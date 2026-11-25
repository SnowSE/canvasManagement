#!/bin/sh
# The fast checks, in the order they fail fastest: types, lint, unit tests.
# Each prints how long it took; the whole thing is meant to stay well under
# a minute. Run before every commit (see .claude/skills/pre-pr).
set -e
cd "$(dirname "$0")/.."
t() { s=$(date +%s); "$@"; echo "  ($(( $(date +%s) - s )) s)"; }
echo "tsc";    t ./node_modules/.bin/tsc --noEmit
echo "eslint"; t ./node_modules/.bin/eslint src
echo "vitest"; t ./node_modules/.bin/vitest run --reporter=dot
