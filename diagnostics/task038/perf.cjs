'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const T=require('./browser-tools.cjs'),{summary}=require('../task029/mobile-perf.cjs'),{normalizeTask038}=require('./source-contract.cjs'),api=require('../../party-game/scripts/content.cjs');
const SIZE=Number(process.env.TASK038_SIZE||7000),PILOT=process.env.TASK038_PILOT==='1',N=PILOT?2:20;assert([7000,15000].includes(SIZE));if(process.env.GITHUB_ACTIONS)assert(!PILOT);
const OUT=path.join(T.ROOT,'artifacts/quip-task038/perf-'+SIZE);fs.mkdirSync(OUT,{recursive:true});
function probe(){
 const q=window.__p38={serial:0,long:[]};try{new PerformanceObserver(l=>q.long.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask'});}catch{}
 q.arm=a=>{q.wait=new Promise((resolve,reject)=>q.armed={...a,resolve,reject});};
 for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{const a=q.armed;if(!a||a.event!==event)return;q.armed=null;const start=e.timeStamp,id='kvip38:'+ ++q.serial+':'+a.label;performance.mark(id+':start');
  const ready=()=>a.kind==='page'?document.querySelector('[data-wizard-page="'+a.value+'"]').hidden===false:a.kind==='profile'?document.getElementById('profile-backdrop').hidden&&(a.format==='duel'?selectedProfileIds[0]===a.value:QuipTeams.selectedProfileId({format:'teams-2x2',slot:0})===a.value):a.kind==='color'?profilePanelColor===a.value:a.kind==='category'?document.querySelector('[data-category-id="'+a.value+'"]').checked===false&&readGeneralCategoryPreferences().policy.excluded.includes(a.value)&&options.contentPack.excluded.includes(a.value):a.kind==='start'?game?.phase==='ready'&&!document.getElementById('scene-game').hidden&&!QuipTeams.busy:false;
  const timer=setTimeout(()=>a.reject(Error('No presented authoritative state '+id)),20000),poll=()=>{if(!ready()){requestAnimationFrame(poll);return;}Promise.resolve(QuipTeams.whenIdle()).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{clearTimeout(timer);const end=performance.now();performance.mark(id+':end');a.resolve({id,label:a.label,start,end,ms:end-start,trusted:e.isTrusted,pointer:e.pointerType||'keyboard',longTasks:q.long.filter(t=>t.start<end&&t.start+t.ms>start)});},0))));};requestAnimationFrame(poll);
 },true);
}
async function traceStart(cdp){await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReturnAsStream'});}
async function traceStop(cdp,file){const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await done,fd=fs.openSync(file,'w');try{for(;;){const r=await cdp.send('IO.read',{handle:stream});fs.writeSync(fd,r.base64Encoded?Buffer.from(r.data,'base64'):r.data);if(r.eof)break;}}finally{fs.closeSync(fd);await cdp.send('IO.close',{handle:stream});}}
function loadRoots(){
 const roots=T.roots(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'task038-load-')),after=path.join(temp,'after');fs.mkdirSync(after);fs.cpSync(path.join(T.ROOT,'party-game'),path.join(after,'party-game'),{recursive:true});
 const data=api.readDataset(),pack=structuredClone(data.packs.find(p=>p.id==='general'&&p.version===48));pack.version=1000;
 const active=new Set(pack.criteria.cardIds),base=data.cards.filter(c=>active.has(c.id)),extra=[];
 for(let n=0;n<SIZE-7000;n++){const row=structuredClone(base[n%base.length]);row.id='word-task038-load-'+n;row.text='Нагрузочный пример '+n;row.type='word';row.pack='task038-synthetic';extra.push(row);pack.criteria.cardIds.push(row.id);}
 data.cards=data.cards.concat(extra);data.packs=data.packs.concat(pack);const generated=api.render(data);
 for(const [name,content]of Object.entries(generated))for(const [kind,root]of [['before',roots.base],['after',after]])fs.writeFileSync(path.join(root,'party-game',name),kind==='before'&&name==='content-packs.js'?normalizeTask038(content):content);
 return {before:roots.base,after,synthetic:SIZE===15000,fixture:'identical rendered catalog; active general@1000 = immutable general@48 plus synthetic load only; no editorial source changes',dispose(){roots.dispose();fs.rmSync(temp,{recursive:true,force:true});}};
}
async function journey(browser,url,variant,kind){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),out=path.join(OUT,variant+'-'+kind);fs.mkdirSync(out,{recursive:true});p.setDefaultTimeout(30000);p.on('dialog',d=>d.accept());await p.addInitScript(probe);await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});const cdp=await ctx.newCDPSession(p),row={variant,kind,cpu:4,n:N,samples:[],cost:[]};let tracing=false;
 const slot=kind==='duel'?'#team-a':'#team-profile-0-0';
 const reset=()=>p.evaluate(()=>{__cost38={check:0,pool:0,index:0};});
 const cost=label=>p.evaluate(label=>({label,...__cost38}),label);
 const measure=async(selector,a,key=false,keep=true)=>{await p.locator(selector).scrollIntoViewIfNeeded();if(key)await p.locator(selector).focus();await p.evaluate(a=>__p38.arm(a),{...a,format:kind,event:key?'keydown':'pointerdown'});if(key)await p.keyboard.press('Space');else await p.locator(selector).tap();const sample=await p.evaluate(()=>__p38.wait);assert(sample.trusted);assert.equal(sample.pointer,key?'keyboard':'touch');if(keep)row.samples.push(sample);await T.idle(p);};
 try{
  await p.goto(url);await p.evaluate(()=>QuipTeams.whenReady());await T.seed(p,27);await T.wizard(p,kind);await p.evaluate(()=>{window.__cost38={check:0,pool:0,index:0};for(const [name,key]of [['checkContentPack','check'],['getPackCardPool','pool'],['buildGeneralCategoryIndex','index']])if(typeof window[name]==='function'){const fn=window[name];window[name]=function(...a){__cost38[key]++;return fn.apply(this,a);};}renderOptions();});
  const ids=await p.evaluate(()=>profileStore.profiles.map(p=>p.id));await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await traceStart(cdp);tracing=true;
  for(let i=-1;i<N;i++){
   await reset();await T.tap(p,slot);await measure('[data-profile-id="'+ids[i<0?4:i+5]+'"]',{kind:'profile',label:'profile_choose',value:ids[i<0?4:i+5]},false,i>=0);
   await T.tap(p,slot);await T.tap(p,'#profile-create-open');await measure('[data-profile-color='+ (i%2?'violet':'green')+']',{kind:'color',label:'color_choose',value:i%2?'violet':'green'},false,i>=0);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
   await measure('[data-wizard-step="3"]',{kind:'page',label:'players_rules',value:3},false,i>=0);await measure('[data-wizard-step="2"]',{kind:'page',label:'rules_players',value:2},false,i>=0);
   if(i>=0){const c=await cost('profile-color-navigation');row.cost.push(c);if(variant==='after')assert.deepEqual(c,{label:c.label,check:0,pool:0,index:0});}
  }
  if(variant==='after'){
   await T.tap(p,'[data-wizard-step="1"]');await T.tap(p,'#wizard-category-summary');const tags=await p.evaluate(()=>generalCategoryCounts(latestGeneralPackSelection()).categories.map(c=>c.id));assert(tags.length>=20);
   for(const key of [false,true])for(let i=-1;i<N;i++){
    if(await p.locator('#wizard-category-all').isEnabled())await T.tap(p,'#wizard-category-all');await reset();const tag=tags[i<0?20:i];await measure('[data-category-id="'+tag+'"]',{kind:'category',label:key?'category_key':'category_touch',value:tag},key,i>=0);
    if(i>=0){const c=await cost('category-input');row.cost.push(c);assert.equal(c.index,0,'no full catalog index rebuild per input');/* Real availability checks may use the indexed buckets; no full catalog rebuild is allowed. */}
   }
   await T.tap(p,'#wizard-category-all');await T.tap(p,'[data-category-id=science]');
  }
  for(let i=-1;i<N;i++){
   if(await p.locator('#scene-game').isVisible()){await T.tap(p,'#exit-game');await T.wizard(p,kind);}await T.configure(p);await reset();await measure('#start-game',{kind:'start',label:'real_start'},false,i>=0);const c=await cost('START');if(i>=0)row.cost.push(c);assert(c.check>0,'real START full check');assert.equal(await p.evaluate(()=>game.contentPack.selectionPolicyVersion===1),variant==='after');
  }
  row.stats=Object.fromEntries([...new Set(row.samples.map(s=>s.label))].map(label=>[label,summary(row.samples.filter(s=>s.label===label),'ms')]));
  for(const [label,s]of Object.entries(row.stats)){assert.equal(s.n,N);if(variant==='after')assert(s.median<=200&&s.p95<=350,label+' budget '+JSON.stringify(s));}
  row.success=true;await p.screenshot({path:path.join(out,'after-start.png'),scale:'css'});return row;
 }catch(error){row.error=error.stack;throw error;}finally{if(tracing)await traceStop(cdp,path.join(out,'cpu4.trace.json'));fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify(row,null,2));await ctx.tracing.stop({path:path.join(out,'playwright.trace.zip')});await ctx.close();console.log(JSON.stringify({variant,kind,stats:row.stats,error:row.error}));}
}
(async()=>{const roots=loadRoots(),before=await T.serve(roots.before),after=await T.serve(roots.after),browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN,args:['--no-sandbox']}: {})}),report={base:T.BASE,head:process.env.TASK038_SOURCE_HEAD||execFileSync('git',['rev-parse','HEAD'],{cwd:T.ROOT,encoding:'utf8'}).trim(),size:SIZE,fixture:roots.fixture,synthetic:roots.synthetic,pilot:PILOT,cpu:4,n:N,version:browser.version(),definition:'Trusted pointerdown/keydown to authoritative state, storage, idle team transaction, two animation frames and after-frame task. Same viewport/browser/CPU/catalog before and after. Category UI has no fabricated before result.',rows:[]};try{for(const kind of ['duel','teams'])for(const [v,s]of [['before',before],['after',after]]){report.rows.push(await journey(browser,s.url,v,kind));fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(report,null,2));}}finally{await browser.close();await Promise.all([before,after].map(s=>new Promise(r=>s.server.close(r))));roots.dispose();}})().catch(e=>{console.error(e);process.exitCode=1});
