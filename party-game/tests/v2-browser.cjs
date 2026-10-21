'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const URL='http://127.0.0.1:8765/party-game/';
async function configureOnly(page,id) {
  await page.locator('#go-advanced').click();
  await page.locator('#mode-settings > summary').click();
  await page.locator('#mode-toggles input[value="'+id+'"]').check({force:true});
  const inputs=page.locator('#mode-toggles input');
  for(let i=0;i<await inputs.count();i++){
    const current=inputs.nth(i);
    if(await current.getAttribute('value')!==id)await current.uncheck({force:true});
  }
  assert.equal(await page.locator('#mode-toggles input:checked').count(),1);
}
(async()=>{
  fs.mkdirSync('artifacts/quip-v2',{recursive:true});
  const browser=await chromium.launch({
    executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
    headless:true,args:['--no-sandbox']
  });
  try{
    for(const device of [{name:'phone',width:390,height:844,dpr:2},{name:'desktop',width:1440,height:900,dpr:1}]){
      const page=await browser.newPage({viewport:{width:device.width,height:device.height},deviceScaleFactor:device.dpr});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(URL,{waitUntil:'load'});
      await page.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
      await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
      await page.locator('[data-setting="difficulty"] [data-value="hard"]').click();
      await configureOnly(page,'yesno');
      assert.equal(await page.locator('[data-setting="dice"]').count(),0,'Old dice choice must be removed');
      await page.locator('#finish-rounds').check({force:true});
      await page.locator('#custom-rounds').evaluate(el=>{el.value='4';el.dispatchEvent(new Event('input',{bubbles:true}))});
      await page.locator('#base-duration').evaluate(el=>{el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}))});
      assert.equal(await page.locator('#base-duration').inputValue(),'60');
      await page.screenshot({path:'artifacts/quip-v2/'+device.name+'-settings.png',fullPage:true});
      await page.locator('#advanced-done').click();
      await page.locator('#start-game').click();
      assert.equal(await page.locator('#round-total').textContent(),'4');
      await page.locator('[data-action="roll"]').click();
      await page.waitForSelector('[data-action="toggle-word"]',{timeout:5500});
      const state=await page.evaluate(()=>({mode:game.current.modeId,
        challenge:game.current.word,
        duration:game.duration,points:game.current.points,dice:game.dice,
        member:getPromptPool('people','hard').includes(game.current.word)}));
      assert.equal(state.mode,'yesno');
      assert.equal(state.member,true,'Expected real or fictional identity');
      assert.equal(state.points,2,'V4 Danetki have a fixed two-point base reward');
      assert.equal(state.duration,60);
      assert.equal(state.dice,true,'Carousel is the only normal game selection method');
      const icon=page.locator('.mode-symbol img.mode-art');
      assert.equal(await icon.getAttribute('src'),'./assets/modes/yesno.webp?v=3','Danetki must display the mystery-person icon');
      assert.ok(await icon.evaluate(el=>el.complete&&el.naturalWidth>=256),'Generated artwork not loaded');
      await page.screenshot({path:'artifacts/quip-v2/'+device.name+'-yesno.png',fullPage:true});
      await page.locator('[data-action="toggle-word"]').click();
      assert.equal(await page.locator('[data-action="start-timer"]').count(),0,'Hard game must auto-start');
      assert.equal(await page.locator('[data-action="pause"]').count(),0,'Hard game must not offer pause');
      await page.waitForSelector('#active-timer',{timeout:4000});
      const timer=await page.locator('#active-timer').evaluate(element=>({
        text:element.textContent,
        width:element.getBoundingClientRect().width,
        children:element.children.length
      }));
      assert.equal(timer.children,0,'Timer must be a single uninterrupted string');
      assert.match(timer.text,/^1:(2[0-9]|30)$/,'Per-mode timer is not used: '+timer.text);
      await page.screenshot({path:'artifacts/quip-v2/'+device.name+'-timer.png',fullPage:true});
      await page.evaluate(()=>{game.current.deadline=Date.now()-10;tick()});
      await page.locator('[data-action="yes"]').click();
      assert.equal(await page.locator('#score-b').textContent(),String(state.points));
      await page.reload();
      await page.locator('#continue-game').click();
      assert.equal(await page.locator('#score-b').textContent(),String(state.points));
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<=2,'Horizontal overflow '+overflow);
      assert.deepEqual(errors,[],'Browser JS errors');
      console.log(device.name,JSON.stringify({state,timer,overflow,errors}));
      await page.close();
    }
    const blitz=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    const errs=[];blitz.on('pageerror',e=>errs.push(e.message));
    await blitz.goto(URL,{waitUntil:'load'});
      await blitz.evaluate(()=>{chooseStartingTeam=()=>0;options.awardTo='guesser';options.complications=false});
    await blitz.locator('#new-game-menu').click();
      await blitz.locator('#standard-game').click();
    await configureOnly(blitz,'blitz');
    await blitz.locator('#advanced-done').click();
    await blitz.locator('#start-game').click();
    await blitz.locator('[data-action="roll"]').click();
    await blitz.waitForSelector('[data-action="toggle-word"]');
    await blitz.locator('[data-action="toggle-word"]').click();
    await blitz.locator('[data-action="start-timer"]').click();
    assert.equal(await blitz.locator('.blitz-status').count(),1);
    const start=await blitz.evaluate(()=>game.current.deadline);
    for(const action of ['blitz-correct','blitz-skip','blitz-correct']){
      await blitz.locator('[data-action="'+action+'"]').click();
    }
    assert.equal(await blitz.locator('[data-action="yes"]').count(),0,'Skipped words must return');
    await blitz.locator('[data-action="blitz-correct"]').click();
    assert.equal(await blitz.locator('[data-action="yes"]').count(),1);
    const stats=await blitz.evaluate(()=>({correct:game.current.blitzCorrect,
      remaining:game.current.blitzQueue.length,count:game.current.blitzWords.length}));
    assert.deepEqual(stats,{correct:3,remaining:0,count:3});
    await blitz.screenshot({path:'artifacts/quip-v2/phone-blitz-result.png',fullPage:true});
    await blitz.locator('[data-action="yes"]').click();
    assert.equal(await blitz.locator('#score-b').textContent(),'2');
    assert.deepEqual(errs,[],'Blitz JS errors');
    await blitz.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
