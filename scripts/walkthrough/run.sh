#!/bin/sh
# A new user's pass over the app (walkthrough.mjs) against a fresh copy of the
# walkthrough course and a fake Canvas holding its course in memory
# (fakeCanvas.mjs): builds this checkout, serves the app and the fake on free
# ports of this machine, runs the pass in the playwright container, stops them
# and appends the timings to scripts/benchmarks.tsv. Exits non-zero if a
# check failed. Takes a few minutes; it is not part of the unit tests.
set -u
cd "$(dirname "$0")/../.."
# free ports of this machine, for the app and for the fake Canvas (inside the container it is on $INSIDE)
free_port() { node -e 'const s = require("net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); })'; }
PORT=$(free_port)
FAKE_PORT=$(free_port)
INSIDE=3999
NAME=cm-walkthrough-$$
WORK=$(mktemp -d)
trap 'docker rm -f $NAME >/dev/null 2>&1; rm -rf "$WORK"' EXIT

cp -r scripts/walkthrough/course/. "$WORK/storage"
mkdir -p "$WORK/home"
./node_modules/.bin/vite build >"$WORK/build.log" 2>&1 && ./node_modules/.bin/vite build --config vite.websocket.config.ts >>"$WORK/build.log" 2>&1 || { tail -20 "$WORK/build.log"; exit 1; }
OUTPUT_KB=$(du -sk .output | cut -f1)

docker rm -f $NAME >/dev/null 2>&1
docker run -d --name $NAME -e TZ=America/Denver -e NODE_ENV=production -e SETTINGS_FILE_PATH=/app/storage/globalSettings.yml \
  -u "$(id -u):$(id -g)" -e HOME=/home/node -p 127.0.0.1:$PORT:3000 -e CANVAS_MANAGER_ADDRESS=127.0.0.1 -w /app \
  -p 127.0.0.1:$FAKE_PORT:$INSIDE -e CANVAS_FAKE_URL=http://127.0.0.1:$INSIDE -e CANVAS_TOKEN=fake \
  -v "$PWD/.output":/app/.output:ro -v "$WORK/home":/home/node -v "$WORK/storage":/app/storage \
  -v "$PWD/scripts/walkthrough/fakeCanvas.mjs":/fake/fakeCanvas.mjs:ro \
  node sh -c "node /fake/fakeCanvas.mjs $INSIDE 0.0.0.0 & node --import ./.output/websocket/websocket-standalone.js .output/server/index.mjs" >/dev/null
for i in $(seq 1 60); do curl -sf -o /dev/null --max-time 3 http://localhost:$PORT/ && break; sleep 1; done

docker run --rm --network host -v "$PWD/scripts/walkthrough":/skill:ro -v "$WORK/storage":/course:ro \
  -e BASE=http://localhost:$PORT -e FAKE=http://localhost:$FAKE_PORT -e COURSE_DIR=/course/Walkthrough -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  mcr.microsoft.com/playwright:v1.56.0-noble \
  sh -c 'mkdir -p /tmp/pw && cp /skill/walkthrough.mjs /tmp/pw/ && cd /tmp/pw && npm i playwright@1.56.0 --silent --no-audit --no-fund >/dev/null 2>&1 && node walkthrough.mjs' | tee "$WORK/result.txt"
STATUS=$(grep -c '^FAIL' "$WORK/result.txt")

LOG=scripts/benchmarks.tsv
[ -f $LOG ] || printf 'date\tcommit\toutput_kb\tcourse_ready_ms\titem_open_ms\tsave_after_typing_ms\n' > $LOG
b() { grep "^BENCH $1 " "$WORK/result.txt" | cut -d' ' -f3; }
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%F)" "$(git rev-parse --short HEAD)" "$OUTPUT_KB" "$(b course_ready_ms)" "$(b item_open_ms)" "$(b save_after_typing_ms)" >> $LOG
echo "timings appended to $LOG"
[ "$STATUS" -eq 0 ]
