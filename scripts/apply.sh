#!/usr/bin/env bash
# Apply the Mobile & Remote adapter onto a DeepSeek Harness checkout.
#
# Usage:
#   ./scripts/apply.sh /path/to/deepseek-harness
#
# Two strategies, tried in order:
#   1. git apply mobile-remote.patch          (one-shot, fails cleanly on drift)
#   2. copy overlay/ files over the tree       (fallback when the patch won't apply)
#
# Re-running is safe: overlay copy is idempotent; git apply is skipped if already
# applied (patch reports "already applied" -> falls through to overlay copy,
# which is a no-op on identical content).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH="$REPO_ROOT/mobile-remote.patch"
OVERLAY="$REPO_ROOT/overlay"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "usage: $0 /path/to/deepseek-harness" >&2
  exit 1
fi

if [[ ! -d "$TARGET/.git" ]]; then
  echo "error: $TARGET is not a git checkout of deepseek-harness" >&2
  exit 1
fi

echo "▶ target:  $TARGET"
echo "▶ strategy 1: git apply mobile-remote.patch"
if git -C "$TARGET" apply --check "$PATCH" 2>/dev/null; then
  git -C "$TARGET" apply "$PATCH"
  echo "  applied patch."
else
  echo "  patch did not apply cleanly (version drift) — falling back to overlay copy."
fi

echo "▶ strategy 2: copy overlay/ over the tree (idempotent fallback)"
# shellcheck disable=SC2164
cd "$OVERLAY"
# rsync if available, otherwise cp -R
if command -v rsync >/dev/null 2>&1; then
  rsync -a "$OVERLAY/" "$TARGET/"
else
  cp -R "$OVERLAY/." "$TARGET/"
fi
echo "  overlay copied."

echo "✓ done. Now build the frontend and web profile:"
echo "    cd $TARGET && pnpm install && pnpm run build"
