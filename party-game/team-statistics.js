'use strict';
// TASK032: immutable result contributions. The team transaction owns the ledger;
// profile exports may carry the same versioned results, joined by ID, never name.
(function expose(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QuipTeamStatistics=api;
})(globalThis,function teamStatistics(){
 const fail=()=>{throw Error('TEAM_STATISTICS: Повреждена привязка профилей или командная статистика. Данные сохранены.');};
 const plain=x=>x&&typeof x==='object'&&!Array.isArray(x),copy=x=>JSON.parse(JSON.stringify(x));
 const count=x=>Number.isSafeInteger(x)&&x>=0,id=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x);
 const matchId=x=>typeof x==='string'&&/^[-A-Za-z0-9_]{16,80}$/.test(x);
 const modeId=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(x)&&!['constructor','prototype'].includes(x);
 const colors=['coral','cyan','violet','green','yellow','pink','orange','blue'];
 function exact(x,keys){if(!plain(x)||Object.keys(x).sort().join('|')!==keys.slice().sort().join('|'))fail();}
 function canonical(x){if(Array.isArray(x))return x.map(canonical);if(plain(x))return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 function binding(value){
  exact(value,['version','storeId','participants']);
  if(value.version!==1||!id(value.storeId)||!Array.isArray(value.participants)||value.participants.length!==2)fail();
  const ids=[];
  for(const team of value.participants){
   if(!Array.isArray(team)||team.length!==2)fail();
   for(const p of team){exact(p,['id','name','color']);if(!id(p.id)||typeof p.name!=='string'||!p.name||p.name!==p.name.normalize('NFKC').replace(/\s+/gu,' ').trim()||Array.from(p.name).length>24||!colors.includes(p.color))fail();ids.push(p.id);}
  }
  if(new Set(ids).size!==4)fail();return copy(value);
 }
 function validateResult(value){
  exact(value,['version','id','storeId','profileIds','scores','turns','sharedTurns','tiebreak','roles','modes']);
  if(value.version!==1||!matchId(value.id)||!id(value.storeId)||!Array.isArray(value.profileIds)||value.profileIds.length!==4||value.profileIds.some(p=>!id(p))||new Set(value.profileIds).size!==4||!Array.isArray(value.scores)||value.scores.length!==2||!value.scores.every(count)||!count(value.turns)||!count(value.sharedTurns)||value.sharedTurns>value.turns||typeof value.tiebreak!=='boolean'||!Array.isArray(value.roles)||value.roles.length!==4||!Array.isArray(value.modes)||value.modes.length!==4)fail();
  value.roles.forEach((role,i)=>{
   exact(role,['setter','guesser','shared']);if(!Object.values(role).every(count)||role.shared!==value.sharedTurns||!plain(value.modes[i]))fail();
   let setters=0,guessers=0,shared=0;
   for(const [mode,stats]of Object.entries(value.modes[i])){
    if(!modeId(mode))fail();exact(stats,['setter','guesser','setterSuccess','guesserSuccess','shared']);
    if(!Object.values(stats).every(count)||stats.setterSuccess>stats.setter||stats.guesserSuccess>stats.guesser||mode==='approx'&&(stats.setter||stats.guesser)||mode!=='approx'&&stats.shared)fail();
    setters+=stats.setter;guessers+=stats.guesser;shared+=stats.shared;
   }
   if(setters!==role.setter||guessers!==role.guesser||shared!==role.shared)fail();
  });
  for(const field of ['setter','guesser'])if(value.roles.reduce((n,r)=>n+r[field],0)!==value.turns-value.sharedTurns)fail();
  return canonical(copy(value));
 }
 function ledger(value){if(!Array.isArray(value)||value.length>4096)fail();const seen=new Set();return value.map(row=>{const r=validateResult(row);if(seen.has(r.id))fail();seen.add(r.id);return r;});}
 function merge(...sources){
  const out=[],seen=new Map();for(const source of sources)for(const row of ledger(source||[])){
   const prior=seen.get(row.id);if(prior){if(!same(prior,row))fail();}else{seen.set(row.id,row);out.push(row);}
  }return ledger(out);
 }
 function result(match){
  const b=binding(match.teamFormat?.profileBinding);
  if(match.phase!=='results'||match.reviewConfirmed!==true||!Array.isArray(match.history)||match.history.length!==match.roundIndex)fail();
  const roles=Array.from({length:4},()=>({setter:0,guesser:0,shared:0})),modes=Array.from({length:4},()=>({}));let sharedTurns=0;
  const stat=(i,mode)=>modes[i][mode]||(modes[i][mode]={setter:0,guesser:0,setterSuccess:0,guesserSuccess:0,shared:0});
  for(const row of match.history){
   if(row.mode==='approx'){sharedTurns++;roles.forEach((r,i)=>{r.shared++;stat(i,'approx').shared++;});continue;}
   const r=row.teamRoles,success=row.taskSuccess??row.correct;
   if(!r||![0,1].includes(r.teamIndex)||![0,1].includes(r.setterPlayerIndex)||r.guesserPlayerIndex!==1-r.setterPlayerIndex||typeof success!=='boolean')fail();
   for(const [field,p]of [['setter',r.setterPlayerIndex],['guesser',r.guesserPlayerIndex]]){
    const i=r.teamIndex*2+p;roles[i][field]++;const s=stat(i,row.mode);s[field]++;s[field+'Success']+=Number(success);
   }
  }
  return validateResult({version:1,id:match.matchId,storeId:b.storeId,profileIds:b.participants.flat().map(p=>p.id),scores:match.scores.slice(),turns:match.roundIndex,sharedTurns,tiebreak:match.tiebreak?.stage==='decided',roles,modes});
 }
 function forStore(results,store){const rows=ledger(results).filter(row=>row.storeId===store.storeId);if(rows.some(row=>row.profileIds.some(id=>!store.profiles.some(p=>p.id===id))))fail();return rows;}
 function forProfile(results,storeId,profileId){
  const total={matches:0,wins:0,losses:0,draws:0,setter:0,guesser:0,shared:0,tiebreaks:0,modes:{},recent:[]};
  for(const row of ledger(results)){
   if(row.storeId!==storeId)continue;const i=row.profileIds.indexOf(profileId);if(i<0)continue;const team=Math.floor(i/2),outcome=row.scores[0]===row.scores[1]?'draws':row.scores[team]>row.scores[1-team]?'wins':'losses';
   total.matches++;total[outcome]++;total.tiebreaks+=Number(row.tiebreak);
   for(const field of ['setter','guesser','shared'])total[field]+=row.roles[i][field];
   for(const [mode,stats]of Object.entries(row.modes[i])){const t=total.modes[mode]||(total.modes[mode]={setter:0,guesser:0,setterSuccess:0,guesserSuccess:0,shared:0});for(const field of Object.keys(t))t[field]+=stats[field];}
   total.recent.push({id:row.id,team:team+1,scores:row.scores.slice(),outcome});
  }
  total.recent=total.recent.slice(-10);return total;
 }
 return Object.freeze({binding,validateResult,ledger,merge,result,forStore,forProfile,same});
});
