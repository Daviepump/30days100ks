'use strict';
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent=message; };
let api;
let busy = false;
let generation = 0;

const profileFields = '<label>Name <input name="name" maxlength="60" required></label>' +
  '<label>Target (km) <input name="goal" type="number" min="0.001" max="10000" step="0.001" value="100" required></label>' +
  '<label>Accent <input name="accent" type="color" value="#b9f94b"></label>' +
  '<label>Display order <input name="order" type="number" min="0" max="100000" value="100" required></label>';
$('add').querySelector('.profile-fields').innerHTML=profileFields;

function values(form) {
  return {
    display_name:form.elements.name.value.trim(),goal_km:form.elements.goal.valueAsNumber,
    accent:form.elements.accent.value,display_order:form.elements.order.valueAsNumber
  };
}
function clearLink() { $('private-url').value=''; $('issued').hidden=true; }
function showLink(secret) {
  const url = new URL('../log/',document.baseURI);
  url.hash = 'token='+secret;
  $('private-url').value=url.href;
  $('issued').hidden=false;
  $('private-url').focus();
  $('private-url').select();
}
$('clear').onclick=clearLink;
$('copy').onclick=async () => {
  try { await navigator.clipboard.writeText($('private-url').value); status('Private link copied.'); }
  catch { $('private-url').select(); status('Copy the selected link.'); }
};
function hideWorkspace() {
  $('workspace').hidden=true;
  $('profiles').replaceChildren();
  $('run-records').replaceChildren();
  $('runs').hidden=true;
  clearLink();
}
async function operation(task) {
  if (busy) return;
  busy=true;
  try { await task(); }
  catch (error) {
    if (error.code==='denied') { hideWorkspace(); status('Administrator access is required.'); }
    else status(error.code==='conflict' ? 'This record changed. Reload it before making another edit.' :
      error.code==='invalid' ? 'Check the entered values and try again.' :
      error.code==='rate' ? 'Too many requests. Wait a minute and try again.' : 'The request could not be confirmed. Reload before retrying changes.');
  } finally { busy=false; }
}

async function showRuns(profile) {
  const result=await api.request('runs',{participant:profile.participant});
  $('runs-title').textContent=profile.display_name+'’s running records';
  const root=$('run-records');
  root.replaceChildren();
  if (!result.data.runs.length) root.textContent='No runs recorded.';
  for (const run of result.data.runs) {
    const form=document.createElement('form');
    form.className='panel log-form';
    form.innerHTML='<label>Date <input type="date" name="date" min="2026-12-01" max="2026-12-31" required></label>' +
      '<label>Distance (km) <input type="number" name="distance" min="0.001" max="1000" step="0.001" required></label>' +
      '<label>Duration (optional, seconds) <input type="number" name="duration" min="1" max="359999"></label>' +
      '<label>Elevation (optional, m) <input type="number" name="elevation" min="0" max="100000"></label>' +
      '<div class="form-actions"><button class="button primary">Save changes</button><button class="button danger" type="button">Delete run</button></div>';
    const fields=form.elements;
    fields.date.value=run.run_date;
    fields.distance.value=run.distance_km;
    fields.duration.value=run.duration_seconds ?? '';
    fields.elevation.value=run.elevation_m ?? '';
    const identity={participant:profile.participant,id:run.id,updated_at:run.updated_at};
    form.onsubmit=event => {
      event.preventDefault();
      operation(async () => {
        await api.request('save',{...identity,run_date:fields.date.value,distance_km:fields.distance.valueAsNumber,
          duration_seconds:fields.duration.valueAsNumber || null,
          elevation_m:fields.elevation.value==='' ? null : fields.elevation.valueAsNumber});
        RunningData.notify();
        status('Run corrected.');
        await showRuns(profile);
      });
    };
    form.querySelector('.danger').onclick=() => {
      if (!confirm('Delete this run?')) return;
      operation(async () => {
        await api.request('delete',identity);
        RunningData.notify();
        status('Run deleted.');
        await showRuns(profile);
      });
    };
    root.append(form);
  }
  $('runs').hidden=false;
  $('runs').scrollIntoView({block:'nearest'});
}

async function loadProfiles(expected = generation) {
  const result=await api.request('list');
  if (expected!==generation) return;
  $('profiles').replaceChildren();
  for (const profile of result.data) {
    const form=document.createElement('form');
    form.className='panel log-form';
    form.innerHTML='<h2></h2>'+profileFields+
      '<label>Status <select name="state"><option value="true">Active</option><option value="false">Inactive</option></select></label>' +
      '<div class="form-actions"><button class="button primary">Save participant</button>' +
      '<button type="button" class="button" data-action="rotate"></button>' +
      '<button type="button" class="button" data-action="revoke">Revoke link</button>' +
      '<button type="button" class="button" data-action="runs">Correct runs</button></div>';
    form.querySelector('h2').textContent=profile.display_name;
    form.elements.name.value=profile.display_name;
    form.elements.goal.value=profile.goal_km;
    form.elements.accent.value=profile.accent;
    form.elements.order.value=profile.display_order;
    form.elements.state.value=String(profile.active);
    const identity={participant:profile.participant};
    const visibility=document.createElement('label');
    visibility.textContent='Public visibility';
    const visibilitySelect=document.createElement('select');
    visibilitySelect.innerHTML='<option value="true">Visible</option><option value="false">Hidden</option>';
    visibilitySelect.value=String(profile.visible ?? true);
    visibilitySelect.disabled=typeof profile.visible !== 'boolean';
    visibility.append(visibilitySelect);
    form.querySelector('.form-actions').before(visibility);
    visibilitySelect.onchange=async () => {
      const visible=visibilitySelect.value==='true';
      visibilitySelect.value=String(profile.visible);
      if (busy) return;
      visibilitySelect.disabled=true;
      try {
        await operation(async () => {
          if (!await api.setVisibility(profile.participant,visible)) {
            throw Object.assign(new Error('Participant missing'),{code:'conflict'});
          }
          profile.visible=visible;
          visibilitySelect.value=String(visible);
          RunningData.notify();
          status(visible ? 'Participant is visible to the public.' : 'Participant is hidden from the public.');
        });
      } finally {
        visibilitySelect.disabled=false;
      }
    };
    form.onsubmit=event => {
      event.preventDefault();
      const active=form.elements.state.value==='true';
      if (profile.active && !active && !confirm('Deactivate this participant and revoke their private link?')) return;
      operation(async () => {
        await api.request('profile',{...identity,...values(form),active});
        clearLink();
        RunningData.notify();
        status('Participant updated.');
        await loadProfiles();
      });
    };
    const rotate=form.querySelector('[data-action=rotate]');
    rotate.textContent=profile.has_link ? 'Regenerate link' : 'Generate link';
    rotate.disabled=!profile.active;
    rotate.onclick=() => {
      if (profile.has_link && !confirm('Replace the current private link and end its sessions?')) return;
      operation(async () => {
        clearLink();
        const result=await api.request('rotate',identity);
        status('New link generated.');
        showLink(result.secret);
        await loadProfiles();
      });
    };
    const revoke=form.querySelector('[data-action=revoke]');
    revoke.disabled=!profile.has_link;
    revoke.onclick=() => {
      if (!confirm('Revoke the private link and end its sessions?')) return;
      operation(async () => { await api.request('revoke',identity); clearLink(); status('Link revoked.'); await loadProfiles(); });
    };
    form.querySelector('[data-action=runs]').onclick=() => operation(() => showRuns(profile));
    $('profiles').append(form);
  }
  $('workspace').hidden=false;
}

$('add').onsubmit=event => {
  event.preventDefault();
  operation(async () => {
    clearLink();
    const result=await api.request('create',values($('add')));
    $('add').reset();
    status('Participant created.');
    showLink(result.secret);
    RunningData.notify();
    await loadProfiles();
  });
};

async function sync() {
  const expected=++generation;
  try {
    const session=await api.session();
    if (expected!==generation) return;
    $('login').hidden=!!session;
    $('logout').hidden=!session;
    if (!session) { hideWorkspace(); status('Sign in with your administrator account.'); return; }
    await loadProfiles(expected);
    if (expected===generation) status('');
  } catch (error) {
    if (expected!==generation) return;
    hideWorkspace();
    status(error.code==='denied' ? 'This account is not an administrator.' : 'Could not verify administrator access.');
  }
}

$('login').onsubmit=event => {
  event.preventDefault();
  operation(async () => {
    try {
      await api.signIn($('login').elements.email.value.trim(),$('login').elements.password.value);
      $('login').reset();
      await sync();
    } catch { status('Could not sign in. Check your credentials.'); }
  });
};
$('logout').onclick=() => operation(async () => {
  generation++;
  hideWorkspace();
  await api.signOut();
  await sync();
});
RunningData.admin().then(client => {
  api=client;
  api.onAuth(sync);
  sync();
}).catch(() => status('Configure Supabase to enable the administrator portal.'));
