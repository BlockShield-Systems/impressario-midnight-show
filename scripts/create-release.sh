#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

ROOT="$(dirname "${PROJECT}")"
NAME="$(basename "${PROJECT}")"
ARCHIVE="${ROOT}/${NAME}.zip"

cd "${PROJECT}"

required=(
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  wrangler.jsonc
  src/main.ts
  src/leaderboard/LeaderboardClient.ts
  src/player/PlayerHealthSystem.ts
  src/world/MirrorCoreSystem.ts
  worker/src/index.ts
  worker/migrations/0001_initial.sql
)

for file in "${required[@]}"; do
  if [[ ! -f "${file}" ]]; then
    echo "Pflichtdatei fehlt: ${file}" >&2
    exit 1
  fi
done

if [[ ! -x node_modules/.bin/tsc ]]; then
  npm ci
fi

npm run build

if ! grep -Rqs \
  'GLOBAL LEADERBOARD' \
  dist/assets/*.js
then
  echo "Leaderboard fehlt im Produktionsbundle." >&2
  exit 1
fi

if ! grep -Rqs \
  'IMPRESSARIO TRUE MAGICIAN' \
  dist/assets/*.js
then
  echo "Finale fehlt im Produktionsbundle." >&2
  exit 1
fi

if find dist -type f -name '*.map' -print -quit |
   grep -q .
then
  echo "Source-Map im Produktionsbuild gefunden." >&2
  exit 1
fi

rm -f "${ARCHIVE}"

cd "${ROOT}"

zip -qr \
  "${ARCHIVE}" \
  "${NAME}" \
  -x \
  "${NAME}/.git/*" \
  "${NAME}/.wrangler/*" \
  "${NAME}/node_modules/*" \
  "${NAME}/dist/*" \
  "${NAME}/.dev.vars" \
  "${NAME}/*.zip" \
  "${NAME}/*.bak" \
  "${NAME}/**/*.bak"

printf '\n'
printf '%s\n' \
  '============================================'
printf '%s\n' \
  'IMPRESSARIO M6C RELEASE ERZEUGT'
printf '%s\n' \
  '============================================'
printf 'Projekt: %s\n' "${PROJECT}"
printf 'Archiv:  %s\n' "${ARCHIVE}"
printf 'Größe:   %s Bytes\n' \
  "$(stat -c '%s' "${ARCHIVE}")"
printf 'SHA-256: %s\n' \
  "$(sha256sum "${ARCHIVE}" | cut -d' ' -f1)"
printf 'Build:   erfolgreich\n'
printf 'Source-Maps: keine\n'
