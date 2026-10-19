# Run CreditMate locally (verified data)

One command brings up Postgres DB + Django API + the React app with the 105 verified public
cards (9 banks, dataset `verified_cards_2026-10-18`).

## Prerequisites

Postgres (a role that can `createdb` over the unix socket), `uv`, Node 18+ with the frontend's
`node_modules` installed (`npm ci --legacy-peer-deps` in `creditmate-ai-fe`), `curl`, `ss`.
Redis on `127.0.0.1:6379` (the script uses DB 5 for the cache and Celery broker; it never touches DB 0/1).

## Start / stop

```bash
# from the parent repo root (submodules checked out)
scripts/dev-up.sh                     # API :8010, built frontend :3010
scripts/dev-down.sh                   # stops exactly the PIDs dev-up wrote
```

Everything is configured with environment variables (defaults in brackets):

| Variable | Meaning |
|---|---|
| `BE_DIR` / `FE_DIR` | backend / frontend checkout [`./creditmate-ai-be`, `./creditmate-ai-fe`] |
| `DB_NAME` | Postgres database, created if missing [`creditmate_local`] |
| `BE_PORT` / `FE_PORT` | [`8010` / `3010`] |
| `REDIS_DB` | Redis DB for cache + Celery broker [`5`] |
| `RUN_DIR` | PIDs, logs, generated env, the frontend build [`./.dev-run`] |
| `SEED` | `verified` (default) or `smoke` (the 12 "Smoke Card" rows the `e2e-live` specs expect) |
| `ADMIN_USER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | when all three are set, creates a staff superuser (idempotent) |

Flags: `--celery` also starts a Celery worker + beat; `--dev` serves the frontend with
`npm start` (hot reload, slower first load) instead of a production build.

What `dev-up.sh` does, in order: create the DB, create `BE_DIR/.venv` (Python 3.12) and
`uv sync --dev`, write `$RUN_DIR/backend.env` (DEBUG, console email backend, CORS/CSRF/`FRONTEND_URL`
for the frontend origin, relaxed throttles, `SEARCH_ENABLED=False`) and load it into the process
environment — a real `.env` in `BE_DIR` is never read or modified — then `migrate`, `loaddata
all_banks.json`, `import_cards <verified fixture>` (both idempotent), optional superuser, start the
API with `runserver --noreload`, build the frontend with `REACT_APP_API_BASE_URL` and
`REACT_APP_SITE_URL` pointing at the local ports (into `$RUN_DIR/fe-build`, so several stacks can
coexist) and serve it with `serve -s`. It refuses to start if a port is busy.

Open <http://127.0.0.1:3010>; the API is at <http://127.0.0.1:8010/api/v1/> and the admin at
`/admin/`. The frontend is a build: after changing frontend code re-run `dev-down.sh && dev-up.sh`
(or use `--dev`).

## Email

Verification and password-reset mails use Django's console backend, so the link is printed in
`$RUN_DIR/backend.log`:

```bash
grep -o 'http[^ ]*verify-email?token=[^ ]*' .dev-run/backend.log | tail -1
```

## Live end-to-end tests

`creditmate-ai-fe/e2e-live/run.sh` starts a separate throwaway stack (`SEED=smoke`, DB
`creditmate_e2e`, ports 8011/3011), runs the Playwright specs against it and stops it afterwards:

```bash
creditmate-ai-fe/e2e-live/run.sh                 # all specs
creditmate-ai-fe/e2e-live/run.sh auth.spec.ts    # one spec
```

If the frontend is not checked out as `<parent>/creditmate-ai-fe`, set `PARENT_DIR`, `BE_DIR` explicitly.
The review spec reads its email-verification link from the stack's backend log
(`E2E_BACKEND_LOG`, set by `run.sh`).

## Troubleshooting

- *Port in use*: pick others (`BE_PORT=8020 FE_PORT=3020 scripts/dev-up.sh`) or stop the old stack.
- *Frontend shows "The request failed"*: the bundle was built for another API URL; rebuild by
  re-running `dev-up.sh` with the same ports you open in the browser.
- *Reset data*: `dropdb creditmate_local` and run `dev-up.sh` again.
- Logs: `$RUN_DIR/backend.log`, `frontend.log`, `frontend-build.log`, `celery-*.log`.
