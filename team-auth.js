const API_BASE = window.location.origin;
const TOKEN_KEY = "team_token";

function getTeamToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setTeamToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearTeamToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra = {}) {
  const token = getTeamToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  if (res.status === 401) {
    clearTeamToken();
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
    throw new Error("인증 필요");
  }
  return res;
}

async function isTeamApiAvailable() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/required`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    await res.json();
    return true;
  } catch {
    return false;
  }
}

async function ensureTeamAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/required`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.required) return;
    if (!getTeamToken() && !window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
  } catch {
    // GitHub Pages 등 정적 호스팅: API 없음 → 데모 JSON으로 동작
  }
}