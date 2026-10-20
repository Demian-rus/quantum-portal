'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

for (const name of ['core.js', 'quant.js', 'crossword.js', 'philword.js', 'sudoku.js', 'db.js']) {
  test(name + ' parses', () => assert.doesNotThrow(() => new vm.Script(read(name))));
}

function fakeElement(id = '') {
  return {
    id, style: {}, dataset: {}, children: [], hidden: false,
    className: '', textContent: '', innerHTML: '',
    classList: { add() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    querySelectorAll(selector) { return selector === '.qnt-cell' ? this.children : []; }
  };
}

test('Quant: each round is counted once, word inputs submit on Enter, wins are repeatable', () => {
  const map = new Map();
  const document = {
    getElementById(id) {
      if (!map.has(id)) map.set(id, fakeElement(id));
      return map.get(id);
    },
    createElement() { return fakeElement(); },
    querySelectorAll(selector) {
      if (selector === '#qnt-term-grid .qnt-cell')
        return map.get('qnt-term-grid')?.children[0]?.children || [];
      if (selector === '#qnt-wordle-grid .qnt-grid-wordle-row')
        return map.get('qnt-wordle-grid')?.children || [];
      return [];
    }
  };
  let games = 0, wins = 0;
  const window = { innerWidth: 500, addEventListener() {} };
  const DB = {
    физика: {
      легкий: [{ w: 'МАССА', q: 'Масса тела' }, { w: 'ВОЛНА', q: 'Перенос энергии' }],
      средний: [{ w: 'ЭНЕРГИЯ', q: 'Способность совершать работу' }],
      сложный: []
    },
    математика: {
      легкий: [{ w: 'СУММА', q: 'Результат сложения' }],
      средний: [],
      сложный: []
    }
  };
  const Storage = {
    addGame() { games++; },
    load() { return { stats: { quant: { games, wins } } }; }
  };
  const context = vm.createContext({
    document, window, DB, Storage,
    markWin() { wins++; },
    quantHasProgress() { return false; },
    showConfirmPopup() {}
  });
  vm.runInContext(read('quant.js'), context);
  context.initQuant();
  assert.equal(games, 1);
  let state = vm.runInContext('Quant', context);
  for (const letter of state.targetWord) window.quantGuessLetter(letter);
  assert.equal(state.triesLeft, 5, 'Typing must not auto-submit');
  window.quantEnter();
  assert.equal(wins, 1);
  assert.equal(games, 1);
  assert.equal(state.finished, true);

  context.quantNewRound(true);
  assert.equal(games, 2);
  context.setQuantMode('wordle', false);
  context.quantNewRound(true);
  assert.equal(games, 3);
  state = vm.runInContext('Quant', context);
  for (const letter of state.targetWord) window.quantGuessLetter(letter);
  assert.equal(state.triesLeft, 5);
  window.quantEnter();
  assert.equal(wins, 2);
  assert.equal(games, 3);
  assert.equal(state.finished, true);
});

test('Sudoku: every difficulty generates a uniquely solvable puzzle', () => {
  let diff = 'easy', gameStarts = 0;
  const elements = new Map();
  const canvasContext = new Proxy({}, {
    get(_target, property) {
      return property === 'createLinearGradient'
        ? () => ({ addColorStop() {} })
        : () => {};
    }
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, id === 'cvSudoku'
          ? { getContext() { return canvasContext; }, width: 0, height: 0 }
          : { style: {}, value: '', textContent: '' });
      }
      if (id === 'sel-diff-su') elements.get(id).value = diff;
      return elements.get(id);
    }
  };
  const ctx = vm.createContext({
    document,
    Storage: { addGame() { gameStarts++; } },
    markWin() {}
  });
  vm.runInContext(read('sudoku.js'), ctx);
  for (const difficulty of ['easy', 'medium', 'hard', 'insane']) {
    diff = difficulty;
    ctx.sudokuGenerateCore();
    const board = vm.runInContext('suGrid.map(row => row.slice())', ctx);
    assert.equal(ctx.sudokuCountSolutions(board), 1, difficulty + ' must have one solution');
  }
  assert.equal(gameStarts, 4);
});
