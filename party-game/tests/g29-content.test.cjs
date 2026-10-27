'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..');
const priorRef='df7a5d0b4c05a0fa059379527d13eaadbee3e67f';
const before=(file)=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G29: new source has 50 stable unique cards, 40 words 10 phrases, split 20/20/10',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v15');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(l=>rows.filter(c=>c.difficulty===l).length),[20,20,10]);
 for(const [level,words,phrases] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,words);
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,phrases);
 }
 rows.filter(c=>c.type==='word').forEach((c,i)=>assert.equal(c.id,'word-054'+String(i+1).padStart(3,'0')));
 rows.filter(c=>c.type==='phrase').forEach((c,i)=>assert.equal(c.id,'phrase-054'+String(i+1).padStart(3,'0')));
 const categoryIds=new Set(data.manifest.categories.map(x=>x.id));
 rows.forEach(c=>assert.ok(c.text&&c.categories.length&&c.categories.every(x=>categoryIds.has(x)),c.id));
 const old=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v15').map(c=>api.normalize(c.text))),seen=new Set();
 for(const c of rows){const name=api.normalize(c.text);assert.ok(!old.has(name)&&!seen.has(name),'Duplicate: '+c.text);seen.add(name)}
 assert.ok(api.validate(data).ok,'Full dictionary validation must pass');
});

test('G29: general@31 pins 6200 IDs with exact unchanged previous 6150-prefix',()=>{
 const d=api.readDataset(),pack=v=>d.packs.find(p=>p.id==='general'&&p.version===v);
 const released=pack(27),g26=pack(28),g27=pack(29),g28=pack(30),g29=pack(31);
 assert.ok(released&&g26&&g27&&g28&&g29);
 assert.deepEqual([released,g26,g27,g28,g29].map(p=>p.criteria.cardIds.length),[6000,6050,6100,6150,6200]);
 assert.deepEqual(g29.criteria.cardIds.slice(0,6150),g28.criteria.cardIds);
 assert.deepEqual(g29.criteria.cardIds.slice(6150),d.cards.filter(c=>c.pack==='general-diversity-v15').map(c=>c.id));
 assert.equal(new Set(g29.criteria.cardIds).size,6200);
});

test('G29: every previously registered JSON source is byte-for-byte unchanged',()=>{
 const earlier=JSON.parse(before('party-game/content/manifest.json')),current=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){
  const known=new Set(current[kind].map(s=>s.path));
  for(const source of earlier[kind]){
   assert.ok(known.has(source.path),'Removed prior source: '+source.path);
   const filename='party-game/content/'+source.path;
   assert.equal(fs.readFileSync(path.join(root,filename),'utf8'),before(filename),'Changed prior source: '+filename);
  }
 }
});
