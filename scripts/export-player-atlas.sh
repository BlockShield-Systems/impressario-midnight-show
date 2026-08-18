#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${PROJECT}/assets/source/characters/impressario/impressario.aseprite"
OUTPUT_DIR="${PROJECT}/public/assets/atlases"
OUTPUT_IMAGE="${OUTPUT_DIR}/impressario.png"
OUTPUT_JSON="${OUTPUT_DIR}/impressario.json"

if [[ ! -f "${SOURCE}" ]]; then
  cat >&2 <<'ERROR_EOF'
Aseprite-Masterdatei fehlt.

Erwarteter Pfad:
  assets/source/characters/impressario/impressario.aseprite

Erforderliche Eigenschaften:
  Canvas:       128 x 128 px
  Farbmodus:    RGBA
  Hintergrund:  transparent
  Facing:       rechts
  Fußpunkt:     X 64 / Y 98

Pflicht-Tags:
  idle
  run
  jump_start
  rise
  fall
ERROR_EOF
  exit 1
fi

ASEPRITE="$("${PROJECT}/scripts/find-aseprite.sh")" || {
  cat >&2 <<'ERROR_EOF'
Aseprite CLI wurde nicht gefunden.

Bei einer Windows-Installation unter WSL2 beispielsweise:

  export ASEPRITE_BIN="/mnt/c/Program Files/Aseprite/Aseprite.exe"
  npm run assets:player
ERROR_EOF
  exit 1
}

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_IMAGE}" "${OUTPUT_JSON}"

ASEPRITE_SOURCE="${SOURCE}"
ASEPRITE_IMAGE="${OUTPUT_IMAGE}"
ASEPRITE_JSON="${OUTPUT_JSON}"

if [[ "${ASEPRITE}" == *.exe ]]; then
  if ! command -v wslpath >/dev/null 2>&1; then
    echo "wslpath fehlt; Windows-Aseprite kann nicht angesprochen werden." >&2
    exit 1
  fi

  ASEPRITE_SOURCE="$(wslpath -w "${SOURCE}")"
  ASEPRITE_IMAGE="$(wslpath -w "${OUTPUT_IMAGE}")"
  ASEPRITE_JSON="$(wslpath -w "${OUTPUT_JSON}")"
fi

"${ASEPRITE}" \
  --batch "${ASEPRITE_SOURCE}" \
  --sheet "${ASEPRITE_IMAGE}" \
  --data "${ASEPRITE_JSON}" \
  --format json-hash \
  --sheet-type packed \
  --list-tags \
  --filename-format '{tag}_{tagframe000}' \
  --border-padding 2 \
  --shape-padding 2 \
  --inner-padding 1

cd "${PROJECT}"
node scripts/validate-player-atlas.mjs

printf '\nPlayer-Atlas erfolgreich exportiert:\n'
printf '  %s\n' "${OUTPUT_IMAGE}"
printf '  %s\n' "${OUTPUT_JSON}"
