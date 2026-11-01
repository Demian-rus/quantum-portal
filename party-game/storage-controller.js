'use strict';
// Storage I/O and save protection; shared state is initialized in app.js.

function storageNotice(){
  if(storageProblem==='corrupt')return 'Сохранение повреждено и защищено. Для безопасного сброса начните новую партию.';
  if(storageProblem==='unavailable')return 'Не удалось прочитать сохранение. Запись заблокирована.';
  return 'Сохранение несовместимо с этой версией игры. Данные сохранены.';
}
function blockSavedData(reason){storageBlocked=true;storageProblem=reason;return null;}
// A saved game's options are pinned until another match actually starts.
// Keep the live match's RAW options stable; future Wizard choices use a distinct,
// match-scoped, versioned preference record. Neither key rewrites the other.
const FUTURE_OPTIONS_KEY='iskra-party:future-options:v1';
let persistedMatchId=null,persistedMatchOptions=null;
function readSaved() {
  try { loadedSaveRaw=localStorage.getItem(STORAGE_KEY); }
  catch { return blockSavedData('unavailable'); }
  if(loadedSaveRaw===null)return null;
  let obj;
  try { obj=JSON.parse(loadedSaveRaw); }
  catch { return blockSavedData('corrupt'); }
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return blockSavedData('corrupt');
  if(obj.version!==1)return blockSavedData('incompatible');
  persistedMatchId=obj.game?.matchId??null;
  persistedMatchOptions=obj.game?obj.options:null;
  // An unfinished match must restore its historical options and its future
  // menu preferences independently. Old saves need no migration or RAW write.
  if(obj.game?.matchId!=null){
    let futureRaw;
    try { futureRaw=localStorage.getItem(FUTURE_OPTIONS_KEY); }
    catch { return blockSavedData('unavailable'); }
    if(futureRaw!==null){
      let future;
      try { future=JSON.parse(futureRaw); }
      catch { return blockSavedData('corrupt'); }
      if(!future||typeof future!=='object'||Array.isArray(future)||future.version!==1||
        typeof future.matchId!=='string'||!future.options||typeof future.options!=='object'||Array.isArray(future.options))
        return blockSavedData('incompatible');
      if(future.matchId===obj.game.matchId)obj.options=future.options;
    }
  }
  return obj;
}
// Explicit recovery only for corrupt data, never for an unknown future version.
// A verified bounded backup is written before the original key can be replaced.
function recoverCorruptSave(){
  if(storageProblem!=='corrupt'||typeof loadedSaveRaw!=='string')return false;
  if(!window.confirm('Сохранение повреждено. Сохранить резервную копию на этом устройстве и начать заново? Предыдущая резервная копия, если есть, будет заменена.'))return false;
  try{
    if(localStorage.getItem(STORAGE_KEY)!==loadedSaveRaw)throw Error('Save changed');
    const backup=JSON.stringify({version:1,createdAt:Date.now(),raw:loadedSaveRaw});
    localStorage.setItem(RECOVERY_KEY,backup);
    if(localStorage.getItem(RECOVERY_KEY)!==backup||localStorage.getItem(STORAGE_KEY)!==loadedSaveRaw)throw Error('Backup unavailable or save changed');
    const reset=JSON.stringify({version:1,options,soundOn,game:null,...(taskMemory?{taskMemory}:{})});
    localStorage.setItem(STORAGE_KEY,reset);
    if(localStorage.getItem(STORAGE_KEY)!==reset)throw Error('Recovery not persisted');
    storageBlocked=false;storageProblem=null;loadedSaveRaw=reset;return true;
  }catch{toast('Сброс не выполнен. Исходные данные защищены; попробуйте перезагрузить страницу.');return false;}
}
function persist() {
  if(storageBlocked)return false;
  try {
    // Wizard previews of new catalogs may change in-memory options but must
    // not rewrite saved options of the same unfinished match. A new START
    // creates a new matchId and adopts the new options; turns still persist.
    const sameMatch=game?.matchId!=null&&game.matchId===persistedMatchId;
    const savedOptions=sameMatch?persistedMatchOptions:options;
    // Write the independent future setup snapshot before the match state.
    // A failed preference write never authorizes a misleading successful save.
    if(sameMatch){
      const future=JSON.stringify({version:1,matchId:game.matchId,options});
      if(localStorage.getItem(FUTURE_OPTIONS_KEY)!==future){
        localStorage.setItem(FUTURE_OPTIONS_KEY,future);
        if(localStorage.getItem(FUTURE_OPTIONS_KEY)!==future)return false;
      }
    }
    const raw=JSON.stringify({version:1,options:savedOptions,soundOn,game,...(taskMemory?{taskMemory}:{})});
    localStorage.setItem(STORAGE_KEY,raw);
    if(localStorage.getItem(STORAGE_KEY)!==raw)return false;
    persistedMatchId=game?.matchId??null;
    persistedMatchOptions=game?(sameMatch?persistedMatchOptions:JSON.parse(JSON.stringify(savedOptions))):null;
    return true;
  }catch { return false; }
}
