#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

CONFIG="${PROJECT}/.asset-tools.env"

is_usable_aseprite() {
  local candidate="${1:-}"

  [[ -n "${candidate}" ]] || return 1
  [[ -f "${candidate}" ]] || return 1

  # Windows-Programme auf DrvFS benötigen nicht zwingend
  # ein von Bash erkanntes Unix-Executable-Bit.
  if [[ "${candidate,,}" == *.exe ]]; then
    return 0
  fi

  [[ -x "${candidate}" ]]
}

if [[ -f "${CONFIG}" ]]; then
  # Die Datei wird lokal erzeugt und ist durch .gitignore ausgeschlossen.
  # shellcheck disable=SC1090
  source "${CONFIG}"
fi

if is_usable_aseprite "${ASEPRITE_BIN:-}"; then
  printf '%s\n' "${ASEPRITE_BIN}"
  exit 0
fi

if command -v aseprite >/dev/null 2>&1; then
  command -v aseprite
  exit 0
fi

candidates=(
  "/mnt/c/dev/asesprite/build/bin/aseprite.exe"
  "/mnt/c/dev/aseprite/build/bin/aseprite.exe"

  "/mnt/c/Program Files/Aseprite/Aseprite.exe"
  "/mnt/c/Program Files (x86)/Aseprite/Aseprite.exe"

  "/mnt/c/Program Files/Steam/steamapps/common/Aseprite/Aseprite.exe"
  "/mnt/c/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe"

  "/mnt/d/SteamLibrary/steamapps/common/Aseprite/Aseprite.exe"
  "/mnt/e/SteamLibrary/steamapps/common/Aseprite/Aseprite.exe"
  "/mnt/f/SteamLibrary/steamapps/common/Aseprite/Aseprite.exe"

  "${HOME}/.steam/debian-installation/steamapps/common/Aseprite/aseprite"
  "${HOME}/.steam/steam/steamapps/common/Aseprite/aseprite"
  "${HOME}/.local/share/Steam/steamapps/common/Aseprite/aseprite"
)

for candidate in "${candidates[@]}"; do
  if is_usable_aseprite "${candidate}"; then
    printf '%s\n' "${candidate}"
    exit 0
  fi
done

exit 1
