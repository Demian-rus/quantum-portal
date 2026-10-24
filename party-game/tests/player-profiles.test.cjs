'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(storage=new Map()){
 const context=vm.createContext({crypto:require('node:crypto').webcrypto,Date,console,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},Math:Object.create(Math)});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../player-profiles.js'),'utf8'),context);
 return {context,storage,eval:source=>vm.runInContext(source,context)};
}
function players(h){h.eval(`createPlayerProfile('ДС','violet');createPlayerProfile('ПА','green');createPlayerProfile('Третий','yellow');selectedProfileIds=profileStore.profiles.slice(0,2).map(p=>p.id);`);}
function finished(h,rows=[{mode:'talk',recipientIndex:0,awarded:1,correct:true},{mode:'talk',recipientIndex:1,awarded:0,correct:false}],scores=[1,0]){
 h.context.rows=rows;h.context.scores=scores;
 h.eval(`var identity=reserveProfileMatch();var match={matchId:identity.storeId+':'+identity.sequence,profileMatch:identity,teams:identity.participants.map(p=>p.name),scores,history:rows,roundIndex:rows.length,finishType:'rounds',rounds:rows.length,phase:'results'};`);
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('profiles: fresh boot is read-only; UUIDs never consume gameplay random',()=>{
 const h=harness();h.eval('Math.random=()=>{throw Error("RNG consumed")};restoreProfiles()');assert.equal(h.storage.size,0);
 players(h);finished(h);assert.match(h.eval('match.matchId'),/^[a-f0-9]{32}:1$/);assert.equal(h.eval('profileStore.profiles.length'),3);
});
test('profiles: required names, Unicode code points, whitespace and case-folded duplicates',()=>{
 const h=harness();
 for(const name of ['', '  ', 'я'.repeat(25)]){h.context.name=name;assert.throws(()=>h.eval('createPlayerProfile(name,"coral")'));}
 h.eval(`createPlayerProfile('  ДС   Команда  ','coral');createPlayerProfile('😀'.repeat(24),'blue')`);
 for(const name of ['дс команда',' ДС  КОМАНДА ','ＤＣ']){
  h.context.name=name;if(name!=='ＤＣ')assert.throws(()=>h.eval('createPlayerProfile(name,"cyan")'));
 }
 assert.equal(h.eval('profileStore.profiles[0].name'),'ДС Команда');
 assert.throws(()=>h.eval('createPlayerProfile("CSS","url(evil)")'));
 assert.throws(()=>h.eval('createPlayerProfile("Prototype","__proto__")'));
});
test('profiles: durable creation, all palette entries, and duplicate submit cannot add twice',()=>{
 const h=harness();h.eval('for(const color of Object.keys(QUIP_PROFILE_COLORS))createPlayerProfile(color,color)');
 assert.equal(h.eval('profileStore.profiles.length'),8);
 assert.throws(()=>h.eval('createPlayerProfile("coral","pink")'));assert.equal(h.eval('profileStore.profiles.length'),8);
 const restored=harness(h.storage);restored.eval('restoreProfiles()');assert.equal(restored.eval('profileStore.profiles.length'),8);
});
test('profiles: failed write does not report success or replace raw data',()=>{
 const h=harness();players(h);const before=h.storage.get('kvip-player-profiles:v1');
 h.context.localStorage.setItem=()=>{throw Error('quota')};assert.throws(()=>h.eval('createPlayerProfile("Четвёртый","pink")'));
 assert.equal(h.storage.get('kvip-player-profiles:v1'),before);assert.equal(h.eval('profileStore.profiles.length'),3);
});
test('profiles: duplicate slots and incomplete choice cannot reserve a match',()=>{
 const h=harness();players(h);h.eval('selectedProfileIds[1]=selectedProfileIds[0]');assert.throws(()=>h.eval('reserveProfileMatch()'));
 h.eval('selectedProfileIds[1]=null');assert.throws(()=>h.eval('reserveProfileMatch()'));assert.equal(h.eval('profileStore.nextSequence'),1);
});
test('statistics: wins follow IDs across positions and different opponents',()=>{
 const h=harness();players(h);finished(h);h.eval('commitProfileResult(match);selectedProfileIds.reverse()');
 finished(h,[{mode:'talk',recipientIndex:1,awarded:2,correct:true},{mode:'talk',recipientIndex:0,awarded:0,correct:false}],[0,2]);
 h.eval('commitProfileResult(match);selectedProfileIds=[profileStore.profiles[0].id,profileStore.profiles[2].id]');
 finished(h,[{mode:'talk',recipientIndex:0,awarded:0,correct:false},{mode:'talk',recipientIndex:1,awarded:1,correct:true}],[0,1]);h.eval('commitProfileResult(match)');
 assert.deepEqual(plain(h.eval('profileStore.profiles.map(p=>profileStore.totals[p.id]).map(t=>[t.matches,t.wins,t.losses,t.points])')),[[3,2,1,3],[2,0,2,0],[1,1,0,1]]);
});
test('statistics: draw, shared awards to one/both/neither, individual success',()=>{
 const h=harness();players(h);finished(h,[{mode:'approx',deltas:[1,1],recipients:[0,1]},{mode:'approx',deltas:[0,0],recipients:[]}],[1,1]);h.eval('commitProfileResult(match)');
 assert.deepEqual(plain(h.eval('Object.values(profileStore.totals).slice(0,2).map(t=>[t.draws,t.wins,t.modes.approx.success,t.modes.approx.points])')),[[1,0,1,1],[1,0,1,1]]);
 for(const [recipient,scores] of [[0,[1,0]],[1,[0,1]]]){
  finished(h,[{mode:'approx',deltas:scores,recipients:[recipient]},{mode:'approx',deltas:[0,0],recipients:[]}],scores);h.eval('commitProfileResult(match)');
 }
 assert.equal(h.eval('profileStore.totals[profileStore.profiles[0].id].matches'),3);
});
test('statistics: actual deltas preserve risk penalties, partial modifier success and Secret methods',()=>{
 const h=harness();players(h);finished(h,[{mode:'secret',methodId:'sing',recipientIndex:0,awarded:2,taskSuccess:true,modifierSuccess:false},
  {mode:'talk',recipientIndex:0,awarded:-2,taskSuccess:false}], [0,0]);h.eval('commitProfileResult(match)');
 assert.deepEqual(plain(h.eval('profileStore.totals[profileStore.profiles[0].id].modes')),{
  secret:{rounds:1,success:1,points:2,methods:{sing:{rounds:1,success:1,points:2}}},talk:{rounds:1,success:0,points:-2}});
 assert.equal(h.eval('profileStore.totals[profileStore.profiles[1].id].modes.secret.points'),0);
});
test('statistics: incomplete and mismatched histories cannot be counted',()=>{
 const h=harness();players(h);finished(h);h.eval('match.phase="ready"');assert.throws(()=>h.eval('commitProfileResult(match)'));
 h.eval('match.phase="results";match.scores=[100,0]');assert.throws(()=>h.eval('commitProfileResult(match)'));
 assert.equal(h.eval('profileStore.settledThrough'),0);
});
test('statistics: repeated commit, reload, and readback failure remain exactly once',()=>{
 const h=harness();players(h);finished(h);h.eval('commitProfileResult(match);commitProfileResult(match)');
 const restored=harness(h.storage);restored.context.match=plain(h.eval('match'));restored.eval('commitProfileResult(match)');
 assert.equal(restored.eval('profileStore.totals[profileStore.profiles[0].id].wins'),1);
 finished(h);const set=h.context.localStorage.setItem;h.context.localStorage.setItem=(key,value)=>{set(key,value);throw Error('readback interrupted')};
 assert.throws(()=>h.eval('commitProfileResult(match)'));h.context.localStorage.setItem=set;h.eval('commitProfileResult(match)');
 assert.equal(h.eval('profileStore.totals[profileStore.profiles[0].id].wins'),2);
});
test('statistics: quota failure leaves the whole aggregate intact and retries once',()=>{
 const h=harness();players(h);finished(h);const before=h.storage.get('kvip-player-profiles:v1'),set=h.context.localStorage.setItem;
 h.context.localStorage.setItem=()=>{throw Error('quota')};assert.throws(()=>h.eval('commitProfileResult(match)'));assert.equal(h.storage.get('kvip-player-profiles:v1'),before);
 h.context.localStorage.setItem=set;h.eval('commitProfileResult(match);commitProfileResult(match)');assert.equal(h.eval('profileStore.settledThrough'),1);
});
test('statistics: malformed/future archives are protected; legacy matches create no entries',()=>{
 for(const raw of ['{bad',JSON.stringify({version:99}),JSON.stringify({version:1,profiles:[]})]){
  const h=harness(new Map([['kvip-player-profiles:v1',raw],['iskra-party:v1','legacy bytes']]));h.eval('restoreProfiles();commitProfileResult({phase:"results"})');
  assert.throws(()=>h.eval('createPlayerProfile("Новый","green")'));assert.equal(h.storage.get('kvip-player-profiles:v1'),raw);assert.equal(h.storage.get('iskra-party:v1'),'legacy bytes');
 }
});
test('statistics: 10,000 matches retain lifetime totals, cap recent results, reject a pruned replay',()=>{
 const h=harness();players(h);finished(h);h.eval('var firstMatch=JSON.parse(JSON.stringify(match));commitProfileResult(match)');
 h.eval(`for(let i=1;i<10000;i++){const value=reserveProfileMatch();match={...match,profileMatch:value,matchId:value.storeId+':'+value.sequence};commitProfileResult(match);}commitProfileResult(firstMatch);`);
 assert.equal(h.eval('profileStore.recent.length'),100);assert.equal(h.eval('profileStore.totals[profileStore.profiles[0].id].wins'),10000);
 const bytes=Buffer.byteLength(h.storage.get('kvip-player-profiles:v1'));assert.ok(bytes<40000,'archive '+bytes+' bytes');console.log('10,000 matches / 3 profiles:',bytes,'UTF-8 bytes');
});
test('statistics integration: real V5 settlement routes either recipient, full Blitz, and Secret methods',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs');
 for(const mode of ['talk','secret','blitz'])for(const award of ['setter','guesser']){
  const h=createSimulation();h.context.mode=mode;h.context.award=award;
  h.eval(`chooseStartingTeam=()=>0;Object.assign(options,{modes:[mode],awardTo:award,finishType:'rounds',rounds:2,dice:false,complications:true,modifierChance:100});newGame();
   roll();if(mode==='blitz')game.current.blitzCorrect=3;game.phase='judge';judge(true,false);
   roll();if(mode==='blitz')game.current.blitzCorrect=2;game.phase='judge';judge(false);`);
  assert.equal(h.eval('game.phase'),'results');assert.equal(h.eval('profileResultProblem'),null);
  const data=plain(h.eval('game')),archive=JSON.parse(h.storage.get('kvip-player-profiles:v1'));
  assert.equal(archive.recent.length,1);assert.deepEqual(archive.recent[0].scores,data.scores);
  for(let i=0;i<2;i++){
   const total=archive.totals[data.profileMatch.participants[i].id];assert.equal(total.points,data.scores[i]);assert.equal(total.matches,1);
   assert.equal(total.modes[mode].rounds,2);assert.equal(total.modes[mode].success,1);
   if(mode==='secret')assert.equal(Object.values(total.modes.secret.methods).reduce((sum,value)=>sum+value.rounds,0),2);
  }
  const raw=h.storage.get('kvip-player-profiles:v1');h.eval('showResults();render();showResults();saveCompletedProfileResult()');assert.equal(h.storage.get('kvip-player-profiles:v1'),raw);
 }
});
test('statistics integration: real risk loss is signed and score/round completion use the engine',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs');
 for(const finishType of ['score','rounds']){
  const h=createSimulation();h.context.finishType=finishType;
  h.eval(`chooseStartingTeam=()=>0;Object.assign(options,{modes:['talk'],awardTo:'setter',finishType,rounds:4,dice:false,complications:false});newGame();if(finishType==='score')game.targetScore=2;
   for(let i=0;i<2;i++){roll();game.phase='judge';judge(true)}
   roll();game.current.risk=true;game.phase='judge';judge(false);
   roll();game.phase='judge';judge(true);`);
  assert.equal(h.eval('game.phase'),'results');assert.deepEqual(Array.from(h.eval('game.scores')),[0,2]);
  assert.equal(h.eval('game.history[2].awarded'),-1);assert.equal(h.eval('profileResultProblem'),null);
  assert.equal(h.eval('profileStore.totals[game.profileMatch.participants[0].id].modes.talk.points'),0);
  assert.equal(h.eval('profileStore.totals[game.profileMatch.participants[1].id].wins'),1);
 }
});
test('statistics integration: failed commit blocks discard, reload retries; color snapshots stay fixed',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation();
 h.eval(`chooseStartingTeam=()=>0;Object.assign(options,{modes:['approx'],finishType:'rounds',rounds:2,dice:false});newGame();
  roll();revealApprox();awardApprox('both');`);
 const set=h.context.localStorage.setItem;h.context.localStorage.setItem=(key,value)=>{if(key==='kvip-player-profiles:v1')throw Error('quota');return set(key,value);};
 h.eval(`roll();revealApprox();awardApprox('none');backToMenu();handleAction('again')`);
 assert.equal(h.eval('game.phase'),'results');assert.ok(h.eval('profileResultProblem'));
 assert.equal(h.eval('profileStore.recent.length'),0);
 const restored=createSimulation(2,h.storage);assert.equal(restored.eval('profileResultProblem'),null);assert.equal(restored.eval('profileStore.recent.length'),1);
 const raw=h.storage.get('kvip-player-profiles:v1');restored.eval(`profileStore.profiles[0].color='blue';writeProfileStore(profileStore)`);
 assert.equal(restored.eval('profileColorForMatch(game,0)'),'#ff827e');assert.notEqual(h.storage.get('kvip-player-profiles:v1'),raw);
});
test('statistics integration: missing or future profile archive does not block a legacy Continue or touch RAW',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),source=createSimulation();source.eval('newGame();delete game.profileMatch;delete game.matchId;persist()');
 const raw=source.storage.get('iskra-party:v1');
 for(const archive of [null,'{"version":99}']){
  const storage=new Map([['iskra-party:v1',raw]]);if(archive!==null)storage.set('kvip-player-profiles:v1',archive);
  const restored=createSimulation(3,storage);restored.eval('continueGame()');assert.equal(restored.eval('activeScene'),'game');
  assert.equal(restored.eval('game.profileMatch'),undefined);assert.equal(storage.get('iskra-party:v1'),raw);
  assert.equal(storage.get('kvip-player-profiles:v1')??null,archive);
 }
});
