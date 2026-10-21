'use strict';
// Test-only browser shell. All selection, planning and scoring functions are loaded
// from the production scripts; no game rules are reimplemented here.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function seededRandom(seed=1){let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}}
function createSimulation(seed=1,existing=new Map()){
 const elements=new Map(),pending=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{id,value:id==='team-a'?'Молнии':id==='team-b'?'Кометы':'',hidden:false,style:{},textContent:'',innerHTML:'',dataset:{},classList:{add(){},remove(){},toggle(){}},parentElement:{classList:{add(){},remove(){},toggle(){}}},children:[],addEventListener(){},setAttribute(){},getAttribute(){return null}});return elements.get(id)};
 const context=vm.createContext({document:{getElementById:element,querySelectorAll(){return []},body:{dataset:{}},addEventListener(){},hidden:false},window:{confirm:()=>true},navigator:{vibrate(){}},localStorage:{getItem:key=>existing.get(key)||null,setItem:(key,value)=>existing.set(key,value)},setInterval:()=>1,clearInterval(){},setTimeout:fn=>{pending.push(fn);return pending.length},clearTimeout(){},Math:Object.assign(Object.create(Math),{random:seededRandom(seed)}),Date,console});
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const match of html.matchAll(/<script src="\.\/([^?"/]+\.js)(?:\?[^" ]*)?" defer><\/script>/g))vm.runInContext(fs.readFileSync(path.join(root,match[1]),'utf8'),context);
 vm.runInContext('soundOn=false',context);
 return {context,elements,storage:existing,eval:source=>vm.runInContext(source,context)};
}
module.exports={createSimulation,seededRandom};
