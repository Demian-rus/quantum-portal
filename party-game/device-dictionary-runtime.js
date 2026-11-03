'use strict';
// The device store participates only in previews and explicitly pinned new parties.
function deviceDictionaryEnvironment(){return {categories:QUIP_EDITORIAL_EDITION.categories,themes:QUIP_EDITORIAL_EDITION.themes,builtins:[...PARTY_CARDS,...QUIP_APPROX_QUESTIONS,{text:'НАШЛА КОСА НА КАМЕНЬ'}]};}
let deviceDictionaryStore=null;
function deviceDictionary(){return deviceDictionaryStore||(deviceDictionaryStore=QuipDeviceDictionary.createStore(localStorage,deviceDictionaryEnvironment()));}
const pinBeforeDeviceDictionary=pinEditorialSelection;
pinEditorialSelection=function(selection){return {...pinBeforeDeviceDictionary(selection),deviceDictionary:deviceDictionary().pin()};};
const categoriesBeforeDeviceDictionary=validateGeneralCategorySelection;
const deviceValidatedSnapshots=new WeakSet();
function validateDeviceSnapshot(snapshot){
 if(!deviceValidatedSnapshots.has(snapshot)){QuipDeviceDictionary.validateSnapshot(snapshot,deviceDictionaryEnvironment());freezeEditorialData(snapshot);deviceValidatedSnapshots.add(snapshot);}return snapshot;
}
validateGeneralCategorySelection=function(selection){
 if(!Object.hasOwn(selection||{},'deviceDictionary'))return categoriesBeforeDeviceDictionary(selection);
 if(!editorialSelection(selection))throw Error('Неизвестная политика пользовательского словаря.');
 validateDeviceSnapshot(selection.deviceDictionary);const {deviceDictionary:ignored,...base}=selection;return categoriesBeforeDeviceDictionary(base);
};
const deviceSnapshotIndices=new WeakMap(),devicePreviewSnapshots=new Map(),devicePoolCache=new WeakMap();
function deviceIndex(snapshot){
 validateDeviceSnapshot(snapshot);if(deviceSnapshotIndices.has(snapshot))return deviceSnapshotIndices.get(snapshot);
 const e=QUIP_EDITORIAL_EDITION,cards=snapshot.cards,mask=(v,n)=>v.reduce((m,x)=>m|2**n.indexOf(x),0),rows=cards.map(QuipDeviceDictionary.row),records={};
 for(let i=0;i<cards.length;i++){const c=cards[i];records[rows[i].id]=[QuipEditorialSelection.FORMS.indexOf(c.type),mask(c.categories,e.categories),mask(c.themes,e.themes),QuipEditorialSelection.STORED_MODES.map(m=>c.modes[m]===null?'0':String(QuipEditorialSelection.TIERS.indexOf(c.modes[m])+1)).join(''),c.language];}
 const catalogs=Object.fromEntries(Object.entries(e.catalogs).map(([theme,p])=>[theme,{...p,ids:rows.filter((r,i)=>theme==='general'||cards[i].themes.includes(theme)).map(r=>r.id)}]));
 const index=QuipEditorialSelection.createIndex({...e,sourceDigest:snapshot.digest,digest:snapshot.digest,catalogs,records},rows);deviceSnapshotIndices.set(snapshot,index);return index;
}
function selectedDeviceSnapshot(selection){
 if(editorialSelection(selection))return selection.deviceDictionary||null; // No live fallback for any existing party.
 const d=deviceDictionary().read();if(!d.enabled||!d.cards.length)return null;
 const key=d.revision;if(!devicePreviewSnapshots.has(key)){devicePreviewSnapshots.clear();devicePreviewSnapshots.set(key,deviceDictionary().pin());}return devicePreviewSnapshots.get(key);
}
const poolBeforeDeviceDictionary=editorialPoolFor;
editorialPoolFor=function(selection,...args){
 const base=poolBeforeDeviceDictionary(selection,...args),snapshot=selectedDeviceSnapshot(selection);if(!snapshot?.cards.length)return base;
 const request=editorialRequest(selection,...args),key=JSON.stringify(request);let pools=devicePoolCache.get(snapshot);if(!pools)devicePoolCache.set(snapshot,pools=new Map());
 if(!pools.has(key)){if(pools.size>=256)pools.delete(pools.keys().next().value);const names=new Set(base.map(r=>QuipDeviceDictionary.normalize(r.text||r.question))),own=deviceIndex(snapshot).pool(request).filter(r=>!names.has(QuipDeviceDictionary.normalize(r.text||r.question)));pools.set(key,Object.freeze([...base,...own]));}return pools.get(key);
};
function editorialRecordForId(match,id){
 if(id.startsWith('user-')||id.startsWith('approx-user-'))return deviceIndex(match.contentPack.deviceDictionary).reference&&(()=>{const c=match.contentPack.deviceDictionary.cards.find(c=>(c.type==='number'?'approx-'+c.id:c.id)===id);if(!c)throw Error('Нет задания в снимке партии');return [QuipEditorialSelection.FORMS.indexOf(c.type),0,0,QuipEditorialSelection.STORED_MODES.map(m=>c.modes[m]===null?'0':String(QuipEditorialSelection.TIERS.indexOf(c.modes[m])+1)).join(''),c.language];})();
 return QUIP_EDITORIAL_EDITION.records[id];
}
