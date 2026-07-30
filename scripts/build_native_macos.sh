#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${APP_DIR}/Dayleaf.app"
CONTENTS="${TARGET}/Contents"
MACOS_DIR="${CONTENTS}/MacOS"
RESOURCES_DIR="${CONTENTS}/Resources"
SWIFT_SOURCE="${APP_DIR}/native/DayleafApp.swift"
INFO_PLIST="${APP_DIR}/native/Info.plist"
WEB_BUNDLE="${APP_DIR}/tmp/native/Dayleaf.html"
ICON="${APP_DIR}/assets/Dayleaf.icns"
ARCH="$(uname -m)"
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
MODULE_CACHE="${APP_DIR}/tmp/swift-module-cache"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "The native Dayleaf app currently supports macOS only." >&2
  exit 1
fi

SWIFTC="$(xcrun --find swiftc)"
if [ ! -x "${SWIFTC}" ]; then
  echo "Swift compiler not found. Install Xcode Command Line Tools first." >&2
  exit 1
fi

if [ ! -f "${ICON}" ]; then
  echo "Missing ${ICON}. Run the icon build from a complete Dayleaf checkout." >&2
  exit 1
fi

node "${APP_DIR}/scripts/bundle_native.mjs"

rm -rf "${TARGET}"
mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}" "${MODULE_CACHE}"

"${SWIFTC}" \
  -O \
  -parse-as-library \
  -sdk "${SDK_PATH}" \
  -target "${ARCH}-apple-macosx13.1" \
  -module-cache-path "${MODULE_CACHE}" \
  -framework Cocoa \
  -framework WebKit \
  "${SWIFT_SOURCE}" \
  -o "${MACOS_DIR}/Dayleaf"

cp "${INFO_PLIST}" "${CONTENTS}/Info.plist"
cp "${WEB_BUNDLE}" "${RESOURCES_DIR}/Dayleaf.html"
cp "${ICON}" "${RESOURCES_DIR}/Dayleaf.icns"

/usr/bin/xattr -cr "${TARGET}"
/usr/bin/codesign --force --deep --sign - "${TARGET}" >/dev/null
/usr/bin/xattr -cr "${TARGET}"

echo "Created native app: ${TARGET}"
echo "Architecture: ${ARCH}"
echo "Interface: embedded WKWebView (no browser or local server)"
