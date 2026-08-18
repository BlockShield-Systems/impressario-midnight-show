#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

SOURCE="${PROJECT}/assets/source/characters/impressario/impressario.aseprite"
OUTPUT_DIR="${PROJECT}/public/assets/atlases"
OUTPUT_IMAGE="${OUTPUT_DIR}/impressario.png"
OUTPUT_JSON="${OUTPUT_DIR}/impressario.json"

if [[ ! -f "${SOURCE}" ]]; then
  cat >&2 <<'ERROR_EOF'
Aseprite-Masterdatei fehlt:

  assets/source/characters/impressario/impressario.aseprite
ERROR_EOF
  exit 1
fi

ASEPRITE="$("${PROJECT}/scripts/find-aseprite.sh")" || {
  echo "Aseprite CLI wurde nicht gefunden." >&2
  exit 1
}

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_IMAGE}" "${OUTPUT_JSON}"

ASEPRITE_SOURCE="${SOURCE}"
ASEPRITE_IMAGE="${OUTPUT_IMAGE}"
ASEPRITE_JSON="${OUTPUT_JSON}"

if [[ "${ASEPRITE,,}" == *.exe ]]; then
  if ! command -v wslpath >/dev/null 2>&1; then
    echo "wslpath fehlt; Windows-Aseprite kann nicht verwendet werden." >&2
    exit 1
  fi

  ASEPRITE_SOURCE="$(wslpath -w "${SOURCE}")"
  ASEPRITE_IMAGE="$(wslpath -w "${OUTPUT_IMAGE}")"
  ASEPRITE_JSON="$(wslpath -w "${OUTPUT_JSON}")"
fi

# --list-tags muss vor der Quelldatei stehen, weil es sich auf
# das nachfolgend geladene Sprite bezieht.
"${ASEPRITE}" \
  --batch \
  --list-tags \
  "${ASEPRITE_SOURCE}" \
  --sheet "${ASEPRITE_IMAGE}" \
  --data "${ASEPRITE_JSON}" \
  --format json-hash \
  --sheet-type packed \
  --filename-format '{tag}_{tagframe000}' \
  --border-padding 2 \
  --shape-padding 2 \
  --inner-padding 1

if [[ ! -s "${OUTPUT_IMAGE}" ]]; then
  echo "Atlas-Bild wurde nicht erzeugt: ${OUTPUT_IMAGE}" >&2
  exit 1
fi

if [[ ! -s "${OUTPUT_JSON}" ]]; then
  echo "Atlas-Metadaten wurden nicht erzeugt: ${OUTPUT_JSON}" >&2
  exit 1
fi

cd "${PROJECT}"

node - <<'NODE_EOF'
const fs = require("node:fs");

const path = "public/assets/atlases/impressario.json";
const atlas = JSON.parse(fs.readFileSync(path, "utf8"));
const tags = atlas?.meta?.frameTags;

if (!Array.isArray(tags)) {
  console.error("Exportfehler: meta.frameTags fehlt.");
  process.exit(1);
}

console.log("Exportierte Tags:");

for (const tag of tags) {
  console.log(
    `  ${tag.name}: Frames ${tag.from}-${tag.to}`,
  );
}
NODE_EOF

node scripts/validate-player-atlas.mjs

printf '\nPlayer-Atlas erfolgreich exportiert:\n'
printf '  %s\n' "${OUTPUT_IMAGE}"
printf '  %s\n' "${OUTPUT_JSON}"
