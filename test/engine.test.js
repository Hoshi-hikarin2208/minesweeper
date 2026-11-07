// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sum(arr) {
  let t = 0;
  for (const v of arr) t += v;
  return t;
}

test('first click is always safe, opens a cascade, and the right number of mines exist', () => {
  for (let seed = 0; seed < 300; seed++) {
    const g = E.newGame(9, 9, 10);
    const first = (seed * 7) % 81;
    E.reveal(g, first, seeded(seed));
    assert.equal(g.mine[first], 0);
    assert.equal(g.count[first], 0, 'clicked cell and its neighbours are mine-free');
    assert.equal(sum(g.mine), 10);
    assert.ok(g.opened > 1, 'a zero cell cascades');
  }
});

test('adjacent counts are correct on every board size', () => {
  for (const [c, r, m] of [[9, 9, 10], [16, 16, 40], [30, 16, 99], [16, 30, 99]]) {
    const g = E.newGame(c, r, m);
    E.reveal(g, 0, seeded(c * r));
    assert.equal(sum(g.mine), m);
    for (let i = 0; i < c * r; i++) {
      if (g.mine[i]) continue;
      let n = 0;
      for (const nb of E.neighbors(g, i)) n += g.mine[nb];
      assert.equal(g.count[i], n);
    }
  }
});

test('revealing every safe cell wins and flags all mines', () => {
  const g = E.newGame(16, 16, 40);
  const rng = seeded(42);
  E.reveal(g, 120, rng);
  for (let i = 0; i < g.mine.length; i++) if (!g.mine[i]) E.reveal(g, i, rng);
  assert.equal(g.status, 'won');
  assert.equal(g.flags, 40);
  assert.equal(sum(g.flag), 40);
});

test('revealing a mine loses and records the exploded cell', () => {
  const g = E.newGame(9, 9, 10);
  E.reveal(g, 40, seeded(1));
  const m = g.mine.indexOf(1);
  E.reveal(g, m);
  assert.equal(g.status, 'lost');
  assert.equal(g.exploded, m);
  assert.deepEqual(E.reveal(g, 0), [], 'no moves after the game ends');
});

test('flags block reveals and keep the counter in sync', () => {
  const g = E.newGame(9, 9, 10);
  assert.ok(E.toggleFlag(g, 5));
  assert.equal(g.flags, 1);
  assert.deepEqual(E.reveal(g, 5), []);
  assert.equal(g.status, 'ready', 'a blocked reveal does not start the game');
  assert.ok(E.toggleFlag(g, 5));
  assert.equal(g.flags, 0);
});

// Layout used for the chord tests (mines marked X):
//   X . .        indexes 0 1 2
//   . . .                3 4 5
//   . . X                6 7 8
function chordGame() {
  const g = E.newGame(3, 3, 2);
  E.layMines(g, [0, 8]);
  g.status = 'playing';
  E.reveal(g, 2);
  return g;
}

test('chord with the right flags opens the remaining neighbours (and can win)', () => {
  const g = chordGame();
  assert.equal(g.count[4], 2);
  E.toggleFlag(g, 0);
  E.toggleFlag(g, 8);
  E.chord(g, 4);
  assert.equal(g.status, 'won');
});

test('chord with a wrong flag hits a mine', () => {
  const g = chordGame();
  E.toggleFlag(g, 3);
  E.toggleFlag(g, 6);
  E.chord(g, 4);
  assert.equal(g.status, 'lost');
});

test('chord does nothing when the flag count does not match', () => {
  const g = chordGame();
  E.toggleFlag(g, 0);
  assert.deepEqual(E.chord(g, 4), []);
  assert.equal(g.status, 'playing');
});

test('tiny boards still place all mines', () => {
  const g = E.newGame(3, 3, 8);
  E.reveal(g, 4, seeded(3));
  assert.equal(sum(g.mine), 8);
  assert.equal(g.mine[4], 0);
});
