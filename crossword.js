// ==========================================
// КРОССВОРД
// ==========================================

const N = 25;

let userGrid = [];
let activeWord = null;
let activeR = -1;
let activeC = -1;
let isSolved = false;
let showAnswers = false;

// Generator, renderer and pointer selection share one coordinate system.
const CW_CELL = 34, CW_PAD = 12, CW_CENTER = Math.floor(N / 2);
let cwLayout = null, cwVersion = 0, cwShape = 'free';
function makeGrid() { return Array.from({length:N}, () => Array(N).fill('.')); }
function cwMask(variant) {
  return Array.from({length:N},(_,r)=>Array.from({length:N},(_,c)=>{
    const y=Math.abs(r-CW_CENTER),x=Math.abs(c-CW_CENTER);
    if(variant==='diamond')return x+y<=10;
    if(variant==='cross')return Math.max(x,y)<=10&&(x<=3||y<=3);
    return x<=9&&y<=9;
  }));
}
function makeMaskFree() { return cwMask('free'); }
function makeMaskSquare() { return cwMask('square'); }
function makeMaskDiamond() { return cwMask('diamond'); }
function makeMaskCross() { return cwMask('cross'); }
function cwShuffle(a) {
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function cwNormalized(item) {
  return {w:String(item.w||'').trim().toUpperCase().replace(/Ё/g,'Е'),q:String(item.q||'').trim()};
}
function cwUniquePool(items) {
  const seen=new Set();
  return items.map(cwNormalized).filter(item=>{
    if(!/^[А-Я]{3,11}$/.test(item.w)||!item.q||seen.has(item.w))return false;
    seen.add(item.w);return true;
  });
}
function cwCanPlace(grid,mask,word,r,c,dir) {
  const len=word.length,dr=dir==='V'?1:0,dc=dir==='H'?1:0;
  const lastR=r+dr*(len-1),lastC=c+dc*(len-1);
  if(r<1||c<1||lastR>=N-1||lastC>=N-1)return 0;
  if(grid[r-dr][c-dc]!=='.'||grid[lastR+dr][lastC+dc]!=='.')return 0;
  let cross=0,added=0;
  for(let i=0;i<len;i++){
    const rr=r+i*dr,cc=c+i*dc;
    if(!mask[rr][cc])return 0;
    const present=grid[rr][cc];
    if(present!=='.'&&present!==word[i])return 0;
    if(present===word[i])cross++;
    else {
      added++;
      if(dir==='H'&&(grid[rr-1][cc]!=='.'||grid[rr+1][cc]!=='.'))return 0;
      if(dir==='V'&&(grid[rr][cc-1]!=='.'||grid[rr][cc+1]!=='.'))return 0;
    }
  }
  return cross&&added?cross:0;
}
function cwBounds(placed){
  let top=N,left=N,bottom=0,right=0;
  for(const p of placed){
    top=Math.min(top,p.r);left=Math.min(left,p.c);
    bottom=Math.max(bottom,p.r+(p.dir==='V'?p.w.length-1:0));
    right=Math.max(right,p.c+(p.dir==='H'?p.w.length-1:0));
  }
  return {top,left,bottom,right,height:bottom-top+1,width:right-left+1};
}
function cwCandidate(pool,variant){
  const g=makeGrid(),mask=cwMask(variant),placed=[];
  const available=cwShuffle(pool.slice()).slice(0,Math.min(105,pool.length));
  const starters=available.filter(item=>item.w.length>=5&&item.w.length<=9);
  if(!starters.length)return {g,placed};
  const first=starters[Math.floor(Math.random()*Math.min(starters.length,20))];
  const dir=Math.random()<.5?'H':'V';
  const r=CW_CENTER-(dir==='V'?Math.floor(first.w.length/2):0);
  const c=CW_CENTER-(dir==='H'?Math.floor(first.w.length/2):0);
  for(let i=0;i<first.w.length;i++)g[r+(dir==='V'?i:0)][c+(dir==='H'?i:0)]=first.w[i];
  placed.push({...first,r,c,dir});
  const used=new Set([first.w]);
  const target=variant==='square'?25:variant==='free'?22:20;
  for(let step=1;step<target;step++){
    const occupied=[];
    for(let rr=1;rr<N-1;rr++)for(let cc=1;cc<N-1;cc++)
      if(g[rr][cc]!=='.')occupied.push({r:rr,c:cc,ch:g[rr][cc]});
    let best=null,bestScore=-Infinity;
    const candidates=cwShuffle(available.filter(item=>!used.has(item.w))).slice(0,85);
    const old=cwBounds(placed);
    for(const item of candidates){
      const word=item.w,tried=new Set();
      for(const pos of occupied)for(let i=0;i<word.length;i++){
        if(word[i]!==pos.ch)continue;
        for(const direction of ['H','V']){
          const rr=pos.r-(direction==='V'?i:0),cc=pos.c-(direction==='H'?i:0);
          const key=rr+','+cc+','+direction;
          if(tried.has(key))continue;
          tried.add(key);
          const cross=cwCanPlace(g,mask,word,rr,cc,direction);
          if(!cross)continue;
          const top=Math.min(old.top,rr),left=Math.min(old.left,cc);
          const bottom=Math.max(old.bottom,rr+(direction==='V'?word.length-1:0));
          const right=Math.max(old.right,cc+(direction==='H'?word.length-1:0));
          const h=bottom-top+1,w=right-left+1;
          const growth=h*w-old.height*old.width;
          const asymmetry=Math.abs(h-w);
          const drift=Math.abs((top+bottom)/2-CW_CENTER)+Math.abs((left+right)/2-CW_CENTER);
          const score=cross*42+word.length*1.4-growth*1.1-asymmetry*6-drift*3+Math.random()*12;
          if(score>bestScore){bestScore=score;best={...item,r:rr,c:cc,dir:direction};}
        }
      }
    }
    if(!best)break;
    for(let i=0;i<best.w.length;i++)g[best.r+(best.dir==='V'?i:0)][best.c+(best.dir==='H'?i:0)]=best.w[i];
    placed.push(best);used.add(best.w);
  }
  placed.sort((a,b)=>a.r-b.r||a.c-b.c||(a.dir==='H'?-1:1));
  const numbers=new Map();
  for(const p of placed){const key=p.r+','+p.c;if(!numbers.has(key))numbers.set(key,numbers.size+1);p.num=numbers.get(key);}
  return {g,placed};
}
function buildBest(pool,attempts=4,_mask=null){
  const variant=document.getElementById('cw-variant')?.value||'free';
  const clean=cwUniquePool(pool);
  let best=null,score=-Infinity;
  for(let i=0;i<Math.min(6,attempts);i++){
    const result=cwCandidate(clean,variant);
    if(!result.placed.length)continue;
    const b=cwBounds(result.placed);
    const quality=result.placed.length*120-Math.abs(b.height-b.width)*17-b.width*b.height*.3;
    if(quality>score){score=quality;best=result;}
  }
  return best;
}
function cwFrame(g,variant){
  const rs=[],cs=[];
  for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(g[r][c]!=='.'){rs.push(r);cs.push(c);}
  if(!rs.length)return null;
  const top=Math.min(...rs),bottom=Math.max(...rs),left=Math.min(...cs),right=Math.max(...cs);
  if(variant==='diamond'||variant==='cross')return {r0:2,c0:2,rows:21,cols:21};
  if(variant==='square'){
    const side=Math.min(21,Math.max(15,bottom-top+3,right-left+3));
    return {r0:Math.max(0,Math.min(N-side,Math.floor((top+bottom-side+1)/2))),
      c0:Math.max(0,Math.min(N-side,Math.floor((left+right-side+1)/2))),rows:side,cols:side};
  }
  const r0=Math.max(0,top-1),c0=Math.max(0,left-1);
  return {r0,c0,rows:Math.min(N,bottom+2)-r0,cols:Math.min(N,right+2)-c0};
}
// Draw at the actual CSS size, not a small bitmap enlarged by the browser.
// Bitmap pixels match CSS pixels × DPR. Text and grid strokes are rasterized afresh.
function drawCrossword(g,placed) {
  if (!g || !placed) return;
  const cv = document.getElementById('cv');
  const frame = cwFrame(g,cwShape);
  if (!cv || !frame) return;

  const {r0,c0,rows,cols} = frame;
  const measuredWidth = cv.getBoundingClientRect?.().width || cv.parentElement?.clientWidth || 0;
  const width = Math.max(200, measuredWidth || cols*CW_CELL + CW_PAD*2);
  const pad = Math.max(7, Math.min(17, width*0.018));
  const cell = (width - pad*2) / cols;
  const height = rows*cell + pad*2;
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

  const physicalWidth = Math.round(width*dpr);
  const physicalHeight = Math.round(height*dpr);
  if (cv.width !== physicalWidth) cv.width = physicalWidth;
  if (cv.height !== physicalHeight) cv.height = physicalHeight;
  cv.style.aspectRatio = width + ' / ' + height;

  const sx = physicalWidth / width, sy = physicalHeight / height;
  const ctx = cv.getContext('2d');
  ctx.setTransform(sx,0,0,sy,0,0);
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle = '#0b1425';
  ctx.fillRect(0,0,width,height);

  const snapX = x => Math.round(x*sx)/sx;
  const snapY = y => Math.round(y*sy)/sy;
  const borderX = 1/sx, borderY = 1/sy;
  const mask = cwMask(cwShape);
  const numberMap = new Map(placed.map(p=>[p.r+','+p.c,p.num]));

  for (let y=0; y<rows; y++) for (let x=0; x<cols; x++) {
    const r=r0+y, c=c0+x;
    if (!mask[r]?.[c] && cwShape !== 'square') continue;
    const x0=snapX(pad+x*cell), x1=snapX(pad+(x+1)*cell);
    const y0=snapY(pad+y*cell), y1=snapY(pad+(y+1)*cell);
    const empty=g[r][c]==='.';
    const cursor=!empty && r===activeR && c===activeC;
    const selected=!empty && activeWord && (
      activeWord.dir==='H' && r===activeWord.r && c>=activeWord.c && c<activeWord.c+activeWord.w.length ||
      activeWord.dir==='V' && c===activeWord.c && r>=activeWord.r && r<activeWord.r+activeWord.w.length
    );
    ctx.fillStyle = empty ? '#29415a' : '#53708c';
    ctx.fillRect(x0,y0,x1-x0,y1-y0);
    ctx.fillStyle = empty ? '#091321' :
      cursor ? '#55d8b8' : selected ? '#c0f3e8' :
      isSolved ? '#d5f8e8' : '#edf4fb';
    ctx.fillRect(x0+borderX,y0+borderY,
      Math.max(0,x1-x0-borderX*2),Math.max(0,y1-y0-borderY*2));
    if(empty)continue;

    const letter=isSolved?g[r][c]:(userGrid[r]?.[c]||(showAnswers?g[r][c]:''));
    if(letter) {
      ctx.fillStyle=showAnswers&&!userGrid[r]?.[c]&&!isSolved?'#748998':'#102335';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='700 '+Math.max(12,Math.min(32,cell*.52)).toFixed(1)+'px system-ui, sans-serif';
      ctx.fillText(letter,(x0+x1)/2,(y0+y1)/2+cell*.045);
    }
    const number=numberMap.get(r+','+c);
    if(number){
      ctx.fillStyle='#30485b';
      ctx.textAlign='left';ctx.textBaseline='top';
      ctx.font='700 '+Math.max(7,Math.min(13,cell*.23)).toFixed(1)+'px system-ui, sans-serif';
      ctx.fillText(String(number),x0+Math.max(2,cell*.06),y0+Math.max(1,cell*.025));
    }
  }
  cwLayout={...frame,cell,pad,width,height,dpr,physicalWidth,physicalHeight};
}

function updateUI() {
  const panel = document.getElementById('active-q-panel');

  if (isSolved) {
    markWin('crossword');
    panel.innerHTML = '🎉 ПОЗДРАВЛЯЕМ! КРОССВОРД РАЗГАДАН! 🎉';
    panel.style.color = '#4ade80';
  } else if (activeWord) {
    const dirText = activeWord.dir === 'H' ? 'По горизонтали' : 'По вертикали';
    panel.innerHTML = `
      <div class="cw-dir-line">
        ${dirText}, №${activeWord.num}
      </div>
      <div class="cw-question-line">
        ${activeWord.q}
      </div>
    `;
    panel.style.color = '#ff6b35';
  } else {
    panel.innerHTML = 'Кликните по клетке для начала';
    panel.style.color = '#ff6b35';
  }

  document.querySelectorAll('.clue-item').forEach(el => el.classList.remove('active'));

  if(activeWord) {
    const el = document.getElementById('clue-' + activeWord.num + '-' + activeWord.dir);
    if(el) {
      el.classList.add('active');

      // Selection is shown above the board; do not scroll the entire document.
    }
  }
  fitCrosswordQuestion(panel);
}

// Reserve one stable panel height on phones so the crossword never moves between clues.
function fitCrosswordQuestion(panel) {
  const question = panel.querySelector('.cw-question-line');
  if (!question) return;
  question.style.fontSize = '';
  if (window.innerWidth > 768) return;
  const direction=panel.querySelector('.cw-dir-line');
  const style=window.getComputedStyle(panel);
  const available=panel.clientHeight -
    parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) -
    (direction?.offsetHeight || 0) - 3;
  const base=Math.min(15, Math.max(12,window.innerWidth/29));
  for(let size=base;size>=10.5;size-=0.5) {
    question.style.fontSize=size+'px';
    if (question.scrollHeight<=available+1) break;
  }
}

function renderCluesList(placed) {
  const box = document.getElementById('cluesList');
  const hor = placed.filter(p => p.dir === 'H').sort((a,b)=>a.num-b.num);
  const ver = placed.filter(p => p.dir === 'V').sort((a,b)=>a.num-b.num);

  let html = `<div class="clues-section"><h3>ПО ГОРИЗОНТАЛИ</h3>`;
  hor.forEach(p => html += `<button type="button" class="clue-item cw-clue-button" data-dir="H" data-num="${p.num}" id="clue-${p.num}-H"><b>${p.num}.</b> ${p.q}</button>`);
  html += `</div><div class="clues-section"><h3>ПО ВЕРТИКАЛИ</h3>`;
  ver.forEach(p => html += `<button type="button" class="clue-item cw-clue-button" data-dir="V" data-num="${p.num}" id="clue-${p.num}-V"><b>${p.num}.</b> ${p.q}</button>`);
  html += `</div>`;
  box.innerHTML = html;
}

function checkWin() {
  if(!window.lastG) return;
  let win = true;
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(window.lastG[r][c]!=='.' && userGrid[r][c]!==window.lastG[r][c]) win=false;
  if(win) { isSolved=true; activeWord=null; activeR=-1; activeC=-1; updateUI(); }
}

function onGenerateCore() {
  showAnswers = false;
  document.getElementById('btn-answ').textContent = '👁 Ответы';

  const themeRaw = document.getElementById('sel-theme').value;
  let levelRaw   = document.getElementById('sel-level').value;

  // Нормализуем всё к русским ключам БД
  const levelMap = {
    'easy':    'легкий',
    'medium':  'средний',
    'hard':    'сложный',
    'легкий':  'легкий',
    'средний': 'средний',
    'сложный': 'сложный'
  };
  const level = levelMap[levelRaw] || 'легкий';

  // Keep easy/medium/hard as the UI value for correct settings synchronization.

  const theme = themeRaw; // тут русские: "физика", "математика", "физмат", "история", ...

  let pool = [];

  if (theme === 'физмат') {
    const phys = DB['физика']?.[level] ?? [];
    const math = DB['математика']?.[level] ?? [];
    pool = [...phys, ...math];
  } else if (theme === 'все') {
    const allThemes = ['физика', 'математика', 'история', 'обществознание'];
    pool = allThemes.flatMap(t => DB[t]?.[level] ?? []);
  } else {
    pool = DB[theme]?.[level] ?? [];
  }

  if (pool.length < 4) {
    document.getElementById('stat').textContent =
      `⚠️ Недостаточно слов: тема "${theme}", уровень "${level}".`;
    return;
  }

  let available = pool.filter(i => !usedWordsHistory.has(i.w));
  if (available.length < 10) {
    usedWordsHistory.clear();
    available = [...pool];
  }

  const variant = document.getElementById('cw-variant')?.value || 'free';
  const masks = { free: makeMaskFree, square: makeMaskSquare,
                  diamond: makeMaskDiamond, cross: makeMaskCross };
  const mask = (masks[variant] || makeMaskFree)();
  cwShape = variant;

  const attempts = 5;

  const serial = ++cwVersion;
  document.getElementById('stat').textContent = 'Строим кроссворд…';
  requestAnimationFrame(() => {
    if (serial !== cwVersion) return;
    const res = buildBest(available, attempts, mask);
    if (!res || res.placed.length < 3) {
      document.getElementById('stat').textContent = '⚠️ Ошибка построения.';
      return;
    }

    const { g, placed } = res;
    Storage.addGame('crossword');
    placed.forEach(p => usedWordsHistory.add(p.w));
    window.lastG = g;
    window.lastPlaced = placed;

    userGrid = Array.from({ length: N }, () => Array(N).fill(''));
    activeWord = null;
    activeR = -1;
    activeC = -1;
    isSolved = false;

    renderCluesList(placed);
    updateUI();
    drawCrossword(g, placed);
    window.cwReadyVersion = serial;

    const frame = cwFrame(g,cwShape);
    document.getElementById('stat').textContent =
      `${placed.length} слов · Сетка ${frame.cols}×${frame.rows}`;

    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth >= 769) sidebar.classList.remove('collapsed');
    updateSidebarToggle(sidebar);
  });
}

function onGenerate() {
  if (!crosswordHasProgress()) {
    onGenerateCore();
    return;
  }

  showConfirmPopup(
    'Сбросить текущий кроссворд и сгенерировать новый?',
    () => onGenerateCore(),
    () => {}
  );
}

function handleInput(key) {
  if (!activeWord || isSolved) return;

  if (key === 'Backspace') {
    userGrid[activeR][activeC] = '';
    if (activeWord.dir === 'H' && activeC > activeWord.c) {
      activeC--;
    } else if (activeWord.dir === 'V' && activeR > activeWord.r) {
      activeR--;
    }
  } else if (key && key.length === 1 && /[а-яё]/i.test(key)) {
    const ch = key.toUpperCase().replace(/Ё/g,'Е');
    userGrid[activeR][activeC] = ch;
    if (activeWord.dir === 'H' && activeC < activeWord.c + activeWord.w.length - 1) {
      activeC++;
    } else if (activeWord.dir === 'V' && activeR < activeWord.r + activeWord.w.length - 1) {
      activeR++;
    }
    checkWin();
  }

  drawCrossword(window.lastG, window.lastPlaced);
}

document.getElementById('cv').addEventListener('pointerdown',e=>{
  if(isSolved||!window.lastG||!cwLayout)return;
  const cv=e.target,rect=cv.getBoundingClientRect();
  const x=(e.clientX-rect.left)*cwLayout.width/rect.width;
  const y=(e.clientY-rect.top)*cwLayout.height/rect.height;
  const c=Math.floor((x-cwLayout.pad)/cwLayout.cell)+cwLayout.c0;
  const r=Math.floor((y-cwLayout.pad)/cwLayout.cell)+cwLayout.r0;
  if(r<0||r>=N||c<0||c>=N||window.lastG[r][c]==='.')return;
  const words=window.lastPlaced.filter(p=>p.dir==='H'?
    r===p.r&&c>=p.c&&c<p.c+p.w.length:
    c===p.c&&r>=p.r&&r<p.r+p.w.length);
  if(!words.length)return;
  activeWord=words.length>1&&words.includes(activeWord)?words.find(p=>p!==activeWord):words[0];
  activeR=r;activeC=c;updateUI();drawCrossword(window.lastG,window.lastPlaced);
});
// ResizeObserver handles the container resizing even without a viewport resize.
const crosswordCanvas = document.getElementById('cv');
let cwResizeQueued=false;
function scheduleCrosswordRedraw() {
  if (cwResizeQueued || !window.lastG) return;
  cwResizeQueued=true;
  requestAnimationFrame(()=>{
    cwResizeQueued=false;
    if (!window.lastG || !document.getElementById('sec-crossword')?.classList.contains('active')) return;
    drawCrossword(window.lastG,window.lastPlaced);
    fitCrosswordQuestion(document.getElementById('active-q-panel'));
  });
}
if (typeof ResizeObserver !== 'undefined')
  new ResizeObserver(scheduleCrosswordRedraw).observe(crosswordCanvas.parentElement);
window.addEventListener('resize',scheduleCrosswordRedraw);
document.getElementById('cluesList').addEventListener('click',event=>{
  const entry=event.target.closest('[data-dir][data-num]');
  if(!entry||isSolved||!window.lastPlaced)return;
  const choice=window.lastPlaced.find(p=>p.dir===entry.dataset.dir&&p.num===Number(entry.dataset.num));
  if(!choice)return;
  activeWord=choice;activeR=choice.r;activeC=choice.c;
  updateUI();drawCrossword(window.lastG,window.lastPlaced);
});


function onToggleAnswers() {
  if(!window.lastG) return;
  showAnswers = !showAnswers;
  document.getElementById('btn-answ').textContent = showAnswers ? '🔒 Скрыть' : '👁 Ответы';
  drawCrossword(window.lastG, window.lastPlaced);
}

function onExport() {
  const a = document.createElement('a');
  a.download = 'crossword.png';
  a.href = document.getElementById('cv').toDataURL('image/png');
  a.click();
}

// Экспорт в глобальную область для core.js и общей клавиатуры
window.handleInput = handleInput;
window.activeWord  = activeWord;
window.isSolved    = isSolved;
window.activeR     = activeR;
window.activeC     = activeC;

// ===== Автогенерация лёгкого кроссворда при первом открытии =====

// если есть селекторы, выставим по умолчанию физмат + easy и сгенерим
document.addEventListener('DOMContentLoaded', () => {
  const sec = document.getElementById('sec-crossword');
  if (!sec) return;

  // тема по умолчанию
  const themeInput = document.getElementById('sel-theme');
  if (themeInput) themeInput.value = 'физмат';

  // сложность по умолчанию easy (для DB)
  const levelInput = document.getElementById('sel-level');
  if (levelInput) levelInput.value = 'easy';

  // обновим статус-бар под это
  const levelLabel = document.getElementById('cw-status-level');
  if (levelLabel) levelLabel.textContent = '★ Лёгкий';

  // первая автогенерация
  onGenerateCore();
});
