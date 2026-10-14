# Rollback

Use this when a release causes errors, failing health checks, or a migration that cannot be rolled forward.

## 1. Decide

- Error rate or latency alert started within 30 minutes of a deploy: roll back first, investigate second.
- Migration failed: stop. Do not start new pods until the schema state is known.

## 2. Roll back the workloads

Kubernetes keeps `revisionHistoryLimit: 5` revisions per deployment.

```bash
# Inspect history
kubectl -n creditmate-prod rollout history deployment/creditmate-backend

# Roll back the API, frontend and workers to the previous revision
kubectl -n creditmate-prod rollout undo deployment/creditmate-backend
kubectl -n creditmate-prod rollout undo deployment/creditmate-frontend
kubectl -n creditmate-prod rollout undo deployment/creditmate-celery-worker
kubectl -n creditmate-prod rollout undo deployment/creditmate-celery-beat

kubectl -n creditmate-prod rollout status deployment/creditmate-backend --timeout=5m
```

For a specific revision: `kubectl rollout undo deployment/<name> --to-revision=<n>`.

Prefer re-applying the last known good overlay over `rollout undo` when the environment has drifted:
`git checkout <last-good-sha> -- k8s/overlays/production && kubectl apply -k k8s/overlays/production`.
Then revert the checkout.

## 3. Database migrations

Django migrations are **not** automatically reversible. Check first:

```bash
kubectl -n creditmate-prod exec deploy/creditmate-backend -- python manage.py showmigrations <app>
```

- If the new migration is additive (new nullable column or table), the old code can run against it. Roll back the
  workloads only.
- If the migration removed or changed data, restore from backup (see below) or apply a reviewed reverse migration.
  Do not run `migrate <app> <previous>` on production without a second engineer reviewing it.

## 4. Confirm

- `scripts/smoke-test.sh https://creditmate.ai` passes.
- The alert that triggered the rollback clears within its `for` window.
- Note the incident start and end times for the post-incident review.

## Backups

Restore points come from the managed PostgreSQL service's automated backups. Confirm the retention window and the
point-in-time restore procedure with the platform owner before you need it. This repository does not manage backups.
