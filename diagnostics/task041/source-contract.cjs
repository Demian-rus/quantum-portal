'use strict';
// Reverse only exact TASK041 integration hunks. Unknown edits remain visible.
const hunks=require('./reviewed-hunks.json');
function normalizeTask041(source){
 // Reverse only the published v115 resource bump before the reviewed TASK041 hunks.
 source=source.replace('  <link rel="stylesheet" href="./task042-round.css?v=1">\n','')
  .replace('kvip-pwa-v116-20261103-task042a-mobile-rounds','kvip-pwa-v115-20261103-task041-start-render-guard')
  .replace('team-controller.js?v=18','team-controller.js?v=17')
  .replace('kvip-pwa-v115-20261103-task041-start-render-guard','kvip-pwa-v114-20261102-task041-pool-performance');
 for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask041,hunks};
