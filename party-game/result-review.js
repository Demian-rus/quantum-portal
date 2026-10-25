'use strict';
// Versioned, deterministic replay. It never selects a task or consumes RNG.
const QUIP_RESULT_REVIEW_VERSION=1;
const reviewCopy=value=>JSON.parse(JSON.stringify(value));
function resultReviewPolicy(match){
 if(match?.resultReviewVersion==null)return null;
 if(match.resultReviewVersion!==QUIP_RESULT_REVIEW_VERSION)throw Error('Неизвестная версия проверки результатов.');
 return 1;
}
function reviewSnapshot(match,round,result){
 return {version:1,rules:{scoringVersion:match.scoringVersion,rulesVersion:match.rulesVersion,modeConfigVersion:match.modeConfigVersion},
  round:reviewCopy(round),result:reviewCopy(result)};
}
function reviewChoices(row){
 const s=row.review;if(!s||s.version!==1)throw Error('Нет снимка правил хода.');
 if(row.mode==='approx')return ['none','a','b','both'];
 const r=s.round,rules=ruleSetForGame(s.rules),split=rules.splitModifierOutcome&&!!r.complication;
 if(row.mode==='blitz'){
  const n=blitzRequiredForRound(s.rules,r);
  if(!Number.isInteger(n)||n<1||n>5)throw Error('Неверный размер Блица.');
  return ['failed',...Array.from({length:n+1},(_,i)=>String(i)),...(split?['base']:[])];
 }
 return ['failed',...(split?['base']:[]),'complete'];
}
function reviewChoice(row){
 const s=row.review;if(row.mode==='approx')return s.result.choice;
 if(row.mode==='blitz'){
  const full=s.result.blitzCorrect===blitzRequiredForRound(s.rules,s.round);
  if(!s.result.taskSuccess&&(full||ruleSetForGame(s.rules).legacyBlitz))return 'failed';
  return full&&s.result.taskSuccess&&s.result.modifierSuccess===false?'base':String(s.result.blitzCorrect);
 }
 return !s.result.taskSuccess?'failed':s.result.modifierSuccess===false?'base':'complete';
}
function changeReviewedOutcome(row,choice){
 if(!reviewChoices(row).includes(choice))throw Error('Этот исход недоступен по правилам хода.');
 const next=reviewCopy(row),r=next.review.result;
 if(row.mode==='approx')r.choice=choice;
 else if(row.mode==='blitz'){
  const n=blitzRequiredForRound(next.review.rules,next.review.round);
  r.blitzCorrect=choice==='failed'?r.blitzCorrect:choice==='base'?n:Number(choice);
  r.taskSuccess=choice!=='failed'&&(ruleSetForGame(next.review.rules).legacyBlitz?r.blitzCorrect>0:r.blitzCorrect===n);r.modifierSuccess=choice!=='base';
 }else{r.taskSuccess=choice!=='failed';r.modifierSuccess=choice!=='base';}
 return next;
}
function replayResultHistory(match,history=match.history,tiebreak=match.tiebreak){
 const scores=[0,0],first=match.startingTeamIndex??0;
 const rows=history.map((original,index)=>{
  const row=reviewCopy(original),s=row.review;
  if(!s||s.version!==1||!s.rules||!s.round||!s.result||row.mode!==s.round.modeId||
     ![0,1].includes(row.setterIndex)||row.setterIndex!==(first+index)%2||
     row.guesserIndex!==(match.scoringVersion===2?1-row.setterIndex:row.setterIndex)||
     !reviewChoices(row).includes(reviewChoice(row)))throw Error('Повреждён снимок результата.');
  const round={...s.round},rules=ruleSetForGame(s.rules);
  if(row.rulesVersion!==rules.version||row.difficulty!==round.difficulty||!Number.isSafeInteger(round.basePoints)||round.basePoints<0||
     !Number.isSafeInteger(round.modifierPoints)||round.modifierPoints<0||!Number.isSafeInteger(round.points)||round.points<0||typeof round.risk!=='boolean')throw Error('Повреждены правила начисления.');
  if(row.mode==='approx'){
   const out=settleSharedAward(round,s.result.choice);
   Object.assign(row,{recipients:out.recipients,recipientNames:out.recipients.map(i=>match.teams[i]),sharedAward:s.result.choice==='both',
    deltas:out.deltas,awarded:out.deltas.reduce((a,b)=>a+b,0),correct:out.recipients.length>0});
   out.deltas.forEach((d,i)=>{scores[i]+=d;});
  }else{
   const recipient=awardRecipientIndex(match,row.setterIndex);
   if(row.recipientIndex!==recipient||typeof s.result.taskSuccess!=='boolean'||typeof s.result.modifierSuccess!=='boolean')throw Error('Повреждён получатель или исход.');
   if(row.mode==='blitz')round.blitzCorrect=s.result.blitzCorrect;
   const out=settleQuipRound(s.rules,round,s.result,scores[recipient]);
   scores[recipient]+=out.delta;
   Object.assign(row,{awarded:out.delta,correct:out.success,modifierPoints:out.success?(out.modifierAwarded??round.modifierPoints??0):0});
   if(rules.splitModifierOutcome)Object.assign(row,{outcome:out.outcome,taskSuccess:out.taskSuccess,modifierSuccess:out.modifierSuccess,
    baseAwarded:out.baseAwarded,reward:out.reward,penalty:out.penalty});
  }
  return row;
 });
 const ordinary={...match,scores,roundIndex:rows.length,tiebreak:null};
 const eligible=scoreNeedsTiebreak(ordinary),tie=tiebreak&&eligible?reviewCopy(tiebreak):null;
 if(tie?.stage==='decided')scores[tie.winnerIndex]+=1;
 return {history:rows,scores,tiebreak:tie,needsTiebreak:eligible&&!tie,complete:scoreMatchComplete({...ordinary,scores,tiebreak:tie})};
}
function validateResultReview(match){
 if(!resultReviewPolicy(match)){
  if(match?.pendingReview!=null||match?.resultEditor!=null||match?.phase==='review')throw Error('Нет политики проверки результатов.');
  return;
 }
 if(!Number.isSafeInteger(match.reviewRevision)||match.reviewRevision<0||typeof match.reviewConfirmed!=='boolean'||
    !Array.isArray(match.history)||match.roundIndex!==match.history.length||
    !['ready','rolling','task','countdown','play','judge','between','tiebreak','review','results'].includes(match.phase)||
    match.pendingReview?.playerIndex!=null&&![0,1].includes(match.pendingReview.playerIndex)||
    (match.phase==='results')!==match.reviewConfirmed||
    (match.phase==='review')!==(match.pendingReview!=null)||
    match.pendingReview!=null&&(match.pendingReview.version!==1||match.current!==null))throw Error('Повреждено состояние проверки итогов.');
 if(match.reviewTiebreakArchive!=null){
  const a=match.reviewTiebreakArchive;
  if(a.version!==1||!Number.isSafeInteger(a.roundIndex)||a.roundIndex<2||a.roundIndex>match.roundIndex||a.roundIndex%2||!a.tiebreak)throw Error('Повреждён архив тай-брейка.');
  const scores=[match.targetScore,match.targetScore];
  if(a.tiebreak.stage==='decided')scores[a.tiebreak.winnerIndex]+=1;
  validateTiebreakState({...match,roundIndex:a.roundIndex,scores,tiebreak:a.tiebreak,phase:a.tiebreak.stage==='decided'?'review':'tiebreak'});
 }
 if(match.tiebreak)validateTiebreakState(match);
 const replay=replayResultHistory(match);
 if(match.phase==='results'&&!replay.complete)throw Error('Итог ещё не достигнут.');
 if(JSON.stringify(replay.history)!==JSON.stringify(match.history)||JSON.stringify(replay.scores)!==JSON.stringify(match.scores)||
    JSON.stringify(replay.tiebreak)!==JSON.stringify(match.tiebreak??null))throw Error('Счёт не совпадает с историей.');
 if(match.resultEditor){
  const e=match.resultEditor;
  if(e.version!==1||![0,1].includes(e.playerIndex)||!Array.isArray(e.history)||e.history.length!==match.history.length||
     match.reviewConfirmed)throw Error('Повреждён черновик исправлений.');
  for(let i=0;i<e.history.length;i++){
   const a=reviewCopy(e.history[i]),b=reviewCopy(match.history[i]);
   // Only selected outcomes may differ in an editor draft.
   a.review.result=b.review.result;
   const normalized=replayResultHistory(match,[...match.history.slice(0,i),a,...match.history.slice(i+1)]).history[i];
   if(JSON.stringify(normalized)!==JSON.stringify(b))throw Error('Черновик изменяет задание.');
  }
  replayResultHistory(match,e.history,e.tiebreak);
 }
}
// A verified single-key transaction, including readback and exact RAW rollback.
function commitReviewState(next,nextMemory=taskMemory){
 if(storageBlocked)throw Error('Сохранение защищено. Изменения не применены.');
 const previous=game,previousMemory=taskMemory;let raw;
 try{raw=localStorage.getItem(STORAGE_KEY);}catch{throw Error('Не удалось прочитать сохранение.');}
 // Reject a second tab instead of overwriting a newer match/revision.
 if(raw){const saved=JSON.parse(raw).game;if(saved?.matchId!==game?.matchId||saved?.reviewRevision!==game?.reviewRevision)throw Error('Партия изменилась в другом окне. Перезапустите приложение.');}
 validateResultReview(next);game=next;taskMemory=nextMemory;
 if(persist())return true;
 game=previous;taskMemory=previousMemory;
 try{
  if(localStorage.getItem(STORAGE_KEY)!==raw){if(raw===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,raw);}
  if(localStorage.getItem(STORAGE_KEY)!==raw)throw Error('rollback');
 }catch{storageBlocked=true;storageProblem='unavailable';stopTicking();throw Error('Не удалось подтвердить запись и восстановление. Данные защищены; перезапустите приложение.');}
 throw Error('Не удалось сохранить изменения. Предыдущие результаты сохранены.');
}
function reviewedRoundRow(match,c,result){
 const setter=(match.roundIndex+(match.startingTeamIndex??0))%2,guesser=match.scoringVersion===2?1-setter:setter;
 const common={mode:c.modeId,setterIndex:setter,guesserIndex:guesser,methodId:c.methodId,setter:match.teams[setter],
  difficulty:c.difficulty,rulesVersion:ruleSetForGame(match).version,basePoints:c.basePoints,
  review:reviewSnapshot(match,c,result)};
 if(c.modeId==='approx')return {...common,assignedIndices:[0,1],word:c.question.question,questionId:c.question.id,
  answer:c.question.answer,unit:c.question.unit,note:c.question.note,risk:false,modifierPoints:0};
 const recipient=awardRecipientIndex(match,setter);
 return {...common,team:match.teams[recipient],recipientIndex:recipient,awardTo:match.awardTo,awardPolicyVersion:match.awardPolicyVersion,
  word:c.modeId==='blitz'?c.blitzWords.join(' / '):c.word,cardId:c.cardId??null,
  ...(c.modeId==='blitz'?{blitzWords:c.blitzWords.slice(),blitzCardIds:c.blitzCardIds?.slice()??c.blitzWords.map(()=>null)}:{}),
  risk:!!c.risk,modifierPoints:0,modeName:getMode(c.modeId).title};
}
function settleReviewedRound(result){
 try{
  const next=reviewCopy(game),row=reviewedRoundRow(next,next.current,result);
  next.history.push(row);next.roundIndex++;next.current=null;
  Object.assign(next,replayResultHistory(next));delete next.complete;delete next.needsTiebreak;
  next.phase=scoreMatchComplete(next)||scoreNeedsTiebreak(next)?'review':'ready';
  next.pendingReview=next.phase==='review'?{version:1}:null;next.reviewRevision++;
  commitReviewState(next);stopTicking();sfx((row.mode==='approx'?result.choice!=='none':result.taskSuccess)?'win':'fail');render();
 }catch(error){toast(error.message);}
}
function confirmReviewedResults(){
 if(game?.phase!=='review'||game.resultEditor)return;
 try{
  const next=reviewCopy(game),out=replayResultHistory(next);
  next.history=out.history;next.scores=out.scores;next.tiebreak=out.tiebreak;next.pendingReview=null;next.reviewRevision++;
  if(out.complete){next.phase='results';next.reviewConfirmed=true;}
  else next.phase=next.tiebreak?'tiebreak':'ready';
  let tieMemory=taskMemory;
  if(next.phase==='ready'&&scoreNeedsTiebreak(next)){
   const previous=game,previousMemory=taskMemory;
   try{game=next;taskMemory=reviewCopy(taskMemory);beginTiebreak();tieMemory=taskMemory;}
   finally{game=previous;taskMemory=previousMemory;}
  }
  const memory=next.phase==='results'&&next.taskHistoryVersion===QUIP_TASK_HISTORY_VERSION&&taskMemory?archiveTaskHistory(taskMemory,next.taskHistory):tieMemory;
  commitReviewState(next,memory);
  // Only an explicit confirmation makes the durable result eligible for totals.
  if(game.phase==='results')saveCompletedProfileResult();
  render();
 }catch(error){toast(error.message);}
}
function settleReviewedTiebreak(winner){
 try{
  const next=reviewCopy(game);next.tiebreak.winnerIndex=winner;next.tiebreak.stage='decided';
  const out=replayResultHistory(next);next.scores=out.scores;next.phase='review';next.pendingReview={version:1};next.reviewRevision++;
  commitReviewState(next);stopTicking();render();
 }catch(error){toast(error.message);}
}
