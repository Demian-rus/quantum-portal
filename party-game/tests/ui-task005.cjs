'use strict';
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},
 {name:'desktop',width:1440,height:900},{name:'landscape',width:844,height:390},{name:'low-landscape',width:640,height:360}];
const modeIds=['talk','mime','draw','sing','yesno','secret','blitz','approx'];
const settle=(page,id)=>page.locator('#'+id).evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
async function openSetup(page){
 await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();
}
async function fitPage(page){
 const g=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
 assert.ok(g.sw<=g.w+2&&g.sh<=g.h+2,'Page overflow: '+JSON.stringify(g));
}
async function scrollFold(page,id){
 await page.evaluate(id=>{const p=document.getElementById('advanced-scroll'),el=document.getElementById(id);
  p.scrollTop+=el.getBoundingClientRect().top-p.getBoundingClientRect().top-8;},id);
}
async function checkGrid(page){
 await page.locator('#mode-toggles img').evaluateAll(async images=>{
  await Promise.all(images.map(image=>image.decode()));
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
 });
 const grid=await page.locator('#mode-toggles').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,
  tiles:[...el.querySelectorAll('label')].map(label=>{const r=label.getBoundingClientRect(),tile=label.querySelector('.mode-tile');
   return {x:r.x,y:r.y,w:r.width,h:r.height,sw:tile.scrollWidth,cw:tile.clientWidth,
    copy:label.querySelector('.mode-tile-copy').scrollWidth,copyWidth:label.querySelector('.mode-tile-copy').clientWidth};})}));
 assert.equal(grid.columns.split(' ').length,2,'Expected exactly two columns');
 assert.equal(grid.tiles.length,8);
 for(let row=0;row<4;row++){
  const a=grid.tiles[row*2],b=grid.tiles[row*2+1];
  assert.ok(Math.abs(a.y-b.y)<=1&&a.x<b.x,'Incorrect row '+row);
  assert.ok(Math.abs(a.x-grid.tiles[0].x)<=1&&Math.abs(b.x-grid.tiles[1].x)<=1,'Column drift');
  if(row)assert.ok(a.y>=grid.tiles[(row-1)*2].y+grid.tiles[(row-1)*2].h+5,'Rows overlap');
 }
 assert.ok(grid.tiles.every(t=>t.sw<=t.cw+1&&t.copy<=t.copyWidth+1),'Tile text overflows: '+JSON.stringify(grid));
 const icons=await page.locator('#mode-toggles img').evaluateAll(els=>els.map(el=>({src:el.src,ok:el.complete,w:el.naturalWidth,h:el.naturalHeight})));
 assert.equal(new Set(icons.map(i=>i.src)).size,8);
 icons.forEach((icon,index)=>assert.ok(icon.ok&&icon.w===512&&icon.h===512&&new URL(icon.src).pathname.endsWith('/'+modeIds[index]+'.webp'),JSON.stringify(icon)));
 const actual=await page.locator('#mode-toggles b').allTextContents();
 const expected=await page.evaluate(()=>DEFAULT_MODES.map(id=>{const c=getModeConfig(id);return '+'+(c.basePoints+(id==='secret'?c.modifierBonus:0))+(c.blitzWordsCount?' · '+c.blitzWordsCount+'/'+c.blitzWordsCount:'')}));
 assert.deepEqual(actual,expected);
}
const tile=(page,id)=>page.locator('#mode-toggles label:has(input[value="'+id+'"])');
const modeInput=(page,id)=>page.locator('#mode-toggles input[value="'+id+'"]');
const typeTile=(page,id)=>page.locator('#content-toggles label:has(input[value="'+id+'"])');
async function settingsUI(browser,url,device){
 const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.name==='phone'?2:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);await page.evaluate(()=>{options.awardTo='guesser';options.modes=DEFAULT_MODES.slice()});await openSetup(page);
  assert.equal(await page.locator('#scene-setup input[type="range"]').count(),0,'Basic setup must use buttons');
  for(const [field,values] of [['targetScore',[15,30,60,100]],['duration',[30,45,60]]]){
   const group=page.locator('.quick-choices[data-setting="'+field+'"]');
   assert.deepEqual(await group.locator('button').evaluateAll(els=>els.map(el=>Number(el.dataset.value))),values);
   for(const value of values){
    const button=group.locator('[data-value="'+value+'"]');await button.click();
    assert.equal(await page.evaluate(field=>options[field],field),value);
    assert.equal(await button.getAttribute('aria-pressed'),'true');
   }
   const sizes=await group.locator('button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height}}));
   assert.ok(sizes.every(s=>s.h>=44&&s.w>=40),JSON.stringify(sizes));
  }
  await page.locator('#go-advanced').click();
  assert.equal(await page.locator('#target-score').inputValue(),'100');assert.equal(await page.locator('#base-duration').inputValue(),'60');
  await page.locator('#finish-rounds').check();await page.locator('#advanced-done').click();
  assert.equal(await page.locator('#quick-score-choices').isVisible(),false);
  await page.locator('#go-advanced').click();await page.locator('#finish-score').check();
  for(const [id,value] of [['target-score','35'],['base-duration','75']])await page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},value);
  await page.locator('#advanced-done').click();
  assert.equal(await page.locator('#score-goal-preview').textContent(),'35 очков');assert.equal(await page.locator('#base-duration-value').textContent(),'75 с');
  assert.equal(await page.locator('.quick-choices .is-chosen').count(),0,'Custom slider values must not be rounded to quick options');
  await page.locator('#go-advanced').click();await settle(page,'scene-advanced');
  for(const id of ['mode-settings','content-settings'])assert.equal(await page.locator('#'+id).evaluate(el=>el.open),false);
  assert.equal(await page.locator('#mode-selection-count').textContent(),'8 ИЗ 8');assert.equal(await page.locator('#content-selection-count').textContent(),'3 ИЗ 3');
  const saved=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  await page.locator('#mode-settings > summary').click();await page.locator('#mode-settings > summary').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),saved,'Folding must not alter stored settings');
  await page.locator('#mode-settings > summary').click();await scrollFold(page,'mode-settings');await checkGrid(page);await fitPage(page);
  if(device.name==='phone')await capture(page,{path:'artifacts/quip-mobile-layout/task005-phone-modes-all.png'});
  const visuals=()=>tile(page,'talk').evaluate(el=>{const s=getComputedStyle(el.querySelector('.mode-tile')),i=getComputedStyle(el.querySelector('img'));
   return {border:s.borderColor,shadow:s.boxShadow,opacity:i.opacity,filter:i.filter};});
  const selected=await visuals();
  for(const id of modeIds){
   await tile(page,id).click();assert.equal(await modeInput(page,id).isChecked(),false);
   assert.equal(await page.locator('#mode-selection-count').textContent(),'7 ИЗ 8');
   if(id==='talk'){
    const off=await visuals();assert.notEqual(off.border,selected.border);assert.equal(off.shadow,'none');
    assert.ok(Number(off.opacity)<Number(selected.opacity));assert.match(off.filter,/grayscale/);
   }
   await tile(page,id).click();assert.equal(await modeInput(page,id).isChecked(),true);
   assert.equal(await page.locator('#mode-selection-count').textContent(),'8 ИЗ 8');
  }
  for(const id of modeIds.slice(0,-1))await tile(page,id).click();
  await tile(page,'approx').click();assert.equal(await modeInput(page,'approx').isChecked(),true);
  assert.equal(await page.locator('#mode-selection-count').textContent(),'1 ИЗ 8');
  for(const id of ['talk','mime','secret'])await tile(page,id).click();
  await page.locator('#mode-settings > summary').click();await page.locator('#content-settings > summary').click();
  for(const id of ['word','phrase','idiom']){
   await typeTile(page,id).click();assert.equal(await page.locator('#content-selection-count').textContent(),'2 ИЗ 3');
   await typeTile(page,id).click();assert.equal(await page.locator('#content-selection-count').textContent(),'3 ИЗ 3');
  }
  await typeTile(page,'word').click();await typeTile(page,'phrase').click();await typeTile(page,'idiom').click();
  assert.equal(await page.locator('#content-toggles input[value="idiom"]').isChecked(),true);
  assert.equal(await page.locator('#content-selection-count').textContent(),'1 ИЗ 3');
  await typeTile(page,'word').click();await page.locator('#content-settings > summary').click();
  const expected=await page.evaluate(()=>({modes:options.modes,types:options.promptTypes,duration:options.duration,target:options.targetScore}));
  await page.locator('#advanced-done').click();await page.locator('#go-advanced').click();
  for(const id of ['mode-settings','content-settings'])assert.equal(await page.locator('#'+id).evaluate(el=>el.open),false);
  await page.reload({waitUntil:'load'});await openSetup(page);await page.locator('#go-advanced').click();
  assert.deepEqual(await page.evaluate(()=>({modes:options.modes,types:options.promptTypes,duration:options.duration,target:options.targetScore})),expected);
  assert.equal(await page.locator('#mode-selection-count').textContent(),'4 ИЗ 8');assert.equal(await page.locator('#content-selection-count').textContent(),'2 ИЗ 3');
  for(const id of ['mode-settings','content-settings'])assert.equal(await page.locator('#'+id).evaluate(el=>el.open),false);
  await page.locator('#mode-settings > summary').click();await scrollFold(page,'mode-settings');await checkGrid(page);
  if(device.name==='phone'){await settle(page,'scene-advanced');await capture(page,{path:'artifacts/quip-mobile-layout/task005-phone-modes-mixed.png'});}
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload({waitUntil:'load'});await openSetup(page);await page.locator('#go-advanced').click();
  assert.deepEqual(await page.evaluate(()=>({modes:options.modes,types:options.promptTypes,duration:options.duration,target:options.targetScore})),expected);
  await page.locator('#mode-settings > summary').click();await checkGrid(page);await fitPage(page);
  assert.deepEqual(errors,[]);console.log('task005 settings PASS',device.name);
 }finally{await context.close();}
}
async function approxGeometry(page,device,revealed){
 const g=await page.evaluate(()=>{
  const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
  const copy=document.querySelector('.approx-copy'),card=document.querySelector('.approx-card');
  return {card:rect('.approx-card'),copy:rect('.approx-copy'),copySW:copy.scrollWidth,copyCW:copy.clientWidth,
   copySH:copy.scrollHeight,copyCH:copy.clientHeight,padding:parseFloat(getComputedStyle(card).paddingTop)+parseFloat(getComputedStyle(card).paddingBottom)+2,
   answer:document.querySelector('.approx-answer strong')?rect('.approx-answer strong'):null,
   actions:[...document.querySelectorAll('.approx-actions button')].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}})};
 });
 assert.ok(g.card.top>=0&&g.card.bottom<=device.height+1&&g.card.left>=0&&g.card.right<=device.width+1,JSON.stringify(g));
 assert.ok(g.copyCH>=18,'Question scroll area lost: '+JSON.stringify(g));
 assert.ok(g.copySW<=g.copyCW+1,'Horizontal question overflow');
 assert.ok(g.actions.every(r=>r.top>=g.card.bottom+3&&r.bottom<=device.height+1&&r.height>=44&&r.left>=0&&r.right<=device.width+1),JSON.stringify(g));
 if(revealed){assert.equal(g.actions.length,4);assert.ok(g.answer.top>=g.card.top&&g.answer.bottom<=g.card.bottom&&g.answer.bottom<=g.copy.top,JSON.stringify(g));}
 else assert.equal(g.actions.length,1);
 await page.locator('.approx-copy').evaluate(el=>{el.scrollTop=el.scrollHeight});
 const scroll=await page.locator('.approx-copy').evaluate(el=>({top:el.scrollTop,ch:el.clientHeight,sh:el.scrollHeight}));
 assert.ok(scroll.top+scroll.ch>=scroll.sh-2,'Long question cannot be read to the end');
 await page.locator('.approx-copy').evaluate(el=>{el.scrollTop=0});await fitPage(page);return g;
}
async function approxUI(browser,url,device){
 const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.name==='phone'?2:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);
  await page.evaluate(()=>{soundOn=false;options.modes=['approx'];options.dice=false;newGame()});
  const fixtures=await page.evaluate(()=>{
   const byLength=[...QUIP_APPROX_QUESTIONS].sort((a,b)=>a.question.length-b.question.length);
   const answer=[...QUIP_APPROX_QUESTIONS].sort((a,b)=>(b.answer+b.unit).length-(a.answer+a.unit).length)[0];
   return [byLength[0].id,byLength.at(-1).id,answer.id];
  });
  let shortHeight;
  for(let index=0;index<fixtures.length;index++){
   // Existing catalog records are injected as UI fixtures; the catalog and engine stay untouched.
   await page.evaluate(id=>{game.dice=false;roll();const q=QUIP_APPROX_QUESTIONS.find(q=>q.id===id);
    game.current.question={...q,categories:q.categories.slice()};game.current.word=q.question;game.current.difficulty=q.difficulty;persist();render();},fixtures[index]);
   await settle(page,'scene-game');const before=await approxGeometry(page,device,false);
   if(index===0){shortHeight=before.card.height;assert.ok(before.card.height<=before.copySH+before.padding+2,'Short card is stretched');}
   if(index===1){
    assert.ok(before.card.height>shortHeight+5,'Card does not adapt to question length');
    const snapshot=await page.evaluate(()=>game.current);
    await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
    assert.deepEqual(await page.evaluate(()=>game.current),snapshot);
    if(device.name==='phone'){await settle(page,'scene-game');await capture(page,{path:'artifacts/quip-mobile-layout/task005-phone-approx-question.png'});}
   }
   await page.locator('[data-action="reveal-approx"]').click();await approxGeometry(page,device,true);
   if(index===1){
    const snapshot=await page.evaluate(()=>game.current);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
    assert.deepEqual(await page.evaluate(()=>game.current),snapshot);await approxGeometry(page,device,true);
    if(device.name==='phone'){await settle(page,'scene-game');await capture(page,{path:'artifacts/quip-mobile-layout/task005-phone-approx-answer.png'});}
   }
   await page.locator('[data-action="award-none"]').click();
  }
  assert.deepEqual(await page.evaluate(()=>game.scores),[0,0]);assert.equal(await page.evaluate(()=>game.roundIndex),3);
  assert.deepEqual(errors,[]);console.log('task005 approx PASS',device.name);
 }finally{await context.close();}
}
module.exports=async function task005(browser,url){
 fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
 for(const device of devices){await settingsUI(browser,url,device);await approxUI(browser,url,device);}
};
