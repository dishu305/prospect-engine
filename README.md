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

The checked research cache powers the repeatable GitHub Pages demonstration. For a live-research deployment, deploy this project to Vercel and configure `TAVILY_API_KEY` for web research and `APOLLO_API_KEY` for licensed contact enrichment in the Vercel project environment variables. `api/research-status.js` reports whether those credentials are configured. Never commit real credentials.
