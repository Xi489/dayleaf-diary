#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${APP_DIR}/Dayleaf.app"
ICON_SVG="${APP_DIR}/public/icons/icon.svg"
ASSET_DIR="${APP_DIR}/assets"
ICON_PNG="${ASSET_DIR}/dayleaf-icon.png"
ICONSET="${ASSET_DIR}/Dayleaf.iconset"
ICNS="${ASSET_DIR}/Dayleaf.icns"
BUILD_DIR="${APP_DIR}/tmp/build"
SOURCE="${BUILD_DIR}/Dayleaf.applescript"

mkdir -p "${ASSET_DIR}" "${BUILD_DIR}"

cat >"${SOURCE}" <<EOF
display notification "正在打开你的日记" with title "日叶 Dayleaf"
do shell script "zsh " & quoted form of "${APP_DIR}/scripts/launch_macos.sh" & " >/tmp/dayleaf-app-launch.log 2>&1"
EOF

rm -f "${ICON_PNG}" "${ASSET_DIR}/icon.svg.png"
qlmanage -t -s 1024 -o "${ASSET_DIR}" "${ICON_SVG}" >/dev/null 2>&1 || true
if [ -f "${ASSET_DIR}/icon.svg.png" ]; then
  mv "${ASSET_DIR}/icon.svg.png" "${ICON_PNG}"
else
  echo "Failed to render ${ICON_SVG} to PNG." >&2
  exit 1
fi

rm -rf "${TARGET}"
osacompile -o "${TARGET}" "${SOURCE}"

rm -rf "${ICONSET}"
mkdir -p "${ICONSET}"
sips -z 16 16 "${ICON_PNG}" --out "${ICONSET}/icon_16x16.png" >/dev/null
sips -z 32 32 "${ICON_PNG}" --out "${ICONSET}/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "${ICON_PNG}" --out "${ICONSET}/icon_32x32.png" >/dev/null
sips -z 64 64 "${ICON_PNG}" --out "${ICONSET}/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "${ICON_PNG}" --out "${ICONSET}/icon_128x128.png" >/dev/null
sips -z 256 256 "${ICON_PNG}" --out "${ICONSET}/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "${ICON_PNG}" --out "${ICONSET}/icon_256x256.png" >/dev/null
sips -z 512 512 "${ICON_PNG}" --out "${ICONSET}/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "${ICON_PNG}" --out "${ICONSET}/icon_512x512.png" >/dev/null
cp "${ICON_PNG}" "${ICONSET}/icon_512x512@2x.png"
iconutil -c icns "${ICONSET}" -o "${ICNS}"

cp "${ICNS}" "${TARGET}/Contents/Resources/applet.icns"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Dayleaf" "${TARGET}/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Dayleaf" "${TARGET}/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Dayleaf" "${TARGET}/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.dayleaf.diary" "${TARGET}/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.dayleaf.diary" "${TARGET}/Contents/Info.plist"
/usr/bin/xattr -cr "${TARGET}"
/usr/bin/codesign --force --deep --sign - "${TARGET}" >/dev/null
/usr/bin/xattr -cr "${TARGET}"

echo "Created ${TARGET}"
echo "Icon source: ${ICON_SVG}"
echo "macOS icon: ${ICNS}"
