'use strict';
// Pure computations: no mutation of scores/history and no random source.
function shouldSelectRisk(match,randomValue){
 const risk=ruleSetForGame(match).risk;
 return match.riskRounds===true&&match.roundIndex>=risk.firstRoundIndex&&
  Number.isFinite(randomValue)&&randomValue>=0&&randomValue<risk.chance;
}
function settleQuipRound(match,round,accepted,previousScore){
 const rules=ruleSetForGame(match);
 const success=Boolean(accepted)&&
  (rules.legacyBlitz||round.modeId!=='blitz'||round.blitzCorrect===rules.blitzRequired);
 let delta=0;
 if(success)delta=round.modeId==='blitz'&&rules.legacyBlitz?round.blitzCorrect:round.points;
 else if(!rules.legacyBlitz&&round.risk)
  delta=-Math.min(rules.risk.loss,Math.max(rules.risk.minScore,previousScore));
 return Object.freeze({rulesVersion:rules.version,success,delta});
}
