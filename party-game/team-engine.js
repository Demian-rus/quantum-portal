'use strict';
// A versioned team projection over the existing task selector, reward math and
// review replay. Duel functions and historical rule/catalog versions stay exact.
const QuipTeamsEngine=(function teamEngine(){
 const VERSION=1,FORMAT='teams-2x2',copy=value=>JSON.parse(JSON.stringify(value));
 const old={};let installed=false;
 const isGame=match=>match?.teamPolicyVersion===VERSION&&match.teamFormat?.format===FORMAT;
 const isSettings=value=>isGame(value)||value?.playFormat===FORMAT&&value.teamPolicyVersion===VERSION||value?.teamProjectionVersion===VERSION;
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const catalogCache=new Map();
 function catalog(match,kind,level){
  const key=JSON.stringify([match.contentPack,kind,level,match.promptTypes]);let pool=catalogCache.get(key);
  if(!pool){const rows=kind==='number'?getPackQuestionPool(match.contentPack,level):getPackCardPool(match.contentPack,kind,level,match.promptTypes);pool={rows,byId:new Map(rows.map(row=>[row.id,row]))};if(catalogCache.size>=128)catalogCache.delete(catalogCache.keys().next().value);catalogCache.set(key,pool);}
  return pool;
 }
 function assert(condition,message){if(!condition)throw Error('TEAM_GAME: '+message);}
 function exact(value,fields){assert(value&&typeof value==='object'&&!Array.isArray(value)&&equal(Object.keys(value).sort(),fields.slice().sort()),'неизвестные или неполные поля');}
 function roles(match,index=match.roundIndex){return QuipTeamFormat.roles(match.teamFormat,index);}
 function projectRow(match,row,index){
  const r=copy(row);r.guesserIndex=1-r.setterIndex;r.setter=match.teams[r.setterIndex];return r;
 }
 function actualRow(match,row,index){
  const r=roles(match,index);return {...row,guesserIndex:r.teamIndex,setter:r.setterName,guesser:r.guesserName,teamRoles:QuipTeamFormat.turnIdentity(match.teamFormat,index)};
 }
 function projection(match,history=match.history){
  const p={...match,history:history.map((r,i)=>projectRow(match,r,i)),teamProjectionVersion:VERSION};
  delete p.teamFormat;delete p.teamPolicyVersion;
  if(match.resultEditor)p.resultEditor={...match.resultEditor,history:match.resultEditor.history.map((r,i)=>projectRow(match,r,i))};
  return p;
 }
 function replay(match,history=match.history,tie=match.tiebreak){
  history.forEach((row,i)=>validateRowRoles(match,row,i));
  const p=projection(match,history),out=old.replayResultHistory(p,p.history,tie);
  return {...out,history:out.history.map((r,i)=>actualRow(match,r,i))};
 }
 function validateRowRoles(match,row,index){
  const r=roles(match,index);QuipTeamFormat.validateTurnIdentity(match.teamFormat,index,row.teamRoles);
  assert(row.setterIndex===r.teamIndex&&row.guesserIndex===r.teamIndex&&row.setter===r.setterName&&row.guesser===r.guesserName,'история содержит чужую команду или роль');
  QuipTeamFormat.validateTurnIdentity(match.teamFormat,index,row.review?.round?.teamRoles);
  if(row.mode==='approx')assert(equal(row.assignedIndices,[0,1]),'на числовой вопрос отвечают обе команды');
  else assert(row.recipientIndex===r.teamIndex&&row.awardTo==='setter'&&row.awardPolicyVersion===1,'получатель командных очков изменён');
 }
 function review(match){
  match.history.forEach((row,i)=>validateRowRoles(match,row,i));
  if(match.resultEditor)match.resultEditor.history.forEach((row,i)=>validateRowRoles(match,row,i));
  old.validateResultReview(projection(match));
  const canonical=replay(match);
  assert(equal(canonical.history,match.history)&&equal(canonical.scores,match.scores),'командный счёт не совпадает с пересчётом');
 }
 function optionsFor(raw){
  const base=sanitizeOptions(raw),modes=Array.isArray(raw?.modes)?DEFAULT_MODES.filter(id=>raw.modes.includes(id)):DEFAULT_MODES.slice();
  return {...base,modes,awardTo:'setter',playFormat:FORMAT,teamPolicyVersion:VERSION,scoring:FORMAT,preset:null};
 }
 function validateRound(match,c,index){
  assert(c&&DEFAULT_MODES.includes(c.modeId)&&match.modes.includes(c.modeId),'неверный режим хода');
  QuipTeamFormat.validateTurnIdentity(match.teamFormat,index,c.teamRoles);
  const config=modeConfigForGame(match,c.modeId),method=modeConfigForGame(match,c.methodId);
  assert(c.modeId==='secret'?method.secretMethod:c.methodId===c.modeId,'неверный способ задания');
  assert(['easy','medium','hard'].includes(c.difficulty)&&c.usesTimer===config.usesTimer,'неверная сложность или таймер');
  assert(match.difficulty==='mixed'||c.difficulty===match.difficulty,'сложность хода изменилась');
  assert(c.basePoints===rewardForRound(match,c.modeId,c.difficulty)&&c.modifierPoints===(c.complication?config.modifierBonus:0)&&c.points===c.basePoints+c.modifierPoints,'изменена награда хода');
  assert(c.seconds===(config.usesTimer?match.duration+method.durationBonus:0),'изменено время хода');
  assert(typeof c.risk==='boolean'&&typeof c.visible==='boolean'&&typeof c.paused==='boolean','повреждён снимок хода');
  if(c.complication){const modifier=QUIP_MODIFIERS_V2.find(m=>m.id===c.complicationId),card=c.modeId==='approx'?null:catalog(match,method.kind,c.difficulty).byId.get(c.modeId==='blitz'?c.blitzCardIds?.[0]:c.cardId);assert(config.usesModifiers&&c.modifierVersion===2&&modifier?.text===c.complication&&getV2ModifierPool(c.methodId,c.difficulty,match,{card}).some(m=>m.id===c.complicationId),'изменено усложнение');}
  else assert(c.complication===''&&c.complicationId===null&&c.modeId!=='secret','нет обязательного усложнения');
  if(c.modeId==='approx'){
   const question=catalog(match,'number',c.difficulty).byId.get(c.question?.id);
   assert(question&&['question','answer'].every(k=>question[k]===c.question[k])&&String(question.unit||'')===String(c.question.unit||'')&&String(question.note||'')===String(c.question.note||'')&&c.cardId===question.id&&c.word===question.question&&!c.risk,'изменён числовой вопрос');
  }else if(c.modeId==='blitz'){
   const pool=catalog(match,'blitz',c.difficulty);
   assert(c.blitzRequired===3&&Array.isArray(c.blitzWords)&&c.blitzWords.length===3&&new Set(c.blitzWords).size===3&&Array.isArray(c.blitzCardIds)&&c.blitzCardIds.length===3,'Блиц должен содержать ровно три слова');
   assert(c.blitzWords.every((word,i)=>pool.byId.get(c.blitzCardIds[i])?.text===word),'изменены карточки Блица');
   assert(Number.isInteger(c.blitzCorrect)&&c.blitzCorrect>=0&&c.blitzCorrect<=3&&Number.isSafeInteger(c.blitzIndex)&&c.blitzIndex>=c.blitzCorrect&&Array.isArray(c.blitzQueue)&&c.blitzQueue.length===3-c.blitzCorrect&&new Set(c.blitzQueue).size===c.blitzQueue.length&&c.blitzQueue.every(i=>[0,1,2].includes(i)),'повреждена очередь Блица');
   assert(c.blitzWords.includes(c.word)&&c.blitzCardIds[c.blitzWords.indexOf(c.word)]===c.cardId&&(!c.blitzQueue.length||c.word===c.blitzWords[c.blitzQueue[0]]),'неверное текущее слово Блица');
  }else{
   const pool=catalog(match,method.kind,c.difficulty),card=pool.byId.get(c.cardId);
   assert(card?.text===c.word,'карточка не принадлежит закреплённому каталогу');
   if(method.kind==='songs')assert(filterSongLanguagePool([card],match,c.modeId).length===1,'неверный язык песни');
  }
 }
 const GAME_FIELDS=['matchId','teamFormat','teamPolicyVersion','teams','scores','roundIndex','startingTeamIndex','resultReviewVersion','reviewRevision','reviewConfirmed','songLanguagePolicyVersion','songLanguages','timerPolicyVersion','finishPolicyVersion','taskHistoryVersion','taskHistory','rounds','targetScore','finishType','riskPolicyVersion','riskPlannerState','riskRounds','scoringVersion','rulesVersion','modeConfigVersion','awardPolicyVersion','awardTo','modeCompatibilityVersion','modifierCatalogVersion','modifierSelectionVersion','modifierChance','modifierRecent','plannerVersion','plannerState','modePlannerVersion','modePlannerState','duration','difficulty','contentPack','preset','modes','promptTypes','dice','complications','blitzCount','current','modeHistory','used','history','phase','pendingReview','resultEditor','reviewSuspendedRound','reviewTiebreakArchive','tiebreak'];
 function validateGame(match,memory){
  assert(installed&&isGame(match),'неизвестная версия командной механики');QuipTeamFormat.validate(match.teamFormat);
  assert(Object.keys(match).every(k=>GAME_FIELDS.includes(k))&&!Object.hasOwn(match,'profileMatch')&&match.matchId===match.teamFormat.id,'неверная идентичность партии');
  assert(equal(match.teams,match.teamFormat.teams.map(t=>t.name))&&match.startingTeamIndex===match.teamFormat.opening.teamIndex,'изменены команды или старт');
  for(const [key,value]of Object.entries({scoringVersion:2,rulesVersion:5,modeConfigVersion:1,awardPolicyVersion:1,awardTo:'setter',modeCompatibilityVersion:1,resultReviewVersion:1,taskHistoryVersion:1,timerPolicyVersion:1,finishPolicyVersion:1,riskPolicyVersion:1,modifierCatalogVersion:2,modifierSelectionVersion:2,plannerVersion:1,modePlannerVersion:1,blitzCount:3}))assert(match[key]===value,'неизвестная политика '+key);
  assert(Array.isArray(match.scores)&&match.scores.length===2&&match.scores.every(n=>Number.isSafeInteger(n)&&n>=0)&&Number.isSafeInteger(match.roundIndex)&&match.roundIndex>=0&&Array.isArray(match.history)&&match.history.length===match.roundIndex,'неверные суммы или число ходов');
  assert(['easy','medium','hard','mixed'].includes(match.difficulty)&&Number.isInteger(match.duration)&&match.duration>=30&&match.duration<=90&&match.duration%5===0&&['score','rounds'].includes(match.finishType)&&Number.isInteger(match.rounds)&&match.rounds>=2&&match.rounds<=100&&match.rounds%2===0&&Number.isInteger(match.targetScore)&&match.targetScore>=15&&match.targetScore<=100&&match.targetScore%5===0,'неверные настройки партии');
  assert(Array.isArray(match.modes)&&match.modes.length>0&&new Set(match.modes).size===match.modes.length&&match.modes.every(id=>DEFAULT_MODES.includes(id))&&Array.isArray(match.promptTypes)&&match.promptTypes.every(t=>PROMPT_TYPES.includes(t)),'неверные режимы или типы');
  assert(typeof match.dice==='boolean'&&typeof match.complications==='boolean'&&typeof match.riskRounds==='boolean'&&sanitizeModifierChance(match.modifierChance)===match.modifierChance,'неверные опции');
  getContentPack(match.contentPack);songLanguagePolicy(match);timerPolicy(match);modifierSelectionPolicy(match);validateTaskMemory(memory);validateGameTaskHistory(match,memory);
  validateRoundPlan(match.plannerVersion,match.plannerState);validatePlannedGame(reviewPlannerProjection(match));validateModePlan(match.modePlannerVersion,match.modePlannerState);validateFeedbackHold(match);validateTiebreakState(match);
  const rounds=match.history.map(r=>r.review?.round),selected=match.current||match.reviewSuspendedRound?.current;if(selected)rounds.push(selected);
  rounds.forEach((c,i)=>validateRound(match,c,i));
  assert(equal(match.modeHistory,rounds.map(c=>c.modeId)),'история выбора режимов не совпадает с ходами');
  const balance=freshModePlan().balance;rounds.forEach((c,i)=>{if(!getModeConfig(c.modeId).supportsSharedAward)balance[c.modeId]+=(match.startingTeamIndex+i)%2===0?1:-1;});
  assert(equal(balance,match.modePlannerState.balance)&&equal(match.modePlannerState.recent,match.modeHistory.slice(-2)),'повреждён план режимов');
  if(match.difficulty==='mixed')for(let i=0;i<rounds.length;i+=6){const levels=rounds.slice(i,i+6).map(c=>c.difficulty);assert(levels.every((level,j)=>j%2===0||level===levels[j-1])&&new Set(levels.filter((_,j)=>j%2===0)).size===Math.ceil(levels.length/2),'повреждён план сложности');}
  validateGameRiskPlan(match);review(match);
  for(const tie of [match.tiebreak,match.reviewTiebreakArchive?.tiebreak].filter(Boolean)){const q=catalog(match,'number',tie.question.difficulty).byId.get(tie.question.id);assert(q&&q.question===tie.question.question&&String(q.answer)===tie.question.answer&&String(q.unit||'')===tie.question.unit&&String(q.note||'')===tie.question.note,'изменён вопрос тай-брейка');}
  if(selected){const phase=match.current?match.phase:match.reviewSuspendedRound.phase;assert(['rolling','task','countdown','play','judge'].includes(phase),'ход не соответствует фазе');if(phase==='play')assert(selected.paused?selected.deadline===null&&Number.isFinite(selected.remainingMs)&&selected.remainingMs>=0:Number.isFinite(selected.deadline),'повреждён таймер');if(phase==='countdown')assert(selected.feedbackHold||Number.isFinite(selected.autoStartAt),'повреждён автоматический старт');}
  else assert(['ready','review','results','tiebreak'].includes(match.phase),'нет снимка текущего задания');
  return true;
 }
 function entry(record){return {version:1,teamFormat:copy(record.teamFormat),game:copy(record.game),options:copy(record.options),taskMemory:copy(record.taskMemory)};}
 function validateEntry(value){
  const entryKey=recordValidationKey(value,false);if(entryKey!==null&&recordValidationScope.keys.has(entryKey))return true;
  exact(value,['version','teamFormat','game','options','taskMemory']);assert(value.version===1&&equal(value.teamFormat,value.game.teamFormat),'неверный конверт партии');
  assert(equal(value.options,optionsFor(value.options)),'неверные сохранённые настройки');const valid=validateGame(value.game,value.taskMemory);rememberRecordValidation(entryKey);return valid;
 }
 // Only one controller transaction may reuse a successful record check.
 // Cache the entire strict JSON value, never just an ID/checksum/role header.
 // New bytes, custom catalogs and a new transaction always validate in full.
 let recordValidationScope=null;
 async function withRecordValidation(work){
  if(recordValidationScope)return work();
  const scope={keys:new Set(),shapes:[],stamp:[],chars:0};recordValidationScope=scope;
  try{return await work();}finally{if(recordValidationScope===scope)recordValidationScope=null;}
 }
 function recordValidationKey(record,withArchives=true){
  if(!recordValidationScope||!Object.isFrozen(PARTY_CARDS)||!Object.isFrozen(QUIP_APPROX_QUESTIONS)||!Object.isFrozen(QUIP_CONTENT_PACKS))return null;
  const stamp=[PARTY_CARDS,QUIP_APPROX_QUESTIONS,QUIP_CONTENT_PACKS,QUIP_MODES_V4,QUIP_MODIFIERS_V2,getContentPack,getPackCardPool,getPackQuestionPool,getModeConfig,getV2ModifierPool];
  if(stamp.some((v,i)=>v!==recordValidationScope.stamp[i])){recordValidationScope.keys.clear();recordValidationScope.shapes.length=0;recordValidationScope.chars=0;recordValidationScope.stamp=stamp;}
  try{
   // Compare against a private shape of previously validated JSON. Every own
   // descriptor and prototype is still checked, including nested array items;
   // equal mutable objects are never trusted by identity. Reusing the known
   // keys avoids rebuilding key arrays, cycle sets and JSON strings on hits.
   const prefix=withArchives?'record:':'entry:';
   for(const cached of recordValidationScope.shapes)if(cached.key.startsWith(prefix)&&sameRecordShape(record,cached.shape))return cached.key;
   // JSON.stringify alone drops undefined/functions and can run toJSON/getters.
   // Those values must reach the original checker, never alias a valid key.
   const active=new Set();
   const json=value=>{
    const type=typeof value;if(value===null||type==='string'||type==='boolean')return;
    if(type==='number'){if(!Number.isFinite(value))throw Error('non-JSON number');return;}
    if(type!=='object'||active.has(value))throw Error('non-JSON value');
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value),keys=Object.keys(value);
    if(proto!==(array?Array.prototype:Object.prototype)||Reflect.ownKeys(value).length!==keys.length+(array?1:0)||array&&(keys.length!==value.length||keys.some((k,i)=>k!==String(i))))throw Error('non-JSON shape');
    active.add(value);
    for(const key of keys){
     const d=Object.getOwnPropertyDescriptor(value,key);if(!Object.hasOwn(d,'value'))throw Error('accessor');
     const child=d.value,kind=typeof child;
     if(child===null||kind==='string'||kind==='boolean')continue;
     if(kind==='number'){if(!Number.isFinite(child))throw Error('non-JSON number');continue;}
     if(kind!=='object')throw Error('non-JSON value');json(child);
    }
    active.delete(value);
   };
   json(record);
   for(const value of withArchives?[record,...record.archives]:[record]){const pack=getContentPack(value.game.contentPack);if(QUIP_CONTENT_PACKS[pack.id+'@'+pack.version]!==pack)return null;}
   const key=JSON.stringify(record);return key.length<=131072?(withArchives?'record:':'entry:')+key:null;
  }catch{return null;}
 }
 function recordShape(value){
  if(value===null||typeof value!=='object')return value;
  const keys=Object.keys(value);return {array:Array.isArray(value),keys,values:keys.map(key=>recordShape(value[key]))};
 }
 function sameRecordShape(value,shape){
  if(shape===null||typeof shape!=='object')return value===shape;
  if(value===null||typeof value!=='object'||Array.isArray(value)!==shape.array||Object.getPrototypeOf(value)!==(shape.array?Array.prototype:Object.prototype)||shape.array&&value.length!==shape.keys.length||Reflect.ownKeys(value).length!==shape.keys.length+(shape.array?1:0))return false;
  for(let i=0;i<shape.keys.length;i++){
   const d=Object.getOwnPropertyDescriptor(value,shape.keys[i]);
   if(!d||!d.enumerable||!Object.hasOwn(d,'value')||!sameRecordShape(d.value,shape.values[i]))return false;
  }
  return true;
 }
 function rememberRecordValidation(key){
  if(key===null||!recordValidationScope)return;
  if(recordValidationScope.keys.has(key))return;
  if(recordValidationScope.chars+key.length>524288){recordValidationScope.keys.clear();recordValidationScope.shapes.length=0;recordValidationScope.chars=0;}
  recordValidationScope.keys.add(key);recordValidationScope.chars+=key.length;
  recordValidationScope.shapes.push({key,shape:recordShape(JSON.parse(key.slice(key.indexOf(':')+1)))});
 }
 function validateRecord(record){
  const memoKey=recordValidationKey(record);if(memoKey!==null&&recordValidationScope.keys.has(memoKey))return true;
  exact(record,['version','teamFormat','game','options','taskMemory','archives',...(record?.version===2?['profileResults']:[])]);assert([1,2].includes(record.version),'неизвестная версия сохранения');validateEntry(entry(record));
  const results=record.version===2?QuipTeamStatistics.ledger(record.profileResults):[];
  if(record.version===1)assert(record.teamFormat.version===1&&record.archives.every(e=>e.teamFormat.version===1),'привязка профилей требует конверт v2');
  for(const value of [record,...record.archives])if(value.teamFormat.version===2&&value.game.phase==='results'){
   const expected=QuipTeamStatistics.result(value.game),saved=results.find(r=>r.id===value.teamFormat.id);assert(saved&&QuipTeamStatistics.same(saved,expected),'нет единственного подтверждённого результата профилей');
  }
  assert(Array.isArray(record.archives)&&record.archives.length<=100,'неверный архив командных партий');record.archives.forEach(validateEntry);
  assert(new Set([record.teamFormat.id,...record.archives.map(e=>e.teamFormat.id)]).size===record.archives.length+1,'повторная партия в архиве');
  rememberRecordValidation(memoKey);return true;
 }
 function validateReplacement(before,after){
  validateRecord(before);validateRecord(after);
  return after.archives.some(e=>equal(e,entry(before)))&&before.archives.every(e=>after.archives.some(n=>equal(n,e)))&&preservesResults(before,after);
 }
 function createRecord(settings,names,{id,random=Math.random,previous=null,profileBinding=null}={}){
  assert(installed,'командный движок не подключён');if(previous)validateRecord(previous);
  const o=optionsFor(settings),songPolicy=setupSongPolicy(o),pack=setupCategorySelection(latestContentPackSelection(getContentPack(o.contentPack).id)),available=checkContentPack(pack,{...o,...songPolicy});
  assert(available.available,available.problems[0]||'набор недоступен');
  const header=profileBinding?QuipTeamFormat.createBound(profileBinding,{id,random}):QuipTeamFormat.create(names,{id,random});let memory=previous?archiveTaskHistory(copy(previous.taskMemory),previous.game.taskHistory):freshTaskMemory();
  const started=startTaskHistory(memory);memory=started.memory;
  const match={matchId:header.id,teamFormat:header,teamPolicyVersion:VERSION,teams:header.teams.map(t=>t.name),scores:[0,0],roundIndex:0,startingTeamIndex:header.opening.teamIndex,
   resultReviewVersion:1,reviewRevision:0,reviewConfirmed:false,...songPolicy,timerPolicyVersion:1,finishPolicyVersion:1,taskHistoryVersion:1,taskHistory:started.history,
   rounds:o.rounds,targetScore:o.targetScore,finishType:o.finishType,riskPolicyVersion:1,riskPlannerState:freshRiskPlan(),riskRounds:o.riskRounds,scoringVersion:2,rulesVersion:5,modeConfigVersion:1,
   awardPolicyVersion:1,awardTo:'setter',modeCompatibilityVersion:1,modifierCatalogVersion:2,modifierSelectionVersion:2,modifierChance:o.modifierChance,modifierRecent:[],
   plannerVersion:1,plannerState:freshRoundPlan(),modePlannerVersion:1,modePlannerState:freshModePlan(),duration:o.duration,difficulty:o.difficulty,contentPack:{...pack},preset:null,
   modes:o.modes.slice(),promptTypes:o.promptTypes.slice(),dice:o.dice,complications:o.complications,blitzCount:3,current:null,modeHistory:[],used:{},history:[],phase:'ready'};
  const withProfiles=!!profileBinding||previous?.version===2;
  const record={version:withProfiles?2:1,teamFormat:header,game:match,options:o,taskMemory:memory,archives:previous?[...copy(previous.archives),entry(previous)]:[],...(withProfiles?{profileResults:copy(previous?.profileResults||[])}:{})};validateRecord(record);return record;
 }
 function finalizeRecord(record){
  if(record.version!==2)return record;
  const results=QuipTeamStatistics.ledger(record.profileResults);
  if(record.teamFormat.version===2&&record.game.phase==='results'){
   // Full replay validation precedes any statistics projection. Both are then
   // committed as ONE team RAW by the existing journal + IndexedDB receipt.
   validateEntry(entry(record));return {...record,profileResults:QuipTeamStatistics.merge(results,[QuipTeamStatistics.result(record.game)])};
  }
  return record;
 }
 function preservesResults(before,after){
  const prior=before.profileResults||[],next=after.profileResults||[];
  return !(before.version===2&&after.version!==2)&&prior.every(r=>next.some(n=>QuipTeamStatistics.same(r,n)))&&next.every(r=>prior.some(n=>QuipTeamStatistics.same(r,n))||r.id===after.teamFormat.id&&after.teamFormat.version===2&&after.game.phase==='results'&&QuipTeamStatistics.same(r,QuipTeamStatistics.result(after.game)));
 }
 function validateTransition(before,after){
  validateRecord(before);validateRecord(after);
  if(!preservesResults(before,after))return false;
  if(before.teamFormat.id!==after.teamFormat.id)return validateReplacement(before,after);
  if(!equal(before.teamFormat,after.teamFormat))return false;
  if(before.profileResults?.some(r=>r.id===before.teamFormat.id)&&after.game.phase!=='results')return false;
  return true;
 }
 function install(){
  if(installed)return;installed=true;
  Object.assign(old,{modeAwardAvailability,getV2ModifierPool,guessingTeamIndex,currentTeam,guessingTeam,reviewedRoundRow,replayResultHistory,validateResultReview,rollOutcome,roll,replaceWord});
  modeAwardAvailability=function(id,settings){return isSettings(settings)?{available:DEFAULT_MODES.includes(id),reason:DEFAULT_MODES.includes(id)?'':'Неизвестный режим'}:old.modeAwardAvailability(id,settings);};
  getV2ModifierPool=function(method,difficulty,match,request={},registry=QUIP_MODIFIERS_V2){return old.getV2ModifierPool(method,difficulty,isSettings(match)?{...match,awardTo:'guesser'}:match,request,registry);};
  guessingTeamIndex=function(){return isGame(game)?currentTeamIndex():old.guessingTeamIndex();};
  currentTeam=function(){return isGame(game)?roles(game).setterName:old.currentTeam();};
  guessingTeam=function(){return isGame(game)?roles(game).guesserName:old.guessingTeam();};
  reviewedRoundRow=function(match,c,result){return isGame(match)?actualRow(match,old.reviewedRoundRow(projection(match),c,result),match.roundIndex):old.reviewedRoundRow(match,c,result);};
  replayResultHistory=function(match,history=match.history,tie=match.tiebreak){return isGame(match)?replay(match,history,tie):old.replayResultHistory(match,history,tie);};
  validateResultReview=function(match){return isGame(match)?review(match):old.validateResultReview(match);};
  rollOutcome=function(){const c=old.rollOutcome();return isGame(game)?{...c,teamRoles:QuipTeamFormat.turnIdentity(game.teamFormat,game.roundIndex)}:c;};
  roll=function(){
   if(!isGame(game))return old.roll();if(game.phase!=='ready')return;
   game.current=rollOutcome();game.phase=game.dice?'rolling':'task';persist();sfx(game.dice?'roll':'go');render();
   // The controller schedules the visual reveal only AFTER this selection is
   // durable. No unguarded legacy timeout may mutate an in-flight transaction.
  };
  replaceWord=function(){
   if(!isGame(game))return old.replaceWord();
   if(game.phase!=='task'||!allowPause()||game.current.modeId==='blitz'||!roundUsesTimer())return;
   const c=game.current,method=getMode(c.methodId);let pool=getPackCardPool(game.contentPack,method.kind,c.difficulty,game.promptTypes);
   if(method.kind==='songs')pool=filterSongLanguagePool(pool,game,c.modeId);
   if(c.complication)pool=pool.filter(card=>getV2ModifierPool(c.methodId,c.difficulty,game,{card}).some(m=>m.id===c.complicationId));
   const card=chooseRememberedTask(pool);rememberLegacyWordUse(method.kind,c.difficulty,card.text,c.modeId);
   c.word=card.text;c.cardId=card.id;c.visible=false;c.replaced=true;persist();sfx('button');render();
  };
 }
 return Object.freeze({VERSION,FORMAT,isGame,isSettings,roles,optionsFor,createRecord,validateGame,withRecordValidation,validateRecord,validateReplacement,validateTransition,finalizeRecord,entry,replay,install});
})();
