// ==========================================
//  КВАНТ - УГАДАЙ СЛОВО ИЗ ТЕРМИНОВ
// ==========================================

const quantWordsUsed = new Set();
let quantCurrentWord = '';
let quantCurrentGuess = '';
let quantAttempts = 6;
let quantWins = 0;
let quantGameOver = false;
let quantWon = false;
let quantHint = '';

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

function quantDrawGrid() {
  const grid = document.getElementById('qntGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const wordLength = quantCurrentWord.length || 5;
  grid.style.gridTemplateColumns = `repeat(${wordLength}, 1fr)`;

  for (let i = 0; i < wordLength; i++) {
    const cell = document.createElement('div');
    cell.className = 'qnt-letter';
    cell.textContent = quantCurrentGuess[i] || '';
    grid.appendChild(cell);
  }
}

function quantDrawKeyboard() {
  const kb = document.getElementById('qntKeyboard');
  if (!kb) return;
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
      if (quantCurrentGuess.length > 0 && !quantGameOver) {
        quantCurrentGuess = quantCurrentGuess.slice(0, -1);
        quantDrawGrid();
      }
    };
  } else {
    btn.className = 'qnt-key';
    btn.onclick = () => {
      quantGuessLetter(letter);
    };
  }

  btn.textContent = letter;
  rowDiv.appendChild(btn);
});

    kb.appendChild(rowDiv);
  });
}

function quantGuessLetter(letter) {
  if (quantGameOver || !quantCurrentWord || quantCurrentGuess.length >= quantCurrentWord.length) return;

  quantCurrentGuess += letter;
  quantDrawGrid();

  if (quantCurrentGuess.length === quantCurrentWord.length) {
    setTimeout(quantCheckGuess, 500);
  }
}

function quantCheckGuess() {
  if (quantCurrentGuess === quantCurrentWord) {
    quantWon = true;
    quantGameOver = true;
    quantWins++;
    document.getElementById('qnt-active-panel').textContent = '🎉 ПРАВИЛЬНО! ' + quantCurrentWord;
    document.getElementById('qnt-active-panel').style.color = '#4ade80';
    document.getElementById('qnt-wins').textContent = quantWins;
    markWin('quant');
    quantDrawGrid();
    return;
  }

  quantAttempts--;
  document.getElementById('qnt-attempts').textContent = quantAttempts;

  if (quantAttempts <= 0) {
    quantGameOver = true;
    document.getElementById('qnt-active-panel').textContent = '❌ НЕПРАВИЛЬНО! Слово: ' + quantCurrentWord;
    document.getElementById('qnt-active-panel').style.color = '#ff4444';
    quantDrawGrid();
    return;
  }

  quantCurrentGuess = '';
  document.getElementById('qnt-active-panel').textContent = `Осталось попыток: ${quantAttempts}`;
  quantDrawGrid();
}

function quantShowHint() {
  if (quantGameOver || !quantCurrentWord) return;
  const revealed = Math.floor(quantCurrentWord.length / 2);
  let hint = '';
  for (let i = 0; i < quantCurrentWord.length; i++) {
    hint += i < revealed ? quantCurrentWord[i] : '_';
  }
  document.getElementById('qnt-active-panel').textContent = '💡 Подсказка: ' + hint;
}

function quantGenerateCore() {
  const theme = document.getElementById('sel-theme-qnt')?.value || 'физика';
  const level = document.getElementById('sel-level-qnt')?.value || 'легкий';

  let minLen = 5, maxLen = 5;
  if (level === 'средний') { minLen = 6; maxLen = 7; }
  if (level === 'сложный') { minLen = 7; maxLen = 10; }

  const pool = quantGetPool(theme, level);

  if (!pool.length) {
    document.getElementById('qnt-stat').textContent = '⚠️ Нет слов в базе';
    return;
  }

  const picked = quantPickWord(pool, minLen, maxLen);
  if (!picked) return;

  quantCurrentWord = picked.w;
  quantCurrentGuess = '';
  quantAttempts = 6;
  quantGameOver = false;
  quantWon = false;
  quantHint = picked.q;

  Storage.addGame('quant');

  document.getElementById('qnt-active-panel').textContent = '📝 ' + picked.q;
  document.getElementById('qnt-active-panel').style.color = '#06f3ff';
  document.getElementById('qnt-attempts').textContent = quantAttempts;
  document.getElementById('qnt-stat').textContent =
    `Слово из ${quantCurrentWord.length} букв | ${theme} | ${level}`;

  quantDrawGrid();
  quantDrawKeyboard();
}

function quantGenerate() {
  if (!quantHasProgress()) {
    quantGenerateCore();
    return;
  }

  showConfirmPopup(
    'Начать новую игру и сбросить текущие попытки?',
    () => quantGenerateCore(),
    () => {}
  );
}

function quantReset() {
  quantCurrentWord = '';
  quantCurrentGuess = '';
  quantAttempts = 6;
  quantGameOver = false;
  quantWon = false;
  document.getElementById('qnt-active-panel').textContent = 'Нажмите "Новое слово"';
  document.getElementById('qnt-active-panel').style.color = '#06f3ff';
  quantDrawGrid();
}
