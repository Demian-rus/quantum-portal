'use strict';
const FEEDBACK_ICONS=Object.freeze({
 up:'<path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 1 2 4l-1 4h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7"/>',
 down:'<path d="M7 14V3H3v11h4Zm0 0 5 8c2 0 3-1 2-4l-1-4h6a2 2 0 0 0 2-2l-2-7a3 3 0 0 0-3-2H7"/>'
});
function feedbackButtonMarkup(positive){
 return '<button type="button" class="card-rating card-rating--'+(positive?'up':'down')+'" data-feedback="'+(positive?'approve':'report')+'" aria-label="'+(positive?'Нравится задание':'Не нравится задание')+'"'+(positive?' aria-pressed="false"':' aria-haspopup="dialog"')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+FEEDBACK_ICONS[positive?'up':'down']+'</svg></button>';
}
function refreshCardApproval(){
 const pause=$('timer-pause-control');pause.hidden=game?.phase!=='play'||!allowPause();
 if(!pause.hidden){pause.dataset.action=game.current.paused?'resume':'pause';pause.setAttribute('aria-label',game.current.paused?'Продолжить':'Пауза');pause.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'+CONTROL_ICONS[game.current.paused?'play':'pause']+'</svg>';}
 else{delete pause.dataset.action;pause.innerHTML='';}
 const button=document.querySelector?.('[data-feedback="approve"]');if(!button)return;
 try{const item=currentReportItem(game),exists=item&&readCardApprovals().data.items.some(row=>row.itemKey===reportItemKey(item));button.setAttribute('aria-pressed',String(!!exists));}catch{/* A read error is explained on the explicit action, never rewritten. */}
}
function approveCurrentCard(){
 try{
  const item=currentReportItem(game);if(!item)return;
  let result=saveCardApproval(item);
  if(result.status==='change-required'){
   if(!window.confirm('Заменить жалобу на это задание положительной оценкой?'))return;
   result=saveCardApproval(item,{replaceReport:true,expectedReport:JSON.stringify(result.report)});
   if(result.status==='change-required')throw reportError('жалоба изменилась. Повторите выбор.');
  }
  refreshCardApproval();renderReportsCount();
  const button=document.querySelector?.('[data-feedback="approve"]');button?.classList.add('is-confirmed');setTimeout(()=>button?.classList.remove('is-confirmed'),700);
  toast(result.status==='exists'?'Вы уже одобрили это задание':'Одобрение сохранено');
 }catch(error){toast(error.message);}
}
function feedbackFile(){
 const date=new Date().toISOString().slice(0,10);
 return new File([createCardFeedbackText()],'kvip-card-feedback-'+date+'.json',{type:'application/json'});
}
function downloadCardFeedback(){
 try{
  const text=createCardFeedbackText(),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='kvip-card-feedback-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  toast('JSON с одобрениями и жалобами подготовлен');
 }catch(error){toast(error.message);}
}
let feedbackSharing=false;
async function shareCardFeedback(){
 if(feedbackSharing)return;
 try{
  if(typeof File!=='function'||!navigator.share||!navigator.canShare){toast('Системное меню недоступно. Нажмите «СКАЧАТЬ JSON».');return;}
  const file=feedbackFile();
  if(!navigator.share||!navigator.canShare?.({files:[file]})){toast('Системное меню недоступно. Нажмите «СКАЧАТЬ JSON».');return;}
  feedbackSharing=true;$('feedback-share').disabled=true;
  // Keep the platform call in the click's transient activation; no preceding await.
  await navigator.share({files:[file],title:'КВИП — оценки заданий'});
  toast('Файл передан системному меню');
 }catch(error){toast(error.name==='AbortError'?'Передача отменена. Оценки сохранены.':'Передача не выполнена. Скачайте JSON; оценки сохранены.');}
 finally{feedbackSharing=false;$('feedback-share').disabled=false;}
}
function restoreFeedbackPanel(){
 if(game?.current?.feedbackHold&&!game?.resultEditor&&$('report-backdrop').hidden)openCurrentCardReport();
}
function registerCardFeedbackControls(){
 $('timer-pause-control').addEventListener('click',()=>handleAction($('timer-pause-control').dataset.action));
 $('play-content').addEventListener('click',event=>{
  const button=event.target.closest('[data-feedback]');if(!button)return;
  event.stopPropagation();button.dataset.feedback==='approve'?approveCurrentCard():openCurrentCardReport();
 });
 $('feedback-share').addEventListener('click',shareCardFeedback);$('feedback-download').addEventListener('click',downloadCardFeedback);
 $('approvals-clear').addEventListener('click',()=>{
  try{
   const {raw}=readCardApprovals();if(!window.confirm('Удалить все одобрения с этого устройства? Сначала сохраните JSON, если они нужны.'))return;
   clearCardApprovals(raw);renderReportsCount();toast('Одобрения очищены');
  }catch(error){toast(error.message);}
 });
}
