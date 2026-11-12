#!/usr/bin/env bash
# Checks every commit message between two revisions (a pull request's base and head) with
# check-commit-message.sh, and names each commit that fails.
set -euo pipefail

base="$1"
head="$2"
here="$(dirname "$0")"
status=0
message="$(mktemp)"
trap 'rm -f "$message"' EXIT
for sha in $(git rev-list "$base..$head"); do
  git log -1 --format=%B "$sha" > "$message"
  if ! "$here/check-commit-message.sh" "$message"; then
    echo "  in $(git log -1 --format='%h %s' "$sha")" >&2
    status=1
  fi
done
exit "$status"
