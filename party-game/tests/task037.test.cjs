'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {normalizeTask037,hunks}=require('../../diagnostics/task037/source-contract.cjs');
const BASE='ac7e2ce49c2c4dd066220b701ce00d801a5664e9',old=f=>execFileSync('git',['show',BASE+':party-game/'+f],{encoding:'utf8',maxBuffer:20e6}),read=f=>fs.readFileSync('party-game/'+f,'utf8');
test('TASK037 permits only reviewed presentation and catalog-cache hunks; every other runtime/data byte remains exact',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'party-game'],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.includes('/tests/')&&!f.includes('/scripts/')&&/\.(js|css|json|webmanifest|html)$/.test(f));
 for(const path of files){const f=path.slice('party-game/'.length);assert.equal(normalizeTask037(read(f)),old(f),f);}
 assert.deepEqual([...new Set(hunks.map(h=>h.file))].sort(),['index.html','setup-wizard.css','setup-wizard.js','sw.js','team-controller.js']);
 for(const h of hunks){assert(h.after);assert.equal(read(h.file).split(h.after).length,2,'unique exact reviewed addition '+h.file);}
});
test('TASK037 normalizer cannot hide unrelated profile, RNG, controller, cache bypass or CSS mutations',()=>{
 for(const f of ['profile-views.js','player-profiles.js','team-controller.js','setup-wizard.js','setup-wizard.css','app.js'])assert.notEqual(normalizeTask037(read(f)+'\n/* unrelated mutation */'),old(f));
 assert.notEqual(normalizeTask037(read('setup-wizard.js').replace('if(args.length>2)','if(false)')),old('setup-wizard.js'));
});
test('TASK037 removes only the example and aligns resource versions without changing SW lifecycle or profile validation',()=>{
 const html=read('index.html'),sw=read('sw.js');assert(!html.includes('Например, ДС'));assert(html.includes('<label for="profile-name">ИМЯ ПРОФИЛЯ</label>'));assert(html.includes('required aria-describedby="profile-name-hint"'));assert(html.includes('До 24 символов'));
 for(const ref of ['setup-wizard.js?v=12','setup-wizard.css?v=8','team-controller.js?v=11']){assert(html.includes('./'+ref));assert(sw.includes("'./"+ref+"'"));}
 assert.equal(sw.slice(sw.indexOf('self.addEventListener')),old('sw.js').slice(old('sw.js').indexOf('self.addEventListener')));
 for(const f of ['profile-views.js','player-profiles.js','style.css','responsive-layout.css'])assert.equal(read(f),old(f));
});
