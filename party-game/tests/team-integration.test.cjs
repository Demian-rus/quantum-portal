'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {withoutTeamShell}=require('./wizard-contract.cjs');
const root=path.resolve(__dirname,'../..'),published='b71e9ee16a2492bbe03de7cf0cd48316d0f6ac22',source='e4ff28fcb65f0309fc23c0405b654b75a351cf7f';
const read=f=>fs.readFileSync(path.join(root,'party-game',f),'utf8'),old=(sha,f)=>execFileSync('git',['show',sha+':party-game/'+f],{cwd:root,encoding:'utf8',maxBuffer:15e6});
test('integration keeps published TASK030 runtime and sole wizard except exact format hooks',()=>{
 for(const f of ['index.html','sw.js'])assert.equal(withoutTeamShell(read(f)),old(published,f),f);
 const wizard=read('setup-wizard.js').replace('<button id="wizard-format-duel" type="button" aria-pressed="true">1 НА 1</button><button id="wizard-format-teams" type="button" aria-pressed="false" disabled>2 НА 2</button>','<button type="button" aria-pressed="true">1 НА 1</button><button type="button" disabled>КОМАНДАМИ · СКОРО</button>').replace("  scene.dispatchEvent(new CustomEvent('quip:setup-rendered'));\n",'');
 assert.equal(wizard,old(published,'setup-wizard.js'));
 assert.equal(read('setup-wizard.css'),old(published,'setup-wizard.css'));
 assert.doesNotMatch(read('team-controller.js'),/wizard-legacy|setup-interface-toggle|setEnabled|function detach/);
});
test('integration imports original team contracts without changing engine, roles, storage or CSS',()=>{
 for(const f of ['team-format.js','team-storage.js','team-engine.js','team-game.css','tests/team-engine.test.cjs','tests/team-foundation-browser.cjs','tests/team-safety-browser.cjs'])assert.equal(read(f),old(source,f),f);
});
test('published engine controllers, rules, catalogs and accepted game CSS remain exact',()=>{
 const scripts=[...old(published,'index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(scripts.length,49);
 for(const f of [...scripts.filter(f=>f!=='setup-wizard.js'),'style.css'])assert.equal(read(f),old(published,f),f);
});
