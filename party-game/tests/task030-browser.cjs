'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium,devices}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs');
const {installProbe,summary}=require('../../diagnostics/task029/mobile-perf.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-task030';
const mobile=viewport=>({...devices['Pixel 7'],viewport,screen:viewport,deviceScaleFactor:2.625,isMobile:true,hasTouch:true,serviceWorkers:'allow'});
const snap=p=>p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),game:JSON.stringify(game),memory:JSON.stringify(taskMemory)}));
async function sole(p){
 assert.equal(new globalThis.URL(p.url()).searchParams.has('setup'),false,'obsolete setup query removed');
 assert.equal(await p.locator('#wizard-legacy,#setup-interface-toggle').count(),0,'switches removed from DOM');
 for(const id of ['game-type','themes','setup','advanced'])assert.equal(await p.locator('#scene-'+id).isVisible(),false,'internal shell is not a navigation destination: '+id);
}
async function step(p,n){await p.locator('[data-wizard-step="'+n+'"]').tap();await p.locator('[data-wizard-page="'+n+'"]:visible').waitFor();await sole(p);}
async function geometry(p){
 const g=await p.evaluate(()=>{const rect=n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,scroll:rect($('wizard-scroll')),steps:rect(document.querySelector('.wizard-steps')),footer:rect(document.querySelector('.wizard-footer')),targets:[...document.querySelectorAll('#scene-wizard button:not(:disabled)')].filter(n=>n.getClientRects().length).map(rect)}});
 assert(g.sw<=g.w+1&&g.sh<=g.h+1,'single local scroll plane '+JSON.stringify(g));assert(g.scroll.top>=g.steps.bottom-1&&g.scroll.bottom<=g.footer.top+1&&g.footer.bottom<=g.h+1);assert(g.targets.every(n=>n.width>=44&&n.height>=44));return g;
}
(async()=>{
 fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']}),results=[];
 try{for(const [width,height]of [[320,568],[390,844],[412,915],[844,390]]){
  const ctx=await browser.newContext(mobile({width,height})),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(installProbe);
  try{
   const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   for(const query of ['', '?setup=legacy','?setup=wizard','?keep=value&setup=legacy&setup=wizard#bookmark']){
    await p.goto(URL+query);await sole(p);if(query.includes('keep=')){assert.equal(new globalThis.URL(p.url()).searchParams.get('keep'),'value');assert.equal(new globalThis.URL(p.url()).hash,'#bookmark');}
    await provisionProfiles(p);await p.locator('#new-game-menu').tap();await p.locator('#wizard-catalog:visible').waitFor();await sole(p);await geometry(p);await p.locator('#standard-game').tap();
    for(const n of [2,3,4]){await step(p,n);await geometry(p);}
    const before=await snap(p);await p.goBack();await p.locator('[data-wizard-page="3"]:visible').waitFor();await sole(p);assert.deepEqual(await snap(p),before,'Android Back is presentation-only');
    await p.goForward();await sole(p);assert.deepEqual(await snap(p),before,'Forward cannot enable a legacy route');
    await p.reload();await sole(p);assert.deepEqual(await snap(p),before,'Reload preserves data');
   }
   await p.locator('#settings-menu').tap();assert.equal(await p.locator('#setup-interface-toggle').count(),0);const sound=await p.locator('#sound-toggle').isChecked();await p.locator('#sound-toggle').setChecked(!sound);await p.locator('#preferences-back').tap();
   await p.locator('#new-game-menu').tap();await p.locator('#thematic-game').tap();await p.locator('[data-theme="geography"]:enabled').tap();await step(p,3);assert.equal(await p.locator('#mode-toggles input[value="sing"]').isDisabled(),true);await step(p,2);await p.locator('#wizard-back').tap();await p.locator('#standard-game').tap();await step(p,3);
   await p.locator('#wizard-mode-settings').tap();assert.equal(await p.locator('[data-wizard-rule]').count(),8);await p.locator('[data-song-language="en"]').tap();assert.deepEqual(await p.evaluate(()=>options.modeSettings.sing.songLanguages),['ru','en']);await p.goBack();await p.locator('#wizard-mode-settings:visible').waitFor();assert.equal(await p.evaluate(()=>document.activeElement.id),'wizard-mode-settings');await step(p,2);
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   for(const offline of [false,true]){
    await ctx.setOffline(offline);await p.goto(URL+'?setup=legacy');await sole(p);await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();
    const env=await p.evaluate(()=>({innerWidth,innerHeight,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},dpr:devicePixelRatio,ua:navigator.userAgent,coarse:matchMedia('(pointer: coarse)').matches,noHover:matchMedia('(hover: none)').matches,touches:navigator.maxTouchPoints,worker:!!navigator.serviceWorker.controller}));
    env.browserVersion=browser.version();env.isMobile=true;env.hasTouch=true;assert.equal(env.innerWidth,width);assert.equal(env.innerHeight,height);assert.equal(env.dpr,2.625);assert(/Android/.test(env.ua)&&env.coarse&&env.noHover&&env.touches>0);if(offline)assert(env.worker);
    await p.screenshot({path:folder+'/'+width+'-'+(offline?'offline':'network')+'.png'});
    await p.evaluate(()=>{window.__original030=checkContentPack;window.__calls030=0;checkContentPack=function(...a){__calls030++;return __original030(...a)};renderOptions();__calls030=0;});
    const transitions=[['players_rules','#wizard-next','rules'],['rules_start','#wizard-next','start'],['start_rules','#wizard-back','rules'],['rules_players','#wizard-back','players'],['players_catalog','#wizard-back','catalog'],['catalog_players','#standard-game','players']],rows=[];
    for(let i=-1;i<20;i++)for(const [label,selector,target]of transitions){await p.locator(selector).scrollIntoViewIfNeeded();await p.evaluate(a=>__perf29.arm(...a),['wizard',target,label]);await p.locator(selector).tap();const row=await p.evaluate(()=>__perf29.wait);assert(row.trusted&&row.pointer==='touch');if(i>=0)rows.push({label,...row});}
    assert.equal(await p.evaluate(()=>__calls030),0,'TASK029 zero repeated validation invariant remains');const stats=Object.fromEntries(transitions.map(([label])=>[label,summary(rows.filter(r=>r.label===label),'ms')]));for(const [label,s]of Object.entries(stats)){assert(s.median<=200,label+' median '+JSON.stringify(s));assert(s.p95<=350,label+' p95 '+JSON.stringify(s));}
    results.push({viewport:{width,height},cpu:4,offline,environment:env,stats,rows});fs.writeFileSync(folder+'/mobile.json',JSON.stringify(results,null,2));console.log('TASK030 Android',width,height,offline?'offline':'network',JSON.stringify(stats));
   }
   await step(p,4);await p.locator('#start-game').tap();assert.equal(await p.evaluate(()=>game.phase),'ready');const saved=await snap(p);await p.reload();await p.locator('#continue-game').tap();assert.deepEqual(await snap(p),saved,'Real START and cold offline restore preserve exact duel');assert.deepEqual(errors,[]);
  }catch(e){await p.screenshot({path:folder+'/'+width+'-failure.png'}).catch(()=>{});throw e;}finally{await ctx.close();}
 }}finally{await browser.close();}
 // Close the browser process and reopen its persistent PWA profile offline.
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kvip030-'));let ctx;
 try{
  const launch=()=>chromium.launchPersistentContext(dir,{...mobile({width:390,height:844}),headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
  ctx=await launch();let p=ctx.pages()[0];await p.goto(URL+'?setup=legacy');await provisionProfiles(p);await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();await step(p,4);await p.locator('#start-game').tap();const saved=await snap(p);await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.close();ctx=await launch();await ctx.setOffline(true);p=ctx.pages()[0];await p.goto(URL+'?setup=legacy');await sole(p);await p.locator('#continue-game').tap();assert.deepEqual(await snap(p),saved,'Browser process restart offline preserves exact saved party');await p.locator('#exit-game').tap();await p.locator('#new-game-menu').tap();await p.locator('#wizard-catalog:visible').waitFor();await sole(p);
 }finally{if(ctx)await ctx.close();fs.rmSync(dir,{recursive:true,force:true});}
 console.log('TASK030 sole route / all URL and history paths / restart offline / Android touch CPU4 n20 performance PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
