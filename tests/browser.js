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
async function main() {
  const tests = [];
  const source = await (await fetch('./model.test.cjs')).text();
  new Function('require',source)(name => ({
    'node:test':(label,fn) => tests.push([label,fn]),
    'node:assert/strict':assertions,
    '../model.js':M
  })[name]);
  for (const [label,fn] of tests) await check(label,fn);
  await check('Production JSON passes validation',async () => {
    const json = await (await fetch('../runs.json')).json();
    M.validate(json);
  });
  await check('Desktop prelaunch and advancing countdown',() => frame('../?preview=pre',1280,async doc => {
    expect(!doc.querySelector('#landing').hidden && doc.querySelector('#dashboard').hidden);
    const seconds = text(doc,'#launch-clock div:last-child strong');
    await until(() => text(doc,'#launch-clock div:last-child strong') !== seconds);
    expect(doc.documentElement.scrollWidth <= 1280,'Desktop landing overflows');
  }));
  await check('Open tab automatically launches at simulated Sydney midnight',() => frame('../?preview=launch',390,async doc => {
    expect(!doc.querySelector('#landing').hidden);
    await until(() => !doc.querySelector('#dashboard').hidden);
    expect(doc.querySelector('#landing').hidden);
    expect(text(doc,'#announcement') === 'THE CHALLENGE HAS BEGUN!');
    dash(doc,'0% complete');
  }));
  const scenarios = {
    zero:'No runs recorded yet',ahead:'Ahead of target',behind:'Behind target',
    milestones:'Halfway to Freedom',complete:'RESPONSIBILITIES SUCCESSFULLY AVOIDED!',final:'Challenge ended'
  };
  for (const [mode, word] of Object.entries(scenarios)) {
    await check('Dashboard scenario · ' + mode,() => frame('../?preview=' + mode,1280, doc => {
      dash(doc,word);
      expect(doc.documentElement.scrollWidth <= 1280,'Desktop dashboard overflows');
      if (mode === 'milestones') expect(doc.querySelectorAll('.badge.unlocked').length === 3);
      if (mode === 'complete' || mode === 'final') expect(doc.querySelector('.ring-value').getAttribute('stroke-dashoffset') === '0');
      if (mode === 'final') expect(doc.querySelector('#finish-clock').hidden && text(doc,'.trophy').includes('SUCCESSFULLY'));
    }));
  }
  await check('320 px mobile layout, calendar day details and chart controls',() => frame('../?preview=example',320, (doc,win) => {
    expect(doc.documentElement.scrollWidth <= 320,'Mobile dashboard overflows');
    expect(doc.querySelectorAll('.calendar .day').length === 31);
    doc.querySelector('[data-day="0"]').click();
    expect(doc.querySelector('#day-dialog').open);
    expect(doc.querySelectorAll('#day-details li').length === 2);
    doc.querySelector('#day-dialog').close();
    doc.querySelector('.chart-hit button').click();
    expect(text(doc,'.chart-tooltip').includes('1 Dec'));
    const picker = doc.querySelector('.chart-picker input');
    picker.value = '13';
    picker.dispatchEvent(new win.Event('input'));
    expect(text(doc,'.chart-tooltip').includes('13 Dec'));
  }));
  await check('Repository-relative data loading, cache bypass, failure and retry',async () => {
    const base = new URL('/running-from-responsibilities/',location.href);
    const source = await (await fetch(base)).text();
    const setup = '<base href="' + base.href + '"><script>' +
      'Date.now = () => Date.parse("2026-12-01T01:00:00+11:00");' +
      'window.attempts=[];const nativeFetch=window.fetch;' +
      'window.fetch=(u,o)=>{attempts.push([u.href,o.cache]);return attempts.length===1?Promise.resolve({ok:false,status:503}):nativeFetch(u,o)};' +
      '</script>';
    await frame('',390,async (doc, win) => {
      await until(() => doc.querySelector('#retry'));
      expect(!text(doc,'#results').includes('0 km'));
      expect(win.attempts[0][0].includes('/running-from-responsibilities/runs.json?v='));
      expect(win.attempts[0][1] === 'no-store');
      doc.querySelector('#retry').click();
      await until(() => doc.querySelector('.ring-text'));
      expect(win.attempts.length === 2);
    }, source.replace('<head>','<head>' + setup));
  });
}
main().catch(error => result('Browser harness',error)).finally(() => {
  summary.textContent = passed + ' passed · ' + failed + ' failed';
  summary.dataset.done = 'true';
});
