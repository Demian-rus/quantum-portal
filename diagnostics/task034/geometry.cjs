'use strict';
function intersection(a,b){const width=Math.min(a.right,b.right)-Math.max(a.x,b.x),height=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);return width>0&&height>0?{width,height,area:width*height}:null;}
// Executed in the real browser. Bounding rects are clipped by actual viewport
// and overflow ancestors; offscreen content in a scroll region is not a clash.
function collect(){
 const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const live=n=>{const s=getComputedStyle(n);return n.getClientRects().length&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&!n.closest('[inert]');};
 const modals=[...document.querySelectorAll('[role=dialog][aria-modal=true]')].filter(live),scope=modals.at(-1)||document;
 const nodes=[...new Set([...scope.querySelectorAll('button:not(:disabled),a[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[role=button],label:has(input)')].filter(live).filter(n=>!n.matches('label')||!n.querySelector('input')?.disabled).map(n=>n.matches('input[type=checkbox],input[type=radio]')?(n.closest('label')||n):n))];
 const clip=n=>{let r=rect(n);r={x:Math.max(0,r.x),y:Math.max(0,r.y),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)};for(let a=n.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=rect(a);if(/auto|scroll|hidden|clip/.test(s.overflowX)){r.x=Math.max(r.x,b.x);r.right=Math.min(r.right,b.right);}if(/auto|scroll|hidden|clip/.test(s.overflowY)){r.y=Math.max(r.y,b.y);r.bottom=Math.min(r.bottom,b.bottom);}}return r;};
 const label=n=>n.id?'#'+n.id:n.tagName.toLowerCase()+(n.dataset.action?'[data-action='+n.dataset.action+']':'')+':'+(n.getAttribute('aria-label')||n.textContent||'').trim().slice(0,55);
 const targets=nodes.map(n=>({node:n,id:label(n),rect:rect(n),visible:clip(n),scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}));
 const visible=targets.filter(t=>t.visible.right>t.visible.x+1&&t.visible.bottom>t.visible.y+1),overlaps=[];
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
  const a=visible[i],b=visible[j];if(a.node.contains(b.node)||b.node.contains(a.node))continue;
  const w=Math.min(a.visible.right,b.visible.right)-Math.max(a.visible.x,b.visible.x),h=Math.min(a.visible.bottom,b.visible.bottom)-Math.max(a.visible.y,b.visible.y);if(w>1&&h>1)overlaps.push({a:a.id,b:b.id,width:w,height:h,area:w*h});
 }
 const small=targets.filter(t=>t.rect.width<43.5||t.rect.height<43.5).map(t=>({id:t.id,width:t.rect.width,height:t.rect.height}));
 const clipped=targets.filter(t=>t.clientWidth>0&&t.scrollWidth>t.clientWidth+2).map(t=>({id:t.id,client:t.clientWidth,scroll:t.scrollWidth}));
 const cards=[...document.querySelectorAll('.challenge-card,.round-fixed-card,.approx-question-card')].filter(live).map(n=>({class:n.className,...rect(n)}));
 const scrollers=[...scope.querySelectorAll('*')].filter(n=>live(n)&&/auto|scroll/.test(getComputedStyle(n).overflowY)&&n.scrollHeight>n.clientHeight+2).map(n=>({id:label(n),rect:rect(n),client:n.clientHeight,scroll:n.scrollHeight}));
 return {viewport:{width:innerWidth,height:innerHeight,visualHeight:visualViewport?.height},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},active:document.activeElement?.id,inputFocused:document.activeElement?.matches('input,textarea'),overlaps,small,clipped,cards,scrollers,targets:targets.map(({node,...t})=>t)};
}
module.exports={intersection,collect};
