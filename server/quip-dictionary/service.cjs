'use strict';
// Deployment-neutral server core. Credentials live in the GitHub App adapter only.
const crypto=require('node:crypto'),D=require('../../party-game/device-dictionary.js'),E=require('../../editorial/quip/editor.cjs'),{compile}=require('../../editorial/quip/compile.cjs');
const REPOSITORY='Demian-rus/quantum-portal',OWNER='Demian-rus';
function error(status,message){return Object.assign(Error(message),{status});}
function validateSubmission(body,c=E.context()){
 E.jsonData(body);if(!body||Object.keys(body).sort().join('|')!=='card|classification|key|version'||body.version!==1)throw error(422,'Unknown submission contract');
 const env={categories:[...c.categories],themes:[...c.themes]},card=D.card(body.card,env);if(D.hash(card)!==body.key||! /^[a-f0-9]{64}$/.test(body.key))throw error(422,'Idempotency key/content mismatch');
 const row=D.row(card),classification=D.classification(card);if(E.hash(classification)!==E.hash(body.classification))throw error(422,'Classification does not match card');
 if([...c.sources.values()].some(s=>D.normalize(s.row.text||s.row.question)===D.normalize(card.text)))throw error(409,'Duplicate published task');
 E.validateClassification(classification,row,c);
 // Exercise the real compiler in memory. This probe is not an editorial approval:
 // only the pending source document below is written to the staging PR.
 const ids=[...c.ids,row.id],sources=new Map(c.sources);sources.set(row.id,{row,path:'device/staging/'+body.key+'.json',fingerprint:E.hash(row)});
 const catalogs=c.catalogs.map(p=>{const ids=p.id==='general'||card.themes.includes(p.id)?[...p.ids,row.id]:p.ids.slice();return {...p,ids,idsDigest:E.hash(ids)};}),next={...c,ids,idSet:new Set(ids),sources,catalogs,general:catalogs.find(p=>p.id==='general'),songLanguages:new Map(c.songLanguages)};
 if(card.type==='song')next.songLanguages.set(row.id,card.language);
 const edition=E.readEdition(c),probe=JSON.parse(JSON.stringify(edition));
 probe.catalogs=catalogs.map(({id,version,ids,packDigest})=>({id,version,idsDigest:E.hash(ids),packDigest}));
 const proposal={form:card.type,categories:card.categories,legacyDifficulty:row.difficulty,themes:card.themes};
 probe.records.push({id:row.id,source:{path:sources.get(row.id).path,fingerprint:E.hash(row)},proposal,classification,review:{status:'reviewed',reviewer:'schema-probe-only',reviewedAt:new Date().toISOString(),rationale:'Temporary compiler validation only; no editorial approval is granted.'}});
 const result=compile(probe,next);
 return {kind:'quip-device-submission',version:1,key:body.key,card,classification,validation:{compiler:'quip@1',digest:result.digest},review:{status:'pending'}};
}
function createService({origin,auth,app,ledger,context=()=>E.context()}={}){
 if(!origin?.startsWith('https://')||!auth?.session||!auth?.validCsrf||!app?.permission||!app?.stageDraft||!app?.status||!ledger?.once||!ledger?.get)throw Error('Missing protected server dependencies');
 async function owner(request,write=false){
  if(request.headers.origin&&request.headers.origin!==origin)throw error(403,'Origin rejected');
  const session=await auth.session(request);if(!session)throw error(401,'Login required');if(session.login!==OWNER)throw error(403,'Owner required');
  const permission=await app.permission(REPOSITORY,session.login);if(!['admin','maintain','write'].includes(permission))throw error(403,'Repository access rejected');
  if(write&&(request.headers.origin!==origin||!await auth.validCsrf(request,session)))throw error(403,'CSRF rejected');return session;
 }
 async function handle(request){
  try{
   const session=await owner(request,request.method==='POST');
   if(request.method==='GET'&&request.path==='/session')return {status:200,body:{version:1,owner:true,csrf:session.csrf}};
   if(request.method==='POST'&&request.path==='/submissions'){
    if(Buffer.byteLength(JSON.stringify(request.body))>20000)throw error(413,'Submission too large');
    const key=request.headers['idempotency-key'];if(key!==request.body?.key)throw error(422,'Idempotency header mismatch');
    const result=await ledger.once(OWNER+':'+key,async()=>{
     const document=validateSubmission(request.body,context()),branch='staging/quip-device-'+key.slice(0,32),path='editorial/quip/inbox/device-'+key+'.json';
     const staged=await app.stageDraft({repository:REPOSITORY,base:'main',branch,path,content:JSON.stringify(document,null,2)+'\n',draft:true,title:'КВИП: задание с устройства — '+document.card.text.slice(0,70),key});
     if(!/^https:\/\/github.com\/Demian-rus\/quantum-portal\/pull\/\d+$/.test(staged.url))throw Error('Invalid GitHub App receipt');
     return {version:1,key,state:'submitted',submissionId:crypto.createHash('sha256').update(OWNER+':'+key).digest('hex'),url:staged.url,owner:OWNER};
    });return {status:200,body:{version:1,key:result.key,state:result.state,submissionId:result.submissionId,url:result.url}};
   }
   if(request.method==='GET'&& /^\/submissions\/[a-f0-9]{64}$/.test(request.path)){
    const id=request.path.split('/').at(-1),record=await ledger.get(id);if(!record||record.owner!==session.login)throw error(404,'Submission not found');
    const state=await app.status({repository:REPOSITORY,url:record.url});if(!['submitted','review','accepted'].includes(state))throw Error('Unknown editorial status');return {status:200,body:{version:1,key:record.key,state,submissionId:id,url:record.url}};
   }throw error(404,'Route not found');
  }catch(e){return {status:e.status||503,body:{version:1,error:e.status?e.message:'Server unavailable; submission remains queued'}};}
 }
 return Object.freeze({handle});
}
module.exports={validateSubmission,createService,REPOSITORY,OWNER};
