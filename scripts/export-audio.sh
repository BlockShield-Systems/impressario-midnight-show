#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${PROJECT}/assets/source/audio"
OGG_DIR="${PROJECT}/public/assets/audio/ogg"
MP3_DIR="${PROJECT}/public/assets/audio/mp3"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg fehlt." >&2
  echo "Installation unter Ubuntu/WSL2:" >&2
  echo "  sudo apt update && sudo apt install -y ffmpeg" >&2
  exit 1
fi

mkdir -p "${OGG_DIR}" "${MP3_DIR}"

exported=0

while IFS= read -r -d '' sourceFile; do
  relative="${sourceFile#${SOURCE_DIR}/}"
  relativeWithoutExtension="${relative%.*}"

  oggFile="${OGG_DIR}/${relativeWithoutExtension}.ogg"
  mp3File="${MP3_DIR}/${relativeWithoutExtension}.mp3"

  mkdir -p \
    "$(dirname "${oggFile}")" \
    "$(dirname "${mp3File}")"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -i "${sourceFile}" \
    -map_metadata -1 \
    -vn \
    -c:a libvorbis \
    -q:a 6 \
    "${oggFile}"

  ffmpeg \
    -hide_banner \
    -loglevel error \
    -y \
    -i "${sourceFile}" \
    -map_metadata -1 \
    -vn \
    -c:a libmp3lame \
    -q:a 2 \
    "${mp3File}"

  printf 'Audio exportiert: %s\n' "${relativeWithoutExtension}"
  exported=$((exported + 1))
done < <(
  find "${SOURCE_DIR}" \
    -type f \
    \( -iname '*.wav' -o -iname '*.wave' \) \
    -print0 |
  sort -z
)

if [[ "${exported}" -eq 0 ]]; then
  echo "Keine WAV-Masterdateien gefunden."
  exit 0
fi

printf '\n%s Audio-Masterdatei(en) exportiert.\n' "${exported}"
