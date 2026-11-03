'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),E=require('./editor.cjs');
const ROOT=path.resolve(__dirname,'../..'),PREFIX='editorial/quip/';
function verify(previous,next,readPrevious,readNext){
 E.validateManifest(next);if(!previous)return {ok:true,preserved:0};
 if(previous.schemaVersion!==1||previous.rubric!=='quip-rubric@1'||!previous.published||!Array.isArray(previous.editions))throw Error('Unknown previous manifest');
 // Unpublished drafts may evolve during this PR. No historical lock existed in
 // the first draft format; a future/unknown schema is still never accepted.
 if(!Object.keys(previous.published).length&&!previous.editions.some(e=>e.status==='published'))return {ok:true,preserved:0};
 E.validateManifest(previous);let preserved=0;
 for(const old of previous.editions.filter(e=>e.status==='published')){
  const key=old.id+'@'+old.version,current=next.editions.find(e=>e.id===old.id&&e.version===old.version);
  if(!current||E.hash(current)!==E.hash(old)||next.published[key]!==previous.published[key])throw Error('Published registration changed '+key);
  for(const [relative,digest]of [[old.path,previous.published[key]],[old.songLanguages.path,old.songLanguages.sha256]]){
   const before=readPrevious(relative),after=readNext(relative);if(E.hash(before)!==digest||E.hash(after)!==digest)throw Error('Published history changed '+relative);
  }
  preserved++;
 }
 return {ok:true,preserved};
}
function run(argv=process.argv.slice(2)){
 const base=argv[0];if(! /^[a-f0-9]{40}$/.test(base||''))throw Error('A full base commit SHA is required');
 const git=args=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
 if(git(['rev-parse','--verify',base+'^{commit}'])!==base)throw Error('Unknown base commit');
 const tracked=git(['ls-tree','--name-only',base,'--',PREFIX+'manifest.json']);
 const previous=tracked?JSON.parse(git(['show',base+':'+PREFIX+'manifest.json'])):null;
 const next=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
 const readNext=relative=>JSON.parse(fs.readFileSync(path.join(__dirname,relative),'utf8'));
 const result=verify(previous,next,relative=>JSON.parse(git(['show',base+':'+PREFIX+relative])),readNext);
 for(const spec of next.editions){const c=E.context(undefined,next,spec);E.validate(E.readEdition(c),c,{release:spec.status==='published'});}
 console.log(JSON.stringify(result));
}
module.exports={verify,run};
if(require.main===module)try{run()}catch(e){console.error(e.message);process.exitCode=1;}
