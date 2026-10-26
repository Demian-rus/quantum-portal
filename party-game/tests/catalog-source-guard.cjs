'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process'),api=require('../scripts/content.cjs');
module.exports=function assertHistoricalCatalogBytes(reference){
 const root=path.resolve(__dirname,'../..'),old=name=>execFileSync('git',['show',reference+':party-game/'+name],{cwd:root,encoding:'utf8',maxBuffer:16e6});
 const cardsSource=old('cards.js'),packsSource=old('content-packs.js');
 const read=(source,begin,end)=>{const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);assert.ok(a>=0&&b>a,'Generated array delimiters');return JSON.parse('['+source.slice(a+begin.length,b)+']');};
 const cards=read(cardsSource,'const PARTY_CARDS=Object.freeze([\n','\n].map(card=>'),packs=read(packsSource,'const QUIP_CONTENT_PACKS=defineContentPacks([\n','\n]);');
 const data=api.readDataset();
 assert.deepEqual(data.cards.slice(0,cards.length),cards,'Every historical card and its order remains exact');
 assert.deepEqual(data.packs.slice(0,packs.length),packs,'Every historical pack revision and its order remains exact');
 // Removing only appended data must reconstruct the complete original bytes,
 // including both runtime templates and the reviewed language ledger.
 const rendered=api.render({...data,cards:data.cards.slice(0,cards.length),packs:data.packs.slice(0,packs.length)});
 assert.equal(rendered['cards.js'],cardsSource,'Historical generated cards and all runtime functions remain exact');
 assert.equal(rendered['content-packs.js'],packsSource,'Historical generated catalogs and all runtime functions remain exact');
};
