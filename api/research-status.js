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

module.exports = function handler(_request, response) {
  try {
    sendJson(response, 200, {
      mode: process.env.TAVILY_API_KEY ? 'live-research-configured' : 'verified-demo-cache',
      liveResearchConfigured: Boolean(process.env.TAVILY_API_KEY),
      contactEnrichmentConfigured: Boolean(process.env.APOLLO_API_KEY)
    });
  } catch (error) {
    sendJson(response, 500, {
      error: 'research-status_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
