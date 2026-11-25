'use strict';
const M = RunningChallenge;
const report = document.getElementById('report');
const summary = document.getElementById('summary');
let passed = 0;
let failed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => result(name), error => result(name,error));
}
function result(name, error) {
  const item = document.createElement('li');
  item.textContent = error ? 'FAIL · ' + name + ' · ' + error.message : 'PASS · ' + name;
  report.append(item);
  if (error) failed++; else passed++;
}
function expect(value, message) {
  if (!value) throw new Error(message || 'Assertion failed');
}
const assertions = {
  equal:(a,b) => expect(Object.is(a,b), JSON.stringify(a) + ' differs from ' + JSON.stringify(b)),
  deepEqual:(a,b) => assertions.equal(JSON.stringify(a),JSON.stringify(b)),
  throws:fn => { let error; try { fn(); } catch (caught) { error = caught; } expect(error,'Expected validation to reject the file'); }
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 14000) {
  const expires = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() >= expires) throw new Error('Timed out waiting for the page');
    await pause(60);
  }
}
async function frame(path, width, verify, html) {
  const iframe = document.createElement('iframe');
  iframe.width = width;
  iframe.height = 720;
  iframe.style.maxWidth = 'none';
  if (html) iframe.srcdoc = html;
  else iframe.src = path;
  const loaded = new Promise(resolve => iframe.addEventListener('load',resolve,{once:true}));
  document.body.append(iframe);
  try {
    await loaded;
    const doc = iframe.contentDocument;
    await verify(doc, iframe.contentWindow);
  } finally { iframe.remove(); }
}
const text = (doc,selector) => doc.querySelector(selector)?.textContent || '';
const dash = (doc,word) => expect(text(doc,'#results').includes(word),'Missing ' + word);

const project = new URL('../',location.href);
const mock = {
  user:null, rows:[], writes:0, requests:0, failRead:false, interruptInsert:false, ids:[]
};
window.rfrMock = mock;
async function connected(path,width,verify) {
  const url = new URL(path,project);
  const source = await (await fetch(url)).text();
  const setup = '<base href="' + url.href + '"><script src="' +
    new URL('tests/supabase-fixture.js',project).href + '"></script>';
  await frame('',width,verify,source.replace('<head>','<head>' + setup)
    .replace(/<script src="[^"]*supabase-config.js" defer><\/script>/,''));
}
async function main() {
  const tests = [];
  const source = await (await fetch('./model.test.cjs')).text();
  new Function('require',source)(name => ({
    'node:test':(label,fn) => tests.push([label,fn]),
    'node:assert/strict':assertions,
    '../model.js':M
  })[name]);
  for (const [label,fn] of tests) await check(label,fn);

  await check('Desktop countdown and removal of sharing controls',() => frame('../?preview=pre',1280,async doc => {
    expect(!doc.querySelector('#landing').hidden && doc.querySelector('#dashboard').hidden);
    expect(!/Share challenge|Copy website link/.test(doc.body.textContent));
    expect(text(doc,'#landing .tagline') === '31 days. 100 km each. Zero valid excuses.');
    expect(doc.querySelectorAll('.brief [data-runner]').length === 2);
    const seconds = text(doc,'#launch-clock div:last-child strong');
    await until(() => text(doc,'#launch-clock div:last-child strong') !== seconds);
    expect(doc.documentElement.scrollWidth <= 1280,'Desktop landing overflows');
  }));
  await check('Open tab launches both 100 km dashboards at Sydney midnight',() => frame('../?preview=launch',390,async doc => {
    expect(!doc.querySelector('#landing').hidden);
    await until(() => doc.querySelectorAll('.ring-text').length === 2);
    expect(doc.querySelector('#landing').hidden);
    expect(text(doc,'#announcement') === 'THE CHALLENGE HAS BEGUN!');
    for (const ring of doc.querySelectorAll('.ring-text')) expect(ring.textContent.includes('of 100 km0%'));
  }));
  await check('Desktop dashboards are side by side and milestones unlock independently',() => frame('../?preview=complete',1280,(doc,win) => {
    const dave = doc.querySelector('#results [data-runner="dave"]');
    const kate = doc.querySelector('#results [data-runner="kate"]');
    expect(dave.getBoundingClientRect().right < kate.getBoundingClientRect().left);
    expect(dave.querySelectorAll('.badge.unlocked').length === 4 && kate.querySelectorAll('.badge.unlocked').length === 3);
    expect(dave.querySelector('.trophy') && !kate.querySelector('.trophy'));
    expect(win.getComputedStyle(kate.querySelector('.ring-value')).stroke === 'rgb(213, 155, 255)');
  }));
  await check('320 px mobile dashboards stack; chart and calendar controls work',() => frame('../?preview=example',320,(doc,win) => {
    expect(doc.documentElement.scrollWidth <= 320,'Mobile dashboard overflows');
    const [dave,kate] = doc.querySelectorAll('#results [data-runner]');
    expect(dave.getBoundingClientRect().bottom < kate.getBoundingClientRect().top);
    expect(doc.querySelectorAll('.calendar .day').length === 62);
    expect(text(dave,'.ring-text') !== text(kate,'.ring-text'));
    kate.querySelector('[data-day="0"]').click();
    expect(doc.querySelector('#day-dialog').open);
    expect(text(doc,'#day-title').startsWith('Kate'));
    expect(doc.querySelectorAll('#day-details li').length === 2);
    doc.querySelector('#day-dialog').close();
    const picker = kate.querySelector('.chart-picker input');
    picker.value = '13';
    picker.dispatchEvent(new win.Event('input'));
    expect(text(kate,'.chart-tooltip').includes('13 Dec'));
  }));
  await check('Database failure shows an error without inventing zero totals, then recovers',async () => {
    mock.failRead = true;
    await connected('./',390,async doc => {
      await until(() => doc.querySelector('#retry'));
      expect(!doc.querySelector('.ring-text'));
      mock.failRead = false;
      doc.querySelector('#retry').click();
      await until(() => doc.querySelectorAll('.ring-text').length === 2);
    });
  });
  await check('Dave logs in, sees Sydney date, and saves with network-safe duplicate prevention',() => connected('dave/log/',320,async (doc,win) => {
    await until(() => !doc.querySelector('#login').hidden);
    expect(doc.documentElement.scrollWidth <= 320,'Login page overflows');
    const login = doc.querySelector('#login');
    login.elements.email.value = 'dave@example.invalid';
    login.elements.password.value = 'wrong';
    login.requestSubmit();
    await until(() => text(doc,'#log-status').includes('Could not sign in'));
    login.elements.password.value = 'test-only';
    login.requestSubmit();
    await until(() => !doc.querySelector('#log-workspace').hidden);
    const form = doc.querySelector('#run-form');
    expect(form.elements.date.value === '2026-12-01');
    form.elements.distance.value = '5';
    form.elements.minutes.value = '25';
    form.elements.minutes.dispatchEvent(new win.Event('input',{bubbles:true}));
    expect(text(doc,'#estimated-pace') === '5:00 /km');
    mock.interruptInsert = true;
    form.requestSubmit();
    form.requestSubmit();
    await until(() => text(doc,'#form-status').includes('Could not confirm'));
    form.requestSubmit();
    await until(() => text(doc,'#form-status') === 'Run saved.');
    expect(mock.rows.length === 1 && mock.writes === 1 && mock.ids.length === 2 && mock.ids[0] === mock.ids[1]);
    await until(() => doc.querySelectorAll('#run-list li').length === 1);
    form.elements.distance.value = '2';
    form.requestSubmit();
    await until(() => doc.querySelectorAll('#run-list li').length === 2);
    expect(mock.rows.every(row => row.run_date === '2026-12-01' && row.participant === 'dave'));
  }));
  await check('Remembered login, edit, delete confirmation, and synchronized public data',() => connected('dave/log/',390,async doc => {
    await until(() => doc.querySelectorAll('#run-list li').length === 2);
    doc.querySelector('#run-list button').click();
    const form = doc.querySelector('#run-form');
    expect(text(doc,'#form-title') === 'Edit run');
    form.elements.distance.value = '3';
    form.requestSubmit();
    await until(() => text(doc,'#run-list').includes('3 km'));
    doc.querySelector('#run-list li button:last-child').click();
    const dialog = doc.querySelector('#delete-dialog');
    expect(dialog.open);
    dialog.close('cancel');
    await pause(100);
    expect(mock.rows.length === 2);
    doc.querySelector('#run-list li button:last-child').click();
    dialog.close('delete');
    await until(() => doc.querySelectorAll('#run-list li').length === 1);
    expect(text(doc,'#delete-status') === 'Run deleted.');
    await connected('./',850,async dashDoc => {
      await until(() => dashDoc.querySelectorAll('.ring-text').length === 2);
      expect(text(dashDoc,'[data-runner="dave"] .ring-text strong') === '5 km');
      expect(text(dashDoc,'[data-runner="kate"] .ring-text strong') === '0 km');
      mock.rows[0].distance_km = 6;
      const signal = new BroadcastChannel('rfr-runs-changed');
      signal.postMessage('changed');
      signal.close();
      await until(() => text(dashDoc,'[data-runner="dave"] .ring-text strong') === '6 km');
    });
  }));
  await check('Wrong-account route is blocked; Kate can sign in and Dave route then blocks Kate',async () => {
    await connected('kate/log/',390,async doc => {
      await until(() => text(doc,'#log-status').includes('cannot access'));
      expect(doc.querySelector('#log-workspace').hidden);
      doc.querySelector('#logout').click();
      await until(() => !doc.querySelector('#login').hidden);
      const login = doc.querySelector('#login');
      login.elements.email.value = 'kate@example.invalid';
      login.elements.password.value = 'test-only';
      login.requestSubmit();
      await until(() => !doc.querySelector('#log-workspace').hidden);
      const form = doc.querySelector('#run-form');
      form.elements.distance.value = '8';
      form.requestSubmit();
      await until(() => text(doc,'#form-status') === 'Run saved.');
      expect(mock.rows.some(row => row.participant === 'kate' && row.distance_km === 8));
    });
    await connected('dave/log/',390,async doc => {
      await until(() => text(doc,'#log-status').includes('cannot access'));
      expect(doc.querySelector('#log-workspace').hidden);
    });
  });
}
main().catch(error => result('Browser harness',error)).finally(() => {
  summary.textContent = passed + ' passed · ' + failed + ' failed';
  summary.dataset.done = 'true';
});
