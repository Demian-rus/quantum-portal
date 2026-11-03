'use strict';
const vm=require('node:vm'),E=require('../../editorial/quip/editor.cjs');
// A custom catalog fixture needs its own explicit matching edition metadata.
function extendFixtureEdition(source,pack){
 const edition=JSON.parse(vm.runInNewContext(source+'\nJSON.stringify(QUIP_EDITORIAL_EDITION)')),versions=JSON.parse(vm.runInNewContext(source+'\nJSON.stringify(QUIP_EDITORIAL_PACK_VERSIONS)'));
 const bit=2**edition.themes.length;edition.themes.push(pack.id);versions[pack.id]=pack.version;
 edition.catalogs[pack.id]={ids:pack.criteria.cardIds.slice(),minimum:pack.minCardsPerPool,allowedModes:['talk','mime','draw','secret','blitz']};
 for(const id of pack.criteria.cardIds)edition.records[id][2]|=bit;
 delete edition.digest;edition.digest=E.hash(edition);
 return source.replace(/const QUIP_EDITORIAL_EDITION=freezeEditorialData\([^\n]+\);/,'const QUIP_EDITORIAL_EDITION=freezeEditorialData('+JSON.stringify(edition)+');').replace(/const QUIP_EDITORIAL_PACK_VERSIONS=Object.freeze\([^\n]+\);/,'const QUIP_EDITORIAL_PACK_VERSIONS=Object.freeze('+JSON.stringify(versions)+');');
}
module.exports={extendFixtureEdition};
