'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quip-v79-'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 fs.mkdirSync('artifacts/quip-content400',{recursive:true});
 try{
  for(const[width,height]of [[320,568],[390,844],[844,390]]){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await provisionProfiles(page);await page.evaluate(()=>{soundOn=false});
   const selected=[];
   for(const[pack,version,origin]of [['general',14,'science-expansion-v4'],['geography',6,'geography-expansion-v2'],['science',8,'science-expansion-v4']]){
    await page.locator('#new-game-menu').click();assert.equal((await page.locator('#standard-content-count').textContent()).replace(/\D/g,''),'5400');
    if(pack==='general')await page.locator('#standard-game').click();
    else{
     await page.locator('#thematic-game').click();
     for(const[id,v,n]of [['geography',6,406],['science',8,582]]){const button=page.locator('[data-theme="'+id+'"][data-version="'+v+'"]');assert.equal(await button.count(),1);assert.match(await button.textContent(),new RegExp(String(n)));}
     if(width===390&&pack==='geography')await page.screenshot({path:'artifacts/quip-content400/catalogs-390.png',animations:'disabled'});
     await page.locator('[data-theme="'+pack+'"]').click();
    }
    await page.evaluate(()=>{Object.assign(options,{modes:['talk'],difficulty:'easy',complications:false,dice:false});renderOptions()});
    await page.locator('#start-game').click();
    await page.evaluate(()=>{game.dice=false;Math.random=()=>.999999;roll();game.dice=true;options.dice=true;persist();render()});
    const item=await page.evaluate(()=>({report:currentReportItem(game),origin:PARTY_CARD_BY_ID.get(game.current.cardId).pack}));
    assert.equal(item.report.pack.id,pack);assert.equal(item.report.pack.version,version);assert.equal(item.origin,origin);selected.push(item.report.cardId);
    const before=await page.evaluate(()=>({game:JSON.stringify(game),main:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)}));
    await page.locator('#report-card').tap();assert.ok(!(await page.locator('#report-target').textContent()).includes(item.report.text));await page.locator('#report-save').click();
    assert.deepEqual(await page.evaluate(()=>({game:JSON.stringify(game),main:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)})),before);
    if(pack==='science'){
     await page.locator('.challenge-card').tap();await page.locator('[data-action="start-timer"]').click();await page.locator('[data-action="pause"]').click();
    }
    await page.locator('#exit-game').click();
   }
   const stored=await page.evaluate(()=>({game:JSON.stringify(game),main:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY)}));
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();
   assert.deepEqual(await page.evaluate(()=>({game:JSON.stringify(game),main:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY)})),stored);
   assert.equal(await page.evaluate(()=>game.contentPack.version),8);assert.equal(await page.evaluate(()=>game.current.cardId),selected[2]);
   await page.locator('#exit-game').click();await page.locator('#settings-menu').click();assert.match(await page.locator('#reports-count').textContent(),/3 \/ 500/);
   const event=page.waitForEvent('download');await page.locator('#reports-export').click();const d=await event,filename=path.join(tmp,'reports-'+width+'.json');await d.saveAs(filename);
   const rows=JSON.parse(fs.readFileSync(filename,'utf8')).archive.items;assert.deepEqual(rows.map(r=>r.item.cardId),selected);assert.deepEqual(rows.map(r=>r.item.pack.version),[14,6,8]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
   await ctx.close();console.log('v79 catalog counts / new source IDs / reports / exact paused offline restore',width,height,'PASS');
  }
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
