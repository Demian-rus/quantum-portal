'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {normalizeTask032}=require('./task032-contract.cjs');
const F=require('../team-format.js'),S=require('../team-storage.js');
const names=[['ДС','ПА'],['Мама','Папа']],id='team-match-fixture-0001';
const header=(bits=[0,0,0])=>{let calls=0;const h=F.create(names,{id,random:()=>bits[calls++]===1 ? .75 : .25});assert.equal(calls,3);return h;};
const match=(bits,turn=0)=>({teamFormat:header(bits),fixtureOnly:true,turn});
const copy=v=>JSON.parse(JSON.stringify(v));
// Deliberately a TEST payload validator, not a production game validator.
const validator=m=>m.fixtureOnly===true&&Number.isSafeInteger(m.turn)&&m.turn>=0&&Object.keys(m).length===3;
function harness(){
 const map=new Map([['iskra-party:v1','UNFINISHED_DUEL_RAW'],['kvip-player-profiles:v1','PROFILES_RAW']]),access=[];
 const allowed=k=>{assert.ok([S.KEY,S.JOURNAL_KEY].includes(k),'must not access duel/profile keys: '+k);};
 const storage={getItem(k){allowed(k);access.push(['get',k]);return map.get(k)??null;},setItem(k,v){allowed(k);access.push(['set',k]);map.set(k,String(v));},removeItem(k){allowed(k);access.push(['remove',k]);map.delete(k);}};
 let tail=Promise.resolve();const exclusive=fn=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;};
 const digest=async raw=>crypto.createHash('sha256').update(raw).digest('hex');
 const make=(overrides={})=>S.create({storage,exclusive,digest,validateMatch:validator,...overrides});
 return {map,storage,access,make};
}
test('all eight opening combinations rotate roles fairly over 4, 8 and 12 turns without RNG',()=>{
 for(const first of [0,1])for(const a of [0,1])for(const b of [0,1]){
  const h=header([first,a,b]),before=JSON.stringify(h);
  for(const n of [4,8,12]){
   const count=[[0,0],[0,0]];
   for(let turn=0;turn<n;turn++){
    const r=F.roles(h,turn);assert.equal(r.teamIndex,(first+turn)%2);assert.equal(r.setterPlayerIndex,([a,b][r.teamIndex]+Math.floor(turn/2))%2);
    assert.equal(r.guesserPlayerIndex,1-r.setterPlayerIndex);assert.equal(r.recipientTeamIndex,r.teamIndex);assert.equal(r.setterName,names[r.teamIndex][r.setterPlayerIndex]);
    assert.deepEqual(F.validateTurnIdentity(h,turn,F.turnIdentity(h,turn)),F.turnIdentity(h,turn));count[r.teamIndex][r.setterPlayerIndex]++;
   }
   assert.deepEqual(count,[[n/4,n/4],[n/4,n/4]]);
  }
  assert.equal(JSON.stringify(h),before);assert.ok(Object.isFrozen(h.opening.setterPlayerIndices));
 }
});
test('documented sequence DS→PA, Mama→Papa, PA→DS, Papa→Mama',()=>{
 const h=header();assert.deepEqual(Array.from({length:4},(_,i)=>{const r=F.roles(h,i);return [r.setterName,r.guesserName];}),[['ДС','ПА'],['Мама','Папа'],['ПА','ДС'],['Папа','Мама']]);
});
test('names normalize before the three draws; invisible, empty, long and lookalike duplicates are rejected',()=>{
 assert.deepEqual(F.members([['  ДС  ','ПА'],[' Мама\u00a0  Смирнова ','Папа']]),[['ДС','ПА'],['Мама Смирнова','Папа']]);
 for(const bad of ['', ' ', 'x'.repeat(25),'Мама\u200b','Мама\u202e','Мама\n'])assert.throws(()=>F.create([[bad,'ПА'],['Мама','Папа']],{id,random:()=>{throw Error('RNG must not run');}}),/TEAM_FORMAT/);
 for(const pair of [['МАМА','мама'],['Мама  А','Мама А'],['ПAPA','ПАРА'],['ＤＣ','DC']])assert.throws(()=>F.members([pair,['Миша','Даша']]),/distinguishable/);
 assert.throws(()=>F.create(names,{id:'short',random:()=>{throw Error('RNG must not run');}}),/ID/);
 for(const random of [()=>NaN,()=>-1,()=>1,()=>Infinity])assert.throws(()=>F.create(names,{id,random}),/random/);
});
test('future/corrupt formats, impossible identities and unknown fields fail closed',()=>{
 for(const mutate of [h=>h.version++,h=>h.format='duel',h=>h.statsPolicy='profiles',h=>h.extra=1,h=>h.opening.teamIndex=2,h=>h.opening.setterPlayerIndices=[0],h=>h.teams[0].members[0]='ПА',h=>h.teams[0].name='Подмена']){
  const h=copy(header());mutate(h);assert.throws(()=>F.validate(h),/TEAM_FORMAT/);
 }
 for(const index of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>F.roles(header(),index),/turn/);
 const sparse=copy(header());sparse.opening.setterPlayerIndices=Array(2);assert.throws(()=>F.validate(sparse),/opening/);
 for(const key of ['teamIndex','setterPlayerIndex','guesserPlayerIndex','recipientTeamIndex']){const turn=copy(F.turnIdentity(header(),0));turn[key]=1-turn[key];assert.throws(()=>F.validateTurnIdentity(header(),0,turn),/inconsistent/);}
});
test('storage refuses to exist without a full validator and an exclusive lock provider',()=>{
 const h=harness();assert.throws(()=>S.create({storage:h.storage}),/полный валидатор/);
 const scope={module:{exports:{}},require:()=>F};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../team-storage.js'),'utf8'),scope);
 assert.throws(()=>scope.module.exports.create({storage:h.storage,validateMatch:validator}),/Web Locks/);
});
test('separate slot: verified commits, restart, monotonic revision and exact old duel/profile RAW',async()=>{
 const h=harness(),s=h.make();assert.equal((await s.load()).status,'empty');
 let current=await s.commit({expectedRaw:null,match:match()});assert.equal(current.revision,1);assert.equal(current.match.teamFormat.statsPolicy,F.STATS_POLICY);
 current=await h.make().commit({expectedRaw:current.raw,match:match([0,0,0],12)});assert.equal(current.revision,2);
 assert.deepEqual(await h.make().load(),current);assert.equal(h.map.get('iskra-party:v1'),'UNFINISHED_DUEL_RAW');assert.equal(h.map.get('kvip-player-profiles:v1'),'PROFILES_RAW');assert.equal(h.map.has(S.JOURNAL_KEY),false);
});
test('parallel writers with the same RAW cannot both commit, and stale revision/action is rejected',async()=>{
 const h=harness(),a=h.make(),b=h.make(),old=await a.commit({expectedRaw:null,match:match()});
 const results=await Promise.allSettled([a.commit({expectedRaw:old.raw,match:match([0,0,0],1)}),b.commit({expectedRaw:old.raw,match:match([0,0,0],2)})]);
 assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected']);assert.equal(results[1].reason.code,'CONFLICT');
 assert.equal((await b.load()).match.turn,1);assert.equal((await b.load()).revision,2);
 await assert.rejects(b.commit({match:match()}),e=>e.code==='EXPECTED_RAW_REQUIRED');
});
test('caller mutation while awaiting the lock/digest cannot alter the action snapshot',async()=>{
 const h=harness(),m=match(),promise=h.make().commit({expectedRaw:null,match:m});m.turn=999;m.teamFormat=header([1,1,1]);
 const out=await promise;assert.equal(out.match.turn,0);assert.equal(out.match.teamFormat.opening.teamIndex,0);
});
test('corrupt, future and oversized RAW is preserved, cannot be overwritten as a fresh match',async()=>{
 const h=harness(),s=h.make(),old=await s.commit({expectedRaw:null,match:match()});
 const changes=[raw=>'{bad',raw=>{const x=JSON.parse(raw);x.version=9;return JSON.stringify(x);},raw=>{const x=JSON.parse(raw);x.match.turn=99;return JSON.stringify(x);},raw=>'x'.repeat(S.MAX_BYTES+1)];
 for(const change of changes){const raw=change(old.raw);h.map.set(S.KEY,raw);const out=await s.load();assert.equal(out.status,'blocked');assert.equal(h.map.get(S.KEY),raw);await assert.rejects(s.commit({expectedRaw:raw,match:match()}));assert.equal(h.map.get(S.KEY),raw);assert.equal(h.map.has(S.JOURNAL_KEY),false);}
});
test('size uses UTF-8 bytes; invalid payloads, validator failures and replacement match IDs write nothing',async()=>{
 const h=harness();for(const bad of [null,{teamFormat:header()}, {...match(),turn:-1}])await assert.rejects(h.make().commit({expectedRaw:null,match:bad}));assert.equal(h.access.some(r=>r[0]==='set'),false);
 const s=h.make(),old=await s.commit({expectedRaw:null,match:match()}),next=match();next.teamFormat=F.create(names,{id:'different-match-id-0001',random:()=>0});
 await assert.rejects(s.commit({expectedRaw:old.raw,match:next}),e=>e.code==='MATCH_CHANGED');assert.equal(h.map.get(S.KEY),old.raw);
 const big={...match(),text:'я'.repeat(800)},limited=h.make({maxBytes:1024,validateMatch:m=>m.fixtureOnly===true});
 await assert.rejects(limited.commit({expectedRaw:old.raw,match:big}),e=>e.code==='LIMIT');assert.equal(h.map.get(S.KEY),old.raw);
});
test('UTF-8 size boundary preserves RAW for ASCII, Cyrillic, BMP, astral and lone surrogates',async()=>{
 for(const limit of [1024,2048])for(const unit of ['a','я','ह','😀','\ud800','\udc00','aяह😀\ud800'])for(const length of [Math.floor(limit/3)-1,Math.floor(limit/3),Math.floor(limit/3)+1,Math.floor(limit/2)-1,Math.floor(limit/2)+1,limit-1,limit,limit+1]){
  const h=harness(),raw=unit.repeat(length);h.map.set(S.KEY,raw);
  const result=await h.make({maxBytes:limit}).load();
  assert.equal(result.status,'blocked');assert.equal(result.reason,Buffer.byteLength(raw,'utf8')>limit?'LIMIT':'CORRUPT',JSON.stringify({unit,length,limit}));
  assert.equal(h.map.get(S.KEY),raw);assert.equal(h.map.has(S.JOURNAL_KEY),false);
 }
});
test('failure before journal verification never writes the primary slot',async()=>{
 for(const fault of ['throw','silent','different']){
  const h=harness(),set=h.storage.setItem;h.storage.setItem=(k,v)=>{if(k===S.JOURNAL_KEY){if(fault==='throw')throw Error('quota');if(fault==='silent')return;if(fault==='different')return set(k,'UNTRUSTED');}return set(k,v);};
  await assert.rejects(h.make().commit({expectedRaw:null,match:match()}));assert.equal(h.map.has(S.KEY),false);
  if(fault==='different'){const raw=h.map.get(S.JOURNAL_KEY);assert.equal((await h.make().pending()).status,'blocked');assert.equal(h.map.get(S.JOURNAL_KEY),raw);}
 }
});
test('write failures preserve the verified before/after journal, explicit recovery can retain either action',async()=>{
 for(const choice of ['keep-before','keep-after'])for(const fault of ['primary-throw','primary-silent','journal-remove']){
  const h=harness(),s=h.make(),old=await s.commit({expectedRaw:null,match:match()}),set=h.storage.setItem,remove=h.storage.removeItem;
  h.storage.setItem=(k,v)=>{if(k===S.KEY&&fault==='primary-throw')throw Error('quota');if(k===S.KEY&&fault==='primary-silent')return;return set(k,v);};
  h.storage.removeItem=k=>{if(k===S.JOURNAL_KEY&&fault==='journal-remove')throw Error('remove');return remove(k);};
  await assert.rejects(s.commit({expectedRaw:old.raw,match:match([0,0,0],1)}));assert.equal((await s.load()).reason,'RECOVERY_REQUIRED');
  const pending=await s.pending();assert.equal(pending.status,'pending');assert.equal(pending.before,old.raw);
  h.storage.setItem=set;h.storage.removeItem=remove;
  const recovered=await s.recover({expectedJournal:pending.journal,choice});assert.equal(recovered.raw,choice==='keep-before'?old.raw:pending.after);assert.equal(recovered.match.turn,choice==='keep-before'?0:1);assert.equal(h.map.has(S.JOURNAL_KEY),false);
 }
});
test('first creation can recover to empty without touching an existing duel',async()=>{
 const h=harness(),remove=h.storage.removeItem;h.storage.removeItem=()=>{throw Error('remove');};
 const s=h.make();await assert.rejects(s.commit({expectedRaw:null,match:match()}));const pending=await s.pending();h.storage.removeItem=remove;
 assert.equal((await s.recover({expectedJournal:pending.journal,choice:'keep-before'})).status,'empty');assert.equal(h.map.has(S.KEY),false);assert.equal(h.map.get('iskra-party:v1'),'UNFINISHED_DUEL_RAW');
});
test('foreign/stale/corrupt journals and unexpected primary data never cause automatic rollback',async()=>{
 const h=harness(),s=h.make(),remove=h.storage.removeItem;h.storage.removeItem=()=>{throw Error('remove');};
 await assert.rejects(s.commit({expectedRaw:null,match:match()}));const p=await s.pending();h.storage.removeItem=remove;
 await assert.rejects(s.recover({expectedJournal:p.journal,choice:'automatic'}),e=>e.code==='RECOVERY_CHOICE');
 await assert.rejects(s.recover({expectedJournal:p.journal+' ',choice:'keep-after'}),e=>e.code==='CONFLICT');
 h.map.set(S.KEY,'FOREIGN_RAW');await assert.rejects(s.recover({expectedJournal:p.journal,choice:'keep-before'}),e=>e.code==='CONFLICT');assert.equal(h.map.get(S.KEY),'FOREIGN_RAW');assert.equal(h.map.get(S.JOURNAL_KEY),p.journal);
 h.map.set(S.JOURNAL_KEY,'{bad');assert.equal((await s.pending()).status,'blocked');assert.equal(h.map.get(S.KEY),'FOREIGN_RAW');
});
test('read/digest/full-validator failure is protected and does not clear any key',async()=>{
 const h=harness(),s=h.make(),old=await s.commit({expectedRaw:null,match:match()});
 for(const overrides of [{digest:async()=>{throw Error('digest unavailable');}},{validateMatch:()=>false}]){
  assert.equal((await h.make(overrides).load()).status,'blocked');await assert.rejects(h.make(overrides).commit({expectedRaw:old.raw,match:match()}));assert.equal(h.map.get(S.KEY),old.raw);
 }
 h.storage.getItem=()=>{throw Error('denied');};assert.equal((await s.load()).reason,'UNAVAILABLE');assert.equal(h.map.get(S.KEY),old.raw);
});
test('a noncooperating write during asynchronous checksum verification is detected without rollback',async()=>{
 const h=harness(),s=h.make(),old=await s.commit({expectedRaw:null,match:match()});let changed=false;
 const injected=h.make({digest:async raw=>{if(!changed){changed=true;h.map.set(S.KEY,'FOREIGN_DURING_DIGEST');}return crypto.createHash('sha256').update(raw).digest('hex');}});
 await assert.rejects(injected.commit({expectedRaw:old.raw,match:match([0,0,0],2)}),e=>e.code==='CONFLICT');
 assert.equal(h.map.get(S.KEY),'FOREIGN_DURING_DIGEST');assert.equal(h.map.has(S.JOURNAL_KEY),false);
});
test('partial primary write protects both the foreign RAW and pending journal for manual inspection',async()=>{
 const h=harness(),s=h.make(),old=await s.commit({expectedRaw:null,match:match()}),set=h.storage.setItem;
 h.storage.setItem=(k,v)=>{set(k,k===S.KEY?'PARTIAL_RAW':v);};await assert.rejects(s.commit({expectedRaw:old.raw,match:match([0,0,0],1)}));
 assert.equal((await s.pending()).status,'blocked');const journal=h.map.get(S.JOURNAL_KEY);
 await assert.rejects(s.recover({expectedJournal:journal,choice:'keep-before'}),e=>e.code==='CONFLICT');
 assert.equal(h.map.get(S.KEY),'PARTIAL_RAW');assert.equal(h.map.get(S.JOURNAL_KEY),journal);
});
test('team runtime is a separate versioned shell and never replaces legacy controllers',()=>{
 const html=normalizeTask032(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')),sw=normalizeTask032(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'));
 for(const [name,version]of [['team-format',1],['team-storage',4],['team-engine',1],['team-controller',7]]){assert.ok(html.includes('./'+name+'.js?v='+version));assert.ok(sw.includes('./'+name+'.js?v='+version));}
 assert.match(fs.readFileSync(path.join(__dirname,'../setup-wizard.js'),'utf8'),/id="wizard-format-teams"[^>]*>2 НА 2/);
 assert.doesNotMatch(html,/feedback-sync/);
});
test('replacement requires an explicit old ID and an exact archived previous party, including recovery',async()=>{
 for(const choice of ['keep-before','keep-after']){
  const h=harness(),old=match(),next={...match(),teamFormat:F.create(names,{id:'next-team-fixture-0001',random:()=>0}),previous:old};
  const validateMatch=m=>validator(m)||m.previous&&Object.keys(m).length===4&&validator(m.previous);
  const validateReplacement=(a,b)=>JSON.stringify(b.previous)===JSON.stringify(a);
  const store=h.make({validateMatch,validateReplacement}),saved=await store.commit({expectedRaw:null,match:old});
  await assert.rejects(store.commit({expectedRaw:saved.raw,match:next}),e=>e.code==='MATCH_CHANGED');
  await assert.rejects(store.commit({expectedRaw:saved.raw,match:{...next,previous:{...old,turn:9}},replaceMatchId:id}),e=>e.code==='MATCH_CHANGED');
  const remove=h.storage.removeItem;h.storage.removeItem=k=>{throw Error('journal cleanup failure');};
  await assert.rejects(store.commit({expectedRaw:saved.raw,match:next,replaceMatchId:id}));h.storage.removeItem=remove;
  const journal=await store.pending();assert.equal(journal.status,'pending');assert.equal(JSON.parse(journal.journal).version,2);
  const restored=await store.recover({expectedJournal:journal.journal,choice});assert.deepEqual(restored.match,choice==='keep-before'?old:next);
  assert.equal(h.map.get('iskra-party:v1'),'UNFINISHED_DUEL_RAW');
 }
});
test('a stale action reports conflict while a current action still requires explicit journal recovery',async()=>{
 const h=harness(),s=h.make(),before=await s.commit({expectedRaw:null,match:match()});
 const remove=h.storage.removeItem;h.storage.removeItem=()=>{throw Error('keep journal')};await assert.rejects(s.commit({expectedRaw:before.raw,match:match(undefined,1)}));h.storage.removeItem=remove;
 await assert.rejects(s.commit({expectedRaw:before.raw,match:match(undefined,2)}),e=>e.code==='CONFLICT');
 await assert.rejects(s.commit({expectedRaw:h.map.get(S.KEY),match:match(undefined,2)}),e=>e.code==='RECOVERY_REQUIRED');
 assert.equal((await s.pending()).status,'pending');assert.equal((await s.load()).status,'blocked');
});
test('load and pending classification recheck RAW after asynchronous verification, without any recovery write',async()=>{
 for(const operation of ['load','commit']){
  const h=harness(),store=h.make(),before=await store.commit({expectedRaw:null,match:match()}),after=await store.commit({expectedRaw:before.raw,match:match(undefined,1)});
  h.map.set(S.KEY,before.raw);h.map.set(S.JOURNAL_KEY,JSON.stringify({version:1,before:before.raw,after:after.raw}));let once=true;
  const digest=async text=>{if(once){once=false;h.map.set(S.KEY,after.raw);h.map.delete(S.JOURNAL_KEY);}return crypto.createHash('sha256').update(text).digest('hex');};
  const reading=h.make({digest}),writes=h.access.filter(x=>x[0]!=='get').length;
  if(operation==='commit')await assert.rejects(reading.commit({expectedRaw:before.raw,match:match(undefined,2)}),e=>e.code==='CONFLICT');
  else assert.equal((await reading.load()).reason,'CONFLICT');
  assert.equal(h.access.filter(x=>x[0]!=='get').length,writes);assert.equal(h.map.get(S.KEY),after.raw);
 }
});
function receiptHarness(){let raw=null;return {get raw(){return raw},set raw(value){raw=value},read:async()=>raw,write:async(expected,next)=>{if(expected!==raw)throw Object.assign(Error('receipt conflict'),{code:'CONFLICT'});raw=next;}};}
test('transactional receipt rejects a stale renderer even if both localStorage values still look old',async()=>{
 const h=harness(),receipt=receiptHarness(),s=h.make({receipt}),before=await s.commit({expectedRaw:null,match:match()}),after=await s.commit({expectedRaw:before.raw,match:match(undefined,1)}),confirmed=receipt.raw;
 h.map.set(S.KEY,before.raw);h.map.delete(S.JOURNAL_KEY);const writes=h.access.filter(x=>x[0]!=='get').length;
 await assert.rejects(s.commit({expectedRaw:before.raw,match:match(undefined,2)}),e=>e.code==='CONFLICT');assert.equal(h.access.filter(x=>x[0]!=='get').length,writes);assert.equal(receipt.raw,confirmed);
 assert.equal((await s.load()).reason,'MIRROR_MISMATCH');assert.equal(h.map.get(S.KEY),before.raw);assert.equal(JSON.parse(confirmed).committedRaw,after.raw);
 for(const bad of ['{"version":99}',JSON.stringify({version:99,committedRaw:after.raw,pendingJournal:null})]){receipt.raw=bad;assert.equal((await s.load()).status,'blocked');await assert.rejects(s.commit({expectedRaw:before.raw,match:match()}));assert.equal((await s.inspect()).receipt,bad);assert.equal(h.map.get(S.KEY),before.raw);}
});
test('receipt intent/final acknowledgement failures never claim success; both versions survive explicit recovery',async()=>{
 for(const fault of ['intent-throw','intent-silent','final-throw','final-silent'])for(const choice of ['keep-before','keep-after']){
  const h=harness(),receipt=receiptHarness(),s=h.make({receipt}),before=await s.commit({expectedRaw:null,match:match()}),write=receipt.write;
  receipt.write=async(expected,next)=>{const value=JSON.parse(next),selected=fault.startsWith('intent')?value.pendingJournal!==null:value.pendingJournal===null;if(selected){if(fault.endsWith('throw'))throw Error(fault);return;}return write(expected,next);};
  await assert.rejects(s.commit({expectedRaw:before.raw,match:match(undefined,1)}));receipt.write=write;
  if(fault.startsWith('intent')){assert.equal(h.map.get(S.KEY),before.raw);assert.equal((await s.load()).status,'ok');assert.equal((await s.pending()).status,'empty');}
  else{assert.equal(h.map.has(S.JOURNAL_KEY),false,'the receipt retains the journal even after local cleanup');assert.equal((await s.load()).reason,'RECOVERY_REQUIRED');const pending=await s.pending();assert.equal(pending.status,'pending');assert.equal(pending.before,before.raw);const out=await s.recover({expectedJournal:pending.journal,choice});assert.equal(out.raw,choice==='keep-before'?before.raw:pending.after);assert.equal((await s.load()).status,'ok');assert.equal(JSON.parse(receipt.raw).pendingJournal,null);}
  assert.equal(h.map.get('iskra-party:v1'),'UNFINISHED_DUEL_RAW');
 }
});
