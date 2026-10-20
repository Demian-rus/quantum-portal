'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

async function navigate(page, game) {
  await page.locator('#sec-' + game).evaluate((element, name) => {
    document.querySelector('nav [data-tab="' + name + '"]').click();
  }, game);
}

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox']
  });
  try {
    for (const profile of [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 390, height: 844, name: 'phone' },
      { width: 768, height: 1024, name: 'tablet' }
    ]) {
      const page = await browser.newPage({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: 1
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
      await page.locator('#start-screen [data-target="crossword"]').click();
      await page.waitForFunction(() => window.lastPlaced?.length >= 10, null, { timeout: 18000 });

      const shell = await page.evaluate(() => {
        const nav = document.querySelector('.qp-nav');
        const bar = document.querySelector('#sec-crossword .game-toolbar');
        const canvas = document.querySelector('#cv');
        return {
          titleGone: !document.querySelector('.header-area'),
          settingsInNav: nav.contains(document.getElementById('btn-open-settings')),
          gameTop: canvas.getBoundingClientRect().top,
          toolbarHeight: bar.getBoundingClientRect().height,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          sidebarCollapsed: document.getElementById('sidebar').classList.contains('collapsed'),
          navTabs: [...nav.querySelectorAll('.tab')].map(b => ({
            text: b.textContent.trim(), width: b.clientWidth, scrollWidth: b.scrollWidth
          })),
          settingsVisible: (() => {
            const r = document.getElementById('btn-open-settings').getBoundingClientRect();
            return r.left >= 0 && r.right <= window.innerWidth;
          })()
        };
      });
      assert.ok(shell.titleGone && shell.settingsInNav, 'Navigation should contain compact settings without title');
      assert.ok(shell.gameTop < (profile.width <= 768 ? 280 : 240), 'Crossword too far below viewport: ' + shell.gameTop);
      assert.ok(shell.toolbarHeight < (profile.width <= 768 ? 100 : 58), 'Top toolbar too tall: ' + shell.toolbarHeight);
      assert.ok(shell.overflow <= 2, 'Horizontal overflow: ' + shell.overflow);
      assert.ok(shell.settingsVisible, 'Settings clipped offscreen');
      for (const tab of shell.navTabs)
        assert.ok(tab.scrollWidth <= tab.width + 2, 'Clipped nav tab: ' + JSON.stringify(tab));
      if (profile.width < 769) {
        assert.ok(shell.sidebarCollapsed, 'Phone sidebar should start closed');
        const noScroll = await page.evaluate(() => {
          const cv = document.getElementById('cv');
          const layout = cwLayout;
          const p = window.lastPlaced[0];
          const rect = cv.getBoundingClientRect();
          const x = rect.left + (layout.pad + (p.c - layout.c0 + .5) * layout.cell) * rect.width / layout.width;
          const y = rect.top + (layout.pad + (p.r - layout.r0 + .5) * layout.cell) * rect.height / layout.height;
          window.scrollTo(0, 0);
          const before = window.scrollY;
          cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
          return { before, after: window.scrollY, matched: activeR === p.r && activeC === p.c };
        });
        assert.ok(noScroll.matched, 'Tap must select a crossword word');
        await page.waitForTimeout(400);
        const scrollY = await page.evaluate(() => window.scrollY);
        assert.ok(Math.abs(scrollY - noScroll.before) <= 2, 'Tap jumped down to clues: ' + JSON.stringify({ ...noScroll, scrollY }));
        const collapse = await page.locator('#sidebar').evaluate(sidebar => {
          const rect = sidebar.getBoundingClientRect();
          const button = sidebar.querySelector('.toggle-btn');
          return { width: rect.width, height: rect.height, label: button.getAttribute('aria-label'),
            pseudo: getComputedStyle(button, '::after').content };
        });
        assert.ok(collapse.width > 280, 'Sidebar collapsed into tiny floating circle');
        assert.ok(collapse.height < 56, 'Collapsed sidebar uses too much height');
        assert.ok(collapse.pseudo === 'none' || collapse.pseudo === 'normal', 'Duplicated icon from CSS pseudo element');
        await page.locator('#sidebar .toggle-btn').click();
        assert.equal(await page.locator('#sidebar .toggle-btn').getAttribute('aria-expanded'), 'true');
        await page.locator('#sidebar .toggle-btn').click();
        assert.equal(await page.locator('#sidebar .toggle-btn').getAttribute('aria-expanded'), 'false');
      }
      await page.screenshot({ path: 'artifacts/' + profile.name + '-crossword-layout.png', fullPage: true });

      await navigate(page, 'quant');
      await page.waitForFunction(() => typeof Quant !== 'undefined' && !!Quant.targetWord, null, { timeout: 12000 });
      const quant = await page.evaluate(() => {
        const card = document.querySelector('#sec-quant .qnt-area').getBoundingClientRect();
        const key = document.querySelector('#qntKeyboardDesktop .qnt-key')?.getBoundingClientRect();
        const cell = document.querySelector('#qnt-term-grid .qnt-cell')?.getBoundingClientRect();
        const keyVisible = key && getComputedStyle(document.querySelector('#qntKeyboardDesktop')).display !== 'none';
        return {cardWidth: card.width, keyWidth: key?.width, cellWidth: cell?.width, keyVisible,
          overflow: document.documentElement.scrollWidth - window.innerWidth};
      });
      if (profile.width > 768) {
        assert.ok(quant.cardWidth >= 580, 'Quant game still tiny: ' + quant.cardWidth);
        assert.ok(quant.keyVisible && quant.keyWidth >= 38, 'Desktop keyboard still too small: ' + JSON.stringify(quant));
        assert.ok(quant.cellWidth >= 38, 'Quant cells still too small: ' + JSON.stringify(quant));
      }
      assert.ok(quant.overflow <= 2, 'Quant causes page horizontal overflow');
      await page.screenshot({ path: 'artifacts/' + profile.name + '-quant-layout.png', fullPage: true });

      await navigate(page, 'philword');
      await page.waitForFunction(() => phGrid.length >= 10, null, { timeout: 15000 });
      const phil = await page.locator('#cvPhil').boundingBox();
      assert.ok(phil && phil.width >= (profile.width > 1023 ? 550 : 290), 'Philword canvas is too small');
      await page.screenshot({ path: 'artifacts/' + profile.name + '-philword-layout.png', fullPage: true });

      await navigate(page, 'sudoku');
      await page.waitForFunction(() => suGrid.length === 9, null, { timeout: 15000 });
      const sudoku = await page.locator('#cvSudoku').boundingBox();
      assert.ok(sudoku && sudoku.width >= (profile.width > 1023 ? 490 : 280), 'Sudoku canvas is too small');
      await page.screenshot({ path: 'artifacts/' + profile.name + '-sudoku-layout.png', fullPage: true });

      assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
      console.log(profile.name, JSON.stringify({ shell, quant, philWidth: phil.width, sudokuWidth: sudoku.width }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
