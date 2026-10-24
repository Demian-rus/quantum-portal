'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quip-reports-'));
async function saved(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kvip-card-reports:v1')));}
async function protectedState(page){return page.evaluate(()=>({game:JSON.stringify(game),main:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)}));}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 fs.mkdirSync('artifacts/quip-reports',{recursive:true});
 try{
  for(const [width,height]of [[320,568],[390,844],[844,390]]){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await provisionProfiles(page);
   await page.evaluate(()=>{window.__now=Date.now();Date.now=()=>window.__now;soundOn=false;});
   for(const mode of ['talk','mime','draw','yesno','secret','blitz','sing','approx']){
    await page.evaluate(mode=>{Object.assign(options,{modes:[mode],awardTo:'guesser',difficulty:'easy',dice:false,complications:false});newGame();game.dice=false;roll()},mode);
    await page.locator('#report-card').waitFor({state:'visible'});
    const before=await protectedState(page),item=await page.evaluate(()=>currentReportItem(game));
    const fixed=mode==='approx'?null:await page.locator('.challenge-card').boundingBox();
    const flag=await page.locator('#report-card').boundingBox();assert.ok(flag.width>=44&&flag.height>=44);
    if(fixed)assert.ok(flag.y+flag.height<=fixed.y+1,'flag must not overlap card');
    await page.locator('#report-card').tap();assert.equal(await page.locator('#report-backdrop').isVisible(),true);
    if(mode!=='approx')assert.ok(!(await page.locator('#report-target').textContent()).includes(item.text),'hidden prompt cannot be revealed by flag');
    assert.deepEqual(await protectedState(page),before,'opening report cannot mutate game or profiles');
    await page.keyboard.press('Escape');await page.locator('#report-backdrop').waitFor({state:'hidden'});assert.deepEqual(await protectedState(page),before);
    await page.locator('#report-card').tap();await page.goBack();await page.locator('#report-backdrop').waitFor({state:'hidden'});assert.deepEqual(await protectedState(page),before);
    await page.locator('#report-card').tap();await page.locator('#report-reason').selectOption('other');await page.locator('#report-comment').fill('  Проверить   формулировку  ');
    if(width===390&&mode==='talk')await page.screenshot({path:'artifacts/quip-reports/report-dialog.png'});
    await page.locator('#report-save').click();await page.locator('#report-backdrop').waitFor({state:'hidden'});
    assert.deepEqual(await protectedState(page),before);assert.equal((await saved(page)).items.at(-1).item.cardId,item.cardId);
    await page.locator('#report-card').click();assert.equal(await page.locator('#report-save').isDisabled(),true);
    await page.locator('#report-edit-existing').click();await page.locator('#report-reason').selectOption('ambiguous');await page.locator('#report-save').click();
    const count=(await saved(page)).items.length;assert.equal((await saved(page)).items.at(-1).reason,'ambiguous');
    if(mode!=='approx'){
     await page.locator('.challenge-card').tap();assert.equal(await page.evaluate(()=>game.current.visible),true);
     await page.locator('[data-action="start-timer"]').click();const deadline=await page.evaluate(()=>game.current.deadline);
     await page.locator('#report-card').tap();assert.equal(await page.locator('#report-timer-notice').isVisible(),true);
     await page.evaluate(()=>{window.__now+=500;tick()});assert.equal(await page.evaluate(()=>game.current.deadline),deadline);
     assert.equal(await page.evaluate(()=>game.current.paused),false);
     await page.locator('#report-cancel').click();assert.equal(await page.evaluate(()=>game.current.deadline),deadline);
     if(mode==='blitz'){
      await page.locator('[data-action="blitz-skip"]').click();const next=await page.evaluate(()=>currentReportItem(game));assert.notEqual(next.cardId,item.cardId);
      await page.locator('#report-card').tap();await page.locator('#report-save').click();assert.equal((await saved(page)).items.length,count+1);
      assert.equal((await saved(page)).items.at(-1).item.cardId,next.cardId);
     }
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   }
   // Shared deciding question reports its numerical ID and leaves scores untouched.
   await page.evaluate(()=>{game.finishType='score';game.roundIndex=30;game.scores=[15,15];game.targetScore=15;game.current=null;beginTiebreak();persist();render()});
   const tie=await protectedState(page),id=await page.evaluate(()=>game.tiebreak.question.id);
   await page.locator('#report-card').tap();await page.locator('#report-save').click();
   assert.deepEqual(await protectedState(page),tie);assert.equal((await saved(page)).items.at(-1).item.cardId,id);assert.equal((await saved(page)).items.at(-1).item.context,'tiebreak');
   // Offline persistence, list/edit, JSON download, single deletion and explicit clear.
   await page.locator('#exit-game').click();await page.locator('#settings-menu').click();
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   const archive=await saved(page);await ctx.setOffline(true);await page.reload();assert.deepEqual(await saved(page),archive);
   await page.locator('#settings-menu').click();await page.locator('#reports-view').click();
   assert.equal(await page.locator('.report-list-row').count(),archive.items.length);
   if(width===320)await page.screenshot({path:'artifacts/quip-reports/list-320.png'});
   await page.locator('#report-close').click();const event=page.waitForEvent('download');await page.locator('#reports-export').click();
   const download=await event;assert.match(download.suggestedFilename(),/^kvip-card-reports-\d{4}-\d{2}-\d{2}\.json$/);
   const filename=path.join(tmp,'reports-'+width+'.json');await download.saveAs(filename);
   const exported=JSON.parse(fs.readFileSync(filename,'utf8'));assert.deepEqual(exported.archive,archive);
   assert.ok(!/profileMatch|profileId|team|scores|matchId/.test(JSON.stringify(exported)));
   await page.locator('#reports-view').click();page.once('dialog',d=>d.accept());await page.locator('[data-report-delete="0"]').click();assert.equal((await saved(page)).items.length,archive.items.length-1);
   page.once('dialog',d=>d.dismiss());await page.locator('#reports-clear').click();assert.equal((await saved(page)).items.length,archive.items.length-1);
   page.once('dialog',d=>d.accept());await page.locator('#reports-clear').click();assert.equal((await saved(page)).items.length,0);
   assert.deepEqual(errors,[]);await ctx.close();console.log('reports all modes / ID / touch / Back / clock / offline / export',width,height,'PASS');
  }
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
