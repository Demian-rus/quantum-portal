'use strict';
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},
 {name:'desktop',width:1440,height:900},{name:'landscape',width:844,height:390},{name:'low-landscape',width:640,height:360}];
async function fixture(page,{modifier=true,policy='setter',mode='talk',long=false,version=5}={}){
 await page.evaluate(({modifier,policy,mode,long,version})=>{
  soundOn=false;options.awardTo=policy;options.modes=[mode];options.dice=false;options.complications=modifier;
  chooseStartingTeam=()=>0;Math.random=()=>0;
  selectedProfileIds=[long?'ПЕРВАЯСУПЕРДЛИННАЯКОМАНДА':'ПА',long?'ВТОРАЯСУПЕРДЛИННАЯКОМАНДА':'ДС'].map(name=>Array.from(name).slice(0,24).join('')).map((name,i)=>
   (profileStore.profiles.find(p=>p.name===name)||createPlayerProfile(name,i?'cyan':'coral')).id);
  newGame();game.rulesVersion=version;roll();game.dice=true;options.dice=true;persist();render();
 },{modifier,policy,mode,long,version});
 await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await page.locator('[data-action="toggle-word"]').click();await page.locator('button[data-action="start-timer"]').click();
}
async function controls(page,phase,modified){
 const root=page.locator('.verdict-actions');
 const g=await root.evaluate(el=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
  return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
   options:[...el.querySelectorAll('.judgement-option')].map(n=>({action:n.querySelector('button').dataset.action,button:rect(n.querySelector('button')),label:rect(n.querySelector('span')),text:n.querySelector('span').textContent})),
   copy:document.querySelector('.judge-copy')?rect(document.querySelector('.judge-copy')):null,
   details:[...document.querySelectorAll('.judge-team-name,.judge-copy .score-note,.judge-copy .score-recipient')].map(rect)};
 });
 const actions=phase==='play'?['wrong-now',...(modified?['base-now']:[]),'correct-now']:['no',...(modified?['base']:[]),'yes'];
 assert.deepEqual(g.options.map(o=>o.action),actions);
 assert.ok(g.sw<=g.w+1&&g.sh<=g.h+1,'Screen overflow '+JSON.stringify(g));
 for(const o of g.options){
  const b=o.button,l=o.label;
  assert.ok(b.w>=44&&Math.abs(b.w-b.h)<1&&b.x>=0&&b.right<=g.w&&b.y>=0&&b.bottom<=g.h,'Circle clipped '+JSON.stringify(g));
  assert.ok(l.y>=b.bottom&&l.bottom<=g.h+1&&l.x>=0&&l.right<=g.w+1,'Label clipped '+JSON.stringify(g));
  assert.ok(Math.abs(b.x+b.w/2-l.x-l.w/2)<=2,'Label not centered');
 }
 assert.ok(g.options.every(o=>Math.abs(o.button.w-g.options[0].button.w)<=1),'Circle sizes differ');
 assert.ok(g.options.slice(1).every((o,i)=>o.button.x>g.options[i].button.right),'Circles overlap');
 if(g.copy){assert.ok(g.copy.bottom<=g.options[0].button.y+1,'Copy overlaps fixed decisions');
  if(g.h<=390)assert.ok(g.details.every(r=>r.y>=g.copy.y-1&&r.bottom<=g.copy.bottom+1),'Essential result details not visible: '+JSON.stringify(g));
 }
 return g.options.map(o=>o.button);
}
async function shot(page,name){
 await page.locator('#play-content img').evaluateAll(async els=>{await Promise.all(els.map(e=>e.decode()));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)});
 await capture(page,{path:'artifacts/quip-mobile-layout/task007b-'+name+'.png'});
}
const expire=page=>page.evaluate(()=>{game.current.deadline=Date.now()-1;tick()});
module.exports=async function outcomes(browser,url){
 fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
 for(const device of devices){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.name==='phone'?2:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);
   await fixture(page,{modifier:false});const plain=await controls(page,'play',false);
   const plainCard=await page.locator('.round-fixed-card').boundingBox();
   await expire(page);const plainJudge=await controls(page,'judge',false);
   assert.ok(plain.every((b,i)=>Math.abs(b.x-plainJudge[i].x)<=2&&Math.abs(b.y-plainJudge[i].y)<=2),'Two circles moved at expiry');
   if(device.name==='phone')await shot(page,'phone-two');
   await page.locator('[data-action="yes"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[1,0]);
   await fixture(page);const modified=await controls(page,'play',true);
   const card=await page.locator('.round-fixed-card').boundingBox();
   assert.ok(Math.abs(card.y-plainCard.y)<=2&&Math.abs(card.height-plainCard.height)<=2,'Third outcome shifted the word card');
   const deadline=await page.evaluate(()=>game.current.deadline);
   await page.locator('[data-action="toggle-word"]').click();assert.equal(await page.evaluate(()=>game.current.visible),false);
   await page.locator('[data-action="toggle-word"]').click();assert.equal(await page.evaluate(()=>game.current.deadline),deadline);
   if(device.name==='phone')await shot(page,'phone-three-playing');
   await page.locator('[data-action="base-now"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[1,0]);
   assert.equal(await page.evaluate(()=>game.history[0].outcome),'base-only');
   await fixture(page,{policy:'guesser',long:true});await expire(page);
   const judge=await controls(page,'judge',true);
   assert.ok(modified.every((b,i)=>Math.abs(b.x-judge[i].x)<=2&&Math.abs(b.y-judge[i].y)<=2),'Three circles moved at expiry or long name');
   const title=await page.locator('.judge-team-name').evaluate(el=>({text:el.textContent,sw:el.scrollWidth,cw:el.clientWidth}));
   assert.equal(title.text,await page.evaluate(()=>game.teams[1]));assert.ok(title.sw<=title.cw+1,'Long guessing team clipped');
   assert.ok((await page.locator('.score-recipient').textContent()).includes(await page.evaluate(()=>game.teams[1])));
   if(['phone','narrow','low-landscape'].includes(device.name))await shot(page,device.name+'-three-long');
   const current=await page.evaluate(()=>JSON.stringify(game.current));await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(game.current)),current);await controls(page,'judge',true);
   await page.locator('[data-action="base"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[0,1]);
   await fixture(page,{policy:'setter'});await expire(page);await controls(page,'judge',true);
   assert.ok((await page.locator('.score-recipient').textContent()).includes('ПА'));
   assert.equal(await page.locator('.judge-team-name').textContent(),'ДС');
   if(device.name==='phone')await shot(page,'phone-three-timeout');
   await page.locator('[data-action="yes"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[2,0]);
   // This legacy geometry fixture seeds points without a ledger; real replayed risk is covered in TASK 020.
   await fixture(page,{policy:'guesser'});await page.evaluate(()=>{delete game.riskPolicyVersion;delete game.riskPlannerState;delete game.resultReviewVersion;delete game.reviewRevision;delete game.reviewConfirmed;game.scores=[5,5];game.current.risk=true;render()});
   await page.locator('[data-action="wrong-now"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[5,3]);
   assert.equal(await page.evaluate(()=>game.history[0].penalty),2);
   // Historical V4, including a stage-A policy, keeps two outcomes and its full bonus.
   await fixture(page,{version:4});await expire(page);await controls(page,'judge',false);
   await page.evaluate(()=>handleAction('base'));assert.equal(await page.evaluate(()=>game.roundIndex),0);
   await page.locator('[data-action="yes"]').click();assert.equal(await page.evaluate(()=>game.history[0].awarded),2);
   await fixture(page,{mode:'blitz'});
   if(device.height<=390){
    await shot(page,device.name+'-blitz-playing');
    const timer=await page.evaluate(()=>{const a=document.querySelector('.timer-ring').getBoundingClientRect(),b=document.querySelector('.timer-pause').getBoundingClientRect();return {ring:{left:a.left,right:a.right,top:a.top,bottom:a.bottom},pause:{left:b.left,right:b.right,top:b.top,bottom:b.bottom,w:b.width,h:b.height}}});
    assert.ok(timer.pause.w>=44&&timer.pause.h>=44);assert.ok(timer.pause.bottom<=timer.ring.top-2||timer.pause.right<=timer.ring.left-2||timer.pause.left>=timer.ring.right+2,'Pause overlaps timer: '+JSON.stringify(timer));
   }
   for(let i=0;i<3;i++)await page.locator('[data-action="blitz-correct"]').click();
   await controls(page,'judge',true);await page.locator('[data-action="base"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[2,0]);
   await fixture(page,{mode:'blitz'});await expire(page);
   assert.equal(await page.locator('[data-action="base"]').count(),0);assert.equal(await page.locator('[data-action="yes"]').count(),0);
   await page.locator('[data-action="no"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[0,0]);
   await fixture(page);await expire(page);
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   const snap=await page.evaluate(()=>JSON.stringify(game));await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(game)),snap);await controls(page,'judge',true);
   await page.locator('[data-action="base"]').click();assert.equal(await page.evaluate(()=>game.history[0].modifierPoints),0);assert.equal(await page.evaluate(()=>game.history[0].baseAwarded),1);
   assert.deepEqual(errors,[]);console.log('task007b outcomes PASS',device.name);
  }finally{await context.close();}
 }
};
