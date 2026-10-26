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
 const s={context:false,inSetup:false,busy:false,blocked:false,record:null,raw:null,status:'loading',duel:null,tx:null,names:[['',''],['','']],idle:Promise.resolve(true),store:null};
 const clone=value=>JSON.parse(JSON.stringify(value)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const $q=selector=>document.querySelector(selector);
 const panel=document.createElement('section');panel.id='team-setup';panel.hidden=true;
 panel.innerHTML='<div class="team-name-grid">'+[0,1].map(t=>'<fieldset><legend>КОМАНДА '+(t+1)+'</legend>'+[0,1].map(p=>'<label>Игрок '+(p+1)+'<input id="team-name-'+t+'-'+p+'" data-team-name="'+t+':'+p+'" type="text" maxlength="48" autocomplete="off" placeholder="Имя участника"></label>').join('')+'</fieldset>').join('')+'</div><p id="team-name-error" role="status"></p><p class="profile-muted">Имена нужны только для этой партии. Личная статистика профилей не изменяется. Настройки сохранятся при старте. Незавершённая игра 1 на 1 останется на устройстве.</p>';
 $('wizard-players').after(panel);
 const unavailable=document.createElement('p');unavailable.id='team-format-unavailable';unavailable.className='profile-muted';unavailable.hidden=true;$q('.wizard-formats').after(unavailable);
 const home=document.createElement('div');home.id='team-home';home.hidden=true;
 home.innerHTML='<button id="continue-teams" type="button" class="button button-secondary">ПРОДОЛЖИТЬ 2 НА 2</button><button id="team-archive-open" type="button" class="button button-secondary">ПАРТИИ 2 НА 2</button>';
 $('continue-game').after(home);
 const busy=document.createElement('div');busy.id='team-saving';busy.hidden=true;busy.setAttribute('role','status');busy.setAttribute('aria-live','polite');busy.textContent='СОХРАНЯЕМ 2 НА 2…';document.body.append(busy);
 const error=document.createElement('aside');error.id='team-save-error';error.hidden=true;error.setAttribute('role','alert');
 error.innerHTML='<p id="team-save-message"></p><button id="team-reload" type="button" class="button button-primary">ОТКРЫТЬ СОХРАНЕНИЕ 2 НА 2</button><button id="team-safe-menu" type="button" class="button button-secondary">К ИГРЕ 1 НА 1</button>';
 document.body.append(error);
 const dialog=document.createElement('div');dialog.id='team-data-backdrop';dialog.hidden=true;dialog.className='dialog-backdrop';
 dialog.innerHTML='<section class="team-data-dialog" role="dialog" aria-modal="true" aria-labelledby="team-data-title"><h2 id="team-data-title">ПАРТИИ 2 НА 2</h2><div id="team-data-body" tabindex="0"></div><p id="team-data-status" role="status"></p><div class="team-data-actions"><button id="team-export" type="button" class="button button-secondary">СКАЧАТЬ ПАРТИИ 2 НА 2</button><button id="team-recover-before" type="button" class="button button-secondary" hidden>ВЕРНУТЬ ПРЕДЫДУЩЕЕ СОСТОЯНИЕ</button><button id="team-recover-after" type="button" class="button button-primary" hidden>ПРИНЯТЬ НОВОЕ СОСТОЯНИЕ</button><button id="team-clear-archive" type="button" class="button button-secondary" hidden>УДАЛИТЬ ТОЛЬКО АРХИВ 2 НА 2</button><button id="team-data-close" type="button" class="button button-primary">ЗАКРЫТЬ</button></div></section>';
 document.body.append(dialog);const homeFootnote=$q('.home-footnote'),originalHomeFootnote=homeFootnote.textContent;let dataFocus=null,pendingJournal=null,dataURL=null,dataInert=false,revealToken=0;
 function setBusy(value){s.busy=value;busy.hidden=!value;document.body.setAttribute('aria-busy',String(value));}
 function fault(e){s.blocked=true;error.hidden=false;$('team-save-message').textContent='Изменение не подтверждено. Предыдущее состояние сохранено или защищено журналом восстановления. '+String(e?.message||e).replace(/^TEAM_(?:GAME|FORMAT):\s*/,'');stopTicking();}
 function root(){const base=s.tx?.proposal||s.record;if(!base||!E.isGame(game))throw Error('Нет активной командной партии.');return {...base,teamFormat:game.teamFormat,game,taskMemory};}
 function snapshotDuel(){return {game,options,taskMemory,storageBlocked,storageProblem,loadedSaveRaw,profileResultProblem};}
 function useDuel(){
  stopTicking();revealToken++;for(const id of ['result-history-backdrop','report-backdrop'])$(id).hidden=true;const shell=$q('.site-shell');if(shell)shell.inert=false;reportView.item=null;reportView.focus=null;
  if(s.duel){({game,options,taskMemory,storageBlocked,storageProblem,loadedSaveRaw,profileResultProblem}=s.duel);}
  s.context=false;s.inSetup=false;s.duel=null;document.body.classList.remove('teams-active');panel.hidden=true;$('wizard-players').hidden=false;$('wizard-award').hidden=false;error.hidden=true;
  old.renderOptions();paintSetup();paintHome();
 }
 function useRecord(record,setup=false){
  if(!s.context)s.duel=snapshotDuel();s.context=true;s.inSetup=setup;stopTicking();
  game=record?clone(record.game):null;taskMemory=record?clone(record.taskMemory):freshTaskMemory();options=E.optionsFor(record?.options||s.duel.options);
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
 function run(action,{replace=false}={}){
  if(s.tx?.executing)return action();
  if(s.busy||s.blocked)return Promise.resolve(false);
  const focused=document.activeElement,focusSelector=reviewFocusSelector(focused)||(focused?.id?'#'+CSS.escape(focused.id):focused?.dataset?.action?'[data-action="'+focused.dataset.action+'"]':null);
  const before={inSetup:s.inSetup,pending:game?.phase==='review'?{player:game.pendingReview.playerIndex??0,scroll:$q('.pending-review-rows')?.scrollTop||0}:null};setBusy(true);stopTicking();
  s.idle=(async()=>{
   let tx;
   try{
    await exclusive(async()=>{
     tx={lock:true,executing:false,messages:[],sounds:[],dirty:false,leave:false};s.tx=tx;
     const loaded=await s.store.load();if(!['empty','ok'].includes(loaded.status)||loaded.raw!==s.raw)throw Error('Сохранение изменилось в другой вкладке или требует восстановления. Откройте его заново.');
     tx.executing=true;try{action();}finally{tx.executing=false;}if(tx.failure)throw tx.failure;
     if(s.context&&E.isGame(game)){
      const next=root();E.validateRecord(next);
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
    const active=document.activeElement;if(!active||active===document.body||!active.getClientRects().length){const target=focusSelector?$q(focusSelector):null;if(target?.getClientRects().length)target.focus({preventScroll:true});else if(focused?.id==='start-game')$q('#play-content [data-action="roll"]')?.focus({preventScroll:true});}
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
  try{if(!s.tx?.executing)throw Error('Исправление требует подтверждённой командной транзакции.');E.validateRecord({...root(),game:next,teamFormat:next.teamFormat,taskMemory:memory});game=next;taskMemory=memory;s.tx.dirty=true;return true;}catch(e){return stageError(e);}
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
 function validNames(){try{return QuipTeamFormat.members(s.names);}catch{return null;}}
 function paintSetup(){
  const team=s.context&&s.inSetup;panel.hidden=!team;
  $('wizard-format-duel').setAttribute('aria-pressed',String(!team));$('wizard-format-teams').setAttribute('aria-pressed',String(team));
  $('wizard-format-teams').disabled=s.status==='loading'||!s.store||s.busy;
  $('wizard-players').hidden=team;$('wizard-award').hidden=team;
  if(!team)return;
  $('score-goal-caption').textContent=options.finishType==='score'?'У каждой команды будет ответный ход':'Одинаковое число ходов у обеих команд';
  const names=validNames();$('team-name-error').textContent=names?'':'Введите четыре разных, различимых имени — до 24 символов каждое.';
  const availability=checkContentPack(options.contentPack,{...options,...setupSongPolicy(options)});
  $('start-game').disabled=!names||!availability.available||s.blocked||s.busy;
  if(s.status==='blocked'){$('team-name-error').textContent='Сохранение 2 на 2 защищено. Сначала откройте восстановление через меню.';$('start-game').disabled=true;}
  const rows=[...$('wizard-summary').children];for(const row of rows){const title=row.querySelector('dt')?.textContent,dd=row.querySelector('dd');if(title==='Игроки')dd.textContent=names?names.map((n,i)=>'Команда '+(i+1)+': '+n.join(' + ')).join(' · '):'Введите четырёх участников';if(title==='Очки получает')dd.textContent='Активная команда. Личная статистика не меняется.';}
  $('wizard-summary').querySelector('[data-team-format-summary]')?.remove();const row=document.createElement('div');row.dataset.teamFormatSummary='';row.innerHTML='<dt>Формат</dt><dd>2 НА 2 · две команды по два участника</dd>';$('wizard-summary').prepend(row);
  for(const copy of panel.ownerDocument.querySelectorAll('#wizard-rule-list .wizard-rule-copy p'))copy.textContent=copy.textContent.replace(/Соперник/g,'Партнёр').replace(/соперник/g,'партнёр');
 }
 function paintHome(){
  home.hidden=!s.record&&s.status!=='blocked';$('scene-home').classList.toggle('has-team-save',!home.hidden);homeFootnote.textContent=home.hidden?originalHomeFootnote:'1 НА 1 ИЛИ 2 НА 2 · ОДИН ТЕЛЕФОН';$('continue-teams').textContent=s.status==='blocked'?'ВОССТАНОВИТЬ 2 НА 2':s.record?.game.phase==='results'?'ИТОГИ 2 НА 2':'ПРОДОЛЖИТЬ 2 НА 2';
  $('team-archive-open').hidden=!s.record;paintSetup();
 }
 function rosterMarkup(){return game.teamFormat.teams.map((team,i)=>'<section><h3>'+escapeHTML(team.name)+' · '+game.scores[i]+'</h3><p>'+team.members.map(escapeHTML).join(' + ')+'</p></section>').join('');}
 function paintHeader(){
  if(!E.isGame(game))return;
  for(const [i,id]of ['a','b'].entries()){
   const roster=game.teamFormat.teams[i].members.join(' + ');$('role-'+id).textContent=roster;$('role-'+id).title=roster;
   $('match-team-'+id).setAttribute('aria-label',game.teams[i]+', '+roster+', '+game.scores[i]+' очков — история ходов');
  }
 }
 function teamReady(){
  const r=E.roles(game);$('play-content').className='play-inner is-ready';$('play-step').textContent='2 НА 2 · ПЕРЕДАЙТЕ ТЕЛЕФОН ЗАГАДЫВАЮЩЕМУ';
  $('play-content').innerHTML='<div class="ready-content team-handoff" tabindex="0" role="region" aria-label="Передача телефона"><span class="game-eyebrow">'+escapeHTML(r.teamName)+' · ЗАГАДЫВАЕТ</span><h2 class="play-title">'+escapeHTML(r.setterName)+'<br><em>ОТГАДЫВАЕТ: '+escapeHTML(r.guesserName)+'</em></h2><p class="play-subtitle">Задание видит только '+escapeHTML(r.setterName)+'. Отгадывает партнёр этой же команды.</p><div class="team-roster">'+rosterMarkup()+'</div></div><div class="ready-action-slot">'+makeButton(game.dice?'ВЫБРАТЬ РЕЖИМ':'ПОЛУЧИТЬ ЗАДАНИЕ','roll','button-primary button-big')+'</div>';
 }
 function paintResults(){
  if(!E.isGame(game)||$('team-result-roster'))return;
  const block=document.createElement('div');block.id='team-result-roster';block.innerHTML='<p class="profile-muted">2 НА 2. Результат сохранён в этой партии и не входит в личную статистику профилей.</p><div class="team-roster">'+rosterMarkup()+'</div>';
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
  paintHome();return loaded;
 }
 function continueTeam(){
  if(s.busy)return s.idle;if(s.context)useDuel();old.setScene('home');s.blocked=false;error.hidden=true;setBusy(true);
  s.idle=(async()=>{
   try{const loaded=await readStore();setBusy(false);if(loaded.status==='blocked'){await openData();return false;}if(loaded.status!=='ok')return false;
    useRecord(s.record);return await run(normaliseRestored);
   }catch(e){setBusy(false);fault(e);return false;}
  })();return s.idle;
 }
 function chooseTeam(){
  if(s.context)return;if(!s.store||s.status==='loading')return;
  useRecord(s.record,true);if(s.record&&s.names.flat().every(n=>!n))s.names=clone(s.record.teamFormat.teams.map(t=>t.members));
  for(let t=0;t<2;t++)for(let p=0;p<2;p++)$('team-name-'+t+'-'+p).value=s.names[t][p];
  old.renderOptions();paintSetup();$('team-name-0-0').focus({preventScroll:true});
 }
 function startTeam(){
  const names=validNames();if(!names){paintSetup();return;}
  if(s.record&&!window.confirm('Текущая партия 2 на 2 будет полностью сохранена в отдельном архиве на этом устройстве. Начать новую?'))return;
  run(()=>{
   const proposal=E.createRecord(options,names,{id:crypto.randomUUID(),previous:s.record});s.tx.proposal=proposal;
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
   }else if(p.status==='blocked')$('team-data-body').textContent='Журнал повреждён или отличается от текущей записи. Автоматическое восстановление запрещено. Исходные данные сохранены; скачайте их для проверки.';
   else{
    const loaded=await readStore();if(loaded.status==='blocked')$('team-data-body').textContent='Сохранение повреждено или создано другой версией. Оно защищено от перезаписи. Скачайте исходные данные для проверки.';
    else if(!s.record)$('team-data-body').textContent='Сохранённых партий 2 на 2 пока нет.';
    else{$('team-data-body').innerHTML='<p>Текущая партия: '+s.record.game.scores.join(' : ')+' · '+s.record.game.roundIndex+' ходов.</p><p>Личная статистика профилей не изменяется. Этот отдельный архив не входит в прежний JSON профилей.</p>'+s.record.archives.map((e,i)=>'<p>Партия '+(i+1)+': '+e.teamFormat.teams.map(t=>t.members.map(escapeHTML).join(' + ')).join(' / ')+' · '+e.game.scores.join(' : ')+' · '+e.game.roundIndex+' ходов.</p>').join('');$('team-clear-archive').hidden=!s.record.archives.length;}
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
 panel.addEventListener('input',event=>{const key=event.target.dataset.teamName;if(!key)return;const [t,p]=key.split(':').map(Number);s.names[t][p]=event.target.value;paintSetup();});
 for(const type of ['selectstart','contextmenu'])panel.addEventListener(type,event=>{if(event.target.matches('[data-team-name]'))event.stopPropagation();});
 $('continue-teams').addEventListener('click',continueTeam);$('team-archive-open').addEventListener('click',openData);
 $('team-reload').addEventListener('click',continueTeam);$('team-safe-menu').addEventListener('click',()=>{if(s.context)useDuel();error.hidden=true;old.setScene('home');});
 $('team-data-close').addEventListener('click',closeData);dialog.addEventListener('click',event=>{if(event.target===dialog)closeData();});
 $('team-export').addEventListener('click',()=>{try{downloadProfileBackup(JSON.stringify({format:'quip-teams-export',version:1,raw:localStorage.getItem(QuipTeamStorage.KEY),pending:localStorage.getItem(QuipTeamStorage.JOURNAL_KEY)},null,2),backupFileName('kvip-2x2'));}catch(e){$('team-data-status').textContent=e.message;}});
 $('team-recover-before').addEventListener('click',()=>recover('keep-before'));$('team-recover-after').addEventListener('click',()=>recover('keep-after'));
 $('team-clear-archive').addEventListener('click',async()=>{
  if(!s.record?.archives.length||!window.confirm('Удалить только архив прежних партий 2 на 2 с устройства? Сначала скачайте копию. Текущая партия и игра 1 на 1 останутся.'))return;
  try{const next={...s.record,archives:[]},saved=await s.store.commit({expectedRaw:s.raw,match:next});s.record=saved.match;s.raw=saved.raw;await openData();}catch(e){$('team-data-status').textContent=e.message;}
 });
 document.addEventListener('click',event=>{
  if(s.busy&&!s.tx?.executing){event.preventDefault();event.stopImmediatePropagation();return;}
  const target=event.target.closest('button');if(!target)return;
  if(s.context&&['wizard-legacy','setup-interface-toggle'].includes(target.id))useDuel();
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
 window.QuipTeams=Object.freeze({get busy(){return s.busy;},get active(){return s.context;},get blocked(){return s.blocked;},whenIdle:()=>s.idle,continue:continueTeam,record:()=>s.record?clone(s.record):null});
 try{
  if(!navigator.locks?.request)throw Error('Этот браузер не поддерживает безопасное сохранение 2 на 2. Игра 1 на 1 остаётся доступной.');
  s.store=QuipTeamStorage.create({storage:localStorage,validateMatch:E.validateRecord,validateReplacement:E.validateReplacement,exclusive});
  readStore().catch(e=>{s.status='blocked';paintHome();old.toast(e.message);});
 }catch(e){s.status='unavailable';$('wizard-format-teams').title=e.message;$('wizard-format-teams').setAttribute('aria-describedby',unavailable.id);unavailable.textContent=e.message;unavailable.hidden=false;paintHome();}
})();
