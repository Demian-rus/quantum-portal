'use strict';
// Versioned TASK028 identity contract; independent of engine and storage.
(function exposeTeamFormat(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.QuipTeamFormat=api;
})(globalThis,function teamFormat(){
 const VERSION=1,FORMAT='teams-2x2',STATS_POLICY='excluded-from-duel-profiles';
 const fail=message=>{throw Error('TEAM_FORMAT: '+message);};
 const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
 function keys(value,expected){
  if(!record(value)||Object.keys(value).sort().join('|')!==expected.slice().sort().join('|'))fail('unknown or missing fields');
 }
 function name(value){
  if(typeof value!=='string'||/[\p{Cc}\p{Cf}]/u.test(value))fail('invalid name');
  const normalized=value.normalize('NFKC').replace(/\s+/gu,' ').trim();
  if(!normalized||Array.from(normalized).length>24)fail('name must contain 1–24 characters');
  return normalized;
 }
 // Reject invisible/case/spacing duplicates and common Latin/Cyrillic lookalikes.
 // This is a local name check, not a permanent player identity or profile ID.
 function nameKey(value){
  const lookalikes={'а':'a','в':'b','с':'c','е':'e','н':'h','к':'k','м':'m','о':'o','р':'p','т':'t','у':'y','х':'x','і':'i','ј':'j','ѕ':'s'};
  return name(value).toLocaleLowerCase('ru-RU').replace(/[авсенкмортухіјѕ]/gu,c=>lookalikes[c]);
 }
 function members(input){
  if(!Array.isArray(input)||input.length!==2||input.some(team=>!Array.isArray(team)||team.length!==2))fail('two teams of two required');
  const result=input.map(team=>team.map(name));
  if(new Set(result.flat().map(nameKey)).size!==4)fail('four distinguishable names required');
  return result;
 }
 const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
 function identity(id){if(typeof id!=='string'||!/^[-A-Za-z0-9_]{16,80}$/.test(id))fail('invalid match ID');return id;}
 function bit(value){if(value!==0&&value!==1)fail('invalid opening position');return value;}
 function validate(header){
  keys(header,['version','format','id','teams','opening','statsPolicy']);
  if(header.version!==VERSION||header.format!==FORMAT||header.statsPolicy!==STATS_POLICY)fail('unsupported version or statistics policy');
  identity(header.id);keys(header.opening,['teamIndex','setterPlayerIndices']);
  bit(header.opening.teamIndex);
  if(!Array.isArray(header.opening.setterPlayerIndices)||header.opening.setterPlayerIndices.length!==2)fail('two opening setters required');
  bit(header.opening.setterPlayerIndices[0]);bit(header.opening.setterPlayerIndices[1]);
  if(!Array.isArray(header.teams)||header.teams.length!==2)fail('two teams required');
  header.teams.forEach(team=>keys(team,['name','members']));
  const names=members(header.teams.map(team=>team.members));
  for(let i=0;i<2;i++){
   if(header.teams[i].name!=='Команда '+(i+1)||names[i].some((n,j)=>n!==header.teams[i].members[j]))fail('noncanonical team names');
  }
  return deepFreeze({version:VERSION,format:FORMAT,id:header.id,
   teams:names.map((list,i)=>({name:'Команда '+(i+1),members:list})),
   opening:{teamIndex:header.opening.teamIndex,setterPlayerIndices:header.opening.setterPlayerIndices.slice()},statsPolicy:STATS_POLICY});
 }
 function create(input,{id,random=Math.random}={}){
  const names=members(input);identity(id);
  if(typeof random!=='function')fail('random source required');
  const draw=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)fail('random must be in [0,1)');return n<.5?0:1;};
  return validate({version:VERSION,format:FORMAT,id,
   teams:names.map((list,i)=>({name:'Команда '+(i+1),members:list})),
   opening:{teamIndex:draw(),setterPlayerIndices:[draw(),draw()]},statsPolicy:STATS_POLICY});
 }
 function roles(header,turnIndex){
  const h=validate(header);
  if(!Number.isSafeInteger(turnIndex)||turnIndex<0)fail('invalid turn index');
  const teamIndex=(h.opening.teamIndex+turnIndex%2)%2;
  const setterPlayerIndex=(h.opening.setterPlayerIndices[teamIndex]+Math.floor(turnIndex/2)%2)%2;
  const guesserPlayerIndex=1-setterPlayerIndex;
  return Object.freeze({turnIndex,teamIndex,setterPlayerIndex,guesserPlayerIndex,recipientTeamIndex:teamIndex,
   teamName:h.teams[teamIndex].name,setterName:h.teams[teamIndex].members[setterPlayerIndex],guesserName:h.teams[teamIndex].members[guesserPlayerIndex]});
 }
 function turnIdentity(header,turnIndex){
  const r=roles(header,turnIndex);
  return Object.freeze({teamIndex:r.teamIndex,setterPlayerIndex:r.setterPlayerIndex,guesserPlayerIndex:r.guesserPlayerIndex,recipientTeamIndex:r.recipientTeamIndex});
 }
 function validateTurnIdentity(header,turnIndex,value){
  const expected=turnIdentity(header,turnIndex);keys(value,Object.keys(expected));
  for(const key of Object.keys(expected))if(value[key]!==expected[key])fail('inconsistent '+key);
  return expected;
 }
 return Object.freeze({VERSION,FORMAT,STATS_POLICY,name,nameKey,members,create,validate,roles,turnIdentity,validateTurnIdentity});
});
