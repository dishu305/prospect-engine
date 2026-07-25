# FlytBase BDR Hackathon Submission

> Replace this file with the version generated from the exact prompt released in the hackathon submission workspace. This interim version documents the shipped system.

## System access

Run locally with:

```powershell
node server.js
```

Open `http://localhost:3000`.

## What the system does

Prospect Engine converts a campaign brief into an account queue, evidence-backed research briefs, verified target contacts, and generated outbound drafts. It is deliberately evidence-first: citations are shown with each account; persona or email data is never guessed; and the rendered outreach exposes its personalization inputs.

## Implementation

- `app.js` contains the inspectable ICP scoring inputs, evidence cache, role verification decisions, and email generation function.
- `index.html` and `styles.css` implement the operator workflow and results review.
- `server.js` is a zero-dependency local web server.
- `THOUGHT_PROCESS.md` contains the process map and failure policy.

## Known limitation and mitigation

This demo uses a checked public-source research cache so it remains repeatable during a live review. A production deployment should refresh the cache through a compliant search/news provider and a licensed contact-enrichment provider. Any unavailable verification remains a blocked record, never fabricated output.
