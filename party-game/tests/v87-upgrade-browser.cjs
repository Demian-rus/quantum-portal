'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const base='c4220005d43e2a86d448466617698b2ed069455a',root=path.resolve(__dirname,'../..'),URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-v87-upgrade';
const snapshot=p=>p.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),memory:JSON.stringify(taskMemory),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY),approvals:localStorage.getItem(QUIP_CARD_APPROVALS_KEY)}));
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const git=a=>execFileSync('git',a,{cwd:root,maxBuffer:12e6});try{git(['cat-file','-e',base+'^{commit}'])}catch{git(['fetch','--depth=1','origin',base])}
 const files=historicalRuntimeFiles(git,base,['index.html','style.css','sw.js']);assert.equal(files.length,51);
 const current=new Map([...files,'responsive-layout.css'].map(n=>[n,fs.readFileSync(path.join(root,'party-game',n))])),previous=new Map(files.map(n=>[n,git(['show',base+':party-game/'+n])]));
 const write=m=>{for(const[n,bytes]of m)fs.writeFileSync(path.join(root,'party-game',n),bytes)};
 const cache=m=>m.get('sw.js').toString().match(/const CACHE='([^']+)'/)[1],oldCache=cache(previous),newCache=cache(current);assert.match(oldCache,/v87/);assert.match(newCache,/^kvip-pwa-v99-20261028-responsive-candidate$/);
 const b=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{for(const scenario of ['editor','pending']){
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   write(previous);for(const n of files)fs.utimesSync(path.join(root,'party-game',n),new Date('2026-01-01'),new Date('2026-01-01'));
   await p.goto(URL);await provisionProfiles(p);
   await p.evaluate(scenario=>{
    soundOn=false;chooseStartingTeam=()=>0;Math.random=()=>0;Object.assign(options,{modes:[scenario==='editor'?'mime':'approx'],difficulty:'easy',awardTo:'setter',dice:false,complications:true,modifierChance:100,riskRounds:true,finishType:'rounds',rounds:scenario==='editor'?8:2});newGame();game.dice=false;
    for(let i=0;i<2;i++){roll();if(scenario==='editor'){game.phase='judge';recordAnswer(true)}else{revealApprox();awardApprox(i?'none':'a')}}
    if(scenario==='editor'){
     roll();toggleWord();startTimer();pauseTimer();
     saveCardReport(currentReportItem(game),'other','Снимок из v86');
     openResultHistory(0);updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'failed')});
    }
    game.dice=true;options.dice=true;persist();
   },scenario);
   await p.evaluate(()=>document.fonts.ready);
   const fixedBefore=scenario==='pending'?await p.evaluate(()=>{const c=$('play-content').getBoundingClientRect(),t=document.querySelector('.review-tabs').getBoundingClientRect(),b=document.querySelector('[data-action="confirm-results"]').getBoundingClientRect();return {tabs:t.y-c.y,bottom:b.bottom-c.bottom}}):null;
   const before=await snapshot(p),risk=await p.evaluate(()=>JSON.stringify(game.riskPlannerState));assert.equal(await p.evaluate(()=>profileStore.recent.length),0);
   if(scenario==='editor'){assert.equal(await p.evaluate(()=>game.current.risk),true);assert.equal(await p.evaluate(()=>!!game.current.feedbackHold),true);assert.equal(await p.locator('#result-history-rows [data-review-choice]').count(),3);}
   await p.screenshot({path:folder+'/'+scenario+'-before-v87.png',animations:'disabled'});
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);assert.equal(await p.evaluate(n=>caches.has(n),oldCache),true);
   write(current);await p.evaluate(async()=>{const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));await(await navigator.serviceWorker.getRegistration()).update();await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('v87 upgrade timeout')),15000))])});
   await p.waitForFunction(async({oldCache,newCache})=>await caches.has(newCache)&&!await caches.has(oldCache),{oldCache,newCache});await ctx.setOffline(true);await p.reload();await p.locator('#continue-game').click();
   assert.deepEqual(await snapshot(p),before,'Actual v87 RAW, ledger, selected task, draft/pending review and profiles survive upgrade exactly');assert.equal(await p.evaluate(()=>JSON.stringify(game.riskPlannerState)),risk);
   if(scenario==='pending'){await p.evaluate(()=>document.fonts.ready);const fixedAfter=await p.evaluate(()=>{const c=$('play-content').getBoundingClientRect(),t=document.querySelector('.review-tabs').getBoundingClientRect(),b=document.querySelector('[data-action="confirm-results"]').getBoundingClientRect();return {tabs:t.y-c.y,bottom:b.bottom-c.bottom}});assert.ok(Math.abs(fixedAfter.tabs-fixedBefore.tabs)<1,'Published v87 tab anchor retained');assert.ok(Math.abs(fixedAfter.bottom-fixedBefore.bottom)<1,'Published v87 confirmation anchor retained');}
   const list=scenario==='editor'?'#result-history-rows':'.pending-review-rows';assert.equal(await p.locator(list+' [data-review-expand]').count(),scenario==='editor'?1:2);assert.equal(await p.locator(list+' [aria-expanded="true"]').count(),0);
   const cached=await p.evaluate(async name=>{const c=await caches.open(name);return Promise.all([...document.scripts].filter(s=>s.src).map(async s=>!!await c.match(s.src)))},newCache);assert.equal(cached.length,54);assert.ok(cached.every(Boolean));
   await p.screenshot({path:folder+'/'+scenario+'-after-v89-offline.png',animations:'disabled'});
   await p.locator(list+' [data-review-expand="0"]').click();assert.deepEqual(await snapshot(p),before,'Expansion after upgrade is read-only');await p.screenshot({path:folder+'/'+scenario+'-expanded-v89-offline.png',animations:'disabled'});
   if(scenario==='editor'){
    const remaining=await p.evaluate(()=>game.current.feedbackHold.remainingMs);await p.locator('#result-history-cancel').click();assert.equal(await p.evaluate(()=>game.current.paused),true);assert.equal(await p.evaluate(()=>game.current.remainingMs),remaining);assert.equal(await p.evaluate(()=>game.history[0].correct),true);
    assert.equal((await snapshot(p)).profiles,before.profiles);assert.equal((await snapshot(p)).reports,before.reports);
   }else{
    await p.locator('[data-action="confirm-results"]').click();assert.equal(await p.evaluate(()=>profileStore.recent.length),1);const profiles=(await snapshot(p)).profiles;await p.reload();assert.equal((await snapshot(p)).profiles,profiles);
   }
   assert.deepEqual(errors,[]);console.log('v87 → v89',scenario,'real SW upgrade / cold offline / exact RAW + risk + profiles / 49 JS / disclosure / timer or exactly-once result PASS');
  }finally{write(current);await ctx.close();}
 }}finally{write(current);await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
