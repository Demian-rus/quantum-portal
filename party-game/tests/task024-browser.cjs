'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const F=require('./task024-fixtures.cjs'),{historicalRuntimeFiles}=require('./profile-fixtures.cjs');
const BASE='c4220005d43e2a86d448466617698b2ed069455a',URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-task024';
const devices=[[320,568],[360,640],[390,844],[412,915],[844,390]],measurements=[];
const same=(a,b,label,tolerance=2)=>{for(const k of ['x','y','w','h'])assert.ok(Math.abs(a[k]-b[k])<=tolerance,label+' '+k+' '+JSON.stringify({a,b}));};
const overlap=(a,b)=>a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5;
function fits(g){
 assert.ok(g.document.w<=g.viewport.w+1&&g.document.h<=g.viewport.h+1,'Document overflow '+JSON.stringify(g));
 for(const b of [g.card,...g.ratings,...g.decisions])assert.ok(b.x>=0&&b.right<=g.viewport.w+1&&b.y>=0&&b.bottom<=g.viewport.h+1,'Offscreen '+JSON.stringify(g));
 for(const b of [...g.ratings,...g.decisions])assert.ok(b.w>=43.9&&b.h>=43.9,'Touch target');
 for(const b of [g.timer,...g.ratings].filter(Boolean)){
  assert.ok(!overlap(b,g.card),'Timer/rating intersects card');
  const gap=g.viewport.w>g.viewport.h?g.card.x-b.right:g.card.y-b.bottom;assert.ok(gap>=11.9,'Header/card gap '+JSON.stringify({gap,g}));
 }
 if(g.timeText)assert.ok(g.timeText.w<=g.timer.w*.84,'Clock text must fit inside the ring '+JSON.stringify(g));
 if(g.timer&&g.ratings.length===2)assert.ok(g.timer.x-g.ratings[0].right>=11.9&&g.ratings[1].x-g.timer.right>=11.9,'Rating/ring gutter must be at least 12px');
 if(g.condition){
  assert.ok(g.condition.y-g.card.bottom>=11.9,'Condition must be below card '+JSON.stringify(g));
  assert.ok(g.copy.y>=g.conditionRegion.y-1&&g.copy.bottom<=g.conditionRegion.bottom+1,'Ordinary condition clipped '+JSON.stringify(g));
  assert.ok(g.regionScroll.scroll<=g.regionScroll.client+1,'Ordinary condition scrolls '+JSON.stringify(g));
  for(const b of g.decisions)assert.ok(b.y-g.condition.bottom>=11.9,'Condition touches decisions '+JSON.stringify(g));
 }
 assert.ok(g.cardScroll.scroll<=g.cardScroll.client+1&&g.cardScroll.scrollWidth<=g.cardScroll.width+1,'Prompt overflow '+JSON.stringify(g));
 assert.ok(g.word.y>=g.card.y-1&&g.word.bottom<=g.card.bottom+1,'Prompt clipped');
}
(async()=>{
 fs.rmSync(folder,{recursive:true,force:true});fs.mkdirSync(folder,{recursive:true});const git=a=>execFileSync('git',a,{cwd:path.resolve(__dirname,'../..'),maxBuffer:12e6});
 const files=historicalRuntimeFiles(git,BASE,['index.html','style.css','sw.js']),oldFiles=new Map(files.map(n=>[n,git(['show',BASE+':party-game/'+n])]));
 // Pin the exact-raster harness to Playwright's matching Chromium revision.
 // Android performance/functional suites retain the runner's native Chrome.
 // https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-executable-path
 const browser=await chromium.launch({executablePath:chromium.executablePath(),headless:true,args:['--no-sandbox']});
 console.log('TASK024 exact raster environment',JSON.stringify({playwright:require('playwright-core/package.json').version,chromium:browser.version()}));
 try{for(const[w,h]of devices){
  const contexts=[];try{
   const old=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});contexts.push(old);const before=await old.newPage();
   await before.route('**/party-game/**',async route=>{const name=new globalThis.URL(route.request().url()).pathname.split('/party-game/')[1]||'index.html';if(!oldFiles.has(name))return route.continue();return route.fulfill({body:oldFiles.get(name),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html'});});
   await F.setup(before,URL);
   const ctx=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,reducedMotion:'reduce'});contexts.push(ctx);const after=await ctx.newPage(),errors=[];after.on('pageerror',e=>errors.push(e.message));await F.setup(after,URL);
   const longest=await after.evaluate(()=>PARTY_CARDS.filter(r=>['word','phrase','idiom'].includes(r.type)).sort((a,b)=>b.text.length-a.text.length)[0].text);
   for(const s of [...F.scenarios,{id:'longest',mode:'talk',modifier:null,word:longest}]){
    const baseline={},candidate={};await F.fixture(before,s);await F.fixture(after,s);
    for(const name of ['task','opened','countdown','play','hidden','revealed']){
     await F.phase(before,name);await F.phase(after,name);baseline[name]=await F.geometry(before);candidate[name]=await F.geometry(after);fits(candidate[name]);
     if((name==='task'||name==='play')&&((w===320||w===390)&&['sing','secret'].includes(s.id)||w===390||w===844&&s.id==='secret'))for(const [version,page]of [['before',before],['after',after]])await page.screenshot({path:folder+'/'+w+'-'+s.id+'-'+name+'-'+version+'.png',animations:'disabled'});
     same(candidate[name].card,candidate.task.card,s.id+' fixed card '+w+' '+name,0.05);
     same(candidate[name].bottom,candidate.task.bottom,s.id+' fixed decisions track '+w+' '+name,0.05);
     same(candidate[name].top,candidate.task.top,s.id+' shared header '+w+' '+name,0.05);
     if(candidate[name].decisions.length)candidate[name].decisions.forEach((b,i)=>same(b,baseline[name].decisions[i],'v87 bottom anchor '+s.id+' '+w,0.05));
     if(name!=='task')assert.equal(await after.locator('.round-top .mode-symbol').count(),0,'Large icon must be replaced after reveal');
    }
    if(w<h)assert.ok(candidate.task.card.y<baseline.task.card.y-20,'Card must move upwards from v87');
    measurements.push({width:w,height:h,scenario:s.id,before:baseline,after:candidate});
   }
   // Approx is a separate interaction: same HTML and pixel-identical screenshots.
   const approx=async p=>{await p.evaluate(()=>{Object.assign(options,{modes:['approx'],dice:false,difficulty:'easy'});newGame();game.dice=false;roll();stopTicking()});await F.settled(p);};
   await approx(before);const oldApprox=await before.screenshot({path:folder+'/'+w+'-approx-before.png',animations:'disabled'});
   await approx(after);const newApprox=await after.screenshot({path:folder+'/'+w+'-approx-after.png',animations:'disabled'});assert.ok(oldApprox.equals(newApprox),'Approx pixels changed '+w);
   // Every displayed V2 condition fits at the smallest portrait, without scroll.
   if(w===320){const ids=await after.evaluate(()=>QUIP_MODIFIERS_V2.map(r=>r.id));for(const modifier of ids){await F.fixture(after,{mode:'mime',modifier});await F.phase(after,'play');fits(await F.geometry(after));}}
   if(w===320){
    const style=await after.addStyleTag({content:'.scene--game{padding-top:32px!important;padding-bottom:28px!important}'});
    await F.fixture(after,F.scenarios[2]);const anchor=(await F.geometry(after)).card;
    for(const name of ['task','countdown','play']){await F.phase(after,name);const g=await F.geometry(after);fits(g);same(g.card,anchor,'Additional safe area '+name,.05);}await style.evaluate(el=>el.remove());
   }
   if(w===320||w===390){
    await F.fixture(after,F.scenarios[1]);const anchor=(await F.geometry(after)).card;
    const sizes=await after.evaluate(()=>({word:parseFloat(getComputedStyle(document.querySelector('.challenge-word')).fontSize),condition:parseFloat(getComputedStyle(document.querySelector('.round-condition')).fontSize)}));
    const style=await after.addStyleTag({content:'.stable-round .challenge-word{font-size:'+sizes.word*1.2+'px!important}.stable-round .round-condition{font-size:'+sizes.condition*1.2+'px!important}'});
    for(const name of ['task','opened','play']){await F.phase(after,name);const g=await F.geometry(after);fits(g);same(g.card,anchor,'120% prompt/condition text '+name,.05);}await style.evaluate(el=>el.remove());
   }
   assert.deepEqual(errors,[]);console.log('TASK024 geometry PASS',w,h,'0px phase shift / v87 bottom anchors / condition below card / Approx exact pixels');
  }finally{for(const ctx of contexts)await ctx.close();}
 }}finally{await browser.close();fs.writeFileSync(folder+'/geometry.json',JSON.stringify(measurements,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});
