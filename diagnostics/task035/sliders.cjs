'use strict';
// Trusted native range gestures, one identical harness for immutable baseline and candidate.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const {provisionProfiles}=require('../../party-game/tests/profile-fixtures.cjs'),{provisionTeamProfiles,chooseTeamProfiles}=require('../../party-game/tests/team-profile-fixtures.cjs');
const BASE='651940652f4a4e582eed18a34646004006792aa3',ROOT=path.resolve(__dirname,'../..'),out=path.join(ROOT,'artifacts/quip-task035/sliders'),N=Number(process.env.QUIP035_N||20);
const ranges=[['base-duration','duration','base-duration-value-advanced'],['target-score','targetScore','target-score-value'],['custom-rounds','rounds','rounds-value'],['modifier-chance','modifierChance','modifier-chance-value']];
function stat(xs){xs=xs.slice().sort((a,b)=>a-b);return {n:xs.length,median:xs[Math.floor(xs.length/2)],p95:xs[Math.ceil(xs.length*.95)-1],max:xs.at(-1)};}
async function serve(root){const s=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://local').pathname);fs.readFile(file.endsWith('/')?file+'index.html':file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(e?'missing':b)});});await new Promise(r=>s.listen(0,'127.0.0.1',r));return {server:s,url:'http://127.0.0.1:'+s.address().port+'/party-game/'};}
function installProbe(){
 const ranges={'base-duration':['duration','base-duration-value-advanced'],'target-score':['targetScore','target-score-value'],'custom-rounds':['rounds','rounds-value'],'modifier-chance':['modifierChance','modifier-chance-value']};
 const probe=window.__range035={events:[],counts:{},onInput:false};
 for(const name of ['renderOptions','persist','checkContentPack','getPackCardPool']){
  const original=window[name];window[name]=function(...args){const t=performance.now();try{return original.apply(this,args)}finally{if(probe.onInput){const count=probe.counts[name]??={calls:0,ms:0};count.calls++;count.ms+=performance.now()-t;}}};
 }
 document.addEventListener('input',e=>{
  const def=ranges[e.target.id];if(!def)return;probe.onInput=true;
  const row={id:e.target.id,trusted:e.isTrusted,inputAt:performance.now(),value:Number(e.target.value)};probe.events.push(row);
  requestAnimationFrame(()=>{row.frameMs=performance.now()-row.inputAt;row.actual=options[def[0]];row.label=document.getElementById(def[1]).textContent;row.valid=row.actual===row.value&&row.label.startsWith(String(row.value));});
 },true);
 document.addEventListener('input',e=>{if(!ranges[e.target.id])return;const row=probe.events.at(-1);row.handlerMs=performance.now()-row.inputAt;probe.onInput=false;});
}
async function prepare(p,url,format){await p.goto(url);await p.evaluate(()=>QuipTeams.whenReady());await provisionProfiles(p);await provisionTeamProfiles(p);await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();if(format==='teams'){await p.locator('#wizard-format-teams').tap();await chooseTeamProfiles(p);}await p.locator('[data-wizard-step="3"]').tap();await p.locator('#wizard-extra>summary').tap();await p.locator('#toggle-complications').check();}
async function measure(browser,root,label){const {server,url}=await serve(root),reports=[];try{for(const format of ['duel','teams']){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),cdp=await ctx.newCDPSession(p);p.setDefaultTimeout(15000);
 try{await prepare(p,url,format);await p.evaluate(installProbe);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 for(const [id,key]of ranges){if(id==='custom-rounds')await p.locator('#finish-rounds').check();if(id==='target-score')await p.locator('#finish-score').check();const el=p.locator('#'+id);await el.scrollIntoViewIfNeeded();const b=await el.boundingBox(),min=Number(await el.getAttribute('min')),max=Number(await el.getAttribute('max'));
 for(const kind of ['drag','track','keyboard']){const samples=[];await p.evaluate(()=>{__range035.counts={};});
 for(let n=-1;n<N;n++){
  const before=await p.evaluate(()=>__range035.events.length);let x=b.x+10+(b.width-20)*(.1+.8*((n+1)%13)/12),y=b.y+b.height/2;
  if(kind==='keyboard'){await el.focus();if(Number(await el.inputValue())>=max)await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');}
  else if(kind==='track'){const step=Number(await el.getAttribute('step')),steps=(max-min)/step;let index=(n+1)%(steps+1);if(index===(Number(await el.inputValue())-min)/step)index=(index+1)%(steps+1);x=b.x+10+(b.width-20)*index/steps;await p.touchscreen.tap(x,y);}
  else{const current=await el.inputValue(),fraction=(Number(current)-min)/(max-min),start=b.x+10+(b.width-20)*fraction,end=b.x+10+(b.width-20)*(fraction<.5?1:0);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});for(let k=1;k<=12;k++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*k/12,y}]});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const events=await p.evaluate(start=>__range035.events.slice(start),before);assert(events.length,id+' '+kind+' must change native value');assert(events.every(e=>e.trusted&&e.valid),JSON.stringify(events));
  if(n>=0)samples.push({n,ms:Math.max(...events.map(e=>e.frameMs)),events});
 }
 const counts=await p.evaluate(()=>__range035.counts),result={label,format,id,key,kind,cpu:4,stats:stat(samples.map(x=>x.ms)),counts,samples};reports.push(result);console.log('TASK035_RANGE '+JSON.stringify({...result,samples:undefined}));fs.writeFileSync(path.join(out,label+'-measurements.json'),JSON.stringify(reports,null,2));
 if(label==='after'){assert(result.stats.n>=20);assert(result.stats.median<=50&&result.stats.p95<=100,JSON.stringify(result.stats));assert.equal(counts.checkContentPack?.calls||0,0,'no full checker on input');assert.equal(counts.getPackCardPool?.calls||0,0,'no pool builds on input');}
 }
 await p.screenshot({path:path.join(out,label+'-'+format+'-'+id+'.png'),scale:'css'});
 }
 const profile=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,label+'-'+format+'.cpuprofile'),JSON.stringify(profile.profile));await ctx.tracing.stop({path:path.join(out,label+'-'+format+'-trace.zip')});
 }finally{await ctx.close();}
 }}finally{server.close();}return reports;}
(async()=>{fs.mkdirSync(out,{recursive:true});const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quip035-base-'));execFileSync('bash',['-c','git archive '+BASE+' party-game | tar -x -C "$1"','_',dir],{cwd:ROOT});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined,args:['--no-sandbox']});try{const labels=process.env.QUIP035_LABEL?[process.env.QUIP035_LABEL]:['before','after'];const reports={base:BASE,head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),browser:browser.version()};for(const label of labels)reports[label]=await measure(browser,label==='before'?dir:ROOT,label);fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(reports,null,2));}finally{await browser.close();fs.rmSync(dir,{recursive:true});}})().catch(e=>{console.error(e);process.exitCode=1});
