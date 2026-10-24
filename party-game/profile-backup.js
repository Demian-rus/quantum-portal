'use strict';
// TASK 016 foundation. Not loaded by index.html until the backup UI is reviewed.
// No gameplay state, RNG, or storage is touched during export / inspection.
const QUIP_PROFILE_BACKUP_KIND='kvip-profile-backup';
const QUIP_PROFILE_BACKUP_VERSION=1;
const QUIP_PROFILE_BACKUP_MAX_CHARS=4*1024*1024;
const QUIP_PROFILE_BACKUP_RECOVERY_KEY='kvip-player-profiles:import-recovery:v1';
const QUIP_PROFILE_BACKUP_GAME_KEY='iskra-party:v1';

function backupError(message){return Error('Резервная копия: '+message);}
function backupPlainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function backupCanonicalStore(value){
  if(!backupPlainObject(value))throw backupError('отсутствуют данные профилей.');
  // Round-trip makes the checksum and restored bytes independent of callers'
  // object identity. Production's profile validator is the schema authority.
  const snapshot=JSON.parse(JSON.stringify(value));
  validateProfileStore(snapshot);
  return JSON.stringify(snapshot);
}
function backupCrypto(){
  if(!globalThis.crypto?.subtle||typeof TextEncoder!=='function')
    throw backupError('недоступна SHA-256 проверка. Откройте установленную HTTPS-версию приложения.');
}
async function backupDigest(data){
  backupCrypto();
  const bytes=new TextEncoder().encode(data);
  if(bytes.length>QUIP_PROFILE_BACKUP_MAX_CHARS)throw backupError('слишком большой архив.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
function backupPayloadSummary(store){
  return {
    storeId:store.storeId,
    nextSequence:store.nextSequence,
    settledThrough:store.settledThrough,
    profiles:store.profiles.map(p=>({
      id:p.id,name:p.name,color:p.color,
      games:store.totals[p.id].matches,
      wins:store.totals[p.id].wins,
      losses:store.totals[p.id].losses,
      draws:store.totals[p.id].draws
    }))
  };
}
async function createProfileBackupText(store,exportedAt=Date.now()){
  if(!Number.isSafeInteger(exportedAt)||exportedAt<0)throw backupError('некорректная дата экспорта.');
  const raw=backupCanonicalStore(store);
  const sha256=await backupDigest(raw);
  return JSON.stringify({
    kind:QUIP_PROFILE_BACKUP_KIND,
    version:QUIP_PROFILE_BACKUP_VERSION,
    exportedAt,sha256,
    payload:JSON.parse(raw)
  },null,2);
}
function backupRelationship(archive,current){
  if(!current)return 'empty';
  if(JSON.stringify(archive)===JSON.stringify(current))return 'identical';
  if(archive.storeId!==current.storeId)return 'different-store';
  if(archive.settledThrough<current.settledThrough)return 'older';
  if(archive.settledThrough>current.settledThrough)return 'newer';
  return 'diverged';
}
async function inspectProfileBackupText(text,currentRaw=null){
  if(typeof text!=='string'||!text||text.length>QUIP_PROFILE_BACKUP_MAX_CHARS)
    throw backupError('файл пустой или слишком большой.');
  let doc;
  try{doc=JSON.parse(text);}
  catch{throw backupError('файл не является корректным JSON.');}
  if(!backupPlainObject(doc)||Object.keys(doc).sort().join('|')!==
     'exportedAt|kind|payload|sha256|version'||
     doc.kind!==QUIP_PROFILE_BACKUP_KIND||
     doc.version!==QUIP_PROFILE_BACKUP_VERSION||
     !Number.isSafeInteger(doc.exportedAt)||doc.exportedAt<0||
     typeof doc.sha256!=='string'||!/^[0-9a-f]{64}$/.test(doc.sha256))
    throw backupError('неизвестный формат или версия.');
  let sourceRaw;
  try{sourceRaw=backupCanonicalStore(doc.payload);}
  catch{throw backupError('данные профилей повреждены или несовместимы.');}
  if(await backupDigest(sourceRaw)!==doc.sha256)throw backupError('контрольная сумма не совпадает.');
  let current=null;
  if(currentRaw!==null){
    if(typeof currentRaw!=='string')throw backupError('неизвестный формат действующего архива.');
    try{current=JSON.parse(currentRaw);validateProfileStore(current);}
    catch{throw backupError('действующий архив повреждён — замена запрещена.');}
  }
  return {
    exportedAt:doc.exportedAt,
    sha256:doc.sha256,
    sourceRaw,
    relationship:backupRelationship(doc.payload,current),
    summary:backupPayloadSummary(doc.payload),
    current:current?backupPayloadSummary(current):null
  };
}
function backupCheckNoGame(raw){
  if(raw===null)return;
  let saved;
  try{saved=JSON.parse(raw);}
  catch{throw backupError('основное сохранение повреждено; импорт запрещён.');}
  if(!backupPlainObject(saved)||saved.version!==1||!Object.hasOwn(saved,'game'))
    throw backupError('неизвестный формат основного сохранения.');
  if(saved.game!==null)
    throw backupError('на устройстве есть партия или её результаты; импорт запрещён.');
}
// This routine is invoked ONLY after separate human UI confirmation. The caller
// must not expose allowReplace without an explicit replacement decision.
// A full replacement is deliberate; two archives are NEVER merged.
async function restoreProfileBackupText(storage,text,{allowReplace=false}={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||
     typeof storage.removeItem!=='function')throw backupError('нет доступного локального хранилища.');
  const originalGameRaw=storage.getItem(QUIP_PROFILE_BACKUP_GAME_KEY);
  backupCheckNoGame(originalGameRaw);
  const originalRaw=storage.getItem(QUIP_PROFILES_KEY);
  const preview=await inspectProfileBackupText(text,originalRaw);
  if(preview.relationship==='identical')return {status:'unchanged',relationship:'identical'};
  if(originalRaw!==null&&!allowReplace)
    throw backupError('на устройстве уже есть профили; автоматическое объединение запрещено.');
  if(originalRaw!==null&&storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)!==null)
    throw backupError('уже существует защитная копия предыдущего импорта. Сначала сохраните её отдельно.');
  let recovery=null;
  if(originalRaw!==null){
    recovery=JSON.stringify({version:1,createdAt:Date.now(),raw:originalRaw});
    storage.setItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY,recovery);
    if(storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)!==recovery)
      throw backupError('не удалось подтвердить защитную копию прежних профилей.');
  }
  // Recheck both keys to catch changes between preflight and commit.
  if(storage.getItem(QUIP_PROFILES_KEY)!==originalRaw||
     storage.getItem(QUIP_PROFILE_BACKUP_GAME_KEY)!==originalGameRaw)
    throw backupError('данные изменились во время импорта; повторите проверку файла.');
  try{
    storage.setItem(QUIP_PROFILES_KEY,preview.sourceRaw);
    if(storage.getItem(QUIP_PROFILES_KEY)!==preview.sourceRaw)
      throw backupError('не удалось подтвердить импорт.');
  }catch(error){
    try{
      if(originalRaw===null)storage.removeItem(QUIP_PROFILES_KEY);
      else storage.setItem(QUIP_PROFILES_KEY,originalRaw);
      if(storage.getItem(QUIP_PROFILES_KEY)!==originalRaw)
        throw Error('rollback verification failed');
    }catch{
      throw backupError('не удалось подтвердить откат. Прекратите запись и сохраните данные для восстановления.');
    }
    throw backupError('импорт не выполнен, прежний архив сохранён.');
  }
  // The UI must refresh its in-memory store (restoreProfiles) only after success.
  return {status:'restored',relationship:preview.relationship,
    recoveredPrevious:originalRaw!==null};
}
