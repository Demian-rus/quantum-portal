// ==========================================
//  КВАНТ - УГАДАЙ СЛОВО ИЗ ТЕРМИНОВ / WORDLE
// ==========================================

// Старые переменные пока оставим для совместимости статистики (wins)
const quantWordsUsed = new Set();
let quantWins = 0;

// === ГЛОБАЛЬНОЕ СОСТОЯНИЕ ДЛЯ НОВОГО КВАНТА ===
const Quant = {
  mode: 'term',          // 'term' | 'wordle'
  difficulty: 'easy',    // 'easy' | 'medium' | 'hard'
  targetWord: '',
  triesLeft: 5,
  maxTries: 5,

  // Термин
  termState: [],         // [{ letter: '', fixed: false }, ...]

  // Wordle
  currentRow: 0,
  maxRows: 5,
  wordleState: [],       // [ [ { letter, status }, ... ], ... ]
};


// === ВСПОМОГАТЕЛЬНОЕ: ПУЛ СЛОВ (ИЗ ТВОЕЙ БД) ===

function quantGetPool(theme, level) {
  if (theme === 'физмат') {
    const phys = DB['физика']?.[level] ?? [];
    const math = DB['математика']?.[level] ?? [];
    return [...phys, ...math];
  }
  return DB[theme]?.[level] ?? [];
}

function quantPickWord(pool, minLen = 5, maxLen = 5) {
  let candidates = pool
    .map(i => ({ w: (i.w || '').toUpperCase(), q: i.q }))
    .filter(i => i.w.length >= minLen && i.w.length <= maxLen && /^[А-ЯЁ]+$/.test(i.w));

  const uniq = new Map();
  candidates.forEach(i => {
    if (!uniq.has(i.w)) uniq.set(i.w, i);
  });

  let list = [...uniq.values()].filter(i => !quantWordsUsed.has(i.w));
  if (list.length < 3) { quantWordsUsed.clear(); list = [...uniq.values()]; }
  if (!list.length) return null;

  const picked = list[Math.floor(Math.random() * list.length)];
  quantWordsUsed.add(picked.w);
  return picked;
}


// === ИНИЦИАЛИЗАЦИЯ КВАНТА (ЗОВЁМ ИЗ core.js ПРИ ПЕРВОМ ВХОДЕ В ТАБ) ===

function initQuant() {
  const modeBtns = document.querySelectorAll('.qnt-mode-btn');
  const diffBtns = document.querySelectorAll('.qnt-diff-btn');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => setQuantMode(btn.dataset.mode));
  });

  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => setQuantDifficulty(btn.dataset.diff));
  });

  // стартовые значения
  setQuantMode('term');
  setQuantDifficulty('easy');
  updateQuantStatLine('Готов к игре Квант');

  // отрисуем десктопную клаву
  quantDrawKeyboardDesktop();
}

function updateQuantStatLine(text) {
  const el = document.getElementById('qnt-stat');
  if (el) el.textContent = text;
}

// Кнопка "⟳ Новая игра" в index.html
function quantNewRound() {
  if (Quant.mode === 'term') {
    initQuantTermRound();
  } else {
    initQuantWordleRound();
  }
}

function setQuantMode(mode) {
  Quant.mode = mode;

  document.querySelectorAll('.qnt-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  const termGrid  = document.getElementById('qnt-term-grid');
  const wordleGrid = document.getElementById('qnt-wordle-grid');
  const hint      = document.getElementById('qnt-term-hint');
  const panel     = document.getElementById('qnt-active-panel');

  if (mode === 'term') {
    termGrid.hidden  = false;
    hint.hidden      = false;
    wordleGrid.hidden = true;
    panel.textContent = 'Угадайте термин по определению';
    initQuantTermRound();   // 🔹 сразу готовим поле и слово
  } else {
    termGrid.hidden   = true;
    hint.hidden       = true;
    wordleGrid.hidden = false;
    panel.textContent = 'Угадайте слово за 5 попыток';
    initQuantWordleRound(); // 🔹 сразу готовим wordle-сетку
  }
}


function setQuantDifficulty(diff) {
  Quant.difficulty = diff;
  document.querySelectorAll('.qnt-diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === diff);
  });

  quantNewRound();
}


// === МАРШРУТИЗАЦИЯ ВВОДА ОТ КЛАВИАТУР ===

function quantHandleInput(ch) {
  ch = ch.toUpperCase();

  if (Quant.mode === 'term') {
    quantTermInput(ch);
  } else {
    quantWordleInput(ch);
  }
}

function quantHandleBackspace() {
  if (Quant.mode === 'term') {
    quantTermBackspace();
  } else {
    quantWordleBackspace();
  }
}

// Экспорт для core.js и #mobile-keyboard
window.quantGuessLetter = quantHandleInput;
window.quantBackspace   = quantHandleBackspace;


// ==========================================
//  РЕЖИМ "ТЕРМИН" (с вопросом, фиксируем буквы)
// ==========================================

function pickQuantTermWord(difficulty) {
  // Используем те же селекты, что были раньше, чтобы не ломать БД:
  const theme = document.getElementById('sel-theme-qnt')?.value || 'физика';
  const level = document.getElementById('sel-level-qnt')?.value || 'легкий';

  let minLen = 5, maxLen = 5;
  if (difficulty === 'medium') { minLen = 6; maxLen = 7; }
  if (difficulty === 'hard')   { minLen = 7; maxLen = 10; }

  const pool = quantGetPool(theme, level);
  const picked = quantPickWord(pool, minLen, maxLen);
  return picked; // { w, q }
}

function initQuantTermRound() {
  const picked = pickQuantTermWord(Quant.difficulty);
  const panel = document.getElementById('qnt-active-panel');

  if (!picked) {
    updateQuantStatLine('⚠️ Нет слов в базе');
    panel.textContent = 'Нет терминов для выбранной темы';
    return;
  }

  Quant.targetWord = picked.w;
  Quant.triesLeft = Quant.maxTries;

  Quant.termState = Array.from({ length: Quant.targetWord.length }, () => ({
    letter: '',
    fixed: false,
  }));

  const grid = document.getElementById('qnt-term-grid');
  grid.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'qnt-grid-term-row';

  for (let i = 0; i < Quant.targetWord.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'qnt-cell';
    cell.dataset.index = i;
    row.appendChild(cell);
  }

  grid.appendChild(row);

  document.getElementById('qnt-term-hint').textContent = picked.q || '';
  document.getElementById('qnt-attempts').textContent = Quant.triesLeft;
  updateQuantStatLine(
    `Термин: слово из ${Quant.targetWord.length} букв | ${picked.q ? 'есть определение' : 'без определения'}`
  );

  panel.style.color = '#06f3ff';
  renderQuantTermRow(false);

  // записываем игру
  Storage.addGame('quant');
}

function quantTermInput(ch) {
  if (!Quant.targetWord) return;
  if (Quant.triesLeft <= 0) return;

  const length = Quant.termState.length;
  let idx = -1;
  for (let i = 0; i < length; i++) {
    if (!Quant.termState[i].fixed && Quant.termState[i].letter === '') {
      idx = i;
      break;
    }
  }
  if (idx === -1) return;

  Quant.termState[idx].letter = ch;
  renderQuantTermRow(false);

  const filled = Quant.termState.every(c => c.letter !== '');
  if (filled) {
    quantTermCheckAttempt();
  }
}

function quantTermBackspace() {
  if (!Quant.targetWord) return;
  if (Quant.triesLeft <= 0) return;

  const length = Quant.termState.length;
  for (let i = length - 1; i >= 0; i--) {
    if (!Quant.termState[i].fixed && Quant.termState[i].letter !== '') {
      Quant.termState[i].letter = '';
      break;
    }
  }
  renderQuantTermRow(false);
}

function quantTermCheckAttempt() {
  if (!Quant.targetWord) return;
  if (Quant.triesLeft <= 0) return;

  Quant.triesLeft--;
  document.getElementById('qnt-attempts').textContent = Quant.triesLeft;

  const word = Quant.targetWord;
  const guess = Quant.termState.map(c => c.letter).join('');
  const length = word.length;
  const panel = document.getElementById('qnt-active-panel');

  // фиксируем правильно стоящие буквы
  for (let i = 0; i < length; i++) {
    if (guess[i] === word[i]) {
      Quant.termState[i].fixed = true;
    }
  }

  renderQuantTermRow(true);

  if (guess === word) {
    quantWins++;
    document.getElementById('qnt-wins').textContent = quantWins;
    markWin('quant');
    Storage.addGame('quant');
    panel.textContent = '🎉 ПРАВИЛЬНО! ' + word;
    panel.style.color = '#4ade80';
    updateQuantStatLine('Термин: победа');
    return;
  }

  if (Quant.triesLeft === 0) {
    Storage.addGame('quant');
    panel.textContent = '❌ НЕПРАВИЛЬНО! Слово: ' + word;
    panel.style.color = '#ff4444';
    updateQuantStatLine('Термин: попытки закончились');
  } else {
    panel.textContent = `Осталось попыток: ${Quant.triesLeft}`;
    panel.style.color = '#06f3ff';
  }
}

function renderQuantTermRow(showColors) {
  const cells = document.querySelectorAll('#qnt-term-grid .qnt-cell');
  const word = Quant.targetWord || '';

  Quant.termState.forEach((c, i) => {
    const cell = cells[i];
    cell.textContent = c.letter || '';
    cell.className = 'qnt-cell';

    if (c.fixed) {
      cell.classList.add('qnt-cell-fixed');
    }
    if (showColors && c.letter && word) {
      if (c.letter === word[i]) {
        cell.classList.add('qnt-cell-correct');
      } else if (word.includes(c.letter)) {
        cell.classList.add('qnt-cell-present');
      } else {
        cell.classList.add('qnt-cell-absent');
      }
    }
  });
}


// ==========================================
//  РЕЖИМ "WORDLE" (5 строк, без вопроса)
// ==========================================

function getWordLengthByDifficulty(diff) {
  if (diff === 'easy') return 5;
  if (diff === 'medium') return 6;
  return 8; // hard
}

function pickQuantWordleWord(difficulty) {
  // берем из той же БД, что и Термин, но без учета определения
  const theme = document.getElementById('sel-theme-qnt')?.value || 'физика';
  const level = document.getElementById('sel-level-qnt')?.value || 'легкий';

  const pool = quantGetPool(theme, level);
  const length = getWordLengthByDifficulty(difficulty);

  const filtered = pool
    .map(i => (i.w || '').toUpperCase())
    .filter(w => w.length === length && /^[А-ЯЁ]+$/.test(w));

  if (!filtered.length) return null;

  const word = filtered[Math.floor(Math.random() * filtered.length)];
  return word;
}

function initQuantWordleRound() {
  const word = pickQuantWordleWord(Quant.difficulty);
  const panel = document.getElementById('qnt-active-panel');

  if (!word) {
    updateQuantStatLine('⚠️ Нет подходящих слов для Wordle');
    panel.textContent = 'Нет слов нужной длины для выбранной темы';
    return;
  }

  Quant.targetWord = word;
  Quant.maxRows = 5;
  Quant.currentRow = 0;
  Quant.triesLeft = Quant.maxTries;

  const length = Quant.targetWord.length;
  Quant.wordleState = Array.from({ length: Quant.maxRows }, () =>
    Array.from({ length }, () => ({ letter: '', status: 'empty' }))
  );

  const grid = document.getElementById('qnt-wordle-grid');
  grid.innerHTML = '';

  for (let r = 0; r < Quant.maxRows; r++) {
    const row = document.createElement('div');
    row.className = 'qnt-grid-wordle-row';
    row.dataset.row = r;
    for (let c = 0; c < length; c++) {
      const cell = document.createElement('div');
      cell.className = 'qnt-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  document.getElementById('qnt-attempts').textContent = Quant.triesLeft;
  updateQuantStatLine(`Wordle: слово из ${length} букв`);

  panel.style.color = '#06f3ff';
  panel.textContent = 'Угадайте слово за 5 попыток';

  Storage.addGame('quant');
  renderQuantWordleGrid();
}

function quantWordleInput(ch) {
  if (!Quant.targetWord) return;
  if (Quant.triesLeft <= 0) return;

  const row = Quant.currentRow;
  if (row >= Quant.maxRows) return;

  const cols = Quant.wordleState[row];
  const length = cols.length;

  let ci = -1;
  for (let c = 0; c < length; c++) {
    if (!cols[c].letter) {
      ci = c;
      break;
    }
  }
  if (ci === -1) return;

  cols[ci].letter = ch;
  renderQuantWordleGrid();

  const filled = cols.every(c => c.letter);
  if (filled) {
    quantWordleCheckAttempt();
  }
}

function quantWordleBackspace() {
  if (!Quant.targetWord) return;
  if (Quant.triesLeft <= 0) return;

  const row = Quant.currentRow;
  if (row >= Quant.maxRows) return;

  const cols = Quant.wordleState[row];
  const length = cols.length;

  for (let c = length - 1; c >= 0; c--) {
    if (cols[c].letter) {
      cols[c].letter = '';
      break;
    }
  }
  renderQuantWordleGrid();
}

function quantWordleCheckAttempt() {
  const row = Quant.currentRow;
  const cols = Quant.wordleState[row];
  const word = Quant.targetWord;
  if (!word) return;

  const length = word.length;
  const guess = cols.map(c => c.letter).join('');
  const panel = document.getElementById('qnt-active-panel');

  Quant.triesLeft--;
  document.getElementById('qnt-attempts').textContent = Quant.triesLeft;

  const targetArr = word.split('');
  const used = Array(length).fill(false);

  // correct
  for (let i = 0; i < length; i++) {
    if (guess[i] === word[i]) {
      cols[i].status = 'correct';
      used[i] = true;
    }
  }

  // present / absent
  for (let i = 0; i < length; i++) {
    if (cols[i].status === 'correct') continue;
    const ch = guess[i];
    let found = false;
    for (let j = 0; j < length; j++) {
      if (!used[j] && targetArr[j] === ch) {
        found = true;
        used[j] = true;
        break;
      }
    }
    cols[i].status = found ? 'present' : 'absent';
  }

  renderQuantWordleGrid();

  if (guess === word) {
    quantWins++;
    document.getElementById('qnt-wins').textContent = quantWins;
    markWin('quant');
    Storage.addGame('quant');
    panel.textContent = '🎉 ПРАВИЛЬНО! ' + word;
    panel.style.color = '#4ade80';
    updateQuantStatLine('Wordle: победа');
    return;
  }

  if (Quant.triesLeft === 0 || Quant.currentRow === Quant.maxRows - 1) {
    Storage.addGame('quant');
    panel.textContent = '❌ НЕПРАВИЛЬНО! Слово: ' + word;
    panel.style.color = '#ff4444';
    updateQuantStatLine('Wordle: попытки закончились');
    return;
  }

  Quant.currentRow++;
  panel.textContent = `Осталось попыток: ${Quant.triesLeft}`;
  panel.style.color = '#06f3ff';
}

function renderQuantWordleGrid() {
  const rows = document.querySelectorAll('#qnt-wordle-grid .qnt-grid-wordle-row');

  for (let r = 0; r < Quant.wordleState.length; r++) {
    const cols = Quant.wordleState[r];
    const rowEl = rows[r];
    const cells = rowEl.querySelectorAll('.qnt-cell');

    cols.forEach((c, i) => {
      const cell = cells[i];
      cell.textContent = c.letter || '';
      cell.className = 'qnt-cell';

      if (c.status === 'correct') {
        cell.classList.add('qnt-cell-correct');
      } else if (c.status === 'present') {
        cell.classList.add('qnt-cell-present');
      } else if (c.status === 'absent') {
        cell.classList.add('qnt-cell-absent');
      }

      if (r === Quant.currentRow && Quant.targetWord) {
        cell.style.boxShadow = '0 0 6px #0f0';
      } else {
        cell.style.boxShadow = 'none';
      }
    });
  }
}


// ==========================================
//  ДЕСКТОПНАЯ КЛАВИАТУРА КВАНТА (НЕ МЕНЯЛ СТИЛИ)
// ==========================================

function quantDrawKeyboardDesktop() {
  const kb = document.getElementById('qntKeyboardDesktop');
  if (!kb) return;

  if (window.innerWidth < 769) {
    kb.innerHTML = '';
    return;
  }

  kb.innerHTML = '';

  const rows = [
    'ЙЦУКЕНГШЩЗХЪ'.split(''),
    'ФЫВАПРОЛДЖЭ'.split(''),
    ['Я','Ч','С','М','И','Т','Ь','Б','Ю','⌫']
  ];

  rows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'qnt-key-row';

    row.forEach(letter => {
      const btn = document.createElement('button');

      if (letter === '⌫') {
        btn.className = 'qnt-key qnt-del';
        btn.onclick = () => {
          quantHandleBackspace();
        };
      } else {
        btn.className = 'qnt-key';
        btn.onclick = () => {
          quantHandleInput(letter);
        };
      }

      btn.textContent = letter;
      rowDiv.appendChild(btn);
    });

    kb.appendChild(rowDiv);
  });
}
