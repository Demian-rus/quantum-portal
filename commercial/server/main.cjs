'use strict';
// Inert by default: no authentication provider, database or paid material.
// Binding is loopback unless inside the explicitly selected future container.
const http=require('node:http');
const {createService}=require('./service.cjs');
if(require.main===module){
 const host=process.env.QUIP_STUB_HOST||'127.0.0.1',port=Number(process.env.QUIP_STUB_PORT||8787);
 if(!['127.0.0.1','0.0.0.0'].includes(host)||!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid stub configuration');
 const service=createService({catalog:{schemaVersion:1,packs:[]}});
 http.createServer(service.handle).listen(port,host,()=>console.log('Local scaffold only; auth, payments and paid delivery disabled'));
}
