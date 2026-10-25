'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const baseline='7f57ee92f9516eba4bd1d87a2275b73800bf2a01',contentHead='87a36561c895aacccf9f1cb05ee9dad48c3d0023',root=path.resolve(__dirname,'../..');
function oldFile(name,ref=baseline){return execFileSync('git',['show',ref+':party-game/'+name],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});}
function catalog(reference=null){
 const ctx=vm.createContext({});
 for(const f of ['cards.js','approx-questions.js','mode-config.js','mode-compatibility.js','rules.js','content-packs.js'])vm.runInContext(reference?oldFile(f,reference):fs.readFileSync(path.join(root,'party-game',f),'utf8'),ctx);
 return {eval:s=>vm.runInContext(s,ctx),context:ctx};
}
const before=catalog(baseline),current=catalog();
const plain=x=>JSON.parse(JSON.stringify(x));
test('v79: exactly 400 additions, all earlier card objects, questions and music survive unchanged',()=>{
 const old=plain(before.eval('PARTY_CARDS')),now=plain(current.eval('PARTY_CARDS')),map=new Map(now.map(c=>[c.id,c])),oldIds=new Set(old.map(c=>c.id));
 for(const card of old)assert.deepEqual(map.get(card.id),card,card.id);
 const fresh=now.filter(c=>!oldIds.has(c.id));assert.equal(fresh.length,450);assert.equal(fresh.filter(c=>c.pack==='science-expansion-v4').length,50);
 assert.deepEqual(Object.fromEntries(['geography-expansion-v1','geography-expansion-v2','science-expansion-v1','science-expansion-v2','science-expansion-v3','idiom-expansion-v1','idiom-expansion-v2'].map(source=>[source,fresh.filter(c=>c.pack===source).length])),{'geography-expansion-v1':50,'geography-expansion-v2':100,'science-expansion-v1':50,'science-expansion-v2':50,'science-expansion-v3':50,'idiom-expansion-v1':50,'idiom-expansion-v2':50});
 assert.deepEqual(now.filter(c=>c.type==='song'),old.filter(c=>c.type==='song'));
 assert.deepEqual(plain(current.eval('QUIP_APPROX_QUESTIONS')),plain(before.eval('QUIP_APPROX_QUESTIONS')));
 for(const f of ['curated-songs.js','content/cards/music-themes-v2.json','content/editorial/music-theme-review.json'])assert.equal(fs.readFileSync(path.join(root,'party-game',f),'utf8'),oldFile(f));
 const oldRegistry=plain(catalog(contentHead).eval('QUIP_CONTENT_PACKS')),newRegistry=plain(current.eval('QUIP_CONTENT_PACKS'));
 for(const key of Object.keys(oldRegistry))assert.deepEqual(newRegistry[key],oldRegistry[key],key+' old catalog preserved');
 const audit=JSON.parse(fs.readFileSync(path.join(root,'party-game/content/editorial/content400-independent-audit-v1.json'),'utf8'));
 assert.equal(audit.records.length,400);
 let normalized=fs.readFileSync(path.join(root,'party-game/cards.js'),'utf8');
 const s4=JSON.parse(fs.readFileSync(path.join(root,'party-game/content/cards/science-expansion-v4.json'),'utf8'));
 const appended=',\n'+s4.map(c=>'  '+JSON.stringify(c)).join(',\n');
 assert.equal(normalized.split(appended).length,2,'Exactly 50 new cards appended');
 normalized=normalized.replace(appended,'');
 for(const change of audit.changes){
  const updated='  '+JSON.stringify(change.after),original='  '+JSON.stringify(change.before);
  assert.equal(normalized.split(updated).length,2,change.id+' must appear once');
  normalized=normalized.replace(updated,original);
 }
 assert.equal(normalized,oldFile('cards.js',contentHead),'Only documented editorial corrections may differ from source PR');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'party-game/content/manifest.json'),'utf8'));
 const oldManifest=JSON.parse(oldFile('content/manifest.json',contentHead));
 assert.deepEqual({...manifest,cards:manifest.cards.filter(s=>s.path!=='cards/science-expansion-v4.json'),packs:manifest.packs.filter(s=>s.path!=='packs/science-expansion-v4.json')},oldManifest);
});
test('v79: every historical catalog and its pools retain exact IDs and ordering; latest counts are pinned',()=>{
 const packs=plain(before.eval('Object.values(QUIP_CONTENT_PACKS)'));
 const selections=[[],['word'],['phrase'],['idiom'],['word','phrase'],['word','idiom'],['phrase','idiom'],['word','phrase','idiom']];
 for(const p of packs){
  assert.deepEqual(plain(current.eval(`getContentPack(${JSON.stringify({id:p.id,version:p.version})})`)),p);
  for(const level of ['easy','medium','hard']){
   for(const kind of ['words','blitz','songs','people'])for(const types of selections){
    const expr=`getPackCardPool(${JSON.stringify({id:p.id,version:p.version})},${JSON.stringify(kind)},${JSON.stringify(level)},${JSON.stringify(types)}).map(c=>c.id)`;
    assert.deepEqual(plain(current.eval(expr)),plain(before.eval(expr)),p.id+'@'+p.version+'/'+kind+'/'+level+'/'+types);
   }
   const expr=`getPackQuestionPool(${JSON.stringify({id:p.id,version:p.version})},${JSON.stringify(level)}).map(q=>q.id)`;
   assert.deepEqual(plain(current.eval(expr)),plain(before.eval(expr)));
  }
 }
 for(const[id,version,count]of [['general',13,5350],['geography',6,406],['science',7,532]])assert.equal(current.eval(`getContentPack({id:'${id}',version:${version}}).criteria.cardIds.length`),count);
});
test('v79: real latest-pack selection reports the new source ID, and new singing parties remain Russian-only',()=>{
 for(const [pack,version]of [['general',14],['geography',6],['science',8]]){
  const h=createSimulation(1);h.context.pack=pack;
  h.eval("Math.random=()=>.999999;options.contentPack=latestContentPackSelection(pack);Object.assign(options,{modes:['talk'],difficulty:'easy',complications:false,dice:false});newGame();game.dice=false;roll()");
  assert.equal(h.eval('game.contentPack.version'),version);
  assert.match(h.eval('PARTY_CARD_BY_ID.get(game.current.cardId).pack'),/expansion-v[1234]$/);
  const raw=h.storage.get('iskra-party:v1'),profiles=h.storage.get('kvip-player-profiles:v1');
  h.eval("Math.random=()=>{throw Error('Reporting must not consume RNG')};saveCardReport(currentReportItem(game),'theme')");
  assert.equal(h.eval('readCardReports().data.items[0].item.cardId'),h.eval('game.current.cardId'));
  assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.storage.get('kvip-player-profiles:v1'),profiles);
 }
 const h=createSimulation();h.eval("Object.assign(options,{modes:['sing'],difficulty:'easy',complications:false,dice:false});newGame();game.dice=false;roll()");
 assert.equal(h.eval('game.songLanguagePolicyVersion'),2);assert.deepEqual(Array.from(h.eval('game.songLanguages')),['ru']);
});

test('v79: untouched runtime scripts remain byte-exact from v78; UI/hold changes are explicit',()=>{
 const html=oldFile('index.html'),scripts=[...html.matchAll(/<script src="\.\/([^?"/]+\.js)/g)].map(m=>m[1]);
 assert.equal(scripts.length,42);
 const uxChanges=['app.js','timer-view.js','timer-controller.js','session-restoration.js','card-reports-view.js','round-presentation.js','tiebreak.js'];
 assert.equal(scripts.filter(f=>!['cards.js','content-packs.js',...uxChanges].includes(f)).length,33);
 for(const f of scripts.filter(f=>!['cards.js','content-packs.js',...uxChanges].includes(f)))assert.equal(fs.readFileSync(path.join(root,'party-game',f),'utf8'),oldFile(f),f);
});
