// ==========================================
//  ФИЛВОРД (WORD SEARCH)
// ==========================================

const PH_CELL = 32, PH_PAD = 24, PH_TOPH = 20, PH_BPAD = 22;
const PH_LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const PH_DIRS = [
  {dr:0, dc:1}, {dr:0, dc:-1}, {dr:1, dc:0}, {dr:-1, dc:0},
  {dr:1, dc:1}, {dr:1, dc:-1}, {dr:-1, dc:1}, {dr:-1, dc:-1}
];

let phSize = 14;
let phGrid = [];
let phPlacements = []; // { w, cells:[{r,c}], r, c, dr, dc }
let phFound = new Set();
let phShowAnswers = false;

let phSelecting = false;
let phSelStart = null;  // {r,c}
let phSelEnd = null;    // {r,c}
let phSelCells = [];    // [{r,c}]

function philMakeGrid(size, fill = "") {
  return Array.from({ length: size }, () => Array(size).fill(fill));
}

function philRandLetter() {
  return PH_LETTERS[Math.floor(Math.random() * PH_LETTERS.length)];
}

function philNormWord(w) {
  return (w || "").toString().trim().toUpperCase();
}

function philGetPool(theme, level) {
  if (theme === "физмат") {
    const phys = DB["физика"]?.[level] ?? [];
    const math = DB["математика"]?.[level] ?? [];
    return [...phys, ...math];
  }
  return DB[theme]?.[level] ?? [];
}

function philPickWords(pool, size, targetCount) {
  const filtered = pool
    .map(i => ({ w: philNormWord(i.w), q: i.q }))
    .filter(i => i.w.length >= 3 && i.w.length <= size)
    .filter(i => /^[А-ЯЁ]+$/i.test(i.w));

  const uniq = new Map();
  filtered.forEach(i => { if (!uniq.has(i.w)) uniq.set(i.w, i); });

  let list = [...uniq.values()].filter(i => !philUsedWordsHistory.has(i.w));
  if (list.length < targetCount + 3) {
    philUsedWordsHistory.clear();
    list = [...uniq.values()];
  }

  list.sort((a, b) => b.w.length - a.w.length);
  return list.slice(0, Math.min(list.length, targetCount + 8));
}

function philCanPlaceWord(grid, word, r, c, dr, dc) {
  const size = grid.length;
  const L = word.length;
  const r2 = r + dr * (L - 1);
  const c2 = c + dc * (L - 1);
  if (r < 0 || c < 0 || r >= size || c >= size) return false;
  if (r2 < 0 || c2 < 0 || r2 >= size || c2 >= size) return false;

  for (let i = 0; i < L; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const ch = grid[rr][cc];
    if (ch !== "" && ch !== word[i]) return false;
  }
  return true;
}

function philPlaceWord(grid, word, r, c, dr, dc) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    grid[rr][cc] = word[i];
    cells.push({ r: rr, c: cc });
  }
  return cells;
}

function philTryPlace(grid, word, attempts = 250) {
  const size = grid.length;
  for (let t = 0; t < attempts; t++) {
    const dir = PH_DIRS[Math.floor(Math.random() * PH_DIRS.length)];
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (!philCanPlaceWord(grid, word, r, c, dir.dr, dir.dc)) continue;
    const cells = philPlaceWord(grid, word, r, c, dir.dr, dir.dc);
    return { r, c, dr: dir.dr, dc: dir.dc, cells };
  }
  return null;
}

function philFillEmpty(grid) {
  const size = grid.length;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!grid[r][c]) grid[r][c] = philRandLetter();
  }
}

function philRenderWordsList() {
  const box = document.getElementById("philWords");
  if (!box) return;

  let html = "";
  phPlacements.forEach((p, idx) => {
    const found = phFound.has(p.w);
    html += `<div class="phw-item ${found ? "found" : ""}" id="phw-${idx}"><b>${idx + 1}.</b> ${p.w}</div>`;
  });

  box.innerHTML = html || `<div class="clue-item">Слова не размещены</div>`;
}

function philUpdateStat() {
  const stat = document.getElementById("phil-stat");
  if (!stat) return;
  stat.textContent = `Найдено: ${phFound.size}/${phPlacements.length} | Размер: ${phSize}×${phSize}`;
}

function philUpdatePanel(text = "") {
  const panel = document.getElementById("phil-active-panel");
  if (!panel) return;

  if (phPlacements.length && phFound.size === phPlacements.length) {
    panel.textContent = "🎉 Все слова найдены!";
    panel.style.color = "#4ade80";
    markWin('philword');
    return;
  }

  panel.style.color = "#a855f7";
  panel.textContent = text || "Выделяйте слова протяжкой: по прямой (8 направлений)";
}

function philCellsKeySet(cells) {
  const s = new Set();
  cells.forEach(k => s.add(`${k.r},${k.c}`));
  return s;
}

function philDraw() {
  const cv = document.getElementById("cvPhil");
  if (!cv || !phGrid.length) return;

  const size = phGrid.length;
  cv.width = size * PH_CELL + PH_PAD * 2;
  cv.height = PH_TOPH + size * PH_CELL + PH_PAD * 2 + PH_BPAD;

  const ctx = cv.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, cv.width, cv.height);
  bg.addColorStop(0, "#06060f");
  bg.addColorStop(1, "#080816");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.strokeStyle = "#0e0e25";
  ctx.lineWidth = 1;
  for (let x = 0; x < cv.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
  for (let y = 0; y < cv.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }

  const selSet = philCellsKeySet(phSelCells || []);
  let ansSet = new Set();
  if (phShowAnswers) {
    phPlacements.forEach(p => p.cells.forEach(k => ansSet.add(`${k.r},${k.c}`)));
  }

  let foundSet = new Set();
  phPlacements.forEach(p => {
    if (!phFound.has(p.w)) return;
    p.cells.forEach(k => foundSet.add(`${k.r},${k.c}`));
  });

  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const x = PH_PAD + c * PH_CELL;
    const y = PH_PAD + PH_TOPH + r * PH_CELL;

    const key = `${r},${c}`;
    const isFound = foundSet.has(key);
    const isSel = selSet.has(key);
    const isAns = ansSet.has(key);

    ctx.fillStyle = isFound ? "#0f301d" : (isSel ? "#2a2a60" : (isAns ? "#0c2430" : "#0d0d22"));
    rrect(ctx, x + 1, y + 1, PH_CELL - 2, PH_CELL - 2, 4);
    ctx.fill();

    ctx.strokeStyle = isSel ? "#00d4ff" : "#00d4ff38";
    ctx.lineWidth = isSel ? 2 : 1;
    rrect(ctx, x + 1, y + 1, PH_CELL - 2, PH_CELL - 2, 4);
    ctx.stroke();

    ctx.fillStyle = isFound ? "#4ade80" : "#00d4ff";
    ctx.font = "bold " + Math.floor(PH_CELL * 0.52) + "px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(phGrid[r][c], x + PH_CELL / 2, y + PH_CELL / 2 + 1);
  }
}

function philPointerToCell(e) {
  const cv = document.getElementById("cvPhil");
  if (!cv) return null;

  const rect = cv.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (cv.width / rect.width);
  const y = (e.clientY - rect.top) * (cv.height / rect.height);

  const c = Math.floor((x - PH_PAD) / PH_CELL);
  const r = Math.floor((y - PH_PAD - PH_TOPH) / PH_CELL);

  if (r < 0 || c < 0 || r >= phSize || c >= phSize) return null;
  return { r, c };
}

function philBestDir(from, to) {
  let dr = to.r - from.r;
  let dc = to.c - from.c;
  if (dr === 0 && dc === 0) return { dr: 0, dc: 0, len: 0 };

  const adr = Math.abs(dr), adc = Math.abs(dc);

  if (adr === adc) {
    dr = Math.sign(dr);
    dc = Math.sign(dc);
    return { dr, dc, len: adr };
  }

  if (adr > adc) {
    dr = Math.sign(dr);
    dc = 0;
    return { dr, dc, len: adr };
  } else {
    dr = 0;
    dc = Math.sign(dc);
    return { dr, dc, len: adc };
  }
}

function philBuildLineCells(start, end) {
  const dir = philBestDir(start, end);
  const cells = [];
  for (let i = 0; i <= dir.len; i++) {
    const rr = start.r + dir.dr * i;
    const cc = start.c + dir.dc * i;
    if (rr < 0 || cc < 0 || rr >= phSize || cc >= phSize) break;
    cells.push({ r: rr, c: cc });
  }
  return cells;
}

function philStringFromCells(cells) {
  return cells.map(k => phGrid[k.r][k.c]).join("");
}

function philReverse(s) {
  return s.split("").reverse().join("");
}

function philCheckSelectionHit() {
  if (!phSelCells || phSelCells.length < 2) return false;

  const s = philStringFromCells(phSelCells);
  const sr = philReverse(s);

  const hit = phPlacements.find(p => !phFound.has(p.w) && (p.w === s || p.w === sr));
  if (!hit) return false;

  phFound.add(hit.w);
  philRenderWordsList();
  philUpdateStat();
  philUpdatePanel(`Найдено: ${hit.w}`);
  return true;
}

function philPointerDown(e) {
  if (!phGrid.length) return;
  const cell = philPointerToCell(e);
  if (!cell) return;

  phSelecting = true;
  phSelStart = cell;
  phSelEnd = cell;
  phSelCells = [cell];
  philUpdatePanel("Тяните до последней буквы слова");
  philDraw();
}

function philPointerMove(e) {
  if (!phSelecting || !phSelStart) return;
  const cell = philPointerToCell(e);
  if (!cell) return;

  phSelEnd = cell;
  phSelCells = philBuildLineCells(phSelStart, phSelEnd);
  philDraw();
}

function philPointerUp() {
  if (!phSelecting) return;
  phSelecting = false;

  const ok = philCheckSelectionHit();
  phSelStart = null;
  phSelEnd = null;
  phSelCells = [];

  if (!ok) philUpdatePanel();
  philDraw();
}

function philToggleAnswers() {
  if (!phGrid.length) return;
  phShowAnswers = !phShowAnswers;
  const btn = document.getElementById("btn-ph-answ");
  if (btn) btn.textContent = phShowAnswers ? "🔒 Скрыть" : "👁 Ответы";
  philDraw();
}

// Внутренняя генерация
function philGenerateCore() {
  phShowAnswers = false;
  const btn = document.getElementById("btn-ph-answ");
  if (btn) btn.textContent = "👁 Ответы";

  const sizeSel  = document.getElementById("sel-size-ph");
  const themeSel = document.getElementById("sel-theme-ph");
  const levelSel = document.getElementById("sel-level-ph");
  if (!sizeSel || !themeSel || !levelSel) return;

  phSize = parseInt(sizeSel.value, 10) || 14;

  const theme = themeSel.value;
  const level = levelSel.value;

  const pool = philGetPool(theme, level);
  if (!pool.length) {
    document.getElementById("phil-stat").textContent = "⚠️ Нет слов в базе для этого режима.";
    return;
  }

  const target = phSize <= 12 ? 10 : (phSize <= 14 ? 12 : 14);
  const candidates = philPickWords(pool, phSize, target);

  const grid = philMakeGrid(phSize, "");
  const placements = [];

  for (const item of candidates) {
    const placed = philTryPlace(grid, item.w, 280);
    if (!placed) continue;

    placements.push({
      w: item.w,
      r: placed.r, c: placed.c,
      dr: placed.dr, dc: placed.dc,
      cells: placed.cells
    });

    philUsedWordsHistory.add(item.w);
    if (placements.length >= target) break;
  }

  philFillEmpty(grid);

  phGrid = grid;
  phPlacements = placements;
  phFound = new Set();

  Storage.addGame('philword');

  philRenderWordsList();
  philUpdateStat();
  philUpdatePanel();
  philDraw();
}

// Публичная функция с попапом
function philGenerate() {
  if (!philHasProgress()) {
    philGenerateCore();
    return;
  }

  showConfirmPopup(
    'Сбросить текущий филворд и создать новый?',
    () => philGenerateCore(),
    () => {}
  );
}

function philInitOnce() {
  if (window.__philInited) return;
  window.__philInited = true;

  const cv = document.getElementById("cvPhil");
  if (cv) {
    cv.addEventListener("pointerdown", philPointerDown);
    window.addEventListener("pointermove", philPointerMove, { passive: true });
    window.addEventListener("pointerup", philPointerUp, { passive: true });
    window.addEventListener("pointercancel", philPointerUp, { passive: true });
  }
}
