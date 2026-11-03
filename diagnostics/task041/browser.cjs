'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright-core'),T=require('../task038/browser-tools.cjs');
const width=Number(process.env.TASK041_WIDTH||390),engine=process.env.TASK041_ENGINE||'chromium',OUT=path.join(T.ROOT,'artifacts/quip-task041',engine+'-'+width);
async function run(){
 fs.mkdirSync(OUT,{recursive:true});const server=await T.serve(T.ROOT),type=engine==='webkit'?webkit:chromium,browser=await type.launch({headless:true,...(engine==='chromium'&&process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN,args:['--no-sandbox']}: {})}),ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],report={width,engine,checks:[]};p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{assert.equal(d.type(),'confirm');assert(d.message().includes('сохранена в отдельном архиве'));await d.accept()});p.setDefaultTimeout(20000);await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 try{
  await p.goto(server.url);await p.evaluate(()=>QuipTeams.whenReady());await T.seed(p,4);await T.wizard(p,'duel');await T.tap(p,'[data-wizard-step="3"]');await p.evaluate(()=>{selectAwardTo('guesser');options.modes=MODE_LIST.map(m=>m.id);renderOptions()});await T.tap(p,'#wizard-mode-settings');
  assert.equal(await p.locator('[data-task-difficulty]').count(),8);
  for(const [i,mode]of ['talk','mime','draw','sing','yesno','secret','blitz','approx'].entries()){
   const choice=mode==='secret'?'method':['easy','medium','hard'][i%3],button=p.locator('[data-task-mode="'+mode+'"][data-task-choice="'+choice+'"]');
   if(!await button.isEnabled())throw Error(mode+'/'+choice+' unexpectedly disabled: '+await button.getAttribute('title'));
   await button.tap();await T.idle(p);assert.equal(await button.getAttribute('aria-pressed'),'true');
  }
  const policy=await p.evaluate(()=>JSON.stringify(readTaskDifficultyPreferences().policy)),saved=await p.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  const sizes=await p.locator('[data-task-mode]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height}}));assert(sizes.every(r=>r.width>=44&&r.height>=44),'all new difficulty targets are at least 44px');await T.inspect(p,OUT,'mode-controls',1,{baseline:true});await p.screenshot({path:path.join(OUT,'modes.png'),fullPage:true});
  await T.tap(p,'#wizard-rules-done');await T.tap(p,'[data-wizard-step="4"]');assert(await p.locator('#wizard-summary').innerText().then(t=>t.includes('Сложности заданий')&&t.includes('Средняя')));
  await p.reload();await p.evaluate(()=>QuipTeams.whenReady());assert.equal(await p.evaluate(()=>JSON.stringify(readTaskDifficultyPreferences().policy)),policy);assert.equal(await p.evaluate(()=>localStorage.getItem(STORAGE_KEY)),saved);
  report.checks.push('eight native independent selections, no active RAW write, exact preference reload and summary');
  for(const kind of ['duel','teams']){
   await T.wizard(p,kind);await T.configure(p,{modes:['draw'],difficulty:'hard'});await T.tap(p,'#start-game');await T.tap(p,'[data-action="roll"]');await p.waitForFunction(()=>game.phase==='task');await T.idle(p);
   assert.equal(await p.evaluate(()=>QUIP_EDITORIAL_EDITION.records[game.current.cardId][3][2]),'3','draw setting is independent of general rules');
   const snapshot=await p.evaluate(()=>JSON.stringify(game.current));await p.reload();await p.evaluate(()=>QuipTeams.whenReady());await T.tap(p,kind==='teams'?'#continue-teams':'#continue-game');assert.equal(await p.evaluate(()=>JSON.stringify(game.current)),snapshot);
   await T.tap(p,'[data-action="toggle-word"]');await T.inspect(p,OUT,kind+'-task',1,{baseline:true});await T.tap(p,'#exit-game');
  }
  await T.wizard(p,'duel');await T.tap(p,'[data-wizard-step="1"]');await T.tap(p,'#wizard-category-summary');
  // Actual category controls empty the song pool; the requested level remains unchanged.
  await T.tap(p,'[data-category-id="music"]');await p.evaluate(()=>{options.modes=['sing'];renderOptions()});await T.tap(p,'[data-wizard-step="3"]');await T.tap(p,'#wizard-mode-settings');
  assert.equal(await p.locator('[data-task-mode="sing"][data-task-choice="easy"]').isEnabled(),false);assert(await p.locator('[data-task-difficulty="sing"] [role="status"]').innerText().then(t=>t.includes('Нет подходящих заданий')));
  assert.equal(await p.evaluate(()=>JSON.stringify(readTaskDifficultyPreferences().policy)),policy);
  await T.inspect(p,OUT,'empty-song-pool',1,{baseline:true});assert.deepEqual(errors,[]);report.success=true;report.checks.push('real draw ID/reload in 1x1 and 2x2; real empty pool disables level with reason and no fallback');
 }catch(error){report.error=error.stack;await p.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});throw error;}
 finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await ctx.tracing.stop({path:path.join(OUT,'trace.zip')});await ctx.close();await browser.close();await new Promise(r=>server.server.close(r));console.log(JSON.stringify(report));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
