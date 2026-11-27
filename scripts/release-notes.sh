#!/usr/bin/env sh
# Prints the CHANGELOG.md section of a version, for the GitHub release:
#
#   sh scripts/release-notes.sh 0.1.0-alpha.1
#
# Fails when the section is missing or empty, so a release can't go out
# without notes.
set -eu

version="$1"
notes="$(awk -v heading="## [$version]" '
  index($0, heading) == 1 { found = 1; next }
  found && /^## \[/ { exit }
  found && /^\[[^]]+\]: / { exit }
  found { print }
' "$(dirname "$0")/../CHANGELOG.md" | sed -e '/./,$!d')"

if [ -z "$(printf %s "$notes" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md has no notes for $version." >&2
  exit 1
fi
printf '%s\n' "$notes"
