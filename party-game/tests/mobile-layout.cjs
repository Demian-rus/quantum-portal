'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const URL='http://127.0.0.1:8765/party-game/';
const devices=[
  {name:'narrow',width:320,height:568},
  {name:'small',width:360,height:640},
  {name:'phone',width:390,height:844},
  {name:'android',width:412,height:915},
  {name:'desktop',width:1280,height:800}
];
const geometry=()=>({
  viewport:{w:innerWidth,h:innerHeight},
  document:{h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth},
  scene:{h:document.getElementById('scene-game').clientHeight,
         sh:document.getElementById('scene-game').scrollHeight},
  rect(selector){
    const element=document.querySelector(selector);
    if(!element)return null;
    const r=element.getBoundingClientRect();
    return {x:r.left,y:r.top,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      width:r.width,height:r.height,client:element.clientHeight,scroll:element.scrollHeight,
      clientWidth:element.clientWidth,scrollWidth:element.scrollWidth};
  }
});
const selectors=[
  '.play-card','.play-card-head','#play-step','#exit-game','.is-ready .play-title',
  '.is-ready .ready-content','.is-ready [data-action="roll"]',
  '#label-team-a','#score-a','.reel-window','.reel-item img',
  '.reel-track','.play-inner',
  '.is-task .task-open [data-action="toggle-word"]',
  '.round-fixed-card','.round-bottom--task'
];
const take=async page=>page.evaluate(`(()=>{
  const g=(${geometry.toString()})();
  return {viewport:g.viewport,document:g.document,scene:g.scene,
    rects:Object.fromEntries(${JSON.stringify(selectors)}.map(sel=>[sel,g.rect(sel)]))};
})()`);
const at=(result,selector)=>result.rects[selector];
function fitsViewport(g,device,stage) {
  assert.ok(g.document.h<=device.height+3,'document height overflow '+stage+': '+JSON.stringify(g));
  assert.ok(g.document.w<=device.width+3,'document width overflow '+stage+': '+JSON.stringify(g));
  assert.ok(g.scene.sh<=g.scene.h+3,'game screen overflow '+stage+': '+JSON.stringify(g));
}
(async()=>{
  fs.mkdirSync('artifacts/quip-mobile-layout',{recursive:true});
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox']
  });
  try{
    for(const device of devices) {
      const page=await browser.newPage({
        viewport:{width:device.width,height:device.height},
        deviceScaleFactor:device.width<=500?2:1
      });
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(URL,{waitUntil:'load'});
      await page.locator('#new-game-menu').click();
      await page.locator('#team-a').fill('ПЕРВЫЙСУПЕРДЛИННЫЙИГРОК');
      await page.locator('#team-b').fill('ВТОРОЙСУПЕРДЛИННЫЙИГРОК');
      await page.evaluate(()=>{options.modes=['talk'];soundOn=false;persist()});
      await page.locator('#start-game').click();
      const ready=await take(page);
      fitsViewport(ready,device,'ready');
      const header=at(ready,'.play-card-head');
      const kicker=at(ready,'#play-step');
      const menu=at(ready,'#exit-game');
      const title=at(ready,'.is-ready .play-title');
      const readyContent=at(ready,'.is-ready .ready-content');
      const readyButton=at(ready,'.is-ready [data-action="roll"]');
      const name=at(ready,'#label-team-a'),score=at(ready,'#score-a');
      assert.ok(kicker.right<=menu.left-2,'header overlaps menu: '+JSON.stringify(ready));
      assert.ok(kicker.scroll<=kicker.client+2,'header label vertically clipped: '+JSON.stringify(ready));
      assert.ok(title.scrollWidth<=title.clientWidth+2,'ready heading horizontally clipped: '+JSON.stringify(ready));
      assert.ok(readyContent.scroll<=readyContent.client+3,'ready main copy vertically clipped: '+JSON.stringify(ready));
      assert.ok(name.right<=score.left+2,'long team name overlaps score: '+JSON.stringify(ready));
      assert.ok(readyButton.bottom<=device.height-2,'ready CTA clips at bottom: '+JSON.stringify(ready));
      assert.ok(readyButton.top>header.bottom,'ready CTA overlaps header: '+JSON.stringify(ready));
      await page.screenshot({path:'artifacts/quip-mobile-layout/'+device.name+'-ready.png'});

      await page.locator('[data-action="roll"]').click();
      await page.waitForSelector('.reel-window',{state:'visible'});
      const carousel=await take(page);
      fitsViewport(carousel,device,'rolling');
      const reel=at(carousel,'.reel-window');
      const art=at(carousel,'.reel-item img');
      const reelTrack=at(carousel,'.reel-track');
      assert.ok(art.width>=125,'Carousel icon is not enlarged: '+JSON.stringify(carousel));
      assert.ok(reel.bottom<=device.height-2,'Carousel clips bottom: '+JSON.stringify(carousel));
      assert.ok(reel.top>at(carousel,'.play-card-head').bottom,
        'Carousel overlaps header: '+JSON.stringify(carousel));
      assert.ok(reel.width<=at(carousel,'.play-inner').width+2,
        'Carousel wider than card: '+JSON.stringify(carousel));
      assert.ok(reelTrack.width>reel.width*3,'Carousel animation lost repeating track');
      await page.screenshot({path:'artifacts/quip-mobile-layout/'+device.name+'-carousel.png'});

      await page.locator('.is-task .task-open [data-action="toggle-word"]').waitFor({timeout:6500});
      const task=await take(page);
      fitsViewport(task,device,'task');
      const openButton=at(task,'.is-task .task-open [data-action="toggle-word"]');
      console.log('CTA-DIAG',device.name,JSON.stringify({readyButton,openButton,readyContent,readyInner:at(ready,'.play-inner'),taskInner:at(task,'.play-inner'),readyHead:at(ready,'.play-card-head'),taskHead:at(task,'.play-card-head'),readyCard:at(ready,'.play-card'),taskCard:at(task,'.play-card')}));
      assert.ok(openButton&&Math.abs(openButton.bottom-readyButton.bottom)<=3,
        'Ready/task bottom buttons differ: '+JSON.stringify({device,readyButton,openButton}));
      assert.ok(Math.abs(openButton.top-readyButton.top)<=3,
        'Ready/task button tops differ: '+JSON.stringify({device,readyButton,openButton}));
      await page.screenshot({path:'artifacts/quip-mobile-layout/'+device.name+'-task.png'});

      // Stress very long cards before testing the timer: the content must never
      // cover the action block or force a document scroll.
      await page.evaluate(()=>{
        game.current.word='СВЕРХПРОДОЛЖИТЕЛЬНОЕНЕВЕРОЯТНОЕПРЕВРАЩЕНИЕ';
        render();
      });
      const longTask=await take(page);
      fitsViewport(longTask,device,'long-task');
      assert.ok(at(longTask,'.round-fixed-card').bottom<=at(longTask,'.round-bottom--task').bottom,
        'Long card overlaps action region: '+JSON.stringify(longTask));

      await page.locator('.is-task .task-open [data-action="toggle-word"]').click();
      await page.locator('.is-task [data-action="start-timer"]').click();
      await page.locator('#active-timer').waitFor({timeout:2000});
      fitsViewport(await take(page),device,'play');
      await page.evaluate(()=>{game.current.deadline=Date.now()-5;tick()});
      await page.locator('.is-judge').waitFor({timeout:2000});
      fitsViewport(await take(page),device,'judge');
      assert.deepEqual(errors,[],'Browser errors on '+device.name);
      console.log('mobile-layout',device.name,
        JSON.stringify({readyBottom:readyButton.bottom,taskBottom:openButton.bottom,
          carouselIconWidth:art.width,carouselWidth:reel.width}));
      await page.close();
    }
  }finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
