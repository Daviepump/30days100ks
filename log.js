(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const slug = document.body.dataset.runner;
  const M = RunningChallenge;
  const login = $('login');
  const form = $('run-form');
  const fields = form.elements;
  const dialog = $('delete-dialog');
  let api;
  let canWrite = false;
  let busy = false;
  let readId = 0;
  let generation = 0;
  let editing = null;
  let deleting = null;
  let runs = [];
  let draftId;

  function status(message, error = false) {
    const element = $('log-status');
    element.hidden = !message;
    element.textContent = message;
    element.classList.toggle('error',error);
  }

  function formStatus(message, error = false) {
    $('form-status').textContent = message;
    $('form-status').classList.toggle('error-text',error);
  }

  function seconds() {
    return Number(fields.hours.value) * 3600 + Number(fields.minutes.value) * 60 + Number(fields.seconds.value);
  }

  function pace(distance,duration) {
    const paceSeconds = Math.round(duration / distance);
    return Math.floor(paceSeconds / 60) + ':' + String(paceSeconds % 60).padStart(2,'0') + ' /km';
  }

  function showPace() {
    const distance = fields.distance.valueAsNumber;
    $('estimated-pace').textContent = distance > 0 && seconds() > 0 ? pace(distance,seconds()) : '—';
  }

  function resetForm() {
    editing = null;
    draftId = null;
    form.reset();
    fields.date.value = M.sydneyDay(Date.now());
    $('form-title').textContent = 'Add a run';
    $('save').textContent = 'Save Run';
    $('cancel-edit').hidden = true;
    showPace();
  }

  function edit(run) {
    if (busy || !canWrite) return;
    editing = run;
    fields.date.value = run.date;
    fields.distance.value = run.distanceKm;
    const duration = run.durationSeconds;
    fields.hours.value = duration == null ? '' : Math.floor(duration / 3600);
    fields.minutes.value = duration == null ? '' : Math.floor(duration / 60) % 60;
    fields.seconds.value = duration == null ? '' : duration % 60;
    fields.elevation.value = run.elevationGainM ?? '';
    $('form-title').textContent = 'Edit run';
    $('save').textContent = 'Save Changes';
    $('cancel-edit').hidden = false;
    formStatus('');
    showPace();
    fields.date.focus();
  }

  function renderRuns() {
    const list = $('run-list');
    list.replaceChildren();
    for (const run of runs) {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = Number(run.date.slice(-2)) + ' Dec · ' + run.distanceKm + ' km';
      const details = document.createElement('span');
      details.className = 'muted';
      const metrics = [];
      if (run.durationSeconds) metrics.push(
        Math.floor(run.durationSeconds / 3600) + 'h ' + Math.floor(run.durationSeconds / 60) % 60 + 'm ' + run.durationSeconds % 60 + 's',
        pace(run.distanceKm,run.durationSeconds)
      );
      if (run.elevationGainM != null) metrics.push(run.elevationGainM + ' m elevation');
      details.textContent = metrics.join(' · ');
      const actions = document.createElement('div');
      actions.className = 'form-actions';
      for (const [label,handler] of [['Edit',() => edit(run)],['Delete',() => {
        if (busy || !canWrite) return;
        deleting = run;
        $('delete-description').textContent = title.textContent;
        dialog.returnValue = 'cancel';
        dialog.showModal();
      }]]) {
        const button = document.createElement('button');
        button.className = 'button';
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-label',label + ' run from ' + title.textContent);
        button.onclick = handler;
        actions.append(button);
      }
      item.append(title,details,actions);
      list.append(item);
    }
  }

  async function refreshRuns() {
    if (!canWrite) return;
    const current = generation;
    const request = ++readId;
    $('reload-runs').hidden = true;
    $('history-status').textContent = 'Loading runs…';
    try {
      const latest = await api.list(slug);
      if (current !== generation || request !== readId) return;
      runs = latest;
      renderRuns();
      $('history-status').textContent = runs.length ? '' : 'No runs logged yet.';
    } catch {
      if (current !== generation || request !== readId) return;
      $('history-status').textContent = 'Could not load previous runs.';
      $('reload-runs').hidden = false;
    }
  }

  function clearPrivate() {
    generation++;
    canWrite = false;
    $('log-workspace').hidden = true;
    $('reload-runs').hidden = true;
    $('run-list').replaceChildren();
    if (dialog.open) dialog.close('cancel');
    runs = [];
    resetForm();
    formStatus('');
  }

  async function syncSession() {
    const current = generation;
    try {
      const session = await api.session();
      if (generation !== current) return;
      $('retry-log').hidden = true;
      login.hidden = !!session;
      $('logout').hidden = !session;
      if (!session) {
        clearPrivate();
        status('');
        return;
      }
      if ((await api.participant()) !== slug) {
        if (generation !== current) return;
        clearPrivate();
        status('This account cannot access ' + M.participants[slug] + '’s run log. Log out to switch accounts.',true);
        return;
      }
      if (generation !== current) return;
      if (!canWrite) {
        canWrite = true;
        $('log-workspace').hidden = false;
        status('');
        await refreshRuns();
      }
    } catch {
      if (generation !== current) return;
      clearPrivate();
      status('Could not verify your session. Try reconnecting.',true);
      $('retry-log').hidden = false;
    }
  }

  function setBusy(value) {
    busy = value;
    $('save').disabled = value;
    $('cancel-edit').disabled = value;
    $('logout').disabled = value;
    login.querySelector('button').disabled = value;
    for (const input of form.querySelectorAll('input')) input.disabled = value;
  }

  login.addEventListener('submit',async event => {
    event.preventDefault();
    if (busy || !api) return;
    setBusy(true);
    status('Signing in…');
    try {
      await api.signIn(login.elements.email.value.trim(),login.elements.password.value);
      login.reset();
      await syncSession();
    } catch {
      status('Could not sign in. Check your email and password or try again.',true);
    } finally { setBusy(false); }
  });

  $('logout').onclick = async () => {
    if (busy) return;
    setBusy(true);
    clearPrivate();
    try {
      await api.signOut();
      await syncSession();
    } catch {
      status('Could not log out. Try again.',true);
    } finally { setBusy(false); }
  };

  async function mutate(operation, confirmation, report = formStatus) {
    if (busy || !canWrite) return;
    const current = generation;
    setBusy(true);
    report('Saving…');
    try {
      await operation();
      RunningData.notify();
      if (current !== generation) return;
      report(confirmation);
      await refreshRuns();
    } catch (error) {
      if (current !== generation) return;
      if (error.code === 'conflict' || error.code === 'duplicate') {
        report('This record changed or was already saved. Review the refreshed list before trying again.',true);
        resetForm();
        await refreshRuns();
      } else report('Could not confirm the change. Check your connection and retry.',true);
    } finally { setBusy(false); }
  }

  form.addEventListener('input',showPace);
  form.addEventListener('submit',event => {
    event.preventDefault();
    if (busy || !canWrite || !form.reportValidity()) return;
    const duration = seconds();
    const enteredDuration = [fields.hours,fields.minutes,fields.seconds].some(input => input.value !== '');
    if (!duration && enteredDuration) {
      formStatus('Enter a duration above zero or clear all three duration fields.',true);
      fields.hours.focus();
      return;
    }
    const values = {
      run_date:fields.date.value, distance_km:fields.distance.valueAsNumber,
      duration_seconds:duration || null, elevation_m:fields.elevation.value === '' ? null : fields.elevation.valueAsNumber
    };
    const existing = editing;
    // Retries use the same primary key if the first request reached the database.
    if (!existing && !draftId) draftId = crypto.randomUUID();
    mutate(async () => {
      await api.save(slug,existing || {id:draftId},values);
      resetForm();
    },existing ? 'Run updated.' : 'Run saved.');
  });

  dialog.addEventListener('close',() => {
    const run = deleting;
    deleting = null;
    if (!run || dialog.returnValue !== 'delete') return;
    mutate(async () => {
      await api.remove(slug,run);
      if (editing?.id === run.id) resetForm();
    },'Run deleted.', (message,error) => {
      $('delete-status')?.remove();
      const feedback = document.createElement('p');
      feedback.id = 'delete-status';
      feedback.setAttribute('role','status');
      feedback.classList.toggle('error-text',!!error);
      feedback.textContent = message;
      $('history-status').before(feedback);
    });
  });

  $('cancel-edit').onclick = () => { resetForm(); formStatus(''); };
  $('reload-runs').onclick = refreshRuns;
  async function connect() {
    $('retry-log').hidden = true;
    try {
      if (!api) {
        api = await RunningData.logger();
        api.onAuth(syncSession);
      }
      await syncSession();
    } catch (error) {
      status(error.code === 'configuration' ? 'The run log needs its Supabase configuration.' : 'Could not connect to the run log.',true);
      $('retry-log').hidden = false;
    }
  }
  $('retry-log').onclick = connect;
  resetForm();
  connect();
})();
