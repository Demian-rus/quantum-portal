// ==========================================
// 📦 STORAGE MANAGER
// ==========================================
const Storage = {
  key: 'QP_Data_v1',
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key)) || {};

      // Базовая структура по умолчанию
      const norm = {
        stats: {
          crossword: { wins: 0, games: 0 },
          philword:  { wins: 0, games: 0 },
          sudoku:    { wins: 0, games: 0 },
          quant:     { wins: 0, games: 0 }
          // futureGameId: { wins: 0, games: 0 }
        },
        history: { words: [] }
      };

      // История
      if (raw.history && Array.isArray(raw.history.words)) {
        norm.history.words = raw.history.words;
      }

      // Статистика (поддержка старого формата, где было просто число)
      if (raw.stats) {
        Object.keys(raw.stats).forEach(game => {
          const val = raw.stats[game];
          if (typeof val === 'number') {
            norm.stats[game] = { wins: val, games: val };
          } else if (val && typeof val === 'object') {
            norm.stats[game] = {
              wins:  Number(val.wins  || 0),
              games: Number(val.games || 0)
            };
          }
        });
      }

      return norm;
    } catch {
      return {
        stats: {
          crossword: { wins: 0, games: 0 },
          philword:  { wins: 0, games: 0 },
          sudoku:    { wins: 0, games: 0 },
          quant:     { wins: 0, games: 0 }
        },
        history: { words: [] }
      };
    }
  },
  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  },
  addGame(game) {
    winMarked[game] = false; // A new round may be won once
    const data = this.load();
    if (!data.stats[game]) {
      data.stats[game] = { wins: 0, games: 0 };
    }
    data.stats[game].games++;
    this.save(data);
  },
  addWin(game) {
    const data = this.load();
    if (!data.stats[game]) {
      data.stats[game] = { wins: 0, games: 0 };
    }
    data.stats[game].wins++;
    if (data.stats[game].games < data.stats[game].wins) {
      data.stats[game].games = data.stats[game].wins;
    }
    this.save(data);
  },
  addWord(word) {
    const data = this.load();
    if (!data.history.words) data.history.words = [];
    data.history.words.push(word);
    if (data.history.words.length > 100) data.history.words.shift();
    this.save(data);
  },
  resetAll() {
    localStorage.removeItem(this.key);
  }
};



const winMarked = { crossword:false, philword:false, sudoku:false, quant:false };

function markWin(game){
  if (winMarked[game]) return;
  winMarked[game] = true;
  Storage.addWin(game);
}



// Инициализируем историю из памяти браузера
const usedWordsHistory = new Set(Storage.load().history.words);

// Переопределяем метод add у Set
const originalSetAdd = Set.prototype.add;
function rememberWord(word) {
  originalSetAdd.call(this, word);
  Storage.addWord(word);
  return this;
}
usedWordsHistory.add = rememberWord;

let philUsedWordsHistory = new Set(Storage.load().history.words);
philUsedWordsHistory.add = rememberWord;



// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ ДЛЯ НАВИГАЦИИ / КЛАВИАТУРЫ
// ==========================================
let currentSection = 'crossword';

function updateMobileKeyboardVisibility() {
  const kb = document.getElementById('mobile-keyboard');
  if (!kb) return;

  if (window.innerWidth >= 769) {
    // На десктопе всё равно прячем через CSS, но чтобы не мигало:
    kb.style.display = '';
    return;
  }

  if (currentSection === 'crossword' || currentSection === 'quant') {
    kb.style.display = 'flex';
  } else {
    kb.style.display = 'none';
  }
}

function attachMobileKeyboard() {
  const kb = document.getElementById('mobile-keyboard');
  if (!kb) return;
  if (window.innerWidth >= 769) return;

  const cwArea  = document.querySelector('#sec-crossword .game-area');
  const qntArea = document.querySelector('#sec-quant .qnt-area');

  // ОДИНАКОВО: клавиатура всегда прямым ребёнком игрового блока
  if (currentSection === 'crossword' && cwArea) {
    cwArea.appendChild(kb);
  } else if (currentSection === 'quant' && qntArea) {
    qntArea.appendChild(kb);
  }
}


// ==========================================
// ПОПАП ПОДТВЕРЖДЕНИЯ
// ==========================================
function showConfirmPopup(text, onOk, onCancel) {
  const wrap = document.getElementById('qp-popup');
  if (!wrap) { onOk && onOk(); return; }

  const textEl = document.getElementById('qp-popup-text');
  const ok = document.getElementById('qp-popup-ok');
  const cancel = document.getElementById('qp-popup-cancel');

  textEl.textContent = text;

  const clear = () => {
    ok.onclick = cancel.onclick = null;
    wrap.style.display = 'none';
  };

  ok.onclick = () => { clear(); onOk && onOk(); };
  cancel.onclick = () => { clear(); onCancel && onCancel(); };

  wrap.style.display = 'flex';
}



// ==========================================
// НАВИГАЦИЯ МЕЖДУ РЕЖИМАМИ
// ==========================================
let quantInited = false; // 🔹 ДОБАВЛЕНО: флаг ленивой инициализации Кванта

function switchTab(id) {
  currentSection = id;

  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.game-section').forEach(s => s.classList.remove('active'));

  // ищем нужную кнопку по data-target (для стартового экрана) или тексту
  const navBtn = Array.from(document.querySelectorAll('nav .tab')).find(btn => {
    return btn.textContent.toLowerCase().includes(
      id === 'quant' ? 'квант' :
      id === 'crossword' ? 'кроссворд' :
      id === 'philword' ? 'филворд' :
      id === 'sudoku' ? 'судоку' : ''
    );
  });
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('sec-' + id).classList.add('active');

  // чтобы ввод букв не продолжал лететь в скрытый кроссворд
  if (id !== 'crossword') {
    activeWord = null;
    activeR = -1;
    activeC = -1;
  }

  // ленивый старт филворда
  if (id === 'philword') {
    philInitOnce();
    if (!phGrid || !phGrid.length) philGenerate();
  }

  // Инициализация судоку
  if (id === 'sudoku') {
    sudokuInitOnce();
    if (!suGrid.length) sudokuGenerate();
  }

  // 🔹 НОВАЯ ИНИЦИАЛИЗАЦИЯ КВАНТА
  if (id === 'quant') {
    if (!quantInited && typeof initQuant === 'function') {
      initQuant();
      quantInited = true;
    }
    // старый quantGenerate больше не трогаем: раунды теперь через кнопку "Новая игра"
  }

  // Phone views open with a compact, optional clue list below the game.
  const sidebar = id === 'crossword' ? document.getElementById('sidebar') :
    id === 'philword' ? document.getElementById('philSidebar') : null;
  if (sidebar && window.innerWidth < 769 && !sidebar.dataset.initialMobileState) {
    sidebar.dataset.initialMobileState = '1';
    sidebar.classList.add('collapsed');
  }
  updateSidebarToggle(sidebar);
  updateMobileKeyboardVisibility();
  attachMobileKeyboard();
}



function updateSidebarToggle(sidebar) {
  if (!sidebar) return;
  const btn = sidebar.querySelector('.toggle-btn');
  if (!btn) return;
  const collapsed = sidebar.classList.contains('collapsed');
  const crossword = sidebar.id === 'sidebar';
  btn.textContent = collapsed ? '›' : '⌄';
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.setAttribute('aria-label', collapsed ?
    (crossword ? 'Показать вопросы' : 'Показать слова') :
    (crossword ? 'Скрыть вопросы' : 'Скрыть слова'));
}
function toggleSidebar(e) {
  if (e) e.stopPropagation();
  const sidebar = document.getElementById('sec-crossword')?.classList.contains('active') ?
    document.getElementById('sidebar') :
    document.getElementById('sec-philword')?.classList.contains('active') ?
    document.getElementById('philSidebar') : null;
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  updateSidebarToggle(sidebar);
}



// ==========================================
// УТИЛИТЫ / РЕНДЕР
// ==========================================
function getResponsiveCell() {
  const vw = window.innerWidth;
  if (vw <= 420) return 20;
  if (vw <= 650) return 25;
  return 32;
}

function rrect(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}



// ==========================================
// ЛОГИКА ПРОГРЕССА ДЛЯ ПОПАПОВ
// ==========================================
function crosswordHasProgress() {
  if (!userGrid || !userGrid.length) return false;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (userGrid[r][c]) return true;
    }
  }
  return false;
}

function philHasProgress() {
  return phGrid && phGrid.length > 0 && (phFound.size > 0);
}

function sudokuHasProgress() {
  if (!suGrid || !suGrid.length || !suSolution || !suSolution.length) return false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!suFixed[r][c] && suGrid[r][c] !== 0) return true;
    }
  }
  return false;
}

function quantHasProgress() {
  if (typeof Quant === 'undefined' || !Quant.targetWord || Quant.finished) return false;
  if (Quant.triesLeft < Quant.maxTries) return true;
  if (Quant.mode === 'term') return Quant.termState.some(c => !!c.letter);
  return Quant.wordleState.some(row => row.some(c => !!c.letter));
}



// ==========================================
// СТАТИСТИКА (ПОПАП)
// ==========================================
function renderStatsPopup() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const data = Storage.load().stats || {};
  const defs = {
    crossword: 'Кроссворд',
    philword:  'Филворд',
    sudoku:    'Судоку',
    quant:     'Квант'
    // futureGameId: 'Название будущей игры'
  };

  let html = '';
  Object.keys(defs).forEach(id => {
    const s = data[id] || { wins: 0, games: 0 };
    const games = s.games || 0;
    const wins  = s.wins  || 0;
    const rate  = games ? Math.round((wins / games) * 100) : 0;

    html += `
      <div class="stats-card">
        <div class="stats-card-title">${defs[id]}</div>
        <div class="stats-row">
          <span>Партий:</span>
          <span class="value">${games}</span>
        </div>
        <div class="stats-row">
          <span>Побед:</span>
          <span class="value">${wins}</span>
        </div>
        <div class="stats-row">
          <span>Успех:</span>
          <span class="value">${rate}%</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<div class="stats-card">Пока нет данных.</div>';
}

function openStatsPopup() {
  renderStatsPopup();
  const el = document.getElementById('stats-popup');
  if (el) el.style.display = 'flex';
}

function closeStatsPopup() {
  const el = document.getElementById('stats-popup');
  if (el) el.style.display = 'none';
}



// ==========================================
// СТАРТОВЫЙ ЭКРАН
// ==========================================
function initStartScreen() {
  const start = document.getElementById('start-screen');
  if (!start) return;

  // Кнопки выбора режимов на стартовом экране
  start.querySelectorAll('.start-buttons button[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-target'); // 'crossword' | 'philword' | ...
      start.style.display = 'none';

      switchTab(id);
    });
  });

  const btnStats = document.getElementById('btn-open-stats');
  if (btnStats) btnStats.addEventListener('click', openStatsPopup);

  const btnCloseStats = document.getElementById('btn-close-stats');
  if (btnCloseStats) btnCloseStats.addEventListener('click', closeStatsPopup);

  const btnResetStats = document.getElementById('btn-reset-stats');
  if (btnResetStats) {
    btnResetStats.addEventListener('click', () => {
      showConfirmPopup(
        'Сбросить всю статистику (победы, партии, историю слов)?',
        () => {
          Storage.resetAll();
          renderStatsPopup();
        },
        () => {}
      );
    });
  }
}

function initMenuButton() {
  const btn = document.getElementById('btn-main-menu');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const start = document.getElementById('start-screen');
    if (!start) return;
    start.style.display = 'flex';
  });
}



// ==========================================
// СКРЫТЫЙ INPUT ДЛЯ ВВОДА С КЛАВЫ/МОБИЛКИ
// ==========================================
const hiddenInput = document.getElementById('hidden-input');

if (hiddenInput) {
  hiddenInput.addEventListener('input', (e) => {
    const char = e.data;
    hiddenInput.value = '';

    if (document.getElementById('sec-crossword').classList.contains('active') && activeWord) {
      if (char && /[а-яёa-z]/i.test(char)) handleInput(char);
    }

    if (document.getElementById('sec-sudoku').classList.contains('active')) {
      if (char && /[1-9]/.test(char)) sudokuInput(parseInt(char));
      if (char === '0') sudokuInput(0);
    }
  });

  hiddenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      if (document.getElementById('sec-crossword').classList.contains('active')) handleInput('Backspace');
      if (document.getElementById('sec-sudoku').classList.contains('active')) sudokuInput(0);
    }
  });
}



// ==========================================
// ГЛОБАЛЬНЫЕ HOTKEY'И
// ==========================================
window.addEventListener('keydown', e => {
  if (e.target && e.target.id === 'hidden-input') return;
  if (e.target.id === 'hidden-input') return;
  if (currentSection === 'crossword' && activeWord && !isSolved) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (/[а-яёa-z]/i.test(e.key) && e.key.length === 1) {
      handleInput(e.key);
    } else if (e.key === 'Backspace') {
      handleInput('Backspace');
    }
  }
});



// ==========================================
// RESPONSIVE UI: layout comes from CSS, not canvas-height observers.
// ==========================================
window.addEventListener('resize', () => {
  updateMobileKeyboardVisibility();
  attachMobileKeyboard();
});
document.addEventListener('DOMContentLoaded', () => {
  updateSidebarToggle(document.getElementById('sidebar'));
  updateSidebarToggle(document.getElementById('philSidebar'));
});

// Для отладки доступны контекстное меню браузера и F12.



// ==========================================
// ОБРАБОТЧИК КЛИКОВ ПО ОБЩЕЙ МОБИЛЬНОЙ КЛАВИАТУРЕ
// ==========================================
(function initMobileKeyboardRouting() {
  const kb = document.getElementById('mobile-keyboard');
  if (!kb) return;

  kb.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;

    const key = btn.dataset.key;

    if (currentSection === 'crossword') {
      if (!activeWord) return;
      if (key === 'Backspace') {
        handleInput('Backspace');
      } else {
        handleInput(key);
      }
    } else if (currentSection === 'quant') {
      if (key === 'Backspace') window.quantBackspace?.();
      else if (key === 'Enter') window.quantEnter?.();
      else window.quantGuessLetter?.(key);
    }
  });
})();



// ==========================================
// ONLOAD
// ==========================================
window.onload = () => {
  philInitOnce();
  sudokuInitOnce();
  initStartScreen();
  initMenuButton();
  // стартовая секция — кроссворд
  currentSection = 'crossword';
  updateMobileKeyboardVisibility();
  attachMobileKeyboard();

  // Инициализация Кванта при первом открытии вкладки, а не на старте сайта.
};
