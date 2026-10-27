'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const {OLD,NEW,normalizeWizardModeCopy,withoutWizardShell}=require('./wizard-contract.cjs');
const root=path.resolve(__dirname,'../..'),base='507c3d24f270a7d26b1562ffc6837c819a15aa5b';
const read=f=>fs.readFileSync(path.join(root,'party-game',f),'utf8'),old=f=>cp.execFileSync('git',['show',base+':party-game/'+f],{cwd:root,encoding:'utf8',maxBuffer:15e6});
test('TASK027 leaves all 48 production controllers and full accepted CSS byte-exact except approved Blitz copy',()=>{
 const files=[...old('index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(files.length,48);
 for(const f of files)assert.equal(f==='mode-config.js'?normalizeWizardModeCopy(read(f)):read(f),old(f),f);
 assert.equal(read('style.css'),old('style.css'));assert.equal(withoutWizardShell(read('index.html')),old('index.html'));assert.equal(withoutWizardShell(read('sw.js')),old('sw.js'));
});
test('TASK027 Blitz changes current description only, all legacy configs and mathematical rules remain identical',()=>{
 const get=s=>{const ctx=vm.createContext({});vm.runInContext(s,ctx);return JSON.parse(vm.runInContext('JSON.stringify({current:QUIP_MODES_V4,legacy:QUIP_LEGACY_MODES,version:QUIP_MODE_CONFIG_VERSION})',ctx));};
 const before=get(old('mode-config.js')),after=get(read('mode-config.js'));
 assert.equal(after.current.blitz.rule,NEW);assert.equal(after.legacy.blitz.rule,OLD);after.current.blitz.rule=OLD;assert.deepEqual(after,before);
 assert.equal(read('rules.js'),old('rules.js'));assert.equal(read('round-selection.js'),old('round-selection.js'));
});
test('TASK027 uses existing controls, no separate save, mocked player, RNG or storage API',()=>{
 const script=read('setup-wizard.js');assert.match(script,/searchParams\.set\('setup'/);assert.match(script,/selectedPlayerProfiles\(\)/);assert.match(script,/rulesGuidePage\(mode.id\)/);assert.match(script,/move\(\$\('start-game'\)/);assert.match(script,/MODE_LIST\.map/);
 assert.doesNotMatch(script,/Math\.random|localStorage|sessionStorage|indexedDB|fetch\(|newGame\s*=|persist\s*=|game\s*=|options\s*=/);
 assert.match(read('sw.js'),/'\.\/setup-wizard.js\?v=2'/);assert.match(read('sw.js'),/'\.\/setup-wizard.css\?v=1'/);
});
