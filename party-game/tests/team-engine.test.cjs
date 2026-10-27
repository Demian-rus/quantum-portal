'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSimulation,seededRandom}=require('../scripts/game-simulation.cjs');
function install(h){for(const file of ['team-format.js','team-engine.js'])if(h.eval('typeof '+(file==='team-format.js'?'QuipTeamFormat':'QuipTeamsEngine'))==='undefined')vm.runInContext(fs.readFileSync('party-game/'+file,'utf8'),h.context);h.eval('QuipTeamsEngine.install()');return h;}
const plain=v=>JSON.parse(JSON.stringify(v));
function start(settings={},bits=[0,0,0],seed=71){
 const h=install(createSimulation(seed)),legacy=new Map(h.storage);h.context.settings=settings;let draws=0;h.context.openingRandom=()=>bits[draws++] ? .75 : .25;
 h.eval(`var teamRecord=QuipTeamsEngine.createRecord({...options,finishType:'rounds',rounds:12,difficulty:'easy',modes:['talk'],complications:false,riskRounds:false,...settings},[['ДС','ПА'],['Мама','Папа']],{id:'engine-fixture-match-0001',random:openingRandom});
 game=teamRecord.game;options=teamRecord.options;taskMemory=teamRecord.taskMemory;game.dice=false;
 // The pure-engine suite injects a staging sink. Real durable actions are tested
 // separately through the browser controller and native HTTP/SW/localStorage.
 persist=()=>true;commitReviewState=(next,memory=taskMemory)=>{QuipTeamsEngine.validateRecord({...teamRecord,game:next,taskMemory:memory});game=next;taskMemory=memory;return true;};
 commitFeedbackClock=next=>{const before=game.current;game.current=next;try{QuipTeamsEngine.validateGame(game,taskMemory)}catch(e){game.current=before;throw e}};`);
 assert.equal(draws,3);h.legacy=legacy;return h;
}
function check(h){assert.equal(h.eval('QuipTeamsEngine.validateRecord({...teamRecord,game,taskMemory})'),true);assert.deepEqual(h.storage,h.legacy,'team mechanics cannot write duel/profile/backup keys');}
function answer(h,{success=true,modifier=true,shared='none'}={}){
 h.context.result={success,modifier,shared};h.eval(`roll();if(game.current.modeId==='approx'){revealApprox();awardApprox(result.shared)}else if(game.current.modeId==='blitz'){
 toggleWord();startTimer();for(let i=0;i<(result.success?3:2);i++)advanceBlitz(true);if(game.phase==='play')finishTimer('early');judge(result.success,result.modifier);
 }else{toggleWord();startTimer();if(game.phase==='countdown')beginAutomaticRound();recordAnswer(result.success,result.modifier)}`);check(h);
}
test('real task selection and settlement: all eight starts, 4/8/12 turns, team/partner rotation and no duel writes',()=>{
 for(const first of [0,1])for(const a of [0,1])for(const b of [0,1])for(const turns of [4,8,12]){
  const h=start({rounds:turns},[first,a,b]);
  for(let i=0;i<turns;i++){
   const roles=plain(h.eval('QuipTeamsEngine.roles(game)'));assert.equal(roles.teamIndex,(first+i)%2);assert.equal(roles.setterPlayerIndex,([a,b][roles.teamIndex]+Math.floor(i/2))%2);
   const before=plain(h.eval('game.scores'));answer(h);const row=plain(h.eval('game.history.at(-1)'));assert.equal(row.setter,roles.setterName);assert.equal(row.guesser,roles.guesserName);assert.equal(row.recipientIndex,roles.teamIndex);assert.equal(row.guesserIndex,roles.teamIndex);before[roles.teamIndex]++;assert.deepEqual(plain(h.eval('game.scores')),before);
  }
  assert.equal(h.eval('game.phase'),'review');h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');check(h);assert.equal(h.eval('profileStore.recent.length'),0);
 }
});
test('all eight real modes: native rewards, required modifiers, three-word Blitz and shared numeric outcomes',()=>{
 for(const mode of ['talk','mime','draw','sing','yesno','secret','blitz','approx'])for(const difficulty of ['easy','medium','hard']){
  const h=start({modes:[mode],difficulty,complications:true,modifierChance:100,rounds:4,riskRounds:true},[1,1,0],82);
  h.eval('roll()');check(h);assert.equal(h.eval('game.current.modeId'),mode);
  if(mode==='approx'){
   assert.equal(h.eval('game.current.usesTimer'),false);h.eval('revealApprox();awardApprox("both")');assert.deepEqual(plain(h.eval('game.scores')),[1,1]);
  }else{
   assert.equal(h.eval('game.current.complication.length>0'),true,mode+'/'+difficulty);
   if(mode==='blitz'){assert.equal(h.eval('game.current.blitzWords.length'),3);assert.equal(h.eval('game.current.basePoints'),2);h.eval('toggleWord();if(game.phase==="task")startTimer();if(game.phase==="countdown")beginAutomaticRound();advanceBlitz(true);advanceBlitz(false);advanceBlitz(true);advanceBlitz(true);judge(true)');}
   else h.eval('toggleWord();if(game.phase==="task")startTimer();if(game.phase==="countdown")beginAutomaticRound();recordAnswer(true)');
   assert.deepEqual(plain(h.eval('game.scores')),[0,h.eval('getModeConfig("'+mode+'").basePoints+1')]);
  }
  check(h);
 }
});
test('team guesser conditions are supported without awarding the opposing team, and base-only outcome is replayable',()=>{
 const h=start({modes:['yesno'],complications:true,modifierChance:100,rounds:4});h.eval('roll()');assert.equal(h.eval('QUIP_MODIFIERS_V2.find(m=>m.id===game.current.complicationId).actor'),'guesser');
 h.eval('toggleWord();startTimer();recordAnswer(true,false)');assert.deepEqual(plain(h.eval('game.scores')),[2,0]);assert.equal(h.eval('game.history[0].outcome'),'base-only');check(h);
});
test('risk uses real balanced planner and never subtracts points from the other team',()=>{
 const h=start({rounds:12,complications:true,modifierChance:100,riskRounds:true});
 answer(h);answer(h);h.eval('Math.random=()=>0;roll()');assert.equal(h.eval('game.current.risk'),true);const before=plain(h.eval('game.scores'));h.eval('game.phase="judge";recordAnswer(false)');
 assert.deepEqual(plain(h.eval('game.scores')),[Math.max(0,before[0]-2),before[1]]);check(h);
});
test('historical correction replays real team deltas and retains selected task/roles/planners without RNG',()=>{
 const h=start({rounds:8});for(let i=0;i<4;i++)answer(h);h.eval('roll();toggleWord();startTimer();pauseTimer()');
 const selected=h.eval('JSON.stringify([game.current,game.riskPlannerState,game.modePlannerState,game.plannerState])');
 h.eval(`Math.random=()=>{throw Error('Review RNG')};var next=reviewCopy(game);next.history[0]=changeReviewedOutcome(next.history[0],'failed');var out=replayResultHistory(next);next.history=out.history;next.scores=out.scores;next.tiebreak=out.tiebreak;next.reviewRevision++;commitReviewState(next)`);
 assert.deepEqual(plain(h.eval('game.scores')),[1,2]);assert.equal(h.eval('JSON.stringify([game.current,game.riskPlannerState,game.modePlannerState,game.plannerState])'),selected);check(h);
});
test('score goal grants a reachable reply then uses the real shared tiebreak and one final team point',()=>{
 const h=start({finishType:'score',targetScore:15,rounds:100});for(let i=0;i<29;i++)answer(h);assert.deepEqual(plain(h.eval('game.scores')),[15,14]);assert.equal(h.eval('game.phase'),'ready');
 answer(h);assert.equal(h.eval('game.phase'),'review');h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'tiebreak');check(h);
 h.eval('revealTiebreak();settleTiebreak("a")');assert.deepEqual(plain(h.eval('game.scores')),[16,15]);assert.equal(h.eval('game.phase'),'review');h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');check(h);
 h.eval('saveCompletedProfileResult();saveCompletedProfileResult()');assert.equal(h.eval('profileStore.recent.length'),0);
});
test('unreachable reply and round-count winner retain current finish policy',()=>{
 const h=start({modes:['yesno'],finishType:'score',targetScore:15,rounds:100});for(let i=0;i<15;i++)answer(h,{success:i%2===0});assert.deepEqual(plain(h.eval('game.scores')),[16,0]);assert.equal(h.eval('game.phase'),'review');h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');check(h);
 const rounds=start({rounds:4});for(let i=0;i<4;i++)answer(rounds,{success:i!==1});rounds.eval('confirmReviewedResults()');assert.deepEqual(plain(rounds.eval('game.scores')),[2,1]);assert.equal(rounds.eval('game.phase'),'results');check(rounds);
});
test('serialized active timer, exact snapshot, header and deterministic role restoration require no RNG',()=>{
 const h=start({modes:['secret'],difficulty:'easy',complications:true,modifierChance:100});answer(h);h.eval('roll();toggleWord();startTimer();pauseTimer()');check(h);
 const raw=h.eval('JSON.stringify({...teamRecord,game,taskMemory})'),next=install(createSimulation(902));next.context.raw=raw;
 next.eval('Math.random=()=>{throw Error("Restore RNG")};var restored=JSON.parse(raw);QuipTeamsEngine.validateRecord(restored);game=restored.game;taskMemory=restored.taskMemory;options=restored.options;render()');assert.equal(next.eval('JSON.stringify(game)'),h.eval('JSON.stringify(game)'));assert.deepEqual(plain(next.eval('QuipTeamsEngine.roles(game)')),plain(h.eval('QuipTeamsEngine.roles(game)')));
});
test('full validator rejects wrong team scores, participants, rules, cards, plans, profile disguises and role snapshots',()=>{
 const h=start({modes:['blitz'],rounds:4});answer(h);h.eval('roll()');const raw=h.eval('JSON.stringify({...teamRecord,game,taskMemory})');
 for(const change of ['r.version=99','r.game.scores[0]++','r.game.profileMatch={}','r.game.awardTo="guesser"','r.game.rulesVersion=99','r.game.teamFormat.opening.teamIndex=1','r.game.history[0].guesser="Подмена"','r.game.history[0].teamRoles.recipientTeamIndex=1','r.game.current.blitzWords[0]="НЕ КАРТОЧКА"','r.game.current.blitzRequired=5','r.game.riskPlannerState.eligible[0]++','r.game.modePlannerState.balance.blitz++','r.game.current.teamRoles.guesserPlayerIndex=1-r.game.current.teamRoles.guesserPlayerIndex']){
  h.context.raw=raw;assert.throws(()=>h.eval('var r=JSON.parse(raw);'+change+';QuipTeamsEngine.validateRecord(r)'),undefined,change);
 }
});
test('new team party archives the exact old party; old unfinished duel and profiles remain untouched',()=>{
 const h=start({rounds:4});answer(h);h.eval('roll()');h.eval('var first={...teamRecord,game,taskMemory};var second=QuipTeamsEngine.createRecord(options,[["Аня","Коля"],["Оля","Иван"]],{id:"engine-fixture-match-0002",random:()=>.9,previous:first})');
 assert.equal(h.eval('QuipTeamsEngine.validateReplacement(first,second)'),true);assert.equal(h.eval('JSON.stringify(second.archives[0])===JSON.stringify(QuipTeamsEngine.entry(first))'),true);assert.deepEqual(h.storage,h.legacy);
 h.eval('second.archives=[]');assert.equal(h.eval('QuipTeamsEngine.validateReplacement(first,second)'),false);
});
test('installing team hooks leaves real 1-on-1 state, writes, cards and RNG sequence identical',()=>{
 const a=createSimulation(61),b=install(createSimulation(61,new Map(a.storage)));
 for(const h of [a,b])h.eval('Date.now=()=>1793020000000;Object.assign(options,{modes:DEFAULT_MODES,awardTo:"guesser",difficulty:"mixed",complications:true,modifierChance:100,rounds:100,finishType:"rounds",dice:false});newGame();game.dice=false');
 let ca=0,cb=0;const ra=seededRandom(123),rb=seededRandom(123);a.context.Math.random=()=>{ca++;return ra()};b.context.Math.random=()=>{cb++;return rb()};
 for(let i=0;i<24;i++){
  for(const h of [a,b])h.eval('roll();if(game.current.modeId==="approx"){revealApprox();awardApprox("both")}else{game.phase="judge";recordAnswer(false)}');
  assert.equal(a.eval('JSON.stringify(game)'),b.eval('JSON.stringify(game)'));assert.equal(ca,cb);assert.deepEqual(a.storage,b.storage);
 }
});
test('mixed difficulty and all enabled modes retain paired planners and valid card replacement',()=>{
 const h=start({modes:['talk','mime','draw','sing','yesno','secret','blitz','approx'],difficulty:'mixed',rounds:24,complications:true,modifierChance:100,riskRounds:true},[1,0,1],912);
 for(let i=0;i<24;i++)answer(h,{success:i%3!==0,shared:i%2?'a':'both'});
 h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');check(h);
 const replacement=start({modes:['talk'],complications:true,modifierChance:100});replacement.eval('roll()');const roles=replacement.eval('JSON.stringify(game.current.teamRoles)'),plans=replacement.eval('JSON.stringify([game.riskPlannerState,game.modePlannerState,game.plannerState])');
 replacement.eval('replaceWord()');check(replacement);assert.equal(replacement.eval('JSON.stringify(game.current.teamRoles)'),roles);assert.equal(replacement.eval('JSON.stringify([game.riskPlannerState,game.modePlannerState,game.plannerState])'),plans);
});
