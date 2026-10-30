'use strict';
// Team-only transaction and UI boundary. The legacy slot remains owned by the
// existing app; it is never used while the isolated team context is active.
(function installTeamsController(){
 if(typeof document.createElement!=='function')return;
 // A misplaced future/team payload in the old slot is never treated as a team
 // session. Preserve its RAW and require the existing protected-slot workflow.
 if(game&&(Object.hasOwn(game,'teamFormat')||Object.hasOwn(game,'teamPolicyVersion'))){game=null;blockSavedData('incompatible');updateContinue();}
 const E=QuipTeamsEngine;E.install();
 const old={persist,render,renderOptions,setScene,handleAction,backToMenu,backWithinKvip,commitReviewState,commitFeedbackClock,sfx,toast,renderMatch,showReady,showResults,reviewedRowDetailsMarkup,renderResultHistory,tick};
 const s={context:false,inSetup:false,busy:false,blocked:false,record:null,raw:null,status:'loading',duel:null,tx:null,profileIds:[null,null,null,null],idle:Promise.resolve(true),ready:Promise.resolve(true),store:null};
 const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const $q=selector=>document.querySelector(selector);
 const panel=document.createElement('section');panel.id='team-setup';panel.hidden=true;
 panel.innerHTML='<div class="team-profile-grid">'+[0,1].map(t=>'<fieldset><legend>КОМАНДА '+(t+1)+'</legend>'+[0,1].map(p=>'<div class="team-profile-slot participant-card"><span id="team-profile-label-'+t+'-'+p+'">Игрок '+(p+1)+'</span><button id="team-profile-'+t+'-'+p+'" data-team-profile="'+(t*2+p)+'" type="button" class="profile-selector" aria-haspopup="dialog" aria-labelledby="team-profile-label-'+t+'-'+p+' team-profile-'+t+'-'+p+'">ВЫБРАТЬ ПРОФИЛЬ</button></div>').join('')+'</fieldset>').join('')+'</div><p id="team-name-error" role="status"></p><p class="profile-muted">Выберите четыре разных постоянных профиля. Результаты 2 НА 2 учитываются отдельно от дуэлей. Настройки сохранятся при старте.</p>';
 $('wizard-players').after(panel);
 const unavailable=document.createElement('p');unavailable.id='team-format-unavailable';unavailable.className='profile-muted';unavailable.hidden=true;$q('.wizard-formats').after(unavailable);
 const home=document.createElement('div');home.id='team-home';home.hidden=true;
 home.innerHTML='<button id="continue-teams" type="button" class="button button-secondary">ПРОДОЛЖИТЬ 2 НА 2</button><button id="team-archive-open" type="button" class="button button-secondary">ПАРТИИ 2 НА 2</button>';
 const continueTeamsButton=home.querySelector('#continue-teams'),archiveTeamsButton=home.querySelector('#team-archive-open');
 const busy=document.createElement('div');busy.id='team-saving';busy.hidden=true;busy.setAttribute('role','status');busy.setAttribute('aria-live','polite');busy.textContent='СОХРАНЯЕМ 2 НА 2…';document.body.append(busy);
 const error=document.createElement('aside');error.id='team-save-error';error.hidden=true;error.setAttribute('role','alert');
 error.innerHTML='<p id="team-save-message"></p><button id="team-reload" type="button" class="button button-primary">ОТКРЫТЬ СОХРАНЕНИЕ 2 НА 2</button><button id="team-safe-menu" type="button" class="button button-secondary">К ИГРЕ 1 НА 1</button>';
 document.body.append(error);
 const dialog=document.createElement('div');dialog.id='team-data-backdrop';dialog.hidden=true;dialog.className='dialog-backdrop';
 dialog.innerHTML='<section class="team-data-dialog" role="dialog" aria-modal="true" aria-labelledby="team-data-title"><h2 id="team-data-title">ПАРТИИ 2 НА 2</h2><div id="team-data-body" tabindex="0"></div><p id="team-data-status" role="status"></p><div class="team-data-actions"><button id="team-export" type="button" class="button button-secondary">СКАЧАТЬ ПАРТИИ 2 НА 2</button><button id="team-recover-before" type="button" class="button button-secondary" hidden>ВЕРНУТЬ ПРЕДЫДУЩЕЕ СОСТОЯНИЕ</button><button id="team-recover-after" type="button" class="button button-primary" hidden>ПРИНЯТЬ НОВОЕ СОСТОЯНИЕ</button><button id="team-clear-archive" type="button" class="button button-secondary" hidden>УДАЛИТЬ ТОЛЬКО АРХИВ 2 НА 2</button><button id="team-data-close" type="button" class="button button-primary">ЗАКРЫТЬ</button></div></section>';
 document.body.append(dialog);const homeFootnote=$q('.home-footnote'),originalHomeFootnote=homeFootnote.textContent;let dataFocus=null,pendingJournal=null,dataURL=null,dataInert=false,revealToken=0;
 function setBusy(value){s.busy=value;busy.hidden=!value;document.body.setAttribute('aria-busy',String(value));}
 function fault(e){s.blocked=true;error.hidden=false;$('team-save-message').textContent='Изменение не подтверждено. Игра остановлена; сохранённые данные защищены от дальнейшей записи. Откройте сохранение заново. '+String(e?.message||e).replace(/^TEAM_(?:GAME|FORMAT):\s*/,'');stopTicking();}
 function root(){const base=s.tx?.proposal||s.record;if(!base||!E.isGame(game))throw Error('Нет активной командной партии.');return {...base,teamFormat:game.teamFormat,game,taskMemory};}
 function snapshotDuel(){return {game,options,taskMemory,storageBlocked,storageProblem,loadedSaveRaw,profileResultProblem};}
 function useDuel(){
  flushSetupRangeWrite();
  stopTicking();revealToken++;for(const id of ['result-history-backdrop','report-backdrop'])$(id).hidden=true;const shell=$q('.site-shell');if(shell)shell.inert=false;reportView.item=null;reportView.focus=null;
  if(s.duel){({game,options,taskMemory,storageBlocked,storageProblem,loadedSaveRaw,profileResultProblem}=s.duel);}
  s.context=false;s.inSetup=false;s.duel=null;document.body.classList.remove('teams-active');panel.hidden=true;$('wizard-players').hidden=false;$('wizard-award').hidden=false;error.hidden=true;
  old.renderOptions();paintSetup();paintHome();
 }
 function useRecord(record,setup=false){
  flushSetupRangeWrite();
  if(!s.context)s.duel=snapshotDuel();s.context=true;s.inSetup=setup;stopTicking();
  game=record?clone(record.game):null;taskMemory=record?clone(record.taskMemory):freshTaskMemory();options=E.optionsFor(record?.options||s.duel.options);
  if(setup)readSetupRanges();
  storageBlocked=false;storageProblem=null;loadedSaveRaw=null;profileResultProblem=null;
  document.body.classList.toggle('teams-active',!setup);paintSetup();
 }
 async function exclusive(fn){
  if(s.tx?.lock)return fn();
  return navigator.locks.request(QuipTeamStorage.LOCK,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Партия 2 на 2 открыта для записи в другой вкладке. Повторите после её закрытия.');return fn();});
 }
 function restoreDurable(before){
  s.inSetup=before.inSetup;
  if(s.record){game=clone(s.record.game);taskMemory=clone(s.record.taskMemory);if(!s.inSetup)options=clone(s.record.options);}
  else{game=null;taskMemory=freshTaskMemory();}
  document.body.classList.toggle('teams-active',!s.inSetup);
 }
 function focusHint(node){if(node?.matches?.('.timer-ring[role="button"]'))return '.timer-ring[role="button"]';if(node?.dataset?.reportHistory!=null)return '[data-report-history="'+node.dataset.reportHistory+'"]'+(node.dataset.reportBlitz!=null?'[data-report-blitz="'+node.dataset.reportBlitz+'"]':'');return reviewFocusSelector(node)||(node?.id?'#'+CSS.escape(node.id):node?.dataset?.action?'[data-action="'+node.dataset.action+'"]':node?.dataset?.feedback?'[data-feedback="'+node.dataset.feedback+'"]':null);}
 function run(action,{replace=false}={}){
  if(s.tx?.executing)return action();
  if(s.busy||s.blocked)return Promise.resolve(false);
  const focused=document.activeElement,focusSelector=focusHint(focused);
  const before={inSetup:s.inSetup,report:!$('report-backdrop').hidden,history:!$('result-history-backdrop').hidden,returnFocus:!$('report-backdrop').hidden?focusHint(reportView.focus):!$('result-history-backdrop').hidden?focusHint(resultHistoryFocus):null,pending:game?.phase==='review'?{player:game.pendingReview.playerIndex??0,scroll:$q('.pending-review-rows')?.scrollTop||0}:null};setBusy(true);stopTicking();
  s.idle=(async()=>{
   let tx;
   try{
    await exclusive(async()=>{
     tx={lock:true,executing:false,messages:[],sounds:[],dirty:false,leave:false};s.tx=tx;
     const loaded=await s.store.load();if(!['empty','ok'].includes(loaded.status)||loaded.raw!==s.raw)throw Error('Сохранение изменилось в другой вкладке или требует восстановления. Откройте его заново.');
     tx.executing=true;try{action();const modalClosed=before.report&&$('report-backdrop').hidden||before.history&&$('result-history-backdrop').hidden;tx.focus=modalClosed&&before.returnFocus?before.returnFocus:focusHint(document.activeElement);}finally{tx.executing=false;}if(tx.failure)throw tx.failure;
     if(s.context&&E.isGame(game)){
      const next=E.finalizeRecord(root());E.validateRecord(next);
      if(!same(next,s.record)){
       const saved=await s.store.commit({expectedRaw:s.raw,match:next,replaceMatchId:replace&&s.record?s.record.teamFormat.id:null});
       s.record=clone(saved.match);s.raw=saved.raw;s.status='ok';
      }
     }
    });
    s.tx=null;setBusy(false);s.blocked=false;error.hidden=true;
    if(tx.leave){useDuel();old.setScene('home');}
    else if(s.context&&!s.inSetup){old.render();paintGame();if(before.pending&&game.phase==='review'&&(game.pendingReview.playerIndex??0)===before.pending.player){const list=$q('.pending-review-rows');if(list)list.scrollTop=before.pending.scroll;}if(!$('result-history-backdrop').hidden)old.renderResultHistory();}
    else old.renderOptions();
    for(const sound of tx.sounds)old.sfx(sound);if(tx.messages.length)old.toast(tx.messages.at(-1));paintHome();
    const active=document.activeElement;if(!active||active===document.body||!active.getClientRects().length){const hint=tx.focus||focusSelector,surface=!$('result-history-backdrop').hidden?$('result-history-backdrop'):!$('report-backdrop').hidden?$('report-backdrop'):document,target=hint?surface.querySelector(hint):null;if(target?.getClientRects().length&&!target.closest('[inert]'))target.focus({preventScroll:true});else if(focused?.id==='start-game')$q('#play-content [data-action="roll"]')?.focus({preventScroll:true});}
    if(s.context&&!s.inSetup&&game?.phase==='rolling')scheduleReveal();return true;
   }catch(e){
    s.tx=null;restoreDurable(before);setBusy(false);fault(e);
    if(s.context&&!s.inSetup&&game){old.render();paintGame();stopTicking();}else{old.renderOptions();paintSetup();}
    return false;
   }finally{if(tx)tx.lock=false;}
  })();return s.idle;
 }
 function stageError(e){if(s.tx)s.tx.failure=e;throw e;}
 persist=function(){
  if(!s.context)return old.persist();
  if(s.inSetup)return false; // This screen is a draft; START commits its full configuration.
  if(s.tx?.executing){s.tx.dirty=true;return true;} // Staging only, never a durable acknowledgement.
  if(!s.busy&&!s.blocked)run(()=>{});return false;
 };
 commitReviewState=function(next,memory=taskMemory){
  if(!s.context)return old.commitReviewState(next,memory);
  try{if(!s.tx?.executing)throw Error('Исправление требует подтверждённой командной транзакции.');E.validateRecord(E.finalizeRecord({...root(),game:next,teamFormat:next.teamFormat,taskMemory:memory}));game=next;taskMemory=memory;s.tx.dirty=true;return true;}catch(e){return stageError(e);}
 };
 commitFeedbackClock=function(next){
  if(!s.context)return old.commitFeedbackClock(next);
  try{if(!s.tx?.executing)throw Error('Изменение таймера требует командной транзакции.');const candidate={...game,current:next};E.validateRecord({...root(),game:candidate});game=candidate;s.tx.dirty=true;}catch(e){return stageError(e);}
 };
 sfx=function(...args){if(s.tx){s.tx.sounds.push(args[0]);return;}return old.sfx(...args);};
 toast=function(message){if(s.tx){s.tx.messages.push(message);return;}return old.toast(message);};
 render=function(...args){if(s.context&&(s.tx||s.busy))return;const result=old.render(...args);if(s.context&&!s.inSetup)paintGame();return result;};
 renderMatch=function(){if(s.context&&(s.tx||s.busy))return;old.renderMatch();if(s.context&&!s.inSetup)paintHeader();};
 renderResultHistory=function(){if(s.context&&(s.tx||s.busy))return;return old.renderResultHistory();};
 for(const name of ['showTask','showTimer','showCountdown','showPendingReview']){
  const original=globalThis[name];globalThis[name]=function(...args){if(s.context&&(s.tx||s.busy))return;return original(...args);};
 }
 showReady=function(){if(!s.context)return old.showReady();if(s.tx||s.busy)return;teamReady();};
 showResults=function(){if(s.context&&(s.tx||s.busy))return;old.showResults();if(s.context)paintResults();};
 reviewedRowDetailsMarkup=function(match,index,editable){
  let html=old.reviewedRowDetailsMarkup(match,index,editable);if(!s.context||!E.isGame(game))return html;
  const row=match.history[index];if(row.mode==='approx')return html.replace('Отвечали оба: '+game.teams.map(escapeHTML).join(' · '),'Совместные ответы команд: '+game.teamFormat.teams.map(t=>escapeHTML(t.name)+' ('+t.members.map(escapeHTML).join(' + ')+')').join(' · '));
  const r=E.roles(game,index),source='Загадывал: '+escapeHTML(game.teams[row.setterIndex])+' · Отгадывал: '+escapeHTML(game.teams[row.guesserIndex]);
  return html.replace(source,escapeHTML(r.teamName)+' · Загадывал: '+escapeHTML(r.setterName)+' · Отгадывал: '+escapeHTML(r.guesserName));
 };
 for(const name of ['roll','toggleWord','replaceWord','startTimer','beginAutomaticRound','pauseTimer','resumeTimer','finishTimer','advanceBlitz','recordAnswer','correctNow','wrongNow','judge','revealApprox','awardApprox','revealTiebreak','settleTiebreak','settleReviewedRound','confirmReviewedResults','settleReviewedTiebreak','openResultHistory','closeResultHistory','updateResultHistory','holdFeedbackTimer','releaseFeedbackTimer','openCardReport','openCurrentCardReport','closeReportPanel','saveReportPanel','approveCurrentCard']){
  const original=globalThis[name];globalThis[name]=function(...args){if(!s.context||s.inSetup)return original(...args);if(s.tx?.executing)return original(...args);return run(()=>original(...args));};
 }
 tick=function(){
  if(!s.context)return old.tick();if(s.inSetup||s.busy||s.blocked)return;
  return old.tick(); // Only expiry/start mutators above acquire a write transaction.
 };
 function leave(){
  if(s.tx?.executing){if(game?.phase==='rolling')game.phase=game.current?'task':'ready';s.tx.leave=true;return;}
  if(s.blocked){useDuel();old.setScene('home');return;}
  return run(()=>leave());
 }
 backToMenu=function(){return s.context&&!s.inSetup?leave():old.backToMenu();};
 backWithinKvip=function(){
  if(!dialog.hidden){closeData();return;}
  if(s.context&&!s.inSetup){if(s.blocked)return leave();return s.tx?.executing?old.backWithinKvip():run(()=>old.backWithinKvip());}
  return old.backWithinKvip();
 };
 handleAction=function(action){
  if(s.context&&!s.inSetup){
   if(action==='menu')return leave();
   if(action==='again'){stopTicking();s.inSetup=true;document.body.classList.remove('teams-active');options=E.optionsFor(s.record.options);openSetup();paintSetup();return;}
   if(!s.tx?.executing)return run(()=>old.handleAction(action));
  }
  return old.handleAction(action);
 };
 setScene=function(which){
  if(s.context&&s.inSetup&&['home','preferences','other-games','statistics'].includes(which))useDuel();
  const result=old.setScene(which);if(s.context&&s.inSetup)paintSetup();return result;
 };
 renderOptions=function(){old.renderOptions();paintSetup();};
 // UI availability is the result of the real, stamped setup renderer. Name
 // edits and navigation only project that result; START validates again in
 // E.createRecord inside the existing transaction before any role RNG.
 function selectedTeamProfiles(){
  if(!profileStore||profileStoreProblem||new Set(s.profileIds).size!==4)return null;
  const list=s.profileIds.map(id=>profileStore.profiles.find(p=>p.id===id));return list.every(Boolean)?[list.slice(0,2),list.slice(2)]:null;
 }
 function profileBindingNow(){
  readProfileStore();const participants=selectedTeamProfiles();
  if(!participants)throw Error('Выберите четыре разных доступных профиля.');
  return QuipTeamStatistics.binding({version:1,storeId:profileStore.storeId,participants:participants.map(team=>team.map(({id,name,color})=>({id,name,color})))});
 }
 function checkBoundProfiles(record,store){
  const b=record?.teamFormat?.profileBinding;if(!b)return;
  QuipTeamStatistics.binding(b);
  if(!store||b.storeId!==store.storeId||b.participants.flat().some(p=>!store.profiles.some(saved=>saved.id===p.id)))throw Error('Профили этой партии недоступны. Восстановите соответствующий архив профилей; командная партия сохранена.');
 }
 function resultLedger(){
  if(['loading','blocked'].includes(s.status)||s.status==='unavailable'&&localStorage.getItem(QuipTeamStorage.KEY)!==null)throw Error('Командные результаты пока недоступны. Данные сохранены; откройте восстановление 2 НА 2.');
  return QuipTeamStatistics.ledger(s.record?.profileResults||[]);
 }
 function validateProfileImport(store){
  const results=resultLedger();QuipTeamStatistics.forStore(QuipTeamStatistics.merge(results,store.teamStatistics?.results||[]),store);
  if(s.record?.game.phase!=='results')checkBoundProfiles(s.record,store);
 }
 function isProfileTarget(target){return target?.format==='teams-2x2'&&Number.isInteger(target.slot)&&target.slot>=0&&target.slot<4;}
 function chooseTeamProfile(target,id){
  if(!isProfileTarget(target)||!s.context||!s.inSetup||!profileStore?.profiles.some(p=>p.id===id)||s.profileIds.some((p,i)=>i!==target.slot&&p===id))return false;
  s.profileIds[target.slot]=id;old.renderOptions();paintSetup();return true;
 }
 function clearTeamProfile(target){
  if(!isProfileTarget(target)||!s.context||!s.inSetup||s.profileIds[target.slot]===null)return false;
  s.profileIds[target.slot]=null;old.renderOptions();paintSetup();return true;
 }
 function paintSetup(){
  const team=s.context&&s.inSetup;panel.hidden=!team;
  $('wizard-format-duel').setAttribute('aria-pressed',String(!team));$('wizard-format-teams').setAttribute('aria-pressed',String(team));
  $('wizard-format-teams').disabled=s.status==='loading'||!s.store||s.busy;
  $('wizard-players').hidden=team;$('wizard-award').hidden=team;
  if(!team)return;
  $('score-goal-caption').textContent=options.finishType==='score'?'У каждой команды будет ответный ход':'Одинаковое число ходов у обеих команд';
  const profiles=selectedTeamProfiles(),names=profiles?.map(team=>team.map(p=>p.name));
  for(let t=0;t<2;t++)for(let p=0;p<2;p++){
   const selected=profileStore?.profiles.find(profile=>profile.id===s.profileIds[t*2+p]);
   $('team-profile-'+t+'-'+p).innerHTML=profileLabel(selected)+'<span class="profile-chevron" aria-hidden="true">⌄</span>';
  }
  $('team-name-error').textContent=profileStoreProblem||(profiles?'':'Выберите четыре разных профиля, чтобы начать партию.');
  $('start-game').disabled=!names||!$('setup-mode-notice').hidden||!!setupCategoryProblem(options.contentPack)||s.blocked||s.busy;
  if(s.status==='blocked'){$('team-name-error').textContent='Сохранение 2 на 2 защищено. Сначала откройте восстановление через меню.';$('start-game').disabled=true;}
  const rows=[...$('wizard-summary').children];for(const row of rows){const title=row.querySelector('dt')?.textContent,dd=row.querySelector('dd');if(title==='Игроки')dd.textContent=names?names.map((n,i)=>'Команда '+(i+1)+': '+n.join(' + ')).join(' · '):'Выберите четыре разных профиля';if(title==='Очки получает')dd.textContent='Активная команда. Статистика 2 НА 2 — отдельно.';}
  $('wizard-summary').querySelector('[data-team-format-summary]')?.remove();const row=document.createElement('div');row.dataset.teamFormatSummary='';row.innerHTML='<dt>Формат</dt><dd>2 НА 2 · две команды по два участника</dd>';$('wizard-summary').prepend(row);
  for(const copy of panel.ownerDocument.querySelectorAll('#wizard-rule-list .wizard-rule-copy p'))copy.textContent=copy.textContent.replace(/Соперник/g,'Партнёр').replace(/соперник/g,'партнёр');
 }
 function paintHome(){
  home.hidden=!s.record&&s.status!=='blocked';if(home.hidden)home.remove();else if(!home.isConnected)$('continue-game').after(home);$('scene-home').classList.toggle('has-team-save',!home.hidden);homeFootnote.textContent=home.hidden?originalHomeFootnote:'1 НА 1 ИЛИ 2 НА 2 · ОДИН ТЕЛЕФОН';continueTeamsButton.textContent=s.status==='blocked'?'ВОССТАНОВИТЬ 2 НА 2':s.record?.game.phase==='results'?'ИТОГИ 2 НА 2':'ПРОДОЛЖИТЬ 2 НА 2';
  archiveTeamsButton.hidden=!s.record;paintSetup();
 }
 function rosterMarkup(){return game.teamFormat.teams.map((team,i)=>'<section><h3>'+escapeHTML(team.name)+' · '+game.scores[i]+'</h3><p>'+team.members.map(escapeHTML).join(' + ')+'</p></section>').join('');}
 function paintHeader(){
  if(!E.isGame(game))return;
  for(const [i,id]of ['a','b'].entries()){
   const roster=game.teamFormat.teams[i].members.join(' + ');$('role-'+id).textContent=roster;$('role-'+id).title=roster;
   $('match-team-'+id).setAttribute('aria-label',game.teams[i]+', '+roster+', '+ruPoints(game.scores[i])+' — история ходов');
  }
 }
 function teamReady(){
  const r=E.roles(game);$('play-content').className='play-inner is-ready';$('play-step').textContent='2 НА 2 · ПЕРЕДАЙТЕ ТЕЛЕФОН ЗАГАДЫВАЮЩЕМУ';
  $('play-content').innerHTML='<div class="ready-content team-handoff" tabindex="0" role="region" aria-label="Передача телефона"><span class="game-eyebrow">'+escapeHTML(r.teamName)+' · ЗАГАДЫВАЕТ</span><h2 class="play-title">'+escapeHTML(r.setterName)+'<br><em>ОТГАДЫВАЕТ: '+escapeHTML(r.guesserName)+'</em></h2><p class="play-subtitle">Задание видит только '+escapeHTML(r.setterName)+'. Отгадывает партнёр этой же команды.</p><div class="team-roster">'+rosterMarkup()+'</div></div><div class="ready-action-slot">'+makeButton(game.dice?'ВЫБРАТЬ РЕЖИМ':'ПОЛУЧИТЬ ЗАДАНИЕ','roll','button-primary button-big')+'</div>';
 }
 function paintResults(){
  if(!E.isGame(game)||$('team-result-roster'))return;
  const block=document.createElement('div');block.id='team-result-roster';block.innerHTML='<p class="profile-muted">'+(game.teamFormat.version===2?'2 НА 2: статистика четырёх профилей обновлена. Дуэльные показатели учитываются отдельно.':'2 НА 2. Историческая партия без привязки профилей; личная статистика не меняется.')+'</p><div class="team-roster">'+rosterMarkup()+'</div>';
  $('results-content').querySelector('.inline-actions').after(block);
 }
 function paintGame(){
  if(!E.isGame(game))return;paintHeader();for(const tabs of document.querySelectorAll('.review-tabs'))tabs.setAttribute('aria-label','История команд');
  if(game.phase==='ready')teamReady();
  else if(game.phase==='results')paintResults();
  else if(game.phase==='tiebreak'){$('play-step').textContent='2 НА 2 · РЕШАЮЩИЙ ОБЩИЙ ВОПРОС';const p=$q('.is-tiebreak .play-subtitle');if(p)p.textContent=game.tiebreak.stage==='question'?'Каждая команда совместно называет одно число.':'Сравните совместные ответы команд.';}
  else if(game.current?.modeId==='approx'){const p=$q('.is-approx .play-subtitle');if(p)p.textContent='Каждая команда совместно называет одно число.';}
  else if(!['review'].includes(game.phase)){const r=E.roles(game),text=r.teamName+' · '+r.setterName+' → '+r.guesserName;$('play-step').textContent=text;$('play-step').title=text;}
 }
 function normaliseRestored(){
  if(game.phase==='rolling')game.phase=game.current?'task':'ready';
  const c=game.current;if(game.phase==='countdown'&&!c.feedbackHold&&c.autoStartAt<=Date.now()){game.phase='play';c.deadline=c.autoStartAt+c.seconds*1000;c.autoStartAt=null;c.paused=false;c.remainingMs=null;}
  if(game.phase==='play'&&!c.paused&&!c.feedbackHold&&c.deadline<=Date.now()){game.phase='judge';c.deadline=null;c.finishedReason='timeout';}
 }
 function scheduleReveal(){
  const token=++revealToken,id=game.matchId,wait=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?1:ROLL_SPIN_MS;
  setTimeout(()=>{if(token!==revealToken||!s.context||s.inSetup||game?.matchId!==id||game.phase!=='rolling')return;run(()=>{game.phase='task';persist();sfx('go');render();});},wait+ROLL_HOLD_MS);
 }
 async function readStore(){
  const loaded=await s.store.load();s.status=loaded.status;s.raw=loaded.raw??null;
  if(loaded.status==='ok')s.record=loaded.match;else if(loaded.status==='empty')s.record=null;
  paintHome();if(!$('scene-statistics').hidden&&typeof renderStatistics==='function')renderStatistics();return loaded;
 }
 function continueTeam(){
  if(s.busy)return s.idle;if(s.context)useDuel();old.setScene('home');s.blocked=false;error.hidden=true;setBusy(true);
  s.idle=(async()=>{
   try{const loaded=await readStore();setBusy(false);if(loaded.status==='blocked'){await openData();return false;}if(loaded.status!=='ok')return false;
    if(s.record.teamFormat.version===2){readProfileStore();checkBoundProfiles(s.record,profileStore);}
    useRecord(s.record);return await run(normaliseRestored);
   }catch(e){setBusy(false);fault(e);return false;}
  })();return s.idle;
 }
 // Four UI preferences have their own small guarded slot. No draft match,
 // roster, profile, team ledger or legacy duel RAW is written before START.
 const rangeKey='kvip:teams-2x2:setup-ranges:v1';let rangeRaw=null,rangeBlocked=false;
 function readSetupRanges(){
  rangeBlocked=false;
  try{
   rangeRaw=localStorage.getItem(rangeKey);if(rangeRaw===null)return;
   const value=JSON.parse(rangeRaw),definitions=setupRangeDefinitions();
   if(value?.version!==1||!value.values||Object.keys(value.values).length!==definitions.length)throw Error('Unsupported range preferences');
   for(const [,key,min,max,step]of definitions){const n=value.values[key];if(!Number.isFinite(n)||n<min||n>max||n%step!==0)throw Error('Invalid range preference');}
   Object.assign(options,value.values);
  }catch{rangeBlocked=true;}
 }
 function persistSetupRanges(){
  if(!s.context||!s.inSetup)return false;
  try{
   if(rangeBlocked||localStorage.getItem(rangeKey)!==rangeRaw)throw Error('Protected range preferences');
   const raw=JSON.stringify({version:1,values:Object.fromEntries(setupRangeDefinitions().map(([,key])=>[key,options[key]]))});
   localStorage.setItem(rangeKey,raw);if(localStorage.getItem(rangeKey)!==raw)throw Error('Range write failed');rangeRaw=raw;return true;
  }catch{rangeBlocked=true;old.toast('Настройки ползунков не сохранены. Данные защищены; проверьте значения после перезагрузки.');return false;}
 }
 function chooseTeam(){
  if(s.context)return;if(!s.store||s.status==='loading')return;
  useRecord(s.record,true);
  const b=s.record?.teamFormat.profileBinding;
  if(b&&b.storeId===profileStore?.storeId&&s.profileIds.every(id=>id===null))s.profileIds=b.participants.flat().map(p=>p.id);
  old.renderOptions();paintSetup();
  // Keep focus on the format control. No text input or automatic dialog/IME.
 }
 function startTeam(){
  flushSetupRangeWrite();
  if(!selectedTeamProfiles()){paintSetup();return;}
  if(s.record&&!window.confirm('Текущая партия 2 на 2 будет полностью сохранена в отдельном архиве на этом устройстве. Начать новую?'))return;
  run(()=>{
   const binding=profileBindingNow(),names=binding.participants.map(team=>team.map(p=>p.name));
   const proposal=E.createRecord(options,names,{id:crypto.randomUUID(),previous:s.record,profileBinding:binding});s.tx.proposal=proposal;
   game=proposal.game;taskMemory=proposal.taskMemory;options=proposal.options;s.inSetup=false;document.body.classList.add('teams-active');persist();sfx('go');render();
  },{replace:!!s.record});
 }
 function closeData(){dialog.hidden=true;pendingJournal=null;const shell=$q('.site-shell');if(shell)shell.inert=dataInert;dataFocus?.focus?.({preventScroll:true});}
 async function openData(){
  const shell=$q('.site-shell');if(dialog.hidden){dataFocus=document.activeElement;dataURL=location.href;dataInert=shell?.inert||false;}dialog.hidden=false;if(shell)shell.inert=true;pendingJournal=null;$('team-data-status').textContent='';$('team-recover-before').hidden=true;$('team-recover-after').hidden=true;$('team-clear-archive').hidden=true;
  try{
   const p=await s.store.pending();
   if(p.status==='pending'){
    pendingJournal=p.journal;$('team-data-body').textContent='Предыдущая запись прервалась. Обе проверенные версии сохранены. Скачайте копию и явно выберите, какое состояние использовать. Игра 1 на 1 не затрагивается.';$('team-recover-before').hidden=false;$('team-recover-after').hidden=false;
   }else if(p.status==='blocked')$('team-data-body').textContent='Журнал повреждён или отличается от текущей записи. Автоматическое восстановление запрещено. Исходные данные сохранены; скачайте их для проверки. '+(p.message||'');
   else{
    const loaded=await readStore();if(loaded.status==='blocked')$('team-data-body').textContent='Сохранение повреждено или создано другой версией. Оно защищено от перезаписи. Скачайте исходные данные для проверки. '+(loaded.message||'');
    else if(!s.record)$('team-data-body').textContent='Сохранённых партий 2 на 2 пока нет.';
    else{$('team-data-body').innerHTML='<p>Текущая партия: '+s.record.game.scores.join(' : ')+' · '+ruTurns(s.record.game.roundIndex)+'.</p><p>'+(s.record.teamFormat.version===2?'Участники выбраны из профилей. Итоги учитываются в разделе «2 НА 2».':'Партия создана по именам. Её результаты не приписываются профилям.')+'</p><p>Командные результаты учитываются отдельно от дуэлей. Экспорт профилей включает записанную статистику обоих форматов; этот файл партий также содержит игровой архив.</p>'+s.record.archives.map((e,i)=>'<p>Партия '+(i+1)+': '+e.teamFormat.teams.map(t=>t.members.map(escapeHTML).join(' + ')).join(' / ')+' · '+e.game.scores.join(' : ')+' · '+ruTurns(e.game.roundIndex)+'.</p>').join('');$('team-clear-archive').hidden=!s.record.archives.length;}
   }
  }catch(e){$('team-data-status').textContent=e.message;}
  $('team-data-close').focus();
 }
 async function recover(choice){
  try{if(!pendingJournal)return;await s.store.recover({expectedJournal:pendingJournal,choice});s.blocked=false;error.hidden=true;await readStore();closeData();old.toast('Сохранение 2 на 2 восстановлено.');}catch(e){$('team-data-status').textContent=e.message;}
 }
 $('scene-wizard').addEventListener('quip:setup-rendered',paintSetup);
 $('wizard-format-teams').addEventListener('click',chooseTeam);
 $('wizard-format-duel').addEventListener('click',()=>{if(s.context){useDuel();old.renderOptions();}});
 panel.addEventListener('click',event=>{const button=event.target.closest('[data-team-profile]');if(button)openProfilePanel({format:'teams-2x2',slot:Number(button.dataset.teamProfile)});});
 continueTeamsButton.addEventListener('click',continueTeam);archiveTeamsButton.addEventListener('click',openData);
 $('team-reload').addEventListener('click',continueTeam);$('team-safe-menu').addEventListener('click',()=>{if(s.context)useDuel();error.hidden=true;old.setScene('home');});
 $('team-data-close').addEventListener('click',closeData);dialog.addEventListener('click',event=>{if(event.target===dialog)closeData();});
 $('team-export').addEventListener('click',async()=>{try{const durable=await s.store.inspect().catch(e=>({unavailable:String(e.message||e)}));downloadProfileBackup(JSON.stringify({durable,format:'quip-teams-export',version:1,raw:localStorage.getItem(QuipTeamStorage.KEY),pending:localStorage.getItem(QuipTeamStorage.JOURNAL_KEY)},null,2),backupFileName('kvip-2x2'));}catch(e){$('team-data-status').textContent=e.message;}});
 $('team-recover-before').addEventListener('click',()=>recover('keep-before'));$('team-recover-after').addEventListener('click',()=>recover('keep-after'));
 $('team-clear-archive').addEventListener('click',async()=>{
  if(!s.record?.archives.length||!window.confirm('Удалить только архив прежних партий 2 на 2 с устройства? Сначала скачайте копию. Текущая партия и игра 1 на 1 останутся.'))return;
  try{const next={...s.record,archives:[]},saved=await s.store.commit({expectedRaw:s.raw,match:next});s.record=saved.match;s.raw=saved.raw;await openData();}catch(e){$('team-data-status').textContent=e.message;}
 });
 document.addEventListener('click',event=>{
  if(s.busy&&!s.tx?.executing){event.preventDefault();event.stopImmediatePropagation();return;}
  const target=event.target.closest('button');if(!target)return;
  if(s.context&&s.inSetup&&target.id==='start-game'){event.preventDefault();event.stopImmediatePropagation();startTeam();return;}
  if(!s.context||s.inSetup||s.tx?.executing||target.closest('#team-home,#team-save-error,#team-data-backdrop'))return;
  if(target.id==='exit-game'){event.preventDefault();event.stopImmediatePropagation();leave();return;}
  if(target.matches('[data-review-expand]')||target.closest('.review-compact-bar')&&!target.closest('[data-review-choice]')||target.matches('[data-review-tab]')&&!game.resultEditor&&game.phase!=='review')return;
  // Replay only game buttons, inside the lock. File/share actions keep their
  // native trusted click and user activation; they never mutate team scores.
  if(target.closest('#scene-game,#scene-results,#result-history-backdrop,#report-backdrop')){
   event.preventDefault();event.stopImmediatePropagation();run(()=>target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:event.detail})));
  }
 },true);
 window.addEventListener('popstate',event=>{if(dialog.hidden)return;event.stopImmediatePropagation();closeData();if(dataURL)history.replaceState(history.state,'',dataURL);backGuardArmed=false;armBrowserBackGuard();},true);
 document.addEventListener('keydown',event=>{
  if(s.busy){event.preventDefault();event.stopImmediatePropagation();return;}
  if(dialog.hidden)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeData();return;}
  if(event.key==='Tab'){const items=[...dialog.querySelectorAll('button:not([hidden]),[tabindex="0"]')].filter(n=>n.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
 },true);
 // The existing Android Back guard must close this separate data dialog first.
 window.addEventListener('storage',event=>{if(!s.context&&[QuipTeamStorage.KEY,QuipTeamStorage.JOURNAL_KEY].includes(event.key)&&s.store)readStore().catch(()=>{});});
 window.QuipTeams=Object.freeze({get busy(){return s.busy;},get active(){return s.context;},get blocked(){return s.blocked;},whenIdle:()=>s.idle,whenReady:()=>s.ready,continue:continueTeam,record:()=>s.record?clone(s.record):null,isProfileTarget,selectedProfileId:target=>isProfileTarget(target)?s.profileIds[target.slot]:null,profileUnavailable:(target,id)=>s.profileIds.some((p,i)=>i!==target.slot&&p===id),chooseProfile:chooseTeamProfile,clearProfile:clearTeamProfile,results:resultLedger,validateProfileImport,persistSetupRanges});
 try{
  if(!navigator.locks?.request)throw Error('Этот браузер не поддерживает безопасное сохранение 2 на 2. Игра 1 на 1 остаётся доступной.');
  s.store=QuipTeamStorage.create({storage:localStorage,validateMatch:E.validateRecord,validateReplacement:E.validateReplacement,validateTransition:E.validateTransition,exclusive});
  s.ready=readStore().catch(e=>{s.status='blocked';paintHome();old.toast(e.message);});
 }catch(e){s.status='unavailable';$('wizard-format-teams').title=e.message;$('wizard-format-teams').setAttribute('aria-describedby',unavailable.id);unavailable.textContent=e.message;unavailable.hidden=false;paintHome();}
})();
