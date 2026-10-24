'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',parent='1498309d79bb97e68392b3d6f46996700e39d37b',folder='artifacts/quip-approx-units';
const state=p=>p.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)}));
async function fixture(page,{tie=false,id='approx-20130',long=false}={}){
 await page.evaluate(({tie,id,long})=>{
  soundOn=false;Object.assign(options,{modes:['approx'],difficulty:'medium',dice:false,finishType:'score',targetScore:15});newGame();game.dice=false;roll();game.dice=true;options.dice=true;
  const q=long?[...QUIP_APPROX_QUESTIONS].filter(q=>q.unit).sort((a,b)=>b.question.length-a.question.length)[0]:QUIP_APPROX_QUESTIONS.find(q=>q.id===id);
  const snapshot={id:q.id,question:q.question,answer:String(q.answer),unit:q.unit,note:q.note||'',difficulty:q.difficulty};
  if(tie){game.finishType='score';game.roundIndex=30;game.scores=[15,15];game.targetScore=15;game.current=null;game.tiebreak={version:1,stage:'question',question:snapshot,attempted:[q.id],winnerIndex:null};game.phase='tiebreak';}
  else{game.current.question=snapshot;game.current.word=q.question;game.current.cardId=q.id;game.phase='task';}
  persist();render();
 },{tie,id,long});
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
}
async function geometry(page,{ordinary=true}={}){
 const g=await page.evaluate(()=>{
  const b=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,client:e.clientHeight,scroll:e.scrollHeight}};
  return{card:b('.approx-card'),copy:b('.approx-copy'),unit:b('.approx-unit'),action:b('.approx-actions button'),w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight};
 });
 assert.ok(g.sw<=g.w+1&&g.sh<=g.h+1,'Page overflow '+JSON.stringify(g));
 assert.ok(g.unit.y>=g.card.y&&g.unit.bottom<=g.card.bottom&&g.unit.x>=0&&g.unit.right<=g.w,'Unit clipped '+JSON.stringify(g));
 assert.ok(g.unit.bottom<=g.copy.y+1,'Unit must stay above question scroll '+JSON.stringify(g));
 assert.ok(g.action.h>=44&&g.action.y>=g.card.bottom&&g.action.bottom<=g.h,'Action unreachable '+JSON.stringify(g));
 if(ordinary)assert.ok(g.copy.scroll<=g.copy.client+1,'Ordinary question unnecessarily scrolls '+JSON.stringify(g));
 return g;
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [width,height]of [[320,568],[390,844],[844,390]]){
   const old=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),op=await old.newPage();
   await op.route('**/party-game/**',async route=>{
    const name=new globalThis.URL(route.request().url()).pathname.split('/party-game/')[1]||'index.html';
    if(!/^(?:index\.html|style\.css|[a-z-]+\.js)$/.test(name)){await route.continue();return;}
    await route.fulfill({body:execFileSync('git',['show',parent+':party-game/'+name],{maxBuffer:8e6}),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
   });
   await op.goto(URL);await provisionProfiles(op);await fixture(op);assert.equal(await op.locator('.approx-unit').count(),0);await op.screenshot({path:folder+'/before-'+width+'.png',animations:'disabled'});await old.close();
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(URL);await provisionProfiles(page);await fixture(page);const before=await state(page);
    assert.equal((await page.locator('.approx-unit').innerText()).replace(/\s+/g,' ').trim(),'ЕДИНИЦА ОТВЕТА: м');assert.equal(await page.locator('.approx-answer').count(),0);assert.ok(!(await page.locator('.approx-card').innerText()).includes('1300'));
    await geometry(page);await page.screenshot({path:folder+'/after-'+width+'.png',animations:'disabled'});
    await page.evaluate(()=>{Math.random=()=>{throw Error('Unit UI consumed RNG')};render()});assert.deepEqual(await state(page),before);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await state(page),before);await geometry(page);
    await page.locator('[data-action="reveal-approx"]').click();assert.equal(await page.locator('.approx-answer strong').textContent(),'1300 м');assert.equal(await page.evaluate(()=>game.current.question.unit),'м');
    await fixture(page,{long:true});await geometry(page,{ordinary:false});assert.equal(await page.locator('.approx-answer').count(),0);
    // If an exceptional long question scrolls, the unit stays outside that scroller.
    const unit=await page.locator('.approx-unit').boundingBox();await page.locator('.approx-copy').evaluate(el=>el.scrollTop=el.scrollHeight);assert.deepEqual(await page.locator('.approx-unit').boundingBox(),unit);
    await fixture(page,{id:'approx-0007'});assert.equal(await page.locator('.approx-unit').count(),0);assert.equal(await page.locator('.approx-answer').count(),0);
    await fixture(page,{tie:true});await geometry(page);assert.equal(await page.locator('.approx-unit strong').textContent(),'м');assert.ok(!(await page.locator('.approx-card').innerText()).includes('1300'));
    const tie=await state(page);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await state(page),tie);assert.equal(await page.locator('.approx-unit strong').textContent(),'м');
    await page.locator('[data-action="tiebreak-reveal"]').click();assert.equal(await page.locator('.approx-answer strong').textContent(),'1300 м');assert.deepEqual(await page.evaluate(()=>game.scores),[15,15]);
    assert.deepEqual(errors,[]);console.log('Approx units PASS',width,height,'Vasa / no hidden answer / long question / legacy blank / tiebreak / exact offline snapshots');
   }catch(error){await page.screenshot({path:folder+'/failure-'+width+'.png',animations:'disabled'});throw error;}finally{await ctx.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
