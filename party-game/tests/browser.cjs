'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
(async()=>{
  fs.mkdirSync('artifacts/iskra',{recursive:true});
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox']
  });
  try{
    for(const profile of [
      {name:'phone',width:390,height:844,dpr:2},
      {name:'tablet',width:768,height:1024,dpr:1},
      {name:'desktop',width:1440,height:900,dpr:1}
    ]){
      const page=await browser.newPage({
        viewport:{width:profile.width,height:profile.height},
        deviceScaleFactor:profile.dpr
      });
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/party-game/',{waitUntil:'load'});
      await page.waitForSelector('#new-game-menu');
      assert.ok(await page.locator('#new-game-menu').isVisible());
      assert.equal(await page.locator('#continue-game').isDisabled(),true);
      assert.equal(await page.locator('#scene-home').isVisible(),true);
      const home=await page.evaluate(()=>({width:document.documentElement.scrollWidth,
        bodyWidth:window.innerWidth,button:document.getElementById('new-game-menu').getBoundingClientRect().height}));
      if(home.width>home.bodyWidth+2) {
        const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')]
          .map(e=>({tag:e.tagName,cls:e.className?.baseVal||e.className||'',
            right:Math.round(e.getBoundingClientRect().right),
            left:Math.round(e.getBoundingClientRect().left)}))
          .filter(o=>o.right>window.innerWidth+1).slice(0,12));
        console.log('MOBILE OVERFLOW ELEMENTS',JSON.stringify(offenders));
      }
      assert.ok(home.width<=home.bodyWidth+2,'home horizontal scrolling '+JSON.stringify(home));
      assert.ok(home.button>=52,'touch target too small');
      await page.screenshot({path:'artifacts/iskra/'+profile.name+'-home.png',fullPage:true});
      await page.locator('#settings-menu').click();
      assert.equal(await page.locator('#scene-preferences').isVisible(),true);
      await page.locator('#sound-toggle').uncheck();
      assert.equal(await page.locator('#sound-toggle').isChecked(),false);
      await page.locator('#preferences-back').click();
      await page.locator('#new-game-menu').click();
      await page.fill('#team-a','Крутые коты');
      await page.fill('#team-b','Синие кометы');
      await page.locator('[data-setting="difficulty"] [data-value="medium"]').click();
      await page.locator('[data-setting="rounds"] [data-value="8"]').click();
      await page.locator('[data-setting="duration"] [data-value="45"]').click();
      assert.equal(await page.locator('#scene-preferences').isVisible(),false);
      await page.locator('#start-game').click();
      assert.equal(await page.locator('#scene-game').isVisible(),true);
      await page.waitForSelector('[data-action="roll"]');
      assert.equal(await page.locator('#label-team-a').textContent(),'Крутые коты');
      assert.equal(await page.locator('#round-total').textContent(),'8');
      await page.screenshot({path:'artifacts/iskra/'+profile.name+'-ready.png',fullPage:true});
      await page.locator('[data-action="roll"]').click();
      await page.waitForSelector('[data-action="toggle-word"]',{timeout:5500});
      assert.equal(await page.locator('.challenge-word').textContent(),'НАЖМИ, ЧТОБЫ ОТКРЫТЬ');
      await page.locator('[data-action="toggle-word"]').click();
      assert.notEqual(await page.locator('.challenge-word').textContent(),'НАЖМИ, ЧТОБЫ ОТКРЫТЬ');
      assert.equal(await page.locator('[data-action="start-timer"]').count(),0,'Medium timer must start automatically');
      await page.waitForSelector('#active-timer',{timeout:4000});
      assert.equal(await page.locator('[data-action="pause"]').count(),0,'Medium timer cannot pause');
      await page.screenshot({path:'artifacts/iskra/'+profile.name+'-timer.png',fullPage:true});
      await page.evaluate(()=>{game.current.deadline=Date.now()-50;tick();});
      await page.waitForSelector('[data-action="yes"]',{timeout:4000});
      assert.equal(await page.locator('[data-action="no"]').count(),1);
      await page.screenshot({path:'artifacts/iskra/'+profile.name+'-judge.png',fullPage:true});
      await page.locator('[data-action="yes"]').click();
      const scored=Number(await page.locator('#score-a').textContent());
      assert.ok(scored>=0&&scored<=3,'wrong awarded points '+scored);
      assert.equal(await page.locator('#round-now').textContent(),'2');
      await page.reload({waitUntil:'load'});
      assert.equal(await page.locator('#scene-home').isVisible(),true);
      assert.equal(await page.locator('#continue-game').isEnabled(),true);
      await page.locator('#continue-game').click();
      await page.waitForSelector('[data-action="roll"]');
      assert.equal(Number(await page.locator('#score-a').textContent()),scored,'lost saved score');
      assert.equal(await page.locator('.topbar').count(),1);
      const dims=await page.evaluate(()=>({width:document.documentElement.scrollWidth,
        viewport:window.innerWidth,play:document.querySelector('.play-card').getBoundingClientRect().width}));
      assert.ok(dims.width<=dims.viewport+2,'game horizontal scroll: '+JSON.stringify(dims));
      assert.deepEqual(errors,[],'Uncaught browser errors');
      console.log(profile.name,JSON.stringify({home,scored,dims,errors}));
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
