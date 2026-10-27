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
test('published engine controllers, rules, catalogs and accepted game CSS remain exact',()=>{
 const scripts=[...old(published,'index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(scripts.length,49);
 for(const f of [...scripts.filter(f=>f!=='setup-wizard.js'),'style.css'])assert.equal(read(f),old(published,f),f);
});

test('published G26-G36 catalogs and every editorial source remain byte-exact',()=>{
 assert.equal(execFileSync('git',['diff',published,'--','party-game/cards.js','party-game/content-packs.js','party-game/content'],{cwd:root,encoding:'utf8',maxBuffer:15e6}), '');
});
