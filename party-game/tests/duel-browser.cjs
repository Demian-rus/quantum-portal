'use strict';
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const URL='http://127.0.0.1:8765/party-game/';
(async()=>{
 fs.mkdirSync('artifacts/quip-duel',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [name,width,height] of [['short-phone',360,640],['phone',390,844]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.goto(URL,{waitUntil:'load'});
      await page.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
   await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
   await page.locator('#team-a').fill('Молнии');
   await page.locator('#team-b').fill('Кометы');
   await page.locator('#quick-score-choices [data-value="30"]').click();
   await page.locator('.quick-choices[data-setting="duration"] [data-value="45"]').click();
   assert.equal(await page.locator('#score-goal-preview').textContent(),'30 очков');
   assert.equal(await page.locator('#base-duration-value').textContent(),'45 с');
   await page.locator('#go-advanced').click();
   assert.equal(await page.locator('#target-score').inputValue(),'30');
   assert.equal(await page.locator('#base-duration').inputValue(),'45');
   await page.locator('#advanced-done').click();
   await page.evaluate(()=>{options.modes=['talk'];options.riskRounds=true;});
   await page.locator('#start-game').click();
   assert.equal(await page.locator('#role-a').textContent(),'ЗАГАДЫВАЕТ');
   assert.equal(await page.locator('#role-b').textContent(),'ОТГАДЫВАЕТ');
   assert.equal(await page.locator('#match-center-label').textContent(),'ЦЕЛЬ 30');
   assert.equal(await page.locator('#round-total').isVisible(),false);
   await page.evaluate(()=>{game.scores=[8,1];game.current=rollOutcome();game.current.risk=true;game.phase='task';render()});
   assert.equal(await page.locator('.risk-notice').count(),1,'Risk must be visible before revealing the card');
   assert.match(await page.locator('#play-step').textContent(),/ЗАГАДЫВАЕТ/);
   let bounds=await page.locator('.challenge-card').evaluate(el=>{
     const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:innerHeight,width:b.width,window:innerWidth};
   });
   assert.ok(bounds.top>=0&&bounds.bottom<=height+2,'Risk card outside viewport: '+JSON.stringify(bounds));
   await capture(page,{path:'artifacts/quip-duel/'+name+'-risk-card.png'});
   await page.locator('[data-action="toggle-word"]').click();
   await page.locator('[data-action="start-timer"]').click();
   assert.equal(await page.locator('.risk-notice').count(),1);
   await page.locator('[data-action="wrong-now"]').click();
   const summary=await page.evaluate(()=>({scores:game.scores,history:game.history[0],phase:game.phase,round:game.roundIndex}));
   assert.deepEqual(summary.scores,[8,0]);
   assert.equal(summary.history.awarded,-1);
   assert.equal(summary.history.team,'Кометы');
   assert.equal(summary.history.setter,'Молнии');
   assert.equal(summary.phase,'ready');
   assert.equal(summary.round,1);
   assert.equal(await page.locator('#role-a').textContent(),'ОТГАДЫВАЕТ');
   assert.deepEqual(errors,[]);
   await page.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL,{waitUntil:'load'});
      await page.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
  await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
  await page.evaluate(()=>{options.difficulty='mixed';options.modes=['secret'];soundOn=false;});
  await page.locator('#start-game').click();
  await page.locator('[data-action="roll"]').click();
  const selected=await page.evaluate(()=>({card:game.current,used:game.used,plan:game.plannerState}));
  assert.equal(await page.evaluate(()=>game.phase),'rolling');
  await page.reload({waitUntil:'load'});
  await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>game.phase),'task');
  assert.deepEqual(await page.evaluate(()=>({card:game.current,used:game.used,plan:game.plannerState})),selected,
    'Carousel restore must preserve card, modifier, rewards and planner without another draw');
  await page.evaluate(()=>{game.phase='judge';judge(false)});
  await page.reload({waitUntil:'load'});
  await page.locator('#continue-game').click();
  await page.locator('[data-action="roll"]').click();
  await page.locator('.is-task').waitFor({timeout:5500});
  assert.equal(await page.evaluate(()=>game.current.difficulty),selected.card.difficulty,'Reply tier changed after reload');
  const reply=await page.evaluate(()=>({card:game.current,plan:game.plannerState,scores:game.scores,round:game.roundIndex}));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  await context.setOffline(true);
  await page.reload({waitUntil:'load'});
  await page.locator('#continue-game').click();
  assert.deepEqual(await page.evaluate(()=>({card:game.current,plan:game.plannerState,scores:game.scores,round:game.roundIndex})),reply,
    'Offline installed-PWA restore lost the selected reply');
  assert.deepEqual(errors,[]);
  console.log('paired-mix offline reload PASS');
  await context.close();
  for(const starter of [0,1]){
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(URL,{waitUntil:'load'});
   await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
   await page.evaluate(starter=>{chooseStartingTeam=()=>starter;options.awardTo='guesser';options.complications=false;options.modes=['talk'];options.dice=false;options.finishType='rounds';options.rounds=2;options.riskRounds=false;soundOn=false},starter);
   await page.locator('#start-game').click();
   const setter=starter===0?'a':'b',guesser=starter===0?'b':'a';
   assert.equal(await page.locator('#role-'+setter).textContent(),'ЗАГАДЫВАЕТ');
   assert.equal(await page.locator('#role-'+guesser).textContent(),'ОТГАДЫВАЕТ');
   await page.locator('[data-action="roll"]').click();
   await page.locator('[data-action="toggle-word"]').click();
   await page.locator('[data-action="start-timer"]').click();
   await page.locator('[data-action="correct-now"]').click();
   assert.equal(await page.locator('#score-'+guesser).textContent(),'1');
   await page.reload({waitUntil:'load'});
   await page.locator('#continue-game').click();
   assert.equal(await page.evaluate(()=>game.startingTeamIndex),starter);
   assert.equal(await page.locator('#role-'+guesser).textContent(),'ЗАГАДЫВАЕТ');
   await page.evaluate(()=>{game.dice=false});
   await page.locator('[data-action="roll"]').click();
   await page.locator('[data-action="toggle-word"]').click();
   await page.locator('[data-action="start-timer"]').click();
   await page.locator('[data-action="correct-now"]').click();
   assert.equal(await page.evaluate(()=>game.phase),'results');
   assert.deepEqual(await page.evaluate(()=>game.scores),[1,1]);
   assert.deepEqual(errors,[]);await page.close();
  }
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(URL,{waitUntil:'load'});
   await page.evaluate(()=>{soundOn=false;options.modes=['approx'];options.dice=false;options.difficulty='hard';newGame()});
   for(const choice of ['a','b','both','none']){
    await page.evaluate(()=>{game.dice=false});
    await page.locator('[data-action="roll"]').click();
    assert.equal(await page.locator('.is-approx img').getAttribute('src'),'./assets/modes/approx.webp?v=3');
    assert.equal(await page.locator('#active-timer').count(),0);
    assert.equal(await page.locator('.risk-notice').count(),0);
    const question=await page.evaluate(()=>game.current.question);
    await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
    assert.deepEqual(await page.evaluate(()=>game.current.question),question);
    assert.equal(await page.locator('.approx-answer').count(),0);
    await page.locator('[data-action="reveal-approx"]').click();
    await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
    assert.deepEqual(await page.evaluate(()=>game.current.question),question);
    assert.equal(await page.locator('[data-action^="award-"]').count(),4);
    const answerVisible=await page.locator('.approx-answer strong').evaluate(answer=>{
     const r=answer.getBoundingClientRect(),card=answer.closest('.approx-card').getBoundingClientRect();
     return r.top>=card.top&&r.bottom<=card.bottom&&r.left>=card.left&&r.right<=card.right;
    });
    assert.equal(answerVisible,true,'Revealed numeric answer must be visible without scrolling');
    const geometry=await page.locator('[data-action^="award-"]').evaluateAll(nodes=>nodes.map(node=>{
     const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};
    }));
    assert.ok(geometry.every(r=>r.top>=0&&r.bottom<=height+1&&r.left>=0&&r.right<=width+1&&r.height>=44),JSON.stringify(geometry));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(choice==='a'){
     await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
     await capture(page,{path:'artifacts/quip-duel/approx-'+width+'x'+height+'.png'});
    }
    await page.locator('[data-action="award-'+choice+'"]').click();
   }
   assert.deepEqual(await page.evaluate(()=>game.scores),[2,2]);
   assert.equal(await page.evaluate(()=>game.roundIndex),4);
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});
   await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   await page.evaluate(()=>{game.dice=false});await page.locator('[data-action="roll"]').click();
   await page.locator('[data-action="reveal-approx"]').click();
   assert.equal(await page.locator('[data-action^="award-"]').count(),4);
   assert.deepEqual(errors,[]);await context.close();
  }
  // A ready topic is injected only in this test context; production topics stay Soon.
  {
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const fixture={id:'fixture-topic',version:1,name:'Тестовая тема',enabled:true,categories:[],types:['word'],
    criteria:{cardIds:['word-000001','word-000002','word-000003'],sourcePacks:['core']},minCardsPerPool:1};
   await page.route('**/content-packs.js*',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace('const QUIP_CONTENT_PACKS=defineContentPacks([',
     'const QUIP_CONTENT_PACKS=defineContentPacks(['+JSON.stringify(fixture)+',');
    await route.fulfill({response,body});
   });
   await page.goto(URL,{waitUntil:'load'});
   await page.evaluate(()=>{soundOn=false;options.modes=['talk'];options.promptTypes=['word'];options.dice=false;options.complications=false;options.duration=45});
   await page.locator('#new-game-menu').click();await page.locator('#thematic-game').click();
   await page.locator('[data-theme="fixture-topic"]').click();
   assert.equal(await page.locator('#scene-setup').isVisible(),true);
   assert.equal(await page.locator('#setup-pack-caption').textContent(),'Тестовая тема');
   assert.equal(await page.locator('#base-duration-value').textContent(),'45 с');
   await page.locator('#setup-back').click();assert.equal(await page.locator('#scene-themes').isVisible(),true);
   await page.locator('[data-theme="fixture-topic"]').click();await page.locator('#start-game').click();
   await page.locator('[data-action="roll"]').click();
   const card=await page.evaluate(()=>({pack:game.contentPack,current:game.current}));
   assert.equal(card.pack.id,'fixture-topic');assert.ok(['КАРАНДАШ','СУНДУК','ПУЗЫРЬ'].includes(card.current.word));
   await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   assert.deepEqual(await page.evaluate(()=>({pack:game.contentPack,current:game.current})),card);
   await page.locator('#exit-game').click();await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
   assert.equal(await page.locator('#setup-pack-caption').textContent(),'Общий словарь');
   assert.equal(await page.evaluate(()=>game.contentPack.id),'fixture-topic','Setup must preserve unfinished topic match');
   assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
