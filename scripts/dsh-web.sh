#!/usr/bin/env bash
# deepseek-harness web UI — start / stop / status helper for remote access.
#
# Wraps the source-launched `dsh --profile web` so you can serve the UI on the
# LAN for a phone, with an optional upstream LLM proxy. No secrets are stored
# here — set them in the environment or a sourced .env before running.
#
# Env:
#   DSH_PORT           listen port for the web UI (default 3700)
#   DSH_BIND           bind host; 0.0.0.0 exposes to the LAN (default 0.0.0.0)
#   DSH_TRUSTED_HOST   extra authority for the /api trust fence (repeat via
#                      --trusted-host in DSH_EXTRA_ARGS instead)
#   OPENCODE_PROXY_KEY forwarded to dsh if your upstream shim needs it
#   DSH_EXTRA_ARGS     any extra dsh web flags, e.g. --trusted-host host:port
#
# usage: ./scripts/dsh-web.sh {start|stop|status|logs}
set -euo pipefail

REPO="${DSH_REPO:-/path/to/deepseek-harness}"   # <-- set this to your checkout
DSH_PORT="${DSH_PORT:-3700}"
DSH_BIND="${DSH_BIND:-0.0.0.0}"
WEB_LOG="${DSH_WEB_LOG:-/tmp/dsh-web.log}"
PID_FILE="/tmp/dsh-web.pid"

case "${1:-start}" in
  start)
    echo "▶ starting dsh web  (bind ${DSH_BIND}:${DSH_PORT})"
    [[ -d "$REPO" ]] || { echo "  set DSH_REPO to your deepseek-harness checkout"; exit 1; }
    cd "$REPO"
    DSH_TELEMETRY_DISABLED=1 \
      OPENCODE_PROXY_KEY="${OPENCODE_PROXY_KEY:-}" \
      nohup node --import tsx/esm apps/cli/src/bin.ts web \
        --host "$DSH_BIND" --port "$DSH_PORT" $DSH_EXTRA_ARGS \
        > "$WEB_LOG" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 5
    # Print the LAN URL the server announced:
    grep -m1 "dsh web:" "$WEB_LOG" 2>/dev/null || true
    curl -sS --max-time 5 "http://127.0.0.1:$DSH_PORT/" -o /dev/null \
      -w "  local check: HTTP %{http_code}\n" 2>/dev/null || echo "  local check: (server still warming up)"
    ;;
  stop)
    echo "■ stopping dsh web"
    [[ -f "$PID_FILE" ]] && kill "$(cat "$PID_FILE")" 2>/dev/null || true
    pkill -f "bin.ts web" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "  stopped."
    ;;
  status)
    if pgrep -f "bin.ts web --host" >/dev/null 2>&1; then
      echo "• dsh web: RUNNING (pid $(cat "$PID_FILE" 2>/dev/null || echo '?'))"
    else
      echo "• dsh web: STOPPED"
    fi
    curl -sS --max-time 5 "http://127.0.0.1:$DSH_PORT/" -o /dev/null \
      -w "• local: HTTP %{http_code}\n" 2>/dev/null || echo "• local: not reachable"
    ;;
  logs)
    tail -n 80 -f "$WEB_LOG"
    ;;
  *)
    echo "usage: $0 {start|stop|status|logs}" >&2
    exit 1
    ;;
esac
