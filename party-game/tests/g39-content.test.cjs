'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..'),priorRef='96e63df3a53f69b3c4376322994d2e87f628403b';
const prev=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});
test('G39 provides exactly 50 Cyrillic prompts with unique 064 IDs and 16/4, 16/4, 8/2 type tiers',()=>{
 const d=api.readDataset(),rows=d.cards.filter(c=>c.pack==='general-diversity-v25');assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(t=>rows.filter(c=>c.difficulty===t).length),[20,20,10]);
 for(const [level,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,w);assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,p)}
 for(const t of ['word','phrase'])rows.filter(c=>c.type===t).forEach((c,i)=>assert.equal(c.id,t+'-064'+String(i+1).padStart(3,'0')));
 const allowed=new Set(d.manifest.categories.map(x=>x.id)),seen=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v25').map(x=>api.normalize(x.text)));
 for(const c of rows){assert.match(c.text,/^[А-ЯЁ ]+$/u);assert.ok(c.categories.length&&c.categories.every(x=>allowed.has(x)));let x=api.normalize(c.text);assert.ok(!seen.has(x),'Duplicate '+c.text);seen.add(x)}
 assert.ok(api.validate(d).ok,'Validation must not be bypassed');
});
test('G39 general@41 includes original 6650 IDs and appends the 50 new ones',()=>{
 const d=api.readDataset(),old=d.packs.find(x=>x.id==='general'&&x.version===40),newer=d.packs.find(x=>x.id==='general'&&x.version===41),rows=d.cards.filter(x=>x.pack==='general-diversity-v25');
 assert.ok(old&&newer);assert.equal(old.criteria.cardIds.length,6650);assert.equal(newer.criteria.cardIds.length,6700);
 assert.deepEqual(newer.criteria.cardIds.slice(0,6650),old.criteria.cardIds);assert.deepEqual(newer.criteria.cardIds.slice(6650),rows.map(x=>x.id));assert.equal(new Set(newer.criteria.cardIds).size,6700);
});
test('G39 preserves all preceding source JSON byte-for-byte',()=>{
 const before=JSON.parse(prev('party-game/content/manifest.json')),after=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){const seen=new Set(after[kind].map(x=>x.path));for(const entry of before[kind]){assert.ok(seen.has(entry.path),'Missing '+entry.path);const f='party-game/content/'+entry.path;assert.equal(fs.readFileSync(path.join(root,f),'utf8'),prev(f),'Historic file changed '+f)}}
});
