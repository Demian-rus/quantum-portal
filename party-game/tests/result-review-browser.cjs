'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-result-review';
const snapshot=p=>p.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY)}));
async function start(page,mode='talk',difficulty='easy',modifier=true,awardTo='setter'){
 await page.evaluate(({mode,difficulty,modifier,awardTo})=>{
  soundOn=false;chooseStartingTeam=()=>0;Object.assign(options,{modes:[mode],difficulty,awardTo,modifierChance:modifier?100:0,complications:modifier,dice:false,finishType:'rounds',rounds:8,riskRounds:false});newGame();game.dice=false;persist();
 },{mode,difficulty,modifier,awardTo});
}
async function settle(page,result='yes'){
 await page.locator('[data-action="roll"]').click();
 await page.evaluate(()=>{game.phase='judge';persist();render()});
 await page.locator('[data-action="'+result+'"]').click();
}
async function rectCheck(page,id){
 const data=await page.evaluate(()=>{
  const r=el=>{const a=el.getBoundingClientRect();return {x:a.x,y:a.y,right:a.right,bottom:a.bottom,width:a.width,height:a.height}};
  const dialog=document.querySelector('.result-history-dialog'),rows=document.querySelector('#result-history-rows'),save=document.querySelector('#result-history-save');
  return {dialog:r(dialog),rows:r(rows),save:r(save),close:r(document.getElementById("result-history-close")),title:r(document.getElementById("result-history-title")),labels:[...rows.querySelectorAll(".review-choice>span:not(.review-choice-icon),.review-choice small")].map(el=>({client:el.clientWidth,scroll:el.scrollWidth})),height:innerHeight,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.equal(data.overflow,false,id);assert.ok(data.dialog.x>=0&&data.dialog.right<=data.width+1,id+' horizontal');
 assert.ok(data.dialog.y>=0&&data.dialog.bottom<=data.height+1,id+' vertical');assert.ok(data.rows.bottom<=data.save.y+1,id+' footer gap');assert.ok(data.rows.height>=90,id+' usable history viewport');
 assert.ok(data.save.height>=44&&data.close.height>=44&&data.close.width>=44,id+' touch targets');assert.ok(data.title.right<=data.close.x+1,id+' close/title gap');assert.ok(data.labels.every(el=>el.scroll<=el.client+1),id+' whole result labels');return data;
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const geometry=[];
 try{
  for(const [id,width,height]of [['320',320,568],['390',390,844],['landscape',844,390]]){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:2.625}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(URL);await provisionProfiles(page);await start(page);
   await page.evaluate(()=>{game.dice=true;persist()});await page.locator('[data-action="roll"]').click();
   assert.equal(await page.evaluate(()=>game.phase),'rolling');
   const rolling=await page.evaluate(()=>JSON.stringify({card:game.current,used:game.used,plan:game.plannerState,mode:game.modePlannerState}));
   await page.locator('#match-team-a').click();assert.equal(await page.evaluate(()=>game.phase),'task');await page.locator('#result-history-cancel').click();
   assert.equal(await page.evaluate(()=>JSON.stringify({card:game.current,used:game.used,plan:game.plannerState,mode:game.modePlannerState})),rolling,'History during the reel retains the selected task and planner');
   assert.equal(await page.locator('.challenge-card').isVisible(),true);await start(page);
   await settle(page);await settle(page);
   const stored=await page.evaluate(()=>({scores:game.scores,stats:localStorage.getItem(QUIP_PROFILES_KEY)}));
   await page.locator('#match-team-a').click();geometry.push({id,...await rectCheck(page,id)});
   assert.equal(await page.locator('[data-review-turn="0"] .review-choice').count(),3);
   assert.equal(await page.evaluate(()=>document.querySelector('.site-shell').inert),true);
   await page.locator('#result-history-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'result-history-save');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'result-history-close');
   assert.equal(await page.locator('[data-review-turn="0"] [data-review-choice="complete"]').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:folder+'/'+id+'-history-before.png',animations:'disabled'});
   await page.locator('[data-review-turn="0"] [data-review-choice="base"]').click();
   assert.equal(await page.locator('[data-review-turn="0"] [data-review-choice="base"]').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:folder+'/'+id+'-history-after.png',animations:'disabled'});
   await page.locator('#result-history-save').click();assert.equal(await page.evaluate(()=>game.scores[0]),stored.scores[0]-1);
   await page.locator('#match-team-b').click();await page.locator('[data-review-turn="1"] [data-review-choice="failed"]').click();await page.keyboard.press('Escape');
   assert.deepEqual(await page.evaluate(()=>game.scores),[stored.scores[0]-1,stored.scores[1]],'Escape cancels staged result');
   await page.locator('#match-team-a').click();await page.locator('[data-review-turn="0"] [data-review-choice="failed"]').click();await page.evaluate(()=>history.back());await page.waitForFunction(()=>document.getElementById('result-history-backdrop').hidden);
   assert.equal(await page.evaluate(()=>game.history[0].outcome),'base-only');
   // A real running Hard countdown is held by history, independently of Easy pause.
   await start(page,'talk','easy',false);await settle(page);await page.locator('#match-team-a').click();
   assert.equal(await page.locator('[data-review-turn="0"] .review-choice').count(),2,'Unmodified words retain two outcomes');await page.locator('#result-history-cancel').click();
   await start(page,'blitz');await page.locator('[data-action="roll"]').click();await page.locator('.challenge-card').click();await page.locator('[data-action="start-timer"]').click();await page.locator('[data-action="blitz-correct"]').click();
   await page.evaluate(()=>finishTimer('early'));await page.locator('[data-action="no"]').click();
   const blitz=await page.evaluate(()=>({words:game.history[0].blitzWords,ids:game.history[0].blitzCardIds,points:game.history[0].review.round.points}));
   await page.locator('#match-team-a').click();await page.locator('[data-review-expand="0"]').click();assert.equal(await page.locator('[data-review-choice="1"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-review-choice="3"]').click();await page.locator('#result-history-save').click();
   assert.equal(await page.evaluate(()=>game.scores[0]),blitz.points);assert.deepEqual(await page.evaluate(()=>game.history[0].blitzWords),blitz.words);assert.deepEqual(await page.evaluate(()=>game.history[0].blitzCardIds),blitz.ids);
   await start(page,'mime','hard',true,'guesser');await settle(page);await page.locator('[data-action="roll"]').click();await page.locator('.challenge-card').click();
   await page.waitForFunction(()=>game.phase==='play');assert.equal(await page.locator('#timer-pause-control').isVisible(),false);
   await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});
   await page.locator('#match-team-b').click();const remaining=await page.evaluate(()=>game.current.feedbackHold.remainingMs);assert.ok(remaining>0);
   await page.locator('#result-history-tabs [data-review-tab="1"]').click();await page.locator('[data-review-turn="0"] [data-review-choice="failed"]').click();
   const held=await snapshot(page);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),held,'Restored held edit remains byte-exact');
   assert.equal(await page.locator('#report-backdrop').isVisible(),false);assert.equal(await page.locator('#result-history-backdrop').isVisible(),true);
   await page.locator('#result-history-save').click();assert.equal(await page.evaluate(()=>game.history[0].correct),false);
   const left=await page.evaluate(()=>game.current.deadline-Date.now());assert.ok(left<=remaining&&left>remaining-1500,'History release retains time');
   // Existing complaint hold is independent and resumes through Escape.
   await page.locator('[data-feedback="report"]').click();assert.equal(await page.evaluate(()=>!!game.current.feedbackHold),true);await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>game.current.feedbackHold),undefined);
   await start(page,'talk','mixed',false);await page.evaluate(()=>{game.finishType='score';game.targetScore=1;persist()});await settle(page,'no');await settle(page,'no');
   await page.locator('[data-action="roll"]').click();await page.locator('.challenge-card').click();await page.waitForFunction(()=>game.phase==='play');
   await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});const liveWord=await page.evaluate(()=>game.current.word);
   await page.locator('#match-team-a').click();const liveRemaining=await page.evaluate(()=>game.current.feedbackHold.remainingMs);
   await page.locator('[data-review-turn="0"] [data-review-choice="complete"]').click();await page.locator('#result-history-save').click();
   assert.equal(await page.evaluate(()=>game.phase),'review');assert.equal(await page.evaluate(()=>game.current),null);assert.equal(await page.evaluate(()=>game.reviewSuspendedRound.current.word),liveWord);
   const suspended=await snapshot(page);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),suspended,'Suspended Mixed task and pending review survive restart exactly');
   await page.screenshot({path:folder+'/'+id+'-suspended-review.png',animations:'disabled'});
   await page.locator('.pending-review-rows [data-review-turn="0"] [data-review-choice="failed"]').click();await page.locator('[data-action="confirm-results"]').click();
   assert.equal(await page.evaluate(()=>game.phase),'play');assert.equal(await page.evaluate(()=>game.current.word),liveWord);
   assert.ok(await page.evaluate(()=>game.current.deadline-Date.now())>liveRemaining-1500,'Undoing victory resumes the same held time');
   await start(page,'approx','easy',false);await page.evaluate(()=>{game.rounds=2;persist()});
   for(const choice of ['a','none']){await page.locator('[data-action="roll"]').click();await page.locator('[data-action="reveal-approx"]').click();await page.locator('[data-action="award-'+choice+'"]').click();}
   assert.equal(await page.evaluate(()=>game.phase),'review');assert.equal(await page.evaluate(()=>profileStore.recent.length),0);
   await page.locator('.pending-review-rows [data-review-expand="0"]').click();assert.equal(await page.locator('.pending-review-rows [data-review-turn="0"] .review-choice').count(),4);
   await page.locator('.pending-review-rows [data-review-turn="0"] [data-review-choice="b"]').click();
   await page.locator('.is-result-review [data-review-tab="1"]').click();
   assert.equal(await page.locator('.pending-review-rows [data-review-turn="1"]').isVisible(),true);
   await page.screenshot({path:folder+'/'+id+'-pending-review.png',animations:'disabled'});
   // Offline cold reload never confirms a win or reapplies totals.
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});
   const pending=await snapshot(page);await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await snapshot(page),pending);
   // Fail the actual final root write: no profile commit and no false victory.
   await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===STORAGE_KEY)throw Error('quota');return originalSet.call(this,k,v)}});
   await page.locator('[data-action="confirm-results"]').click();assert.equal(await page.evaluate(()=>game.phase),'review');assert.equal(await page.evaluate(()=>profileStore.recent.length),0);
   assert.deepEqual(await snapshot(page),pending);
   await page.evaluate(()=>{Storage.prototype.setItem=originalSet});await page.locator('[data-action="confirm-results"]').click();
   assert.equal(await page.evaluate(()=>game.phase),'results');assert.equal(await page.evaluate(()=>profileStore.recent.length),1);assert.equal(await page.evaluate(()=>profileStore.totals[game.profileMatch.participants[1].id].wins),1);
   const confirmed=await snapshot(page);await page.reload();assert.equal((await snapshot(page)).profiles,confirmed.profiles);
   await ctx.setOffline(false);
   // 102 settled real tasks, long profile names and a bounded scrolling panel.
   await page.evaluate(()=>{
    options.rounds=100;options.finishType='score';options.targetScore=100;newGame();game.dice=false;game.targetScore=10000;
    for(let i=0;i<102;i++){roll();revealApprox();awardApprox('none')}
    game.teams=['Очень длинное имя игрока','Ещё одно длинное имя'];delete game.profileMatch;delete game.matchId;
    for(const row of game.history){row.setter=game.teams[row.setterIndex];row.recipientNames=row.recipients.map(i=>game.teams[i]);}persist();
   });
   await page.locator('#match-team-a').click();await rectCheck(page,id+'-102');assert.equal(await page.locator('#result-history-rows .review-row').count(),102,'Shared results appear in both profiles');
   await page.locator('#result-history-rows').evaluate(el=>el.scrollTop=el.scrollHeight);assert.equal(await page.locator('[data-review-turn="101"]').isVisible(),true);
   await page.screenshot({path:folder+'/'+id+'-long-history.png',animations:'disabled'});
   await page.locator('#result-history-cancel').click();assert.deepEqual(errors,[]);await ctx.close();console.log('TASK020 '+id+' history / timer hold / Back / offline review / write failure / single stats / 102 turns PASS');
  }
  fs.writeFileSync(folder+'/geometry.json',JSON.stringify(geometry,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
