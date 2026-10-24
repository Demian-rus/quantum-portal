'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createSimulation,seededRandom}=require('../scripts/game-simulation.cjs');
function harness(storage=new Map()){
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const context=vm.createContext({Date,localStorage});vm.runInContext(fs.readFileSync(path.join(__dirname,'../card-reports.js'),'utf8'),context);
 return {context,storage,eval:s=>vm.runInContext(s,context)};
}
const item={cardId:'word-test-1',pack:{id:'general',version:6},context:'round',modeId:'talk',methodId:null,difficulty:'easy',text:'Мачта'};
function prepare(h){h.context.item=JSON.parse(JSON.stringify(item));}
test('reports: exact source IDs in all modes, Secret and every Blitz position survive queue rotations',()=>{
 for(const mode of ['talk','mime','draw','yesno','secret','blitz','sing','approx']){
  const h=createSimulation(19);h.context.mode=mode;
  h.eval("Object.assign(options,{modes:[mode],awardTo:'guesser',difficulty:'easy',dice:false,complications:false});newGame();roll()");
  const c=h.eval('game.current'),report=h.eval('currentReportItem(game)');
  assert.ok(report.cardId);assert.equal(report.text,c.word);assert.equal(report.cardId,c.question?.id??c.cardId);
  if(mode!=='approx'){
   const actual=h.eval("getPackCardPool(game.contentPack,getMode(game.current.methodId).kind,game.current.difficulty,game.promptTypes).find(c=>c.id===game.current.cardId)");
   assert.equal(actual.text,c.word);
  }
  if(mode==='secret')assert.equal(report.methodId,c.methodId);
  if(mode==='blitz'){
   assert.equal(c.blitzCardIds.length,c.blitzWords.length);assert.equal(new Set(c.blitzCardIds).size,c.blitzWords.length);
   h.eval('toggleWord();startTimer()');const clock=h.eval('game.current.deadline');
   for(let i=0;i<c.blitzWords.length*2;i++){
    const at=h.eval('game.current.blitzQueue[0]');assert.equal(h.eval('currentReportItem(game).cardId'),c.blitzCardIds[at]);
    assert.equal(h.eval('currentReportItem(game).text'),c.blitzWords[at]);h.eval('advanceBlitz(false)');
   }
   assert.equal(h.eval('game.current.deadline'),clock);
  }
 }
});
test('reports: selection metadata adds zero RNG calls and preserves every chosen outcome and planner state',()=>{
 const old=execFileSync('git',['show','042a9392a517d5bfacaee6e2ae3caf42ce99c72f:party-game/round-selection.js'],{encoding:'utf8'});
 for(const historical of [false,true])for(const mode of ['talk','mime','draw','yesno','secret','blitz','sing','approx']){
  const current=createSimulation(7),baseline=createSimulation(7);vm.runInContext(old,baseline.context);
  const configure=h=>{
   h.context.mode=mode;h.context.historical=historical;
   h.eval("Object.assign(options,{modes:[mode],awardTo:'guesser',difficulty:'mixed',dice:false,complications:true});newGame();if(historical){delete game.taskHistoryVersion;delete game.taskHistory;delete game.modifierSelectionVersion;delete game.modifierCatalogVersion;delete game.modifierChance;delete game.modifierRecent;}");
   let calls=0;const random=seededRandom(781);h.context.Math.random=()=>{calls++;return random()};return()=>calls;
  };
  const ca=configure(current),cb=configure(baseline);
  for(let round=0;round<5;round++){
   const a=current.eval('rollOutcome()'),b=baseline.eval('rollOutcome()');delete a.cardId;delete a.blitzCardIds;
   assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),mode);
   assert.equal(ca(),cb());
   assert.equal(current.eval('JSON.stringify([game.taskHistory,game.used,game.modeHistory,game.plannerState,game.modePlannerState])'),baseline.eval('JSON.stringify([game.taskHistory,game.used,game.modeHistory,game.plannerState,game.modePlannerState])'));
  }
 }
});
test('reports: legacy snapshots do not invent an ID from equal text; numerical tie uses its own ID',()=>{
 const h=harness();h.context.match={phase:'task',contentPack:{id:'general',version:1},current:{modeId:'talk',difficulty:'easy',word:'Мачта'}};
 assert.equal(h.eval('currentReportItem(match).cardId'),null);
 h.context.match.phase='tiebreak';h.context.match.tiebreak={question:{id:'approx-test-3',difficulty:'hard',question:'Сколько?'}};
 assert.equal(h.eval('currentReportItem(match).cardId'),'approx-test-3');
 assert.equal(h.eval('currentReportItem(match).context'),'tiebreak');
});
test('reports: add, explicit edit and restart preserve one entry without leaking personal match data',()=>{
 const h=harness();prepare(h);h.eval("saveCardReport(item,'error')");const raw=h.storage.get('kvip-card-reports:v1');
 const exists=h.eval("saveCardReport(item,'hard')");assert.equal(exists.status,'exists');assert.equal(h.storage.get('kvip-card-reports:v1'),raw);
 h.context.previous=JSON.stringify(exists.row);h.eval("saveCardReport(item,'other','  Есть   ошибка  ',{allowUpdate:true,expectedRow:previous})");
 const restarted=harness(h.storage);assert.equal(restarted.eval('readCardReports().data.items.length'),1);
 assert.equal(restarted.eval('readCardReports().data.items[0].comment'),'Есть ошибка');
 const exported=JSON.parse(restarted.eval('createCardReportsText()'));
 assert.equal(exported.kind,'kvip-card-reports');assert.equal(exported.archive.items.length,1);
 assert.ok(!/profile|score|teams|history|matchId/i.test(JSON.stringify(exported)));
});
test('reports: comment limit counts Unicode characters and malformed archive is never overwritten',()=>{
 const h=harness();prepare(h);h.context.comment='😀'.repeat(160);h.eval("saveCardReport(item,'other',comment)");
 const before=h.storage.get('kvip-card-reports:v1');h.context.comment='a'.repeat(161);
 assert.throws(()=>h.eval("saveCardReport({...item,cardId:'word-second'},'other',comment)"),/160/);
 assert.equal(h.storage.get('kvip-card-reports:v1'),before);
 for(const raw of ['{broken','{"version":2,"items":[]}','{"version":1,"items":[],"profiles":[]}']){
  h.storage.set('kvip-card-reports:v1',raw);assert.throws(()=>h.eval("saveCardReport(item,'error')"));assert.equal(h.storage.get('kvip-card-reports:v1'),raw);
 }
});
test('reports: 500-entry limit preserves all earlier records while allowing explicit edits and removal',()=>{
 const h=harness();prepare(h);h.eval("var rows={version:1,items:[]};for(let i=0;i<500;i++){let target={...item,cardId:'word-test-'+i};rows.items.push({itemKey:reportItemKey(target),item:target,reason:'error',comment:'',createdAt:1,updatedAt:1})}localStorage.setItem(QUIP_CARD_REPORTS_KEY,JSON.stringify(rows))");
 const raw=h.storage.get('kvip-card-reports:v1');assert.throws(()=>h.eval("saveCardReport({...item,cardId:'word-over-limit'},'hard')"),/500/);assert.equal(h.storage.get('kvip-card-reports:v1'),raw);
 h.eval("var row=readCardReports().data.items[0];saveCardReport(row.item,'hard','',{allowUpdate:true,expectedRow:JSON.stringify(row)})");
 assert.equal(h.eval('readCardReports().data.items.length'),500);
 h.eval("var row=readCardReports().data.items[0];deleteCardReport(row.itemKey,JSON.stringify(row))");assert.equal(h.eval('readCardReports().data.items.length'),499);
});
test('reports: storage quota/readback failures report failure and verify original RAW',()=>{
 for(const failure of ['quota','readback']){
  const h=harness();prepare(h);h.eval("saveCardReport(item,'error')");const old=h.storage.get('kvip-card-reports:v1'),set=h.context.localStorage.setItem,get=h.context.localStorage.getItem;
  let once=true,wrong=false;
  h.context.localStorage.setItem=(k,v)=>{if(once){once=false;if(failure==='quota')throw Error('quota');set(k,v);wrong=true}else set(k,v)};
  h.context.localStorage.getItem=k=>{if(wrong){wrong=false;return 'wrong'}return get(k)};
  assert.throws(()=>h.eval("saveCardReport({...item,cardId:'word-second'},'error')"),/не удалось сохранить/);assert.equal(h.storage.get('kvip-card-reports:v1'),old);
 }
});
test('reports: stale edit/delete/clear snapshots and unknown personal fields are rejected',()=>{
 const h=harness();prepare(h);h.eval("saveCardReport(item,'error')");const before=h.storage.get('kvip-card-reports:v1');
 assert.throws(()=>h.eval("saveCardReport(item,'hard','',{allowUpdate:true,expectedRow:'stale'})"),/изменилось/);
 assert.throws(()=>h.eval("deleteCardReport(reportItemKey(item),'stale')"),/изменилось/);
 assert.throws(()=>h.eval("clearCardReports('stale')"),/изменился/);
 assert.throws(()=>h.eval("saveCardReport({...item,profileId:'private'},'error')"));assert.equal(h.storage.get('kvip-card-reports:v1'),before);
 h.context.raw=before;h.eval('clearCardReports(raw)');assert.equal(h.eval('readCardReports().data.items.length'),0);
});
test('reports: reporting does not change live game RAW, scores, profiles, visibility or timer',()=>{
 const h=createSimulation(1);h.eval("Object.assign(options,{modes:['talk'],difficulty:'easy',dice:false});newGame();roll();toggleWord();startTimer()");
 const game=h.eval('JSON.stringify(game)'),main=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
 h.eval("Math.random=()=>{throw Error('report consumed RNG')};saveCardReport(currentReportItem(game),'other','Проверить')");
 assert.equal(h.eval('JSON.stringify(game)'),game);assert.equal(h.storage.get('iskra-party:v1'),main);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
});
