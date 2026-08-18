#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -n "${ASEPRITE_BIN:-}" ]] && [[ -x "${ASEPRITE_BIN}" ]]; then
  printf '%s\n' "${ASEPRITE_BIN}"
  exit 0
fi

if command -v aseprite >/dev/null 2>&1; then
  command -v aseprite
  exit 0
fi

candidates=(
  "/mnt/c/Program Files/Aseprite/Aseprite.exe"
  "/mnt/c/Program Files (x86)/Aseprite/Aseprite.exe"
  "${HOME}/.steam/debian-installation/steamapps/common/Aseprite/aseprite"
  "${HOME}/.local/share/Steam/steamapps/common/Aseprite/aseprite"
)

for candidate in "${candidates[@]}"; do
  if [[ -x "${candidate}" ]]; then
    printf '%s\n' "${candidate}"
    exit 0
  fi
done

exit 1
