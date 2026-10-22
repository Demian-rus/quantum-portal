'use strict';
// Versioned, pure selection history. It does not know about DOM, scores or timers.
const QUIP_TASK_HISTORY_VERSION=1;
const QUIP_TASK_HISTORY_POLICIES=Object.freeze({1:Object.freeze({recentParties:10,maxKeys:100000,maxKeyLength:600,maxMemoryChars:750000})});
function normalizeTaskText(value){return String(value).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function taskRecordKeys(record){
 const domain=record.question!=null?'question':record.type==='person'?'person':'prompt',text=record.question??record.text;
 const keys=[domain+':id:'+record.id,domain+':text:'+normalizeTaskText(text)];
 if(record.meta?.equivalenceKey)keys.push(domain+':equiv:'+normalizeTaskText(record.meta.equivalenceKey));
 return keys;
}
function freshTaskMemory(){return {version:1,nextPartyId:1,parties:[],seen:[]};}
function validateHistoryKeys(keys,policy=QUIP_TASK_HISTORY_POLICIES[1]){
 if(!Array.isArray(keys)||keys.length>policy.maxKeys||new Set(keys).size!==keys.length||keys.some(k=>typeof k!=='string'||!k||k.length>policy.maxKeyLength))throw Error('Invalid task-history keys');
}
function validateTaskMemory(memory){
 const p=QUIP_TASK_HISTORY_POLICIES[memory?.version];
 if(!p||!Number.isSafeInteger(memory.nextPartyId)||memory.nextPartyId<1||!Array.isArray(memory.parties)||memory.parties.length>p.recentParties||
  new Set(memory.parties).size!==memory.parties.length||memory.parties.some((id,i)=>!Number.isSafeInteger(id)||id<1||id>=memory.nextPartyId||i>0&&id<=memory.parties[i-1])||!Array.isArray(memory.seen))throw Error('Unsupported task-history memory');
 validateHistoryKeys(memory.seen.map(row=>row?.[0]),p);
 if(memory.seen.some(row=>!Array.isArray(row)||row.length!==2||!memory.parties.includes(row[1])))throw Error('Invalid task-history party reference');
 return memory;
}
function validateGameTaskHistory(match,memory){
 if(match.taskHistoryVersion==null){if(match.taskHistory!=null)throw Error('Missing task-history policy');return;}
 const p=QUIP_TASK_HISTORY_POLICIES[match.taskHistoryVersion],h=match.taskHistory;
 if(!p||!memory||!h||!Number.isSafeInteger(h.partyId)||h.partyId<1||h.partyId>=memory.nextPartyId)throw Error('Unsupported task-history policy/state');
 validateHistoryKeys(h.seen,p);
}
function startTaskHistory(memory){
 validateTaskMemory(memory);if(memory.nextPartyId===Number.MAX_SAFE_INTEGER)throw Error('Task-history sequence exhausted');
 return {memory:{...memory,nextPartyId:memory.nextPartyId+1},history:{partyId:memory.nextPartyId,seen:[]}};
}
function archiveTaskHistory(memory,history,policy=QUIP_TASK_HISTORY_POLICIES[1]){
 validateTaskMemory(memory);if(!history?.seen.length||memory.parties.includes(history.partyId))return memory;
 const seen=new Map(memory.seen);for(const key of history.seen)seen.set(key,history.partyId);
 let parties=[...memory.parties,history.partyId].slice(-policy.recentParties),entries=[...seen].filter(([,party])=>parties.includes(party));
 // A rare very large archive releases oldest whole parties, never current-match keys.
 while(parties.length&&(entries.length>policy.maxKeys||JSON.stringify(entries).length>policy.maxMemoryChars)){
  parties=parties.slice(1);entries=entries.filter(([,party])=>parties.includes(party));
 }
 return {...memory,parties,seen:entries};
}
function rememberTaskKeys(history,keys){
 const selected=new Set(keys),seen=history.seen.filter(key=>!selected.has(key));seen.push(...selected);validateHistoryKeys(seen);
 return {...history,seen};
}
function selectHistoryRecord(pool,history,memory,{random=Math.random,excludedKeys=[],onExhaustion='oldest',keysFor=taskRecordKeys}={}){
 validateHistoryKeys(history.seen);validateTaskMemory(memory);
 const excluded=new Set(excludedKeys),rank=new Map(history.seen.map((key,index)=>[key,index]));
 const candidates=pool.map(record=>({record,keys:keysFor(record)})).filter(candidate=>!candidate.keys.some(key=>excluded.has(key)));
 if(!candidates.length)throw Error('No distinct eligible task remains in this round');
 let available=candidates.filter(c=>c.keys.every(key=>!rank.has(key))),exhausted=!available.length;
 if(exhausted){
  if(onExhaustion==='skip')return {record:null,history,exhausted:true,releasedParties:0};
  const age=c=>Math.max(...c.keys.map(key=>rank.get(key)??-1)),oldest=Math.min(...candidates.map(age));
  available=candidates.filter(c=>age(c)===oldest);
 }
 const past=new Map(memory.seen),parties=memory.parties.filter(id=>id!==history.partyId);let allowed=[],releasedParties=0;
 // Current-match uniqueness has priority over every previous-party restriction.
 for(;releasedParties<=parties.length;releasedParties++){
  const blocked=new Set(parties.slice(releasedParties));allowed=available.filter(c=>c.keys.every(key=>!blocked.has(past.get(key))));if(allowed.length)break;
 }
 const roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('Invalid task-history RNG');
 const chosen=allowed[Math.floor(roll*allowed.length)];
 return {record:chosen.record,history:rememberTaskKeys(history,chosen.keys),exhausted,releasedParties};
}
if(typeof module==='object'&&module.exports)module.exports={QUIP_TASK_HISTORY_VERSION,QUIP_TASK_HISTORY_POLICIES,normalizeTaskText,taskRecordKeys,freshTaskMemory,validateTaskMemory,validateGameTaskHistory,startTaskHistory,archiveTaskHistory,rememberTaskKeys,selectHistoryRecord};
