'use strict';
// Build/server contract only. Never loaded by party-game/index.html.
const assert=require('node:assert/strict');
const slug=/^[a-z][a-z0-9-]{0,79}$/;
function version(v){assert.match(v,/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);return v.split('.').map(Number);}
function compatible(actual,minimum){const a=version(actual),b=version(minimum);for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return true;}
function exact(value,keys){assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),keys.slice().sort());}
function validateCatalog(manifest){
 exact(manifest,['schemaVersion','packs']);assert.equal(manifest.schemaVersion,1);assert(Array.isArray(manifest.packs));const seen=new Set();
 for(const p of manifest.packs){
  exact(p,['id','version','access','entitlement','delivery','minClientVersion']);assert.match(p.id,slug);assert(Number.isSafeInteger(p.version)&&p.version>0);version(p.minClientVersion);
  const key=p.id+'@'+p.version;assert(!seen.has(key));seen.add(key);
  if(p.access==='free'){assert.equal(p.entitlement,null);assert.equal(p.delivery,'local-free');}
  else{assert.equal(p.access,'paid');assert.match(p.entitlement,slug);assert.equal(p.delivery,'protected-server');}
 }
 return manifest;
}
// This adapter is intentionally for the PUBLIC editorial source only. A later
// free G batch remains free without changing this module or a hard-coded count.
function fromPublicPacks(packs){return validateCatalog({schemaVersion:1,packs:packs.map(p=>({id:p.id,version:p.version,access:'free',entitlement:null,delivery:'local-free',minClientVersion:'1.0.0'}))});}
module.exports={validateCatalog,fromPublicPacks,compatible,exact};
