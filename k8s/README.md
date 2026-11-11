> **DEPRECATED — superseded by the Helm chart in `charts/creditmate/`.**
> New deploys use the chart (see `charts/creditmate/README.md` and
> `scripts/cluster-up.sh`). These Kustomize manifests are kept for one
> release as reference only and will be removed afterwards. The chart also
> closes this directory's documented gaps: migrations run as a hook Job,
> NetworkPolicies exist, and local Postgres/Redis are provided in-cluster.

# Kubernetes manifests

Kustomize layout for the Creditmate platform (frontend, backend, Celery).

```
k8s/
├── base/                  # environment-agnostic resources
│   ├── *-deployment.yaml  # frontend (nginx), backend (gunicorn), celery worker, celery beat
│   ├── *-service.yaml     # ClusterIP services
│   ├── hpa.yaml           # CPU > 70%, memory > 80%
│   ├── pdb.yaml           # PodDisruptionBudgets (maxUnavailable: 1)
│   ├── ingress.yaml       # TLS, rate limit, ModSecurity WAF
│   ├── configmap.yaml     # non-secret config (placeholders)
│   └── external-secret.yaml  # secrets pulled from the external store
├── overlays/
│   ├── staging/           # namespace creditmate-staging, host staging.creditmate.ai
│   └── production/        # namespace creditmate-prod, host creditmate.ai
└── examples/
    └── backend-secret.example.yaml  # template only, NOT part of any overlay
```

## Rendering

```bash
kustomize build k8s/overlays/staging      # or: kubectl kustomize k8s/overlays/staging
kustomize build k8s/overlays/production
```

Rendering does not contact a cluster. Nothing here is applied automatically.

## Placeholders

Every value that must be filled in per environment is written as `REPLACE_ME_*`:

| Placeholder | Where | Filled by |
|---|---|---|
| `REPLACE_ME_IMAGE_TAG` | overlay `images:` | release pipeline (immutable git SHA tag) |
| `REPLACE_ME_CLUSTER_SECRET_STORE` | `base/external-secret.yaml` | platform team |
| `REPLACE_ME_CLUSTER_ISSUER` | `base/ingress.yaml` | cert-manager ClusterIssuer name |
| `REPLACE_ME_*_HOST`, `REPLACE_ME_*_DB_*` | overlay ConfigMap patches | per-environment infra |

`kustomize build` succeeds with placeholders in place, so nothing stops a leftover placeholder from reaching a cluster.
Before the first real deploy of an overlay, this must print nothing:

```bash
kustomize build k8s/overlays/staging | grep -n REPLACE_ME
```

The base files intentionally contain placeholders, so checking the source directory with grep is not meaningful.

## Secrets

- No real secret values exist in this repository.
- `base/external-secret.yaml` makes External Secrets Operator create the `creditmate-backend-secrets` Secret from
  remote key `creditmate/<env>/backend`.
- `examples/backend-secret.example.yaml` documents the expected keys only.

## Cluster prerequisites (not installed by these manifests)

- ingress-nginx (ingress class `nginx`), with ModSecurity and OWASP CRS enabled for the WAF annotations.
- cert-manager with a ClusterIssuer.
- External Secrets Operator with a ClusterSecretStore (`external-secrets.io/v1beta1`).
- metrics-server (required for HPA resource metrics).
- Prometheus Operator is optional; `monitoring/` provides plain rule files that work without it.

## Known gaps

- Redis, PostgreSQL and Elasticsearch are assumed to be external managed services. No in-cluster stateful sets.
- No NetworkPolicies yet.
- Migrations are not run by these manifests. Run them as a one-off step (see `docs/runbooks/staging-deploy.md`).
- Helm charts are not provided; the task allowed "k8s/ ... or Helm charts", and kustomize was chosen.
