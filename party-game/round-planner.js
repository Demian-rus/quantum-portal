'use strict';
const QUIP_PLANNER_VERSION=1;
const QUIP_PLAN_LEVELS=Object.freeze(['easy','medium','hard']);
function freshRoundPlan(){return {cycleIndex:-1,levels:[]};}
function validateRoundPlan(version,state){
 if(version!==QUIP_PLANNER_VERSION)throw Error('Unsupported QUIP plannerVersion: '+version);
 if(!state||!Number.isInteger(state.cycleIndex)||state.cycleIndex< -1||!Array.isArray(state.levels))
  throw Error('Invalid QUIP planner state');
 if(state.cycleIndex===-1?state.levels.length!==0:
   state.levels.length!==3||new Set(state.levels).size!==3||state.levels.some(x=>!QUIP_PLAN_LEVELS.includes(x)))
  throw Error('Invalid QUIP planner cycle');
}
// Pure transition: the caller persists the returned state with the selected card.
// All three pairs in a cycle are planned together. Restoring or rendering uses no RNG.
function planRoundDifficulty(state,roundIndex,difficulty,random=Math.random){
 validateRoundPlan(QUIP_PLANNER_VERSION,state);
 if(!Number.isInteger(roundIndex)||roundIndex<0)throw Error('Invalid QUIP roundIndex');
 if(difficulty!=='mixed'){
  if(!QUIP_PLAN_LEVELS.includes(difficulty))throw Error('Unknown QUIP difficulty: '+difficulty);
  return {difficulty,state};
 }
 const pairIndex=Math.floor(roundIndex/2),cycleIndex=Math.floor(pairIndex/3);
 if(state.cycleIndex!==cycleIndex){
  // Never reconstruct the reply or a missing historical cycle with a new random draw.
  if(roundIndex%6!==0)throw Error('Missing QUIP plan for an existing cycle');
  const levels=QUIP_PLAN_LEVELS.slice();
  for(let i=levels.length-1;i>0;i--){
   const value=random();
   if(!Number.isFinite(value)||value<0||value>=1)throw Error('Invalid QUIP random value');
   const j=Math.floor(value*(i+1));[levels[i],levels[j]]=[levels[j],levels[i]];
  }
  state={cycleIndex,levels};
 }
 return {difficulty:state.levels[pairIndex%3],state};
}

function validatePlannedGame(match){
 validateRoundPlan(match.plannerVersion,match.plannerState);
 if(match.difficulty!=='mixed')return;
 const cycleIndex=Math.floor(match.roundIndex/6),state=match.plannerState;
 const betweenCycles=match.phase==='ready'&&match.roundIndex%6===0&&state.cycleIndex===cycleIndex-1;
 if(state.cycleIndex!==cycleIndex&&!betweenCycles)throw Error('Missing saved QUIP cycle');
 if(match.current&&match.current.difficulty!==state.levels[Math.floor(match.roundIndex/2)%3])
  throw Error('Saved QUIP difficulty does not match its plan');
}
