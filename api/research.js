function sendJson(response, statusCode, payload) {
  if (response && typeof response.status === 'function' && typeof response.json === 'function') {
    response.status(statusCode).json(payload);
    return;
  }

  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', chunk => { data += chunk; });
    request.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function firstString(value) {
  return Array.isArray(value) ? value[0] : value;
}

function inferCompanyName(title = '', content = '') {
  const raw = `${title} ${content}`.trim();
  const clean = raw.split('|')[0].split(' - ')[0].split(' — ')[0].split(':')[0].trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const generic = new Set(['Leadership', 'Investors', 'News', 'Home', 'About', 'Careers', 'Contact', 'Team', 'Official']);
  const filtered = parts.filter(word => !generic.has(word));
  if (filtered.length === 0) return '';
  return filtered.join(' ').replace(/\s+/g, ' ').trim();
}

function deriveCountry(text = '') {
  if (/\bBrazil\b/i.test(text)) return 'Brazil';
  if (/\bChile\b/i.test(text)) return 'Chile';
  if (/\bPeru\b/i.test(text)) return 'Peru';
  if (/\bArgentina\b/i.test(text)) return 'Argentina';
  if (/\bMexico\b/i.test(text)) return 'Mexico';
  if (/\bColombia\b/i.test(text)) return 'Colombia';
  if (/\bLatin America\b/i.test(text)) return 'Latin America';
  return 'Latin America';
}

function deriveCommodity(vertical = '', text = '') {
  const corpus = `${vertical} ${text}`;
  if (/lithium/i.test(corpus)) return 'Lithium';
  if (/copper/i.test(corpus)) return 'Copper';
  if (/iron ore/i.test(corpus)) return 'Iron ore';
  if (/zinc/i.test(corpus)) return 'Zinc';
  if (/nickel/i.test(corpus)) return 'Nickel';
  return 'Mining';
}

function dedupeCompanies(results = []) {
  const seen = new Set();
  const companies = [];

  for (const result of results) {
    const name = inferCompanyName(result.title, result.content || result.raw_content || '');
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    companies.push({ name, source: result });
  }

  return companies;
}

async function tavilySearch(query, { maxResults = 5, includeRawContent = false } = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY is required for live research');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: includeRawContent,
      include_images: false
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tavily search failed (${response.status}): ${body}`);
  }

  return response.json();
}

function scoreAccount(company, evidenceResults, vertical) {
  const support = evidenceResults.length;
  const signalBonus = evidenceResults.reduce((total, result) => total + Math.min(10, Math.round((result.score || 0) * 10)), 0);
  const rootCommodity = String(vertical || '').split(/[,(]/)[0].toLowerCase();
  return Math.max(65, Math.min(98, 60 + support * 5 + signalBonus + (company.name.toLowerCase().includes(rootCommodity) ? 5 : 0)));
}

function makeSignals(results, company) {
  const signals = [];
  for (const result of results.slice(0, 3)) {
    const text = (result.content || result.raw_content || '').replace(/\s+/g, ' ').trim();
    const snippet = text ? text.slice(0, 220) : `Live source found: ${result.title}`;
    signals.push(snippet);
  }

  if (signals.length === 0) {
    signals.push(`Live research returned official sources for ${company.name}.`);
  }

  return signals;
}

async function apolloSearchContacts(companyName, titles) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  const endpoints = [
    'https://api.apollo.io/v1/mixed_people/search',
    'https://api.apollo.io/v1/people/search'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify({
          api_key: apiKey,
          q_organization_name: companyName,
          q_organization_names: [companyName],
          person_titles: titles,
          page: 1,
          per_page: 5
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      const people = data.people || data.contacts || data.results || data.members || [];
      if (!Array.isArray(people) || people.length === 0) continue;

      return people.slice(0, 2).map(person => ({
        name: person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Verified contact',
        role: person.title || person.role || person.job_title || 'Operations leader',
        verification: 'Verified via Apollo live enrichment',
        verificationLink: person.linkedin_url || person.profile_url || person.company_url || '',
        email: person.email || person.personal_emails?.[0]?.email || '',
        source: 'apollo'
      }));
    } catch {
      // Try the next Apollo endpoint.
    }
  }

  return [];
}

function extractNameRolePairs(text) {
  const pairs = [];
  const regexes = [
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})\s*[\-|–|—|,|:]+\s*([^\n|•]{8,120})/g,
    /([^\n|•]{2,60}?)\s*[\-|–|—|,|:]+\s*(Vice President|VP|Director|Head|Manager|Chief|Officer|Lead)[^\n|•]*/g
  ];

  for (const regex of regexes) {
    for (const match of text.matchAll(regex)) {
      const name = match[1].trim();
      const role = match[2].trim();
      if (name.split(/\s+/).length < 2) continue;
      if (!pairs.some(pair => pair.name === name && pair.role === role)) {
        pairs.push({ name, role });
      }
    }
  }

  return pairs;
}

async function tavilyFallbackContacts(companyName) {
  const response = await tavilySearch(`${companyName} leadership team operations official site`, { maxResults: 5, includeRawContent: true });
  const people = [];

  for (const result of response.results || []) {
    const corpus = `${result.title || ''}\n${result.content || ''}\n${result.raw_content || ''}`;
    for (const pair of extractNameRolePairs(corpus)) {
      if (!people.some(person => person.name === pair.name && person.role === pair.role)) {
        people.push({
          name: pair.name,
          role: pair.role,
          verification: `Live public-source verification from ${result.title || companyName}`,
          verificationLink: result.url || '',
          source: 'tavily'
        });
      }
    }
    if (people.length >= 2) break;
  }

  return people.slice(0, 2);
}

async function getContacts(companyName) {
  const titles = ['Head of Operations', 'VP HSE', 'Site Director', 'Operations Director', 'Chief Operating Officer'];
  const apolloContacts = await apolloSearchContacts(companyName, titles);
  if (apolloContacts.length) return apolloContacts;

  const tavilyContacts = await tavilyFallbackContacts(companyName);
  if (tavilyContacts.length) return tavilyContacts;

  return [{
    name: 'Contact research required',
    role: 'Site Operations / HSE leader',
    verification: 'No named target-role contact was confirmed from the live research sources',
    verificationLink: '',
    source: 'none'
  }];
}

function makeOutreach(account, contact, brief) {
  const first = contact.name.split(' ')[0];
  return {
    subject: `${account.name}: autonomous inspection at operating scale`,
    body: `Hi ${first},\n\nBased on live research into ${account.name} and the campaign brief targeting ${brief.vertical}, it looks like your team operates in the kind of high-consequence environment where autonomous drone inspection can reduce contractor exposure and improve visibility.\n\nThe research signals I found included: ${account.signals.slice(0, 2).join(' ')}\n\nWould a 20-minute conversation on how this could apply to ${account.name}'s operations be useful?\n\nBest,\n[Sender]`
  };
}

async function buildAccounts(brief) {
  const discovery = await tavilySearch(`Latin America mining companies similar to ${brief.reference} ${brief.vertical}`, { maxResults: 7, includeRawContent: false });
  const discoveryCompanies = dedupeCompanies(discovery.results || []);

  const supporting = await tavilySearch(`${brief.vertical} leading companies Latin America official sites`, { maxResults: 7, includeRawContent: false });
  const supportingCompanies = dedupeCompanies(supporting.results || []);

  const candidates = [...discoveryCompanies, ...supportingCompanies].filter(item => item.name && item.name.length > 1);
  const chosen = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = candidate.name.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    chosen.push(candidate);
    if (chosen.length >= 3) break;
  }

  if (chosen.length === 0) {
    throw new Error('No qualifying accounts were discovered from live research. Try broadening the brief.');
  }

  const accounts = [];
  for (const candidate of chosen) {
    const company = candidate.name;
    const evidence = await tavilySearch(`${company} official leadership operations mining site`, { maxResults: 4, includeRawContent: true });
    const news = await tavilySearch(`${company} recent mining operations news official`, { maxResults: 3, includeRawContent: false });
    const evidenceResults = [...(evidence.results || []), ...(news.results || [])];
    const sources = evidenceResults.slice(0, 3).map(result => ({ label: result.title || company, url: result.url }));
    const combinedText = evidenceResults.map(result => `${result.title || ''} ${result.content || ''} ${result.raw_content || ''}`).join('\n');
    const signals = makeSignals(evidenceResults, candidate);
    const contacts = await getContacts(company);

    const enrichedContacts = contacts.map(contact => ({
      ...contact,
      outreach: contact.name.startsWith('Contact') ? null : makeOutreach({ name: company, signals }, contact, brief),
      rationale: signals.slice(0, 2),
      verificationLink: contact.verificationLink || sources[0]?.url || ''
    }));

    accounts.push({
      name: company,
      country: deriveCountry(combinedText),
      commodity: deriveCommodity(brief.vertical, combinedText),
      score: scoreAccount(candidate, evidenceResults, brief.vertical),
      fit: `Live research indicates ${company} is relevant to the ${brief.reference} brief because its public footprint matches the requested ${brief.vertical.toLowerCase()} operating profile.`,
      signals,
      news: firstString((news.results || []).map(result => result.content || result.title)) || `Live research found current public sources for ${company}.`,
      tech: `Live sources suggest ${company} has the operational footprint where ${brief.angle.toLowerCase()} could reduce exposure and improve visibility.`,
      sources,
      contacts: enrichedContacts
    });
  }

  return accounts;
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'method_not_allowed', message: 'Use POST with a campaign brief.' });
      return;
    }

    const brief = await readJsonBody(request);
    if (!brief.vertical || !brief.reference || !brief.goal || !brief.angle) {
      sendJson(response, 400, { error: 'invalid_brief', message: 'vertical, reference, goal, and angle are required.' });
      return;
    }

    const accounts = await buildAccounts(brief);

    sendJson(response, 200, {
      mode: 'live-agent',
      providers: {
        tavily: Boolean(process.env.TAVILY_API_KEY),
        apollo: Boolean(process.env.APOLLO_API_KEY)
      },
      brief,
      accounts
    });
  } catch (error) {
    sendJson(response, 500, {
      error: 'live_research_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
