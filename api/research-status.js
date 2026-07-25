module.exports = function handler(_request, response) {
  response.status(200).json({
    mode: process.env.TAVILY_API_KEY ? 'live-research-configured' : 'verified-demo-cache',
    liveResearchConfigured: Boolean(process.env.TAVILY_API_KEY),
    contactEnrichmentConfigured: Boolean(process.env.APOLLO_API_KEY)
  });
};
