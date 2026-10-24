'use strict';
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const assert=require('node:assert/strict');
module.exports=async function dictionaryBrowser(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 try{
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
  await page.evaluate(()=>{soundOn=false;options.modes=['talk'];options.promptTypes=['word'];options.complications=false;options.dice=false;options.difficulty='easy';Math.random=()=>.99999});
  await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();
  assert.equal(await page.evaluate(()=>game.contentPack.version),await page.evaluate(()=>latestGeneralPackSelection().version));assert.equal(await page.evaluate(()=>game.current.word),'ПОДОДЕЯЛЬНИК');
  await page.evaluate(()=>{game.dice=true;persist()});const snapshot=await page.evaluate(()=>JSON.stringify(game));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);
  assert.equal(await page.evaluate(()=>getPackCardPool({id:'general',version:2},'words','easy',['word']).some(r=>r.pack==='general-expansion-v1')),false);
  await context.setOffline(false);await page.evaluate(()=>{options.modes=['sing'];options.dice=false;options.complications=false;newGame();roll();game.dice=true;persist()});
  assert.match(await page.evaluate(()=>modeInformation().rule),/любую песню/);
  const songSnapshot=await page.evaluate(()=>JSON.stringify(game));await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),songSnapshot);assert.match(await page.evaluate(()=>modeInformation().rule),/любую песню/);
  console.log('TASK009 D2 music: universal topic / rule copy / offline snapshot PASS');
  console.log('TASK009 D1 dictionary: new standard card / pinned old pool / offline snapshot PASS');
 }finally{await context.close()}
};
