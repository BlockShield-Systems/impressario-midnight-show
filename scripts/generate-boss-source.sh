#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ASEPRITE="$(scripts/find-aseprite.sh)"
SCRIPT="$(realpath scripts/aseprite/generate-mirror-conductor.lua)"
GENERATED="$(realpath -m assets/source/characters/boss/mirror-conductor.generated.aseprite)"
MASTER="$(realpath -m assets/source/characters/boss/mirror-conductor.aseprite)"

rm -f "$GENERATED"

if [[ "${ASEPRITE,,}" == *.exe ]]; then
  "$ASEPRITE" \
    -b \
    --script-param "output=$(wslpath -w "$GENERATED")" \
    --script "$(wslpath -w "$SCRIPT")"
else
  "$ASEPRITE" \
    -b \
    --script-param "output=$GENERATED" \
    --script "$SCRIPT"
fi

if [[ ! -s "$GENERATED" ]]; then
  echo "FEHLER: Boss-Aseprite wurde nicht erzeugt."
  exit 1
fi

mv -f "$GENERATED" "$MASTER"
echo "Boss master source: $MASTER"
