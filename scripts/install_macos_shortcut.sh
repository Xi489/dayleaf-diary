#!/bin/zsh
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "The Dayleaf shortcut currently supports macOS only."
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="${APP_DIR}/Dayleaf.app"
DESKTOP_DIR="${HOME}/Desktop"
DESKTOP_SHORTCUT="${DESKTOP_DIR}/Dayleaf.app"

chmod +x "${APP_DIR}/scripts/"*.sh
"${APP_DIR}/scripts/build_macos_launcher.sh"

mkdir -p "${DESKTOP_DIR}"
if [ -L "${DESKTOP_SHORTCUT}" ]; then
  rm "${DESKTOP_SHORTCUT}"
fi

if [ ! -e "${DESKTOP_SHORTCUT}" ]; then
  ln -s "${APP_PATH}" "${DESKTOP_SHORTCUT}"
  echo "Desktop shortcut created: ${DESKTOP_SHORTCUT}"
else
  echo "Desktop item already exists and was left unchanged: ${DESKTOP_SHORTCUT}"
fi

echo
echo "Dayleaf is ready."
echo "App: ${APP_PATH}"
echo "Desktop shortcut: ${DESKTOP_SHORTCUT}"
