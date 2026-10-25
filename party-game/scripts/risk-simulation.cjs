'use strict';
// Deterministic Monte Carlo over production policy functions. Independent stream
// for mode eligibility: risk decisions cannot change the sampled schedule.
const fs=require('node:fs'),path=require('node:path');
const {createSimulation,seededRandom}=require('./game-simulation.cjs');
function runSimulation(matches=10000){
 const h=createSimulation(19),plan=h.eval('planRisk'),fresh=h.eval('freshRiskPlan');
 const old=h.eval('(round,value,mode)=>shouldSelectRisk({riskRounds:true,scoringVersion:2,rulesVersion:5,modeConfigVersion:1,roundIndex:round},value,mode)');
 const scenarios=[['10 turns',10,0],['20 turns',20,0],['40 turns',40,0],['100 turns',100,0],['200 turns',200,0],['Mixed 40 / 25% Approx',40,.25],['Mixed 100 / 25% Approx',100,.25],['unequal eligibility 100 / 50% Approx for recipient 1',100,.5]];
 const results=[];
 for(const [scenario,turns,skip]of scenarios){
  const stats=()=>({eligible:0,risks:0,recipients:[0,0],gaps:[],maxPrefixGap:0,maxRiskOwnerStreak:0,sameOwnerTransitions:0,transitions:0,zeroRiskMatches:0,tenToZero:0});
  const rows=[stats(),stats()];
  for(let seed=1;seed<=matches;seed++){
   const random=seededRandom(seed),modes=seededRandom(seed^0x51ed270b),counts=[[0,0],[0,0]],last=[null,null],streak=[0,0];let state=fresh();
   for(let round=0;round<turns;round++){
    const recipient=round%2,mode=skip&&(scenario.startsWith('unequal')?recipient===1&&modes()<skip:modes()<skip)?'approx':'talk';
    if(round<2||mode==='approx')continue;
    const value=random(),selected=plan(state,recipient,value);state=selected.state;
    for(const [i,risk]of [old(round,value,mode),selected.risk].entries()){
     const row=rows[i];row.eligible++;
     if(risk){
      counts[i][recipient]++;row.risks++;row.recipients[recipient]++;
      if(last[i]!==null){row.transitions++;if(last[i]===recipient)row.sameOwnerTransitions++;}
      streak[i]=last[i]===recipient?streak[i]+1:1;last[i]=recipient;
      row.maxRiskOwnerStreak=Math.max(row.maxRiskOwnerStreak,streak[i]);
     }
     row.maxPrefixGap=Math.max(row.maxPrefixGap,Math.abs(counts[i][0]-counts[i][1]));
    }
   }
   for(let i=0;i<2;i++){
    const gap=Math.abs(counts[i][0]-counts[i][1]);rows[i].gaps.push(gap);
    if(!counts[i][0]&&!counts[i][1])rows[i].zeroRiskMatches++;
    if(Math.min(...counts[i])===0&&Math.max(...counts[i])>=10)rows[i].tenToZero++;
   }
  }
  rows.forEach((row,i)=>{
   row.gaps.sort((a,b)=>a-b);const gaps=row.gaps;delete row.gaps;
   results.push({scenario,policy:i?'balanced-v1':'legacy',matches,...row,
    ratePercent:+(100*row.risks/row.eligible).toFixed(4),meanFinalGap:+(gaps.reduce((a,b)=>a+b,0)/matches).toFixed(4),
    p95FinalGap:gaps[Math.ceil(matches*.95)-1],maxFinalGap:gaps.at(-1),
    sameOwnerPercent:row.transitions?+(100*row.sameOwnerTransitions/row.transitions).toFixed(2):0,
    gapDistribution:Object.fromEntries([...new Set(gaps)].map(gap=>[gap,gaps.filter(n=>n===gap).length]))});
  });
 }
 return {version:1,matchesPerScenario:matches,seedRange:[1,matches],warmupTurns:2,results,scoreFinish:scoreFinishSimulation(matches,h)};
}
function scoreFinishSimulation(matches,h){
 const plan=h.eval('planRisk'),fresh=h.eval('freshRiskPlan'),recipient=h.eval('awardRecipientIndex'),settle=h.eval('settleQuipRound'),finish=h.eval('scoreMatchComplete'),tie=h.eval('scoreNeedsTiebreak');
 const report=[];
 for(const policy of ['legacy','balanced-v1']){
  let eligible=0,risks=0,maxPrefixGap=0,turns=0,ties=0;const gaps=[],recipients=[0,0];
  for(let seed=1;seed<=matches;seed++){
   const random=seededRandom(seed),outcomes=seededRandom(seed^0x90019),counts=[0,0];let state=fresh();
   const match={scoringVersion:2,rulesVersion:5,modeConfigVersion:1,finishPolicyVersion:1,awardPolicyVersion:1,
    awardTo:seed%2?'setter':'guesser',startingTeamIndex:seed%2,scores:[0,0],roundIndex:0,difficulty:'easy',
    modes:['talk','mime','secret','blitz'],riskRounds:true,complications:false,modifierChance:20,finishType:'score',targetScore:20};
   while(!finish(match)&&!tie(match)&&match.roundIndex<1000){
    const modeId=match.modes[Math.floor(outcomes()*match.modes.length)],who=recipient(match,(match.roundIndex+match.startingTeamIndex)%2);
    const success=outcomes()<.65,value=match.roundIndex>=2?random():null;
    const picked=match.roundIndex<2?{risk:false,state}:policy==='legacy'?{risk:value<.2,state}:plan(state,who,value);state=picked.state;
    if(value!==null)eligible++;if(picked.risk){risks++;counts[who]++;recipients[who]++;}
    maxPrefixGap=Math.max(maxPrefixGap,Math.abs(counts[0]-counts[1]));
    const basePoints=modeId==='talk'?1:2,modifierPoints=modeId==='secret'?1:0;
    const round={modeId,basePoints,modifierPoints,points:basePoints+modifierPoints,risk:picked.risk,complication:modifierPoints?'fixed secret condition':'',blitzCorrect:success?3:0,blitzRequired:3};
    match.scores[who]+=settle(match,round,{taskSuccess:success,modifierSuccess:true},match.scores[who]).delta;
    match.roundIndex++;
   }
   if(match.roundIndex>=1000)throw Error('Unbounded score simulation');
   if(tie(match))ties++;turns+=match.roundIndex;gaps.push(Math.abs(counts[0]-counts[1]));
  }
  gaps.sort((a,b)=>a-b);report.push({scenario:'score target 20 / 65% success / 4 real modes',policy,matches,eligible,risks,recipients,
   ratePercent:+(100*risks/eligible).toFixed(4),meanTurns:+(turns/matches).toFixed(4),p95FinalGap:gaps[Math.ceil(matches*.95)-1],maxFinalGap:gaps.at(-1),maxPrefixGap,ties});
 }
 return report;
}
if(require.main===module){
 const report=runSimulation();const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.table([...report.results,...report.scoreFinish].map(({scenario,policy,ratePercent,p95FinalGap,maxFinalGap,maxPrefixGap,maxRiskOwnerStreak,sameOwnerPercent,tenToZero})=>({scenario,policy,ratePercent,p95FinalGap,maxFinalGap,maxPrefixGap,maxRiskOwnerStreak,sameOwnerPercent,tenToZero})));
}
module.exports={runSimulation};
