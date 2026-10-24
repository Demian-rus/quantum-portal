'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function harness(storage=new Map()){
 const localStorage={
   getItem:key=>storage.has(key)?storage.get(key):null,
   setItem:(key,value)=>storage.set(key,String(value)),
   removeItem:key=>storage.delete(key)
 };
 const context=vm.createContext({
   Date,console,TextEncoder,crypto:require('node:crypto').webcrypto,localStorage
 });
 vm.runInContext(fs.readFileSync(path.join(root,'player-profiles.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'profile-backup.js'),'utf8'),context);
 return {context,storage,eval:source=>vm.runInContext(source,context)};
}
function profiles(h){
 h.eval("createPlayerProfile('ДС','violet');createPlayerProfile('ПА','green');selectedProfileIds=profileStore.profiles.map(p=>p.id)");
}
function match(h){
 h.eval("var identity=reserveProfileMatch();var match={matchId:identity.storeId+':'+identity.sequence,profileMatch:identity,"+
 "teams:identity.participants.map(p=>p.name),scores:[1,0],history:["+
 "{mode:'talk',setterIndex:0,recipientIndex:0,awarded:1,taskSuccess:true},"+
 "{mode:'talk',setterIndex:1,recipientIndex:1,awarded:0,taskSuccess:false}],"+
 "roundIndex:2,finishType:'rounds',rounds:2,phase:'results'};commitProfileResult(match)");
}
async function backup(h){
 return await h.eval('createProfileBackupText(profileStore,1761300000000)');
}
test('backup: complete profiles, scores and lifetime watermark survive an empty-device round trip',async()=>{
 const source=harness();profiles(source);match(source);
 const raw=source.storage.get('kvip-player-profiles:v1'),doc=await backup(source);
 const target=harness();target.context.archived=doc;
 const preview=await target.eval('inspectProfileBackupText(archived)');
 assert.equal(preview.relationship,'empty');
 assert.equal(preview.summary.profiles.length,2);
 assert.equal(preview.summary.profiles[0].games,1);
 assert.equal(target.storage.size,0,'preflight may not write anything');
 const outcome=await target.eval('restoreProfileBackupText(localStorage,archived)');
 assert.equal(outcome.status,'restored');
 assert.equal(target.storage.get('kvip-player-profiles:v1'),raw);
 target.eval('restoreProfiles()');
 assert.equal(target.eval('profileStore.settledThrough'),1);
 assert.equal(target.eval('profileStore.totals[profileStore.profiles[0].id].wins'),1);
 const before=target.storage.get('kvip-player-profiles:v1');
 assert.equal((await target.eval('restoreProfileBackupText(localStorage,archived)')).status,'unchanged');
 assert.equal(target.storage.get('kvip-player-profiles:v1'),before);
});
test('backup: SHA-256 verifies archived data and fails on tampering',async()=>{
 const h=harness();profiles(h);const doc=JSON.parse(await backup(h));
 assert.match(doc.sha256,/^[0-9a-f]{64}$/);
 doc.payload.profiles[0].name='Другое имя';
 h.context.document=JSON.stringify(doc);
 await assert.rejects(()=>h.eval('inspectProfileBackupText(document)'),/контрольная сумма/);
 assert.equal(h.storage.size,1,'failed preflight must not write the archive');
});
test('backup: malformed JSON, unknown format, broken schema and oversize input fail closed',async()=>{
 const h=harness();profiles(h);const doc=JSON.parse(await backup(h));
 for(const bad of ['{broken',JSON.stringify({...doc,version:23}),JSON.stringify({...doc,payload:null})]){
  h.context.bad=bad;await assert.rejects(()=>h.eval('inspectProfileBackupText(bad)'));
 }
 h.context.bad='x'.repeat(4*1024*1024+1);
 await assert.rejects(()=>h.eval('inspectProfileBackupText(bad)'),/слишком большой/);
});
test('backup: conflicting store IDs never silently merge lifetime aggregates',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);match(a);match(b);
 const aRaw=a.storage.get('kvip-player-profiles:v1');
 const bRaw=b.storage.get('kvip-player-profiles:v1');
 a.context.other=await backup(b);
 const preview=await a.eval('inspectProfileBackupText(other,localStorage.getItem(QUIP_PROFILES_KEY))');
 assert.equal(preview.relationship,'different-store');
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,other)'),/автоматическое объединение запрещено/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),aRaw);
 a.eval("localStorage.setItem('iskra-party:v1',JSON.stringify({version:1,game:null}))");
 const done=await a.eval('restoreProfileBackupText(localStorage,other,{allowReplace:true})');
 assert.equal(done.status,'restored');
 assert.equal(a.storage.get('kvip-player-profiles:v1'),bRaw);
 const safety=JSON.parse(a.storage.get('kvip-player-profiles:import-recovery:v1'));
 assert.equal(safety.raw,aRaw);
 assert.equal((await a.eval('restoreProfileBackupText(localStorage,other,{allowReplace:true})')).status,'unchanged');
});
test('backup: old snapshot from same store is classified older and cannot automatically replace newer stats',async()=>{
 const h=harness();profiles(h);
 const old=await backup(h);
 match(h);
 h.context.old=old;
 const preview=await h.eval('inspectProfileBackupText(old,localStorage.getItem(QUIP_PROFILES_KEY))');
 assert.equal(preview.relationship,'older');
 const before=h.storage.get('kvip-player-profiles:v1');
 await assert.rejects(()=>h.eval('restoreProfileBackupText(localStorage,old)'),/автоматическое объединение запрещено/);
 assert.equal(h.storage.get('kvip-player-profiles:v1'),before);
});
test('backup: unfinished or completed local game prevents importing unrelated profiles',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);
 a.context.archived=await backup(b);
 for(const phase of ['ready','results']){
  a.storage.set('iskra-party:v1',JSON.stringify({version:1,game:{phase}}));
  const before=a.storage.get('kvip-player-profiles:v1');
  await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/есть партия/);
  assert.equal(a.storage.get('kvip-player-profiles:v1'),before);
 }
});
test('backup: optional v74 tiebreak counters survive export and import exactly',async()=>{
 const h=harness();profiles(h);
 h.eval("profileStore.totals[profileStore.profiles[0].id].tiebreaks=4;profileStore.totals[profileStore.profiles[0].id].tiebreakWins=3;writeProfileStore(profileStore)");
 const fresh=harness();fresh.context.archived=await backup(h);
 await fresh.eval('restoreProfileBackupText(localStorage,archived)');
 const restored=JSON.parse(fresh.storage.get('kvip-player-profiles:v1'));
 assert.equal(restored.totals[restored.profiles[0].id].tiebreaks,4);
 assert.equal(restored.totals[restored.profiles[0].id].tiebreakWins,3);
});
test('backup: failed replacement restores prior RAW and retains a verified recovery',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);
 const old=a.storage.get('kvip-player-profiles:v1');a.context.archived=await backup(b);
 const set=a.context.localStorage.setItem,get=a.context.localStorage.getItem;
 let falseRead=false,injectOnce=true;
 a.context.localStorage.setItem=(key,value)=>{
   set(key,value);
   if(key==='kvip-player-profiles:v1'&&injectOnce){falseRead=true;injectOnce=false;}
 };
 a.context.localStorage.getItem=key=>{
   if(key==='kvip-player-profiles:v1'&&falseRead){falseRead=false;return 'not persisted'}
   return get(key);
 };
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/импорт не выполнен/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),old);
 assert.equal(JSON.parse(a.storage.get('kvip-player-profiles:import-recovery:v1')).raw,old);
});
test('backup: a failed initial write rolls back a partially written fresh import',async()=>{
 const source=harness();profiles(source);const target=harness();target.context.archived=await backup(source);
 const key='kvip-player-profiles:v1';let falseRead=false;
 target.context.localStorage.setItem=(k,v)=>{target.storage.set(k,v);if(k===key)falseRead=true};
 target.context.localStorage.getItem=k=>{if(k===key&&falseRead){falseRead=false;return 'wrong'}return target.storage.get(k)??null};
 await assert.rejects(()=>target.eval('restoreProfileBackupText(localStorage,archived)'),/импорт не выполнен/);
 assert.equal(target.storage.has(key),false);
});
test('backup: overwrite never replaces a pre-existing recovery slot',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);
 a.context.archived=await backup(b);
 const original=a.storage.get('kvip-player-profiles:v1');
 a.storage.set('kvip-player-profiles:import-recovery:v1','previous-important-recovery');
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/уже существует/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),original);
 assert.equal(a.storage.get('kvip-player-profiles:import-recovery:v1'),'previous-important-recovery');
});
test('backup: corrupt active archive or main save blocks restoration without writes',async()=>{
 const a=harness(),b=harness();profiles(b);a.context.archived=await backup(b);
 a.storage.set('kvip-player-profiles:v1','{corrupt');
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/действующий архив повреждён/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),'{corrupt');
 a.storage.delete('kvip-player-profiles:v1');a.storage.set('iskra-party:v1','{broken');
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived)'),/основное сохранение повреждено/);
 assert.equal(a.storage.has('kvip-player-profiles:v1'),false);
});
