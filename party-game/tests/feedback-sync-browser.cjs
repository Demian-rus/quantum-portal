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
  }});
  window.testItem=n=>({cardId:'test-'+n,pack:{id:'general',version:7},context:'round',modeId:'talk',methodId:null,difficulty:'easy',text:'ЛОКАЛЬНОЕ СЛОВО '+n});
 },endpoint);
}
const privateState=p=>p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().filter(k=>!['kvip-feedback-outbox:v1','kvip-card-reports:v1','kvip-card-approvals:v1'].includes(k)).map(k=>[k,localStorage.getItem(k)]))));
(async()=>{
 const service=createService({ownerToken:'browser-test-private-owner-token-not-in-client',origin:new globalThis.URL(URL).origin}),server=http.createServer(service.handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+server.address().port+'/v1/feedback';
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await ctx.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url()===endpoint&&r.method()==='POST')requests.push({body:r.postData(),headers:r.headers()});});await page.goto(URL);
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
  for(const request of requests){assert.ok(!/ЛОКАЛЬНОЕ|scores|team|ownerToken|profileId|history/.test(request.body));assert.ok(!request.headers.authorization&&!request.headers.cookie);}
  assert.equal(await privateState(page),original);assert.deepEqual(errors,[]);await ctx.close();
  console.log('TASK023A browser PASS: inert gate / real CORS ACK / offline restart / original exports / replacement / Web Locks across tabs / tombstones / private state unchanged');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));service.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
