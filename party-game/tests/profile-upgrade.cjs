'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {historicalRuntimeFiles}=require('./profile-fixtures.cjs');
module.exports=async function profileUpgrade(browser,url){
 const root=path.resolve(__dirname,'../..'),baseline='e24058fd59920d1e8b4d7f2b9c0517eb90454977';
 const git=args=>execFileSync('git',args,{cwd:root,timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
 try{git(['cat-file','-e',baseline+'^{commit}'])}catch{git(['fetch','--depth=1','origin',baseline])}
 const files=historicalRuntimeFiles(git,baseline,['sw.js','index.html','style.css']);
 const current=new Map(files.map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
 const previous=new Map(files.map(name=>[name,git(['show',baseline+':party-game/'+name])]));
 const cache=source=>source.toString().match(/const CACHE='([^']+)'/)[1],oldCache=cache(previous.get('sw.js')),newCache=cache(current.get('sw.js'));
 const write=sources=>{for(const [name,source]of sources)fs.writeFileSync(path.join(root,'party-game',name),source)};
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  write(previous);for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
  await page.goto(url,{waitUntil:'load'});await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.evaluate(()=>{
   soundOn=false;chooseStartingTeam=()=>0;Math.random=()=>.999999;
   Object.assign(options,{modes:['secret'],difficulty:'mixed',dice:false,complications:true});newGame();
   delete game.timerPolicyVersion;game.songLanguagePolicyVersion=1;
   roll();toggleWord();startTimer();pauseTimer();game.dice=true;options.dice=true;persist();
  });
  assert.equal(await page.evaluate(()=>game.current.paused),true);
  await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  const snapshot=await page.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY)}));
  write(current);
  await page.evaluate(async()=>{
   const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   await navigator.serviceWorker.register('./sw.js?qa-profiles-v73',{scope:'./',updateViaCache:'none'});
   if(!navigator.serviceWorker.controller?.scriptURL.includes('qa-profiles-v73'))await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Profile update timed out')),15000))]);
  });
  await page.waitForFunction(async({oldCache,newCache})=>await caches.has(newCache)&&!await caches.has(oldCache),{oldCache,newCache});
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.raw);
  assert.equal(await page.evaluate(()=>localStorage.getItem('kvip-player-profiles:v1')),null);
  assert.equal(await page.locator('[data-action="resume"]').count(),1);
  await page.locator('[data-action="resume"]').click();assert.equal(await page.evaluate(()=>game.current.paused),false);
  const coverage=await page.evaluate(async cacheName=>{
   const cache=await caches.open(cacheName),scripts=Array.from(document.querySelectorAll('script[src]'),el=>el.src);
   return Promise.all(scripts.map(async url=>!!await cache.match(url)));
  },newCache);
  assert.equal(coverage.length,47);assert.ok(coverage.every(Boolean));
  assert.deepEqual(errors,[]);console.log('v72 → current candidate offline upgrade PASS: exact legacy RAW, paused Mixed / Secret song V1, no automatic profiles; precache 47/47');
 }finally{write(current);await context.close()}
};
