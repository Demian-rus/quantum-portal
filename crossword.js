// ==========================================
// КРОССВОРД
// ==========================================

const N = 35;

let userGrid = [];
let activeWord = null;
let activeR = -1;
let activeC = -1;
let isSolved = false;
let showAnswers = false;

// Маски фигур
function makeMaskFree() {
  const centerR = Math.floor(N / 2);
  const centerC = Math.floor(N / 2);
  const radius = 10; // 20×20 квадрат

  return Array.from({length:N}, (_, r) => Array.from({length:N}, (_, c) => {
    return Math.abs(r - centerR) <= radius && Math.abs(c - centerC) <= radius;
  }));
}

function makeMaskSquare() {
  const S = 3, S2 = 7, E = N - 4, E2 = N - 8, M = Math.floor(N/2);
  return Array.from({length:N}, (_, r) => Array.from({length:N}, (_, c) => {
    const isTop = (r >= S && r <= S2) && (c >= S && c <= E);
    const isBot = (r >= E2 && r <= E) && (c >= S && c <= E);
    const isLef = (c >= S && c <= S2) && (r >= S && r <= E);
    const isRig = (c >= E2 && c <= E) && (r >= S && r <= E);
    const isCrossH = Math.abs(r - M) <= 1 && (c >= S && c <= E);
    const isCrossV = Math.abs(c - M) <= 1 && (r >= S && r <= E);
    return isTop || isBot || isLef || isRig || isCrossH || isCrossV;
  }));
}

function makeMaskDiamond() {
  const cx = Math.floor(N/2), R = Math.floor(N/2) - 4;
  return Array.from({length:N}, (_, r) => Array.from({length:N}, (_, c) => {
    const dist = Math.abs(r - cx) + Math.abs(c - cx);
    const isBorder = (dist <= R && dist >= R - 4);
    const isCrossH = Math.abs(r - cx) <= 1 && Math.abs(c - cx) <= R;
    const isCrossV = Math.abs(c - cx) <= 1 && Math.abs(r - cx) <= R;
    return isBorder || isCrossH || isCrossV;
  }));
}

function makeMaskQuadrants() {
  const M = Math.floor(N/2), q1 = Math.floor(M/2), q2 = M + Math.floor(M/2);
  const R = Math.floor(M/2) - 1, Rin = R - 3;
  const isBox = (r, c, cr, cc) => {
    const dr = Math.abs(r - cr), dc = Math.abs(c - cc);
    return (dr <= R && dc <= R) && !(dr <= Rin && dc <= Rin);
  };
  return Array.from({length:N}, (_, r) => Array.from({length:N}, (_, c) => {
    return isBox(r,c,q1,q1) || isBox(r,c,q1,q2) || isBox(r,c,q2,q1) || isBox(r,c,q2,q2) 
           || Math.abs(r - M) <= 1 || Math.abs(c - M) <= 1;
  }));
}

function makeMaskCross() {
  const C = Math.floor(N/2), Wout = 6, Win = 3, S = 3, E = N - 4;
  return Array.from({length:N}, (_, r) => Array.from({length:N}, (_, c) => {
    const inCross = (Math.abs(c - C) <= Wout && r >= S && r <= E) || 
                    (Math.abs(r - C) <= Wout && c >= S && c <= E);
    const inHoleV = Math.abs(c - C) <= Win && r >= S + 3 && r <= E - 3;
    const inHoleH = Math.abs(r - C) <= Win && c >= S + 3 && c <= E - 3;
    const inCenterHole = Math.abs(c - C) <= Win && Math.abs(r - C) <= Win;
    const isBridge = Math.abs(r - C) === 0 || Math.abs(c - C) === 0;
    return inCross && (!inHoleV && !inHoleH && !inCenterHole || isBridge);
  }));
}

const SHAPES = {
  'свободная': makeMaskFree,
  'квадрат':   makeMaskSquare,
  'ромб':      makeMaskDiamond,
  'крест':     makeMaskCross,
  'квадранты': makeMaskQuadrants
};

function makeGrid() { return Array.from({length:N}, () => Array(N).fill('.')); }
function doPlace(g, w, r, c, dir) {
  for (let i=0; i<w.length; i++) dir==='H' ? g[r][c+i]=w[i] : g[r+i][c]=w[i];
}
function shuffle(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function canPlace(g, w, r, c, dir, mask) {
  const L = w.length;
  if (dir === 'H') { if (c < 0 || c + L > N || r < 0 || r >= N) return false; }
  else             { if (r < 0 || r + L > N || c < 0 || c >= N) return false; }

  if (mask) {
    for (let i=0; i<L; i++) {
      const rr = dir === 'H' ? r : r + i;
      const cc = dir === 'H' ? c + i : c;
      if (!mask[rr] || !mask[rr][cc]) return false;
    }
  }

  if (dir === 'H') {
    if (c > 0 && g[r][c-1] !== '.') return false;
    if (c + L < N && g[r][c+L] !== '.') return false;
    for (let i=0; i<L; i++) {
      const ch = g[r][c+i];
      if (ch !== '.' && ch !== w[i]) return false;
      if (ch === '.') {
        if (r > 0 && g[r-1][c+i] !== '.') return false;
        if (r < N-1 && g[r+1][c+i] !== '.') return false;
      }
    }
  } else {
    if (r > 0 && g[r-1][c] !== '.') return false;
    if (r + L < N && g[r+L][c] !== '.') return false;
    for (let i=0; i<L; i++) {
      const ch = g[r+i][c];
      if (ch !== '.' && ch !== w[i]) return false;
      if (ch === '.') {
        if (c > 0 && g[r+i][c-1] !== '.') return false;
        if (c < N-1 && g[r+i][c+1] !== '.') return false;
      }
    }
  }
  return true;
}

function getValidSlotsForWord(g, item, mask) {
  const w = item.w, slots = [];
  for (let r=1; r<N-1; r++) for (let c=1; c<N-1; c++) {
    for (const dir of ['H', 'V']) {
      if (!canPlace(g, w, r, c, dir, mask)) continue;
      let cross = 0, isAttached = false;
      for (let i=0; i<w.length; i++) {
        const rr = dir === 'H' ? r : r + i, cc = dir === 'H' ? c + i : c;
        if (g[rr][cc] === w[i]) cross++;
        if (g[rr][cc] !== '.') isAttached = true;
      }
      if (isAttached) slots.push({ r, c, dir, cross });
    }
  }
  return slots;
}

function getCOM(g, mask) {
  let sumR=0, sumC=0, cnt=0;
  for(let r=0; r<N; r++) {
    for(let c=0; c<N; c++) {
      if (g[r][c] === '.') continue;
      if (mask && !mask[r][c]) continue;
      sumR+=r; sumC+=c; cnt++;
    }
  }
  if(!cnt && mask) {
    let mR=0, mC=0, mCnt=0;
    for(let r=0; r<N; r++) for(let c=0; c<N; c++) {
      if(mask[r][c]) { mR+=r; mC+=c; mCnt++; }
    }
    return { r: mCnt ? mR/mCnt : N/2, c: mCnt ? mC/mCnt : N/2 };
  }
  return cnt ? {r:sumR/cnt, c:sumC/cnt} : {r:N/2, c:N/2};
}

function tryBuildSmart(pool, mask=null) {
  const g = makeGrid(), placed = [];
  let available = [...pool], num = 1;
  available.sort((a, b) => b.w.length - a.w.length);
  const first = available.shift();

  const initialSlots = [];
  for (let r=1; r<N-1; r++) for (let c=1; c<N-1; c++) {
    if (!canPlace(g, first.w, r, c, 'H', mask)) continue;
    initialSlots.push({r,c,dir:'H'});
    if (!canPlace(g, first.w, r, c, 'V', mask)) continue;
    initialSlots.push({r,c,dir:'V'});
  }
  if (!initialSlots.length) return { g, placed: [] };

  const start = initialSlots[Math.floor(Math.random() * initialSlots.length)];
  doPlace(g, first.w, start.r, start.c, start.dir);
  placed.push({ ...first, r: start.r, c: start.c, dir: start.dir, num: num++ });

  let added;
  do {
    added = false;
    shuffle(available);
    for (let i=0; i<available.length; i++) {
      const item = available[i];
      const slots = getValidSlotsForWord(g, item, mask);
      if (!slots.length) continue;

      slots.forEach(s => s.score = s.cross * 100);
      slots.sort((a, b) => b.score - a.score);

      const best = slots[0];
      doPlace(g, item.w, best.r, best.c, best.dir);
      placed.push({ ...item, r: best.r, c: best.c, dir: best.dir, num: num++ });
      available.splice(i, 1);
      added = true; break;
    }
  } while (added && placed.length < 28);

  placed.sort((a, b) => a.r !== b.r ? a.r - b.r : a.c - b.c);
  placed.forEach((p, i) => p.num = i + 1);
  return { g, placed };
}

function buildBest(pool, attempts=15, mask=null) {
  let best = null;
  for (let i=0; i<attempts; i++) {
    const res = tryBuildSmart(pool, mask);
    if (!best || res.placed.length > best.placed.length) best = res;
    if (best.placed.length >= 25) break;
  }
  return best;
}

let CELL = 32;
const GPAD = 24, TOPH = 20, BPAD = 30;

// Рисуем кроссворд
function drawCrossword(g, placed) {
  CELL = getResponsiveCell();

  const targetSize = window.innerWidth <= 650 ? 380 : 600;

  const cv = document.getElementById('cv');
  cv.width = targetSize;
  cv.height = targetSize;

  const ctx = cv.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, cv.width, cv.height);
  bg.addColorStop(0, '#06060f');
  bg.addColorStop(1, '#080816');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.strokeStyle = '#0e0e25';
  ctx.lineWidth = 1;
  for (let x = 0; x < cv.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
  for (let y = 0; y < cv.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }

  const rs = [], cs = [];
  for(let r=0; r<N; r++) for(let c=0; c<N; c++) if(g[r][c]!=='.') { rs.push(r); cs.push(c); }
  if(!rs.length) return;

  const rMin = Math.max(0, Math.min(...rs) - 1);
  const rMax = Math.min(N - 1, Math.max(...rs) + 1);
  const cMin = Math.max(0, Math.min(...cs) - 1);
  const cMax = Math.min(N - 1, Math.max(...cs) + 1);

  window.lastBounds = { rMin, cMin };

  const gridWidth = (cMax - cMin + 1) * CELL;
  const gridHeight = (rMax - rMin + 1) * CELL;
  const maxDim = Math.max(gridWidth, gridHeight);
  const availableSpace = targetSize - GPAD * 2 - 20;
  const scale = Math.min(1, availableSpace / maxDim);

  const offsetX = (targetSize - gridWidth * scale) / 2;
  const offsetY = (targetSize - gridHeight * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const numMap = {};
  placed.forEach(p => { if(!numMap[`${p.r},${p.c}`]) numMap[`${p.r},${p.c}`] = p.num; });

  for(let r = rMin; r <= rMax; r++) {
    for(let c = cMin; c <= cMax; c++) {
      if(g[r][c]==='.') continue;

      const x = (c - cMin) * CELL;
      const y = (r - rMin) * CELL;

      let isActive = false;
      let isCursor = (r === activeR && c === activeC);

      if(activeWord) {
        if(activeWord.dir==='H' && r===activeWord.r && c>=activeWord.c && c<activeWord.c+activeWord.w.length) isActive=true;
        if(activeWord.dir==='V' && c===activeWord.c && r>=activeWord.r && r<activeWord.r+activeWord.w.length) isActive=true;
      }

      ctx.fillStyle = isSolved ? '#0f301d' : (isCursor ? '#2a2a60' : (isActive ? '#1a1a40' : '#0d0d22'));
      rrect(ctx, x+1, y+1, CELL-2, CELL-2, 4);
      ctx.fill();

      ctx.strokeStyle = isCursor ? '#00d4ff' : '#00d4ff38';
      ctx.lineWidth = isCursor ? 2 : 1;
      rrect(ctx, x+1, y+1, CELL-2, CELL-2, 4);
      ctx.stroke();

      let letter, letterColor;
      if (isSolved) {
        letter = g[r][c];
        letterColor = '#4ade80';
      } else if (userGrid[r][c]) {
        letter = userGrid[r][c];
        letterColor = '#fbbf24';
      } else if (showAnswers) {
        letter = g[r][c];
        letterColor = 'rgba(0, 212, 255, 0.4)';
      } else {
        letter = '';
      }
      if (letter) {
        ctx.fillStyle = letterColor;
        ctx.font = 'bold ' + Math.floor(CELL * 0.52) + 'px Segoe UI,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, x + CELL/2, y + CELL/2 + 1);
      }

      if(numMap[`${r},${c}`]) {
        ctx.fillStyle='#ff6b35';
        ctx.font='bold 9px Segoe UI,sans-serif';
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(numMap[`${r},${c}`], x+3, y+2);
      }
    }
  }

  ctx.restore();
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

      const container = document.getElementById('cluesList');
      const targetScroll = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - (container.clientHeight / 2) + (el.clientHeight / 2);
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }
}

function renderCluesList(placed) {
  const box = document.getElementById('cluesList');
  const hor = placed.filter(p => p.dir === 'H').sort((a,b)=>a.num-b.num);
  const ver = placed.filter(p => p.dir === 'V').sort((a,b)=>a.num-b.num);

  let html = `<div class="clues-section"><h3>ПО ГОРИЗОНТАЛИ</h3>`;
  hor.forEach(p => html += `<div class="clue-item" id="clue-${p.num}-H"><b>${p.num}.</b> ${p.q}</div>`);
  html += `</div><div class="clues-section"><h3>ПО ВЕРТИКАЛИ</h3>`;
  ver.forEach(p => html += `<div class="clue-item" id="clue-${p.num}-V"><b>${p.num}.</b> ${p.q}</div>`);
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

  const theme = document.getElementById('sel-theme').value;
  const level = document.getElementById('sel-level').value;

  let pool = [];
  if (theme === 'физмат') {
    const phys = DB['физика']?.[level] ?? [];
    const math = DB['математика']?.[level] ?? [];
    pool = [...phys, ...math];
  } else {
    pool = DB[theme]?.[level] ?? [];
  }

  if(pool.length < 4) return;

  let available = pool.filter(i => !usedWordsHistory.has(i.w));
  if(available.length < 10) { usedWordsHistory.clear(); available = [...pool]; }

  const mask = makeMaskFree();

  let attempts = 15;
  if(level === 'средний') attempts = 30;
  if(level === 'сложный') attempts = 50;

  Storage.addGame('crossword');

  requestAnimationFrame(() => {
    const res = buildBest(available, attempts, mask);
    if(!res || !res.placed.length) { document.getElementById('stat').textContent='⚠️ Ошибка построения.'; return; }

    const {g, placed} = res;
    placed.forEach(p => usedWordsHistory.add(p.w));
    window.lastG=g;
    window.lastPlaced=placed;

    userGrid = Array.from({length:N}, ()=>Array(N).fill(''));
    activeWord=null;
    activeR=-1;
    activeC=-1;
    isSolved=false;

    renderCluesList(placed);
    updateUI();
    drawCrossword(g, placed);

    const left = pool.filter(i => !usedWordsHistory.has(i.w)).length;
    document.getElementById('stat').textContent = `Слов на поле: ${placed.length} | Осталось в базе: ${left}/${pool.length}`;

    if(document.getElementById('sidebar').classList.contains('collapsed')) {
      document.getElementById('sidebar').classList.remove('collapsed');
    }
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
  } else if (key && key.length === 1 && /[а-яёa-z]/i.test(key)) {
    const ch = key.toUpperCase();
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


document.getElementById('cv').addEventListener('pointerdown', e => {
  if(isSolved || !window.lastG) return;

  const rect = e.target.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (e.target.width / rect.width);
  const y = (e.clientY - rect.top) * (e.target.height / rect.height);

  const targetSize = window.innerWidth <= 650 ? 380 : 600;
  const rs = [], cs = [];
  for(let r=0; r<N; r++) for(let c=0; c<N; c++) if(window.lastG[r][c]!=='.') { rs.push(r); cs.push(c); }

  const rMin = Math.max(0, Math.min(...rs) - 1);
  const cMin = Math.max(0, Math.min(...cs) - 1);
  const rMax = Math.min(N - 1, Math.max(...rs) + 1);
  const cMax = Math.min(N - 1, Math.max(...cs) + 1);

  const gridWidth = (cMax - cMin + 1) * CELL;
  const gridHeight = (rMax - rMin + 1) * CELL;
  const maxDim = Math.max(gridWidth, gridHeight);
  const availableSpace = targetSize - GPAD * 2 - 20;
  const scale = Math.min(1, availableSpace / maxDim);

  const offsetX = (targetSize - gridWidth * scale) / 2;
  const offsetY = (targetSize - gridHeight * scale) / 2;

  const gridX = (x - offsetX) / scale;
  const gridY = (y - offsetY) / scale;

  const c = Math.floor(gridX / CELL) + cMin;
  const r = Math.floor(gridY / CELL) + rMin;

  if(r>=0 && r<N && c>=0 && c<N && window.lastG[r][c]!=='.') {
    const words = window.lastPlaced.filter(p => 
      p.dir==='H' ? (p.r===r && c>=p.c && c<p.c+p.w.length) : 
      (p.c===c && r>=p.r && r<p.r+p.w.length)
    );

    if(words.length) {
      let selectedWord = words.find(w => (w.dir==='H' && w.r===r && w.c===c) || (w.dir==='V' && w.c===c && w.r===r));

      if(!selectedWord) {
        if(activeWord && words.includes(activeWord) && words.length > 1) {
          selectedWord = words.find(w => w !== activeWord);
        } else {
          selectedWord = words[0];
        }
      }

      activeWord = selectedWord;
      activeR = r; 
      activeC = c;
    } else { 
      activeWord = null; 
      activeR = -1; 
      activeC = -1; 
    }
  } else { 
    activeWord = null; 
    activeR = -1; 
    activeC = -1; 
  }

  updateUI(); 
  drawCrossword(window.lastG, window.lastPlaced);
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
