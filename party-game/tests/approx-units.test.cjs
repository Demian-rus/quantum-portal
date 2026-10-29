'use strict';
const {normalizeTask032}=require('./task032-contract.cjs');
const {withoutRiskDispatch}=require('./selection-source.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs'),{auditApproxUnits}=require('../scripts/approx-unit-audit.cjs');
const parent='2872a233f97d70f84c5989eee653a233a72b7b44',root=path.resolve(__dirname,'..');
test('approx units: every active/historical source is audited; all 37 empty units are explicit legacy counts',()=>{
 const a=auditApproxUnits();assert.equal(a.total,664);assert.equal(a.withUnit,627);assert.equal(a.empty.length,37);assert.ok(a.empty.every(r=>r.file==='questions/legacy-v1.json'));assert.ok(a.empty.every(r=>/^Скольк[ои]/u.test(r.question)));
 assert.ok(a.files.some(x=>x.path==='questions/approx-games-v1.json'&&x.questions===16));assert.ok(a.manualCandidates.length>0);assert.ok(a.manualCandidates.every(r=>r.unit));
 const report=JSON.parse(fs.readFileSync(path.join(root,'APPROX-UNIT-AUDIT.json')));assert.deepEqual(a,report);
});
test('approx units: all 664 snapshots render their own unit before the answer in both renderers, with no RNG or writes',()=>{
 const h=createSimulation();h.eval("Object.assign(options,{modes:['approx'],dice:false});newGame();game.dice=false;roll();Math.random=()=>{throw Error('RNG')}");
 const raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
 const result=h.eval(`(()=>{let checked=0;for(const q of QUIP_APPROX_QUESTIONS){
  game.current.question=q;game.phase='task';const before=JSON.stringify(game);showApprox();const normal=$('play-content').innerHTML;
  if(JSON.stringify(game)!==before)throw Error('Rendering changed game');
  game.tiebreak={question:q,stage:'question'};const tieBefore=JSON.stringify(game);showTiebreak();const tie=$('play-content').innerHTML;
  if(JSON.stringify(game)!==tieBefore)throw Error('Tie rendering changed game');
  for(const html of [normal,tie]){
   if(html.includes('class="approx-answer"')||html.includes('class="approx-note"'))throw Error('Premature answer '+q.id);
   if(q.unit.trim()){if(!html.includes(approxUnitMarkup(q)))throw Error('Missing saved unit '+q.id);}
   else if(html.includes('class="approx-unit"'))throw Error('Invented unit '+q.id);
  }checked++;
 }return checked;})()`);
 assert.equal(result,664);assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
 assert.ok(!h.eval('approxUnitMarkup({unit:"м",answer:"SECRET_NUMBER"})').includes('SECRET_NUMBER'));
 assert.ok(h.eval('approxUnitMarkup({unit:"<м>"})').includes('&lt;м&gt;'));
});
test('approx units: stored foreign/legacy units and original answers stay authoritative through reveal',()=>{
 const h=createSimulation();h.eval("Object.assign(options,{modes:['approx'],dice:false});newGame();game.dice=false;roll();game.current.question={id:'approx-old-unit',question:'Сколько?',answer:'987654321',unit:'морских миль',note:'Снимок из старой партии'};game.phase='task';showApprox()");
 assert.match(h.elements.get('play-content').innerHTML,/морских миль/);assert.ok(!h.elements.get('play-content').innerHTML.includes('987654321'));
 h.eval('revealApprox()');assert.match(h.elements.get('play-content').innerHTML,/987654321 морских миль/);
 assert.equal(h.eval('game.current.question.unit'),'морских миль');
});
test('approx units: numeric answers and scoring retain exact historical bytes; content catalog is reproducible',()=>{
 const baseline='fd644e77cb66c74c17aa90842eda76a2894466d6';
 const names=['round-selection.js','round-actions.js','profile-backup.js','card-reports.js','rules.js','penalties.js'];
 const questions=execFileSync('git',['ls-tree','-r','--name-only',baseline,'--','party-game/content/questions'],{encoding:'utf8'}).trim().split('\n').map(p=>p.slice('party-game/'.length));
 for(const n of [...names,...questions])assert.deepEqual(n==='round-selection.js'?Buffer.from(withoutRiskDispatch(fs.readFileSync(path.join(root,n),'utf8'))):Buffer.from(normalizeTask032(fs.readFileSync(path.join(root,n),'utf8'))),execFileSync('git',['show',baseline+':party-game/'+n],{maxBuffer:8e6}),n);
 const contentApi=require('../scripts/content.cjs'),generated=contentApi.render(contentApi.readDataset());
 for(const name of ['cards.js','content-packs.js','approx-questions.js'])assert.equal(fs.readFileSync(path.join(root,name),'utf8'),generated[name],name+' reproducible reviewed content');
 const tie=fs.readFileSync(path.join(root,'tiebreak.js'),'utf8');
 assert.ok(tie.includes("(!shown?approxUnitMarkup(tie.question):'')"),'Question phase retains the original measurement unit before answer reveal');
 assert.ok(tie.includes("escapeHTML(tie.question.answer)+' '+escapeHTML(tie.question.unit)"),'Answer retains the same unit');
});
