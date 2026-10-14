# Secret rotation

Secrets live in the external secret store (path `creditmate/<env>/backend`). External Secrets Operator syncs them into
the `creditmate-backend-secrets` Kubernetes Secret every `refreshInterval` (1 hour). Nothing secret is stored in git.

Rotate on schedule (at least every 90 days), immediately after any suspected exposure, and whenever a team member with
access leaves.

## Order of operations (for any secret)

1. Create the new value in the source system (database user password, Redis password, Elasticsearch user, Sentry DSN).
2. Update the value in the external secret store under `creditmate/<env>/backend`.
3. Force a sync (don't wait an hour): `kubectl -n <ns> annotate externalsecret creditmate-backend-secrets force-sync=$(date +%s) --overwrite`.
4. Restart consumers so they read the new value: `kubectl -n <ns> rollout restart deployment/creditmate-backend deployment/creditmate-celery-worker deployment/creditmate-celery-beat`.
5. Verify: `scripts/smoke-test.sh <url>` passes, and no `CreditmatePostgresDown` or `CreditmateRedisDown` alert fired.
6. Revoke the old value in the source system only after step 5 passes.

## Django secret key

Rotating `DJANGO_SECRET_KEY` invalidates existing sessions and password-reset tokens. Announce it, and schedule it
outside peak hours. Do not reuse the old key.

## Database password

Create a second database role, switch the secret to it, verify, then drop the old role. Avoid changing a live role's
password in place, because connection pools keep old connections authenticated.

## Never

- Do not paste secret values into tickets, Slack, or shell history. Use the secret store UI or `read -s`.
- Do not commit `.env.staging` or a filled-in copy of `k8s/examples/backend-secret.example.yaml`.
