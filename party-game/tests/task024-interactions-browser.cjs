'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright-core'),F=require('./task024-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const same=(a,b)=>{for(const k of ['x','y','w','h'])assert.ok(Math.abs(a[k]-b[k])<=.05,'Interactive phase moved card: '+JSON.stringify({a,b}));};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{for(const[w,h]of [[320,568],[360,640],[390,844],[412,915],[844,390]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await ctx.addInitScript(()=>{window.__now=1792930000000;Date.now=()=>window.__now});await F.setup(p,URL);await F.fixture(p,{...F.scenarios[1],difficulty:'hard'});const initial=(await F.geometry(p)).card;
   await p.locator('.challenge-card').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>game.phase),'countdown');same((await F.geometry(p)).card,initial);
   await p.locator('[data-feedback="report"]').tap();const heldStart=await p.evaluate(()=>game.current.feedbackHold.remainingMs);
   await p.evaluate(()=>{window.__now+=4000;tick()});assert.equal(await p.evaluate(()=>game.phase),'countdown');assert.equal(await p.evaluate(()=>game.current.feedbackHold.remainingMs),heldStart);same((await F.geometry(p)).card,initial);
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>game.current.autoStartAt-Date.now()),heldStart);same((await F.geometry(p)).card,initial);
   await p.evaluate(()=>{window.__now+=1001;tick();stopTicking()});assert.equal(await p.evaluate(()=>game.phase),'play');same((await F.geometry(p)).card,initial);
   const deadline=await p.evaluate(()=>game.current.deadline);await p.locator('.challenge-card').focus();await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>game.current.visible),false);assert.equal(await p.evaluate(()=>document.activeElement.matches('.challenge-card')),true);same((await F.geometry(p)).card,initial);
   await p.keyboard.press('Space');assert.equal(await p.evaluate(()=>game.current.deadline),deadline);same((await F.geometry(p)).card,initial);
   const profiles=await p.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY));await p.locator('[data-feedback="approve"]').tap();assert.equal(await p.locator('[data-feedback="approve"]').getAttribute('aria-pressed'),'true');
   for(const close of ['Escape','Back']){await p.locator('[data-feedback="report"]').tap();const held=await p.evaluate(()=>game.current.feedbackHold.remainingMs);same((await F.geometry(p)).card,initial);
    await p.evaluate(()=>{window.__now+=4000;tick()});if(close==='Escape')await p.keyboard.press('Escape');else await p.evaluate(()=>history.back());await p.waitForFunction(()=>$('report-backdrop').hidden);
    assert.equal(await p.evaluate(()=>game.current.deadline-Date.now()),held);same((await F.geometry(p)).card,initial);assert.equal(await p.evaluate(()=>document.activeElement.dataset.feedback),'report');
   }
   await p.locator('[data-feedback="report"]').tap();const hold=await p.evaluate(()=>game.current.feedbackHold.remainingMs);await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await p.reload();await p.locator('#continue-game').click();await F.settled(p);
   assert.equal(await p.evaluate(()=>game.current.feedbackHold.remainingMs),hold);assert.equal(await p.locator('#report-backdrop').isVisible(),true);same((await F.geometry(p)).card,initial);
   await p.locator('#report-cancel').click();same((await F.geometry(p)).card,initial);assert.equal(await p.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY)),profiles);await ctx.setOffline(false);
   await F.fixture(p,{mode:'talk',modifier:null,difficulty:'easy'});const easy=(await F.geometry(p)).card;await p.locator('.challenge-card').click();assert.equal(await p.evaluate(()=>game.phase),'task');same((await F.geometry(p)).card,easy);
   await p.locator('[data-action="start-timer"]').click();await p.locator('#timer-pause-control').click();assert.equal(await p.evaluate(()=>game.current.paused),true);same((await F.geometry(p)).card,easy);await p.locator('#timer-pause-control').click();assert.equal(await p.evaluate(()=>game.current.paused),false);same((await F.geometry(p)).card,easy);
   // Exceptional historical text has one reachable local scroll region below the card.
   await p.evaluate(()=>{game.current.complicationId=null;game.current.complication='Очень длинное историческое условие. '.repeat(35);render();stopTicking()});
   const region=p.locator('.round-condition-slot');await region.focus();await region.press('End');await p.waitForFunction(()=>{const el=document.querySelector('.round-condition-slot');return el.scrollTop+el.clientHeight>=el.scrollHeight-2});same((await F.geometry(p)).card,easy);
   assert.deepEqual(errors,[]);console.log('TASK024 interactions PASS',w,h,'keyboard / auto-start / Easy pause / ratings / report hold / Escape+Back / cold offline restore / local long-condition scroll');
  }finally{await ctx.close();}
 }}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
