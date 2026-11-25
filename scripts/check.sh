#!/bin/sh
# The fast checks, for every iteration (see .claude/skills/pre-pr): types,
# lint and unit tests, run side by side. tsc and eslint keep caches in
# node_modules/.cache, so a second run only rereads what changed. Prints each
# one's time, and the output of any that failed; exits non-zero if one did.
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
CACHE=node_modules/.cache
mkdir -p $CACHE

run() { # name, command...
  name=$1; shift
  ( s=$(date +%s); "$@" >"$OUT/$name.log" 2>&1; echo "$? $(( $(date +%s) - s ))" >"$OUT/$name.status" ) &
}
run tsc ./node_modules/.bin/tsc --noEmit --incremental --tsBuildInfoFile $CACHE/check.tsbuildinfo
run eslint ./node_modules/.bin/eslint src --cache --cache-location $CACHE/eslint
run vitest ./node_modules/.bin/vitest run --reporter=dot
wait

failed=0
for name in tsc eslint vitest; do
  read -r code secs <"$OUT/$name.status"
  if [ "$code" -eq 0 ]; then
    summary=$( [ $name = vitest ] && grep -E "^ +Tests " "$OUT/$name.log" | tr -s ' ' )
    echo "ok    $name ($secs s)$summary"
  else
    failed=1
    echo "FAIL  $name ($secs s)"
    tail -40 "$OUT/$name.log"
  fi
done
exit $failed
