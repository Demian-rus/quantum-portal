'use strict';
// Versioned editorial text overlay. Historical sources and unmarked saves stay exact.
const QUIP_PROMPT_REVISIONS=Object.freeze({1:Object.freeze({'idiom-000083':Object.freeze({before:'НАЙТИ КОСА НА КАМЕНЬ',after:'НАШЛА КОСА НА КАМЕНЬ'})})});
const categoryBeforePromptRevision=validateGeneralCategorySelection;
validateGeneralCategorySelection=function(selection){
 if(!Object.hasOwn(selection||{},'promptRevisionVersion'))return categoryBeforePromptRevision(selection);
 if(!editorialSelection(selection)||!Object.hasOwn(QUIP_PROMPT_REVISIONS,selection.promptRevisionVersion))throw Error('Неизвестная версия редакторских замен. Сохранение защищено.');
 const {promptRevisionVersion,...base}=selection;return categoryBeforePromptRevision(base);
};
const pinBeforePromptRevision=pinEditorialSelection;
pinEditorialSelection=function(selection){return {...pinBeforePromptRevision(selection),promptRevisionVersion:1};};
const poolBeforePromptRevision=editorialPoolFor,revisionPools=new Map();
let revisedPromptIndex=null;
function promptRevisionIndex(){
 if(!revisedPromptIndex){
  const e=QUIP_EDITORIAL_EDITION,id='idiom-000083',source=PARTY_CARDS.find(row=>row.id===id),edit=QUIP_PROMPT_REVISIONS[1][id];
  if(source.text!==edit.before)throw Error('Редакторская замена не соответствует источнику.');
  // A reviewed replacement resolves source-defect; independent modes use quip@1.
  const tuple=e.records[id].slice();tuple[3]='2330000';
  const catalogs=Object.fromEntries(Object.entries(e.catalogs).map(([name,p])=>[name,{...p,ids:p.ids.includes(id)?[id]:[]} ]));
  revisedPromptIndex=QuipEditorialSelection.createIndex({...e,catalogs,records:{[id]:tuple}},[{...source,text:edit.after}]);
 }
 return revisedPromptIndex;
}
editorialPoolFor=function(selection,...args){
 const pool=poolBeforePromptRevision(selection,...args),version=selection?.promptRevisionVersion;
 if(version===undefined)return pool;
 if(!QUIP_PROMPT_REVISIONS[version])throw Error('Неизвестная версия редакторских замен.');
 const request=editorialRequest(selection,...args),key=JSON.stringify([version,request]);
 if(!revisionPools.has(key)){
  if(revisionPools.size>=256)revisionPools.delete(revisionPools.keys().next().value);
  const ids=QUIP_PROMPT_REVISIONS[version];revisionPools.set(key,Object.freeze([...pool.filter(row=>!Object.hasOwn(ids,row.id)),...promptRevisionIndex().pool(request)]));
 }
 return revisionPools.get(key);
};
