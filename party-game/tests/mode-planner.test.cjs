'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSimulation,seededRandom}=require('../scripts/game-simulation.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function start(seed=10,settings={},storage=new Map()){
 const h=createSimulation(seed,storage);h.context.settings=settings;
 h.eval('Object.assign(options,{dice:false,awardTo:"guesser",difficulty:"mixed",finishType:"rounds",rounds:100},settings);newGame()');
 return h;
}
test('TASK010 all compatible mode subsets, packs, tiers, starters and recipients finish bounded transitions',()=>{
 const h=createSimulation(10010);let checked=0;
 h.context.rng=seededRandom(10010);
 const result=plain(h.eval(`(()=>{
 let combinations=0,draws=0;
 for(const id of ['general','geography','science'])for(const awardTo of ['setter','guesser']){
  const pack=latestContentPackSelection(id),settings={...options,contentPack:pack,awardTo,
   promptTypes:id==='general'?['word','phrase','idiom']:['word','phrase']};
  settings.modes=compatibleAwardModes({...settings,modes:getContentPack(pack).allowedModes||MODE_LIST.map(m=>m.id)});
  const active=MODE_LIST.filter(m=>packModeAvailability(pack,settings,m.id).available).map(m=>m.id);
  for(let mask=1;mask<2**active.length;mask++)for(const difficulty of ['easy','medium','hard','mixed'])for(const starter of [0,1]){
   const modes=active.filter((_,index)=>mask&(1<<index));
   if(!checkContentPack(pack,{...settings,modes,difficulty}).available)throw Error('Invalid fixture');
   const match={scoringVersion:2,rulesVersion:5,modeConfigVersion:1,awardPolicyVersion:1,awardTo};
   let state=freshModePlan(),difficultyState=freshRoundPlan();
   for(let round=0;round<12;round++){
    const level=planRoundDifficulty(difficultyState,round,difficulty,rng);difficultyState=level.state;
    const selected=planMode(state,{modes,rewards:modeOpportunityRewards(match,modes,level.difficulty),
     recipientIndex:awardRecipientIndex(match,(round+starter)%2),pairStart:round%2===0},rng);
    if(!modes.includes(selected.modeId))throw Error('Inactive mode');state=selected.state;draws++;
    if(JSON.stringify(state).length>350)throw Error('Unbounded state');
   }
   combinations++;
  }
 }
 return {combinations,draws};})()`));
 checked=result.combinations;assert.equal(checked,6096);assert.equal(result.draws,73152);
});
test('TASK010 rewards come from the frozen rule table; Secret includes mandatory bonus and Blitz full result',()=>{
 const h=start();
 for(const level of ['easy','medium','hard']){
  h.context.level=level;
  assert.deepEqual(plain(h.eval('modeOpportunityRewards(game,["talk","secret","blitz","approx"],level)')),{talk:1,secret:3,blitz:2,approx:1});
 }
 const before=h.eval('JSON.stringify([QUIP_RULESETS,QUIP_MODE_CONFIGS,QUIP_PLANNER_VERSION])');
 for(const mode of ['talk','secret','blitz','approx']){
  h.context.mode=mode;h.eval('options.modes=[mode];options.complications=false;newGame();roll()');
  assert.equal(h.eval('game.current.modeId'),mode);
  if(mode==='secret')assert.equal(h.eval('Boolean(game.current.complication)&&game.current.points===3'),true);
  if(mode==='blitz')assert.equal(h.eval('game.current.blitzWords.length===3&&game.current.basePoints===2'),true);
  if(mode==='approx')assert.equal(h.eval('game.current.usesTimer||game.current.risk||Boolean(game.current.complication)'),false);
 }
 assert.equal(h.eval('JSON.stringify([QUIP_RULESETS,QUIP_MODE_CONFIGS,QUIP_PLANNER_VERSION])'),before);
});
test('TASK010 shared Approx is neutral while single Secret balances complete pairs without RNG',()=>{
 const h=start();
 h.eval('var state=freshModePlan()');
 for(const mode of ['approx','secret'])for(const recipientIndex of [0,1]){
  h.context.args={modes:[mode],rewards:{[mode]:mode==='secret'?3:1},recipientIndex,pairStart:true};
  const s=plain(h.eval('planMode(freshModePlan(),args,()=>{throw Error("single-mode RNG")}).state'));
  assert.equal(s.balance[mode],mode==='approx'?0:recipientIndex===0?1:-1);
 }
 h.eval('options.modes=["secret"];newGame();roll();game.phase="judge";judge(false);game.dice=false;roll()');
 assert.ok(Object.values(plain(h.eval('game.modePlannerState.balance'))).every(n=>n===0));
});
test('TASK010 scores and outcomes cannot influence selection; two modes can repeat and do not lock to players',()=>{
 const a=start(10010,{modes:['talk','secret'],difficulty:'easy'}),b=start(10010,{modes:['talk','secret'],difficulty:'easy'});
 let repeats=0,last=null;const counts=[{talk:0,secret:0},{talk:0,secret:0}];
 for(let i=0;i<100;i++){
  b.eval(`game.scores=${i%2?'[999,0]':'[0,999]'};game.history=[{correct:${i%3===0},awarded:999}]`);
  const ma=a.eval('pickMode("easy").id'),mb=b.eval('pickMode("easy").id');assert.equal(ma,mb);
  assert.deepEqual(plain(a.eval('game.modePlannerState')),plain(b.eval('game.modePlannerState')));
  if(last===ma)repeats++;last=ma;counts[a.eval('awardTeamIndex()')][ma]++;
  a.eval('game.roundIndex++');b.eval('game.roundIndex++');
 }
 assert.ok(repeats>0&&repeats<70);for(const row of counts)assert.ok(row.talk>0&&row.secret>0);
 assert.ok(Math.abs(counts[0].secret-counts[1].secret)<=3);
});
test('TASK010 pair opening has equal fairness costs and real random ties; no fixed schedule or mirroring',()=>{
 const h=start();const choices=new Set();
 for(const value of [0,.2,.4,.6,.8,.999999]){
  h.context.value=value;
  choices.add(h.eval('planMode(freshModePlan(),{modes:["talk","secret","blitz"],rewards:{talk:1,secret:3,blitz:2},recipientIndex:0,pairStart:true},()=>value).modeId'));
 }
 assert.equal(choices.size,3);
 assert.throws(()=>h.eval('planMode(freshModePlan(),{modes:["talk","secret"],rewards:{talk:1,secret:3},recipientIndex:0,pairStart:true},()=>1)'),/random/);
});
test('TASK010 production ledger follows the actual recipient for both random starters and award policies',()=>{
 for(const awardTo of ['setter','guesser'])for(const value of [0,.999999]){
  const h=createSimulation(10010);h.context.settings={awardTo};h.context.value=value;
  h.eval('Object.assign(options,settings,{modes:["talk"],dice:false});Math.random=()=>value;newGame();roll()');
  const starter=value===0?0:1,recipient=awardTo==='setter'?starter:1-starter;
  assert.equal(h.eval('game.startingTeamIndex'),starter);
  assert.equal(h.eval('game.modePlannerState.balance.talk'),recipient===0?1:-1);
 }
});
test('TASK010 selected card, planner, timer, difficulty, scores and histories survive reload, render and duplicate roll',()=>{
 for(const phase of ['rolling','task','play']){
  const store=new Map(),h=start(10010,{modes:['talk','secret','blitz','approx'],dice:phase==='rolling'},store);
  h.eval('roll()');
  if(phase==='play')h.eval('game.phase="play";game.current.deadline=Date.now()+60000;game.current.remainingMs=60000;persist()');
  h.eval('game.dice=true;persist()');
  const before=plain(h.eval('game')),again=createSimulation(123,store);
  if(phase==='rolling')before.phase='task';
  assert.deepEqual(plain(again.eval('game')),before);
  again.eval('Math.random=()=>{throw Error("must not redraw")};continueGame();render();roll()');
  assert.deepEqual(plain(again.eval('game')),before);
 }
 // Completed-turn reload keeps the exact debt used for the next random choice.
 const store=new Map(),h=start(11,{modes:['talk','secret'],difficulty:'easy'},store);
 h.eval('roll();game.phase="judge";judge(false)');const next=createSimulation(12,store);
 assert.deepEqual(plain(next.eval('game.modePlannerState')),plain(h.eval('game.modePlannerState')));
 h.eval('Math.random=()=>.67;game.dice=false;roll()');next.eval('Math.random=()=>.67;game.dice=false;roll()');
 assert.deepEqual(plain(next.eval('game')),plain(h.eval('game')));
});
test('TASK010 old saves keep the exact historical mode RNG and current card; unknown/corrupt new policy is protected',()=>{
 const store=new Map(),h=start(10,{modes:['talk','secret'],difficulty:'easy'},store);
 h.eval('delete game.modePlannerVersion;delete game.modePlannerState;roll();game.dice=true;persist()');
 const before=h.eval('JSON.stringify(game)'),again=createSimulation(99,store);assert.equal(again.eval('JSON.stringify(game)'),before);
 again.eval('game.current=null;game.phase="ready";Math.random=()=>0');
 let last=again.eval('game.modeHistory.at(-1)');
 for(let i=0;i<10;i++){
  const id=again.eval('pickMode().id');assert.notEqual(id,last);again.context.id=id;again.eval('game.modeHistory.push(id);game.roundIndex++');last=id;
 }
 assert.equal(again.eval('game.modePlannerVersion'),undefined);
 for(const change of ['saved.game.modePlannerVersion=99','delete saved.game.modePlannerState','saved.game.modePlannerState.balance.approx=1','saved.game.modePlannerState.recent.push("unknown")','delete saved.game.modePlannerVersion']){
  const fixture=start(9),raw=fixture.storage.get('iskra-party:v1');fixture.context.raw=raw;fixture.context.change=change;
  const bad=fixture.eval('(()=>{const saved=JSON.parse(raw);eval(change);return JSON.stringify(saved)})()');
  const broken=new Map([['iskra-party:v1',bad]]),loaded=createSimulation(10,broken);
  assert.equal(loaded.eval('storageBlocked'),true);loaded.eval('persist();newGame()');assert.equal(broken.get('iskra-party:v1'),bad);
 }
});
