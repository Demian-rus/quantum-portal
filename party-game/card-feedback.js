'use strict';
// Approvals reuse TASK017 identity and validation, but have an independent bounded archive.
const QUIP_CARD_APPROVALS_KEY='kvip-card-approvals:v1',QUIP_CARD_APPROVALS_LIMIT=500;
let cardApprovalsBlocked=false;
function validateCardApprovals(data){
 if(!data||Object.keys(data).sort().join('|')!=='items|version'||data.version!==1||!Array.isArray(data.items)||data.items.length>QUIP_CARD_APPROVALS_LIMIT)throw reportError('архив одобрений повреждён или имеет неизвестную версию. Данные сохранены.');
 const keys=new Set();
 for(const row of data.items){
  if(!row||Object.keys(row).sort().join('|')!=='createdAt|item|itemKey|updatedAt')throw reportError('неизвестный формат одобрения.');
  validateReportItem(row.item);
  if(row.itemKey!==reportItemKey(row.item)||keys.has(row.itemKey)||!Number.isSafeInteger(row.createdAt)||row.createdAt<0||!Number.isSafeInteger(row.updatedAt)||row.updatedAt<row.createdAt)throw reportError('повреждена запись одобрения.');
  keys.add(row.itemKey);
 }
 return data;
}
function readCardApprovals(storage=localStorage){
 const raw=storage.getItem(QUIP_CARD_APPROVALS_KEY);
 return {raw,data:raw===null?{version:1,items:[]}:validateCardApprovals(JSON.parse(raw))};
}
// Cross-archive changes are read back and rolled back together. No match/profile keys.
function feedbackArchiveTransaction(storage,action,restoreFirst=QUIP_CARD_REPORTS_KEY){
 if(cardReportsBlocked||cardApprovalsBlocked)throw reportError('запись оценок заблокирована после неподтверждённого сохранения. Экспортируйте журналы и перезапустите приложение.');
 const keys=[QUIP_CARD_REPORTS_KEY,QUIP_CARD_APPROVALS_KEY],raw=keys.map(key=>storage.getItem(key));
 try{return action();}
 catch(error){
  try{
   // Restore the previous rating before removing its confirmed replacement.
   [restoreFirst,...keys.filter(key=>key!==restoreFirst)].forEach(key=>{const i=keys.indexOf(key);if(storage.getItem(key)!==raw[i]){if(raw[i]===null)storage.removeItem(key);else storage.setItem(key,raw[i]);}});
   if(keys.some((key,i)=>storage.getItem(key)!==raw[i]))throw Error('rollback');
  }catch{cardReportsBlocked=true;cardApprovalsBlocked=true;throw reportError('не удалось подтвердить откат оценок. Дальнейшая запись заблокирована.');}
  throw error;
 }
}
function writeCardApprovals(storage,previous,next){
 if(cardApprovalsBlocked)throw reportError('запись одобрений заблокирована. Экспортируйте журнал и перезапустите приложение.');
 validateCardApprovals(next);
 if(storage.getItem(QUIP_CARD_APPROVALS_KEY)!==previous)throw reportError('одобрения изменились. Откройте журнал заново.');
 const text=JSON.stringify(next);
 return feedbackArchiveTransaction(storage,()=>{
  storage.setItem(QUIP_CARD_APPROVALS_KEY,text);
  if(storage.getItem(QUIP_CARD_APPROVALS_KEY)!==text)throw reportError('не удалось подтвердить сохранение одобрения.');
  return next;
 });
}
function saveCardApproval(item,{storage=localStorage,replaceReport=false,expectedReport=null,now=Date.now()}={}){
 validateReportItem(item);if(!Number.isSafeInteger(now)||now<0)throw reportError('неверная дата.');
 const a=readCardApprovals(storage),r=readCardReports(storage),itemKey=reportItemKey(item);
 const approval=a.data.items.find(row=>row.itemKey===itemKey),report=r.data.items.find(row=>row.itemKey===itemKey);
 if(report&&(!replaceReport||JSON.stringify(report)!==expectedReport))return {status:'change-required',report};
 if(approval&&!report)return {status:'exists',row:approval};
 if(!approval&&a.data.items.length>=QUIP_CARD_APPROVALS_LIMIT)throw reportError('сохранено 500 одобрений. Экспортируйте и очистите одобрения; старые записи не удаляются автоматически.');
 const row=approval||{itemKey,item:JSON.parse(JSON.stringify(item)),createdAt:now,updatedAt:now};
 return feedbackArchiveTransaction(storage,()=>{
  if(!approval)writeCardApprovals(storage,a.raw,{version:1,items:[...a.data.items,row]});
  if(report)deleteCardReport(itemKey,JSON.stringify(report),storage);
  return {status:report?'changed':'saved',row};
 });
}
function saveCardFeedbackReport(item,reason,comment='',settings={}){
 const storage=settings.storage||localStorage,a=readCardApprovals(storage),key=reportItemKey(item);
 const approval=a.data.items.find(row=>row.itemKey===key);
 if(approval&&(!settings.replaceApproval||JSON.stringify(approval)!==settings.expectedApproval))return {status:'change-required',approval};
 return feedbackArchiveTransaction(storage,()=>{
  const result=saveCardReport(item,reason,comment,settings);
  if(result.status!=='exists'&&approval)writeCardApprovals(storage,a.raw,{version:1,items:a.data.items.filter(row=>row.itemKey!==key)});
  return result;
 },QUIP_CARD_APPROVALS_KEY);
}
function clearCardApprovals(expectedRaw,storage=localStorage){
 const {raw}=readCardApprovals(storage);if(raw!==expectedRaw)throw reportError('одобрения изменились. Проверьте журнал перед очисткой.');
 return writeCardApprovals(storage,raw,{version:1,items:[]});
}
function createCardFeedbackText(storage=localStorage,exportedAt=Date.now()){
 if(!Number.isSafeInteger(exportedAt)||exportedAt<0)throw reportError('неверная дата.');
 return JSON.stringify({kind:'kvip-card-feedback',version:1,exportedAt,
  approvals:readCardApprovals(storage).data,reports:readCardReports(storage).data},null,2);
}
