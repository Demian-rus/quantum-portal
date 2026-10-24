'use strict';
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},
 {name:'desktop',width:1440,height:900},{name:'landscape',width:640,height:360}];
const choose=(page,value)=>page.locator('#award-policy-choices [data-value="'+value+'"]');
const yesno=page=>page.locator('#mode-toggles input[value="yesno"]');
async function enableMode(page,id){
 const input=page.locator('#mode-toggles input[value="'+id+'"]');
 if(!await input.isChecked())await page.locator('#mode-toggles label:has(input[value="'+id+'"])').click();
 assert.equal(await input.isChecked(),true);
}
async function setup(page){await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();}
async function geometry(page){
 const g=await page.locator('#award-policy-choices').evaluate(el=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,w:r.width,h:r.height}};
  return {choices:rect(el),teams:rect(document.querySelector('#setup-panel .setup-grid')),next:rect(document.querySelector('.settings-grid--compact')),
   width:innerWidth,sw:document.documentElement.scrollWidth,buttons:[...el.querySelectorAll('button')].map(n=>({...rect(n),sw:n.scrollWidth,cw:n.clientWidth}))};
 });
 assert.ok(g.choices.top>=g.teams.bottom&&g.next.top>=g.choices.bottom,'Recipient setting must follow the players');
 assert.ok(g.sw<=g.width+1&&g.buttons.every(b=>b.h>=44&&b.sw<=b.cw+1&&b.left>=0&&b.right<=g.width+1),JSON.stringify(g));
 assert.equal(await page.locator('#award-policy-choices [aria-pressed="true"]').count(),1);
 assert.equal(await page.locator('#scene-advanced [data-setting="awardTo"]').count(),0);
}
async function shot(page,name){
 await page.waitForFunction(()=>!document.getElementById("toast").classList.contains("show"));
 await page.locator("#toast").evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await page.locator('#scene-setup,#scene-advanced').evaluateAll(async els=>{for(const el of els)await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))});
 await capture(page,{path:'artifacts/quip-mobile-layout/task007a-'+name+'.png'});
}
module.exports=async function awardPolicy(browser,url){
 fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
 for(const device of devices){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:device.name==='phone'?2:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);await setup(page);await page.setViewportSize({width:device.width,height:device.height});
   assert.equal(await choose(page,'setter').getAttribute('aria-pressed'),'true');assert.equal(await yesno(page).isChecked(),false);
   await geometry(page);
   if(device.name==='phone')await shot(page,'phone-setter');
   await choose(page,'guesser').click();await geometry(page);
   if(device.name==='phone')await shot(page,'phone-guesser');
   await page.locator('#go-advanced').click();await page.locator('#mode-settings > summary').click();await enableMode(page,'yesno');
   await page.locator('#advanced-done').click();const previous=await page.evaluate(()=>options.modes);
   await choose(page,'setter').click();assert.equal(await page.evaluate(()=>options.modes.includes('yesno')),false);
   assert.deepEqual(await page.evaluate(()=>options.modes),previous.filter(id=>id!=='yesno'));
   await page.locator('#go-advanced').click();await page.locator('#mode-settings > summary').click();
   assert.equal(await yesno(page).isDisabled(),true);assert.equal(await yesno(page).isChecked(),false);
   assert.match(await yesno(page).evaluate(el=>el.closest('label').title),/Доступно, когда очки получает отгадывающий/);
   await yesno(page).evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))});
   assert.equal(await yesno(page).isChecked(),false);assert.equal(await page.evaluate(()=>options.modes.includes('yesno')),false);
   await page.locator('#advanced-done').click();await choose(page,'guesser').click();
   await page.locator('#go-advanced').click();await page.locator('#mode-settings > summary').click();assert.equal(await yesno(page).isDisabled(),false);assert.equal(await yesno(page).isChecked(),false);
   await enableMode(page,'yesno');await page.locator('#advanced-done').click();
   await page.reload({waitUntil:'load'});await setup(page);assert.equal(await choose(page,'guesser').getAttribute('aria-pressed'),'true');
   await page.locator('#go-advanced').click();await page.locator('#mode-settings > summary').click();assert.equal(await yesno(page).isChecked(),true);await page.locator('#advanced-done').click();
   await page.evaluate(()=>{options.modes=['yesno'];persist();renderOptions()});await choose(page,'setter').click();
   assert.deepEqual(await page.evaluate(()=>options.modes),[]);assert.equal(await page.locator('#start-game').isDisabled(),true);assert.match(await page.locator('#setup-mode-notice').textContent(),/Выберите/);
   await page.reload({waitUntil:'load'});await setup(page);assert.deepEqual(await page.evaluate(()=>options.modes),[]);assert.equal(await page.locator('#start-game').isDisabled(),true);
   await page.locator('#go-advanced').click();await page.locator('#mode-settings > summary').click();await enableMode(page,'talk');await page.locator('#advanced-done').click();assert.equal(await page.locator('#start-game').isEnabled(),true);
   for(const value of ['setter','guesser']){
    await choose(page,value).click();
    await page.evaluate(()=>{soundOn=false;options.modes=['talk'];options.dice=false;options.complications=false;chooseStartingTeam=()=>0});
    await page.locator('#start-game').click();
    assert.equal(await page.locator('#role-a').textContent(),'ЗАГАДЫВАЕТ');assert.equal(await page.locator('#role-b').textContent(),'ОТГАДЫВАЕТ');
    assert.match(await page.locator('.ready-content .play-subtitle').textContent(),new RegExp('Очки получает '+(value==='setter'?'Молнии':'Кометы')));
    await page.locator('[data-action="roll"]').click();await page.locator('[data-action="toggle-word"]').click();await page.locator('[data-action="start-timer"]').click();
    await page.locator('[data-action="correct-now"]').click();
    const expected=value==='setter'?[1,0]:[0,1];assert.deepEqual(await page.evaluate(()=>game.scores),expected);
    assert.equal(await page.evaluate(()=>game.history[0].team),value==='setter'?'Молнии':'Кометы');
    // Future setup changes must not alter the already-started game's recipient.
    const match=await page.evaluate(()=>{game.dice=true;persist();return JSON.stringify(game)});await page.evaluate(()=>setScene('home'));await setup(page);
    await choose(page,value==='setter'?'guesser':'setter').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),match);
    await page.reload({waitUntil:'load'});assert.equal(await page.evaluate(()=>JSON.stringify(game)),match);
    await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>game.awardTo),value);
    await page.evaluate(()=>setScene('home'));await setup(page);
   }
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);
   const stored=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));await context.setOffline(true);await page.reload({waitUntil:'load'});await setup(page);
   assert.equal(await page.evaluate(()=>localStorage.getItem(STORAGE_KEY)),stored);await geometry(page);
   assert.deepEqual(errors,[]);console.log('task007a award-policy PASS',device.name);
  }finally{await context.close();}
 }
};
