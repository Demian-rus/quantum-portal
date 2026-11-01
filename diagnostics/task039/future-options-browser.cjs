'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const T=require('../task038/browser-tools.cjs');
const OUT=path.join(T.ROOT,'artifacts/quip-task039');
async function ready(p){await p.evaluate(()=>QuipTeams.whenReady());}
async function chance(p,value){
 await T.tap(p,'[data-wizard-step="3"]');
 await p.locator('#modifier-chance').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);
 await p.evaluate(()=>flushSetupRangeWrite());
 assert.equal(await p.evaluate(()=>options.modifierChance),value);
}
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});const server=await T.serve(T.ROOT),browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN,args:['--no-sandbox']}: {})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
 const report={browser:browser.version(),physicalDevice:false,checks:[]};p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 try{
  await p.goto(server.url);await ready(p);await T.seed(p);
  const original=await T.raw(p),match=await p.evaluate(()=>JSON.stringify(game)),matchId=await p.evaluate(()=>game.matchId);
  await T.wizard(p,'duel');await p.evaluate(()=>{Object.assign(options,{modes:['yesno'],awardTo:'guesser',complications:true,modifierChance:100});persist();renderOptions();});
  // The established compatibility rule removes guesser-only Danetki when
  // switching the recipient. That genuine empty choice must survive reload.
  await T.tap(p,'[data-wizard-step="2"]');await T.tap(p,'#award-policy-choices [data-value="setter"]');
  assert.equal(await p.evaluate(()=>options.modes.length),0,'recipient compatibility leaves an explicit empty choice');
  await chance(p,10);assert.equal(await p.evaluate(()=>options.modes.length),0);
  const first=await T.raw(p);assert.equal(first['iskra-party:v1'],original['iskra-party:v1']);
  assert.equal(first['kvip:teams-2x2:v1'],original['kvip:teams-2x2:v1']);
  await p.reload();await ready(p);assert.equal(await p.evaluate(()=>options.modifierChance),10);assert.equal(await p.evaluate(()=>options.modes.length),0);
  assert.equal(await p.evaluate(()=>JSON.stringify(game)),match);assert.deepEqual(await T.raw(p),first);
  report.checks.push('100→10 and empty modes survive reload; paused duel and isolated team RAW remain exact');

  await T.wizard(p,'duel');await T.tap(p,'[data-wizard-step="3"]');await T.tap(p,'#wizard-mode-settings');await p.locator('#mode-toggles input[value="talk"]').check();await chance(p,30);
  await p.reload();await ready(p);assert.equal(await p.evaluate(()=>options.modifierChance),30);assert.deepEqual(await p.evaluate(()=>options.modes),['talk']);
  const edited=await T.raw(p);assert.equal(edited['iskra-party:v1'],original['iskra-party:v1']);
  await T.wizard(p,'teams');const teamEntry=await T.raw(p),future=JSON.parse(teamEntry['iskra-party:future-options:v1']);
  assert.equal(future.options.modifierChance,30);assert.deepEqual(future.options.modes,['talk']);
  for(const key of Object.keys(edited).filter(k=>k!=='iskra-party:future-options:v1'))assert.equal(teamEntry[key],edited[key],key+' remains exact on entering team setup');
  await T.configure(p,{modes:['mime'],difficulty:'medium'});
  assert.deepEqual(await T.raw(p),teamEntry,'team setup cannot write duel preferences or either party');
  await p.reload();await ready(p);await T.tap(p,'#continue-teams');assert(await p.evaluate(()=>game.current.paused));await T.tap(p,'#exit-game');
  assert.equal(await p.evaluate(()=>options.modifierChance),30);assert.deepEqual(await T.raw(p),teamEntry);
  report.checks.push('repeated edits and team Wizard/reload/Continue/exit preserve future duel preferences and both parties');

  await T.wizard(p,'duel');await T.configure(p);await T.tap(p,'#start-game');
  assert.notEqual(await p.evaluate(()=>game.matchId),matchId);assert.equal(await p.evaluate(()=>game.modifierChance),30);assert.equal(await p.evaluate(()=>game.rulesVersion),6);
  const started=await T.raw(p);assert.equal(started['kvip:teams-2x2:v1'],original['kvip:teams-2x2:v1']);
  await p.reload();await ready(p);assert.equal(await p.evaluate(()=>options.modifierChance),30);assert.equal((await T.raw(p))['iskra-party:v1'],started['iskra-party:v1']);
  report.checks.push('real new START adopts updated options; stale prior sidecar cannot override it after reload');
  assert.deepEqual(errors,[]);report.success=true;console.log(JSON.stringify(report));
 }catch(e){report.error=e.stack;await p.screenshot({path:path.join(OUT,'future-options-failure.png')}).catch(()=>{});throw e;}
 finally{fs.writeFileSync(path.join(OUT,'future-options.json'),JSON.stringify(report,null,2));await context.close();await browser.close();await new Promise(r=>server.server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
