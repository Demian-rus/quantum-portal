'use strict';
// Immutable rules. Never edit existing versions: saved matches depend on them.
const QUIP_RULE_VERSION=5;
const QUIP_DIFFICULTIES=Object.freeze(['easy','medium','hard']);
const freezeQuipRewards=rows=>Object.freeze(Object.fromEntries(Object.entries(rows).map(([key,tiers])=>[key,Object.freeze({...tiers})])));
const CLASSIC_QUIP_REWARDS=freezeQuipRewards({
 talk:{easy:1,medium:1,hard:1},mime:{easy:2,medium:2,hard:2},
 draw:{easy:2,medium:2,hard:2},sing:{easy:2,medium:2,hard:2},
 yesno:{easy:2,medium:2,hard:2},secret:{easy:3,medium:3,hard:3},
 blitz:{easy:3,medium:3,hard:3}
});
const GRADED_QUIP_REWARDS=freezeQuipRewards({
 talk:{easy:1,medium:2,hard:3},mime:{easy:2,medium:3,hard:4},
 draw:{easy:2,medium:3,hard:4},sing:{easy:2,medium:3,hard:4},
 yesno:{easy:2,medium:3,hard:4},secret:{easy:3,medium:4,hard:5},
 blitz:{easy:3,medium:3,hard:3}
});
function makeQuipRule(version,rewards,legacyBlitz=false){
 return Object.freeze({version,rewards,legacyBlitz,blitzRequired:5,
  risk:Object.freeze({firstRoundIndex:2,chance:.2,loss:legacyBlitz?0:2,minScore:0})});
}
const V4_QUIP_REWARDS=freezeQuipRewards(Object.fromEntries(Object.values(QUIP_MODES_V4)
 .map(mode=>[mode.id,Object.fromEntries(QUIP_DIFFICULTIES.map(level=>[level,mode.basePoints]))])));
const QUIP_RULESETS=Object.freeze({
 1:makeQuipRule(1,CLASSIC_QUIP_REWARDS,true),
 2:makeQuipRule(2,CLASSIC_QUIP_REWARDS),
 3:makeQuipRule(3,GRADED_QUIP_REWARDS),
 4:Object.freeze({...makeQuipRule(4,V4_QUIP_REWARDS),modeConfigVersion:1,blitzRequired:3}),
 5:Object.freeze({...makeQuipRule(5,V4_QUIP_REWARDS),modeConfigVersion:1,blitzRequired:3,splitModifierOutcome:true})
});
function ruleSetForGame(match){
 if(!match||match.scoringVersion!==2)return QUIP_RULESETS[1];
 // Old V5 duel saves have scoringVersion:2, but no rulesVersion.
 if(match.rulesVersion==null)return QUIP_RULESETS[2];
 const rules=QUIP_RULESETS[match.rulesVersion];
 if(!rules)throw Error('Unsupported QUIP rulesVersion: '+String(match.rulesVersion));
 return rules;
}
function rewardForRound(match,mode,difficulty,hasModifier=false){
 const table=ruleSetForGame(match).rewards[mode];
 if(!table||!QUIP_DIFFICULTIES.includes(difficulty))
  throw Error('Unknown mode/difficulty for rewards: '+mode+'/'+difficulty);
 const bonus=ruleSetForGame(match).version>=4&&hasModifier?modeConfigForGame(match,mode).modifierBonus:0;
 return table[difficulty]+bonus;
}

// Recipient policy is independent of rule versions and player roles.
const QUIP_AWARD_POLICY_VERSION=1;
function validateAwardPolicy(match){
 if(match.awardPolicyVersion==null&&match.awardTo==null)return;
 if(match.awardPolicyVersion!==QUIP_AWARD_POLICY_VERSION||!['setter','guesser'].includes(match.awardTo))
  throw Error('Unsupported QUIP award policy');
}
function awardRecipientIndex(match,setterIndex){
 validateAwardPolicy(match);
 const setter=match.awardPolicyVersion==null?match.scoringVersion!==2:match.awardTo==='setter';
 return setter?setterIndex:(setterIndex+1)%2;
}

// New score-finish policy. Missing version retains historical equal-pair endings.
// This pure check never selects a mode/card or advances any random planner.
const QUIP_FINISH_POLICY_VERSION=1;
function finishPolicyVersion(match){
  if(match?.finishPolicyVersion==null)return null;
  if(match.finishPolicyVersion!==QUIP_FINISH_POLICY_VERSION)throw Error('Unsupported QUIP finish policy');
  return match.finishPolicyVersion;
}
function scoreReplyReachable(match){
  // Called after the first of two scheduled turns was settled.
  // Check whether ANY eligible next round could close the leader's gap.
  const gap=Math.abs(match.scores[0]-match.scores[1]);
  if(!gap)return true;
  const leader=match.scores[0]>match.scores[1]?0:1,laggard=1-leader;
  const setter=(match.roundIndex+(match.startingTeamIndex??0))%2;
  const recipient=awardRecipientIndex(match,setter);
  const rules=ruleSetForGame(match);
  const difficulty=match.difficulty==='mixed'&&match.plannerVersion!=null?
    match.plannerState?.levels?.[Math.floor(match.roundIndex/2)%3]:match.difficulty;
  if(!QUIP_DIFFICULTIES.includes(difficulty))throw Error('Unknown next round difficulty');
  const pack=match.contentPack?getContentPack(match.contentPack):null;
  return match.modes.some(id=>{
    if(pack?.allowedModes&&!pack.allowedModes.includes(id))return false;
    if(!modeAwardAvailability(id,match).available)return false;
    const config=modeConfigForGame(match,id);
    if(config.supportsSharedAward){
      // One player can be awarded independently while the other gets zero.
      return rewardForRound(match,id,difficulty,false)>=gap;
    }
    const modifier=rules.version>=4&&config.usesModifiers&&
      (id==='secret'||match.complications&&match.modifierChance>0);
    const reward=rewardForRound(match,id,difficulty,modifier);
    if(recipient===laggard&&reward>=gap)return true;
    // The next recipient can be the leader under guesser-scoring.
    // A risk failure can then close the gap by subtracting points.
    const risk=match.riskRounds&&config.allowsRisk&&rules.risk.chance>0&&
      match.roundIndex>=rules.risk.firstRoundIndex;
    return recipient===leader&&risk&&
      Math.min(rules.risk.loss,Math.max(rules.risk.minScore,match.scores[leader]))>=gap;
  });
}
function scoreMatchComplete(match){
  if(finishPolicyVersion(match)==null){
    if(match.finishType!=='score')return match.roundIndex>=match.rounds;
    return match.roundIndex%2===0&&Math.max(...match.scores)>=match.targetScore&&match.scores[0]!==match.scores[1];
  }
  if(match.finishType!=='score')return match.roundIndex>=match.rounds;
  if(Math.max(...match.scores)<match.targetScore||match.scores[0]===match.scores[1])return false;
  if(match.roundIndex%2===0)return true;
  return !scoreReplyReachable(match);
}

function scoreNeedsTiebreak(match){
 return finishPolicyVersion(match)===1&&match.finishType==='score'&&
  match.roundIndex>0&&match.roundIndex%2===0&&
  match.scores[0]===match.scores[1]&&match.scores[0]>=match.targetScore;
}
