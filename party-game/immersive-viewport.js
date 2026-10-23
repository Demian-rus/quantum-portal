// Freeze the immersive game's original layout when Android briefly reveals system bars.
// Browser tabs/standalone windows retain responsive dvh sizing. No game state is touched.
(function(){
  'use strict';
  if(!window.matchMedia || !window.matchMedia('(display-mode: fullscreen)').matches)return;
  const root=document.documentElement;
  let width=Math.round(window.innerWidth);
  let height=Math.round(window.innerHeight);
  let orientation=window.screen?.orientation?.type||'';
  function publish(){
    root.style.setProperty('--kvip-locked-vh',height/100+'px');
    root.style.setProperty('--kvip-locked-height',height+'px');
  }
  function sync(){
    const nextWidth=Math.round(window.innerWidth);
    const nextHeight=Math.round(window.innerHeight);
    const nextOrientation=window.screen?.orientation?.type||'';
    // A genuine rotation/width change resets the baseline. Shorter temporary
    // insets on the same screen must not compress cards or move scroll panels.
    if(Math.abs(nextWidth-width)>3 || (orientation&&nextOrientation&&orientation!==nextOrientation)){
      width=nextWidth;
      height=nextHeight;
      orientation=nextOrientation;
    }else if(nextHeight>height){
      height=nextHeight;
    }
    publish();
  }
  publish();
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
  window.visualViewport?.addEventListener('resize',sync,{passive:true});
})();
