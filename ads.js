const CSV_PATH = "ad_performance_raw.csv";
const JSON_PATH = "data/campaigns.json";
const API_BASE = "http://127.0.0.1:8000";
const SPEND_MIN = 500_000;
const ROAS_MAX = 150;
const AUTO_CUTOFF_KEY = "ads-auto-cutoff-enabled";
const MANUAL_RESUME_KEY = "ads-manual-resume";

const PLATFORM_LABELS = { meta: "메타", youtube: "유튜브", tiktok: "틱톡", all: "전체" };

const loading = document.getElementById("loading");
const summaryBanner = document.getElementById("summary-banner");
const summaryText = document.getElementById("summary-text");
const warningPanel = document.getElementById("warning-panel");
const warningCount = document.getElementById("warning-count");
const dataSource = document.getElementById("data-source");
const generatedAt = document.getElementById("generated-at");
const modeBadge = document.getElementById("mode-badge");
const autoCutoffToggle = document.getElementById("auto-cutoff-toggle");
const autoCutoffStatus = document.getElementById("auto-cutoff-status");
const autoPauseBanner = document.getElementById("auto-pause-banner");
const autoPauseTitle = document.getElementById("auto-pause-title");
const autoPauseDesc = document.getElementById("auto-pause-desc");

let currentRows = [];
let currentSource = JSON_PATH;
let currentPlatform = "all";
let apiAvailable = false;
let dataMode = "demo";

function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}

function formatWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatPct(value, digits = 1) {
  return `${(value || 0).toFixed(digits)}%`;
}

function platformTag(platform) {
  const label = PLATFORM_LABELS[platform] || platform;
  return `<span class="platform-tag ${platform}">${label}</span>`;
}

function campaignKey(row) {
  return `${row.Platform || "legacy"}::${row.Campaign_ID || row.Campaign_Name}::${row.Target_Segment}`;
}

function isAutoCutoffEnabled() {
  const stored = localStorage.getItem(AUTO_CUTOFF_KEY);
  return stored === null ? true : stored === "true";
}

function getManualResumeSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(MANUAL_RESUME_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveManualResumeSet(set) {
  localStorage.setItem(MANUAL_RESUME_KEY, JSON.stringify([...set]));
}

function normalizeRow(row) {
  const spend = Number(row.Spend || 0);
  const revenue = Number(row.Revenue || 0);
  const impressions = Number(row.Impressions || 0);
  const clicks = Number(row.Clicks || 0);
  const conversions = Number(row.Conversions || 1);
  const ctr = row.CTR ?? (impressions ? (clicks / impressions) * 100 : 0);
  const cvr = row.CVR ?? (clicks ? (conversions / clicks) * 100 : 0);
  const cpa = row.CPA ?? (conversions ? spend / conversions : 0);
  const roas = row.ROAS ?? (spend ? (revenue / spend) * 100 : 0);

  return {
    Platform: row.Platform || "legacy",
    Brand: row.Brand || "-",
    Campaign_ID: row.Campaign_ID || "",
    Campaign_Name: row.Campaign_Name || "",
    Target_Segment: row.Target_Segment || "",
    Impressions: impressions,
    Clicks: clicks,
    Spend: spend,
    Conversions: conversions,
    Revenue: revenue,
    Status: row.Status || "ACTIVE",
    CTR: ctr,
    CVR: cvr,
    CPA: cpa,
    ROAS: roas,
  };
}

function applyBudgetStatus(rows) {
  const autoEnabled = isAutoCutoffEnabled();
  const manualResume = getManualResumeSet();

  return rows.map((row) => {
    const alreadyPaused = row.Status === "PAUSED";
    const shouldPause =
      !alreadyPaused &&
      autoEnabled &&
      !manualResume.has(campaignKey(row)) &&
      row.Spend >= SPEND_MIN &&
      row.ROAS < ROAS_MAX;

    return { ...row, budgetPaused: alreadyPaused || shouldPause };
  });
}

function filterByPlatform(rows) {
  if (currentPlatform === "all") return rows;
  return rows.filter((r) => r.Platform === currentPlatform);
}

function groupBySegment(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.Target_Segment;
    if (!map.has(key)) {
      map.set(key, {
        Target_Segment: key,
        campaigns: 0,
        activeCampaigns: 0,
        pausedCampaigns: 0,
        Impressions: 0,
        Clicks: 0,
        Spend: 0,
        activeSpend: 0,
        Conversions: 0,
        Revenue: 0,
      });
    }
    const agg = map.get(key);
    agg.campaigns += 1;
    if (row.budgetPaused) agg.pausedCampaigns += 1;
    else {
      agg.activeCampaigns += 1;
      agg.activeSpend += row.Spend;
      agg.Impressions += row.Impressions;
      agg.Clicks += row.Clicks;
      agg.Conversions += row.Conversions;
      agg.Revenue += row.Revenue;
    }
    agg.Spend += row.Spend;
  });

  return [...map.values()].map((s) => ({
    ...s,
    CTR: s.Clicks > 0 ? (s.Clicks / s.Impressions) * 100 : 0,
    CVR: s.Clicks > 0 ? (s.Conversions / s.Clicks) * 100 : 0,
    CPA: s.Conversions > 0 ? s.activeSpend / s.Conversions : 0,
    ROAS: s.activeSpend > 0 ? (s.Revenue / s.activeSpend) * 100 : 0,
  }));
}

function getWaste(rows) {
  return rows.filter((r) => r.Spend >= SPEND_MIN && r.ROAS < ROAS_MAX);
}

function buildSummary(paused, activeRows) {
  const activeSpend = activeRows.reduce((s, r) => s + r.Spend, 0);
  const activeRevenue = activeRows.reduce((s, r) => s + r.Revenue, 0);
  const roas = activeSpend > 0 ? (activeRevenue / activeSpend) * 100 : 0;
  const saved = paused.reduce((s, r) => s + r.Spend, 0);
  const modeLabel = dataMode === "live" ? "실연동" : "데모";

  let note = "";
  if (isAutoCutoffEnabled() && paused.length) {
    note = `저효율 ${paused.length}건 예산 자동 중단(절감 ${formatWon(saved)}). `;
  }

  return `${modeLabel} · ${PLATFORM_LABELS[currentPlatform] || "전체"} · 운영 ROAS ${formatPct(roas)}. ${note}메타·유튜브·틱톡 통합 모니터링 중.`;
}

function renderModeBadge() {
  modeBadge.textContent = dataMode === "live" ? "실연동 API" : "데모 모드 (3매체)";
  modeBadge.className = `mode-badge${dataMode === "live" ? " live" : ""}`;
}

function renderAutoCutoffBar(paused) {
  const enabled = isAutoCutoffEnabled();
  autoCutoffToggle.checked = enabled;
  autoCutoffStatus.textContent = enabled ? "자동 중단 ON" : "자동 중단 OFF";
  autoCutoffStatus.className = `badge ${enabled ? "badge-warn" : "badge-accent"}`;

  autoPauseBanner.hidden = false;
    if (enabled && paused.length) {
    const saved = paused.reduce((s, r) => s + r.Spend, 0);
    autoPauseBanner.className = "auto-pause-banner";
    autoPauseTitle.textContent = `${paused.length}개 캠페인 예산이 자동으로 꺼졌습니다`;
    const isLive = dataMode === "live";
    autoPauseDesc.textContent = isLive
      ? `실연동 · 매체 API로 실제 일시정지됨 · 절감 ${formatWon(saved)}`
      : apiAvailable
        ? `데모 모드 · connect.html 에서 API_MODE=live 설정 시 실제 중단 · 절감 ${formatWon(saved)}`
        : `시뮬레이션 · ./run_api.sh 실행 + 실연동 설정 필요 · 절감 ${formatWon(saved)}`;
  } else if (enabled) {
    autoPauseBanner.className = "auto-pause-banner auto-pause-banner--ok";
    autoPauseTitle.textContent = "자동 중단 규칙 활성화 중";
    autoPauseDesc.textContent = "현재 필터·조건에 해당하는 저효율 캠페인이 없습니다.";
  } else {
    autoPauseBanner.className = "auto-pause-banner auto-pause-banner--off";
    autoPauseTitle.textContent = "예산 자동 중단이 꺼져 있습니다";
    autoPauseDesc.textContent = "토글을 켜면 저효율 캠페인 예산이 자동 OFF 됩니다.";
  }
}

function renderKPIs(allRows, activeRows, paused) {
  const activeSpend = activeRows.reduce((s, r) => s + r.Spend, 0);
  const savedSpend = paused.reduce((s, r) => s + r.Spend, 0);
  const activeRevenue = activeRows.reduce((s, r) => s + r.Revenue, 0);
  const roas = activeSpend > 0 ? (activeRevenue / activeSpend) * 100 : 0;

  const cards = [
    { label: "운영 중 광고비", value: formatWon(activeSpend), sub: `${activeRows.length}건 운영`, cls: "" },
    { label: "절감 예산", value: formatWon(savedSpend), sub: `${paused.length}건 중단`, cls: savedSpend ? "rose" : "" },
    { label: "운영 ROAS", value: formatPct(roas), sub: PLATFORM_LABELS[currentPlatform], cls: "mint" },
    { label: "분석 캠페인", value: `${allRows.length}건`, sub: "메타·유튜브·틱톡", cls: "accent" },
  ];

  document.getElementById("kpi-grid").innerHTML = cards
    .map(
      (c) => `
      <div class="kpi-card ${c.cls}">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
        ${c.sub ? `<div class="kpi-sub">${c.sub}</div>` : ""}
      </div>`
    )
    .join("");
}

function statusCell(row) {
  return row.budgetPaused
    ? `<span class="status-badge paused">예산 OFF</span>`
    : `<span class="status-badge active">운영 중</span>`;
}

function renderWarningTable(waste, paused) {
  const tbody = document.querySelector("#warning-table tbody");
  if (!waste.length) {
    warningPanel.hidden = true;
    return;
  }
  warningPanel.hidden = false;
  warningCount.textContent = `${waste.length}건`;
  tbody.innerHTML = waste
    .map((r) => {
      const isPaused = paused.some((p) => campaignKey(p) === campaignKey(r));
      return `
      <tr class="${isPaused ? "row-paused" : ""}">
        <td>${platformTag(r.Platform)}</td>
        <td>${r.Brand}</td>
        <td>${r.Campaign_Name}</td>
        <td>${r.Target_Segment}</td>
        <td>${formatWon(r.Spend)}</td>
        <td class="roas-low">${formatPct(r.ROAS)}</td>
        <td>${isPaused ? '<span class="status-badge paused">자동 중단</span>' : statusCell(r)}</td>
      </tr>`;
    })
    .join("");
}

function rankClass(i) {
  return i === 0 ? "gold" : i === 1 ? "silver" : "bronze";
}

function renderTopTable(tableId, items, type) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = items
    .map((r, i) => {
      if (type === "cpa") {
        return `<tr>
          <td><span class="rank ${rankClass(i)}">${i + 1}</span></td>
          <td>${r.Target_Segment}</td>
          <td>${formatWon(r.CPA)}</td>
          <td class="roas-high">${formatPct(r.ROAS)}</td>
          <td>${r.Conversions.toLocaleString()}건</td>
        </tr>`;
      }
      return `<tr>
        <td><span class="rank ${rankClass(i)}">${i + 1}</span></td>
        <td>${r.Target_Segment}</td>
        <td class="roas-high">${formatPct(r.ROAS)}</td>
        <td>${formatWon(r.CPA)}</td>
        <td>${formatWon(r.Revenue)}</td>
      </tr>`;
    })
    .join("");
}

function renderSegmentTable(segments) {
  document.querySelector("#segment-table tbody").innerHTML = segments
    .sort((a, b) => b.ROAS - a.ROAS)
    .map(
      (s) => `<tr>
        <td><strong>${s.Target_Segment}</strong></td>
        <td>${s.activeCampaigns}건</td>
        <td>${formatWon(s.activeSpend)}</td>
        <td>${formatWon(s.Revenue)}</td>
        <td>${s.Conversions.toLocaleString()}건</td>
        <td>${formatPct(s.CTR, 2)}</td>
        <td>${formatPct(s.CVR, 2)}</td>
        <td>${formatWon(s.CPA)}</td>
        <td class="roas-high">${formatPct(s.ROAS)}</td>
      </tr>`
    )
    .join("");
}

function renderCampaignTable(rows) {
  const active = rows.filter((r) => !r.budgetPaused);
  const paused = rows.filter((r) => r.budgetPaused);
  document.getElementById("campaign-count").textContent =
    `전체 ${rows.length} · 운영 ${active.length} · 중단 ${paused.length}`;

  document.querySelector("#campaign-table tbody").innerHTML = [...rows]
    .sort((a, b) => (a.budgetPaused === b.budgetPaused ? b.ROAS - a.ROAS : a.budgetPaused ? 1 : -1))
    .map((r) => {
      const roasCls = r.ROAS < ROAS_MAX && r.Spend >= SPEND_MIN ? "roas-low" : r.ROAS >= 200 ? "roas-high" : "";
      const resumeBtn = r.budgetPaused
        ? `<button class="resume-btn" data-key="${campaignKey(r)}">예산 재개</button>`
        : "";
      return `<tr class="${r.budgetPaused ? "row-paused" : ""}">
        <td>${platformTag(r.Platform)}</td>
        <td>${r.Brand}</td>
        <td>${r.Campaign_Name}</td>
        <td>${r.Target_Segment}</td>
        <td>${formatWon(r.Spend)}</td>
        <td>${formatWon(r.Revenue)}</td>
        <td class="${roasCls}">${formatPct(r.ROAS)}</td>
        <td>${statusCell(r)}</td>
        <td>${resumeBtn}</td>
      </tr>`;
    })
    .join("");

  document.querySelectorAll(".resume-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const set = getManualResumeSet();
      set.add(btn.dataset.key);
      saveManualResumeSet(set);
      renderDashboard(currentRows, currentSource);
    });
  });
}

function renderDashboard(rows, sourceName) {
  currentRows = rows;
  currentSource = sourceName;

  const filtered = filterByPlatform(rows.map(normalizeRow));
  const enriched = applyBudgetStatus(filtered);
  const activeRows = enriched.filter((r) => !r.budgetPaused);
  const paused = enriched.filter((r) => r.budgetPaused);
  const waste = getWaste(enriched);
  const segments = groupBySegment(enriched);

  const topCpa = [...segments].filter((s) => s.Conversions > 0).sort((a, b) => a.CPA - b.CPA).slice(0, 3);
  const topRoas = [...segments].filter((s) => s.activeSpend > 0).sort((a, b) => b.ROAS - a.ROAS).slice(0, 3);

  renderModeBadge();
  renderAutoCutoffBar(paused);
  renderKPIs(enriched, activeRows, paused);
  summaryText.textContent = buildSummary(paused, activeRows);
  summaryBanner.hidden = false;
  renderWarningTable(waste, paused);
  renderTopTable("top-cpa-table", topCpa, "cpa");
  renderTopTable("top-roas-table", topRoas, "roas");
  renderSegmentTable(segments);
  renderCampaignTable(enriched);

  dataSource.textContent = sourceName;
  generatedAt.textContent = new Date().toLocaleString("ko-KR");
}

async function tryLoadAPI(autoPause) {
  try {
    const url = autoPause ? `${API_BASE}/api/auto-pause` : `${API_BASE}/api/analyze?auto_pause=false`;
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    apiAvailable = true;
    dataMode = data.mode === "live" || data.platform_status?.mode === "live" ? "live" : "demo";
    return {
      rows: data.campaigns || [],
      source: dataMode === "live" ? "실연동 API" : "데모 API",
      summary: data.summary,
      message: data.message,
    };
  } catch {
    apiAvailable = false;
    return null;
  }
}

async function loadJSON() {
  const res = await fetch(JSON_PATH);
  if (!res.ok) throw new Error("JSON 없음");
  const data = await res.json();
  dataMode = data.mode === "live" ? "live" : "demo";
  return { rows: data.campaigns, source: JSON_PATH };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].replace(/^\uFEFF/, "").split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const key = h.trim();
      const val = values[i] ?? "";
      row[key] = ["Impressions", "Clicks", "Spend", "Conversions", "Revenue"].includes(key)
        ? Number(val)
        : val.trim();
    });
    row.Platform = row.Platform || "legacy";
    row.Brand = row.Brand || "-";
    return row;
  });
}

async function loadCSV() {
  const res = await fetch(CSV_PATH);
  if (!res.ok) throw new Error("CSV 없음");
  return { rows: parseCSV(await res.text()), source: CSV_PATH };
}

async function init(sourceFile, forceAutoPause = false) {
  showLoading(true);
  try {
    let payload = null;

    if (!sourceFile) {
      payload = await tryLoadAPI(forceAutoPause && isAutoCutoffEnabled());
      if (!payload) payload = await loadJSON();
    }

    if (sourceFile) {
      const text = await sourceFile.text();
      payload = { rows: parseCSV(text), source: sourceFile.name };
    }

    if (!payload) payload = await loadCSV();

    renderDashboard(payload.rows, payload.source);
    if (payload.summary) {
      summaryText.textContent = payload.message
        ? `${payload.summary} (${payload.message})`
        : payload.summary;
    }
  } catch (err) {
    summaryText.textContent = `오류: ${err.message}`;
    summaryBanner.hidden = false;
  } finally {
    showLoading(false);
  }
}

document.querySelectorAll(".platform-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".platform-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentPlatform = btn.dataset.platform;
    renderDashboard(currentRows, currentSource);
  });
});

autoCutoffToggle.addEventListener("change", async () => {
  localStorage.setItem(AUTO_CUTOFF_KEY, String(autoCutoffToggle.checked));
  if (apiAvailable && autoCutoffToggle.checked) {
    await init(null, true);
  } else if (currentRows.length) {
    renderDashboard(currentRows, currentSource);
  }
});

document.getElementById("refresh-btn").addEventListener("click", () => init(null, isAutoCutoffEnabled()));
document.getElementById("csv-upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) init(file);
});

init();