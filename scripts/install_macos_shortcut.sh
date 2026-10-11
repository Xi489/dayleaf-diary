#!/bin/zsh
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "The Dayleaf shortcut currently supports macOS only."
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_PATH="${APP_DIR}/dist/Dayleaf-mac.zip"
USER_APPLICATIONS_DIR="${HOME}/Applications"
APP_PATH="${USER_APPLICATIONS_DIR}/Dayleaf.app"
REPO_SHORTCUT="${APP_DIR}/Dayleaf.app"
DESKTOP_DIR="${HOME}/Desktop"
DESKTOP_SHORTCUT="${DESKTOP_DIR}/Dayleaf.app"
INSTALL_STAGING="$(mktemp -d /private/tmp/dayleaf-native-install.XXXXXX)"
trap 'rm -rf "${INSTALL_STAGING}"' EXIT

chmod +x "${APP_DIR}/scripts/"*.sh
"${APP_DIR}/scripts/build_native_macos.sh"

mkdir -p "${USER_APPLICATIONS_DIR}" "${DESKTOP_DIR}"
/usr/bin/ditto -x -k "${ARCHIVE_PATH}" "${INSTALL_STAGING}"
/usr/bin/xattr -cr "${INSTALL_STAGING}/Dayleaf.app"
/usr/bin/codesign --verify --deep --strict "${INSTALL_STAGING}/Dayleaf.app"

if [ -e "${APP_PATH}" ]; then
  EXISTING_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${APP_PATH}/Contents/Info.plist" 2>/dev/null || true)"
  if [ "${EXISTING_IDENTIFIER}" != "com.dayleaf.diary" ]; then
    echo "A different app already exists at ${APP_PATH}; it was left unchanged." >&2
    exit 1
  fi
  rm -rf "${APP_PATH}"
fi

cp -R "${INSTALL_STAGING}/Dayleaf.app" "${APP_PATH}"
/usr/bin/xattr -cr "${APP_PATH}"
/usr/bin/xattr -d com.apple.FinderInfo "${APP_PATH}" 2>/dev/null || true
/usr/bin/codesign --verify --deep --strict "${APP_PATH}"

if [ -L "${REPO_SHORTCUT}" ]; then
  rm "${REPO_SHORTCUT}"
elif [ -e "${REPO_SHORTCUT}" ]; then
  REPO_IDENTIFIER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${REPO_SHORTCUT}/Contents/Info.plist" 2>/dev/null || true)"
  if [ "${REPO_IDENTIFIER}" != "com.dayleaf.diary" ]; then
    echo "A different item already exists at ${REPO_SHORTCUT}; it was left unchanged." >&2
    exit 1
  fi
  rm -rf "${REPO_SHORTCUT}"
fi
ln -s "${APP_PATH}" "${REPO_SHORTCUT}"

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
echo "Native Dayleaf is ready."
echo "App: ${APP_PATH}"
echo "Desktop shortcut: ${DESKTOP_SHORTCUT}"
