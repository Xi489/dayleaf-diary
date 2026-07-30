#!/bin/zsh
set -euo pipefail

PORT="${DAYLEAF_PORT:-4173}"
PID_FILE="/tmp/dayleaf-diary-${PORT}.pid"

if [ ! -f "${PID_FILE}" ]; then
  echo "Dayleaf is not running."
  exit 0
fi

SERVER_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
  kill "${SERVER_PID}"
  echo "Stopped Dayleaf (PID ${SERVER_PID})."
else
  echo "Dayleaf was not running."
fi

rm -f "${PID_FILE}"
