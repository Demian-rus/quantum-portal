'use strict';
// Existing navigation behavior extracted intact; no storage or gameplay migration.
function hasUnfinishedGame() {
  return Boolean(game && !['results','home'].includes(game.phase));
}
function updateContinue() {
  const button=$('continue-game');
  if(!button)return;
  const possible=hasUnfinishedGame();
  button.disabled=!possible;
  button.setAttribute('aria-disabled',String(!possible));
}
function setScene(which) {
  activeScene=which;
  for(const scene of ['home','other-games','preferences','statistics','game-type','themes','setup','advanced','game','results'])
    $('scene-'+scene).hidden=scene!==which;
  document.body.dataset.screen=which;
  updateContinue();
}
// A single browser-history guard converts Android Back into app navigation.
// No per-round history entries: exiting a round must never replay old answers.
const KVIP_BACK_GUARD='__kvipBackGuard';
let backGuardArmed=false;
let lastHomeBackAt=0;
function armBrowserBackGuard(){
  if(!window.history?.pushState||!window.location?.href)return;
  try{
    window.history.pushState({[KVIP_BACK_GUARD]:true},'',window.location.href);
    backGuardArmed=true;
  }catch{backGuardArmed=false;}
}
function backWithinKvip(){
  if(!$('result-history-backdrop').hidden){closeResultHistory(false);return;}
  if(!$('backup-backdrop').hidden){closeBackupPanel();return;}
  if(!$('report-backdrop').hidden){closeReportPanel();return;}
  if(!$('profile-backdrop').hidden){backProfilePanel();return;}
  if(!$('mode-options-backdrop').hidden){closeModeSettings();return;}
  if(!$('rules-backdrop').hidden){closeRules();return;}
  switch(activeScene){
    case 'advanced':closeAdvanced();return;
    case 'setup':setupReturn==='themes'?openThemes():openGameType();return;
    case 'themes':openGameType();return;
    case 'statistics':case 'game-type':case 'preferences':case 'other-games':setScene('home');return;
    case 'game':case 'results':backToMenu();return;
  }
}
function onBrowserBack(){
  if(!backGuardArmed)return;
  backGuardArmed=false;
  if(activeScene==='home'&&$('backup-backdrop').hidden&&$('report-backdrop').hidden&&$('profile-backdrop').hidden&&$('rules-backdrop').hidden&&$('mode-options-backdrop').hidden){
    const now=Date.now();
    if(lastHomeBackAt&&now-lastHomeBackAt<2000){
      lastHomeBackAt=0;
      // Explicit second Back at home may exit to the calling browser/app.
      window.history?.back?.();
      return;
    }
    lastHomeBackAt=now;
    toast('Нажмите «Назад» ещё раз, чтобы выйти');
  }else{
    lastHomeBackAt=0;
    backWithinKvip();
  }
  armBrowserBackGuard();
}
function installBrowserBackNavigation(){
  if(!window.addEventListener||!window.history?.pushState)return;
  window.addEventListener('popstate',onBrowserBack);
  armBrowserBackGuard();
}
function openPreferences() {
  setSoundIcon();
  renderBackupPreferences();
  renderReportsCount();
  setScene('preferences');
}
// Counts come from the installed versioned catalogs, independent of user saves.
// This preview cache never authorizes START; the game performs full validation.
let gameTypeCountCache=null;
function contentCountLabel(n){return n.toLocaleString('ru-RU')+' заданий';}
function contentPackCount(pack){return new Set(pack.criteria.cardIds).size;}
function gameTypeCountSnapshot(){
 const key=JSON.stringify(options);
 if(!gameTypeCountCache||gameTypeCountCache.cards!==PARTY_CARDS||gameTypeCountCache.questions!==QUIP_APPROX_QUESTIONS||gameTypeCountCache.packs!==QUIP_CONTENT_PACKS)
  gameTypeCountCache={cards:PARTY_CARDS,questions:QUIP_APPROX_QUESTIONS,packs:QUIP_CONTENT_PACKS,entries:new Map()};
 const cache=gameTypeCountCache.entries;
 if(!cache.has(key)){
  const general=getContentPack(latestGeneralPackSelection()),themes=listThematicPacks(options);
  const active=themes.filter(entry=>entry.available&&entry.pack.enabled);
  const snapshot={general:contentPackCount(general),thematic:active.reduce((sum,entry)=>sum+contentPackCount(entry.pack),0),themes};
  if(cache.size>=8)cache.delete(cache.keys().next().value);
  cache.set(key,snapshot);
 }
 return cache.get(key);
}
function renderGameTypeCounts(){
 try{const counts=gameTypeCountSnapshot();
  $('standard-content-count').textContent=contentCountLabel(counts.general);
  $('thematic-content-count').textContent=contentCountLabel(counts.thematic);
 }catch{
  $('standard-content-count').textContent='Количество недоступно';
  $('thematic-content-count').textContent='Количество недоступно';
 }
}
function openGameType(){renderGameTypeCounts();setScene('game-type');}
function rememberPackSettings(){
 const selection=options.contentPack,key=selection.id+'@'+selection.version;
 options.packPreferences={...(options.packPreferences||{}),[key]:{modes:options.modes.slice(),promptTypes:options.promptTypes.slice()}};
}
function changeSetupPack(selection,from){
 const next=packSetupSettings(selection,options);
 rememberPackSettings();options={...options,...next,packPreferences:options.packPreferences};
 persist();openSetup(from);
}
function selectStandardGame(){changeSetupPack(latestGeneralPackSelection(),'game-type');}
function renderThemes(){
 const entries=gameTypeCountSnapshot().themes;
 $('theme-list').innerHTML=entries.map(({pack,available})=>
  '<button type="button" class="theme-choice" data-theme="'+pack.id+'" data-version="'+pack.version+'"'+
  (available?'':' disabled aria-disabled="true"')+'><strong>'+escapeHTML(pack.name)+'</strong><span>'+
  (available?contentPackCount(pack).toLocaleString('ru-RU'):'Скоро')+'</span></button>').join('');
 $('themes-caption').textContent=entries.some(entry=>entry.available)?
  'Выберите тему, затем настройте партию.':'Тематические наборы ещё готовятся. Пока можно сыграть в стандартную игру.';
}
function openThemes(){renderThemes();setScene('themes');$('themes-scroll').scrollTop=0;}
function selectTheme(id,version){
 const selection={id,version};
 try{
  const pack=getContentPack(selection);
  const setup=packSetupSettings(selection,options);
  if(pack.id==='general'||!pack.enabled||(setup.modes.length&&!checkContentPack(selection,setup).available)){toast('Эта тема пока недоступна.');return false;}
 }catch{toast('Эта тема пока недоступна.');return false;}
 changeSetupPack(selection,'themes');return true;
}
function openSetup(from='game-type') {
  setupReturn=from;
  // Opening setup keeps any unfinished session untouched until the user starts a new one.
  renderOptions();
  setScene('setup');
  $('setup-scroll').scrollTop=0;
}
function openAdvanced(from='setup') {
  advancedReturn=from;
  $('mode-settings').open=false;
  $('content-settings').open=false;
  renderOptions();
  setScene('advanced');
  $('advanced-scroll').scrollTop=0;
}
function closeAdvanced() {
  renderOptions();
  setScene(advancedReturn);
}
