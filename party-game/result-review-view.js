'use strict';
let resultHistoryFocus=null;
function reviewHistoryOwner(row,index,player){
 // Tabs show the player's scoring opportunities, independent of setter/guesser.
 // Shared questions belong to both tabs even when neither player earned points.
 if(row.mode==='approx'||Object.hasOwn(row,'deltas'))return (row.assignedIndices??[0,1]).includes(player);
 const setter=row.setterIndex??((game.startingTeamIndex??0)+index)%2;
 return (row.recipientIndex??awardRecipientIndex(game,setter))===player;
}
function reviewChoiceLabel(row,choice){
 if(row.mode==='approx')return {none:'Никому',a:game.teams[0],b:game.teams[1],both:'Обоим'}[choice];
 if(row.mode==='blitz'&&choice==='failed')return 'Не засчитано';
 if(row.mode==='blitz'&&choice!=='base')return choice+' из '+blitzRequiredForRound(row.review.rules,row.review.round);
 return {failed:'Не угадали',base:'Без усложнения',complete:row.review.round.complication?'С усложнением':'Угадали'}[choice];
}
function reviewDeltaText(row){
 return row.deltas?row.deltas.map((d,i)=>game.teams[i]+': '+(d>0?'+':'')+d).join(' · '):(game.teams[row.recipientIndex]??row.team??'Очки')+': '+(row.awarded>0?'+':'')+row.awarded;
}
// Presentation state is transient: expanding a row never changes game or storage.
const reviewPresentation={modal:{},pending:{}};
function reviewPresentationFor(surface,player){
 const state=reviewPresentation[surface],key=game?.matchId??game;
 if(state.key!==key||state.player!==player){state.key=key;state.player=player;state.expanded=null;}
 return state;
}
function reviewSavedLabel(row){
 if(row.review)return reviewChoiceLabel(row,reviewChoice(row));
 if(row.mode==='approx'||Object.hasOwn(row,'deltas')){
  const recipients=row.recipients??row.deltas?.flatMap((n,i)=>n>0?[i]:[])??[];
  return recipients.length===2?'Обоим':recipients.length?game.teams[recipients[0]]:'Никому';
 }
 return row.outcome==='failed'||row.correct===false?'Не угадали':row.outcome==='base-only'?'Без усложнения':'Угадали';
}
function reviewChoiceColor(row,choice){
 return choice==='failed'||choice==='none'||choice==='0'?'bad':choice==='base'||row.mode==='blitz'&&Number(choice)<blitzRequiredForRound(row.review.rules,row.review.round)?'partial':'good';
}
function reviewButtonsMarkup(match,index,compact=false){
 const row=match.history[index],selected=reviewChoice(row);
 return reviewChoices(row).map(choice=>{
  const color=reviewChoiceColor(row,choice),icon=color==='bad'?'×':color==='partial'?'✓−':'✓';
  let award='';
  if(!compact){
   const alternate=match.history.slice();alternate[index]=changeReviewedOutcome(row,choice);
   award=reviewDeltaText(replayResultHistory(game,alternate,match.tiebreak).history[index]);
  }
  return '<button type="button" class="review-choice review-choice--'+color+(compact?' review-choice--compact':'')+'" data-review-row="'+index+'" data-review-choice="'+choice+'" aria-label="'+escapeHTML('Ход '+(index+1)+'. '+row.word+': '+reviewChoiceLabel(row,choice))+'" aria-pressed="'+(selected===choice)+'"><span class="review-choice-icon" aria-hidden="true">'+icon+'</span>'+
   (compact?'':'<span>'+escapeHTML(reviewChoiceLabel(row,choice))+'</span><small>'+escapeHTML(award)+'</small>')+'</button>';
 }).join('');
}
function reviewedRowDetailsMarkup(match,index,editable){
 const row=match.history[index],round=row.review?.round;
 const setter=row.setterIndex??((game.startingTeamIndex??0)+index)%2,guesser=row.guesserIndex??(game.scoringVersion===2?1-setter:setter);
 const method=row.methodId&&row.methodId!==row.mode?' · '+(getMode(row.methodId)?.title||row.methodId):'';
 const condition=round?displayedRoundCondition(round):row.complication;
 return '<h3>Ход '+(index+1)+' · '+escapeHTML(getMode(row.mode)?.title||row.mode)+escapeHTML(method)+'</h3><p class="review-word">'+escapeHTML(row.word)+'</p>'+
  '<p class="profile-muted">'+(row.mode==='approx'?'Отвечали оба: '+game.teams.map(escapeHTML).join(' · '):'Загадывал: '+escapeHTML(game.teams[setter])+' · Отгадывал: '+escapeHTML(game.teams[guesser]))+'</p>'+
  (condition?'<p class="review-condition">Усложнение: '+escapeHTML(condition)+'</p>':'')+
  (row.mode==='approx'?'<p class="profile-muted">Ответ: '+escapeHTML(row.answer??round?.question?.answer??'')+' '+escapeHTML(row.unit??round?.question?.unit??'')+'</p>':'')+
  '<p class="review-award">'+escapeHTML(reviewDeltaText(row))+(row.risk?' · РИСК: штраф '+(row.penalty??Math.max(0,-row.awarded)):'')+'</p>'+
  (editable?'<div class="review-choices">'+reviewButtonsMarkup(match,index)+'</div>':'<p>'+escapeHTML(reviewSavedLabel(row))+'</p>');
}
function reviewTieDetailsMarkup(match,editable){
 const tie=match.tiebreak;
 return '<h3>Решающий тай-брейк</h3><p class="review-word">'+escapeHTML(tie.question.question)+'</p>'+
  '<p class="profile-muted">Ответ: '+escapeHTML(tie.question.answer)+' '+escapeHTML(tie.question.unit||'')+'</p>'+
  (tie.stage==='decided'?'<p>Очко: '+escapeHTML(game.teams[tie.winnerIndex])+'</p>':'<p>Нужно сравнить ответы.</p>')+
  (editable?'<div class="review-choices">'+['a','b','same'].map((v,i)=>'<button type="button" class="button" data-review-tie="'+v+'" aria-pressed="'+(i<2?tie.winnerIndex===i:tie.stage==='judge'&&tie.winnerIndex===null)+'">'+escapeHTML(i<2?game.teams[i]+' ближе':'Одинаково близко')+'</button>').join('')+'</div>':'');
}
function reviewCompactRow(surface,key,title,summary,controls,details,expanded){
 const id='review-details-'+surface+'-'+key;
 return '<article class="review-row review-row--compact"'+(key!=='tie'?' data-review-turn="'+key+'"':' data-review-tiebreak')+'><div class="review-compact-bar">'+
  '<button type="button" class="review-row-toggle" data-review-expand="'+key+'" aria-expanded="'+expanded+'" aria-controls="'+id+'" title="'+escapeHTML(title)+'"><span class="review-row-title">'+escapeHTML(title)+'</span><span class="review-disclosure" aria-hidden="true">'+(expanded?'▴':'▾')+'</span></button>'+
  (controls?'<div class="review-compact-controls" role="group" aria-label="Исход хода">'+controls+'</div>':'<span class="review-compact-summary">'+escapeHTML(summary)+'</span>')+
  '</div><div class="review-details" id="'+id+'" data-review-details="'+key+'"'+(expanded?'':' hidden')+'>'+details+'</div></article>';
}
function reviewedRowsMarkup(match,player,editable,surface='modal'){
 const state=reviewPresentationFor(surface,player);state.match=match;state.editable=editable;
 const markup=match.history.map((row,index)=>{
  if(!reviewHistoryOwner(row,index,player))return '';
  const expanded=state.expanded===String(index),compact=editable&&row.mode!=='approx'&&row.mode!=='blitz';
  return reviewCompactRow(surface,String(index),(index+1)+'. '+row.word,reviewSavedLabel(row),compact?reviewButtonsMarkup(match,index,true):'',
   expanded?reviewedRowDetailsMarkup(match,index,editable):'',expanded);
 }).join('');
 return markup||'<p class="profile-muted">Завершённых ходов пока нет.</p>';
}
function reviewedTieMarkup(match,player,editable,surface){
 if(!match.tiebreak)return '';
 const state=reviewPresentationFor(surface,player),expanded=state.expanded==='tie',tie=match.tiebreak;
 return reviewCompactRow(surface,'tie','Решающий тай-брейк · '+tie.question.question,
  tie.stage==='decided'?game.teams[tie.winnerIndex]+' ближе':'Сравнить ответы','',expanded?reviewTieDetailsMarkup(match,editable):'',expanded);
}
function toggleReviewedDetails(event,surface){
 if(event.target.closest('[data-review-choice],[data-review-tab],[data-review-tie]'))return false;
 const toggle=event.target.closest('[data-review-expand]')||event.target.closest('.review-compact-bar')?.querySelector('[data-review-expand]');
 if(!toggle)return false;
 const root=surface==='modal'?$('result-history-rows'):document.querySelector('.pending-review-rows');
 if(!root?.contains(toggle))return false;
 const player=surface==='modal'?game.resultEditor?.playerIndex??Number($('result-history-backdrop').dataset.player||0):game.pendingReview?.playerIndex??0;
 const state=reviewPresentationFor(surface,player),key=toggle.dataset.reviewExpand;
 const before=toggle.getBoundingClientRect().top,scroll=root.scrollTop;
 const previous=root.querySelector('[data-review-expand][aria-expanded="true"]');
 const oldDetails=root.querySelector('.review-details:not([hidden])');
 if(previous){previous.setAttribute('aria-expanded','false');previous.querySelector('.review-disclosure').textContent='▾';}
 if(oldDetails){oldDetails.hidden=true;oldDetails.innerHTML='';}
 const open=state.expanded!==key;state.expanded=open?key:null;
 if(open){
  const details=toggle.closest('.review-row').querySelector('.review-details');
  details.innerHTML=key==='tie'?reviewTieDetailsMarkup(state.match,state.editable):reviewedRowDetailsMarkup(state.match,Number(key),state.editable);
  details.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.querySelector('.review-disclosure').textContent='▴';
 }
 root.scrollTop=scroll+toggle.getBoundingClientRect().top-before;
 toggle.focus({preventScroll:true});return true;
}
function reviewFocusSelector(element){
 const choice=element?.closest?.('[data-review-choice]');
 if(choice)return (choice.closest('.review-details')?'.review-details ':'.review-compact-controls ')+'[data-review-row="'+choice.dataset.reviewRow+'"][data-review-choice="'+choice.dataset.reviewChoice+'"]';
 if(element?.dataset.reviewTab!=null)return '[data-review-tab="'+element.dataset.reviewTab+'"]';
 if(element?.dataset.reviewTie)return '[data-review-tie="'+element.dataset.reviewTie+'"]';
 return null;
}
function reviewTabsMarkup(player){
 return game.teams.map((name,i)=>'<button type="button" role="tab" aria-selected="'+(i===player)+'" data-review-tab="'+i+'">'+profileDot(game.profileMatch?.participants[i]?.color||(i===0?'coral':'cyan'))+escapeHTML(name)+'</button>').join('');
}
function renderResultHistory(){
 const e=game?.resultEditor,editable=!!e&&resultReviewPolicy(game)&&!game.reviewConfirmed;
 const player=e?.playerIndex??Number($('result-history-backdrop').dataset.player||0);
 const out=editable?replayResultHistory(game,e.history,e.tiebreak):{history:game.history,scores:game.scores,tiebreak:game.tiebreak};
 $('result-history-title').textContent=game.teams[player]+' — ИСТОРИЯ ОТВЕТОВ';
 $('result-history-tabs').innerHTML=reviewTabsMarkup(player);
 const scroll=$('result-history-rows').scrollTop;
 $('result-history-rows').innerHTML=reviewedRowsMarkup(out,player,editable,'modal')+reviewedTieMarkup(out,player,editable,'modal');
 $('result-history-rows').scrollTop=scroll;
 $('result-history-score').innerHTML=game.teams.map((n,i)=>'<span><small title="'+escapeHTML(n)+'">'+escapeHTML(n)+'</small><b>'+out.scores[i]+'</b></span>').join('');
 $('result-history-save').hidden=!editable;$('result-history-cancel').textContent=editable?'ОТМЕНА':'ЗАКРЫТЬ';
 $('result-history-notice').textContent=editable?(game.current?.feedbackHold?'Таймер удерживается. После закрытия отсчёт продолжится.':'«Сохранить» применяет правки. «Отмена» их отменяет.'):'Ранее завершённая или начатая партия: результаты доступны только для просмотра.';
}
function openResultHistory(player){
 if(!game||![0,1].includes(player)||!$('report-backdrop').hidden)return;
 resultHistoryFocus=document.activeElement;reviewPresentation.modal.expanded=null;
 try{
  const editable=resultReviewPolicy(game)&&!game.reviewConfirmed;
  if(!game.resultEditor)holdFeedbackTimer();
  if(editable&&!game.resultEditor){
   const next=reviewCopy(game);if(next.phase==='rolling')next.phase='task';next.resultEditor={version:1,playerIndex:player,history:reviewCopy(game.history),tiebreak:reviewCopy(game.tiebreak??null)};next.reviewRevision++;
   commitReviewState(next);stopTicking();
  }
  $('result-history-error').textContent='';$('result-history-backdrop').dataset.player=String(player);$('result-history-backdrop').hidden=false;
  renderResultHistory();const shell=document.querySelector?.('.site-shell');if(shell)shell.inert=true;$('result-history-close').focus?.({preventScroll:true});
 }catch(error){toast(error.message);if(!game?.resultEditor&&game?.current?.feedbackHold){try{releaseFeedbackTimer();render();}catch(e){toast(e.message);}}}
}
function restoreResultHistory(){
 if(game?.resultEditor&&$('result-history-backdrop').hidden){$('result-history-backdrop').hidden=false;renderResultHistory();const shell=document.querySelector?.('.site-shell');if(shell)shell.inert=true;$('result-history-close').focus?.({preventScroll:true});}
}
function closeResultHistory(apply=false){
 try{
  if(game?.resultEditor){
   const next=reviewCopy(game),e=next.resultEditor;
   if(apply){
    const out=replayResultHistory(next,e.history,e.tiebreak);
    // Retain an answered/selected tie-break when edits make it temporarily ineligible.
    if(next.tiebreak&&!out.tiebreak)next.reviewTiebreakArchive={version:1,roundIndex:next.roundIndex,tiebreak:reviewCopy(next.tiebreak)};
    next.history=out.history;next.scores=out.scores;next.tiebreak=out.tiebreak;
    if(!next.tiebreak&&scoreNeedsTiebreak(next)&&next.reviewTiebreakArchive?.roundIndex===next.roundIndex){
     next.tiebreak=reviewCopy(next.reviewTiebreakArchive.tiebreak);next.scores=replayResultHistory(next).scores;
    }
    if(next.current&&(scoreMatchComplete(next)||scoreNeedsTiebreak(next)))suspendReviewedRound(next);
    if(!next.current){
     next.phase=game.phase==='review'||scoreMatchComplete(next)||scoreNeedsTiebreak(next)||next.tiebreak?'review':'ready';
     next.pendingReview=next.phase==='review'?{version:1}:null;
    }
    next.reviewRevision++;
   }
   if(next.current?.feedbackHold)next.current=releasedFeedbackRound(next.current);
   delete next.resultEditor;next.reviewRevision++;commitReviewState(next);
  }
  if(!resultReviewPolicy(game)&&game?.current?.feedbackHold)releaseFeedbackTimer();
  $('result-history-backdrop').hidden=true;const shell=document.querySelector?.('.site-shell');if(shell)shell.inert=false;render();
  const target=resultHistoryFocus?.isConnected?resultHistoryFocus:$('match-team-a');target?.focus?.({preventScroll:true});
  return true;
 }catch(error){$('result-history-error').textContent=error.message;return false;}
}
function updateResultHistory(change){
 try{const selector=reviewFocusSelector(document.activeElement);
 const next=reviewCopy(game);change(next.resultEditor);next.reviewRevision++;commitReviewState(next);renderResultHistory();
 if(selector)$('result-history-backdrop').querySelector?.(selector)?.focus?.({preventScroll:true});$('result-history-error').textContent='';}
 catch(error){$('result-history-error').textContent=error.message;}
}
function showPendingReview(){
 $('play-content').className='play-inner is-result-review';$('play-step').textContent='ПРОВЕРКА РЕЗУЛЬТАТОВ';
 const player=game.pendingReview.playerIndex??0;
 $('play-content').innerHTML='<h2 class="play-title">ПРОВЕРКА РЕЗУЛЬТАТОВ</h2>'+
  '<div class="review-tabs" role="tablist" aria-label="История игроков">'+reviewTabsMarkup(player)+'</div>'+
  '<div class="review-final-score">'+game.teams.map((n,i)=>'<span>'+escapeHTML(n)+' <b>'+game.scores[i]+'</b></span>').join('')+'</div>'+
  '<div class="pending-review-rows" tabindex="0" aria-label="Проверка ходов">'+(game.reviewSuspendedRound?'<p class="profile-muted">Текущий ход приостановлен. Если партия продолжится, вернётся то же задание и время.</p>':'')+reviewedRowsMarkup(game,player,true,'pending')+reviewedTieMarkup(game,player,true,'pending')+'</div>'+
  makeButton('ПОДТВЕРДИТЬ РЕЗУЛЬТАТЫ','confirm-results','button-primary button-big');
}
function changePendingReview(event){
 if(game?.phase!=='review')return;
 if(toggleReviewedDetails(event,'pending'))return;
 const tab=event.target.closest('[data-review-tab]'),choice=event.target.closest('[data-review-choice]'),tie=event.target.closest('[data-review-tie]');
 if(!tab&&!choice&&!tie)return;
 try{
  const next=reviewCopy(game);
  if(tab){next.pendingReview.playerIndex=Number(tab.dataset.reviewTab);next.reviewRevision++;}
  if(choice){const i=Number(choice.dataset.reviewRow);next.history[i]=changeReviewedOutcome(next.history[i],choice.dataset.reviewChoice);}
  if(tie){next.tiebreak.winnerIndex=tie.dataset.reviewTie==='same'?null:tie.dataset.reviewTie==='a'?0:1;next.tiebreak.stage=next.tiebreak.winnerIndex===null?'judge':'decided';}
  if(choice||tie){
   const out=replayResultHistory(next);
   if(next.tiebreak&&!out.tiebreak)next.reviewTiebreakArchive={version:1,roundIndex:next.roundIndex,tiebreak:reviewCopy(next.tiebreak)};
   next.history=out.history;next.scores=out.scores;next.tiebreak=out.tiebreak;
   if(!next.tiebreak&&scoreNeedsTiebreak(next)&&next.reviewTiebreakArchive?.roundIndex===next.roundIndex){next.tiebreak=reviewCopy(next.reviewTiebreakArchive.tiebreak);next.scores=replayResultHistory(next).scores;}
   next.reviewRevision++;
  }
  const scroll=document.querySelector?.('.pending-review-rows')?.scrollTop||0;
  commitReviewState(next);renderMatch();showPendingReview();
  const list=document.querySelector?.('.pending-review-rows');if(list)list.scrollTop=tab?0:scroll;
  const selector=reviewFocusSelector(choice||tab||tie);
  $('play-content').querySelector?.(selector)?.focus?.({preventScroll:true});
 }catch(error){toast(error.message);}
}
function registerResultReviewControls(){
 for(const [i,id]of ['a','b'].entries())$('match-team-'+id).addEventListener('click',()=>openResultHistory(i));
 $('result-history-close').addEventListener('click',()=>closeResultHistory(false));$('result-history-cancel').addEventListener('click',()=>closeResultHistory(false));
 $('result-history-save').addEventListener('click',()=>closeResultHistory(true));
 $('result-history-backdrop').addEventListener('click',event=>{
  if(event.target.id==='result-history-backdrop'){closeResultHistory(false);return;}
  if(toggleReviewedDetails(event,'modal'))return;
  const tab=event.target.closest('[data-review-tab]'),choice=event.target.closest('[data-review-choice]'),tie=event.target.closest('[data-review-tie]');
  if(tab){if(game.resultEditor)updateResultHistory(e=>{e.playerIndex=Number(tab.dataset.reviewTab)});else{$('result-history-backdrop').dataset.player=tab.dataset.reviewTab;renderResultHistory();}}
  if(choice)updateResultHistory(e=>{const i=Number(choice.dataset.reviewRow);e.history[i]=changeReviewedOutcome(e.history[i],choice.dataset.reviewChoice);});
  if(tie)updateResultHistory(e=>{e.tiebreak.winnerIndex=tie.dataset.reviewTie==='same'?null:tie.dataset.reviewTie==='a'?0:1;e.tiebreak.stage=e.tiebreak.winnerIndex===null?'judge':'decided';});
 });
 $('play-content').addEventListener('click',changePendingReview);
 document.addEventListener('keydown',event=>{
  if($('result-history-backdrop').hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeResultHistory(false);}
  if(event.key==='Tab'){
   const items=[...$('result-history-backdrop').querySelectorAll('button:not(:disabled)')].filter(el=>!el.closest('[hidden]'));
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 });
}
