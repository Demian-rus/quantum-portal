'use strict';
const {provisionProfiles,chooseNamedProfile}=require('./profile-fixtures.cjs');
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const URL='http://127.0.0.1:8765/party-game/';
async function isInViewport(page){
 return page.evaluate(()=>{
  const v=document.getElementById('scene-game');
  return {page:document.documentElement.scrollHeight,window:window.innerHeight,inside:v.scrollHeight,height:v.clientHeight};
 });
}
async function roundInvariant(page){
 return page.evaluate(()=>{
  const snapshot=JSON.parse(JSON.stringify(game));
  for(const key of ['deadline','remainingMs','paused','feedbackHold'])delete snapshot.current[key];
  return {game:snapshot,memory:JSON.stringify(taskMemory),profiles:localStorage.getItem(QUIP_PROFILES_KEY),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY),approvals:localStorage.getItem(QUIP_CARD_APPROVALS_KEY)};
 });
}
async function pauseAndRatingsGeometry(page,allowed){
 const pause=page.locator('#timer-pause-control');
 assert.equal(await pause.isVisible(),allowed,'Ordinary pause eligibility');
 assert.equal(await page.locator('[data-action="pause"],[data-action="resume"]').count(),allowed?1:0);
 if(allowed){assert.equal(await pause.isEnabled(),true);assert.equal(await pause.getAttribute('aria-label'),'Пауза');}
 const {boxes,width,height}=await page.evaluate(()=>{
  const elements=[...document.querySelectorAll('#timer-pause-control,#exit-game,[data-feedback],.round-bottom--play .round-action')].filter(el=>!el.hidden);
  return {width:innerWidth,height:innerHeight,boxes:elements.map(el=>{const r=el.getBoundingClientRect();return {name:el.id||el.dataset.feedback||el.dataset.action,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};})};
 });
 for(const box of boxes)assert.ok(box.w>=44&&box.h>=44&&box.x>=0&&box.y>=0&&box.right<=width&&box.bottom<=height,'Unreachable control '+JSON.stringify(box));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'Pause, ratings or results overlap '+JSON.stringify({a,b}));
 }
 assert.equal(await page.locator('[data-feedback="report"]').count(),1);
 assert.equal(await page.locator('[data-feedback="approve"]').count(),1);
}
async function freezeClock(page){await page.evaluate(()=>{window.__polishRealNow=Date.now;window.__polishNow=Date.now();Date.now=()=>window.__polishNow;});}
async function restoreClock(page){await page.evaluate(()=>{Date.now=window.__polishRealNow;});}
(async()=>{
 fs.mkdirSync('artifacts/quip-polish',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const device of [{name:'small',width:360,height:640},{name:'phone',width:390,height:844},{name:'large',width:412,height:915},{name:'desktop',width:1440,height:900}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.width<500?2:1});
   const dialogs=[],errors=[];
   page.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(URL,{waitUntil:'load'});await provisionProfiles(page);
      await page.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
   // Test the three approved backgrounds on every device, including preferences.
   const art=async expected=>page.evaluate(expected=>{
     const bg=getComputedStyle(document.body,'::before').backgroundImage;
     return {bg,chosen:getComputedStyle(document.querySelector('.home-action--primary')||document.body).backgroundImage,
       neon:getComputedStyle(document.documentElement).getPropertyValue('--kvip-electric').trim()};
   },expected);
   const homeArt=await art('home');
   assert.ok(homeArt.bg.includes('bg-home.webp?v=4'),'Home artwork was not loaded');
   assert.equal(homeArt.neon,'#54e8ff');
   if(device.name==='phone')await capture(page,{path:'artifacts/quip-polish/phone-kvip-home.png'});
   await page.locator('#settings-menu').click();
   const prefArt=await art('setup');
   assert.ok(prefArt.bg.includes('bg-setup.webp?v=3'),'Preferences should share the settings backdrop');
   await page.locator('#preferences-back').click();
   await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
   const setupArt=await art('setup');
   assert.ok(setupArt.bg.includes('bg-setup.webp?v=3'),'Party setup art mismatch');
   const chosen=await page.locator('.choices .is-chosen').first().evaluate(el=>getComputedStyle(el).backgroundImage);
   assert.match(chosen,/gradient/,'Old flat lime selection still active');
   if(device.name==='phone')await capture(page,{path:'artifacts/quip-polish/phone-kvip-setup.png'});
   const selection=await page.evaluate(()=>{
     const label=document.querySelector('.choices[data-setting="difficulty"] [data-value="medium"]');
     const start=new Event('selectstart',{bubbles:true,cancelable:true});
     const menu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
     label.dispatchEvent(start);label.dispatchEvent(menu);
     return {style:getComputedStyle(label).userSelect,selectCanceled:start.defaultPrevented,
       menuCanceled:menu.defaultPrevented};
   });
   assert.deepEqual(selection,{style:'none',selectCanceled:true,menuCanceled:true},
     'Settings are selectable: '+JSON.stringify(selection));
   await chooseNamedProfile(page,0,'Тестовая команда');
   assert.equal(await page.locator('#team-a').locator('span').nth(1).textContent(),'Тестовая команда',
     'Disabling selection must not block typing a team name');
   await page.evaluate(()=>{options.modes=['talk'];options.dice=false;options.difficulty='easy';});
   await page.locator('#start-game').click();
   assert.ok((await art('game')).bg.includes('bg-game.webp?v=3'),'Game background mismatch');
   await page.waitForSelector('[data-action="roll"]');
   if(device.name==='phone')await capture(page,{path:'artifacts/quip-polish/phone-kvip-game-ready.png'});
   const ready=await page.evaluate(()=>{
    const a=document.querySelector('.is-ready .ready-avatar').getBoundingClientRect();
    const bar=document.querySelector('.play-card-head').getBoundingClientRect();
    return {avatarWidth:a.width,avatarTop:a.top,headBottom:bar.bottom,viewport:innerHeight};
   });
   assert.ok(ready.avatarWidth>=108,'Ready artwork is too small '+JSON.stringify(ready));
   assert.ok(ready.avatarTop>=ready.headBottom&&ready.avatarTop<ready.viewport*.60,'Ready image is not near header '+JSON.stringify(ready));
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-ready.png'});
   await page.locator('[data-action="roll"]').click();
   await page.waitForSelector('[data-action="toggle-word"]');
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-task-closed.png'});
   const hiddenCardHeight=await page.locator('.is-task .challenge-card').evaluate(el=>el.getBoundingClientRect().height);
   await page.locator('[data-action="toggle-word"]').click();
   // Reproduce the reported two-line prompt on every viewport.
   await page.evaluate(()=>{game.current.word='ПОТЕРЯННЫЙ ТЕЛЕФОН';render();});
   const wordFit=await page.evaluate(()=>{
     const card=document.querySelector('.is-task .challenge-card');
     const word=card.querySelector('.challenge-word');
     const rect=card.getBoundingClientRect(),text=word.getBoundingClientRect();
     return {cardHeight:rect.height,cardBottom:rect.bottom,textBottom:text.bottom,
       wrappers:card.querySelectorAll('.challenge-overline,.challenge-details').length,
       overflow:getComputedStyle(word).overflowY,
       selection:getComputedStyle(word).userSelect,
       scoreSelection:getComputedStyle(document.getElementById('score-a')).userSelect};
   });
   assert.ok(Math.abs(wordFit.cardHeight-hiddenCardHeight)<=2,
     'Card changed height on reveal: '+JSON.stringify(wordFit));
   assert.equal(wordFit.overflow,'visible','Unexpected word scrollbar');
   assert.equal(wordFit.selection,'none','Task text can be selected on Android');
   assert.equal(wordFit.scoreSelection,'none','Scores can be selected on Android');
   assert.equal(wordFit.wrappers,0,'Task card should contain the prompt only');
   assert.ok(wordFit.textBottom<wordFit.cardBottom-4,
     'Prompt is cut off by the card border: '+JSON.stringify(wordFit));
   for(const act of ['start-timer','replace-word']){
     assert.equal(await page.locator('.is-task .round-action[data-action="'+act+'"]').count(),1,act+' missing');
   }
   const task=await page.evaluate(()=>{
    const card=document.querySelector('.is-task .challenge-card');
    const rect=card.getBoundingClientRect();
    return {cardWidth:rect.width,cardHeight:rect.height,cardTop:rect.top,transform:getComputedStyle(card).transform};
   });
   assert.ok(task.cardHeight>=85&&task.transform!=='none','Layered card missing '+JSON.stringify(task));
   await page.evaluate(()=>{game.current.word='ПАРАЛЛЕЛЬНАЯ РЕАЛЬНОСТЬ';render();});
   const russian=await page.locator('.is-task .challenge-word').evaluate(el=>({
     raw:el.textContent.replace(/\u00ad/g,''),marked:el.textContent.includes('\u00ad'),
     hyphens:getComputedStyle(el).hyphens,wordBreak:getComputedStyle(el).wordBreak,
     width:el.getBoundingClientRect().width,cardWidth:el.closest('.challenge-card').clientWidth
   }));
   assert.equal(russian.raw,'ПАРАЛЛЕЛЬНАЯ РЕАЛЬНОСТЬ');
   assert.equal(russian.marked,true,'Russian soft break missing');
   assert.equal(russian.hyphens,'auto');
   assert.equal(russian.wordBreak,'normal');
   assert.ok(russian.width<russian.cardWidth,'Long Russian prompt does not fit');
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-russian-hyphen.png'});
   await page.evaluate(()=>{game.current.word='ПОТЕРЯННЫЙ ТЕЛЕФОН';render();});
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-task-controls.png'});
   await page.locator('.is-task [data-action="start-timer"]').click();
   assert.equal(await page.locator('.is-play [data-action="correct-now"]').count(),1);
   await pauseAndRatingsGeometry(page,true);
   const invariant=await roundInvariant(page);
   await freezeClock(page);
   const remaining=await page.evaluate(()=>game.current.deadline-Date.now());
   await page.locator('#timer-pause-control[data-action="pause"]').click();
   assert.equal(await page.evaluate(()=>game.current.paused),true);
   assert.equal(await page.evaluate(()=>game.current.deadline),null);
   assert.equal(await page.evaluate(()=>game.current.remainingMs),remaining);
   // Reporting an already paused Easy round must never resume it on dismissal.
   await page.locator('[data-feedback="report"]').click();
   assert.equal(await page.evaluate(()=>game.current.feedbackHold.wasPaused),true);
   await page.evaluate(()=>{window.__polishNow+=700;tick()});
   assert.equal(await page.evaluate(()=>game.current.feedbackHold.remainingMs),remaining);
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(()=>game.current.paused),true);
   assert.equal(await page.evaluate(()=>game.current.remainingMs),remaining);
   await page.locator('#timer-pause-control[data-action="resume"]').click();
   assert.equal(await page.evaluate(()=>game.current.paused),false);
   assert.equal(await page.evaluate(()=>game.current.deadline-Date.now()),remaining);
   assert.deepEqual(await roundInvariant(page),invariant,'Pause/report changed non-timer match data');
   await restoreClock(page);
   const geometry=await page.evaluate(()=>{
     const card=document.querySelector('.is-play .challenge-card').getBoundingClientRect();
     const actions=[...document.querySelectorAll('.round-bottom--play .round-action')].map(e=>{
       const b=e.getBoundingClientRect();
       return {action:e.dataset.action,centerX:(b.left+b.right)/2,top:b.top,width:b.width,color:getComputedStyle(e).color};
     });
     const timer=document.querySelector('.round-top--timer .timer-ring').getBoundingClientRect();
     return {cardTop:card.top,cardHeight:card.height,timerBottom:timer.bottom,actions,viewport:innerWidth};
   });
   assert.ok(Math.abs(task.cardTop-geometry.cardTop)<=2,
     'Card jumped after timer start: '+JSON.stringify({task,geometry}));
   assert.ok(geometry.timerBottom<geometry.cardTop-3,'Timer should be above fixed card: '+JSON.stringify(geometry));
   assert.deepEqual(geometry.actions.map(x=>x.action),['wrong-now','correct-now']);
   assert.ok(geometry.actions[0].centerX<geometry.viewport/2&&geometry.actions[1].centerX>geometry.viewport/2,'Verdicts must stay on opposite sides');
   assert.equal(geometry.actions[0].color,'rgb(255, 255, 255)');assert.equal(geometry.actions[1].color,'rgb(255, 255, 255)');
   assert.equal(await page.locator('.round-action[data-action="toggle-word"]').count(),0);
   assert.equal(await page.locator('.challenge-card[data-action="toggle-word"]').count(),1);
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-timer-controls.png'});
   const first=await isInViewport(page);
   assert.ok(first.page<=first.window+2&&first.inside<=first.height+4,'Game scroll overflow '+JSON.stringify(first));
   await page.locator('[data-action="correct-now"]').click();
   assert.equal(await page.locator('#score-b').textContent(),'1');
   assert.equal(await page.locator('#round-now').textContent(),'2');
   assert.equal(await page.locator('[data-action="roll"]').count(),1,'Extra next-step confirmation');
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-next-turn.png'});
   // Intentionally create another game while one is saved; nothing must summon a system alert.
   await page.locator('#exit-game').click();
   await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
   await page.locator('#start-game').click();
   assert.deepEqual(dialogs,[],'Unexpected native browser confirmations');
   await page.evaluate(()=>{options.modes=['talk'];options.dice=false;options.difficulty='easy';});
   await page.locator('[data-action="roll"]').click();
   await page.locator('[data-action="toggle-word"]').click();
   await page.locator('[data-action="start-timer"]').click();
   // Immediate red X rejects an invalid answer and passes the turn with no points.
   await page.locator('[data-action="wrong-now"]').click();
   assert.equal(await page.locator('#score-a').textContent(),'0');
   assert.equal(await page.locator('[data-action="roll"]').count(),1);
   await page.evaluate(()=>{options.modes=['talk'];options.dice=false;options.difficulty='easy';});
   await page.locator('[data-action="roll"]').click();
   await page.locator('[data-action="toggle-word"]').click();
   await page.locator('[data-action="start-timer"]').click();
   await page.evaluate(()=>{game.current.deadline=Date.now()-10;tick()});
   await page.waitForSelector('.is-judge .judgement-grid');
   const align=await page.locator('.judgement-option').evaluateAll(options=>options.map(e=>{
    const button=e.querySelector('button').getBoundingClientRect();
    const text=e.querySelector('span').getBoundingClientRect();
    return {button:(button.left+button.right)/2,text:(text.left+text.right)/2};
   }));
   assert.equal(align.length,2);
   assert.ok(align.every(x=>Math.abs(x.button-x.text)<=2),'Judge labels not centered: '+JSON.stringify(align));
   const judgeSides=await page.locator('.is-judge .judgement-option button').evaluateAll(nodes=>nodes.map(el=>({
     action:el.dataset.action,x:el.getBoundingClientRect().x
   })));
   assert.deepEqual(judgeSides.map(x=>x.action),['no','yes'],'Judge order must be red then green');
   assert.ok(judgeSides[0].x<judgeSides[1].x);
   await capture(page,{path:'artifacts/quip-polish/'+device.name+'-judgement.png'});
   await page.locator('[data-action="no"]').click();
   assert.equal(await page.locator('[data-action="roll"]').count(),1);
   assert.deepEqual(errors,[],'Browser JS errors');
   console.log(device.name,JSON.stringify({ready,task,first,align,dialogs,errors}));
   await page.close();
  }
  // The hard/medium auto-start path passes through a one-second countdown;
  // check all THREE states have the exact same word-card geometry.
  for(const difficulty of ['medium','hard']){
  const medium=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await medium.goto(URL,{waitUntil:'load'});await provisionProfiles(medium);
      await medium.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
  await medium.locator('#new-game-menu').click();
      await medium.locator('#standard-game').click();
  await medium.evaluate(difficulty=>{options.modes=['talk'];options.dice=false;options.difficulty=difficulty;},difficulty);
  await medium.locator('#start-game').click();
  await medium.locator('[data-action="roll"]').click();
  const cardTop=()=>medium.locator('.round-fixed-card .challenge-card').evaluate(el=>el.getBoundingClientRect().top);
  const taskTop=await cardTop();
  await medium.locator('[data-action="toggle-word"]').click();
  assert.equal(await medium.locator('.is-countdown').count(),1);
  const countdownTop=await cardTop();
  await medium.waitForSelector('.is-play #active-timer',{timeout:4500});
  const timerTop=await cardTop();
  assert.ok(Math.abs(taskTop-countdownTop)<=2 && Math.abs(taskTop-timerTop)<=2,
    'Autostart card jumps: '+JSON.stringify({taskTop,countdownTop,timerTop}));
  await pauseAndRatingsGeometry(medium,false);
  const deadline=await medium.evaluate(()=>game.current.deadline),invariant=await roundInvariant(medium);
  await medium.evaluate(()=>pauseTimer());
  assert.equal(await medium.evaluate(()=>game.current.deadline),deadline,'Forbidden ordinary pause changed deadline');
  assert.equal(await medium.evaluate(()=>game.current.paused),false);
  await freezeClock(medium);
  const remaining=await medium.evaluate(()=>game.current.deadline-Date.now());
  await medium.locator('[data-feedback="report"]').click();
  assert.equal(await medium.evaluate(()=>game.current.deadline),null);
  assert.equal(await medium.evaluate(()=>game.current.feedbackHold.remainingMs),remaining);
  await medium.evaluate(()=>{window.__polishNow+=700;tick();resumeTimer()});
  assert.equal(await medium.evaluate(()=>game.current.feedbackHold.remainingMs),remaining);
  assert.equal(await medium.evaluate(()=>game.phase),'play');
  if(difficulty==='medium')await medium.keyboard.press('Escape');else await medium.goBack();
  assert.equal(await medium.evaluate(()=>game.current.paused),false);
  assert.equal(await medium.evaluate(()=>game.current.deadline-Date.now()),remaining);
  assert.equal(await medium.evaluate(()=>document.activeElement.dataset.feedback),'report');
  assert.deepEqual(await roundInvariant(medium),invariant,'Report hold changed non-timer match data');
  await pauseAndRatingsGeometry(medium,false);await restoreClock(medium);
  await capture(medium,{path:'artifacts/quip-polish/phone-'+difficulty+'-autostart-fixed-card.png'});
  console.log('polish',difficulty,'autostart / ordinary pause forbidden / report hold / focus / Back-Escape PASS');
  await medium.close();
  }
  // Blitz keeps the same left-red/right-green spatial language as other modes.
  const blitz=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await blitz.goto(URL,{waitUntil:'load'});await provisionProfiles(blitz);
      await blitz.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
  await blitz.locator('#new-game-menu').click();
      await blitz.locator('#standard-game').click();
  await blitz.evaluate(()=>{options.modes=['blitz'];options.difficulty='easy';});
  await blitz.locator('#start-game').click();
  await blitz.locator('[data-action="roll"]').click();
  await blitz.waitForSelector('.is-task [data-action="toggle-word"]',{timeout:4500});
  await blitz.locator('.is-task [data-action="toggle-word"]').click();
  await blitz.locator('[data-action="start-timer"]').click();
  const blitzActions=await blitz.locator('.blitz-actions .round-action').evaluateAll(nodes=>nodes.map(node=>{
    const box=node.getBoundingClientRect();
    return {action:node.dataset.action,centerX:(box.left+box.right)/2,centerY:(box.top+box.bottom)/2,
      danger:node.classList.contains('round-action--danger'),
      success:node.classList.contains('round-action--success')};
  }));
  assert.deepEqual(blitzActions.map(a=>a.action),['blitz-skip','blitz-correct']);
  assert.ok(blitzActions[0].danger&&blitzActions[1].success,'Blitz uses wrong button colors');
  assert.ok(blitzActions[0].centerX<195&&blitzActions[1].centerX>195,
    'Blitz actions are not on opposite sides: '+JSON.stringify(blitzActions));
  assert.ok(Math.abs(blitzActions[0].centerY-blitzActions[1].centerY)<=2,'Blitz buttons are at different heights');
  const blitzFit=await isInViewport(blitz);
  assert.ok(blitzFit.page<=blitzFit.window+2&&blitzFit.inside<=blitzFit.height+4,
    'Blitz layout scrolls '+JSON.stringify(blitzFit));
  await capture(blitz,{path:'artifacts/quip-polish/phone-blitz-red-left-green-right.png'});
  await blitz.locator('[data-action="blitz-skip"]').click();
  await blitz.evaluate(()=>{for(let i=0;i<43;i++)advanceBlitz(false);});
  const status=await blitz.locator('.blitz-status').evaluate(el=>({
    text:el.innerText,
    labels:[...el.querySelectorAll('b')].map(x=>({
      text:x.textContent,color:getComputedStyle(x).color,x:x.getBoundingClientRect().x
    }))
  }));
  assert.deepEqual(status.labels.map(x=>x.text),['ОСТАЛОСЬ: 3','ОТГАДАНО: 0']);
  assert.equal(status.labels[0].color,status.labels[1].color);
  assert.ok(status.labels[0].x<status.labels[1].x);
  assert.ok(!status.text.includes('Пропущено'));
  await blitz.evaluate(()=>{game.current.deadline=Date.now()-1;tick()});
  const blitzJudge=await blitz.locator('.is-judge button[data-action]').evaluateAll(nodes=>
    nodes.map(el=>el.dataset.action));
  assert.deepEqual(blitzJudge,['no'],'Incomplete Blitz must have one finalization button');
  assert.ok(!(await blitz.locator('.is-judge').innerText()).includes('Пропущено'));
  await capture(blitz,{path:'artifacts/quip-polish/phone-blitz-incomplete-finalize.png'});
  await blitz.close();
  console.log('polish complete: four device layouts / Easy pause+resume / all-difficulty report hold / result controls / Blitz PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
