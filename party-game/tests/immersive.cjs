'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const URL='http://127.0.0.1:8765/party-game/';
(async()=>{
  fs.mkdirSync('artifacts/iskra-immersive',{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  try{
    for(const device of [
      {width:360,height:640,name:'small-phone'},
      {width:390,height:844,name:'phone'},
      {width:412,height:915,name:'large-phone'},
      {width:1440,height:900,name:'desktop'}
    ]){
      const page=await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.width<500?2:1});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(URL,{waitUntil:'load'});
      await page.waitForSelector('#new-game-menu',{state:'visible'});
      const home=await page.evaluate(()=>{
        const e=document.getElementById('scene-home');
        const background=getComputedStyle(document.body,'::before');
        return {scroll:document.documentElement.scrollHeight,viewport:innerHeight,
          gameDisabled:document.getElementById('continue-game').disabled,
          bg:background.backgroundImage,
          button:document.getElementById('new-game-menu').getBoundingClientRect().height};
      });
      assert.equal(home.gameDisabled,true);
      assert.ok(home.bg.includes('bg-home.webp'),JSON.stringify(home));
      assert.ok(home.scroll<=home.viewport+2,'Home scrolls: '+JSON.stringify(home));
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-home.png',fullPage:true});
      await page.locator('#new-game-menu').click();
      await page.locator('[data-setting="difficulty"] [data-value="medium"]').click();
      assert.equal(await page.locator('#scene-setup').isVisible(),true);
      const setup=await page.evaluate(()=>({
        bg:getComputedStyle(document.body,'::before').backgroundImage,
        viewport:innerHeight,pageScroll:document.documentElement.scrollHeight,
        scroller:document.getElementById('setup-scroll').scrollHeight,
        viewHeight:document.getElementById('setup-scroll').clientHeight
      }));
      assert.ok(setup.bg.includes('bg-setup.webp'),JSON.stringify(setup));
      assert.ok(setup.pageScroll<=setup.viewport+2,'Setup scrolls whole document');
      if(device.width<500 && setup.scroller>setup.viewHeight){
        const scrolled=await page.locator('#setup-scroll').evaluate(el=>{
          el.scrollTop=el.scrollHeight;
          return el.scrollTop>0;
        });
        assert.ok(scrolled,'Long setup form must scroll inside its own pane');
        await page.locator('#setup-scroll').evaluate(el=>el.scrollTop=0);
      }
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-setup.png',fullPage:true});
      await page.locator('#go-advanced').click();
      assert.equal(await page.locator('#scene-advanced').isVisible(),true);
      const before=await page.evaluate(()=>getComputedStyle(document.body,'::before').backgroundImage);
      await page.locator('#advanced-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
      const after=await page.evaluate(()=>getComputedStyle(document.body,'::before').backgroundImage);
      assert.equal(before,after,'Backdrop should stay fixed behind scrolling options');
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-advanced.png',fullPage:true});
      await page.locator('#advanced-done').click();
      await page.locator('#start-game').click();
      assert.equal(await page.locator('#scene-game').isVisible(),true);
      const ready=await page.evaluate(()=>({
        viewport:innerHeight,scroll:document.documentElement.scrollHeight,
        bg:getComputedStyle(document.body,'::before').backgroundImage,
        viewScroll:document.getElementById('scene-game').scrollHeight,
        viewHeight:document.getElementById('scene-game').clientHeight
      }));
      assert.ok(ready.bg.includes('bg-game.webp'),JSON.stringify(ready));
      assert.ok(ready.scroll<=ready.viewport+2,'Game scrolls document');
      assert.ok(ready.viewScroll<=ready.viewHeight+3,'Game itself overflows: '+JSON.stringify(ready));
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-ready.png',fullPage:true});
      await page.evaluate(()=>{soundOn=false;persist();});
      await page.locator('[data-action="roll"]').click();
      await page.waitForSelector('.reel-window',{state:'visible'});
      const images=await page.locator('.reel-item img').count();
      assert.ok(images>=35,'The reel needs repeating tiles, not a final card: '+images);
      const first=await page.evaluate(()=>{
        const t=document.getElementById('reel-track');
        return {x:t.getBoundingClientRect().left,items:t.children.length};
      });
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-reel.png',fullPage:true});
      await page.waitForSelector('.reel-item--landed',{timeout:4500});
      const landing=await page.evaluate(()=>{
        const windowEl=document.getElementById('reel-window');
        const winner=document.querySelector('.reel-item--winner');
        const before=winner.previousElementSibling;
        const after=winner.nextElementSibling;
        const rect=windowEl.getBoundingClientRect();
        const w=winner.getBoundingClientRect();
        const left=before.getBoundingClientRect(),right=after.getBoundingClientRect();
        return {target:game.current.modeId,winner:winner.dataset.mode,
          centerError:Math.abs((w.left+w.right)/2-(rect.left+rect.right)/2),
          beforeVisible:left.right>rect.left+1,afterVisible:right.left<rect.right-1,
          leftId:before.dataset.mode,rightId:after.dataset.mode,
          x:document.getElementById('reel-track').getBoundingClientRect().left,
          loaded:[...windowEl.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth===256)
        };
      });
      assert.equal(landing.winner,landing.target,'Carousel displayed the wrong selected mode');
      assert.ok(landing.centerError<=3,'The selected icon did not land at center: '+JSON.stringify(landing));
      assert.ok(landing.beforeVisible&&landing.afterVisible,
        'The reel must have visible tiles BOTH before and after the winner: '+JSON.stringify(landing));
      assert.ok(landing.x>first.x+500,'The carousel did not travel from left to right: '+JSON.stringify({first,landing}));
      assert.ok(landing.loaded,'Some of the new WebP icons failed to load');
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-reel-landed.png',fullPage:true});
      await page.waitForSelector('[data-action="toggle-word"]',{timeout:5000});
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-task.png',fullPage:true});
      await page.locator('#exit-game').click();
      assert.equal(await page.locator('#scene-home').isVisible(),true);
      assert.equal(await page.locator('#continue-game').isEnabled(),true);
      await page.reload({waitUntil:'load'});
      assert.equal(await page.locator('#continue-game').isEnabled(),true);
      await page.locator('#continue-game').click();
      assert.equal(await page.locator('#scene-game').isVisible(),true);
      await page.locator('[data-action="toggle-word"]').click();
      await page.waitForSelector('#active-timer',{timeout:4500});
      assert.equal(await page.locator('.ring-svg .ring-progress').count(),1);
      await page.screenshot({path:'artifacts/iskra-immersive/'+device.name+'-circular-timer.png',fullPage:true});
      const state=await page.evaluate(()=>({
        scroll:document.documentElement.scrollHeight,
        h:innerHeight,gameScroll:document.getElementById('scene-game').scrollHeight,
        gameHeight:document.getElementById('scene-game').clientHeight,
        ringDash:getComputedStyle(document.getElementById('timer-progress')).strokeDasharray
      }));
      assert.ok(state.scroll<=state.h+2,'Timer causes body scroll: '+JSON.stringify(state));
      assert.ok(state.gameScroll<=state.gameHeight+3,'Timer scene overflows: '+JSON.stringify(state));
      assert.deepEqual(errors,[],'Uncaught JavaScript errors');
      console.log(device.name,JSON.stringify({home,setup,ready,state}));
      await page.close();
    }
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(URL,{waitUntil:'load'});
    const manifest=await page.evaluate(async()=>{
      const response=await fetch('./manifest.webmanifest');return response.json();
    });
    assert.equal(manifest.display,'standalone','Should install with no browser toolbar');
    assert.equal(manifest.icons.length,2);
    assert.equal(await page.locator('link[rel="manifest"]').count(),1);
    await page.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
