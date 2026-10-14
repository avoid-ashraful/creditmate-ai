#!/usr/bin/env bash
# Apply the data-quality reporting views with psql only (no Django, no Python).
#
#   DQ_DATABASE_URL='postgresql://<admin_user>@<host>:5432/<db>' monitoring/sql/apply.sh
#
# Use an account that can CREATE SCHEMA and CREATE ROLE, and supply the password
# through PGPASSWORD or ~/.pgpass rather than inside the URL, so it stays out of
# the process list. The script is idempotent: rerun it after editing the SQL.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${DQ_DATABASE_URL:?set DQ_DATABASE_URL to a postgresql:// URL with CREATE privileges}"
command -v psql >/dev/null || { echo "psql not found on PATH" >&2; exit 1; }

# -1 runs the whole file in one transaction; ON_ERROR_STOP aborts on the first error.
psql "$DQ_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -q -f "$here/data_quality_views.sql"
echo "Applied $here/data_quality_views.sql"
