'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const protocolByRow=new WeakMap();
function documentProbe(){
 window.__boot38={scripts:[],errors:[],resourceErrors:[]};
 document.addEventListener('load',e=>{if(e.target.tagName==='SCRIPT')__boot38.scripts.push({src:e.target.src,ok:true});},true);
 window.addEventListener('error',e=>{if(e.target?.tagName==='SCRIPT')__boot38.scripts.push({src:e.target.src,ok:false});else if(typeof e.message==='string')__boot38.errors.push({message:e.message,file:e.filename,line:e.lineno,stack:e.error?.stack});else __boot38.resourceErrors.push({tag:e.target?.tagName,url:e.target?.src||e.target?.href});},true);
}
async function install(p,row){
 row.boots=[];row.networkFailures=[];row.pageErrors=[];row.httpErrors=[];
 p.on('pageerror',e=>row.pageErrors.push({message:e.message,stack:e.stack}));
 p.on('requestfailed',r=>row.networkFailures.push({url:r.url(),failure:r.failure()?.errorText,resource:r.resourceType()}));
 p.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()});});
 await p.addInitScript(documentProbe);
 // Observe cancellation/initiator/cache provenance without routing or changing
 // HTTP/CacheStorage/SW behavior. Retain a bounded window only for a failure.
 const cdp=await p.context().newCDPSession(p),recent=[];protocolByRow.set(row,recent);
 const keep=(event,data)=>{recent.push({event,...data});if(recent.length>3000)recent.splice(0,1000);};
 await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',e=>{if(['Script','Document'].includes(e.type))keep('request',{requestId:e.requestId,loaderId:e.loaderId,type:e.type,url:e.request.url,initiator:e.initiator,timestamp:e.timestamp,wallTime:e.wallTime});});
 cdp.on('Network.responseReceived',e=>{if(['Script','Document'].includes(e.type))keep('response',{requestId:e.requestId,loaderId:e.loaderId,type:e.type,url:e.response.url,status:e.response.status,mime:e.response.mimeType,protocol:e.response.protocol,fromDiskCache:e.response.fromDiskCache,fromServiceWorker:e.response.fromServiceWorker,serviceWorkerResponseSource:e.response.serviceWorkerResponseSource,timestamp:e.timestamp});});
 cdp.on('Network.loadingFailed',e=>keep('failed',e));
}
async function ready(p,row,label,out,root){
 const state=await p.evaluate(async()=>({document:document.readyState,url:location.href,app:typeof QuipTeams,errors:window.__boot38?.errors||[],resourceErrors:window.__boot38?.resourceErrors||[],scripts:[...document.scripts].filter(n=>n.src).map(n=>({src:n.src,...window.__boot38?.scripts.find(s=>s.src===n.src)})),controller:navigator.serviceWorker.controller?.scriptURL||null,registrations:await navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>({scope:r.scope,active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state}))),caches:await caches.keys()}));
 row.boots.push({label,...state});
 if(state.app==='undefined'||state.errors.length||state.scripts.some(s=>s.ok!==true)){
  const sources=await p.evaluate(async()=>{const result=[];for(const n of document.scripts)if(n.src){try{const cached=await caches.match(n.src);if(!cached){result.push({url:n.src,cached:false});continue;}const bytes=await cached.arrayBuffer();result.push({url:n.src,cached:true,bytes:bytes.byteLength,status:cached.status,mime:cached.headers.get('content-type'),sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')});}catch(e){result.push({url:n.src,error:e.message});}}return result;});
  for(const s of sources){const file=path.join(root,'.'+new URL(s.url).pathname);s.expected=fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null;s.exact=s.sha256===s.expected;}
  fs.writeFileSync(path.join(out,'boot-failure.json'),JSON.stringify({label,state,sources,pageErrors:row.pageErrors,networkFailures:row.networkFailures,httpErrors:row.httpErrors,protocol:protocolByRow.get(row)},null,2));
  throw Error('Application boot failed: '+label+' '+JSON.stringify({errors:state.errors,unloaded:state.scripts.filter(s=>s.ok!==true),network:row.networkFailures.slice(-8)}));
 }
 assert.equal(state.document,'complete');await p.evaluate(()=>QuipTeams.whenReady());
}
async function verifyCatalog(p,root){
 const refs=await p.locator('script[src]').evaluateAll(ns=>ns.filter(n=>/\/(?:cards|content-packs|approx-questions)\.js\?/.test(n.src)).map(n=>n.src));assert.equal(refs.length,3);
 const rows=[];for(const url of refs){const actual=await p.evaluate(async url=>{const response=await fetch(url);if(!response.ok)throw Error('Catalog HTTP '+response.status);const bytes=await response.arrayBuffer();return {bytes:bytes.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')};},url),expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'.'+new URL(url).pathname))).digest('hex');assert.equal(actual.sha256,expected,'real served synthetic catalog is byte-exact '+url);rows.push({file:path.basename(new URL(url).pathname),...actual});}return rows;
}
module.exports={install,ready,verifyCatalog};
