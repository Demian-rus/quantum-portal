'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright-core'),{provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',base='959017bf33c5bb8a8fd08ba047ad99c82682e32d';
const folder='artifacts/quip-feedback',tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quip-feedback-'));
const devices=[[320,568],[390,844],[844,390]];
const state=p=>p.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),approvals:localStorage.getItem(QUIP_CARD_APPROVALS_KEY),reports:localStorage.getItem(QUIP_CARD_REPORTS_KEY)}));
const same=(a,b)=>{for(const k of ['x','y','w','h'])assert.ok(Math.abs(a[k]-b[k])<2,JSON.stringify({a,b,k}));};
async function layoutFixture(page,{phase='play',mode='secret',modified=true}={}){
 await page.evaluate(({phase,mode,modified})=>{
  soundOn=false;window.__now=Date.now();Date.now=()=>window.__now;Math.random=()=>0;
  Object.assign(options,{modes:[mode],difficulty:'easy',complications:modified,dice:false});newGame();game.dice=false;roll();game.dice=true;options.dice=true;
  const c=game.current,card=PARTY_CARDS.find(c=>c.type==='phrase'&&c.text.length>=34&&c.text.length<=48);
  c.word=card.text;c.cardId=card.id;c.visible=true;
  if(mode==='secret')c.methodId='sing';
  c.modifierVersion=2;c.complicationId=modified?'v2-closed-mouth':null;
  c.complication=modified?'Напевай с закрытым ртом, без произнесения слов. Не задерживай дыхание.':'';
  game.phase=phase;c.deadline=phase==='play'?Date.now()+19000:null;c.paused=false;c.remainingMs=null;c.autoStartAt=phase==='countdown'?Date.now()+1000:null;
  persist();render();stopTicking();
 },{phase,mode,modified});
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
}
const geometry=page=>page.evaluate(()=>{
 const box=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,client:el.clientHeight,scroll:el.scrollHeight}};
 const condition=document.querySelector('.round-condition');let copy=null;if(condition){const r=document.createRange();r.selectNodeContents(condition.querySelector('strong'));const b=r.getBoundingClientRect();copy={y:b.y,bottom:b.bottom};}
 return {card:box('.challenge-card'),top:box('.round-top'),condition:box('.round-condition'),copy,timer:box('.timer-ring'),down:box('[data-feedback="report"]'),up:box('[data-feedback="approve"]'),
  actions:[...document.querySelectorAll('.round-bottom--play .round-action')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}}),
  header:[...document.querySelectorAll('#report-card,#timer-pause-control,#exit-game')].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}}),
  page:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},w:innerWidth,h:innerHeight};
});
function fits(g){
 assert.ok(g.page.w<=g.w+1&&g.page.h<=g.h+1,'Page overflow '+JSON.stringify(g));
 assert.ok(g.card.x>=0&&g.card.right<=g.w+1&&g.card.bottom<=g.h,'Card clipped '+JSON.stringify(g));
 if(g.condition){assert.ok(g.condition.scroll<=g.condition.client+1,'Ordinary condition has internal scroll '+JSON.stringify(g));assert.ok(g.copy.y>=g.top.y-1&&g.copy.bottom<=g.top.bottom+1,'Condition clipped '+JSON.stringify(g));}
 for(const b of [...g.actions,...(g.down?[g.down,g.up]:[])])assert.ok(b.w>=44&&b.h>=44&&b.x>=0&&b.right<=g.w&&b.y>=0&&b.bottom<=g.h,'Unreachable action '+JSON.stringify(g));
 for(const b of g.header)assert.ok(b.w>=44&&b.h>=44&&(b.bottom<=g.card.y+1||b.right<=g.card.x||b.x>=g.card.right),'Header overlaps task '+JSON.stringify(g));
 for(const b of g.actions)assert.ok(g.card.bottom<=b.y-3||g.card.right<=b.x||g.card.x>=b.right,'Card overlaps result action '+JSON.stringify(g));
 if(g.down){assert.ok(g.down.right<g.timer.x&&g.up.x>g.timer.right,'Ratings must flank timer '+JSON.stringify(g));for(const b of [g.down,g.up])assert.ok(b.bottom<g.card.y||b.right<g.card.x||b.x>g.card.right,'Ratings collide with task '+JSON.stringify(g));}
}
async function start(page,difficulty='hard',mode='talk'){
 await page.evaluate(({difficulty,mode})=>{
  window.__now=Date.now();Date.now=()=>window.__now;soundOn=false;
  Object.assign(options,{modes:[mode],difficulty,complications:false,dice:false});newGame();game.dice=false;roll();game.dice=true;options.dice=true;persist();render();
 },{difficulty,mode});
 await page.locator('.challenge-card').tap();
 if(difficulty==='easy')await page.locator('[data-action="start-timer"]').click();
 else await page.evaluate(()=>{window.__now+=1001;tick()});
 await page.locator('[data-feedback="report"]').waitFor();
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [width,height]of devices){
   // Same real v79 bundle and same geometry fixture; no modification of source PR.
   const old=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),op=await old.newPage();
   await op.route('**/party-game/**',async route=>{
    const name=new globalThis.URL(route.request().url()).pathname.split('/party-game/')[1]||'index.html';
    if(!/^(?:index\.html|style\.css|[a-z-]+\.js)$/.test(name)){await route.continue();return;}
    const bytes=execFileSync('git',['show',base+':party-game/'+name],{maxBuffer:8e6});
    await route.fulfill({body:bytes,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});
   });
   await op.goto(URL);await provisionProfiles(op);await layoutFixture(op);const before=await geometry(op);await op.screenshot({path:folder+'/before-'+width+'.png',animations:'disabled'});await old.close();
   const ctx=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(URL);await provisionProfiles(page);await layoutFixture(page);const after=await geometry(page);fits(after);
    if(height>width){assert.ok(after.card.y>before.card.y+8,'Card did not move lower');assert.ok(after.card.h>before.card.h+10,'Card did not grow');}
    assert.ok(after.actions.every(b=>b.w<=68.01),'Result circles not compact');
    await page.screenshot({path:folder+'/after-'+width+'.png',animations:'disabled'});
    const card=after.card;
    for(const phase of ['task','countdown','play']){await layoutFixture(page,{phase});const g=await geometry(page);fits(g);same(g.card,card);}
    await layoutFixture(page,{mode:'talk',modified:false});fits(await geometry(page));assert.equal(await page.locator('.judgement-option').count(),2);
    await layoutFixture(page,{mode:'blitz',modified:false});fits(await geometry(page));
    // Three-line ordinary text fits; only exceptional historical text uses the outer fallback.
    await page.evaluate(()=>{game.current.complicationId=null;game.current.complication='После каждой музыкальной фразы сделай паузу на два ровных счёта, затем продолжай.';render()});fits(await geometry(page));
    await page.evaluate(()=>{game.current.complication='Очень длинное сохранённое условие. '.repeat(24);render()});
    assert.equal(await page.locator('.round-condition').evaluate(el=>getComputedStyle(el).overflowY),'visible');
    const fallback=await page.locator('.round-top').evaluate(el=>{el.scrollTop=el.scrollHeight;return{scroll:el.scrollHeight,client:el.clientHeight,at:el.scrollTop}});assert.ok(fallback.scroll>fallback.client&&fallback.at>0,'Historical fallback must be reachable');
    await start(page,'hard');assert.equal(await page.locator('#report-card').isVisible(),false);assert.equal(await page.locator('[data-action="pause"]').isVisible(),false);
    await page.evaluate(()=>{window.__randomCalls=0;const random=Math.random;Math.random=()=>{window.__randomCalls++;return random()}});
    const unvoted=await state(page),item=await page.evaluate(()=>currentReportItem(game));
    await page.locator('[data-feedback="approve"]').tap();await page.locator('[data-feedback="approve"]').tap();
    const voted=await state(page);for(const k of ['game','raw','profiles','reports'])assert.equal(voted[k],unvoted[k],k);assert.equal(JSON.parse(voted.approvals).items.length,1);
    assert.equal(await page.locator('[data-feedback="approve"]').getAttribute('aria-pressed'),'true');
    for(const close of ['Escape','Back','Cancel']){
     const remaining=await page.evaluate(()=>game.current.deadline-Date.now());await page.locator('[data-feedback="report"]').tap();
     assert.equal(await page.locator('#report-title').textContent(),'ПОЧЕМУ НЕ НРАВИТСЯ ЗАДАНИЕ?');assert.equal(await page.locator('#report-comment').isVisible(),true);
     for(const reason of ['error','ambiguous','hard','duplicate','theme','other']){await page.locator('#report-reason').selectOption(reason);assert.equal(await page.locator('#report-comment').isVisible(),true);}
     assert.equal(await page.evaluate(()=>game.current.feedbackHold.remainingMs),remaining);assert.equal(await page.evaluate(()=>game.current.deadline),null);
     await page.evaluate(()=>{window.__now+=5000;tick()});assert.equal(await page.evaluate(()=>game.current.feedbackHold.remainingMs),remaining);
     if(close==='Escape')await page.keyboard.press('Escape');else if(close==='Back')await page.goBack();else await page.locator('#report-cancel').click();
     assert.equal(await page.locator('#report-backdrop').isVisible(),false);assert.equal(await page.evaluate(()=>game.current.deadline-Date.now()),remaining);
     assert.equal(await page.evaluate(()=>document.activeElement.dataset.feedback),'report');assert.equal(await page.evaluate(()=>game.current.paused),false);
    }
    await page.locator('[data-feedback="report"]').tap();await page.locator('#report-reason').selectOption('theme');await page.locator('#report-comment').fill('Комментарий при любой причине');
    page.once('dialog',d=>d.accept());await page.locator('#report-save').click();
    let saved=await state(page);assert.equal(JSON.parse(saved.approvals).items.length,0);assert.equal(JSON.parse(saved.reports).items[0].item.cardId,item.cardId);assert.equal(JSON.parse(saved.reports).items[0].comment,'Комментарий при любой причине');
    assert.equal(saved.profiles,unvoted.profiles);assert.equal(await page.evaluate(()=>window.__randomCalls),0);
    // The held state itself is durable. Reload offline while the dialog is open.
    await page.locator('[data-feedback="report"]').tap();const held=await state(page),remaining=await page.evaluate(()=>game.current.feedbackHold.remainingMs);
    await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();await page.locator('#continue-game').click();
    await page.locator('#report-backdrop').waitFor({state:'visible'});assert.deepEqual(await state(page),held);assert.equal(await page.evaluate(()=>game.current.feedbackHold.remainingMs),remaining);
    await page.locator('#report-close').click();assert.ok(await page.evaluate(remaining=>Math.abs(game.current.deadline-Date.now()-remaining)<300,remaining));assert.equal(await page.evaluate(()=>game.history.length),0);assert.equal(await page.evaluate(()=>document.activeElement.dataset.feedback),'report');
    if(width===390){
     await page.evaluate(()=>{window.__now=Date.now();Date.now=()=>window.__now;Object.assign(options,{modes:['talk'],difficulty:'hard',dice:false});newGame();game.dice=false;roll();game.dice=true;options.dice=true;persist()});
     await page.locator('.challenge-card').tap();await page.evaluate(()=>{stopTicking();window.__now=game.current.autoStartAt+1});
     await page.locator('#report-card').tap();assert.equal(await page.evaluate(()=>game.current.feedbackHold.phase),'play');
     await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.feedback),'report');
    }
    await start(page,'easy');await page.locator('[data-action="pause"]').click();assert.equal(await page.evaluate(()=>game.current.paused),true);
    await page.locator('[data-feedback="report"]').tap();const paused=await state(page);await page.reload();await page.locator('#continue-game').click();assert.deepEqual(await state(page),paused);
    await page.locator('#report-cancel').click();assert.equal(await page.evaluate(()=>game.current.paused),true);assert.equal(await page.evaluate(()=>game.current.deadline),null);
    // Separate Blitz word identities, then share both kinds of feedback offline.
    await start(page,'easy','blitz');await page.locator('[data-feedback="approve"]').tap();const first=await page.evaluate(()=>game.current.cardId);await page.locator('[data-action="blitz-skip"]').click();const second=await page.evaluate(()=>game.current.cardId);assert.notEqual(second,first);
    await page.locator('[data-feedback="report"]').tap();await page.locator('#report-save').click();
    await page.locator('#exit-game').click();await page.locator('#settings-menu').click();
    const protectedBeforeShare=await state(page);
    await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length===1&&files[0].type==='application/json'});Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.__shared=data;return new Promise(resolve=>window.__shareResolve=resolve)}})});
    await page.locator('#feedback-share').click();assert.equal(await page.locator('#feedback-share').isDisabled(),true);assert.ok(!(await page.locator('#toast').textContent()).includes('Файл передан'));
    const shared=await page.evaluate(async()=>JSON.parse(await window.__shared.files[0].text()));assert.equal(shared.kind,'kvip-card-feedback');assert.equal(shared.approvals.version,1);assert.equal(shared.reports.version,1);assert.ok(shared.approvals.items.some(r=>r.item.cardId===first));assert.ok(shared.reports.items.some(r=>r.item.cardId===second));
    await page.evaluate(()=>window.__shareResolve());await page.waitForFunction(()=>!document.getElementById('feedback-share').disabled);assert.deepEqual(await state(page),protectedBeforeShare);
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('cancel','AbortError'))}));await page.locator('#feedback-share').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Передача отменена'));assert.deepEqual(await state(page),protectedBeforeShare);
    await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));await page.locator('#feedback-share').click();
    const event=page.waitForEvent('download');await page.locator('#feedback-download').click();const download=await event,file=path.join(tmp,'feedback-'+width+'.json');await download.saveAs(file);const json=JSON.parse(fs.readFileSync(file));assert.deepEqual(json.approvals,shared.approvals);assert.deepEqual(json.reports,shared.reports);assert.deepEqual(await state(page),protectedBeforeShare);
    assert.deepEqual(errors,[]);console.log('UX/feedback PASS',width,height,'stable card / complete condition / zero-RNG approval / held clock + offline restart / Back + Escape / Web Share + JSON');
   }catch(error){await page.screenshot({path:folder+'/failure-'+width+'.png',animations:'disabled'});throw error;}finally{await ctx.close();}
  }
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
