'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const devices=[{name:'narrow',width:320,height:568},{name:'small',width:360,height:640},
 {name:'phone',width:390,height:844},{name:'landscape',width:844,height:390},
 {name:'low-landscape',width:640,height:360},{name:'desktop',width:1440,height:900}];
const ids=['general','talk','mime','draw','sing','yesno','secret','blitz','approx'];
const snap=page=>page.evaluate(()=>({stored:localStorage.getItem(STORAGE_KEY),game,options}));
async function openPreferences(page,device){
 // Enter through the real settings button before resizing the guide. The pre-existing
 // home menu overlaps its gallery CTA on short landscape screens (outside this task).
 if(device.height<=390)await page.setViewportSize({width:390,height:844});
 await page.locator('#settings-menu').click();
 if(device.height<=390)await page.setViewportSize({width:device.width,height:device.height});
}
async function settled(page){
 await page.locator('#rules-card').evaluate(async el=>{
  await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));
  await Promise.all([...el.querySelectorAll('img')].map(img=>img.decode()));
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
 });
}
async function geometry(page,device,height){
 await settled(page);
 const g=await page.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
  const sel=s=>rect(document.querySelector(s));
  const copy=document.querySelector('.rules-copy');
  return {width:innerWidth,height:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
   dialog:sel('.rules-dialog'),header:sel('.rules-header'),card:sel('#rules-card'),heading:sel('.rules-card-heading'),copy:sel('.rules-copy'),
   nav:sel('.rules-footer'),close:sel('#close-rules'),buttons:[...document.querySelectorAll('.rules-nav button')].map(rect),
   textSW:copy.scrollWidth,textCW:copy.clientWidth,dialogSH:document.querySelector('.rules-dialog').scrollHeight,
   dialogCH:document.querySelector('.rules-dialog').clientHeight,cardSH:document.querySelector('#rules-card').scrollHeight,
   cardCH:document.querySelector('#rules-card').clientHeight, title:sel('#rules-card-title'),
   titleSW:document.querySelector('#rules-card-title').scrollWidth,titleCW:document.querySelector('#rules-card-title').clientWidth};
 });
 const msg=JSON.stringify({device,g});
 assert.ok(g.sw<=g.width+1&&g.sh<=g.height+1,'Document overflow '+msg);
 assert.ok(g.dialog.x>=0&&g.dialog.y>=0&&g.dialog.right<=g.width&&g.dialog.bottom<=g.height,msg);
 assert.ok(g.dialogSH<=g.dialogCH+1&&g.cardSH<=g.cardCH+1,'Only copy may scroll '+msg);
 assert.ok(g.card.y>=g.header.bottom+5&&g.nav.y>=g.card.bottom+5,'Overlapping shell '+msg);
 assert.ok(g.copy.h>=60&&g.copy.y>=g.card.y&&g.copy.bottom<=g.card.bottom,msg);
 assert.ok(g.textSW<=g.textCW+1&&g.titleSW<=g.titleCW+1,'Text clipped horizontally '+msg);
 assert.ok([g.close,...g.buttons].every(r=>r.w>=44&&r.h>=44&&r.y>=g.dialog.y&&r.bottom<=g.dialog.bottom),msg);
 assert.ok(g.heading.bottom<=g.card.bottom&&g.title.y>=g.card.y&&g.title.bottom<=g.card.bottom,msg);
 if(height)assert.ok(Math.abs(g.dialog.h-height)<1,'Dialog jumps in height');
 // Every block, including the final condition, remains reachable inside the copy.
 const end=await page.locator('.rules-copy').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop+el.clientHeight>=el.scrollHeight-1});
 assert.equal(end,true);
 await page.locator('.rules-copy').evaluate(el=>{el.scrollTop=0});
 return g.dialog.h;
}
async function gesture(cdp,from,to){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y}]});
 for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
module.exports=async function rulesGuide(browser,url){
 fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
 for(const device of devices){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},hasTouch:true,deviceScaleFactor:device.name==='phone'?2:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'load'});
   // Use an actual unfinished, revealed V4 round to guard against side effects.
   await page.evaluate(()=>{soundOn=false;options.modes=['approx'];options.dice=false;newGame();roll();revealApprox();game.dice=true;options.dice=true;persist();setScene('home')});
   await openPreferences(page,device);
   const before=await snap(page);
   await page.locator('#preferences-rules').click();
   assert.equal(await page.locator('#close-rules').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('.site-shell').evaluate(el=>el.inert),true);
   assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).overflowY),'hidden');
   assert.equal(await page.locator('#rules-prev').isDisabled(),true);
   let height;const images=[];
   for(let i=0;i<ids.length;i++){
    assert.equal(await page.locator('#rules-card').getAttribute('data-page'),ids[i]);
    assert.equal(await page.locator('#rules-page-status').textContent(),`${i+1} / 9`);
    height=await geometry(page,device,height);
    const copy=await page.locator('#rules-card').textContent();
    if(i){
     const art=await page.locator('.rules-art').evaluate(el=>({src:el.getAttribute('src'),w:el.naturalWidth,loaded:el.complete}));
     assert.equal(art.src,`./assets/modes/${ids[i]}.webp?v=3`);assert.equal(art.w,512);assert.equal(art.loaded,true);images.push(art.src);
     const config=await page.evaluate(id=>({points:QUIP_RULESETS[QUIP_RULE_VERSION].rewards[id].easy,bonus:getModeConfig(id).modifierBonus}),ids[i]);
     assert.ok((await page.locator('.rules-reward').textContent()).includes('+'+config.points));
     if(ids[i]==='secret')assert.match(copy,/\+2 \+ 1 = \+3/);
     if(ids[i]==='blitz'){assert.match(copy,/3\/3 → \+2/);assert.doesNotMatch(copy,/5 слов|5\/5/);}
     if(ids[i]==='approx'){assert.match(copy,/Таймера нет/);assert.match(copy,/Риска и усложнений нет/);for(const text of ['первая команда +1','вторая +1','обе +1','никому'])assert.ok(copy.includes(text));}
    }else assert.equal(await page.locator('.rules-art').count(),0);
    if(device.name==='phone'&&[0,7,8].includes(i)||device.name==='desktop'&&i===7)
     await page.screenshot({path:`artifacts/quip-mobile-layout/task006-${device.name}-${ids[i]}.png`});
    if(device.height<=390&&i===0)await page.screenshot({path:`artifacts/quip-mobile-layout/task006-${device.name}-general.png`});
    if(i<ids.length-1)await page.locator('#rules-next').click();
   }
   assert.equal(new Set(images).size,8);assert.equal(await page.locator('#rules-next').isDisabled(),true);
   await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'approx');
   await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'blitz');
   await page.locator('#rules-prev').click();assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'secret');
   // Focus stays trapped at both ends, including when a boundary button disables.
   await page.locator('#close-rules').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'rules-understood');
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'close-rules');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#rules-backdrop').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'preferences-rules');
   assert.equal(await page.locator('.site-shell').evaluate(el=>el.inert),false);
   assert.deepEqual(await snap(page),before);
   await page.locator('#preferences-rules').click();assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'general');
   const cdp=await context.newCDPSession(page),box=await page.locator('.rules-copy').boundingBox();
   const y=box.y+Math.min(65,box.height/2),right=box.x+box.width-20,left=box.x+20;
   await gesture(cdp,{x:right,y},{x:left,y:y+4});assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'talk');
   await gesture(cdp,{x:left,y},{x:right,y:y+3});assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'general');
   const scrollBox=await page.locator('.rules-copy').boundingBox();
   await gesture(cdp,{x:scrollBox.x+scrollBox.width/2,y:scrollBox.y+scrollBox.height-15},{x:scrollBox.x+scrollBox.width/2+5,y:scrollBox.y+15});
   assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'general','Vertical scroll changed page');
   if(device.name==='narrow')assert.ok(await page.locator('.rules-copy').evaluate(el=>el.scrollTop>0),'Vertical touch did not scroll long copy');
   await page.locator('#close-rules').click();assert.equal(await page.locator('#rules-backdrop').isVisible(),false);
   await page.locator('#preferences-rules').click();await page.locator('#rules-understood').click();assert.equal(await page.locator('#rules-backdrop').isVisible(),false);
   await page.locator('#preferences-rules').click();await page.mouse.click(2,2);assert.equal(await page.locator('#rules-backdrop').isVisible(),false);
   assert.deepEqual(await snap(page),before);
   // Native touch cancellation and ambiguous/short gestures are ignored.
   await page.locator('#preferences-rules').click();
   await page.locator('#rules-card').dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',isPrimary:true,clientX:200,clientY:150});
   await page.locator('#rules-card').dispatchEvent('pointercancel',{pointerId:9,pointerType:'touch',isPrimary:true});
   await page.locator('#rules-card').dispatchEvent('pointerup',{pointerId:9,pointerType:'touch',isPrimary:true,clientX:70,clientY:150});
   assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'general');
   for(const end of [{clientX:180,clientY:150},{clientX:120,clientY:245}]){
    await page.locator('#rules-card').dispatchEvent('pointerdown',{pointerId:10,pointerType:'touch',isPrimary:true,clientX:200,clientY:150});
    await page.locator('#rules-card').dispatchEvent('pointermove',{pointerId:10,pointerType:'touch',isPrimary:true,...end});
    await page.locator('#rules-card').dispatchEvent('pointerup',{pointerId:10,pointerType:'touch',isPrimary:true,...end});
    assert.equal(await page.locator('#rules-card').getAttribute('data-page'),'general');
   }
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#rules-next').click();assert.equal(await page.locator('#rules-card').evaluate(el=>el.getAnimations().length),0);
   await page.keyboard.press('Escape');
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   await context.setOffline(true);await page.reload({waitUntil:'load'});
   assert.deepEqual(await snap(page),before);
   await openPreferences(page,device);await page.locator('#preferences-rules').click();
   for(let i=0;i<ids.length;i++){
    await settled(page);assert.equal(await page.locator('#rules-card').getAttribute('data-page'),ids[i]);
    if(i<ids.length-1)await page.locator('#rules-next').click();
   }
   await page.keyboard.press('Escape');assert.deepEqual(await snap(page),before);
   await page.locator('#preferences-back').click();await page.locator('#continue-game').click();
   assert.equal(await page.locator('.approx-answer').isVisible(),true);assert.deepEqual(await snap(page),before);
   if(device.name==='phone')for(const version of [1,2,3]){
    await page.evaluate(version=>{options.modes=['blitz'];options.dice=false;newGame();game.rulesVersion=version;game.contentPack={id:'general',version:1};delete game.modeConfigVersion;game.blitzCount=5;game.dice=false;roll();game.dice=true;options.dice=true;persist();setScene('home')},version);
    await openPreferences(page,device);const legacy=await snap(page);
    await page.locator('#preferences-rules').click();
    for(let i=0;i<7;i++)await page.locator('#rules-next').click();
    assert.match(await page.locator('#rules-card').textContent(),/3\/3 → \+2/);
    await page.keyboard.press('Escape');assert.deepEqual(await snap(page),legacy);
    await page.locator('#preferences-back').click();
   }
   assert.deepEqual(errors,[]);console.log('task006 rules-guide PASS',device.name,'9 cards / touch / keyboard / saved round / offline');
  }finally{await context.close();}
 }
};
