'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base='fd644e77cb66c74c17aa90842eda76a2894466d6';
const git=a=>cp.execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:12000000});
test('original v85 runtime untouched; content-only additions are explicitly versioned',()=>{
 const changed=git(['diff','--name-only',base,'HEAD','--','party-game/content','party-game/cards.js','party-game/content-packs.js','party-game/approx-questions.js','party-game/curated-words.js','party-game/curated-songs.js','party-game/curated-people.js','party-game/words.js','party-game/extra-words.js']).trim().split('\n').filter(Boolean);
 const manifest=require('../content/manifest.json');
 const editorial=['geography-expansion-v1-review.md','geography-expansion-v2-review.md','science-expansion-v1-review.md','science-expansion-v2-review.md','science-expansion-v3-review.md','idiom-expansion-v1-review.md','idiom-expansion-v2-review.md','science-expansion-v4-review.md','general-expansion-v2-review.md','general-diversity-v1-review.md','general-diversity-v2-review.md','general-diversity-v3-review.md','general-diversity-v4-review.md','content400-independent-audit-v1.md','content400-independent-audit-v1.json','CONTENTS-ROADMAP-2026.md'];
 const valid=path=>/^(?:cards|packs)\/(?:geography-expansion-v[12]|science-expansion-v[1-4]|idiom-expansion-v[12]|general-expansion-v2|general-diversity-v[1-4])\.json$/.test(path);
 const allowed=new Set(['party-game/cards.js','party-game/content-packs.js','party-game/content/manifest.json','party-game/content/templates/content-packs.after.js',...manifest.cards.filter(e=>valid(e.path)).map(e=>'party-game/content/'+e.path),...manifest.packs.filter(e=>valid(e.path)).map(e=>'party-game/content/'+e.path),...editorial.map(e=>'party-game/content/editorial/'+e)]);
 for(const file of changed)assert.ok(allowed.has(file),'Unapproved content change: '+file);
 const known=git(['ls-tree','-r','--name-only',base,'--','party-game/content']).trim().split('\n').filter(Boolean);
 for(const file of known.filter(f=>!['party-game/content/manifest.json','party-game/content/templates/content-packs.after.js'].includes(f)))assert.equal(fs.readFileSync(path.join(root,file),'utf8'),git(['show',base+':'+file]),file+' preexisting source preserved');
 const api=require('../scripts/content.cjs'),built=api.render(api.readDataset());
 for(const file of ['cards.js','content-packs.js'])assert.equal(fs.readFileSync(path.join(root,'party-game',file),'utf8'),built[file],file+' matches generator');
 for(const name of ['rules.js','penalties.js','round-planner.js','round-selection.js','profile-backup.js']){
  const file='party-game/'+name;assert.equal(fs.readFileSync(path.join(root,file),'utf8'),git(['show',base+':'+file]));
 }
});
test('47 scripts match service-worker precache and old content URLs',()=>{
 const html=fs.readFileSync(path.join(root,'party-game/index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'party-game/sw.js'),'utf8');
 const scripts=[...html.matchAll(/<script src="\.\/([^?"/]+\.js)\?v=(\d+)"/g)].map(x=>'./'+x[1]+'?v='+x[2]);
 assert.equal(scripts.length,47);for(const s of scripts)assert.ok(sw.includes("'"+s+"'"),s);
 assert.match(sw,/kvip-pwa-v85-20261025-result-review-candidate/);
 for(const x of ['cards.js?v=8','content-packs.js?v=16']){assert.ok(html.includes(x));assert.ok(sw.includes(x));}
});
