'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const assert=require('node:assert/strict');
module.exports=async function estimationBrowser(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 try{
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
  await page.evaluate(()=>{soundOn=false;options.modes=['approx'];options.difficulty='hard';options.complications=false;options.dice=false;Math.random=()=>.99999});await startFromSetup(page);await page.locator('[data-action="roll"]').click();
  assert.equal(await page.evaluate(()=>game.contentPack.version),await page.evaluate(()=>latestGeneralPackSelection().version));assert.equal(await page.evaluate(()=>game.current.question.id),'approx-23115');assert.equal(await page.locator('.approx-answer').count(),0);
  await page.locator('[data-action="reveal-approx"]').click();assert.match(await page.locator('.approx-answer').textContent(),/585/);assert.equal(await page.locator('.approx-actions button').count(),4);
  await page.evaluate(()=>{game.dice=true;persist()});const freshSnapshot=await page.evaluate(()=>JSON.stringify(game));await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),freshSnapshot);assert.match(await page.locator('.approx-answer').textContent(),/585/);
  // Keep the former E question/answer fixture pinned to E rather than silently replacing it.
  await page.evaluate(()=>backToMenu());await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();await page.evaluate(()=>{options.modes=['approx'];options.difficulty='hard';options.complications=false;options.dice=false;Math.random=()=>.99999});await startFromSetup(page);await page.evaluate(()=>{game.contentPack={id:'general',version:5};persist()});await page.locator('[data-action="roll"]').click();
  assert.equal(await page.evaluate(()=>game.contentPack.version),5);assert.equal(await page.evaluate(()=>game.current.question.id),'approx-20148');
  await page.locator('[data-action="reveal-approx"]').click();assert.match(await page.locator('.approx-answer').textContent(),/2800/);assert.equal(await page.locator('.approx-actions button').count(),4);
  await page.evaluate(()=>{game.dice=true;persist()});const snapshot=await page.evaluate(()=>JSON.stringify(game));await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);assert.match(await page.locator('.approx-answer').textContent(),/2800/);assert.equal(await page.locator('.approx-actions button').count(),4);
  for(const id of ['geography','science']){const expectedVersion=await page.evaluate(id=>latestContentPackSelection(id).version,id);await page.evaluate(()=>backToMenu());await page.locator('#new-game-menu').click();await page.locator('#thematic-game').click();const tile=page.locator('[data-theme="'+id+'"]');assert.equal(await tile.getAttribute('data-version'),String(expectedVersion));await tile.click();await page.evaluate(()=>{options.modes=['approx'];options.dice=false;options.difficulty='mixed'});await startFromSetup(page);await page.locator('[data-action="roll"]').click();assert.equal(await page.evaluate(()=>game.contentPack.version),expectedVersion);assert.equal(await page.locator('.approx-question').count(),1)}
  console.log('TASK009 E/F estimation: latest general and themes / unchanged F answer / pinned E answer / four awards / byte-exact offline restores PASS');
 }finally{await context.close()}
};
