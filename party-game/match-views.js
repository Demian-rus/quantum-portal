'use strict';
// Match display views; state, navigation and helpers remain in the existing scripts.

function renderMatch() {
  $('label-team-a').textContent=game.teams[0];
  $('label-team-b').textContent=game.teams[1];
  $('score-a').textContent=game.scores[0];
  $('score-b').textContent=game.scores[1];
  $('round-now').textContent=game.roundIndex+1;
  $('round-total').textContent=game.finishType==='score'?'':game.rounds;
  $('round-total').hidden=game.finishType==='score';
  $('round-slash').hidden=game.finishType==='score';
  $('match-progress').style.width=game.finishType==='score'?(Math.min(100,Math.max(...game.scores)/game.targetScore*100))+'%':(game.roundIndex/game.rounds*100)+'%';
  $('match-team-a').classList.toggle('is-turn',guessingTeamIndex()===0);
  $('match-team-b').classList.toggle('is-turn',guessingTeamIndex()===1);
  const legacy=game.scoringVersion!==2;
  $('role-a').textContent=legacy?(currentTeamIndex()===0?'ХОД':'ЖДЁТ'):(guessingTeamIndex()===0?'ОТГАДЫВАЕТ':'ЗАГАДЫВАЕТ');
  $('role-b').textContent=legacy?(currentTeamIndex()===1?'ХОД':'ЖДЁТ'):(guessingTeamIndex()===1?'ОТГАДЫВАЕТ':'ЗАГАДЫВАЕТ');
  if(game.current&&modeConfigForGame(game,game.current.modeId).supportsSharedAward){
    for(const id of ['a','b']){
      $('role-'+id).textContent='НАЗЫВАЕТ ЧИСЛО';
      $('match-team-'+id).classList.add('is-turn');
    }
  }
  $('match-center-label').textContent=game.finishType==='score'?'ЦЕЛЬ '+game.targetScore:'ПО ЧИСЛУ ХОДОВ';
}

function showBetween() {
  $('play-content').className='play-inner is-between';
  $('play-step').textContent='РАУНД ЗАВЕРШЁН';
  const last=game.history[game.history.length-1];
  $('play-content').innerHTML=
    '<span class="game-eyebrow">СЧЁТ ОБНОВЛЁН</span>'+
    symbol(last.correct?'talk':'secret')+
    '<h2 class="play-title">'+(last.correct?'ЕСТЬ! <em>+'+last.awarded+' ОЧК'+(last.awarded===1?'О':'А')+'</em>':'В СЛЕДУЮЩИЙ <em>РАЗ!</em>')+'</h2>'+
    '<p class="play-subtitle">Следующий ход: <b>'+escapeHTML(currentTeam())+'</b>. Передайте телефон этой команде.</p>'+
    makeButton('СЛЕДУЮЩИЙ ХОД','next','button-primary button-big');
}

function historyMarkup(row,index){
 if(row.mode==='approx')return '<div class="history-row"><span>'+(index+1)+'. ПРИМЕРНО · '+escapeHTML(row.word)+
  ' · Ответ: '+escapeHTML(row.answer)+' '+escapeHTML(row.unit||'')+' · '+
  (row.sharedAward?'Обе команды':row.recipientNames.length?escapeHTML(row.recipientNames.join(', ')):'Никому')+
  '</span><b>'+row.deltas.map(delta=>'+'+delta).join(' / ')+'</b></div>';
 return '<div class="history-row"><span>'+(index+1)+'. '+escapeHTML(row.team)+' · '+
  escapeHTML(getMode(row.mode)?.title||'')+' · '+escapeHTML(row.word)+
  (row.outcome?' · '+(row.outcome==='failed'?'Не угадали':row.outcome==='base-only'?'Без усложнения':row.modifierSuccess===true?'С усложнением':'Угадали'):'')+'</span>'+
  '<b>'+(row.awarded>0?'+'+row.awarded:row.awarded)+'</b></div>';
}

function showResults() {
  setScene('results');
  const [a,b]=game.scores;
  const winner=a===b?'НИЧЬЯ!':(a>b?game.teams[0]:game.teams[1]);
  const item=(index)=>'<div class="final-score-item '+(game.scores[index]===Math.max(a,b)&&a!==b?'is-winner':'')+'">'+
    '<span>'+escapeHTML(game.teams[index])+'</span><b>'+game.scores[index]+'</b><span>ОЧКОВ</span></div>';
  $('results-content').innerHTML=
    '<span class="section-kicker">ПАРТИЯ ЗАВЕРШЕНА</span>'+
    '<div class="result-trophy" aria-hidden="true">'+(a===b?'✳':'🏆')+'</div>'+
    '<h1 class="match-finished">'+(a===b?'ПОБЕДИЛА <em>ДРУЖБА</em>':'ПОБЕДИТЕЛЬ:<br><span style="color:var(--lime)">'+escapeHTML(winner)+'</span>')+'</h1>'+
    '<p class="play-subtitle" style="margin:15px auto">Отличная партия. Но разве это повод останавливаться?</p>'+
    '<div class="final-score">'+item(0)+'<span class="final-score-divider">:</span>'+item(1)+'</div>'+
    '<div class="inline-actions">'+makeButton('СЫГРАТЬ ЕЩЁ','again','button-primary button-big')+
    makeButton('В ГЛАВНОЕ МЕНЮ','menu')+'</div>'+
    '<div class="history-block"><h3>ИСТОРИЯ ХОДОВ</h3>'+
    game.history.map(historyMarkup).join('')+
    '</div>';
}
