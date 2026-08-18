#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ASEPRITE="$(scripts/find-aseprite.sh)"
SCRIPT="$(realpath scripts/aseprite/generate-enemies.lua)"
TARGET="$(realpath -m assets/source/characters/enemies/enemies.generated.aseprite)"
MASTER="$(realpath -m assets/source/characters/enemies/enemies.aseprite)"

rm -f "$TARGET"

if [[ "${ASEPRITE,,}" == *.exe ]]; then
  "$ASEPRITE" \
    -b \
    --script-param "output=$(wslpath -w "$TARGET")" \
    --script "$(wslpath -w "$SCRIPT")"
else
  "$ASEPRITE" \
    -b \
    --script-param "output=$TARGET" \
    --script "$SCRIPT"
fi

if [[ ! -s "$TARGET" ]]; then
  echo "FEHLER: Aseprite-Quelldatei wurde nicht erzeugt."
  exit 1
fi

mv -f "$TARGET" "$MASTER"
echo "Enemy master source: $MASTER"
