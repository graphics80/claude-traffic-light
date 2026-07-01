#!/usr/bin/env bash
# Claude Traffic Light installer (macOS / Linux).
# Thin wrapper around the cross-platform Node installer.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/install.mjs"
