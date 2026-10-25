'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const item={cardId:'word-feedback-1',pack:{id:'general',version:13},context:'round',modeId:'talk',methodId:null,difficulty:'easy',text:'Мачта'};
const plain=x=>JSON.parse(JSON.stringify(x));
test('feedback: ordinary timer controller is byte-exact after removing only five hold guards',()=>{
 const current=fs.readFileSync(path.join(__dirname,'../timer-controller.js'),'utf8');
 assert.equal((current.match(/\|\|game\.current\??\.feedbackHold/g)||[]).length,5);
 const original=current.replaceAll('||game.current.feedbackHold','').replaceAll('||game.current?.feedbackHold','');
 assert.equal(original,execFileSync('git',['show','959017bf33c5bb8a8fd08ba047ad99c82682e32d:party-game/timer-controller.js'],{encoding:'utf8'}));
});
function archive(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const c=vm.createContext({localStorage:storage,Date,Math:Object.assign(Object.create(Math),{random(){throw Error('RNG');}})});
 for(const n of ['card-reports.js','card-feedback.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',n),'utf8'),c);
 c.item=plain(item);return {map,storage,c,eval:s=>vm.runInContext(s,c)};
}
function clock({difficulty='easy',phase='play',paused=false}={}){
 const h=createSimulation(89);h.context.localStorage.removeItem=k=>h.storage.delete(k);
 h.context.clockNow=Date.now();h.eval('Date=class extends Date{static now(){return clockNow}}');
 h.context.level=difficulty;h.context.stage=phase;h.context.wasPaused=paused;
 h.eval("Object.assign(options,{modes:['talk'],difficulty:level,dice:false,complications:false});newGame();game.dice=false;roll();game.dice=true;options.dice=true;game.phase=stage;Object.assign(game.current,{visible:true,deadline:stage==='play'&&!wasPaused?Date.now()+12345:null,paused:wasPaused,remainingMs:wasPaused?12345:null,autoStartAt:stage==='countdown'?Date.now()+650:null});persist();Math.random=()=>{throw Error('RNG')}");
 return h;
}
test('feedback: stable IDs + pack context, legacy keys, dedup and no match/profile data or RNG',()=>{
 const a=archive();a.map.set('iskra-party:v1','game bytes');a.map.set('kvip-player-profiles:v1','profile bytes');
 assert.equal(a.eval('saveCardApproval(item).status'),'saved');const raw=a.map.get('kvip-card-approvals:v1');
 assert.equal(a.eval('saveCardApproval(item).status'),'exists');assert.equal(a.map.get('kvip-card-approvals:v1'),raw);
 a.eval('saveCardApproval({...item,pack:{id:"general",version:12}});saveCardApproval({...item,cardId:null})');
 assert.equal(a.eval('readCardApprovals().data.items.length'),3);
 assert.equal(a.map.get('iskra-party:v1'),'game bytes');assert.equal(a.map.get('kvip-player-profiles:v1'),'profile bytes');
 const out=JSON.parse(a.eval('createCardFeedbackText()'));assert.equal(out.approvals.version,1);assert.equal(out.reports.version,1);
 assert.ok(!/profileId|profileMatch|team|scores|matchId/.test(JSON.stringify(out)));
});
test('feedback: explicit rating changes move one identity between archives; old report JSON format survives',()=>{
 const a=archive();a.eval("saveCardReport(item,'error','Проверить')");
 assert.equal(a.eval('saveCardApproval(item).status'),'change-required');assert.equal(a.eval('readCardReports().data.items.length'),1);
 a.eval('saveCardApproval(item,{replaceReport:true,expectedReport:JSON.stringify(readCardReports().data.items[0])})');
 assert.equal(a.eval('readCardReports().data.items.length'),0);assert.equal(a.eval('readCardApprovals().data.items.length'),1);
 assert.equal(a.eval("saveCardFeedbackReport(item,'theme','Комментарий для любой причины').status"),'change-required');
 a.eval("saveCardFeedbackReport(item,'theme','Комментарий для любой причины',{replaceApproval:true,expectedApproval:JSON.stringify(readCardApprovals().data.items[0])})");
 assert.equal(a.eval('readCardApprovals().data.items.length'),0);
 const out=JSON.parse(a.eval('createCardReportsText()'));assert.equal(out.kind,'kvip-card-reports');assert.equal(out.version,1);assert.equal(out.archive.items[0].comment,'Комментарий для любой причины');
});
test('feedback: capacity, unknown versions and stale clear protect original approvals',()=>{
 const a=archive();a.eval('for(let i=0;i<500;i++)saveCardApproval({...item,cardId:"word-cap-"+i})');const raw=a.map.get('kvip-card-approvals:v1');
 assert.throws(()=>a.eval('saveCardApproval(item)'),/500/);assert.equal(a.map.get('kvip-card-approvals:v1'),raw);
 assert.throws(()=>a.eval('clearCardApprovals(null)'),/изменились/);assert.equal(a.map.get('kvip-card-approvals:v1'),raw);
 a.map.set('kvip-card-approvals:v1','{"version":2,"items":[]}');assert.throws(()=>a.eval('saveCardApproval(item)'),/верси/);assert.equal(a.map.get('kvip-card-approvals:v1'),'{"version":2,"items":[]}');
});
test('feedback: quota and post-write faults roll back both archives during a rating change',()=>{
 for(const direction of ['approve','report'])for(const afterWrite of [false,true]){
  const a=archive();a.eval(direction==='approve'?"saveCardReport(item,'hard')":'saveCardApproval(item)');const before=[...a.map];
  const set=a.storage.setItem;let failed=false;
  a.storage.setItem=(k,v)=>{if(k===(direction==='approve'?'kvip-card-approvals:v1':'kvip-card-reports:v1')&&!failed){failed=true;if(afterWrite)set(k,v);throw Error('quota');}return set(k,v);};
  assert.throws(()=>a.eval(direction==='approve'?'saveCardApproval(item,{replaceReport:true,expectedReport:JSON.stringify(readCardReports().data.items[0])})':"saveCardFeedbackReport(item,'error','',{replaceApproval:true,expectedApproval:JSON.stringify(readCardApprovals().data.items[0])})"));
  assert.deepEqual([...a.map].sort(),before.sort());
 }
});
test('feedback: unconfirmed rating-change rollback blocks writes and retains the confirmed replacement',()=>{
 const a=archive();a.eval("saveCardReport(item,'hard')");const old=a.map.get('kvip-card-reports:v1');const set=a.storage.setItem;
 a.storage.setItem=(k,v)=>{if(k==='kvip-card-reports:v1'){if(v===old)throw Error('rollback');set(k,v);throw Error('post-write');}return set(k,v);};
 assert.throws(()=>a.eval('saveCardApproval(item,{replaceReport:true,expectedReport:JSON.stringify(readCardReports().data.items[0])})'),/откат/);
 assert.equal(a.eval('cardReportsBlocked&&cardApprovalsBlocked'),true);assert.equal(a.eval('readCardApprovals().data.items.length'),1);
 assert.throws(()=>a.eval('saveCardApproval({...item,cardId:"word-another"})'),/заблок/);
});
test('feedback clock: all difficulties hold exactly and restart without timeout, settlement, profiles or RNG',()=>{
 for(const difficulty of ['easy','medium','hard','mixed']){
  const h=clock({difficulty}),before=plain(h.eval('game')),profiles=h.storage.get('kvip-player-profiles:v1');
  assert.equal(h.eval('holdFeedbackTimer()'),true);assert.equal(h.eval('game.current.feedbackHold.remainingMs'),12345);
  h.eval('clockNow+=500000;tick();handleAction("correct-now");resumeTimer()');assert.equal(h.eval('game.phase'),'play');assert.equal(h.eval('game.roundIndex'),0);
  const held=h.storage.get('iskra-party:v1'),r=createSimulation(3,new Map(h.storage));
  assert.equal(r.storage.get('iskra-party:v1'),held);assert.equal(r.eval('game.current.feedbackHold.remainingMs'),12345);assert.equal(r.eval('game.phase'),'play');
  r.context.clockNow=Date.now()+600000;r.eval('Date=class extends Date{static now(){return clockNow}};Math.random=()=>{throw Error("RNG")};releaseFeedbackTimer()');
  assert.equal(r.eval('game.current.deadline-Date.now()'),12345);assert.equal(r.eval('game.current.paused'),false);
  const after=plain(r.eval('game'));for(const k of Object.keys(before).filter(k=>k!=='current'))assert.deepEqual(after[k],before[k],k);
  assert.equal(r.storage.get('kvip-player-profiles:v1'),profiles);
  if(difficulty!=='easy'){const raw=r.storage.get('iskra-party:v1');r.eval('pauseTimer()');assert.equal(r.storage.get('iskra-party:v1'),raw);}
 }
});
test('feedback clock: an already paused party stays paused and countdown resumes only its unused part',()=>{
 const h=clock({paused:true}),before=plain(h.eval('game'));h.eval('holdFeedbackTimer();clockNow+=90000;releaseFeedbackTimer()');assert.deepEqual(plain(h.eval('game')),before);
 const c=clock({difficulty:'hard',phase:'countdown'});c.eval('holdFeedbackTimer();clockNow+=100000;tick()');assert.equal(c.eval('game.phase'),'countdown');assert.equal(c.eval('game.current.feedbackHold.remainingMs'),650);
 const r=createSimulation(4,new Map(c.storage));assert.equal(r.eval('game.phase'),'countdown');r.context.clockNow=Date.now()+200000;r.eval('Date=class extends Date{static now(){return clockNow}};releaseFeedbackTimer()');
 assert.equal(r.eval('game.current.autoStartAt-Date.now()'),650);r.eval('clockNow+=651;tick()');assert.equal(r.eval('game.phase'),'play');assert.equal(r.eval('game.history.length'),0);
 const boundary=clock({difficulty:'hard',phase:'countdown'});boundary.eval('clockNow+=651');assert.equal(boundary.eval('holdFeedbackTimer()'),true);assert.equal(boundary.eval('game.current.feedbackHold.phase'),'play');assert.equal(boundary.eval('game.current.feedbackHold.remainingMs'),boundary.eval('game.current.seconds*1000-1'));
});
test('feedback clock: a post-write readback fault rolls back entry or release with the exact old RAW',()=>{
 for(const release of [false,true]){
  const h=clock();if(release)h.eval('holdFeedbackTimer()');const raw=h.storage.get('iskra-party:v1'),state=plain(h.eval('game'));
  const get=h.context.localStorage.getItem,set=h.context.localStorage.setItem;let once=true,wrong=false;
  h.context.localStorage.setItem=(k,v)=>{set(k,v);if(once&&k==='iskra-party:v1'){once=false;wrong=true;}};
  h.context.localStorage.getItem=k=>{if(wrong&&k==='iskra-party:v1'){wrong=false;return 'unconfirmed';}return get(k);};
  assert.throws(()=>h.eval(release?'releaseFeedbackTimer()':'holdFeedbackTimer()'),/сохранить таймер/);
  assert.equal(h.storage.get('iskra-party:v1'),raw);assert.deepEqual(plain(h.eval('game')),state);
 }
});
test('feedback clock: expiry cannot be revived; failed hold preserves RAW and an unknown hold is protected',()=>{
 const h=clock();h.eval('clockNow+=20000');assert.equal(h.eval('holdFeedbackTimer()'),false);assert.equal(h.eval('game.phase'),'judge');assert.equal(h.eval('game.history.length'),0);
 const f=clock(),raw=f.storage.get('iskra-party:v1'),state=plain(f.eval('game'));f.context.localStorage.setItem=()=>{throw Error('quota')};assert.throws(()=>f.eval('holdFeedbackTimer()'),/сохранить таймер/);assert.deepEqual(plain(f.eval('game')),state);assert.equal(f.storage.get('iskra-party:v1'),raw);
 const unknown=clock();unknown.eval('holdFeedbackTimer();game.current.feedbackHold.version=2;persist()');const saved=unknown.storage.get('iskra-party:v1'),r=createSimulation(1,new Map(unknown.storage));assert.equal(r.eval('storageBlocked'),true);assert.equal(r.storage.get('iskra-party:v1'),saved);
});
test('UX aliases are exact display-only matches; saved/custom/V1 snapshots and catalogs stay unchanged',()=>{
 const h=clock(),source='Напевай с закрытым ртом, без произнесения слов. Не задерживай дыхание.';
 h.context.source=source;h.eval('Object.assign(game.current,{modifierVersion:2,complicationId:"v2-closed-mouth",complication:source});persist()');const raw=h.storage.get('iskra-party:v1');
 assert.equal(h.eval('displayedRoundCondition(game.current)'),'Напевай с закрытым ртом, без слов.');h.eval('roundConditionMarkup()');assert.equal(h.storage.get('iskra-party:v1'),raw);
 assert.equal(h.eval('displayedRoundCondition({...game.current,modifierVersion:1})'),source);assert.equal(h.eval('displayedRoundCondition({...game.current,complication:"Особое условие"})'),'Особое условие');
 for(const name of ['content/modifiers/v2.json','modifiers-v2.js','modifiers.js','round-selection.js','round-actions.js','round-settlement.js','player-profiles.js','profile-backup.js','storage-controller.js'])assert.equal(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),execFileSync('git',['show','959017bf33c5bb8a8fd08ba047ad99c82682e32d:party-game/'+name],{encoding:'utf8',maxBuffer:8e6}));
});
