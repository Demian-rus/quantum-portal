'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),published='fd644e77cb66c74c17aa90842eda76a2894466d6';
const shared='7f57ee92f9516eba4bd1d87a2275b73800bf2a01',source='dec17db1ac8a0be07dffea7bc68ffbec9aa7240b';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
test('v82: published v78 and repaired #99 are ancestors; integration changes no inherited gameplay, data, or UI bytes',()=>{
 for(const ref of [published,source])assert.equal(git(['merge-base','--is-ancestor',ref,'HEAD']),'',ref+' must remain an ancestor');
 assert.equal(git(['rev-parse',published+'^{tree}']),git(['rev-parse',shared+'^{tree}']),'main already contains the exact TASK 016/017 tree');
 const html=fs.readFileSync(path.join(root,'party-game/index.html'),'utf8');
 const scripts=[...html.matchAll(/<script src="\.\/([^?"/]+\.js)/g)].map(m=>m[1]);
 assert.equal(scripts.length,45);
 for(const name of [...scripts,'index.html','style.css'])assert.equal(fs.readFileSync(path.join(root,'party-game',name),'utf8'),git(['show',source+':party-game/'+name]),name);
 const prior=git(['show',source+':party-game/sw.js']),now=fs.readFileSync(path.join(root,'party-game/sw.js'),'utf8');
 assert.match(now,/const CACHE='kvip-pwa-v82-20261025-integration-candidate'/);
 assert.equal(now.replace(/const CACHE='[^']+'/,'const CACHE=VERSION'),prior.replace(/const CACHE='[^']+'/,'const CACHE=VERSION'),'Only the integration cache name changes');
 const allowed=new Set(['party-game/sw.js','party-game/INTEGRATION-V82.md','party-game/tests/v78-integration.test.cjs','party-game/tests/v78-upgrade-browser.cjs','party-game/tests/profile-backup-browser.cjs']);
 for(const name of git(['diff','--name-only',source,'HEAD','--','party-game']).trim().split('\n').filter(Boolean))assert.ok(allowed.has(name),'Unexpected integration edit '+name);
});
