'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-risk-planner';
const snapshot=p=>p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),game:JSON.stringify(game),profiles:localStorage.getItem(QUIP_PROFILES_KEY),memory:JSON.stringify(taskMemory)}));
async function settle(page,choice='no'){
 await page.locator('[data-action="roll"]').click();await page.locator('.challenge-card').click();
 await page.locator('[data-action="start-timer"]').click();await page.evaluate(()=>finishTimer('early'));
 await page.locator('[data-action="'+choice+'"]').click();
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{for(const [id,width,height]of [['320',320,568],['390',390,844],['landscape',844,390]]){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(URL);await provisionProfiles(page);
   await page.evaluate(()=>{soundOn=false;chooseStartingTeam=()=>0;Math.random=()=>0;Object.assign(options,{modes:['talk'],awardTo:'guesser',dice:false,difficulty:'easy',complications:false,riskRounds:true,finishType:'rounds',rounds:6});newGame()});
   await settle(page,'yes');await settle(page,'yes');await page.locator('[data-action="roll"]').click();
   assert.equal(await page.evaluate(()=>game.current.risk),true);assert.deepEqual(await page.evaluate(()=>game.riskPlannerState),{eligible:[0,1],risks:[0,1]});
   await page.locator('.challenge-card').click();await page.locator('[data-action="start-timer"]').click();
   const plan=await page.evaluate(()=>JSON.stringify(game.riskPlannerState));
   await page.locator('[data-feedback="report"]').click();const remain=await page.evaluate(()=>game.current.feedbackHold.remainingMs);
   await page.evaluate(()=>history.back());await page.waitForFunction(()=>!game.current.feedbackHold);assert.ok(await page.evaluate(()=>game.current.deadline-Date.now())>remain-1500);
   await page.locator('#match-team-a').click();await page.locator('#result-history-tabs [data-review-tab="1"]').click();
   await page.locator('[data-review-turn="0"] [data-review-choice="failed"]').click();
   await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});
   const held=await snapshot(page);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),held);
   await page.locator('#result-history-save').click();assert.equal(await page.evaluate(()=>JSON.stringify(game.riskPlannerState)),plan);
   assert.equal(await page.evaluate(()=>game.scores[1]),0);await page.evaluate(()=>finishTimer('early'));await page.locator('[data-action="no"]').click();
   assert.equal(await page.evaluate(()=>game.history[2].penalty),0,'TASK020 recalculates existing risk floor after correction');
   const state=await snapshot(page);await page.locator('#exit-game').click();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),state);
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),state,'New risk ledger survives cold offline reload byte-for-byte');
   await page.evaluate(()=>{game.dice=false;Math.random=()=>0});await settle(page,'no');await settle(page,'no');await settle(page,'yes');
   assert.equal(await page.evaluate(()=>game.phase),'review');assert.equal(await page.evaluate(()=>validateGameRiskPlan(game)||true),true);
   await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});
   const pending=await snapshot(page);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),pending);
   await page.screenshot({path:folder+'/'+id+'-review-offline.png',animations:'disabled'});
   await page.locator('[data-action="confirm-results"]').click();assert.equal(await page.evaluate(()=>profileStore.recent.length),1);
   const profiles=await page.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY));await page.reload();assert.equal(await page.evaluate(()=>storageBlocked),false);assert.equal(await page.evaluate(()=>game.phase),'results');assert.equal(await page.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY)),profiles);
   assert.deepEqual(errors,[]);console.log('TASK019',id,'recipient / risk / history correction / timer hold / Back / restart / offline / pending review / exactly-once profiles PASS');
  }finally{await ctx.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
