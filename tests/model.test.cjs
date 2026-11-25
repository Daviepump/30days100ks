const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, phase, sydneyDay, stats, countdown, preview, config } = require('../model.js');
const run = (id, day, distanceKm, durationSeconds) => ({
  id, date: '2026-12-' + String(day).padStart(2, '0'), distanceKm,
  ...(durationSeconds === undefined ? {} : { durationSeconds })
});
const data = runs => ({ challenge: config, lastUpdated: null, runs });
test('Sydney launch and finish are exact UTC instants', () => {
  assert.equal(phase(Date.parse('2026-11-30T12:59:59.999Z')), 'pre');
  assert.equal(phase(Date.parse('2026-11-30T13:00:00Z')), 'active');
  assert.equal(phase(Date.parse('2026-12-31T13:00:00Z')), 'ended');
  assert.equal(sydneyDay(Date.parse('2026-12-31T12:59:59Z')), '2026-12-31');
  assert.equal(sydneyDay(Date.parse('2026-11-30T20:00:00-08:00')), '2026-12-01');
  assert.deepEqual(countdown(90061000), [1, 1, 1, 1]);
});
test('first day includes today, zero runs and an initial target of 4.84', () => {
  const result = stats([], '2026-12-01');
  assert.equal(result.days, 31);
  assert.equal(result.required.toFixed(2), '4.84');
  assert.equal(result.status, 'On track');
  assert.equal(result.pace, null);
});
test('validation rejects duplicate IDs, invalid dates, distance and optional measurements', () => {
  for (const runs of [[run('r',1,5), run('r',2,6)], [run('r',32,5)], [run('r',1,0)], [run('r',1,5,0)], [run('r',1,Infinity)]]) {
    assert.throws(() => validate(data(runs)));
  }
  assert.deepEqual(validate(data([{...run('r',1,5), date:'2026-11-30'}])), []);
});
test('multiple runs, weighted pace, streaks and milestone dates', () => {
  const result = stats([run('a',1,7,2100),run('b',1,8,3200),run('c',2,10),run('d',5,5,1500)], '2026-12-06');
  assert.equal(result.total, 30);
  assert.equal(result.daily[0], 15);
  assert.equal(result.pace, 340);
  assert.equal(result.time, 6800);
  assert.equal(result.current, 1);
  assert.equal(result.longestStreak, 2);
  assert.equal(result.milestones[0], '2026-12-02');
  assert.equal(result.status, 'Ahead of target');
  assert.equal(stats([run('a',1,2)], '2026-12-06').status, 'Behind target');
});
test('final day, completion, overachievement and final results', () => {
  assert.equal(stats([], '2026-12-31').required, 150);
  assert.equal(stats([run('x',31,150)], '2026-12-31').status, 'Challenge completed');
  assert.equal(stats([run('x',31,160)], '2027-01-01').percent, 160 / 150 * 100);
  assert.equal(stats([], '2027-01-01').required, null);
  assert.equal(stats([], '2027-01-01').status, 'Challenge ended');
});
test('preview states use isolated data and a running launch clock', () => {
  assert.equal(phase(preview('launch', 0).now(9999)), 'pre');
  assert.equal(phase(preview('launch', 0).now(10000)), 'active');
  assert.equal(preview('zero', 0).payload.runs.length, 0);
  for (const mode of ['example', 'ahead', 'behind', 'milestones', 'complete', 'final']) validate(preview(mode, 0).payload);
});
