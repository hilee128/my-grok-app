#!/bin/bash
# 팀 내부용 임시 공개 배포 (Cloudflare Tunnel)
# 영구 배포는 Railway/Render 사용 권장

set -euo pipefail
cd "$(dirname "$0")"

: "${TEAM_ACCESS_PASSWORD:?TEAM_ACCESS_PASSWORD 환경변수를 설정하세요}"

export API_MODE="${API_MODE:-mock}"
export AUTO_PAUSE_SCHEDULE="${AUTO_PAUSE_SCHEDULE:-false}"
export PORT="${PORT:-8000}"

echo "▶ API 서버 시작 (port $PORT)..."
python3 -m uvicorn api.main:app --host 127.0.0.1 --port "$PORT" &
API_PID=$!

sleep 2
echo "▶ Cloudflare Tunnel 시작..."
cloudflared tunnel --url "http://127.0.0.1:$PORT" &
TUNNEL_PID=$!

trap 'kill $API_PID $TUNNEL_PID 2>/dev/null' EXIT

echo "팀 비밀번호: $TEAM_ACCESS_PASSWORD"
echo "터널 URL은 위 로그에서 https://*.trycloudflare.com 확인"
wait