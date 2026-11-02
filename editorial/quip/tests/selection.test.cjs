'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../editor.cjs'),S=require('../selector.js'),{compile}=require('../compile.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(){
 const base=E.context(),ids=['word-000229','word-000249','word-000263','word-000964','phrase-000334','person-000006','song-020002','song-020092','approx-0046'];
 const general={...base.general,ids,idsDigest:E.hash(ids),pack:{...base.general.pack,criteria:{...base.general.pack.criteria,cardIds:ids}}};
 const c={...base,ids,idSet:new Set(ids),general,catalogs:[general],themes:new Set()};
 const e=E.createDraft(c),classify=(id,form,categories,tiers)=>({id,fingerprint:c.sources.get(id).fingerprint,rationale:'Изолированная тестовая оценка реального исходного задания, не массовая проверка каталога.',classification:{form,categories,themes:[],ambiguities:[],modes:Object.fromEntries(E.MODES.map(m=>[m,m==='secret'?{policy:'actual-method'}:{eligible:!!tiers[m],difficulty:tiers[m]||null,reason:tiers[m]?'concrete':'type'}]))}});
 const decisions=[
  classify(ids[0],'word',['animals'],{talk:'easy',mime:'easy',draw:'easy',blitz:'easy'}),
  classify(ids[1],'word',['technology'],{talk:'easy',mime:'easy',draw:'easy',blitz:'easy'}),
  classify(ids[2],'word',['everyday'],{talk:'easy',mime:'easy',draw:'easy',blitz:'easy'}),
  classify(ids[3],'word',['science','technology'],{talk:'easy',mime:'medium',draw:'medium',blitz:'medium'}),
  classify(ids[4],'phrase',['science'],{talk:'hard'}),
  classify(ids[5],'person',['literature','cinema'],{yesno:'easy'}),
  classify(ids[6],'song',['music'],{sing:'easy'}),
  classify(ids[7],'song',['music'],{sing:'medium'}),
  classify(ids[8],'number',['science','space'],{approx:'hard'})
 ];
 const edition=E.apply(e,decisions,{reviewer:'isolated-test',at:'2026-11-01T12:00:00.000Z'},c);
 const compiled=compile(edition,c),rows=ids.map(id=>c.sources.get(id).row);return {c,edition,compiled,rows,index:S.createIndex(compiled,rows)};
}
function request(overrides={}){return {theme:'general',mode:'draw',method:null,tiers:['easy'],promptTypes:['word','phrase','idiom'],excludedCategories:[],languages:['ru'],...overrides};}

test('unreviewed full draft cannot be compiled into a playable edition',()=>assert.throws(()=>compile(E.readEdition()),/await semantic review/));
test('draw defaults to easy independently of round severity; other modes remain independent',()=>{
 const p=S.preferences();assert.deepEqual(S.tiersFor(p,'draw','hard'),['easy']);assert.deepEqual(S.tiersFor(p,'mime','hard'),['easy']);
 assert.deepEqual(S.tiersFor(p,'talk','hard'),['hard']);assert.deepEqual(S.tiersFor(p,'blitz','medium'),['medium','hard']);
 const next={version:1,choices:{...p.choices,draw:'hard',mime:'medium'}};assert.deepEqual(S.tiersFor(next,'draw','easy'),['hard']);assert.deepEqual(S.tiersFor(p,'draw','easy'),['easy']);
});
test('Blitz default excludes easy while explicit easy and saved all policies remain compatible',()=>{
 const p=S.preferences();
 for(const round of S.TIERS)assert.deepEqual(S.tiersFor(p,'blitz',round),['medium','hard']);
 assert.deepEqual(S.tiersFor({version:1,choices:{...p.choices,blitz:'easy'}},'blitz','hard'),['easy']);
 assert.deepEqual(S.tiersFor({version:1,choices:{...p.choices,blitz:'all'}},'blitz','easy'),['easy','medium','hard']);
 assert.throws(()=>S.preferences({version:1,choices:{...p.choices,draw:'medium-hard'}}));
});
test('Secret uses actual method and cannot introduce hard drawing through a different default',()=>{
 const p=S.preferences();assert.deepEqual(S.tiersFor(p,'secret','hard','draw'),['easy']);assert.deepEqual(S.tiersFor(p,'secret','hard','talk'),['hard']);
 const restricted={version:1,choices:{...p.choices,secret:'hard'}};assert.deepEqual(S.tiersFor(restricted,'secret','hard','draw'),[]);
 const explicit={version:1,choices:{...restricted.choices,draw:'hard'}};assert.deepEqual(S.tiersFor(explicit,'secret','easy','draw'),['hard']);
 assert.throws(()=>S.tiersFor(p,'secret','easy'),/actual method/);
});
test('unknown policy versions, modes, tiers and missing choices are blocked',()=>{
 const p=S.preferences();assert.throws(()=>S.preferences({version:2,choices:p.choices}),/Unknown task-level policy/);
 assert.throws(()=>S.preferences({version:1,choices:{...p.choices,draw:'all'}}));assert.throws(()=>S.preferences({version:1,choices:{draw:'easy'}}));
 assert.throws(()=>S.tiersFor(p,'future','easy'));assert.throws(()=>S.tiersFor(p,'draw','mixed'));
});
test('individual mode metadata controls real source records and never falls back across tiers',()=>{
 const {index}=fixture();assert.equal(index.pool(request()).length,3);
 assert.deepEqual(index.pool(request({tiers:['medium']})).map(r=>r.id),['word-000964']);
 assert.deepEqual(index.pool(request({tiers:['hard']})),[]);assert.deepEqual(index.pool(request({tiers:[]})),[]);
 assert.equal(index.availability(request({tiers:['hard']})).available,false);
 assert.deepEqual(index.pool(request({mode:'talk',tiers:['hard']})).map(r=>r.id),['phrase-000334']);
});
test('category all-off/on and empty form lists stay explicit; returned arrays cannot alter the index',()=>{
 const {index,compiled}=fixture(),first=index.pool(request());first.length=0;assert.equal(index.pool(request()).length,3);
 assert.deepEqual(index.pool(request({excludedCategories:compiled.categories})),[]);assert.equal(index.pool(request()).length,3);
 assert.deepEqual(index.pool(request({promptTypes:[]})),[]);assert.equal(index.pool(request({excludedCategories:['technology']})).some(r=>r.id==='word-000249'),false);
});
test('Blitz allows medium/hard words, rejects phrases and requires three distinct normalized prompts',()=>{
 const {index,compiled,rows}=fixture();const r=request({mode:'blitz',tiers:['easy','medium','hard']});
 assert.equal(index.pool(r).length,4);assert.equal(index.pool(r).some(row=>row.type!=='word'),false);assert.equal(index.availability(r).available,true);
 assert.equal(index.availability({...r,tiers:['medium']}).available,false);
 const duplicates=rows.map(row=>row.type==='word'?{...row,text:'ЁЛКА'}:row),duped=S.createIndex(compiled,duplicates);
 assert.equal(duped.availability(r).count,1);assert.equal(duped.availability(r).available,false);
});
test('songs and numeric tasks retain separate pools and source values; song language also applies inside Secret',()=>{
 const {index,c}=fixture();assert.deepEqual(index.pool(request({mode:'sing'})).map(r=>r.id),['song-020002']);
 const en=request({mode:'secret',method:'sing',tiers:['medium'],languages:['en']});assert.deepEqual(index.pool(en).map(r=>r.id),['song-020092']);
 assert.deepEqual(index.pool({...en,languages:[]}),[]);const q=index.pool(request({mode:'approx',tiers:['hard']}));assert.equal(q.length,1);assert.equal(q[0],c.sources.get('approx-0046').row);
});
test('compiled format carries metadata and IDs, without answers or mutable authoring notes',()=>{
 const {compiled,edition}=fixture(),text=JSON.stringify(compiled);assert.doesNotMatch(text,/"(?:answer|question|text|rationale|reviewer|sourceUrl)"\s*:/);
 assert.equal(compiled.records['word-000964'][3][S.STORED_MODES.indexOf('draw')],'2');
 const {digest,...payload}=compiled;assert.equal(digest,E.hash(payload));assert.equal(compiled.sourceDigest,E.hash(edition));
 const changed=clone(payload);changed.catalogs.general.minimum++;assert.notEqual(E.hash(changed),digest);
});
test('compiled and source boundaries reject accessors and toJSON without executing them',()=>{
 const {compiled,rows}=fixture();let calls=0;const bad=clone(compiled);Object.defineProperty(bad,'version',{enumerable:true,get(){calls++;return 1}});
 assert.throws(()=>S.createIndex(bad,rows));const source=clone(rows);Object.defineProperty(source[0],'text',{enumerable:true,get(){calls++;return 'tampered'}});assert.throws(()=>S.createIndex(compiled,source));
 const json=clone(compiled);json.toJSON=()=>{calls++;return {}};assert.throws(()=>S.createIndex(json,rows));assert.equal(calls,0);
});
test('compiler uses the explicit edition policy rather than inferring it from historical pack fields',()=>{
 const {c,edition,compiled}=fixture();
 // Deliberately inconsistent isolated context: the validated catalog object is
 // not the authority for the new edition's mode policy.
 const general={...c.general,pack:{...c.general.pack,minCardsPerPool:99,allowedModes:['talk']}},next=compile(edition,{...c,general,catalogs:[general]});
 assert.deepEqual(next,compiled);assert.equal(next.catalogs.general.minimum,1);
 assert.equal(S.createIndex(next,c.ids.map(id=>c.sources.get(id).row)).availability(request()).available,true);
});
test('unsupported compiled editions and malformed mode/form metadata fail closed',()=>{
 const {compiled,rows}=fixture();for(const mutate of [e=>{e.schemaVersion=2},e=>{e.future=true},e=>{e.records['word-000229'][3]='1111119'},e=>{e.records['phrase-000334'][3]='3000030'},e=>{e.records['word-000229'][4]='ru'},e=>{e.catalogs.general.ids.push('missing')}]){
  const next=clone(compiled);mutate(next);assert.throws(()=>S.createIndex(next,rows));
 }
});
test('selectors do not consume RNG, change source records or mutate independent settings snapshots',()=>{
 const {index,rows}=fixture(),before=E.hash(rows),random=Math.random,p=S.preferences();
 Math.random=()=>{throw Error('Unexpected RNG')};try{index.availability(request());index.pool(request({mode:'secret',method:'draw'}));S.tiersFor(p,'secret','hard','draw');}finally{Math.random=random;}
 assert.equal(E.hash(rows),before);assert.equal(p.choices.draw,'easy');assert.equal(Object.isFrozen(p.choices),true);
});
