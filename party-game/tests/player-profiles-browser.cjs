'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const {chooseNamedProfile}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
async function setup(page){await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();}
async function approxParty(page){
 await page.locator('#go-advanced').click();await page.locator('#finish-rounds').check({force:true});
 await page.locator('#custom-rounds').focus();await page.locator('#custom-rounds').press('Home');
 await page.locator('#mode-settings > summary').click();
 const input=page.locator('#mode-toggles input[value="approx"]');
 if(!await input.isChecked())await page.locator('#mode-toggles label:has(input[value="approx"])').click();
 for(const mode of ['talk','mime','draw','sing','yesno','secret','blitz']){
  const input=page.locator('#mode-toggles input[value="'+mode+'"]');
  if(await input.isChecked())await page.locator('#mode-toggles label:has(input[value="'+mode+'"])').click();
 }
 await page.locator('#advanced-done').click();await page.locator('#start-game').click();
 // Skip the cosmetic reel in settlement fixtures; the real controls still
 // select the production question and commit its unchanged award semantics.
 await page.evaluate(()=>{game.dice=false});
}
async function answer(page,choice){
 await page.locator('[data-action="roll"]').click();await page.locator('[data-action="reveal-approx"]').click();await page.locator('[data-action="award-'+choice+'"]').click();
}
async function store(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('kvip-player-profiles:v1')));}
async function geometry(page){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'horizontal overflow');
 const boxes=await page.locator('#scene-home .home-menu button,#other-games-menu').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};}));
 for(const rect of boxes)assert.ok(rect.top>=0&&rect.bottom<=await page.evaluate(()=>innerHeight)&&rect.height>=38,JSON.stringify(boxes));
 assert.ok(boxes[3].bottom<=boxes[4].top,'Settings overlaps Other games');
}
(async()=>{
 fs.mkdirSync('artifacts/quip-profiles',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [width,height] of [[320,568],[390,844],[412,915],[1440,900],[844,390]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(URL,{waitUntil:'load'});await geometry(page);
   assert.equal(await store(page),null,'Boot creates no fake profiles');
   if(width===390)await page.screenshot({path:'artifacts/quip-profiles/home.png'});
   await setup(page);assert.equal(await page.locator('#start-game').isDisabled(),true);
   await page.locator('#team-a').click();assert.equal(await page.locator('#profile-empty').isVisible(),true);
   await page.locator('#profile-create-open').click();await page.locator('#profile-name').fill('Отмена');
   await page.goBack();await page.locator('#profile-list-area').waitFor({state:'visible'});
   assert.equal(await store(page),null);assert.equal(await page.locator('#scene-setup').isVisible(),true);
   await page.goBack();await page.locator('#profile-backdrop').waitFor({state:'hidden'});
   await chooseNamedProfile(page,0,'ДС','violet');await chooseNamedProfile(page,1,'ПА','green');
   await page.locator('#team-b').click();assert.equal(await page.locator('#profile-list button').filter({hasText:'ДС'}).isDisabled(),true);
   await page.locator('#profile-create-open').click();await page.locator('#profile-name').fill(' дс ');await page.locator('#profile-create-save').click();
   assert.match(await page.locator('#profile-panel-error').textContent(),/уже есть/);
   await page.locator('#profile-name').fill('😀'.repeat(25));await page.locator('#profile-create-save').click();assert.match(await page.locator('#profile-panel-error').textContent(),/24/);
   await page.locator('#profile-close').click();assert.equal((await store(page)).profiles.length,2);
   await approxParty(page);
   assert.deepEqual(await page.evaluate(()=>[0,1].map(i=>profileColorForMatch(game,i))),['#af98ff','#a8ef9b']);
   const colors=await page.locator('.match-team .team-spot').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).backgroundColor));
   assert.deepEqual(colors,['rgb(175, 152, 255)','rgb(168, 239, 155)']);
   if(width===390)await page.screenshot({path:'artifacts/quip-profiles/active-colors.png'});
   await answer(page,'both');await answer(page,'none');
   assert.equal(await page.locator('#scene-results').isVisible(),true);
   const result=await store(page);assert.equal(result.recent.length,1);assert.equal(result.totals[result.profiles[0].id].draws,1);
   await page.reload({waitUntil:'load'});assert.deepEqual(await store(page),result,'reload cannot count results twice');
   await page.locator('#statistics-menu').click();assert.match(await page.locator('#statistics-metrics').textContent(),/1/);
   if(width===390)await page.screenshot({path:'artifacts/quip-profiles/statistics.png'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.locator('#statistics-profile').click();await page.locator('#profile-create-open').click();await page.locator('#profile-name').fill('Третий');await page.locator('[data-profile-color="orange"]').click();await page.locator('#profile-create-save').click();
   assert.match(await page.locator('#statistics-profile').textContent(),/Третий/);
   await page.goBack();await page.locator('#scene-home').waitFor({state:'visible'});
   await setup(page);await chooseNamedProfile(page,0,'Третий');await chooseNamedProfile(page,1,'ДС');await chooseNamedProfile(page,0,'ПА');
   assert.match(await page.locator('#team-a').textContent(),/ПА/);assert.match(await page.locator('#team-b').textContent(),/ДС/);
   await page.locator('#start-game').click();assert.deepEqual(await page.evaluate(()=>game.profileMatch.participants.map(p=>p.color)),['green','violet']);
   await page.locator('#exit-game').click();await page.reload({waitUntil:'load'});await setup(page);
   assert.match(await page.locator('#team-a').textContent(),/ПА/);assert.match(await page.locator('#team-b').textContent(),/ДС/);
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await context.setOffline(true);await page.reload({waitUntil:'load'});
   await page.locator('#continue-game').click();assert.deepEqual(await page.evaluate(()=>game.profileMatch.participants.map(p=>p.color)),['green','violet']);
   await page.locator('#exit-game').click();await page.locator('#statistics-menu').click();assert.equal((await store(page)).recent.length,1);
   assert.deepEqual(errors,[]);await context.close();console.log('profiles UI / offline / geometry',width,height,'PASS');
  }
  // A failed final aggregate write keeps the actual completed match available.
  {
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(URL);await setup(page);
   await chooseNamedProfile(page,0,'ДС');await chooseNamedProfile(page,1,'ПА');await approxParty(page);await answer(page,'a');
   await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='kvip-player-profiles:v1')throw Error('fixture quota');return Reflect.apply(write,this,arguments);};});
   await answer(page,'none');assert.equal((await store(page)).recent.length,0);
   assert.match(await page.locator('#results-content').textContent(),/ПОВТОРИТЬ ЗАПИСЬ/);
   await page.locator('[data-action="menu"]').click();assert.equal(await page.locator('#scene-results').isVisible(),true);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('iskra-party:v1')).game.phase),'results');
   await page.reload({waitUntil:'load'});const result=await store(page);assert.equal(result.recent.length,1);
   await page.reload({waitUntil:'load'});assert.deepEqual(await store(page),result);await context.close();console.log('quota / reload retry PASS');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
