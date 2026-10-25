'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs'),{auditConditions}=require('../scripts/condition-audit.cjs');
const root=path.resolve(__dirname,'..'),baseline='363b9aa1e33f47f5484d438d6fc49f57c7c12c0a';
test('TASK021: full V1/V2 audit; all ten alternatives and other caveats are display-only exact aliases',()=>{
 const audit=auditConditions(),v1=audit.rows.filter(r=>r.version===1),v2=audit.rows.filter(r=>r.version===2);
 assert.equal(v1.length,112);assert.equal(v2.length,51);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'CONDITION-AUDIT.json'))),audit);
 assert.ok(v1.every(r=>r.source===r.display));
 const sources=JSON.parse(fs.readFileSync(path.join(root,'content/modifiers/v2.json'))),alternatives=sources.filter(r=>r.alternative);assert.equal(alternatives.length,10);
 const h=createSimulation(),raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
 h.eval("Math.random=()=>{throw Error('Presentation consumed RNG')}");
 for(const row of v2){
  assert.ok(!/(физически недоступно|удобн|безопасн|задерживай дыхание|без усилия|не кричи|можно показывать сидя)/iu.test(row.display),row.id);
  h.context.snapshot={modifierVersion:2,complicationId:row.id,complication:row.source};
  assert.equal(h.eval('displayedRoundCondition(snapshot)'),row.display);
  h.eval('game={current:snapshot}');const before=h.eval('JSON.stringify(game)');const html=h.eval('roundConditionMarkup()');
  assert.ok(html.includes(row.display));assert.equal(h.eval('JSON.stringify(game)'),before);
  assert.ok(!/(физически недоступно|удобн|безопасн|задерживай дыхание)/iu.test(html),row.id+' tooltip/aria/visible');
  assert.equal(h.eval('displayedRoundCondition({...snapshot,complication:"Мой исторический текст. Если это физически недоступно — другое правило."})'),'Мой исторический текст. Если это физически недоступно — другое правило.');
 }
 for(const row of alternatives){
  h.context.snapshot={modifierVersion:2,complicationId:row.id,complication:row.text};
  assert.equal(h.eval('displayedRoundCondition(snapshot)'),v2.find(r=>r.id===row.id).display,'Base-only historical variant '+row.id);
 }
 assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
 // A meaningful second sentence is a rule, never a blanket sentence-strip.
 assert.match(v2.find(r=>r.id==='v2-two-words').display,/Следующую начинай только после/);
 assert.match(v2.find(r=>r.id==='v2-unique-nouns').display,/Другая форма/);
});
test('TASK021: current-round flag is unavailable in every phase; deciding-question and history reports survive',()=>{
 const h=createSimulation();
 for(const phase of ['ready','rolling','task','countdown','play','judge','between','results']){
  h.context.phase=phase;h.eval('game={phase};updateReportFlag()');const b=h.elements.get('report-card');
  assert.equal(b.hidden,true,phase);assert.equal(b.disabled,true,phase);assert.equal(b.tabIndex,-1,phase);
 }
 h.eval('game={phase:"tiebreak"};updateReportFlag()');assert.equal(h.elements.get('report-card').hidden,false);assert.equal(h.elements.get('report-card').disabled,false);
 assert.match(h.eval('reportHistoryButtons({mode:"talk"},0)'),/data-report-history="0"/);
});
test('TASK021: content, RNG, unchanged selection, clock, backup and storage modules are byte-exact from published v83',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'party-game/content'],{encoding:'utf8'}).trim().split('\n');
 for(const name of [...files,...['cards.js','content-packs.js','modifiers.js','modifiers-v2.js','rules.js','penalties.js','round-planner.js','round-selection.js','round-actions.js','timer-controller.js','storage-controller.js','profile-backup.js','card-reports.js','card-feedback.js'].map(n=>'party-game/'+n)]){
  assert.equal(fs.readFileSync(path.join(root,'..',name),'utf8'),execFileSync('git',['show',baseline+':'+name],{encoding:'utf8',maxBuffer:12e6}),name);
 }
});
