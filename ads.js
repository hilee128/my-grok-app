const CSV_PATH = "ad_performance_raw.csv";
const SPEND_MIN = 500_000;
const ROAS_MAX = 150;
const AUTO_CUTOFF_KEY = "ads-auto-cutoff-enabled";
const MANUAL_RESUME_KEY = "ads-manual-resume";

const loading = document.getElementById("loading");
const summaryBanner = document.getElementById("summary-banner");
const summaryText = document.getElementById("summary-text");
const warningPanel = document.getElementById("warning-panel");
const warningCount = document.getElementById("warning-count");
const dataSource = document.getElementById("data-source");
const generatedAt = document.getElementById("generated-at");
const autoCutoffToggle = document.getElementById("auto-cutoff-toggle");
const autoCutoffStatus = document.getElementById("auto-cutoff-status");
const autoPauseBanner = document.getElementById("auto-pause-banner");
const autoPauseTitle = document.getElementById("auto-pause-title");
const autoPauseDesc = document.getElementById("auto-pause-desc");

let currentRows = [];
let currentSource = CSV_PATH;

function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}

function formatWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatPct(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function campaignKey(row) {
  return `${row.Campaign_Name}::${row.Target_Segment}`;
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

function shouldAutoPause(row, autoEnabled, manualResume) {
  if (!autoEnabled) return false;
  if (manualResume.has(campaignKey(row))) return false;
  return row.Spend >= SPEND_MIN && row.ROAS < ROAS_MAX;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].replace(/^\uFEFF/, "").split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const val = values[i] ?? "";
      row[h.trim()] = ["Impressions", "Clicks", "Spend", "Conversions", "Revenue"].includes(h.trim())
        ? Number(val)
        : val.trim();
    });
    return row;
  });
}

function addMetrics(rows) {
  return rows.map((row) => {
    const ctr = (row.Clicks / row.Impressions) * 100;
    const cvr = (row.Conversions / row.Clicks) * 100;
    const cpa = row.Spend / row.Conversions;
    const roas = (row.Revenue / row.Spend) * 100;
    return { ...row, CTR: ctr, CVR: cvr, CPA: cpa, ROAS: roas };
  });
}

function applyBudgetStatus(rows) {
  const autoEnabled = isAutoCutoffEnabled();
  const manualResume = getManualResumeSet();

  return rows.map((row) => ({
    ...row,
    budgetPaused: shouldAutoPause(row, autoEnabled, manualResume),
  }));
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
    if (row.budgetPaused) {
      agg.pausedCampaigns += 1;
    } else {
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

function getWasteCampaigns(rows) {
  return rows
    .filter((r) => r.Spend >= SPEND_MIN && r.ROAS < ROAS_MAX)
    .sort((a, b) => a.ROAS - b.ROAS);
}

function getPausedCampaigns(rows) {
  return rows.filter((r) => r.budgetPaused);
}

function buildSummary(paused, activeRows, topCpa, topRoas) {
  const activeSpend = activeRows.reduce((s, r) => s + r.Spend, 0);
  const activeRevenue = activeRows.reduce((s, r) => s + r.Revenue, 0);
  const totalRoas = activeSpend > 0 ? (activeRevenue / activeSpend) * 100 : 0;
  const savedSpend = paused.reduce((s, r) => s + r.Spend, 0);

  const bestRoas = topRoas[0]?.Target_Segment ?? "-";
  const bestCpa = topCpa[0]?.Target_Segment ?? "-";

  let pauseNote = "";
  if (isAutoCutoffEnabled() && paused.length) {
    pauseNote = `저효율 ${paused.length}건 예산 자동 중단(절감 ${formatWon(savedSpend)}), `;
  } else if (!isAutoCutoffEnabled()) {
    pauseNote = "자동 중단 OFF 상태 — 수동 예산 조정 필요, ";
  }

  return (
    `운영 중 ROAS ${formatPct(totalRoas)} 기준, ` +
    `'${bestRoas}' 세그먼트 예산 확대·'${bestCpa}' 세그먼트 벤치마킹 권장. ` +
    `${pauseNote}총 운영 광고비 ${formatWon(activeSpend)} 대비 수익 극대화 액션 우선.`
  );
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
    autoPauseDesc.textContent =
      `ROAS ${ROAS_MAX}% 미만 · 광고비 ${formatWon(SPEND_MIN)} 이상 조건 충족. ` +
      `절감 예상액 ${formatWon(saved)} · 아래 표에서 개별 재개 가능`;
  } else if (enabled) {
    autoPauseBanner.className = "auto-pause-banner auto-pause-banner--ok";
    autoPauseTitle.textContent = "자동 중단 규칙 활성화 중";
    autoPauseDesc.textContent = "현재 조건에 해당하는 저효율 캠페인이 없습니다.";
  } else {
    autoPauseBanner.className = "auto-pause-banner auto-pause-banner--off";
    autoPauseTitle.textContent = "예산 자동 중단이 꺼져 있습니다";
    autoPauseDesc.textContent = "토글을 켜면 저효율 캠페인 예산이 자동으로 OFF 됩니다.";
  }
}

function renderKPIs(allRows, activeRows, paused) {
  const totalSpend = allRows.reduce((s, r) => s + r.Spend, 0);
  const activeSpend = activeRows.reduce((s, r) => s + r.Spend, 0);
  const activeRevenue = activeRows.reduce((s, r) => s + r.Revenue, 0);
  const savedSpend = paused.reduce((s, r) => s + r.Spend, 0);
  const totalRoas = activeSpend > 0 ? (activeRevenue / activeSpend) * 100 : 0;
  const avgCpa = activeRows.length
    ? activeSpend / activeRows.reduce((s, r) => s + r.Conversions, 0)
    : 0;

  const cards = [
    {
      label: "운영 중 광고비",
      value: formatWon(activeSpend),
      sub: paused.length ? `중단 ${paused.length}건 제외` : "",
      cls: "",
    },
    {
      label: "절감 예산",
      value: formatWon(savedSpend),
      sub: isAutoCutoffEnabled() ? "자동 중단으로 차단" : "자동 중단 OFF",
      cls: savedSpend > 0 ? "rose" : "",
    },
    {
      label: "운영 ROAS",
      value: formatPct(totalRoas),
      sub: `전체 ${formatWon(totalSpend)} 대비`,
      cls: "mint",
    },
    {
      label: "운영 평균 CPA",
      value: formatWon(avgCpa),
      sub: `${activeRows.length}개 캠페인 운영 중`,
      cls: "accent",
    },
    {
      label: "전체 캠페인",
      value: `${allRows.length}건`,
      sub: `운영 ${activeRows.length} · 중단 ${paused.length}`,
      cls: "",
    },
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
  if (row.budgetPaused) {
    return `<span class="status-badge paused">예산 OFF</span>`;
  }
  return `<span class="status-badge active">운영 중</span>`;
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
        <td>${r.Campaign_Name}</td>
        <td>${r.Target_Segment}</td>
        <td>${formatWon(r.Spend)}</td>
        <td>${formatWon(r.Revenue)}</td>
        <td class="roas-low">${formatPct(r.ROAS)}</td>
        <td>${formatWon(r.CPA)}</td>
        <td>${isPaused ? '<span class="status-badge paused">자동 중단됨</span>' : '<span class="status-badge active">운영 중</span>'}</td>
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
        return `
        <tr>
          <td><span class="rank ${rankClass(i)}">${i + 1}</span></td>
          <td>${r.Target_Segment}</td>
          <td>${formatWon(r.CPA)}</td>
          <td class="roas-high">${formatPct(r.ROAS)}</td>
          <td>${r.Conversions.toLocaleString()}건</td>
        </tr>`;
      }
      return `
        <tr>
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
  const tbody = document.querySelector("#segment-table tbody");
  tbody.innerHTML = segments
    .sort((a, b) => b.ROAS - a.ROAS)
    .map(
      (s) => `
      <tr>
        <td><strong>${s.Target_Segment}</strong></td>
        <td>${s.activeCampaigns}건${s.pausedCampaigns ? ` <span class="status-badge paused">-${s.pausedCampaigns}</span>` : ""}</td>
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
    `전체 ${rows.length}건 · 운영 ${active.length} · 중단 ${paused.length}`;

  const tbody = document.querySelector("#campaign-table tbody");
  tbody.innerHTML = [...rows]
    .sort((a, b) => {
      if (a.budgetPaused !== b.budgetPaused) return a.budgetPaused ? 1 : -1;
      return b.ROAS - a.ROAS;
    })
    .map((r) => {
      const roasCls =
        r.ROAS < ROAS_MAX && r.Spend >= SPEND_MIN ? "roas-low" : r.ROAS >= 200 ? "roas-high" : "";
      const resumeBtn = r.budgetPaused
        ? `<button class="resume-btn" data-key="${campaignKey(r)}">예산 재개</button>`
        : "";
      return `
      <tr class="${r.budgetPaused ? "row-paused" : ""}">
        <td>${r.Campaign_Name}</td>
        <td>${r.Target_Segment}</td>
        <td>${formatWon(r.Spend)}</td>
        <td>${formatWon(r.Revenue)}</td>
        <td>${formatPct(r.CTR, 2)}</td>
        <td>${formatPct(r.CVR, 2)}</td>
        <td>${formatWon(r.CPA)}</td>
        <td class="${roasCls}">${formatPct(r.ROAS)}</td>
        <td>${statusCell(r)}</td>
        <td>${resumeBtn}</td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".resume-btn").forEach((btn) => {
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

  const enriched = applyBudgetStatus(addMetrics(rows));
  const activeRows = enriched.filter((r) => !r.budgetPaused);
  const paused = getPausedCampaigns(enriched);
  const segments = groupBySegment(enriched);
  const waste = getWasteCampaigns(enriched);

  const topCpa = [...segments].filter((s) => s.Conversions > 0).sort((a, b) => a.CPA - b.CPA).slice(0, 3);
  const topRoas = [...segments].filter((s) => s.activeSpend > 0).sort((a, b) => b.ROAS - a.ROAS).slice(0, 3);

  renderAutoCutoffBar(paused);
  renderKPIs(enriched, activeRows, paused);

  summaryText.textContent = buildSummary(paused, activeRows, topCpa, topRoas);
  summaryBanner.hidden = false;

  renderWarningTable(waste, paused);
  renderTopTable("top-cpa-table", topCpa, "cpa");
  renderTopTable("top-roas-table", topRoas, "roas");
  renderSegmentTable(segments);
  renderCampaignTable(enriched);

  dataSource.textContent = sourceName;
  generatedAt.textContent = new Date().toLocaleString("ko-KR");
}

async function loadDefaultCSV() {
  const res = await fetch(CSV_PATH);
  if (!res.ok) throw new Error("CSV 파일을 불러올 수 없습니다.");
  const text = await res.text();
  return { rows: parseCSV(text), source: CSV_PATH };
}

function handleFileUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve({ rows: parseCSV(e.target.result), source: file.name });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsText(file, "UTF-8");
  });
}

async function init(sourceFile) {
  showLoading(true);
  try {
    const { rows, source } = sourceFile
      ? await handleFileUpload(sourceFile)
      : await loadDefaultCSV();
    renderDashboard(rows, source);
  } catch (err) {
    summaryText.textContent = `오류: ${err.message}`;
    summaryBanner.hidden = false;
  } finally {
    showLoading(false);
  }
}

autoCutoffToggle.addEventListener("change", () => {
  localStorage.setItem(AUTO_CUTOFF_KEY, String(autoCutoffToggle.checked));
  if (currentRows.length) {
    renderDashboard(currentRows, currentSource);
  }
});

document.getElementById("refresh-btn").addEventListener("click", () => init());
document.getElementById("csv-upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) init(file);
});

init();