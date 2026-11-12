#!/usr/bin/env bash
# Checks one commit message, given as a file, for tool attribution: a Co-authored-by trailer,
# a line starting with "Generated with", or a coding assistant's session line or link.
# Exits non-zero with a reason when one is found.
set -euo pipefail

file="$1"
fail() {
  echo "commit message rejected: $1" >&2
  exit 1
}
grep -qiE '^[[:space:]]*Co-authored-by:' "$file" && fail "a Co-authored-by trailer"
grep -qiE '^[^[:alnum:]]*Generated with' "$file" && fail "a 'Generated with' line"
grep -qiE '^[[:space:]]*Claude-Session:|claude\.ai/code' "$file" && fail "a coding assistant session line"
exit 0
