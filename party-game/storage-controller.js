'use strict';
// Storage I/O and save protection; shared state is initialized in app.js.

function storageNotice(){
  if(storageProblem==='corrupt')return 'Сохранение повреждено и защищено. Для безопасного сброса начните новую партию.';
  if(storageProblem==='unavailable')return 'Не удалось прочитать сохранение. Запись заблокирована.';
  return 'Сохранение несовместимо с этой версией игры. Данные сохранены.';
}
function blockSavedData(reason){storageBlocked=true;storageProblem=reason;return null;}
function readSaved() {
  try { loadedSaveRaw=localStorage.getItem(STORAGE_KEY); }
  catch { return blockSavedData('unavailable'); }
  if(loadedSaveRaw===null)return null;
  let obj;
  try { obj=JSON.parse(loadedSaveRaw); }
  catch { return blockSavedData('corrupt'); }
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return blockSavedData('corrupt');
  if(obj.version!==1)return blockSavedData('incompatible');
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
  if(storageBlocked)return;
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,options,soundOn,game,...(taskMemory?{taskMemory}:{})})); }
  catch { /* Private browsing might block storage; a session still works. */ }
}
