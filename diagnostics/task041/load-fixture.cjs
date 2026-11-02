'use strict';
// Synthetic capacity fixture only; never writes authoring sources or shipped IDs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),E=require('../../editorial/quip/editor.cjs');
function extendEdition(root,data,pack,extra){
 const file=path.join(root,'party-game/editorial-edition.js'),source=fs.readFileSync(file,'utf8');
 const edition=JSON.parse(vm.runInNewContext(source+'\nJSON.stringify(QUIP_EDITORIAL_EDITION)'));
 const versions=JSON.parse(vm.runInNewContext(source+'\nJSON.stringify(QUIP_EDITORIAL_PACK_VERSIONS)'));
 const templates=data.cards.filter(row=>row.type==='word'&&edition.records[row.id]?.[0]===0);
 for(let n=0;n<extra.length;n++)edition.records[extra[n].id]=edition.records[templates[n%templates.length].id].slice();
 edition.catalogs.general.ids=pack.criteria.cardIds.slice();versions.general=pack.version;
 const universe=new Set(Object.values(edition.catalogs).flatMap(p=>p.ids));
 edition.records=Object.fromEntries(Object.entries(edition.records).filter(([id])=>universe.has(id)));
 delete edition.digest;edition.digest=E.hash(edition);
 const next=source.replace(/const QUIP_EDITORIAL_EDITION=freezeEditorialData\([^\n]+\);/, 'const QUIP_EDITORIAL_EDITION=freezeEditorialData('+JSON.stringify(edition)+');').replace(/const QUIP_EDITORIAL_PACK_VERSIONS=Object.freeze\([^\n]+\);/,'const QUIP_EDITORIAL_PACK_VERSIONS=Object.freeze('+JSON.stringify(versions)+');');
 if(next===source)throw Error('Synthetic edition was not installed');fs.writeFileSync(file,next);
}
module.exports={extendEdition};
