'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const {URL,idle,click,start,select,begin,answer,raw,seedDuel}=require('./team-game-browser.cjs');
const duel=p=>p.evaluate(()=>({raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY)}));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  try{
   await p.goto(URL+'?setup=wizard');await seedDuel(p);await start(p,{rounds:12,risk:true,complications:true},[0,0,0]);const originalDuel=await duel(p);
   await answer(p);await answer(p);await p.evaluate(()=>{window.savedRandom=Math.random;Math.random=()=>0;});const risk=await answer(p,{success:false});assert.equal(risk.c.risk,true);await p.evaluate(()=>{Math.random=savedRandom;});
   // Native review holds the timer, changes a historical outcome and resumes
   // the exact same selected card/roles/plans. Replays must never consume RNG.
   await select(p);await begin(p);await click(p,'#timer-pause-control');
   const selected=await p.evaluate(()=>JSON.stringify([game.current.word,game.current.teamRoles,game.modePlannerState,game.riskPlannerState,game.plannerState]));
   await p.evaluate(()=>{window.savedRandom=Math.random;Math.random=()=>{throw Error('Unexpected review RNG')};});
   await click(p,'#match-team-a');await click(p,'#result-history-backdrop [data-review-turn="0"] [data-review-choice="failed"]');await click(p,'#result-history-save');
   assert.equal(await p.evaluate(()=>JSON.stringify([game.current.word,game.current.teamRoles,game.modePlannerState,game.riskPlannerState,game.plannerState])),selected);assert.equal(await p.evaluate(()=>game.current.paused),true);
   await p.evaluate(()=>{Math.random=savedRandom;});
   // Card reports use the existing archive; the team clock hold is durable.
   await click(p,'[data-feedback="report"]');assert.ok(await p.evaluate(()=>game.current.feedbackHold));await p.locator('#report-reason').selectOption('other');await p.locator('#report-comment').fill('Проверка командной карточки');await click(p,'#report-save');assert.equal(await p.evaluate(()=>game.current.feedbackHold==null),true);assert.equal(await p.evaluate(()=>game.current.paused),true);
   await click(p,'#timer-pause-control');const activeRaw=await raw(p),activeGame=await p.evaluate(()=>JSON.stringify(game));
   await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await p.reload();await click(p,'#continue-teams');assert.equal(await raw(p),activeRaw);assert.equal(await p.evaluate(()=>JSON.stringify(game)),activeGame,'unpaused cold offline timer is exact');
   await p.evaluate(()=>{window.nowBefore=Date.now;Date.now=()=>nowBefore()+120000;tick();});await idle(p);assert.equal(await p.evaluate(()=>game.phase),'judge');await p.evaluate(()=>{Date.now=nowBefore;});await click(p,'[data-action="no"]');await ctx.setOffline(false);
   // Two real tabs with the same durable snapshot. The stale tab must not
   // select a task, consume RNG, or replace the winner's newer revision.
   const b=await ctx.newPage();await b.goto(URL+'?setup=wizard');await click(b,'#continue-teams');const stale=await raw(p);await select(p);const newer=await raw(p);assert.notEqual(newer,stale);
   await b.evaluate(()=>{Math.random=()=>{throw Error('Stale action consumed RNG')};});await b.locator('[data-action="roll"]').click();await b.evaluate(()=>QuipTeams.whenIdle());assert.equal(await b.evaluate(()=>QuipTeams.blocked),true);assert.equal(await raw(b),newer);assert.match(await b.locator('#team-save-message').textContent(),/другой вкладке/);await b.close();
   // A held native lock blocks before running an action. No queued stale move.
   const lock=await ctx.newPage();await lock.goto(URL);await lock.evaluate(()=>{window.held=false;window.unlock=null;navigator.locks.request(QuipTeamStorage.LOCK,async()=>{held=true;await new Promise(r=>unlock=r)});});await lock.waitForFunction(()=>held);
   const beforeLock=await raw(p);await p.locator('[data-action="toggle-word"]').click();await p.evaluate(()=>QuipTeams.whenIdle());assert.equal(await p.evaluate(()=>QuipTeams.blocked),true);assert.equal(await raw(p),beforeLock);await lock.evaluate(()=>unlock());await lock.close();await click(p,'#team-reload');
   // Quota failure before journal creation never reveals the selected action.
   const beforeQuota=await raw(p),beforeGame=await p.evaluate(()=>JSON.stringify(game));await p.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===QuipTeamStorage.JOURNAL_KEY)throw new DOMException('quota','QuotaExceededError');return originalSet.call(this,k,v)}});
   await p.locator('[data-action="toggle-word"]').click();await p.evaluate(()=>QuipTeams.whenIdle());assert.equal(await p.evaluate(()=>QuipTeams.blocked),true);assert.equal(await raw(p),beforeQuota);assert.equal(await p.evaluate(()=>JSON.stringify(game)),beforeGame);await p.evaluate(()=>{Storage.prototype.setItem=originalSet});await click(p,'#team-reload');
   // Failure AFTER primary write keeps a validated before/after journal. Only
   // explicit recovery may choose either action; no automatic blind rollback.
   const beforePending=await raw(p);await p.evaluate(()=>{window.originalRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(k===QuipTeamStorage.JOURNAL_KEY)throw Error('cleanup fault');return originalRemove.call(this,k)}});
   await p.locator('[data-action="toggle-word"]').click();await p.evaluate(()=>QuipTeams.whenIdle());assert.equal(await p.evaluate(()=>QuipTeams.blocked),true);const afterPending=await raw(p);assert.notEqual(afterPending,beforePending);assert.ok(await p.evaluate(()=>localStorage.getItem(QuipTeamStorage.JOURNAL_KEY)));await p.evaluate(()=>{Storage.prototype.removeItem=originalRemove});
   await p.locator('#team-reload').click();await p.locator('#team-recover-before:visible').waitFor();await p.locator('#team-recover-before').click();await p.locator('#team-data-backdrop').waitFor({state:'hidden'});assert.equal(await raw(p),beforePending);await click(p,'#continue-teams');
   assert.deepEqual(await duel(p),originalDuel,'all failures retain exact unfinished duel and profiles');
   // New party stores the exact previous unfinished team match in its archive.
   await click(p,'#exit-game');const previous=await p.evaluate(()=>QuipTeams.record());await start(p,{mode:'blitz',rounds:4},[1,1,1]);const record=await p.evaluate(()=>QuipTeams.record());assert.equal(record.archives.length,1);assert.deepEqual(record.archives[0],{version:1,teamFormat:previous.teamFormat,game:previous.game,options:previous.options,taskMemory:previous.taskMemory});
   await answer(p,{success:false});assert.equal(await p.evaluate(()=>game.history[0].review.result.blitzCorrect),2);assert.deepEqual(await duel(p),originalDuel);
   assert.deepEqual(errors,[]);console.log('TASK028 safety PASS: risk / live history + replay / report + held clock / unpaused offline timer + expiry / stale tabs + RNG / native lock / quota / pending recovery / exact archived match / duel+profiles');
  }finally{await ctx.close();}
  // Actual score finish, guaranteed reply and the shared numerical tie-break.
  const score=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),q=await score.newPage();
  try{await q.goto(URL+'?setup=wizard');await start(q,{goal:15},[0,1,0]);for(let i=0;i<29;i++)await answer(q);assert.deepEqual(await q.evaluate(()=>game.scores),[15,14]);assert.equal(await q.evaluate(()=>game.phase),'ready');await answer(q);await click(q,'[data-action="confirm-results"]');assert.equal(await q.evaluate(()=>game.phase),'tiebreak');
   await click(q,'[data-action="tiebreak-reveal"]');await click(q,'[data-action="tiebreak-same"]');assert.equal(await q.evaluate(()=>game.tiebreak.attempted.length),2);await click(q,'[data-action="tiebreak-reveal"]');await click(q,'[data-action="tiebreak-b"]');await click(q,'[data-action="confirm-results"]');assert.equal(await q.evaluate(()=>game.phase),'results');assert.deepEqual(await q.evaluate(()=>game.scores),[15,16]);assert.equal(await q.evaluate(()=>profileStore?.recent.length??0),0);console.log('TASK028 real score-goal / reply / same-distance next question / tiebreak / final confirmation / no individual stats PASS');
  }finally{await score.close();}
  const protectedContext=await browser.newContext({viewport:{width:320,height:568}}),r=await protectedContext.newPage();
  try{await r.goto(URL+'?setup=wizard');await r.evaluate(()=>localStorage.setItem(QuipTeamStorage.KEY,'{"version":99,"keep":"original"}'));await r.reload();await r.locator('#continue-teams').click();await r.locator('#team-data-backdrop:visible').waitFor();assert.equal(await r.evaluate(()=>localStorage.getItem(QuipTeamStorage.KEY)),'{"version":99,"keep":"original"}');assert.equal(await r.locator('#team-recover-after').isVisible(),false);await r.locator('#team-data-close').click();
   await r.locator('#new-game-menu').click();await r.locator('#standard-game').click();await r.locator('#wizard-format-teams').click();await r.locator('[data-wizard-step="4"]').click();assert.equal(await r.locator('#start-game').isDisabled(),true);assert.equal(await r.evaluate(()=>localStorage.getItem(QuipTeamStorage.KEY)),'{"version":99,"keep":"original"}');
  }finally{await protectedContext.close();}
  const unsupported=await browser.newContext(),u=await unsupported.newPage();
  try{await u.addInitScript(()=>Object.defineProperty(Navigator.prototype,'locks',{get:()=>undefined}));await u.goto(URL+'?setup=wizard');await u.locator('#new-game-menu').click();await u.locator('#standard-game').click();assert.equal(await u.locator('#wizard-format-teams').isDisabled(),true);assert.match(await u.locator('#team-format-unavailable').textContent(),/не поддерживает/);assert.equal(await u.evaluate(()=>storageBlocked),false);console.log('TASK028 unknown-slot preservation / no destructive reset / Web Locks unavailable explanation PASS');}
  finally{await unsupported.close();}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
