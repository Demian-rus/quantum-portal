'use strict';
// File actions and dialogs only; all archive validation/transactions live in the core.
let backupView={token:0,busy:false,preview:null,text:null,focus:null,recoveryRaw:null,stage:'preview'};
function backupMessage(message){$('backup-status').textContent=message;}
function backupFileName(prefix='kvip-profiles'){
  const now=new Date(),date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  return prefix+'-'+date+'.json';
}
function downloadProfileBackup(text,name){
  const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function exportProfileBackup(recovery=false){
  const button=$(recovery?'backup-recovery-export':'backup-export');button.disabled=true;
  try{
    let store;
    if(recovery){
      const safety=inspectProfileBackupRecovery(localStorage);
      if(!safety)throw backupError('защитной копии нет.');
      backupView.recoveryRaw=safety.raw;store=safety.store;
    }else{
      store=readProfileStore();
      if(!store)throw backupError('профилей пока нет. Сначала создайте профиль.');
    }
    const text=await createProfileBackupText(store,Date.now(),{includeTeams:!recovery});
    // After asynchronous hashing the download uses the immutable checked snapshot.
    downloadProfileBackup(text,backupFileName(recovery?'kvip-profiles-previous':'kvip-profiles'));
    backupMessage(recovery?'Файл подготовлен. Это точная защитная копия прежних профилей и сохранённых в ней показателей.':'Файл подготовлен к сохранению. В нём профили и записанная статистика 1 НА 1 и 2 НА 2; текущие партии не входят.');
    if(recovery){$('backup-recovery-saved-label').hidden=false;$('backup-recovery-saved').checked=false;$('backup-recovery-clear').disabled=true;}
  }catch(error){backupMessage(error.message);}
  finally{button.disabled=false;}
}
function renderBackupPreferences(){
  $('backup-recovery-saved-label').hidden=true;$('backup-recovery-saved').checked=false;
  $('backup-recovery-clear').disabled=true;backupView.recoveryRaw=null;
  try{
    $('backup-recovery').hidden=localStorage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)===null;
    assertProfileBackupWritable();backupMessage('');
  }catch(error){backupMessage(error.message);}
}
function openBackupPanel(){
  backupView.focus=document.activeElement;$('backup-backdrop').hidden=false;
  document.querySelector('.site-shell').inert=true;$('backup-close').focus({preventScroll:true});
}
function closeBackupPanel(){
  if(backupView.busy)return;
  backupView.token++;backupView.text=null;backupView.preview=null;
  $('backup-backdrop').hidden=true;document.querySelector('.site-shell').inert=false;
  backupView.focus?.focus({preventScroll:true});backupView.focus=null;
}
function backupSummaryMarkup(summary){
  if(!summary)return '<p class="profile-muted">Профилей пока нет</p>';
  return '<p class="profile-muted">Профилей: '+summary.profiles.length+'</p><ul class="backup-profiles">'+summary.profiles.map(p=>
    '<li><strong>'+profileDot(p.color)+escapeHTML(p.name)+'</strong><span>Игр: '+p.games+' · Побед: '+p.wins+' · Поражений: '+p.losses+' · Ничьих: '+p.draws+(p.teamGames!=null?' · Игр 2 НА 2: '+p.teamGames:'')+'</span></li>').join('')+'</ul>';
}
function backupGameNotice(raw){
  if(storageBlocked)return 'Основное сохранение повреждено или недоступно. Восстановление профилей заблокировано; исходные данные сохранены.';
  try{backupCheckNoGame(raw);return '';}
  catch(error){
    if(game?.phase==='results')return 'На устройстве осталась завершённая партия. Откройте результаты и нажмите «В меню»: сначала игра проверит запись статистики. Затем выберите файл снова.';
    return error.message+' Завершите текущую партию и вернитесь в меню. Текущая партия в файл статистики не входит.';
  }
}
async function previewProfileBackup(file){
  if(!file||backupView.busy)return;
  const token=++backupView.token;backupView.stage='preview';backupView.preview=null;backupView.text=null;
  $('backup-title').textContent='ПРОВЕРКА ФАЙЛА';$('backup-preview').textContent='Проверяем резервную копию…';
  $('backup-panel-error').textContent='';$('backup-confirm-area').hidden=true;$('backup-apply').hidden=true;
  $('backup-open-results').hidden=true;openBackupPanel();
  try{
    assertProfileBackupWritable();
    if(file.size>QUIP_PROFILE_BACKUP_MAX_CHARS)throw backupError('слишком большой архив. Максимум — 4 МБ.');
    const expectedRaw=localStorage.getItem(QUIP_PROFILES_KEY),expectedGameRaw=localStorage.getItem(QUIP_PROFILE_BACKUP_GAME_KEY);
    const text=await file.text(),preview=await inspectProfileBackupText(text,expectedRaw);
    validateTeamProfileImport(JSON.parse(preview.sourceRaw));
    if(token!==backupView.token)return;
    backupView={...backupView,text,preview,expectedRaw,expectedGameRaw};
    $('backup-title').textContent='АРХИВ НАЙДЕН';
    const relations={empty:'Можно восстановить профили на этом устройстве.',identical:'Этот архив уже находится на устройстве. Изменения не нужны.',
      'different-store':'Это архив другого устройства. Результаты не объединяются.',older:'В файле более старый счётчик результатов. Замена может удалить новые результаты.',
      newer:'В файле более новый счётчик результатов. Общая история двух устройств не гарантирована.',diverged:'Истории различаются при одинаковом счётчике. Результаты не объединяются.'};
    $('backup-preview').innerHTML='<p class="profile-muted">Создан: '+escapeHTML(new Date(preview.exportedAt).toLocaleString('ru-RU'))+'</p><p>'+relations[preview.relationship]+'</p>'+
      '<h3>В ФАЙЛЕ</h3>'+backupSummaryMarkup(preview.summary)+(preview.current?'<h3>НА ЭТОМ УСТРОЙСТВЕ</h3>'+backupSummaryMarkup(preview.current):'');
    if(preview.relationship==='identical')return;
    const notice=backupGameNotice(expectedGameRaw);
    if(notice){$('backup-panel-error').textContent=notice;$('backup-open-results').hidden=game?.phase!=='results';return;}
    $('backup-apply').hidden=false;$('backup-apply').textContent=preview.current?'ПРОДОЛЖИТЬ':'ВОССТАНОВИТЬ ПРОФИЛИ';
  }catch(error){if(token===backupView.token){$('backup-title').textContent='ФАЙЛ НЕ ПРИНЯТ';$('backup-preview').textContent='Статистика на устройстве не изменена.';$('backup-panel-error').textContent=error.message;}}
}
async function applyProfileBackup(){
  if(backupView.busy||!backupView.preview)return;
  if(backupView.preview.current&&backupView.stage!=='confirm'){
    backupView.stage='confirm';$('backup-confirm-area').hidden=false;
    $('backup-confirm-check').checked=false;$('backup-apply').disabled=true;$('backup-apply').textContent='ЗАМЕНИТЬ СТАТИСТИКУ';
    $('backup-confirm-area').scrollIntoView({block:'nearest'});$('backup-confirm-check').focus({preventScroll:true});return;
  }
  if(backupView.preview.current&&!$('backup-confirm-check').checked)return;
  backupView.busy=true;$('backup-apply').disabled=true;$('backup-close').disabled=true;$('backup-cancel').disabled=true;
  try{
    const result=await restoreProfileBackupText(localStorage,backupView.text,{
      allowReplace:!!backupView.preview.current,expectedRaw:backupView.expectedRaw,expectedGameRaw:backupView.expectedGameRaw
    });
    restoreProfiles();
    if(profileStoreProblem)throw backupError('файл записан, но профили не удалось открыть. Перезапустите приложение; повторная замена не требуется.');
    statisticsProfileId=null;renderOptions();
    $('backup-title').textContent=result.status==='unchanged'?'ИЗМЕНЕНИЯ НЕ НУЖНЫ':'ПРОФИЛИ ВОССТАНОВЛЕНЫ';
    $('backup-preview').textContent='Профили и статистика готовы. Новая партия будет использовать сохранённые ID и защиту от повторного начисления.';
    $('backup-confirm-area').hidden=true;$('backup-apply').hidden=true;$('backup-panel-error').textContent='';
    backupView.preview=null;backupView.text=null;renderBackupPreferences();
  }catch(error){
    $('backup-panel-error').textContent=error.message;$('backup-apply').hidden=true;$('backup-confirm-area').hidden=true;
    backupView.preview=null;backupView.text=null;
    try{assertProfileBackupWritable();}catch{restoreProfiles();renderOptions();}
    // Recovery controls remain reachable after closing the error dialog.
    try{$('backup-recovery').hidden=localStorage.getItem(QUIP_PROFILE_BACKUP_RECOVERY_KEY)===null;}catch{}
  }finally{backupView.busy=false;$('backup-apply').disabled=false;$('backup-close').disabled=false;$('backup-cancel').disabled=false;}
}
function backupPanelKeydown(event){
  if($('backup-backdrop').hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeBackupPanel();return;}
  if(event.key==='Tab'){
    const items=[...$('backup-backdrop').querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el=>!el.closest('[hidden]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
}
function registerProfileBackupControls(){
  $('backup-export').addEventListener('click',()=>exportProfileBackup());
  $('backup-import').addEventListener('click',()=>{if(!backupView.busy){$('backup-file').value='';$('backup-file').click();}});
  $('backup-file').addEventListener('change',event=>{const file=event.target.files[0];$('backup-apply').disabled=false;previewProfileBackup(file);});
  $('backup-close').addEventListener('click',closeBackupPanel);$('backup-cancel').addEventListener('click',closeBackupPanel);
  $('backup-backdrop').addEventListener('click',event=>{if(event.target.id==='backup-backdrop')closeBackupPanel();});
  $('backup-confirm-check').addEventListener('change',()=>{$('backup-apply').disabled=!$('backup-confirm-check').checked;});
  $('backup-apply').addEventListener('click',applyProfileBackup);
  $('backup-open-results').addEventListener('click',()=>{closeBackupPanel();if(game?.phase==='results')render();});
  $('backup-recovery-export').addEventListener('click',()=>exportProfileBackup(true));
  $('backup-recovery-saved').addEventListener('change',()=>{$('backup-recovery-clear').disabled=!$('backup-recovery-saved').checked;});
  $('backup-recovery-clear').addEventListener('click',()=>{
    if(!$('backup-recovery-saved').checked||!backupView.recoveryRaw)return;
    if(!window.confirm('Удалить защитную копию предыдущего импорта с устройства? Убедитесь, что сохранили скачанный файл. Текущая статистика останется.'))return;
    try{clearProfileBackupRecovery(localStorage,backupView.recoveryRaw);renderBackupPreferences();backupMessage('Защитная копия удалена с устройства по вашему запросу.');}
    catch(error){backupMessage(error.message);}
  });
  document.addEventListener('keydown',backupPanelKeydown);
}
