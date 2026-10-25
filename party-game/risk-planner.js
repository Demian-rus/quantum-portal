'use strict';
// Selection only. Settlement, scores and outcomes deliberately are not inputs.
const QUIP_RISK_POLICY_VERSION=1;
function freshRiskPlan(){return {eligible:[0,0],risks:[0,0]};}
function validateRiskPlan(version,state){
 if(version!==QUIP_RISK_POLICY_VERSION)throw Error('Unsupported QUIP risk policy');
 if(!state||Object.keys(state).sort().join(',')!=='eligible,risks'||
  ![state.eligible,state.risks].every(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isSafeInteger(n)&&n>=0))||
  state.risks.some((n,i)=>n>state.eligible[i])||Math.abs(state.risks[0]-state.risks[1])>2)
  throw Error('Invalid QUIP risk state');
}
// For alternating eligible recipients the stationary mean is exactly 1/5:
// p(d)=2/21*(2-d), d=risks[recipient]-risks[other]. The small discrete-turn
// correction avoids the 21.05% mean of the naive .2-.1*d formula.
function riskProbability(state,recipientIndex){
 validateRiskPlan(QUIP_RISK_POLICY_VERSION,state);
 if(![0,1].includes(recipientIndex))throw Error('Invalid QUIP risk recipient');
 return (2-state.risks[recipientIndex]+state.risks[1-recipientIndex])*2/21;
}
function planRisk(state,recipientIndex,randomValue){
 const probability=riskProbability(state,recipientIndex);
 if(!Number.isFinite(randomValue)||randomValue<0||randomValue>=1)throw Error('Invalid QUIP risk random value');
 const risk=randomValue<probability;
 const next={eligible:state.eligible.slice(),risks:state.risks.slice()};
 next.eligible[recipientIndex]++;if(risk)next.risks[recipientIndex]++;
 validateRiskPlan(QUIP_RISK_POLICY_VERSION,next);
 return {risk,state:next};
}
function riskPolicyVersion(match){
 if(!Object.hasOwn(match,'riskPolicyVersion')&&!Object.hasOwn(match,'riskPlannerState'))return null;
 validateRiskPlan(match.riskPolicyVersion,match.riskPlannerState);return match.riskPolicyVersion;
}
function selectRoundRisk(match,modeId){
 // Preserve every historical short circuit and the position/count of RNG calls.
 if(riskPolicyVersion(match)===null)return modeConfigForGame(match,modeId).allowsRisk&&match.riskRounds&&
  match.roundIndex>=ruleSetForGame(match).risk.firstRoundIndex&&shouldSelectRisk(match,Math.random(),modeId);
 if(!modeConfigForGame(match,modeId).allowsRisk||!match.riskRounds||
  match.roundIndex<ruleSetForGame(match).risk.firstRoundIndex)return false;
 const setter=(match.roundIndex+(match.startingTeamIndex??0))%2;
 const next=planRisk(match.riskPlannerState,awardRecipientIndex(match,setter),Math.random());
 match.riskPlannerState=next.state;return next.risk;
}
function validateGameRiskPlan(match){
 if(riskPolicyVersion(match)===null)return;
 if(!Array.isArray(match.history)||match.history.length!==match.roundIndex||typeof match.riskRounds!=='boolean')
  throw Error('Invalid QUIP risk history');
 const expected=freshRiskPlan();
 const rounds=match.history.map(row=>row.review?.round);
 if(match.current&&match.reviewSuspendedRound)throw Error('Duplicate QUIP risk current round');
 const current=match.current||match.reviewSuspendedRound?.current;
 if(current)rounds.push(current);
 for(const [index,round]of rounds.entries()){
  if(!round||typeof round.risk!=='boolean')throw Error('Missing QUIP risk snapshot');
  const eligible=match.riskRounds&&index>=ruleSetForGame(match).risk.firstRoundIndex&&modeConfigForGame(match,round.modeId).allowsRisk;
  if(!eligible){if(round.risk)throw Error('Ineligible QUIP risk');continue;}
  const recipient=awardRecipientIndex(match,(index+(match.startingTeamIndex??0))%2);
  expected.eligible[recipient]++;if(round.risk)expected.risks[recipient]++;
  validateRiskPlan(QUIP_RISK_POLICY_VERSION,expected);
 }
 if(['eligible','risks'].some(key=>expected[key].some((n,i)=>n!==match.riskPlannerState[key][i])))
  throw Error('QUIP risk state does not match selected history');
}
