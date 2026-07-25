const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

function app(req, res) {
  if (req.url === '/api/research-status') {
    const liveResearchConfigured = Boolean(process.env.TAVILY_API_KEY);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      mode: liveResearchConfigured ? 'live-research-configured' : 'verified-demo-cache',
      liveResearchConfigured,
      contactEnrichmentConfigured: Boolean(process.env.APOLLO_API_KEY)
    }));
    return;
  }
  const requestPath = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(root, requestPath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  http.createServer(app).listen(port, () => console.log('Prospect Engine running at http://localhost:' + port));
}

module.exports = app;
