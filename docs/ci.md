# CI workflows

`.github/workflows/ci.yml` runs on pull requests to `main`/`master`, pushes to those branches, version tags (`v*`), manual dispatch, and a nightly schedule. The schedule runs only the k6 smoke job; manual dispatch runs the regular checks and k6. A concurrency group cancels superseded branch/PR runs. Workflow permissions default to `contents: read`; only the container job grants `packages: write`, which is needed for version-tag publication.

## Jobs

- **Backend (matrix)**: checks the eight Django apps `accounts`, `saved`, `reviews`, `alerts`, `credit_cards`, `banks`, `search`, and `credit_mate_ai`. Each matrix leg uses PostgreSQL 16, Redis 7 at logical DB 14, and Elasticsearch 8 as service containers. It runs `uv lock --check`, frozen dependency sync, Django system and migration checks, flake8, pytest with coverage, and drf-spectacular schema validation. CI uses the `creditmate_81ci` database name.
- **Frontend checks**: installs the lockfile with `npm ci`, runs Jest with coverage, type/lint/format checks, token validation, production build, and bundle budget. It uploads the production build for browser tests.
- **Playwright production e2e**: installs/caches Chromium, serves the built frontend, and runs non-visual tests. **Visual regression** is a separate `continue-on-error` job, so its result does not gate required checks.
- **npm audit**: reports vulnerability counts to the job summary and is non-blocking.
- **Storybook**: builds Storybook for production.
- **Kubernetes and monitoring validation**: builds all `k8s/` base and overlay manifests, validates them with kubeconform, runs yamllint on `k8s/` and `monitoring/`, and checks/tests Prometheus rules with promtool.
- **Nightly k6 smoke**: runs only on schedule or manual dispatch. It starts the staging compose stack, runs `load-tests/smoke.js`, and tears the stack down.
- **Container build**: builds backend and frontend images without publishing for branch pushes. Only a `v*` tag pushes images to GHCR; pull requests do not run this job. There is no deployment job.

## Private submodule checkout

The repository uses recursive Git submodules. If either submodule is private, create a fine-grained token with read-only Contents access to each required submodule repository and add it as the repository secret `SUBMODULE_TOKEN`. Do not commit or paste a token into workflow files. Checkout uses `SUBMODULE_TOKEN` when present and otherwise falls back to `GITHUB_TOKEN`; the fallback works only when repository permissions allow it (for example, public submodules).

## Validation and known gaps

Action references use upstream version tags with inline comments because full action commit SHAs could not be verified from the offline checkout. Third-party tool releases are pinned to explicit versions. The workflow was not dispatched and no workflow changes were pushed. This checkout has uninitialized submodule worktrees, so application commands, dependency scripts, the Django app paths, real browser tests, image builds, and the full service-backed backend suite cannot be confirmed locally. The CI commands assume `manage.py` is at the backend root, pytest accepts each Django app name as a test target, and frontend scripts named `check-format`, `tokens:check`, `bundle:budget`, `build-storybook`, and Playwright are available. Review those assumptions against the initialized submodules before relying on the first hosted run. GitHub-hosted service-container health behavior and nightly stack startup also remain unverified here.
