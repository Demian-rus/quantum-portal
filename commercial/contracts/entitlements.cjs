'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {validateCatalog,compatible,exact}=require('./catalog.cjs');
const accountId=/^acct_[a-z0-9_-]{8,80}$/;
function snapshot({account,grants,catalog,clientVersion,now=Date.now()}){
 validateCatalog(catalog);assert(Array.isArray(grants));if(account)assert.match(account.id,accountId);
 for(const g of grants){exact(g,['id','accountId','scope','source','issuedAt','expiresAt','revokedAt','version']);assert.equal(g.version,1);assert.match(g.accountId,accountId);assert.match(g.id,/^[a-z0-9_-]{8,100}$/);assert(['purchased','granted','owner'].includes(g.source));assert(Number.isSafeInteger(g.issuedAt)&&g.issuedAt>=0);assert(g.expiresAt===null||Number.isSafeInteger(g.expiresAt)&&g.expiresAt>g.issuedAt);assert(g.revokedAt===null||Number.isSafeInteger(g.revokedAt)&&g.revokedAt>=g.issuedAt);assert(g.source==='owner'?g.scope==='*'&&g.expiresAt===null:/^[a-z][a-z0-9-]{0,79}$/.test(g.scope));}
 return {schemaVersion:1,accountId:account?.id||null,issuedAt:now,expiresAt:now+60000,rights:catalog.packs.map(p=>{
  const eligible=compatible(clientVersion,p.minClientVersion);
  if(p.access==='free')return {id:p.id,version:p.version,allowed:eligible,source:'free',expiresAt:null};
  const live=account?.active===true?grants.filter(g=>g.accountId===account.id&&g.issuedAt<=now&&g.revokedAt===null&&(g.expiresAt===null||g.expiresAt>now)&&(g.source==='owner'||g.scope===p.entitlement)):[];
  const g=live.find(g=>g.source==='owner')||live.find(g=>g.expiresAt===null)||live.sort((a,b)=>b.expiresAt-a.expiresAt)[0];
  return {id:p.id,version:p.version,allowed:eligible&&!!g,source:g?.source||null,expiresAt:g?.expiresAt??null};
 })};
}
// A signed UI snapshot is NOT a bearer credential for material delivery. The
// server rechecks its current database for each protected content request.
function signSnapshot(value,key,keyId){assert.match(keyId,/^[a-z0-9_-]{1,40}$/);const payload=Buffer.from(JSON.stringify({...value,keyId})).toString('base64url');return {payload,signature:crypto.sign(null,Buffer.from(payload),key).toString('base64url')};}
function verifySnapshot(token,{publicKeys,accountId:expected,now=Date.now()}){
 exact(token,['payload','signature']);assert(typeof token.payload==='string'&&token.payload.length<=200000&&/^[A-Za-z0-9_-]+$/.test(token.payload));assert.match(token.signature,/^[A-Za-z0-9_-]+$/);
 const value=JSON.parse(Buffer.from(token.payload,'base64url'));const key=publicKeys[value.keyId];assert(key&&crypto.verify(null,Buffer.from(token.payload),key,Buffer.from(token.signature,'base64url')),'Untrusted signature');
 assert.equal(value.schemaVersion,1);assert.equal(value.accountId,expected);assert(value.issuedAt<=now&&value.expiresAt>now&&value.expiresAt-value.issuedAt<=60000);assert(Array.isArray(value.rights));return value;
}
module.exports={snapshot,signSnapshot,verifySnapshot};
