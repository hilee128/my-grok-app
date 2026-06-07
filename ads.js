const CSV_PATH = "ad_performance_raw.csv";
const SPEND_MIN = 500_000;
const ROAS_MAX = 150;

const loading = document.getElementById("loading");
const summaryBanner = document.getElementById("summary-banner");
const summaryText = document.getElementById("summary-text");
const warningPanel = document.getElementById("warning-panel");
const warningCount = document.getElementById("warning-count");
const dataSource = document.getElementById("data-source");
const generatedAt = document.getElementById("generated-at");

function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}

function formatWon(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatPct(value, digits = 1) {
  return `${value.toFixed(digits)}%`;
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

function groupBySegment(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.Target_Segment;
    if (!map.has(key)) {
      map.set(key, {
        Target_Segment: key,
        campaigns: 0,
        Impressions: 0,
        Clicks: 0,
        Spend: 0,
        Conversions: 0,
        Revenue: 0,
      });
    }
    const agg = map.get(key);
    agg.campaigns += 1;
    agg.Impressions += row.Impressions;
    agg.Clicks += row.Clicks;
    agg.Spend += row.Spend;
    agg.Conversions += row.Conversions;
    agg.Revenue += row.Revenue;
  });

  return [...map.values()].map((s) => ({
    ...s,
    CTR: (s.Clicks / s.Impressions) * 100,
    CVR: (s.Conversions / s.Clicks) * 100,
    CPA: s.Spend / s.Conversions,
    ROAS: (s.Revenue / s.Spend) * 100,
  }));
}

function getWasteCampaigns(rows) {
  return rows
    .filter((r) => r.Spend >= SPEND_MIN && r.ROAS < ROAS_MAX)
    .sort((a, b) => a.ROAS - b.ROAS);
}

function buildSummary(waste, topCpa, topRoas, totalSpend, totalRoas) {
  const bestRoas = topRoas[0]?.Target_Segment ?? "-";
  const bestCpa = topCpa[0]?.Target_Segment ?? "-";
  const wasteNote = waste.length
    ? `예산 낭비 의심 캠페인 ${waste.length}건 즉시 예산 축소·소재 교체 검토,`
    : "예산 낭비 캠페인 없음,";

  return (
    `전체 ROAS ${formatPct(totalRoas)} 기준, ` +
    `'${bestRoas}' 세그먼트 예산 확대·'${bestCpa}' 세그먼트 전환 효율 벤치마킹 권장. ` +
    `${wasteNote} 총 광고비 ${formatWon(totalSpend)} 대비 수익 극대화 액션 우선.`
  );
}

function renderKPIs(rows) {
  const totalSpend = rows.reduce((s, r) => s + r.Spend, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.Revenue, 0);
  const totalConversions = rows.reduce((s, r) => s + r.Conversions, 0);
  const totalRoas = (totalRevenue / totalSpend) * 100;
  const avgCpa = totalSpend / totalConversions;

  const cards = [
    { label: "총 광고비", value: formatWon(totalSpend), cls: "" },
    { label: "총 매출", value: formatWon(totalRevenue), cls: "accent" },
    { label: "전체 ROAS", value: formatPct(totalRoas), cls: "mint" },
    { label: "평균 CPA", value: formatWon(avgCpa), cls: "rose" },
    { label: "분석 캠페인", value: `${rows.length}건`, cls: "" },
  ];

  document.getElementById("kpi-grid").innerHTML = cards
    .map(
      (c) => `
      <div class="kpi-card ${c.cls}">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
      </div>`
    )
    .join("");

  return { totalSpend, totalRevenue, totalRoas };
}

function renderWarningTable(waste) {
  const tbody = document.querySelector("#warning-table tbody");
  if (!waste.length) {
    warningPanel.hidden = true;
    return;
  }

  warningPanel.hidden = false;
  warningCount.textContent = `${waste.length}건`;
  tbody.innerHTML = waste
    .map(
      (r) => `
      <tr>
        <td>${r.Campaign_Name}</td>
        <td>${r.Target_Segment}</td>
        <td>${formatWon(r.Spend)}</td>
        <td>${formatWon(r.Revenue)}</td>
        <td class="roas-low">${formatPct(r.ROAS)}</td>
        <td>${formatWon(r.CPA)}</td>
      </tr>`
    )
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
        <td>${s.campaigns}건</td>
        <td>${formatWon(s.Spend)}</td>
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
  document.getElementById("campaign-count").textContent = `${rows.length}건`;
  const tbody = document.querySelector("#campaign-table tbody");
  tbody.innerHTML = [...rows]
    .sort((a, b) => b.ROAS - a.ROAS)
    .map((r) => {
      const roasCls = r.ROAS < ROAS_MAX && r.Spend >= SPEND_MIN ? "roas-low" : r.ROAS >= 200 ? "roas-high" : "";
      return `
      <tr>
        <td>${r.Campaign_Name}</td>
        <td>${r.Target_Segment}</td>
        <td>${formatWon(r.Spend)}</td>
        <td>${formatWon(r.Revenue)}</td>
        <td>${formatPct(r.CTR, 2)}</td>
        <td>${formatPct(r.CVR, 2)}</td>
        <td>${formatWon(r.CPA)}</td>
        <td class="${roasCls}">${formatPct(r.ROAS)}</td>
      </tr>`;
    })
    .join("");
}

function renderDashboard(rows, sourceName) {
  const enriched = addMetrics(rows);
  const segments = groupBySegment(enriched);
  const waste = getWasteCampaigns(enriched);

  const topCpa = [...segments].sort((a, b) => a.CPA - b.CPA).slice(0, 3);
  const topRoas = [...segments].sort((a, b) => b.ROAS - a.ROAS).slice(0, 3);

  const { totalSpend, totalRoas } = renderKPIs(enriched);

  summaryText.textContent = buildSummary(waste, topCpa, topRoas, totalSpend, totalRoas);
  summaryBanner.hidden = false;

  renderWarningTable(waste);
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

document.getElementById("refresh-btn").addEventListener("click", () => init());
document.getElementById("csv-upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) init(file);
});

init();