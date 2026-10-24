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

test('backup: preview is bound to exact profile and game RAWs before confirmation',async()=>{
 for(const changedKey of ['kvip-player-profiles:v1','iskra-party:v1']){
  const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
  a.context.expected=a.storage.get('kvip-player-profiles:v1');
  if(changedKey==='kvip-player-profiles:v1')a.eval("createPlayerProfile('Третий','orange')");
  else a.storage.set(changedKey,JSON.stringify({version:1,game:null,soundOn:false}));
  const snapshot=new Map(a.storage);
  await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true,expectedRaw:expected,expectedGameRaw:null})'),/после предпросмотра/);
  assert.deepEqual(a.storage,snapshot,'stale preview cannot even occupy recovery');
 }
});
test('backup: an archive changing during async hashing is rejected without creating recovery',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 const operation=a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})');
 const raw=JSON.parse(a.storage.get('kvip-player-profiles:v1'));raw.nextSequence++;
 a.storage.set('kvip-player-profiles:v1',JSON.stringify(raw));
 await assert.rejects(()=>operation,/данные изменились/);
 assert.equal(a.storage.has('kvip-player-profiles:import-recovery:v1'),false);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),JSON.stringify(raw));
});
test('backup: quota before changing the profile archive is a verified no-op and retry reuses safety',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 const original=a.storage.get('kvip-player-profiles:v1'),set=a.context.localStorage.setItem;
 a.context.localStorage.setItem=(key,val)=>{if(key==='kvip-player-profiles:v1')throw Error('quota');set(key,val)};
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/прежний архив сохранён/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),original);
 const recovery=a.storage.get('kvip-player-profiles:import-recovery:v1');
 assert.equal(a.storage.has('kvip-player-profiles:import-pending:v1'),false);
 a.context.localStorage.setItem=set;
 assert.equal((await a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})')).status,'restored');
 assert.equal(a.storage.get('kvip-player-profiles:import-recovery:v1'),recovery,'retry cannot overwrite original recovery');
});
test('backup: failed safety readback never writes the profile archive',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 const original=a.storage.get('kvip-player-profiles:v1'),get=a.context.localStorage.getItem;
 let fail=false;const set=a.context.localStorage.setItem;
 a.context.localStorage.setItem=(key,val)=>{set(key,val);if(key==='kvip-player-profiles:import-recovery:v1')fail=true};
 a.context.localStorage.getItem=key=>{if(key==='kvip-player-profiles:import-recovery:v1'&&fail){fail=false;return 'unconfirmed'}return get(key)};
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/защитную копию/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),original);
});
test('backup: unverified rollback blocks every profile writer including after application restart',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 const original=a.storage.get('kvip-player-profiles:v1'),set=a.context.localStorage.setItem;
 a.context.localStorage.setItem=(key,val)=>{
  if(key==='kvip-player-profiles:v1'){
   if(val===original)throw Error('rollback denied');
   a.storage.set(key,'corrupt partial write');throw Error('write then failure');
  }
  set(key,val);
 };
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/не удалось подтвердить откат/);
 assert.equal(JSON.parse(a.storage.get('kvip-player-profiles:import-recovery:v1')).raw,original);
 assert.equal(a.storage.has('kvip-player-profiles:import-pending:v1'),true);
 a.context.localStorage.setItem=set;
 assert.throws(()=>a.eval("createPlayerProfile('Опасная запись','pink')"),/заблокирована/);
 assert.throws(()=>a.eval('writeProfileStore(freshProfileStore())'),/заблокирована/);
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/заблокирована/);
 const restarted=harness(a.storage);
 assert.throws(()=>restarted.eval("createPlayerProfile('После перезапуска','pink')"),/заблокирована/);
 assert.equal(restarted.storage.get('kvip-player-profiles:v1'),'corrupt partial write');
});
test('backup: failed commit-marker removal cannot report success or permit subsequent writes',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 a.context.localStorage.removeItem=key=>{if(key==='kvip-player-profiles:import-pending:v1')throw Error('remove failed');a.storage.delete(key)};
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/подтвердить завершение/);
 assert.throws(()=>a.eval('reserveProfileMatch()'),/заблокирована/);
 assert.equal(a.storage.has('kvip-player-profiles:import-pending:v1'),true);
});
test('backup: every active/paused/tiebreak/completed phase and corrupt main save block without mutation',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 for(const game of [{phase:'ready'},{phase:'play',current:{paused:true}},{phase:'tiebreak'},{phase:'results'}]){
  a.storage.set('iskra-party:v1',JSON.stringify({version:1,game}));const snapshot=new Map(a.storage);
  await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/есть партия/);
  assert.deepEqual(a.storage,snapshot);
 }
 for(const raw of ['{broken','[]',JSON.stringify({version:2,game:null}),JSON.stringify({version:1})]){
  a.storage.set('iskra-party:v1',raw);const snapshot=new Map(a.storage);
  await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'));
  assert.deepEqual(a.storage,snapshot);
 }
});
test('backup: old schema, future counters, Secret methods and scores survive with lifetime dedupe',async()=>{
 const a=harness();profiles(a);match(a);
 const doc=JSON.parse(await backup(a));
 for(const total of Object.values(doc.payload.totals)){
  delete total.tiebreaks;delete total.tiebreakWins;
  total.futureCounter={observations:17};
  total.modes.secret={rounds:2,success:1,points:0,methods:{draw:{rounds:2,success:1,points:0}}};
 }
 a.context.legacy=doc.payload;
 const text=await a.eval('createProfileBackupText(legacy)');
 const b=harness();b.context.archived=text;b.context.oldMatch=a.eval('match');
 await b.eval('restoreProfileBackupText(localStorage,archived)');b.eval('restoreProfiles()');
 const before=b.storage.get('kvip-player-profiles:v1');b.eval('commitProfileResult(oldMatch)');
 assert.equal(b.storage.get('kvip-player-profiles:v1'),before,'lifetime watermark prevents replay');
 assert.deepEqual(JSON.parse(before),doc.payload);
});
test('backup: checksum-valid archives still reject broken IDs, watermark, modes and tiebreak counters',async()=>{
 const a=harness();profiles(a);const base=JSON.parse(await backup(a));
 const mutations=[
  p=>p.profiles[0].id='invalid',p=>p.nextSequence=p.settledThrough,
  p=>p.totals[p.profiles[0].id].wins=7,p=>p.totals[p.profiles[0].id].tiebreakWins=2,
  p=>p.totals[p.profiles[0].id].modes.talk={rounds:1,success:2,points:0}
 ];
 for(const mutate of mutations){
  const doc=JSON.parse(JSON.stringify(base));mutate(doc.payload);
  doc.sha256=require('node:crypto').createHash('sha256').update(JSON.stringify(doc.payload)).digest('hex');
  a.context.bad=JSON.stringify(doc);
  await assert.rejects(()=>a.eval('inspectProfileBackupText(bad)'),/повреждены или несовместимы/);
 }
});
test('backup: size limit counts UTF-8 bytes rather than only JavaScript characters',async()=>{
 const a=harness();a.context.bad='я'.repeat(3*1024*1024);
 await assert.rejects(()=>a.eval('inspectProfileBackupText(bad)'),/слишком большой/);
});
test('backup: recovery can be exported and only explicitly cleared with the exact reviewed RAW',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 await a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})');
 const restored=a.storage.get('kvip-player-profiles:v1');
 const safety=a.eval('inspectProfileBackupRecovery(localStorage)');
 a.context.recoveryStore=safety.store;
 const text=await a.eval('createProfileBackupText(recoveryStore)');assert.equal(JSON.parse(text).payload.storeId,safety.store.storeId);
 assert.throws(()=>a.eval("clearProfileBackupRecovery(localStorage,'stale')"),/изменилась/);
 a.context.reviewed=safety.raw;a.eval('clearProfileBackupRecovery(localStorage,reviewed)');
 assert.equal(a.storage.has('kvip-player-profiles:import-recovery:v1'),false);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),restored);
});
test('backup: quota in recovery or marker preparation leaves original profiles and permits a safe retry',async()=>{
 for(const blockedKey of ['kvip-player-profiles:import-recovery:v1','kvip-player-profiles:import-pending:v1']){
  const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
  const original=a.storage.get('kvip-player-profiles:v1'),set=a.context.localStorage.setItem;
  a.context.localStorage.setItem=(k,v)=>{if(k===blockedKey)throw Error('quota');return set(k,v)};
  await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'));
  assert.equal(a.storage.get('kvip-player-profiles:v1'),original);
  assert.equal(a.storage.has('kvip-player-profiles:import-pending:v1'),false);
  a.context.localStorage.setItem=set;
  assert.equal((await a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})')).status,'restored');
 }
});
test('backup: concurrent restores in one process cannot both create transactions',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 const first=a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})');
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/заблокирована/);
 assert.equal((await first).status,'restored');
});
test('backup: marker readback failure blocks writes without touching original profiles',async()=>{
 const a=harness(),b=harness();profiles(a);profiles(b);a.context.archived=await backup(b);
 const original=a.storage.get('kvip-player-profiles:v1'),get=a.context.localStorage.getItem,set=a.context.localStorage.setItem;
 let fail=false;
 a.context.localStorage.setItem=(key,val)=>{set(key,val);if(key==='kvip-player-profiles:import-pending:v1')fail=true};
 a.context.localStorage.getItem=key=>{if(key==='kvip-player-profiles:import-pending:v1'&&fail){fail=false;return 'unconfirmed'}return get(key)};
 await assert.rejects(()=>a.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})'),/подтвердить подготовку/);
 assert.equal(a.storage.get('kvip-player-profiles:v1'),original);
 assert.throws(()=>a.eval('reserveProfileMatch()'),/заблокирована/);
});
