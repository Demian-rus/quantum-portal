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
 const RECEIPT_DB='kvip-teams-durability:v1';
 function nativeReceipt(){
  if(!globalThis.indexedDB)fail('RECEIPT_REQUIRED','Для надёжного сохранения 2 на 2 требуется IndexedDB. Игра 1 на 1 остаётся доступной.');
  let connection=null,opening=null;
  function open(){
   if(connection)return Promise.resolve(connection);
   if(opening)return opening;
   const pending=new Promise((resolve,reject)=>{
   const request=globalThis.indexedDB.open(RECEIPT_DB,1);let rejected=false,problem=null;
   request.onupgradeneeded=event=>{try{if(event.oldVersion===0)request.result.createObjectStore('receipts');}catch(e){problem=e;request.transaction.abort();}};
   request.onblocked=()=>{rejected=true;reject(error('RECEIPT_BLOCKED','Закройте другую версию приложения и повторите сохранение 2 на 2.'));};
   request.onerror=()=>reject(problem||request.error);
   request.onsuccess=()=>{const db=request.result;if(rejected){db.close();return;}if(db.version!==1||db.objectStoreNames.length!==1||!db.objectStoreNames.contains('receipts')){db.close();reject(error('INCOMPATIBLE','Неизвестная версия подтверждений 2 на 2.'));return;}db.onversionchange=()=>{if(connection===db)connection=null;db.close();};db.onclose=()=>{if(connection===db)connection=null;};connection=db;resolve(db);};
   }).finally(()=>{if(opening===pending)opening=null;});
   opening=pending;return pending;
  }
  async function access(expected,next,write){
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('receipts',write?'readwrite':'readonly',write?{durability:'strict'}:{}),store=tx.objectStore('receipts'),get=store.get(KEY);let value=null,problem=null;
    get.onsuccess=()=>{try{value=get.result??null;if(write){if(value!==expected){problem=error('CONFLICT','Подтверждённая версия уже изменена в другой вкладке.');tx.abort();}else store.put(next,KEY);}}catch(e){problem=e;tx.abort();}};
    tx.oncomplete=()=>resolve(write?next:value);tx.onabort=()=>reject(problem||tx.error||error('RECEIPT_FAILED','Подтверждение командной записи не сохранено.'));tx.onerror=()=>{};
   });
  }
  return {read:()=>access(null,null,false),write:(expected,next)=>access(expected,next,true)};
 }
 async function sha256(value){
  const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
 }
 function create({storage,validateMatch,validateReplacement=null,validateTransition=null,exclusive,digest=sha256,maxBytes=MAX_BYTES,receipt}={}){
  if(!format||typeof validateMatch!=='function')fail('VALIDATOR_REQUIRED','Требуется полный валидатор командного матча.');
  if(validateTransition!==null&&typeof validateTransition!=='function')fail('VALIDATOR_REQUIRED','Неверный валидатор перехода.');
  if(validateReplacement!==null&&typeof validateReplacement!=='function')fail('VALIDATOR_REQUIRED','Неверный валидатор сохранения предыдущей партии.');
  if(!storage||!['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function'))fail('STORAGE_REQUIRED','Командное хранилище недоступно.');
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>MAX_BYTES)fail('LIMIT','Неверный предел размера.');
  if(!exclusive){
   if(!globalThis.navigator?.locks?.request)fail('LOCK_REQUIRED','Для безопасной командной записи требуется Web Locks.');
   exclusive=fn=>globalThis.navigator.locks.request(LOCK,{mode:'exclusive'},fn);
  }
  if(typeof exclusive!=='function'||typeof digest!=='function')fail('DEPENDENCY','Неверный провайдер блокировки или контрольной суммы.');
  if(receipt===undefined)receipt=typeof window!=='undefined'&&window===globalThis?nativeReceipt():null;
  if(receipt!==null&&(!receipt||typeof receipt.read!=='function'||typeof receipt.write!=='function'))fail('DEPENDENCY','Неверное транзакционное хранилище подтверждений.');
  function checkMatch(match,raw,wrapped=false){
   if(!match||typeof match!=='object'||Array.isArray(match))fail('CORRUPT','Нет командного матча.');
   format.validate(match.teamFormat);
   // This callback must validate the actual engine, history, score replay,
   // planners, cards and roles. Header validation alone cannot authorize a save.
   if(validateMatch(match,raw,wrapped)!==true)fail('CORRUPT','Полная проверка командного матча не пройдена.');
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
   checkMatch(match,raw,true);return value;
  }
  async function encode(match,revision){
   const payload={version:VERSION,kind:KIND,revision,match};
   const raw=bounded(JSON.stringify({...payload,checksum:await checksum(payload)}));
   await decode(raw);return raw;
  }
  const protectedResult=(e,raw)=>({status:'blocked',reason:e.code||'UNAVAILABLE',raw,message:String(e.message||e)});
  async function readReceipt(){
   const raw=receipt?await receipt.read():null;if(raw===null)return {raw:null,value:null};
   const value=JSON.parse(bounded(raw,maxBytes*5));exact(value,['version','committedRaw','pendingJournal']);
   if(value.version!==1)fail('INCOMPATIBLE','Неизвестная версия подтверждения 2 на 2.');
   if(value.committedRaw!==null)await decode(value.committedRaw);
   if(value.pendingJournal!==null){const journal=await readJournal(value.pendingJournal);if(journal.before!==value.committedRaw)fail('CORRUPT','Подтверждение не совпадает с журналом.');}
   return {raw,value};
  }
  async function writeReceipt(expected,committedRaw,pendingJournal=null){
   const next=bounded(JSON.stringify({version:1,committedRaw,pendingJournal}),maxBytes*5);await receipt.write(expected,next);if(await receipt.read()!==next)fail('WRITE_PENDING','Транзакционное подтверждение не прошло проверку чтением.');return next;
  }
  function load(){return exclusive(async()=>{
   let raw;try{
    const state=await readReceipt();
    raw=storage.getItem(KEY);
    if(state.value&&state.value.pendingJournal!==null)return {status:'blocked',reason:'RECOVERY_REQUIRED',raw};
    if(state.value&&state.value.committedRaw!==raw)return {status:'blocked',reason:'MIRROR_MISMATCH',raw};
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
   let snapshot;try{const raw=bounded(JSON.stringify(match));snapshot=JSON.parse(raw);checkMatch(snapshot,raw);}catch(e){return Promise.reject(e);}
   if(expectedRaw!==null&&typeof expectedRaw!=='string')return Promise.reject(error('EXPECTED_RAW_REQUIRED','Требуется точный исходный RAW.'));
   return exclusive(async()=>{
    const state=await readReceipt();
    // IndexedDB's transaction completion establishes the cross-renderer CAS.
    // localStorage notifications are not used as an authority for this version.
    if(state.value&&state.value.committedRaw!==expectedRaw)fail('CONFLICT','Командная партия уже изменена в другой вкладке.');
    if(state.value&&state.value.pendingJournal!==null)fail('RECOVERY_REQUIRED','Сначала восстановите прерванную командную запись.');
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
    if(before&&validateTransition&&validateTransition(before.match,snapshot)!==true)fail('RESULT_CONFLICT','Подтверждённая привязка или статистика партии изменена.');
    const next=await encode(snapshot,revision),journal=bounded(JSON.stringify(replacing?{version:2,before:raw,after:next,replaceMatchId}:{version:1,before:raw,after:next}),maxBytes*3);
    if(storage.getItem(KEY)!==raw||storage.getItem(JOURNAL_KEY)!==null)fail('CONFLICT','Командное сохранение изменилось.');
    const pendingReceipt=receipt?await writeReceipt(state.raw,raw,journal):null;
    if(storage.getItem(KEY)!==raw||storage.getItem(JOURNAL_KEY)!==null)fail('CONFLICT','Сохранение изменилось при подтверждении намерения.');
    storage.setItem(JOURNAL_KEY,journal);
    if(storage.getItem(JOURNAL_KEY)!==journal||storage.getItem(KEY)!==raw)fail('WRITE_PENDING','Не удалось проверить журнал командной записи.');
    storage.setItem(KEY,next);
    if(storage.getItem(KEY)!==next||storage.getItem(JOURNAL_KEY)!==journal)fail('WRITE_PENDING','Не удалось подтвердить командную запись.');
    storage.removeItem(JOURNAL_KEY);
    if(storage.getItem(JOURNAL_KEY)!==null||storage.getItem(KEY)!==next)fail('WRITE_PENDING','Не удалось завершить командную запись.');
    if(receipt)await writeReceipt(pendingReceipt,next);
    return {status:'ok',raw:next,revision,match:JSON.parse(next).match};
   });
  }
  function pending(){return exclusive(async()=>{
   try{
    const state=await readReceipt(),local=storage.getItem(JOURNAL_KEY),journal=state.value?.pendingJournal??local;if(journal===null)return {status:'empty',journal:null};
    if(state.value?.pendingJournal&&local!==null&&local!==journal)fail('CONFLICT','Локальный журнал отличается от транзакционного подтверждения.');
    const value=await readJournal(journal);
    if(state.value&&!state.value.pendingJournal&&state.value.committedRaw!==value.before)fail('CONFLICT','Журнал относится к другой подтверждённой версии.');
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
   if(before&&validateTransition&&validateTransition(before.match,after.match)!==true)fail('RESULT_CONFLICT','Журнал изменяет подтверждённые профили или статистику.');
   if(value.version===1){if(before&&before.match.teamFormat.id!==after.match.teamFormat.id)fail('CORRUPT','Изменена партия в обычном журнале.');}
   else if(!before||value.replaceMatchId!==before.match.teamFormat.id||before.match.teamFormat.id===after.match.teamFormat.id||validateReplacement?.(before.match,after.match)!==true)fail('CORRUPT','Журнал не сохраняет предыдущую партию.');
   return value;
  }
  function recover({expectedJournal,choice}={}){return exclusive(async()=>{
   if(typeof expectedJournal!=='string'||!['keep-before','keep-after'].includes(choice))fail('RECOVERY_CHOICE','Требуется явный выбор восстановления.');
   const state=await readReceipt(),local=storage.getItem(JOURNAL_KEY);
   if(state.value?.pendingJournal?state.value.pendingJournal!==expectedJournal||local!==null&&local!==expectedJournal:local!==expectedJournal)fail('CONFLICT','Журнал изменился.');
   const journal=await readJournal(expectedJournal),raw=storage.getItem(KEY);
   if(state.value&&!state.value.pendingJournal&&state.value.committedRaw!==journal.before)fail('CONFLICT','Подтверждение относится к другой записи.');
   if(![journal.before,journal.after].includes(raw))fail('CONFLICT','Сторонняя запись сохранена без изменений.');
   const target=choice==='keep-before'?journal.before:journal.after;
   if(storage.getItem(JOURNAL_KEY)!==local||storage.getItem(KEY)!==raw)fail('CONFLICT','Сохранение изменилось при проверке.');
   const pendingReceipt=receipt?(state.value?.pendingJournal?state.raw:await writeReceipt(state.raw,journal.before,expectedJournal)):null;
   if(raw!==target){if(target===null)storage.removeItem(KEY);else storage.setItem(KEY,target);}
   if(storage.getItem(KEY)!==target||storage.getItem(JOURNAL_KEY)!==local)fail('WRITE_PENDING','Восстановление не подтверждено.');
   if(local!==null)storage.removeItem(JOURNAL_KEY);
   if(storage.getItem(JOURNAL_KEY)!==null||storage.getItem(KEY)!==target)fail('WRITE_PENDING','Восстановление не завершено.');
   if(receipt)await writeReceipt(pendingReceipt,target);
   return target===null?{status:'empty',raw:null,revision:0,match:null}:{status:'ok',raw:target,...(({revision,match})=>({revision,match}))(await decode(target))};
  });}
  const inspect=()=>exclusive(async()=>({receipt:receipt?await receipt.read():null}));
  return Object.freeze({load,commit,pending,recover,inspect});
 }
 return Object.freeze({KEY,JOURNAL_KEY,LOCK,VERSION,KIND,MAX_BYTES,RECEIPT_DB,create});
});
