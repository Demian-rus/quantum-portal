'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const E=require('../../editorial/quip/editor.cjs'),S=require('../../editorial/quip/selector.js'),C=require('../scripts/content.cjs'),{compile}=require('../../editorial/quip/compile.cjs'),{decisions}=require('../../editorial/quip/task043/materialize.cjs'),{createSimulation,seededRandom}=require('../scripts/game-simulation.cjs');
const BASE='0584e0df435782eec8a31d5f5040ac517d300315',c1=E.context(undefined,undefined,{id:'quip',version:1}),c2=E.context(),e1=E.readEdition(c1),e2=E.readEdition(c2),added=decisions(),ids=new Set(added.map(r=>r.id));
const plain=v=>JSON.parse(JSON.stringify(v)),git=file=>cp.execFileSync('git',['show',BASE+':'+file],{maxBuffer:32e6});
test('TASK043 appends 248 exact source-bound decisions and freezes the shipped 7697 without reclassification',()=>{
 assert.equal(E.validate(e2,c2,{release:true}).releaseReady,true);assert.equal(e2.version,2);assert.equal(e2.records.length,7945);assert.equal(c2.general.ids.length,7708);
 assert.equal(c1.spec.status,'published');assert.equal(c2.spec.status,'draft');assert.deepEqual(e2.records.filter(r=>!ids.has(r.id)),e1.records);
 assert.equal(fs.readFileSync('editorial/quip/editions/quip-v1.json','utf8'),git('editorial/quip/editions/quip-v1.json').toString());
 assert.equal(fs.readFileSync('party-game/editorial-edition.js','utf8'),git('party-game/editorial-edition.js').toString());
 for(const p of c1.catalogs){const newer=c2.catalogs.find(n=>n.id===p.id);assert.equal(newer.version,p.version+1);assert.deepEqual(newer.ids.slice(0,p.ids.length),p.ids);assert(newer.ids.slice(p.ids.length).every(id=>ids.has(id)));}
 assert.throws(()=>E.apply(e1,[],{reviewer:'test'},c1),/published edition/);
});
test('TASK043 historical sources, catalog declarations, locks and song/numeric data retain exact bytes',()=>{
 const manifest=JSON.parse(git('party-game/content/manifest.json')),lock=JSON.parse(git('party-game/content/baseline-lock.json'));
 for(const source of [...manifest.cards,...manifest.questions,...manifest.packs])assert.deepEqual(fs.readFileSync('party-game/content/'+source.path),git('party-game/content/'+source.path),source.path);
 for(const [key,value]of Object.entries(lock.sources))assert.deepEqual(c2.data.lock.sources[key],value,key);
 assert.deepEqual(fs.readFileSync('party-game/approx-questions.js'),git('party-game/approx-questions.js'));
 for(const file of ['round-selection.js','round-settlement.js','round-actions.js','round-planner.js','tiebreak.js','team-engine.js','rules.js','prompt-revisions.js'])assert.deepEqual(fs.readFileSync('party-game/'+file),git('party-game/'+file),file);
});
test('TASK043 normalized accepted labels do not collide with any historical source or the corrected proverb',()=>{
 const normalize=s=>s.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,''),prior=new Set(c1.data.sources.filter(s=>s.kind!=='packs'&&s.path!=='cards/task043-quality-v1.json').flatMap(s=>s.rows.map(r=>normalize(r.text||r.question))));prior.add(normalize('НАШЛА КОСА НА КАМЕНЬ'));
 const seen=new Set();for(const r of added){const text=normalize(r.text);assert(!prior.has(text),r.text);assert(!seen.has(text),r.text);seen.add(text);}
 const candidates=require('../../editorial/quip/task043/candidates.json');assert.equal(candidates.length,627);assert.equal(candidates.filter(r=>r.status==='accepted').length,248);assert.equal(candidates.filter(r=>r.code==='exact-duplicate').length,175);assert.equal(candidates.filter(r=>r.code==='inflection-duplicate').length,2);
});
test('TASK043 every rating/category/theme is explicit and the real compiled pools enforce all exclusions',()=>{
 const compiled=compile(e2,c2),index=S.createIndex(compiled,c2.ids.map(id=>c2.sources.get(id).row)),modes=['talk','mime','draw','yesno','blitz'];
 for(const r of added){const cl=e2.records.find(n=>n.id===r.id).classification;assert.deepEqual(cl.categories,r.categories);assert.deepEqual(cl.themes,r.themes);assert.deepEqual(cl.modes.secret,{policy:'actual-method'});
  for(const [i,mode]of modes.entries())assert.equal(cl.modes[mode].difficulty,Number(r.ratings[i])?S.TIERS[Number(r.ratings[i])-1]:null,r.id+'/'+mode);
  assert.equal(cl.modes.sing.eligible,false);assert.equal(cl.modes.approx.eligible,false);
 }
 for(const theme of Object.keys(compiled.catalogs))for(const mode of S.STORED_MODES)for(const tier of S.TIERS){
  const request={theme,mode,method:null,tiers:[tier],promptTypes:['word','phrase','idiom'],excludedCategories:[],languages:['ru','en']};
  for(const row of index.pool(request).filter(r=>ids.has(r.id))){const cl=e2.records.find(n=>n.id===row.id).classification;assert.equal(cl.modes[mode].difficulty,tier);if(theme!=='general')assert(cl.themes.includes(theme));if(mode==='blitz'){assert.equal(cl.form,'word');assert(!/\s/.test(row.text));}}
  assert.deepEqual(index.pool({...request,excludedCategories:compiled.categories}),[]);
 }
 const ricotta=added.find(r=>r.text==='РИКОТТА');assert(ricotta);assert.equal(ricotta.ratings[1],'0');assert.equal(ricotta.ratings[2],'0');
});
let historicalRoot;
function baselineRoot(){if(historicalRoot)return historicalRoot;historicalRoot=fs.mkdtempSync(path.join(os.tmpdir(),'quip043-baseline-'));const html=git('party-game/index.html').toString();fs.writeFileSync(path.join(historicalRoot,'index.html'),html);for(const m of html.matchAll(/<script src="\.\/([^?"/]+\.js)/g))fs.writeFileSync(path.join(historicalRoot,m[1]),git('party-game/'+m[1]));return historicalRoot;}
after(()=>{if(historicalRoot)fs.rmSync(historicalRoot,{recursive:true,force:true});});
for(const teams of [false,true])test('TASK043 '+(teams?'2x2':'1x1')+' main→candidate restores exact v1 snapshot, RAW and seeded selections; new parties pin v2',()=>{
 const old=createSimulation(43,new Map(),baselineRoot());old.eval("options.modes=['blitz','talk','draw','secret'];options.complications=false;options.riskRounds=false;options.difficulty='medium';");
 if(teams)old.eval("QuipTeamsEngine.install();var rec043=QuipTeamsEngine.createRecord({...options,awardTo:'setter'},[['А','Б'],['В','Г']],{id:'task043-history-match-0001'});game=rec043.game;taskMemory=rec043.taskMemory;options=rec043.options");else old.eval('newGame()');
 old.eval('game.current=rollOutcome();game.phase="task";');if(!teams)old.eval('persist()');
 const save=old.eval('JSON.stringify(game)'),memory=old.eval('JSON.stringify(taskMemory)'),settings=old.eval('JSON.stringify(options)'),storage=new Map(old.storage),current=createSimulation(43,storage);
 assert.deepEqual([...current.storage],[...old.storage]);if(teams)current.eval('QuipTeamsEngine.install()');
 for(const h of [old,current]){h.context.save043=save;h.context.memory043=memory;h.context.options043=settings;h.context.rng043=seededRandom(43043);h.eval('game=JSON.parse(save043);taskMemory=JSON.parse(memory043);options=JSON.parse(options043);Math.random=rng043;game.current=null;game.phase="ready";');}
 assert.equal(current.eval('game.contentPack.edition.version'),1);assert.equal(current.eval('JSON.stringify(editorialPool(game,"blitz","medium").map(r=>r.id))'),old.eval('JSON.stringify(editorialPool(game,"blitz","medium").map(r=>r.id))'));
 for(let i=0;i<10;i++)assert.equal(current.eval('JSON.stringify(rollOutcome())'),old.eval('JSON.stringify(rollOutcome())'));
 current.eval("options.contentPack=latestGeneralPackSelection();options.modes=['talk'];newGame()");assert.equal(current.eval('game.contentPack.edition.version'),2);assert.equal(current.eval('game.contentPack.pack.version'),69);
 assert(current.eval("editorialPool(game,'talk','medium').some(r=>/-910[0-9]{3}$/.test(r.id))"));
 current.eval('game.contentPack.edition.digest="0".repeat(64)');assert.throws(()=>current.eval('validateEditorialGame(game)'));
});
test('TASK043 exact additive source guard rejects unrelated changes and altered approved hunks',()=>{
 const {hunks,normalizeTask043}=require('../../diagnostics/task043/source-contract.cjs');
 for(const h of hunks){const now=fs.readFileSync('party-game/'+h.file,'utf8'),before=git('party-game/'+h.file).toString();assert.equal(normalizeTask043(now),before);assert.notEqual(normalizeTask043(now+'/* forbidden */'),before);assert.notEqual(normalizeTask043(now.replace(h.after,h.after+'/* changed */')),before);}
});
