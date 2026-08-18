#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failure=0

if command -v node >/dev/null 2>&1; then
  printf '%-16s %s\n' "Node.js" "$(node --version)"
else
  printf '%-16s %s\n' "Node.js" "NICHT GEFUNDEN"
  failure=1
fi

if command -v npm >/dev/null 2>&1; then
  printf '%-16s %s\n' "npm" "$(npm --version)"
else
  printf '%-16s %s\n' "npm" "NICHT GEFUNDEN"
  failure=1
fi

if command -v ffmpeg >/dev/null 2>&1; then
  printf '%-16s %s\n' "ffmpeg" "$(ffmpeg -version | head -n1)"
else
  printf '%-16s %s\n' "ffmpeg" "NICHT GEFUNDEN"
  failure=1
fi

if ASEPRITE="$("${PROJECT}/scripts/find-aseprite.sh")"; then
  printf '%-16s %s\n' "Aseprite" "${ASEPRITE}"
else
  printf '%-16s %s\n' "Aseprite" "NICHT GEFUNDEN"
  failure=1
fi

printf '\n'

if [[ "${failure}" -ne 0 ]]; then
  echo "Mindestens ein benötigtes Authoring-Tool fehlt." >&2
  exit 1
fi

echo "Asset-Toolchain ist vollständig verfügbar."
