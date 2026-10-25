'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
function start({mode='talk',modifier=false,risk=false,rounds=8,awardTo='setter',finishType='rounds',targetScore=25}={}){
 const h=createSimulation(37);h.context.settings={mode,modifier,risk,rounds,awardTo,finishType,targetScore};
 h.eval(`Object.assign(options,{modes:[settings.mode],dice:false,rounds:settings.rounds,finishType:settings.finishType,targetScore:settings.targetScore,awardTo:settings.awardTo,complications:settings.modifier,modifierChance:settings.modifier?100:0,riskRounds:settings.risk});newGame();game.dice=false;persist();`);
 return h;
}
function answer(h,yes=true,mod=true){h.context.yes=yes;h.context.mod=mod;h.eval("roll();game.phase='judge';persist();recordAnswer(yes,mod)");}
function edit(h,index,choice){h.context.index=index;h.context.choice=choice;return h.eval(`(()=>{const next=reviewCopy(game);next.history[index]=changeReviewedOutcome(next.history[index],choice);const out=replayResultHistory(next);next.history=out.history;next.scores=out.scores;next.tiebreak=out.tiebreak;next.reviewRevision++;commitReviewState(next);return game.scores.slice()})()`);}
test('new policy replays early corrections, modifier/base and repeated edits with zero RNG or planner/task changes',()=>{
 const h=start({modifier:true});answer(h);answer(h);answer(h);
 const preserved=h.eval('JSON.stringify({used:game.used,taskHistory:game.taskHistory,mode:game.modePlannerState,planner:game.plannerState,modeHistory:game.modeHistory})');
 h.eval("Math.random=()=>{throw Error('Unexpected RNG')}");
 assert.deepEqual(plain(edit(h,0,'failed')),[2,2]);assert.deepEqual(plain(edit(h,1,'base')),[2,1]);
 assert.deepEqual(plain(edit(h,2,'failed')),[0,1]);assert.deepEqual(plain(edit(h,0,'complete')),[2,1]);
 assert.equal(h.eval('JSON.stringify({used:game.used,taskHistory:game.taskHistory,mode:game.modePlannerState,planner:game.plannerState,modeHistory:game.modeHistory})'),preserved);
 assert.equal(h.eval('validateResultReview(game);true'),true);
});
test('risk loss is replayed from preceding score, including floor zero and role recipient inversion',()=>{
 for(const awardTo of ['setter','guesser']){
  const h=start({risk:true,awardTo});answer(h,true);answer(h,false);
  h.eval("roll();game.current.risk=true;game.phase='judge';persist();recordAnswer(false)");
  const recipient=awardTo==='setter'?h.eval('game.startingTeamIndex'):1-h.eval('game.startingTeamIndex');
  assert.equal(h.eval('game.history[2].penalty'),1);
  edit(h,0,'failed');assert.equal(h.eval('game.history[2].penalty'),0);assert.equal(h.eval('game.scores['+recipient+']'),0);
  edit(h,0,'complete');assert.equal(h.eval('game.history[2].penalty'),1);assert.equal(h.eval('game.scores['+recipient+']'),0);
 }
});
test('Blitz uses real 0/partial/full and modifier outcomes; Approx awards neither/one/both',()=>{
 const b=start({mode:'blitz',modifier:true});
 b.eval("roll();game.current.blitzCorrect=3;game.phase='judge';persist();recordAnswer(true)");
 assert.deepEqual(plain(b.eval('reviewChoices(game.history[0])')),['failed','0','1','2','3','base']);
 const recipient=b.eval('game.history[0].recipientIndex');
 for(const [choice,expected] of [['0',0],['1',0],['2',0],['3',3],['base',2]]){edit(b,0,choice);assert.equal(b.eval('game.scores['+recipient+']'),expected,choice);}
 edit(b,0,'3');edit(b,0,'failed');assert.equal(b.eval('reviewChoice(game.history[0])'),'failed');assert.equal(b.eval('game.history[0].awarded'),0);
 edit(b,0,'0');assert.equal(b.eval('reviewChoices(game.history[0]).includes("failed")'),false,'No duplicate rejected outcome for zero/partial Blitz');
 const a=start({mode:'approx'});a.eval("roll();revealApprox();awardApprox('none')");
 assert.match(a.eval('reviewedRowsMarkup(game,0,true)'),/Отвечали оба:/);assert.doesNotMatch(a.eval('reviewedRowsMarkup(game,0,true)'),/Загадывал:/);
 for(const [choice,scores]of [['a',[1,0]],['b',[0,1]],['both',[1,1]],['none',[0,0]]])assert.deepEqual(plain(edit(a,0,choice)),scores);
});
test('final answer enters durable review before lifetime totals; corrections change winner; confirmation is idempotent',()=>{
 const h=start({rounds:2});answer(h,true);answer(h,false);
 assert.equal(h.eval('game.phase'),'review');assert.equal(h.eval('profileStore.recent.length'),0);
 edit(h,0,'failed');edit(h,1,'complete');
 const restored=createSimulation(1,h.storage);assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.eval('game.phase'),'review');
 restored.eval('Math.random=()=>{throw Error("RNG")};confirmReviewedResults()');
 assert.equal(restored.eval('game.phase'),'results');assert.equal(restored.eval('profileStore.recent.length'),1);
 const winner=restored.eval('game.history[1].recipientIndex');assert.equal(restored.eval('completedProfileSummary(game)['+winner+'].wins'),1);
 const raw=restored.storage.get('kvip-player-profiles:v1');restored.eval('confirmReviewedResults();saveCompletedProfileResult();saveCompletedProfileResult()');
 assert.equal(restored.storage.get('kvip-player-profiles:v1'),raw);
 const again=createSimulation(2,h.storage);assert.equal(again.storage.get('kvip-player-profiles:v1'),raw);assert.equal(again.eval('storageBlocked'),false);
});
test('editing deciding score cancels victory and preserves all played tasks before continuing',()=>{
 const h=start({rounds:20,finishType:'score',targetScore:1});answer(h,true);answer(h,false);
 assert.equal(h.eval('game.phase'),'review');const history=h.eval('JSON.stringify(game.history.map(r=>r.review.round))');
 edit(h,0,'failed');h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'ready');assert.equal(h.eval('profileStore.recent.length'),0);
 assert.equal(h.eval('JSON.stringify(game.history.map(r=>r.review.round))'),history);assert.equal(h.eval('game.roundIndex'),2);
});
test('tie after correction selects existing tie-break only on confirmation; decided tie is reviewed before stats',()=>{
 const h=start({finishType:'score',targetScore:1});answer(h,true);answer(h,false);edit(h,1,'complete');
 assert.equal(h.eval('game.tiebreak'),null);h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'tiebreak');
 h.eval("revealTiebreak();settleTiebreak('a')");assert.equal(h.eval('game.phase'),'review');assert.equal(h.eval('profileStore.recent.length'),0);
 assert.equal(h.eval('validateTiebreakState(game);validateResultReview(game);true'),true);
 const restored=createSimulation(1,h.storage);assert.equal(restored.eval('storageBlocked'),false);
 restored.eval('confirmReviewedResults()');assert.equal(restored.eval('game.phase'),'results');assert.equal(restored.eval('profileStore.recent.length'),1);
 assert.equal(restored.eval('completedProfileSummary(game)[0].tiebreakWins'),1);
});
test('history draft and timer hold survive restart; cancellation restores exact outcomes and remaining time',()=>{
 const h=start();answer(h);h.eval("roll();game.phase='play';Object.assign(game.current,{visible:true,deadline:Date.now()+18000,paused:false});persist();$('report-backdrop').hidden=true;openResultHistory(0)");
 assert.equal(h.eval('!!game.resultEditor'),true);const remain=h.eval('game.current.feedbackHold.remainingMs');assert.ok(remain>17000);
 h.eval("updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'failed')})");
 const restored=createSimulation(1,h.storage);assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.eval('reviewChoice(game.resultEditor.history[0])'),'failed');
 assert.equal(restored.eval('game.current.feedbackHold.remainingMs'),remain);
 restored.eval('closeResultHistory(false)');assert.equal(restored.eval('game.history[0].correct'),true);assert.equal(restored.eval('game.current.feedbackHold'),undefined);
 assert.ok(restored.eval('game.current.deadline-Date.now()')>remain-1000);
});
test('failed write and readback rollback leave exact old RAW/history; failed rollback blocks writes',()=>{
 for(const kind of ['throw','readback','rollback']){
  const h=start();answer(h);const raw=h.storage.get('iskra-party:v1'),old=h.eval('JSON.stringify(game)');h.context.kind=kind;
  h.eval(`const realSet=localStorage.setItem,realGet=localStorage.getItem;let writes=0,reads=0,didWrite=false;
   localStorage.setItem=(key,value)=>{if(key===STORAGE_KEY){writes++;if(kind==='throw'||kind==='rollback'&&writes>1)throw Error('quota');}realSet(key,value);if(key===STORAGE_KEY)didWrite=true;};
   localStorage.getItem=key=>{const v=realGet(key);if(key===STORAGE_KEY&&didWrite&&writes===1&&reads++===0)return v+' ';return v;};`);
  assert.throws(()=>edit(h,0,'failed'));
  assert.equal(h.eval('JSON.stringify(game)'),old);
  if(kind!=='rollback'){assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.eval('storageBlocked'),false);}else assert.equal(h.eval('storageBlocked'),true);
 }
});
test('legacy parties keep immediate completion; unknown policy and mismatching snapshots are protected without rewriting RAW',()=>{
 const h=start({rounds:2});h.eval('delete game.resultReviewVersion;delete game.reviewRevision;delete game.reviewConfirmed;persist()');answer(h);answer(h);
 assert.equal(h.eval('game.phase'),'results');assert.equal(h.eval('profileStore.recent.length'),1);
 for(const corrupt of ['game.resultReviewVersion=99','game.scores[0]++','game.history[0].review.rules.rulesVersion=99']){
  const n=start();answer(n);n.eval(corrupt+';persist()');const raw=n.storage.get('iskra-party:v1');const r=createSimulation(1,n.storage);
  assert.equal(r.eval('storageBlocked'),true);assert.equal(r.storage.get('iskra-party:v1'),raw);
 }
});
test('corrected tie-break can change winner, become undecided or be archived and reused without RNG',()=>{
 const h=start({finishType:'score',targetScore:1});answer(h,true);answer(h,false);edit(h,1,'complete');h.eval("confirmReviewedResults();revealTiebreak();settleTiebreak('a')");
 const question=h.eval('JSON.stringify(game.tiebreak)');h.eval("Math.random=()=>{throw Error('Correction consumed RNG')};$('report-backdrop').hidden=true;openResultHistory(0)");
 h.eval("updateResultHistory(e=>{e.tiebreak.winnerIndex=1});closeResultHistory(true)");assert.deepEqual(plain(h.eval('game.scores')),[1,2]);
 h.eval("openResultHistory(0);updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'failed')});closeResultHistory(true)");
 assert.equal(h.eval('game.tiebreak'),null);assert.equal(h.eval('game.reviewTiebreakArchive.tiebreak.winnerIndex'),1);
 h.eval("openResultHistory(0);updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'complete')});closeResultHistory(true)");
 assert.equal(h.eval('game.tiebreak.question.id'),JSON.parse(question).question.id);assert.deepEqual(plain(h.eval('game.scores')),[1,2]);
 h.eval("openResultHistory(0);updateResultHistory(e=>{e.tiebreak.winnerIndex=null;e.tiebreak.stage='judge'});closeResultHistory(true);confirmReviewedResults()");
 assert.equal(h.eval('game.phase'),'tiebreak');assert.equal(h.eval('game.tiebreak.stage'),'judge');assert.equal(h.eval('profileStore.recent.length'),0);
});
test('pure replay preserves every historical rule version and legacy Blitz scoring from pinned snapshots',()=>{
 const h=createSimulation();
 for(const version of [1,2,3,4,5])for(const count of [0,1,2,3,5]){
  const required=version<4?5:3;if(count>required)continue;
  h.context.v=version;h.context.count=count;h.context.required=required;
  const result=h.eval(`(()=>{const rules={scoringVersion:2,rulesVersion:v,modeConfigVersion:1};
   const round={modeId:'blitz',difficulty:'easy',basePoints:v<4?3:2,modifierPoints:0,points:v<4?3:2,risk:true,complication:'',blitzCorrect:count,blitzRequired:required};
   const match={...rules,teams:['A','B'],startingTeamIndex:0,awardPolicyVersion:1,awardTo:'setter',roundIndex:1,finishType:'rounds',rounds:20};
   const row={mode:'blitz',setterIndex:0,guesserIndex:1,recipientIndex:0,rulesVersion:v,difficulty:'easy',review:reviewSnapshot(match,round,{taskSuccess:count>0,modifierSuccess:true,blitzCorrect:count})};
   return {replay:replayResultHistory(match,[row]).scores[0],original:settleQuipRound(match,round,{taskSuccess:count>0,modifierSuccess:true},0).delta};})()`);
  assert.equal(result.replay,0+result.original,'rules '+version+' count '+count);
 }
});
test('a failed final profile readback retries from a durable confirmed source without another win',()=>{
 const h=start({rounds:2});answer(h);answer(h,false);
 const getter=h.context.localStorage.getItem;let faults=0;
 h.context.localStorage.getItem=key=>{const value=getter(key);if(key==='kvip-player-profiles:v1'&&value&&JSON.parse(value).settledThrough===1&&faults++===0)throw Error('readback');return value};
 h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');assert.ok(h.eval('profileResultProblem'));
 h.context.localStorage.getItem=getter;const before=h.storage.get('kvip-player-profiles:v1');
 h.eval('saveCompletedProfileResult()');assert.equal(h.eval('profileResultProblem'),null);assert.equal(h.storage.get('kvip-player-profiles:v1'),before);
 const r=createSimulation(2,h.storage);assert.equal(r.storage.get('kvip-player-profiles:v1'),before);assert.equal(r.eval('profileStore.recent.length'),1);
});
test('Gameplay: mixed real matches, all modes/roles/starters and repeated edits retain replay/statistics invariants',()=>{
 let turns=0,corrections=0;
 for(let seed=1;seed<=24;seed++){
  const h=createSimulation(seed);h.context.seed=seed;
  h.eval(`Object.assign(options,{modes:['talk','mime','draw','sing','blitz','secret','approx'],awardTo:seed%2?'setter':'guesser',difficulty:'mixed',finishType:'rounds',rounds:12,dice:false,modifierChance:100,complications:true,riskRounds:true});newGame();game.dice=false;persist()`);
  for(let i=0;i<12;i++){
   h.context.turn=i;h.eval(`roll();if(game.current.modeId==='approx'){revealApprox();awardApprox(['none','a','b','both'][turn%4])}else{game.phase='judge';game.current.blitzCorrect=turn%4;recordAnswer(turn%3!==0,allowsModifierResult()?turn%2===0:true)}`);
   assert.equal(h.eval('game.history.length'),i+1);turns++;
   if(i>1&&i%3===0){
    const before=h.eval('JSON.stringify({task:game.taskHistory,planner:game.plannerState,mode:game.modePlannerState,current:game.current,used:game.used})');
    const key=h.eval('reviewChoices(game.history[0])['+(i%2)+']');edit(h,0,key);corrections++;
    assert.equal(h.eval('JSON.stringify({task:game.taskHistory,planner:game.plannerState,mode:game.modePlannerState,current:game.current,used:game.used})'),before);
   }
   assert.equal(h.eval('validateResultReview(game);true'),true);
  }
  assert.equal(h.eval('game.phase'),'review');assert.equal(h.eval('profileStore.recent.length'),0);
  h.eval('confirmReviewedResults();saveCompletedProfileResult();saveCompletedProfileResult()');
  assert.equal(h.eval('game.phase'),'results');assert.equal(h.eval('profileStore.recent.length'),1);
  assert.equal(h.eval('completedProfileSummary(game).every((s,i)=>s.points===game.scores[i])'),true);
 }
 console.log('Gameplay real turns:',turns,'corrections:',corrections);
});
test('new round settlement quota failure preserves prior history and final answer for retry',()=>{
 const h=start({rounds:2});answer(h);h.eval("roll();game.phase='judge';persist()");
 const before=h.eval('JSON.stringify(game)'),raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
 const set=h.context.localStorage.setItem;h.context.localStorage.setItem=(k,v)=>{if(k==='iskra-party:v1')throw Error('quota');return set(k,v)};
 h.eval('recordAnswer(true)');assert.equal(h.eval('JSON.stringify(game)'),before);assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
 h.context.localStorage.setItem=set;h.eval('recordAnswer(true)');assert.equal(h.eval('game.phase'),'review');assert.equal(h.eval('game.history.length'),2);
});
test('review and explicit confirmation also work with team names and no profile identity',()=>{
 const h=start({rounds:2});h.eval('delete game.profileMatch;delete game.matchId;persist()');const profiles=h.storage.get('kvip-player-profiles:v1');
 answer(h);answer(h,false);assert.equal(h.eval('game.phase'),'review');edit(h,0,'failed');h.eval('confirmReviewedResults()');
 assert.equal(h.eval('game.phase'),'results');assert.deepEqual(plain(h.eval('game.scores')),[0,0]);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
});
test('history editor retains countdown and existing Easy pause, including failed close rollback',()=>{
 for(const phase of ['countdown','play']){
  const h=start();answer(h);h.context.phase=phase;
  h.eval("roll();game.phase=phase;Object.assign(game.current,{visible:true,paused:phase==='play',remainingMs:phase==='play'?12000:null,autoStartAt:phase==='countdown'?Date.now()+900:null,deadline:null});persist();$('report-backdrop').hidden=true;openResultHistory(0)");
  const before=h.eval('JSON.stringify(game)'),raw=h.storage.get('iskra-party:v1'),remain=h.eval('game.current.feedbackHold.remainingMs');
  const set=h.context.localStorage.setItem;h.context.localStorage.setItem=()=>{throw Error('quota')};assert.equal(h.eval('closeResultHistory(true)'),false);
  assert.equal(h.eval('JSON.stringify(game)'),before);assert.equal(h.storage.get('iskra-party:v1'),raw);
  h.context.localStorage.setItem=set;h.eval('closeResultHistory(false)');
  if(phase==='play'){assert.equal(h.eval('game.current.paused'),true);assert.equal(h.eval('game.current.remainingMs'),remain);assert.equal(h.eval('game.current.deadline'),null);}
  else{assert.equal(h.eval('game.phase'),'countdown');assert.ok(h.eval('game.current.autoStartAt-Date.now()')>remain-500);}
 }
});
test('player tabs follow the award recipient while preserving setter, guesser and shared assignments',()=>{
 for(const awardTo of ['setter','guesser']){
  const h=start({awardTo});answer(h);const recipient=h.eval('game.history[0].recipientIndex');h.context.recipient=recipient;
  assert.equal(h.eval('reviewHistoryOwner(game.history[0],0,recipient)'),true);assert.equal(h.eval('reviewHistoryOwner(game.history[0],0,1-recipient)'),false);
  assert.equal(h.eval('game.history[0].setterIndex===game.startingTeamIndex'),true);assert.equal(h.eval('game.history[0].guesserIndex===1-game.startingTeamIndex'),true);
 }
 const shared=start({mode:'approx'});shared.eval("roll();revealApprox();awardApprox('none')");
 assert.equal(shared.eval('reviewHistoryOwner(game.history[0],0,0)&&reviewHistoryOwner(game.history[0],0,1)'),true);
});
test('new review policy consumes exactly the old selection RNG and retains every selected task across real rounds',()=>{
 for(const seed of [4,19,83]){
  const pair=[createSimulation(seed),createSimulation(seed)];
  for(const [index,h]of pair.entries()){
   h.eval(`var calls=0,draw=Math.random;Math.random=()=>{calls++;return draw()};Object.assign(options,{modes:['talk','mime','draw','sing','blitz','secret','approx'],difficulty:'mixed',finishType:'rounds',rounds:100,dice:false,modifierChance:100});newGame();game.dice=false`);
   if(index===1)h.eval('delete game.resultReviewVersion;delete game.reviewRevision;delete game.reviewConfirmed;persist()');
  }
  for(let i=0;i<12;i++){
   for(const h of pair)h.eval('roll()');
   const selected=h=>h.eval('JSON.stringify({current:game.current,used:game.used,task:game.taskHistory,plan:game.plannerState,mode:game.modePlannerState,calls})');
   assert.equal(selected(pair[0]),selected(pair[1]),'seed '+seed+' turn '+i);
   for(const h of pair){h.context.turn=i;h.eval(`if(game.current.modeId==='approx'){revealApprox();awardApprox(['none','a','b','both'][turn%4])}else{game.current.blitzCorrect=turn%4;game.phase='judge';recordAnswer(turn%3!==0,allowsModifierResult()?turn%2===0:true)}`)}
   assert.deepEqual(plain(pair[0].eval('game.scores')),plain(pair[1].eval('game.scores')));assert.equal(pair[0].eval('calls'),pair[1].eval('calls'));
  }
 }
});
test('Mixed pending review restores on every six-turn planner boundary without a new cycle or RNG',()=>{
 for(const rounds of [6,12]){
  const h=createSimulation(17);h.context.rounds=rounds;h.eval("Object.assign(options,{modes:['talk'],difficulty:'mixed',finishType:'rounds',rounds,dice:false,complications:false});newGame();game.dice=false;for(let i=0;i<rounds;i++){roll();game.phase='judge';recordAnswer(false)};game.dice=true;options.dice=true;persist()");
  assert.equal(h.eval('game.phase'),'review');const raw=h.storage.get('iskra-party:v1'),plan=h.eval('JSON.stringify(game.plannerState)');
  const restored=createSimulation(1,h.storage);assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.eval('game.phase'),'review');
  restored.eval("Math.random=()=>{throw Error('Review restore consumed RNG')};continueGame()");assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(restored.eval('JSON.stringify(game.plannerState)'),plan);
  restored.eval('confirmReviewedResults()');assert.equal(restored.eval('game.phase'),'results');assert.equal(restored.eval('profileStore.recent.length'),1);
 }
});
test('an early correction suspends the selected live task; undoing victory resumes the same task and held milliseconds',()=>{
 const h=start({finishType:'score',targetScore:1});answer(h,false);answer(h,false);
 h.eval("roll();game.phase='play';Object.assign(game.current,{visible:true,paused:false,deadline:Date.now()+25000});game.dice=true;options.dice=true;persist();$('report-backdrop').hidden=true;openResultHistory(0)");
 const selected=h.eval('JSON.stringify(game.current)'),source=h.eval('JSON.stringify({used:game.used,history:game.taskHistory,planner:game.plannerState,mode:game.modePlannerState})');
 h.eval("Math.random=()=>{throw Error('Correction consumed RNG')};updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'complete')});closeResultHistory(true)");
 assert.equal(h.eval('game.phase'),'review');assert.equal(h.eval('game.current'),null);assert.equal(h.eval('JSON.stringify(game.reviewSuspendedRound.current)'),selected);
 const remain=h.eval('game.reviewSuspendedRound.current.feedbackHold.remainingMs'),restored=createSimulation(2,h.storage);
 assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.eval('game.phase'),'review');
 restored.eval("Math.random=()=>{throw Error('Resume consumed RNG')};$('report-backdrop').hidden=true;openResultHistory(0);updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'failed')});closeResultHistory(true);confirmReviewedResults()");
 assert.equal(restored.eval('game.phase'),'play');assert.equal(restored.eval('game.reviewSuspendedRound'),undefined);
 const actual=plain(restored.eval('game.current')),original=JSON.parse(selected);delete original.feedbackHold;original.paused=false;original.remainingMs=null;original.deadline=actual.deadline;
 assert.deepEqual(actual,original);assert.ok(restored.eval('game.current.deadline-Date.now()')>remain-1000);
 assert.equal(restored.eval('JSON.stringify({used:game.used,history:game.taskHistory,planner:game.plannerState,mode:game.modePlannerState})'),source);assert.equal(restored.eval('profileStore.recent.length'),0);
});
test('opening history during the reel retains its selected task and cannot strand a stale animation callback',()=>{
 const h=start(),callbacks=[];h.context.setTimeout=fn=>{callbacks.push(fn);return callbacks.length};
 h.eval("game.dice=true;roll();$('report-backdrop').hidden=true");assert.equal(h.eval('game.phase'),'rolling');
 const selected=h.eval('JSON.stringify({current:game.current,used:game.used,planner:game.plannerState,mode:game.modePlannerState})');
 h.eval("Math.random=()=>{throw Error('History rerolled the selected task')};openResultHistory(0);closeResultHistory(false)");
 assert.equal(h.eval('game.phase'),'task');for(const fn of callbacks)fn();assert.equal(h.eval('game.phase'),'task');
 assert.equal(h.eval('JSON.stringify({current:game.current,used:game.used,planner:game.plannerState,mode:game.modePlannerState})'),selected);
});
