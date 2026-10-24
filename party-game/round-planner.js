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
 const betweenCycles=!match.current&&['ready','between','results','tiebreak'].includes(match.phase)&&
  match.roundIndex%6===0&&state.cycleIndex===cycleIndex-1;
 if(state.cycleIndex!==cycleIndex&&!betweenCycles)throw Error('Missing saved QUIP cycle');
 if(match.current&&match.current.difficulty!==state.levels[Math.floor(match.roundIndex/2)%3])
  throw Error('Saved QUIP difficulty does not match its plan');
}

// Mode fairness is an independent opt-in policy; absence keeps historical RNG.
const QUIP_MODE_PLANNER_VERSION=1;
const QUIP_MODE_PLAN_IDS=Object.freeze(Object.keys(QUIP_MODES_V4));
function freshModePlan(){
 return {balance:Object.fromEntries(QUIP_MODE_PLAN_IDS.map(id=>[id,0])),recent:[]};
}
function validateModePlan(version,state){
 if(version!==QUIP_MODE_PLANNER_VERSION)throw Error('Unsupported QUIP mode planner version');
 if(!state||!state.balance||Object.keys(state.balance).length!==QUIP_MODE_PLAN_IDS.length||
  QUIP_MODE_PLAN_IDS.some(id=>!Number.isSafeInteger(state.balance[id]))||
  !Array.isArray(state.recent)||state.recent.length>2||state.recent.some(id=>!QUIP_MODE_PLAN_IDS.includes(id)))
  throw Error('Invalid QUIP mode planner state');
 // Shared opportunities never belong to the formal turn's recipient.
 if(QUIP_MODE_PLAN_IDS.some(id=>QUIP_MODES_V4[id].supportsSharedAward&&state.balance[id]!==0))
  throw Error('Invalid shared QUIP mode balance');
}
function modeOpportunityRewards(match,modes,level){
 return Object.fromEntries(modes.map(id=>[id,rewardForRound(match,id,level,id==='secret')]));
}
// Pure transition. This interface deliberately has no scores, outcomes or skills.
// balance[id] is opportunities for recipient 0 minus those for recipient 1.
// Shared rounds add the same opportunity to both, hence a zero difference.
function planMode(state,{modes,rewards,recipientIndex,pairStart},random=Math.random){
 validateModePlan(QUIP_MODE_PLANNER_VERSION,state);
 if(![0,1].includes(recipientIndex)||typeof pairStart!=='boolean'||!Array.isArray(modes)||!modes.length||
  new Set(modes).size!==modes.length||modes.some(id=>!QUIP_MODE_PLAN_IDS.includes(id)||!Number.isFinite(rewards[id])||rewards[id]<=0))
  throw Error('Invalid QUIP mode planner input');
 const direction=recipientIndex===0?1:-1;
 const advance=(balance,id,sign)=>({...balance,[id]:balance[id]+(QUIP_MODES_V4[id].supportsSharedAward?0:sign)});
 const energy=balance=>{
  let rewardGap=0,modeGap=0;
  for(const id of modes){rewardGap+=balance[id]*rewards[id];modeGap+=balance[id]**2;}
  return modeGap+rewardGap**2/2;
 };
 const candidates=modes.map(id=>{
  const balance=advance(state.balance,id,direction);
  // Judge the opening turn by a possible completed pair, not an unavoidable
  // half-pair lead. No reply is reserved: its actual choice stays random.
  const cost=pairStart?Math.min(...modes.map(reply=>energy(advance(balance,reply,-direction)))):energy(balance);
  const last=state.recent.at(-1),previous=state.recent.at(-2);
  // Soft penalties are essential: strict alternation with two modes permanently
  // assigns one mode to each player. Fairness can outweigh a recent repeat.
  const recency=id===last?.15:id===previous?.55:1;
  return {id,balance,cost,recency};
 });
 let selected=candidates[0];
 if(candidates.length>1){
  const minCost=Math.min(...candidates.map(row=>row.cost));
  const weights=candidates.map(row=>row.recency*Math.exp(-(row.cost-minCost)/2));
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1)throw Error('Invalid QUIP mode random value');
  let cursor=value*weights.reduce((sum,weight)=>sum+weight,0);
  selected=candidates.at(-1);
  for(let i=0;i<candidates.length;i++){cursor-=weights[i];if(cursor<0){selected=candidates[i];break;}}
 }
 const next={balance:selected.balance,recent:[...state.recent,selected.id].slice(-2)};
 validateModePlan(QUIP_MODE_PLANNER_VERSION,next);
 return {modeId:selected.id,state:next};
}
