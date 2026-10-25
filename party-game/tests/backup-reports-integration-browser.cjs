'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quip-integration-'));
async function raw(page,key){return page.evaluate(key=>localStorage.getItem(key),key);}
async function download(page,id,name){const event=page.waitForEvent('download');await page.locator('#'+id).click();const d=await event;await d.saveAs(name);return JSON.parse(fs.readFileSync(name,'utf8'));}
async function upload(page,file){const picker=page.waitForEvent('filechooser');await page.locator('#backup-import').click();await(await picker).setFiles(file);await page.waitForFunction(()=>document.getElementById('backup-title').textContent==='АРХИВ НАЙДЕН');}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 fs.mkdirSync('artifacts/quip-integration',{recursive:true});
 try{
  const source=await browser.newContext(),sp=await source.newPage();await sp.goto(URL);await provisionProfiles(sp);
  await sp.evaluate(()=>{soundOn=false;Object.assign(options,{modes:['approx'],difficulty:'easy',rounds:2,finishType:'rounds',dice:false});newGame();game.dice=false;roll();revealApprox();awardApprox('a');roll();revealApprox();awardApprox('none');});
  await sp.locator('[data-action="menu"]').click();await sp.locator('#settings-menu').click();
  const file=path.join(tmp,'profiles.json'),backup=await download(sp,'backup-export',file);
  for(const[width,height]of [[320,568],[390,844],[844,390]]){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await provisionProfiles(page);
   await page.evaluate(()=>{soundOn=false;Object.assign(options,{modes:['approx'],difficulty:'easy',rounds:2,finishType:'rounds',dice:false});newGame();game.dice=false;roll();revealApprox();awardApprox('a');roll();revealApprox();awardApprox('none')});
   const played=await page.evaluate(()=>JSON.stringify(game));await page.locator('[data-report-history="0"]').tap();await page.goBack();await page.locator('#report-backdrop').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>JSON.stringify(game)),played);
   await page.locator('[data-report-history="0"]').tap();await page.locator('#report-reason').selectOption('theme');await page.locator('#report-save').click();
   await page.locator('[data-action="menu"]').click();await page.locator('#settings-menu').click();
   const profilesBefore=await raw(page,'kvip-player-profiles:v1'),reports=await raw(page,'kvip-card-reports:v1');
   assert.equal(JSON.parse(profilesBefore).recent.length,1);
   if(width===390)await page.screenshot({path:'artifacts/quip-integration/settings-both.png',animations:'disabled'});
   await page.locator('#reports-view').click();await page.keyboard.press('Escape');await page.locator('#report-backdrop').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.activeElement.id),'reports-view');
   await upload(page,file);await page.goBack();await page.locator('#backup-backdrop').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.activeElement.id),'backup-import');
   assert.equal(await page.evaluate(()=>document.querySelector('.site-shell').inert),false);
   assert.equal(await raw(page,'kvip-player-profiles:v1'),profilesBefore);assert.equal(await raw(page,'kvip-card-reports:v1'),reports);
   const exportedReports=await download(page,'reports-export',path.join(tmp,'reports-'+width+'.json'));
   assert.equal(exportedReports.kind,'kvip-card-reports');assert.equal(backup.kind,'kvip-profile-backup');
   assert.ok(!Object.hasOwn(backup.payload,'items'));assert.ok(!Object.hasOwn(exportedReports.archive,'profiles'));
   await upload(page,file);await page.locator('#backup-apply').click();await page.locator('#backup-confirm-check').check();await page.locator('#backup-apply').click();
   await page.waitForFunction(()=>document.getElementById('backup-title').textContent==='ПРОФИЛИ ВОССТАНОВЛЕНЫ');await page.locator('#backup-close').click();
   assert.deepEqual(JSON.parse(await raw(page,'kvip-player-profiles:v1')),backup.payload);assert.equal(await raw(page,'kvip-card-reports:v1'),reports);
   assert.equal(JSON.parse(await raw(page,'kvip-player-profiles:import-recovery:v1')).raw,profilesBefore);
   await page.locator('#reports-view').click();await page.locator('[data-report-edit="0"]').click();await page.locator('#report-edit-existing').click();await page.locator('#report-reason').selectOption('error');await page.locator('#report-save').click();
   const imported=await raw(page,'kvip-player-profiles:v1');assert.deepEqual(JSON.parse(imported),backup.payload);
   await page.locator('#preferences-back').click();
   await page.evaluate(()=>{Object.assign(options,{modes:['talk'],difficulty:'easy',dice:false});newGame();game.dice=false;roll();toggleWord();startTimer();window.__now=Date.now();Date.now=()=>window.__now;window.__reportRandomCalls=0;const random=Math.random;Math.random=()=>{window.__reportRandomCalls++;return random()}});
   const deadline=await page.evaluate(()=>game.current.deadline),visible=await page.evaluate(()=>game.current.visible),profileActive=await raw(page,'kvip-player-profiles:v1');
   await page.locator('[data-feedback="report"]').tap();const remain=await page.evaluate(()=>game.current.feedbackHold.remainingMs);await page.evaluate(()=>{window.__now+=500;tick()});assert.equal(await page.evaluate(()=>game.current.deadline),null);assert.equal(await page.evaluate(()=>game.current.feedbackHold.remainingMs),remain);
   await page.locator('#report-save').click();assert.equal(await page.evaluate(()=>game.current.deadline),deadline+500);assert.equal(await page.evaluate(()=>game.current.visible),visible);assert.equal(await page.evaluate(()=>window.__reportRandomCalls),0);
   assert.equal(await raw(page,'kvip-player-profiles:v1'),profileActive);await page.evaluate(()=>{pauseTimer();game.dice=true;options.dice=true;persist()});
   const savedGame=await page.evaluate(()=>JSON.stringify(game)),main=await raw(page,'iskra-party:v1'),reportsAfter=await raw(page,'kvip-card-reports:v1');
   await page.locator('#exit-game').click();await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(game)),savedGame);assert.equal(await raw(page,'iskra-party:v1'),main);assert.equal(await raw(page,'kvip-card-reports:v1'),reportsAfter);assert.equal(await raw(page,'kvip-player-profiles:v1'),profileActive);
   await page.locator('#exit-game').click();await page.locator('#settings-menu').click();
   await download(page,'backup-export',path.join(tmp,'offline-profiles-'+width+'.json'));await download(page,'reports-export',path.join(tmp,'offline-reports-'+width+'.json'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
   await ctx.close();console.log('v80 combined archives / modal focus / timer / paused restore / offline exports',width,height,'PASS');
  }
  await source.close();
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
