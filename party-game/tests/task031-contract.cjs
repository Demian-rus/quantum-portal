'use strict';
// Exact, reviewed presentation hunks only. Historical engine/data guards still
// compare every byte after reversing these explicit TASK031 UI additions.
const hunks=require('./task031-presentation.json');
const {normalizeTask032}=require('./task032-contract.cjs');
function normalizeTask031(s){
 s=normalizeTask032(s);
 const file=s.includes('(function installSetupWizard(){')?'setup-wizard.js':
  s.startsWith('/* Sole setup presentation.')?'setup-wizard.css':
  s.includes('function renderModeSettings(')?'setup-view.js':null;
 if(file)for(const h of hunks.filter(h=>h.file===file).reverse())s=s.replace(h.after,h.before);
 return s.replaceAll('setup-wizard.js?v=8','setup-wizard.js?v=7').replaceAll('setup-wizard.css?v=4','setup-wizard.css?v=3').replaceAll('setup-view.js?v=5','setup-view.js?v=4').replace('kvip-pwa-v96-20261027-wizard-polish-candidate','kvip-pwa-v95-20261027-teams-counts-ready-candidate');
}
module.exports={normalizeTask031};
