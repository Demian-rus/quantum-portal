'use strict';
// Release-to-release PWA check. No production mocks: two file sets are served
// at one origin, with a genuine service-worker upgrade and existing localStorage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core');

const ROOT=path.resolve(__dirname,'../..');
const SOURCE=path.join(ROOT,'party-game');
const BEFORE='21044998ab9fee887e60244a4733a239eb290333';
const AFTER_CACHE='kvip-pwa-v60-20261023-timer-view';
const OLD_CACHE='kvip-pwa-v52-20261022-stable-viewport';
const REPLACED=['index.html','app.js','sw.js'];

function oldFile(name){
 const key=BEFORE+':party-game/'+name;
 try{return execFileSync('git',['show',key],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});}
 catch{
  execFileSync('git',['fetch','--no-tags','--depth=1','origin',BEFORE],{cwd:ROOT,stdio:'pipe'});
  return execFileSync('git',['show',key],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});
 }
}
function serverFor(root){
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
 return http.createServer((req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
  catch{res.writeHead(400);res.end();return;}
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const contentType=mime[path.extname(file)]||'application/octet-stream';
  const isBundle=path.extname(file)==='.js'&&!file.endsWith('sw.js');
  res.setHeader('Content-Type',contentType);
  res.setHeader('Cache-Control',isBundle?'public, max-age=86400':'no-store');
  const stream=fs.createReadStream(file);
  stream.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});
  stream.pipe(res);
 });
}
function start(server){
 return new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>resolve(server.address().port));
 });
}
function stop(server){return new Promise(resolve=>server.close(resolve));}
async function readMatch(page){
 return page.evaluate(()=>({
  raw:localStorage.getItem('iskra-party:v1'),
  game:JSON.parse(JSON.stringify(game)),
  current:JSON.parse(JSON.stringify(game.current))
 }));
}
async function upgradingPWA(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'quip-upgrade-'));
 const deployed=path.join(temp,'party-game');
 let browser=null,server=null;
 try{
  fs.cpSync(SOURCE,deployed,{recursive:true});
  const next=new Map(REPLACED.map(name=>[name,fs.readFileSync(path.join(deployed,name))]));
  for(const name of REPLACED)fs.writeFileSync(path.join(deployed,name),oldFile(name));
  server=serverFor(temp);
  const port=await start(server);
  const url='http://127.0.0.1:'+port+'/party-game/';
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
   headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[];
   page.setDefaultTimeout(30000);
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'load'});
   await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{timeout:30000});
   assert.equal(await page.locator('script[src*="rules-guide.js"]').count(),0,'Baseline unexpectedly referenced extracted module');
   assert.ok((await page.evaluate(()=>caches.keys())).includes(OLD_CACHE),'Baseline worker cache not installed');

   await page.evaluate(()=>{
    chooseStartingTeam=()=>0;
    options.modes=['talk'];options.promptTypes=['word'];options.difficulty='easy';
    options.complications=false;options.finishType='rounds';options.rounds=6;
    soundOn=false;newGame();
   });
   await page.locator('[data-action="roll"]').click();
   await page.waitForFunction(()=>game?.phase==='task');
   await page.locator('[data-action="toggle-word"]').click();
   await page.locator('[data-action="start-timer"]').click();
   await page.locator('[data-action="correct-now"]').click();
   await page.locator('[data-action="roll"]').click();
   await page.waitForFunction(()=>game?.phase==='task');
   const before=await readMatch(page);
   assert.equal(before.game.roundIndex,1);
   assert.equal(before.game.history.length,1);
   assert.equal(before.game.phase,'task');
   assert.ok(before.current.word);
   assert.equal(JSON.parse(before.raw).version,1);

   // Deploy all new modules at the same origin, then let the actual PWA update.
   for(const [name,contents]of next)fs.writeFileSync(path.join(deployed,name),contents);
   await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration)throw Error('Missing original registration');
    const changed=new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('No PWA controllerchange after deployment')),30000);
     navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
    });
    await registration.update();
    await changed;
   });
   await page.waitForFunction(async()=>{
    const keys=await caches.keys();
    return keys.includes('kvip-pwa-v60-20261023-timer-view')&&!keys.includes('kvip-pwa-v52-20261022-stable-viewport');
   },{timeout:30000});
   const expectedScripts=[...fs.readFileSync(path.join(deployed,'index.html'),'utf8')
    .matchAll(/<script src="(\.\/[^\"]+\.js\?v=\d+)" defer><\/script>/g)].map(match=>match[1]);
   assert.ok(expectedScripts.length>=20,'Expected full new release script list');
   const cached=await page.evaluate(async urls=>{
    const cache=await caches.open('kvip-pwa-v60-20261023-timer-view');
    return (await Promise.all(urls.map(async url=>
     ({url,has:!!(await cache.match(url))})))).filter(x=>!x.has).map(x=>x.url);
   },expectedScripts);
   assert.deepEqual(cached,[],'New worker must cache every new release script before offline reload');

   await page.reload({waitUntil:'load'});
   await page.waitForFunction(()=>document.body.dataset.screen==='home');
   const online=await readMatch(page);
   assert.equal(online.raw,before.raw,'Upgrade must not rewrite the saved JSON envelope');
   assert.deepEqual(online.game,before.game,'Upgrade must not change session');
   assert.equal(await page.evaluate(()=>typeof showReady),'function');
   assert.equal(await page.evaluate(()=>typeof registerSetupControls),'function');
   assert.equal(await page.evaluate(()=>typeof showReady),'function');
   assert.equal(await page.evaluate(()=>typeof showTask),'function');
   assert.equal(await page.evaluate(()=>typeof showJudge),'function');
   for(const fn of ['showTimer','showCountdown','updateTimerVisual'])
    assert.equal(await page.evaluate(name=>typeof window[name],fn),'function',fn+' missing after upgrade');
   for(const name of ['renderMatch','showBetween','historyMarkup','showResults']){
    assert.equal(await page.evaluate(name=>typeof window[name],name),'function',name+' missing after upgrade');
   }
   await page.locator('#continue-game').click();
   assert.deepEqual((await readMatch(page)).game,before.game,'Continue changed game after upgrade');

   await context.setOffline(true);
   await page.reload({waitUntil:'load'});
   await page.locator('#continue-game').click();
   const offline=await readMatch(page);
   assert.deepEqual(offline.game,before.game,'Offline upgrade lost the active round');
   assert.equal(offline.raw,before.raw,'Offline upgrade rewrote saved bytes');
   assert.deepEqual(errors,[],'Uncaught browser errors after PWA update');
   console.log('PWA cross-release upgrade PASS: old cache v52 -> new v60, earned score/history/next card, reload + offline Continue');
  }finally{await context.close();}
 }finally{
  if(browser)await browser.close();
  if(server)await stop(server);
  fs.rmSync(temp,{recursive:true,force:true});
 }
}
upgradingPWA().catch(e=>{console.error(e);process.exitCode=1;});
