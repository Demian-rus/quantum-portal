'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const {chooseNamedProfile,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const baseline='571757e331e75854a5167c57d792072852336804',root=path.resolve(__dirname,'../..');
const folder='artifacts/quip-v84-upgrade',tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quip-v84-upgrade-'));
const snapshot=page=>page.evaluate(()=>({
 game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY),memory:JSON.stringify(taskMemory),
 profiles:localStorage.getItem(QUIP_PROFILES_KEY),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY),
 approvals:localStorage.getItem('kvip-card-approvals:v1')
}));
async function download(page,selector,name){
 const event=page.waitForEvent('download');await page.locator(selector).click();const file=path.join(tmp,name);
 await(await event).saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));
}
async function completedMatch(page){
 await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
 await chooseNamedProfile(page,0,'Исторический','violet');await chooseNamedProfile(page,1,'Соперник','green');
 await setupRules(page);await page.locator('#finish-rounds').check({force:true});
 await page.locator('#custom-rounds').focus();await page.locator('#custom-rounds').press('Home');
 await setupFold(page,'mode-settings');
 if(!await page.locator('#mode-toggles input[value="approx"]').isChecked())await page.locator('#mode-toggles label:has(input[value="approx"])').click();
 for(const id of ['talk','mime','draw','sing','yesno','blitz','secret'])if(await page.locator('#mode-toggles input[value="'+id+'"]').isChecked())await page.locator('#mode-toggles label:has(input[value="'+id+'"])').click();
 await setupPlayers(page);await startFromSetup(page);await page.evaluate(()=>{game.dice=false});
 for(const recipient of ['a','none']){
  await page.locator('[data-action="roll"]').click();await page.locator('[data-action="reveal-approx"]').click();await page.locator('[data-action="award-'+recipient+'"]').click();
 }
 await page.locator('[data-action="menu"]').click();
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});
 const git=args=>execFileSync('git',args,{cwd:root,timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
 try{git(['cat-file','-e',baseline+'^{commit}'])}catch{git(['fetch','--depth=1','origin',baseline])}
 const files=historicalRuntimeFiles(git,baseline,['sw.js','index.html','style.css']);
 assert.equal(files.length,48,'Exact v84 HTML must supply its original 45 scripts');
 const current=new Map([...files,'responsive-layout.css'].map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
 const previous=new Map(files.map(name=>[name,git(['show',baseline+':party-game/'+name])]));
 const write=sources=>{for(const[name,content]of sources)fs.writeFileSync(path.join(root,'party-game',name),content)};
 const cache=bytes=>bytes.toString().match(/const CACHE='([^']+)'/)[1];
 const oldCache=cache(previous.get('sw.js')),newCache=cache(current.get('sw.js'));
 assert.match(oldCache,/v84/);assert.match(newCache,/^kvip-pwa-v106-20261030-general-categories-candidate-d$/);assert.notEqual(oldCache,newCache);
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  write(previous);for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
  await page.goto(URL);await completedMatch(page);
  // Create a real v84 task and original TASK 017 report. No synthetic save format.
  await page.evaluate(()=>{
   soundOn=false;Math.random=()=>0;Object.assign(options,{modes:['mime'],difficulty:'easy',dice:true,complications:true,modifierChance:100});newGame();game.dice=false;
   roll();toggleWord();startTimer();pauseTimer();game.dice=true;options.dice=true;
   saveCardReport(currentReportItem(game),'other','Сохранено в опубликованной v84');persist();backToMenu();
  });
  const before=await snapshot(page),profiles=JSON.parse(before.profiles),reports=JSON.parse(before.reports);
  assert.equal(profiles.recent.length,1);assert.equal(profiles.totals[profiles.profiles[0].id].matches,1);
  assert.equal(reports.items.length,1);assert.equal(typeof reports.items[0].item.cardId,'string');assert.equal(before.approvals,null);
  const oldGame=JSON.parse(before.game),remaining=oldGame.current.remainingMs;
  assert.ok(remaining>0);assert.equal(oldGame.current.paused,true);assert.equal(oldGame.current.deadline,null);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await page.evaluate(name=>caches.has(name),oldCache),true);
  write(current);
  await page.evaluate(async()=>{
   const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   await(await navigator.serviceWorker.getRegistration()).update();
   await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('v84 update timed out')),15000))]);
  });
  await page.waitForFunction(async({oldCache,newCache})=>await caches.has(newCache)&&!await caches.has(oldCache),{oldCache,newCache});
  await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();
  assert.ok(!(await page.locator('.round-condition').textContent()).includes('физически недоступно'));
  assert.ok(JSON.parse(before.game).current.complication.includes('физически недоступно'),'The real old snapshot contains its compiled alternative');
  assert.deepEqual(await snapshot(page),before,'Upgrade + offline Continue must preserve every original RAW, task and history');
  const cached=await page.evaluate(async name=>{
   const c=await caches.open(name);return Promise.all([...document.scripts].filter(s=>s.src).map(async s=>({url:s.src,found:!!await c.match(s.src)})));
  },newCache);
  assert.equal(cached.length,54);assert.deepEqual(cached.filter(row=>!row.found),[],'54 current scripts must load from the new worker offline');
  assert.equal(await page.locator('.timer-ring[role="button"][data-action="resume"]').isVisible(),true);
  assert.equal(await page.locator('[data-feedback]').count(),2);
  await page.screenshot({path:folder+'/v84-paused-offline-v89.png',animations:'disabled'});
  // Opening and closing a report on an already paused historical party keeps it paused.
  await page.locator('[data-feedback="report"]').click();await page.keyboard.press('Escape');
  const cancelled=await snapshot(page);
  // The first explicit save after restore serializes normalized options in their
  // existing canonical order. Compare the entire root object, and every other
  // RAW byte, so no value or historical game field can be hidden by that order.
  assert.deepEqual(JSON.parse(cancelled.raw),JSON.parse(before.raw),'Report cancellation must preserve every root value');
  assert.deepEqual({...cancelled,raw:null},{...before,raw:null},'Report cancellation must preserve the exact v84 party and journal/profile bytes');
  await page.locator('.timer-ring[role="button"][data-action="resume"]').click();
  const resumed=await page.evaluate(()=>({left:game.current.deadline-Date.now(),paused:game.current.paused,history:game.history}));
  assert.equal(resumed.paused,false);assert.ok(resumed.left<=remaining&&resumed.left>remaining-1000,'Header Resume must retain the v84 remaining time');
  assert.deepEqual(resumed.history,oldGame.history);
  await page.locator('.timer-ring[role="button"][data-action="pause"]').click();
  await page.locator('#exit-game').click();await page.locator('#settings-menu').click();
  const protectedState=await snapshot(page);
  const backup=await download(page,'#backup-export','profiles.json');assert.equal(backup.kind,'kvip-profile-backup');
  assert.deepEqual(backup.payload,profiles);assert.equal(backup.sha256,require('node:crypto').createHash('sha256').update(JSON.stringify(profiles)).digest('hex'));
  const legacy=await download(page,'#reports-export','reports.json');assert.equal(legacy.kind,'kvip-card-reports');assert.deepEqual(legacy.archive,reports);
  const combined=await download(page,'#feedback-download','feedback.json');assert.equal(combined.kind,'kvip-card-feedback');
  assert.deepEqual(combined.reports,reports);assert.deepEqual(combined.approvals,{version:1,items:[]});
  assert.deepEqual(await snapshot(page),protectedState,'Offline exports are read-only');
  assert.equal(protectedState.profiles,before.profiles,'No second settlement or watermark change');
  assert.equal(protectedState.reports,before.reports,'No conversion of the old journal or original task ID');
  await page.screenshot({path:folder+'/v84-data-offline-v89.png',animations:'disabled'});
  assert.deepEqual(errors,[]);
  console.log('v84 → v89 real warm worker / offline cold reload / exact game, profiles, totals, recent, watermarks, task memory and report RAW PASS');
  console.log('48/48 precache / header Resume + retained time / report Escape / backup SHA-256 + legacy and combined JSON offline PASS');
 }finally{
  write(current);await ctx.close();await browser.close();fs.rmSync(tmp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
