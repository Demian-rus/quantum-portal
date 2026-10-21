'use strict';
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
   await page.locator('#new-game-menu').click();
   await page.locator('#team-a').fill('Молнии');
   await page.locator('#team-b').fill('Кометы');
   await page.locator('#quick-target-score').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}))});
   await page.locator('#quick-duration').evaluate(el=>{el.value='45';el.dispatchEvent(new Event('input',{bubbles:true}))});
   assert.equal(await page.locator('#score-goal-preview').textContent(),'До 35 очков');
   assert.equal(await page.locator('#base-duration-value').textContent(),'45 с');
   await page.locator('#go-advanced').click();
   assert.equal(await page.locator('#target-score').inputValue(),'35');
   assert.equal(await page.locator('#base-duration').inputValue(),'45');
   await page.locator('#advanced-done').click();
   await page.evaluate(()=>{options.modes=['talk'];options.riskRounds=true;});
   await page.locator('#start-game').click();
   assert.equal(await page.locator('#role-a').textContent(),'ЗАГАДЫВАЕТ');
   assert.equal(await page.locator('#role-b').textContent(),'ОТГАДЫВАЕТ');
   assert.equal(await page.locator('#match-center-label').textContent(),'ЦЕЛЬ 35');
   assert.equal(await page.locator('#round-total').isVisible(),false);
   await page.evaluate(()=>{game.scores=[8,1];game.current=rollOutcome();game.current.risk=true;game.phase='task';render()});
   assert.equal(await page.locator('.risk-notice').count(),1,'Risk must be visible before revealing the card');
   assert.match(await page.locator('#play-step').textContent(),/ЗАГАДЫВАЕТ/);
   let bounds=await page.locator('.challenge-card').evaluate(el=>{
     const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:innerHeight,width:b.width,window:innerWidth};
   });
   assert.ok(bounds.top>=0&&bounds.bottom<=height+2,'Risk card outside viewport: '+JSON.stringify(bounds));
   await page.screenshot({path:'artifacts/quip-duel/'+name+'-risk-card.png'});
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
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
