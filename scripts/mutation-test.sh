#!/bin/sh
# Mutation testing on demand, to find behaviour the tests don't pin down:
# StrykerJS is fetched into a throwaway container each run, so nothing in
# package.json, the lockfile or the image depends on it. Each surviving
# mutant is either a missing test or code that can go.
#
#   scripts/mutation-test.sh                                   # the pane rules
#   scripts/mutation-test.sh src/services/listTable.ts src/services/listTable.test.ts
#
# The report is printed, and written to reports/mutation/mutation.html.
set -e
cd "$(dirname "$0")/.."
mutate="${1:-src/components/panes/cascade.ts}"
tests="${2:-${mutate%.ts}.test.ts}"
# Stryker's command runner: each mutant runs the project's own vitest, as configured
# (typescript, which Stryker reads the tsconfig with, is the project's own too)
cat > .stryker.json <<JSON
{ "mutate": ["$mutate"], "testRunner": "command", "commandRunner": { "command": "./node_modules/.bin/vitest run $tests" },
  "reporters": ["clear-text", "html", "progress-append-only"], "concurrency": 4, "cleanTempDir": "always" }
JSON
trap 'rm -f .stryker.json' EXIT
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:22 sh -c "
  mkdir /tmp/stryker && cd /tmp/stryker && echo {} > package.json &&
  npm install --no-audit --no-fund --loglevel=error @stryker-mutator/core@10.1.1 &&
  ln -s /app/node_modules/typescript node_modules/ &&
  cd /app && /tmp/stryker/node_modules/.bin/stryker run .stryker.json"
