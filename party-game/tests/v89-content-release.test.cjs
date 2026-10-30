'use strict';
const {normalizeCatalogNavigation}=require('./catalog-count-contract.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {normalizeWizardModeCopy,withoutWizardShell}=require('./wizard-contract.cjs');
const {normalizeTouchHighlight}=require('../../diagnostics/touch-highlight/source-contract.cjs');
const api=require('../scripts/content.cjs'),root=path.resolve(__dirname,'../..'),base='ccbc52cb1142a9a169dd735d6dbfd3e94408fec1',editorial='c230c15b81c11468b24f3d486f6ce210dead4f7f';
const old=(ref,file)=>cp.execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16e6});
const assertPublishedCss=css=>assert.equal(normalizeTouchHighlight(css),old(base,'party-game/style.css'));
test('v89 retains every published runtime mechanism and every original editorial source',()=>{
 const html=old(base,'party-game/index.html');
 for(const[,name]of html.matchAll(/<script src="\.\/([^?]+\.js)\?/g))if(!['cards.js','content-packs.js'].includes(name))assert.equal(name==='mode-config.js'?normalizeWizardModeCopy(normalizeCatalogNavigation(fs.readFileSync(path.join(root,'party-game',name),'utf8'))):normalizeCatalogNavigation(fs.readFileSync(path.join(root,'party-game',name),'utf8')),old(base,'party-game/'+name),name);
 assertPublishedCss(fs.readFileSync(path.join(root,'party-game/style.css'),'utf8'));
 for(const ref of [base,editorial]){
  const manifest=JSON.parse(old(ref,'party-game/content/manifest.json'));
  for(const kind of ['cards','questions','packs'])for(const source of manifest[kind]){
   const file='party-game/content/'+source.path;assert.equal(fs.readFileSync(path.join(root,file),'utf8'),old(ref,file),ref+':'+file);
  }
 }
 const normalize=s=>withoutWizardShell(s).replace('kvip-pwa-v89-20261026-general-content-release','kvip-pwa-v88-20261025-round-layout-candidate').replaceAll('cards.js?v=10','cards.js?v=9').replaceAll('content-packs.js?v=18','content-packs.js?v=17');
 for(const name of ['index.html','sw.js'])assert.equal(normalize(normalizeCatalogNavigation(fs.readFileSync(path.join(root,'party-game',name),'utf8'))),old(base,'party-game/'+name),name+' only changes cache/resource versions');
});
test('v89 CSS byte guard rejects unrelated edits, appended rules and changes inside the allowed tap-highlight hunk',()=>{
 const css=fs.readFileSync(path.join(root,'party-game/style.css'),'utf8');
 for(const mutation of [css.replace('--bg:#0f0b20','--bg:#000000'),css+'\nbutton{outline:none}',css.replace('-webkit-tap-highlight-color:transparent','-webkit-tap-highlight-color:transparent;outline:none')]){
  assert.notEqual(mutation,css,'negative control must change CSS');
  assert.throws(()=>assertPublishedCss(mutation),assert.AssertionError);
 }
});
test('v89 exposes 6000 active IDs with nine explicit replacements and preserves all historical catalogs',()=>{
 const d=api.readDataset(),by=new Map(d.cards.map(c=>[c.id,c])),prior=d.packs.find(p=>p.id==='general'&&p.version===26),active=d.packs.find(p=>p.id==='general'&&p.version===27),published=d.packs.find(p=>p.id==='general'&&p.version===15);
 const revisions=d.cards.filter(c=>c.pack==='general-release-v89-revisions'),changes=new Map(revisions.map(c=>[c.meta.replacesCardId,c.id]));
 assert.equal(revisions.length,9);assert.equal(active.criteria.cardIds.length,6000);assert.equal(new Set(active.criteria.cardIds).size,6000);
 assert.deepEqual(active.criteria.cardIds,prior.criteria.cardIds.map(id=>changes.get(id)||id));
 assert.deepEqual(active.criteria.cardIds.slice(0,5450),published.criteria.cardIds);
 for(const c of revisions){const original=by.get(c.meta.replacesCardId);assert.ok(original);assert.equal(c.type,original.type);assert.equal(c.difficulty,original.difficulty);assert.ok(!active.criteria.cardIds.includes(original.id));assert.ok(prior.criteria.cardIds.includes(original.id));}
 for(let version=16;version<=26;version++)assert.equal(d.packs.find(p=>p.id==='general'&&p.version===version).criteria.cardIds.length,5450+(version-15)*50);
 const original=d.cards.filter(c=>/^general-diversity-v(?:[1-9]|10|11)$/.test(c.pack));assert.equal(original.length,550);assert.equal(original.filter(c=>c.type==='word').length,440);assert.equal(original.filter(c=>c.type==='phrase').length,110);
 const selected=active.criteria.cardIds.filter(id=>!published.criteria.cardIds.includes(id)).map(id=>by.get(id));
 assert.equal(selected.length,550);assert.deepEqual(['easy','medium','hard'].map(l=>selected.filter(c=>c.difficulty===l).length),[220,220,110]);
 assert.equal(selected.filter(c=>c.type==='word').length,440);assert.equal(selected.filter(c=>c.type==='phrase').length,110);
 const before=new Set(published.criteria.cardIds.map(id=>by.get(id)?.text).filter(Boolean).map(api.normalize)),fresh=new Set();
 for(const c of selected){const text=api.normalize(c.text);assert.ok(!before.has(text)&&!fresh.has(text),c.text);fresh.add(text);}
 assert.equal(selected.some(c=>c.text==='КОНТРБАС'),false);assert.equal(selected.filter(c=>c.text==='КОНТРАБАС').length,1);
 assert.ok(api.validate(d).ok);
});
