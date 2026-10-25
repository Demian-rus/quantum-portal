'use strict';
let resultHistoryFocus=null;
function reviewHistoryOwner(row,index,player){
 // The panel follows the owner of the task, with shared questions in both tabs.
 // Every row separately names setter, guesser and actual score recipients.
 return row.assignedIndices?.includes(player)??((row.setterIndex??((game.startingTeamIndex??0)+index)%2)===player);
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
function reviewedRowsMarkup(match,player,editable){
 const history=match.history;
 return history.map((row,index)=>{
  if(!reviewHistoryOwner(row,index,player))return '';
  const setter=row.setterIndex??((game.startingTeamIndex??0)+index)%2,guesser=row.guesserIndex??(game.scoringVersion===2?1-setter:setter);
  const selected=editable?reviewChoice(row):null;
  const choices=editable?reviewChoices(row).map(choice=>{
   const alternate=history.slice();alternate[index]=changeReviewedOutcome(row,choice);
   const preview=replayResultHistory(game,alternate,match.tiebreak).history[index];
   const color=choice==='failed'||choice==='none'||choice==='0'?'bad':choice==='base'||row.mode==='blitz'&&Number(choice)<blitzRequiredForRound(row.review.rules,row.review.round)?'partial':'good';
   return '<button type="button" class="review-choice review-choice--'+color+'" data-review-row="'+index+'" data-review-choice="'+choice+'" aria-pressed="'+(selected===choice)+'"><span class="review-choice-icon" aria-hidden="true">'+(color==='bad'?'×':color==='partial'?'✓−':'✓')+'</span><span>'+escapeHTML(reviewChoiceLabel(row,choice))+'</span><small>'+escapeHTML(reviewDeltaText(preview))+'</small></button>';
  }).join(''):'';
  return '<article class="review-row" data-review-turn="'+index+'"><h3>Ход '+(index+1)+' · '+escapeHTML(getMode(row.mode)?.title||row.mode)+'</h3><p class="review-word">'+escapeHTML(row.word)+'</p>'+
   '<p class="profile-muted">Загадывал: '+escapeHTML(game.teams[setter])+' · Отгадывал: '+escapeHTML(game.teams[guesser])+'</p>'+
   '<p class="review-award">'+escapeHTML(reviewDeltaText(row))+(row.risk?' · РИСК: штраф '+(row.penalty??Math.max(0,-row.awarded)):'')+'</p>'+
   (editable?'<div class="review-choices">'+choices+'</div>':'<p>'+escapeHTML(row.outcome==='failed'||row.correct===false?'Не угадали':row.outcome==='base-only'?'Без усложнения':'Угадали')+'</p>')+'</article>';
 }).join('')||'<p class="profile-muted">Завершённых ходов пока нет.</p>';
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
 $('result-history-rows').innerHTML=reviewedRowsMarkup(out,player,editable)+
  (out.tiebreak?'<article class="review-row"><h3>Решающий тай-брейк</h3><p>'+escapeHTML(out.tiebreak.question.question)+'</p>'+
   (out.tiebreak.stage==='decided'?'<p>Очко: '+escapeHTML(game.teams[out.tiebreak.winnerIndex])+'</p>':'<p>Нужно сравнить ответы.</p>')+
   (editable?'<div class="review-choices">'+['a','b','same'].map((v,i)=>'<button type="button" class="button" data-review-tie="'+v+'" aria-pressed="'+(out.tiebreak.winnerIndex===i)+'">'+escapeHTML(i<2?game.teams[i]+' ближе':'Одинаково близко')+'</button>').join('')+'</div>':'')+'</article>':'');
 $('result-history-rows').scrollTop=scroll;
 $('result-history-score').innerHTML=game.teams.map((n,i)=>'<span><small title="'+escapeHTML(n)+'">'+escapeHTML(n)+'</small><b>'+out.scores[i]+'</b></span>').join('');
 $('result-history-save').hidden=!editable;$('result-history-cancel').textContent=editable?'ОТМЕНА':'ЗАКРЫТЬ';
 $('result-history-notice').textContent=editable?(game.current?.feedbackHold?'Таймер удерживается. После закрытия отсчёт продолжится.':'«Сохранить» применяет правки. «Отмена» их отменяет.'):'Ранее завершённая или начатая партия: результаты доступны только для просмотра.';
}
function openResultHistory(player){
 if(!game||![0,1].includes(player)||!$('report-backdrop').hidden)return;
 resultHistoryFocus=document.activeElement;
 try{
  const editable=resultReviewPolicy(game)&&!game.reviewConfirmed;
  if(!game.resultEditor)holdFeedbackTimer();
  if(editable&&!game.resultEditor){
   const next=reviewCopy(game);next.resultEditor={version:1,playerIndex:player,history:reviewCopy(game.history),tiebreak:reviewCopy(game.tiebreak??null)};next.reviewRevision++;
   commitReviewState(next);stopTicking();
  }
  $('result-history-error').textContent='';$('result-history-backdrop').dataset.player=String(player);$('result-history-backdrop').hidden=false;
  renderResultHistory();$('result-history-close').focus?.({preventScroll:true});
 }catch(error){toast(error.message);if(!game?.resultEditor&&game?.current?.feedbackHold){try{releaseFeedbackTimer();render();}catch(e){toast(e.message);}}}
}
function restoreResultHistory(){
 if(game?.resultEditor&&$('result-history-backdrop').hidden){$('result-history-backdrop').hidden=false;renderResultHistory();$('result-history-close').focus?.({preventScroll:true});}
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
  $('result-history-backdrop').hidden=true;render();
  const target=resultHistoryFocus?.isConnected?resultHistoryFocus:$('match-team-a');target?.focus?.({preventScroll:true});
  return true;
 }catch(error){$('result-history-error').textContent=error.message;return false;}
}
function updateResultHistory(change){
 try{const next=reviewCopy(game);change(next.resultEditor);next.reviewRevision++;commitReviewState(next);renderResultHistory();$('result-history-error').textContent='';}
 catch(error){$('result-history-error').textContent=error.message;}
}
function showPendingReview(){
 $('play-content').className='play-inner is-result-review';$('play-step').textContent='ПРОВЕРКА РЕЗУЛЬТАТОВ';
 const player=game.pendingReview.playerIndex??0;
 $('play-content').innerHTML='<h2 class="play-title">ПРОВЕРКА РЕЗУЛЬТАТОВ</h2>'+
  '<div class="review-tabs" role="tablist" aria-label="История игроков">'+reviewTabsMarkup(player)+'</div>'+
  '<div class="review-final-score">'+game.teams.map((n,i)=>'<span>'+escapeHTML(n)+' <b>'+game.scores[i]+'</b></span>').join('')+'</div>'+
  '<div class="pending-review-rows" tabindex="0" aria-label="Проверка ходов">'+reviewedRowsMarkup(game,player,true)+
  (game.tiebreak?'<article class="review-row"><h3>Решающий тай-брейк</h3><p>'+escapeHTML(game.tiebreak.question.question)+'</p><div class="review-choices">'+['a','b','same'].map((v,i)=>'<button type="button" class="button" data-review-tie="'+v+'" aria-pressed="'+(game.tiebreak.winnerIndex===i)+'">'+escapeHTML(i<2?game.teams[i]+' ближе':'Одинаково близко')+'</button>').join('')+'</div></article>':'')+'</div>'+
  makeButton('ПОДТВЕРДИТЬ РЕЗУЛЬТАТЫ','confirm-results','button-primary button-big');
}
function changePendingReview(event){
 if(game?.phase!=='review')return;
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
  const selector=choice?'[data-review-row="'+choice.dataset.reviewRow+'"][data-review-choice="'+choice.dataset.reviewChoice+'"]':tab?'[data-review-tab="'+tab.dataset.reviewTab+'"]':'[data-review-tie="'+tie.dataset.reviewTie+'"]';
  $('play-content').querySelector?.(selector)?.focus?.({preventScroll:true});
 }catch(error){toast(error.message);}
}
function registerResultReviewControls(){
 for(const [i,id]of ['a','b'].entries())$('match-team-'+id).addEventListener('click',()=>openResultHistory(i));
 $('result-history-close').addEventListener('click',()=>closeResultHistory(false));$('result-history-cancel').addEventListener('click',()=>closeResultHistory(false));
 $('result-history-save').addEventListener('click',()=>closeResultHistory(true));
 $('result-history-backdrop').addEventListener('click',event=>{
  if(event.target.id==='result-history-backdrop'){closeResultHistory(false);return;}
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
