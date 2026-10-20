#!/usr/bin/env bash
# Uptime check for the live site: guide pages and the Ask AI. Free: runs from GitHub Actions
# (.github/workflows/uptime.yml) or locally: `bash scripts/uptime-check.sh [base-url]`.
# Uses fictional questions only. Fails (exit 1) on any problem, so GitHub emails the owner.
set -uo pipefail

BASE="${1:-${SITE_URL:-https://wyrm-it.vercel.app}}"
MAX_SECONDS=10
failures=0

fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

check_page() {
  local path="$1" out code secs
  out=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --max-time 20 "$BASE$path") || out="000 20"
  read -r code secs <<<"$out"
  if [ "$code" != 200 ]; then fail "$path returned $code"
  elif awk "BEGIN{exit !($secs > $MAX_SECONDS)}"; then fail "$path took ${secs}s"
  else echo "ok   $path ${secs}s"; fi
}

# ask <name> <json> <expected providers regex>
ask() {
  local name="$1" body="$2" want="$3" resp secs json status provider
  resp=$(curl -s -w "\n%{time_total}" --max-time 30 -X POST "$BASE/api/ask" \
    -H "content-type: application/json" -d "$body") || { fail "ask $name: no response"; return; }
  secs=$(tail -n1 <<<"$resp")
  json=$(sed '$d' <<<"$resp")
  read -r status provider < <(node -e '
    let d = {}; try { d = JSON.parse(require("fs").readFileSync(0, "utf8")); } catch {}
    console.log(`${d.status ?? "invalid"} ${d.provider ?? "none"}`);' <<<"$json")
  if [ "$status" = invalid ] || [ "$status" = error ]; then fail "ask $name: status $status"
  elif ! [[ "$provider" =~ $want ]]; then fail "ask $name: provider $provider (expected $want)"
  elif awk "BEGIN{exit !($secs > $MAX_SECONDS)}"; then fail "ask $name took ${secs}s"
  else echo "ok   ask $name: $provider ${secs}s"; fi
}

check_page /
check_page /guide
check_page /guide/backup-recovery
check_page /guide/identity-access

# Answered from the guide itself: must always work, even with no AI key.
ask instant '{"question":"quick wins for backups"}' '^instant$'
# Needs the AI: "guide" means the AI is down, rate-limited or the key is missing.
ask ai '{"question":"We have 12 staff and one file server. How often should we test restoring a backup?"}' '^(groq|claude)$'

if [ "$failures" -gt 0 ]; then echo "$failures check(s) failed for $BASE"; exit 1; fi
echo "All checks passed for $BASE"
