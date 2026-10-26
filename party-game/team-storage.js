'use strict';
// Isolated team slot. No automatic migration or access to duel keys.
(function exposeTeamStorage(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./team-format.js'));
 else root.QuipTeamStorage=factory(root.QuipTeamFormat);
})(globalThis,function teamStorage(format){
 const KEY='kvip:teams-2x2:v1',JOURNAL_KEY=KEY+':pending',LOCK=KEY+':write';
 const VERSION=1,KIND='quip-teams-2x2',MAX_BYTES=1024*1024;
 const error=(code,message)=>Object.assign(Error(message),{code});
 const fail=(code,message)=>{throw error(code,message);};
 function exact(value,fields){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==fields.slice().sort().join('|'))fail('CORRUPT','Неизвестные или неполные поля командного сохранения.');
 }
 const bytes=value=>new TextEncoder().encode(value).byteLength;
 async function sha256(value){
  const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
 }
 function create({storage,validateMatch,validateReplacement=null,exclusive,digest=sha256,maxBytes=MAX_BYTES}={}){
  if(!format||typeof validateMatch!=='function')fail('VALIDATOR_REQUIRED','Требуется полный валидатор командного матча.');
  if(validateReplacement!==null&&typeof validateReplacement!=='function')fail('VALIDATOR_REQUIRED','Неверный валидатор сохранения предыдущей партии.');
  if(!storage||!['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function'))fail('STORAGE_REQUIRED','Командное хранилище недоступно.');
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>MAX_BYTES)fail('LIMIT','Неверный предел размера.');
  if(!exclusive){
   if(!globalThis.navigator?.locks?.request)fail('LOCK_REQUIRED','Для безопасной командной записи требуется Web Locks.');
   exclusive=fn=>globalThis.navigator.locks.request(LOCK,{mode:'exclusive'},fn);
  }
  if(typeof exclusive!=='function'||typeof digest!=='function')fail('DEPENDENCY','Неверный провайдер блокировки или контрольной суммы.');
  function checkMatch(match){
   if(!match||typeof match!=='object'||Array.isArray(match))fail('CORRUPT','Нет командного матча.');
   format.validate(match.teamFormat);
   // This callback must validate the actual engine, history, score replay,
   // planners, cards and roles. Header validation alone cannot authorize a save.
   if(validateMatch(match)!==true)fail('CORRUPT','Полная проверка командного матча не пройдена.');
   return match;
  }
  async function checksum(payload){const sum=await digest(JSON.stringify(payload));if(typeof sum!=='string'||!/^[0-9a-f]{64}$/.test(sum))fail('DIGEST','Контрольная сумма недоступна.');return sum;}
  function bounded(raw,limit=maxBytes){if(typeof raw!=='string'||bytes(raw)>limit)fail('LIMIT','Превышен размер командного сохранения.');return raw;}
  async function decode(raw){
   let value;try{value=JSON.parse(bounded(raw));}catch(e){if(e.code)throw e;fail('CORRUPT','Повреждён JSON командной партии.');}
   exact(value,['version','kind','revision','match','checksum']);
   if(value.version!==VERSION||value.kind!==KIND)fail('INCOMPATIBLE','Неизвестная версия командного сохранения.');
   if(!Number.isSafeInteger(value.revision)||value.revision<1)fail('CORRUPT','Неверная ревизия командного сохранения.');
   const {version,kind,revision,match}=value,payload={version,kind,revision,match};
   if(value.checksum!==await checksum(payload))fail('CORRUPT','Контрольная сумма не совпадает.');
   checkMatch(match);return value;
  }
  async function encode(match,revision){
   const payload={version:VERSION,kind:KIND,revision,match};
   const raw=bounded(JSON.stringify({...payload,checksum:await checksum(payload)}));
   await decode(raw);return raw;
  }
  const protectedResult=(e,raw)=>({status:'blocked',reason:e.code||'UNAVAILABLE',raw});
  function load(){return exclusive(async()=>{
   let raw;try{
    raw=storage.getItem(KEY);
    const value=raw===null?null:await decode(raw);
    // Re-read after asynchronous verification. A receiving renderer may have
    // queued storage notifications when its native Web Lock is first granted.
    if(storage.getItem(KEY)!==raw)return {status:'blocked',reason:'CONFLICT',raw};
    if(storage.getItem(JOURNAL_KEY)!==null)return {status:'blocked',reason:'RECOVERY_REQUIRED',raw};
    return value?{status:'ok',raw,revision:value.revision,match:value.match}:{status:'empty',raw:null,revision:0,match:null};
   }catch(e){return protectedResult(e,raw);}
  });}
  function commit({expectedRaw,match,replaceMatchId=null}={}){
   // Snapshot synchronously: caller mutations while awaiting a lock/digest must
   // not change the action that is eventually committed.
   let snapshot;try{snapshot=JSON.parse(bounded(JSON.stringify(match)));checkMatch(snapshot);}catch(e){return Promise.reject(e);}
   if(expectedRaw!==null&&typeof expectedRaw!=='string')return Promise.reject(error('EXPECTED_RAW_REQUIRED','Требуется точный исходный RAW.'));
   return exclusive(async()=>{
    const raw=storage.getItem(KEY);
    if(raw!==expectedRaw)fail('CONFLICT','Командная партия уже изменена в другой вкладке.');
    const before=raw===null?null:await decode(raw),revision=(before?.revision||0)+1;
    // Classify pending only after the async read is verified and rechecked.
    // No pending journal is removed, ignored or repaired by this path.
    if(storage.getItem(KEY)!==raw)fail('CONFLICT','Командная партия уже изменена в другой вкладке.');
    if(storage.getItem(JOURNAL_KEY)!==null)fail('RECOVERY_REQUIRED','Сначала восстановите прерванную командную запись.');
    if(!Number.isSafeInteger(revision))fail('LIMIT','Исчерпаны ревизии.');
    const replacing=!!before&&before.match.teamFormat.id!==snapshot.teamFormat.id;
    if(replacing&&!(replaceMatchId===before.match.teamFormat.id&&validateReplacement?.(before.match,snapshot)===true)||!replacing&&replaceMatchId!==null)fail('MATCH_CHANGED','Нельзя заменить другую командную партию без явного сохранения её архива.');
    const next=await encode(snapshot,revision),journal=bounded(JSON.stringify(replacing?{version:2,before:raw,after:next,replaceMatchId}:{version:1,before:raw,after:next}),maxBytes*3);
    if(storage.getItem(KEY)!==raw||storage.getItem(JOURNAL_KEY)!==null)fail('CONFLICT','Командное сохранение изменилось.');
    storage.setItem(JOURNAL_KEY,journal);
    if(storage.getItem(JOURNAL_KEY)!==journal||storage.getItem(KEY)!==raw)fail('WRITE_PENDING','Не удалось проверить журнал командной записи.');
    storage.setItem(KEY,next);
    if(storage.getItem(KEY)!==next||storage.getItem(JOURNAL_KEY)!==journal)fail('WRITE_PENDING','Не удалось подтвердить командную запись.');
    storage.removeItem(JOURNAL_KEY);
    if(storage.getItem(JOURNAL_KEY)!==null||storage.getItem(KEY)!==next)fail('WRITE_PENDING','Не удалось завершить командную запись.');
    return {status:'ok',raw:next,revision,match:JSON.parse(next).match};
   });
  }
  function pending(){return exclusive(async()=>{
   try{
    const journal=storage.getItem(JOURNAL_KEY);if(journal===null)return {status:'empty',journal:null};
    const value=await readJournal(journal);
    if(![value.before,value.after].includes(storage.getItem(KEY)))fail('CONFLICT','Исходное сохранение не соответствует журналу.');
    return {status:'pending',journal,before:value.before,after:value.after};
   }catch(e){return protectedResult(e);}
  });}
  async function readJournal(raw){
   let value;try{value=JSON.parse(bounded(raw,maxBytes*3));}catch(e){if(e.code)throw e;fail('CORRUPT','Повреждён журнал командной записи.');}
   if(value?.version!==1&&value?.version!==2)fail('INCOMPATIBLE','Неизвестная версия журнала.');
   exact(value,value.version===2?['version','before','after','replaceMatchId']:['version','before','after']);
   const before=value.before===null?null:await decode(value.before),after=await decode(value.after);
   if(after.revision!==(before?.revision||0)+1)fail('CORRUPT','Непоследовательный журнал командной записи.');
   if(value.version===1){if(before&&before.match.teamFormat.id!==after.match.teamFormat.id)fail('CORRUPT','Изменена партия в обычном журнале.');}
   else if(!before||value.replaceMatchId!==before.match.teamFormat.id||before.match.teamFormat.id===after.match.teamFormat.id||validateReplacement?.(before.match,after.match)!==true)fail('CORRUPT','Журнал не сохраняет предыдущую партию.');
   return value;
  }
  function recover({expectedJournal,choice}={}){return exclusive(async()=>{
   if(typeof expectedJournal!=='string'||!['keep-before','keep-after'].includes(choice))fail('RECOVERY_CHOICE','Требуется явный выбор восстановления.');
   if(storage.getItem(JOURNAL_KEY)!==expectedJournal)fail('CONFLICT','Журнал изменился.');
   const journal=await readJournal(expectedJournal),raw=storage.getItem(KEY);
   if(![journal.before,journal.after].includes(raw))fail('CONFLICT','Сторонняя запись сохранена без изменений.');
   const target=choice==='keep-before'?journal.before:journal.after;
   if(storage.getItem(JOURNAL_KEY)!==expectedJournal||storage.getItem(KEY)!==raw)fail('CONFLICT','Сохранение изменилось при проверке.');
   if(raw!==target){if(target===null)storage.removeItem(KEY);else storage.setItem(KEY,target);}
   if(storage.getItem(KEY)!==target||storage.getItem(JOURNAL_KEY)!==expectedJournal)fail('WRITE_PENDING','Восстановление не подтверждено.');
   storage.removeItem(JOURNAL_KEY);
   if(storage.getItem(JOURNAL_KEY)!==null||storage.getItem(KEY)!==target)fail('WRITE_PENDING','Восстановление не завершено.');
   return target===null?{status:'empty',raw:null,revision:0,match:null}:{status:'ok',raw:target,...(({revision,match})=>({revision,match}))(await decode(target))};
  });}
  return Object.freeze({load,commit,pending,recover});
 }
 return Object.freeze({KEY,JOURNAL_KEY,LOCK,VERSION,KIND,MAX_BYTES,create});
});
