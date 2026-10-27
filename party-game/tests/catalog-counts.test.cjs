'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSimulation}=require('../scripts/game-simulation.cjs'),{readDataset}=require('../scripts/content.cjs');
test('installed counts follow the latest editorial general pack and each available theme',()=>{
 const data=readDataset(),latest=new Map();for(const pack of data.packs)if(!latest.has(pack.id)||pack.version>latest.get(pack.id).version)latest.set(pack.id,pack);
 const h=createSimulation(1),counts=JSON.parse(h.eval('JSON.stringify(gameTypeCountSnapshot())'));
 assert.equal(counts.general,new Set(latest.get('general').criteria.cardIds).size);
 let sum=0;for(const entry of counts.themes){const expected=latest.get(entry.pack.id);assert.equal(entry.pack.version,expected.version);assert.equal(new Set(entry.pack.criteria.cardIds).size,new Set(expected.criteria.cardIds).size);if(entry.available&&entry.pack.enabled)sum+=new Set(expected.criteria.cardIds).size;}
 assert.equal(counts.thematic,sum);h.eval('renderGameTypeCounts();renderThemes()');
 assert.equal(h.elements.get('standard-content-count').textContent,counts.general.toLocaleString('ru-RU')+' заданий');
 for(const entry of counts.themes)assert.ok(h.elements.get('theme-list').innerHTML.includes('data-theme="'+entry.pack.id+'"'));
});
function fixture(){
 const elements=new Map(),pack=(id,ids,enabled=true)=>({id,version:1,name:id,enabled,criteria:{cardIds:ids}});
 const general=pack('general',['g1','g2']),a=pack('a',['shared','a']),b=pack('b',['shared','b','b']),soon=pack('soon',['x'],false),unavailable=pack('unavailable',['z']);
 const ctx=vm.createContext({options:{difficulty:'easy'},PARTY_CARDS:[],QUIP_APPROX_QUESTIONS:[],QUIP_CONTENT_PACKS:{'general@1':general},themes:[{pack:a,available:true},{pack:b,available:true},{pack:soon,available:false},{pack:unavailable,available:false}],calls:0,$:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},escapeHTML:String});
 vm.runInContext("function latestGeneralPackSelection(){return {id:'general',version:Math.max(...Object.values(QUIP_CONTENT_PACKS).map(p=>p.version))}};function getContentPack(s){const p=QUIP_CONTENT_PACKS[s.id+'@'+s.version];if(!p)throw Error('Missing catalog');return p};function listThematicPacks(){calls++;return themes}",ctx);
 vm.runInContext(fs.readFileSync(require.resolve('../menu-navigation.js'),'utf8'),ctx);return {ctx,elements,run:s=>vm.runInContext(s,ctx)};
}
test('theme total is a sum of separate volumes, counts shared IDs in both themes and excludes unavailable themes',()=>{
 const h=fixture();assert.equal(h.run('gameTypeCountSnapshot().thematic'),4,'union would incorrectly give 3');
 h.run('renderThemes()');const html=h.elements.get('theme-list').innerHTML;assert.equal((html.match(/>2<\/span>/g)||[]).length,2);assert.equal((html.match(/>Скоро<\/span>/g)||[]).length,2);
});
test('preview cache refreshes for a new catalog version or settings, never scans on clean renders',()=>{
 const h=fixture();h.run('renderGameTypeCounts();renderThemes();renderGameTypeCounts()');assert.equal(h.ctx.calls,1);
 h.run("QUIP_CONTENT_PACKS={...QUIP_CONTENT_PACKS,'general@2':{id:'general',version:2,criteria:{cardIds:['g1','g2','g3','g4']}}};renderGameTypeCounts()");assert.equal(h.run('gameTypeCountSnapshot().general'),4);assert.equal(h.ctx.calls,2);
 h.run("options={difficulty:'hard'};renderGameTypeCounts();renderThemes()");assert.equal(h.ctx.calls,3);
 h.run("options={difficulty:'easy'};renderGameTypeCounts()");assert.equal(h.ctx.calls,3,'prior format/settings projection is reusable');
});
test('missing catalog is described as unavailable without a fabricated zero',()=>{
 const h=fixture();h.run('QUIP_CONTENT_PACKS={};renderGameTypeCounts()');for(const id of ['standard-content-count','thematic-content-count'])assert.equal(h.elements.get(id).textContent,'Количество недоступно');
});
