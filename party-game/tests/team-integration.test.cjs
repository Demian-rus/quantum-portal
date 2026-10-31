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
 for(const f of [...scripts.filter(f=>!['setup-wizard.js','cards.js','content-packs.js','approx-questions.js'].includes(f)),'style.css'])assert.equal(read(f),old(published,f),f);
 const api=require('../scripts/content.cjs'),dataset=api.readDataset(),rendered=api.render(dataset);
 for(const f of ['cards.js','content-packs.js','approx-questions.js'])assert.equal(fs.readFileSync(path.join(root,'party-game',f),'utf8'),rendered[f],f+' is exact generator output');
 assert.ok(api.validate(dataset).ok,'Full content validation must remain enabled');
});

test('published historical source JSON remains byte-exact; explicit G37–VG6 additions allowed',()=>{
 const api=require('../scripts/content.cjs'),data=api.readDataset(),previous=JSON.parse(old(published,'content/manifest.json'));
 const priorSources=[...previous.cards,...previous.questions,...previous.packs];
 const currentSources=new Set([...data.manifest.cards,...data.manifest.questions,...data.manifest.packs].map(x=>x.path));
 for(const entry of priorSources){
  assert.ok(currentSources.has(entry.path),'Historical source omitted '+entry.path);
  assert.equal(read('content/'+entry.path),old(published,'content/'+entry.path),'Historical bytes changed '+entry.path);
 }
 const diff=execFileSync('git',['diff','--name-only',published,'--','party-game/cards.js','party-game/content-packs.js','party-game/content'],{cwd:root,encoding:'utf8',maxBuffer:15e6}).trim().split('\n').filter(Boolean);
 assert.equal(read('content/templates/content-packs.after.js'),old(published,'content/templates/content-packs.after.js'),'Only exact reviewed selector/template hunks are permitted');
 const allowed=new Set(['party-game/content/templates/content-packs.after.js','party-game/cards.js','party-game/content-packs.js','party-game/approx-questions.js','party-game/content/manifest.json',
 'party-game/content/cards/general-diversity-v23.json','party-game/content/packs/general-diversity-v23.json',
 'party-game/content/editorial/general-diversity-v23-review.md','party-game/content/cards/general-diversity-v24.json','party-game/content/packs/general-diversity-v24.json','party-game/content/editorial/general-diversity-v24-review.md',
 'party-game/content/cards/general-diversity-v25.json','party-game/content/packs/general-diversity-v25.json',
 'party-game/content/editorial/general-diversity-v25-review.md',
 'party-game/content/cards/general-diversity-v26.json','party-game/content/packs/general-diversity-v26.json',
 'party-game/content/editorial/general-diversity-v26-review.md',
 'party-game/content/cards/general-diversity-v27.json','party-game/content/packs/general-diversity-v27.json',
 'party-game/content/editorial/general-diversity-v27-review.md',
 'party-game/content/cards/general-diversity-v28.json','party-game/content/packs/general-diversity-v28.json',
 'party-game/content/editorial/general-diversity-v28-review.md',
 'party-game/content/cards/general-diversity-v29.json','party-game/content/packs/general-diversity-v29.json',
 'party-game/content/editorial/general-diversity-v29-review.md',
  'party-game/content/cards/general-diversity-v30.json','party-game/content/packs/general-diversity-v30.json',
  'party-game/content/editorial/general-diversity-v30-review.md',
  'party-game/content/cards/general-diversity-v31.json','party-game/content/packs/general-diversity-v31.json',
  'party-game/content/editorial/general-diversity-v31-review.md',
   'party-game/content/cards/general-editorial-v1.json','party-game/content/packs/general-editorial-v1.json',
   'party-game/content/editorial/general-editorial-v1-review.md',
   'party-game/content/cards/general-editorial-v2.json','party-game/content/packs/general-editorial-v2.json',
   'party-game/content/editorial/general-editorial-v2-review.md',
   'party-game/content/editorial/modifiers-v3-review-proposals.md',
   'party-game/content/cards/general-memes-v1.json',
   'party-game/content/packs/general-memes-v1.json',
   'party-game/content/editorial/general-memes-v1-review.md',
   'party-game/content/cards/general-games-v1.json',
   'party-game/content/packs/general-games-v1.json',
   'party-game/content/editorial/general-games-v1-review.md',
   'party-game/content/cards/general-games-v2.json',
   'party-game/content/packs/general-games-v2.json',
   'party-game/content/editorial/general-games-v2-review.md',
   'party-game/content/cards/general-games-v3.json',
   'party-game/content/packs/general-games-v3.json',
   'party-game/content/editorial/general-games-v3-review.md',
   'party-game/content/cards/general-games-v4.json',
   'party-game/content/packs/general-games-v4.json',
   'party-game/content/editorial/general-games-v4-review.md',
   'party-game/content/cards/general-games-v5.json',
   'party-game/content/packs/general-games-v5.json',
   'party-game/content/editorial/general-games-v5-review.md',
   'party-game/content/packs/general-games-audience-v1.json',
   'party-game/content/editorial/general-games-audience-v1-decisions.json',
   'party-game/content/editorial/general-games-audience-v1-review.md',
   'party-game/content/editorial/general-games-audience-v1-ci-repair.md',
   'party-game/content/cards/general-games-v7.json',
   'party-game/content/packs/general-games-v7.json',
   'party-game/content/editorial/general-games-v7-review.md',
   'party-game/content/cards/general-games-v8.json',
   'party-game/content/packs/general-games-v8.json',
   'party-game/content/editorial/general-games-v8-review.md',
   'party-game/content/cards/general-games-v9.json',
   'party-game/content/packs/general-games-v9.json',
   'party-game/content/editorial/general-games-v9-review.md',
   'party-game/content/cards/general-games-v10.json',
   'party-game/content/packs/general-games-v10.json',
   'party-game/content/editorial/general-games-v10-review.md',
    'party-game/content/cards/general-games-v11.json',
    'party-game/content/packs/general-games-v11.json',
    'party-game/content/editorial/general-games-v11-review.md',
   'party-game/approx-questions.js',
   'party-game/content/questions/approx-games-v1.json',
   'party-game/content/packs/approx-games-v1.json',
   'party-game/content/editorial/approx-games-v1-sources.json',
   'party-game/content/editorial/approx-games-v1-review.md',
   'party-game/content/questions/approx-games-v2.json',
   'party-game/content/packs/approx-games-v2.json',
   'party-game/content/editorial/approx-games-v2-sources.json',
   'party-game/content/editorial/approx-games-v2-review.md',
   'party-game/content/questions/approx-games-v3.json',
   'party-game/content/packs/approx-games-v3.json',
   'party-game/content/editorial/approx-games-v3-sources.json',
   'party-game/content/editorial/approx-games-v3-review.md',
   'party-game/content/questions/approx-games-v4.json',
   'party-game/content/packs/approx-games-v4.json',
   'party-game/content/editorial/approx-games-v4-sources.json',
   'party-game/content/editorial/approx-games-v4-review.md',
   'party-game/content/questions/approx-games-v5.json',
   'party-game/content/packs/approx-games-v5.json',
   'party-game/content/editorial/approx-games-v5-sources.json',
   'party-game/content/editorial/approx-games-v5-review.md',
   'party-game/content/questions/approx-games-v6.json',
   'party-game/content/packs/approx-games-v6.json',
   'party-game/content/editorial/approx-games-v6-sources.json',
   'party-game/content/editorial/approx-games-v6-review.md']);
 for(const f of diff)assert.ok(allowed.has(f),'Unexpected published content change '+f);
 assert.equal(data.packs.find(p=>p.id==='general'&&p.version===38).criteria.cardIds.length,6550);
 assert.equal(data.packs.find(p=>p.id==='general'&&p.version===39).criteria.cardIds.length,6600);
});
