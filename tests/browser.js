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


window.rfrMock = {admin:null,records:[],revoked:false,offline:false,created:false};
const project = new URL('../',location.href);
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
  for (const file of ['model.test.cjs','stage3.cjs']) {
    const source = await (await fetch('./'+file)).text();
    new Function('require',source)(name => ({
      'node:test':(label,fn) => tests.push([label,fn]),
      'node:assert/strict':assertions,
      '../model.js':M
    })[name]);
  }
  for (const [label,fn] of tests) await check(label,fn);
  await check('Countdown preserves the Christmas branding and launch transition',() => frame('../?preview=launch',390,async doc => {
    expect(!doc.getElementById('landing').hidden);
    expect(text(doc,'#landing-title') === '30 Days. 100 Ks.');
    expect(text(doc,'#launch-clock').includes('Seconds'));
    expect(doc.querySelectorAll('#landing-roster li').length === 2);
    await until(() => doc.querySelectorAll('.ring-text').length === 2);
    expect(doc.getElementById('landing').hidden);
    expect(text(doc,'#announcement') === 'THE CHALLENGE HAS BEGUN!');
  }));
  for (const width of [1280,320]) {
    await check('Three independent runners, Christmas icons and layout at '+width+'px',() => frame('../?preview=example',width,doc => {
      const cards=[...doc.querySelectorAll('#results > section')];
      expect(cards.length===3);
      expect(doc.documentElement.scrollWidth <= width,'Unexpected horizontal overflow');
      expect(cards.every(card => text(card,'.ring-text').includes('of 100 km') && card.querySelector('.rest-day svg')));
      expect(cards[0].querySelector('.runner-name').textContent==='Dave');
      expect(doc.querySelectorAll('#scheduled-days').length===1);
      expect(text(doc,'#scheduled-days').includes('scheduled running days remaining'));
      const [first,second]=cards.map(card=>card.querySelector('.runner-toggle'));
      expect(first.getAttribute('aria-expanded')==='false' && second.getAttribute('aria-expanded')==='false');
      const details=doc.getElementById(first.getAttribute('aria-controls'));
      expect(details.inert && details.getBoundingClientRect().height===0);
      first.click();
      expect(!details.inert && first.getAttribute('aria-expanded')==='true');
      expect(second.getAttribute('aria-expanded')==='false');
      expect(details.querySelector('.calendar') && details.querySelector('.chart-grid'));
      first.click();
      expect(details.inert && first.getAttribute('aria-expanded')==='false');
      const a=cards[0].getBoundingClientRect(), b=cards[1].getBoundingClientRect();
      expect(width===320 ? a.bottom<b.top : a.right<b.left);
    }));
  }
  await check('A failed backend read shows no false progress; a dynamic roster loads after retry',async () => {
    rfrMock.offline=true;
    await connected('./',390,async doc => {
      await until(() => doc.querySelector('#retry'));
      expect(!doc.querySelector('.ring-text'));
      rfrMock.offline=false;
      doc.getElementById('retry').click();
      await until(() => doc.querySelectorAll('.ring-text').length===3);
      expect(text(doc,'#results').includes('Ada'));
    });
  });
  await check('Private logging adds, edits and deletes; revoked sessions lose access',async () => {
    sessionStorage.setItem('rfr-participant-session','local-simulated-session');
    await connected('log/',320,async doc => {
      await until(() => !doc.getElementById('log-workspace').hidden);
      expect(!doc.querySelector('input[type=password]'));
      const form=doc.getElementById('run-form');
      expect(form.elements.date.value==='2026-12-01');
      form.elements.distance.value='5';
      form.elements.minutes.value='25';
      form.requestSubmit();
      await until(() => doc.querySelectorAll('#run-list li').length===1);
      doc.querySelector('#run-list button').click();
      form.elements.distance.value='6';
      form.requestSubmit();
      await until(() => text(doc,'#run-list').includes('6 km'));
      doc.querySelector('#run-list button:last-child').click();
      doc.getElementById('delete-dialog').close('delete');
      await until(() => !doc.querySelector('#run-list li'));
      rfrMock.revoked=true;
      form.elements.distance.value='7';
      form.requestSubmit();
      await until(() => doc.getElementById('log-workspace').hidden);
    });
    expect(!sessionStorage.getItem('rfr-participant-session'));
  });
  await check('Admin denies a non-admin, then creates a participant and shows a fragment link',async () => {
    rfrMock.admin='non-admin';
    await connected('admin/',390,async doc => {
      await until(() => text(doc,'#status').includes('not an administrator'));
      expect(doc.getElementById('workspace').hidden);
      doc.getElementById('logout').click();
      await until(() => !doc.getElementById('login').hidden);
      const login=doc.getElementById('login');
      login.elements.email.value='admin@example.invalid';
      login.elements.password.value='simulated-only';
      login.requestSubmit();
      await until(() => !doc.getElementById('workspace').hidden);
      const dave=[...doc.querySelectorAll('#profiles form')].find(form => form.querySelector('h2').textContent==='Dave');
      const visibility=[...dave.querySelectorAll('select')].find(select => select.options[0].textContent==='Visible');
      visibility.value='false';
      visibility.dispatchEvent(new doc.defaultView.Event('change'));
      await until(() => text(doc,'#status').includes('hidden from the public'));
      expect(dave.isConnected && dave.elements.state.value==='true' && visibility.value==='false');
      visibility.value='true';
      visibility.dispatchEvent(new doc.defaultView.Event('change'));
      await until(() => text(doc,'#status').includes('visible to the public'));
      const add=doc.getElementById('add');
      add.elements.name.value='Steve';
      add.requestSubmit();
      await until(() => !doc.getElementById('issued').hidden);
      expect(new URL(doc.getElementById('private-url').value).hash.startsWith('#token='));
      expect(rfrMock.created);
    });
  });
}
main().catch(error => result('Browser harness',error)).finally(() => {
  summary.textContent=passed+' passed · '+failed+' failed';
  summary.dataset.done='true';
});
