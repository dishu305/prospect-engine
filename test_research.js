// Local test harness for api/research.js
// Mocks global fetch to avoid external network calls and runs the handler with a sample brief.

const { PassThrough } = require('stream');

// Lightweight fetch mock to simulate Tavily and Apollo responses
globalThis.fetch = async (url, opts) => {
  const body = opts && opts.body ? String(opts.body) : '';
  if (String(url).includes('tavily')) {
    // Return a fake search response with one or two results depending on query
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: 'Mock Operations Page - MockCorp',
            content: 'MockCorp operates large logistics hubs with an operations director listed as John Doe. Brazil operations presence.',
            raw_content: 'John Doe — Head of Operations',
            url: 'https://mock.example/mockcorp-ops',
            score: 0.82
          }
        ]
      }),
      text: async () => JSON.stringify({})
    };
  }

  if (String(url).includes('apollo')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        people: [
          { name: 'Ana Ramos', title: 'Head of Operations', linkedin_url: 'https://linkedin.example/ana', email: 'ana@mockcorp.com' }
        ]
      }),
      text: async () => JSON.stringify({})
    };
  }

  return { ok: false, status: 404, text: async () => 'not found' };
};

// Load handler
// Provide fake API keys so the handler enables the live-provider code paths (we still mock fetch)
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY || 'test-tavily-key';
process.env.APOLLO_API_KEY = process.env.APOLLO_API_KEY || 'test-apollo-key';

const handler = require('./api/research.js');

// Build a fake request stream with JSON body
function makeRequest(obj) {
  const req = new PassThrough();
  req.method = 'POST';
  process.nextTick(() => {
    req.write(JSON.stringify(obj));
    req.end();
  });
  return req;
}

// Build a fake response object compatible with sendJson (has status().json())
function makeResponse() {
  const res = {};
  res.status = function (code) { this._status = code; return this; };
  res.json = function (payload) { console.log('HANDLER OUTPUT:\n' + JSON.stringify({ status: this._status || 200, payload }, null, 2)); };
  return res;
}

(async () => {
  const brief = {
    vertical: 'Autonomous warehouse robotics for e-commerce fulfillment',
    reference: 'Amazon Fulfillment Network',
    goal: 'Reduce fulfillment time and worker exposure during peak seasons',
    angle: 'Autonomous robotics for high-density picking and replenishment',
    notes: 'Focus on Southeast Asia pilot sites and regional distribution hubs.'
  };

  const req = makeRequest(brief);
  const res = makeResponse();

  try {
    await handler(req, res);
    console.log('\nTest harness completed (mocked fetch).');
  } catch (err) {
    console.error('Harness error:', err && err.stack ? err.stack : err);
  }
})();
