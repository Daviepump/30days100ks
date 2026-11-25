'use strict';
const M = RunningChallenge;
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const scenario = query.get('preview');
const simulation = M.preview(scenario, Date.now());
const now = () => simulation ? simulation.now(Date.now()) : Date.now();
const fmt = (value, digits = 2) => new Intl.NumberFormat('en-AU', {maximumFractionDigits:digits}).format(value);
const km = value => fmt(value) + ' km';
const dLabel = date => Number(date.slice(-2)) + ' Dec 2026';
const pad = number => String(number).padStart(2,'0');
const duration = value => value == null ? '—' : Math.floor(value / 3600) + 'h ' + pad(Math.floor(value / 60) % 60) + 'm ' + pad(Math.floor(value) % 60) + 's';
const pace = value => value == null ? '—' : Math.floor(Math.round(value) / 60) + ':' + pad(Math.round(value) % 60) + ' /km';
const shapes = {
  bolt:'M13 2 4 14h7l-1 8 10-12h-8z', target:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 5h.01',
  calendar:'M3 6h18v15H3zM7 3v6m10-6v6M3 11h18', activity:'M2 12h5l3-7 4 14 3-7h5',
  time:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4v6l4 2', trophy:'M7 3h10v9a5 5 0 0 1-10 0zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 5v4m-5 0h10',
  tree:'M12 2 6 9h3l-5 6h4l-3 4h14l-3-4h4l-5-6h3zM12 19v3',
  lock:'M5 10h14v11H5zm3 0V6a4 4 0 0 1 8 0v4', flag:'M4 22V3h15l-4 5 4 5H4', mountain:'M2 20 9 7l4 7 3-5 6 11z'
};
const icon = name => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + shapes[name] + '"/></svg>';
for (const node of document.querySelectorAll('[data-icon]')) node.innerHTML = icon(node.dataset.icon);
if (simulation) {
  $('preview').hidden = false;
  $('preview').innerHTML = '<strong>Preview · simulated clock and run data</strong><br>' +
    ['pre','launch','zero','example','ahead','behind','milestones','complete','final'].map(mode =>
      '<a href="?preview=' + mode + '"' + (mode === scenario ? ' aria-current="page"' : '') + '>' + mode + '</a>').join(' ') +
    ' <a href="./">Exit preview</a>';
}
function makeClock(id) {
  const root = $(id);
  root.setAttribute('role','timer');
  root.innerHTML = ['Days','Hours','Minutes','Seconds'].map(label => '<div><strong>00</strong><small>' + label + '</small></div>').join('');
  const digits = root.querySelectorAll('strong');
  return ms => M.countdown(ms).forEach((n,i) => { if (digits[i].textContent !== pad(n)) digits[i].textContent = pad(n); });
}
const launchClock = makeClock('launch-clock');
const finishClock = makeClock('finish-clock');
function celebrate(accent = '#b9f94b') {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const burst = document.createElement('div');
  burst.innerHTML = Array.from({length:44}, (_,i) =>
    '<i class="particle" style="--x:' + ((i * 37) % 100) + '%;--c:' + [accent,'#fff','#f4bc68'][i%3] +
    ';--speed:' + (1.1 + i%8 / 10) + 's;--delay:' + i%9 / 28 + 's;--drift:' + ((i%2 ? 1 : -1) * (20+i)) + 'px"></i>').join('');
  $('confetti').append(burst);
  setTimeout(() => burst.remove(), 2500);
}
function activities(runs) {
  if (!runs.length) return '<p class="muted">No runs recorded yet.</p>';
  return '<ul class="activity">' + [...runs].reverse().map(run => {
    const metrics = [['Duration',duration(run.durationSeconds)],['Pace',pace(run.durationSeconds == null ? null : run.durationSeconds / run.distanceKm)],['Elevation',run.elevationGainM == null ? '—' : fmt(run.elevationGainM) + ' m']];
    return '<li><div><time datetime="' + run.date + '">' + dLabel(run.date) + '</time><strong>' + km(run.distanceKm) + '</strong></div><dl>' +
      metrics.map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') + '</dl></li>';
  }).join('') + '</ul>';
}
function chart(result, today, cumulative) {
  const values = cumulative ? result.cumulative : result.daily;
  const reference = cumulative ? result.goalKm : result.target;
  const limit = Math.ceil(Math.max(reference, ...values) / (cumulative ? 50 : 5)) * (cumulative ? 50 : 5);
  const expected = M.dates.map(date => M.scheduled.filter(day => day <= date).length * result.target);
  const highDay = Math.max(...result.daily);
  const x = i => 47 + i * 12;
  const y = v => 151 - 134 * v / limit;
  const todayIndex = M.dates.indexOf(today);
  const lastIndex = today > M.dates.at(-1) ? 30 : todayIndex;
  const series = cumulative
    ? '<polyline points="' + values.slice(0,lastIndex+1).map((v,i) => x(i) + ',' + y(v)).join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="3"/>' +
      (lastIndex >= 0 ? '<circle cx="' + x(lastIndex) + '" cy="' + y(values[lastIndex]) + '" r="4" fill="var(--accent)"/>' : '') +
      '<polyline points="' + expected.map((v,i) => x(i) + ',' + y(v)).join(' ') + '" fill="none" stroke="#a6b4c4" stroke-width="1.8" stroke-dasharray="5 4"/>'
    : values.map((v,i) => '<rect x="' + (x(i)-4) + '" y="' + (v ? y(v) : 149) + '" width="8" height="' + (v ? 151-y(v) : 2) +
      '" rx="2" fill="' + (v && v === highDay ? '#f4bc68' : v ? 'var(--accent)' : '#475665') + '"/>').join('');
  const axes = [0,limit/2,limit].map(v => '<path d="M41 ' + y(v) + 'H414" stroke="#435261" stroke-width=".7"/><text x="36" y="' + (y(v)+4) +
    '" text-anchor="end">' + fmt(v,1) + '</text>').join('') +
    [0,6,13,20,30].map(i => '<text x="' + x(i) + '" y="170" text-anchor="middle">' + (i+1) + '</text>').join('');
  const title = cumulative ? 'Cumulative running progress' : 'Daily running distance';
  const labels = M.dates.map((date,i) => (i+1) + ' Dec · ' + (cumulative && i > lastIndex ? 'Future date' : km(values[i])) +
    (cumulative ? ' · Expected ' + km(expected[i]) : values[i] && values[i] === highDay ? ' · Longest day' : '') +
    (i === todayIndex ? ' · Today' : ''));
  return '<section class="panel"><h2>' + title + '</h2><div class="legend"><span>Recorded km</span><span style="--key:#a6b4c4">' +
    (cumulative ? 'Expected progress' : 'Daily target · ' + km(result.target)) + '</span><span style="--key:#f4bc68">' + (cumulative ? km(result.goalKm) + ' finish' : 'Longest day') +
    '</span></div><div class="chart-frame"><svg viewBox="0 0 430 179" aria-hidden="true"><g fill="#a6b4c4" font-size="11" font-family="monospace">' +
    axes + '</g>' + (!cumulative && todayIndex >= 0 ? '<rect x="' + (x(todayIndex)-6) + '" y="15" width="12" height="136" fill="#adc78b" opacity=".22"/>' : '') +
    '<g class="chart-series">' + series + '</g><path d="M41 ' + y(reference) + 'H414" stroke="' + (cumulative ? '#f4bc68' : '#a6b4c4') +
    '" stroke-dasharray="4 4"/></svg><div class="chart-hit">' + labels.map(label => '<button aria-label="' + label + '"></button>').join('') +
    '</div></div><label class="chart-picker">Explore days<input type="range" min="1" max="31" value="' +
    (todayIndex < 0 ? 31 : todayIndex + 1) + '" aria-label="Explore ' + title.toLowerCase() +
    ' by December day"></label><p class="chart-tooltip" aria-live="polite">Select a day to see its distance.</p></section>';
}
let phase;
let today;
let snapshot;
let loading = false;
let requested = false;
const previous = new Map();
const completed = new Set();

function renderParticipant(slug, payload, position) {
  let section = $('results').querySelector('[data-runner="' + slug + '"]');
  if (!section) {
    section = document.createElement('section');
    section.dataset.runner = slug;
    section.innerHTML = '<div class="panel runner-summary"><h2 class="runner-name"></h2><div class="runner-overview"></div>' +
      '<button type="button" class="button runner-toggle" aria-expanded="false">View details</button></div>' +
      '<div class="runner-disclosure" inert><div class="runner-results"></div></div>';
    const toggle = section.querySelector('.runner-toggle');
    const disclosure = section.querySelector('.runner-disclosure');
    disclosure.id = 'runner-details-' + slug;
    toggle.setAttribute('aria-controls',disclosure.id);
    toggle.onclick = () => {
      const open = disclosure.inert;
      disclosure.inert = !open;
      toggle.setAttribute('aria-expanded',String(open));
      toggle.textContent = open ? 'Hide details' : 'View details';
      toggle.setAttribute('aria-label',toggle.textContent + ' for ' + section.querySelector('.runner-name').textContent);
    };
  }
  const root = section.querySelector('.runner-results');
  const signature = JSON.stringify([today,payload]);
  if ($('results').children[position] !== section) $('results').insertBefore(section,$('results').children[position] ?? null);
  if (previous.get(slug) === signature) return;
  section.style.setProperty('--accent',payload.accent);
  section.querySelector('.runner-name').textContent = payload.name;
  section.querySelector('.runner-toggle').setAttribute('aria-label',
    section.querySelector('.runner-toggle').textContent + ' for ' + payload.name);
  previous.set(slug,signature);
  const r = M.stats(payload.runs,today,payload.goalKm);
  const complete = r.remaining === 0;
  const tiles = [
    ['Longest run',r.visible.length ? km(r.longest) : '—','mountain'],['Runs recorded',r.visible.length,'activity'],
    ['Average pace',pace(r.pace),'time','Runs with recorded durations'],['Total running time',duration(r.time),'time','Recorded durations'],
    ['Average distance',r.visible.length ? km(r.total/r.visible.length) : '—','target'],['Active days',r.active,'calendar'],
    ['Current streak',r.current + ' days','bolt'],['Longest streak',r.longestStreak + ' days','trophy']
  ];
  const cap = Math.min(100,r.percent);
  const calendar = M.dates.map((date,i) => {
    const distance = r.daily[i];
    const rest = date === M.restDay;
    const className = 'day' + (rest ? ' rest-day' : '') + (date === today ? ' today' : '') + (date > today ? ' future' : '');
    const current = date === today ? ' aria-current="date"' : '';
    const content = '<span>' + (i+1) + '</span>' + (rest ? '<span title="Even Santa gets a rest day.">' + icon('tree') + '<span class="sr-only">Christmas rest day</span></span>' : '');
    return distance ? '<button class="' + className + ' run-day" data-day="' + i + '" aria-label="' + dLabel(date) + ', ' + km(distance) + (rest ? ', Christmas rest day' : '') +
      '" style="--intensity:' + Math.min(28, 7 + distance) + '%"' + current + '>' + content + icon('activity') + '<small>' + km(distance) +
      '</small></button>' : '<div class="' + className + '"' + current + '>' + content + (date <= today ? '<small>0 km</small>' : '') + '</div>';
  }).join('');
  const last = payload.lastUpdated ? new Intl.DateTimeFormat('en-AU',{timeZone:M.config.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(payload.lastUpdated)) + ' Sydney time' : 'No updates recorded';
  section.querySelector('.runner-overview').innerHTML =
    '<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true">' +
    '<circle class="ring-track" cx="60" cy="60" r="51"/>' + (cap > 0 ? '<circle class="ring-value" cx="60" cy="60" r="51" pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + (100-cap) + '"/>' : '') +
    '</svg><div class="ring-text"><strong>' + fmt(r.total) + ' km</strong><span>of ' + km(r.goalKm) + '</span></div></div>' +
    '<dl class="runner-metrics"><div><dt>Remaining</dt><dd>' + km(r.remaining) + '</dd></div>' +
    '<div><dt>Required daily average</dt><dd>' + (r.required == null ? '—' : km(r.required) + '/day') + '</dd></div></dl>' +
    '<p class="runner-status' + (r.delta < -.005 && !complete && phase === 'active' ? ' behind' : '') + '">' + r.status + '</p>';
  root.innerHTML = (complete ? '<div class="panel trophy">' + icon('trophy') + 'RESPONSIBILITIES SUCCESSFULLY AVOIDED!</div>' : '') +
    '<h3 class="section-title">Running statistics</h3><div class="stat-grid">' + tiles.map(([label,value,symbol,note]) => '<div class="panel stat">' +
      icon(symbol) + '<strong>' + value + '</strong><span>' + label + '</span>' + (note ? '<small>' + note + '</small>' : '') + '</div>').join('') +
    '</div><div class="chart-grid">' + chart(r,today,false) + chart(r,today,true) +
    '</div><h2 class="section-title">Achievements</h2><div class="badge-grid">' + M.milestones.map((label,i) => '<div class="panel badge' +
      (r.milestones[i] ? ' unlocked' : '') + '">' + icon(r.milestones[i] ? (i === M.milestones.length - 1 ? 'trophy' : 'flag') : 'lock') + '<div><strong>' + label + '</strong><small>' +
      (i+1)*25 + ' km · ' + (r.milestones[i] ? dLabel(r.milestones[i]) : 'Locked') + '</small></div></div>').join('') +
    '</div><div class="details-grid"><section class="panel"><h2>December activity</h2>' +
    '<div class="week">' + ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => '<span>' + day + '</span>').join('') +
    '</div><div class="calendar"><span></span>' + calendar + '</div></section><section class="panel"><h2>Recent runs</h2>' + activities(r.visible) +
    '</section></div><p class="updated">Last data update · ' + last + '</p>';
  for (const button of root.querySelectorAll('.chart-hit button')) {
    const show = () => { button.closest('section').querySelector('.chart-tooltip').textContent = button.getAttribute('aria-label'); };
    for (const event of ['focus','pointerenter','click']) button.addEventListener(event, show);
  }
  for (const picker of root.querySelectorAll('.chart-picker input')) {
    const update = () => {
      const section = picker.closest('section');
      const label = section.querySelectorAll('.chart-hit button')[Number(picker.value) - 1].getAttribute('aria-label');
      picker.setAttribute('aria-valuetext',label);
      section.querySelector('.chart-tooltip').textContent = label;
    };
    picker.addEventListener('input',update);
    picker.addEventListener('focus',update);
  }
  for (const button of root.querySelectorAll('[data-day]')) {
    button.onclick = () => {
      const day = Number(button.dataset.day);
      $('day-dialog').dataset.runner = slug;
      $('day-dialog').style.setProperty('--accent',payload.accent);
      $('day-details').innerHTML = '<h2 id="day-title"></h2>' + activities(r.grouped[day]);
      $('day-title').textContent = payload.name + ' · ' + dLabel(M.dates[day]) + ' · ' + km(r.daily[day]);
      $('day-dialog').setAttribute('aria-labelledby','day-title');
      $('day-dialog').showModal();
    };
  }
  if (complete && !completed.has(slug) && phase === 'active') {
    celebrate(getComputedStyle(root).getPropertyValue('--accent').trim());
  }
  if (complete) completed.add(slug);
  else completed.delete(slug);
}

function render() {
  if (!snapshot) return;
  if (phase === 'pre') {
    const roster = $('landing-roster');
    roster.replaceChildren(...Object.values(snapshot).map(profile => {
      const item = document.createElement('li');
      item.style.setProperty('--accent',profile.accent);
      const name = document.createElement('strong');
      name.textContent = profile.name;
      item.append(name,' · ' + km(profile.goalKm));
      return item;
    }));
    roster.hidden = !roster.children.length;
    return;
  }
  for (const card of [...$('results').children]) {
    if (!Object.hasOwn(snapshot,card.dataset.runner)) {
      previous.delete(card.dataset.runner);
      completed.delete(card.dataset.runner);
      card.remove();
    }
  }
  Object.entries(snapshot).forEach(([slug,profile],index) => renderParticipant(slug,profile,index));
  $('empty-roster').hidden = Object.keys(snapshot).length !== 0;
}

async function load() {
  if (loading) return;
  loading = requested = true;
  if (!snapshot) $('data-status').innerHTML = '<p class="notice">Loading running data…</p>';
  try {
    const next = simulation?.payload ?? await RunningData.snapshot();
    snapshot = Object.fromEntries(Object.entries(next).map(([slug,payload]) => [
      slug, {...payload,runs:M.validate(payload)}
    ]));
    $('data-status').replaceChildren();
    render();
  } catch (error) {
    if (phase === 'pre') return;
    const message = error.code === 'configuration' ? 'The live database has not been configured.' :
      snapshot ? 'Could not refresh running data. Showing the last successful update.' : 'Running data is temporarily unavailable.';
    $('data-status').innerHTML = '<p class="notice error">' + message + ' <button class="button" id="retry">Retry</button></p>';
    $('retry').onclick = load;
  } finally {
    loading = false;
  }
}
function tick() {
  const instant = now();
  const nextPhase = M.phase(instant);
  const nextDay = M.sydneyDay(instant);
  const dayChanged = today !== nextDay;
  today = nextDay;
  if (dayChanged) {
    const remaining = M.scheduled.filter(date => date >= today).length;
    $('scheduled-days').textContent = remaining + ' scheduled running ' + (remaining === 1 ? 'day' : 'days') + ' remaining';
  }
  if (nextPhase !== phase) {
    const launched = phase === 'pre' && nextPhase === 'active';
    $('landing').hidden = nextPhase !== 'pre';
    $('dashboard').hidden = nextPhase === 'pre';
    $('finish-title').textContent = nextPhase === 'ended' ? 'Challenge finished · Final results' : 'Time to the finish';
    $('finish-clock').hidden = nextPhase === 'ended';
    if (launched || (nextPhase === 'active' && M.sydneyDay(instant) === M.config.startDate)) {
      $('announcement').textContent = 'THE CHALLENGE HAS BEGUN!';
      $('announcement').hidden = false;
    }
    if (nextPhase === 'ended') $('announcement').hidden = true;
    if (launched) { $('dashboard').classList.add('launching'); celebrate(); }
    phase = nextPhase;
    if (launched && !simulation) load();
  }
  if (phase === 'pre') launchClock(M.start - instant);
  if (phase === 'active') finishClock(M.end - instant);
  if (dayChanged) {
    if (today !== M.config.startDate) $('announcement').hidden = true;
    if (requested) render();
  }
  if (!requested) load();
}
tick();
setInterval(tick,250);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    tick();
    if (!simulation) load();
  }
});
if (!simulation) {
  setInterval(() => { if (!document.hidden) load(); }, 15000);
  RunningData.onChange(load);
}
