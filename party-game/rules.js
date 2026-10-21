'use strict';
// Immutable rules. Never edit existing versions: saved matches depend on them.
const QUIP_RULE_VERSION=3;
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
const QUIP_RULESETS=Object.freeze({
 1:makeQuipRule(1,CLASSIC_QUIP_REWARDS,true),
 2:makeQuipRule(2,CLASSIC_QUIP_REWARDS),
 3:makeQuipRule(3,GRADED_QUIP_REWARDS)
});
function ruleSetForGame(match){
 if(!match||match.scoringVersion!==2)return QUIP_RULESETS[1];
 // Old V5 duel saves have scoringVersion:2, but no rulesVersion.
 if(match.rulesVersion==null)return QUIP_RULESETS[2];
 const rules=QUIP_RULESETS[match.rulesVersion];
 if(!rules)throw Error('Unsupported QUIP rulesVersion: '+String(match.rulesVersion));
 return rules;
}
function rewardForRound(match,mode,difficulty){
 const table=ruleSetForGame(match).rewards[mode];
 if(!table||!QUIP_DIFFICULTIES.includes(difficulty))
  throw Error('Unknown mode/difficulty for rewards: '+mode+'/'+difficulty);
 return table[difficulty];
}
