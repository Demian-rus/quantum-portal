'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),{execFileSync}=require('node:child_process'),{webcrypto}=require('node:crypto');
const P=require('../feedback-sync/protocol.js'),C=require('../feedback-sync/client.js'),{createService,serve}=require('../feedback-sync/local-server.cjs');
const base='4bb6e67d8bed60f03459f31b14e6168ea996048b',root=path.resolve(__dirname,'../..'),token='local-test-owner-token-never-shipped-to-client';
function mutex(){const tails=new Map();return async(name,fn)=>{const previous=tails.get(name)||Promise.resolve();let release;const gate=new Promise(resolve=>release=resolve);tails.set(name,previous.then(()=>gate));await previous;try{return await fn();}finally{release();}};}
function fixture(){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const context=vm.createContext({localStorage:storage,Date,console});
 for(const f of ['card-reports.js','card-feedback.js'])vm.runInContext(fs.readFileSync(path.join(root,'party-game',f),'utf8'),context);
 const run=s=>vm.runInContext(s,context),readArchives=()=>JSON.parse(run('JSON.stringify({reports:readCardReports().data,approvals:readCardApprovals().data})'));
 const item=n=>({cardId:'word-'+n,pack:{id:'general',version:7},context:'round',modeId:'mime',methodId:null,difficulty:'easy',text:'ЛОКАЛЬНЫЙ ТЕКСТ '+n});
 const approval=n=>{context.item=item(n);return run('saveCardApproval(item)');};
 const report=(n,comment='Комментарий')=>{context.item=item(n);context.comment=comment;return run('saveCardFeedbackReport(item,"error",comment)');};
 const withLock=mutex();let clock=1000,connected=true,calls=[];
 const fetcher=async(url,options)=>{const e=JSON.parse(options.body);calls.push({url,options,event:e});return response({...e,status:'applied'});};
 const create=(extra={})=>C.create({config:{enabled:true,endpoint:'https://feedback.example/v1/feedback'},storage,readArchives,crypto:webcrypto,withLock,now:()=>clock,online:()=>connected,fetch:fetcher,...extra});
 return {values,storage,context,run,readArchives,item,approval,report,create,calls,setClock:t=>clock=t,setOnline:v=>connected=v};
}
function response(event){const {version,installId,revision,eventId,status}=event;return new Response(JSON.stringify({version,installId,revision,eventId,status}),{status:200,headers:{'Content-Type':'application/json'}});}
const getState=f=>JSON.parse(f.storage.getItem(C.KEY));
const wire=(installId,revision,n,rating='approve')=>P.makeEvent(installId,revision,{item:{cardId:'word-'+n,pack:{id:'general',version:7}},rating,reason:rating==='report'?'error':null,comment:rating==='report'?'Текст':null});

test('TASK023A default gate causes zero storage, RNG, crypto, listener or network effects',async()=>{
 const fail=()=>{throw Error('disabled side effect')},sync=C.create({storage:{getItem:fail,setItem:fail},crypto:{randomUUID:fail},readArchives:fail,fetch:fail});
 assert.equal((await sync.start({events:{addEventListener:fail}})).mode,'disabled');assert.equal((await sync.reconcile()).mode,'disabled');assert.equal((await sync.flush()).mode,'disabled');assert.equal((await sync.status()).lastAckAt,null);sync.stop();
});
test('activation baselines all old ratings and keeps legacy IDs local; old deletion sends nothing',async()=>{
 const f=fixture();f.approval(1);f.report(2);f.context.item={...f.item(3),cardId:null};f.run('saveCardApproval(item)');const before=f.run('createCardFeedbackText(localStorage,1)');
 const s=f.create();await s.flush();assert.equal(f.calls.length,0);assert.equal((await s.status()).localOnly,3);assert.equal(f.run('createCardFeedbackText(localStorage,1)'),before);
 f.run('clearCardReports(readCardReports().raw);clearCardApprovals(readCardApprovals().raw)');await s.flush();assert.equal(f.calls.length,0);assert.equal(getState(f).records.length,0);
});
test('new votes are local before network; only minimal allowlisted fields cross the boundary',async()=>{
 const f=fixture(),s=f.create();await s.reconcile();f.approval(1);const archive=f.run('createCardFeedbackText(localStorage,1)');await s.flush();
 assert.equal(f.calls.length,1);const {event,options}=f.calls[0];assert.deepEqual(Object.keys(event).sort(),'comment eventId installId item rating reason revision version'.split(' ').sort());
 assert.ok(!options.body.includes('ЛОКАЛЬНЫЙ'));assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');assert.equal((await s.status()).delivered,1);assert.equal((await s.status()).lastAckAt,1000);
 f.approval(1);await s.flush();assert.equal(f.calls.length,1);assert.equal(f.run('createCardFeedbackText(localStorage,1)'),archive);
});
test('automatic lifecycle reacts to online and detaches listeners/timer on stop',async()=>{
 const f=fixture(),s=f.create(),events=new EventTarget(),document=new EventTarget();
 try{await s.start({events,document});f.approval(1);events.dispatchEvent(new Event('online'));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);assert.equal((await s.status()).pending,0);
  s.stop();f.approval(2);events.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);
 }finally{s.stop();}
});
test('offline + process death between journal save and queue capture is repaired after reload',async()=>{
 const f=fixture();await f.create().reconcile();f.setOnline(false);f.report(1);const archived=f.run('createCardFeedbackText(localStorage,1)');
 const reloaded=f.create();await reloaded.flush();assert.equal(f.calls.length,0);assert.equal((await reloaded.status()).pending,1);
 f.setOnline(true);await f.create().flush();assert.equal(f.calls[0].event.comment,'Комментарий');assert.equal(f.run('createCardFeedbackText(localStorage,1)'),archived);
});
test('replacement uses one vote identity, increasing revision and original cross-archive transaction',async()=>{
 const f=fixture(),s=f.create();await s.reconcile();f.approval(1);await s.flush();
 const a=f.readArchives().approvals.items[0];f.context.item=f.item(1);f.context.expected=JSON.stringify(a);f.run('saveCardFeedbackReport(item,"hard","Проверить",{replaceApproval:true,expectedApproval:expected})');await s.flush();
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].event.revision,2);assert.deepEqual(f.calls[0].event.item,f.calls[1].event.item);assert.equal(f.calls[1].event.rating,'report');assert.equal(f.readArchives().approvals.items.length,0);assert.equal(f.readArchives().reports.items.length,1);
});
test('status never labels a newer journal edit as delivered before reconciliation',async()=>{
 const f=fixture(),s=f.create();await s.reconcile();f.report(1);await s.flush();assert.equal((await s.status()).delivered,1);
 f.context.comment='Исправленный комментарий';f.run('saveCardFeedbackReport(item,"error",comment,{allowUpdate:true,expectedRow:JSON.stringify(readCardReports().data.items[0])})');
 const status=await s.status();assert.equal(status.delivered,0);assert.equal(status.deferred,1);assert.equal(status.mode,'attention');await s.flush();assert.equal((await s.status()).delivered,1);
});
test('in-flight ACK cannot erase a newer edit or pending tombstone',async()=>{
 const f=fixture();let release,first=true,arrived;const started=new Promise(resolve=>arrived=resolve),sent=[];
 const s=f.create({fetch:async(url,options)=>{const event=JSON.parse(options.body);sent.push(event);if(first){first=false;arrived();await new Promise(resolve=>release=resolve);}return response({...event,status:'applied'});}});
 await s.reconcile();f.approval(1);const flush=s.flush();await started;
 f.run('clearCardApprovals(readCardApprovals().raw)');await s.reconcile();assert.equal(getState(f).records[0].pending.rating,'deleted');release();await flush;
 assert.deepEqual(sent.map(x=>x.rating),['approve','deleted']);assert.deepEqual(sent.map(x=>x.revision),[1,2]);assert.equal(getState(f).records.length,0);
});
test('lost ACK resends identical event; persisted server applies it once',async()=>{
 const f=fixture(),service=createService({ownerToken:token});let requests=0;const seen=[];
 try{const s=f.create({fetch:async(url,options)=>{const e=JSON.parse(options.body);seen.push(options.body);const ack=service.accept(e);if(++requests===1)throw Error('lost ACK');return response(ack);}});
  await s.reconcile();f.approval(1);await s.flush();assert.equal((await s.status()).pending,1);assert.equal((await s.status()).lastAckAt,null);
  f.setClock(100000);await s.flush();assert.equal(seen.length,2);assert.equal(seen[0],seen[1]);assert.equal(service.ownerExport().aggregates[0].count,1);assert.equal(service.counts().events,1);
 }finally{service.close();}
});
test('retry is durable, bounded, honors Retry-After and does not hammer the server',async()=>{
 const f=fixture();let count=0;const fetch=async()=>{count++;return new Response('',{status:429,headers:{'Retry-After':'120'}});};
 const s=f.create({fetch});await s.reconcile();f.report(1);await s.flush();const deadline=getState(f).nextAttemptAt;assert.ok(deadline>=121000&&deadline<=86401000);
 await f.create({fetch}).flush();assert.equal(count,1);f.setClock(deadline);await f.create({fetch}).flush();assert.equal(count,2);assert.equal(getState(f).attempts,2);
});
test('permanent HTTP rejection persists attention and requires explicit recovery',async()=>{
 const f=fixture();let count=0;const fetch=async()=>{count++;return new Response('',{status:409});};const s=f.create({fetch});await s.reconcile();f.approval(1);await s.flush();assert.equal(getState(f).halted,true);
 f.setClock(10000000);const reload=f.create({fetch});assert.equal((await reload.flush()).mode,'attention');assert.equal(count,1);await reload.resume();await reload.flush();assert.equal(count,2);assert.equal((await reload.status()).pending,1);
});
test('wrong/oversized/unknown ACKs and HTTP 204 never count as delivery',async()=>{
 for(const mode of ['wrong','large','unknown','204','type']){
  const f=fixture(),s=f.create({fetch:async(url,options)=>{const e=JSON.parse(options.body);if(mode==='204')return new Response(null,{status:204});if(mode==='large')return new Response('x'.repeat(2048),{headers:{'Content-Type':'application/json'}});
   const ack={version:1,installId:e.installId,revision:e.revision,eventId:mode==='wrong'?'wrong':e.eventId,status:'applied'};if(mode==='unknown')ack.extra=true;
   return new Response(JSON.stringify(ack),{headers:{'Content-Type':mode==='type'?'text/html':'application/json'}});}});
  await s.reconcile();f.approval(1);await s.flush();assert.equal((await s.status()).pending,1,mode);assert.equal((await s.status()).lastAckAt,null,mode);
 }
});
test('outbox quota failure cannot roll back a successfully saved rating; catchup succeeds later',async()=>{
 const f=fixture(),s=f.create();await s.reconcile();f.report(1);const before=f.storage.getItem(C.KEY),archive=f.run('createCardFeedbackText(localStorage,1)'),set=f.storage.setItem;
 f.storage.setItem=(k,v)=>{if(k===C.KEY)throw Error('quota');return set(k,v);};await assert.rejects(s.reconcile(),/quota/);assert.equal(f.storage.getItem(C.KEY),before);assert.equal(f.run('createCardFeedbackText(localStorage,1)'),archive);
 f.storage.setItem=set;await s.flush();assert.equal((await s.status()).delivered,1);
});
test('readback failure restores exact RAW; unverified rollback latches the writer',async()=>{
 for(const broken of [false,true]){
  const f=fixture(),s=f.create();await s.reconcile();f.report(1);const raw=f.storage.getItem(C.KEY),get=f.storage.getItem,set=f.storage.setItem;let wrote=false,once=true;
  f.storage.setItem=(k,v)=>{if(k===C.KEY){if(broken&&wrote&&v===raw)throw Error('rollback');wrote=true;}return set(k,v);};
  f.storage.getItem=k=>{const v=get(k);if(k===C.KEY&&wrote&&once){once=false;return v+' ';}return v;};await assert.rejects(s.reconcile());
  f.storage.getItem=get;f.storage.setItem=set;
  if(broken)await assert.rejects(s.flush(),/blocked/);else{assert.equal(get(C.KEY),raw);await s.flush();assert.equal((await s.status()).delivered,1);}
  assert.equal(f.readArchives().reports.items.length,1);
 }
});
test('ACK checkpoint failure safely resends without double-counting',async()=>{
 const f=fixture(),service=createService({ownerToken:token});try{
  const set=f.storage.setItem;let fault=true;
  const s=f.create({fetch:async(url,options)=>{const ack=service.accept(JSON.parse(options.body));if(fault){fault=false;let fail=true;f.storage.setItem=(k,v)=>{if(k===C.KEY&&fail){fail=false;throw Error('ACK quota');}return set(k,v);};}return response(ack);}});
  await s.reconcile();f.approval(1);await s.flush();assert.equal((await s.status()).pending,1);assert.equal((await s.status()).lastAckAt,null);
  f.setClock(100000);await s.flush();assert.equal(service.ownerExport().aggregates[0].count,1);assert.equal((await s.status()).pending,0);
 }finally{service.close();}
});
test('corruption, conflicting archives and endpoint changes retain all original bytes',async()=>{
 const f=fixture(),s=f.create();await s.reconcile();f.approval(1);await s.reconcile();const raw=f.storage.getItem(C.KEY);
 await assert.rejects(f.create({config:{enabled:true,endpoint:'https://other.example/v1/feedback'}}).flush(),/Invalid outbox/);assert.equal(f.storage.getItem(C.KEY),raw);
 f.storage.setItem(C.KEY,'{"version":99}');await assert.rejects(s.flush(),/Invalid outbox/);assert.equal(f.storage.getItem(C.KEY),'{"version":99}');f.storage.setItem(C.KEY,raw);
 f.context.item=f.item(1);f.run('saveCardReport(item,"other","")');await assert.rejects(s.flush(),/Conflicting/);assert.equal(f.storage.getItem(C.KEY),raw);assert.equal(f.calls.length,0);
});
test('bounded latest-state outbox coalesces edits and defers overflow without eviction or deadlock',async()=>{
 const f=fixture(),s=f.create();await s.reconcile();f.report(1);await s.reconcile();
 for(let i=0;i<10;i++){f.context.comment='Редакция '+i;f.run('saveCardFeedbackReport(item,"error",comment,{allowUpdate:true,expectedRow:JSON.stringify(readCardReports().data.items[0])})');await s.reconcile();}
 assert.equal(getState(f).records.length,1);assert.equal(getState(f).sequence,11);
 // Fill the admitted 1000 pending slots using valid, separately bounded archives.
 const source={approvals:{version:1,items:[]},reports:{version:1,items:[]}};
 const bulk=f.create({readArchives:()=>source});
 for(let i=0;i<500;i++){const item=f.item('bulk-'+i),row={itemKey:'key-'+i,item,createdAt:1,updatedAt:1};source.approvals.items.push(row);source.reports.items.push({...row,itemKey:'report-'+i,item:f.item('report-'+i),reason:'other',comment:''});}
 await bulk.reconcile();assert.equal(getState(f).records.filter(r=>r.pending).length,C.MAX_PENDING);assert.equal((await bulk.status()).deferred,1);assert.equal(source.approvals.items.length,500);
 await bulk.flush();await bulk.reconcile();assert.equal((await bulk.status()).deferred,0);assert.equal(source.approvals.items.length,500);assert.ok(getState(f).records.length<=C.MAX_RECORDS);
});
test('two tabs share identity and a sender lock; no duplicate revision or lost pending state',async()=>{
 const f=fixture(),a=f.create(),b=f.create();await Promise.all([a.reconcile(),b.reconcile()]);const id=getState(f).installId;f.approval(1);f.report(2);
 await Promise.all([a.flush(),b.flush()]);assert.equal(f.calls.length,2);assert.equal(getState(f).sequence,2);assert.ok(f.calls.every(c=>c.event.installId===id));assert.deepEqual(f.calls.map(c=>c.event.revision),[1,2]);
});
test('UTF-8 byte capacity also defers without blocking queue drainage',async()=>{
 const f=fixture(),source={reports:{version:1,items:[]},approvals:{version:1,items:[]}},pack={id:'p'.repeat(160),version:Number.MAX_SAFE_INTEGER};
 const row=(prefix,i,report)=>({itemKey:prefix+i,item:{...f.item(i),cardId:(prefix+'w'.repeat(160)).slice(0,156)+String(i).padStart(4,'0'),pack},createdAt:1,updatedAt:1,...(report?{reason:'other',comment:'🧩'.repeat(160)}:{})});
 for(let i=0;i<500;i++){source.reports.items.push(row('r',i,true));source.approvals.items.push(row('a',i,false));}
 const s=f.create({readArchives:()=>source});await s.reconcile();
 source.reports.items.forEach(r=>r.comment='🔷'.repeat(160));await s.reconcile();
 source.reports.items=source.reports.items.map((r,i)=>row('n',i,true));await s.reconcile();
 const before=await s.status();assert.ok(before.deferred>0);assert.ok(P.bytes(f.storage.getItem(C.KEY))<=C.MAX_BYTES);assert.equal(source.reports.items.length,500);
 await s.flush();await s.reconcile();assert.ok((await s.status()).deferred<before.deferred);assert.ok(P.bytes(f.storage.getItem(C.KEY))<=C.MAX_BYTES);
});
test('clear site data during a request never resurrects the old identity or silently replays journals',async()=>{
 const f=fixture();let release,arrived;const start=new Promise(r=>arrived=r),s=f.create({fetch:async(url,options)=>{arrived();await new Promise(r=>release=r);return response({...JSON.parse(options.body),status:'applied'});}});
 await s.reconcile();const id=getState(f).installId;f.approval(1);const sending=s.flush();await start;f.storage.removeItem(C.KEY);release();await sending;assert.equal(f.storage.getItem(C.KEY),null);
 const next=f.create();await next.flush();assert.notEqual(getState(f).installId,id);assert.equal(f.calls.length,0);assert.equal((await next.status()).localOnly,1);
});
test('unsafe endpoints, missing Web Locks, untrusted fields and free-text abuse fail closed',async()=>{
 for(const endpoint of ['http://example.com/v1/feedback','https://u:p@example.com/v1/feedback','https://example.com/v1/feedback?secret=x','https://example.com/other'])assert.throws(()=>C.create({config:{enabled:true,endpoint}}));
 const f=fixture();await assert.rejects(f.create({withLock:null}).reconcile(),/unsupported/);
 const e=wire(webcrypto.randomUUID(),1,1,'report');for(const value of ['x'.repeat(161),'line\nline','\u202evil','\ud800'])assert.throws(()=>P.validateEvent({...e,comment:value}));
 for(const extra of [{profileId:'p'},{team:'ДС'},{scores:[1,2]},{history:[]},{ownerToken:'secret'}])assert.throws(()=>P.validateEvent({...e,...extra}));
 assert.throws(()=>P.validateEvent({...e,item:{...e.item,text:'private'}}));
});
test('server rejects stale resurrection, revision reuse and counts a replacement/deletion once',()=>{
 const s=createService({ownerToken:token}),id=webcrypto.randomUUID();try{
  s.accept(wire(id,1,1));assert.equal(s.accept(wire(id,1,1)).status,'duplicate');s.accept(wire(id,2,1,'report'));assert.equal(s.ownerExport().aggregates[0].rating,'report');
  s.accept(wire(id,3,1,'deleted'));assert.equal(s.ownerExport().aggregates.length,0);assert.equal(s.ownerExport().reports.length,0);
  assert.throws(()=>s.accept(wire(id,1,1)),e=>e.status===409);assert.throws(()=>s.accept(wire(id,3,2)),e=>e.status===409);assert.equal(s.counts().votes,1);assert.equal(s.counts().events,3);
 }finally{s.close();}
});
test('server database survives restart; per-install/IP quotas and capacity retain existing data',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quip-feedback-')),database=path.join(dir,'test.sqlite'),id=webcrypto.randomUUID();
 let s=createService({ownerToken:token,database,maxVotes:1,maxEvents:3});try{s.accept(wire(id,1,1));s.close();s=createService({ownerToken:token,database,maxVotes:1,maxEvents:3,ratePerInstall:3});assert.equal(s.accept(wire(id,1,1)).status,'duplicate');
  assert.throws(()=>s.accept(wire(id,2,2)),e=>e.status===503);assert.equal(s.counts().events,1);s.accept(wire(id,3,1,'deleted'));assert.throws(()=>s.accept(wire(id,4,1)),e=>e.status===429);assert.equal(s.ownerExport().aggregates.length,0);
 }finally{s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('real loopback HTTP validates origin, credentials, strict JSON, body limits and owner-only export',async()=>{
 const server=serve({ownerToken:token,port:0});await new Promise(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+server.address().port;
 try{const event=wire(webcrypto.randomUUID(),1,1),headers={Origin:'http://127.0.0.1:8765','Content-Type':'application/json'};
  const post=(body=JSON.stringify(event),changes={})=>fetch(url+'/v1/feedback',{method:'POST',headers:{...headers,...changes},body});
  let r=await post();assert.equal(r.status,200);P.validateAck(await r.json(),event);assert.equal((await post()).status,200);
  assert.equal((await post(undefined,{Origin:'https://evil.example'})).status,403);assert.equal((await post(undefined,{Cookie:'test=1'})).status,400);
  assert.equal((await post(JSON.stringify({...event,team:'private'}))).status,400);assert.equal((await post('x'.repeat(2049))).status,413);assert.equal((await post('{bad')).status,400);assert.equal((await post(undefined,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await fetch(url+'/owner/export')).status,401);assert.equal((await fetch(url+'/owner/export',{headers:{Authorization:'Bearer '+token,Origin:'http://127.0.0.1:8765'}})).status,403);
  r=await fetch(url+'/owner/export',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);const exported=await r.json();assert.equal(exported.aggregates[0].count,1);assert.ok(!JSON.stringify(exported).includes(event.installId));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('TASK023A preserves every published runtime byte, catalogs, exports and TASK022',()=>{
 const changed=execFileSync('git',['diff','--name-only',base,'--','party-game'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert.ok(changed.every(n=>n.startsWith('party-game/feedback-sync/')||n==='party-game/TASK023A-FEEDBACK-SYNC.md'||n.startsWith('party-game/tests/feedback-sync')),changed.join('\n'));
 const html=fs.readFileSync(path.join(root,'party-game/index.html'),'utf8');assert.ok(!html.includes('feedback-sync/'));
 for(const f of ['index.html','sw.js','style.css','card-reports.js','card-reports-view.js','card-feedback.js','card-feedback-view.js','result-review.js','result-review-view.js','match-views.js','risk-planner.js','player-profiles.js','profile-backup.js','storage-controller.js','cards.js','content-packs.js'])assert.deepEqual(fs.readFileSync(path.join(root,'party-game',f)),execFileSync('git',['show',base+':party-game/'+f],{cwd:root,maxBuffer:12e6}),f);
});
