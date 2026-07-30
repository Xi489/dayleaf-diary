#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${DAYLEAF_PORT:-4173}"
URL="http://127.0.0.1:${PORT}"
HEALTH_URL="${URL}/health"
PID_FILE="/tmp/dayleaf-diary-${PORT}.pid"
LOG_FILE="/tmp/dayleaf-diary-${PORT}.log"

find_node() {
  for candidate in \
    "/opt/homebrew/bin/node" \
    "/usr/local/bin/node" \
    "${HOME}/.volta/bin/node"; do
    if [ -x "${candidate}" ]; then
      echo "${candidate}"
      return 0
    fi
  done

  command -v node 2>/dev/null || true
}

is_running() {
  [ "$(/usr/bin/curl --noproxy '*' -fsS --max-time 1 "${HEALTH_URL}" 2>/dev/null || true)" = "dayleaf-ok" ]
}

show_dialog() {
  /usr/bin/osascript -e "display dialog \"$1\" buttons {\"OK\"} default button \"OK\" with icon caution"
}

if is_running; then
  /usr/bin/open "${URL}"
  exit 0
fi

NODE_BIN="$(find_node)"
if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  show_dialog "Dayleaf 需要 Node.js 18 或更高版本。请先从 nodejs.org 安装 Node.js，再次双击 Dayleaf。"
  exit 1
fi

if [ -f "${PID_FILE}" ]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [ -n "${OLD_PID}" ] && ! kill -0 "${OLD_PID}" 2>/dev/null; then
    rm -f "${PID_FILE}"
  fi
fi

cd "${APP_DIR}"
PORT="${PORT}" "${NODE_BIN}" "${APP_DIR}/scripts/serve.mjs" >>"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "${SERVER_PID}" >"${PID_FILE}"
trap 'rm -f "${PID_FILE}"' EXIT

for _ in {1..40}; do
  if is_running; then
    /usr/bin/open "${URL}"
    wait "${SERVER_PID}"
    exit $?
  fi
  sleep 0.15
done

kill "${SERVER_PID}" 2>/dev/null || true
show_dialog "Dayleaf 启动失败。即将打开日志文件，便于检查原因。"
/usr/bin/open -a TextEdit "${LOG_FILE}"
exit 1
