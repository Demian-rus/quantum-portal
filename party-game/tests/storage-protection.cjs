'use strict';
const assert=require('node:assert/strict');
module.exports=async function storageProtection(browser,url){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),raw='{incomplete-save';
 try{
  await page.goto(url,{waitUntil:'load'});await page.evaluate(raw=>localStorage.setItem('iskra-party:v1',raw),raw);await page.reload({waitUntil:'load'});
  assert.equal(await page.evaluate(()=>storageBlocked),true);assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),raw);
  await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#start-game').click();assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),raw);assert.equal(await page.evaluate(()=>game),null);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#start-game').click();assert.equal(await page.evaluate(()=>storageBlocked),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(RECOVERY_KEY)).raw),raw);const snapshot=await page.evaluate(()=>JSON.stringify(game));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(RECOVERY_KEY)).raw),raw);
  console.log('TASK009 A corrupt save: protected / cancel / verified backup / consent / offline restore PASS');
 }finally{await context.close()}
};
