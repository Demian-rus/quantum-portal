'use strict';
const {withoutRiskDispatch}=require('./selection-source.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base='fd644e77cb66c74c17aa90842eda76a2894466d6';
const git=a=>cp.execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:12000000});
test('feature-only release leaves all card and catalog files untouched',()=>{
 const files=git(['diff','--name-only',base,'HEAD','--','party-game/content','party-game/cards.js','party-game/content-packs.js','party-game/approx-questions.js','party-game/curated-words.js','party-game/curated-songs.js','party-game/curated-people.js','party-game/words.js','party-game/extra-words.js']);
 assert.equal(files.trim(),'');
 for(const name of ['rules.js','penalties.js','round-planner.js','round-selection.js','profile-backup.js']){
  const file='party-game/'+name;assert.equal((name==='round-selection.js'?withoutRiskDispatch(fs.readFileSync(path.join(root,file),'utf8')):fs.readFileSync(path.join(root,file),'utf8')),git(['show',base+':'+file]));
 }
});
test('48 scripts match service-worker precache and old content URLs',()=>{
 const html=fs.readFileSync(path.join(root,'party-game/index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'party-game/sw.js'),'utf8');
 const scripts=[...html.matchAll(/<script src="\.\/([^?"/]+\.js)\?v=(\d+)"/g)].map(x=>'./'+x[1]+'?v='+x[2]);
 assert.equal(scripts.length,48);for(const s of scripts)assert.ok(sw.includes("'"+s+"'"),s);
 assert.match(sw,/kvip-pwa-v86-20261025-risk-balance-candidate/);
 for(const x of ['cards.js?v=8','content-packs.js?v=16']){assert.ok(html.includes(x));assert.ok(sw.includes(x));}
});
