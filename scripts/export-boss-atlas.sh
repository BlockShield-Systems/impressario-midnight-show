#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ASEPRITE="$(scripts/find-aseprite.sh)"
SOURCE="$(realpath assets/source/characters/boss/mirror-conductor.aseprite)"
PNG="$(realpath -m public/assets/atlases/mirror-conductor.png)"
JSON="$(realpath -m public/assets/atlases/mirror-conductor.json)"

rm -f "$PNG" "$JSON"

export_atlas() {
  "$ASEPRITE" \
    -b "$1" \
    --sheet "$2" \
    --data "$3" \
    --format json-array \
    --sheet-pack \
    --sheet-width 2048 \
    --filename-format "{tag}_{tagframe}" \
    --list-tags
}

if [[ "${ASEPRITE,,}" == *.exe ]]; then
  export_atlas \
    "$(wslpath -w "$SOURCE")" \
    "$(wslpath -w "$PNG")" \
    "$(wslpath -w "$JSON")"
else
  export_atlas "$SOURCE" "$PNG" "$JSON"
fi

if [[ ! -s "$PNG" || ! -s "$JSON" ]]; then
  echo "FEHLER: Boss-Atlas wurde nicht vollständig exportiert."
  exit 1
fi

node --input-type=module <<'NODE'
import fs from "node:fs";

const path =
  "public/assets/atlases/mirror-conductor.json";

const content =
  fs.readFileSync(path, "utf8");

const normalized =
  content.replace(/\r\n?/g, "\n");

fs.writeFileSync(
  path,
  normalized.endsWith("\n")
    ? normalized
    : `${normalized}\n`,
  "utf8"
);
NODE

node scripts/validate-boss-atlas.mjs
