'use strict';
const {normalizeCatalogNavigation}=require('./catalog-count-contract.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {normalizeWizardModeCopy}=require('./wizard-contract.cjs');
const {normalizeTouchHighlight}=require('../../diagnostics/touch-highlight/source-contract.cjs');
const {createSimulation}=require('../scripts/game-simulation.cjs'),base='c4220005d43e2a86d448466617698b2ed069455a',root=path.resolve(__dirname,'../..');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:12e6});
const assertPublishedCss=css=>assert.ok(normalizeTouchHighlight(css).startsWith(git('show',base+':party-game/style.css')),'Published CSS remains exact prefix, new rules scoped to stable-round');
function start(){const h=createSimulation(12);h.eval("soundOn=false;Math.random=()=>0;Object.assign(options,{modes:['secret'],dice:false,difficulty:'easy',complications:true,modifierChance:100});newGame();game.dice=false;roll()");return h;}
test('TASK024 render-only views keep state, RAW, profiles, source conditions and RNG unchanged',()=>{
 const h=start();
 for(const stage of ['task','opened','countdown','play']){
  h.context.stage=stage;h.eval("game.current.visible=stage!=='task';game.phase=stage==='opened'?'task':stage;game.current.deadline=Date.now()+60000;game.current.remainingMs=60000");
  const before=h.eval('JSON.stringify([game,profileStore,taskMemory])'),raw=h.storage.get('iskra-party:v1');
  h.eval("Math.random=()=>{throw Error('View RNG')};localStorage.setItem=()=>{throw Error('View storage')};if(stage==='countdown')showCountdown();else if(stage==='play')showTimer();else showTask()");
  assert.equal(h.eval('JSON.stringify([game,profileStore,taskMemory])'),before);assert.equal(h.storage.get('iskra-party:v1'),raw);
  const html=h.elements.get('play-content').innerHTML;
  assert.ok(html.indexOf('round-fixed-card')<html.indexOf('round-condition-slot'));assert.ok(html.indexOf('round-condition-slot')<html.indexOf('round-bottom'));
  assert.ok(!html.slice(0,html.indexOf('round-fixed-card')).includes('class="round-condition"'));
  if(stage!=='task'){assert.ok(html.includes('timer-dial'));assert.ok(!html.includes('mode-symbol'));assert.equal((html.match(/data-feedback=/g)||[]).length,2);}
 }
});
test('TASK024 published mechanisms, history and all unrelated runtime scripts remain byte-exact',()=>{
 const html=git('show',base+':party-game/index.html'),allowed=['round-views.js','timer-view.js','round-presentation.js','cards.js','content-packs.js','approx-questions.js'];
 for(const [,name]of html.matchAll(/<script src="\.\/([^?]+\.js)\?/g))if(!allowed.includes(name))assert.equal(name==='mode-config.js'?normalizeWizardModeCopy(normalizeCatalogNavigation(fs.readFileSync(path.join(root,'party-game',name),'utf8'))):normalizeCatalogNavigation(fs.readFileSync(path.join(root,'party-game',name),'utf8')),git('show',base+':party-game/'+name),name);
 const read=n=>fs.readFileSync(path.join(root,'party-game',n),'utf8');const c=require('../scripts/content.cjs');assert.equal(read('approx-questions.js'),c.render(c.readDataset())['approx-questions.js'],'numeric catalog exact generated output');const segment=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
 for(const [name,a,b]of [['round-presentation.js','function showApprox()','function blitzStatus()'],['round-presentation.js','function displayedRoundCondition(','// Independent lower grid row'],['timer-view.js','function updateTimerVisual(','\u0000'],['round-views.js','function showJudge()','\u0000']]){
  const current=read(name),old=git('show',base+':party-game/'+name);
  if(b==='\u0000')assert.equal(current.slice(current.indexOf(a)),old.slice(old.indexOf(a)),a);
  else if(a==='function displayedRoundCondition(')assert.equal(segment(current,a,'// Independent lower grid row'),segment(old,a,'// Keyboard focus'),a);
  else assert.equal(segment(current,a,b),segment(old,a,b),a);
 }
 assertPublishedCss(read('style.css'));
});
test('TASK024 CSS prefix guard rejects unrelated changes after exact tap-highlight normalization',()=>{
 const css=fs.readFileSync(path.join(root,'party-game/style.css'),'utf8');
 for(const mutation of [css.replace('--bg:#0f0b20','--bg:#000000'),css.replace('outline:3px solid var(--lime)','outline:none'),css.replace('box-sizing:border-box','box-sizing:content-box')]){
  assert.notEqual(mutation,css,'negative control must change CSS');
  assert.throws(()=>assertPublishedCss(mutation),assert.AssertionError);
 }
});
test('TASK024 views remain intact with v89 content resource versions and no sync',()=>{
 const html=fs.readFileSync(path.join(root,'party-game/index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'party-game/sw.js'),'utf8');
 const scripts=[...html.matchAll(/<script src="\.\/([^"?]+\.js\?v=\d+)"/g)].map(m=>m[1]);assert.equal(scripts.length,54);for(const name of scripts)assert.ok(sw.includes("'./"+name+"'"),name);
 assert.match(sw,/kvip-pwa-v106-20261030-general-categories-candidate-f/);assert.ok(!html.includes('feedback-sync'));assert.ok(html.includes('cards.js?v=11')&&html.includes('content-packs.js?v=21'));
});
