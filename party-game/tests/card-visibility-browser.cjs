'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const card=page=>page.locator('.challenge-card[data-action="toggle-word"]');
const clock=page=>page.evaluate(()=>JSON.stringify([game.current.deadline,game.current.remainingMs,game.current.autoStartAt,game.current.paused,intervalId]));
const box=page=>card(page).boundingBox();
function sameBox(a,b,label){for(const key of ['x','y','width','height'])assert.ok(Math.abs(a[key]-b[key])<1.5,label+' '+JSON.stringify({a,b}));}
async function state(page,visible){
 assert.equal(await card(page).count(),1);assert.equal(await card(page).evaluate(el=>el.tagName),'BUTTON');
 assert.equal(await card(page).getAttribute('aria-pressed'),String(visible));
 assert.equal(await page.locator('.round-action[data-action="toggle-word"],.task-open button').count(),0);
 const word=await page.evaluate(()=>game.current.word),text=await card(page).textContent();
 if(visible)assert.equal(text.replace(/\u00ad/g,''),word);
 else{assert.equal(text,'НАЖМИ, ЧТОБЫ ОТКРЫТЬ');assert.ok(!(await card(page).getAttribute('aria-label')).includes(word));}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
}
(async()=>{
 fs.mkdirSync('artifacts/quip-card-visibility',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));await page.goto(URL,{waitUntil:'load'});await provisionProfiles(page);
   await page.evaluate(()=>{window.__nativeNow=Date.now;window.__clock=Date.now();Date.now=()=>window.__clock;});
   for(const mode of ['talk','secret','blitz'])for(const difficulty of ['easy','medium','hard','mixed']){
    await page.evaluate(({mode,difficulty})=>{
     window.__clock=window.__nativeNow();soundOn=false;chooseStartingTeam=()=>0;
     Object.assign(options,{modes:[mode],difficulty,finishType:'rounds',rounds:30,dice:false,complications:false});
     newGame();roll();
     if(mode!=='blitz')game.current.word='ПАРАЛЛЕЛЬНАЯ РЕАЛЬНОСТЬ';
     persist();render();
    },{mode,difficulty});
    await state(page,false);const fixed=await box(page);
    assert.ok(fixed.width>=44&&fixed.height>=44);
    if(width===320&&mode==='talk'&&difficulty==='easy')await page.screenshot({path:'artifacts/quip-card-visibility/hidden-320.png',animations:'disabled'});
    await card(page).click();await state(page,true);sameBox(await box(page),fixed,'First reveal moved card');
    if(difficulty==='easy')await page.locator('[data-action="start-timer"]').click();
    else{
     assert.equal(await page.evaluate(()=>game.phase),'countdown');
     const scheduled=await clock(page);await card(page).tap();await state(page,false);await card(page).tap();await state(page,true);
     assert.equal(await clock(page),scheduled,'Countdown tap changed start/ticker');
     await page.evaluate(()=>{window.__clock=game.current.autoStartAt+1;tick()});
    }
    assert.equal(await page.evaluate(()=>game.phase),'play');sameBox(await box(page),fixed,'Timer start moved card');
    const running=await clock(page),points=await page.evaluate(()=>JSON.stringify([game.scores,game.history,game.plannerState,game.modePlannerState]));
    await card(page).tap();await state(page,false);assert.equal(await clock(page),running);
    await card(page).click();await state(page,true);assert.equal(await clock(page),running);
    sameBox(await box(page),fixed,'Visibility changed geometry');
    assert.equal(await page.evaluate(()=>JSON.stringify([game.scores,game.history,game.plannerState,game.modePlannerState])),points);
    if(width===390&&mode==='talk'&&difficulty==='easy'){
     await page.keyboard.press('Tab');await card(page).focus();await card(page).press('Space');await state(page,false);
     assert.equal(await page.evaluate(()=>document.activeElement.matches('.challenge-card')),true);
     assert.notEqual(await card(page).evaluate(el=>getComputedStyle(el).outlineStyle),'none');
     await card(page).press('Enter');await state(page,true);assert.equal(await page.evaluate(()=>document.activeElement.matches('.challenge-card')),true);
     await page.evaluate(()=>{window.__explicitCardFocus=0;const focus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...args){if(this.matches('.challenge-card'))window.__explicitCardFocus++;return Reflect.apply(focus,this,args);};});
     await card(page).tap();assert.equal(await page.evaluate(()=>window.__explicitCardFocus),0,'Touch must not force keyboard focus');
     await card(page).tap();await state(page,true);
     await page.screenshot({path:'artifacts/quip-card-visibility/timer-390.png',animations:'disabled'});
    }
    if(width===390&&mode==='talk'&&difficulty==='medium'){
     // Auto-start rebuilds the view after a keyboard reveal; retain the card.
     await page.evaluate(()=>{window.__clock=window.__nativeNow();newGame();game.dice=false;roll()});
     await page.keyboard.press('Tab');await card(page).focus();await card(page).press('Enter');
     assert.equal(await page.evaluate(()=>game.phase),'countdown');assert.equal(await page.evaluate(()=>document.activeElement.matches('.challenge-card')),true);
     await page.evaluate(()=>{window.__clock=game.current.autoStartAt+1;tick()});
     assert.equal(await page.evaluate(()=>document.activeElement.matches('.challenge-card')),true);
    }
    if(difficulty==='easy'){
     await page.locator('[data-action="pause"]').click();const paused=await clock(page);
     await card(page).tap();await card(page).tap();assert.equal(await clock(page),paused);
     await page.locator('[data-action="resume"]').click();
    }
    if(mode==='blitz'){
     const deadline=await page.evaluate(()=>game.current.deadline);await card(page).tap();await state(page,false);
     await page.locator('[data-action="blitz-skip"]').click();await state(page,true);
     assert.equal(await page.evaluate(()=>game.current.deadline),deadline);assert.equal(await page.evaluate(()=>game.current.blitzCorrect),0);
     await card(page).tap();await page.locator('[data-action="blitz-correct"]').click();await state(page,true);
     assert.equal(await page.evaluate(()=>game.current.blitzCorrect),1);assert.equal(await page.evaluate(()=>game.current.deadline),deadline);
     if(width===844&&difficulty==='mixed'){await card(page).tap();await page.screenshot({path:'artifacts/quip-card-visibility/blitz-landscape.png',animations:'disabled'});}
    }
   }
   // Persist and restore a hidden active card through the actual offline PWA.
   await page.evaluate(()=>{game.current.visible=false;game.dice=true;persist();render()});
   const saved=await page.evaluate(()=>({deadline:game.current.deadline,word:game.current.word,raw:localStorage.getItem(STORAGE_KEY)}));
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   await state(page,false);assert.equal(await page.evaluate(()=>game.current.deadline),saved.deadline);assert.equal(await page.evaluate(()=>game.current.word),saved.word);
   assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),saved.raw);
   await card(page).tap();await state(page,true);assert.equal(await page.evaluate(()=>game.current.deadline),saved.deadline);
   await context.setOffline(false);
   await page.evaluate(()=>{Object.assign(options,{modes:['approx'],difficulty:'easy',dice:false});newGame();roll()});
   assert.equal(await card(page).count(),0);assert.equal(await page.locator('[data-action="reveal-approx"]').count(),1);
   await page.evaluate(()=>{game.finishType='score';game.roundIndex=30;game.scores=[15,15];game.targetScore=15;game.current=null;beginTiebreak();render()});
   assert.equal(await card(page).count(),0);assert.equal(await page.locator('[data-action="tiebreak-reveal"]').count(),1);
   assert.deepEqual(errors,[]);await context.close();console.log('Card visibility / keyboard / ticker / Blitz / offline PASS',width,height);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
