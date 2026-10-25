'use strict';
let reportView={item:null,existing:null,editing:false,focus:null,rows:[],raw:null};
function reportHistoryButtons(row,index){
 const words=row.mode==='blitz'&&Array.isArray(row.blitzWords)?row.blitzWords:null;
 return '<div class="report-history-actions">'+(words?words.map((word,i)=>
  '<button type="button" data-report-history="'+index+'" data-report-blitz="'+i+'" aria-label="Замечание к слову '+escapeHTML(word)+'">⚑ '+escapeHTML(word)+'</button>').join(''):
  '<button type="button" data-report-history="'+index+'">⚑ Замечание к заданию</button>')+'</div>';
}
function updateReportFlag(){
 const button=$('report-card');
 const available=game?.phase==='tiebreak';
 button.hidden=!available;button.disabled=!available;button.tabIndex=available?0:-1;
 button.setAttribute('aria-hidden',String(!available));
}
function openReportPanel(){
 reportView.focus=document.activeElement;$('report-backdrop').hidden=false;
 document.querySelector('.site-shell').inert=true;$('report-close').focus({preventScroll:true});
}
function closeReportPanel(){
 const focus=reportView.focus,feedback=focus?.dataset?.feedback;
 let released=false;
 try{released=releaseFeedbackTimer();}catch(error){setReportError(error);return false;}
 $('report-backdrop').hidden=true;document.querySelector('.site-shell').inert=false;
 reportView.item=null;reportView.focus=null;
 if(released)render();
 let target=feedback?document.querySelector('[data-feedback="'+feedback+'"]'):focus;
 if(!target?.isConnected||target===document.body||!target.getClientRects().length)target=document.querySelector('[data-feedback="report"]')||(!$('report-card').hidden?$('report-card'):$('exit-game'));
 target?.focus({preventScroll:true});
 return true;
}
function setReportError(error){$('report-error').textContent=error?.message||String(error||'');}
function openCardReport(item,{hidden=false}={}){
 if(!item)return;
 reportView.item=JSON.parse(JSON.stringify(item));reportView.existing=null;reportView.editing=false;
 $('report-title').textContent='ПОЧЕМУ НЕ НРАВИТСЯ ЗАДАНИЕ?';$('report-list').hidden=true;$('report-editor').hidden=false;
 $('report-target').textContent=hidden?'Задание скрыто. Замечание относится к выбранной карточке.':item.text;
 const level={easy:'Лёгкое',medium:'Среднее',hard:'Сложное'};
 $('report-context').textContent=[item.context==='tiebreak'?'Решающий вопрос':getMode(item.modeId)?.title||'Задание',item.methodId?getMode(item.methodId)?.title:null,level[item.difficulty],item.cardId===null?'Задание из ранее начатой партии':null].filter(Boolean).join(' · ');
 $('report-timer-notice').hidden=!game?.current?.feedbackHold;
 $('report-timer-notice').textContent=game?.current?.feedbackHold?.wasPaused?'Таймер остаётся на паузе.':'Таймер приостановлен. После закрытия отсчёт продолжится.';
 $('report-reason').value='error';$('report-comment').value='';updateReportComment();
 $('report-existing').hidden=true;$('report-save').disabled=false;$('report-save').textContent='ОТПРАВИТЬ ЖАЛОБУ';setReportError('');
 try{
  reportView.existing=readCardReports().data.items.find(row=>row.itemKey===reportItemKey(item))??null;
  if(reportView.existing){
   $('report-existing').hidden=false;$('report-save').disabled=true;
   $('report-reason').value=reportView.existing.reason;$('report-comment').value=reportView.existing.comment;updateReportComment();
  }
 }catch(error){setReportError(error);$('report-save').disabled=true;}
 openReportPanel();
}
function openCurrentCardReport(){
 try{
  if(!currentReportItem(game))return;
  const trigger=document.activeElement;
  const held=holdFeedbackTimer();
  openCardReport(currentReportItem(game),{hidden:!!game?.current&&game.current.question==null&&!game.current.visible&&game.phase!=='judge'});
  reportView.focus=trigger;
  if(held)render();
 }
 catch(error){toast(error.message);}
}
function updateReportComment(){
 $('report-comment-label').hidden=false;
 $('report-comment-count').textContent=Array.from($('report-comment').value).length+' / 160';
}
function saveReportPanel(){
 if(!reportView.item)return;
 try{
  const settings={
   allowUpdate:reportView.editing,expectedRow:reportView.existing?JSON.stringify(reportView.existing):null
  };
  let result=saveCardFeedbackReport(reportView.item,$('report-reason').value,$('report-comment').value,settings);
  if(result.status==='change-required'){
   if(!window.confirm('Заменить одобрение этого задания жалобой?'))return;
   result=saveCardFeedbackReport(reportView.item,$('report-reason').value,$('report-comment').value,{...settings,replaceApproval:true,expectedApproval:JSON.stringify(result.approval)});
   if(result.status==='change-required')throw reportError('одобрение изменилось. Повторите выбор.');
  }
  if(result.status==='exists'){
   reportView.existing=result.row;$('report-existing').hidden=false;$('report-save').disabled=true;setReportError('Для этой карточки уже есть замечание. Нажмите «Изменить замечание».');return;
  }
  reportView.existing=result.row;$('report-save').disabled=true;
  renderReportsCount();if(!closeReportPanel())return;
  toast(result.status==='updated'?'Замечание обновлено':'Замечание сохранено на устройстве');
 }catch(error){setReportError(error);}
}
function renderReportsCount(){
 try{const {data}=readCardReports();$('reports-count').textContent='Жалоб: '+data.items.length+' / 500';}
 catch(error){$('reports-count').textContent=error.message;}
 try{const {data}=readCardApprovals();$('approvals-count').textContent='Одобрений: '+data.items.length+' / 500';$('approvals-clear').disabled=data.items.length===0;}
 catch(error){$('approvals-count').textContent=error.message;$('approvals-clear').disabled=true;}
}
function openReportsList(){
 $('report-title').textContent='ЗАМЕЧАНИЯ К ЗАДАНИЯМ';$('report-editor').hidden=true;$('report-list').hidden=false;setReportError('');
 reportView.item=null;reportView.rows=[];
 try{
  const {raw,data}=readCardReports();reportView.raw=raw;reportView.rows=data.items;
  $('report-list-rows').innerHTML=data.items.map((row,i)=>'<article class="report-list-row"><strong>'+escapeHTML(row.item.text)+'</strong><p>'+escapeHTML(QUIP_REPORT_REASONS[row.reason])+(row.comment?' · '+escapeHTML(row.comment):'')+'</p><div><button type="button" data-report-edit="'+i+'">ПРОСМОТР / ИЗМЕНИТЬ</button><button type="button" data-report-delete="'+i+'">УДАЛИТЬ</button></div></article>').join('')||'<p class="profile-muted">Замечаний пока нет.</p>';
  $('reports-clear').disabled=data.items.length===0;
 }catch(error){$('report-list-rows').textContent='Журнал не изменён.';$('reports-clear').disabled=true;setReportError(error);}
 openReportPanel();
}
function reportsDownload(){
 try{
  const text=createCardReportsText(),now=new Date();
  const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='kvip-card-reports-'+date+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  toast('Файл замечаний подготовлен к сохранению');
 }catch(error){toast(error.message);}
}
function reportPanelKeydown(event){
 if($('report-backdrop').hidden)return;
 if(event.key==='Escape'){event.preventDefault();closeReportPanel();return;}
 if(event.key==='Tab'){
  const items=[...$('report-backdrop').querySelectorAll('button:not(:disabled),input,textarea,select')].filter(el=>!el.closest('[hidden]'));
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
}
function registerCardReportControls(){
 $('report-card').addEventListener('click',event=>{event.stopPropagation();if(game?.phase==='tiebreak')openCurrentCardReport();});
 $('report-close').addEventListener('click',closeReportPanel);$('report-cancel').addEventListener('click',closeReportPanel);
 $('report-backdrop').addEventListener('click',event=>{if(event.target.id==='report-backdrop')closeReportPanel();});
 $('report-reason').addEventListener('change',updateReportComment);$('report-comment').addEventListener('input',updateReportComment);
 $('report-save').addEventListener('click',saveReportPanel);
 $('report-edit-existing').addEventListener('click',()=>{reportView.editing=true;$('report-existing').hidden=true;$('report-save').disabled=false;$('report-save').textContent='СОХРАНИТЬ ИЗМЕНЕНИЯ';});
 $('reports-view').addEventListener('click',openReportsList);$('reports-export').addEventListener('click',reportsDownload);
 $('report-list-rows').addEventListener('click',event=>{
  const edit=event.target.closest('[data-report-edit]'),remove=event.target.closest('[data-report-delete]');
  if(edit){const row=reportView.rows[Number(edit.dataset.reportEdit)];if(row){closeReportPanel();openCardReport(row.item);}}
  if(remove){const row=reportView.rows[Number(remove.dataset.reportDelete)];if(!row||!window.confirm('Удалить это замечание?'))return;
   try{deleteCardReport(row.itemKey,JSON.stringify(row));closeReportPanel();openReportsList();renderReportsCount();}catch(error){setReportError(error);}}
 });
 $('reports-clear').addEventListener('click',()=>{
  if(!window.confirm('Удалить все замечания с этого устройства? Сначала экспортируйте их, если хотите сохранить.'))return;
  try{clearCardReports(reportView.raw);closeReportPanel();openReportsList();renderReportsCount();}catch(error){setReportError(error);}
 });
 $('results-content').addEventListener('click',event=>{
  if(event.target.closest('#report-final-tiebreak')){openCardReport(makeReportItem(game,{tiebreak:true}));return;}
  const button=event.target.closest('[data-report-history]');if(!button)return;
  try{const row=game?.history?.[Number(button.dataset.reportHistory)];if(row)openCardReport(makeReportItem(game,{row,blitzIndex:button.hasAttribute('data-report-blitz')?Number(button.dataset.reportBlitz):null}));}
  catch(error){toast(error.message);}
 });
 document.addEventListener('keydown',reportPanelKeydown);
}
