'use strict';
// Shared wire contract. No match, profile, task text, timestamps or credentials.
(function(root){
 const VERSION=1,MAX_EVENT_BYTES=2048,REASONS=['error','ambiguous','hard','duplicate','theme','other'];
 const keys=(x,list)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===list.split('|').sort().join('|');
 const id=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,159}$/.test(x);
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
 const bytes=x=>new TextEncoder().encode(x).length;
 function requireThat(ok){if(!ok)throw Error('Invalid feedback protocol');}
 function validateItem(x){
  requireThat(keys(x,'cardId|pack')&&id(x.cardId)&&(x.pack===null||keys(x.pack,'id|version')&&id(x.pack.id)&&Number.isSafeInteger(x.pack.version)&&x.pack.version>0));return x;
 }
 function itemKey(item){validateItem(item);return JSON.stringify([item.pack?.id??null,item.pack?.version??null,item.cardId]);}
 function itemFromKey(key){const x=JSON.parse(key);requireThat(Array.isArray(x)&&x.length===3);const item={cardId:x[2],pack:x[0]===null&&x[1]===null?null:{id:x[0],version:x[1]}};requireThat(itemKey(item)===key);return item;}
 function validateVote(x,deleted=false){
  requireThat(keys(x,'item|rating|reason|comment'));validateItem(x.item);
  requireThat(['approve','report',...(deleted?['deleted']:[])].includes(x.rating));
  if(x.rating==='report')requireThat(REASONS.includes(x.reason)&&typeof x.comment==='string'&&
   x.comment===x.comment.normalize('NFKC').replace(/\s+/gu,' ').trim()&&Array.from(x.comment).length<=160&&bytes(x.comment)<=640&&
   !/[\p{Surrogate}\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(x.comment));
  else requireThat(x.reason===null&&x.comment===null);
  return x;
 }
 function canonicalVote(x){validateVote(x);return JSON.stringify({item:{cardId:x.item.cardId,pack:x.item.pack===null?null:{id:x.item.pack.id,version:x.item.pack.version}},rating:x.rating,reason:x.reason,comment:x.comment});}
 function validateEvent(x){
  requireThat(keys(x,'version|installId|revision|eventId|item|rating|reason|comment')&&x.version===VERSION&&uuid(x.installId)&&Number.isSafeInteger(x.revision)&&x.revision>0&&x.eventId===x.installId+':'+x.revision);
  validateVote({item:x.item,rating:x.rating,reason:x.reason,comment:x.comment},true);
  requireThat(bytes(JSON.stringify(x))<=MAX_EVENT_BYTES);return x;
 }
 function makeEvent(installId,revision,vote){return validateEvent({version:VERSION,installId,revision,eventId:installId+':'+revision,...vote});}
 function validateAck(x,event){
  requireThat(keys(x,'version|installId|revision|eventId|status')&&x.version===VERSION&&x.installId===event.installId&&x.revision===event.revision&&x.eventId===event.eventId&&['applied','duplicate'].includes(x.status));return x;
 }
 const api=Object.freeze({VERSION,MAX_EVENT_BYTES,REASONS,keys,id,uuid,bytes,validateItem,itemKey,itemFromKey,validateVote,canonicalVote,validateEvent,makeEvent,validateAck});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.KvipFeedbackProtocol=api;
})(globalThis);
