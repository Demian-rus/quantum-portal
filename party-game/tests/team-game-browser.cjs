'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs');
const {provisionTeamProfiles,chooseTeamProfiles,duplicateTeamProfileRejected}=require('./team-profile-fixtures.cjs');
const {settled}=require('./task024-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-teams';
const names=[['ДС','ПА'],['Мама','Папа']];
const idle=async p=>{await p.evaluate(()=>QuipTeams.whenIdle());assert.equal(await p.evaluate(()=>QuipTeams.blocked),false,await p.locator('#team-save-message').textContent());};
async function click(p,selector){if(selector==='#timer-pause-control'&&!await p.locator(selector).count())selector='.timer-ring[role="button"]';await p.locator(selector).click();await idle(p);}
async function range(p,id,value){await p.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));},String(value));}
async function config(p,{mode='talk',rounds=12,goal=null,complications=false,risk=false,difficulty='easy'}={}){
 await p.locator('[data-wizard-step="3"]').click();await p.locator('[data-setting="difficulty"] [data-value="'+difficulty+'"]:visible').click();
 await p.locator(goal?'#finish-score':'#finish-rounds').check();await range(p,goal?'target-score':'custom-rounds',goal||rounds);
 if(!await p.locator('#wizard-extra').evaluate(n=>n.open))await p.locator('#wizard-extra > summary').click();
 await p.locator('#toggle-complications').setChecked(complications);await p.locator('#toggle-risk').setChecked(risk);if(complications)await range(p,'modifier-chance',100);
 const wanted=p.locator('#mode-toggles input[value="'+mode+'"]');if(!await wanted.isChecked())await wanted.locator('..').tap();
 for(const el of await p.locator('#mode-toggles input').all())if(await el.inputValue()!==mode&&await el.isChecked())await el.locator('..').tap();
 await p.locator('[data-wizard-step="4"]').click();assert.match(await p.locator('#wizard-summary').textContent(),/2 НА 2/);
}
async function start(p,settings={},bits=[0,0,0]){
 await provisionTeamProfiles(p,names);await p.locator('#new-game-menu').click();await p.locator('#standard-game').click();const protectedBefore=await protectedRaw(p);await p.locator('#wizard-format-teams').click();
 await chooseTeamProfiles(p,names);await duplicateTeamProfileRejected(p);
 await p.locator('#wizard-format-duel').click();await p.locator('#wizard-format-teams').click();assert.match(await p.locator('#team-profile-0-0').textContent(),new RegExp(names[0][0]),'format toggle retains profile draft');
 await config(p,settings);await p.evaluate(bits=>{window.originalRandom=Math.random;window.openingDraws=0;Math.random=()=>bits[openingDraws++]===1 ? .75 : .25;},bits);
 await click(p,'#start-game');assert.equal(await p.evaluate(()=>openingDraws),3,'three opening draws only');await p.evaluate(()=>{Math.random=originalRandom;soundOn=false;});
 assert.equal(await p.evaluate(()=>activeScene),'game');assert.equal(await p.evaluate(()=>game.awardTo),'setter');return protectedBefore;
}
async function select(p){await click(p,'[data-action="roll"]');await p.waitForFunction(()=>game.phase==='task');await idle(p);}
async function begin(p){await click(p,'[data-action="toggle-word"]');if(await p.evaluate(()=>game.phase==='task'))await click(p,'[data-action="start-timer"]');await p.waitForFunction(()=>game.phase==='play');await idle(p);}
async function answer(p,{success=true,base=false,shared='both',blitzSkip=false}={}){
 await select(p);const c=await p.evaluate(()=>JSON.parse(JSON.stringify(game.current))),before=await p.evaluate(()=>game.scores.slice()),team=await p.evaluate(()=>currentTeamIndex());
 if(c.modeId==='approx'){assert.match(await p.locator('.play-subtitle').textContent(),/Каждая команда/);await click(p,'[data-action="reveal-approx"]');await click(p,'[data-action="award-'+shared+'"]');}
 else{await begin(p);if(c.modeId==='blitz'){
  assert.equal(c.blitzWords.length,3);assert.equal(c.basePoints,2);if(blitzSkip)await click(p,'[data-action="blitz-skip"]');for(let n=0;n<(success?3:2);n++)await click(p,'[data-action="blitz-correct"]');
  if(!success)await click(p,'[data-action="finish-early"]');await click(p,'[data-action="'+(success?'yes':'no')+'"]');
 }else await click(p,'[data-action="'+(success?base?'base-now':'correct-now':'wrong-now')+'"]');}
 const row=await p.evaluate(()=>JSON.parse(JSON.stringify(game.history.at(-1))));assert.equal(row.setterIndex,team);assert.equal(row.guesserIndex,team);
 assert.notEqual(row.setter,row.guesser);assert.equal(row.teamRoles.recipientTeamIndex,team);
 const after=await p.evaluate(()=>game.scores.slice());if(c.modeId!=='approx'){assert.equal(after[1-team],before[1-team]);assert.equal(after[team],success?before[team]+c.basePoints+(base?0:c.modifierPoints):Math.max(0,before[team]-(c.risk?2:0)));}
 await p.evaluate(()=>QuipTeamsEngine.validateRecord(QuipTeams.record()));return {c,row,before,after};
}
const protectedRaw=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>!k.startsWith('kvip:teams-2x2:')).map(k=>[k,localStorage.getItem(k)])));
const raw=p=>p.evaluate(()=>localStorage.getItem(QuipTeamStorage.KEY));
async function seedDuel(p){await provisionProfiles(p);await p.evaluate(()=>{soundOn=false;Object.assign(options,{modes:['talk'],difficulty:'easy',dice:false,finishType:'rounds',rounds:8,complications:false,riskRounds:false});newGame();game.dice=false;roll();game.phase='judge';recordAnswer(true);roll();toggleWord();startTimer();pauseTimer();game.dice=true;options=sanitizeOptions(options);persist();backToMenu();});}
async function geometry(p,label,measurements){await settled(p);const row=await p.evaluate(()=>{const r=n=>{const a=n.getBoundingClientRect();return {x:a.x,y:a.y,right:a.right,bottom:a.bottom,width:a.width,height:a.height};};const card=document.querySelector('.challenge-card'),action=document.querySelector('[data-action="roll"]');return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,card:card?r(card):null,action:action?r(action):null,footer:document.querySelector('.wizard-footer')?.getClientRects().length?r(document.querySelector('.wizard-footer')):null,content:r($('play-content')),buttons:[...document.querySelectorAll('#scene-game button,#scene-wizard button')].filter(n=>n.getClientRects().length).map(n=>({label:n.getAttribute('aria-label')||n.textContent,...r(n)}))};});assert(row.documentWidth<=row.width+1,label+' document overflow');if(row.action)assert(row.action.bottom<=row.height+1,label+' handoff action visible');if(row.footer)assert(row.footer.bottom<=row.height+1,label+' wizard footer visible');measurements.push({label,...row});return row;}
module.exports={URL,names,idle,click,range,config,start,select,begin,answer,protectedRaw,raw,seedDuel};
if(require.main===module)(async()=>{fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']}),measurements=[];
 try{
  // UI creates real games, runs native timers/actions and writes through SHA-256
  // + native Web Locks. No injected engine, fake commit or prebuilt game fixture.
  for(const [index,viewport]of [{width:320,height:568},{width:390,height:844},{width:844,height:390}].entries()){
   const ctx=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{await p.goto(URL+'?setup=wizard');await seedDuel(p);const duelGame=await p.evaluate(()=>JSON.stringify(game));
    const duel=await start(p,{rounds:[4,8,12][index]},[index%2,1,0]);await geometry(p,'handoff '+viewport.width,measurements);await p.screenshot({path:folder+'/'+viewport.width+'-handoff.png'});
    for(let i=0;i<[4,8,12][index];i++){
     const r=await p.evaluate(()=>QuipTeamsEngine.roles(game));assert.equal(r.teamIndex,(index%2+i)%2);assert.equal(r.setterPlayerIndex,([1,0][r.teamIndex]+Math.floor(i/2))%2);
     if(i===1){await select(p);const hidden=await geometry(p,'hidden '+viewport.width,measurements);await click(p,'[data-action="toggle-word"]');const visible=await geometry(p,'visible '+viewport.width,measurements);assert.deepEqual(visible.card,hidden.card,'v88 task card stays fixed on reveal');await click(p,'[data-action="start-timer"]');const playing=await geometry(p,'timer '+viewport.width,measurements);assert.deepEqual(playing.card,hidden.card,'v88 task card stays fixed in timer');await click(p,'[data-action="correct-now"]');}
     else await answer(p,{success:i!==2});
    }
    assert.equal(await p.evaluate(()=>game.phase),'review');await click(p,'#match-team-a');await click(p,'#result-history-backdrop [data-review-tab="'+(index%2)+'"]');await click(p,'#result-history-backdrop [data-review-turn="0"] [data-review-choice="failed"]');assert.equal(await p.evaluate(()=>document.activeElement.closest('#result-history-backdrop')!==null&&document.activeElement.dataset.reviewChoice==='failed'),true,'editing modal retains focus inside the active editor');await p.keyboard.press('Escape');await idle(p);assert.equal(await p.evaluate(()=>document.activeElement.id),'match-team-a','Escape restores the history trigger');await click(p,'.is-result-review [data-review-tab="'+(index%2)+'"]');
    if(index===2){const list=p.locator('.pending-review-rows');await list.evaluate(n=>n.scrollTop=n.scrollHeight);const scroll=await list.evaluate(n=>n.scrollTop);assert(scroll>0,'landscape history really overflows');await click(p,'.pending-review-rows [data-review-turn="10"] [data-review-choice="failed"]');assert.equal(await list.evaluate(n=>n.scrollTop),scroll,'editing a lower turn retains the bounded history scroll');await click(p,'.pending-review-rows [data-review-turn="10"] [data-review-choice="complete"]');}
    await click(p,'.pending-review-rows [data-review-turn="0"] [data-review-choice="failed"]');const corrected=await p.evaluate(()=>game.scores.slice());
    await click(p,'.pending-review-rows [data-review-turn="0"] [data-review-choice="complete"]');const final=await p.evaluate(()=>game.scores.slice());assert.equal(final[index%2],corrected[index%2]+1);
    await click(p,'[data-action="confirm-results"]');assert.equal(await p.evaluate(()=>game.phase),'results');assert.match(await p.locator('#team-result-roster').textContent(),/статистика четырёх профилей/);
    const saved=await raw(p);await p.locator('#results-content [data-review-expand="0"]').click();assert.match(await p.locator('#review-details-results-0').textContent(),/Загадывал:.*Отгадывал:/);assert.equal(await p.locator('#results-content [data-review-choice]').count(),0);assert.equal(await raw(p),saved,'completed disclosure is read-only');
    await click(p,'[data-action="menu"]');const homeTargets=await p.locator('#scene-home button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {id:n.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};}));
    for(const a of homeTargets){assert(a.x>=0&&a.y>=0&&a.right<=viewport.width+1&&a.bottom<=viewport.height+1,'home target inside viewport '+a.id);assert(a.w>=44&&a.h>=44,'home touch target '+a.id);for(const b of homeTargets)if(a!==b)assert(!(a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5),'home buttons overlap '+a.id+'/'+b.id);}
    await p.screenshot({path:folder+'/'+viewport.width+'-home.png'});assert.equal(await p.evaluate(()=>QuipTeams.active),false);assert.equal(await p.evaluate(()=>JSON.stringify(game)),duelGame);assert.deepEqual(await protectedRaw(p),duel,'team game never writes duel, profiles or backups');
    await click(p,'#continue-game');assert.equal(await p.evaluate(()=>JSON.stringify(game)),duelGame);await p.locator('#exit-game').click();await click(p,'#continue-teams');assert.equal(await p.evaluate(()=>game.phase),'results');
    await click(p,'[data-action="menu"]');await p.locator('#team-archive-open').click();const modal=await p.locator('#team-data-backdrop').boundingBox();assert.deepEqual(modal,{x:0,y:0,width:viewport.width,height:viewport.height},'team archive is a fixed viewport dialog');assert.equal(await p.locator('.site-shell').evaluate(n=>n.inert),true);await p.goBack();await p.locator('#team-data-backdrop').waitFor({state:'hidden'});assert.equal(await p.locator('.site-shell').evaluate(n=>n.inert),false);assert.equal(await raw(p),saved,'Android Back closes own data without writes');
    await p.locator('#new-game-menu').click();await p.locator('#standard-game').click();await p.locator('#wizard-format-teams').click();await p.locator('#wizard-format-duel').click();assert.deepEqual(await protectedRaw(p),duel,'format toggle preserves duel exactly');
    assert.equal(await p.locator('#wizard-legacy,#setup-interface-toggle').count(),0);assert.equal(await p.evaluate(()=>QuipTeams.active),false);assert.equal(new globalThis.URL(p.url()).searchParams.has('setup'),false);assert.equal(await raw(p),saved);assert.deepEqual(errors,[]);
    console.log('TASK028 UI',viewport.width,'real 4/8/12 turns / roles / awards / correction / completion / profiles / format switch / Back / fixed card PASS');
   }catch(e){await p.screenshot({path:folder+'/'+viewport.width+'-failure.png'});throw e;}finally{await ctx.close();}
  }
  // Each mode is selected through the real wizard; no mode is silently disabled.
  for(const mode of ['talk','mime','draw','sing','yesno','secret','blitz','approx']){
   const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage();
   try{await p.goto(URL+'?setup=wizard');await start(p,{mode,rounds:4,complications:true,risk:true},[1,0,1]);const first=await answer(p,{base:mode==='yesno',blitzSkip:true});if(!['approx'].includes(mode))assert.ok(first.c.complication);if(mode==='approx')assert.deepEqual(first.after,[1,1]);
    // Pause in a real active task, restore its exact snapshot cold and offline.
    await select(p);if(mode!=='approx'){await begin(p);await click(p,'#timer-pause-control');}
    const before=await raw(p),snapshot=await p.evaluate(()=>JSON.stringify(game));await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await p.reload();await click(p,'#continue-teams');assert.equal(await raw(p),before);assert.equal(await p.evaluate(()=>JSON.stringify(game)),snapshot,'offline full snapshot '+mode);
    if(mode!=='approx'){await click(p,'#timer-pause-control');if(mode==='blitz'){for(let n=0;n<3;n++)await click(p,'[data-action="blitz-correct"]');await click(p,'[data-action="yes"]');}else await click(p,'[data-action="correct-now"]');}else{await click(p,'[data-action="reveal-approx"]');await click(p,'[data-action="award-a"]');}
    console.log('TASK028 mode',mode,'real actions / modifiers / isolated save / offline restart PASS');
   }finally{await ctx.close();}
  }
  fs.writeFileSync(folder+'/measurements.json',JSON.stringify(measurements,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
