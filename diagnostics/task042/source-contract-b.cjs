'use strict';
const hunks=require('./reviewed-b-hunks.json');
function normalizeTask042B(source){for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask042B,hunks};
