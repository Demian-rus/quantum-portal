'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
(async () => {
  fs.mkdirSync('artifacts', {recursive:true});
  const browser = await chromium.launch({
    executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome',
    headless:true, args:['--no-sandbox']
  });
  try {
    for (const viewport of [{width:1440,height:900,name:'desktop'},{width:390,height:844,name:'phone'}]) {
      const page = await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'});
      await page.locator('#start-screen [data-target="crossword"]').click();
      await page.waitForFunction(() => window.lastPlaced?.length>=10,{timeout:15000});
      for(const variant of ['square','free','diamond','cross']) {
        const oldVersion=await page.evaluate(()=>window.cwReadyVersion||0);
        await page.locator('#btn-open-settings').click();
        await page.locator('#settings-cw-variant [data-cw-variant="'+variant+'"]').click();
        await page.locator('#btn-settings-apply').click();
        await page.waitForFunction(({v,previous}) => window.cwReadyVersion>previous &&
          window.lastPlaced?.length>=10 && cwShape===v,
          {v:variant,previous:oldVersion},{timeout:15000});
        const measurement=await page.evaluate(() => {
          const canvas=document.getElementById('cv');
          const rect=canvas.getBoundingClientRect();
          const layout=cwLayout;
          const points=window.lastPlaced;
          const unique=new Set(points.map(p=>p.w)).size;
          const title=document.querySelector('.header-title')?.textContent;
          const ratio=Math.max(rect.width,rect.height)/Math.min(rect.width,rect.height);
          const horizontalOverflow=document.documentElement.scrollWidth-window.innerWidth;
          const first=points[0];
          const clickX=(layout.pad+(first.c-layout.c0+.5)*layout.cell)*rect.width/layout.width+rect.left;
          const clickY=(layout.pad+(first.r-layout.r0+.5)*layout.cell)*rect.height/layout.height+rect.top;
          canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:clickX,clientY:clickY}));
          return {frame:[layout.rows,layout.cols],canvas:[rect.width,rect.height],
            rowsMatch:activeR===first.r,colsMatch:activeC===first.c,
            count:points.length,unique,title,ratio,horizontalOverflow,
            physicalWidth:canvas.width,
            physicalHeight:canvas.height,
            cssPixelRatio:canvas.width / rect.width,
            cellCss:layout.cell,
            questionButtons:document.querySelectorAll('#cluesList .cw-clue-button').length,
            subtitleVisible:Boolean(document.querySelector('.header-inner .sub') && getComputedStyle(document.querySelector('.header-inner .sub')).display!=='none')};
        });
        assert.ok(measurement.count>=10,variant+' too few words');
        assert.ok(Math.abs(measurement.cssPixelRatio-1)<0.03,variant+' bitmap/CSS size mismatch: '+measurement.cssPixelRatio);
        assert.ok(Math.abs(measurement.physicalHeight-measurement.canvas[1])<2,
          variant+' vertical bitmap/CSS size mismatch');
        assert.equal(measurement.unique,measurement.count,variant+' repeated words');
        assert.ok(measurement.rowsMatch&&measurement.colsMatch,variant+' click mismatch');
        assert.equal(measurement.questionButtons,measurement.count,variant+' clue list mismatch');
        assert.ok(!measurement.subtitleVisible,'Obsolete subtitle still visible');
        assert.ok(measurement.horizontalOverflow<=2,variant+' horizontal overflow '+measurement.horizontalOverflow);
        if(variant==='square'){
          assert.equal(measurement.frame[0],measurement.frame[1],'Square grid not square');
          assert.ok(measurement.ratio<=1.01,'Square canvas distorted '+measurement.ratio);
        }
        console.log(viewport.name,variant,JSON.stringify(measurement));
        if(variant==='square'||variant==='free')
          await page.screenshot({path:'artifacts/'+viewport.name+'-'+variant+'.png',fullPage:true});
      }
      assert.deepEqual(errors,[],'Browser page errors: '+errors.join('; '));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1;});
