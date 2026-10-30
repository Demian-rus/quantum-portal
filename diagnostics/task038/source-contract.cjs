'use strict';
const manifest=require('../../party-game/content/manifest.json'),hunks=require('./reviewed-hunks.json');
const placeholder='const QUIP_GENERAL_CATEGORY_LABELS=Object.freeze(/* general-category-labels */{});';
const generated='const QUIP_GENERAL_CATEGORY_LABELS=Object.freeze('+JSON.stringify(Object.fromEntries(manifest.categories.map(({id,name})=>[id,name])))+');';
// Only the exact build-time mapping from the validated manifest is data. A
// changed runtime label without its source, or any code change, stays visible.
function canonicalizeMetadata(source){return source.replace(generated,placeholder);}
function normalizeTask038(source){source=canonicalizeMetadata(source);for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask038,canonicalizeMetadata,hunks};
