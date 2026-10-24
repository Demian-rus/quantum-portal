'use strict';
// Local profile archives: read-only inspection, explicit replacement, verified rollback.
// No gameplay state, RNG, or storage is touched during export / inspection.
const QUIP_PROFILE_BACKUP_KIND='kvip-profile-backup';
const QUIP_PROFILE_BACKUP_VERSION=1;
const QUIP_PROFILE_BACKUP_MAX_CHARS=4*1024*1024;
const QUIP_PROFILE_BACKUP_RECOVERY_KEY='kvip-player-profiles:import-recovery:v1';
const QUIP_PROFILE_BACKUP_GAME_KEY='iskra-party:v1';
const QUIP_PROFILE_BACKUP_PENDING_KEY='kvip-player-profiles:import-pending:v1';
let profileBackupRestoring=false,profileBackupUncertain=false;
function assertProfileBackupWritable(storage=localStorage){
  if(profileBackupRestoring||profileBackupUncertain||storage.getItem(QUIP_PROFILE_BACKUP_PENDING_KEY)!==null)
    throw backupError('запись профилей заблокирована: предыдущий импорт не подтверждён. Сохраните защитную копию; требуется проверка восстановления.');
}

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
  const text=JSON.stringify({
    kind:QUIP_PROFILE_BACKUP_KIND,
    version:QUIP_PROFILE_BACKUP_VERSION,
    exportedAt,sha256,
    payload:JSON.parse(raw)
  },null,2);
  if(new TextEncoder().encode(text).length>QUIP_PROFILE_BACKUP_MAX_CHARS)throw backupError('слишком большой архив.');
  return text;
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
  if(new TextEncoder().encode(text).length>QUIP_PROFILE_BACKUP_MAX_CHARS)throw backupError('слишком большой архив.');
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
  try{
    if(saved.taskMemory!=null&&typeof validateTaskMemory==='function')validateTaskMemory(saved.taskMemory);
    if(typeof modeCompatibilityPolicy==='function')modeCompatibilityPolicy(saved.options);
    if(typeof sanitizeOptions==='function')sanitizeOptions(saved.options);
  }catch{throw backupError('основное сохранение повреждено или несовместимо; импорт запрещён.');}
}
// The UI binds confirmation to the exact RAWs displayed in its preview.
// All mutations after the asynchronous checksum check are synchronous.
async function restoreProfileBackupText(storage,text,options={}){
  const {allowReplace=false}=options;
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||
     typeof storage.removeItem!=='function')throw backupError('нет доступного локального хранилища.');
  assertProfileBackupWritable(storage);
  profileBackupRestoring=true;
  try{
    const originalGameRaw=storage.getItem(QUIP_PROFILE_BACKUP_GAME_KEY);
    backupCheckNoGame(originalGameRaw);
    const originalRaw=storage.getItem(QUIP_PROFILES_KEY);
    if(Object.hasOwn(options,'expectedRaw')&&options.expectedRaw!==originalRaw||
       Object.hasOwn(options,'expectedGameRaw')&&options.expectedGameRaw!==originalGameRaw)
      throw backupError('данные изменились после предпросмотра; выберите файл повторно.');
    const preview=await inspectProfileBackupText(text,originalRaw);
    const checkOriginal=()=>{
      if(storage.getItem(QUIP_PROFILES_KEY)!==originalRaw||
         storage.getItem(QUIP_PROFILE_BACKUP_GAME_KEY)!==originalGameRaw)
        throw backupError('данные изменились во время импорта; повторите проверку файла.');
    };
    checkOriginal();
    if(storage.getItem(QUIP_PROFILE_BACKUP_PENDING_KEY)!==null)
      throw backupError('другая операция восстановления не подтверждена.');
    if(preview.relationship==='identical')return {status:'unchanged',relationship:'identical'};
    if(originalRaw!==null&&!allowReplace)
      throw backupError('на устройстве уже есть профили; автоматическое объединение запрещено.');
    if(originalRaw!==null){
      const previous=storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY);
      if(previous!==null){
        // A failed attempt with a verified rollback can reuse its exact safety
        // snapshot, but can never overwrite a recovery from a different state.
        let same=false;
        try{const doc=JSON.parse(previous);same=doc.version===1&&doc.raw===originalRaw&&Number.isSafeInteger(doc.createdAt);}catch{}
        if(!same)throw backupError('уже существует защитная копия предыдущего импорта. Сначала сохраните её отдельно в настройках.');
      }else{
        const recovery=JSON.stringify({version:1,createdAt:Date.now(),raw:originalRaw});
        try{
          storage.setItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY,recovery);
          if(storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)!==recovery)throw Error('recovery readback');
        }catch{throw backupError('не удалось сохранить и подтвердить защитную копию прежних профилей. Освободите память и повторите попытку.');}
      }
    }
    checkOriginal();
    // Durable bounded marker prevents all profile writers after a crash or an
    // unverifiable rollback. It contains no unbounded history or extra archive.
    const marker=JSON.stringify({version:1,createdAt:Date.now(),sha256:preview.sha256});
    try{
      storage.setItem(QUIP_PROFILE_BACKUP_PENDING_KEY,marker);
      if(storage.getItem(QUIP_PROFILE_BACKUP_PENDING_KEY)!==marker)throw Error('marker readback');
    }catch{
      let absent=false;
      try{absent=storage.getItem(QUIP_PROFILE_BACKUP_PENDING_KEY)===null;}catch{}
      if(absent)throw backupError('не удалось подготовить импорт. Прежний архив сохранён; освободите память и повторите попытку.');
      profileBackupUncertain=true;
      throw backupError('не удалось подтвердить подготовку импорта. Запись профилей заблокирована; сохраните защитную копию.');
    }
    let attempted=false;
    try{
      checkOriginal();
      attempted=true;
      storage.setItem(QUIP_PROFILES_KEY,preview.sourceRaw);
      if(storage.getItem(QUIP_PROFILES_KEY)!==preview.sourceRaw)throw Error('import readback');
    }catch{
      if(!attempted){backupFinishTransaction(storage);throw backupError('данные изменились во время импорта; повторите проверку файла.');}
      try{
        // A failed write may have left the original untouched (e.g. quota).
        if(storage.getItem(QUIP_PROFILES_KEY)!==originalRaw){
          if(originalRaw===null)storage.removeItem(QUIP_PROFILES_KEY);
          else storage.setItem(QUIP_PROFILES_KEY,originalRaw);
        }
        if(storage.getItem(QUIP_PROFILES_KEY)!==originalRaw)throw Error('rollback readback');
      }catch{
        profileBackupUncertain=true;
        throw backupError('не удалось подтвердить откат. Запись профилей заблокирована; сохраните защитную копию для восстановления.');
      }
      backupFinishTransaction(storage);
      throw backupError('импорт не выполнен, прежний архив сохранён. Можно повторить попытку.');
    }
    backupFinishTransaction(storage);
    return {status:'restored',relationship:preview.relationship,recoveredPrevious:originalRaw!==null};
  }finally{profileBackupRestoring=false;}
}
function backupFinishTransaction(storage){
  try{
    storage.removeItem(QUIP_PROFILE_BACKUP_PENDING_KEY);
    if(storage.getItem(QUIP_PROFILE_BACKUP_PENDING_KEY)!==null)throw Error('pending marker remains');
  }catch{
    profileBackupUncertain=true;
    throw backupError('не удалось подтвердить завершение импорта. Запись профилей заблокирована; сохраните защитную копию.');
  }
}
function inspectProfileBackupRecovery(storage){
  const raw=storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY);
  if(raw===null)return null;
  try{
    const doc=JSON.parse(raw);
    if(doc.version!==1||!Number.isSafeInteger(doc.createdAt)||doc.createdAt<0||typeof doc.raw!=='string')throw Error('invalid recovery');
    const store=JSON.parse(doc.raw);validateProfileStore(store);
    return {raw,store,createdAt:doc.createdAt};
  }catch{throw backupError('защитная копия повреждена. Она сохранена на устройстве; автоматическое удаление запрещено.');}
}
// Called only after exporting the recovery AND a separate explicit user choice.
function clearProfileBackupRecovery(storage,expectedRaw){
  assertProfileBackupWritable(storage);
  if(typeof expectedRaw!=='string'||storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)!==expectedRaw)
    throw backupError('защитная копия изменилась; проверьте её повторно.');
  const current=storage.getItem(QUIP_PROFILES_KEY);
  if(current!==null)validateProfileStore(JSON.parse(current));
  inspectProfileBackupRecovery(storage);
  storage.removeItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY);
  if(storage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)!==null)throw backupError('не удалось освободить защитную копию.');
}
