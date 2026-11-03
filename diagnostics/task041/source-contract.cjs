'use strict';
// Reverse only exact TASK041 integration hunks. Unknown edits remain visible.
const hunks=require('./reviewed-hunks.json');
function normalizeTask041(source){
 source=require('../task042/source-contract.cjs').normalizeTask042(source);
 source=normalizeTask041Release(source);
 for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
function normalizeTask041Release(source){
 source=source.replace('team-controller.js?v=18','team-controller.js?v=17').replace('kvip-pwa-v115-20261103-task041-start-render-guard','kvip-pwa-v114-20261102-task041-pool-performance');
 source=source.replace("   // The success path paints after durability is confirmed. Do not render\n   // the uncommitted game and then render the same state a second time.\n   game=proposal.game;taskMemory=proposal.taskMemory;options=proposal.options;s.inSetup=false;document.body.classList.add('teams-active');persist();sfx('go');","   game=proposal.game;taskMemory=proposal.taskMemory;options=proposal.options;s.inSetup=false;document.body.classList.add('teams-active');persist();sfx('go');render();");
 return source;
}
module.exports={normalizeTask041,normalizeTask041Release,hunks};
