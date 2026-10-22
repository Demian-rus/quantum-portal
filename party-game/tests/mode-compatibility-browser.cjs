'use strict';
const assert=require('node:assert/strict');
module.exports=async function modeCompatibilityBrowser(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'load'});
  await page.evaluate(()=>{soundOn=false;options.modes=['yesno'];options.awardTo='setter';newGame()});assert.equal(await page.evaluate(()=>game),null);
  await page.evaluate(()=>{options=optionsForPartyPreset('classic-duel',3,{awardTo:'setter',modes:['secret','yesno'],dice:false});newGame();roll()});
  assert.deepEqual(await page.evaluate(()=>game.modes),['secret']);assert.equal(await page.evaluate(()=>game.modeCompatibilityVersion),1);assert.notEqual(await page.evaluate(()=>game.current.methodId),'yesno');assert.ok(await page.evaluate(()=>game.current.complicationId));
  for(const value of [0,.99999]){await page.evaluate(value=>{options.modes=['talk','mime','secret'];options.awardTo='setter';newGame();const oldPick=pickMode;pickMode=()=>getMode('secret');Math.random=()=>value;try{roll()}finally{pickMode=oldPick}},value);assert.ok(['talk','mime'].includes(await page.evaluate(()=>game.current.methodId)));assert.ok(await page.evaluate(()=>game.current.complicationId))}
  for(const [difficulty,id]of [['easy','v2-question-budget'],['medium','v2-no-names-search'],['hard','v2-no-biography']]){
   await page.evaluate(difficulty=>{options.awardTo='guesser';options.modes=['secret','yesno'];options.difficulty=difficulty;options.dice=false;newGame();const oldPick=pickMode;pickMode=()=>getMode('secret');try{roll()}finally{pickMode=oldPick}},difficulty);
   assert.equal(await page.evaluate(()=>game.current.methodId),'yesno');assert.equal(await page.evaluate(()=>game.current.complicationId),id);
  }
  await page.evaluate(()=>{game.dice=true;game.phase='judge';selectAwardTo('setter');persist();render()});const snapshot=await page.evaluate(()=>JSON.stringify(game));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);assert.equal(await page.evaluate(()=>game.current.methodId),'yesno');assert.equal(await page.evaluate(()=>game.awardTo),'guesser');
  // A pre-G setter party keeps its selected Danetki/condition; setup policy cannot rewrite it.
  await page.evaluate(()=>{delete game.modeCompatibilityVersion;game.awardTo='setter';persist()});const legacy=await page.evaluate(()=>JSON.stringify(game));await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),legacy);
  await page.evaluate(()=>{game.modeCompatibilityVersion=99;persist()});const raw=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));await page.reload({waitUntil:'load'});assert.equal(await page.evaluate(()=>storageBlocked),true);await page.evaluate(()=>{persist();newGame()});assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),raw);
  assert.deepEqual(errors,[]);console.log('TASK009 G compatibility: setter rejection / presets / explicit Secret methods / three Danetki tiers / pinned old and new offline snapshots / unknown version protection PASS');
 }finally{await context.close()}
};
