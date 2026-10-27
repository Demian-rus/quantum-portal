'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {capture}=require('./screenshots.cjs');
const ledger=require('../content/editorial/music-theme-review.json');
const language=id=>ledger.find(row=>row.id===id)?.language;
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},
 {name:'desktop',width:1280,height:800},{name:'landscape',width:640,height:360}];
async function setup(page){await page.locator('#new-game-menu').click();await page.locator('#standard-game').click()}
async function openMode(page,id='sing'){await modeCenter(page,id);}
async function sources(page,languages){
 for(const value of languages){const button=page.locator('[data-song-language="'+value+'"]');if(await button.getAttribute('aria-pressed')!=='true')await button.click()}
 for(const value of ['ru','en'].filter(value=>!languages.includes(value))){const button=page.locator('[data-song-language="'+value+'"]');if(await button.getAttribute('aria-pressed')==='true')await button.click()}
}
async function selected(page){return page.evaluate(()=>getPackCardPool(game.contentPack,'songs',game.current.difficulty).find(row=>row.text===game.current.word).id)}
async function ui(browser,url,device){
 const context=await browser.newContext({viewport:{width:device.width,height:device.height},hasTouch:device.width<500});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);await setup(page);
  await page.evaluate(()=>{soundOn=false;Object.assign(options,{modes:['sing'],difficulty:'hard',dice:false,complications:false,riskRounds:false});renderOptions()});
  await setupRules(page);await setupFold(page,'mode-settings');
  await page.locator('#scene-wizard').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(animation=>animation.finished.catch(()=>{}))));
  await page.locator('#mode-toggles img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  assert.equal(await page.locator('#mode-toggles .mode-gear').count(),0,'No per-mode gear survives in the sole UI');
  const rects=await page.locator('#mode-toggles label').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,sw:n.scrollWidth,cw:n.clientWidth}}));
  assert.equal(rects.length,8);assert(rects.every(r=>r.w>=44&&r.h>=44&&r.sw<=r.cw+1),'All eight touch tiles fit');
  if(device.name==='desktop'){
   await page.evaluate(()=>document.body.style.zoom='1.25');
   const zoomed=await page.locator('#mode-toggles label').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,sw:n.scrollWidth,cw:n.clientWidth})));
   assert.equal(zoomed.length,8);assert(zoomed.every(r=>r.w>=44&&r.h>=44&&r.sw<=r.cw+1),'125% zoom retains all touch tiles and complete text');
   await page.evaluate(()=>document.body.style.zoom='');
  }
  if(device.name==='phone'||device.name==='narrow')await capture(page,{path:'artifacts/quip-mobile-layout/task012c-'+device.name+'-tiles.png'});
  const modes=await page.evaluate(()=>JSON.stringify(options.modes));
  await openMode(page);
  const beforeRules=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  for(const id of ['talk','mime','draw','sing','yesno','secret','blitz','approx']){
   const row=page.locator('[data-wizard-rule="'+id+'"]'),details=row.locator('.wizard-rule-details');
   assert.equal(await details.evaluate(node=>node.open),false,'Every rule is closed on entry');
   assert.equal(await row.locator('.wizard-rule-copy').isVisible(),false);
   await details.locator('summary').click();
   assert.equal(await row.locator('.wizard-rule-copy').isVisible(),true);
   assert.equal(await page.evaluate(()=>JSON.stringify(options.modes)),modes,'Opening read-only rules must not toggle a mode');
   await details.locator('summary').press('Space');
   assert.equal(await row.locator('.wizard-rule-copy').isVisible(),false,'Native keyboard disclosure closes rules');
   assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),beforeRules,'Reading rules does not save settings');
  }
  await closeModeCenter(page);
  const talk=page.locator('#mode-toggles label:has(input[value="talk"])');
  await talk.click();assert.equal(await page.locator('#mode-toggles input[value="talk"]').isChecked(),true);
  await talk.click();assert.equal(await page.locator('#mode-toggles input[value="talk"]').isChecked(),false);
  await openMode(page);
  assert.equal(await page.locator('[data-song-language="ru"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-song-language="en"]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-song-language="ru"]').click();assert.match(await page.locator('#mode-source-status').textContent(),/хотя бы один/);
  await page.locator('[data-song-language="en"]').click();
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['ru','en']);
  if(device.name==='phone'||device.name==='narrow')await capture(page,{path:'artifacts/quip-mobile-layout/task012c-'+device.name+'-sources.png'});
  await page.locator('#wizard-rules-done').press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'wizard-mode-settings');
  await openMode(page);await page.goBack();await page.locator('#wizard-rules').waitFor({state:'hidden'});
  assert.equal(await page.locator('[data-wizard-page="3"]').isVisible(),true,'Back closes center without leaving Rules');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'wizard-mode-settings');
  await openMode(page);await sources(page,['en']);await page.locator('[data-song-language="en"]').click();
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  await closeModeCenter(page);await setupPlayers(page);
  await setupStep(page,3);await page.locator('.choices[data-setting="difficulty"] [data-value="easy"]').click();
  assert.equal(await page.locator('#start-game').isDisabled(),true);assert.match(await page.locator('#setup-mode-notice').textContent(),/источники или сложность/);
  await setupStep(page,3);await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').click();assert.equal(await page.locator('#start-game').isEnabled(),true);
  // Preferences belong to the mode, and survive visiting a theme without songs.
  await setupPlayers(page);await setupBack(page,'setup-back');await page.locator('#thematic-game').click();await page.locator('[data-theme="geography"]:enabled').click();await openMode(page);
  assert.equal(await page.locator('#mode-source-availability').isVisible(),true);
  assert.equal(await page.locator('#mode-toggles input[value="sing"]').isDisabled(),true);
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  await closeModeCenter(page);await setupPlayers(page);await setupBack(page,'setup-back');await page.locator('#standard-game').click();
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  // Return to the same single-mode fixture after the theme's mode preferences.
  await page.evaluate(()=>{options.modes=['sing'];options.difficulty='hard';renderOptions()});
  await page.reload({waitUntil:'load'});await setup(page);await openMode(page);
  assert.equal(await page.locator('[data-song-language="en"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-song-language="ru"]').getAttribute('aria-pressed'),'false');
  await sources(page,['ru','en']);await closeModeCenter(page);await setupPlayers(page);
  await page.evaluate(()=>{options.dice=false;Math.random=()=>0});await startFromSetup(page);await page.locator('[data-action="roll"]').click();
  assert.equal(language(await selected(page)),'ru');
  await page.evaluate(()=>{game.phase='judge';judge(false);Math.random=()=>.999999;roll()});assert.equal(language(await selected(page)),'en');
  await provisionProfiles(page);
  await page.locator('#exit-game').click();await setup(page);await openMode(page);await sources(page,['en']);
  const active=await page.evaluate(()=>JSON.stringify(game));
  await sources(page,['ru']);assert.equal(await page.evaluate(()=>JSON.stringify(game)),active,'Menu changed active party');
  await sources(page,['en']);await closeModeCenter(page);await setupPlayers(page);
  await page.evaluate(()=>options.dice=false);await startFromSetup(page);await page.locator('[data-action="roll"]').click();
  assert.equal(language(await selected(page)),'en');
  await page.evaluate(()=>{game.dice=true;options.dice=true;persist()});
  const snapshot=await page.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY)}));
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.raw);
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  assert.deepEqual(errors,[]);console.log('TASK012 C mode settings UI PASS',device.name,'stable copy/reward, sources ru/en/both, guarded Easy, offline Continue');
 }finally{await context.close()}
}
async function upgrade(browser,url){
 const {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'../..'),baseline='4001c01aecb6e088da19c94a0197768552736e81';
 const git=args=>execFileSync('git',args,{cwd:root,timeout:30000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
 try{git(['cat-file','-e',baseline+'^{commit}'])}catch{git(['fetch','--depth=1','origin',baseline])}
 const files=historicalRuntimeFiles(git,baseline,['sw.js','index.html','style.css','app.js','session-restoration.js','setup-view.js','setup-controls.js','menu-navigation.js','match-views.js','timer-view.js','round-presentation.js','round-selection.js','content-packs.js','round-views.js','modifiers-v2.js']);
 const current=new Map(files.map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
 const previous=new Map(files.map(name=>[name,git(['show',baseline+':party-game/'+name])]));
 const cache=source=>source.toString().match(/const CACHE='([^']+)'/)[1],oldCache=cache(previous.get('sw.js')),newCache=cache(current.get('sw.js'));
 const write=sources=>{for(const [name,source]of sources)fs.writeFileSync(path.join(root,'party-game',name),source)};
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  write(previous);for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  assert.equal(await page.evaluate(key=>caches.has(key),oldCache),true);
  await page.evaluate(()=>{soundOn=false;Object.assign(options,{modes:['sing'],difficulty:'hard',dice:false,complications:false});newGame();roll();game.dice=true;options.dice=true;persist()});
  await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  const snapshot=await page.evaluate(()=>({game:JSON.stringify(game),memory:JSON.stringify(taskMemory),options:JSON.stringify(options),raw:localStorage.getItem(STORAGE_KEY)}));
  write(current);
  await page.evaluate(async()=>{
   const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   await navigator.serviceWorker.register('./sw.js?qa-mode-settings-upgrade',{scope:'./',updateViaCache:'none'});
   if(!navigator.serviceWorker.controller?.scriptURL.includes('qa-mode-settings-upgrade'))await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('Mode settings worker update timed out')),15000))]);
  });
  await page.waitForFunction(async({oldCache,newCache})=>await caches.has(newCache)&&!await caches.has(oldCache),{oldCache,newCache});
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);assert.equal(await page.evaluate(()=>JSON.stringify(taskMemory)),snapshot.memory);
  assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.raw);
  assert.deepEqual(await page.evaluate(()=>options),{...JSON.parse(snapshot.options),modeSettings:{sing:{songLanguages:['ru']}}});
  await provisionProfiles(page);
  await page.locator('#exit-game').click();await setup(page);await openMode(page);await sources(page,['en']);
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);
  await closeModeCenter(page);await setupPlayers(page);await setupBack(page,'setup-back');await setupBack(page,'game-type-back');
  await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  assert.deepEqual(errors,[]);console.log('TASK012 C offline worker update PASS',oldCache,'→',newCache,'v69 ru snapshot/RAW preserved; future en preference survives offline reload independently');
 }finally{write(current);await context.close()}
}
module.exports=async(browser,url)=>{for(const device of devices)await ui(browser,url,device);await upgrade(browser,url)};
