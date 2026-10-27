'use strict';
// Diagnostic-only: serves immutable production files, uses trusted Android taps.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium,devices}=require('playwright-core');
const BASE='8dd989f4017fa48d4279f243d13012ade1710a63',ROOT=path.resolve(__dirname,'../..');
const N=Number(process.env.PERF_REPEATS||20),PILOT=process.env.PERF_PILOT==='1',WIDTH=Number(process.env.PERF_WIDTH||390);
const heights={320:568,390:844,412:915,844:390},out=path.resolve('artifacts/task029',PILOT?'pilot':String(WIDTH));
const git=(...args)=>execFileSync('git',args,{cwd:ROOT});
const quant=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.ceil(a.length*p)-1)];
function summary(rows,key){const v=rows.map(r=>r[key]);return {n:v.length,median:+quant(v,.5).toFixed(2),p95:+quant(v,.95).toFixed(2),max:+Math.max(...v).toFixed(2)};}
async function serve(root){const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
 const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(b);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,origin:'http://127.0.0.1:'+server.address().port};}
// This instrumentation runs via addInitScript, never changes a runtime source.
function installProbe(){
 const state=window.__perf29={long:[],events:[],samples:[],serial:0};
 const collect=(type,list)=>{for(const e of list)state[type].push({name:e.name,start:e.startTime,duration:e.duration,processing:e.processingEnd-e.processingStart,interactionId:e.interactionId});};
 const observers=[];for(const type of ['longtask','event'])try{const ob=new PerformanceObserver(list=>collect(type==='longtask'?'long':'events',list.getEntries()));ob.observe(type==='event'?{type,durationThreshold:16}:{type});observers.push([ob,type]);}catch{}
 const shown=id=>{const el=document.getElementById(id);return el&&!el.hidden;};
 function ready(route,target){
  if(target==='home')return shown('scene-home');
  if(route==='wizard'){
   if(!shown('scene-wizard'))return false;
   if(target==='center')return shown('wizard-rules');
   const page={catalog:1,themes:1,players:2,rules:3,start:4}[target];
   return document.querySelector('[data-wizard-page="'+page+'"]')?.hidden===false&&
    !shown('wizard-rules')&&(page!==1||shown('wizard-themes')===(target==='themes'));
  }
  if(target==='center')return shown('mode-options-backdrop');
  if(target==='expanded')return shown('scene-advanced')&&document.getElementById('mode-settings').open;
  return shown('scene-'+({catalog:'game-type',players:'setup',rules:'advanced',themes:'themes'}[target]));
 }
 state.arm=(route,target,label)=>{
  const id='kvip29:'+ ++state.serial+':'+label;let resolve,reject;
  state.wait=new Promise((a,b)=>{resolve=a;reject=b;});
  state.armed={route,target,id,resolve,reject};
 };
 document.addEventListener('pointerdown',event=>{
  const a=state.armed;if(!a)return;state.armed=null;
  const start=event.timeStamp;performance.mark(a.id+':start');
  const timer=setTimeout(()=>a.reject(Error('Target not painted: '+a.id)),30000);
  const poll=()=>{
   if(!ready(a.route,a.target)){requestAnimationFrame(poll);return;}
   const root=document.getElementById(a.target==='home'?'scene-home':a.route==='wizard'?'scene-wizard':a.target==='center'?'mode-options-backdrop':'scene-'+({catalog:'game-type',players:'setup',rules:'advanced',themes:'themes',expanded:'advanced'}[a.target]));
   const animations=root.getAnimations({subtree:false}).filter(x=>Number.isFinite(x.effect.getTiming().iterations));
   Promise.all(animations.map(x=>x.finished.catch(()=>{}))).then(()=>requestAnimationFrame(()=>setTimeout(()=>{
    for(const [ob,type]of observers)collect(type==='longtask'?'long':'events',ob.takeRecords());
    const end=performance.now();performance.mark(a.id+':end');clearTimeout(timer);
    const tasks=state.long.filter(x=>x.start<end&&x.start+x.duration>start);
    const interactions=state.events.filter(x=>x.start>=start-1&&x.start<=end);
    a.resolve({id:a.id,start,end,ms:end-start,trusted:event.isTrusted,pointer:event.pointerType,longTasks:tasks.length,longMs:tasks.reduce((s,x)=>s+x.duration,0),blockingMs:tasks.reduce((s,x)=>s+Math.max(0,x.duration-50),0),eventTiming:interactions});
   },0)));
  };requestAnimationFrame(poll);
 },true);
}
const wizard=[['home_catalog','#new-game-menu','catalog'],['catalog_players','#standard-game','players'],['players_rules','#wizard-next','rules'],['rules_modes','#wizard-mode-settings','center'],['modes_rules','#wizard-rules-done','rules'],['rules_start','#wizard-next','start'],['start_rules_back','#wizard-back','rules'],['rules_players_back','#wizard-back','players'],['players_catalog_back','#wizard-back','catalog'],['catalog_themes','#thematic-game','themes'],['themes_players','#theme-list [data-theme="geography"]:enabled','players'],['theme_players_catalog_back','#wizard-back','catalog'],['catalog_themes_again','#thematic-game','themes'],['themes_catalog_back','#wizard-back','catalog'],['catalog_standard_switch','#standard-game','players'],['standard_players_catalog_back','#wizard-back','catalog'],['catalog_home_back','#wizard-back','home']];
const legacy=[['home_catalog','#new-game-menu','catalog'],['catalog_players','#standard-game','players'],['players_rules','#go-advanced','rules'],['rules_expand','#mode-settings > summary','expanded'],['rules_modes','[data-mode-settings="sing"]','center'],['modes_rules','#mode-options-done','rules'],['rules_players_back','#advanced-back','players'],['players_catalog_back','#setup-back','catalog'],['catalog_themes','#thematic-game','themes'],['themes_players','#theme-list [data-theme="geography"]:enabled','players'],['theme_players_themes_back','#setup-back','themes'],['themes_catalog_back','#themes-back','catalog'],['catalog_standard_switch','#standard-game','players'],['standard_players_catalog_back','#setup-back','catalog'],['catalog_home_back','#game-type-back','home']];
async function metrics(cdp){return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));}
async function cycle(page,cdp,route,rows,meta){
 for(const [label,selector,target]of route==='wizard'?wizard:legacy){
  const button=page.locator(selector);await button.scrollIntoViewIfNeeded();
  const before=await metrics(cdp);await page.evaluate(args=>__perf29.arm(...args),[route,target,label]);
  await button.tap();const sample=await page.evaluate(()=>__perf29.wait),after=await metrics(cdp);
  assert(sample.trusted&&sample.pointer==='touch','must measure a real trusted touch, not a click or evaluate call');
  for(const key of ['ScriptDuration','RecalcStyleDuration','LayoutDuration','TaskDuration'])sample[key]=(after[key]-before[key])*1000;
  rows.push({...meta,label,...sample});
 }
}
async function traceStart(cdp){await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,cc',transferMode:'ReturnAsStream'});}
async function traceStop(cdp,file,rows){
 const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await done;let data='';
 while(true){const r=await cdp.send('IO.read',{handle:stream});data+=r.base64Encoded?Buffer.from(r.data,'base64').toString():r.data;if(r.eof)break;}await cdp.send('IO.close',{handle:stream});fs.writeFileSync(file,data);
 const events=JSON.parse(data).traceEvents,marks=new Map(events.filter(e=>e.name?.startsWith('kvip29:')).map(e=>[e.name,e]));
 for(const row of rows){const a=marks.get(row.id+':start'),b=marks.get(row.id+':end');if(!a||!b)continue;const selected=events.filter(e=>e.ph==='X'&&e.ts<b.ts&&e.ts+(e.dur||0)>a.ts);
  row.trace={};for(const name of ['UpdateLayoutTree','RecalculateStyles','Layout','Paint','RasterTask','Layerize','CompositeLayers','Decode Image']){const hits=selected.filter(e=>e.name===name&&(name==='RasterTask'||name==='Decode Image'||e.tid===a.tid));row.trace[name]={count:hits.length,ms:hits.reduce((s,e)=>s+Math.max(0,Math.min(e.ts+e.dur,b.ts)-Math.max(e.ts,a.ts))/1000,0)};}
 }
}
async function attribution(page,cdp,file,route){
 await page.evaluate(()=>{window.__cost29={};window.__original29={};for(const name of ['checkContentPack','packModeAvailability','getPackCardPool','getPackQuestionPool','secretMethodsForPack','renderProfileSelectors','selectedPlayerProfiles','renderModeSettings','listThematicPacks']){const fn=window[name];if(typeof fn!=='function')continue;__original29[name]=fn;window[name]=function(...args){const start=performance.now();try{return fn.apply(this,args);}finally{const r=__cost29[name]||(__cost29[name]={calls:0,ms:0,max:0});const d=performance.now()-start;r.calls++;r.ms+=d;r.max=Math.max(r.max,d);}};}
  window.__mutations29={total:0,hidden:0};window.__observer29=new MutationObserver(list=>{__mutations29.total+=list.length;__mutations29.hidden+=list.filter(m=>m.target.nodeType===1&&m.target.closest('[hidden]')).length;});__observer29.observe(document.body,{attributes:true,childList:true,subtree:true,characterData:true});
 });
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');await traceStart(cdp);
 const rows=[];await cycle(page,cdp,route,rows,{attribution:true});
 const {profile}=await cdp.send('Profiler.stop');await traceStop(cdp,file+'.trace.json',rows);fs.writeFileSync(file+'.cpuprofile',JSON.stringify(profile));
 const costs=await page.evaluate(()=>{__observer29.disconnect();const result={costs:__cost29,mutations:__mutations29};for(const [name,fn]of Object.entries(__original29))window[name]=fn;return result;});
 const byId=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of profile.nodes)for(const id of n.children||[])parent.set(id,n.id);
 const hits=new Map();for(let i=0;i<(profile.samples||[]).length;i++){let id=profile.samples[i];const ms=profile.timeDeltas[i]/1000;for(let depth=0;id&&depth<100;depth++,id=parent.get(id)){const n=byId.get(id),key=n.callFrame.functionName+' @ '+n.callFrame.url.split('/').pop()+':'+(n.callFrame.lineNumber+1);hits.set(key,(hits.get(key)||0)+ms);}}
 return {...costs,rows,cpuInclusive:[...hits].sort((a,b)=>b[1]-a[1]).slice(0,30)};
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kvip29-')),archive=path.join(tmp,'baseline.tar');git('archive','--format=tar','--output='+archive,BASE,'party-game');execFileSync('tar',['-xf',archive,'-C',tmp]);fs.unlinkSync(archive);
 const before=await serve(tmp),candidate=await serve(ROOT),changed=git('diff','--name-only',BASE,'HEAD','--','party-game').toString().trim();
 const variants=changed?[{name:'before',...before},{name:'after',...candidate}]:[{name:'before',...before}];
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const version=browser.version(),ua='Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/'+version+' Mobile Safari/537.36';
 const report={base:BASE,head:git('rev-parse','HEAD').toString().trim(),version,physicalAndroid:false,hardware:{cpu:os.cpus()[0]?.model,logicalCores:os.cpus().length},definition:'Trusted pointerdown timestamp to correct DOM + finite root animation + subsequent animation frame and after-paint task. Includes JS/style/layout/paint and frame scheduling, excludes Playwright pre-tap actionability/scroll. Cold = reloaded document/JS realm, not OS restart. Traces instrument representative cycles; timing cycles have no source wrappers or CPU profiler.',cases:[]};
 try{
  try{const session=await browser.newBrowserCDPSession();const info=await session.send('SystemInfo.getInfo');report.gpu={devices:info.gpu.devices,auxAttributes:info.gpu.auxAttributes};await session.detach();}catch(e){report.gpu={unavailable:e.message};}
  let seed;
  {const ctx=await browser.newContext({...devices['Pixel 7'],userAgent:ua,isMobile:true,hasTouch:true,serviceWorkers:'allow'});const p=await ctx.newPage();await p.goto(before.origin+'/party-game/?setup=wizard');await require('../../party-game/tests/profile-fixtures.cjs').provisionProfiles(p);seed=(await ctx.storageState()).origins[0].localStorage;await ctx.close();}
  const configs=PILOT?[{cpu:4,cache:'network',heat:'warm',route:'wizard'},{cpu:4,cache:'network',heat:'warm',route:'legacy'}]:[1,4].flatMap(cpu=>['network','pwa-offline'].flatMap(cache=>['cold','warm'].flatMap(heat=>['wizard','legacy'].map(route=>({cpu,cache,heat,route}))))).filter(c=>(!process.env.PERF_CPU||c.cpu===Number(process.env.PERF_CPU))&&(!process.env.PERF_CACHE||c.cache===process.env.PERF_CACHE));
  for(const config of configs)for(const variant of variants){
   const tag=[variant.name,WIDTH,config.cpu,config.cache,config.heat,config.route].join('-'),ctx=await browser.newContext({...devices['Pixel 7'],viewport:{width:WIDTH,height:heights[WIDTH]},screen:{width:WIDTH,height:heights[WIDTH]},deviceScaleFactor:2.625,userAgent:ua,isMobile:true,hasTouch:true,serviceWorkers:'allow',storageState:{cookies:[],origins:[{origin:variant.origin,localStorage:seed}]}});
   const page=await ctx.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(installProbe);
   const cdp=await ctx.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:config.cpu});await cdp.send('Network.setBypassServiceWorker',{bypass:config.cache==='network'});await cdp.send('Network.setCacheDisabled',{cacheDisabled:config.cache==='network'});
   const requests=[];page.on('response',r=>requests.push({url:r.url().replace(variant.origin,''),worker:r.fromServiceWorker(),status:r.status()}));
   const url=variant.origin+'/party-game/?setup='+config.route,rows=[],startups=[];
   try{
    await page.goto(url);await page.waitForFunction(()=>typeof activeScene!=='undefined'&&activeScene==='home');
    if(config.cache==='pwa-offline'){await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();}
    const initialStartup=await page.evaluate(()=>({ready:performance.now(),navigation:performance.getEntriesByType('navigation')[0].toJSON(),paint:performance.getEntriesByType('paint').map(e=>e.toJSON())}));
    const environment=await page.evaluate(()=>({innerWidth,innerHeight,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},devicePixelRatio,ua:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hoverNone:matchMedia('(hover: none)').matches,mobileLayout:matchMedia('(max-width: 779px)').matches,shortLandscape:matchMedia('(max-height: 480px)').matches,screen:{width:screen.width,height:screen.height,orientation:screen.orientation.type},worker:!!navigator.serviceWorker.controller,backdrop:getComputedStyle(document.getElementById('scene-wizard')).backdropFilter}));
    assert.equal(environment.innerWidth,WIDTH);assert.equal(environment.innerHeight,heights[WIDTH]);assert.equal(environment.devicePixelRatio,2.625);assert(environment.coarse&&environment.hoverNone&&environment.maxTouchPoints>0&&/Android/.test(environment.ua));
    fs.writeFileSync(path.join(out,tag+'-environment.json'),JSON.stringify({...environment,...config,isMobile:true,hasTouch:true},null,2));await page.screenshot({path:path.join(out,tag+'-before.png')});
    await page.locator('#new-game-menu').tap();await page.screenshot({path:path.join(out,tag+'-mobile-catalog.png')});await page.locator(config.route==='wizard'?'#wizard-back':'#game-type-back').tap();
    if(config.heat==='warm')await cycle(page,cdp,config.route,[],{warmup:true});
    for(let repeat=0;repeat<N;repeat++){
     if(config.heat==='cold'){await page.reload();await page.waitForFunction(()=>typeof activeScene!=='undefined'&&activeScene==='home');}
     if(config.heat==='warm'){if(repeat===0)startups.push(initialStartup);}else startups.push(await page.evaluate(()=>({ready:performance.now(),navigation:performance.getEntriesByType('navigation')[0].toJSON(),paint:performance.getEntriesByType('paint').map(e=>e.toJSON())})));
     await cycle(page,cdp,config.route,rows,{repeat});
    }
    const representative=[];await traceStart(cdp);await cycle(page,cdp,config.route,representative,{representative:true});await traceStop(cdp,path.join(out,tag+'.trace.json'),representative);
    const grouped=Object.fromEntries([...new Set(rows.map(r=>r.label))].map(label=>{const r=rows.filter(x=>x.label===label);return [label,Object.fromEntries(['ms','ScriptDuration','RecalcStyleDuration','LayoutDuration','TaskDuration','longMs','blockingMs'].map(key=>[key,summary(r,key)]))];}));
    let detail;if(PILOT){detail=await attribution(page,cdp,path.join(out,tag+'-attribution'),config.route);if(config.route==='wizard'){
      await page.evaluate(()=>document.getElementById('scene-wizard').style.backdropFilter='none');const noBlur=[];for(let repeat=0;repeat<N;repeat++)await cycle(page,cdp,config.route,noBlur,{repeat});detail.noBlur=Object.fromEntries([...new Set(noBlur.map(r=>r.label))].map(label=>[label,summary(noBlur.filter(r=>r.label===label),'ms')]));await page.evaluate(()=>document.getElementById('scene-wizard').style.removeProperty('backdrop-filter'));
     }}
    assert.deepEqual(errors,[]);if(config.cache==='pwa-offline')assert(requests.some(r=>r.worker),'offline scenario must actually use the service worker');const result={tag,variant:variant.name,...config,environment,grouped,rows,startups,representative,detail,requests};report.cases.push(result);fs.writeFileSync(path.join(out,tag+'.json'),JSON.stringify(result,null,2));
    console.log('PERF29 '+JSON.stringify({tag,environment,transitions:Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,{...v.ms,js:v.ScriptDuration.median,style:v.RecalcStyleDuration.median,layout:v.LayoutDuration.median,blocking:v.blockingMs.median}])),detail}));
   }catch(e){await page.screenshot({path:path.join(out,tag+'-failure.png')}).catch(()=>{});throw e;}finally{await ctx.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
  }
 }finally{await browser.close();await Promise.all([before.server,candidate.server].map(s=>new Promise(r=>s.close(r))));fs.rmSync(tmp,{recursive:true,force:true});}
}
module.exports={installProbe,summary};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
