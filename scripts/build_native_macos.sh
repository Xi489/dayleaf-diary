#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_TARGET="${APP_DIR}/dist/Dayleaf-mac.zip"
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

STAGING_ROOT="$(mktemp -d /private/tmp/dayleaf-native-build.XXXXXX)"
BUILD_TARGET="${STAGING_ROOT}/Dayleaf.app"
CONTENTS="${BUILD_TARGET}/Contents"
MACOS_DIR="${CONTENTS}/MacOS"
RESOURCES_DIR="${CONTENTS}/Resources"
trap 'rm -rf "${STAGING_ROOT}"' EXIT

node "${APP_DIR}/scripts/bundle_native.mjs"

mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}" "${MODULE_CACHE}"

"${SWIFTC}" \
  -O \
  -parse-as-library \
  -sdk "${SDK_PATH}" \
  -target "${ARCH}-apple-macosx13.1" \
  -module-cache-path "${MODULE_CACHE}" \
  -framework Cocoa \
  -framework CoreServices \
  -framework WebKit \
  "${SWIFT_SOURCE}" \
  -o "${MACOS_DIR}/Dayleaf"

cp "${INFO_PLIST}" "${CONTENTS}/Info.plist"
cp "${WEB_BUNDLE}" "${RESOURCES_DIR}/Dayleaf.html"
cp "${ICON}" "${RESOURCES_DIR}/Dayleaf.icns"

/usr/bin/xattr -cr "${BUILD_TARGET}"
/usr/bin/codesign --force --deep --sign - "${BUILD_TARGET}" >/dev/null
/usr/bin/codesign --verify --deep --strict "${BUILD_TARGET}"

mkdir -p "$(dirname "${ARCHIVE_TARGET}")"
rm -f "${ARCHIVE_TARGET}"
/usr/bin/ditto -c -k --keepParent --norsrc "${BUILD_TARGET}" "${ARCHIVE_TARGET}"

VERIFY_ROOT="${STAGING_ROOT}/verify"
mkdir -p "${VERIFY_ROOT}"
/usr/bin/ditto -x -k "${ARCHIVE_TARGET}" "${VERIFY_ROOT}"
/usr/bin/xattr -cr "${VERIFY_ROOT}/Dayleaf.app"
/usr/bin/codesign --verify --deep --strict "${VERIFY_ROOT}/Dayleaf.app"

echo "Created signed app archive: ${ARCHIVE_TARGET}"
echo "Architecture: ${ARCH}"
echo "Interface: embedded WKWebView (no browser or local server)"
