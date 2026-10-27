'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const assert=require('node:assert/strict');
module.exports=async function taskHistoryBrowser(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);
  await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
  await page.evaluate(()=>{soundOn=false;options.modes=['talk'];options.complications=false;options.dice=false});
  await startFromSetup(page);await page.locator('[data-action="roll"]').click();
  const first=await page.evaluate(()=>game.current.word);await page.evaluate(()=>replaceWord());
  const replaced=await page.evaluate(()=>game.current.word);assert.notEqual(first,replaced);
  await page.evaluate(()=>persist());const history=await page.evaluate(()=>JSON.stringify(game.taskHistory));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game.taskHistory)),history);
  assert.equal(await page.evaluate(()=>game.current.word),replaced);
  await page.evaluate(()=>{options.modes=['blitz'];options.dice=false;newGame()});
  await page.locator('[data-action="roll"]').click();
  const state=await page.evaluate(()=>({words:game.current.blitzWords,seen:game.taskHistory.seen,parties:taskMemory.parties,version:game.taskHistoryVersion}));
  assert.equal(state.version,1);assert.equal(state.parties.length,1);assert.equal(new Set(state.words).size,3);
  for(const word of state.words){assert.ok(![first,replaced].includes(word));assert.ok(state.seen.includes('prompt:text:'+word.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim()))}
  await page.evaluate(()=>{game.dice=true;persist()});const snapshot=await page.evaluate(()=>JSON.stringify(game));await page.reload({waitUntil:'load'});
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);assert.deepEqual(errors,[]);
  console.log('TASK009 B history: replacement / interrupted match / offline reload / all Blitz cards PASS');
 }finally{await context.close()}
};
