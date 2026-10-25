'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-compact-history';
const modal='#result-history-rows',pending='.pending-review-rows';
const state=p=>p.evaluate(()=>({game:JSON.stringify(game),raw:localStorage.getItem(STORAGE_KEY),profiles:localStorage.getItem(QUIP_PROFILES_KEY),memory:JSON.stringify(taskMemory),risk:JSON.stringify(game.riskPlannerState)}));
async function start(p,mode='mime',modifier=true,rounds=12){
 await p.evaluate(({mode,modifier,rounds})=>{if(!$('result-history-backdrop').hidden)closeResultHistory(false);soundOn=false;chooseStartingTeam=()=>0;let seed=22;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};Object.assign(options,{modes:[mode],awardTo:'setter',dice:false,difficulty:'easy',complications:modifier,modifierChance:100,riskRounds:true,finishType:'rounds',rounds});newGame();game.dice=false;},{mode,modifier,rounds});
}
async function settle(p,yes=true){
 await p.locator('[data-action="roll"]').click();await p.evaluate(()=>{game.phase='judge';render()});await p.locator('[data-action="'+(yes?'yes':'no')+'"]').click();
}
const choice=(p,root,index,value)=>p.locator(root+' [data-review-turn="'+index+'"] .review-compact-controls [data-review-choice="'+value+'"]');
const expand=(p,root,index)=>p.locator(root+' [data-review-expand="'+index+'"]');
async function geometry(p,root,label){
 const g=await p.locator(root).evaluate(el=>{
  const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  return {viewport:{w:innerWidth,h:innerHeight},list:box(el),documentWidth:document.documentElement.scrollWidth,
   rows:[...el.querySelectorAll('.review-compact-bar')].map(row=>({row:box(row),toggle:box(row.querySelector('.review-row-toggle')),buttons:[...row.querySelectorAll('.review-choice')].map(b=>({box:box(b),label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),text:b.textContent.trim(),icon:box(b.firstElementChild),iconFits:b.firstElementChild.scrollWidth<=b.firstElementChild.clientWidth+1,selectedOutline:{style:getComputedStyle(b.firstElementChild).outlineStyle,width:parseFloat(getComputedStyle(b.firstElementChild).outlineWidth)}}))})),
   open:el.querySelectorAll('.review-details:not([hidden])').length,
   labels:[...el.querySelectorAll('.review-details:not([hidden]) .review-choice>span:not(.review-choice-icon),.review-details:not([hidden]) .review-choice small')].map(n=>({client:n.clientWidth,scroll:n.scrollWidth})),nodes:el.querySelectorAll('*').length};
 });
 assert.ok(g.documentWidth<=g.viewport.w+1,label+' horizontal document overflow');assert.ok(g.list.x>=0&&g.list.right<=g.viewport.w+1,label+' list bounds');assert.ok(g.open<=1,label+' one expanded row');
 for(const row of g.rows){
  assert.ok(row.row.x>=g.list.x-1&&row.row.right<=g.list.right+1,label+' row bounds');assert.ok(row.toggle.height>=44&&row.toggle.width>=44,label+' title target');
  let right=row.toggle.right;
  for(const b of row.buttons){assert.ok(b.box.width>=44&&b.box.height>=44,label+' outcome target');assert.ok(right<=b.box.x+.1,label+' overlapping touch targets');right=b.box.right;assert.ok(b.icon.width<=32&&b.icon.height<=32,label+' visual compact circle');assert.ok(b.iconFits,label+' icon fits its circle');if(b.pressed==='true'){assert.equal(b.selectedOutline.style,'solid',label+' selection shape independent of color');assert.ok(b.selectedOutline.width>=2)}assert.ok(b.label?.includes('Ход'),label+' meaningful ARIA');assert.ok(['true','false'].includes(b.pressed));assert.ok(['×','✓−','✓'].includes(b.text),label+' no visible labels');}
 }
 assert.ok(g.labels.every(n=>n.scroll<=n.client+1),label+' expanded editor labels fit');return g;
}
(async()=>{fs.mkdirSync(folder,{recursive:true});const b=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']}),measurements=[];
try{for(const [id,width,height]of [['320',320,568],['360',360,640],['390',390,844],['landscape',844,390]]){
 const ctx=await b.newContext({viewport:{width,height},hasTouch:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(URL);await provisionProfiles(p);
 await start(p);for(let i=0;i<8;i++)await settle(p,i%3!==0);await p.locator('#match-team-a').click();
 assert.equal(await p.locator(modal+' [aria-expanded="true"]').count(),0);assert.equal(await p.locator(modal+' .review-details:not([hidden])').count(),0);
 assert.equal(await p.locator(modal+' [data-review-turn="0"] .review-choice--compact').count(),3);
 const before=await state(p);await p.evaluate(()=>{window.__rng=0;window.__writes=0;const random=Math.random,set=Storage.prototype.setItem;Math.random=()=>{__rng++;return random()};Storage.prototype.setItem=function(...a){__writes++;return set.apply(this,a)}});
 await expand(p,modal,0).focus();await p.keyboard.press('Enter');assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'true');
 assert.ok((await p.locator(modal+' .review-details:not([hidden])').textContent()).includes('Усложнение:'));
 await expand(p,modal,2).click();assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'false');assert.equal(await expand(p,modal,2).getAttribute('aria-expanded'),'true');
 await p.keyboard.press('Space');assert.equal(await expand(p,modal,2).getAttribute('aria-expanded'),'false');assert.deepEqual(await state(p),before);
 assert.deepEqual(await p.evaluate(()=>({rng:__rng,writes:__writes})),{rng:0,writes:0},'Expand/collapse is presentation only');
 await p.screenshot({path:folder+'/'+id+'-compact.png',animations:'disabled'});measurements.push({id,compact:await geometry(p,modal,id)});
 const scores=await p.evaluate(()=>game.scores.slice());await choice(p,modal,0,'complete').click();assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'false');
 await choice(p,modal,0,'base').click();assert.equal(await choice(p,modal,0,'base').getAttribute('aria-pressed'),'true');
 assert.equal(await p.evaluate(()=>game.resultEditor.history[0].review.result.modifierSuccess),false);assert.deepEqual(await p.evaluate(()=>game.scores),scores,'Draft leaves actual score unchanged');
 const expected=await p.evaluate(()=>replayResultHistory(game,game.resultEditor.history,game.resultEditor.tiebreak).scores);
 assert.deepEqual(await p.locator('#result-history-score b').allTextContents(),expected.map(String),'Immediate score preview');
 await expand(p,modal,0).click();await geometry(p,modal,id+' expanded');await p.screenshot({path:folder+'/'+id+'-expanded.png',animations:'disabled'});
 await choice(p,modal,0,'failed').click();assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'true','Compact outcome preserves expanded details');
 await p.locator(modal+' [data-review-turn="0"] .review-details [data-review-choice="complete"]').click();assert.equal(await p.evaluate(()=>document.activeElement.closest('.review-details')!==null),true,'Detailed editor retains focus');
 assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'true','Outcome never toggles expansion');await p.keyboard.press('Escape');assert.deepEqual(await p.evaluate(()=>game.scores),scores);
 await p.locator('#match-team-a').click();assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'false','Fresh panel starts collapsed');
 await choice(p,modal,0,'complete').click();await choice(p,modal,0,'base').click();await p.locator('#result-history-save').click();assert.deepEqual(await p.evaluate(()=>game.scores),expected);
 await p.locator('#match-team-a').click();await p.locator('#result-history-tabs [data-review-tab="1"]').click();assert.equal(await p.locator(modal+' [data-review-turn="1"]').count(),1);assert.equal(await p.locator(modal+' [data-review-turn="0"]').count(),0);
 await p.evaluate(()=>history.back());await p.waitForFunction(()=>$('result-history-backdrop').hidden);assert.equal(await p.evaluate(()=>document.activeElement.id),'match-team-a');
 // Exact saved text must wrap in details without pushing the compact controls.
 await start(p,'talk',false);await settle(p);await p.evaluate(()=>{const text='СВЕРХПРОДОЛЖИТЕЛЬНОЕНЕВЕРОЯТНОЕПРЕВРАЩЕНИЕ — ПЕРЕВОДИТЬ ТЕЛЕФОН В БЕЗЗВУЧНЫЙ РЕЖИМ';game.history[0].word=text;game.history[0].review.round.word=text;persist()});
 await p.locator('#match-team-a').click();assert.equal(await p.locator(modal+' .review-choice--compact').count(),2);await geometry(p,modal,id+' long title');await expand(p,modal,0).click();assert.equal(await p.locator(modal+' .review-word').textContent(),await p.evaluate(()=>game.history[0].word));
 assert.equal(await p.locator(modal+' .review-word').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await p.locator('#result-history-cancel').click();
 // Real Blitz and Approx expose their original legal model only inside details.
 await start(p,'blitz');await p.evaluate(()=>{roll();game.current.blitzCorrect=3;game.phase='judge';recordAnswer(true)});await p.locator('#match-team-a').click();assert.equal(await p.locator(modal+' [data-review-choice]').count(),0);await expand(p,modal,0).click();
 const allowed=await p.evaluate(()=>reviewChoices(game.history[0]));assert.deepEqual(await p.locator(modal+' [data-review-choice]').evaluateAll(nodes=>nodes.map(n=>n.dataset.reviewChoice)),allowed);
 await p.locator(modal+' [data-review-choice="1"]').click();await p.locator('#result-history-save').click();assert.equal(await p.evaluate(()=>game.scores[0]),0);assert.equal(await p.evaluate(()=>game.history[0].review.result.blitzCorrect),1);
 await start(p,'approx',false);await p.evaluate(()=>{roll();revealApprox();awardApprox('none')});await p.locator('#match-team-a').click();assert.equal(await p.locator(modal+' [data-review-choice]').count(),0);await expand(p,modal,0).click();assert.equal(await p.locator(modal+' [data-review-choice]').count(),4);await p.locator(modal+' [data-review-choice="both"]').click();await p.locator('#result-history-save').click();assert.deepEqual(await p.evaluate(()=>game.scores),[1,1]);
 // Draft restart, failed write/readback and UI-only disclosure under quota failure.
 await start(p);await settle(p);await p.locator('#match-team-a').click();await choice(p,modal,0,'base').click();await expand(p,modal,0).click();await p.evaluate(()=>{game.dice=true;options.dice=true;persist()});const draft=await state(p);
 await p.reload();await p.locator('#continue-game').click();assert.deepEqual(await state(p),draft);assert.equal(await expand(p,modal,0).getAttribute('aria-expanded'),'false');assert.equal(await choice(p,modal,0,'base').getAttribute('aria-pressed'),'true');
 for(const fault of ['quota','readback']){
  const protectedState=await state(p);await p.evaluate(fault=>{window.__get=Storage.prototype.getItem;window.__set=Storage.prototype.setItem;let wrote=false,once=true;Storage.prototype.setItem=function(k,v){if(k===STORAGE_KEY){if(fault==='quota')throw Error('quota');wrote=true}return __set.call(this,k,v)};Storage.prototype.getItem=function(k){const value=__get.call(this,k);if(k===STORAGE_KEY&&wrote&&once){once=false;return value+' '}return value};},fault);
  await choice(p,modal,0,'failed').click();assert.deepEqual(await state(p),protectedState,fault+' verified rollback');assert.ok((await p.locator('#result-history-error').textContent()).length>0);await expand(p,modal,0).click();assert.deepEqual(await state(p),protectedState,'Disclosure never writes even under storage failure');await expand(p,modal,0).click();
  await p.evaluate(()=>{Storage.prototype.getItem=__get;Storage.prototype.setItem=__set});
 }
 await p.locator('#result-history-cancel').click();
 // Last deciding result: preview can change winner; stats wait for confirmation.
 await start(p,'talk',false,2);await settle(p,true);await settle(p,false);assert.equal(await p.evaluate(()=>game.phase),'review');
 const statsBefore=await p.evaluate(()=>profileStore.recent.length);await choice(p,pending,0,'failed').click();assert.deepEqual(await p.evaluate(()=>game.scores),[0,0]);await p.locator('.is-result-review [data-review-tab="1"]').click();await choice(p,pending,1,'complete').click();assert.deepEqual(await p.evaluate(()=>game.scores),[0,1]);
 await geometry(p,pending,id+' pending');await p.screenshot({path:folder+'/'+id+'-pending.png',animations:'disabled'});await p.evaluate(()=>{game.dice=true;options.dice=true;persist()});
 await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);const savedPending=await state(p);await ctx.setOffline(true);await p.reload();await p.locator('#continue-game').click();assert.deepEqual(await state(p),savedPending);assert.equal(await p.evaluate(()=>profileStore.recent.length),statsBefore);
 await p.locator('[data-action="confirm-results"]').click();assert.equal(await p.evaluate(()=>profileStore.recent.length),statsBefore+1);const done=await state(p);await p.reload();assert.equal((await state(p)).profiles,done.profiles);await ctx.setOffline(false);
 // Confirmed match: expand saved details but no outcome controls in any row.
 await p.evaluate(()=>{openResultHistory(0)});assert.equal(await p.locator(modal+' [data-review-choice]').count(),0);await expand(p,modal,0).click();assert.equal(await p.locator(modal+' [data-review-choice]').count(),0);await p.locator('#result-history-cancel').click();
 // Actual tie-break and its saved decision use the same expandable list.
 await start(p,'talk',false,20);await p.evaluate(()=>{game.finishType='score';game.targetScore=1;persist()});await settle(p);await settle(p);await p.locator('[data-action="confirm-results"]').click();await p.locator('[data-action="tiebreak-reveal"]').click();await p.locator('[data-action="tiebreak-a"]').click();
 assert.equal(await p.locator(pending+' [data-review-tie]').count(),0);await expand(p,pending,'tie').click();assert.deepEqual(await p.locator(pending+' [data-review-tie]').evaluateAll(n=>n.map(e=>e.dataset.reviewTie)),['a','b','same']);await p.locator(pending+' [data-review-tie="b"]').click();assert.equal(await p.locator(pending+' [data-review-tie="b"]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-action="confirm-results"]').click();assert.equal(await p.evaluate(()=>game.tiebreak.winnerIndex),1);
 // 102 real tasks: lazy details, bounded DOM, no scroll jump after editing last.
 await start(p,'approx',false);await p.evaluate(()=>{game.finishType='score';game.targetScore=10000;for(let i=0;i<102;i++){roll();revealApprox();awardApprox('none')}game.dice=true;options.dice=true;persist()});await p.locator('#match-team-a').click();assert.equal(await p.locator(modal+' [data-review-turn]').count(),102);assert.equal(await p.locator(modal+' [data-review-choice]').count(),0);const large=await geometry(p,modal,id+' 102');assert.ok(large.nodes<1600,'Bounded compact DOM');
 await p.locator(modal).evaluate(el=>el.scrollTop=el.scrollHeight);await p.evaluate(()=>{window.__times=[];const original=toggleReviewedDetails;toggleReviewedDetails=function(...args){const t=performance.now();try{return original(...args)}finally{__times.push(performance.now()-t)}}});await expand(p,modal,101).click();await p.locator(modal+' [data-review-turn="101"] .review-details [data-review-choice="both"]').click();
 const scroll=await p.locator(modal).evaluate(el=>el.scrollTop);await p.locator(modal+' [data-review-turn="101"] .review-details [data-review-choice="none"]').click();assert.ok(Math.abs(await p.locator(modal).evaluate(el=>el.scrollTop)-scroll)<3,'Editing preserves list scroll');assert.equal(await p.evaluate(()=>document.activeElement.dataset.reviewChoice),'none');assert.equal(await p.locator(modal+' .review-details:not([hidden])').count(),1);assert.ok((await p.evaluate(()=>Math.max(...__times)))<1200,'Disclosure responds within bounded time');
 measurements.push({id,largeDOM:large.nodes,toggleMs:await p.evaluate(()=>__times)});await p.screenshot({path:folder+'/'+id+'-102-expanded.png',animations:'disabled'});await p.locator('#result-history-cancel').click();assert.deepEqual(errors,[]);await ctx.close();console.log('TASK022',id,'compact / details / focus / legal modes / winner / rollback / restart / Back / offline / 102 rows PASS');
}}finally{await b.close()}fs.writeFileSync(folder+'/geometry.json',JSON.stringify(measurements,null,2));})().catch(e=>{console.error(e);process.exitCode=1});
