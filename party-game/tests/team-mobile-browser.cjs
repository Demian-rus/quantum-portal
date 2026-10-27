'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,devices}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs'),{installProbe,summary}=require('../../diagnostics/task029/mobile-perf.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-teams/mobile';
const names=[['ДС','ПА'],['Мама','Папа']];
const snapshot=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
// A format switch stays on page 2. Its end condition must observe the NEW
// format rather than the already visible page used by navigation measurements.
function installFormatProbe(){
 const probe=window.__formatPerf={arm(team,label){if(QuipTeams.active===team)throw Error('Format already selected');probe.wait=new Promise((resolve,reject)=>{probe.pending={team,label,resolve,reject};});}};
 document.addEventListener('pointerdown',event=>{const a=probe.pending;if(!a)return;probe.pending=null;const start=event.timeStamp,timer=setTimeout(()=>a.reject(Error('Format not painted: '+a.label)),30000);
  const poll=()=>{if(QuipTeams.active!==a.team||document.getElementById('team-setup').hidden===a.team||document.getElementById(a.team?'wizard-format-teams':'wizard-format-duel').getAttribute('aria-pressed')!=='true'){requestAnimationFrame(poll);return;}
   const animations=document.getElementById('scene-wizard').getAnimations({subtree:false}).filter(x=>Number.isFinite(x.effect.getTiming().iterations));Promise.all(animations.map(x=>x.finished.catch(()=>{}))).then(()=>requestAnimationFrame(()=>setTimeout(()=>{const end=performance.now();clearTimeout(timer);a.resolve({start,end,ms:end-start,trusted:event.isTrusted,pointer:event.pointerType});},0)));
  };requestAnimationFrame(poll);
 },true);
}
async function geometry(p){
 const g=await p.evaluate(()=>{const r=n=>{const a=n.getBoundingClientRect();return {x:a.x,y:a.y,right:a.right,bottom:a.bottom,w:a.width,h:a.height};};return {width:innerWidth,height:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,footer:r(document.querySelector('.wizard-footer')),fields:[...document.querySelectorAll('#team-setup input')].map(r),buttons:[...document.querySelectorAll('#scene-wizard button:not(:disabled)')].filter(n=>n.getClientRects().length).map(r)};});
 assert(g.sw<=g.width+1&&g.sh<=g.height+1,'one local scroll plane');assert(g.footer.bottom<=g.height+1);assert(g.buttons.every(n=>n.w>=44&&n.h>=44));assert(g.fields.every(n=>n.w>=44&&n.h>=44&&n.x>=0&&n.right<=g.width+1));return g;
}
(async()=>{fs.mkdirSync(folder,{recursive:true});const results=[],browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const [width,height]of [[320,568],[390,844],[412,915],[844,390]]){
  const ctx=await browser.newContext({...devices['Pixel 7'],viewport:{width,height},screen:{width,height},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,serviceWorkers:'allow'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(installProbe);await p.addInitScript(installFormatProbe);
  try{const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await p.goto(URL);await provisionProfiles(p);await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
   for(const offline of [false,true]){
    await ctx.setOffline(offline);await p.goto(URL+'?setup=legacy');await p.waitForFunction(()=>!!window.QuipTeams&&!document.getElementById('wizard-format-teams').disabled);
    const environment=await p.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,ua:navigator.userAgent,coarse:matchMedia('(pointer: coarse)').matches,noHover:matchMedia('(hover: none)').matches,touches:navigator.maxTouchPoints,worker:!!navigator.serviceWorker.controller}));
    environment.browserVersion=browser.version();assert.equal(environment.width,width);assert.equal(environment.height,height);assert.equal(environment.dpr,2.625);assert(/Android/.test(environment.ua)&&environment.coarse&&environment.noHover&&environment.touches>0);if(offline)assert(environment.worker);
    await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();const saved=await snapshot(p);
    await p.locator('#wizard-format-teams').tap();for(let t=0;t<2;t++)for(let n=0;n<2;n++)await p.locator('#team-name-'+t+'-'+n).fill(names[t][n]);
    await p.locator('[data-wizard-step="4"]').tap();assert.equal(await p.locator('#start-game').isDisabled(),false);assert.match(await p.locator('#wizard-summary').textContent(),/ДС.*ПА.*Мама.*Папа/);await p.locator('[data-wizard-step="2"]').tap();const g=await geometry(p);
    await p.screenshot({path:folder+'/'+width+'-'+(offline?'offline':'network')+'.png'});
    await p.evaluate(()=>{window.__teamChecks=0;window.__teamPools=0;const check=checkContentPack,pool=getPackCardPool;checkContentPack=function(...args){__teamChecks++;return check.apply(this,args)};getPackCardPool=function(...args){__teamPools++;return pool.apply(this,args)};renderOptions();__teamChecks=0;__teamPools=0;});
    // Names cannot change catalog availability, and duplicate names still block START.
    await p.locator('#team-name-1-1').fill('ДС');assert.equal(await p.locator('#start-game').isDisabled(),true);await p.locator('#team-name-1-1').fill(names[1][1]);assert.equal(await p.locator('#start-game').isDisabled(),false);
    const transitions=[['players_rules','#wizard-next','rules'],['rules_start','#wizard-next','start'],['start_rules','#wizard-back','rules'],['rules_players','#wizard-back','players'],['players_catalog','#wizard-back','catalog'],['catalog_players','#standard-game','players']],rows=[];
    for(let i=-1;i<20;i++)for(const [label,selector,target]of transitions){await p.locator(selector).scrollIntoViewIfNeeded();await p.evaluate(a=>__perf29.arm(...a),['wizard',target,label]);await p.locator(selector).tap();const row=await p.evaluate(()=>__perf29.wait);assert(row.trusted&&row.pointer==='touch');if(i>=0)rows.push({label,...row});}
    assert.equal(await p.evaluate(()=>__teamChecks),0,'clean team navigation and name edits repeat no catalog validation');assert.equal(await p.evaluate(()=>__teamPools),0,'clean team navigation rebuilds no pools');
    const toggles=[];for(let i=-1;i<20;i++)for(const [label,selector,team]of [['teams_duel','#wizard-format-duel',false],['duel_teams','#wizard-format-teams',true]]){
     await p.locator(selector).scrollIntoViewIfNeeded();await p.evaluate(a=>__formatPerf.arm(...a),[team,label]);await p.locator(selector).tap();const row=await p.evaluate(()=>__formatPerf.wait);assert(row.trusted&&row.pointer==='touch');assert.equal(await p.evaluate(()=>QuipTeams.active),team);assert.equal(await p.locator(selector).getAttribute('aria-pressed'),'true');if(i>=0)toggles.push({label,...row});
    }
    for(let t=0;t<2;t++)for(let n=0;n<2;n++)assert.equal(await p.locator('#team-name-'+t+'-'+n).inputValue(),names[t][n]);
    assert.deepEqual(await snapshot(p),saved,'format and navigation cannot write duel/profiles/team slots');assert.equal(await p.locator('#wizard-legacy,#setup-interface-toggle').count(),0);assert.equal(new globalThis.URL(p.url()).searchParams.has('setup'),false);
    const stats=Object.fromEntries([...new Set([...rows,...toggles].map(r=>r.label))].map(label=>[label,summary([...rows,...toggles].filter(r=>r.label===label),'ms')]));
    results.push({viewport:{width,height},cpu:4,offline,environment,geometry:g,stats,rows,toggles});fs.writeFileSync(folder+'/measurements.json',JSON.stringify(results,null,2));
    for(const [label,s]of Object.entries(stats)){assert.equal(s.n,20);assert(s.median<=200,label+' median '+JSON.stringify(s));assert(s.p95<=350,label+' p95 '+JSON.stringify(s));}assert.deepEqual(errors,[]);console.log('TASK028 Android teams',width,height,offline?'offline':'network',JSON.stringify(stats));
   }
  }catch(e){await p.screenshot({path:folder+'/'+width+'-failure.png'}).catch(()=>{});throw e;}finally{await ctx.close();}
 }}finally{await browser.close();}
 console.log('TASK028 Android CPU4 trusted touch n20 / four sizes / offline / format switching / no repeated validation PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
