#!/usr/bin/env bash
# Claude Ampel host installer.
#   - installs host npm deps
#   - writes a ready-to-merge hook snippet with the absolute hook path filled in
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOOK="$ROOT/host/hook-client.mjs"

echo "==> Installing host dependencies"
( cd "$ROOT/host" && npm install )

OUT="$ROOT/claude-settings-generated.json"
sed "s#__HOOK__#$HOOK#g" "$ROOT/claude-settings-snippet.json" > "$OUT"

cat <<EOF

==> Done.

1) Start the bridge (keep it running; add to login items / launchd for auto-start):
     node "$ROOT/host/serial-bridge.mjs"

2) Merge the generated hooks into ~/.claude/settings.json:
     $OUT

3) Tune token budgets in host/config.mjs (or via env AMPEL_5H_BUDGET / AMPEL_WEEK_BUDGET).

Test the device without Claude:
     node "$HOOK" C tool
     node "$HOOK" H 42
EOF
