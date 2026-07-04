# Fair Queue

Anti-bot queue allocation via behavioral fingerprinting — scores *how* a
request was made, not just *when*.

🔗 Live demo: _[add Vercel link here]_

## Core insight

Bots and humans interact with a page fundamentally differently — timing,
movement, and hesitation patterns are hard to fake convincingly. Score how a
request was made, and you can separate the two before granting queue
position.

## How it works

1. **Capture** — mouse/touch/click/form events on a test page
   (`src/capture/eventCapture.js`)
2. **Score** — a pure function computes a 0-100 "humanness confidence score"
   from movement entropy, click timing variance, and form-fill plausibility
   (`src/scoring/scoringEngine.js`)
3. **Reorder** — the queue sorts by score, arrival time as tiebreaker
   (`src/queue/queueLogic.js`)
4. **Watch** — bots that arrive first still get pushed behind humans, live,
   on the dashboard (`dashboard.html`)

## Try it

- `index.html` — capture harness. Move your mouse/finger, click, fill the
  form, watch your live humanness score.
- `dashboard.html` — live queue demo. Click **Simulate Bot Rush** and watch
  the queue self-correct.

## Validation

The scoring engine is validated against synthetic human-like and bot-like
traffic in `tests/test.js`:

- Human-like sessions score ~55–98
- Bot-like sessions score ~2–18
- Clean separation, no overlap

Run it: `node tests/test.js`

## Stack

Vanilla JS, no build step, no dependencies. Runs in-browser on StackBlitz,
deploys to Vercel. Chosen to work entirely from a phone browser over mobile
data — see [docs/PRD.md](docs/PRD.md) for the full rationale and build plan.

## Scope

This is a hackathon proof-of-concept, not a production system. Out of
scope this week: anti-spoofing against bots that deliberately mimic human
jitter, real concurrent multi-user queues, auth/payments, polished UI.
