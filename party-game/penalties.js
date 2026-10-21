'use strict';
// Pure computations: no mutation of scores/history and no random source.
function shouldSelectRisk(match,randomValue,modeId){
 if(modeId&&!modeConfigForGame(match,modeId).allowsRisk)return false;
 const risk=ruleSetForGame(match).risk;
 return match.riskRounds===true&&match.roundIndex>=risk.firstRoundIndex&&
  Number.isFinite(randomValue)&&randomValue>=0&&randomValue<risk.chance;
}
function settleQuipRound(match,round,result,previousScore){
 const rules=ruleSetForGame(match);
 const accepted=typeof result==='object'?result?.taskSuccess===true:Boolean(result);
 const modifierMet=typeof result==='object'?result?.modifierSuccess===true:true;
 const success=accepted&&
  (rules.legacyBlitz||round.modeId!=='blitz'||round.blitzCorrect===blitzRequiredForRound(match,round));
 const split=rules.splitModifierOutcome===true;
 const base=success?(round.basePoints??round.points):0;
 const modifier=success&&(!split||modifierMet)?(round.modifierPoints||0):0;
 let delta=0;
 if(success)delta=split?base+modifier:round.modeId==='blitz'&&rules.legacyBlitz?round.blitzCorrect:round.points;
 else if(!rules.legacyBlitz&&round.risk&&
  (rules.version<4||modeConfigForGame(match,round.modeId).allowsRisk))
  delta=-Math.min(rules.risk.loss,Math.max(rules.risk.minScore,previousScore));
 return Object.freeze({rulesVersion:rules.version,success,delta,
  ...(split?{taskSuccess:success,modifierSuccess:round.complication?success&&modifierMet:null,
   baseAwarded:base,modifierAwarded:modifier,reward:Math.max(0,delta),penalty:Math.max(0,-delta),
   outcome:!success?'failed':round.complication&&!modifierMet?'base-only':'complete'}:{})});
}
