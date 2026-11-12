#!/usr/bin/env bash
# Tests check-commit-message.sh on messages it must accept and messages it must reject.
set -euo pipefail

check="$(dirname "$0")/check-commit-message.sh"
message="$(mktemp)"
trap 'rm -f "$message"' EXIT
failures=0
expect() {
  local want="$1" text="$2"
  printf '%s\n' "$text" > "$message"
  if "$check" "$message" 2>/dev/null; then got=accept; else got=reject; fi
  if [ "$got" != "$want" ]; then
    echo "expected $want, got $got: $text" >&2
    failures=$((failures + 1))
  fi
}
expect accept "feat: a new session screen"
expect accept "fix: a session ends when the last answer is given"
expect accept "docs: how sessions are planned, generated from the day's budget"
expect reject $'feat: x\n\nCo-Authored-By: Someone <someone@example.com>'
expect reject $'feat: x\n\n  co-authored-by: someone'
expect reject $'feat: x\n\nGenerated with a tool'
expect reject $'feat: x\n\n\xf0\x9f\xa4\x96 Generated with a tool'
expect reject $'feat: x\n\nTool-Session: https://example.com/abc'
expect reject $'feat: x\n\nhttps://example.com/code/session_123'
if [ "$failures" -gt 0 ]; then
  echo "$failures commit message check(s) failed" >&2
  exit 1
fi
echo "commit message checks pass"
