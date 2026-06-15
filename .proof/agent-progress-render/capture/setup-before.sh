#!/usr/bin/env bash
set -euo pipefail
BIN=/tmp/cc-before
DATA=/tmp/ccbefore-data
LOG=/tmp/ccbefore.log
PORT=8772
B=http://127.0.0.1:$PORT
for p in $(ss -tlnp 2>/dev/null | grep ":$PORT" | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); do kill "$p" 2>/dev/null || true; done
sleep 1
rm -rf "$DATA" /tmp/ccb.jar /tmp/ccbefore.env
mkdir -p "$DATA"
nohup "$BIN" serve -dev-bootstrap -data "$DATA" -addr 127.0.0.1:$PORT > "$LOG" 2>&1 &
sleep 3
OWNER=$(grep -oE 'usr_[a-z0-9]+' "$LOG" | head -1)
REQ=$(curl -s -c /tmp/ccb.jar -X POST "$B/api/auth/magic/request" -H 'content-type: application/json' -d '{"email":"local@clickclack.chat"}')
TOK=$(echo "$REQ" | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
curl -s -c /tmp/ccb.jar -b /tmp/ccb.jar -X POST "$B/api/auth/magic/consume" -H 'content-type: application/json' -d "{\"token\":\"$TOK\"}" >/dev/null
WSP=$(curl -s -b /tmp/ccb.jar "$B/api/workspaces" | grep -oE 'wsp_[a-z0-9]+' | head -1)
WSROUTE=$(curl -s -b /tmp/ccb.jar "$B/api/workspaces" | grep -oE '"route_id":"[^"]+"' | head -1 | cut -d'"' -f4)
CH=$(curl -s -b /tmp/ccb.jar "$B/api/workspaces/$WSP/channels" | grep -oE 'chn_[a-z0-9]+' | head -1)
CHROUTE=$(curl -s -b /tmp/ccb.jar "$B/api/workspaces/$WSP/channels" | grep -oE '"route_id":"[^"]+"' | head -1 | cut -d'"' -f4)
OUT=$("$BIN" admin bot create -data "$DATA" -workspace "$WSP" -owner "$OWNER" -name "Forge" -handle forge -scopes "bot:write,agent_progress:write" -created-by "$OWNER" 2>&1)
BOT=$(echo "$OUT" | grep -oE '"token":"ccb_[^"]+"' | tail -1 | cut -d'"' -f4)
SST=$(grep cc_session /tmp/ccb.jar | awk '{print $NF}')
cat > /tmp/ccbefore.env <<EOF
PORT=$PORT
WSP=$WSP
WSROUTE=$WSROUTE
CH=$CH
CHROUTE=$CHROUTE
BOT=$BOT
SST=$SST
EOF
cat /tmp/ccbefore.env
