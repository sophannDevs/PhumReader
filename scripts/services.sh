#!/usr/bin/env bash
# Local services without Docker (macOS, Homebrew): Redis, Meilisearch, MinIO (R2 stand-in), Mailpit.
# Usage: scripts/services.sh start|stop|status
# Data and logs live in .local/services (git-ignored). Settings come from backend/.env.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=".local/services"
mkdir -p "$DIR/redis" "$DIR/meili" "$DIR/minio" "$DIR/logs" "$DIR/pids"

if [ -f backend/.env ]; then set -a; . backend/.env; set +a; fi
MEILI_KEY="${MEILI_MASTER_KEY:-phumreader-dev-meili-key}"
S3_USER="${S3_ACCESS_KEY:-phumreader}"
S3_PASS="${S3_SECRET_KEY:-phumreader-dev-secret}"
BREW="$(brew --prefix)"

start_one() { # name, command...
  local name="$1"; shift
  local pidfile="$DIR/pids/$name.pid"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then echo "$name already running"; return; fi
  nohup "$@" >"$DIR/logs/$name.log" 2>&1 &
  echo $! >"$pidfile"
  echo "$name started (pid $!)"
}

case "${1:-}" in
  start)
    start_one redis "$BREW/bin/redis-server" --port 6379 --dir "$DIR/redis" --save "" --appendonly no
    start_one meilisearch env MEILI_NO_ANALYTICS=true "$BREW/bin/meilisearch" --http-addr 127.0.0.1:7700 \
      --db-path "$DIR/meili/data.ms" --dump-dir "$DIR/meili/dumps" --snapshot-dir "$DIR/meili/snapshots" \
      --master-key "$MEILI_KEY"
    start_one minio env MINIO_ROOT_USER="$S3_USER" MINIO_ROOT_PASSWORD="$S3_PASS" \
      "$BREW/bin/minio" server "$DIR/minio" --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
    start_one mailpit "$BREW/bin/mailpit" --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025 --database "$DIR/mailpit.db"
    ;;
  stop)
    for f in "$DIR"/pids/*.pid; do
      [ -e "$f" ] || continue
      n="$(basename "$f" .pid)"
      if kill "$(cat "$f")" 2>/dev/null; then echo "$n stopped"; else echo "$n was not running"; fi
      : >"$f"
    done
    ;;
  status) npm run --silent services:check ;;
  *) echo "usage: $0 start|stop|status"; exit 2 ;;
esac
