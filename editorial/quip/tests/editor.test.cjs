'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../editor.cjs'),C=E.context(),initial=E.createDraft(C),clone=v=>JSON.parse(JSON.stringify(v));
const at='2026-11-01T12:00:00.000Z';
test('the checked-in working edition has complete, source-bound coverage',()=>assert.equal(E.validate(E.readEdition(C),C).ok,true));
function classification(form,categories,eligible,themes=[]){
 return {form,categories,themes,ambiguities:[],modes:Object.fromEntries(E.MODES.map(mode=>[mode,mode==='secret'?{policy:'actual-method'}:{eligible:!!eligible[mode],difficulty:eligible[mode]||null,reason:eligible[mode]?'concrete':'type'}]))};
}
function decision(id,cl,rationale){return {id,fingerprint:C.sources.get(id).fingerprint,classification:cl,rationale};}
const cat=decision('word-000229',classification('word',['animals'],{talk:'easy',mime:'easy',draw:'easy',blitz:'easy'},['animals']),'Домашнее животное: узнаваемый силуэт, повадки и короткая словесная подсказка.');
const microscope=decision('word-000964',classification('word',['science','technology'],{talk:'easy',mime:'medium',draw:'medium',blitz:'medium'},['science']),'Знакомый прибор; жесты требуют показать работу с окуляром, рисунок — узнаваемую конструкцию.');
const quantum=decision('phrase-000334',classification('phrase',['science'],{talk:'hard'},['science']),'Специальное физическое понятие без общепонятного физического или визуального показа; Блиц исключён как фраза.');
const potter=decision('person-000006',classification('person',['literature','cinema'],{yesno:'easy'}),'Узнаваемый литературный и киноперсонаж с отличимыми признаками для вопросов да/нет.');
function apply(decisions=[cat,microscope,quantum,potter]){return E.apply(initial,clone(decisions),{reviewer:'editorial-test',at},C);}

test('exact published general68 coverage, plus existing theme-only IDs; migration is not review',()=>{
 const result=E.validate(initial,C);assert.equal(result.general,7460);assert.equal(result.records,7697);assert.equal(result.themeOnly,237);
 assert.equal(result.states.pending,7697);assert.equal(result.releaseReady,false);assert.throws(()=>E.validate(initial,C,{release:true}),/await semantic review/);
 assert.equal(new Set(initial.records.map(r=>r.id)).size,7697);
});
test('individual decisions can have independent method tiers and type-safe exclusions',()=>{
 const next=apply();assert.equal(E.validate(next,C).states.reviewed,4);const r=next.records.find(r=>r.id===microscope.id);
 assert.equal(r.classification.modes.talk.difficulty,'easy');assert.equal(r.classification.modes.draw.difficulty,'medium');
 assert.equal(next.records.find(r=>r.id===quantum.id).classification.modes.draw.eligible,false);
 assert.equal(next.records.find(r=>r.id===potter.id).classification.modes.yesno.difficulty,'easy');
 assert.equal(initial.records.find(r=>r.id===cat.id).classification,null);
});
test('a decision result does not alias mutable caller data',()=>{
 const decisions=clone([cat]),next=E.apply(initial,decisions,{reviewer:'test',at},C);decisions[0].classification.categories.push('food');
 assert.deepEqual(next.records.find(r=>r.id===cat.id).classification.categories,['animals']);
});
test('unknown IDs, duplicate IDs, incomplete coverage and stale source fingerprints are blocked',()=>{
 for(const mutate of [e=>e.records.pop(),e=>{e.records[0].id='future-0001'},e=>{e.records[0].id=e.records[1].id},e=>{e.records[0].source.fingerprint='0'.repeat(64)}]){
  const next=clone(initial);mutate(next);assert.throws(()=>E.validate(next,C));
 }
});
test('a bad member makes the whole review batch fail without changing the original',()=>{
 const before=E.hash(initial),bad=clone(microscope);bad.fingerprint='0'.repeat(64);
 assert.throws(()=>apply([cat,bad]),/Stale decision/);assert.equal(E.hash(initial),before);
 assert.throws(()=>apply([cat,cat]),/duplicate decision/);
});
test('unknown schemas, rubrics, properties and migration hint edits fail closed',()=>{
 for(const mutate of [e=>{e.schemaVersion=2},e=>{e.rubric='quip-rubric@999'},e=>{e.version=2},e=>{e.future=true},e=>{e.records[0].proposal.categories=['food']}]){
  const next=clone(initial);mutate(next);assert.throws(()=>E.validate(next,C));
 }
});
test('all reviewed is distinct from ready to release when real mode pools are missing',()=>{
 const id=cat.id,general={...C.general,ids:[id],idsDigest:E.hash([id])},c={...C,ids:[id],idSet:new Set([id]),general,catalogs:[general],themes:new Set()};
 const only=clone(cat);only.classification.themes=[];
 const e=E.apply(E.createDraft(c),[only],{reviewer:'isolated-test',at},c),result=E.validate(e,c);
 assert.equal(result.reviewComplete,true);assert.equal(result.releaseReady,false);assert.ok(result.releaseProblems.includes('no playable sing pool'));
 assert.throws(()=>E.validate(e,c,{release:true}),/Release blocked/);
});
test('version registrations are unique and every published edition needs a checksum',()=>{
 for(const mutate of [m=>{m.schemaVersion=2},m=>m.editions.push(clone(m.editions[0])),m=>{m.editions[0].path='../escape.json'},m=>{m.editions[0].status='published'},m=>{m.published['quip@999']='0'.repeat(64)},m=>{m.editions[0].catalogs[0].version=0}]){
  const m=clone(C.m);mutate(m);assert.throws(()=>E.validateManifest(m));
 }
});
test('historical source edits are detected before generating a new draft',()=>{
 const data=clone(C.data),source=data.sources.find(s=>s.immutable);source.rows[0].text+='changed';
 assert.throws(()=>E.context(data,C.m),/Historical source changed/);
});
test('historical pool policies and category overrides cannot change behind the same catalog version',()=>{
 for(const mutate of [p=>{p.minCardsPerPool++},p=>{p.allowedModes=['talk']},p=>{p.categoryOverrides['word-000005']=['food']}]){
  const data=clone(C.data),pack=data.packs.find(p=>p.id==='general'&&p.version===68);mutate(pack);
  assert.throws(()=>E.context(data,C.m),/Historical catalog definition changed/);
 }
});
test('an edition binds explicit pool policy and rejects weaker thematic minima',()=>{
 const altered=clone(initial);altered.poolPolicies.animals.minimum++;
 assert.throws(()=>E.validate(altered,C),/Edition pool policies changed/);
 const changedModes=clone(initial);changedModes.poolPolicies.science.allowedModes=['talk'];
 assert.throws(()=>E.validate(changedModes,C),/Edition pool policies changed/);
 const m=clone(C.m);m.editions[0].poolPolicies.animals.minimum=1;
 assert.throws(()=>E.context(C.data,m),/minimum cannot be weakened/);
 for(const mutate of [p=>{p.allowedModes=['future']},p=>{p.minimum=0},p=>{delete p.allowedModes}]){
  const bad=clone(C.m);mutate(bad.editions[0].poolPolicies.animals);assert.throws(()=>E.validateManifest(bad));
 }
});
test('published editions are content-locked and cannot be edited',()=>{
 const m=clone(C.m);m.editions[0].status='published';m.published['quip@1']=E.hash(initial);const c=E.context(C.data,m);
 assert.equal(E.validate(initial,c).ok,true);assert.throws(()=>E.apply(initial,[cat],{reviewer:'test',at},c),/published edition/);
 const next=clone(initial);next.records[0].review.status='needs-source';next.records[0].review.reviewer='test';next.records[0].review.reviewedAt=at;next.records[0].review.rationale='Нужен источник значения слова.';
 assert.throws(()=>E.validate(next,c),/immutable/);
});
test('invalid tiers, unknown tags/modes, game-kind changes and universal secret difficulty are rejected',()=>{
 for(const mutate of [d=>{d.classification.modes.draw.difficulty='extreme'},d=>{d.classification.categories=['unknown']},d=>{d.classification.themes=['unknown']},d=>{d.classification.modes.future={}},d=>{d.classification.form='song'},d=>{d.classification.modes.secret={policy:'easy'}},d=>{d.classification.modes.sing={eligible:false,difficulty:'easy',reason:'type'}}]){
  const d=clone(cat);mutate(d);assert.throws(()=>apply([d]));
 }
});
test('songs, people, numbers and multiword forms cannot leak into the Blitz word pool',()=>{
 for(const d of [potter,quantum]){const bad=clone(d);bad.classification.modes.blitz={eligible:true,difficulty:'easy',reason:'fast-clue'};assert.throws(()=>apply([bad]),/eligible mode blitz/);}
 const bad=clone(quantum);bad.classification.form='word';bad.classification.modes.blitz={eligible:true,difficulty:'hard',reason:'specialist'};assert.throws(()=>apply([bad]),/eligible mode blitz/);
});
test('review status requires an individual rationale and finite timestamp',()=>{
 const d=clone(cat);d.rationale='ok';assert.throws(()=>apply([d]),/rationale/);
 assert.throws(()=>E.apply(initial,[cat],{reviewer:'test',at:'not-a-date'},C),/timestamp/);
 const e=clone(initial);e.records[0].review.reviewer='not-reviewed';assert.throws(()=>E.validate(e,C),/migrated hint/);
});
test('JSON boundary rejects getters/toJSON, cycles, symbols, hidden values and non-finite values without executing them',()=>{
 let calls=0;const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){calls++;throw Error('executed')}});
 const toJSON={toJSON(){calls++;throw Error('executed')}};const cycle={};cycle.self=cycle;const hidden={};Object.defineProperty(hidden,'x',{value:1});
 for(const value of [getter,toJSON,cycle,{x:Infinity},{x:NaN},{x:undefined},{x:1n},new Date(),Object.create({x:1}),{[Symbol()]:1},hidden,[,1]])assert.throws(()=>E.hash(value));
 assert.equal(calls,0);
});
test('audit counts actual-method tiers, category intersections and distinct Blitz IDs',()=>{
 const report=E.audit(apply(),C);assert.equal(report.byMode.draw.easy,1);assert.equal(report.byMode.draw.medium,1);assert.equal(report.byMode.draw.ineligible,2);
 assert.equal(report.intersections['science+technology'],1);assert.equal(report.byMode.secret.derived,4);
 assert.equal(report.byFormMode.word.draw.easy,1);assert.equal(report.byFormMode.phrase.draw.ineligible,1);
 assert.equal(report.byMode.secret.byMethod.draw.medium,1);assert.equal(report.byMode.secret.byMethod.talk.hard,1);
 const find=(mode,tier)=>report.pools.find(p=>p.theme==='general'&&p.category==='all'&&p.mode===mode&&p.tier===tier);
 assert.equal(find('blitz','easy').count,1);assert.equal(find('blitz','easy').minimum,3);assert.equal(find('blitz','easy').available,false);
 assert.equal(find('secret','easy').count,3);assert.equal(find('secret','medium').count,1);assert.equal(find('draw','hard').available,false);
});
test('public audit never copies numeric answers, derivations or source URLs',()=>{
 const report=E.audit(initial,C),serialized=JSON.stringify(report);
 assert.doesNotMatch(serialized,/"(?:answer|tolerance|explanation|sourceUrl|sourceURLs|sources)"\s*:/);
 for(const r of report.pending.filter(r=>r.type==='number'))assert.deepEqual(Object.keys(r).sort(),['id','status','text','type']);
 assert.equal(report.pending.filter(r=>r.type==='number').length,C.ids.filter(id=>!C.sources.get(id).row.type).length);
});
test('audit warnings do not rewrite texts, plurals, IDs or historical sources',()=>{
 const before=E.hash(initial),sourceBefore=E.hash(C.data.sources),report=E.audit(initial,C);
 assert.ok(report.pluralCandidates.length>0);assert.equal(E.hash(initial),before);assert.equal(E.hash(C.data.sources),sourceBefore);
});
test('schema enumerations and required modes match executable format',()=>{
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schema-v1.json'),'utf8'));
 assert.deepEqual(schema.$defs.classification.properties.form.enum,E.FORMS);assert.deepEqual(schema.$defs.modes.required,E.MODES);
 assert.deepEqual(schema.$defs.eligible.properties.difficulty.enum,E.LEVELS);assert.deepEqual(schema.$defs.reason.enum,E.REASONS);
});

test('lexical character correction preserves source and moves eligibility exclusively to yesno',()=>{
 const id='word-075012',d=decision(id,classification('person',['videogames','culture'],{yesno:'medium'}),'Именной ледяной боец является персонажем; исходный ID и текст сохранены.');
 const next=E.apply(initial,[d],{reviewer:'editorial-test',at},C),r=next.records.find(r=>r.id===id);
 assert.equal(r.proposal.form,'word');assert.equal(r.classification.form,'person');
 assert.equal(r.classification.modes.yesno.difficulty,'medium');
 assert.equal(r.classification.modes.blitz.eligible,false);
 assert.deepEqual(r.source,initial.records.find(r=>r.id===id).source);
 const bad=clone(d);bad.classification.modes.talk={eligible:true,difficulty:'medium',reason:'indirect'};
 assert.throws(()=>E.apply(initial,[bad],{reviewer:'editorial-test',at},C),/eligible mode talk/);
});
