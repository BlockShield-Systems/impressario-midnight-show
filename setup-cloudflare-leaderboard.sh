#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

if ! command -v npx >/dev/null 2>&1; then
  echo "npm/npx fehlt." >&2
  exit 1
fi

echo "Cloudflare-Anmeldung wird geprüft..."
npx wrangler whoami

echo
echo "D1-Datenbank wird erstellt..."
set +e
CREATE_OUTPUT="$(
  npx wrangler d1 create \
    impressario-leaderboard \
    2>&1
)"
CREATE_STATUS=$?
set -e

printf '%s\n' "${CREATE_OUTPUT}"

DATABASE_ID="$(
  printf '%s\n' "${CREATE_OUTPUT}" |
  grep -Eo \
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' |
  tail -n1
)"

if [[ -z "${DATABASE_ID}" ]]; then
  echo
  echo "Keine neue ID erkannt."
  echo "Falls die Datenbank bereits existiert:"
  echo "  npx wrangler d1 list"
  echo
  read -r -p \
    "D1 database_id eingeben: " \
    DATABASE_ID
fi

if [[ ! "${DATABASE_ID}" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Ungültige D1-ID." >&2
  exit 1
fi

python3 - \
  wrangler.jsonc \
  "${DATABASE_ID}" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
database_id = sys.argv[2]

text = path.read_text(encoding="utf-8")

import re

text, count = re.subn(
    r'"database_id"\s*:\s*"[^"]+"',
    f'"database_id": "{database_id}"',
    text,
    count=1,
)

if count != 1:
    raise SystemExit(
        "database_id konnte nicht gesetzt werden"
    )

path.write_text(text, encoding="utf-8")
PY

echo
echo "Remote-Migration wird angewendet..."
npx wrangler d1 migrations apply \
  impressario-leaderboard \
  --remote

echo
echo "Turnstile im Cloudflare Dashboard anlegen:"
echo "  https://dash.cloudflare.com/?to=/:account/turnstile"
echo
echo "Danach TURNSTILE_SITE_KEY und ALLOWED_ORIGIN"
echo "in wrangler.jsonc setzen."
echo
echo "Turnstile Secret sicher speichern:"
echo "  npx wrangler secret put TURNSTILE_SECRET_KEY"
echo
echo "Anschließend deployen:"
echo "  npm run deploy"
