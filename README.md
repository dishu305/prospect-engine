# Prospect Engine

Evidence-first outbound account research for FlytBase's Latin American mining campaign.

## Run locally

```powershell
node scripts/local-server.js
```

Open `http://localhost:3000`.

## Hackathon hand-in

1. Create a private or public GitHub repository, push this repository, and copy its URL.
2. Deploy the folder with Netlify Drop, Netlify, Vercel, or GitHub Pages. This app is static; no environment variables or build command are needed.
3. Use the repository's `thought-process.html` URL as the required self-contained mind map / flowchart.
4. At the hackathon start, copy the portal's requested `Submission.md` prompt and regenerate that file against this codebase.
5. Record the five-minute walkthrough in the submission portal, then submit the four URLs/files requested there.

## Production research configuration

This app now runs as a live, input-driven research agent on Vercel. Configure `TAVILY_API_KEY` for web research and `APOLLO_API_KEY` for licensed contact enrichment in the Vercel project environment variables. `api/research-status.js` reports whether those credentials are configured. Never commit real credentials.

Quick smoke test (local, mocked providers):

```powershell
node test_research.js
```

This will run a local harness that mocks Tavily/Apollo responses and verifies the handler path. Use this to sanity-check the codebase without real API keys.

Note: the server truncates/sanitizes long search queries to accommodate Tavily's 400-character limit; the UI exposes the sanitized queries under "Sanitized search queries" in the results panel for transparency.
