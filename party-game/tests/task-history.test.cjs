'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../task-history.js'),{createSimulation}=require('../scripts/game-simulation.cjs');
const row=(id,text,type='word')=>({id,text,type});
function start(memory=H.freshTaskMemory()){return H.startTaskHistory(memory)}
function choose(pool,state,extra={}){const selected=H.selectHistoryRecord(pool,state.history,state.memory,{random:()=>0,...extra});state.history=selected.history;return selected}
test('TASK009 B normalized text crosses ordinary modes and music, while people/questions and IDs stay distinct',()=>{
 const state=start(),word=row('word-1','ЁЛКА'),song=row('song-1',' елка! ','song'),other=row('word-2','ОПЫТ С ЁЛКОЙ');
 assert.equal(choose([word,other],state).record.id,'word-1');assert.equal(choose([song,other],state).record.id,'word-2');
 assert.equal(choose([row('person-1','ЁЛКА','person')],state).exhausted,false);
 assert.equal(choose([{id:'approx-1',question:'ЁЛКА',answer:'1'}],state).exhausted,false);
 const a=row('word-a','ДЕРЖАТЬ ЯЗЫК ЗА ЗУБАМИ'),b=row('idiom-b','ЯЗЫК ЗА ЗУБАМИ','idiom');a.meta=b.meta={equivalenceKey:'держать-язык'};const aliases=start();choose([a],aliases);assert.equal(choose([b],aliases).exhausted,true);
});
test('TASK009 B current uniqueness outranks past history; the oldest previous party releases first',()=>{
 const [a,b,c]=['A','B','C'].map((text,i)=>row('word-'+i,text));let state=start();choose([b],state);state.memory=H.archiveTaskHistory(state.memory,state.history);state=start(state.memory);choose([c],state);state.memory=H.archiveTaskHistory(state.memory,state.history);state=start(state.memory);choose([a],state);
 const chosen=choose([a,b,c],state);assert.equal(chosen.record.id,b.id);assert.equal(chosen.releasedParties,1);assert.equal(chosen.exhausted,false);
});
test('TASK009 B exactly ten nonempty parties survive, repeated archive/reload cannot duplicate a match',()=>{
 let memory=H.freshTaskMemory();for(let i=1;i<=12;i++){const state=start(memory);choose([row('word-'+i,'СЛОВО '+i)],state);memory=H.archiveTaskHistory(state.memory,state.history);assert.deepEqual(H.archiveTaskHistory(memory,state.history),memory);memory=JSON.parse(JSON.stringify(memory));H.validateTaskMemory(memory)}
 assert.deepEqual(memory.parties,[3,4,5,6,7,8,9,10,11,12]);assert.equal(memory.seen.some(([key])=>key==='prompt:id:word-1'),false);
 const empty=start(memory);assert.deepEqual(H.archiveTaskHistory(empty.memory,empty.history).parties,memory.parties);
});
test('TASK009 B exhaustion is finite and least-recent; strict Blitz exclusions never relax',()=>{
 const pool=[row('a','СЛОН'),row('b','КОТ'),row('c','КИТ')],state=start();const draws=[];for(let i=0;i<6;i++)draws.push(choose(pool,state).record.id);assert.deepEqual(draws,['a','b','c','a','b','c']);
 assert.equal(choose(pool,state,{onExhaustion:'skip'}).record,null);
 const round=start();let excluded=[];for(let i=0;i<3;i++){const chosen=choose(pool,round,{excludedKeys:excluded});excluded.push(...H.taskRecordKeys(chosen.record))}assert.throws(()=>choose(pool,round,{excludedKeys:excluded}),/distinct eligible/);
});
test('TASK009 B interrupted party, replacement and every Blitz card are remembered across restart and new match',()=>{
 const stored=new Map(),h=createSimulation(2,stored);h.eval('options.dice=false;options.modes=["talk"];options.complications=false;newGame();roll()');const first=h.eval('game.current.word');h.eval('replaceWord()');const replaced=h.eval('game.current.word');assert.notEqual(first,replaced);
 h.eval('game.dice=true;persist()');const snapshot=h.eval('JSON.stringify(game)'),again=createSimulation(2,stored);assert.equal(again.eval('JSON.stringify(game)'),snapshot);
 again.eval('options.dice=false;options.modes=["blitz"];newGame();roll()');const words=Array.from(again.eval('game.current.blitzWords'));assert.equal(new Set(words.map(H.normalizeTaskText)).size,3);assert.equal(words.includes(first)||words.includes(replaced),false);
 assert.equal(again.eval('taskMemory.parties.length'),1);assert.equal(again.eval('game.taskHistory.seen.filter(k=>k.startsWith("prompt:id:")).length'),3);
 again.eval('game.dice=true;persist()');const third=createSimulation(3,stored);third.eval('options.dice=false;options.modes=["talk"];newGame();roll()');assert.equal([first,replaced,...words].includes(third.eval('game.current.word')),false);
});
test('TASK009 B old snapshots keep their prior selector and unknown history versions preserve original bytes',()=>{
 const original=new Map(),old=createSimulation(2,original);old.eval('options.dice=false;options.modes=["talk"];newGame();roll();delete game.taskHistoryVersion;delete game.taskHistory;game.modifierSelectionVersion=1;delete game.modifierCatalogVersion;taskMemory=null;game.dice=true;persist()');const snapshot=old.eval('JSON.stringify(game)'),loaded=createSimulation(3,original);assert.equal(loaded.eval('JSON.stringify(game)'),snapshot);assert.equal(loaded.eval('game.taskHistoryVersion'),undefined);
 for(const mutation of ['game.taskHistoryVersion=99','taskMemory.version=99','game.taskHistory.seen=[null]']){
  const store=new Map(),a=createSimulation(1,store);a.eval('newGame();'+mutation+';persist()');const raw=store.get('iskra-party:v1'),b=createSimulation(1,store);assert.equal(b.eval('storageBlocked'),true);b.eval('persist();newGame()');assert.equal(store.get('iskra-party:v1'),raw);
 }
});
test('TASK009 B completion, menu and replay archive one match only',()=>{
 const h=createSimulation(1);h.eval('options.finishType="rounds";options.rounds=2;options.dice=false;options.modes=["talk"];newGame();roll();game.phase="judge";judge(false);roll();game.phase="judge";judge(false)');assert.equal(h.eval('game.phase'),'results');assert.equal(h.eval('taskMemory.parties.length'),1);h.eval('archiveCurrentTaskHistory();backToMenu();newGame()');assert.equal(h.eval('taskMemory.parties.length'),1);
});
