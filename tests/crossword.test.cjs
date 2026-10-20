'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function dictionary() {
  const logs = {groupCollapsed(){},groupEnd(){},log(){},warn(){},error(){}};
  const context = vm.createContext({console:logs});
  vm.runInContext(read('db.js'),context);
  return vm.runInContext('DB',context);
}
function engine(variant) {
  const listeners = {};
  const noop=()=>{};
  const cv={
    style:{}, width:0,height:0,
    addEventListener(event,fn){listeners[event]=fn;},
    getBoundingClientRect(){return {left:0,top:0,width:340,height:340*this.height/this.width};},
    getContext(){return new Proxy({}, {get(){return noop;}});}
  };
  const elements={
    cv,'cw-variant':{value:variant},'active-q-panel':{style:{},textContent:''}
  };
  const doc={getElementById(id){return elements[id]||{value:variant,style:{},classList:{add(){},remove(){}},scrollIntoView(){},addEventListener(){}};},
    addEventListener(){},querySelectorAll(){return [];}};
  const win={devicePixelRatio:2,addEventListener(){}};
  const ctx=vm.createContext({document:doc,window:win});
  vm.runInContext(read('crossword.js'),ctx);
  return {ctx,listeners,canvas:cv};
}

test('dictionary has no duplicate normalized words, including across subjects',()=>{
  const DB=dictionary(),seen=new Set();
  let count=0;
  for(const subject of ['физика','математика'])
    for(const level of ['легкий','средний','сложный'])
      for(const item of DB[subject][level]){
        assert.match(item.w,/^[А-Я]+$/);
        assert.ok(!seen.has(item.w), 'Duplicate '+item.w);
        seen.add(item.w);
        assert.ok(item.q.trim().length>5);
        count++;
      }
  assert.ok(count>=1080,'Vocabulary lost terms');
});

for(const variant of ['free','square','diamond','cross']) {
  test(variant+' geometry: intersecting unique words, compact bounds, consistent hit testing',()=>{
    const DB=dictionary();
    const {ctx,listeners,canvas}=engine(variant);
    const pool=ctx.cwUniquePool([...DB.физика.легкий,...DB.математика.легкий]);
    for(let round=0;round<3;round++){
      const result=ctx.buildBest(pool,5);
      const grid=result.g, placed=result.placed;
      assert.ok(placed.length>=10,'Sparse crossword: '+placed.length);
      assert.equal(placed.length,new Set(placed.map(p=>p.w)).size,'Repeated word in puzzle');
      const mask=ctx.cwMask(variant);
      for(const word of placed)for(let i=0;i<word.w.length;i++){
        const r=word.r+(word.dir==='V'?i:0);
        const c=word.c+(word.dir==='H'?i:0);
        assert.equal(grid[r][c],word.w[i],'Mismatching crossings');
        assert.equal(mask[r][c],true,'Outside selected geometry');
      }
      const b=ctx.cwBounds(placed),frame=ctx.cwFrame(grid,variant);
      assert.ok(Math.max(b.height,b.width)/Math.min(b.height,b.width)<=1.6,'Long strip generated');
      if(variant==='square')assert.equal(frame.rows,frame.cols,'Non-square square mode');
      ctx.window.lastG=grid;ctx.window.lastPlaced=placed;
      vm.runInContext('cwShape='+JSON.stringify(variant),ctx);
      vm.runInContext('userGrid=Array.from({length:N},()=>Array(N).fill(""))',ctx);
      ctx.drawCrossword(grid,placed);
      assert.ok(canvas.width>200&&canvas.height>200);
      const word=placed[0],r=word.r,c=word.c;
      const logical=vm.runInContext('cwLayout',ctx);
      const rect=canvas.getBoundingClientRect();
      listeners.pointerdown({target:canvas,
        clientX:(logical.pad+(c-logical.c0+.5)*logical.cell)*rect.width/logical.width,
        clientY:(logical.pad+(r-logical.r0+.5)*logical.cell)*rect.height/logical.height});
      assert.equal(vm.runInContext('activeR',ctx),r,'Click selected wrong row');
      assert.equal(vm.runInContext('activeC',ctx),c,'Click selected wrong column');
    }
  });
}
