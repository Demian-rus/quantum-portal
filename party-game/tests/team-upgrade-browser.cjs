'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const {historicalRuntimeFiles}=require('./profile-fixtures.cjs'),{URL,idle,click,start,select,begin,answer,raw,seedDuel,config,names}=require('./team-game-browser.cjs');
const root=path.resolve(__dirname,'../..'),git=args=>execFileSync('git',args,{cwd:root,maxBuffer:15e6});
async function run(base,label){
const oldNames=historicalRuntimeFiles(git,base,['index.html','style.css','sw.js']),newNames=[...new Set([...oldNames,'setup-wizard.js','setup-wizard.css','team-format.js','team-storage.js','team-engine.js','team-controller.js','team-game.css'])];
const before=new Map(oldNames.map(f=>[f,git(['show',base+':party-game/'+f])])),current=new Map([...newNames,'responsive-layout.css'].map(f=>[f,fs.readFileSync(path.join(root,'party-game',f))]));
let stamp=Date.UTC(2026,1,1);function write(files){stamp+=2000;for(const [f,bytes]of files){const file=path.join(root,'party-game',f);fs.writeFileSync(file,bytes);fs.utimesSync(file,new Date(stamp),new Date(stamp));}}
async function update(p,cache){await p.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration(),change=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));await reg.update();await Promise.race([change,new Promise((_,reject)=>setTimeout(()=>reject(Error('SW update timeout')),20000))]);});await p.waitForFunction(async name=>await caches.has(name),cache);}
// Read through the native API even while the old app has no team modules.
// Abort creation so a missing database cannot be mistaken for preservation.
async function receipt(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('kvip-teams-durability:v1');q.onupgradeneeded=()=>{q.transaction.abort();reject(Error('Team receipt DB was lost'));};q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result;try{const tx=db.transaction('receipts','readonly'),get=tx.objectStore('receipts').get('kvip:teams-2x2:v1');let value;get.onsuccess=()=>{value=get.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=()=>{db.close();reject(tx.error);};}catch(e){db.close();reject(e);}};}));}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   write(before);await p.goto(URL);await seedDuel(p);
   let original=await p.evaluate(()=>JSON.stringify([game,taskMemory,localStorage.getItem(STORAGE_KEY),localStorage.getItem(QUIP_PROFILES_KEY)]));
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   let legacyTeam=false;
   if(before.has('team-controller.js')){
    // Seed a real names-only v1 party under the exact historical UI BEFORE
    // upgrading. New v2 parties intentionally cannot be opened by old code.
    await p.locator('#new-game-menu').click();await p.locator('#standard-game').click();await p.locator('#wizard-format-teams').click();
    const legacyNames=await p.evaluate(()=>[selectedPlayerProfiles().map(p=>p.name),['Мама','Папа']]);
    for(let t=0;t<2;t++)for(let n=0;n<2;n++)await p.locator('#team-name-'+t+'-'+n).fill(legacyNames[t][n]);
    await config(p,{mode:'secret',rounds:8,complications:true});await click(p,'#start-game');await answer(p);await select(p);await begin(p);await click(p,'.timer-ring[role="button"]');await click(p,'#exit-game');legacyTeam=true;
   }
   const observed=await p.evaluate(()=>[game,taskMemory,localStorage.getItem(STORAGE_KEY),localStorage.getItem(QUIP_PROFILES_KEY)]),prior=JSON.parse(original);for(const i of [0,1,3])assert.deepEqual(observed[i],prior[i],'historical team setup preserves duel game, memory and profiles');original=JSON.stringify(observed);
   write(current);await update(p,'kvip-pwa-v104-20261029-touch-highlight-candidate');await ctx.setOffline(true);await p.reload();await click(p,'#continue-game');
   assert.equal(await p.evaluate(()=>JSON.stringify([game,taskMemory,localStorage.getItem(STORAGE_KEY),localStorage.getItem(QUIP_PROFILES_KEY)])),original,label+' initial upgrade preserves exact duel');await click(p,'#exit-game');
   if(legacyTeam){await click(p,'#continue-teams');assert.equal(await p.evaluate(()=>game.teamFormat.version),1,'legacy party must never acquire profiles by name');assert.equal(await p.evaluate(()=>game.teamFormat.profileBinding),undefined,'even matching profile names cannot create an association');}
   else{await start(p,{mode:'secret',rounds:8,complications:true},[1,1,0]);await answer(p);await select(p);await begin(p);await click(p,'.timer-ring[role="button"]');}
   const protectedDuel=await p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),teamRaw=await raw(p),teamGame=await p.evaluate(()=>JSON.stringify(game)),receiptRaw=await receipt(p);assert.equal(typeof receiptRaw,'string');
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const cached=await p.evaluate(async()=>{const cache=await caches.open('kvip-pwa-v104-20261029-touch-highlight-candidate');return Promise.all([...document.scripts].filter(s=>s.src).map(async s=>!!await cache.match(s.src)));});assert.equal(cached.length,54);assert.ok(cached.every(Boolean));
   await ctx.setOffline(true);await p.reload();await click(p,'#continue-teams');assert.equal(await raw(p),teamRaw);assert.equal(await p.evaluate(()=>JSON.stringify(game)),teamGame);await click(p,'#exit-game');
   // Serve the exact published v89 bytes; its worker and old code know nothing
   // about team sessions. Both slots must survive a real cold offline rollback.
   write(before);await ctx.setOffline(false);await update(p,before.get('sw.js').toString().match(/const CACHE='([^']+)'/)[1]);await ctx.setOffline(true);await p.goto(URL+'?setup=legacy');assert.equal(await p.evaluate(()=>typeof QuipTeams),before.has('team-controller.js')?'object':'undefined');await p.locator('#continue-game').click();
   assert.deepEqual(await p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),protectedDuel);assert.equal(await p.evaluate(()=>localStorage.getItem('kvip:teams-2x2:v1')),teamRaw);assert.equal(await p.evaluate(()=>game.current.paused),true);assert.equal(await p.evaluate(()=>game.roundIndex),1);assert.equal(await receipt(p),receiptRaw,'exact v89 leaves the transactional team receipt untouched');
   if(before.has('team-controller.js')){
    // Historical runtimes only understand the general pack versions they shipped with.
    // Newer general@47 sessions must be restored by the new client, not opened
    // under obsolete code; the historical client must still preserve the data.
    assert.equal(await raw(p),teamRaw,'historical client preserves team RAW');
    assert.equal(await receipt(p),receiptRaw,'historical client preserves native IndexedDB receipt');
   }
   // Returning to the new code resumes the same team task, roster and history.
   write(current);await ctx.setOffline(false);await update(p,'kvip-pwa-v104-20261029-touch-highlight-candidate');await ctx.setOffline(true);await p.goto(URL+'?setup=wizard');await click(p,'#continue-teams');assert.equal(await raw(p),teamRaw);assert.equal(await p.evaluate(()=>JSON.stringify(game)),teamGame);
   assert.deepEqual(await p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),protectedDuel);assert.equal(await receipt(p),receiptRaw,'upgrade back preserves the exact transactional receipt');assert.deepEqual(errors,[]);console.log(label,'TASK028 real SW PASS: 54 scripts offline / active team cold restore / exact v89 rollback resumes old duel / team RAW retained / upgrade back resumes exact team');
  }finally{write(current);await ctx.close();}
 }finally{write(current);await browser.close();}
}
(async()=>{await run('507c3d24f270a7d26b1562ffc6837c819a15aa5b','v89');await run('b71e9ee16a2492bbe03de7cf0cd48316d0f6ac22','published TASK030');await run('47a7266b48818b3ebc94e1e37e1f5c3f769ee812','published TASK028 main → TASK031');})().catch(e=>{console.error(e);process.exitCode=1;});
