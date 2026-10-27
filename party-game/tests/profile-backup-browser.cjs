'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright-core');
const {chooseNamedProfile,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const {execFileSync}=require('node:child_process');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const KEY='kvip-player-profiles:v1',GAME='iskra-party:v1',RECOVERY='kvip-player-profiles:import-recovery:v1';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kvip-backup-'));
async function snapshot(page){return page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));}
async function upload(page,file){
 const picker=page.waitForEvent('filechooser');await page.locator('#backup-import').click();await(await picker).setFiles(file);
 await page.waitForFunction(()=>['АРХИВ НАЙДЕН','ФАЙЛ НЕ ПРИНЯТ'].includes(document.getElementById('backup-title').textContent));
}
async function download(page,button,file){
 const event=page.waitForEvent('download');await page.locator(button).click();const result=await event;
 assert.match(result.suggestedFilename(),/^kvip-profiles(-previous)?-\d{4}-\d{2}-\d{2}\.json$/);
 await result.saveAs(file);return fs.readFileSync(file,'utf8');
}
async function startApprox(page){
 await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
 await chooseNamedProfile(page,0,'ДС','violet');await chooseNamedProfile(page,1,'ПА','green');
 await setupRules(page);await page.locator('#finish-rounds').check({force:true});
 await page.locator('#custom-rounds').focus();await page.locator('#custom-rounds').press('Home');
 await setupFold(page,'mode-settings');
 if(!await page.locator('#mode-toggles input[value="approx"]').isChecked())await page.locator('#mode-toggles label:has(input[value="approx"])').click();
 for(const id of ['talk','mime','draw','sing','yesno','blitz','secret']){
  const input=page.locator('#mode-toggles input[value="'+id+'"]');
  if(await input.isChecked())await page.locator('#mode-toggles label:has(input[value="'+id+'"])').click();
 }
 await setupPlayers(page);await startFromSetup(page);await page.evaluate(()=>{game.dice=false});
}
async function answer(page,choice){
 await page.locator('[data-action="roll"]').click();await page.locator('[data-action="reveal-approx"]').click();
 await page.locator('[data-action="award-'+choice+'"]').click();
 if(await page.evaluate(()=>game.phase==='review'))await page.locator('[data-action="confirm-results"]').click();
}
async function confirmReplace(page){
 await page.locator('#backup-apply').click();assert.equal(await page.locator('#backup-confirm-area').isVisible(),true);
 assert.equal(await page.locator('#backup-apply').isDisabled(),true);
 await page.locator('#backup-confirm-check').check();await page.locator('#backup-apply').click();
}
async function success(page){await page.waitForFunction(()=>document.getElementById('backup-title').textContent==='ПРОФИЛИ ВОССТАНОВЛЕНЫ');}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 fs.mkdirSync('artifacts/quip-backup',{recursive:true});
 try{
  const source=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),sp=await source.newPage();
  // Serve the real preceding PWA, then update its worker and cold-start offline.
  const root=path.resolve(__dirname,'../..'),baseline='042a9392a517d5bfacaee6e2ae3caf42ce99c72f';
  const git=args=>execFileSync('git',args,{cwd:root,timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
  try{git(['cat-file','-e',baseline+'^{commit}'])}catch{git(['fetch','--depth=1','origin',baseline])}
  const files=historicalRuntimeFiles(git,baseline,['sw.js','index.html','style.css']);
  const current=new Map(files.map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
  const previous=new Map(files.map(name=>[name,git(['show',baseline+':party-game/'+name])]));
  const write=sources=>{for(const[name,content]of sources)fs.writeFileSync(path.join(root,'party-game',name),content)};
  const cache=content=>content.toString().match(/const CACHE='([^']+)'/)[1];
  try{
   write(previous);for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
   await sp.goto(URL);await startApprox(sp);await answer(sp,'a');await answer(sp,'none');await sp.locator('[data-action="menu"]').click();
   // Keep a real v75 paused task across the update, including its original ID-less snapshot.
   await sp.evaluate(()=>{Object.assign(options,{modes:['talk'],difficulty:'easy',dice:true});newGame();game.dice=false;roll();toggleWord();startTimer();pauseTimer();game.dice=true;options.dice=true;persist();backToMenu()});
   const oldGame=await sp.evaluate(()=>JSON.stringify(game)),oldMain=(await snapshot(sp))[GAME];
   const raw=(await snapshot(sp))[KEY];
   await sp.evaluate(async()=>{await navigator.serviceWorker.ready});await sp.waitForFunction(()=>!!navigator.serviceWorker.controller);
   write(current);
   await sp.evaluate(async()=>{
    const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    const registration=await navigator.serviceWorker.getRegistration();await registration.update();
    await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Backup PWA update timed out')),15000))]);
   });
   await sp.waitForFunction(async({oldCache,newCache})=>await caches.has(newCache)&&!await caches.has(oldCache),{oldCache:cache(previous.get('sw.js')),newCache:cache(current.get('sw.js'))});
   await source.setOffline(true);await sp.reload();assert.equal((await snapshot(sp))[KEY],raw,'PWA update cannot mutate profiles');
   const cached=await sp.evaluate(async name=>{const c=await caches.open(name);return Promise.all([...document.scripts].filter(s=>s.src).map(async s=>({url:s.src,found:!!await c.match(s.src)})))},cache(current.get('sw.js')));
   assert.equal(cached.length,49);assert.deepEqual(cached.filter(row=>!row.found),[],'Every runtime script must be precached');
   await sp.locator('#continue-game').click();assert.equal(await sp.evaluate(()=>JSON.stringify(game)),oldGame,'v75 paused game must remain exact');assert.equal((await snapshot(sp))[GAME],oldMain,'v75 main RAW must remain exact');
   await sp.locator('#exit-game').click();await sp.locator('#settings-menu').click();
   console.log('v75 → '+cache(current.get('sw.js'))+' PWA upgrade / exact v75 profiles + paused game RAW / offline backup UI / precache 48/48 PASS');
  }finally{write(current);}
  const file=path.join(tmp,'profiles.json'),text=await download(sp,'#backup-export',file),payload=JSON.parse(text).payload;
  assert.equal(payload.recent.length,1);assert.equal(payload.totals[payload.profiles[0].id].matches,1);
  assert.equal(Object.hasOwn(JSON.parse(text),'game'),false);
  for(const [width,height] of [[320,568],[390,844],[844,390]]){
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await page.locator('#settings-menu').tap();
   assert.equal(await page.locator('#backup-export').evaluate(el=>el.getBoundingClientRect().height>=44),true);
   const before=await snapshot(page);await upload(page,file);
   assert.equal(await page.locator('#backup-confirm-area').isVisible(),false);
   assert.match(await page.locator('#backup-preview').textContent(),/ДС/);
   assert.deepEqual(await snapshot(page),before,'preview must be read-only');
   if(width===390)await page.screenshot({path:'artifacts/quip-backup/preview.png'});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#backup-backdrop').isVisible(),false);
   await upload(page,file);await page.goBack();await page.locator('#backup-backdrop').waitFor({state:'hidden'});
   assert.equal(await page.locator('#scene-preferences').isVisible(),true);assert.deepEqual(await snapshot(page),before);
   await upload(page,file);await page.locator('#backup-apply').tap();await success(page);
   assert.deepEqual(JSON.parse((await snapshot(page))[KEY]),payload);
   await page.locator('#backup-close').click();
   await page.reload();await page.locator('#statistics-menu').click();
   assert.match(await page.locator('#statistics-profile').textContent(),/ДС/);
   assert.match(await page.locator('#statistics-metrics').textContent(),/Игр/);
   assert.equal(await page.locator('.profile-dot').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(175, 152, 255)');
   await page.locator('#statistics-back').click();await page.locator('#settings-menu').click();
   await upload(page,file);assert.match(await page.locator('#backup-preview').textContent(),/Изменения не нужны/);
   assert.equal(await page.locator('#backup-apply').isVisible(),false);await page.locator('#backup-close').click();
   // Replacement is two explicit actions, in addition to selecting the file.
   await page.evaluate(()=>createPlayerProfile('Третий','orange'));const old=(await snapshot(page))[KEY];
   await upload(page,file);await page.locator('#backup-apply').click();
   assert.equal(await page.locator('#backup-apply').isDisabled(),true);
   assert.equal((await snapshot(page))[KEY],old);
   if(width===320)await page.screenshot({path:'artifacts/quip-backup/confirmation-320.png'});
   await page.locator('#backup-confirm-check').check();await page.locator('#backup-apply').tap();await success(page);
   assert.equal(JSON.parse((await snapshot(page))[RECOVERY]).raw,old);
   await page.locator('#backup-close').click();
   // Save/acknowledge/delete a recovery explicitly; never delete automatically.
   assert.equal(await page.locator('#backup-recovery').isVisible(),true);
   const saved=await download(page,'#backup-recovery-export',path.join(tmp,'previous-'+width+'.json'));
   assert.equal(JSON.stringify(JSON.parse(saved).payload),old);
   await page.locator('#backup-recovery-saved').check();page.once('dialog',dialog=>dialog.accept());await page.locator('#backup-recovery-clear').click();
   assert.equal((await snapshot(page))[RECOVERY],undefined);
   // Offline cold reload retains profile identities, downloaded export and import.
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();
   await page.locator('#settings-menu').click();await download(page,'#backup-export',path.join(tmp,'offline-'+width+'.json'));
   const offline=(await snapshot(page))[KEY];
   await page.evaluate(()=>localStorage.removeItem('kvip-player-profiles:v1')); // empty second-device fixture
   await upload(page,file);await page.locator('#backup-apply').click();await success(page);
   assert.equal((await snapshot(page))[KEY],offline);await page.locator('#backup-close').click();
   await page.reload();await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
   await chooseNamedProfile(page,0,'ДС');await chooseNamedProfile(page,1,'ПА');await startFromSetup(page);
   assert.equal(await page.locator('#scene-game').isVisible(),true);assert.deepEqual(await page.evaluate(()=>game.profileMatch.participants.map(p=>p.id)),payload.profiles.map(p=>p.id));
   await page.locator('#exit-game').click();await page.locator('#settings-menu').click();
   // A genuinely different archive is blocked while a game is paused/active.
   await page.evaluate(()=>createPlayerProfile('Четвёртый','pink'));const gameRaw=(await snapshot(page))[GAME];
   await upload(page,file);assert.match(await page.locator('#backup-panel-error').textContent(),/есть партия/);
   assert.equal(await page.locator('#backup-apply').isVisible(),false);assert.equal((await snapshot(page))[GAME],gameRaw);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(errors,[]);await ctx.close();console.log('backup file picker / download / confirmation / Back / offline / restart',width,height,'PASS');
  }
  // The finished-game path does not silently clear RAW, and settlement is checked before retirement.
  {
   const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();await page.goto(URL);
   await startApprox(page);await answer(page,'a');await answer(page,'none');await page.reload();
   await page.locator('#settings-menu').click();const raw=(await snapshot(page))[GAME],old=(await snapshot(page))[KEY];
   await upload(page,file);assert.match(await page.locator('#backup-panel-error').textContent(),/завершённая партия/);assert.equal((await snapshot(page))[GAME],raw);
   await page.locator('#backup-open-results').click();await page.locator('[data-action="menu"]').click();
   assert.equal(JSON.parse((await snapshot(page))[GAME]).game,null);assert.equal((await snapshot(page))[KEY],old);
   await page.locator('#settings-menu').click();await upload(page,file);await confirmReplace(page);await success(page);await ctx.close();
   console.log('completed game / explicit result retirement / no duplicate settlement PASS');
  }
  // Stale preview, corrupt file and corrupt current archive cannot erase anything.
  {
   const ctx=await browser.newContext(),page=await ctx.newPage();await page.goto(URL);await page.locator('#settings-menu').click();
   await upload(page,file);await page.evaluate(()=>createPlayerProfile('Новый','cyan'));
   const old=(await snapshot(page))[KEY];await page.locator('#backup-apply').click();
   await page.waitForFunction(()=>document.getElementById('backup-panel-error').textContent.includes('после предпросмотра'));
   assert.equal((await snapshot(page))[KEY],old);assert.equal((await snapshot(page))[RECOVERY],undefined);
   await page.locator('#backup-close').click();const bad=path.join(tmp,'bad.json');fs.writeFileSync(bad,'{broken');
   await upload(page,bad);assert.equal(await page.locator('#backup-title').textContent(),'ФАЙЛ НЕ ПРИНЯТ');assert.equal((await snapshot(page))[KEY],old);
   await page.locator('#backup-close').click();await page.evaluate(()=>localStorage.setItem('kvip-player-profiles:v1','{corrupt'));
   await upload(page,file);assert.match(await page.locator('#backup-panel-error').textContent(),/действующий архив повреждён/);assert.equal((await snapshot(page))[KEY],'{corrupt');await ctx.close();
   console.log('stale preview / malformed file / corrupt current archive PASS');
  }
  await source.close();
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
