# Formloom build loop

Resumable checklist. Each tick: pick the first unchecked item, build it, run the gate, tick it.

Gate: `bun run check && bun run build`, then drive the flow in headless Playwright; design: `node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs <url> --app`.

## Done (verified 2026-11-01)
- [x] Stack: Next 16 + Bun, Postgres/Drizzle service layer, LRU+Redis cache, Auth.js, shadcn (Base UI)
- [x] Workspaces: personal + team, roles, invite links, switcher, team page
- [x] Validation + branching logic (node tests), server-side re-validation (422 on bad payloads)
- [x] Builder: node spine, insert buttons, drag reorder, logic, rule well, example checks, autosave, undo
- [x] AI panel: chat, clarifying-question chips, suggestion cards (live call untested: no API key on this machine)
- [x] Responses: KPI strip, 14-day chart, summaries, table (paged by 100), CSV, clear
- [x] Share: link, embed, Sheets IMPORTDATA, Excel, webhook + Apps Script; Settings
- [x] Public form: single sheet, searchable dropdown (lazy), file upload (local/R2), offline queue
- [x] PWA manifest + service worker; mobile 390px no overflow; dark mode
- [x] Design: framed-sheet direction (IBM Plex, stone frame, teal on data); inspector 0 FAIL on /f/[id]

## Next
- [x] Go to section from a choice, multiple-choice and checkbox grids, QR code in Send
- [x] Individual response view, pre-filled link, submit-another, closed message, quiz shows missed answers
- [x] Shuffle options and questions, text blocks, header image, font, question image, collect email, Resend notify and respondent copy
- [x] Landing: phone how-it-works at natural height, prompt kept through sign-in, work-email rule, dialog links to /forms?prompt=
- [x] Video item (YouTube, Vimeo, https mp4/webm). Not an answered question.
- [x] Live AI call with the Anthropic key now in .env.local. A vendor-onboarding prompt returned a title, 4 fields, questions and suggestions. The in-app action was not clicked in a browser.
- [x] Resend test mail accepted (HTTP 200) using RESEND_API_KEY and MAIL_FROM now in .env.local.
- [ ] Real Google Sheet round trip. No OAuth client is registered for http://localhost:3000/api/integrations/google/callback.
- [ ] Publish the repo. formloom is not a git repo and gh is not logged in.
- [x] Direct "Link to Sheets" (OAuth, drive.file) with append + resync (swarm T1; real Google round trip untested)
- [x] Spreadsheet-style responses grid (swarm T2)
- [x] Client IP per TRUST_PROXY; webhook SSRF guard + 3 attempts (swarm T3)
- [x] Google-Forms-familiar builder layout; workspace switcher follows the opened form
- [x] Durable delivery outbox, quiz scoring, response edit links (swarm wave 2)
- [x] Landing page: split-stage run (loom photos, live rule tester, pinned how-it-works, open create dialog); inspector 0 FAIL at 1440/768/390
