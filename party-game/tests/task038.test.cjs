'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const BASE='126563ccd1c2a9fcbb8e857eb81b422c02a55701',plain=x=>JSON.parse(JSON.stringify(x));
const old=execFileSync('git',['show',BASE+':party-game/content-packs.js'],{encoding:'utf8',maxBuffer:20e6});
function reference(h){for(const [name,next]of [['getPackCardPool','getPackQuestionPool'],['getPackQuestionPool','checkContentPack']]){const a=old.indexOf('function '+name+'('),b=old.indexOf('function '+next+'(',a);vm.runInContext('var old_'+name+'='+old.slice(a,b).trim()+';',h.context);}return h;}
test('TASK038 all-on preserves every historical general pool, record order and identities against published selectors',()=>{
 const h=reference(createSimulation());
 assert(h.eval(`(()=>{for(const p of Object.values(QUIP_CONTENT_PACKS).filter(p=>p.id==='general'))for(const level of PARTY_CARD_LEVELS){const s={id:p.id,version:p.version};for(const kind of ['words','songs','people','blitz']){const a=getPackCardPool(s,kind,level,PROMPT_TYPES),b=old_getPackCardPool(s,kind,level,PROMPT_TYPES);if(a.length!==b.length||a.some((r,i)=>r!==b[i]))return false;}const a=getPackQuestionPool(s,level),b=old_getPackQuestionPool(s,level);if(a.length!==b.length||a.some((r,i)=>r!==b[i]))return false;}return true})()`));
 assert(h.eval(`(()=>{for(const types of [['word'],['phrase'],['idiom'],['word','phrase'],['phrase','idiom'],['word','idiom'],PROMPT_TYPES])for(const level of PARTY_CARD_LEVELS){const s=latestGeneralPackSelection(),a=getPackCardPool(s,'words',level,types),b=old_getPackCardPool(s,'words',level,types);if(a.length!==b.length||a.some((r,i)=>r!==b[i]))return false;}return true})()`));
});
test('TASK038 any excluded tag removes a record in every pool; untagged IDs remain; counts are unique IDs for the entire pack',()=>{
 const h=createSimulation();
 const matrix=plain(h.eval(`(()=>{const s=latestGeneralPackSelection(),counts=generalCategoryCounts(s),rows=[];for(const {id}of counts.categories){const selected=generalCategorySelection(s,{version:1,excluded:[id]});for(const level of PARTY_CARD_LEVELS){for(const kind of ['words','songs','people','blitz']){const original=getPackCardPool(s,kind,level,PROMPT_TYPES),filtered=getPackCardPool(selected,kind,level,PROMPT_TYPES);if(JSON.stringify(filtered.map(c=>c.id))!==JSON.stringify(original.filter(c=>!c.categories.includes(id)).map(c=>c.id)))throw Error(id+'/'+kind+'/'+level);}const original=getPackQuestionPool(s,level),filtered=getPackQuestionPool(selected,level);if(JSON.stringify(filtered.map(c=>c.id))!==JSON.stringify(original.filter(c=>!c.categories.includes(id)).map(c=>c.id)))throw Error(id+'/number/'+level);}const total=generalCategoryCounts(s,{version:1,excluded:[id]});rows.push({id,count:total.available});}return {total:counts.total,categories:counts.categories.length,rows,allOff:generalCategoryCounts(s,{version:1,excluded:counts.categories.map(c=>c.id)}).available}})()`));
 assert.equal(matrix.total,7000);assert.equal(matrix.categories,22);assert.equal(matrix.allOff,2840);assert(matrix.rows.some(r=>r.count<7000));
 assert.equal(h.eval(`generalCategoryCounts(latestGeneralPackSelection()).categories.some(c=>['videogames','memes'].includes(c.id))`),false);
 assert.equal(h.eval(`generalCategoryCounts(latestGeneralPackSelection(),{version:1,excluded:['science','geography']}).available`),h.eval(`new Set([...PARTY_CARDS,...QUIP_APPROX_QUESTIONS].filter(c=>getContentPack(latestGeneralPackSelection()).criteria.cardIds.includes(c.id)&&!c.categories.some(t=>['science','geography'].includes(t))).map(c=>c.id)).size`));
});
test('TASK038 custom mutable catalogs, multi-tag exclusions, empty pools, unique Blitz minimum and Secret methods retain real validation',()=>{
 const h=createSimulation();h.eval(`var fixtures=[{id:'word-fixture-1',type:'word',difficulty:'easy',text:'А',categories:['videogames','culture'],pack:'fixture'},{id:'word-fixture-2',type:'word',difficulty:'easy',text:'Б',categories:['videogames'],pack:'fixture'},{id:'word-fixture-3',type:'word',difficulty:'easy',text:'В',categories:[],pack:'fixture'}];var fixturePack=defineContentPacks([{id:'general',version:999,name:'Тест',enabled:true,categories:[],types:['word','number'],criteria:{cardIds:[],sourcePacks:[]},minCardsPerPool:1}]);var selected={id:'general',version:999,categoryPolicy:{version:1,excluded:['videogames']}};var settings={...options,difficulty:'easy',modes:['blitz'],rulesVersion:5};`);
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
  const row=plain(h.eval(`(()=>{const settings={...options,modes:[mode],difficulty:level,complications:true,riskRounds:false,rounds:100,finishType:'rounds',contentPack:latestGeneralPackSelection()};if(format==='duel'){Object.assign(options,settings);newGame();}else{const r=QuipTeamsEngine.createRecord(settings,[['А','Б'],['В','Г']],{id:'task038-match-'+mode+'-'+level,random:()=>.1});game=r.game;taskMemory=r.taskMemory;options=r.options;}roll();const c=game.current;return {policy:game.contentPack.categoryPolicy,ids:c.blitzCardIds||[c.cardId],valid:(c.blitzCardIds||[c.cardId]).every(id=>{const r=[...PARTY_CARDS,...QUIP_APPROX_QUESTIONS].find(r=>r.id===id);return !!r&&!r.categories.includes('everyday')})}})()`));
  assert.deepEqual(row.policy,{version:1,excluded:['everyday']},format+'/'+mode+'/'+difficulty);assert(row.valid);assert(row.ids.length>=1);
 }
});
test('TASK038 future preferences never change a running snapshot, RAW, profiles or RNG; reload restores the pinned policy',()=>{
 const h=createSimulation(381);h.eval(`writeGeneralCategoryPreferences(['everyday']);Object.assign(options,{modes:['talk'],difficulty:'easy',contentPack:latestGeneralPackSelection()});newGame();game.dice=false;roll();game.dice=true;toggleWord();startTimer();pauseTimer();`);
 const before=h.eval('JSON.stringify([game,profileStore,taskMemory])'),raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
 h.eval(`Math.random=()=>{throw Error('category UI RNG')};writeGeneralCategoryPreferences([])`);
 assert.equal(h.eval('JSON.stringify([game,profileStore,taskMemory])'),before);assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
 const restored=createSimulation(381,new Map(h.storage));assert.deepEqual(plain(restored.eval('game.contentPack.categoryPolicy')),{version:1,excluded:['everyday']});assert.equal(restored.eval('game.current.paused'),true);assert.equal(restored.eval('readGeneralCategoryPreferences().policy.excluded.length'),0);assert.equal(restored.storage.get('iskra-party:v1'),raw);
});
test('TASK038 unknown/corrupt future preferences and saved policies fail closed without rewriting any RAW',()=>{
 const h=createSimulation();const key=h.eval('QUIP_GENERAL_CATEGORY_KEY');
 for(const raw of ['{broken','null',JSON.stringify({version:2,excluded:[]}),JSON.stringify({version:1,excluded:['science'],unknown:true})]){
  h.storage.set(key,raw);const before=new Map(h.storage);assert(h.eval('!!readGeneralCategoryPreferences().problem'));
  assert.throws(()=>h.eval('writeGeneralCategoryPreferences([])'));assert.throws(()=>h.eval('setupCategorySelection(latestGeneralPackSelection())'));h.eval('newGame()');assert.deepEqual(h.storage,before);
  assert.equal(h.eval(`setupCategorySelection({id:'geography',version:2}).id`),'geography');
 }
 const source=createSimulation();source.eval('newGame()');const original=JSON.parse(source.storage.get('iskra-party:v1'));
 for(const target of ['options','game']){const value=structuredClone(original);value[target].contentPack.categoryPolicy={version:999,excluded:[]};const map=new Map(source.storage),raw=JSON.stringify(value);map.set('iskra-party:v1',raw);const loaded=createSimulation(382,map);assert.equal(loaded.eval('storageBlocked'),true);loaded.eval('persist();newGame()');assert.equal(map.get('iskra-party:v1'),raw);}
});
test('TASK038 only the reviewed policy/setup/resource hunks change; all editorial data and unrelated runtime bytes remain exact',()=>{
 const {normalizeTask038,canonicalizeMetadata,hunks}=require('../../diagnostics/task038/source-contract.cjs');
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'party-game'],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.includes('/tests/')&&!f.includes('/scripts/')&&/\.(js|css|json|html|webmanifest)$/.test(f));
 for(const file of files){const actual=fs.readFileSync(file,'utf8'),expected=execFileSync('git',['show',BASE+':'+file],{encoding:'utf8',maxBuffer:20e6});assert.equal(normalizeTask038(actual),expected,file);}
 for(const h of hunks)assert.equal(canonicalizeMetadata(fs.readFileSync('party-game/'+h.file,'utf8')).split(h.after).length,2,'exact unique reviewed hunk '+h.file);
 const html=fs.readFileSync('party-game/index.html','utf8'),sw=fs.readFileSync('party-game/sw.js','utf8');
 for(const [,ref]of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:css|js)\?v=\d+)"/g))assert(sw.includes("'./"+ref+"'"),ref);
 assert(sw.includes('kvip-pwa-v105-20261030-general-categories-candidate'));assert(html.includes('content-packs.js?v=20'));
});
test('TASK038 normalizer cannot hide catalog changes, unknown metadata, RNG, focus, worker lifecycle or validation bypasses',()=>{
 const {normalizeTask038}=require('../../diagnostics/task038/source-contract.cjs');
 for(const name of ['app.js','content-packs.js','setup-wizard.js','setup-wizard.css','sw.js','team-engine.js','session-restoration.js']){
  const source=fs.readFileSync('party-game/'+name,'utf8'),expected=execFileSync('git',['show',BASE+':party-game/'+name],{encoding:'utf8',maxBuffer:20e6});assert.notEqual(normalizeTask038(source+'\n/* unrelated mutation */'),expected,name);
 }
 const source=fs.readFileSync('party-game/content-packs.js','utf8'),expected=execFileSync('git',['show',BASE+':party-game/content-packs.js'],{encoding:'utf8',maxBuffer:20e6});
 for(const mutated of [source.replace('required=Math.max','required=0;Math.max'),source.replace('"Транспорт"','"Непроверенное название"'),source.replace('word-000001','word-CHANGED')]){assert.notEqual(mutated,source);assert.notEqual(normalizeTask038(mutated),expected);}
});
