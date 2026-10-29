'use strict';
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const {snapshot,signSnapshot}=require('../contracts/entitlements.cjs');
const {validateCatalog}=require('../contracts/catalog.cjs');
function error(code,status){return Object.assign(Error(code),{code,status});}
function createService({catalog,auth,store,materials,signingKey,keyId='test',audit,clock=Date.now}){
 validateCatalog(catalog);
 async function principal(request){if(!auth)throw error('AUTH_NOT_CONFIGURED',503);const id=await auth.resolve(request);if(!id)throw error('AUTH_REQUIRED',401);const a=await store.account(id);if(!a?.active)throw error('AUTH_REQUIRED',401);return a;}
 async function rights(account,clientVersion){return snapshot({account,grants:await store.grants(account.id),catalog,clientVersion,now:clock()});}
 async function handle(req,res){
  const requestId=crypto.randomUUID();res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Authorization');res.setHeader('X-Content-Type-Options','nosniff');
  function send(status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
  try{
   if(req.method!=='GET')throw error('METHOD_NOT_ALLOWED',405);
   const u=new URL(req.url,'http://local.invalid');if(u.pathname==='/health')return send(200,{service:'quip-commercial-scaffold',productionReady:false});
   const a=await principal(req);
   if(u.pathname==='/v1/auth/session')return send(200,{schemaVersion:1,account:{id:a.id},localGameProfiles:false});
   const clientVersion=req.headers['x-quip-client-version'];let r;try{r=await rights(a,clientVersion);}catch{throw error('ACCESS_UNAVAILABLE',503);}
   if(u.pathname==='/v1/entitlements'){
    if(!signingKey)throw error('SIGNING_NOT_CONFIGURED',503);
    await audit({type:'rights-read',requestId,accountId:a.id,at:clock()});return send(200,signSnapshot(r,signingKey,keyId));
   }
   const m=u.pathname.match(/^\/v1\/content\/([a-z][a-z0-9-]{0,79})\/([1-9]\d{0,8})$/);if(!m)throw error('NOT_FOUND',404);
   const p=catalog.packs.find(p=>p.id===m[1]&&p.version===Number(m[2]));if(!p)throw error('NOT_FOUND',404);
   const right=r.rights.find(x=>x.id===p.id&&x.version===p.version);
   if(!right?.allowed){await audit({type:'content-denied',requestId,accountId:a.id,pack:p.id,version:p.version,at:clock()});throw error('ACCESS_DENIED',403);}
   if(p.delivery!=='protected-server')throw error('LOCAL_FREE_CONTENT',409);
   // Failure of either audit or material storage fails closed. No access token,
   // email, payment instrument or local profile data is written to this journal.
   await audit({type:'content-authorized',requestId,accountId:a.id,pack:p.id,version:p.version,source:right.source,at:clock()});
   const body=await materials.read(p.id,p.version);if(!body)throw error('MATERIAL_UNAVAILABLE',503);return send(200,{schemaVersion:1,id:p.id,version:p.version,material:body});
  }catch(e){const status=e.status||503;return send(status,{error:e.status?e.code:'SERVICE_UNAVAILABLE',requestId});}
 }
 return {handle};
}
// Trusted server/admin operation, never an HTTP endpoint. The persistence
// adapter must implement grantOnce + audit in ONE database transaction.
async function grantAccess({store,actorId,grant,now=Date.now()}){
 const actor=await store.account(actorId);if(!actor?.active||actor.role!=='admin')throw error('ADMIN_REQUIRED',403);
 if(!['granted','owner'].includes(grant.source))throw error('PAYMENTS_DISABLED',503);
 const account=await store.account(grant.accountId);assert(account?.active,'Unknown recipient');
 snapshot({account,grants:[grant],catalog:{schemaVersion:1,packs:[]},clientVersion:'1.0.0',now});
 return store.grantOnce(grant,{type:grant.source==='owner'?'owner-granted':'access-granted',actorId,accountId:grant.accountId,grantId:grant.id,at:now});
}
const paymentProvider=Object.freeze({async confirm(){throw error('PAYMENTS_DISABLED',503);}});
module.exports={createService,grantAccess,paymentProvider,error};
