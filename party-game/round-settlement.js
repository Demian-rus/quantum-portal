'use strict';
// Round confirmation and settlement; shared state and controllers remain in app.js.

function revealApprox(){
 if(!game||game.phase!=='task'||roundInteraction()!=='estimate')return;
 game.phase='judge';game.current.answerRevealed=true;persist();render();
}

function awardApprox(choice){
 if(!game||game.phase!=='judge'||roundInteraction()!=='estimate'||!game.current.answerRevealed)return;
 if(resultReviewPolicy(game))return settleReviewedRound({choice});
 const c=game.current,outcome=settleSharedAward(c,choice);
 outcome.deltas.forEach((delta,index)=>{game.scores[index]+=delta;});
 game.history.push({mode:c.modeId,
  ...(game.profileMatch?{setterIndex:currentTeamIndex(),guesserIndex:guessingTeamIndex(),assignedIndices:[0,1]}:{}),
  word:c.question.question,questionId:c.question.id,
  answer:c.question.answer,unit:c.question.unit,note:c.question.note,difficulty:c.difficulty,
  recipients:outcome.recipients,recipientNames:outcome.recipients.map(index=>game.teams[index]),
  sharedAward:choice==='both',deltas:outcome.deltas,awarded:outcome.deltas.reduce((a,b)=>a+b,0),
  correct:outcome.recipients.length>0,risk:false,basePoints:c.basePoints,modifierPoints:0,
  rulesVersion:game.rulesVersion,setter:currentTeam()});
 completeRound(outcome.recipients.length>0);
}

function recordAnswer(yes,modifierSuccess=true) {
  if(!game||!['judge','play'].includes(game.phase)||roundInteraction()!=='explain')return;
  if(yes&&!modifierSuccess&&!allowsModifierResult())return;
  if(resultReviewPolicy(game))return settleReviewedRound({taskSuccess:yes,modifierSuccess,blitzCorrect:game.current.blitzCorrect});
  const teamIndex=awardTeamIndex(),c=game.current;
  const outcome=settleQuipRound(game,c,{taskSuccess:yes,modifierSuccess},game.scores[teamIndex]);
  game.scores[teamIndex]+=outcome.delta;
  game.history.push({
    team:game.teams[teamIndex],setter:currentTeam(),mode:c.modeId,
    ...(game.profileMatch?{setterIndex:currentTeamIndex(),guesserIndex:guessingTeamIndex(),methodId:c.methodId}:{}),
    ...(game.awardPolicyVersion?{recipientIndex:teamIndex,awardTo:game.awardTo,awardPolicyVersion:game.awardPolicyVersion}:{}),
    word:c.modeId==='blitz'?c.blitzWords.join(' / '):c.word,cardId:c.cardId??null,
    ...(c.modeId==='blitz'?{blitzWords:c.blitzWords.slice(),blitzCardIds:c.blitzCardIds?.slice()??c.blitzWords.map(()=>null)}:{}),
    awarded:outcome.delta,correct:outcome.success,risk:!!c.risk,
    rulesVersion:outcome.rulesVersion,difficulty:c.difficulty,
    basePoints:c.basePoints,modifierPoints:outcome.success?(outcome.modifierAwarded??c.modifierPoints??0):0,
    ...(ruleSetForGame(game).splitModifierOutcome?{outcome:outcome.outcome,taskSuccess:outcome.taskSuccess,
      modifierSuccess:outcome.modifierSuccess,baseAwarded:outcome.baseAwarded,reward:outcome.reward,penalty:outcome.penalty,modeName:getMode(c.modeId).title}:{})
  });
  completeRound(outcome.success);
}

function completeRound(success){
  game.roundIndex++;
  // Confirmation is the final action for a round; no extra Next button.
  game.phase=matchComplete()?'results':'ready';
  if(game.phase==='ready')beginTiebreak();
  if(game.phase==='results')archiveCurrentTaskHistory();
  game.current=null;
  stopTicking();persist();
  if(game.phase==='results')saveCompletedProfileResult();
  sfx(success?'win':'fail');render();
}

function correctNow(modifierSuccess=true) {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused&&Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(c.paused&&(c.remainingMs??0)<=0){finishTimer('timeout');return;}
  recordAnswer(true,modifierSuccess);
}

function wrongNow() {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused && Date.now()>=c.deadline){finishTimer('timeout');return;}
  recordAnswer(false);
}

function judge(yes,modifierSuccess=true) {
  if(!game||game.phase!=='judge')return;
  recordAnswer(yes,modifierSuccess);
}
