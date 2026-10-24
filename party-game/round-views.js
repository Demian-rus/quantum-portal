'use strict';
// Display-only round views; state and helpers remain in the existing scripts.

function showReady() {
  $('play-content').className='play-inner is-ready';
  $('play-step').textContent='ПЕРЕДАЙТЕ ТЕЛЕФОН ЗАГАДЫВАЮЩЕМУ';
  const index=currentTeamIndex();
  const team=escapeHTML(currentTeam()),opponent=escapeHTML(guessingTeam());
  $('play-content').innerHTML=
    '<div class="ready-content">'+
      '<div class="ready-avatar '+(index===1?'is-blue':'')+'">'+modeArt('secret')+'</div>'+
      '<h2 class="play-title">'+(game.scoringVersion===2?'ЗАГАДЫВАЕТ':'НА ОЧЕРЕДИ')+'<br><em>'+team+'</em></h2>'+
      '<p class="play-subtitle">'+(game.scoringVersion===2?'<strong>'+opponent+'</strong> отгадывает. Очки получает <strong>'+escapeHTML(awardTeam())+'</strong>. Задание видит только загадывающий.':'Продолжение сохранённой партии по прежним правилам: очки получает команда текущего хода.')+'</p>'+
    '</div>'+
    '<div class="ready-action-slot">'+
      makeButton(game.dice?'ВЫБРАТЬ РЕЖИМ':'ПОЛУЧИТЬ ЗАДАНИЕ','roll','button-primary button-big')+
    '</div>';
}

function showTask() {
  $('play-content').className='play-inner is-task stable-round';
  const {mode,secret,name}=modeInformation();
  $('play-step').textContent=game.scoringVersion===2?'ЗАГАДЫВАЕТ: '+currentTeam():'ЗАДАНИЕ ДЛЯ '+currentTeam();
  const c=game.current;
  $('play-content').innerHTML=
    '<div class="round-top round-top--task" tabindex="0" role="region" aria-label="Условия раунда">'+
      symbol(mode.id)+
      '<h2 class="play-title mode-name">'+escapeHTML(name)+'</h2>'+
      roundConditionMarkup()+
      (secret?'<span class="secret-flag">СЕКРЕТКА · +'+c.points+' '+pointNoun(c.points)+'</span>':
        '<span class="score-note">ЗА ВЕРНЫЙ ОТВЕТ: +'+(c.modeId==='blitz'?(game.scoringVersion===2?c.points+' ЗА ВСЕ '+c.blitzWords.length+' СЛОВ':'1 ЗА СЛОВО'):c.points)+'</span>')+
    (c.risk?'<p class="risk-notice">⚡ РИСК-РАУНД: ПРОВАЛ — ДО −'+ruleSetForGame(game).risk.loss+' ОЧКОВ</p>':'')+
    '</div>'+
    '<div class="round-fixed-card">'+taskMarkup(!c.visible)+'</div>'+
    '<div class="round-bottom round-bottom--task">'+taskControls(c)+'</div>';
}

function showJudge() {
  $('play-content').className='play-inner is-judge verdict-round';
  $('play-step').textContent='ИТОГ РАУНДА';
  const c=game.current,blitz=c.modeId==='blitz';
  const incompleteBlitz=blitz&&game.scoringVersion===2&&c.blitzCorrect<blitzRequiredForRound(game,c);
  const points=allowsModifierResult()?'Основа +'+c.basePoints+' · усложнение +'+c.modifierPoints:
    'Награда: +'+(blitz&&ruleSetForGame(game).legacyBlitz?c.blitzCorrect:incompleteBlitz?0:c.points);
  $('play-content').innerHTML='<div class="judge-copy" tabindex="0" role="region" aria-label="Итог раунда">'+
    '<span class="game-eyebrow">'+(c.finishedReason==='timeout'?'ВРЕМЯ ВЫШЛО':'РАУНД ЗАКОНЧЕН')+'</span>'+
    symbol(blitz?'blitz':c.methodId)+
    '<h2 class="play-title"><span class="judge-team-name'+(guessingTeam().length>16?' judge-team-name--long':'')+'">'+displayTeamName(guessingTeam())+'</span> <em>УГАДАЛИ?</em></h2>'+
    '<p class="score-note">'+(blitz?'Отгадано '+c.blitzCorrect+' из '+c.blitzWords.length+(ruleSetForGame(game).legacyBlitz?'. За каждое отгаданное слово — одно очко (старая партия).':''):'Было загадано: <b>'+escapeHTML(c.word)+'</b>')+'</p>'+
    '<p class="score-note">'+points+'</p>'+
    '<p class="score-recipient">Очки получит <b>'+escapeHTML(awardTeam())+'</b></p>'+
    (c.risk?'<p class="risk-notice">⚡ Провал: до −'+ruleSetForGame(game).risk.loss+' очков у '+escapeHTML(awardTeam())+'</p>':'')+
    '</div><div class="round-bottom round-bottom--judge">'+
    (incompleteBlitz?'<div class="incomplete-blitz">'+makeButton('ЗАВЕРШИТЬ РАУНД','no','button-primary')+'</div>':resultControls())+'</div>';
}
