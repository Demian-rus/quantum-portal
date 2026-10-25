'use strict';
const {provisionProfiles,historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const assert=require('node:assert/strict');
const {capture}=require('./screenshots.cjs');
const devices=[{name:'narrow',width:320,height:568},{name:'phone',width:390,height:844},
 {name:'tall-phone',width:412,height:915},{name:'desktop',width:1280,height:800},
 {name:'landscape',width:640,height:360}];
const modes=['mime','talk','draw','sing','yesno','secret','blitz'];
async function settled(page){
 await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
 await page.locator('.mode-art').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.evaluate(()=>document.fonts.ready);
}
async function fixture(page,mode,modified=false){
 await page.evaluate(({mode,modified})=>{
  soundOn=false;chooseStartingTeam=()=>0;Math.random=()=>0;
  Object.assign(options,{modes:[mode],dice:false,difficulty:'easy',complications:modified,riskRounds:false,awardTo:'guesser'});
  newGame();roll();
  if(game.phase!=='task'||game.current.modeId!==mode)throw Error('Layout fixture did not start '+mode+': '+game.phase+'/'+game.current?.modeId);
  if(mode==='secret'){
   game.current.methodId='draw';
   game.current.complication='Не рисуй горизонтальные и вертикальные линии.';
  }
  game.current.word='УВЕДОМЛЕНИЕ';persist();render();
 },{mode,modified});
 await settled(page);
}
const geometry=page=>page.evaluate(()=>{
 const rect=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
 return {bar:rect('.match-bar'),top:rect('.round-top'),icon:rect('.round-top .mode-symbol'),
  title:rect('.mode-name'),rule:rect('.round-condition'),reward:rect('.round-top .score-note,.round-top .secret-flag'),
  card:rect('.challenge-card'),word:rect('.challenge-word'),caption:rect('.round-top--timer .game-eyebrow'),
  timer:rect('.timer-ring'),
  wrong:rect('[data-action="wrong-now"]'),base:rect('[data-action="base-now"]'),correct:rect('[data-action="correct-now"]'),
  page:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},w:innerWidth,h:innerHeight};
});
const sameBox=(a,b,message)=>{for(const key of ['x','y','w','h'])assert.ok(Math.abs(a[key]-b[key])<=2,message+': '+JSON.stringify({a,b}))};
module.exports=async function roundLayout(browser,url){
 for(const device of devices){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},hasTouch:device.width<500});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(url,{waitUntil:'load'});await provisionProfiles(page);
   let iconBox,plain;
   for(const mode of modes){
    await fixture(page,mode,mode==='secret'||mode==='talk');
    const g=await geometry(page);
    assert.ok(g.bar.y>=7&&g.bar.y<=12,'Excessive gap above teams: '+JSON.stringify(g));
    assert.equal(await page.locator('#match-team-a').evaluate(el=>el.classList.contains('is-turn')),true,'Setter must be active before reveal');
    assert.equal(await page.locator('#match-team-b').evaluate(el=>el.classList.contains('is-turn')),false);
    assert.ok(g.page.w<=g.w+1&&g.page.h<=g.h+1,'Page overflow');
    assert.ok(Math.abs(g.icon.w-g.icon.h)<=1,'Mode icon was squeezed by a long title');
    if(iconBox)sameBox({x:0,y:0,w:g.icon.w,h:g.icon.h},{x:0,y:0,w:iconBox.w,h:iconBox.h},'Mode icon size changed');
    iconBox=g.icon;
    if(device.height>480)assert.ok(g.icon.y>=g.top.y-1&&g.icon.bottom<=g.title.y-3,'Icon/title collide or clip: '+JSON.stringify(g));
    else assert.ok(g.icon.y>=g.top.y-1&&g.icon.right<=g.title.x-3&&g.title.bottom<=g.top.bottom,'Landscape icon/title collide or clip: '+JSON.stringify(g));
    if(g.rule)assert.ok(g.title.bottom<=g.rule.y-3&&g.rule.bottom<=g.reward.y-3,'Condition/reward collide: '+JSON.stringify(g));
    else assert.ok(g.title.bottom<=g.reward.y-3,'Title/reward collide: '+JSON.stringify(g));
    assert.equal(await page.locator('.mode-rule').count(),0,'Generic rules should stay in the guide');
    if(device.height>device.width)assert.ok(g.reward.bottom<=g.card.y-3,'Reward collides with card: '+JSON.stringify(g));
    assert.equal(await page.locator('.challenge-overline,.challenge-details').count(),0);
    if(mode==='mime'&&device.name==='phone')await capture(page,{path:'artifacts/quip-mobile-layout/task013a-phone-plain-task.png'});
    const saved=await page.evaluate(()=>({raw:localStorage.getItem('iskra-party:v1'),game:JSON.stringify(game),memory:JSON.stringify(taskMemory)}));
    await page.evaluate(()=>render());
    assert.deepEqual(await page.evaluate(()=>({raw:localStorage.getItem('iskra-party:v1'),game:JSON.stringify(game),memory:JSON.stringify(taskMemory)})),saved,'Rendering changed saved data');
    await page.locator('.challenge-card[data-action="toggle-word"]').click();
    const prompt=await page.locator('.challenge-word').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return {text:el.textContent,lines:range.getClientRects().length,font:getComputedStyle(el).font,available:el.closest('.challenge-card').clientWidth}});
    assert.equal(prompt.text,'УВЕДОМЛЕНИЕ');assert.equal(prompt.lines,1,'Word should fit before hyphenation: '+JSON.stringify(prompt));
    await page.locator('[data-action="start-timer"]').click();
    const playing=await geometry(page);
    assert.equal(await page.locator('#match-team-b').evaluate(el=>el.classList.contains('is-turn')),true,'Guesser must be active during timer');
    assert.equal(await page.locator('#match-team-a').evaluate(el=>el.classList.contains('is-turn')),false);
    assert.ok(playing.caption.bottom<=playing.timer.y-(device.height>device.width?7:2),'Timer caption needs breathing room');
    if(mode==='mime')plain=playing;
    if(mode==='secret'){
     for(const key of ['wrong','correct','card'])sameBox(playing[key],plain[key],'Extra outcome moved '+key);
     assert.ok(playing.wrong.x<playing.base.x&&playing.base.x<playing.correct.x,'Verdict slots out of order');
    }
    assert.ok(playing.card.w>=44&&playing.card.h>=44,'Card touch target too small');
    assert.equal(await page.locator('.round-visibility').count(),0,'Standalone visibility row remains');
    assert.equal(await page.locator('.challenge-card[data-action="toggle-word"]').count(),1);
    const deadline=await page.evaluate(()=>game.current.deadline);
    await page.locator('.challenge-card').click();await page.locator('.challenge-card').click();
    assert.equal(await page.evaluate(()=>game.current.deadline),deadline);
    sameBox((await geometry(page)).card,playing.card,'Visibility changed the card geometry');
    if(mode==='mime'&&device.name==='phone')await capture(page,{path:'artifacts/quip-mobile-layout/task013a-phone-plain-timer.png'});
    if(mode==='secret'&&device.name==='landscape')await capture(page,{path:'artifacts/quip-mobile-layout/task013a-landscape-timer.png'});
    if(mode==='secret'&&['phone','narrow'].includes(device.name)){
     await capture(page,{path:'artifacts/quip-mobile-layout/task013a-'+device.name+'-timer.png'});
     await fixture(page,mode,true);
     await capture(page,{path:'artifacts/quip-mobile-layout/task013a-'+device.name+'-task.png'});
    }
   }
   assert.deepEqual(errors,[]);
   console.log('round-layout PASS',device.name,JSON.stringify({modes:modes.length,icon:{w:iconBox.w,h:iconBox.h},card:plain.card,verdicts:[plain.wrong,plain.correct]}));
  }catch(error){
   console.error('round-layout failure',device.name,await page.evaluate(()=>({phase:game?.phase,mode:game?.current?.modeId,startingTeam:game?.startingTeamIndex})));
   await page.screenshot({path:'artifacts/quip-mobile-layout/task013a-'+device.name+'-failure.png'});throw error;
  }finally{await context.close()}
 }
};
