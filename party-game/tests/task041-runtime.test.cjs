'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createSimulation}=require('../scripts/game-simulation.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
function start(mode,tier,teams=false){
 const h=createSimulation(794);h.context.mode=mode;h.context.tier=tier;
 h.eval(`writeTaskDifficultyPreference(mode,tier);options={...options,awardTo:'guesser',modes:[mode],difficulty:'medium',complications:false,riskRounds:false};`);
 if(teams)h.eval(`QuipTeamsEngine.install();var record=QuipTeamsEngine.createRecord({...options,awardTo:'setter'},[['А','Б'],['В','Г']],{id:'task041-runtime-match-0001'});game=record.game;taskMemory=record.taskMemory;options=record.options;`);
 else h.eval('newGame()');
 assert(h.eval('!!game'),'START failed '+mode+'/'+tier);return h;
}
for(const teams of [false,true])for(const mode of ['talk','mime','draw','sing','yesno','blitz','approx'])for(const tier of ['easy','medium','hard'])test(`${teams?'2x2':'1x1'} ${mode}/${tier}: real selection, eligible exact tier, snapshot and replay`,()=>{
 const h=start(mode,tier,teams);
 for(let i=0;i<4;i++){
  h.eval('game.current=rollOutcome();game.phase="task"');
  const info=plain(h.eval(`(()=>{const c=game.current,ids=c.blitzCardIds||[c.cardId],position=QuipEditorialSelection.STORED_MODES.indexOf(c.modeId);return {ids,levels:ids.map(id=>QUIP_EDITORIAL_EDITION.records[id][3][position]),policy:game.taskDifficultyPolicy.choices[mode],count:c.blitzWords?.length};})()`));
  assert(info.levels.every(x=>x===String(['easy','medium','hard'].indexOf(tier)+1)),JSON.stringify(info));assert.equal(info.policy,tier);
  if(mode==='blitz'){assert.equal(info.count,3);assert.equal(new Set(info.ids).size,3);}
  // The normal complete team validator verifies the actual selected IDs.
  if(teams)assert.equal(h.eval('QuipTeamsEngine.validateGame(game,taskMemory)'),true);
  // Exercise selection independently of settlement without inventing another turn.
  h.eval('game.current=null;game.phase="ready";game.modeHistory=[];game.modePlannerState=freshModePlan()');
 }
 const snapshot=h.eval('JSON.stringify([game.contentPack,game.taskDifficultyPolicy])');h.eval(`writeTaskDifficultyPreference(mode,tier==='hard'?'easy':'hard')`);assert.equal(h.eval('JSON.stringify([game.contentPack,game.taskDifficultyPolicy])'),snapshot);
});
test('Secret follows actual method and never expands an incompatible explicit source',()=>{
 const h=start('secret','method');h.eval("game.modes=['draw','secret'];game.taskDifficultyPolicy={version:1,choices:{...game.taskDifficultyPolicy.choices,draw:'hard'}};game.modes=['secret','draw'];");
 const methods=plain(h.eval("editorialSecretMethods(game.contentPack,game,'medium')"));assert.deepEqual(methods,['draw']);
 h.eval("pickMode=()=>getMode('secret');game.current=rollOutcome()");assert.equal(h.eval('game.current.methodId'),'draw');assert.equal(h.eval("QUIP_EDITORIAL_EDITION.records[game.current.cardId][3][2]"),'3');
 h.eval("game.taskDifficultyPolicy={version:1,choices:{...game.taskDifficultyPolicy.choices,secret:'easy'}}");assert.equal(h.eval("checkEditorialPack(game.contentPack,game).available"),false);
});
test('empty pools and unknown editions/policies fail closed without fallback',()=>{
 const h=start('talk','easy');h.eval("game.contentPack.excluded=QUIP_EDITORIAL_EDITION.categories.slice()");assert.equal(h.eval('checkContentPack(game.contentPack,game).available'),false);assert.throws(()=>h.eval('rollOutcome()'));
 h.eval("game.contentPack.edition.digest='0'.repeat(64)");assert.throws(()=>h.eval('validateEditorialGame(game)'));
 h.eval("localStorage.setItem(QUIP_TASK_DIFFICULTY_KEY,JSON.stringify({version:999,choices:{}}))");assert.equal(h.eval('readTaskDifficultyPreferences().policy'),null);assert.throws(()=>h.eval("writeTaskDifficultyPreference('draw','easy')"));
});
test('historical parties keep the old selector and exact RNG when new preferences change',()=>{
 const a=start('blitz','hard'),b=start('blitz','hard');
 for(const h of [a,b])h.eval('game.contentPack={id:"general",version:68};delete game.taskDifficultyPolicy');
 a.eval("writeTaskDifficultyPreference('blitz','easy')");b.eval("writeTaskDifficultyPreference('blitz','medium')");
 assert.equal(a.eval('JSON.stringify(rollOutcome())'),b.eval('JSON.stringify(rollOutcome())'));
});
