'use strict';
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
(async()=>{
 fs.mkdirSync('artifacts/iskra-polish',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const device of [{name:'small',width:360,height:640},{name:'phone',width:390,height:844},{name:'large',width:412,height:915},{name:'desktop',width:1440,height:900}]){
   const page=await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.width<500?2:1});
   const dialogs=[],errors=[];
   page.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(URL,{waitUntil:'load'});
   await page.locator('#new-game-menu').click();
   await page.evaluate(()=>{options.modes=['talk'];options.dice=false;options.difficulty='easy';});
   await page.locator('#start-game').click();
   await page.waitForSelector('[data-action="roll"]');
   const ready=await page.evaluate(()=>{
    const a=document.querySelector('.is-ready .ready-avatar').getBoundingClientRect();
    const bar=document.querySelector('.play-card-head').getBoundingClientRect();
    return {avatarWidth:a.width,avatarTop:a.top,headBottom:bar.bottom,viewport:innerHeight};
   });
   assert.ok(ready.avatarWidth>=108,'Ready artwork is too small '+JSON.stringify(ready));
   assert.ok(ready.avatarTop>=ready.headBottom&&ready.avatarTop<ready.viewport*.60,'Ready image is not near header '+JSON.stringify(ready));
   await page.screenshot({path:'artifacts/iskra-polish/'+device.name+'-ready.png'});
   await page.locator('[data-action="roll"]').click();
   await page.waitForSelector('[data-action="toggle-word"]');
   await page.screenshot({path:'artifacts/iskra-polish/'+device.name+'-task-closed.png'});
   await page.locator('[data-action="toggle-word"]').click();
   for(const act of ['toggle-word','start-timer','replace-word']){
     assert.equal(await page.locator('.is-task .round-action[data-action="'+act+'"]').count(),1,act+' missing');
   }
   const task=await page.evaluate(()=>{
    const card=document.querySelector('.is-task .challenge-card');
    const rect=card.getBoundingClientRect();
    return {cardWidth:rect.width,cardHeight:rect.height,cardTop:rect.top,transform:getComputedStyle(card).transform};
   });
   assert.ok(task.cardHeight>=85&&task.transform!=='none','Layered card missing '+JSON.stringify(task));
   await page.screenshot({path:'artifacts/iskra-polish/'+device.name+'-task-controls.png'});
   await page.locator('.is-task [data-action="start-timer"]').click();
   assert.equal(await page.locator('.is-play [data-action="correct-now"]').count(),1);
   assert.equal(await page.locator('.is-play [data-action="pause"]').count(),1);
   const geometry=await page.evaluate(()=>{
     const card=document.querySelector('.is-play .challenge-card').getBoundingClientRect();
     const actions=[...document.querySelectorAll('.three-answer-actions .round-action')].map(e=>{
       const b=e.getBoundingClientRect();
       return {action:e.dataset.action,centerX:(b.left+b.right)/2,top:b.top,width:b.width,color:getComputedStyle(e).color};
     });
     const timer=document.querySelector('.round-top--timer .timer-ring').getBoundingClientRect();
     return {cardTop:card.top,cardHeight:card.height,timerBottom:timer.bottom,actions,viewport:innerWidth};
   });
   assert.ok(Math.abs(task.cardTop-geometry.cardTop)<=2,
     'Card jumped after timer start: '+JSON.stringify({task,geometry}));
   assert.ok(geometry.timerBottom<geometry.cardTop-3,'Timer should be above fixed card');
   assert.deepEqual(geometry.actions.map(x=>x.action),['wrong-now','toggle-word','correct-now']);
   assert.ok(geometry.actions[0].centerX<geometry.actions[1].centerX &&
     geometry.actions[1].centerX<geometry.actions[2].centerX,'Answer controls not ordered');
   assert.ok(Math.abs(geometry.actions[1].centerX-geometry.viewport/2)<=4,'Hide button not centered');
   assert.ok(geometry.actions[0].width>geometry.actions[1].width &&
     geometry.actions[2].width>geometry.actions[1].width,'Side decisions must be larger');
   assert.equal(geometry.actions[0].color,'rgb(255, 255, 255)');
   assert.equal(geometry.actions[2].color,'rgb(255, 255, 255)');
   await page.screenshot({path:'artifacts/iskra-polish/'+device.name+'-timer-controls.png'});
   const first=await isInViewport(page);
   assert.ok(first.page<=first.window+2&&first.inside<=first.height+4,'Game scroll overflow '+JSON.stringify(first));
   await page.locator('[data-action="correct-now"]').click();
   assert.equal(await page.locator('#score-a').textContent(),'1');
   assert.equal(await page.locator('#round-now').textContent(),'2');
   assert.equal(await page.locator('[data-action="roll"]').count(),1,'Extra next-step confirmation');
   await page.screenshot({path:'artifacts/iskra-polish/'+device.name+'-next-turn.png'});
   // Intentionally create another game while one is saved; nothing must summon a system alert.
   await page.locator('#exit-game').click();
   await page.locator('#new-game-menu').click();
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
   await page.screenshot({path:'artifacts/iskra-polish/'+device.name+'-judgement.png'});
   await page.locator('[data-action="no"]').click();
   assert.equal(await page.locator('[data-action="roll"]').count(),1);
   assert.deepEqual(errors,[],'Browser JS errors');
   console.log(device.name,JSON.stringify({ready,task,first,align,dialogs,errors}));
   await page.close();
  }
  // The hard/medium auto-start path passes through a one-second countdown;
  // check all THREE states have the exact same word-card geometry.
  const medium=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await medium.goto(URL,{waitUntil:'load'});
  await medium.locator('#new-game-menu').click();
  await medium.evaluate(()=>{options.modes=['talk'];options.dice=false;options.difficulty='medium';});
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
  await medium.screenshot({path:'artifacts/iskra-polish/phone-autostart-fixed-card.png'});
  await medium.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
