'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base='e0201acd7d544411b330264e6e2cfa252bbd6cff',read=f=>fs.readFileSync(path.join(root,'party-game',f),'utf8'),old=f=>execFileSync('git',['show',base+':party-game/'+f],{cwd:root,encoding:'utf8',maxBuffer:15e6});
const {withoutTeamShell}=require('./wizard-contract.cjs');
test('TASK030 keeps all engine scripts, scene v88 and catalog/data code byte-exact',()=>{
 const scripts=[...old('index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(scripts.length,49);
 for(const f of scripts.filter(f=>f!=='setup-wizard.js'))assert.equal(read(f),old(f),f);
 assert.equal(read('style.css'),old('style.css'));
 assert.equal(withoutTeamShell(read('index.html')).replace('setup-wizard.js?v=4','setup-wizard.js?v=2').replace('setup-wizard.css?v=2','setup-wizard.css?v=1'),old('index.html'));
 assert.equal(withoutTeamShell(read('sw.js')).replace('kvip-pwa-v91-20261027-wizard-only-candidate-guard','kvip-pwa-v90-20261027-wizard-performance-candidate').replace('setup-wizard.js?v=4','setup-wizard.js?v=2').replace('setup-wizard.css?v=2','setup-wizard.css?v=1'),old('sw.js'));
});
test('TASK030 preserves the exact TASK029 validation stamp and scoped memo',()=>{
 const cost=s=>s.slice(s.indexOf(' function viewStamp(){'),s.indexOf(" const scene=document.createElement"));assert.equal(cost(read('setup-wizard.js')),cost(old('setup-wizard.js')));
 const s=read('setup-wizard.js');assert.doesNotMatch(s,/wizard-legacy|setup-interface-toggle|setEnabled|function detach|let enabled/);assert.match(s,/searchParams\.delete\('setup'\)/);assert.match(s,/renderOptions=function/);
});
