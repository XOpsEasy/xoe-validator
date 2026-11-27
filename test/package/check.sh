#!/usr/bin/env sh
# Installs the packed package in an empty project and uses it as a user would:
# import (ESM) and require (CJS) with the current Node, and the type
# declarations (ESM, CommonJS and bundler resolution) with every TypeScript
# version in TS_VERSIONS (if set).
#
#   sh test/package/check.sh [package.tgz]
#   TS_VERSIONS="5.0 5.9" sh test/package/check.sh package.tgz
#
# Without an argument it packs the current build (run npm run build first).
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [ $# -gt 0 ]; then
  tarball="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
else
  tarball="$work/$(cd "$root" && npm pack --silent --pack-destination "$work")"
fi

cd "$work"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "$tarball"
cp "$here/esm.mjs" "$here/cjs.cjs" "$here/types.mts" "$here/types.cts" \
  "$here/tsconfig.json" "$here/tsconfig.bundler.json" .

node esm.mjs
node cjs.cjs

for version in ${TS_VERSIONS:-}; do
  for project in tsconfig.json tsconfig.bundler.json; do
    npx --yes --package "typescript@$version" tsc --project "$project"
  done
  echo "types: ok (TypeScript $version: ESM, CommonJS, bundler)"
done
