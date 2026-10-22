'use strict';
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},{name:'desktop',width:1440,height:900}];
async function openSetup(page){await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();}
async function advanced(page){await page.locator('#go-advanced').click();}
async function frequency(page,value){await page.locator('#modifier-chance').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},String(value));}
async function align(page){
 await page.locator('.modifier-settings').evaluate(el=>{const scroller=document.getElementById('advanced-scroll');scroller.scrollTop+=el.getBoundingClientRect().top-scroller.getBoundingClientRect().top-10});
}
async function shot(page,name){
 await align(page);await page.locator('#scene-advanced').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await capture(page,{path:'artifacts/quip-mobile-layout/task007c-'+name+'.png'});
}
async function offlineUpgrade(browser,url){
 const path=require('node:path'),{execFileSync}=require('node:child_process');
 const root=path.resolve(__dirname,'../..'),legacyCommit='b532dbc474e577db2d21ead89b63993d13575d9d';
 // The Actions checkout is shallow. Fetch this immutable pre-C fixture only when
 // necessary, without switching branches or changing the checkout's files.
 const git=args=>execFileSync('git',args,{cwd:root,timeout:30000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
 try{git(['cat-file','-e',legacyCommit+'^{commit}'])}catch{git(['fetch','--depth=1','origin',legacyCommit])}
 const files=['sw.js','index.html','style.css','app.js','modifiers.js','cards.js','approx-questions.js','content-packs.js'];
 const current=new Map(files.map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
 const legacy=new Map(files.map(name=>[name,git(['show',legacyCommit+':party-game/'+name])]));
 const cache=source=>source.toString().match(/const CACHE='([^']+)'/)[1];
 const oldCache=cache(legacy.get('sw.js')),currentCache=cache(current.get('sw.js'));
 const write=sources=>{for(const [name,source] of sources)fs.writeFileSync(path.join(root,'party-game',name),source)};
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 try{
  // Install the actual stage-B bundle and worker, then update to stage C.
  // All other precached production resources are unchanged between these commits.
  write(legacy);
  // Give historical assets a historical Last-Modified value. The local static
  // server has one-second precision; two writes within a second can yield a
  // false HTTP 304 despite different bytes during this synthetic deployment.
  for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
  await page.goto(url,{waitUntil:'load'});await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  assert.ok(await page.evaluate(key=>caches.has(key),oldCache));
  await page.evaluate(()=>{
   soundOn=false;options.modes=['talk'];options.dice=false;Math.random=()=>0;chooseStartingTeam=()=>0;newGame();roll();
   game.dice=true;options.dice=true;game.phase='judge';game.current.finishedReason='timeout';persist();render();
  });
  assert.equal(await page.evaluate(()=>game.modifierSelectionVersion),undefined);
  const snapshot=await page.evaluate(()=>({stored:localStorage.getItem(STORAGE_KEY),game:JSON.stringify(game)}));
  write(current);
  await page.evaluate(async()=>{
   const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   await navigator.serviceWorker.register('./sw.js?qa-task007-upgrade',{scope:'./',updateViaCache:'none'});
   if(!navigator.serviceWorker.controller?.scriptURL.includes('qa-task007-upgrade'))
    await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker update timed out')),15000))]);
  });
  await page.waitForFunction(async ({oldCache,currentCache})=>(await caches.has(currentCache))&&!(await caches.has(oldCache)),{oldCache,currentCache});
  assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.stored);
  const cachedIndex=await page.evaluate(async key=>{const response=await (await caches.open(key)).match('./index.html');return response.text()},currentCache);
  assert.ok(cachedIndex.includes(current.get('index.html').toString().match(/src="([^"]*app\.js[^"]*)"/)[1]),'New worker must cache the deployed index');
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);assert.equal(await page.evaluate(()=>game.modifierSelectionVersion),undefined);
  assert.equal(await page.evaluate(()=>options.modifierChance),20);
  await page.locator('[data-action="base"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[1,0]);
  console.log('task007c offline worker update PASS',legacyCommit,oldCache,'→',currentCache,'pre-C party preserved');
 }finally{write(current);await context.close();}
}
module.exports=async function frequencyUI(browser,url){
 fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
 for(const device of devices){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.name==='phone'?2:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'load'});await openSetup(page);await advanced(page);
   const checkbox=page.locator('#toggle-complications'),slider=page.locator('#modifier-chance');
   assert.equal(await checkbox.isChecked(),true);assert.equal(await slider.inputValue(),'20');assert.equal(await page.locator('#modifier-chance-value').textContent(),'20%');
   for(const [name,value] of [['min','10'],['max','100'],['step','5']])assert.equal(await slider.getAttribute(name),value);
   assert.equal(await slider.isVisible(),true);if(device.name==='phone')await shot(page,'phone-20');
   await frequency(page,100);assert.equal(await page.locator('#modifier-chance-value').textContent(),'100%');
   if(device.name==='phone')await shot(page,'phone-100');
   await checkbox.uncheck();assert.equal(await slider.isVisible(),false);assert.equal(await page.evaluate(()=>options.modifierChance),100);
   if(device.name==='phone')await shot(page,'phone-off');
   await checkbox.check();assert.equal(await slider.inputValue(),'100');
   await frequency(page,35);await page.locator('#advanced-done').click();await advanced(page);assert.equal(await slider.inputValue(),'35');
   await page.reload({waitUntil:'load'});await openSetup(page);await advanced(page);assert.equal(await slider.inputValue(),'35');
   await align(page);
   const g=await page.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
    return {box:rect('.modifier-settings .modifier-toggle'),frequency:rect('#modifier-chance-settings'),range:rect('#modifier-chance'),w:innerWidth,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,h:innerHeight};
   });
   assert.ok(g.frequency.top>=g.box.bottom+5&&g.range.left>=0&&g.range.right<=g.w&&g.sw<=g.w+1&&g.sh<=g.h+1,JSON.stringify(g));
   await frequency(page,100);await page.locator('#advanced-done').click();
   await page.evaluate(()=>{soundOn=false;options.modes=['talk'];options.dice=false;chooseStartingTeam=()=>0;Math.random=()=>.9999});
   await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();
   assert.equal(await page.evaluate(()=>game.modifierChance),100);assert.equal(await page.evaluate(()=>game.modifierSelectionVersion),1);assert.ok(await page.evaluate(()=>game.current.complication));
   await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});
   const snapshot=await page.evaluate(()=>({game:JSON.stringify(game),round:JSON.stringify(game.current),recent:JSON.stringify(game.modifierRecent)}));
   await page.locator('#exit-game').click();await openSetup(page);await advanced(page);await frequency(page,20);await checkbox.uncheck();await page.locator('#advanced-done').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game,'Future frequency changed active party');
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(game.current)),snapshot.round);assert.equal(await page.evaluate(()=>JSON.stringify(game.modifierRecent)),snapshot.recent);assert.equal(await page.evaluate(()=>game.modifierChance),100);
   await page.locator('[data-action="toggle-word"]').click();await page.locator('[data-action="start-timer"]').click();await page.locator('[data-action="base-now"]').click();
   assert.deepEqual(await page.evaluate(()=>game.scores),[1,0]);
   // The special modes keep their conditions even offline and with opposite flags.
   await page.evaluate(()=>{options.modes=['secret'];options.complications=false;options.modifierChance=10;options.dice=false;newGame();roll()});
   assert.ok(await page.evaluate(()=>game.current.complication));
   await page.evaluate(()=>{options.modes=['approx'];options.complications=true;options.modifierChance=100;newGame();roll()});
   assert.equal(await page.evaluate(()=>game.current.complication),'');assert.equal(await page.evaluate(()=>game.current.usesTimer),false);
   assert.deepEqual(errors,[]);console.log('task007c frequency PASS',device.name);
  }finally{await context.close();}
 }
 await offlineUpgrade(browser,url);
};
