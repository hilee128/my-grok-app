async function checkApi() {
  const el = document.getElementById("api-status");
  try {
    const res = await fetch(`${window.location.origin}/api/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data.mode === "live" && data.live_pause_enabled) {
      el.className = "api-status live";
      el.textContent = "✅ API 서버 실행 중 · 실연동 모드 · 실제 중단 가능";
    } else if (data.mode === "live") {
      el.className = "api-status warn";
      el.textContent = "⚠️ 실연동 모드이지만 매체 토큰이 아직 없습니다 · .env 확인";
    } else {
      el.className = "api-status ok";
      el.textContent = "✅ API 서버 실행 중 · 데모 모드 (API_MODE=mock)";
    }
    return true;
  } catch {
    el.className = "api-status warn";
    el.textContent = "❌ API 서버 미실행 · 터미널에서 ./run_api.sh 실행 필요";
    return false;
  }
}

function renderPlatformResult(platform, result) {
  const card = document.getElementById(`card-${platform}`);
  const el = document.getElementById(`result-${platform}`);
  if (!result) return;

  card.classList.toggle("connected", result.connected);
  el.className = `test-result ${result.connected ? "ok" : "fail"}`;
  el.textContent = result.connected
    ? `✅ ${result.message} · 캠페인 ${result.campaign_count}건`
    : `❌ ${result.message}`;
}

async function runTests() {
  const btn = document.getElementById("test-btn");
  btn.disabled = true;
  btn.textContent = "테스트 중…";

  try {
    const res = await apiFetch(`/api/connect/test`, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    data.platforms.forEach((p) => renderPlatformResult(p.platform, p));

    const status = document.getElementById("api-status");
    if (data.ready_for_live_pause) {
      status.className = "api-status live";
      status.textContent = "✅ 실연동 준비 완료 · 대시보드에서 자동 중단 시 실제로 꺼집니다";
    }
  } catch {
    document.getElementById("api-status").textContent = "연결 테스트 실패 · API 서버 확인";
  } finally {
    btn.disabled = false;
    btn.textContent = "연결 테스트";
  }
}

document.getElementById("test-btn").addEventListener("click", runTests);
ensureTeamAuth().then(() => checkApi().then((ok) => { if (ok) runTests(); }));