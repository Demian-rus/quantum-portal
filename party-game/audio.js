'use strict';
// Optional audio UI/synthesis: original handlers retained, never block the game.
function setSoundIcon() {
  $('sound-toggle').checked=soundOn;
  $('sound-toggle').setAttribute('aria-checked',String(soundOn));
}
function initAudio() {
  if(!soundOn)return;
  try {
    const Ctor=window.AudioContext||window.webkitAudioContext;
    if(!Ctor)return;
    if(!audioContext)audioContext=new Ctor();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  } catch { /* Audio is optional, never block play. */ }
}
function tone(freq=660,duration=.11,type='sine',volume=.07,delay=0) {
  if(!soundOn)return;
  initAudio();
  if(!audioContext)return;
  try {
    const now=audioContext.currentTime+delay;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(freq,now);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(volume,now+.016);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(now);oscillator.stop(now+duration+.02);
  } catch { /* Playback may be restricted by the device. */ }
}
function sfx(kind) {
  if(kind==='button')tone(520,.08,'triangle',.055);
  if(kind==='roll'){tone(340,.1,'triangle',.055);tone(540,.13,'triangle',.05,.12);}
  if(kind==='go'){tone(560,.1,'sine',.06);tone(740,.14,'sine',.07,.14);}
  if(kind==='tick')tone(600,.09,'sine',.075);
  if(kind==='last')tone(910,.17,'triangle',.11);
  if(kind==='time'){tone(520,.24,'sawtooth',.09);tone(390,.4,'triangle',.10,.23);tone(260,.5,'triangle',.09,.55);}
  if(kind==='win'){tone(500,.12,'triangle',.07);tone(660,.16,'triangle',.07,.15);tone(880,.3,'triangle',.09,.34);}
  if(kind==='fail')tone(285,.21,'triangle',.075);
}
