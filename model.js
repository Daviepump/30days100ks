(() => {
  'use strict';
  const config = Object.freeze({name:'Running From Responsibilities', goalKm:100, startDate:'2026-12-01', endDate:'2026-12-31', timezone:'Australia/Sydney'});
  const start = Date.parse('2026-12-01T00:00:00+11:00');
  const end = Date.parse('2027-01-01T00:00:00+11:00');
  const dates = Array.from({length:31}, (_, i) => '2026-12-' + String(i + 1).padStart(2, '0'));
  const milestones = ['Getting Away With It', 'Halfway to Freedom', 'Almost Off the Hook', 'Responsibilities Successfully Avoided'];
  const participants = Object.freeze({dave:'Dave', kate:'Kate'});
  const formatter = new Intl.DateTimeFormat('en', {timeZone:config.timezone, year:'numeric', month:'2-digit', day:'2-digit'});
  function sydneyDay(now) {
    const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  const phase = now => now < start ? 'pre' : now < end ? 'active' : 'ended';
  function countdown(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }
  function validate(data) {
    if (!data || !Array.isArray(data.runs) || !Object.entries(config).every(([key, value]) => data.challenge?.[key] === value)) {
      throw new Error('Challenge metadata or run list is invalid.');
    }
    const stamp = data.lastUpdated;
    if (stamp !== null && (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) || !validDate(stamp.slice(0,10)) || !Number.isFinite(Date.parse(stamp)))) {
      throw new Error('The last updated timestamp is invalid.');
    }
    const ids = new Set();
    const positive = value => Number.isFinite(value) && value > 0;
    for (const run of data.runs) {
      if (!run || typeof run.id !== 'string' || !run.id || run.id !== run.id.trim() || ids.has(run.id) ||
          !validDate(run.date) || !positive(run.distanceKm) ||
          ('durationSeconds' in run && !positive(run.durationSeconds)) ||
          ('elevationGainM' in run && (!Number.isFinite(run.elevationGainM) || run.elevationGainM < 0))) {
        throw new Error('A run has invalid fields or a duplicate ID.');
      }
      ids.add(run.id);
    }
    return data.runs.filter(run => dates.includes(run.date)).sort((a,b) => a.date.localeCompare(b.date));
  }
  function stats(runs, today, goalKm = config.goalKm) {
    const target = goalKm / dates.length;
    const before = today < dates[0];
    const ended = today > dates.at(-1);
    const days = before ? dates.length : dates.filter(date => date >= today).length;
    const visible = runs.filter(run => run.date <= today);
    const grouped = dates.map(date => visible.filter(run => run.date === date));
    const sumDistance = list => list.reduce((sum, run) => sum + run.distanceKm, 0);
    const daily = grouped.map(sumDistance);
    let total = 0;
    let streak = 0;
    let longestStreak = 0;
    let current = 0;
    const cumulative = daily.map((distance, index) => {
      streak = distance > 0 ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
      if (dates[index] <= today && (dates[index] === today ? distance > 0 : true)) current = streak;
      total = Math.round((total + distance) * 1e9) / 1e9;
      return total;
    });
    const expected = (dates.length - days) * target;
    const delta = total - expected;
    const remaining = Math.max(0, goalKm - total);
    const timed = visible.filter(run => run.durationSeconds !== undefined);
    const time = timed.length ? timed.reduce((sum, run) => sum + run.durationSeconds, 0) : null;
    const status = before ? 'Challenge not started' : ended ? 'Challenge ended' : remaining === 0 ? 'Challenge completed' :
      Math.abs(delta) < 0.005 ? 'On track' : delta > 0 ? 'Ahead of target' : 'Behind target';
    return {
      visible, grouped, daily, cumulative, total, remaining, days, expected, delta, status, time, goalKm, target,
      percent: total / goalKm * 100, pace: timed.length ? time / sumDistance(timed) : null,
      required: remaining === 0 ? 0 : days ? remaining / days : null,
      longest: Math.max(0, ...visible.map(run => run.distanceKm)), active: daily.filter(Boolean).length,
      current, longestStreak, milestones: milestones.map((_, i) => dates[cumulative.findIndex(distance => distance >= (i + 1) * 25)])
    };
  }
  function preview(mode, origin) {
    const scenarios = {
      pre:[start - 4 * 86400000 - 3712000, []], launch:[start - 10000, []], zero:[start + 3600000, []],
      example:[start + 11 * 86400000, [9, 4, 0, 7, 11, 8, 0, 6, 3]],
      ahead:[start + 7 * 86400000, [12, 8, 14, 0, 11, 8]],
      behind:[start + 8 * 86400000, [4, 0, 0, 6, 0, 3]],
      milestones:[start + 14 * 86400000, [18, 10, 12, 0, 16, 20, 7]],
      complete:[start + 24 * 86400000, [23, 0, 22, 20, 25, 0, 24, 20, 24]],
      final:[end + 3600000, [23, 0, 22, 20, 25, 0, 24, 20, 16]]
    };
    if (!Object.hasOwn(scenarios, mode)) return null;
    const [instant, distances] = scenarios[mode];
    const runs = distances.flatMap((distanceKm, index) => distanceKm ? [{
      id:'preview-' + index, date:dates[index], distanceKm,
      ...(index % 4 ? {durationSeconds: distanceKm * (320 + index * 3), elevationGainM: index * 14} : {})
    }] : []);
    if (mode === 'example') runs.push({id:'preview-second', date:dates[0], distanceKm:2.5, durationSeconds:840});
    const makePayload = entries => ({
      challenge:config, goalKm:config.goalKm, lastUpdated:entries.length ? new Date(instant).toISOString() : null, runs:entries
    });
    const kateRuns = runs.map(({id, distanceKm, durationSeconds, ...run}) => ({
      ...run, id:'kate-' + id, distanceKm:distanceKm / 2,
      ...(durationSeconds === undefined ? {} : {durationSeconds:durationSeconds / 2})
    }));
    return {now:wall => instant + wall - origin, payload:{dave:makePayload(runs), kate:makePayload(kateRuns)}};
  }
  const model = {config, start, end, dates, participants, milestones, sydneyDay, phase, countdown, validDate, validate, stats, preview};
  if (typeof module !== 'undefined') module.exports = model;
  else globalThis.RunningChallenge = model;
})();
