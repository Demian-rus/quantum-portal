'use strict';
let profilePanelTarget=0,profilePanelMode='list',profilePanelColor='coral',profilePanelFocus=null,profileCreating=false;
function profileDot(color){return '<span class="profile-dot" style="--profile-color:'+QUIP_PROFILE_COLORS[color]+'" aria-hidden="true"></span>';}
function profileLabel(profile){return profile?profileDot(profile.color)+'<span>'+escapeHTML(profile.name)+'</span>':'<span>ВЫБРАТЬ ПРОФИЛЬ</span>';}
function renderProfileSelectors(){
  for(const [i,id] of ['team-a','team-b'].entries()){
    const profile=profileStore?.profiles.find(p=>p.id===selectedProfileIds[i]);
    $(id).innerHTML=profileLabel(profile)+'<span class="profile-chevron" aria-hidden="true">⌄</span>';
  }
  $('setup-profile-notice').textContent=profileStoreProblem||(selectedPlayerProfiles()?'':'Выберите два разных профиля, чтобы начать партию.');
}
function openProfilePanel(target){
  profilePanelTarget=target;profilePanelMode='list';profilePanelFocus=document.activeElement;
  try{readProfileStore();}catch{}
  $('profile-backdrop').hidden=false;document.querySelector('.site-shell').inert=true;
  renderProfilePanel();$('profile-panel-back').focus({preventScroll:true});
}
function closeProfilePanel(){
  $('profile-backdrop').hidden=true;document.querySelector('.site-shell').inert=false;
  profilePanelFocus?.focus({preventScroll:true});profilePanelFocus=null;
}
function backProfilePanel(){
  if(profilePanelMode==='create'){profilePanelMode='list';renderProfilePanel();$('profile-panel-back').focus({preventScroll:true});}
  else closeProfilePanel();
}
function renderProfilePanel(){
  const creating=profilePanelMode==='create';
  $('profile-panel-title').textContent=creating?'НОВЫЙ ПРОФИЛЬ':'ВЫБРАТЬ ПРОФИЛЬ';
  $('profile-create-form').hidden=!creating;$('profile-list-area').hidden=creating;
  $('profile-panel-error').textContent=profileStoreProblem||'';
  if(creating){
    $('profile-name').value='';profilePanelColor='coral';renderProfilePalette();$('profile-name').focus({preventScroll:true});return;
  }
  const profiles=profileStore?.profiles||[],teamTarget=typeof QuipTeams!=='undefined'&&QuipTeams.isProfileTarget(profilePanelTarget),selected=profilePanelTarget==='statistics'?statisticsProfileId:teamTarget?QuipTeams.selectedProfileId(profilePanelTarget):selectedProfileIds[profilePanelTarget];
  $('profile-list').innerHTML=profiles.map(profile=>{
    const unavailable=teamTarget?QuipTeams.profileUnavailable(profilePanelTarget,profile.id):profilePanelTarget!=='statistics'&&selectedProfileIds[1-profilePanelTarget]===profile.id;
    return '<button type="button" class="profile-choice" data-profile-id="'+profile.id+'" aria-pressed="'+(profile.id===selected)+'"'+
      (unavailable?' disabled':'')+'>'+profileLabel(profile)+(unavailable?'<small>Уже выбран</small>':profile.id===selected?'<span aria-hidden="true">✓</span>':'')+'</button>';
  }).join('');
  $('profile-empty').hidden=profiles.length>0||!!profileStoreProblem;
  $('profile-create-open').disabled=!!profileStoreProblem;
}
function renderProfilePalette(){
  $('profile-palette').innerHTML=Object.entries(QUIP_PROFILE_COLORS).map(([id,color])=>
    '<button type="button" class="profile-swatch" style="--profile-color:'+color+'" data-profile-color="'+id+'" aria-label="'+QUIP_PROFILE_COLOR_NAMES[id]+'" aria-pressed="'+(id===profilePanelColor)+'"><span aria-hidden="true">'+(id===profilePanelColor?'✓':'')+'</span></button>').join('');
}
function chooseProfile(id){
  if(!profileStore?.profiles.some(p=>p.id===id))return;
  if(profilePanelTarget==='statistics'){statisticsProfileId=id;renderStatistics();}
  else if(typeof QuipTeams!=='undefined'&&QuipTeams.isProfileTarget(profilePanelTarget)){if(!QuipTeams.chooseProfile(profilePanelTarget,id))return;}
  else{
    if(selectedProfileIds[1-profilePanelTarget]===id)return;
    selectedProfileIds[profilePanelTarget]=id;renderOptions();
  }
  closeProfilePanel();
}
function submitProfile(event){
  event.preventDefault();if(profileCreating)return;
  profileCreating=true;$('profile-create-save').disabled=true;
  try{const profile=createPlayerProfile($('profile-name').value,profilePanelColor);chooseProfile(profile.id);}
  catch(error){$('profile-panel-error').textContent=profileStoreProblem||error.message;}
  finally{profileCreating=false;$('profile-create-save').disabled=false;}
}
function openStatistics(){
  try{readProfileStore();}catch{}
  if(!profileStore?.profiles.some(p=>p.id===statisticsProfileId))statisticsProfileId=profileStore?.profiles[0]?.id||null;
  renderStatistics();setScene('statistics');$('statistics-scroll').scrollTop=0;
}
function renderStatistics(){
  const profile=profileStore?.profiles.find(p=>p.id===statisticsProfileId),total=profile?profileStore.totals[profile.id]:null;
  $('statistics-profile').innerHTML=profileLabel(profile)+'<span aria-hidden="true">⌄</span>';
  $('statistics-empty').hidden=!!profile;$('statistics-details').hidden=!profile;
  $('statistics-notice').textContent=profileStoreProblem||'Учитываются только завершённые партии. Данные сохраняются на этом устройстве.';
  if(!profile)return;
  renderTeamProfileStatistics(profile);
  const percent=(success,count)=>count?Math.round(success/count*100)+'%':'0%';
  const metrics=[['Заданий',total.turns],['Игр',total.matches],['Побед',total.wins],['Поражений',total.losses],['Ничьих',total.draws],['Побед',percent(total.wins,total.matches)],['Всего очков',total.points],['Тай-брейков',total.tiebreaks??0],['Побед в тай-брейке',total.tiebreakWins??0]];
  $('statistics-metrics').innerHTML=metrics.map(([title,value])=>'<div class="stat-metric"><b>'+value+'</b><span>'+title+'</span></div>').join('');
  $('statistics-modes').innerHTML=Object.entries(total.modes).map(([id,stats])=>'<div class="stat-mode"><strong>'+escapeHTML(getMode(id)?.title||id)+'</strong><span>'+'Заданий: '+stats.rounds+' · '+(id==='approx'?'Верно: ':'Отгадано: ')+stats.success+' · '+(id==='approx'?'Неверно: ':'Не отгадано: ')+(stats.rounds-stats.success)+'</span><b>'+ruPoints(stats.points)+'</b></div>').join('')||'<p class="profile-muted">Пока нет данных</p>';
}
function renderTeamProfileStatistics(profile){
  try{
    const total=QuipTeamStatistics.forProfile(profileTeamResults(),profileStore.storeId,profile.id);
    $('statistics-teams-notice').textContent='Только подтверждённые завершённые партии. Старые партии по именам не приписываются профилям.';
    const rows=[['Игр',total.matches],['Побед',total.wins],['Поражений',total.losses],['Ничьих',total.draws],['Загадывал',total.setter],['Отгадывал',total.guesser],['Совместных вопросов',total.shared],['Командных тай-брейков',total.tiebreaks]];
    $('statistics-teams-metrics').innerHTML=rows.map(([title,value])=>'<div class="stat-metric"><b>'+value+'</b><span>'+title+'</span></div>').join('');
    $('statistics-teams-modes').innerHTML=Object.entries(total.modes).map(([id,s])=>'<div class="stat-mode"><strong>'+escapeHTML(getMode(id)?.title||id)+'</strong><span>'+(id==='approx'?'Совместных вопросов: '+s.shared:'Загадывал: '+s.setter+' · Отгадывал: '+s.guesser+'<br>Командных успехов в этих ролях: '+s.setterSuccess+' / '+s.guesserSuccess)+'</span></div>').join('')||'<p class="profile-muted">Пока нет данных</p>';
    $('statistics-teams-recent').innerHTML=total.recent.slice().reverse().map(row=>'<p class="profile-muted">Команда '+row.team+' · командный счёт '+row.scores.join(' : ')+' · '+({wins:'Победа',losses:'Поражение',draws:'Ничья'})[row.outcome]+'</p>').join('')||'<p class="profile-muted">Пока нет завершённых партий</p>';
  }catch(error){
    $('statistics-teams-notice').textContent=error.message;
    for(const id of ['statistics-teams-metrics','statistics-teams-modes','statistics-teams-recent'])$(id).textContent='';
  }
}
function profilePanelKeydown(event){
  if($('profile-backdrop').hidden)return;
  if(event.key==='Escape'){event.preventDefault();backProfilePanel();return;}
  if(event.key==='Tab'){
    const items=[...$('profile-backdrop').querySelectorAll('button:not(:disabled),input')].filter(el=>!el.closest('[hidden]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
}
function registerProfileControls(){
  $('profile-backdrop').hidden=true;
  $('team-a').addEventListener('click',()=>openProfilePanel(0));$('team-b').addEventListener('click',()=>openProfilePanel(1));
  $('statistics-menu').addEventListener('click',openStatistics);
  $('statistics-back').addEventListener('click',()=>setScene('home'));
  $('statistics-profile').addEventListener('click',()=>openProfilePanel('statistics'));
  $('statistics-create').addEventListener('click',()=>{openProfilePanel('statistics');profilePanelMode='create';renderProfilePanel();});
  $('profile-panel-back').addEventListener('click',backProfilePanel);
  $('profile-close').addEventListener('click',closeProfilePanel);
  $('profile-backdrop').addEventListener('click',event=>{if(event.target.id==='profile-backdrop')closeProfilePanel();});
  $('profile-list').addEventListener('click',event=>{const button=event.target.closest('[data-profile-id]');if(button&&!button.disabled)chooseProfile(button.dataset.profileId);});
  $('profile-create-open').addEventListener('click',()=>{profilePanelMode='create';renderProfilePanel();});
  $('profile-palette').addEventListener('click',event=>{
    const button=event.target.closest('[data-profile-color]');if(button){profilePanelColor=button.dataset.profileColor;renderProfilePalette();$('profile-palette').querySelector('[data-profile-color="'+profilePanelColor+'"]').focus({preventScroll:true});}
  });
  $('profile-create-form').addEventListener('submit',submitProfile);
  document.addEventListener('keydown',profilePanelKeydown);
}
