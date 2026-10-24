'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASELINE='007abb864aa727fcdf4249662af732df819bf73b';
const ART='artifacts/quip-mobile-layout/task013b-';
const LONG='Не рисуй горизонтальные и вертикальные линии. Рисуй только изогнутые линии, сохраняя понятность рисунка. '.repeat(4)+'Конец условия.';
const ledger=new Map(require('../content/editorial/music-theme-review.json').map(row=>[row.id,row.language]));
async function settle(page){await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));await page.evaluate(()=>document.fonts.ready)}
async function setup(page){await page.locator('#new-game-menu').click();await page.locator('#standard-game').click()}
const cardBox=page=>page.locator('.round-fixed-card').boundingBox();
function sameBox(a,b,label){for(const k of ['x','y','width','height'])assert.ok(Math.abs(a[k]-b[k])<=2,label+': '+JSON.stringify({a,b}))}
async function fullCondition(page,expected){
 const area=page.locator('.round-condition');
 assert.equal(await page.locator('.round-condition').textContent(),'УСЛОЖНЕНИЕ: '+expected);
 await area.focus();await area.press('End');
 await page.waitForFunction(()=>{const e=document.querySelector('.round-condition');return e.scrollTop+e.clientHeight>=e.scrollHeight-2});
 await area.scrollIntoViewIfNeeded();
 const g=await page.evaluate(()=>{
  const parent=document.querySelector('.round-condition'),condition=parent.querySelector('strong'),node=condition.firstChild;
  const range=document.createRange();range.setStart(node,node.length-1);range.setEnd(node,node.length);
  const tail=range.getBoundingClientRect(),p=parent.getBoundingClientRect();
  return {overflow:getComputedStyle(parent).overflowY,bar:getComputedStyle(parent).scrollbarWidth,webkit:getComputedStyle(parent,'::-webkit-scrollbar').display,
   tail:{top:tail.top,bottom:tail.bottom},parent:{top:p.top,bottom:p.bottom},scroll:parent.scrollTop,total:parent.scrollHeight,client:parent.clientHeight,
   document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},w:innerWidth,h:innerHeight};
 });
 assert.equal(g.overflow,'auto');assert.equal(g.bar,'none');assert.equal(g.webkit,'none');
 assert.ok(g.tail.top>=g.parent.top-1&&g.tail.bottom<=g.parent.bottom+1,'Condition ending is inaccessible: '+JSON.stringify(g));
 assert.ok(g.document.w<=g.w+1&&g.document.h<=g.h+1,'Page scroll instead of local region');
 return g;
}
async function upgrade(browser,url){
 const {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'../..');
 const git=args=>execFileSync('git',args,{cwd:root,timeout:30000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
 try{git(['cat-file','-e',BASELINE+'^{commit}'])}catch{git(['fetch','--depth=1','origin',BASELINE])}
 const files=['sw.js','index.html','style.css','app.js','setup-controls.js','setup-view.js','session-restoration.js','content-packs.js','modifiers-v2.js','round-selection.js','round-views.js','round-presentation.js','timer-view.js'];
 const current=new Map(files.map(name=>[name,fs.readFileSync(path.join(root,'party-game',name))]));
 const previous=new Map(files.map(name=>[name,git(['show',BASELINE+':party-game/'+name])]));
 const cache=s=>s.toString().match(/const CACHE='([^']+)'/)[1],oldCache=cache(previous.get('sw.js')),newCache=cache(current.get('sw.js'));
 const write=sources=>{for(const [name,source]of sources)fs.writeFileSync(path.join(root,'party-game',name),source)};
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  write(previous);for(const name of files)fs.utimesSync(path.join(root,'party-game',name),new Date('2026-01-01'),new Date('2026-01-01'));
  await page.goto(url,{waitUntil:'load'});await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.evaluate(()=>{
   soundOn=false;chooseStartingTeam=()=>0;Object.assign(options,{modes:['draw','sing','secret'],difficulty:'mixed',dice:false,complications:true,riskRounds:false});
   newGame();pickMode=()=>getMode('secret');let values=[.999999,.999999,0];Math.random=()=>values.length?values.shift():.999999;
   roll();toggleWord();startTimer();pauseTimer();game.dice=true;options.dice=true;persist();
  });
  assert.equal(await page.evaluate(()=>game.current.difficulty),'easy');assert.equal(await page.evaluate(()=>game.current.methodId),'draw');assert.equal(await page.evaluate(()=>game.current.paused),true);
  await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  const snapshot=await page.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),game:JSON.stringify(game),memory:JSON.stringify(taskMemory),options:JSON.stringify(options)}));
  await page.evaluate(condition=>{game.phase='task';game.current.visible=false;game.current.complication=condition;render()},LONG);await settle(page);
  const before=await page.locator('.mode-rule').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,bar:getComputedStyle(el).scrollbarWidth,overflow:getComputedStyle(el).overflowY}));
  assert.equal(before.overflow,'auto');assert.ok(before.scroll>before.client,'The baseline must reproduce nested overflow');
  await page.screenshot({path:ART+'condition-before.png'});
  await page.evaluate(saved=>{game=JSON.parse(saved);render()},snapshot.game);
  assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.raw);
  write(current);
  await page.evaluate(async()=>{
   const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   await navigator.serviceWorker.register('./sw.js?qa-task013b-upgrade',{scope:'./',updateViaCache:'none'});
   if(!navigator.serviceWorker.controller?.scriptURL.includes('qa-task013b-upgrade'))await Promise.race([changed,new Promise((_,reject)=>setTimeout(()=>reject(Error('v72 update timed out')),15000))]);
  });
  await page.waitForFunction(async({oldCache,newCache})=>await caches.has(newCache)&&!await caches.has(oldCache),{oldCache,newCache});
  await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot.game);assert.equal(await page.evaluate(()=>JSON.stringify(taskMemory)),snapshot.memory);
  assert.deepEqual(await page.evaluate(()=>options),JSON.parse(snapshot.options));assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.raw);
  assert.equal(await page.evaluate(()=>game.timerPolicyVersion),undefined);assert.equal(await page.evaluate(()=>game.songLanguagePolicyVersion),1);
  assert.equal(await page.evaluate(()=>getPromptPool('songs','hard','secret').length),await page.evaluate(()=>getPackCardPool(game.contentPack,'songs','hard').length));
  assert.equal(await page.locator('[data-action="resume"]').count(),1);
  const remaining=await page.evaluate(()=>game.current.remainingMs);await page.locator('[data-action="resume"]').click();
  assert.equal(await page.evaluate(()=>game.current.paused),false);assert.ok(Math.abs(await page.evaluate(()=>game.current.deadline-Date.now())-remaining)<1500);
  await page.evaluate(condition=>{game.phase='task';game.current.visible=false;game.current.complication=condition;render()},LONG);await settle(page);
  const after=await fullCondition(page,LONG);await page.locator('.round-top,.round-condition').evaluateAll(elements=>elements.forEach(el=>el.scrollTop=0));
  await page.screenshot({path:ART+'condition-after.png'});
  assert.deepEqual(errors,[]);console.log('TASK013 B v71 → v72 offline update PASS: paused Mixed / song V1 / exact RAW game options history / usable resume',JSON.stringify({before,after}));
 }finally{write(current);await context.close()}
}
async function settingsOrder(page){
 const g=await page.evaluate(()=>{
  const el=selector=>document.querySelector(selector),before=(a,b)=>Boolean(el(a).compareDocumentPosition(el(b))&Node.DOCUMENT_POSITION_FOLLOWING);
  return {order:[before('#finish-score-settings','#base-duration'),before('#base-duration','#mode-settings'),before('#mode-settings','#content-settings'),before('#content-settings','.extra-rules'),before('.extra-rules','#advanced-done')],
   ids:['toggle-risk','toggle-complications','modifier-chance'].map(id=>document.querySelectorAll('#'+id).length),
   grouped:['toggle-risk','toggle-complications','modifier-chance'].every(id=>el('.extra-rules').contains(document.getElementById(id))),
   page:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},w:innerWidth,h:innerHeight};
 });
 assert.deepEqual(g.order,[true,true,true,true,true]);assert.deepEqual(g.ids,[1,1,1]);assert.equal(g.grouped,true);assert.ok(g.page.w<=g.w+1&&g.page.h<=g.h+1);
}
async function languageSources(page,languages){
 await page.locator('[data-mode-settings="sing"]').click();
 for(const lang of languages){const b=page.locator('[data-song-language="'+lang+'"]');if(await b.getAttribute('aria-pressed')!=='true')await b.click()}
 for(const lang of ['ru','en'].filter(v=>!languages.includes(v))){const b=page.locator('[data-song-language="'+lang+'"]');if(await b.getAttribute('aria-pressed')==='true')await b.click()}
 await page.locator('#mode-options-done').click();
}
async function ui(browser,url,width,height){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'load'});await setup(page);await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').click();await page.locator('#go-advanced').click();
  await settingsOrder(page);
  await page.locator('#mode-settings summary').click();await page.locator('#content-settings summary').click();await settingsOrder(page);
  await page.locator('#toggle-risk').uncheck();assert.equal(await page.evaluate(()=>options.riskRounds),false);
  await page.locator('#toggle-complications').uncheck();assert.equal(await page.locator('#modifier-chance-settings').isVisible(),false);
  await page.locator('#toggle-complications').check();await page.locator('#modifier-chance').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.evaluate(()=>options.modifierChance),35);
  if(width===390){await page.locator('.extra-rules').scrollIntoViewIfNeeded();await page.screenshot({path:ART+'settings-after.png'})}
  const inputs=page.locator('#mode-toggles input');
  if(!await page.locator('#mode-toggles input[value="secret"]').isChecked())await page.locator('#mode-toggles label:has(input[value="secret"])').click();
  for(let i=0;i<await inputs.count();i++){const input=inputs.nth(i),value=await input.getAttribute('value');if(value!=='secret'&&await input.isChecked())await page.locator('#mode-toggles label:has(input[value="'+value+'"])').click()}
  assert.deepEqual(await page.evaluate(()=>options.modes),['secret']);
  for(const languages of [['ru'],['en'],['ru','en']]){
   if(!await page.locator('#scene-advanced').isVisible()){await setup(page);await page.locator('#go-advanced').click()}
   if(!await page.locator('#mode-toggles').isVisible())await page.locator('#mode-settings summary').click();
   await languageSources(page,languages);await page.locator('#advanced-done').click();
   await page.evaluate(()=>{soundOn=false;Math.random=()=>.999999});await page.locator('#start-game').click();
   assert.equal(await page.locator('.ready-content .game-eyebrow').count(),0);assert.equal(await page.locator('#round-now').textContent(),'1');assert.match(await page.locator('#match-center-label').textContent(),/ЦЕЛЬ/);
   await page.locator('[data-action="roll"]').click();await page.locator('.is-task').waitFor();
   const selected=await page.evaluate(()=>({mode:game.current.modeId,method:game.current.methodId,policy:game.songLanguagePolicyVersion,languages:game.songLanguages,card:getPackCardPool(game.contentPack,'songs',game.current.difficulty).find(row=>row.text===game.current.word).id}));
   assert.equal(selected.mode,'secret');assert.equal(selected.method,'sing');assert.equal(selected.policy,2);assert.deepEqual(selected.languages,languages);assert.ok(languages.includes(ledger.get(selected.card)));
   await page.locator('.task-open [data-action="toggle-word"]').click();assert.equal(await page.locator('[data-action="start-timer"]').count(),0);
   await page.locator('#active-timer').waitFor();assert.equal(await page.locator('[data-action="pause"]').count(),0);
   const snapshot=await page.evaluate(()=>({current:JSON.stringify(game.current),raw:localStorage.getItem(STORAGE_KEY)}));
   await page.evaluate(()=>pauseTimer());assert.equal(await page.evaluate(()=>game.current.paused),false);
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(game.current)),snapshot.current);assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),snapshot.raw);
   await context.setOffline(false);await page.locator('#exit-game').click();
  }
  // The current condition remains available through reveal and timer start, without moving the word card.
  await setup(page);await page.evaluate(condition=>{
   Object.assign(options,{modes:['draw','secret'],difficulty:'easy',dice:false,complications:true});newGame();const originalPick=pickMode;pickMode=()=>getMode('secret');try{roll()}finally{pickMode=originalPick}
   game.current.complication=condition;game.current.risk=true;render();
  },LONG);await settle(page);
  const fixed=await cardBox(page);const conditionGeometry=await fullCondition(page,LONG);sameBox(await cardBox(page),fixed,'Scrolling moved card');
  if(width===320){await page.locator('.round-top,.round-condition').evaluateAll(elements=>elements.forEach(el=>el.scrollTop=0));await page.screenshot({path:ART+'narrow-condition-after.png'})}
  await page.locator('.task-open [data-action="toggle-word"]').click();await fullCondition(page,LONG);sameBox(await cardBox(page),fixed,'Reveal moved card');
  await page.locator('[data-action="start-timer"]').click();await fullCondition(page,LONG);sameBox(await cardBox(page),fixed,'Timer moved card');
  await page.locator('#exit-game').click();await setup(page);
  await page.locator('.choices[data-setting="difficulty"] [data-value="mixed"]').click();
  await page.evaluate(()=>{
   Object.assign(options,{modes:['mime'],dice:false,complications:false});Math.random=()=>.999999;
   window.__clock=Date.now();Date.now=()=>window.__clock;
   const nativeInterval=window.setInterval;window.setInterval=(fn,...args)=>nativeInterval(()=>{if(!document.hidden)fn()},...args);
  });
  await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();
  assert.equal(await page.evaluate(()=>game.current.difficulty),'easy');assert.equal(await page.evaluate(()=>game.current.points),1);
  await settle(page);const mixedBox=await cardBox(page);await page.locator('.task-open [data-action="toggle-word"]').click();assert.equal(await page.evaluate(()=>game.phase),'countdown');
  assert.equal(await page.locator('[data-action="start-timer"]').count(),0);sameBox(await cardBox(page),mixedBox,'Countdown moved card');
  const auto=await page.evaluate(()=>game.current.autoStartAt);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.evaluate(start=>window.__clock=start+3500,auto);
  assert.equal(await page.evaluate(()=>game.phase),'countdown');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});
  await page.locator('#active-timer').waitFor();const deadline=await page.evaluate(()=>game.current.deadline);
  assert.equal(deadline,auto+await page.evaluate(()=>game.current.seconds*1000));sameBox(await cardBox(page),mixedBox,'Automatic start moved card');
  assert.equal(await page.locator('[data-action="pause"]').count(),0);
  await page.evaluate(()=>{handleAction('pause');handleAction('start-timer');beginAutomaticRound();document.dispatchEvent(new Event('visibilitychange'))});
  assert.equal(await page.evaluate(()=>game.current.deadline),deadline);assert.equal(await page.evaluate(()=>game.current.paused),false);
  const raw=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>game.current.deadline),deadline);assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),raw);
  assert.deepEqual(errors,[]);console.log('TASK013 B UI PASS',width+'x'+height,'settings order / solo Secret ru en both + offline / full condition / Mixed Easy background + offline',JSON.stringify(conditionGeometry));
 }catch(error){await page.screenshot({path:ART+width+'-failure.png'});throw error}finally{await context.close()}
}
module.exports=async(browser,url)=>{fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});await upgrade(browser,url);for(const [w,h]of [[320,568],[390,844]])await ui(browser,url,w,h)};
