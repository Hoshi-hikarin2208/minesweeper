/* Minesweeper UI: rendering, input (mouse, touch, keyboard), timer and best times. */
(() => {
  'use strict';

  const E = window.MinesEngine;

  const LEVELS = {
    beginner:     { label: 'Beginner',     cols: 9,  rows: 9,  mines: 10 },
    intermediate: { label: 'Intermediate', cols: 16, rows: 16, mines: 40 },
    expert:       { label: 'Expert',       cols: 30, rows: 16, mines: 99 },
  };
  const HINT = 'Click a square to begin. Right-click or long-press to flag a mine.';
  const LONG_PRESS_MS = 380;

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const minesEl = $('mines');
  const timeEl = $('time');
  const faceEl = $('face');
  const statusEl = $('status');
  const bestEl = $('best');
  const flagBtn = $('flag-mode');
  const levelBtns = document.querySelectorAll('[data-level]');

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('minesweeper:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('minesweeper:' + key, JSON.stringify(value));
      } catch (_) { /* storage unavailable: ignore */ }
    },
  };

  let level = store.get('level', 'beginner');
  if (!LEVELS[level]) level = 'beginner';

  let game = null;
  let cells = [];
  let cursor = 0;
  let flagMode = false;
  let timer = null;
  let startAt = 0;

  // ---------- helpers ----------

  function lcd(n) {
    n = Math.max(-99, Math.min(999, n));
    return n < 0 ? '-' + String(-n).padStart(2, '0') : String(n).padStart(3, '0');
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function elapsed() {
    if (!startAt) return 0;
    return Math.min(999, Math.max(1, Math.ceil((performance.now() - startAt) / 1000)));
  }

  function startTimer() {
    startAt = performance.now();
    clearInterval(timer);
    timer = setInterval(() => { timeEl.textContent = lcd(elapsed()); }, 250);
    timeEl.textContent = lcd(elapsed());
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function dims() {
    const l = LEVELS[level];
    let { cols, rows } = l;
    // On narrow screens a wide board is rotated so cells stay finger-sized.
    if (cols > rows && window.matchMedia('(max-width: 600px)').matches) [cols, rows] = [rows, cols];
    return { cols, rows, mines: l.mines };
  }

  function fit() {
    if (!game) return;
    const avail = Math.min(window.innerWidth, 1280) - 76;
    const size = Math.max(26, Math.min(40, Math.floor(avail / game.cols) - 2));
    document.documentElement.style.setProperty('--cell', size + 'px');
  }

  function renderBest() {
    const best = store.get('best', {});
    bestEl.textContent = 'Best times: ' + Object.keys(LEVELS)
      .map((k) => LEVELS[k].label + ' ' + (best[k] ? best[k] + 's' : '–'))
      .join(' · ');
  }

  // ---------- rendering ----------

  function paint(i) {
    const g = game;
    const el = cells[i];
    const row = Math.floor(i / g.cols) + 1;
    const col = (i % g.cols) + 1;
    const pos = 'Row ' + row + ', column ' + col;
    let cls = 'cell';
    let text = '';
    let label = pos + ', hidden';
    let n = 0;

    if (g.open[i]) {
      cls += ' open';
      n = g.count[i];
      text = n ? String(n) : '';
      label = pos + (n ? ', ' + n + ' adjacent mines' : ', empty');
    } else if (g.status === 'lost' && g.mine[i] && !g.flag[i]) {
      cls += i === g.exploded ? ' mine boom' : ' mine';
      text = '💣';
      label = pos + ', mine';
    } else if (g.status === 'lost' && g.flag[i] && !g.mine[i]) {
      cls += ' wrong';
      text = '❌';
      label = pos + ', wrong flag';
    } else if (g.flag[i]) {
      cls += ' flag';
      text = '🚩';
      label = pos + ', flagged';
    }

    el.className = cls;
    el.textContent = text;
    el.setAttribute('aria-label', label);
    if (n) el.dataset.n = n;
    else delete el.dataset.n;
  }

  function paintAll() {
    for (let i = 0; i < cells.length; i++) paint(i);
  }

  function updateCounter() {
    minesEl.textContent = lcd(game.mines - game.flags);
  }

  function buildBoard() {
    boardEl.style.setProperty('--cols', game.cols);
    boardEl.replaceChildren();
    cells = [];
    cursor = 0;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < game.cols * game.rows; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.dataset.i = i;
      b.tabIndex = i === 0 ? 0 : -1;
      cells.push(b);
      frag.appendChild(b);
    }
    boardEl.appendChild(frag);
    paintAll();
    fit();
  }

  // ---------- game flow ----------

  function startNew() {
    stopTimer();
    startAt = 0;
    const d = dims();
    game = E.newGame(d.cols, d.rows, d.mines);
    buildBoard();
    timeEl.textContent = lcd(0);
    updateCounter();
    faceEl.textContent = '🙂';
    setStatus(HINT);
    renderBest();
  }

  function finish() {
    const secs = elapsed();
    stopTimer();
    timeEl.textContent = lcd(secs);
    paintAll();
    if (game.status === 'won') {
      faceEl.textContent = '😎';
      const best = store.get('best', {});
      let msg = 'Field cleared in ' + secs + 's!';
      if (!best[level] || secs < best[level]) {
        best[level] = secs;
        store.set('best', best);
        msg += ' New best time!';
        renderBest();
      }
      setStatus(msg, 'win');
    } else {
      faceEl.textContent = '😵';
      setStatus('Boom! Press the face or R to try again.', 'lose');
    }
  }

  function act(i, kind) {
    if (!game) return;
    const before = game.status;
    let changed;
    if (kind === 'flag') changed = E.toggleFlag(game, i) ? [i] : [];
    else if (game.open[i]) changed = E.chord(game, i);
    else changed = E.reveal(game, i);

    if (before === 'ready' && game.status === 'playing') startTimer();

    if ((game.status === 'won' || game.status === 'lost') && before !== game.status) {
      finish();
    } else {
      changed.forEach(paint);
    }
    updateCounter();
  }

  function setCursor(i, focus) {
    if (cells[cursor]) cells[cursor].tabIndex = -1;
    cursor = i;
    cells[i].tabIndex = 0;
    if (focus) cells[i].focus();
  }

  // ---------- input ----------

  let lastPointer = 'mouse';
  let pressTimer = null;
  let longPressed = false;

  boardEl.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    longPressed = false;
    clearTimeout(pressTimer);
    const el = e.target.closest('.cell');
    if (!el || e.pointerType === 'mouse') return;
    // Touch / pen: holding a square places a flag.
    pressTimer = setTimeout(() => {
      longPressed = true;
      if (navigator.vibrate) navigator.vibrate(15);
      act(+el.dataset.i, 'flag');
    }, LONG_PRESS_MS);
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
    boardEl.addEventListener(type, () => clearTimeout(pressTimer));
  });

  boardEl.addEventListener('click', (e) => {
    const el = e.target.closest('.cell');
    if (!el) return;
    if (longPressed) { longPressed = false; return; }
    const i = +el.dataset.i;
    setCursor(i, false);
    act(i, flagMode && !game.open[i] ? 'flag' : 'reveal');
  });

  boardEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (lastPointer !== 'mouse') return; // touch long-press is handled above
    const el = e.target.closest('.cell');
    if (el) { setCursor(+el.dataset.i, false); act(+el.dataset.i, 'flag'); }
  });

  // Middle click chords on a number.
  boardEl.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  boardEl.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    const el = e.target.closest('.cell');
    if (el) act(+el.dataset.i, 'reveal');
  });

  boardEl.addEventListener('keydown', (e) => {
    const el = e.target.closest('.cell');
    if (!el) return;
    const i = +el.dataset.i;
    const { cols, rows } = game;
    let x = i % cols;
    let y = (i / cols) | 0;
    switch (e.key) {
      case 'ArrowLeft': x--; break;
      case 'ArrowRight': x++; break;
      case 'ArrowUp': y--; break;
      case 'ArrowDown': y++; break;
      case 'f':
      case 'F':
        e.preventDefault();
        act(i, 'flag');
        return;
      default:
        return; // Enter / Space fall through to the button's own click
    }
    e.preventDefault();
    x = Math.max(0, Math.min(cols - 1, x));
    y = Math.max(0, Math.min(rows - 1, y));
    setCursor(y * cols + x, true);
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R' || e.key === 'n' || e.key === 'N') startNew();
  });

  faceEl.addEventListener('click', startNew);
  $('new-game').addEventListener('click', startNew);

  flagBtn.addEventListener('click', () => {
    flagMode = !flagMode;
    flagBtn.setAttribute('aria-pressed', String(flagMode));
  });

  function syncLevels() {
    levelBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
  }

  levelBtns.forEach((b) => {
    b.addEventListener('click', () => {
      level = b.dataset.level;
      store.set('level', level);
      syncLevels();
      startNew();
    });
  });

  window.addEventListener('resize', fit);

  // ---------- go ----------

  syncLevels();
  startNew();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
