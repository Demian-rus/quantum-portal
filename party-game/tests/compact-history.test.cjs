'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs'),base='3ff06f50eca48790ed5057e01847b4fdf424089e';
function start(mode='mime',modifier=true){
 const h=createSimulation(22);h.context.mode=mode;h.context.modifier=modifier;
 h.eval(`soundOn=false;chooseStartingTeam=()=>0;Math.random=()=>0;Object.assign(options,{modes:[mode],dice:false,difficulty:'easy',complications:modifier,modifierChance:100,riskRounds:true,finishType:'rounds',rounds:100});newGame();game.dice=false;`);
 return h;
}
function answer(h,yes=true){h.context.yes=yes;h.eval(`roll();if(game.current.modeId==='approx'){revealApprox();awardApprox('both')}else{if(game.current.modeId==='blitz')game.current.blitzCorrect=game.current.blitzRequired;game.phase='judge';recordAnswer(yes)}`);}
test('TASK022 compact 2/3 legal outcomes have meaningful ARIA and no visible labels or full cards by default',()=>{
 for(const [mode,modifier,count]of [['talk',false,2],['mime',true,3]]){
  const h=start(mode,modifier);answer(h);const text=h.eval('reviewedRowsMarkup(game,0,true)');
  assert.equal((text.match(/review-choice--compact/g)||[]).length,count);
  assert.equal((text.match(/aria-pressed="true"/g)||[]).length,1);
  assert.match(text,/data-review-expand="0" aria-expanded="false" aria-controls="review-details-modal-0"/);
  assert.match(text,/data-review-details="0" hidden><\/div>/);assert.doesNotMatch(text,/<h3>|<small>|Загадывал:|class="review-word"/);
  assert.match(text,/aria-label="Ход 1\.[^"]+: Не угадали"/);assert.match(text,/review-choice-icon" aria-hidden="true"/);
 }
});
test('TASK022 expanded detail preserves roles, legal editor, condition, mode, full word and risk without any writes or RNG',()=>{
 const h=start();for(let i=0;i<3;i++)answer(h,i<2);
 const before=h.eval('JSON.stringify([game,profileStore,taskMemory])'),raw=h.storage.get('iskra-party:v1');
 h.eval(`Math.random=()=>{throw Error('View consumed RNG')};localStorage.setItem=()=>{throw Error('View wrote storage')};reviewPresentationFor('modal',0).expanded='2'`);
 const html=h.eval('reviewedRowsMarkup(game,0,true)');assert.match(html,/data-review-expand="2" aria-expanded="true"/);
 assert.equal((html.match(/<h3>/g)||[]).length,1);assert.match(html,/Загадывал:/);assert.match(html,/Отгадывал:/);assert.match(html,/РИСК: штраф/);
 assert.ok(html.includes(h.eval('game.history[2].word')));assert.equal((html.match(/class="review-details"[^>]* data-review-details="2">/g)||[]).length,1);
 assert.equal(h.eval('JSON.stringify([game,profileStore,taskMemory])'),before);assert.equal(h.storage.get('iskra-party:v1'),raw);
 h.eval('reviewPresentationFor("modal",1)');assert.equal(h.eval('reviewPresentation.modal.expanded'),null,'Changing profile collapses details');
});
test('TASK022 special modes use saved outcome summaries and only the real detailed editor',()=>{
 for(const mode of ['blitz','approx']){
  const h=start(mode);answer(h);const compact=h.eval('reviewedRowsMarkup(game,0,true)');
  assert.doesNotMatch(compact,/data-review-choice=/);assert.match(compact,/review-compact-summary/);
  h.eval('reviewPresentationFor("modal",0).expanded="0"');const detail=h.eval('reviewedRowsMarkup(game,0,true)');
  assert.equal((detail.match(/data-review-choice=/g)||[]).length,h.eval('reviewChoices(game.history[0]).length'));
  if(mode==='approx'){assert.match(detail,/Отвечали оба:/);assert.doesNotMatch(detail,/Загадывал:/);assert.match(detail,/Ответ:/);}
  else assert.ok(detail.includes(h.eval('game.history[0].blitzWords.join(" / ")')));
 }
});
test('TASK022 completed and legacy rows remain compact read-only, including original shared awards',()=>{
 const h=start('approx');answer(h);
 for(const editable of [false]){h.context.editable=editable;h.eval('reviewPresentation.modal.expanded=null');assert.doesNotMatch(h.eval('reviewedRowsMarkup(game,0,editable)'),/data-review-choice=/);h.eval('reviewPresentationFor("modal",0).expanded="0"');assert.doesNotMatch(h.eval('reviewedRowsMarkup(game,0,editable)'),/data-review-choice=/);}
 h.eval('delete game.history[0].review');const html=h.eval('reviewedRowsMarkup(game,0,false)');assert.match(html,/Обоим/);assert.match(html,/Отвечали оба:/);assert.doesNotMatch(html,/data-review-choice=/);
});
test('TASK022 102 real shared rounds render no alternative replays or hidden editor buttons',()=>{
 const h=start('approx');h.eval("game.finishType='score';game.targetScore=10000");for(let i=0;i<102;i++)answer(h,false);
 h.eval("replayResultHistory=()=>{throw Error('Collapsed rows replayed alternatives')}");
 const html=h.eval('reviewedRowsMarkup(game,0,true)');assert.equal((html.match(/data-review-turn=/g)||[]).length,102);assert.doesNotMatch(html,/data-review-choice=|<h3>/);
});
test('TASK022 disclosure survives a draft transaction in a supported match without profile identity',()=>{
 const h=start();answer(h);h.eval('delete game.profileMatch;delete game.matchId;persist();$("report-backdrop").hidden=true;openResultHistory(0);reviewPresentationFor("modal",0).expanded="0"');
 h.eval('updateResultHistory(e=>{e.history[0]=changeReviewedOutcome(e.history[0],"failed")})');assert.equal(h.eval('reviewPresentation.modal.expanded'),'0');assert.match(h.elements.get('result-history-rows').innerHTML,/data-review-expand="0" aria-expanded="true"/);
 assert.equal(h.eval('game.history[0].correct'),true);assert.equal(h.eval('game.resultEditor.history[0].review.result.taskSuccess'),false);
});
test('TASK022 completed result screen uses the same read-only list and retains per-card reporting',()=>{
 const h=start('mime');answer(h);answer(h);
 h.eval('game.phase="results";game.reviewConfirmed=true;reviewPresentationFor("results",null).expanded=null');
 const closed=h.eval('reviewedRowsMarkup(game,null,false,"results")');assert.equal((closed.match(/data-review-turn=/g)||[]).length,2);assert.doesNotMatch(closed,/data-review-choice=|data-report-history=/);
 h.eval('reviewPresentationFor("results",null).expanded="0"');const open=h.eval('reviewedRowsMarkup(game,null,false,"results")');assert.match(open,/data-report-history="0"/);assert.doesNotMatch(open,/data-review-choice=/);assert.match(open,/Загадывал:/);
});
test('TASK022 mathematical, storage, risk, catalog and gameplay cores remain exact published bytes',()=>{
 const root=path.resolve(__dirname,'../..'),git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:12e6});
 for(const name of ['result-review.js','risk-planner.js','round-selection.js','round-settlement.js','rules.js','penalties.js','round-planner.js','round-actions.js','timer-controller.js','feedback-clock.js','player-profiles.js','storage-controller.js','session-restoration.js','profile-backup.js','profile-backup-view.js','card-feedback.js','cards.js','content-packs.js'])
  assert.equal(fs.readFileSync(path.join(root,'party-game',name),'utf8'),git(['show',base+':party-game/'+name]),name);
 const old=git(['show',base+':party-game/result-review-view.js']),view=fs.readFileSync(path.join(root,'party-game/result-review-view.js'),'utf8');
 const segment=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
 assert.equal(segment(view,'function closeResultHistory(','function updateResultHistory('),segment(old,'function closeResultHistory(','function updateResultHistory('),'Save/cancel, rollback and profile protocol');
 assert.equal(segment(view,'  const next=reviewCopy(game);\n  if(tab)', '  const scroll=document.querySelector'),segment(old,'  const next=reviewCopy(game);\n  if(tab)', '  const scroll=document.querySelector'),'Pending review transaction');
 const oldMatch=git(['show',base+':party-game/match-views.js']),newMatch=fs.readFileSync(path.join(root,'party-game/match-views.js'),'utf8');
 const withoutHistory=s=>{const a=s.indexOf('function historyMarkup('),b=s.indexOf('\nfunction showResults()',a);assert.ok(a>=0&&b>a);return s.slice(0,a)+s.slice(b)};
 assert.equal(withoutHistory(newMatch).replace("reviewedRowsMarkup(game,null,false,'results')+reviewedTieMarkup(game,null,false,'results')","game.history.map(historyMarkup).join('')"),withoutHistory(oldMatch),'Completed winner/score/navigation view keeps every other byte');
 const css=fs.readFileSync(path.join(root,'party-game/style.css'),'utf8');assert.ok(css.startsWith(git(['show',base+':party-game/style.css'])),'Original gameplay CSS remains an exact prefix');
});
