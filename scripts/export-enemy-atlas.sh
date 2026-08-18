#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ASEPRITE="$(scripts/find-aseprite.sh)"
SOURCE="$(realpath assets/source/characters/enemies/enemies.aseprite)"
PNG="$(realpath -m public/assets/atlases/enemies.png)"
JSON="$(realpath -m public/assets/atlases/enemies.json)"

mkdir -p "$(dirname "$PNG")"
rm -f "$PNG" "$JSON"

run_export() {
  local source="$1"
  local png="$2"
  local json="$3"

  "$ASEPRITE" \
    -b "$source" \
    --sheet "$png" \
    --data "$json" \
    --format json-array \
    --sheet-pack \
    --sheet-width 1024 \
    --filename-format "{tag}_{tagframe}" \
    --list-tags
}

if [[ "${ASEPRITE,,}" == *.exe ]]; then
  run_export \
    "$(wslpath -w "$SOURCE")" \
    "$(wslpath -w "$PNG")" \
    "$(wslpath -w "$JSON")"
else
  run_export "$SOURCE" "$PNG" "$JSON"
fi

if [[ ! -s "$PNG" || ! -s "$JSON" ]]; then
  echo "FEHLER: Enemy-Atlas wurde nicht vollständig exportiert."
  exit 1
fi

# Aseprite for Windows emits CRLF JSON under WSL.
# Normalize the generated text asset so Git receives stable LF line endings.
node --input-type=module <<'NODE'
import fs from "node:fs";

const atlasPath = "public/assets/atlases/enemies.json";
const content = fs.readFileSync(atlasPath, "utf8");
const normalized = content.replace(/\r\n?/g, "\n");

fs.writeFileSync(
  atlasPath,
  normalized.endsWith("\n")
    ? normalized
    : `${normalized}\n`,
  "utf8"
);
NODE

node scripts/validate-enemy-atlas.mjs
