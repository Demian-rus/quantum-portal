'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createSimulation,seededRandom}=require('../scripts/game-simulation.cjs');
const {runSimulation}=require('../scripts/risk-simulation.cjs');
const plain=v=>JSON.parse(JSON.stringify(v)),base='4330e165641404a159dc71f8cd8198e385b9885b';
function start(seed=19,settings={},storage=new Map()){
 const h=createSimulation(seed,storage);h.context.settings=settings;
 h.eval('Object.assign(options,{modes:["talk"],difficulty:"easy",complications:false,dice:false,finishType:"rounds",rounds:100,riskRounds:true},settings);options.modes=compatibleAwardModes(options);newGame();game.dice=false;persist()');return h;
}
function answer(h,yes=false){h.context.yes=yes;h.eval('roll();game.phase="judge";recordAnswer(yes)');}
test('TASK019 bounded pure transition, exact boundaries and non-alternating outcomes',()=>{
 const h=start();h.eval('var state=freshRiskPlan()');
 for(const r of [0,0,0,1,1,1,1]){h.context.r=r;h.eval('state=planRisk(state,r,0).state');}
 assert.deepEqual(plain(h.eval('state')),{eligible:[3,4],risks:[2,4]});
 assert.equal(h.eval('riskProbability(state,1)'),0);assert.equal(h.eval('riskProbability(state,0)'),8/21);
 assert.equal(h.eval('planRisk(freshRiskPlan(),0,4/21).risk'),false);
 assert.equal(h.eval('planRisk(freshRiskPlan(),0,4/21-Number.EPSILON).risk'),true);
 for(const v of [-1,1,NaN,Infinity]){h.context.v=v;assert.throws(()=>h.eval('planRisk(state,0,v)'),/random/);}
 for(const r of [-1,2,null]){h.context.r=r;assert.throws(()=>h.eval('planRisk(state,r,0)'),/recipient/);}
 const before=h.eval('JSON.stringify(state)');h.eval('planRisk(state,0,.8)');assert.equal(h.eval('JSON.stringify(state)'),before);
});
test('TASK019 actual recipient, both starters and award policies; no first-pair / Approx / disabled draws',()=>{
 for(const awardTo of ['setter','guesser'])for(const starter of [0,1]){
  const h=start(19,{awardTo});h.context.starter=starter;h.eval('game.startingTeamIndex=starter;Math.random=()=>0');
  answer(h);answer(h);answer(h);const recipient=awardTo==='setter'?starter:1-starter;
  assert.equal(h.eval('game.history[2].recipientIndex'),recipient);
  assert.deepEqual(plain(h.eval('game.riskPlannerState.risks')),recipient?[0,1]:[1,0]);
  assert.equal(h.eval('validateGameRiskPlan(game);true'),true);
 }
 const h=start();h.eval('Math.random=()=>{throw Error("ineligible draw")};selectRoundRisk(game,"talk")');
 h.eval('game.roundIndex=2;selectRoundRisk(game,"approx");game.riskRounds=false;selectRoundRisk(game,"talk")');
 assert.deepEqual(plain(h.eval('game.riskPlannerState')),{eligible:[0,0],risks:[0,0]});
});
test('TASK019 new vs legacy uses identical RNG calls and immutable cards/modes/planners across 1920 real turns',()=>{
 for(const awardTo of ['setter','guesser'])for(const starter of [0,1])for(const modes of [['talk'],['secret','blitz'],['talk','mime','draw','sing','yesno','secret','blitz','approx']]){
  const a=start(19,{awardTo,modes,difficulty:'mixed',complications:true}),b=start(19,{awardTo,modes,difficulty:'mixed',complications:true});
  for(const h of [a,b]){h.context.starter=starter;h.eval('game.startingTeamIndex=starter');}
  b.eval('delete game.riskPolicyVersion;delete game.riskPlannerState');
  let ca=0,cb=0;const ra=seededRandom(10019),rb=seededRandom(10019);a.context.Math.random=()=>{ca++;return ra()};b.context.Math.random=()=>{cb++;return rb()};
  for(let n=0;n<80;n++){
   for(const h of [a,b])h.eval('roll()');
   const project=h=>plain(h.eval('(()=>{const c={...game.current};delete c.risk;return {current:c,used:game.used,modes:game.modeHistory,plan:game.plannerState,modePlan:game.modePlannerState,tasks:game.taskHistory}})()'));
   assert.deepEqual(project(a),project(b));assert.equal(ca,cb);
   for(const h of [a,b])h.eval('if(game.current.modeId==="approx"){revealApprox();awardApprox("none")}else{game.phase="judge";recordAnswer(false)}');
   assert.equal(a.eval('validateGameRiskPlan(game);true'),true);
  }
 }
});
test('TASK019 historical selection byte behavior against actual published v85 function including RNG counts',()=>{
 const source=execFileSync('git',['show',base+':party-game/round-selection.js'],{encoding:'utf8'});
 for(const awardTo of ['setter','guesser']){
  const a=start(21,{awardTo,modes:['talk','secret','blitz','approx'],difficulty:'mixed'}),b=start(21,{awardTo,modes:['talk','secret','blitz','approx'],difficulty:'mixed'});
  vm.runInContext(source,b.context);
  for(const h of [a,b])h.eval('delete game.riskPolicyVersion;delete game.riskPlannerState;game.startingTeamIndex=1');
  let ca=0,cb=0;const ra=seededRandom(211),rb=seededRandom(211);a.context.Math.random=()=>{ca++;return ra()};b.context.Math.random=()=>{cb++;return rb()};
  for(let n=0;n<100;n++){
   assert.deepEqual(plain(a.eval('rollOutcome()')),plain(b.eval('rollOutcome()')));assert.equal(ca,cb);
   for(const h of [a,b])h.eval('game.roundIndex++');
  }
 }
});
test('TASK019 state survives reload, duplicate controls, loss of storage, history edits and pending review',()=>{
 const h=start();for(let i=0;i<10;i++)answer(h,i%3===0);
 h.eval('roll();game.dice=true;persist()');const before=plain(h.eval('game')),raw=h.storage.get('iskra-party:v1');
 const restored=createSimulation(92,h.storage);assert.equal(restored.eval('storageBlocked'),false);assert.deepEqual(plain(restored.eval('game')),before);
 restored.eval('Math.random=()=>{throw Error("redraw")};render();continueGame();roll()');assert.equal(restored.storage.get('iskra-party:v1'),raw);
 const risks=restored.eval('JSON.stringify(game.riskPlannerState)');
 restored.eval("$('report-backdrop').hidden=true;openResultHistory(0);updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],'failed')});closeResultHistory(true)");
 assert.equal(restored.eval('JSON.stringify(game.riskPlannerState)'),risks);assert.equal(restored.eval('validateGameRiskPlan(game);true'),true);
 const saved=restored.storage.get('iskra-party:v1'),old=restored.eval('JSON.stringify(game)');
 restored.context.localStorage.setItem=()=>{throw Error('quota')};
 restored.eval("openResultHistory(0)");assert.equal(restored.storage.get('iskra-party:v1'),saved);assert.equal(restored.eval('JSON.stringify(game)'),old);
 const end=start(3,{rounds:4});for(let i=0;i<4;i++)answer(end,i%2===0);
 assert.equal(end.eval('game.phase'),'review');const loaded=createSimulation(4,end.storage);assert.equal(loaded.eval('storageBlocked'),false);
 loaded.eval('confirmReviewedResults();saveCompletedProfileResult();saveCompletedProfileResult()');assert.equal(loaded.eval('profileStore.recent.length'),1);
});
test('TASK019 failed card save cannot persist a partial risk transition or advance twice on retry',()=>{
 const h=start();answer(h);answer(h);const raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1'),set=h.context.localStorage.setItem;
 h.context.localStorage.setItem=(k,v)=>{if(k==='iskra-party:v1')throw Error('quota');set(k,v)};
 h.eval('Math.random=()=>0;roll()');assert.equal(h.storage.get('iskra-party:v1'),raw);
 const selected=h.eval('JSON.stringify(game.riskPlannerState)');h.eval('roll()');assert.equal(h.eval('JSON.stringify(game.riskPlannerState)'),selected);
 const loaded=createSimulation(1,h.storage);assert.equal(loaded.eval('storageBlocked'),false);assert.equal(loaded.eval('game.current'),null);
 loaded.eval('game.dice=false;Math.random=()=>0;roll()');assert.equal(loaded.eval('validateGameRiskPlan(game);true'),true);
 assert.equal(loaded.eval('game.riskPlannerState.eligible.reduce((a,b)=>a+b,0)'),1);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
});
test('TASK019 unknown policy, corrupt counters, impossible prefix and missing fields protect exact RAW',()=>{
 for(const change of ['game.riskPolicyVersion=99','game.riskPolicyVersion=null','delete game.riskPolicyVersion','delete game.riskPlannerState','game.riskPlannerState.eligible[0]++','game.riskPlannerState.risks=[3,0]','game.riskPlannerState.extra=1']){
  const h=start();answer(h);answer(h);answer(h);h.eval(change+';persist()');const raw=h.storage.get('iskra-party:v1');
  const loaded=createSimulation(3,h.storage);assert.equal(loaded.eval('storageBlocked'),true,change);loaded.eval('persist();newGame()');assert.equal(h.storage.get('iskra-party:v1'),raw);
 }
});
test('TASK019 policy is invariant under scores/outcomes and mirrored recipients; adversarial prefixes stay bounded',()=>{
 const h=start(),plan=h.eval('planRisk'),fresh=h.eval('freshRiskPlan');let a=fresh(),b=fresh();const random=seededRandom(19);
 for(let i=0;i<10000;i++){
  const recipient=i%17<12?0:1,value=random();a=plan(a,recipient,value).state;b=plan(b,1-recipient,value).state;
  assert.deepEqual(plain(a.risks),plain(b.risks).reverse());assert.ok(Math.abs(a.risks[0]-a.risks[1])<=2);
 }
 const first=start(),second=start();second.eval('game.scores=[9999,0];game.history=[{correct:true,awarded:9999}]');
 for(const x of [first,second])x.eval('game.roundIndex=2;Math.random=()=>.15');
 assert.equal(first.eval('selectRoundRisk(game,"talk")'),second.eval('selectRoundRisk(game,"talk")'));
});
test('TASK019 90000 Monte Carlo matches are reproducible with capped gap and natural variation',()=>{
 const report=runSimulation(10000),saved=JSON.parse(fs.readFileSync(path.join(__dirname,'../RISK-SIMULATION.json')));
 assert.deepEqual(report,saved);
 const target=report.scoreFinish.find(r=>r.policy==='balanced-v1');assert.ok(target.maxPrefixGap<=2);assert.ok(target.ratePercent>19.5&&target.ratePercent<20.5);
 for(const r of report.results.filter(r=>r.policy==='balanced-v1')){
  assert.ok(r.maxPrefixGap<=2);assert.ok(r.sameOwnerTransitions>0);assert.ok(r.zeroRiskMatches>=0);
  assert.equal(r.tenToZero,0);assert.ok(r.ratePercent>17.5&&r.ratePercent<20.4);
 }
});
test('TASK019 immutable scoring, TASK020, profiles, timer, catalogs and backup remain published bytes',()=>{
 for(const name of ['rules.js','penalties.js','round-planner.js','round-settlement.js','round-actions.js','timer-controller.js','feedback-clock.js','card-feedback-view.js','result-review.js','result-review-view.js','player-profiles.js','profile-backup.js','profile-backup-view.js','storage-controller.js','cards.js','content-packs.js'])
  assert.equal(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),execFileSync('git',['show',(['cards.js','content-packs.js'].includes(name)?'584d54f38ff6f090e36dfe5308821809c559408d':base)+':party-game/'+name],{encoding:'utf8',maxBuffer:12000000}),name);
});
