'use strict';
// Diagnosis only. Acceptance still uses the unmodified exact TASK024 assertions.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright-core');
const F=require('../../party-game/tests/task024-fixtures.cjs'),{historicalRuntimeFiles}=require('../../party-game/tests/profile-fixtures.cjs');
const root=path.resolve(__dirname,'../..'),BASE='c4220005d43e2a86d448466617698b2ed069455a',URL='http://127.0.0.1:8765/party-game/',out='artifacts/task030-raster',N=10;
const git=a=>execFileSync('git',a,{cwd:root,maxBuffer:15e6}),files=historicalRuntimeFiles(git,BASE,['index.html','style.css','sw.js']),old=new Map(files.map(n=>[n,git(['show',BASE+':party-game/'+n])]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function meta(p){
 const cdp=await p.context().newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const fonts=[];
 for(const selector of ['#score-a','#score-b']){const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});fonts.push({selector,...await cdp.send('CSS.getPlatformFontsForNode',{nodeId})});}await cdp.detach();
 return {fonts,geometry:await F.geometry(p),text:await p.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),scores:['score-a','score-b'].map(id=>{const n=$(id),r=n.getBoundingClientRect(),s=getComputedStyle(n);return {id,text:n.textContent,box:{x:r.x,y:r.y,w:r.width,h:r.height},font:s.font,family:s.fontFamily,weight:s.fontWeight,variation:s.fontVariationSettings,kerning:s.fontKerning,transform:s.transform,color:s.color,rendering:s.textRendering,smoothing:s.webkitFontSmoothing};})}))};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const report={head:git(['rev-parse','HEAD']).toString().trim(),base:BASE,n:N,physicalAndroid:false,playwright:require('playwright-core/package.json').version,note:'Exact failing TASK024 geometry harness: desktop Chromium viewport390x844/touch/reducedMotion, NOT the Android performance profile. No runtime edits, masks or pixel tolerances. Playwright-bundled Chromium control across all five TASK024 viewports, same runner and default font/raster flags; baseline and candidate receive the same pinned browser; this changes only the diagnostic visual-test environment, never the application; all raw PNGs and font/geometry data retained for every mismatch. Default Android performance tests are unchanged.',hardware:{cpu:os.cpus()[0].model,cores:os.cpus().length},variants:[]};
 try{for(const [name,args]of [['bundled',[]]]){
  const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath(),args:['--no-sandbox',...args]}),variant={name,args,version:browser.version(),pairs:[]};report.variants.push(variant);
  try{const cdp=await browser.newBrowserCDPSession();variant.gpu=(await cdp.send('SystemInfo.getInfo')).gpu;await cdp.detach();
   for(const [width,height]of [[320,568],[360,640],[390,844],[412,915],[844,390]])for(let i=0;i<N;i++){
    const before=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),after=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
    try{const a=await before.newPage(),b=await after.newPage();await a.route('**/party-game/**',route=>{const f=new globalThis.URL(route.request().url()).pathname.split('/party-game/')[1]||'index.html';return old.has(f)?route.fulfill({body:old.get(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'}):route.continue();});await F.setup(a,URL);await F.setup(b,URL);
     const longest=await b.evaluate(()=>PARTY_CARDS.filter(r=>['word','phrase','idiom'].includes(r.type)).sort((a,b)=>b.text.length-a.text.length)[0].text);
     for(const s of [...F.scenarios,{id:'longest',mode:'talk',modifier:null,word:longest}]){await F.fixture(a,s);await F.fixture(b,s);for(const phase of ['task','opened','countdown','play','hidden','revealed']){await F.phase(a,phase);await F.phase(b,phase);}}
     const approx=async p=>{await p.evaluate(()=>{Object.assign(options,{modes:['approx'],dice:false,difficulty:'easy'});newGame();game.dice=false;roll();stopTicking()});await F.settled(p);};await approx(a);const a1=await a.screenshot({animations:'disabled'});await approx(b);const b1=await b.screenshot({animations:'disabled'});
     const a2=await a.screenshot({animations:'disabled'}),b2=await b.screenshot({animations:'disabled'}),row={width,height,i,crossFirst:a1.equals(b1),crossSecond:a2.equals(b2),beforeSelf:a1.equals(a2),afterSelf:b1.equals(b2),hashes:[a1,b1,a2,b2].map(sha),before:await meta(a),after:await meta(b)};variant.pairs.push(row);
     if(!row.crossFirst||!row.crossSecond||i===0)for(const [tag,buf]of [['before-1',a1],['after-1',b1],['before-2',a2],['after-2',b2]])fs.writeFileSync(path.join(out,name+'-'+width+'-'+i+'-'+tag+'.png'),buf);
     fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('RASTER030',JSON.stringify({name,width,height,i,crossFirst:row.crossFirst,crossSecond:row.crossSecond,beforeSelf:row.beforeSelf,afterSelf:row.afterSelf,scoresBefore:row.before.text.scores,scoresAfter:row.after.text.scores,fontsBefore:row.before.fonts,fontsAfter:row.after.fonts}));
    }finally{await before.close();await after.close();}
   }
  }finally{await browser.close();}
 }}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log('RASTER030 SUMMARY',JSON.stringify(report.variants.map(v=>({name:v.name,n:v.pairs.length,crossFirst:v.pairs.filter(r=>!r.crossFirst).length,crossSecond:v.pairs.filter(r=>!r.crossSecond).length,beforeSelf:v.pairs.filter(r=>!r.beforeSelf).length,afterSelf:v.pairs.filter(r=>!r.afterSelf).length}))));
})().catch(e=>{console.error(e);process.exitCode=1});
