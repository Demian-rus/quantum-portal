'use strict';
const assert=require('node:assert/strict');
module.exports=async function modifiersV2Browser(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'load'});
  await page.evaluate(()=>{soundOn=false;options.modes=['yesno'];options.difficulty='hard';options.awardTo='guesser';options.modifierChance=100;options.dice=false;newGame();delete game.modeCompatibilityVersion;game.awardTo='setter';roll()});
  assert.equal(await page.evaluate(()=>game.current.complication),'');
  assert.equal(await page.locator('[data-action="toggle-word"]').count(),1);
  await page.evaluate(()=>{options.awardTo='guesser';newGame();roll()});
  assert.equal(await page.evaluate(()=>game.current.complicationId),'v2-no-biography');
  await page.evaluate(()=>{game.awardTo='setter';delete game.modeCompatibilityVersion;game.modes=['secret','yesno'];pickMode=()=>getMode('secret');game.current=rollOutcome();game.phase='task';game.dice=true;persist();render()});
  assert.notEqual(await page.evaluate(()=>game.current.methodId),'yesno');assert.ok(await page.evaluate(()=>game.current.complication));
  const snapshot=await page.evaluate(()=>JSON.stringify(game));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);
  await page.evaluate(()=>{options.modes=['secret'];options.difficulty='mixed';newGame();for(let i=0;i<18;i++){game.current=rollOutcome();if(!game.current.complication)throw Error('Missing mandatory condition');game.roundIndex++}game.phase='task';persist();render()});
  assert.deepEqual(errors,[]);console.log('TASK009 C V2: recipient eligibility / Secret fallback / offline snapshot / tier exhaustion PASS');
 }finally{await context.close()}
};
