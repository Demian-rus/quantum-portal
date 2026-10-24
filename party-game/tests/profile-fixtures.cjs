'use strict';
// Explicit test data for pre-profile gameplay regression suites. Production boot
// never creates profiles. Profile lifecycle itself is covered through the UI.
async function provisionProfiles(page){
  await page.evaluate(()=>{
    if(typeof createPlayerProfile!=='function')return;
    if(!profileStore){createPlayerProfile('Молнии','coral');createPlayerProfile('Кометы','cyan');}
    if(!selectedPlayerProfiles())selectedProfileIds=profileStore.profiles.slice(0,2).map(p=>p.id);
    renderOptions();
  });
}
async function chooseNamedProfile(page,slot,name,color='violet'){
  await page.locator(slot===0?'#team-a':'#team-b').click();
  const existing=page.locator('#profile-list [data-profile-id]').filter({hasText:name});
  if(await existing.count()){await existing.first().click();return;}
  await page.locator('#profile-create-open').click();
  await page.locator('#profile-name').fill(name);
  await page.locator('[data-profile-color="'+color+'"]').click();
  await page.locator('#profile-create-save').click();
}
module.exports={provisionProfiles,chooseNamedProfile};
