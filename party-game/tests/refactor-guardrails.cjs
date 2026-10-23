'use strict';
// Browser contracts across subsystem boundaries. Drive the shipped HTML and UI;
// evaluate only reads snapshots or installs a transparent observation probe.
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
const KEY='iskra-party:v1';
function observe(){
 const probe=window.__quipRefactorProbe={randomCalls:0,writes:[]};
 const originalRandom=Math.random;
 Math.random=function(){probe.randomCalls++;return Reflect.apply(originalRandom,this,arguments);};
 for(const name of ['setItem','removeItem','clear']){
  const original=Storage.prototype[name];
  Storage.prototype[name]=function(key){
   if(this===localStorage&&(name==='clear'||key==='iskra-party:v1'||key==='iskra-party:recovery:v1'))
    probe.writes.push({method:name,key:name==='clear'?null:key});
   return Reflect.apply(original,this,arguments);
  };
 }
}
async function scene(page,name){await page.locator('#scene-'+name).waitFor({state:'visible'});}
async function standard(page){
 await page.locator('#new-game-menu').click();await scene(page,'game-type');
 await page.locator('#standard-game').click();await scene(page,'setup');
}
async function advanced(page){await page.locator('#go-advanced').click();await scene(page,'advanced');}
async function fold(page,id){
 if(!await page.locator('#'+id).evaluate(el=>el.open))await page.locator('#'+id+' > summary').click();
}
async function selection(page,container,values){
 const input=id=>page.locator('#'+container+' input[value="'+id+'"]');
 const toggle=id=>page.locator('#'+container+' label:has(input[value="'+id+'"])').click();
 // Select the desired items first so the UI's nonempty-selection guard stays live.
 for(const id of values)if(!await input(id).isChecked())await toggle(id);
 const ids=await page.locator('#'+container+' input').evaluateAll(nodes=>nodes.map(node=>node.value));
 for(const id of ids)if(!values.includes(id)&&await input(id).isChecked())await toggle(id);
}
async function range(page,id,value){
 const input=page.locator('#'+id),min=Number(await input.getAttribute('min')),step=Number(await input.getAttribute('step'));
 await input.scrollIntoViewIfNeeded();await input.focus();await input.press('Home');
 for(let n=min;n<value;n+=step)await input.press('ArrowRight');
 assert.equal(await input.inputValue(),String(value),id+' must use the actual input handler');
}
async function snapshot(page){
 return page.evaluate(()=>({
  game:JSON.parse(JSON.stringify(game)),memory:JSON.parse(JSON.stringify(taskMemory)),
  options:JSON.parse(JSON.stringify(options)),raw:localStorage.getItem('iskra-party:v1'),
  probe:{randomCalls:window.__quipRefactorProbe.randomCalls,writes:window.__quipRefactorProbe.writes.slice()}
 }));
}
async function resetProbe(page){await page.evaluate(()=>{window.__quipRefactorProbe.randomCalls=0;window.__quipRefactorProbe.writes=[];});}
async function unchangedMatch(page,before,label){
 const after=await snapshot(page),saved=JSON.parse(after.raw);
 assert.deepEqual(after.game,before.game,label+': live match, current round, scores and history');
 assert.deepEqual(after.memory,before.memory,label+': live task archive');
 assert.equal(saved.version,1,label+': root format');
 assert.deepEqual(saved.game,JSON.parse(before.raw).game,label+': persisted match');
 assert.deepEqual(saved.taskMemory,JSON.parse(before.raw).taskMemory,label+': persisted task archive');
 assert.equal(after.probe.randomCalls,0,label+': navigation must not draw another task/mode');
}
async function silence(page){
 await page.locator('#settings-menu').click();await page.locator('#sound-toggle').uncheck();
 await page.locator('#preferences-back').click();await scene(page,'home');
}
async function menuDetour(page){
 await silence(page);await standard(page);
 await page.locator('#team-a').fill('Первый игрок');await page.locator('#team-b').fill('Второй игрок');
 await advanced(page);await page.locator('#toggle-complications').uncheck();
 await fold(page,'mode-settings');await selection(page,'mode-toggles',['talk']);
 await page.locator('#advanced-done').click();await page.locator('#start-game').click();await scene(page,'game');
 // Earn points through the real controls, then select the reply's task.
 await page.locator('[data-action="roll"]').click();
 await page.locator('[data-action="toggle-word"]').waitFor({timeout:6500});
 await page.locator('[data-action="toggle-word"]').click();await page.locator('[data-action="start-timer"]').click();
 await page.locator('[data-action="correct-now"]').click();
 await page.locator('[data-action="roll"]').click();
 await page.locator('[data-action="toggle-word"]').waitFor({timeout:6500});
 const before=await snapshot(page);
 assert.equal(before.game.roundIndex,1);assert.equal(before.game.history.length,1);
 assert.equal(before.game.scores.reduce((a,b)=>a+b,0),1);assert.equal(before.game.phase,'task');
 assert.ok(before.game.current.word);assert.ok(before.game.taskHistory.seen.length>=2);
 await resetProbe(page);await page.locator('#exit-game').click();await scene(page,'home');
 assert.equal((await snapshot(page)).raw,before.raw,'Leaving an idle task must not change saved bytes');
 await page.locator('#settings-menu').click();await scene(page,'preferences');
 await page.locator('#preferences-back').click();
 await unchangedMatch(page,before,'App preferences');
 // App preferences and next-party settings are distinct existing screens.
 await standard(page);
 await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').click();
 await page.locator('#award-policy-choices [data-value="guesser"]').click();
 await advanced(page);await range(page,'base-duration',75);await page.locator('#toggle-complications').check();
 await fold(page,'mode-settings');await selection(page,'mode-toggles',['draw','yesno']);
 await fold(page,'content-settings');await selection(page,'content-toggles',['phrase']);
 await page.locator('#advanced-back').click();await scene(page,'setup');
 await page.locator('#setup-back').click();await scene(page,'game-type');
 await page.locator('#game-type-back').click();await scene(page,'home');
 await unchangedMatch(page,before,'Edited next-party settings');
 assert.notDeepEqual((await snapshot(page)).options,before.options,'The detour must really edit future settings');
 // Thematic Back has a different return target; protect a live match there too.
 await page.locator('#new-game-menu').click();await page.locator('#thematic-game').click();
 await scene(page,'themes');await page.locator('[data-theme="geography"]:enabled').click();await scene(page,'setup');
 await unchangedMatch(page,before,'Selecting a future theme');
 await page.goBack();await scene(page,'themes');
 await page.locator('#themes-back').click();await scene(page,'game-type');
 await page.locator('#game-type-back').click();await scene(page,'home');
 await unchangedMatch(page,before,'Thematic return / Android Back');
 await page.locator('#continue-game').click();await scene(page,'game');
 await unchangedMatch(page,before,'Continue after all detours');
 assert.equal(await page.locator('.challenge-word').textContent(),'НАЖМИ, ЧТОБЫ ОТКРЫТЬ');
}
async function settingsReload(page){
 await silence(page);await standard(page);
 await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').click();
 await page.locator('#award-policy-choices [data-value="guesser"]').click();await advanced(page);
 await range(page,'base-duration',75);await range(page,'target-score',35);
 await range(page,'modifier-chance',65);await page.locator('#toggle-complications').uncheck();
 await page.locator('#toggle-risk').uncheck();
 await fold(page,'mode-settings');await selection(page,'mode-toggles',['talk','yesno','secret']);
 await fold(page,'content-settings');await selection(page,'content-toggles',['word','phrase']);
 await page.locator('#advanced-done').click();
 await page.locator('#award-policy-choices [data-value="setter"]').click();
 const setter=await snapshot(page);
 const expected={difficulty:'hard',duration:75,targetScore:35,promptTypes:['word','phrase'],
  complications:false,modifierChance:65,riskRounds:false,awardTo:'setter',modes:['talk','secret']};
 for(const [field,value]of Object.entries(expected))
  assert.deepEqual(setter.options[field],value,'UI must store the requested '+field);
 assert.equal(setter.options.contentPack.id,'general');
 assert.equal(setter.game,null);
 await page.reload({waitUntil:'load'});await scene(page,'home');
 const restored=await snapshot(page);
 assert.deepEqual(restored.options,setter.options,'Restore the entire nondefault configuration');
 assert.equal(restored.raw,setter.raw,'Normal reload must preserve the exact stored bytes');
 assert.deepEqual(restored.probe.writes,[],'Restore must not rewrite or normalize the saved envelope');
 await standard(page);await advanced(page);await fold(page,'mode-settings');
 const danetki=page.locator('#mode-toggles input[value="yesno"]');
 assert.equal(await danetki.isDisabled(),true);assert.equal(await danetki.isChecked(),false);
 assert.equal(await page.locator('#base-duration').inputValue(),'75');
 assert.equal(await page.locator('#toggle-complications').isChecked(),false);
 assert.equal(await page.locator('#toggle-risk').isChecked(),false);
 await page.locator('#advanced-done').click();
 assert.equal(await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#award-policy-choices [data-value="setter"]').getAttribute('aria-pressed'),'true');
 await page.locator('#award-policy-choices [data-value="guesser"]').click();await advanced(page);await fold(page,'mode-settings');
 assert.equal(await danetki.isDisabled(),false);assert.equal(await danetki.isChecked(),false,'Changing recipient must not silently reselect Danetki');
 await selection(page,'mode-toggles',['talk','yesno','secret']);await page.locator('#advanced-done').click();
 const guesser=await snapshot(page);
 for(const [field,value]of Object.entries({...expected,awardTo:'guesser',modes:['talk','yesno','secret']}))
  assert.deepEqual(guesser.options[field],value,'Explicit recipient/mode change must store '+field);
 await page.reload({waitUntil:'load'});await scene(page,'home');
 const again=await snapshot(page);
 assert.deepEqual(again.options,guesser.options);assert.equal(again.raw,guesser.raw);assert.deepEqual(again.probe.writes,[]);
 await standard(page);await advanced(page);await fold(page,'mode-settings');
 assert.equal(await danetki.isDisabled(),false);assert.equal(await danetki.isChecked(),true);
 await page.locator('#advanced-done').click();await page.locator('#start-game').click();await scene(page,'game');
 const started=await snapshot(page);
 for(const field of ['difficulty','duration','awardTo','modes','promptTypes','complications','modifierChance','riskRounds','targetScore','contentPack'])
  assert.deepEqual(started.game[field],guesser.options[field],'Start uses restored '+field);
 assert.equal(started.game.rulesVersion,5);assert.equal(started.game.modePlannerVersion,1);
 assert.equal(JSON.parse(started.raw).version,1);
}
async function protectedMenus(page,raw){
 // Fixture creation is the only direct write: seed once, then observe a real boot.
 await page.evaluate(raw=>localStorage.setItem('iskra-party:v1',raw),raw);
 await page.reload({waitUntil:'load'});await scene(page,'home');
 assert.equal(await page.locator('#continue-game').isDisabled(),true);
 await page.locator('#settings-menu').click();await page.locator('#preferences-back').click();
 await standard(page);await page.locator('.choices[data-setting="difficulty"] [data-value="hard"]').click();
 await advanced(page);await range(page,'base-duration',75);
 await page.locator('#advanced-back').click();await page.locator('#setup-back').click();
 await page.locator('#game-type-back').click();
 await page.locator('#new-game-menu').click();await page.locator('#thematic-game').click();
 await page.locator('#themes-back').click();await page.locator('#game-type-back').click();
 const state=await snapshot(page);
 assert.equal(state.raw,raw,'Menu transitions must leave unknown/corrupt data byte-for-byte intact');
 assert.deepEqual(state.probe.writes,[],'Protected data must not be set, removed, cleared or silently backed up');
 assert.equal(state.game,null);assert.equal(await page.evaluate(()=>localStorage.getItem('iskra-party:recovery:v1')),null);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [name,run]of [
   ['earned round / preferences / future settings / thematic Back / Continue',menuDetour],
   ['complete nondefault settings / reload / recipient compatibility / Start',settingsReload],
   ['unknown root version / menu write protection',page=>protectedMenus(page,' {"version":99,"game":null} \n')],
   ['corrupt JSON / menu write protection',page=>protectedMenus(page,'{"version":1,"options":')]
  ]){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));await context.addInitScript(observe);
   try{
    await page.goto(URL,{waitUntil:'load'});await scene(page,'home');await run(page);
    assert.deepEqual(errors,[],'Uncaught browser errors: '+name);console.log('TASK011 B PASS:',name);
   }catch(error){error.message=name+': '+error.message;throw error;}
   finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
