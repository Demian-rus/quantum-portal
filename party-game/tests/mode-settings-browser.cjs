'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ledger=require('../content/editorial/music-theme-review.json');
const language=id=>ledger.find(row=>row.id===id)?.language;
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},
 {name:'desktop',width:1280,height:800},{name:'landscape',width:640,height:360}];
async function setup(page){await page.locator('#new-game-menu').click();await page.locator('#standard-game').click()}
async function openMode(page,id='sing'){
 if(!await page.locator('#scene-advanced').isVisible())await page.locator('#go-advanced').click();
 if(!await page.locator('#mode-toggles').isVisible())await page.locator('#mode-settings summary').click();
 await page.locator('[data-mode-settings="'+id+'"]').click();
}
async function sources(page,languages){
 for(const value of languages){const button=page.locator('[data-song-language="'+value+'"]');if(await button.getAttribute('aria-pressed')!=='true')await button.click()}
 for(const value of ['ru','en'].filter(value=>!languages.includes(value))){const button=page.locator('[data-song-language="'+value+'"]');if(await button.getAttribute('aria-pressed')==='true')await button.click()}
}
async function selected(page){return page.evaluate(()=>getPackCardPool(game.contentPack,'songs',game.current.difficulty).find(row=>row.text===game.current.word).id)}
async function ui(browser,url,device){
 const context=await browser.newContext({viewport:{width:device.width,height:device.height},hasTouch:device.width<500});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(url,{waitUntil:'load'});await setup(page);
  await page.evaluate(()=>{soundOn=false;Object.assign(options,{modes:['sing'],difficulty:'hard',dice:false,complications:false,riskRounds:false});renderOptions()});
  await page.locator('#go-advanced').click();await page.locator('#mode-settings summary').click();
  await page.locator('#mode-toggles img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  const rects=()=>page.locator('#mode-toggles').evaluate(grid=>[...grid.querySelectorAll('.mode-choice')].map(tile=>{
   const rect=selector=>{const r=tile.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
   return {name:rect('strong'),reward:rect('b'),gear:rect('button'),icon:rect('button svg'),tile:rect('label')};
  }));
  const visible=await rects();
  await page.locator('.mode-gear').evaluateAll(buttons=>buttons.forEach(button=>button.hidden=true));
  const hidden=await rects();
  await page.locator('.mode-gear').evaluateAll(buttons=>buttons.forEach(button=>button.hidden=false));
  assert.equal(visible.length,8);
  for(let index=0;index<8;index++){
   const row=visible[index];assert.deepEqual(row.name,hidden[index].name);assert.deepEqual(row.reward,hidden[index].reward);
   assert.ok(row.gear.w>=36&&row.gear.h>=36,'Gear touch target');
   assert.ok(row.gear.x>=row.tile.x&&row.gear.x+row.gear.w<=row.tile.x+row.tile.w+1);
   for(const text of [row.name,row.reward])assert.ok(row.icon.x+row.icon.w<=text.x||row.icon.x>=text.x+text.w||row.icon.y+row.icon.h<=text.y||row.icon.y>=text.y+text.h,'Gear icon overlaps text: '+JSON.stringify(row));
  }
  if(device.name==='phone'||device.name==='narrow')await page.screenshot({path:'artifacts/quip-mobile-layout/task012c-'+device.name+'-gears.png'});
  const modes=await page.evaluate(()=>JSON.stringify(options.modes));
  for(const id of ['talk','mime','draw','yesno','secret','blitz','approx']){
   await openMode(page,id);assert.equal(await page.locator('#mode-options-placeholder').isVisible(),true);
   assert.equal(await page.locator('#mode-song-sources').isVisible(),false);
   await page.locator('#close-mode-options').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(options.modes)),modes,'Gear toggled a mode');
  }
  const gear=page.locator('[data-mode-settings="sing"]');
  if(device.width<500)await gear.tap();else await gear.click();
  assert.equal(await page.locator('[data-song-language="ru"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-song-language="en"]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-song-language="ru"]').click();assert.match(await page.locator('#mode-source-status').textContent(),/хотя бы один/);
  await page.locator('[data-song-language="en"]').click();
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['ru','en']);
  if(device.name==='phone'||device.name==='narrow')await page.screenshot({path:'artifacts/quip-mobile-layout/task012c-'+device.name+'-sources.png'});
  await page.locator('#close-mode-options').press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'mode-options-done');
  await page.locator('#mode-options-done').press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'close-mode-options');
  await page.locator('#close-mode-options').press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.modeSettings),'sing');
  await openMode(page);await page.evaluate(()=>history.back());await page.waitForFunction(()=>document.getElementById('mode-options-backdrop').hidden);
  assert.equal(await page.locator('#scene-advanced').isVisible(),true,'Back left advanced settings instead of closing the panel');
  await openMode(page);await page.mouse.click(2,2);assert.equal(await page.locator('#mode-options-backdrop').isVisible(),false);
  await openMode(page);await sources(page,['en']);await page.locator('[data-song-language="en"]').click();
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  await page.locator('#mode-options-done').click();await page.locator('#advanced-done').click();
  await page.locator('.choices[data-setting="difficulty"] [data-value="easy"]').click();
  assert.equal(await page.locator('#start-game').isDisabled(),true);assert.match(await page.locator('#setup-mode-notice').textContent(),/источники или сложность/);
  await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').click();assert.equal(await page.locator('#start-game').isEnabled(),true);
  await page.reload({waitUntil:'load'});await setup(page);await openMode(page);
  assert.equal(await page.locator('[data-song-language="en"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-song-language="ru"]').getAttribute('aria-pressed'),'false');
  await sources(page,['ru','en']);await page.locator('#mode-options-done').click();await page.locator('#advanced-done').click();
  await page.evaluate(()=>{options.dice=false;Math.random=()=>0});await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();
  assert.equal(language(await selected(page)),'ru');
  await page.evaluate(()=>{game.phase='judge';judge(false);Math.random=()=>.999999;roll()});assert.equal(language(await selected(page)),'en');
  await page.locator('#exit-game').click();await setup(page);await openMode(page);await sources(page,['en']);
  const active=await page.evaluate(()=>JSON.stringify(game));
  await sources(page,['ru']);assert.equal(await page.evaluate(()=>JSON.stringify(game)),active,'Menu changed active party');
  await sources(page,['en']);await page.locator('#mode-options-done').click();await page.locator('#advanced-done').click();
  await page.evaluate(()=>options.dice=false);await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();
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
 const files=['sw.js','index.html','style.css','app.js','session-restoration.js','setup-view.js','setup-controls.js','menu-navigation.js'];
 const current=new Map(files.map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
 const previous=new Map(files.map(name=>[name,git(['show',baseline+':party-game/'+name])]));
 const cache=source=>source.toString().match(/const CACHE='([^']+)'/)[1],oldCache=cache(previous.get('sw.js')),newCache=cache(current.get('sw.js'));
 const write=sources=>{for(const [name,source]of sources)fs.writeFileSync(path.join(root,'party-game',name),source)};
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  write(previous);for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
  await page.goto(url,{waitUntil:'load'});await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
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
  await page.locator('#exit-game').click();await setup(page);await openMode(page);await sources(page,['en']);
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);
  await page.locator('#mode-options-done').click();await page.locator('#advanced-done').click();await page.locator('#setup-back').click();await page.locator('#game-type-back').click();
  await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);
  assert.deepEqual(await page.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
  assert.deepEqual(errors,[]);console.log('TASK012 C offline worker update PASS',oldCache,'→',newCache,'v69 ru snapshot/RAW preserved; future en preference survives offline reload independently');
 }finally{write(current);await context.close()}
}
module.exports=async(browser,url)=>{for(const device of devices)await ui(browser,url,device);await upgrade(browser,url)};
