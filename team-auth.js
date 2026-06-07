const API_BASE = window.location.origin;
const TOKEN_KEY = "team_token";
const TEAM_APP_URL = "https://my-grok-app-production.up.railway.app";

function fetchWithTimeout(url, options = {}, ms = 8000) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

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
  const { timeoutMs, ...rest } = options;
  const res = await fetchWithTimeout(
    `${API_BASE}${path}`,
    {
      ...rest,
      headers: authHeaders(rest.headers || {}),
    },
    timeoutMs || 8000
  );
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
    const res = await fetchWithTimeout(`${API_BASE}/api/auth/required`, {}, 5000);
    if (!res.ok) return false;
    await res.json();
    return true;
  } catch {
    return false;
  }
}

async function ensureTeamAuth() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/auth/required`, {}, 5000);
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