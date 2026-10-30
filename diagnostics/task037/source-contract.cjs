'use strict';
const {normalizeTouchHighlight}=require('../touch-highlight/source-contract.cjs');
const hunks=require('./reviewed-hunks.json');
function normalizeTask037(source){source=normalizeTouchHighlight(source);for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask037,hunks};
