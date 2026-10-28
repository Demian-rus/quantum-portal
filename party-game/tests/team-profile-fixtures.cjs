'use strict';
// Persistent fixture identities use the production profile API. The current
// selectors still perform real trusted clicks and native START validation.
async function provisionTeamProfiles(page,names=['ДС','ПА','Мама','Папа']){
 await page.evaluate(names=>{for(const [i,name]of names.entries())if(!profileStore?.profiles.some(p=>p.name===name))createPlayerProfile(name,['coral','cyan','violet','green'][i%4]);renderOptions();},names.flat());
}
async function chooseTeamProfiles(page,names=[['ДС','ПА'],['Мама','Папа']]){
 for(let t=0;t<2;t++)for(let p=0;p<2;p++){
  await page.locator('#team-profile-'+t+'-'+p).tap();
  const id=await page.evaluate(name=>profileStore.profiles.find(p=>p.name===name).id,names[t][p]);
  await page.locator('[data-profile-id="'+id+'"]').tap();
 }
}
async function duplicateTeamProfileRejected(page){
 const before=await page.locator('#team-profile-1-1').textContent();await page.locator('#team-profile-1-1').tap();
 const id=await page.evaluate(()=>profileStore.profiles.find(p=>p.name==='ДС').id);
 const button=page.locator('[data-profile-id="'+id+'"]');if(!await button.isDisabled())throw Error('Repeated team profile must be disabled');
 const rejected=await page.evaluate(id=>QuipTeams.chooseProfile({format:'teams-2x2',slot:3},id),id);if(rejected)throw Error('Team identity guard accepted duplicate');
 await page.locator('#profile-close').tap();if(await page.locator('#team-profile-1-1').textContent()!==before)throw Error('Rejected choice changed team slot');
}
module.exports={provisionTeamProfiles,chooseTeamProfiles,duplicateTeamProfileRejected};
