const $ = selector => document.querySelector(selector);

let latestResults = null;

function getBrief() {
  return {
    vertical: $('#vertical').value.trim(),
    reference: $('#reference').value.trim(),
    goal: $('#goal').value.trim(),
    angle: $('#angle').value.trim()
  };
}

function setStatus(text, tone = 'ready') {
  const status = $('.live-dot');
  if (!status) return;
  status.textContent = text;
  status.dataset.tone = tone;
}

function setPipelineState(state) {
  const stages = [...document.querySelectorAll('[data-stage]')];
  stages.forEach(stage => {
    const label = stage.querySelector('em');
    stage.className = '';
    if (!label) return;
    if (state === 'running') label.textContent = 'Running';
    else if (state === 'done') { stage.className = 'done'; label.textContent = 'Complete'; }
    else if (state === 'error') { stage.className = 'active'; label.textContent = 'Needs attention'; }
    else label.textContent = 'Waiting';
  });

  if (state === 'running') {
    stages.forEach((stage, index) => {
      setTimeout(() => {
        stage.className = 'active';
        const label = stage.querySelector('em');
        if (label) label.textContent = 'Running';
      }, index * 220);
    });
  }
}

function renderAccounts(accounts) {
  const contacts = accounts.flatMap(account => account.contacts || []).filter(contact => !contact.name.startsWith('Contact'));
  $('#empty').hidden = true;
  $('#results').hidden = false;
  $('#summary').textContent = `${accounts.length} matched accounts, ${contacts.length} verified contacts`;
  $('#metrics').innerHTML = [
    `<div><strong>${accounts.length}</strong><span>Accounts scored</span></div>`,
    `<div><strong>${contacts.length}</strong><span>Verified named contacts</span></div>`,
    `<div><strong>${accounts.reduce((n, account) => n + (account.sources || []).length, 0)}</strong><span>Live sources</span></div>`,
    `<div><strong>${latestResults?.providers?.apollo ? '1' : '0'}</strong><span>Apollo enrichment</span></div>`
  ].join('');

  $('#accounts').innerHTML = accounts.map((account, i) => {
    const accountContacts = account.contacts || [];
    return `<article class="account"><div class="account-top"><div><span class="rank">MATCH ${String(i + 1).padStart(2, '0')}</span><h3>${account.name}</h3><p>${account.country} <span>·</span> ${account.commodity}</p></div><div class="score"><strong>${account.score}</strong><small>ICP score</small></div></div><div class="account-grid"><div><h4>Why it fits</h4><p>${account.fit}</p><h4>Evidence</h4><ul>${(account.signals || []).map(signal => `<li>${signal}</li>`).join('')}</ul></div><div><h4>Research brief</h4><p><b>Recent signal:</b> ${account.news}</p><p><b>FlytBase relevance:</b> ${account.tech}</p><div class="sources">${(account.sources || []).map(source => `<a target="_blank" rel="noreferrer" href="${source.url}">↗ ${source.label}</a>`).join('')}</div></div></div><div class="contacts"><h4>Target contacts</h4>${accountContacts.map((contact, j) => { const safe = !contact.name.startsWith('Contact'); const email = contact.email ? `<p><b>Email:</b> ${contact.email}</p>` : ''; const generated = contact.outreach ? `<div class="email"><div><span>GENERATED OUTREACH</span><b>Subject: ${contact.outreach.subject}</b></div><pre>${contact.outreach.body}</pre><p class="rationale">Personalization inputs: ${(contact.rationale || []).join(' ')}</p></div>` : '<p class="suppressed">No email generated. A named target contact must be confirmed from an authoritative public source before outreach is drafted.</p>'; return `<details ${safe && i === 0 && j === 0 ? 'open' : ''}><summary><span class="person">${safe ? contact.name : 'No verified persona'}</span><span>${contact.role}</span><span class="verified">${safe ? 'Verified' : 'Needs enrichment'}</span></summary><div class="contact-body"><p><b>Verification:</b> ${contact.verificationLink ? `<a target="_blank" rel="noreferrer" href="${contact.verificationLink}">${contact.verification}</a>` : contact.verification}</p>${email}${safe ? generated : '<p class="suppressed">No email generated. A named target contact must be confirmed from an authoritative public source before outreach is drafted.</p>'}</div></details>`; }).join('')}</div></article>`;
  }).join('');
}

function showError(message) {
  $('#empty').hidden = false;
  $('#results').hidden = true;
  $('#empty h2').textContent = 'Research could not run';
  $('#empty p').textContent = message;
  setStatus('LIVE RESEARCH ERROR', 'error');
  setPipelineState('error');
}

async function loadStatus() {
  try {
    const response = await fetch('/api/research-status');
    const status = await response.json();
    setStatus(status.liveResearchConfigured ? 'LIVE RESEARCH READY' : 'CONFIGURE TAVILY + APOLLO', status.liveResearchConfigured ? 'live' : 'config');
  } catch {
    setStatus('LIVE RESEARCH READY', 'ready');
  }
}

async function runResearch() {
  const brief = getBrief();
  const button = $('#run');
  latestResults = null;

  if (!brief.vertical || !brief.reference || !brief.goal || !brief.angle) {
    showError('Please fill in the campaign brief before running live research.');
    return;
  }

  button.disabled = true;
  button.innerHTML = 'Running live research...';
  setStatus('RUNNING LIVE RESEARCH', 'live');
  setPipelineState('running');

  try {
    const response = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brief)
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || payload.error || 'Live research failed');

    latestResults = payload;
    renderAccounts(payload.accounts || []);
    setPipelineState('done');
    setStatus('LIVE RESEARCH COMPLETE', 'live');
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Live research failed.');
  } finally {
    button.disabled = false;
    button.innerHTML = '<span class="play">↻</span> Run again';
  }
}

$('#run').addEventListener('click', runResearch);
$('#export').addEventListener('click', () => {
  if (!latestResults) return;
  const blob = new Blob([JSON.stringify(latestResults, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'prospect-engine-results.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

loadStatus();
