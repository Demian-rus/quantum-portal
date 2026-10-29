'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const F=require('../team-format.js'),S=require('../team-storage.js'),T=require('../team-statistics.js'),{ruTurns,ruPoints,ruAfterTurns}=require('../setup-view.js');
const plain=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>assert.deepEqual(plain(a),plain(b));
test('TASK032 exact delta preserves every inherited script, all game CSS, dictionaries and PWA lifecycle outside the reviewed additions',()=>{
 const {execFileSync}=require('node:child_process'),{normalizeTask032,normalizeTask033}=require('./task032-contract.cjs'),hunks=require('./task032-presentation.json');
 const before=f=>execFileSync('git',['show','7852bfe05cfa193b8084860a7c4faa0f01ae5786:party-game/'+f],{encoding:'utf8',maxBuffer:15e6}),read=f=>fs.readFileSync('party-game/'+f,'utf8');
 const scripts=[...before('index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(scripts.length,53);
 // G46 generated catalogs are versioned and editor-reviewed, not part of TASK032's
 // immutable game-engine surface. Validate exact reproducibility instead.
 const generatedFiles=new Set(['cards.js','content-packs.js']);
 for(const f of [...scripts.filter(name=>!generatedFiles.has(name)),'style.css','setup-wizard.css','team-game.css','index.html','sw.js'])
  assert.equal(normalizeTask032(read(f)),before(f),f);
 const api=require('../scripts/content.cjs'),dataset=api.readDataset(),rendered=api.render(dataset);
 for(const f of generatedFiles)assert.equal(read(f),rendered[f],f+' must match deterministic generated source');
 const g45=dataset.packs.find(p=>p.id==='general'&&p.version===47),g46=dataset.packs.find(p=>p.id==='general'&&p.version===48);
 assert.ok(g45&&g46,'Both the G45 and G46 revisions must remain available');
 assert.equal(g45.criteria.cardIds.length,7000);
 assert.equal(g46.criteria.cardIds.length,7000);
 assert.equal(g46.criteria.cardIds.filter(id=>id.startsWith('song-')).length,224,'Preserve all 224 song prompts');
 assert.match(read('sw.js'),/G46 2026-10-28: refresh the installed PWA catalog/);
 for(const h of hunks){assert(h.after);assert(normalizeTask033(read(h.file)).includes(h.after),'exact addition must still exist: '+h.file);}
 const current=[...read('index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);same(current.slice().sort(),[...scripts,'team-statistics.js'].sort());
 assert.equal(read('sw.js').slice(read('sw.js').indexOf("self.addEventListener('install'")),before('sw.js').slice(before('sw.js').indexOf("self.addEventListener('install'")));
 assert.doesNotMatch(read('team-statistics.js'),/localStorage|indexedDB|Math\.random/);
 assert(!normalizeTask032(read('team-engine.js').replace("const VERSION=1,FORMAT='teams-2x2'","const VERSION=999,FORMAT='teams-2x2'")).includes("const VERSION=1,FORMAT='teams-2x2'"),'normalization cannot erase unrelated engine changes');
});
function game(settings={},bits=[0,0,0]){
 const h=createSimulation(320);h.context.TextEncoder=TextEncoder;h.context.errorMessages=[];h.eval('toast=message=>errorMessages.push(message)');
 h.eval("createPlayerProfile('Третий','violet');createPlayerProfile('Четвёртый','green');QuipTeamsEngine.install();");
 h.context.settings=settings;h.context.bits=bits;
 h.eval(`var openingCalls=0;var binding={version:1,storeId:profileStore.storeId,participants:[profileStore.profiles.slice(0,2),profileStore.profiles.slice(2)].map(team=>team.map(({id,name,color})=>({id,name,color})))};
 var teamRecord=QuipTeamsEngine.createRecord({...options,finishType:'rounds',rounds:4,modes:['talk'],difficulty:'easy',complications:false,riskRounds:false,dice:false,...settings},null,{id:'task032-profile-match-0001',profileBinding:binding,random:()=>bits[openingCalls++]?0.75:0.25});
 game=teamRecord.game;game.dice=false;options=teamRecord.options;taskMemory=teamRecord.taskMemory;
 persist=()=>true;commitReviewState=(next,memory=taskMemory)=>{QuipTeamsEngine.validateRecord(QuipTeamsEngine.finalizeRecord({...teamRecord,game:next,taskMemory:memory}));game=next;taskMemory=memory;return true;};`);
 assert.equal(h.eval('openingCalls'),3);h.before=new Map(h.storage);h.profiles=plain(h.eval('profileStore'));return h;
}
function turn(h,success=true,shared='both'){
 h.context.success=success;h.context.shared=shared;
 h.eval(`roll();if(game.current.modeId==='approx'){revealApprox();awardApprox(shared)}else{game.phase='judge';recordAnswer(success)};QuipTeamsEngine.validateGame(game,taskMemory)`);
}
function finish(h,results=[true,false,true,false]){results.forEach(value=>turn(h,value));h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');return plain(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory})'));}
function validate(h,r){h.context.candidate=plain(r);return h.eval('QuipTeamsEngine.validateRecord(candidate)');}
function storage(h){
 const map=new Map(),adapter={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 let tail=Promise.resolve(),receiptRaw=null;const exclusive=fn=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;};
 const receipt={read:async()=>receiptRaw,write:async(expected,next)=>{assert.equal(receiptRaw,expected);receiptRaw=next;return next;}};
 const store=S.create({storage:adapter,exclusive,receipt,digest:async raw=>crypto.createHash('sha256').update(raw).digest('hex'),validateMatch:r=>validate(h,r),validateReplacement:(a,b)=>{h.context.before=plain(a);h.context.after=plain(b);return h.eval('QuipTeamsEngine.validateReplacement(before,after)');},validateTransition:(a,b)=>{h.context.before=plain(a);h.context.after=plain(b);return h.eval('QuipTeamsEngine.validateTransition(before,after)');}});
 return {map,adapter,receipt,store,get receiptRaw(){return receiptRaw;}};
}
test('TASK032 Russian forms cover unit, teen, compound and genitive contexts',()=>{
 const cases=[[0,'ходов','очков'],[1,'ход','очко'],[2,'хода','очка'],[4,'хода','очка'],[5,'ходов','очков'],[10,'ходов','очков'],[11,'ходов','очков'],[12,'ходов','очков'],[14,'ходов','очков'],[20,'ходов','очков'],[21,'ход','очко'],[22,'хода','очка'],[24,'хода','очка'],[25,'ходов','очков'],[31,'ход','очко'],[41,'ход','очко'],[74,'хода','очка'],[100,'ходов','очков'],[101,'ход','очко'],[111,'ходов','очков']];
 for(const [n,turns,points]of cases){assert.equal(ruTurns(n),n+' '+turns);assert.equal(ruPoints(n),n+' '+points);}
 for(const n of [1,21,31,41,101])assert.equal(ruAfterTurns(n),'После '+n+' хода');
 for(const n of [0,2,4,11,14,22,24,74,100,111])assert.equal(ruAfterTurns(n),'После '+n+' ходов');
 assert.equal(ruPoints(-1),'-1 очко');
});
test('TASK032 v2 uses four immutable IDs, permits equal names without identifying people by name, and retains all three RNG draws',()=>{
 const h=game();const binding=plain(h.eval('binding'));binding.participants.flat().forEach(p=>p.name='Одинаковое имя');let calls=0;
 const header=F.createBound(binding,{id:'equal-names-profile-match',random:()=>{calls++;return .75;}});assert.equal(calls,3);assert.equal(header.version,2);assert.equal(header.statsPolicy,'separate-team-profiles-v1');assert.equal(new Set(header.profileBinding.participants.flat().map(p=>p.id)).size,4);
 for(let i=0;i<12;i++)assert.deepEqual(F.turnIdentity(header,i),F.turnIdentity(F.create([['A','B'],['C','D']],{id:header.id,random:()=>.75}),i));
 const bad=plain(binding);bad.participants[1][1].id=bad.participants[0][0].id;assert.throws(()=>F.createBound(bad,{id:header.id,random:()=>{throw Error('No RNG');}}),/TEAM_STATISTICS/);
 assert(Object.isFrozen(header.profileBinding.participants[0][0]));
});
test('TASK032 legacy v1 remains strict and receives no inferred profiles or statistics',()=>{
 const header=F.create([['A','B'],['C','D']],{id:'legacy-profile-match-001',random:()=>0});assert.equal(header.version,1);assert.equal(header.statsPolicy,'excluded-from-duel-profiles');
 assert.throws(()=>F.validate({...header,profileBinding:{}}));assert.throws(()=>F.validate({...header,version:2}));
 const h=game();const legacy=plain(h.eval("QuipTeamsEngine.createRecord(options,[['A','B'],['C','D']],{id:'legacy-profile-match-002',random:()=>0})"));assert.equal(legacy.version,1);assert(!Object.hasOwn(legacy,'profileResults'));assert.equal(validate(h,legacy),true);
 assert.throws(()=>validate(h,{...legacy,profileResults:[]}));
});
test('TASK032 all 24 permutations attribute results to permanent IDs and never to names or the duel pair',()=>{
 const h=game(),profiles=h.profiles.profiles,results=[];
 const permutations=list=>list.length?list.flatMap((p,i)=>permutations(list.filter((_,j)=>i!==j)).map(t=>[p,...t])):[[]];
 for(const [i,order]of permutations([0,1,2,3]).entries()){
  h.context.reordered={version:1,storeId:h.profiles.storeId,participants:[order.slice(0,2),order.slice(2)].map(team=>team.map(i=>{const {id,name,color}=profiles[i];return {id,name,color};}))};h.context.newId='permutation-profile-match-'+i;
  h.eval('teamRecord=QuipTeamsEngine.createRecord(options,null,{id:newId,profileBinding:reordered,random:()=>0});game=teamRecord.game;game.dice=false;taskMemory=teamRecord.taskMemory;options=teamRecord.options');
  const record=finish(h);assert.equal(validate(h,record),true);results.push(record.profileResults[0]);
  for(const [position,index]of order.entries()){const t=T.forProfile(record.profileResults,h.profiles.storeId,profiles[index].id);assert.equal(t.wins,position<2?1:0);assert.equal(t.losses,position<2?0:1);}
 }
 for(const p of profiles){const t=T.forProfile(results,h.profiles.storeId,p.id);assert.equal(t.matches,24);assert.equal(t.wins,12);assert.equal(t.losses,12);assert.equal(t.setter,24);assert.equal(t.guesser,24);}
 assert.deepEqual(h.storage,h.before);
});
test('TASK032 new party and unfinished exits do not count, final win/loss applies once to all four and never changes duel totals',()=>{
 const h=game(),start=plain(h.eval('teamRecord'));assert.equal(start.version,2);same(start.profileResults,[]);
 turn(h);same(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory}).profileResults'),[]);[false,true,false].forEach(v=>turn(h,v));
 assert.equal(h.eval('game.phase'),'review');same(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory}).profileResults'),[]);
 h.eval('confirmReviewedResults()');const record=plain(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory})'));assert.equal(validate(h,record),true);assert.equal(record.profileResults.length,1);
 for(const [i,p]of h.profiles.profiles.entries()){
  const t=T.forProfile(record.profileResults,h.profiles.storeId,p.id);assert.equal(t.matches,1);assert.equal(t.wins,i<2?1:0);assert.equal(t.losses,i<2?0:1);assert.equal(t.setter,1);assert.equal(t.guesser,1);assert(!Object.hasOwn(t,'points'));
 }
 assert.deepEqual(h.storage,h.before);same(h.eval('profileStore.totals'),h.profiles.totals);
 same(T.merge(record.profileResults,record.profileResults),record.profileResults);same(T.merge(JSON.parse(JSON.stringify(record.profileResults)),record.profileResults),record.profileResults);
});
test('TASK032 corrected history is projected only after final confirmation; all-profile draw and shared Approx participation have real semantics',()=>{
 const h=game();[true,false,true,false].forEach(v=>turn(h,v));h.eval("var next=reviewCopy(game);next.history[0]=changeReviewedOutcome(next.history[0],'failed');var replayed=replayResultHistory(next);next.history=replayed.history;next.scores=replayed.scores;next.reviewRevision++;commitReviewState(next)");
 same(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory}).profileResults'),[]);h.eval('confirmReviewedResults()');const corrected=plain(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory})'));assert.equal(corrected.profileResults[0].scores[0],1);
 const approximate=game({modes:['approx']});for(let i=0;i<4;i++)turn(approximate,true,'both');approximate.eval('confirmReviewedResults()');assert.equal(approximate.eval('game.phase'),'results',JSON.stringify(plain(approximate.eval('errorMessages'))));const r=plain(approximate.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory})'));
 for(const p of approximate.profiles.profiles){const t=T.forProfile(r.profileResults,approximate.profiles.storeId,p.id);assert.equal(t.draws,1);assert.equal(t.setter,0);assert.equal(t.guesser,0);assert.equal(t.shared,4);assert.equal(t.modes.approx.shared,4);assert.equal(t.modes.approx.setterSuccess,0);}
});
test('TASK032 finalized ledger is append-only across archive cleanup, new parties and stale identity changes',()=>{
 const h=game(),first=finish(h);h.context.first=first;
 const next=plain(h.eval("QuipTeamsEngine.createRecord(options,null,{id:'task032-profile-match-0002',profileBinding:binding,previous:first,random:()=>0})"));assert.equal(next.archives.length,1);same(next.profileResults,first.profileResults);h.context.after=next;assert.equal(h.eval('QuipTeamsEngine.validateReplacement(first,after)'),true);
 const cleaned={...next,archives:[]};h.context.before=next;h.context.after=cleaned;assert.equal(h.eval('QuipTeamsEngine.validateTransition(before,after)'),true);
 for(const mutate of [r=>r.profileResults=[],r=>r.profileResults[0].scores[0]++,r=>r.teamFormat.profileBinding.participants[0][0].id='a'.repeat(32),r=>r.game.phase='review']){
  const bad=plain(first);mutate(bad);h.context.before=first;h.context.after=bad;assert.throws(()=>{if(!h.eval('QuipTeamsEngine.validateTransition(before,after)'))throw Error('Rejected');});
 }
});
test('TASK032 score-goal tiebreak is jointly participated and counted once only after the final confirmation',()=>{
 const h=game({finishType:'score',targetScore:15,rounds:100});for(let i=0;i<30;i++)turn(h,true);
 h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'tiebreak');same(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory}).profileResults'),[]);
 h.eval("revealTiebreak();settleTiebreak('a')");assert.equal(h.eval('game.phase'),'review');same(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory}).profileResults'),[]);
 h.eval('confirmReviewedResults()');assert.equal(h.eval('game.phase'),'results');const r=plain(h.eval('QuipTeamsEngine.finalizeRecord({...teamRecord,game,taskMemory})'));assert.equal(r.profileResults.length,1);same(r.profileResults[0].scores,[16,15]);
 for(const [i,p]of h.profiles.profiles.entries()){const t=T.forProfile(r.profileResults,h.profiles.storeId,p.id);assert.equal(t.tiebreaks,1);assert.equal(t.wins,i<2?1:0);assert.equal(t.matches,1);assert(!Object.hasOwn(t,'points'));}
});
test('TASK032 one native team transaction contains both final game and all four contributions; interrupted writes recover both together',async()=>{
 for(const fault of ['primary','cleanup','receipt-final'])for(const choice of ['keep-before','keep-after']){
  const h=game(),before=plain(h.eval('teamRecord')),after=finish(h),x=storage(h),saved=await x.store.commit({expectedRaw:null,match:before});
  const set=x.adapter.setItem,remove=x.adapter.removeItem,write=x.receipt.write;let receipts=0;
  x.adapter.setItem=(k,v)=>{if(fault==='primary'&&k===S.KEY)throw Error('quota');return set(k,v);};x.adapter.removeItem=k=>{if(fault==='cleanup'&&k===S.JOURNAL_KEY)throw Error('remove');return remove(k);};x.receipt.write=async(a,b)=>{if(fault==='receipt-final'&&++receipts===2)throw Error('IDB interrupted');return write(a,b);};
  await assert.rejects(x.store.commit({expectedRaw:saved.raw,match:after}));assert.equal((await x.store.load()).status,'blocked');const pending=await x.store.pending();assert.equal(pending.status,'pending');
  x.adapter.setItem=set;x.adapter.removeItem=remove;x.receipt.write=write;const recovered=await x.store.recover({expectedJournal:pending.journal,choice});
  assert.equal(recovered.match.game.phase,choice==='keep-before'?'ready':'results');assert.equal(recovered.match.profileResults.length,choice==='keep-before'?0:1);
  const verified=await x.store.load();same(verified.match,recovered.match);assert.equal(JSON.parse(x.receiptRaw).committedRaw,verified.raw);
 }
});
test('TASK032 concurrent final confirmations have one CAS winner and a repeated confirmed result cannot count twice',async()=>{
 const h=game(),before=plain(h.eval('teamRecord')),after=finish(h),x=storage(h),saved=await x.store.commit({expectedRaw:null,match:before});
 const out=await Promise.allSettled([x.store.commit({expectedRaw:saved.raw,match:after}),x.store.commit({expectedRaw:saved.raw,match:after})]);assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal(out.find(r=>r.status==='rejected').reason.code,'CONFLICT');
 const current=await x.store.load(),again=await x.store.commit({expectedRaw:current.raw,match:after});assert.equal(again.match.profileResults.length,1);assert.equal(T.forProfile(again.match.profileResults,h.profiles.storeId,h.profiles.profiles[0].id).matches,1);
});
function backupHarness(){
 const map=new Map(),context=vm.createContext({crypto:crypto.webcrypto,TextEncoder,Date,console,localStorage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}});
 for(const f of ['team-statistics.js','player-profiles.js','profile-backup.js'])vm.runInContext(fs.readFileSync('party-game/'+f,'utf8'),context);return {map,context,eval:s=>vm.runInContext(s,context)};
}
test('TASK032 one versioned profile backup preserves IDs, duel values and team results, including deduplication against the live ledger',async()=>{
 const h=game(),record=finish(h);h.context.QuipTeams={results:()=>record.profileResults};const text=await h.eval('createProfileBackupText(profileStore,1793160000000)');const doc=JSON.parse(text);assert.equal(doc.version,2);assert.equal(doc.payload.version,2);same(doc.payload.totals,h.profiles.totals);assert.equal(doc.payload.teamStatistics.results.length,1);
 const target=backupHarness();target.context.text=text;await target.eval('restoreProfileBackupText(localStorage,text)');target.eval('restoreProfiles()');same(target.eval('profileStore.totals'),h.profiles.totals);same(target.eval('profileStore.profiles'),h.profiles.profiles);assert.equal(target.eval('profileTeamResults().length'),1);
 target.context.QuipTeams={results:()=>record.profileResults,validateProfileImport:store=>T.merge(record.profileResults,store.teamStatistics?.results||[])};const second=JSON.parse(await target.eval('createProfileBackupText(profileStore)'));assert.equal(second.payload.teamStatistics.results.length,1);assert.equal(target.eval('profileTeamResults().length'),1);
 const original=target.map.get('kvip-player-profiles:v1'),wrong=plain(doc);wrong.payload.teamStatistics.results[0].profileIds[0]='f'.repeat(32);target.context.wrong=JSON.stringify(wrong);await assert.rejects(target.eval('restoreProfileBackupText(localStorage,wrong,{allowReplace:true})'));assert.equal(target.map.get('kvip-player-profiles:v1'),original);
});
test('TASK033 profile-picker touch closes without a container rectangle and preserves keyboard focus',()=>{
 const read=f=>fs.readFileSync('party-game/'+f,'utf8');
 const css=read('setup-wizard.css'),globalCss=read('style.css'),profiles=read('profile-views.js');
 assert.match(globalCss,/\.team-input-wrap:focus-within,[\s\S]*?box-shadow:0 0 0 1px #6cddff75/);
 assert.match(css,/\.wizard-page \.team-input-wrap:focus-within\{box-shadow:none\}/);
 assert.match(globalCss,/button:focus-visible,input:focus-visible/);
 assert.match(profiles,/profilePanelFocus\?\.focus\(\{preventScroll:true\}\)/);
 const html=read('index.html'),sw=read('sw.js');
 assert.match(html,/setup-wizard\.css\?v=7/);
 assert.match(sw,/setup-wizard\.css\?v=7/);
 assert.match(sw,/kvip-pwa-v102-20261029-wizard-stepper-candidate/);
});
