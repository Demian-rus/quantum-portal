'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',BASE='363b9aa1e33f47f5484d438d6fc49f57c7c12c0a';
const folder='artifacts/quip-task021',devices=[[320,568],[360,640],[390,844],[412,915],[844,390]],rows=[];
async function fixture(page,{mode='mime',method='mime',id='v2-no-touch',phase='task',risk=false}={}){
 await page.evaluate(({mode,method,id,risk})=>{
  soundOn=false;Math.random=()=>0;window.__now=Date.now();Date.now=()=>window.__now;
  Object.assign(options,{modes:[mode],difficulty:'hard',complications:true,dice:false});newGame();game.dice=false;roll();game.dice=true;options.dice=true;
  const c=game.current,row=QUIP_MODIFIERS_V2.find(r=>r.id===id);
  Object.assign(c,{modeId:mode,methodId:mode==='secret'?method:mode,word:'ПЕРЕВОДИТЬ ТЕЛЕФОН В БЕЗЗВУЧНЫЙ РЕЖИМ',visible:false,risk,
   modifierVersion:2,complicationId:row?.id||null,complication:row?.text||'',deadline:null,remainingMs:null,paused:false});
  c.basePoints=rewardForRound(game,mode,c.difficulty);c.modifierPoints=row?modeConfigForGame(game,mode).modifierBonus:0;c.points=rewardForRound(game,mode,c.difficulty,!!row);
  game.phase='task';persist();render();stopTicking();
 },{mode,method,id,risk});
 if(phase!=='task'){
  await page.locator('.challenge-card').click();
  if(phase==='play')await page.evaluate(()=>{window.__now+=1001;tick();stopTicking()});
 }
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
}
async function measure(page){return page.evaluate(()=>{
 const box=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height}};
 const q=s=>box(document.querySelector(s)),condition=document.querySelector('.round-condition'),top=document.querySelector('.round-top'),card=document.querySelector('.challenge-card'),word=card?.querySelector('.challenge-word');
 const range=e=>{if(!e)return null;const r=document.createRange();r.selectNodeContents(e);return box(r)};
 return{width:innerWidth,height:innerHeight,phase:game.phase,card:q('.challenge-card'),top:q('.round-top'),ring:q('.timer-ring'),svg:q('.ring-svg'),dial:q('.timer-dial'),time:q('#active-timer'),
  ratings:[...document.querySelectorAll('[data-feedback]')].map(box),controls:[...document.querySelectorAll('.round-bottom button')].map(box),
  condition:box(condition),copy:range(condition?.querySelector('strong')),word:range(word),wordScroll:card?{h:card.scrollHeight,ch:card.clientHeight,w:card.scrollWidth,cw:card.clientWidth}:null,
  topScroll:top?{h:top.scrollHeight,ch:top.clientHeight}:null,page:{h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth},
  flag:{hidden:document.getElementById('report-card').hidden,disabled:document.getElementById('report-card').disabled,tab:document.getElementById('report-card').tabIndex,aria:document.getElementById('report-card').getAttribute('aria-hidden')}
 };
});}
const overlaps=(a,b)=>a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5;
function fits(g,{ordinary=true}={}){
 assert.deepEqual(g.flag,{hidden:true,disabled:true,tab:-1,aria:'true'},'No available current-round flag');
 assert.ok(g.page.h<=g.height+1&&g.page.w<=g.width+1,'Page overflow '+JSON.stringify(g));
 const objects=[g.card,...g.ratings,...g.controls,...[g.ring,g.time].filter(Boolean)];
 for(const b of objects)assert.ok(b.x>=-.5&&b.right<=g.width+.5&&b.y>=0&&b.bottom<=g.height+.5,'Offscreen '+JSON.stringify(g));
 for(const b of [...g.ratings,...g.controls])assert.ok(b.w>=43.9&&b.h>=43.9,'Touch target '+JSON.stringify(g));
 for(const b of [g.ring,g.svg,g.time,...g.ratings].filter(Boolean)){
  assert.ok(!overlaps(b,g.card),'Card intersects timer/rating '+JSON.stringify(g));
  const gap=g.width>g.height?g.card.x-b.right:g.card.y-b.bottom;
  assert.ok(gap>=12-.1,'Timer/rating to rotated card gap <12px '+JSON.stringify({gap,g}));
 }
 for(const b of g.controls){assert.ok(b.y-g.card.bottom>=11.9,'Card to result gap <12px '+JSON.stringify(g));}
 for(let i=0;i<g.ratings.length;i++){
  for(const b of [g.ring,g.time,...g.controls,...g.ratings.slice(i+1)].filter(Boolean))assert.ok(!overlaps(g.ratings[i],b),'Rating intersects control '+JSON.stringify(g));
 }
 assert.ok(g.wordScroll.h<=g.wordScroll.ch+1&&g.wordScroll.w<=g.wordScroll.cw+1,'Word scroller/clipping '+JSON.stringify(g));
 assert.ok(g.word.y>=g.card.y-1&&g.word.bottom<=g.card.bottom+1,'Word text outside card '+JSON.stringify(g));
 if(ordinary&&g.condition){assert.ok(g.topScroll.h<=g.topScroll.ch+1,'Ordinary upper content scrolls '+JSON.stringify(g));assert.ok(g.copy.y>=g.top.y-.5&&g.copy.bottom<=g.top.bottom+.5,'Condition clipped '+JSON.stringify(g));}
}
function stable(a,b){for(const k of ['x','y','w','h'])assert.ok(Math.abs(a.card[k]-b.card[k])<=2,'Phase moves card '+JSON.stringify({a,b,k}));}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const[width,height]of devices){
   // Exact published v83 bytes with the identical fixture, including its compiled alternative.
   const old=await browser.newContext({viewport:{width,height},isMobile:true,deviceScaleFactor:2.625,hasTouch:true,serviceWorkers:'block'}),op=await old.newPage();
   await op.route('**/party-game/**',async route=>{
    const name=new globalThis.URL(route.request().url()).pathname.split('/party-game/')[1]||'index.html';
    if(!/^(?:index\.html|style\.css|[a-z\d-]+\.js)$/.test(name)){await route.continue();return;}
    const bytes=execFileSync('git',['show',BASE+':party-game/'+name],{maxBuffer:8e6});await route.fulfill({body:bytes,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
   });
   await op.goto(URL);await provisionProfiles(op);
   for(const phase of ['task','play']){await fixture(op,{phase});await op.screenshot({path:folder+'/before-'+phase+'-'+width+'.png',animations:'disabled'});}
   await old.close();
   const ctx=await browser.newContext({viewport:{width,height},isMobile:true,deviceScaleFactor:2.625,hasTouch:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(URL);await provisionProfiles(page);
    for(const scenario of [
     {mode:'mime',id:'v2-no-touch'},{mode:'secret',method:'talk',id:'v2-analogy'},
     {mode:'sing',id:'v2-closed-mouth'},{mode:'secret',method:'sing',id:'v2-phrase-pause'},
     {mode:'blitz',id:'v2-unique-nouns',risk:true},{mode:'talk',id:null}]){
     await fixture(page,scenario);const task=await measure(page);fits(task);
     assert.ok(!(await page.locator('.round-condition').count())||!/(физически недоступно|удобно|безопасно|задерживай дыхание)/iu.test(await page.locator('.round-condition').getAttribute('title')));
     await page.locator('.challenge-card').click();const countdown=await measure(page);fits(countdown);stable(task,countdown);
     await page.evaluate(()=>{window.__now+=1001;tick();stopTicking()});const play=await measure(page);fits(play);stable(task,play);
     assert.equal(play.ratings.length,2);assert.equal(play.controls.length,scenario.mode==='blitz'?3:scenario.id?3:2);
     rows.push({width,height,scenario,task,countdown,play});
     if(scenario.mode==='mime'){
      await page.screenshot({path:folder+'/after-play-'+width+'.png',animations:'disabled'});
      await fixture(page,scenario);await page.screenshot({path:folder+'/after-task-'+width+'.png',animations:'disabled'});
     }
    }
    await fixture(page,{mode:'talk',id:null,phase:'play'});
    await page.evaluate(()=>{game.current.word=PARTY_CARDS.filter(r=>['word','phrase','idiom'].includes(r.type)).sort((a,b)=>b.text.length-a.text.length)[0].text;render();stopTicking()});
    fits(await measure(page));
    // Every V2 display string fits at the narrowest portrait; no two-phrase whitelist.
    if(width===320){
     const ids=await page.evaluate(()=>QUIP_MODIFIERS_V2.map(r=>r.id));
     for(const id of ids){await fixture(page,{mode:'mime',id,phase:'play'});fits(await measure(page));}
     // Simulate additional top/bottom safe-area consumption in the actual grid.
     await page.addStyleTag({content:'.scene--game{padding-top:32px!important;padding-bottom:28px!important}'});
     for(const phase of ['task','countdown','play']){await fixture(page,{mode:'mime',id:'v2-no-touch',phase});fits(await measure(page));}
    }
    assert.deepEqual(errors,[]);console.log('TASK021 geometry PASS',width,height,'all phases / modes / 2+3 controls / ≥12px actual gaps / stable card / no flag');
   }catch(error){await page.screenshot({path:folder+'/failure-'+width+'.png',animations:'disabled'});throw error;}finally{await ctx.close();}
  }
  fs.writeFileSync(folder+'/geometry.json',JSON.stringify(rows,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
