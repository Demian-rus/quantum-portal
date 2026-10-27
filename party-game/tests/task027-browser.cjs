'use strict';
const {setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter}=require('./wizard-ui.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,devices}=require('playwright-core');
const {chooseNamedProfile}=require('./profile-fixtures.cjs');
const base=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-task027';
const scene=async(p,id)=>p.locator('#scene-'+id).waitFor({state:'visible'});
const step=async(p,n)=>{await p.locator('[data-wizard-step="'+n+'"]').click();await p.locator('[data-wizard-page="'+n+'"]:visible').waitFor();};
async function range(p,id,value){const el=p.locator('#'+id);await el.focus();await el.press('Home');for(let n=Number(await el.getAttribute('min'));n<value;n+=Number(await el.getAttribute('step')))await el.press('ArrowRight');assert.equal(await el.inputValue(),String(value));}
async function modes(p,ids){for(const id of ids){const el=p.locator('#mode-toggles input[value="'+id+'"]');if(!await el.isChecked())await el.locator('..').tap();}for(const el of await p.locator('#mode-toggles input').all())if(!ids.includes(await el.inputValue())&&await el.isChecked())await el.locator('..').tap();}
const snapshot=p=>p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),game:JSON.stringify(game),profiles:localStorage.getItem(QUIP_PROFILES_KEY),memory:JSON.stringify(taskMemory),options:JSON.stringify(options),selected:JSON.stringify(selectedProfileIds)}));
async function geometry(p,label,measurements){
 const row=await p.locator('#scene-wizard').evaluate(root=>{const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const scroll=$('wizard-scroll');return {viewport:{width:innerWidth,height:innerHeight},scene:rect(root),header:rect(root.querySelector('.wizard-header')),steps:rect(root.querySelector('.wizard-steps')),scroll:rect(scroll),footer:rect(root.querySelector('.wizard-footer')),overflow:scroll.scrollWidth-scroll.clientWidth,documentWidth:document.documentElement.scrollWidth,activeTargets:[...root.querySelectorAll('button:not(:disabled),input[type="range"],.mode-choice label')].filter(n=>n.getClientRects().length).map(n=>({text:n.textContent.trim().slice(0,35),...rect(n)}))};});
 assert(row.documentWidth<=row.viewport.width+1,label+' document width');assert(row.overflow<=1,label+' scroll width');assert(row.scroll.y>=row.steps.bottom-1&&row.scroll.bottom<=row.footer.y+1,label+' one scroll plane, no sticky overlap');assert(row.footer.bottom<=row.viewport.height+1,label+' footer visible');
 for(const target of row.activeTargets)assert(target.width>=44&&target.height>=44,label+' touch area '+JSON.stringify(target));measurements.push({label,...row});
}
async function standard(p){await p.locator('#new-game-menu').click();await scene(p,'wizard');await p.locator('#standard-game').click();await p.locator('[data-wizard-page="2"]:visible').waitFor();}
async function settle(p,yes){await p.locator('[data-action="roll"]').click();await p.locator('[data-action="toggle-word"]').waitFor({timeout:7000});await p.locator('[data-action="toggle-word"]').click();await p.locator('[data-action="start-timer"]').click();await p.locator('[data-action="'+(yes?'correct-now':'wrong-now')+'"]').click();}
(async()=>{fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']}),measurements=[];
 try{for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  const ctx=await browser.newContext({...devices['Pixel 7'],viewport,deviceScaleFactor:2.625,isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(base);await p.locator('#new-game-menu').click();await scene(p,'wizard');await geometry(p,'catalog '+viewport.width,measurements);await p.screenshot({path:folder+'/'+viewport.width+'-1-game.png'});
   await p.locator('#standard-game').click();await chooseNamedProfile(p,0,'Первый игрок');await chooseNamedProfile(p,1,'Второй игрок');await geometry(p,'profiles '+viewport.width,measurements);
   await setupStep(p,2);await p.locator('#award-policy-choices [data-value="guesser"]').click();await step(p,3);await geometry(p,'rules '+viewport.width,measurements);
   assert.equal(await p.locator('#mode-toggles .mode-gear').count(),0);assert.equal(await p.locator('#mode-toggles input').count(),8);
   for(const el of await p.locator('#mode-toggles input').all()){if(!await el.isChecked())await el.locator('..').tap();await el.locator('..').tap();await el.locator('..').tap();}
   await p.locator('#wizard-mode-settings').click();await p.locator('#wizard-rules:visible').waitFor();assert.equal(await p.locator('[data-wizard-rule]').count(),8);
   assert.match(await p.locator('[data-wizard-rule="blitz"]').textContent(),/3\/3 → \+2/);assert.match(await p.locator('[data-wizard-rule="approx"]').textContent(),/Без таймера/);
   await p.locator('[data-song-language="en"]').click();await p.locator('[data-song-language="ru"]').click();await p.locator('[data-song-language="en"]').click();assert.equal(await p.locator('[data-song-language="en"]').getAttribute('aria-pressed'),'true','nonempty real source guard');
   await geometry(p,'mode center '+viewport.width,measurements);await p.screenshot({path:folder+'/'+viewport.width+'-3-modes.png'});await p.goBack();await p.locator('#wizard-mode-settings:visible').waitFor();assert.equal(await p.evaluate(()=>document.activeElement.id),'wizard-mode-settings');
   // A future configuration bonus must flow to every read-only timer display,
   // including the union of Secret methods; no literal +30 in the adapter.
   const timerProbe=await p.evaluate(()=>{window.__originalModeConfig=getModeConfig;getModeConfig=(...args)=>{const c=__originalModeConfig(...args);return {...c,durationBonus:c.durationBonus+7};};return options.duration;});
   await p.locator('#wizard-mode-settings').click();assert.equal(await p.locator('[data-wizard-rule="secret"] .wizard-mode-time').textContent(),'Время: '+(timerProbe+7)+' или '+(timerProbe+37)+' с, по выбранному способу');assert.equal(await p.locator('[data-wizard-rule="draw"] .wizard-mode-time').textContent(),'Время: '+(timerProbe+37)+' с');
   await p.evaluate(()=>{getModeConfig=__originalModeConfig;delete window.__originalModeConfig;});await p.locator('#wizard-rules-done').click();
   await p.locator('#wizard-mode-settings').click();await p.keyboard.press('Escape');assert.equal(await p.locator('[data-wizard-page="3"]').isVisible(),true);
   await p.locator('#finish-rounds').check();await range(p,'custom-rounds',2);await range(p,'base-duration',75);await p.locator('#wizard-extra > summary').click();await p.locator('#toggle-complications').uncheck();await p.locator('#toggle-risk').uncheck();await modes(p,['talk']);
   await step(p,4);await geometry(p,'review '+viewport.width,measurements);assert.match(await p.locator('#wizard-summary').textContent(),/Первый игрок.*Второй игрок/s);assert.match(await p.locator('#wizard-summary').textContent(),/75 с/);await p.screenshot({path:folder+'/'+viewport.width+'-4-start.png'});
   await startFromSetup(p);await scene(p,'game');assert.equal(await p.evaluate(()=>game.profileMatch.participants.length),2);assert.equal(await p.evaluate(()=>game.duration),75);assert.equal(await p.evaluate(()=>game.songLanguages),undefined,'Talk-only party has no fabricated song policy');
   await settle(p,true);const earned=await snapshot(p);assert.equal(await p.evaluate(()=>game.roundIndex),1);
   // Leave the real match intact while changing only presentation of next setup.
   await p.locator('#exit-game').click();await standard(p);await step(p,3);const before=await snapshot(p);assert.equal(await p.locator('#wizard-legacy,#setup-interface-toggle').count(),0);await p.goBack();await p.locator('[data-wizard-page="2"]:visible').waitFor();assert.deepEqual(await snapshot(p),before,'Wizard Back preserves exact RAW, settings, match and profiles');await p.locator('#wizard-back').click();await p.locator('#wizard-back').click();await p.locator('#continue-game').click();await scene(p,'game');assert.equal((await snapshot(p)).game,earned.game);
   await settle(p,false);await p.locator('[data-action="confirm-results"]').waitFor();const stats=await p.evaluate(()=>profileStore.recent.length);const owner=await p.evaluate(()=>game.history[0].recipientIndex);await p.locator('.is-result-review [data-review-tab="'+owner+'"]').click();
   await p.locator('.pending-review-rows [data-review-turn="0"] [data-review-choice="failed"]').click();assert.deepEqual(await p.evaluate(()=>game.scores),[0,0]);await p.locator('.pending-review-rows [data-review-turn="0"] [data-review-choice="complete"]').click();await p.locator('[data-action="confirm-results"]').click();await scene(p,'results');assert.equal(await p.evaluate(()=>profileStore.recent.length),stats+1);
   const completed=await snapshot(p);await p.reload();assert.equal((await snapshot(p)).profiles,completed.profiles,'No duplicate stats on restore');await p.locator('#new-game-menu').click();await scene(p,'wizard');await setupBack(p,'game-type-back');
   // App preferences have no interface switch; select an actual theme.
   await p.locator('#settings-menu').click();assert.equal(await p.locator('#setup-interface-toggle').count(),0);await p.locator('#preferences-back').click();await p.locator('#new-game-menu').click();await p.locator('#thematic-game').click();await p.locator('#theme-list [data-theme="geography"]:enabled').click();await step(p,3);assert.equal(await p.locator('#mode-toggles input[value="sing"]').isDisabled(),true);await step(p,4);await startFromSetup(p);await scene(p,'game');assert.equal(await p.evaluate(()=>game.contentPack.id),'geography');
   await p.locator('[data-action="roll"]').click();await p.locator('[data-action="toggle-word"]').waitFor({timeout:7000});const themeTask=await p.evaluate(()=>game.current.word);assert.ok(themeTask);const saved=await snapshot(p);
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await p.reload();await p.locator('#continue-game').click();assert.deepEqual(await snapshot(p),saved,'Cold offline restore preserves exact real match and task');
   assert.equal(await p.evaluate(()=>game.current.word),themeTask);await ctx.setOffline(false);assert.deepEqual(errors,[]);
   console.log('TASK027 mobile',viewport.width,viewport.height,'real profiles / all mode toggles / language / Back / true match / edit+confirm / single setup route / themes / offline PASS');
  }catch(e){await p.screenshot({path:folder+'/'+viewport.width+'-failure.png'});throw e;}finally{await ctx.close();}
 }
 fs.writeFileSync(folder+'/measurements.json',JSON.stringify(measurements,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
