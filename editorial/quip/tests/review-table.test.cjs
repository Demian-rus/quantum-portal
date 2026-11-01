'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../editor.cjs'),T=require('../review-table.cjs'),c=E.context();
const table=()=>fs.readFileSync(path.join(__dirname,'../reviews/persons-01.psv'),'utf8');
test('explicit per-ID review table is source-bound and has independent mode decisions',()=>{
 const rows=T.parse(table(),c);assert.equal(rows.length,110);const potter=rows.find(r=>r.id==='person-000006');
 assert.deepEqual(potter.classification.categories,['literature','cinema']);assert.equal(potter.classification.modes.yesno.difficulty,'easy');assert.equal(potter.classification.modes.draw.eligible,false);
 assert.ok(rows.find(r=>r.id==='person-000021').classification.ambiguities.length);
});
test('table parser blocks stale source digests, mismatched labels, omitted mode columns and unsupported editions',()=>{
 const original=table();
 const stale=original.replace(/"sourcesDigest":"[a-f0-9]+"/,'"sourcesDigest":"'+'0'.repeat(64)+'"');assert.throws(()=>T.parse(stale,c),/source changed/);
 assert.throws(()=>T.parse(original.replace('|ЧЕБУРАШКА|','|ДРУГОЙ ГЕРОЙ|'),c),/label\/ID mismatch/);
 assert.throws(()=>T.parse(original.replace('talk|mime|','talk|'),c),/mode columns/);
 assert.throws(()=>T.parse(original.replace('quip@1','quip@2'),c),/Unsupported review table/);
 assert.throws(()=>T.parse(original.replace('easy:recognisable-person','easy'),c),/mode reason/);
});
test('all committed review tables parse and exactly match their reviewed edition records',()=>{
 const records=new Map(E.readEdition(c).records.map(r=>[r.id,r]));
 for(const file of fs.readdirSync(path.join(__dirname,'../reviews')).filter(f=>f.endsWith('.psv'))){
  const decisions=T.parse(fs.readFileSync(path.join(__dirname,'../reviews',file),'utf8'),c);
  for(const d of decisions){const r=records.get(d.id);assert.equal(r.review.status,'reviewed');assert.deepEqual(r.classification,d.classification);assert.equal(r.review.rationale,d.rationale);}
 }
});
test('semantic examples keep concrete drawing separate from abstract words and phrase-free Blitz',()=>{
 const records=new Map(E.readEdition(c).records.map(r=>[r.id,r]));
 const concept=records.get('word-000112').classification,greeting=records.get('word-000113').classification,pencil=records.get('word-000001').classification;
 assert.equal(concept.modes.talk.difficulty,'medium');assert.equal(concept.modes.draw.eligible,false);assert.equal(concept.modes.mime.eligible,false);
 assert.equal(greeting.modes.draw.difficulty,'easy');assert.equal(greeting.modes.mime.difficulty,'easy');assert.equal(pencil.modes.blitz.difficulty,'easy');
 assert.equal(records.get('person-000129').classification.modes.yesno.eligible,false);
});
test('polysemy and marine/freshwater distinctions are explicit editorial decisions',()=>{
 const records=new Map(E.readEdition(c).records.map(r=>[r.id,r.classification]));
 assert.deepEqual(records.get('word-000191').categories,['animals','transport']);assert.ok(records.get('word-000205').ambiguities.length);
 assert.equal(records.get('word-000071').categories.includes('marine'),false);assert.equal(records.get('word-000385').categories.includes('marine'),false);
 assert.equal(records.get('word-000377').categories.includes('marine'),true);
});
