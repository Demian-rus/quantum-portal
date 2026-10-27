'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,devices}=require('playwright-core'),{PNG}=require('pngjs');
const {provisionProfiles}=require('../../party-game/tests/profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-task031-probe';
async function capture(cdp,file){const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true});const bytes=Buffer.from(shot.data,'base64');fs.writeFileSync(file,bytes);return PNG.sync.read(bytes);}
function outside(a,b,{label,span,dpr}){let changed=0,total=0,max=0;for(let y=Math.ceil((label.y+1)*dpr);y<Math.floor((label.bottom-1)*dpr);y++)for(let x=Math.ceil((label.x+1)*dpr);x<Math.floor((label.right-1)*dpr);x++){
 const cx=(x+.5)/dpr,cy=(y+.5)/dpr;if(cx>=span.x-3&&cx<=span.right+3&&cy>=span.y-3&&cy<=span.bottom+3)continue;total++;const i=(y*a.width+x)*4,d=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]);max=Math.max(max,d);if(d>=3)changed++;
}return {changed,total,max};}
async function state(p){return p.evaluate(()=>{const input=document.getElementById('finish-rounds'),label=input.closest('label'),span=label.querySelector('span'),rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},style=n=>{const s=getComputedStyle(n);return {tap:s.webkitTapHighlightColor,outline:s.outline,background:s.backgroundColor,border:s.borderRadius};};return {dpr:devicePixelRatio,label:rect(label),span:rect(span),input:rect(input),styles:{label:style(label),span:style(span),input:style(input)},finish:options.finishType};});}
(async()=>{fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']}),ctx=await browser.newContext({...devices['Pixel 7'],viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),rows=[];
 try{const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await p.goto(URL);await provisionProfiles(p);await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();await p.locator('[data-wizard-step="3"]').tap();await p.evaluate(()=>{window.__presses=[];document.addEventListener('pointerdown',e=>__presses.push({trusted:e.isTrusted,pointer:e.pointerType,target:e.target.tagName}),true);});
  for(const [name,color]of [['published',null],['transparent','transparent'],['bright-positive','rgba(255,0,0,.8)']]){
   const sheet=color?await p.addStyleTag({content:'.setup-wizard .finish-choices label{-webkit-tap-highlight-color:'+color+'}'}):null;
   if(!await p.locator('#finish-score').isChecked())await p.locator('#finish-score').locator('..').tap();await p.locator('#finish-rounds').locator('..').scrollIntoViewIfNeeded();await p.waitForTimeout(400);
   const g=await state(p),before=await capture(cdp,path.join(folder,name+'-before.png')),point={x:g.span.x+g.span.width/2,y:g.span.y+g.span.height/2},frames=[];
   const start=Date.now();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1,force:1}]});
   try{for(let i=0;i<4;i++){const img=await capture(cdp,path.join(folder,name+'-held-'+i+'.png'));frames.push({index:i,elapsed:Date.now()-start,...outside(before,img,g)});await p.waitForTimeout(25);}}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   await p.waitForTimeout(350);await capture(cdp,path.join(folder,name+'-released.png'));assert.equal(await p.evaluate(()=>options.finishType),'rounds');
   rows.push({name,geometry:g,frames,press:await p.evaluate(()=>__presses.at(-1))});assert(rows.at(-1).press.trusted&&rows.at(-1).press.pointer==='touch');if(sheet)await sheet.evaluate(n=>n.remove());
  }
  const result={browserVersion:browser.version(),cpu:4,rows};fs.writeFileSync(folder+'/tap-probe.json',JSON.stringify(result,null,2));console.log('TASK031 TAP PROBE',JSON.stringify(result));
 }finally{await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
