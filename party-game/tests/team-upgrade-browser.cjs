'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const {historicalRuntimeFiles}=require('./profile-fixtures.cjs'),{URL,idle,click,start,select,begin,answer,raw,seedDuel}=require('./team-game-browser.cjs');
const root=path.resolve(__dirname,'../..'),base='507c3d24f270a7d26b1562ffc6837c819a15aa5b',git=args=>execFileSync('git',args,{cwd:root,maxBuffer:15e6});
const oldNames=historicalRuntimeFiles(git,base,['index.html','style.css','sw.js']),newNames=[...new Set([...oldNames,'setup-wizard.js','setup-wizard.css','team-format.js','team-storage.js','team-engine.js','team-controller.js','team-game.css'])];
const before=new Map(oldNames.map(f=>[f,git(['show',base+':party-game/'+f])])),current=new Map(newNames.map(f=>[f,fs.readFileSync(path.join(root,'party-game',f))]));
let stamp=Date.UTC(2026,1,1);function write(files){stamp+=2000;for(const [f,bytes]of files){const file=path.join(root,'party-game',f);fs.writeFileSync(file,bytes);fs.utimesSync(file,new Date(stamp),new Date(stamp));}}
async function update(p,cache){await p.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration(),change=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));await reg.update();await Promise.race([change,new Promise((_,reject)=>setTimeout(()=>reject(Error('SW update timeout')),20000))]);});await p.waitForFunction(async name=>await caches.has(name),cache);}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   write(current);await p.goto(URL+'?setup=wizard');await seedDuel(p);await start(p,{mode:'secret',rounds:8,complications:true},[1,1,0]);await answer(p);await select(p);await begin(p);await click(p,'#timer-pause-control');
   const protectedDuel=await p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),teamRaw=await raw(p),teamGame=await p.evaluate(()=>JSON.stringify(game));
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const cached=await p.evaluate(async()=>{const cache=await caches.open('kvip-pwa-v91-20261026-teams-candidate-r5');return Promise.all([...document.scripts].filter(s=>s.src).map(async s=>!!await cache.match(s.src)));});assert.equal(cached.length,53);assert.ok(cached.every(Boolean));
   await ctx.setOffline(true);await p.reload();await click(p,'#continue-teams');assert.equal(await raw(p),teamRaw);assert.equal(await p.evaluate(()=>JSON.stringify(game)),teamGame);await click(p,'#exit-game');
   // Serve the exact published v89 bytes; its worker and old code know nothing
   // about team sessions. Both slots must survive a real cold offline rollback.
   write(before);await ctx.setOffline(false);await update(p,'kvip-pwa-v89-20261026-general-content-release');await ctx.setOffline(true);await p.goto(URL+'?setup=legacy');assert.equal(await p.evaluate(()=>typeof QuipTeams),'undefined');await p.locator('#continue-game').click();
   assert.deepEqual(await p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),protectedDuel);assert.equal(await p.evaluate(()=>localStorage.getItem('kvip:teams-2x2:v1')),teamRaw);assert.equal(await p.evaluate(()=>game.current.paused),true);assert.equal(await p.evaluate(()=>game.roundIndex),1);
   // Returning to the new code resumes the same team task, roster and history.
   write(current);await ctx.setOffline(false);await update(p,'kvip-pwa-v91-20261026-teams-candidate-r5');await ctx.setOffline(true);await p.goto(URL+'?setup=wizard');await click(p,'#continue-teams');assert.equal(await raw(p),teamRaw);assert.equal(await p.evaluate(()=>JSON.stringify(game)),teamGame);
   assert.deepEqual(await p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),protectedDuel);assert.deepEqual(errors,[]);console.log('TASK028 real SW PASS: 53 scripts offline / active team cold restore / exact v89 rollback resumes old duel / team RAW retained / upgrade back resumes exact team');
  }finally{write(current);await ctx.close();}
 }finally{write(current);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
