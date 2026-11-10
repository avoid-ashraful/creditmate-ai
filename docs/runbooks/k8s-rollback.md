# Runbook: Helm rollback drill (CreditMate chart)

Purpose: prove, before you ever need it for real, that a bad CreditMate
release can be rolled back with the Helm chart in `charts/creditmate/`, and
record how long it takes. Run the drill after any chart change that touches
probes, resources, or the migrate hook — and at least once per release cycle.

## Preconditions

- Local cluster up: `scripts/cluster-up.sh --with-app`
- `kubectl get pods -n creditmate` all Ready; `curl -k https://creditmate.localhost/api/readyz/` returns ready.
- Note the current revision: `helm history creditmate -n creditmate`

## Drill

1. **Deploy a deliberately broken release** (bad image tag — pods can never become ready):

   ```bash
   time helm upgrade creditmate charts/creditmate -n creditmate \
     -f charts/creditmate/values-local.yaml \
     --set api.image.tag=does-not-exist --wait --timeout 3m   # expected to FAIL / time out
   kubectl get pods -n creditmate -w   # new API pods stuck in ImagePullBackOff; old pods keep serving
   curl -k https://creditmate.localhost/api/readyz/           # still ready: readiness + maxUnavailable 0 did their job
   ```

2. **Roll back** to the previous revision:

   ```bash
   time helm rollback creditmate -n creditmate
   kubectl rollout status deployment/creditmate-backend -n creditmate
   curl -k https://creditmate.localhost/api/readyz/
   ```

3. **Verify**: `helm history creditmate -n creditmate` shows the rollback
   revision; API/frontend/worker/beat all Ready; the migrate hook Job for the
   rolled-back revision completed (migrations are backward-compatible within
   one release — a migration that is not is a release blocker, call it out in
   the PR).

## Record the drill (evidence)

Append one row per drill run — date, chart version, broken-change used,
rollback elapsed time (from the `time` output), and any surprise:

| Date | Chart | Broken change | Rollback took | Notes |
|---|---|---|---|---|
| _not yet run_ | 0.1.0 | — | — | Drill is executed in the consolidated verification pass after all six capability streams land (per Ash's reduced-testing direction, 2026-11-11); this runbook is the procedure that pass follows. |

## Real incident rollback

Same commands without the `--set` sabotage: identify the last good revision
in `helm history`, `helm rollback creditmate <REV> -n <namespace>`, verify
readyz + one user-visible page, then write up what the bad revision changed.
If the bad release ran an irreversible migration, rollback of code alone is
not enough — restore from the database backup/snapshot first, then roll back.
