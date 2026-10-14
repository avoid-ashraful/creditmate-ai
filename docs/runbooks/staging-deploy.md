# Staging deploy

Target: `https://staging.creditmate.ai`, namespace `creditmate-staging`.

> **Scope note:** this runbook covers the manual path. Auto-deploy on merge to `main` and the CI image build
> belong to the CI pipeline (task 8.1) and are **not** implemented by the staging configuration in this repository.

## Prerequisites

- Cluster prerequisites from [k8s/README.md](../../k8s/README.md) are installed.
- Your kubeconfig context points at the staging cluster: `kubectl config current-context`.
- The image tag exists in GHCR for both `creditmate-ai-be` and `creditmate-ai-fe`.
- The external secret `creditmate/staging/backend` exists in the secret store.

## 1. Render and review

```bash
kustomize build k8s/overlays/staging > /tmp/staging.yaml
grep -n REPLACE_ME /tmp/staging.yaml && echo "placeholders remain, stop" || true
```

Check that the image tags are the intended ones and that `DATABASE_HOST`, `REDIS_URL` and `ELASTICSEARCH_URL`
point at staging-only hosts, never production.

## 2. Apply

```bash
kubectl apply -k k8s/overlays/staging
kubectl -n creditmate-staging rollout status deployment/creditmate-backend --timeout=5m
kubectl -n creditmate-staging rollout status deployment/creditmate-frontend --timeout=5m
kubectl -n creditmate-staging rollout status deployment/creditmate-celery-worker --timeout=5m
kubectl -n creditmate-staging rollout status deployment/creditmate-celery-beat --timeout=5m
```

## 3. Migrate

Migrations are not part of the manifests. Run them once per release, after the new backend pods are ready and
before you consider the deploy complete:

```bash
kubectl -n creditmate-staging exec deploy/creditmate-backend -- python manage.py migrate --noinput
kubectl -n creditmate-staging exec deploy/creditmate-backend -- python manage.py showmigrations --plan | tail -5
```

If a migration fails, stop. Do not roll forward. See [rollback.md](rollback.md).

## 4. Smoke test

```bash
scripts/smoke-test.sh https://staging.creditmate.ai
```

All four checks must print `PASS`. Any `FAIL` means roll back.

## 5. Verify

- Targets are `UP` in Prometheus (`up{job=~"creditmate-.*"}`).
- No `CreditmatePodCrashLooping` alert within 15 minutes.
- Staging data is a subset, and the database is not a production replica. Do not load production personal data into staging.

## Refresh staging data

Staging uses a data subset. Refresh it only by a documented export/import job that anonymizes personal data.
Do not copy the production database directly.
