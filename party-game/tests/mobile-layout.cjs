'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const {provisionProfiles,chooseNamedProfile}=require('./profile-fixtures.cjs');
const {capture}=require('./screenshots.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright-core');
const URL='http://127.0.0.1:8765/party-game/';
const devices=[
  {name:'narrow',width:320,height:568},
  {name:'small',width:360,height:640},
  {name:'phone',width:390,height:844},
  {name:'android',width:412,height:915},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'desktop',width:1280,height:800},
  {name:'wide-desktop',width:1920,height:1080}
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
  '.is-ready .ready-avatar','.is-ready .play-subtitle',
  '.is-ready .ready-content','.is-ready [data-action="roll"]',
  '#label-team-a','#score-a','.reel-window','.reel-item img',
  '.reel-track','.play-inner',
  '.is-task .challenge-card[data-action="toggle-word"]',
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
    await require('./task013b-browser.cjs')(browser,URL);
    await require('./round-layout.cjs')(browser,URL);
    await require('./storage-protection.cjs')(browser,URL);
    await require('./task-history-browser.cjs')(browser,URL);
    await require('./modifiers-v2-browser.cjs')(browser,URL);
    await require('./mode-compatibility-browser.cjs')(browser,URL);
    await require('./dictionary-browser.cjs')(browser,URL);
    await require('./estimation-browser.cjs')(browser,URL);
    await require('./thematic-game.cjs')(browser,URL);
    await require('./modifier-frequency.cjs')(browser,URL);
    await require('./mode-settings-browser.cjs')(browser,URL);
    await require('./round-outcomes.cjs')(browser,URL);
    await require('./award-policy.cjs')(browser,URL);
    await require('./rules-guide.cjs')(browser,URL);
    await require('./ui-task005.cjs')(browser,URL);
    for(const device of devices) {
      const page=await browser.newPage({
        viewport:{width:device.width,height:device.height},
        deviceScaleFactor:device.width<=500?2:1
      });
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(URL,{waitUntil:'load'});await provisionProfiles(page);
      await page.evaluate(()=>{chooseStartingTeam=()=>0;options.complications=false});
      await page.locator('#scene-home').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
      const homeButtons=await page.evaluate(()=>{
        const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
        return {settings:rect('settings-menu'),other:rect('other-games-menu'),footnote:document.querySelector('.home-footnote').getBoundingClientRect().top};
      });
      assert.ok(homeButtons.other.height>=44,'Other-games touch target too small');
      assert.ok(homeButtons.other.top>homeButtons.settings.bottom+4,'Other-games button overlaps main menu');
      assert.ok(homeButtons.other.bottom<homeButtons.footnote,'Other-games button overlaps footer');
      await page.locator('#other-games-menu').click();
      await page.locator('#scene-other-games').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
      const gallery=await page.evaluate(()=>{
        const r=document.getElementById('other-games-grid').getBoundingClientRect();
        return {left:r.left,right:r.right,width:r.width,page:document.documentElement.scrollWidth,
          cells:[...document.querySelectorAll('.other-game-image')].map(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}})};
      });
      assert.equal(gallery.cells.length,6);
      for(const cell of gallery.cells)assert.ok(Math.abs(cell.width-cell.height)<=1,'Gallery image is not square');
      assert.ok(Math.abs(gallery.cells[0].y-gallery.cells[2].y)<=1,'Expected three tiles in first row');
      assert.ok(Math.abs(gallery.cells[3].y-gallery.cells[5].y)<=1,'Expected three tiles in second row');
      assert.ok(gallery.cells[3].y>gallery.cells[0].bottom,'Gallery rows overlap');
      assert.ok(Math.abs(gallery.left-(device.width-gallery.right))<=2,'Gallery is not centered');
      assert.ok(gallery.page<=device.width+2,'Gallery causes horizontal overflow');
      assert.equal(await page.locator('#other-games-grid a, #other-games-grid button').count(),0);
      await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-other-games.png'});
      await page.locator('#other-games-back').click();
      await page.locator('#scene-home').waitFor({state:'visible'});
      await page.locator('#new-game-menu').click();
      assert.equal(await page.locator('#wizard-catalog').isVisible(),true);
      for(const id of ['standard-game','thematic-game']){
        const box=await page.locator('#'+id).boundingBox();
        assert.ok(box&&box.width>=44&&box.height>=44,'Game-type touch target too small');
      }
      await page.locator('#wizard-catalog').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
      await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-game-type.png'});
      await page.locator('#thematic-game').click();
      assert.equal(await page.locator('#wizard-themes').isVisible(),true);
      assert.equal(await page.locator('#theme-list button:disabled').count(),3);
      assert.equal(await page.locator('#theme-list button:not(:disabled)').count(),3);
      assert.equal(await page.locator('[data-theme="geography"]:enabled').count(),1);
      assert.equal(await page.locator('[data-theme="animals"]:enabled').count(),1);
      assert.ok((await page.locator('#themes-caption').textContent()).includes('Выберите тему'));
      const themeLayout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,
        cards:[...document.querySelectorAll('.theme-choice')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right}})}));
      assert.ok(themeLayout.w<=device.width+2&&themeLayout.h<=device.height+2,JSON.stringify(themeLayout));
      assert.ok(themeLayout.cards.every(r=>r.left>=0&&r.right<=device.width+1),'Theme card outside viewport');
      await page.locator('#wizard-themes').evaluate(el=>Promise.all(el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
      await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-themes.png'});
      await setupBack(page,'themes-back');
      await setupBack(page,'game-type-back');
      assert.equal(await page.locator('#scene-home').isVisible(),true);
      await page.locator('#new-game-menu').click();
      await page.locator('#standard-game').click();
      if(device.width>=780){
        const setup=await page.locator('#scene-wizard').evaluate(n=>({width:n.getBoundingClientRect().width,viewport:innerWidth,columns:getComputedStyle(document.querySelector('.wizard-steps')).gridTemplateColumns}));
        assert.ok(setup.width>=Math.min(device.width,850)-2,'Wizard uses its accepted readable width: '+JSON.stringify(setup));
        assert.equal(setup.columns.split(' ').length,4,'All four steps remain in one row');
        await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-setup.png'});
      }
      await chooseNamedProfile(page,0,'ПЕРВЫЙСУПЕРДЛИННЫЙИГРОК');
      await chooseNamedProfile(page,1,'ВТОРОЙСУПЕРДЛИННЫЙИГРОК');
      await page.evaluate(()=>{options.modes=['talk'];soundOn=false;persist()});
      await startFromSetup(page);
      // The scene enters with a 7px translateY animation. Compare settled
      // coordinates, not a transient animation frame immediately after start.
      await page.locator('#scene-game').evaluate(el=>Promise.all(
        el.getAnimations({subtree:false}).map(a=>a.finished.catch(()=>{}))));
      const ready=await take(page);
      fitsViewport(ready,device,'ready');
      const header=at(ready,'.play-card-head');
      const kicker=at(ready,'#play-step');
      const menu=at(ready,'#exit-game');
      const title=at(ready,'.is-ready .play-title');
      const readyContent=at(ready,'.is-ready .ready-content');
      const readyButton=at(ready,'.is-ready [data-action="roll"]');
      const avatar=at(ready,'.is-ready .ready-avatar');
      const description=at(ready,'.is-ready .play-subtitle');
      const titleTextWidth=await page.locator('.is-ready .play-title').evaluate(el=>{
        const range=document.createRange();range.selectNodeContents(el.firstChild);
        return range.getBoundingClientRect().width;
      });
      assert.ok(titleTextWidth<=title.width+2,
        'Word ЗАГАДЫВАЕТ is clipped: '+JSON.stringify({device,titleTextWidth,title}));
      if(device.width<780){
        assert.ok(avatar.top<device.height*.41,
          'Main artwork was moved down with CTA: '+JSON.stringify({device,avatar}));
        assert.ok(title.top<device.height*.68,
          'Main heading was moved down with CTA: '+JSON.stringify({device,title}));
      }
      assert.ok(description.bottom<readyButton.top-5,
        'Main description collides with the bottom CTA: '+JSON.stringify({device,description,readyButton}));
      const name=at(ready,'#label-team-a'),score=at(ready,'#score-a');
      assert.equal(await page.locator('#play-step').evaluate(el=>getComputedStyle(el).clipPath),'inset(50%)',
        'Phase context should be accessible without duplicating the visible team roles');
      assert.ok(menu.right<=header.right+1&&menu.left>=header.left,'Menu outside header');
      assert.ok(title.scrollWidth<=title.clientWidth+2,'ready heading horizontally clipped: '+JSON.stringify(ready));
      assert.ok(readyContent.scroll<=readyContent.client+3,'ready main copy vertically clipped: '+JSON.stringify(ready));
      assert.ok(name.right<=score.left+2,'long team name overlaps score: '+JSON.stringify(ready));
      assert.ok(readyButton.bottom<=device.height-2,'ready CTA clips at bottom: '+JSON.stringify(ready));
      assert.ok(readyButton.top>header.bottom,'ready CTA overlaps header: '+JSON.stringify(ready));
      await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-ready.png'});

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
      await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-carousel.png'});

      await page.locator('.is-task .challenge-card[data-action="toggle-word"]').waitFor({timeout:6500});
      const task=await take(page);
      fitsViewport(task,device,'task');
      const openButton=at(task,'.is-task .challenge-card[data-action="toggle-word"]');
      assert.ok(openButton&&openButton.width>=44&&openButton.height>=44,'Task card is not a usable touch target');
      assert.equal(await page.locator('.is-task .round-action[data-action="toggle-word"]').count(),0,'Separate visibility controls must be absent');
      assert.equal(await page.locator('.is-task .challenge-card').evaluate(el=>el.tagName),'BUTTON');
      await capture(page,{path:'artifacts/quip-mobile-layout/'+device.name+'-task.png'});

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

      await page.locator('.is-task .challenge-card[data-action="toggle-word"]').click();
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
