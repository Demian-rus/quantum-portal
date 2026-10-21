/* КВИП mode art: eight 512px transparent WebP assets; approx is reserved for the upcoming mode. 
   Seven active modes are defined in MODE_LIST in app.js. */
const MODE_ASSETS = Object.freeze({
  talk: './assets/modes/talk.webp?v=3',     // СЛОВА — speaking avatar
  mime: './assets/modes/mime.webp?v=3',     // ЖЕСТЫ — open hand
  draw: './assets/modes/draw.webp?v=3',     // НАРИСУЙ — paint palette and brush
  sing: './assets/modes/sing.webp?v=3',     // НАПОЙ — microphone
  yesno: './assets/modes/yesno.webp?v=3',   // ДАНЕТКИ — yes / no choice
  secret: './assets/modes/secret.webp?v=3', // СЕКРЕТКА — question mark
  blitz: './assets/modes/blitz.webp?v=3',   // БЛИЦ — stopwatch and lightning
  approx: './assets/modes/approx.webp?v=3'  // ПРИМЕРНО — target and arrow (future mode)
});
