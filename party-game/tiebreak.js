'use strict';
// Shared numerical tie-break: a separate contest, never an ordinary round.
const QUIP_TIEBREAK_VERSION=1;
function validateTiebreakState(match){
 const tie=match?.tiebreak;
 if(tie==null)return;
 if(finishPolicyVersion(match)!==1||match.finishType!=='score'||!tie||
    tie.version!==QUIP_TIEBREAK_VERSION||!['question','judge','decided'].includes(tie.stage)||
    !Array.isArray(tie.attempted)||tie.attempted.length>120||
    new Set(tie.attempted).size!==tie.attempted.length||
    tie.attempted.some(id=>typeof id!=='string'||!/^approx-[a-z0-9-]+$/.test(id))||
    !tie.question||!tie.attempted.includes(tie.question.id)||
    typeof tie.question.question!=='string'||typeof tie.question.answer!=='string'||
    typeof tie.question.unit!=='string'||typeof tie.question.note!=='string'||
    !['easy','medium','hard'].includes(tie.question.difficulty)||
    !(tie.winnerIndex===null||[0,1].includes(tie.winnerIndex))||
    (tie.stage==='decided')!==(tie.winnerIndex!==null)||
    (tie.stage==='decided')!==(match.phase==='results')||
    match.roundIndex%2!==0||match.roundIndex<2||
    (tie.winnerIndex===null?match.scores[0]!==match.scores[1]:
      match.scores[tie.winnerIndex]!==match.scores[1-tie.winnerIndex]+1)||
    Math.max(...match.scores)<match.targetScore)throw Error('Invalid saved QUIP tiebreak');
}
function nextTiebreakQuestion(attempted=[]){
 if(attempted.length>=120)return null;
 const levels=game.difficulty==='mixed'?['medium','easy','hard']:
  [game.difficulty,...['medium','easy','hard'].filter(level=>level!==game.difficulty)];
 for(const level of levels){
  const pool=getPackQuestionPool(game.contentPack,level).filter(q=>!attempted.includes(q.id));
  if(pool.length){
   const q=pullApproxQuestion(level,attempted);
   return {id:q.id,question:q.question,answer:String(q.answer),unit:String(q.unit||''),
     note:String(q.note||''),difficulty:level};
  }
 }
 return null;
}
function beginTiebreak(){
 if(!scoreNeedsTiebreak(game))return false;
 const question=nextTiebreakQuestion();
 if(!question)return false; // No numeric cards in the pinned theme: continue paired turns.
 game.tiebreak={version:QUIP_TIEBREAK_VERSION,stage:'question',question,
   attempted:[question.id],winnerIndex:null};
 game.phase='tiebreak';
 return true;
}
function revealTiebreak(){
 if(game?.phase!=='tiebreak'||game.tiebreak?.stage!=='question')return;
 game.tiebreak.stage='judge';persist();render();
}
function settleTiebreak(choice){
 if(game?.phase!=='tiebreak'||game.tiebreak?.stage!=='judge')return;
 if(choice==='same'){
  const question=nextTiebreakQuestion(game.tiebreak.attempted);
  if(!question){
   game.tiebreak=null;game.phase='ready';
   persist();toast('Числовые вопросы закончились. Продолжаем обычные ходы.');render();return;
  }
  game.tiebreak.question=question;game.tiebreak.attempted.push(question.id);
  game.tiebreak.stage='question';persist();render();return;
 }
 const winner=choice==='a'?0:choice==='b'?1:null;
 if(winner===null)return;
 game.tiebreak.winnerIndex=winner;game.tiebreak.stage='decided';
 game.scores[winner]+=1;game.phase='results';
 archiveCurrentTaskHistory();stopTicking();persist();
 saveCompletedProfileResult();sfx('win');render();
}
function showTiebreak(){
 $('play-content').className='play-inner is-approx is-tiebreak';
 $('play-step').textContent='РЕШАЮЩИЙ ОБЩИЙ ВОПРОС';
 const tie=game.tiebreak,shown=tie.stage==='judge';
 $('play-content').innerHTML=
  '<div class="approx-heading">'+symbol('approx')+'<h2 class="play-title">ТАЙ-БРЕЙК</h2>'+
    '<p class="play-subtitle">'+(shown?'Сравните ответы. Кто оказался ближе к правильному числу?':
      'Оба назовите свой ответ. Победит тот, кто ближе к правильному числу.')+'</p></div>'+
  '<div class="approx-card'+(shown?' is-revealed':'')+'">'+
    (shown?'<div class="approx-answer"><span>ПРАВИЛЬНЫЙ ОТВЕТ</span><strong>'+
       escapeHTML(tie.question.answer)+' '+escapeHTML(tie.question.unit)+'</strong></div>':'')+
    '<div class="approx-copy" tabindex="0" aria-label="Решающий вопрос">'+
      '<p class="approx-question">'+escapeHTML(tie.question.question)+'</p>'+
      (shown&&tie.question.note?'<p class="approx-note">'+escapeHTML(tie.question.note)+'</p>':'')+
    '</div></div>'+
  '<div class="approx-actions">'+(shown?
    makeButton(escapeHTML(game.teams[0])+' ближе','tiebreak-a','button-primary')+
    makeButton(escapeHTML(game.teams[1])+' ближе','tiebreak-b','button-coral')+
    makeButton('Одинаково близко','tiebreak-same','button-secondary'):
    makeButton('Показать ответ','tiebreak-reveal','button-primary button-big'))+
   '</div>';
}
