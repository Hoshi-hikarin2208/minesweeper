/*
 * Minesweeper engine: pure game logic, no DOM.
 * Works in the browser (window.MinesEngine) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MinesEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Create an empty game. Mines are placed on the first reveal so it is always safe. */
  function newGame(cols, rows, mines) {
    const n = cols * rows;
    return {
      cols,
      rows,
      mines,
      status: 'ready', // ready -> playing -> won | lost
      placed: false,
      opened: 0,
      flags: 0,
      exploded: -1,
      mine: new Uint8Array(n),
      open: new Uint8Array(n),
      flag: new Uint8Array(n),
      count: new Uint8Array(n),
    };
  }

  function neighbors(g, i) {
    const x = i % g.cols;
    const y = (i / g.cols) | 0;
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < g.cols && ny >= 0 && ny < g.rows) out.push(ny * g.cols + nx);
      }
    }
    return out;
  }

  /** Put mines at exact positions and compute the adjacent-mine counts. */
  function layMines(g, positions) {
    g.mine.fill(0);
    g.count.fill(0);
    for (const p of positions) g.mine[p] = 1;
    g.mines = positions.length;
    for (let i = 0; i < g.mine.length; i++) {
      if (g.mine[i]) continue;
      let c = 0;
      for (const nb of neighbors(g, i)) c += g.mine[nb];
      g.count[i] = c;
    }
    g.placed = true;
  }

  /** Random placement that keeps the first-clicked cell and its neighbours mine-free. */
  function placeMines(g, safe, rng) {
    const n = g.cols * g.rows;
    const banned = new Set(neighbors(g, safe));
    banned.add(safe);
    let pool = [];
    for (let i = 0; i < n; i++) if (!banned.has(i)) pool.push(i);
    if (pool.length < g.mines) {
      // Tiny board: only protect the clicked cell itself.
      pool = [];
      for (let i = 0; i < n; i++) if (i !== safe) pool.push(i);
    }
    const k = Math.min(g.mines, pool.length);
    for (let a = 0; a < k; a++) {
      const b = a + Math.floor(rng() * (pool.length - a));
      const tmp = pool[a];
      pool[a] = pool[b];
      pool[b] = tmp;
    }
    layMines(g, pool.slice(0, k));
  }

  function win(g) {
    g.status = 'won';
    for (let i = 0; i < g.mine.length; i++) g.flag[i] = g.mine[i];
    g.flags = g.mines;
  }

  /** Reveal a cell. Returns the list of cells whose look changed. */
  function reveal(g, i, rng) {
    rng = rng || Math.random;
    if (g.status === 'won' || g.status === 'lost') return [];
    if (g.open[i] || g.flag[i]) return [];
    if (!g.placed) {
      placeMines(g, i, rng);
      g.status = 'playing';
    }
    if (g.mine[i]) {
      g.exploded = i;
      g.status = 'lost';
      return [i];
    }
    const changed = [];
    const stack = [i];
    while (stack.length) {
      const c = stack.pop();
      if (g.open[c] || g.flag[c] || g.mine[c]) continue;
      g.open[c] = 1;
      g.opened++;
      changed.push(c);
      if (g.count[c] === 0) {
        for (const nb of neighbors(g, c)) if (!g.open[nb]) stack.push(nb);
      }
    }
    if (g.opened === g.cols * g.rows - g.mines) win(g);
    return changed;
  }

  /** Toggle a flag. Returns true if something changed. */
  function toggleFlag(g, i) {
    if ((g.status !== 'ready' && g.status !== 'playing') || g.open[i]) return false;
    if (g.flag[i]) {
      g.flag[i] = 0;
      g.flags--;
    } else {
      g.flag[i] = 1;
      g.flags++;
    }
    return true;
  }

  /** Chord: on an opened number whose flag count matches, reveal all other neighbours. */
  function chord(g, i, rng) {
    if (g.status !== 'playing' || !g.open[i] || g.count[i] === 0) return [];
    const nbs = neighbors(g, i);
    let f = 0;
    for (const nb of nbs) if (g.flag[nb]) f++;
    if (f !== g.count[i]) return [];
    const changed = [];
    for (const nb of nbs) {
      if (g.flag[nb] || g.open[nb]) continue;
      const res = reveal(g, nb, rng);
      for (const c of res) changed.push(c);
      if (g.status !== 'playing') break;
    }
    return changed;
  }

  return { newGame, neighbors, layMines, reveal, toggleFlag, chord };
});
