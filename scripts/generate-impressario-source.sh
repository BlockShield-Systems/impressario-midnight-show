#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
  pwd
)"

cd "${PROJECT}"

MASTER="$PROJECT/assets/source/characters/impressario/impressario.aseprite"
GENERATED="$PROJECT/assets/source/characters/impressario/impressario.generated.aseprite"
BACKUP="$PROJECT/assets/source/characters/impressario/impressario.manual-backup.aseprite"
SCRIPT="$PROJECT/scripts/aseprite/generate-impressario.lua"

ASEPRITE="$("$PROJECT/scripts/find-aseprite.sh")"

[[ -f "${ASEPRITE}" ]] || {
  echo "Aseprite nicht gefunden: ${ASEPRITE}" >&2
  exit 1
}

[[ -s "${MASTER}" ]] || {
  echo "Masterdatei fehlt: ${MASTER}" >&2
  exit 1
}

[[ -s "${SCRIPT}" ]] || {
  echo "Lua-Generator fehlt: ${SCRIPT}" >&2
  exit 1
}

rm -f "${GENERATED}"

cp -v "${MASTER}" "${BACKUP}"

SCRIPT_WIN="$(wslpath -w "${SCRIPT}")"
GENERATED_WIN="$(wslpath -w "${GENERATED}")"

echo
echo "Aseprite-Generator wird ausgeführt ..."
echo "Binary: ${ASEPRITE}"
echo "Script: ${SCRIPT}"
echo "Output: ${GENERATED}"
echo

"${ASEPRITE}" \
  --batch \
  --script-param "output=${GENERATED_WIN}" \
  --script "${SCRIPT_WIN}"

[[ -s "${GENERATED}" ]] || {
  echo "Generierte Datei wurde nicht erstellt." >&2
  echo "Deine bisherige Datei bleibt unverändert." >&2
  exit 1
}

echo
echo "Generierung erfolgreich:"
ls -lh "${GENERATED}" "${BACKUP}"

cp -v "${GENERATED}" "${MASTER}"

echo
echo "Neue generierte Datei wurde als Master aktiviert:"
ls -lh "${MASTER}"

echo
echo "Exportiere Atlas ..."
npm run assets:player

echo
echo "Validiere Pflicht-Tags ..."
npm run assets:player:validate

echo
echo "Generierung und Atlas-Export erfolgreich."
