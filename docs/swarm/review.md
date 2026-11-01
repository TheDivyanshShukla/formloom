# Formloom code review (T7, agent a4)

Scope: src/server/**, proxy.ts, features/auth, workspaces, forms (actions, service, queries, logic, components, builder), responses service/queries/components, integrations, app routes/pages. Skipped (in flux): deliveries, responses/server/edit*, api/forms/[id]/edit, quiz, webhook*. Every finding was traced by reading the code; none was executed. Line numbers are from the files as read on 2026-11-01.

## Findings

### 1. critical — Any signed-in user can read arbitrary server files through /api/files (path traversal, local storage driver)
File: src/features/responses/server/service.ts:134-137 (also src/server/storage.ts:21-23, src/app/api/files/[...key]/route.ts:7-8)
Scenario: STORAGE_DRIVER defaults to `local`. A user signs up, creates a form `A` in their personal workspace, then requests `GET /api/files/A/..%2f..%2f.env` (encoded slash, or `curl --path-as-is`). `readFile` authorises only `key.split("/")[0]` = `A`, which the user owns. `storage.get` then does `path.join(uploads, "A/../../.env")`, which resolves to the project's `.env` (AUTH_SECRET, DB and Redis URLs). The same trick reaches other forms' uploads if their uuid is known. The submit check `a.key.startsWith(formId + "/")` (service.ts:26) accepts `A/../B/uuid` too, so a respondent can plant a cross-form reference.
Fix: reject any key that does not match `^[A-Za-z0-9_-]{4,32}/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$` in `readFile`, in the submit key check and in `local.get`. In the local driver also assert `path.resolve(file).startsWith(LOCAL_ROOT + path.sep)`.

### 2. high — Quiz answer keys are sent to every respondent
File: src/features/forms/server/service.ts:74-81 (returned to src/app/f/[id]/page.tsx:33 as `draft`)
Scenario: `getPublicForm` returns `form.draft` untouched. The draft now carries `fields[].answerKey.correct`, `points` and `feedback`. These land in the RSC payload and the Redis/L1 cache entry, and the service worker caches `/f/*` pages (public/sw.js:48). Opening view-source on `/f/<id>` of a quiz shows every correct answer. This contradicts the copy in settings-panel.tsx:58 ("answers are never sent to their browser"). The quiz work is in progress, so this may already be on the lead's list.
Fix: in `getPublicForm`, map `draft.fields` to `({ answerKey: _k, ...f }) => f` before caching. Never put `answerKey` in `PublicFormDTO`.

### 3. high — Regex denial of service: user-supplied `pattern` runs on the server against 20 KB public input
File: src/features/forms/logic.ts:110-116 (called from src/features/responses/server/service.ts:29)
Scenario: anyone can self-register and create a form. They save a field with `pattern: "(a+)+$"` through `saveFormAction` (schema has no restriction on `pattern`, schema.ts:56). They then POST `/api/forms/<id>/responses` with `{"answers":{"q1":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"}}`. `new RegExp` runs in the Node event loop and the whole server stalls for minutes. Rate limiting does not help: 10 requests per minute is enough to hold it down.
Fix: validate `pattern` on save (max ~200 chars, reject nested quantifiers, or compile with RE2). Cap the tested string length (`s.slice(0, 1000)`) before `re.test`.

### 4. medium — Account pre-hijacking: password sign-up does not verify the email, and Google sign-in merges into it
File: src/features/auth/server/service.ts:27-36 and 45-51; src/features/auth/actions.ts:33-49
Scenario: attacker registers `victim@gmail.com` with a password they know (no email verification). The victim later clicks "Continue with Google". `upsertOAuthUser` hits `onConflictDoUpdate` on the same email and logs the victim into the attacker-created account. The attacker still holds the password and can sign in to the victim's workspace, forms and connected-sheet data at any time.
Fix: on OAuth conflict, null out `passwordHash` when the existing row has never signed in through Google (or require email verification before password login works). At minimum `set: { image, passwordHash: null }` for Google-verified emails.

### 5. medium — Autosave badge sticks on "Saving" (and the unload prompt stays on) after any re-render during a save
File: src/features/forms/components/builder/builder.tsx:72 and 96
Scenario: `latest.current = { draft, settings }` creates a new object on every render. The save callback compares `latest.current !== snapshot` by identity. If the user clicks another card, switches tab or toggles the assistant while the request is in flight (700 ms debounce plus network), any re-render replaces the object. The success branch returns early, so `setSave("saved")` never runs and no new save is scheduled because `draft` did not change. The badge spins forever, `beforeunload` blocks leaving (line 104-109), and a failed save is never surfaced either.
Fix: compare contents by identity of the parts: `if (latest.current.draft !== snapshot.draft || latest.current.settings !== snapshot.settings) return;`.

### 6. medium — Undo restores a whole old draft and silently discards later edits
File: src/features/forms/components/builder/builder.tsx:111-118, 132, 139-150, 163-179
Scenario: user deletes question 3 (snapshot taken), then renames the title, edits labels and adds two questions. None of those take a snapshot (`patchDraft`, `onChange` without a `type` key, `onDuplicate` and `add` all skip it). Pressing Undo (toolbar, Cmd+Z or the "Question deleted" toast action) pops the old snapshot and `setDraft(prev)` replaces the entire draft. All the later work is gone and the autosave then persists the loss.
Fix: snapshot before every structural change (add, duplicate, patchDraft burst) or debounce-snapshot on edits, and make toast-undo restore only the deleted field (re-insert at its index) instead of the whole draft.

### 7. medium — Anonymous upload endpoint buffers whole bodies before any size check and leaves orphan files
File: src/app/api/forms/[id]/upload/route.ts:6-14; src/features/responses/server/service.ts:116-131
Scenario: `req.formData()` reads the full multipart body into memory before `uploadFile` checks `file.size` or even whether the form exists. The rate-limit key `upload:${id}:${ip}` uses the attacker-chosen path segment `id`, so rotating random ids gives each request a fresh bucket. A multi-GB POST to `/api/forms/zzzz/upload` exhausts memory. Valid-form uploads (up to 25 MB, 20 per minute per IP) are never tied to a response, so abandoned uploads accumulate forever, and `clearResponses`/`deleteForm` also never delete stored objects (service.ts:80-85, forms/server/service.ts:113-118).
Fix: reject early on `content-length` > 26 MB, rate limit by IP alone (plus per form), check the form exists before parsing, and add a cleanup for unreferenced keys and for deleted forms.

### 8. medium — Viewers receive the webhook URL and sheet owner id in the page payload
File: src/app/(app)/forms/[id]/page.tsx:22-24; src/features/forms/server/service.ts:36-44; builder.tsx:545-549
Scenario: `getFormForUser(user.id, id)` defaults to viewer and `toDTO` returns the full `settings`. The whole `FormDTO` is passed as a prop to the client `Builder`, so a viewer sees `webhook` (Zapier/Make/Apps Script URLs usually embed the secret) and `sheet.connectedBy` in the RSC payload even though the Settings tab is hidden. (csvKey is also included, which is needed for the viewer's CSV button.)
Fix: for `role === "viewer"` blank `webhook` and strip `sheet.connectedBy` in `toDTO` (or build a separate viewer DTO).

### 9. medium — "Clear" responses is offered to viewers and always reports success
File: src/features/responses/components/responses-view.tsx:75 and 202-206
Scenario: viewer opens Responses, clicks Clear, confirms. The server (`deleteAllResponses`, service.ts:81) correctly returns false, but `clearResponsesAction`'s result is ignored and the toast says "Responses deleted". The viewer believes the data is gone and the page refresh shows it is not.
Fix: pass `canEdit` into `ResponsesView` and hide `ClearAll` for viewers; also check the action result and `toast.error` on false.

### 10. medium — Sheet resync runs with the caller's Google token, not the linker's, and wipes the sheet before rewriting
File: src/features/integrations/google/server/service.ts:175-184
Scenario: owner A linked the sheet (`connectedBy` = A). Editor B clicks Resync. `api(userId = B, ...)` uses B's token. With the `drive.file` scope B cannot see A's spreadsheet (404 or permission error), or B has no connection and sees the misleading "Google access was lost". Separately, `values:clear` runs before `put`: if the rewrite fails (quota, timeout), the sheet is left empty with no retry.
Fix: use `sheet.connectedBy` for the API calls in `resyncSheet`; write the grid first (or use a single `batchUpdate`) and clear only the leftover range.

### 11. medium — First visit creates duplicate "Personal" workspaces
File: src/features/workspaces/server/service.ts:17-27 and 46-50; src/features/workspaces/components/workspace-switcher.tsx:18
Scenario: a new account has zero memberships. `WorkspaceSwitcher` runs `Promise.all([listWorkspaces, currentWorkspace])`, and `currentWorkspace` itself calls `listWorkspaces`. Pages call it again in parallel (forms/[id]/page.tsx:22). Each call sees an empty list and runs `createWorkspace(..., "Personal", true)`. There is no unique constraint on `(personal, owner)` in the schema, so the switcher shows two or three "Personal" entries and forms may land in different ones.
Fix: create the personal workspace at sign-up (`createUser`/`upsertOAuthUser`) or guard with an advisory lock / `INSERT ... WHERE NOT EXISTS` keyed on user id.

### 12. medium — Public form accessibility blockers: unnamed groups, dangling label, unlabeled search dropdown
File: src/features/forms/components/field-input.tsx:112, 138, 178-179 (checkbox group has no role/name), 206-214, 246; src/features/forms/components/search-select.tsx:27-33
Scenario: `<label htmlFor={id}>` (line 112) points at an id that is only applied to text inputs, textarea and native select, so for choice, checkboxes, scale, rating, file and searchable dropdown the visible question text labels nothing. Checkboxes (line 178) have no `role="group"` or name, so a screen reader announces bare "Option A, checkbox". Required state and the error message (`aria-describedby`) are not attached to radiogroups or checkbox groups, and the searchable combobox input gets no accessible name at all. Collapsed builder cards activate on Enter only, not Space (question-card.tsx:88-90).
Fix: render choice/checkboxes in `<fieldset><legend>` (legend = label, `aria-required`, `aria-describedby` for the error), pass `id` and `aria-labelledby` to `ComboboxInput`, handle Space on the card.

### 13. low — AI reply overwrites edits typed while the assistant was thinking
File: src/features/forms/components/builder/ai-panel.tsx:78-86; builder.tsx:206-210
Scenario: user sends a request, keeps editing a label for the 5-15 seconds the model takes. `onApply(res.form)` does `setDraft(next)` with the AI's version of the stale draft sent at line 78, so the in-flight edits are replaced. Undo recovers them only if the user notices the toast.
Fix: disable edits while `busy`, or merge: apply AI result only when `draft` is still the object that was sent, else prompt.

### 14. low — Renaming a workspace leaves the old name on public forms for up to 5 minutes
File: src/features/workspaces/server/service.ts:58-62; src/features/forms/server/service.ts:74-81
Scenario: `getPublicForm` caches `org` (the workspace name) for 300 s; `renameWorkspace` does not call `invalidate`.
Fix: after rename, invalidate `cacheKeys.publicForm` for the workspace's forms, or shorten the TTL.

### 15. low — Cache fill can resurrect a stale value after an invalidation
File: src/server/cache/index.ts:36-38
Scenario: reader loads the form from the DB (old), editor saves and `invalidate()` deletes the key, then the reader's `redis.set(key, old, "EX", 300)` lands. The public form (including `accepting`) is stale for 5 minutes.
Fix: use a short version stamp or `SET ... NX` plus a tombstone, or lower the TTL for `accepting` changes (invalidate twice, 1 s apart).

### 16. low — `rotateCsvKey` and `setSheet` do read-modify-write of the whole form row
File: src/features/forms/server/service.ts:99-105 and 121-126
Scenario: both read the row, then `updateForm` writes `draft` and `settings` back. An autosave landing between the read and the write is reverted (draft edits lost). Window is milliseconds for rotate but includes Google round-trips only for the caller, so it is rare.
Fix: update only the settings key with `jsonb_set` (`settings = settings || '{"csvKey": ...}'`) and leave `draft` out of the SET.

### 17. low — Rate limits are bypassable when TRUST_PROXY is left at its default and the app is not behind a proxy
File: src/server/env.ts:17; src/server/rate-limit.logic.ts:11
Scenario: default `proxy` trusts the last `x-forwarded-for` hop. If the container is reached directly, the client sets that header to a random valid IP on every request and defeats sign-in, submit and AI limits. Rate-limit buckets are also keyed by the unvalidated form id (submit route.ts:13), so Redis keys are attacker-creatable.
Fix: default `TRUST_PROXY` to `none`, require it to be set explicitly in production, validate `id` against the form-id regex before building the bucket.

### 18. low — Responses beyond 10,000 are silently hidden and summaries can freeze on a huge scale
File: src/features/responses/server/queries.ts:10; src/features/responses/components/responses-view.tsx:114-116
Scenario: `selectResponses` limits to 10,000 newest rows with no indicator, so the count, charts, CSV and sheet resync (50,000 in integrations queries.ts:18) disagree for big forms. `Bars` builds `Array.from({length: max - min + 1})` for scale and rating; a field with `max: 1e9` (accepted by the schema) freezes the tab.
Fix: show "latest 10,000 of N" using `responseCount`; clamp scale/rating ranges in `Bars` the same way `ScaleInput` does (field-input.tsx:208).

## Checked and fine

- Form/response/file/sheet/invite authorization: every form read or write goes through `selectFormForUser` (membership join) and role check (`getFormForUser(..., "editor")` in save, delete, duplicate, rotate, clear, AI edit, sheet link/resync/unlink); `saveForm` re-applies server-owned `csvKey` and `sheet` so clients cannot set them (actions.ts:60-64, service.ts:93-94).
- Workspace actions: owner-only rename/invite/setRole/removeMember, last-owner guard, `selectWorkspace` validates membership before setting the cookie; stale cookie falls back safely.
- Open redirects: `safeNext` in auth/actions.ts:11-14 plus Auth.js base-URL joining; Google callback only redirects to `new URL(path, NEXT_PUBLIC_APP_URL)` with a regex-checked form id; invite `next` is encoded.
- Google OAuth: state is HMAC-signed, expiring, bound to user and form (crypto.ts:24-42); refresh tokens are AES-GCM encrypted at rest and never leave `features/integrations/google/server`; tokens are not logged.
- csvKey: compared in constant time (responses service.ts:93-97), CSV cells formula-guarded, `cache-control: no-store`.
- Submission path: file keys must belong to the form prefix (modulo finding 1), hidden fields are stripped by `validate`, accepting flag is read uncached.
- Cache: `getPublicForm` invalidated on save and delete; Redis outages fall through to the loader; rate limiter fails closed.
- Session handling: `proxy.ts` is only an optimistic gate and every page/action re-checks via `requireUser`; password hashing uses scrypt with per-user salt and `timingSafeEqual`.
- Service worker caches only static assets and `/f/` pages, never `/api` or signed-in pages (public/sw.js:27, 48).
- Offline outbox: queues only on network failure, drops on 4xx, keeps on 429/5xx.
