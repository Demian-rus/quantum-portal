'use strict';
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const topics=[{id:'geography',version:4,source:'geography-v2',name:'География',prefix:'task008b'},{id:'science',version:4,source:'science-v2',name:'Наука',prefix:'task008c'}];
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},{name:'desktop',width:1440,height:900}];
async function settleAnimations(page){await page.locator('.scene:not([hidden])').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))))}
async function screenshot(page,topic,name){await settleAnimations(page);await capture(page,{path:'artifacts/quip-mobile-layout/'+topic.prefix+'-'+name+'.png'})}
async function align(page,selector){await page.locator(selector).evaluate(el=>{const scroll=document.getElementById('advanced-scroll');scroll.scrollTop+=el.getBoundingClientRect().top-scroll.getBoundingClientRect().top-8})}
async function chooseTopic(page,topic){await page.locator('#new-game-menu').click();await page.locator('#thematic-game').click();await page.locator('[data-theme="'+topic.id+'"]').click()}
async function assertRoundSource(page,source){assert.equal(await page.evaluate(source=>{
 const c=game.current;if(c.question){const theme=source.replace(/-v2$/,'');return game.contentPack.id===theme&&c.question.categories.includes(theme)&&getPackQuestionPool(game.contentPack,c.difficulty).some(q=>q.id===c.question.id&&JSON.stringify(q)===JSON.stringify(c.question))}
 const kind=c.modeId==='blitz'?'blitz':getMode(c.methodId).kind,pool=getPackCardPool(game.contentPack,kind,c.difficulty,game.promptTypes);
 return pool.every(row=>row.pack===source)&&(c.blitzWords||[c.word]).every(text=>pool.some(row=>row.text===text));
},source),true)}
module.exports=async function thematicUI(browser,url){
 fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
 for(const topic of topics)for(const device of devices){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.name==='phone'?2:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url,{waitUntil:'load'});const standard=await page.evaluate(()=>JSON.stringify({modes:options.modes,promptTypes:options.promptTypes}));
   await page.locator('#new-game-menu').click();await page.locator('#thematic-game').click();
   assert.equal(await page.locator('[data-theme="'+topic.id+'"]').isEnabled(),true);
   for(const id of ['biology','animals','history','culture'])assert.equal(await page.locator('[data-theme="'+id+'"]').isDisabled(),true);
   if(device.name==='phone')await screenshot(page,topic,'phone-picker');
   await page.locator('[data-theme="'+topic.id+'"]').click();assert.equal(await page.locator('#setup-pack-caption').textContent(),topic.name);
   if(device.name==='phone')await screenshot(page,topic,'phone-setup');
   await page.locator('[data-setting="awardTo"] button[data-value="guesser"]').click();await page.locator('#go-advanced').click();await page.locator('#mode-settings > summary').click();
   assert.equal(await page.locator('#mode-toggles input[value="sing"]').isDisabled(),true);
   assert.match(await page.locator('#mode-toggles input[value="sing"] + span .mode-availability').textContent(),/нет песен/);
   assert.equal(await page.locator('#content-toggles input[value="idiom"]').isDisabled(),true);
   await page.locator('#mode-toggles input[value="yesno"]').check();await align(page,'#mode-settings');
   if(device.name==='phone')await screenshot(page,topic,'phone-modes');
   const width=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth,tiles:[...document.querySelectorAll('#mode-toggles .mode-tile')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right}})}));
   assert.ok(width.scroll<=width.w+1);assert.ok(Math.abs(width.tiles[0].y-width.tiles[1].y)<1);assert.ok(width.tiles[2].y>width.tiles[0].y);assert.ok(width.tiles.every(r=>r.x>=0&&r.right<=width.w+1));
   await page.locator('#advanced-done').click();const awardTo=device.name==='phone'?'guesser':'setter';
   await page.locator('[data-setting="awardTo"] button[data-value="'+awardTo+'"]').click();
   await page.evaluate(()=>{soundOn=false;options.modes=['talk'];options.promptTypes=['word'];options.finishType='rounds';options.rounds=2;options.dice=false;options.modifierChance=100;options.complications=true;Math.random=()=>0;chooseStartingTeam=()=>0;renderOptions()});
   await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();await assertRoundSource(page,topic.source);
   await page.locator('[data-action="toggle-word"]').click();if(device.name==='phone')await screenshot(page,topic,'phone-round');
   await page.locator('[data-action="start-timer"]').click();await page.locator('[data-action="base-now"]').click();
   assert.equal(await page.evaluate(()=>game.history[0].outcome),'base-only');assert.deepEqual(await page.evaluate(()=>game.scores),awardTo==='setter'?[1,0]:[0,1]);
   assert.equal(await page.evaluate(()=>game.phase),'ready');await page.locator('[data-action="roll"]').click();await assertRoundSource(page,topic.source);await page.locator('[data-action="toggle-word"]').click();await page.locator('[data-action="start-timer"]').click();await page.locator('[data-action="correct-now"]').click();
   assert.equal(await page.evaluate(()=>game.phase),'results');assert.equal(await page.evaluate(()=>game.contentPack.id),topic.id);await page.locator('[data-action="again"]').click();assert.equal(await page.evaluate(()=>game.roundIndex),0);assert.equal(await page.evaluate(()=>game.contentPack.id),topic.id);
   if(device.name==='phone'){
    for(const mode of ['mime','draw','yesno','secret','blitz','approx']){
     await page.evaluate(mode=>{options.modes=[mode];options.dice=false;options.complications=mode!=='secret';options.modifierChance=100;newGame();roll()},mode);await assertRoundSource(page,topic.source);
     if(mode==='secret')assert.notEqual(await page.evaluate(()=>game.current.methodId),'sing');
     if(mode==='blitz'){
      assert.equal(await page.evaluate(()=>new Set(game.current.blitzWords).size),3);await page.locator('[data-action="toggle-word"]').click();await page.locator('[data-action="start-timer"]').click();
      for(let i=0;i<3;i++)await page.locator('[data-action="blitz-correct"]').click();
      await page.locator('[data-action="base"]').click();assert.equal(await page.evaluate(()=>game.history[0].reward),2);
     }else if(mode==='approx'){
      await screenshot(page,topic,'phone-approx-question');await page.locator('[data-action="reveal-approx"]').click();await screenshot(page,topic,'phone-approx-answer');
      for(const action of ['award-a','award-b','award-both','award-none'])assert.equal(await page.locator('[data-action="'+action+'"]').isVisible(),true);
      await page.locator('[data-action="award-both"]').click();assert.deepEqual(await page.evaluate(()=>game.scores),[1,1]);
     }
    }
   }
   await page.evaluate(()=>{options.modes=['talk'];options.dice=false;newGame();roll();options.dice=true;game.dice=true;persist()});const snapshot=await page.evaluate(()=>JSON.stringify(game));
   await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();assert.equal(await page.evaluate(()=>JSON.stringify(game)),snapshot);
   await page.locator('#exit-game').click();await page.locator('#new-game-menu').click();await page.locator('#standard-game').click();assert.equal(await page.evaluate(()=>JSON.stringify({modes:options.modes,promptTypes:options.promptTypes})),standard);await page.locator('#go-advanced').click();assert.equal(await page.locator('#mode-toggles input[value="sing"]').isDisabled(),false);assert.equal(await page.locator('#content-toggles input[value="idiom"]').isDisabled(),false);
   await page.locator('#advanced-done').click();await page.evaluate(()=>{options.modes=['talk'];options.dice=false;Math.random=()=>0;chooseStartingTeam=()=>0});await page.locator('#start-game').click();await page.locator('[data-action="roll"]').click();assert.equal(await page.evaluate(()=>game.contentPack.id),'general');assert.equal(await page.evaluate(()=>game.current.word),'КАРАНДАШ');
   if(device.name==='phone'){
    const other=topics.find(t=>t.id!==topic.id);await page.evaluate(()=>{game.dice=true;persist()});const activeSnapshot=await page.evaluate(()=>JSON.stringify(game));
    await page.locator('#exit-game').click();await chooseTopic(page,other);
    assert.equal(await page.locator('#setup-pack-caption').textContent(),other.name);
    await page.evaluate(()=>{options.modes=['draw','approx'];options.promptTypes=['phrase'];persist()});
    await page.reload({waitUntil:'load'});await chooseTopic(page,topic);
    assert.deepEqual(await page.evaluate(()=>({modes:options.modes,types:options.promptTypes})),{modes:['talk'],types:['word']});
    await page.reload({waitUntil:'load'});await chooseTopic(page,other);
    assert.deepEqual(await page.evaluate(()=>({modes:options.modes,types:options.promptTypes})),{modes:['draw','approx'],types:['phrase']});
    await page.reload({waitUntil:'load'});await page.locator('#continue-game').click();
    assert.equal(await page.evaluate(()=>JSON.stringify(game)),activeSnapshot);
   }
   assert.deepEqual(errors,[]);console.log('TASK008 themed UI PASS',topic.id,device.name,'navigation / all modes / awards / reload / offline / standard preferences');
  }finally{await context.close()}
 }
};
