'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,devices}=require('playwright-core');
const {installProbe,summary}=require('../../diagnostics/task029/mobile-perf.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-teams/catalog-counts';
async function expected(p){return p.evaluate(()=>{const latest=new Map();for(const pack of Object.values(QUIP_CONTENT_PACKS))if(!latest.has(pack.id)||pack.version>latest.get(pack.id).version)latest.set(pack.id,pack);return {general:new Set(latest.get('general').criteria.cardIds).size,themes:listThematicPacks(options).map(e=>({id:e.pack.id,available:e.available&&e.pack.enabled,count:new Set(e.pack.criteria.cardIds).size}))};});}
async function visibleText(p,selector,parent){
 assert.equal(await p.locator(selector).count(),1,'unique counter '+selector);await p.locator(selector).waitFor({state:'visible'});
 const g=await p.locator(selector).evaluate((node,parent)=>{
  const r=n=>{const a=n.getBoundingClientRect();return {x:a.x,y:a.y,right:a.right,bottom:a.bottom,width:a.width,height:a.height};},box=r(node),card=r(node.closest(parent)),scroll=r(document.getElementById('wizard-scroll')),style=getComputedStyle(node),range=document.createRange();range.selectNodeContents(node);
  const text=[...range.getClientRects()].map(a=>({x:a.x,y:a.y,right:a.right,bottom:a.bottom,width:a.width,height:a.height}));
  const clear=text.every(a=>[[a.x+1,a.y+a.height/2],[a.right-1,a.y+a.height/2],[(a.x+a.right)/2,a.y+a.height/2]].every(([x,y])=>{const top=document.elementFromPoint(x,y);return top&&(node===top||node.contains(top));}));
  return {box,card,scroll,text,clear,font:parseFloat(style.fontSize),opacity:style.opacity,color:style.color,textContent:node.textContent,ariaHidden:!!node.closest('[aria-hidden="true"]'),width:innerWidth,height:innerHeight};
 },parent);
 assert(g.text.length>0&&g.font>=12&&+g.opacity>0&&!g.ariaHidden,'readable accessible text '+JSON.stringify(g));assert(g.clear,'counter is not covered '+JSON.stringify(g));
 for(const a of g.text){assert(a.x>=g.card.x&&a.right<=g.card.right+.5&&a.y>=g.card.y&&a.bottom<=g.card.bottom+.5,'inside its card');assert(a.x>=0&&a.right<=g.width&&a.y>=g.scroll.y&&a.bottom<=g.scroll.bottom+.5,'visible without clipping '+JSON.stringify(g));}return g;
}
async function catalog(p,data){
 const a=await visibleText(p,'#standard-content-count','#standard-game'),b=await visibleText(p,'#thematic-content-count','#thematic-game');
 assert.equal(a.textContent,data.general.toLocaleString('ru-RU')+' заданий');const sum=data.themes.filter(t=>t.available).reduce((n,t)=>n+t.count,0);assert.equal(b.textContent,sum.toLocaleString('ru-RU')+' заданий');return {standard:a,thematic:b};
}
(async()=>{fs.mkdirSync(folder,{recursive:true});const results=[],browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{for(const [width,height]of [[320,568],[390,844],[412,915],[844,390]]){
  const ctx=await browser.newContext({...devices['Pixel 7'],viewport:{width,height},screen:{width,height},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,serviceWorkers:'allow'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(installProbe);
  try{const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   for(const offline of [false,true]){
    if(!offline){await p.goto(URL);await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);}await ctx.setOffline(offline);await p.goto(URL);
    const data=await expected(p),rows=[];let cold;await p.evaluate(()=>{window.catalogChecks=0;window.catalogPools=0;const check=checkContentPack,pool=getPackCardPool;checkContentPack=function(...args){catalogChecks++;return check.apply(this,args)};getPackCardPool=function(...args){catalogPools++;return pool.apply(this,args)};});
    // Include the very first entry after reload, then n20 warm entries. A cold
    // catalog may compute once; repeated entry must reuse its preview snapshot.
    for(let i=-1;i<20;i++){await p.evaluate(()=>__perf29.arm('wizard','catalog','home_catalog'));await p.locator('#new-game-menu').tap();const row=await p.evaluate(()=>__perf29.wait);assert(row.trusted&&row.pointer==='touch');assert(row.ms<=350,'first/catalog entry budget '+row.ms);if(i>=0)rows.push(row);if(i===-1){cold=row;await catalog(p,data);await p.evaluate(()=>{catalogChecks=0;catalogPools=0;});}if(i<19)await p.locator('#wizard-back').tap();}
    assert.equal(await p.evaluate(()=>catalogChecks),0,'warm entry never revalidates theme catalogs');assert.equal(await p.evaluate(()=>catalogPools),0,'warm entry rebuilds no pools');const stats=summary(rows,'ms');assert(stats.median<=200&&stats.p95<=350,JSON.stringify(stats));const geometry=await catalog(p,data);await p.screenshot({path:folder+'/'+width+'-'+(offline?'offline':'network')+'-catalog.png'});
    await p.locator('#thematic-game').tap();for(const t of data.themes){const button=p.locator('[data-theme="'+t.id+'"]');assert.equal(await button.isEnabled(),t.available);assert.equal(await button.locator('span').textContent(),t.available?t.count.toLocaleString('ru-RU'):'Скоро');if(t.available){await button.scrollIntoViewIfNeeded();await visibleText(p,'[data-theme="'+t.id+'"] span','.theme-choice');}}
    await p.locator('#wizard-scroll').evaluate(n=>n.scrollTop=0);await p.screenshot({path:folder+'/'+width+'-'+(offline?'offline':'network')+'-themes.png'});await p.locator('#wizard-back').tap();await catalog(p,data);await p.reload();await p.locator('#new-game-menu').tap();await catalog(p,data);assert.deepEqual(errors,[]);
    results.push({width,height,cpu:4,offline,browserVersion:browser.version(),data,stats,cold,rows,geometry});fs.writeFileSync(folder+'/measurements.json',JSON.stringify(results,null,2));console.log('Catalog counters Android',width,height,offline?'offline':'network',JSON.stringify({general:data.general,thematic:data.themes.filter(t=>t.available).reduce((n,t)=>n+t.count,0),stats}));
   }
  }catch(e){await p.screenshot({path:folder+'/'+width+'-failure.png'}).catch(()=>{});throw e;}finally{await ctx.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
