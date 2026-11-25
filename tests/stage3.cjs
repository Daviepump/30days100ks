const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');
test('Christmas is excluded from pacing and preserves streaks, but optional runs count', () => {
  const run = (date,distanceKm) => ({id:date,date:'2026-12-'+date,distanceKm});
  assert.equal(M.stats([], '2026-12-01').required.toFixed(2), '3.33');
  assert.equal(M.stats([], '2026-12-25').days, 6);
  assert.equal(M.stats([], '2026-12-26').expected, 80);
  const rested = M.stats([run('24',5),run('26',5)], '2026-12-26');
  assert.equal(rested.longestStreak, 2);
  const optional = M.stats([run('24',5),run('25',7),run('26',5)], '2026-12-26');
  assert.equal(optional.total,17);
  assert.equal(optional.longestStreak,3);
});
