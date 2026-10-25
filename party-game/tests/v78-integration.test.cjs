'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),published='fd644e77cb66c74c17aa90842eda76a2894466d6';
const shared='7f57ee92f9516eba4bd1d87a2275b73800bf2a01',source='dec17db1ac8a0be07dffea7bc68ffbec9aa7240b';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
test('v82 editorial successor preserves runtime code and pins all content changes to audited sources',()=>{
 for(const ref of [published,source])assert.equal(git(['merge-base','--is-ancestor',ref,'HEAD']),'',ref+' must remain an ancestor');
 assert.equal(git(['rev-parse',published+'^{tree}']),git(['rev-parse',shared+'^{tree}']),'main already contains the exact TASK 016/017 tree');
 const html=fs.readFileSync(path.join(root,'party-game/index.html'),'utf8');
 const scripts=[...html.matchAll(/<script src="\.\/([^?"/]+\.js)/g)].map(m=>m[1]);
 assert.equal(scripts.length,45);
 const editableContentArtifacts=new Set(['cards.js','content-packs.js']);
 for(const name of [...scripts,'index.html','style.css'].filter(name=>!editableContentArtifacts.has(name)))
  assert.equal(fs.readFileSync(path.join(root,'party-game',name),'utf8'),git(['show',source+':party-game/'+name]),name);
 const contentApi=require('../scripts/content.cjs'),rendered=contentApi.render(contentApi.readDataset());
 for(const name of editableContentArtifacts)assert.equal(fs.readFileSync(path.join(root,'party-game',name),'utf8'),rendered[name],name+' deterministic build');
 const prior=git(['show',source+':party-game/sw.js']),now=fs.readFileSync(path.join(root,'party-game/sw.js'),'utf8');
 assert.match(now,/const CACHE='kvip-pwa-v82-20261025-integration-candidate'/);
 assert.equal(now.replace(/const CACHE='[^']+'/,'const CACHE=VERSION'),prior.replace(/const CACHE='[^']+'/,'const CACHE=VERSION'),'Only the integration cache name changes');
 const allowed=new Set([
 'party-game/sw.js','party-game/INTEGRATION-V82.md',
 'party-game/tests/v78-integration.test.cjs','party-game/tests/v78-upgrade-browser.cjs','party-game/tests/profile-backup-browser.cjs',
 'party-game/tests/approx-units.test.cjs','party-game/tests/content400-integration.test.cjs',
 'party-game/cards.js','party-game/content/cards/science-expansion-v2.json','party-game/content/cards/science-expansion-v3.json','party-game/content/cards/idiom-expansion-v1.json',
 'party-game/content/editorial/content400-independent-audit-v1.json','party-game/content/editorial/content400-independent-audit-v1.md'
]);
 for(const name of git(['diff','--name-only',source,'HEAD','--','party-game']).trim().split('\n').filter(Boolean))assert.ok(allowed.has(name),'Unexpected integration edit '+name);
});
