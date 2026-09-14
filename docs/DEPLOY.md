# Deployment Checklist: Workers Static Assets + D1

Base: `m10-semantic-level-authoring`, commit `62569e413709ab2dfa4d5ac0472ae510203f3cac`.
Sources: `wrangler.jsonc`, `worker/src/index.ts`, `worker/migrations/0001_initial.sql`.

This checklist is a manual runbook. Remote state and reachability were not verified when it was written. No build, tests, or deployment were executed during authoring.

Run all terminal commands from the repository root. Existing project dependencies are assumed; do not install new ones. On unexpected results, stop and investigate — do not recreate the database or secrets on suspicion.

## 1. Verify Cloudflare account and target

- [ ] **Command:**

  ```bash
  pwd
  npx wrangler --version
  npx wrangler whoami
  npx wrangler d1 list
  ```

  **Success:** The working directory is the repository root and Wrangler reports `4.131.1`. The authenticated Cloudflare account owns the existing Worker and the D1 database. Name and ID match:

  | Setting | Value |
  | --- | --- |
  | Worker | `impressario-midnight-show` |
  | D1 binding | `DB` |
  | D1 database | `impressario-leaderboard` |
  | D1 ID | `8a5731ee-c376-480f-8764-36072c693553` |
  | Expected public origin | `https://impressario-midnight-show.contact-541.workers.dev` |

  If only authentication is missing: run `npx wrangler login`, then repeat `npx wrangler whoami`. Success is being signed into the correct account. Do not create a second D1 database and do not create a Pages project.

## 2. D1 migrations and remote state

Exactly one migration exists: `worker/migrations/0001_initial.sql`. It creates the tables `runs` and `submissions` plus the indexes `idx_runs_public_ranking`, `idx_runs_started_at`, and `idx_submissions_run`. `submissions` references `runs` and enforces unique pairs of `run_id` and `sequence`.

- [ ] **Check for pending remote migrations:**

  ```bash
  npx wrangler d1 migrations list impressario-leaderboard --remote
  ```

  **Success:** Wrangler reaches the configured remote database. If `0001_initial.sql` is listed as pending, continue with the next step. If nothing is pending, the migration bookkeeping considers the database up to date. Without `--remote` this would not inspect production.

- [ ] **Apply only if pending (writes to production):**

  ```bash
  npx wrangler d1 migrations apply impressario-leaderboard --remote
  npx wrangler d1 migrations list impressario-leaderboard --remote
  ```

  **Success:** `0001_initial.sql` applies without error and the follow-up listing shows no pending migrations. Verify database and migration name before confirming any prompt. Do not additionally load the SQL file via `d1 execute --file` — that would desynchronize migration bookkeeping.

- [ ] **Confirm applied migration and schema objects:**

  ```bash
  npx wrangler d1 execute impressario-leaderboard --remote --command "SELECT name, applied_at FROM d1_migrations ORDER BY id;"
  npx wrangler d1 execute impressario-leaderboard --remote --command "SELECT type, name FROM sqlite_master WHERE name IN ('runs', 'submissions', 'idx_runs_public_ranking', 'idx_runs_started_at', 'idx_submissions_run') ORDER BY type, name;"
  ```

  **Success:** The history contains `0001_initial.sql` with a timestamp. The schema query returns exactly the two tables and three indexes. If `d1_migrations` is missing, migration application via Wrangler is not proven — investigate instead of treating it as a valid state.

## 3. Set the Turnstile secret

The Worker expects exactly one Turnstile secret: **`TURNSTILE_SECRET_KEY`**. It must belong to the widget with site key **`0x4AAAAAAETYILffpEJOeLSk`**.

`TURNSTILE_SITE_KEY` is public and already configured under `vars`, as are `ALLOWED_ORIGIN`, `BUILD_VERSION` (`0.7.0`), and `ENVIRONMENT` (`production`). `DB`, `ASSETS`, and `START_LIMITER` are bindings, not manually set secrets. In production there is no Turnstile bypass when the secret is absent.

- [ ] **Check secret names:**

  ```bash
  npx wrangler secret list --name impressario-midnight-show
  ```

  **Success:** The list contains `TURNSTILE_SECRET_KEY`. This proves existence only, not that it matches the widget. A known-good existing secret does not need to be set again.

- [ ] **If missing or provably wrong, set it interactively:**

  ```bash
  npx wrangler secret put TURNSTILE_SECRET_KEY --name impressario-midnight-show
  npx wrangler secret list --name impressario-midnight-show
  ```

  **Action:** Enter the secret key of the matching widget at the hidden prompt — not the public site key. Never pass it as a command argument, commit it to Git, or place it in `wrangler.jsonc`.

  **Success:** Wrangler confirms the write and the subsequent listing contains the name. This step modifies the existing remote Worker and may trigger a new deployment; it is not a local-only preparation step. Actual validity is only proven by a successful run start (section 6).

## 4. Allow the Turnstile domain

- [ ] **Open the dashboard (Linux with a graphical desktop):**

  ```bash
  xdg-open 'https://dash.cloudflare.com/?to=/:account/turnstile'
  ```

  Without `xdg-open`, open the same URL manually. This is a dashboard step, not a Wrangler command.

  **Action:** In the correct account, open the widget with site key `0x4AAAAAAETYILffpEJOeLSk`. In hostname/domain management, add or confirm the following hostname and save:

  ```text
  impressario-midnight-show.contact-541.workers.dev
  ```

  Use the hostname only — no `https://`, port, or path. `ALLOWED_ORIGIN` in Wrangler does not replace this Turnstile allowlist entry. The entry covers the fixed production URL, not rotating preview URLs.

  **Success:** Reopening the widget settings still shows the saved hostname. After deployment, Turnstile verification completes successfully on exactly that URL.

## 5. Deploy game and Worker together

The configuration uses `main: worker/src/index.ts`, static assets from `./dist` with binding `ASSETS`, `run_worker_first: ["/api/*"]`, and an SPA fallback. As a result, `/api/*` reaches the existing D1 Worker and the game is served from the same origin. `workers_dev: true` enables the public Workers URL. No separate Pages deployment and no additional CORS configuration are required; existing CORS code stays untouched.

- [ ] **Verify QA hooks are absent from the production bundle:**

  ```bash
  npm run build
  grep -c "__IMPRESSARIO_BOUNDARY_QA__\|__IMPRESSARIO_AUDIO_DEBUG__" dist/assets/*.js
  ```

  **Success:** The count is `0`. The QA hooks are guarded by `import.meta.env.VITE_QA_RUNTIME_INSPECTION === "1"` and must never ship to production. A non-zero count means the flag leaked into the build environment — stop and clear it before deploying. The Node test only inspects source, not the built artifact, so this check is not redundant.

- [ ] **Produce a fresh production build and publish:**

  ```bash
  npm run deploy
  ```

  This runs `npm run build && wrangler deploy` as defined in `package.json`. Use the script rather than invoking the two commands manually so both paths cannot drift apart.

  **Success:** The build exits with code 0 and produces `dist`. Wrangler confirms asset and Worker upload and prints the public URL, expected:

  ```text
  https://impressario-midnight-show.contact-541.workers.dev
  ```

  The deploy does not apply D1 migrations; those must be done beforehand. If the URL differs, stop and reconcile account/subdomain, the Turnstile hostname, and `ALLOWED_ORIGIN`. Do not change secrets or database IDs on suspicion. The commands below are smoke checks, not another Node or Playwright run.

- [ ] **Tag the deployed revision:**

  ```bash
  git tag -a "deploy-$(date +%Y%m%d)" -m "public deployment"
  git push origin --tags
  ```

  **Success:** The tag exists locally and on the remote. Without it there is no reliable record of which revision is live, since deployments happen from `m10-semantic-level-authoring` while the default branch is `milestone-7f-boss-atlas-runtime`.

## 6. Post-deployment smoke test

- [ ] **Check HTML, configuration, and D1 read access:**

  ```bash
  BASE_URL='https://impressario-midnight-show.contact-541.workers.dev'
  curl --fail-with-body --silent --show-error -i "$BASE_URL/"
  curl --fail-with-body --silent --show-error -i "$BASE_URL/api/config"
  curl --fail-with-body --silent --show-error -i "$BASE_URL/api/leaderboard?page=1&pageSize=1"
  ```

  **Success:** All three responses return HTTP 200. `/` returns HTML. `/api/config` returns JSON with `turnstileSiteKey: "0x4AAAAAAETYILffpEJOeLSk"` and `buildVersion: "0.7.0"`. The leaderboard returns JSON with `entries`, `page: 1`, `pageSize: 1`, `total`, and `pages`. An empty leaderboard is acceptable. HTML at an API path is not a success. A 200 on `/api/config` alone verifies neither D1 nor the Turnstile secret. `buildVersion` is a static config variable, not proof of the deployed Git revision.

- [ ] **Check that API paths 404 instead of falling back to the SPA:**

  ```bash
  curl --silent --show-error -i "$BASE_URL/api/deploy-smoke-not-found"
  ```

  **Success:** HTTP **404** with JSON `{"error":"Not found"}`, not HTTP 200 with the game HTML. `--fail-with-body` is deliberately omitted here because 404 is the expected result.

- [ ] **Check the game, same-origin behavior, and real Turnstile verification in a browser:**

  ```bash
  xdg-open "$BASE_URL/"
  ```

  Without a desktop, open the URL manually. Load it in a private window with no Cloudflare session, open DevTools, and disable cache in the Network tab. Load the game and complete Turnstile verification and a leaderboard-eligible run start through the normal game UI.

  **Success:** The game is publicly reachable and playable without authentication; all required assets load without HTTP errors. The game and its own `/api/*` requests use the same origin with no CORS errors. External Turnstile requests to Cloudflare are expected. After genuine verification, `POST /api/runs` responds with **HTTP 201** and JSON fields `runId`, `token`, `playerName`, `startedAt`.

  **Side effect:** This final step creates a real `active` record in the production database, though not yet a public leaderboard entry. Do not publish run tokens. Do not send synthetic finish or checkpoint requests. On HTTP 403 `Verification failed`, check the secret, widget assignment, and domain. On HTTP 429, wait at least 60 seconds (start limit: 8 per 60 seconds per IP). HTTP 500 is a failure, not a passed smoke test.
