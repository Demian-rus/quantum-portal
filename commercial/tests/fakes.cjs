'use strict';
// Synthetic, in-memory test adapters. No credentials, real accounts or content.
const assert=require('node:assert/strict');
function fakeStore(accounts){const grants=new Map(),events=[];return {events,async account(id){return structuredClone(accounts.find(a=>a.id===id)||null);},async grants(id){return [...grants.values()].filter(g=>g.accountId===id).map(g=>structuredClone(g));},async grantOnce(g,event){if(grants.has(g.id)){assert.deepEqual(grants.get(g.id),g,'Conflicting idempotency key');return false;}grants.set(g.id,structuredClone(g));events.push(structuredClone(event));return true;}};}
const pack={id:'fictional-moon',version:1,access:'paid',entitlement:'fictional-moon',delivery:'protected-server',minClientVersion:'1.0.0'};
module.exports={fakeStore,pack};
