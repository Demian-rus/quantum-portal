'use strict';
// TASK023A staging module: deliberately absent from index.html and service-worker CORE.
(function(root){
 const P=typeof module==='object'&&module.exports?require('./protocol.js'):root.KvipFeedbackProtocol;
 const KEY='kvip-feedback-outbox:v1',MAX_RECORDS=2000,MAX_PENDING=1000,MAX_BYTES=2*1024*1024;
 const DEFAULT_CONFIG=Object.freeze({enabled:false,endpoint:null});
 const copy=x=>JSON.parse(JSON.stringify(x));
 function snapshot(archives){
  if(!P.keys(archives,'reports|approvals'))throw Error('Invalid feedback archives');
  const votes=new Map();let legacy=0;
  for(const [name,rating]of [['reports','report'],['approvals','approve']]){
   const a=archives[name];if(!P.keys(a,'version|items')||a.version!==1||!Array.isArray(a.items)||a.items.length>500)throw Error('Invalid feedback archives');
   const seen=new Set();
   for(const row of a.items){
    if(!P.keys(row,rating==='report'?'itemKey|item|reason|comment|createdAt|updatedAt':'itemKey|item|createdAt|updatedAt')||
     !P.keys(row.item,'cardId|pack|context|modeId|methodId|difficulty|text')||typeof row.itemKey!=='string'||seen.has(row.itemKey)||
     !Number.isSafeInteger(row.createdAt)||row.createdAt<0||!Number.isSafeInteger(row.updatedAt)||row.updatedAt<row.createdAt)throw Error('Invalid feedback archive row');
    seen.add(row.itemKey);
    // Legacy text never leaves the device and no ID is guessed from text.
    if(row.item.cardId===null){legacy++;continue;}
    const item={cardId:row.item.cardId,pack:copy(row.item.pack)};
    const vote=P.validateVote({item,rating,reason:rating==='report'?row.reason:null,comment:rating==='report'?row.comment:null});
    const key=P.itemKey(item);if(votes.has(key))throw Error('Conflicting feedback archives');
    votes.set(key,P.canonicalVote(vote));
   }
  }
  return {votes,legacy};
 }
 function validateState(s,endpoint){
  if(!P.keys(s,'version|endpoint|installId|sequence|records|attempts|nextAttemptAt|lastAckAt|halted')||s.version!==1||s.endpoint!==endpoint||!P.uuid(s.installId)||typeof s.halted!=='boolean'||
   !Number.isSafeInteger(s.sequence)||s.sequence<0||!Array.isArray(s.records)||s.records.length>MAX_RECORDS||
   !Number.isInteger(s.attempts)||s.attempts<0||s.attempts>12||!Number.isSafeInteger(s.nextAttemptAt)||s.nextAttemptAt<0||
   s.lastAckAt!==null&&(!Number.isSafeInteger(s.lastAckAt)||s.lastAckAt<0))throw Error('Invalid outbox; original data retained');
  const seen=new Set();let pending=0;
  for(const r of s.records){
   if(!P.keys(r,'key|fingerprint|remote|pending')||typeof r.key!=='string'||seen.has(r.key)||typeof r.remote!=='boolean')throw Error('Invalid outbox record');
   seen.add(r.key);P.itemFromKey(r.key);
   if(r.fingerprint!==null){if(typeof r.fingerprint!=='string'||r.fingerprint.length>2048)throw Error('Invalid fingerprint');const vote=JSON.parse(r.fingerprint);if(P.canonicalVote(vote)!==r.fingerprint||P.itemKey(vote.item)!==r.key)throw Error('Invalid fingerprint');}
   if(r.pending!==null){pending++;P.validateEvent(r.pending);if(!r.remote||r.pending.installId!==s.installId||r.pending.revision>s.sequence||P.itemKey(r.pending.item)!==r.key||
    (r.pending.rating==='deleted'?r.fingerprint!==null:P.canonicalVote({item:r.pending.item,rating:r.pending.rating,reason:r.pending.reason,comment:r.pending.comment})!==r.fingerprint))throw Error('Invalid pending event');}
   else if(r.fingerprint===null)throw Error('Invalid empty record');
  }
  if(pending>MAX_PENDING||P.bytes(JSON.stringify(s))>MAX_BYTES)throw Error('Outbox capacity reached; archives retained');return s;
 }
 function create(options={}){
  const config={...DEFAULT_CONFIG,...options.config},enabled=config.enabled===true;
  const storage=options.storage,readArchives=options.readArchives,now=options.now||Date.now,crypto=options.crypto||root.crypto;
  const lock=Object.hasOwn(options,'withLock')?options.withLock:(root.navigator?.locks?((name,fn)=>root.navigator.locks.request(name,fn)):null);
  const fetcher=options.fetch||root.fetch?.bind(root),online=options.online||(()=>root.navigator?.onLine!==false);
  let endpoint=null,blocked=false,lastError=null,timer=null,unlisten=[],currentAbort=null,stopped=false;
  if(enabled){
   const u=new URL(config.endpoint);
   if(u.username||u.password||u.search||u.hash||u.pathname!=='/v1/feedback'||u.protocol!=='https:'&&!(options.allowLoopback===true&&u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error('Unsafe feedback endpoint');
   endpoint=u.href;
  }
  function ready(){if(!enabled)return false;if(typeof lock!=='function'||!crypto?.randomUUID||!crypto?.getRandomValues||!storage||!readArchives||!fetcher)throw Error('Sync unsupported; local export remains available');if(blocked)throw Error('Outbox blocked after unconfirmed rollback');return true;}
  function read(){const raw=storage.getItem(KEY);if(raw!==null&&P.bytes(raw)>MAX_BYTES)throw Error('Outbox too large');return {raw,state:raw===null?null:validateState(JSON.parse(raw),endpoint)};}
  function write(previous,state){
   validateState(state,endpoint);const text=JSON.stringify(state);
   if(text===previous)return;
   if(storage.getItem(KEY)!==previous)throw Error('Outbox changed; retry');
   try{storage.setItem(KEY,text);if(storage.getItem(KEY)!==text)throw Error('Outbox readback failed');}
   catch(error){
    try{if(storage.getItem(KEY)!==previous){if(previous===null)storage.removeItem(KEY);else storage.setItem(KEY,previous);}if(storage.getItem(KEY)!==previous)throw Error('rollback');}
    catch{blocked=true;throw Error('Outbox rollback unconfirmed; local archives retained');}
    throw error;
   }
  }
  function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)throw Error('Invalid clock');return t;}
  function capture(){
   const {raw,state}=read(),source=snapshot(readArchives());
   if(state===null){
    // Activation is a durable baseline, never an implicit upload of old ratings.
    const initial={version:1,endpoint,installId:crypto.randomUUID(),sequence:0,records:[...source.votes].map(([key,fingerprint])=>({key,fingerprint,remote:false,pending:null})),attempts:0,nextAttemptAt:0,lastAckAt:null,halted:false};write(raw,initial);return initial;
   }
   const records=new Map(state.records.map(r=>[r.key,r]));let pending=state.records.filter(r=>r.pending).length;
   for(const key of new Set([...records.keys(),...source.votes.keys()])){
    const r=records.get(key),fingerprint=source.votes.get(key)??null;
    if(r?.fingerprint===fingerprint)continue;
    if(fingerprint===null&&!r.remote){records.delete(key);continue;}
    // Admit incrementally; the archives retain deferred changes until slots drain.
    if(!r&&records.size>=MAX_RECORDS||!r?.pending&&pending>=MAX_PENDING)continue;
    if(state.sequence===Number.MAX_SAFE_INTEGER)throw Error('Outbox revision exhausted');
    const vote=fingerprint===null?{item:P.itemFromKey(key),rating:'deleted',reason:null,comment:null}:JSON.parse(fingerprint);
    if(!r?.pending)pending++;
    records.set(key,{key,fingerprint,remote:true,pending:P.makeEvent(state.installId,++state.sequence,vote)});
   }
   state.records=[...records.values()];write(raw,state);return state;
  }
  const transact=fn=>lock('kvip-feedback-outbox-v1',fn);
  async function reconcile(){if(!enabled)return {mode:'disabled'};try{ready();await transact(capture);lastError=null;return await status();}catch(e){lastError=e.message;throw e;}}
  async function status(){
   if(!enabled)return {mode:'disabled',pending:0,deferred:0,delivered:0,localOnly:0,lastAckAt:null,error:null};
   ready();return transact(()=>{const {state}=read(),source=snapshot(readArchives()),records=new Map(state?.records.map(r=>[r.key,r])??[]);
    const deferred=state?[...new Set([...records.keys(),...source.votes.keys()])].filter(key=>records.get(key)?.fingerprint!==(source.votes.get(key)??null)).length:0;
    return {mode:state?.halted||lastError||deferred?'attention':state?.records.some(r=>r.pending)?'pending':'idle',
    pending:state?.records.filter(r=>r.pending).length??0,deferred,delivered:state?.records.filter(r=>r.remote&&!r.pending&&r.fingerprint===source.votes.get(r.key)).length??0,
    localOnly:(state?.records.filter(r=>!r.remote).length??source.votes.size)+source.legacy,lastAckAt:state?.lastAckAt??null,error:lastError};});
  }
  async function limitedAck(response){
   if(!response.body?.getReader)throw Error('Missing ACK body');const reader=response.body.getReader();let text='',size=0;const decoder=new TextDecoder();
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024)throw Error('ACK too large');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}
   finally{await reader.cancel().catch(()=>{});}
  }
  async function send(event){
   const controller=new AbortController();currentAbort=controller;
   const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',mode:'cors'});
    if(response.status!==200){const e=Error('Server did not acknowledge feedback');e.permanent=response.status>=400&&response.status<500&&![408,425,429].includes(response.status);e.retryAfter=[429,503].includes(response.status)?Math.min(86400000,Math.max(0,Number(response.headers.get('Retry-After'))||0)*1000):0;throw e;}
    if(!/^application\/json(?:;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('Invalid ACK content type');
    P.validateAck(await limitedAck(response),event);
   }finally{clearTimeout(timeout);currentAbort=null;}
  }
  async function flush(){
   if(!enabled)return {mode:'disabled'};
   try{
    ready();await transact(capture);if(!online()||stopped)return await status();
    await lock('kvip-feedback-send-v1',async()=>{
     for(let i=0;i<10&&!stopped;i++){
      const event=await transact(()=>{const {state}=read();return state&&!state.halted&&time()>=state.nextAttemptAt?copy(state.records.find(r=>r.pending)?.pending??null):null;});if(!event||!online())break;
      try{
       await send(event);
       await transact(()=>{const {raw,state}=read();if(!state||state.installId!==event.installId)return;const record=state.records.find(r=>r.key===P.itemKey(event.item));
        if(record?.pending?.eventId===event.eventId){if(event.rating==='deleted')state.records=state.records.filter(r=>r!==record);else record.pending=null;}
        state.attempts=0;state.nextAttemptAt=0;state.lastAckAt=time();write(raw,state);});lastError=null;
      }catch(error){
       lastError='Delivery unconfirmed; local archives retained';
       await transact(()=>{const {raw,state}=read();if(!state||state.installId!==event.installId)return;
        state.halted=error.permanent===true;state.attempts=Math.min(12,state.attempts+1);const jitter=new Uint32Array(1);crypto.getRandomValues(jitter);
        state.nextAttemptAt=time()+Math.max(error.retryAfter||0,Math.min(3600000,5000*2**(state.attempts-1))+(jitter[0]%1000));write(raw,state);});break;
      }
     }
    });return await status();
   }catch(error){lastError=error.message;throw error;}
  }
  async function start({events=root,document=root.document}={}){
   if(!enabled)return {mode:'disabled'};ready();if(timer!==null)return status();stopped=false;
   const initial=await flush();
   const tick=()=>{flush().catch(()=>{});};
   for(const [target,name]of [[events,'online'],[events,'storage'],[document,'visibilitychange']])if(target?.addEventListener){target.addEventListener(name,tick);unlisten.push(()=>target.removeEventListener(name,tick));}
   timer=setInterval(tick,15000);return initial;
  }
  function stop(){stopped=true;currentAbort?.abort();if(timer!==null)clearInterval(timer);timer=null;unlisten.forEach(fn=>fn());unlisten=[];}
  // Explicit operator recovery, never an automatic reset of identity or revisions.
  async function resume(){if(!enabled)return {mode:'disabled'};ready();await transact(()=>{const {raw,state}=read();if(state){state.halted=false;state.attempts=0;state.nextAttemptAt=0;write(raw,state);}});lastError=null;return status();}
  return Object.freeze({reconcile,flush,status,start,stop,resume});
 }
 const api=Object.freeze({KEY,DEFAULT_CONFIG,MAX_RECORDS,MAX_PENDING,MAX_BYTES,create});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.KvipFeedbackSync=api;
})(globalThis);
