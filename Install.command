#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
"${APP_DIR}/scripts/install_macos_shortcut.sh"

echo
read -k 1 "?安装完成。按任意键关闭此窗口…"
