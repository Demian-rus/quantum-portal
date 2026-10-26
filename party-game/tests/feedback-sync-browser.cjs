'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright-core');
const {createService}=require('../feedback-sync/local-server.cjs'),http=require('node:http');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const sources=['protocol.js','client.js'].map(n=>fs.readFileSync(path.join(__dirname,'../feedback-sync',n),'utf8'));
async function load(page,endpoint){
 for(const content of sources)await page.addScriptTag({content});
 await page.evaluate(endpoint=>{
  window.sync=KvipFeedbackSync.create({config:{enabled:true,endpoint},allowLoopback:true,storage:localStorage,readArchives:()=>{
   if(cardReportsBlocked||cardApprovalsBlocked)throw Error('Unconfirmed archive rollback');
   return {reports:readCardReports().data,approvals:readCardApprovals().data};
  },now:()=>window.__syncNow??Date.now()});
  window.testItem=n=>({cardId:'test-'+n,pack:{id:'general',version:7},context:'round',modeId:'talk',methodId:null,difficulty:'easy',text:'ЛОКАЛЬНОЕ СЛОВО '+n});
 },endpoint);
}
const privateState=p=>p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().filter(k=>!['kvip-feedback-outbox:v1','kvip-card-reports:v1','kvip-card-approvals:v1'].includes(k)).map(k=>[k,localStorage.getItem(k)]))));
(async()=>{
 const serviceOptions={ownerToken:'browser-test-private-owner-token-not-in-client',origin:new globalThis.URL(URL).origin},service=createService(serviceOptions),exhausted=createService({...serviceOptions,maxVotes:0,maxEvents:0});
 let refuseNext=false,holdAck=null,heldAck=null;
 const server=http.createServer((req,res)=>{
  if(req.method==='POST'&&refuseNext){refuseNext=false;return exhausted.handler(req,res);}
  if(req.method==='POST'&&holdAck){const hold=holdAck,end=res.end.bind(res);holdAck=null;res.end=(...args)=>{let released=false;hold.release=()=>{if(!released){released=true;end(...args);}};hold.arrive();return res;};}
  return service.handler(req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+server.address().port+'/v1/feedback';
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url()===endpoint&&r.method()==='POST')requests.push({body:r.postData(),headers:r.headers()});});await page.goto(URL);
  assert.equal(await page.evaluate(()=>typeof KvipFeedbackSync),'undefined','Published v88 does not load the sync module');
  await load(page,endpoint);await page.evaluate(()=>{saveCardApproval(testItem('old'));localStorage.setItem('private-test-sentinel',JSON.stringify({team:'ДС',scores:[17,21]}))});const original=await privateState(page);
  await page.evaluate(async()=>{const disabled=KvipFeedbackSync.create({storage:localStorage,readArchives:()=>{throw Error('disabled read')}});if((await disabled.start()).mode!=='disabled')throw Error('gate')});
  await page.evaluate(()=>sync.flush());assert.equal(service.counts().events,0,'Historical approvals stay local');
  await page.evaluate(()=>{saveCardApproval(testItem('new'));Math.random=()=>{throw Error('Feedback consumed gameplay RNG')}});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await ctx.setOffline(true);await page.evaluate(()=>sync.flush());const id=await page.evaluate(()=>JSON.parse(localStorage.getItem(KvipFeedbackSync.KEY)).installId);assert.equal((await page.evaluate(()=>sync.status())).pending,1);
  const exportBefore=await page.evaluate(()=>createCardFeedbackText(localStorage,1));await page.reload();await load(page,endpoint);assert.equal((await page.evaluate(()=>sync.flush())).pending,1);assert.equal(service.counts().events,0);
  await ctx.setOffline(false);await page.evaluate(()=>sync.flush());assert.equal((await page.evaluate(()=>sync.status())).pending,0);assert.equal(service.ownerExport().aggregates[0].count,1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(KvipFeedbackSync.KEY)).installId),id);assert.equal(await page.evaluate(()=>createCardFeedbackText(localStorage,1)),exportBefore);assert.equal(await privateState(page),original);
  await page.evaluate(()=>{const item=testItem('new'),old=readCardApprovals().data.items.find(r=>r.item.cardId===item.cardId);saveCardFeedbackReport(item,'ambiguous','Проверить 🧩',{replaceApproval:true,expectedApproval:JSON.stringify(old)})});await page.evaluate(()=>sync.flush());
  assert.equal(service.ownerExport().aggregates[0].rating,'report');assert.equal(service.ownerExport().reports[0].comment,'Проверить 🧩');
  const second=await ctx.newPage();await second.goto(URL);await load(second,endpoint);await page.evaluate(()=>saveCardApproval(testItem('two')));
  await Promise.all([page.evaluate(()=>sync.flush()),second.evaluate(()=>sync.flush())]);assert.deepEqual(service.counts(),{votes:2,events:3});
  await page.evaluate(()=>clearCardReports(readCardReports().raw));await second.evaluate(()=>sync.flush());assert.equal(service.ownerExport().reports.length,0);assert.equal(service.ownerExport().aggregates.length,1);
  await page.evaluate(()=>clearCardApprovals(readCardApprovals().raw));await page.evaluate(()=>sync.flush());assert.equal(service.ownerExport().aggregates.length,0);assert.equal(service.counts().events,5,'Old unsent approval deletion has no wire event');
  // A real cross-origin 503 exposes Retry-After; the archive and pending survive.
  const checkpoint=service.counts().events;refuseNext=true;await page.evaluate(()=>saveCardFeedbackReport(testItem('retry'),'error','Сохранено до отказа'));
  const failedArchive=await page.evaluate(()=>createCardFeedbackText(localStorage,1));await page.evaluate(()=>sync.flush());
  assert.equal((await page.evaluate(()=>sync.status())).pending,1);assert.equal(service.counts().events,checkpoint);
  const retryAt=await page.evaluate(()=>JSON.parse(localStorage.getItem(KvipFeedbackSync.KEY)).nextAttemptAt);assert.ok(retryAt-Date.now()>3500000,'Browser can read server Retry-After across CORS');
  await page.evaluate(()=>sync.flush());assert.equal(service.counts().events,checkpoint);await page.evaluate(t=>{window.__syncNow=t;return sync.flush();},retryAt);
  assert.equal((await page.evaluate(()=>sync.status())).pending,0);assert.equal(await page.evaluate(()=>createCardFeedbackText(localStorage,1)),failedArchive);
  await page.evaluate(()=>{clearCardReports(readCardReports().raw);return sync.flush();});
  // SQLite commits the first vote, but its ACK arrives after a newer edit in tab 2.
  let arrive;const committed=new Promise(resolve=>arrive=resolve);heldAck=holdAck={arrive};
  await page.evaluate(()=>saveCardApproval(testItem('late')));const sending=page.evaluate(()=>sync.flush());await committed;
  await second.evaluate(()=>{const item=testItem('late'),old=readCardApprovals().data.items.find(r=>r.item.cardId===item.cardId);saveCardFeedbackReport(item,'other','Новее запоздалого ACK',{replaceApproval:true,expectedApproval:JSON.stringify(old)});return sync.reconcile();});
  assert.equal((await second.evaluate(()=>sync.status())).pending,1);heldAck.release();await sending;
  assert.equal(service.counts().events,checkpoint+4);assert.equal(service.ownerExport().aggregates[0].count,1);assert.equal(service.ownerExport().reports[0].comment,'Новее запоздалого ACK');
  // A rollback latch raised while the sender waits for another tab prevents POST.
  await second.evaluate(()=>{window.__senderLock=navigator.locks.request('kvip-feedback-send-v1',()=>new Promise(resolve=>{window.__senderHeld=true;window.__releaseSender=resolve;}));});await second.waitForFunction(()=>window.__senderHeld);
  await page.evaluate(()=>{saveCardApproval(testItem('blocked'));return sync.reconcile();});const queueBefore=await page.evaluate(()=>localStorage.getItem(KvipFeedbackSync.KEY)),eventsBefore=service.counts().events;
  const waiting=page.evaluate(()=>sync.flush().then(()=>null,e=>e.message));await page.waitForFunction(async()=>(await navigator.locks.query()).pending.some(l=>l.name==='kvip-feedback-send-v1'));
  await page.evaluate(()=>{cardReportsBlocked=true;});await second.evaluate(()=>{window.__releaseSender();return window.__senderLock;});assert.match(await waiting,/Unconfirmed archive rollback/);
  assert.equal(service.counts().events,eventsBefore);assert.equal(await page.evaluate(()=>localStorage.getItem(KvipFeedbackSync.KEY)),queueBefore);
  await page.evaluate(()=>{cardReportsBlocked=false;return sync.flush();});assert.equal(service.counts().events,eventsBefore+1);
  for(const request of requests){assert.ok(!/ЛОКАЛЬНОЕ|scores|team|ownerToken|profileId|history/.test(request.body));assert.ok(!request.headers.authorization&&!request.headers.cookie);}
  assert.equal(await privateState(page),original);assert.deepEqual(errors,[]);await ctx.close();
  console.log('TASK025 browser PASS: inert v88 / real SQLite+CORS ACK / offline restart / Retry-After / original exports / replacement / two-tab late ACK / rollback while awaiting lock / tombstones / private state unchanged');
 }finally{heldAck?.release?.();await browser?.close();await new Promise(resolve=>server.close(resolve));service.close();exhausted.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
