'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{chromium,webkit}=require('playwright-core');
const {serve,scaleFonts}=require('../task034/mobile.cjs'),{installProbe,summary}=require('../task029/mobile-perf.cjs');
const {provisionProfiles}=require('../../party-game/tests/profile-fixtures.cjs'),{provisionTeamProfiles,chooseTeamProfiles}=require('../../party-game/tests/team-profile-fixtures.cjs');
const ROOT=path.resolve(__dirname,'../..'),BASE='76edbc0c1083060952fce004a1400fcbf6db15e3',ENGINE=process.env.QUIP036_ENGINE||'chromium',PILOT=process.env.QUIP036_PILOT==='1';
const sizes=ENGINE==='webkit'?[[375,667,2],[390,844,3],[393,852,3],[430,932,3]]:[[320,568,2],[344,720,2.625],[360,640,2],[360,780,3],[390,844,2.625],[412,732,2.625],[412,915,3],[667,375,2],[844,390,2.625],[932,430,3],[1024,768,1]];
const folder=path.join(ROOT,'artifacts/quip-task036',ENGINE);fs.mkdirSync(folder,{recursive:true});
function collect(){
 const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const textRects=n=>{const r=document.createRange();r.selectNodeContents(n);return [...r.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}));};
 const nav=document.querySelector('.wizard-steps'),kicker=$('wizard-kicker');
 return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},nav:rect(nav),scroll:rect($('wizard-scroll')),footer:rect(document.querySelector('.wizard-footer')),title:{text:$('wizard-title').textContent,rect:rect($('wizard-title'))},kicker:{hidden:kicker.hidden,text:kicker.textContent,rect:rect(kicker)},fontMethod:window.__font034Method,
  steps:[...nav.querySelectorAll('button')].map(n=>({step:Number(n.dataset.wizardStep),label:n.querySelector('span').textContent,current:n.getAttribute('aria-current'),name:n.getAttribute('aria-label'),rect:rect(n),number:rect(n.querySelector('b')),labelRect:rect(n.querySelector('span')),glyphs:textRects(n.querySelector('span')),font:getComputedStyle(n.querySelector('span')).fontSize,outline:getComputedStyle(n).outlineStyle})),focus:document.activeElement.id};
}
function violations(g,step){
 const bad=[],eps=.1,inside=(a,b)=>a.x>=b.x-eps&&a.right<=b.right+eps&&a.y>=b.y-eps&&a.bottom<=b.bottom+eps,overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.1;
 const all=g.steps;if(g.document.width>g.viewport.width+1)bad.push('horizontal document overflow');
 if(g.nav.x<-.1||g.nav.right>g.viewport.width+.1)bad.push('nav outside viewport');
 if(g.scroll.y<g.nav.bottom-.1||g.scroll.bottom>g.footer.y+.1||g.scroll.height<=0)bad.push('nav/scroll/footer collision');
 if(!g.kicker.hidden||g.kicker.rect.height||g.kicker.text)bad.push('duplicate step kicker or reserved space');
 if(g.focus!=='wizard-title')bad.push('navigation did not focus the existing h1');
 for(const s of all){
  if(s.label!==['Игра','Игроки','Правила','Старт'][s.step-1])bad.push('wrong visible label '+s.step);
  if(s.name!=='Этап '+s.step+' из 4: '+s.label)bad.push('missing accessible step number '+s.step);
  if(s.current!==(s.step===step?'step':null))bad.push('wrong aria-current '+s.step);
  if(s.rect.width<44||s.rect.height<44)bad.push('small touch target '+s.step);
  if(Math.abs(s.rect.width-all[0].rect.width)>eps||Math.abs(s.rect.height-all[0].rect.height)>eps)bad.push('unequal button areas '+s.step);
  if(Math.abs(s.number.y-all[0].number.y)>eps||Math.abs(s.number.height-all[0].number.height)>eps)bad.push('unaligned number row '+s.step);
  if(Math.abs(s.labelRect.y-all[0].labelRect.y)>eps||Math.abs(s.labelRect.height-all[0].labelRect.height)>eps)bad.push('unaligned label row '+s.step);
  if(s.glyphs.length!==1)bad.push('wrapped label '+s.step);
  for(const r of [s.number,s.labelRect,...s.glyphs])if(!inside(r,s.rect))bad.push('content outside its own hit area '+s.step);
  if(overlap(s.number,s.labelRect))bad.push('number/label overlap '+s.step);
  for(const other of all.filter(n=>n.step>s.step))if(overlap(s.rect,other.rect)||overlap(s.labelRect,other.labelRect))bad.push('adjacent steps overlap');
 }
 return [...new Set(bad)];
}
const storage=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
const model=p=>p.evaluate(()=>JSON.stringify({options,selectedProfileIds,profileStore,game,taskMemory,record:QuipTeams.record()}));
async function journey(browser,endpoint,variant,size,scale,format){
 const [width,height,dpr]=size,key=[variant,width+'x'+height,'font'+scale,format].join('-'),out=path.join(folder,key);fs.mkdirSync(out,{recursive:true});
 const persistent=ENGINE==='webkit'?fs.mkdtempSync(path.join(os.tmpdir(),'kvip036-wk-')):null,opts={viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,reducedMotion:'reduce'},ctx=persistent?await webkit.launchPersistentContext(persistent,{...opts,headless:true}):await browser.newContext(opts),p=await ctx.newPage(),row={key,variant,width,height,dpr,scale,format,states:[],checks:[],physicalDevice:false},errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(installProbe);await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 let cdp;if(ENGINE==='chromium'){cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 const tap=async selector=>{await scaleFonts(p,scale);await p.locator(selector).tap();await p.evaluate(()=>QuipTeams.whenIdle());};
 async function inspect(step,label){await scaleFonts(p,scale);await p.evaluate(()=>document.fonts.ready);const geometry=await p.evaluate(collect),bad=violations(geometry,step);const file=label+'.png';await p.screenshot({path:path.join(out,file),scale:'css',animations:'disabled'});row.states.push({step,label,file,geometry,violations:bad});if(variant==='after')assert.deepEqual(bad,[],key+' / '+label);return geometry;}
 try{
  await p.goto(endpoint.url);await p.evaluate(()=>QuipTeams.whenReady());await provisionProfiles(p);const names=[['Первый','Второй'],['Третий','Четвёртый']];await provisionTeamProfiles(p,names);
  await tap('#new-game-menu');await tap('#standard-game');if(format==='teams'){await tap('#wizard-format-teams');await chooseTeamProfiles(p,names);}
  await p.evaluate(()=>QuipTeams.whenIdle());const raw=await storage(p),stable=await model(p);
  for(let n=1;n<=4;n++){await tap('[data-wizard-step="'+n+'"]');await inspect(n,'step-'+n);}
  assert.deepEqual(await storage(p),raw,'trusted step taps preserve every RAW slot');assert.equal(await model(p),stable,'trusted step taps preserve options/game/profiles/history/catalog selection');row.checks.push('four trusted step taps / exact RAW and model');
  await p.keyboard.press('Escape');await p.locator('[data-wizard-page="3"]:visible').waitFor();await tap('#wizard-back');await p.locator('[data-wizard-page="2"]:visible').waitFor();
  await p.goBack();await p.locator('[data-wizard-page="1"]:visible').waitFor();assert.deepEqual(await storage(p),raw);assert.equal(await model(p),stable);row.checks.push('Escape / visible Back / native history Back preserve RAW and model');
  await p.locator('[data-wizard-step="2"]').focus();await p.keyboard.press('Enter');await p.locator('[data-wizard-page="2"]:visible').waitFor();assert.equal(await p.locator('#wizard-title').evaluate(n=>n===document.activeElement),true);
  await p.locator('[data-wizard-step="3"]').focus();await p.keyboard.press('Space');await p.locator('[data-wizard-page="3"]:visible').waitFor();await p.locator('[data-wizard-step="2"]').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.dataset.wizardStep),'3');assert(await p.evaluate(()=>document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineStyle!=='none'));await p.screenshot({path:path.join(out,'keyboard-focus.png'),scale:'css'});row.checks.push('Enter / Space / Tab order / visible focus');
  await tap('#wizard-mode-settings');assert.equal(await p.locator('#wizard-kicker').isVisible(),true);assert.equal(await p.locator('#wizard-kicker').textContent(),'ОБЩИЙ ЦЕНТР');await p.keyboard.press('Escape');await p.locator('[data-wizard-page="3"]:visible').waitFor();row.checks.push('useful mode-center heading retained / Escape returns');
  if(variant==='after'){
   const saved=await p.locator('[data-wizard-step="2"] b').getAttribute('style');await p.locator('[data-wizard-step="2"] b').evaluate(n=>{n.style.position='relative';n.style.top='-8px'});assert(violations(await p.evaluate(collect),3).some(x=>x.includes('unaligned number')),'positive control: detector must see shifted circle');await p.locator('[data-wizard-step="2"] b').evaluate((n,s)=>s===null?n.removeAttribute('style'):n.setAttribute('style',s),saved);
   await p.locator('[data-wizard-step="2"] span').evaluate(n=>n.style.cssText='width:8px;white-space:normal;overflow-wrap:anywhere');assert(violations(await p.evaluate(collect),3).some(x=>x.includes('wrapped label')),'positive control: detector must see multiline label');await p.locator('[data-wizard-step="2"] span').evaluate(n=>n.removeAttribute('style'));row.checks.push('detector positive controls: shifted number and wrapped label rejected');
  }
  // Reuse the TASK029 trusted pointerdown-to-presented-frame definition and
  // unchanged budgets. Warm every transition before clearing full-scan counters.
  if(cdp&&scale===1){
   await p.evaluate(()=>{window.__catalog036={check:0,pool:0};const check=checkContentPack,pool=getPackCardPool;checkContentPack=function(...a){__catalog036.check++;return check.apply(this,a)};getPackCardPool=function(...a){__catalog036.pool++;return pool.apply(this,a)};renderOptions();});
   const actions=[[1,'catalog'],[2,'players'],[3,'rules'],[4,'start']],samples=[];
   for(let i=-1;i<20;i++){for(const [n,target]of actions){await p.evaluate(a=>__perf29.arm(...a),['wizard',target,'step-'+n]);await tap('[data-wizard-step="'+n+'"]');const sample=await p.evaluate(()=>__perf29.wait);assert(sample.trusted&&sample.pointer==='touch');if(i>=0)samples.push({step:n,...sample});}if(i===-1)await p.evaluate(()=>{__catalog036={check:0,pool:0}});}
   const stats=Object.fromEntries(actions.map(([n])=>[n,summary(samples.filter(r=>r.step===n),'ms')])),catalog=await p.evaluate(()=>__catalog036);for(const s of Object.values(stats))assert(s.median<=200&&s.p95<=350,JSON.stringify(stats));assert.deepEqual(catalog,{check:0,pool:0});row.performance={cpu:4,n:20,stats,catalog,samples};
  }
  assert.deepEqual(await storage(p),raw);assert.equal(await model(p),stable);assert.deepEqual(errors,[]);row.errors=errors;row.success=true;
 }catch(e){row.error=e.stack;await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
 finally{fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(row,null,2));await ctx.tracing.stop({path:path.join(out,'trace.zip')});await ctx.close();if(persistent)fs.rmSync(persistent,{recursive:true,force:true});}
 console.log('TASK036 '+JSON.stringify({key,states:row.states.length,baselineViolations:row.states.reduce((n,s)=>n+s.violations.length,0),checks:row.checks,performance:row.performance?.stats}));return row;
}
async function main(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kvip036-base-')),tar=path.join(tmp,'baseline.tar');execFileSync('git',['archive','--format=tar','--output='+tar,BASE,'party-game'],{cwd:ROOT});execFileSync('tar',['-xf',tar,'-C',tmp]);
 const before=await serve(tmp),after=await serve(ROOT),browser=await (ENGINE==='webkit'?webkit:chromium).launch({headless:true,...(ENGINE==='chromium'?{executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']}:{} )}),rows=[];
 const report={base:BASE,checkout:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHead:process.env.QUIP036_SOURCE_HEAD||null,engine:ENGINE,browser:browser.version(),physicalDevice:false,rows};
 try{for(const size of PILOT?sizes.slice(0,1):sizes)for(const scale of [1,2])for(const format of ['duel','teams'])for(const [variant,endpoint]of [['before',before],['after',after]]){rows.push(await journey(browser,endpoint,variant,size,scale,format));fs.writeFileSync(path.join(folder,'summary.json'),JSON.stringify(report,null,2));}}
 finally{await browser.close();await Promise.all([before,after].map(s=>new Promise(r=>s.server.close(r))));fs.rmSync(tmp,{recursive:true,force:true});}
}
module.exports={collect,violations};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
