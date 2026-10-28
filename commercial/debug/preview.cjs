'use strict';
// A separate local capability preview, not a game bypass or login mechanism.
// The public build never copies this source or its generated HTML.
const http=require('node:http'),crypto=require('node:crypto');
const {snapshot}=require('../contracts/entitlements.cjs');
const {pack}=require('../tests/fakes.cjs');
function debugOwnerPreview(){const now=Date.now();return snapshot({account:{id:'acct_debug_synthetic',active:true},grants:[{id:'debug_owner_grant',accountId:'acct_debug_synthetic',scope:'*',source:'owner',issuedAt:now,expiresAt:null,revokedAt:null,version:1}],catalog:{schemaVersion:1,packs:[pack,{...pack,id:'fictional-future',entitlement:'fictional-future'}]},clientVersion:'1.0.0',now});}
if(require.main===module){
 const token=crypto.randomBytes(24).toString('hex'),server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  if(req.headers.host!==`127.0.0.1:${server.address().port}`||req.url!=='/'+token){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>КВИП — фиктивный owner preview</title><h1>DEBUG: только фиктивные возможности</h1><p>Это не вход в аккаунт и не разблокировка опубликованной игры.</p><pre>'+JSON.stringify(debugOwnerPreview(),null,2)+'</pre>');
 });server.listen(0,'127.0.0.1',()=>console.log('Local debug only: http://127.0.0.1:'+server.address().port+'/'+token));
}
module.exports={debugOwnerPreview};
