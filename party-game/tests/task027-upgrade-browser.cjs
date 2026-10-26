'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const base='507c3d24f270a7d26b1562ffc6837c819a15aa5b',root=path.resolve(__dirname,'../..'),URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const git=a=>execFileSync('git',a,{cwd:root,maxBuffer:15e6});
const files=historicalRuntimeFiles(git,base,['index.html','style.css','sw.js']);
const before=new Map(files.map(f=>[f,git(['show',base+':party-game/'+f])])),current=new Map(files.map(f=>[f,fs.readFileSync(path.join(root,'party-game',f))]));
// SimpleHTTPServer's Last-Modified has one-second precision. Advancing each
// served bundle explicitly prevents a false 304 when a fast upgrade/rollback
// rewrites different SW bytes in the same second. Never sleep or bypass the SW.
let fixtureStamp=Date.UTC(2026,0,1);
const write=m=>{fixtureStamp+=2000;for(const [f,b] of m){const file=path.join(root,'party-game',f);fs.writeFileSync(file,b);fs.utimesSync(file,new Date(fixtureStamp),new Date(fixtureStamp));}};
const snapshot=p=>p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),game:JSON.stringify(game),profiles:localStorage.getItem(QUIP_PROFILES_KEY),memory:JSON.stringify(taskMemory)}));
async function update(p,name){await p.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();const change=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));await registration.update();await Promise.race([change,new Promise((_,reject)=>setTimeout(()=>reject(Error('PWA change timeout')),20000))]);});await p.waitForFunction(async name=>await caches.has(name),name);}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   write(before);await p.goto(URL);await provisionProfiles(p);await p.evaluate(()=>{soundOn=false;Math.random=()=>0;Object.assign(options,{modes:['talk'],difficulty:'easy',dice:true,complications:false,riskRounds:false,finishType:'rounds',rounds:8});newGame();game.dice=false;roll();game.phase='judge';recordAnswer(true);roll();toggleWord();startTimer();pauseTimer();game.dice=true;options.dice=true;persist();});
   const protectedState=await snapshot(p);assert.equal(await p.evaluate(()=>game.roundIndex),1);assert.equal(await p.evaluate(()=>game.current.paused),true);
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   write(current);await update(p,'kvip-pwa-v91-20261026-teams-receipt-candidate');await ctx.setOffline(true);await p.goto(URL+'?setup=wizard');await p.locator('#continue-game').click();assert.deepEqual(await snapshot(p),protectedState,'v89 actual paused task and earned history survive upgrade exactly');
   await p.locator('#exit-game').click();await p.locator('#new-game-menu').click();await p.locator('#standard-game').click();await p.locator('[data-wizard-step="3"]').click();
   const beforeToggle=await snapshot(p);await p.locator('#wizard-legacy').click();await p.locator('#scene-advanced:visible').waitFor();assert.deepEqual(await snapshot(p),beforeToggle,'Offline UI rollback writes no data');
   await p.reload();await p.locator('#continue-game').click();assert.deepEqual(await snapshot(p),beforeToggle,'Offline opt-out survives reload');
   // Serve the exact old v89 bundle, let its real SW take control, then cold offline.
   write(before);await ctx.setOffline(false);await update(p,'kvip-pwa-v89-20261026-general-content-release');await ctx.setOffline(true);await p.reload();await p.locator('#continue-game').click();assert.deepEqual(await snapshot(p),beforeToggle,'Old v89 reads the unchanged schema and resumes exact task/history/profiles');
   assert.equal(await p.locator('#scene-wizard').count(),0);assert.deepEqual(errors,[]);console.log('TASK027 v89 → wizard candidate → offline legacy UI → exact v89 rollback: RAW, earned history, paused timer, profiles and task memory PASS');
  }finally{write(current);await ctx.close();}
 }finally{write(current);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
