'use strict';
const hunks=require('./reviewed-hunks.json');
function normalizeTask042(source){source=require('./source-contract-b.cjs').normalizeTask042B(source);for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask042,hunks};
