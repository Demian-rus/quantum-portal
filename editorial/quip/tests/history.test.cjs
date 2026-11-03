'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../editor.cjs'),H=require('../history.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(){const c=E.context(undefined,undefined,{id:'quip',version:1}),e=E.createDraft(c),m={...clone(c.m),editions:[clone(c.spec)],published:{}};m.editions[0].status='published';m.published['quip@1']=E.hash(e);const data=new Map([[m.editions[0].path,e],[m.editions[0].songLanguages.path,require('../baselines/song-languages-v1.json')]]);return {m,data,read:p=>data.get(p)};}
test('history allows an appended draft while retaining published registration and all protected files',()=>{
 const {m,read}=fixture(),next=clone(m);next.editions.push({...clone(next.editions[0]),version:2,status:'draft',path:'editions/quip-v2.json'});
 assert.equal(H.verify(m,next,read,read).preserved,1);
});
test('a lock cannot be bypassed by removing it, replacing its digest or changing the old baseline',()=>{
 const {m,read}=fixture();for(const mutate of [n=>{n.editions=[];n.published={}},n=>{n.published['quip@1']='0'.repeat(64)},n=>{n.editions[0].catalogs[0].version=69},n=>{n.editions[0].songLanguages.sha256='0'.repeat(64)},n=>{n.editions[0].status='draft';n.published={}}]){const next=clone(m);mutate(next);assert.throws(()=>H.verify(m,next,read,read));}
});
test('protected file content is checked independently of the manifest digest',()=>{
 const {m,read}=fixture();assert.throws(()=>H.verify(m,m,read,p=>p.endsWith('quip-v1.json')?{...read(p),version:999}:read(p)),/history changed/);
 assert.throws(()=>H.verify(m,m,read,p=>p.includes('song-languages')?[]:read(p)),/history changed/);
});
test('published catalog definition and pool policy stay frozen when a newer draft is added',()=>{
 const {m,read}=fixture();
 for(const mutate of [s=>{s.catalogs[0].sha256='0'.repeat(64)},s=>{s.poolPolicies.animals.minimum++},s=>{s.poolPolicies.science.allowedModes=['talk']}]){
  const next=clone(m);next.editions.push({...clone(next.editions[0]),version:2,status:'draft',path:'editions/quip-v2.json'});
  mutate(next.editions[0]);assert.throws(()=>H.verify(m,next,read,read),/Published registration changed/);
 }
 const next=clone(m);next.editions.push({...clone(next.editions[0]),version:2,status:'draft',path:'editions/quip-v2.json'});
 next.editions[1].poolPolicies.animals.minimum++;assert.equal(H.verify(m,next,read,read).preserved,1);
});
