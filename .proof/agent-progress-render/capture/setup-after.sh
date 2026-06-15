#!/usr/bin/env bash
set -euo pipefail
BIN=${1:-/tmp/cc-after}
DATA=/tmp/ccdemo-data
LOG=/tmp/ccdemo-after.log
B=http://127.0.0.1:8771

# kill any existing server on 8771 by pid (avoid pkill self-match)
for p in $(ss -tlnp 2>/dev/null | grep ':8771' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); do kill "$p" 2>/dev/null || true; done
sleep 1
rm -rf "$DATA" /tmp/ccdemo.jar /tmp/ccdemo.env
mkdir -p "$DATA"
nohup "$BIN" serve -dev-bootstrap -data "$DATA" -addr 127.0.0.1:8771 > "$LOG" 2>&1 &
SRVPID=$!
sleep 3
OWNER=$(grep -oE 'usr_[a-z0-9]+' "$LOG" | head -1)
REQ=$(curl -s -c /tmp/ccdemo.jar -X POST "$B/api/auth/magic/request" -H 'content-type: application/json' -d '{"email":"local@clickclack.chat"}')
TOK=$(echo "$REQ" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
curl -s -c /tmp/ccdemo.jar -b /tmp/ccdemo.jar -X POST "$B/api/auth/magic/consume" -H 'content-type: application/json' -d "{\"token\":\"$TOK\"}" >/dev/null
WSP=$(curl -s -b /tmp/ccdemo.jar "$B/api/workspaces" | grep -oE 'wsp_[a-z0-9]+' | head -1)
WSROUTE=$(curl -s -b /tmp/ccdemo.jar "$B/api/workspaces" | grep -oE '"route_id":"[^"]+"' | head -1 | cut -d'"' -f4)
CH=$(curl -s -b /tmp/ccdemo.jar "$B/api/workspaces/$WSP/channels" | grep -oE 'chn_[a-z0-9]+' | head -1)
CHROUTE=$(curl -s -b /tmp/ccdemo.jar "$B/api/workspaces/$WSP/channels" | grep -oE '"route_id":"[^"]+"' | head -1 | cut -d'"' -f4)
OUT=$("$BIN" admin bot create -data "$DATA" -workspace "$WSP" -owner "$OWNER" -name "Forge" -handle forge -scopes "bot:write,agent_progress:write" -created-by "$OWNER" 2>&1)
BOT=$(echo "$OUT" | grep -oE '"token":"ccb_[^"]+"' | tail -1 | cut -d'"' -f4)
BOTUSER=$(echo "$OUT" | grep -oE '"id":"usr_[^"]+"' | head -1 | cut -d'"' -f4)
# Post the human's question (as Local Captain) so Forge has something to respond to
curl -s -o /dev/null -b /tmp/ccdemo.jar -X POST "$B/api/channels/$CH/messages" -H 'content-type: application/json' \
  -d '{"body":"@forge the auth integration test is flaking on CI — TestSessionCookiesDefaultSecure. can you take a look and push a fix?"}'
cat > /tmp/ccdemo.env <<EOF
SRVPID=$SRVPID
B=$B
OWNER=$OWNER
WSP=$WSP
WSROUTE=$WSROUTE
CH=$CH
CHROUTE=$CHROUTE
BOT=$BOT
BOTUSER=$BOTUSER
EOF
cat /tmp/ccdemo.env
echo "OK"
