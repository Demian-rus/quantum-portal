// ==========================================
//  СУДОКУ
// ==========================================

const SU_CELL = 54, SU_PAD = 14;
let suGrid = [];       // текущее состояние (0 - пусто)
let suSolution = [];   // полное решение
let suFixed = [];      // маска: true если это стартовая цифра (нельзя менять)
let suSelR = -1, suSelC = -1;
let suErrors = new Set(); // ошибки при проверке

function sudokuCountSolutions(board, limit = 2) {
  let count = 0;
  function search() {
    if (count >= limit) return;
    let bestR = -1, bestC = -1, candidates = null;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      const used = new Set();
      for (let k = 0; k < 9; k++) {
        used.add(board[r][k]);
        used.add(board[k][c]);
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) used.add(board[rr][cc]);
      const available = [];
      for (let n = 1; n <= 9; n++) if (!used.has(n)) available.push(n);
      if (available.length === 0) return;
      if (!candidates || available.length < candidates.length) {
        candidates = available;
        bestR = r; bestC = c;
      }
    }
    if (bestR === -1) { count++; return; }
    for (const n of candidates) {
      board[bestR][bestC] = n;
      search();
      board[bestR][bestC] = 0;
      if (count >= limit) return;
    }
  }
  search();
  return count;
}

function sudokuGenerateCore() {
  const diff = document.getElementById('sel-diff-su').value;

  // 1. Базовая сетка (сдвиг)
  const base = [1,2,3,4,5,6,7,8,9];
  suSolution = [];
  for(let r=0; r<9; r++) {
    const shift = (Math.floor(r / 3) + (r % 3) * 3) % 9; // 0,3,6, 1,4,7, 2,5,8
    const row = [];
    for(let c=0; c<9; c++) row.push(base[(c + shift) % 9]);
    suSolution.push(row);
  }

  // 2. Перемешивание (Shuffling)
  // Свап строк в пределах районов
  for(let i=0; i<20; i++) {
    const block = Math.floor(Math.random()*3);
    const r1 = block*3 + Math.floor(Math.random()*3);
    const r2 = block*3 + Math.floor(Math.random()*3);
    const temp = suSolution[r1]; suSolution[r1] = suSolution[r2]; suSolution[r2] = temp;
  }
  // Свап колонок в пределах районов
  for(let i=0; i<20; i++) {
    const block = Math.floor(Math.random()*3);
    const c1 = block*3 + Math.floor(Math.random()*3);
    const c2 = block*3 + Math.floor(Math.random()*3);
    for(let r=0; r<9; r++) {
      const temp = suSolution[r][c1]; suSolution[r][c1] = suSolution[r][c2]; suSolution[r][c2] = temp;
    }
  }
  // Свап районов строк (0-2, 3-5, 6-8)
  for(let i=0; i<5; i++) {
    const b1 = Math.floor(Math.random()*3);
    const b2 = Math.floor(Math.random()*3);
    if(b1 !== b2) {
      for(let k=0; k<3; k++) {
        const temp = suSolution[b1*3+k]; suSolution[b1*3+k] = suSolution[b2*3+k]; suSolution[b2*3+k] = temp;
      }
    }
  }

  // 3. Удаление цифр (Digging holes)
  suGrid = suSolution.map(r => [...r]);
  suFixed = Array.from({length:9}, () => Array(9).fill(true));

  const targets = { easy: 35, medium: 42, hard: 48, insane: 53 };
  const targetRemoved = targets[diff] || targets.medium;
  const positions = Array.from({ length: 81 }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  let removed = 0;
  for (const index of positions) {
    if (removed >= targetRemoved) break;
    const r = Math.floor(index / 9), c = index % 9;
    const old = suGrid[r][c];
    suGrid[r][c] = 0;
    if (sudokuCountSolutions(suGrid) === 1) {
      suFixed[r][c] = false;
      removed++;
    } else {
      suGrid[r][c] = old;
    }
  }

  suSelR = -1; suSelC = -1;
  suErrors.clear();
  document.getElementById('su-stat').textContent = `Сложность: ${diff.toUpperCase()}`;
  document.getElementById('su-active-panel').textContent = "Выберите клетку и введите цифру";
  document.getElementById('su-active-panel').style.color = "#fbbf24";

  Storage.addGame('sudoku');

  sudokuDraw();
}

// Обёртка с попапом
function sudokuGenerate() {
  if (!sudokuHasProgress()) {
    sudokuGenerateCore();
    return;
  }

  showConfirmPopup(
    'Сбросить текущее судоку и сгенерировать новое?',
    () => sudokuGenerateCore(),
    () => {}
  );
}

function sudokuDraw() {
  const cv = document.getElementById('cvSudoku');
  if(!cv) return;
  const ctx = cv.getContext('2d');

  const W = SU_CELL * 9 + SU_PAD * 2;
  cv.width = W; cv.height = W;

  const bg = ctx.createLinearGradient(0,0,W,W);
  bg.addColorStop(0,'#06060f'); bg.addColorStop(1,'#101025');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,W);

  if(!suGrid.length) return;

  const getX = (c) => SU_PAD + c * SU_CELL;
  const getY = (r) => SU_PAD + r * SU_CELL;

  for(let r=0; r<9; r++) {
    for(let c=0; c<9; c++) {
      const val = suGrid[r][c];
      const fixed = suFixed[r][c];
      const x = getX(c), y = getY(r);
      const isSel = (r === suSelR && c === suSelC);
      const isErr = suErrors.has(`${r},${c}`);

      if(isSel) ctx.fillStyle = "#2a2a60";
      else if(isErr) ctx.fillStyle = "#3f1a1a";
      else if(fixed) ctx.fillStyle = "#12122a";
      else ctx.fillStyle = "#0a0a18";

      ctx.fillRect(x, y, SU_CELL, SU_CELL);

      if(val !== 0) {
        ctx.fillStyle = fixed ? "#666688" : (isErr ? "#ff4444" : "#00d4ff");
        if(isSel) ctx.fillStyle = "#fff";
        ctx.font = (fixed ? "bold " : "") + "26px Segoe UI";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(val, x + SU_CELL/2, y + SU_CELL/2 + 2);
      }

      ctx.strokeStyle = "#222244"; ctx.lineWidth = 1;
      ctx.strokeRect(x, y, SU_CELL, SU_CELL);
    }
  }

  ctx.strokeStyle = "#00d4ff"; ctx.lineWidth = 2;
  ctx.beginPath();
  for(let i=0; i<=9; i+=3) {
    ctx.moveTo(getX(i), getY(0)); ctx.lineTo(getX(i), getY(9));
    ctx.moveTo(getX(0), getY(i)); ctx.lineTo(getX(9), getY(i));
  }
  ctx.stroke();

  if(suSelR !== -1) {
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2;
    ctx.strokeRect(getX(suSelC), getY(suSelR), SU_CELL, SU_CELL);
  }
}

function sudokuClick(e) {
  const cv = document.getElementById('cvSudoku');
  if(!cv) return;
  const rect = cv.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (cv.width / rect.width);
  const y = (e.clientY - rect.top) * (cv.height / rect.height);

  const c = Math.floor((x - SU_PAD) / SU_CELL);
  const r = Math.floor((y - SU_PAD) / SU_CELL);

  if(r>=0 && r<9 && c>=0 && c<9) {
    suSelR = r; suSelC = c;
    sudokuDraw();
  }
}

function sudokuInput(num) { // num: 0..9 (0 = clear)
  if(suSelR === -1 || suFixed[suSelR][suSelC]) return;
  suGrid[suSelR][suSelC] = num;
  suErrors.delete(`${suSelR},${suSelC}`);
  sudokuDraw();

  let filled = true;
  for(let r=0; r<9; r++) for(let c=0; c<9; c++) if(suGrid[r][c]===0) filled=false;
  if(filled) {
    let win = true;
    for(let r=0; r<9; r++) for(let c=0; c<9; c++) if(suGrid[r][c] !== suSolution[r][c]) win=false;
    if(win) {
      document.getElementById('su-active-panel').textContent = "🎉 СУДОКУ РЕШЕНО ВЕРНО!";
      document.getElementById('su-active-panel').style.color = "#4ade80";
      markWin('sudoku');
    }
  }
}

function sudokuCheck() {
  suErrors.clear();
  let errorsCount = 0;
  for(let r=0; r<9; r++) {
    for(let c=0; c<9; c++) {
      if(suGrid[r][c] !== 0 && suGrid[r][c] !== suSolution[r][c]) {
        suErrors.add(`${r},${c}`);
        errorsCount++;
      }
    }
  }
  sudokuDraw();
  const p = document.getElementById('su-active-panel');
  if(errorsCount === 0) {
    p.textContent = "✅ Ошибок нет"; p.style.color = "#4ade80";
  } else {
    p.textContent = `❌ Найдено ошибок: ${errorsCount}`; p.style.color = "#ff4444";
  }
}

function sudokuReset() {
  for(let r=0; r<9; r++) for(let c=0; c<9; c++) if(!suFixed[r][c]) suGrid[r][c] = 0;
  suErrors.clear();
  sudokuDraw();
}

function sudokuInitOnce() {
  if(window.__suInited) return;
  window.__suInited = true;

  const cv = document.getElementById('cvSudoku');
  if(cv) {
    cv.addEventListener('pointerdown', e => {
      sudokuClick(e);
    });
  }

  window.addEventListener('keydown', e => {
    if (e.target.id === 'hidden-input') return;
    if(document.getElementById('sec-sudoku').classList.contains('active')) {
      if(e.key >= '1' && e.key <= '9') sudokuInput(parseInt(e.key));
      if(e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') sudokuInput(0);

      if(suSelR !== -1) {
        if(e.key==='ArrowUp' && suSelR>0) suSelR--;
        if(e.key==='ArrowDown' && suSelR<8) suSelR++;
        if(e.key==='ArrowLeft' && suSelC>0) suSelC--;
        if(e.key==='ArrowRight' && suSelC<8) suSelC++;
        sudokuDraw();
      }
    }
  });
}
