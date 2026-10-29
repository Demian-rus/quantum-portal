'use strict';
// Reverse only explicit approved hunks. Unknown edits remain visible to byte guards.
const hunks=require('./reviewed-hunks.json');
function normalizeTask035(source){for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask035,hunks};
