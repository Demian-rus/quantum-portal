'use strict';
// Test navigation through the shipped UI, never enable a hidden legacy route.
// Historical SW fixtures without the adapter retain their exact old controls.
async function wizard(p){return await p.locator('#scene-wizard').count()>0;}
async function setupStep(p,n){
 if(await wizard(p))await p.locator('[data-wizard-step="'+n+'"]').click();
}
async function setupRules(p){
 if(await wizard(p)){
  await setupStep(p,3);
  if(!await p.locator('#wizard-extra').evaluate(n=>n.open))await p.locator('#wizard-extra > summary').click();
 }else await p.locator('#go-advanced').click();
}
async function setupPlayers(p){if(await wizard(p))await setupStep(p,2);else await p.locator('#advanced-done').click();}
async function startFromSetup(p){await setupStep(p,4);await p.locator('#start-game').click();}
async function setupBack(p,id){await p.locator(await wizard(p)?'#wizard-back':'#'+id).click();}
async function setupFold(p,id){
 if(await wizard(p)){
  if(id==='content-settings'&&!await p.locator('#wizard-extra').evaluate(n=>n.open))await p.locator('#wizard-extra > summary').click();
 }else if(!await p.locator('#'+id).evaluate(n=>n.open))await p.locator('#'+id+' > summary').click();
}
async function modeCenter(p,id='sing'){
 if(await wizard(p)){await setupStep(p,3);await p.locator('#wizard-mode-settings').click();}
 else{if(!await p.locator('#scene-advanced').isVisible())await setupRules(p);await setupFold(p,'mode-settings');await p.locator('[data-mode-settings="'+id+'"]').click();}
}
async function closeModeCenter(p){await p.locator(await wizard(p)?'#wizard-rules-done':'#mode-options-done').click();}
module.exports={setupStep,setupRules,setupPlayers,startFromSetup,setupBack,setupFold,modeCenter,closeModeCenter};
