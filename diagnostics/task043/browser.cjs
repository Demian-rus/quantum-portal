'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright-core'),T=require('../task038/browser-tools.cjs');
const added=new Set(require('../../party-game/content/cards/task043-quality-v1.json').map(r=>r.id));
async function run(){
 const engine=process.env.ENGINE||'chromium',server=await T.serve(T.ROOT),browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,args:engine==='chromium'?['--no-sandbox']:[]}),out=path.join('artifacts/quip-task043',engine),report={engine,sizes:[],checks:[]};fs.mkdirSync(out,{recursive:true});
 try{for(const [width,height]of [[320,568],[360,640],[390,844],[412,915]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(server.url);await p.evaluate(()=>QuipTeams.whenReady());
   await p.evaluate(()=>{for(const [n,name]of ['Первый','Второй','Третий','Четвёртый'].entries())createPlayerProfile(name,['coral','cyan','violet','green'][n]);selectedProfileIds=profileStore.profiles.slice(0,2).map(p=>p.id);soundOn=false;writeTaskDifficultyPreference('talk','medium');});
   for(const kind of ['duel','teams']){
    await T.wizard(p,kind);await T.configure(p,{modes:['talk'],difficulty:'easy'});await T.tap(p,'#start-game');
    const pinned=await p.evaluate(()=>({version:game.contentPack.edition.version,pack:game.contentPack.pack,rows:editorialPool(game,'talk','medium').map(r=>r.id)}));assert.equal(pinned.version,2);assert.equal(pinned.pack.version,69);assert(pinned.rows.some(id=>added.has(id)));
    // Draw the longest actual new phrase without altering source or mechanics.
    const selected=await p.evaluate(async ids=>{const pool=editorialPool(game,'talk','medium').filter(r=>ids.includes(r.id)).sort((a,b)=>b.text.length-a.text.length),original=editorialPool;try{editorialPool=(match,mode,level,method)=>mode==='talk'?[pool[0]]:original(match,mode,level,method);game.dice=false;roll();await QuipTeams.whenIdle();return {expected:pool[0].id,actual:game.current.cardId};}finally{editorialPool=original;game.dice=true;}},[...added]);assert.equal(selected.actual,selected.expected);
    await T.tap(p,'[data-action="toggle-word"]');await T.tap(p,'.timer-ring[role="button"]');await p.waitForFunction(()=>game.phase==='play');await T.tap(p,'.timer-ring[role="button"]');assert.equal(await p.evaluate(()=>game.current.paused),true);await T.inspect(p,out,width+'-'+kind,1,{baseline:true});
    const snapshot=await p.evaluate(()=>JSON.stringify(game.current)),selection=await p.evaluate(()=>JSON.stringify(game.contentPack));await p.reload();await p.evaluate(()=>QuipTeams.whenReady());await T.tap(p,kind==='teams'?'#continue-teams':'#continue-game');assert.equal(await p.evaluate(()=>JSON.stringify(game.current)),snapshot);assert.equal(await p.evaluate(()=>JSON.stringify(game.contentPack)),selection);await T.tap(p,'#exit-game');
   }
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const raw=await T.raw(p);server.setUnavailable(true);const missed=server.failedRequests();await p.reload();await p.evaluate(()=>QuipTeams.whenReady());assert(server.failedRequests()>missed,'real server outage occurred');assert.deepEqual(await T.raw(p),raw);
   const cached=await p.evaluate(async()=>{const c=await caches.open('kvip-pwa-v119-20261103-task044-stability');return Promise.all([...document.scripts].filter(s=>s.src).map(async s=>!!await c.match(s.src)));});assert.equal(cached.length,63);assert(cached.every(Boolean));
   await T.tap(p,'#continue-game');assert.equal(await p.evaluate(()=>game.contentPack.edition.version),2);assert.deepEqual(errors,[]);report.sizes.push({width,height,success:true});
  }finally{server.setUnavailable(false);await ctx.close();}
 }report.success=true;report.checks=['actual new edition and new source selection in 1x1/2x2','longest new medium phrase geometry at 320/360/390/412','exact current task and edition after reload','real server outage, 63 scripts cached, offline party restoration'];
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify(report));}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1});
