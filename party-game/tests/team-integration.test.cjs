'use strict';
const {normalizeCatalogNavigation,normalizeWizardCountCSS}=require('./catalog-count-contract.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {withoutTeamShell}=require('./wizard-contract.cjs');
const root=path.resolve(__dirname,'../..'),published='b094bd5159bb07b9aa17fff4b906fa6d4e32f636',source='e4ff28fcb65f0309fc23c0405b654b75a351cf7f';
const read=f=>normalizeCatalogNavigation(fs.readFileSync(path.join(root,'party-game',f),'utf8')),old=(sha,f)=>execFileSync('git',['show',sha+':party-game/'+f],{cwd:root,encoding:'utf8',maxBuffer:15e6});
test('integration keeps published TASK030 runtime and sole wizard except exact format hooks',()=>{
 for(const f of ['index.html','sw.js'])assert.equal(withoutTeamShell(read(f)),old(published,f),f);
 const wizard=read('setup-wizard.js').replace('<button id="wizard-format-duel" type="button" aria-pressed="true">1 НА 1</button><button id="wizard-format-teams" type="button" aria-pressed="false" disabled>2 НА 2</button>','<button type="button" aria-pressed="true">1 НА 1</button><button type="button" disabled>КОМАНДАМИ · СКОРО</button>').replace("  scene.dispatchEvent(new CustomEvent('quip:setup-rendered'));\n",'');
 assert.equal(wizard.replace("  for(const id of ['standard','thematic'])$(id+'-game').insertBefore($(id+'-content-count'),$(id+'-game').querySelector('strong').nextSibling);\n",'').replace('  renderGameTypeCounts();\n','').replace(' // Prepare installed catalog counts during boot, before the first trusted tap.\n renderGameTypeCounts();\n',''),old(published,'setup-wizard.js'));
 assert.equal(normalizeWizardCountCSS(read('setup-wizard.css')),old(published,'setup-wizard.css'));
 assert.doesNotMatch(read('team-controller.js'),/wizard-legacy|setup-interface-toggle|setEnabled|function detach/);
});
test('integration imports original team contracts without changing engine, roles, storage or CSS',()=>{
 for(const f of ['team-format.js','team-storage.js','team-engine.js','team-game.css','tests/team-engine.test.cjs','tests/team-foundation-browser.cjs','tests/team-safety-browser.cjs'])assert.equal(read(f),old(source,f),f);
});
test('published engine controllers and accepted game CSS remain exact; catalog expansion is independently guarded',()=>{
 const scripts=[...old(published,'index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(scripts.length,49);
 for(const f of [...scripts.filter(f=>!['setup-wizard.js','cards.js','content-packs.js'].includes(f)),'style.css'])assert.equal(read(f),old(published,f),f);
 const api=require('../scripts/content.cjs'),dataset=api.readDataset(),rendered=api.render(dataset);
 for(const f of ['cards.js','content-packs.js'])assert.equal(read(f),rendered[f],f+' is exact generator output');
 assert.ok(api.validate(dataset).ok,'Full content validation must remain enabled');
});

test('published G26-G36 source JSON remains byte-exact; only G37-G38 additions and generated artifacts can differ',()=>{
 const api=require('../scripts/content.cjs'),data=api.readDataset(),previous=JSON.parse(old(published,'content/manifest.json'));
 const priorSources=[...previous.cards,...previous.questions,...previous.packs];
 const currentSources=new Set([...data.manifest.cards,...data.manifest.questions,...data.manifest.packs].map(x=>x.path));
 for(const entry of priorSources){
  assert.ok(currentSources.has(entry.path),'Historical source omitted '+entry.path);
  assert.equal(read('content/'+entry.path),old(published,'content/'+entry.path),'Historical bytes changed '+entry.path);
 }
 const diff=execFileSync('git',['diff','--name-only',published,'--','party-game/cards.js','party-game/content-packs.js','party-game/content'],{cwd:root,encoding:'utf8',maxBuffer:15e6}).trim().split('\n').filter(Boolean);
 const allowed=new Set(['party-game/cards.js','party-game/content-packs.js','party-game/content/manifest.json',
 'party-game/content/cards/general-diversity-v23.json','party-game/content/packs/general-diversity-v23.json',
 'party-game/content/editorial/general-diversity-v23-review.md','party-game/content/cards/general-diversity-v24.json','party-game/content/packs/general-diversity-v24.json','party-game/content/editorial/general-diversity-v24-review.md']);
 for(const f of diff)assert.ok(allowed.has(f),'Unexpected published content change '+f);
 assert.equal(data.packs.find(p=>p.id==='general'&&p.version===38).criteria.cardIds.length,6550);
 assert.equal(data.packs.find(p=>p.id==='general'&&p.version===39).criteria.cardIds.length,6600);
});
