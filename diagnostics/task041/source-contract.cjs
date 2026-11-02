'use strict';
// Reverse only exact TASK041 integration hunks. Unknown edits remain visible.
const hunks=require('./reviewed-hunks.json');
function normalizeTask041(source){for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask041,hunks};
