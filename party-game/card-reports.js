'use strict';
// Independent bounded editorial archive; no profiles, match IDs, scores or RNG.
const QUIP_CARD_REPORTS_KEY='kvip-card-reports:v1';
const QUIP_CARD_REPORTS_LIMIT=500;
const QUIP_REPORT_REASONS=Object.freeze({error:'Ошибка / неверный ответ',ambiguous:'Неоднозначно',hard:'Слишком сложно',duplicate:'Дубликат',theme:'Не подходит теме',other:'Другое'});
let cardReportsBlocked=false;
function reportError(message){return Error('Замечания: '+message);}
function reportComment(text){return String(text??'').normalize('NFKC').replace(/\s+/gu,' ').trim();}
function reportId(value){return typeof value==='string'&&/^[a-z][a-z0-9_-]{0,159}$/.test(value);}
function reportItemKey(item){
 const source=[item.pack?.id??null,item.pack?.version??null];
 return JSON.stringify(item.cardId!==null?[...source,'id',item.cardId]:[...source,'legacy',item.context,item.modeId,item.methodId,item.difficulty,item.text]);
}
function validateReportItem(item){
 if(!item||typeof item!=='object'||Array.isArray(item)||
  Object.keys(item).sort().join('|')!=='cardId|context|difficulty|methodId|modeId|pack|text'||
  item.cardId!==null&&!reportId(item.cardId)||!['round','tiebreak'].includes(item.context)||
  !reportId(item.modeId)||item.methodId!==null&&!reportId(item.methodId)||
  item.difficulty!==null&&!['easy','medium','hard'].includes(item.difficulty)||
  typeof item.text!=='string'||!item.text||item.text.length>4000||
  item.pack!==null&&(!item.pack||Object.keys(item.pack).sort().join('|')!=='id|version'||!reportId(item.pack.id)||!Number.isSafeInteger(item.pack.version)||item.pack.version<1))throw reportError('не удалось определить исходное задание.');
 return item;
}
function makeReportItem(match,{current=match?.current,tiebreak=false,row=null,blitzIndex=null}={}){
 const pack=match?.contentPack?{id:match.contentPack.id,version:match.contentPack.version}:null;
 let item;
 if(tiebreak){const q=match?.tiebreak?.question;if(!q)return null;
  item={cardId:q.id??null,pack,context:'tiebreak',modeId:'approx',methodId:null,difficulty:q.difficulty??null,text:q.question};
 }else if(row){
  const blitz=Number.isInteger(blitzIndex)&&Array.isArray(row.blitzWords);
  if(blitz&&(blitzIndex<0||blitzIndex>=row.blitzWords.length))return null;
  item={cardId:blitz?row.blitzCardIds?.[blitzIndex]??null:row.questionId??row.cardId??null,
   pack,context:'round',modeId:row.mode,methodId:row.mode==='secret'?row.methodId??null:null,
   difficulty:row.difficulty??null,text:blitz?row.blitzWords[blitzIndex]:row.word};
 }else{
  if(!current)return null;
  const index=current.modeId==='blitz'?(current.blitzQueue?.[0]??Math.min(current.blitzIndex??0,(current.blitzWords?.length??1)-1)):null;
  // A completed Blitz queue refers to the last shown word, never an invented ID.
  const id=current.modeId==='blitz'?(current.blitzQueue?.length?current.blitzCardIds?.[index]:current.cardId):current.cardId;
  item={cardId:current.question?.id??id??null,pack,context:'round',modeId:current.modeId,
   methodId:current.modeId==='secret'?current.methodId??null:null,difficulty:current.difficulty??null,
   text:current.question?.question??current.word};
 }
 return validateReportItem(item);
}
function currentReportItem(match){
 if(match?.phase==='tiebreak')return makeReportItem(match,{tiebreak:true});
 if(!['task','countdown','play','judge'].includes(match?.phase))return null;
 return makeReportItem(match);
}
function validateCardReports(data){
 if(!data||Object.keys(data).sort().join('|')!=='items|version'||data.version!==1||!Array.isArray(data.items)||data.items.length>QUIP_CARD_REPORTS_LIMIT)throw reportError('журнал повреждён или имеет неизвестную версию. Исходные данные сохранены.');
 const keys=new Set();
 for(const row of data.items){
  if(!row||Object.keys(row).sort().join('|')!=='comment|createdAt|item|itemKey|reason|updatedAt')throw reportError('неизвестный формат записи.');
  validateReportItem(row.item);
  if(row.itemKey!==reportItemKey(row.item)||keys.has(row.itemKey)||!Object.hasOwn(QUIP_REPORT_REASONS,row.reason)||
   typeof row.comment!=='string'||row.comment!==reportComment(row.comment)||Array.from(row.comment).length>160||
   !Number.isSafeInteger(row.createdAt)||row.createdAt<0||!Number.isSafeInteger(row.updatedAt)||row.updatedAt<row.createdAt)throw reportError('повреждена запись журнала.');
  keys.add(row.itemKey);
 }
 return data;
}
function readCardReports(storage=localStorage){
 const raw=storage.getItem(QUIP_CARD_REPORTS_KEY);
 return {raw,data:raw===null?{version:1,items:[]}:validateCardReports(JSON.parse(raw))};
}
function writeCardReports(storage,previous,next){
 if(cardReportsBlocked)throw reportError('запись заблокирована после неподтверждённого сохранения. Сохраните журнал в файл и перезапустите приложение.');
 validateCardReports(next);const raw=JSON.stringify(next);
 if(storage.getItem(QUIP_CARD_REPORTS_KEY)!==previous)throw reportError('журнал изменился. Откройте его заново.');
 try{
  storage.setItem(QUIP_CARD_REPORTS_KEY,raw);
  if(storage.getItem(QUIP_CARD_REPORTS_KEY)!==raw)throw Error('readback');
 }catch{
  try{
   if(storage.getItem(QUIP_CARD_REPORTS_KEY)!==previous){
    if(previous===null)storage.removeItem(QUIP_CARD_REPORTS_KEY);else storage.setItem(QUIP_CARD_REPORTS_KEY,previous);
   }
   if(storage.getItem(QUIP_CARD_REPORTS_KEY)!==previous)throw Error('rollback');
  }catch{cardReportsBlocked=true;throw reportError('не удалось подтвердить откат. Дальнейшая запись замечаний заблокирована.');}
  throw reportError('не удалось сохранить замечание. Прежний журнал сохранён; проверьте свободную память.');
 }
 return next;
}
function saveCardReport(item,reason,comment='',{storage=localStorage,allowUpdate=false,expectedRow=null,now=Date.now()}={}){
 validateReportItem(item);
 comment=reportComment(comment);
 if(!Object.hasOwn(QUIP_REPORT_REASONS,reason))throw reportError('выберите причину.');
 if(Array.from(comment).length>160)throw reportError('комментарий — до 160 символов.');
 if(!Number.isSafeInteger(now)||now<0)throw reportError('неверная дата.');
 const {raw,data}=readCardReports(storage),itemKey=reportItemKey(item),index=data.items.findIndex(row=>row.itemKey===itemKey);
 if(index!==-1&&!allowUpdate)return {status:'exists',row:data.items[index]};
 if(index!==-1&&JSON.stringify(data.items[index])!==expectedRow)throw reportError('замечание изменилось. Откройте его заново.');
 if(index===-1&&allowUpdate)throw reportError('замечание уже удалено. Откройте журнал заново.');
 if(index===-1&&data.items.length>=QUIP_CARD_REPORTS_LIMIT)throw reportError('сохранено 500 карточек. Экспортируйте журнал и удалите ненужное замечание; старые записи не удаляются автоматически.');
 const row={itemKey,item:JSON.parse(JSON.stringify(item)),reason,comment,createdAt:index===-1?now:data.items[index].createdAt,updatedAt:Math.max(now,index===-1?now:data.items[index].updatedAt)};
 const next={version:1,items:data.items.slice()};if(index===-1)next.items.push(row);else next.items[index]=row;
 writeCardReports(storage,raw,next);return {status:index===-1?'saved':'updated',row};
}
function deleteCardReport(itemKey,expectedRow,storage=localStorage){
 const {raw,data}=readCardReports(storage),row=data.items.find(row=>row.itemKey===itemKey);
 if(!row||JSON.stringify(row)!==expectedRow)throw reportError('замечание изменилось. Откройте журнал заново.');
 return writeCardReports(storage,raw,{version:1,items:data.items.filter(row=>row.itemKey!==itemKey)});
}
function clearCardReports(expectedRaw,storage=localStorage){
 const {raw}=readCardReports(storage);if(raw!==expectedRaw)throw reportError('журнал изменился. Проверьте его перед очисткой.');
 return writeCardReports(storage,raw,{version:1,items:[]});
}
function createCardReportsText(storage=localStorage,exportedAt=Date.now()){
 if(!Number.isSafeInteger(exportedAt)||exportedAt<0)throw reportError('неверная дата.');
 return JSON.stringify({kind:'kvip-card-reports',version:1,exportedAt,archive:readCardReports(storage).data},null,2);
}
