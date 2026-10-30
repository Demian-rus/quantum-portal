'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const BASE='af9eb4723a97c38394b6b9f0310506abb856ef4e',plain=x=>JSON.parse(JSON.stringify(x));
const old=execFileSync('git',['show',BASE+':party-game/content-packs.js'],{encoding:'utf8',maxBuffer:20e6});
function reference(h){for(const [name,next]of [['getPackCardPool','getPackQuestionPool'],['getPackQuestionPool','checkContentPack']]){const a=old.indexOf('function '+name+'('),b=old.indexOf('function '+next+'(',a);vm.runInContext('var old_'+name+'='+old.slice(a,b).trim()+';',h.context);}return h;}
test('TASK038 all-on preserves every historical general pool, record order and identities against published selectors',()=>{
 const h=reference(createSimulation());
 assert(h.eval(`(()=>{for(const p of Object.values(QUIP_CONTENT_PACKS).filter(p=>p.id==='general'))for(const level of PARTY_CARD_LEVELS){const s={id:p.id,version:p.version};for(const kind of ['words','songs','people','blitz']){const a=getPackCardPool(s,kind,level,PROMPT_TYPES),b=old_getPackCardPool(s,kind,level,PROMPT_TYPES);if(a.length!==b.length||a.some((r,i)=>r!==b[i]))return false;}const a=getPackQuestionPool(s,level),b=old_getPackQuestionPool(s,level);if(a.length!==b.length||a.some((r,i)=>r!==b[i]))return false;}return true})()`));
 assert(h.eval(`(()=>{for(const types of [['word'],['phrase'],['idiom'],['word','phrase'],['phrase','idiom'],['word','idiom'],PROMPT_TYPES])for(const level of PARTY_CARD_LEVELS){const s=latestGeneralPackSelection(),a=getPackCardPool(s,'words',level,types),b=old_getPackCardPool(s,'words',level,types);if(a.length!==b.length||a.some((r,i)=>r!==b[i]))return false;}return true})()`));
});
test('TASK038 any excluded tag removes a record in every pool; untagged IDs remain; counts are unique IDs for the entire pack',()=>{
 const h=createSimulation();
 const matrix=plain(h.eval(`(()=>{const s={id:'general',version:48},counts=generalCategoryCounts(s),rows=[];for(const {id}of counts.categories){const selected=generalCategorySelection(s,{version:1,excluded:[id]});for(const level of PARTY_CARD_LEVELS){for(const kind of ['words','songs','people','blitz']){const original=getPackCardPool(s,kind,level,PROMPT_TYPES),filtered=getPackCardPool(selected,kind,level,PROMPT_TYPES);if(JSON.stringify(filtered.map(c=>c.id))!==JSON.stringify(original.filter(c=>!c.categories.includes(id)).map(c=>c.id)))throw Error(id+'/'+kind+'/'+level);}const original=getPackQuestionPool(s,level),filtered=getPackQuestionPool(selected,level);if(JSON.stringify(filtered.map(c=>c.id))!==JSON.stringify(original.filter(c=>!c.categories.includes(id)).map(c=>c.id)))throw Error(id+'/number/'+level);}const total=generalCategoryCounts(s,{version:1,excluded:[id]});rows.push({id,count:total.available});}return {total:counts.total,categories:counts.categories.length,rows,allOff:generalCategoryCounts(s,{version:1,excluded:counts.categories.map(c=>c.id)}).available}})()`));
 assert.equal(matrix.total,7000);assert.equal(matrix.categories,22);assert.equal(matrix.allOff,2840);assert(matrix.rows.some(r=>r.count<7000));
 assert.equal(h.eval(`generalCategoryCounts({id:'general',version:48}).categories.some(c=>['videogames','memes'].includes(c.id))`),false);
 assert.equal(h.eval(`generalCategoryCounts(latestGeneralPackSelection(),{version:1,excluded:['science','geography']}).available`),h.eval(`new Set([...PARTY_CARDS,...QUIP_APPROX_QUESTIONS].filter(c=>getContentPack(latestGeneralPackSelection()).criteria.cardIds.includes(c.id)&&!c.categories.some(t=>['science','geography'].includes(t))).map(c=>c.id)).size`));
});
test('TASK038 custom mutable catalogs, multi-tag exclusions, empty pools, unique Blitz minimum and Secret methods retain real validation',()=>{
 const h=createSimulation();h.eval(`var fixtures=[{id:'word-fixture-1',type:'word',difficulty:'easy',text:'А',categories:['videogames','culture'],pack:'fixture'},{id:'word-fixture-2',type:'word',difficulty:'easy',text:'Б',categories:['videogames'],pack:'fixture'},{id:'word-fixture-3',type:'word',difficulty:'easy',text:'В',categories:[],pack:'fixture'}];var fixturePack=defineContentPacks([{id:'general',version:999,name:'Тест',enabled:true,categories:[],types:['word','number'],criteria:{cardIds:[],sourcePacks:[]},minCardsPerPool:1}]);var selected={selectionPolicyVersion:1,pack:{id:'general',version:999},excluded:['videogames']};var settings={...options,difficulty:'easy',modes:['blitz'],rulesVersion:5};`);
 assert.deepEqual(plain(h.eval(`getPackCardPool(selected,'blitz','easy',PROMPT_TYPES,fixtures,fixturePack).map(c=>c.id)`)),['word-fixture-3']);
 assert.equal(h.eval(`checkContentPack(selected,settings,fixtures,fixturePack,[]).available`),false);
 h.eval(`fixtures[0].categories=[];fixtures[1].categories=[]`);
 assert.equal(h.eval(`checkContentPack(selected,settings,fixtures,fixturePack,[]).available`),true,'mutable custom source invalidation');
 h.eval(`fixtures[1].text='А'`);assert.equal(h.eval(`checkContentPack(selected,settings,fixtures,fixturePack,[]).available`),false,'two distinct texts do not meet Blitz minimum');
 h.eval(`fixtures.forEach(c=>c.categories=['videogames'])`);
 assert.equal(h.eval(`checkContentPack(selected,{...settings,modes:['talk']},fixtures,fixturePack,[]).available`),false);
 assert.deepEqual(plain(h.eval(`secretMethodsForPack(selected,{...settings,modes:['secret']},fixturePack,'easy',fixtures)`)),[]);
 assert.equal(h.eval(`checkContentPack(selected,{...settings,modes:['secret']},fixtures,fixturePack,[]).available`),false);
 const q=[{id:'approx-fixture',difficulty:'easy',question:'Тест?',answer:1,unit:'шт.',categories:['videogames'],pack:'fixture'}];h.context.fixtureQuestions=q;
 assert.equal(h.eval(`checkContentPack(selected,{...settings,modes:['approx']},fixtures,fixturePack,fixtureQuestions).available`),false);
});
test('TASK038 real duel and team START/roll use the same filtered snapshot in all eight modes and all difficulties',()=>{
 const h=createSimulation(380);h.eval(`QuipTeamsEngine.install();writeGeneralCategoryPreferences(['everyday']);var selectedIds=[];`);
 for(const format of ['duel','teams'])for(const mode of ['talk','mime','draw','sing','yesno','secret','blitz','approx'])for(const difficulty of ['easy','medium','hard']){
  h.context.mode=mode;h.context.level=difficulty;h.context.format=format;
  const row=plain(h.eval(`(()=>{const settings={...options,modes:[mode],difficulty:level,awardTo:mode==='yesno'?'guesser':'setter',complications:true,riskRounds:false,rounds:100,finishType:'rounds',contentPack:latestGeneralPackSelection()};if(format==='duel'){Object.assign(options,settings);newGame();}else{const r=QuipTeamsEngine.createRecord(settings,[['А','Б'],['В','Г']],{id:'task038-match-'+mode+'-'+level,random:()=>.1});game=r.game;taskMemory=r.taskMemory;options=r.options;}roll();const c=game.current;return {modeId:c.modeId,difficulty:c.difficulty,policy:validateGeneralCategorySelection(game.contentPack),ids:c.blitzCardIds||[c.cardId],valid:(c.blitzCardIds||[c.cardId]).every(id=>{const r=[...PARTY_CARDS,...QUIP_APPROX_QUESTIONS].find(r=>r.id===id);return !!r&&!r.categories.includes('everyday')})}})()`));
  assert.equal(row.modeId,mode,format+'/'+mode+'/'+difficulty);assert.equal(row.difficulty,difficulty);assert.deepEqual(row.policy,{version:1,excluded:['everyday']},format+'/'+mode+'/'+difficulty);assert(row.valid);assert(row.ids.length>=1);
 }
});
test('TASK038 future preferences never change a running snapshot, RAW, profiles or RNG; reload restores the pinned policy',()=>{
 const h=createSimulation(381);h.eval(`writeGeneralCategoryPreferences(['everyday']);Object.assign(options,{modes:['talk'],difficulty:'easy',contentPack:latestGeneralPackSelection()});newGame();game.dice=false;roll();game.dice=true;toggleWord();startTimer();pauseTimer();`);
 const before=h.eval('JSON.stringify([game,profileStore,taskMemory])'),raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
 h.eval(`Math.random=()=>{throw Error('category UI RNG')};writeGeneralCategoryPreferences([])`);
 assert.equal(h.eval('JSON.stringify([game,profileStore,taskMemory])'),before);assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
 const restored=createSimulation(381,new Map(h.storage));assert.deepEqual(plain(restored.eval('validateGeneralCategorySelection(game.contentPack)')),{version:1,excluded:['everyday']});assert.equal(restored.eval('game.current.paused'),true);assert.equal(restored.eval('readGeneralCategoryPreferences().policy.excluded.length'),0);assert.equal(restored.storage.get('iskra-party:v1'),raw);
});
test('TASK038 unknown/corrupt future preferences and saved policies fail closed without rewriting any RAW',()=>{
 const h=createSimulation();const key=h.eval('QUIP_GENERAL_CATEGORY_KEY');
 for(const raw of ['{broken','null',JSON.stringify({version:2,excluded:[]}),JSON.stringify({version:1,excluded:['science'],unknown:true})]){
  h.storage.set(key,raw);const before=new Map(h.storage);assert(h.eval('!!readGeneralCategoryPreferences().problem'));
  assert.throws(()=>h.eval('writeGeneralCategoryPreferences([])'));assert.throws(()=>h.eval('setupCategorySelection(latestGeneralPackSelection())'));h.eval('newGame()');assert.deepEqual(h.storage,before);
  assert.equal(h.eval(`setupCategorySelection({id:'geography',version:2}).id`),'geography');
 }
 const source=createSimulation();source.eval('newGame()');const original=JSON.parse(source.storage.get('iskra-party:v1'));
 for(const target of ['options','game']){const value=structuredClone(original);value[target].contentPack={selectionPolicyVersion:999,pack:{id:'general',version:48},excluded:[]};const map=new Map(source.storage),raw=JSON.stringify(value);map.set('iskra-party:v1',raw);const loaded=createSimulation(382,map);assert.equal(loaded.eval('storageBlocked'),true);loaded.eval('persist();newGame()');assert.equal(map.get('iskra-party:v1'),raw);}
});
test('TASK038 only the reviewed policy/setup/resource hunks change; all editorial data and unrelated runtime bytes remain exact',()=>{
 const {normalizeTask038,canonicalizeMetadata,hunks}=require('../../diagnostics/task038/source-contract.cjs');
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'party-game'],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.includes('/tests/')&&!f.includes('/scripts/')&&/\.(js|css|json|html|webmanifest)$/.test(f));
 for(const file of files){const actual=fs.readFileSync(file,'utf8'),expected=execFileSync('git',['show',BASE+':'+file],{encoding:'utf8',maxBuffer:20e6});assert.equal(normalizeTask038(actual),expected,file);}
 for(const h of hunks)assert.equal(canonicalizeMetadata(fs.readFileSync('party-game/'+h.file,'utf8')).split(h.after).length,2,'exact unique reviewed hunk '+h.file);
 const html=fs.readFileSync('party-game/index.html','utf8'),sw=fs.readFileSync('party-game/sw.js','utf8');
 for(const [,ref]of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:css|js)\?v=\d+)"/g))assert(sw.includes("'./"+ref+"'"),ref);
 assert(sw.includes('kvip-pwa-v106-20261030-general-categories-candidate-h'));assert(html.includes('content-packs.js?v=21'));
});
test('TASK038 normalizer cannot hide catalog changes, unknown metadata, RNG, focus, worker lifecycle or validation bypasses',()=>{
 const {normalizeTask038}=require('../../diagnostics/task038/source-contract.cjs');
 for(const name of ['app.js','content-packs.js','setup-wizard.js','setup-wizard.css','sw.js','team-engine.js','session-restoration.js']){
  const source=fs.readFileSync('party-game/'+name,'utf8'),expected=execFileSync('git',['show',BASE+':party-game/'+name],{encoding:'utf8',maxBuffer:20e6});assert.notEqual(normalizeTask038(source+'\n/* unrelated mutation */'),expected,name);
 }
 const source=fs.readFileSync('party-game/content-packs.js','utf8'),expected=execFileSync('git',['show',BASE+':party-game/content-packs.js'],{encoding:'utf8',maxBuffer:20e6});
 for(const mutated of [source.replace('required=Math.max','required=0;Math.max'),source.replace('"Транспорт"','"Непроверенное название"'),source.replace('word-000001','word-CHANGED')]){assert.notEqual(mutated,source);assert.notEqual(normalizeTask038(mutated),expected);}
});
test('TASK038 old published readers reject a filtered snapshot instead of silently dropping its policy; all-on remains readable',()=>{
 const h=createSimulation(),a=old.indexOf('function getContentPack('),b=old.indexOf('// General 1/2',a);
 vm.runInContext('var publishedGetContentPack='+old.slice(a,b).trim()+';',h.context);
 assert.equal(h.eval(`publishedGetContentPack(generalCategorySelection({id:'general',version:48},QUIP_GENERAL_CATEGORIES_ALL)).id`),'general');
 assert.throws(()=>h.eval(`publishedGetContentPack(generalCategorySelection({id:'general',version:48},{version:1,excluded:['science']}))`));
});
test('TASK038 generated future category labels and revisions work without engine changes or editorial branch integration',()=>{
 const api=require('../scripts/content.cjs'),data=api.readDataset();data.manifest=structuredClone(data.manifest);data.manifest.categories.push({id:'future-test',name:'Будущая категория'});
 const extra={id:'word-task038-future',type:'word',difficulty:'easy',text:'ТЕСТОВЫЙ ПРИМЕР',categories:['future-test','videogames'],pack:'task038-fixture'};data.cards=data.cards.concat(extra);
 const pack=structuredClone(data.packs.find(p=>p.id==='general'&&p.version===48));pack.version=999;pack.criteria.cardIds.push(extra.id);data.packs=data.packs.concat(pack);
 const generated=api.render(data),h=createSimulation();h.context.futureCards=data.cards;
 vm.runInContext('var future=(function(){'+generated['content-packs.js']+';return {getPackCardPool,generalCategorySelection,generalCategoryCounts,labels:QUIP_GENERAL_CATEGORY_LABELS,registry:QUIP_CONTENT_PACKS}})();',h.context);
 assert.equal(h.eval("future.labels['future-test']"),'Будущая категория');
 assert.equal(h.eval(`future.generalCategoryCounts({id:'general',version:999},QUIP_GENERAL_CATEGORIES_ALL,futureCards,QUIP_APPROX_QUESTIONS,future.registry).total`),7001);
 assert.equal(h.eval(`future.generalCategoryCounts({id:'general',version:999},{version:1,excluded:['future-test']},futureCards,QUIP_APPROX_QUESTIONS,future.registry).available`),7000);
 assert.equal(h.eval(`future.getPackCardPool(future.generalCategorySelection({id:'general',version:999},{version:1,excluded:['videogames']}),'words','easy',PROMPT_TYPES,futureCards,future.registry).some(c=>c.id==='word-task038-future')`),false);
});
test('TASK038 filtered reports retain the same source-pack metadata and schemas',()=>{
 const h=createSimulation(383);h.eval(`writeGeneralCategoryPreferences(['everyday']);Object.assign(options,{modes:['talk'],contentPack:latestGeneralPackSelection(),difficulty:'easy'});newGame();game.dice=false;roll();`);
 const item=plain(h.eval('makeReportItem(game)'));assert.deepEqual(item.pack,plain(h.eval('latestGeneralPackSelection()')));assert.equal(h.eval('validateReportItem(makeReportItem(game))!==null'),true);
});
test('TASK038 all-on produces the published RNG draw count and actual round sequence',()=>{
 function run(published){const h=reference(createSimulation(384));if(published)h.eval('getPackCardPool=old_getPackCardPool;getPackQuestionPool=old_getPackQuestionPool;');
  return plain(h.eval(`(()=>{let draws=0;const random=Math.random;Math.random=()=>{draws++;return random()};Object.assign(options,{modes:DEFAULT_MODES.filter(id=>id!=='yesno'),difficulty:'mixed',rounds:100,finishType:'rounds',awardTo:'setter',contentPack:latestGeneralPackSelection()});newGame();game.dice=false;const rows=[];for(let i=0;i<24;i++){roll();const c=game.current;rows.push([c.modeId,c.methodId,c.difficulty,c.cardId,c.blitzCardIds,c.complicationId,c.points,c.risk]);if(c.modeId==='approx'){revealApprox();awardApprox('both');}else{game.phase='judge';if(c.modeId==='blitz')c.blitzCorrect=c.blitzRequired;recordAnswer(true,true);}}return {draws,rows,used:game.used,planner:game.plannerState}})()`));}
 assert.deepEqual(run(false),run(true));
});
test('TASK038 report archive remains independent of the catalog/engine and projects only the stable pack identity',()=>{
 const context=vm.createContext({Date});vm.runInContext(fs.readFileSync('party-game/card-reports.js','utf8'),context);
 context.match={contentPack:{selectionPolicyVersion:1,pack:{id:'general',version:48},excluded:['science']},current:{modeId:'talk',methodId:'talk',difficulty:'easy',cardId:'word-fixture',word:'Тест'}};
 assert.deepEqual(plain(vm.runInContext('makeReportItem(match).pack',context)),{id:'general',version:48});
 context.match.contentPack.selectionPolicyVersion=999;assert.throws(()=>vm.runInContext('makeReportItem(match)',context));
});
test('TASK038 deciding questions use the pinned category filter; an empty numeric pool consumes no RNG and retains paired turns',()=>{
 const h=createSimulation(385);h.eval(`QuipTeamsEngine.install();`);
 for(const format of ['duel','teams']){
  h.context.format=format;
  const result=plain(h.eval(`(()=>{writeGeneralCategoryPreferences(['science']);const settings={...options,modes:['talk'],difficulty:'easy',finishType:'score',contentPack:latestGeneralPackSelection()};if(format==='duel'){Object.assign(options,settings);newGame();}else{const r=QuipTeamsEngine.createRecord(settings,[['А','Б'],['В','Г']],{id:'task038-tie-'+format,random:()=>.1});game=r.game;taskMemory=r.taskMemory;options=r.options;}const q=nextTiebreakQuestion(),source=QUIP_APPROX_QUESTIONS.find(row=>row.id===q?.id),valid=!!source&&!source.categories.includes('science');writeGeneralCategoryPreferences([]);const same=validateGeneralCategorySelection(game.contentPack).excluded[0]==='science';writeGeneralCategoryPreferences(generalCategoryCounts(latestGeneralPackSelection()).categories.map(c=>c.id));if(format==='duel')newGame();else{const r=QuipTeamsEngine.createRecord(settings,[['А','Б'],['В','Г']],{id:'task038-empty-tie-'+format,random:()=>.1});game=r.game;taskMemory=r.taskMemory;options=r.options;}const before=JSON.stringify(game);const random=Math.random;Math.random=()=>{throw Error('empty tie consumed RNG')};let empty;try{empty=nextTiebreakQuestion()===null;}finally{Math.random=random;}return {valid,same,empty,unchanged:JSON.stringify(game)===before}})()`));
  assert.deepEqual(result,{valid:true,same:true,empty:true,unchanged:true},format);
 }
});
test('TASK038 transaction validation memo reuses only a complete identical strict JSON record; corrupt bytes and new transactions still validate fully',async()=>{
 const h=createSimulation(386),source=fs.readFileSync('party-game/team-engine.js','utf8'),needle="if(memoKey!==null&&recordValidationScope.keys.has(memoKey))return true;";
 assert.equal(source.split(needle).length,2);
 h.eval('var __fullRecordChecks=0,__fullEntryChecks=0;var measuredTeam=(function(){'+source.replace(needle,needle+'globalThis.__fullRecordChecks++;').replace('if(entryKey!==null&&recordValidationScope.keys.has(entryKey))return true;','if(entryKey!==null&&recordValidationScope.keys.has(entryKey))return true;globalThis.__fullEntryChecks++;')+';return QuipTeamsEngine})();measuredTeam.install();var valid=measuredTeam.createRecord({...options,modes:["talk"],difficulty:"easy",contentPack:latestGeneralPackSelection()},[["А","Б"],["В","Г"]],{id:"task038-validation-memo",random:()=>.1});var cloneRecord=()=>JSON.parse(JSON.stringify(valid));__fullRecordChecks=0;Math.random=()=>{throw Error("validation consumed RNG")};');
 h.eval('measuredTeam.validateRecord(cloneRecord());measuredTeam.validateRecord(cloneRecord())');assert.equal(h.eval('__fullRecordChecks'),2,'outside a controller scope every call is full');
 await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecord(cloneRecord());await Promise.resolve();measuredTeam.validateRecord(cloneRecord())})');assert.equal(h.eval('__fullRecordChecks'),3,'identical cloned JSON can reuse one full successful check');
 const mutations=['r.game.scores[0]++','r.game.startingTeamIndex=1-r.game.startingTeamIndex','r.teamFormat.teams[0].members[0]="Чужой"','r.game.timerPolicyVersion=99','r.game.contentPack={selectionPolicyVersion:999,pack:{id:"general",version:67},excluded:[]}','r.game.extra=undefined','r.extra=NaN','Object.defineProperty(r.game,"duration",{get:()=>valid.game.duration,enumerable:true})','r.game[Symbol("hidden")]=1','Object.defineProperty(r.game,"hidden",{value:1})','r.game.toJSON=()=>valid.game','Object.setPrototypeOf(r.game,{})','r.game.history=Object.assign(Object.create(Array.prototype),{length:0})','r.game.history.length=1','r.options=Object.fromEntries(Object.entries(r.options).reverse())','r.game.scores[0]=Infinity','r.game.self=r.game','r.profileResults=[{version:99}]','r.archives.push(measuredTeam.entry(valid))'];
 for(const mutation of mutations){h.context.mutation=mutation;const baseline=h.eval('(()=>{const r=cloneRecord();eval(mutation);try{measuredTeam.validateRecord(r);return true}catch{return false}})()');h.eval('__fullRecordChecks=0');const outcome=await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecord(cloneRecord());const r=cloneRecord();eval(mutation);try{measuredTeam.validateRecord(r);return true}catch{return false}})');assert.equal(outcome,baseline,mutation+' retains the original full-validator decision');assert.equal(h.eval('__fullRecordChecks'),2,mutation+' always reaches full validation, never a cached JSON alias');}
 h.eval('__fullRecordChecks=0');await h.eval('measuredTeam.withRecordValidation(async()=>{const r=cloneRecord();measuredTeam.validateRecord(r);r.game.scores[0]++;try{measuredTeam.validateRecord(r)}catch{}r.game.scores[0]--;measuredTeam.validateRecord(r)})');assert.equal(h.eval('__fullRecordChecks'),2,'mutating a previously checked object cannot reuse authorization by identity');
 h.eval('__fullRecordChecks=0');await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecordJSON(JSON.stringify(valid));measuredTeam.validateRecordJSON(JSON.stringify(valid));const changed=cloneRecord();changed.game.scores[0]++;try{measuredTeam.validateRecordJSON(JSON.stringify(changed))}catch{}})');assert.equal(h.eval('__fullRecordChecks'),2,'native parsed bytes reuse only a successful equal record, changed scores validate fully');
 await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecordJSON(JSON.stringify(valid));let blocked=false;try{measuredTeam.validateRecordJSON(JSON.stringify(valid).replace(\'"current":null\',\'"current":1e999\'))}catch{blocked=true}if(!blocked)throw Error("overflow aliased null")})');
 const controller=fs.readFileSync('party-game/team-controller.js','utf8'),start=controller.indexOf('validateMatch:')+'validateMatch:'.length,end=controller.indexOf(',validateReplacement:',start);h.eval('var E=measuredTeam;var storedRecordValidator='+controller.slice(start,end));assert.throws(()=>h.eval('(()=>{const r=cloneRecord();r.game.resultEditor=Infinity;storedRecordValidator(r)})()'),/non-JSON number/,'actual storage callback cannot normalize an overflowing raw value to null');
 assert.throws(()=>h.eval('measuredTeam.validateRecordJSON(valid)'),/JSON/,'mutable objects cannot claim parsed provenance');
 h.eval('__fullEntryChecks=0');await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecord(cloneRecord());const next=measuredTeam.createRecord({...options,modes:["talk"],difficulty:"easy",contentPack:latestGeneralPackSelection()},[["А","Б"],["В","Г"]],{id:"task038-next-validation",previous:cloneRecord(),random:()=>.1});measuredTeam.validateRecord(next);measuredTeam.validateReplacement(cloneRecord(),next);})');assert.equal(h.eval('__fullEntryChecks'),2,'old current entry is checked once, then reused byte-exact as an archive; new entry is fully checked');
 h.eval('createPlayerProfile("Третий","green");createPlayerProfile("Четвёртый","violet");var boundProfiles=profileStore.profiles.slice(0,4).map(({id,name,color})=>({id,name,color}));var bound=measuredTeam.createRecord({...options,modes:["talk"],difficulty:"easy",contentPack:latestGeneralPackSelection()},[["А","Б"],["В","Г"]],{id:"task038-bound-validation",random:()=>.1,profileBinding:{version:1,storeId:profileStore.storeId,participants:[boundProfiles.slice(0,2),boundProfiles.slice(2)]}});__fullEntryChecks=0;');
 const ledgerProtected=await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecord(bound);const changed=JSON.parse(JSON.stringify(bound));changed.profileResults=[{version:999}];try{measuredTeam.validateRecord(changed);return false}catch{return true}})');assert.equal(ledgerProtected,true,'a cached valid entry cannot skip independent profile-ledger validation');assert.equal(h.eval('__fullEntryChecks'),1,'ledger corruption is detected even when the unchanged entry is reused');
 h.eval('__fullRecordChecks=0');await assert.rejects(h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecord(cloneRecord());throw Error("intentional transaction failure")})'),/intentional transaction failure/);h.eval('measuredTeam.validateRecord(cloneRecord());measuredTeam.validateRecord(cloneRecord())');assert.equal(h.eval('__fullRecordChecks'),3,'a failed transaction cannot leave a validation cache alive');
 h.eval('__fullRecordChecks=0');await h.eval('measuredTeam.withRecordValidation(async()=>{measuredTeam.validateRecord(cloneRecord());const original=getContentPack;try{getContentPack=function(...args){return original(...args)};measuredTeam.validateRecord(cloneRecord());getContentPack=function(...args){return {...original(...args)}};measuredTeam.validateRecord(cloneRecord());measuredTeam.validateRecord(cloneRecord());}finally{getContentPack=original}})');assert.equal(h.eval('__fullRecordChecks'),4,'changed resolver/custom catalog never reuses an old authorization');
});
