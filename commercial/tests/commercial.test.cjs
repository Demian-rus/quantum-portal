'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {validateCatalog,fromPublicPacks,compatible}=require('../contracts/catalog.cjs'),{snapshot,signSnapshot,verifySnapshot}=require('../contracts/entitlements.cjs'),{createService,grantAccess,paymentProvider}=require('../server/service.cjs'),{fakeStore,pack}=require('./fakes.cjs'),{debugOwnerPreview}=require('../debug/preview.cjs'),{build}=require('../build/build.cjs'),{plan}=require('../deploy/plan.cjs');
const now=1700000000000,account={id:'acct_test_synthetic',active:true,role:'user'},admin={id:'acct_admin_synthetic',active:true,role:'admin'},other={id:'acct_other_synthetic',active:true,role:'user'};
const free={id:'general',version:48,access:'free',entitlement:null,delivery:'local-free',minClientVersion:'1.0.0'},catalog={schemaVersion:1,packs:[free,pack]};
const grant=(source='granted',over={})=>({id:'grant_synthetic_01',accountId:account.id,scope:source==='owner'?'*':pack.entitlement,source,issuedAt:now-10,expiresAt:null,revokedAt:null,version:1,...over});
const rights=(grants=[],who=account,c=catalog)=>snapshot({account:who,grants,catalog:c,clientVersion:'1.0.0',now}).rights;
const ROOT=path.resolve(__dirname,'../..'),git=(...a)=>execFileSync('git',a,{cwd:ROOT,maxBuffer:32*1024*1024}),head=()=>git('rev-parse','HEAD').toString().trim();

test('all existing public pack versions and future free G batches default to free without mutating source',()=>{
 const d=require('../../party-game/scripts/content.cjs').readDataset(),before=JSON.stringify(d.packs),m=fromPublicPacks(d.packs);assert.equal(m.packs.length,d.packs.length);assert(m.packs.every(p=>p.access==='free'&&p.delivery==='local-free'&&p.entitlement===null));assert.equal(JSON.stringify(d.packs),before);
 assert.deepEqual(m.packs.map(p=>[p.id,p.version]),d.packs.map(p=>[p.id,p.version]));assert.equal(fromPublicPacks([{id:'general',version:999}]).packs[0].access,'free');
});
test('catalog rejects unknown schemas, duplicate versions, paid local delivery, malformed versions and payload fields',()=>{
 validateCatalog(catalog);for(const c of [{...catalog,schemaVersion:2},{...catalog,packs:[pack,pack]},{...catalog,packs:[{...pack,delivery:'local-free'}]},{...catalog,packs:[{...free,entitlement:'pay'}]},{...catalog,packs:[{...pack,payload:'FICTIONAL'}]},{...catalog,packs:[{...pack,minClientVersion:'latest'}]}])assert.throws(()=>validateCatalog(c));assert(compatible('1.2.0','1.1.9'));assert(!compatible('1.0.0','2.0.0'));
});
test('free remains free; paid defaults deny, local flags and another account cannot grant access',()=>{
 assert(rights([],null)[0].allowed);assert(!rights()[1].allowed);assert(!rights([grant('granted',{accountId:other.id})])[1].allowed);assert(!rights([], {...account,owner:true,purchased:true,localStorage:{premium:true}})[1].allowed);assert(!rights([grant()],{...account,active:false})[1].allowed);
});
test('purchased and granted expire/revoke; owner covers current AND future packs permanently, version gate remains',()=>{
 for(const source of ['purchased','granted']){assert(rights([grant(source)])[1].allowed);assert(!rights([grant(source,{expiresAt:now-1,issuedAt:now-100})])[1].allowed);assert(!rights([grant(source,{revokedAt:now-1})])[1].allowed);}
 const later={schemaVersion:1,packs:[pack,{...pack,id:'fictional-next',entitlement:'fictional-next'}]};assert(rights([grant('owner')],account,later).every(x=>x.allowed&&x.source==='owner'));assert(!rights([grant('owner')],account,{schemaVersion:1,packs:[{...pack,minClientVersion:'2.0.0'}]})[0].allowed);assert.throws(()=>rights([grant('owner',{expiresAt:now+10})]));
});
test('Ed25519 snapshot detects forgery, wrong account, expired snapshot, unknown key and key rotation',()=>{
 const k=crypto.generateKeyPairSync('ed25519'),k2=crypto.generateKeyPairSync('ed25519'),v=snapshot({account,grants:[grant()],catalog,clientVersion:'1.0.0',now}),signed=signSnapshot(v,k.privateKey,'rotation1'),opts={publicKeys:{rotation1:k.publicKey},accountId:account.id,now};assert(verifySnapshot(signed,opts).rights[1].allowed);
 for(const o of [{...opts,accountId:other.id},{...opts,now:now+60001},{...opts,publicKeys:{}},{...opts,publicKeys:{rotation1:k2.publicKey}}])assert.throws(()=>verifySnapshot(signed,o));assert.throws(()=>verifySnapshot({...signed,payload:Buffer.from(JSON.stringify({...v,accountId:other.id,keyId:'rotation1'})).toString('base64url')},opts));
});
test('manual permanent gifts/owner require trusted admin and are audited atomically/idempotently; payments disabled',async()=>{
 const store=fakeStore([account,other,admin]);await assert.rejects(grantAccess({store,actorId:account.id,grant:grant(),now}));assert.equal(await grantAccess({store,actorId:admin.id,grant:grant(),now}),true);assert.equal(await grantAccess({store,actorId:admin.id,grant:grant(),now}),false);assert.equal(store.events.length,1);assert.equal(await grantAccess({store,actorId:admin.id,grant:grant('owner',{id:'owner_synthetic_01'}),now}),true);assert.equal(store.events[1].type,'owner-granted');await assert.rejects(grantAccess({store,actorId:admin.id,grant:grant('purchased'),now}));await assert.rejects(paymentProvider.confirm());
});
async function serverCase(run,over={}){
 const store=fakeStore([account,other,admin]),events=[],keys=crypto.generateKeyPairSync('ed25519');let reads=0;
 const app=createService({catalog,auth:{resolve:async req=>req.headers.authorization==='Bearer SYNTHETIC_TEST_SESSION'?account.id:null},store,materials:{read:async()=>{reads++;return {text:'FICTIONAL TEST MATERIAL ONLY'};}},signingKey:keys.privateKey,keyId:'test',audit:async e=>events.push(e),clock:()=>now,...over});const server=http.createServer(app.handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await run({store,events,reads:()=>reads,keys,get:async(p,headers={})=>{const r=await fetch('http://127.0.0.1:'+server.address().port+p,{headers:{'X-QUIP-Client-Version':'1.0.0',...headers}});return {status:r.status,headers:r.headers,body:await r.json()};}});}finally{await new Promise(r=>server.close(r));}
}
const authenticated={Authorization:'Bearer SYNTHETIC_TEST_SESSION'};
test('native loopback HTTP fails closed; verified account + live grant required; signed snapshot is not content authorization',async()=>serverCase(async x=>{
 assert.equal((await x.get('/v1/content/fictional-moon/1')).status,401);assert.equal((await x.get('/v1/content/fictional-moon/1',authenticated)).status,403);assert.equal(x.reads(),0);
 await grantAccess({store:x.store,actorId:admin.id,grant:grant(),now});const signed=await x.get('/v1/entitlements',authenticated);assert.equal(signed.status,200);verifySnapshot(signed.body,{publicKeys:{test:x.keys.publicKey},accountId:account.id,now});
 assert.equal((await x.get('/v1/content/fictional-moon/1',{Authorization:signed.body.payload})).status,401);
 const material=await x.get('/v1/content/fictional-moon/1',authenticated);assert.equal(material.status,200);assert.equal(material.body.material.text,'FICTIONAL TEST MATERIAL ONLY');assert.equal(material.headers.get('cache-control'),'no-store');assert.equal(x.reads(),1);assert(x.events.every(e=>!JSON.stringify(e).includes('SYNTHETIC_TEST_SESSION')));
}));
test('auth, database, audit and material failures cannot return paid content; default stub cannot authenticate',async()=>{
 for(const over of [{auth:undefined},{auth:{resolve:async()=>{throw Error('synthetic outage');}}},{store:{account:async()=>{throw Error('offline');}}},{audit:async()=>{throw Error('journal unavailable');}}])await serverCase(async x=>assert.equal((await x.get('/v1/content/fictional-moon/1',authenticated)).status,503),over);
 await serverCase(async x=>{await grantAccess({store:x.store,actorId:admin.id,grant:grant(),now});assert.equal((await x.get('/v1/content/fictional-moon/1',authenticated)).status,503);},{materials:{read:async()=>{throw Error('offline');}}});
});
test('debug owner is synthetic and isolated from public HTML, worker and local game identities',()=>{
 assert(debugOwnerPreview().rights.every(x=>x.allowed&&x.source==='owner'));for(const name of ['index.html','sw.js'])assert(!/commercial\/|debugOwnerPreview|owner-preview|entitlements\.cjs/.test(fs.readFileSync(path.join(ROOT,'party-game',name),'utf8')));const config=require('../deploy/config.example.json'),schema=require('../deploy/config.schema.json');for(const [k,v]of Object.entries(schema.properties))assert.equal(config[k],v.const);assert.equal(schema.additionalProperties,false);
});
test('public build is exact-SHA allowlist only: no premium, debug, backend or editorial source; no APK/IPA claim',()=>{
 const dir=fs.mkdtempSync(path.join(path.dirname(ROOT),'task034-build-test-')),output=path.join(dir,'release');try{
  const r=build({sha:head(),out:output});assert.equal(r.variant,'public-web');assert.equal(r.deployEnabled,false);assert.equal(r.apkProduced,false);assert.equal(r.ipaProduced,false);assert(r.files.length>=54);
  for(const f of r.files)assert.deepEqual(fs.readFileSync(path.join(output,f.path)),git('show',head()+':'+f.path));
  const list=fs.readdirSync(output,{recursive:true});assert(!list.some(n=>/commercial|premium|private|owner|debug|\.cjs$|\.apk$|\.ipa$/.test(n)));assert(!list.some(n=>n.startsWith('party-game/content/')));assert(JSON.parse(fs.readFileSync(path.join(output,'public-catalog.json'))).packs.every(p=>p.access==='free'));
  assert.throws(()=>build({sha:'main',out:path.join(dir,'bad')}));assert.throws(()=>build({sha:head(),out:output}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('every deploy path is dry-run; exact file checksums and SHA, no network/cloud/payment operation',()=>{
 const dir=fs.mkdtempSync(path.join(path.dirname(ROOT),'task034-plan-test-'));try{
  assert.throws(()=>plan({sha:head(),out:path.join(dir,'bad'),dryRun:false}),/REAL_DEPLOY_DISABLED/);const p=plan({sha:head(),out:path.join(dir,'dry'),dryRun:true});assert.equal(p.sha,head());assert.deepEqual(p.networkOperations,[]);assert.deepEqual(p.cloudResources,[]);assert.equal(p.releaseEnabled,false);for(const f of p.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'dry',f.path))).digest('hex'),f.sha256);
  assert.match(fs.readFileSync(path.join(ROOT,'commercial/deploy/release.workflow.example.yml'),'utf8'),/if: \$\{\{ false \}\}/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unreviewed tracked payload is excluded; an allowlist attempting private delivery fails; wrapper/debug targets stay separate',()=>{
 const dir=fs.mkdtempSync(path.join(path.dirname(ROOT),'task034-isolation-test-'));
 function syntheticCommit(entries){const env={...process.env,GIT_INDEX_FILE:path.join(dir,'index'),GIT_AUTHOR_NAME:'Synthetic test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'Synthetic test',GIT_COMMITTER_EMAIL:'test@example.invalid'},run=(args,input)=>execFileSync('git',args,{cwd:ROOT,env,input}).toString().trim();run(['read-tree',head()]);for(const [name,text]of entries){const blob=run(['hash-object','-w','--stdin'],text);run(['update-index','--add','--cacheinfo','100644,'+blob+','+name]);}return run(['commit-tree',run(['write-tree']),'-p',head(),'-m','Synthetic local isolation fixture']);}
 try{
  const s=syntheticCommit([['party-game/assets/fictional-unreviewed.json','{"text":"FICTIONAL ONLY"}']]),r=build({sha:s,out:path.join(dir,'isolated')});assert(!r.files.some(f=>f.path.includes('fictional-unreviewed')));
  const allow=JSON.parse(git('show',head()+':commercial/build/public-files.json'));allow.files.push('premium/fictional.json');const bad=syntheticCommit([['commercial/build/public-files.json',JSON.stringify(allow)]]);assert.throws(()=>build({sha:bad,out:path.join(dir,'bad')}),/Non-public resource/);
  for(const variant of ['debug-preview','future-android-wrapper','future-ios-wrapper']){const output=path.join(dir,variant),b=build({sha:head(),out:output,variant});assert.equal(b.variant,variant);assert.equal(b.apkProduced,false);assert.equal(b.ipaProduced,false);assert.equal(fs.existsSync(path.join(output,'DEBUG-ONLY.txt')),variant==='debug-preview');}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
