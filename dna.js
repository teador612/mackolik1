"use strict";
/* =========================================================
   DNA — SONUÇTAN ORAN ANALİZİ
   Veri: ./data/matches.json
   Geçmiş: Seçilen tarihten önceki 30 gün
   Minimum örnek: 8
   Minimum başarı: %80
   Eşleşme: Aynı market + birebir aynı açılış oranı
   Minimum tekli oran: 1.35
   Not:
   Kupona ekleme özelliği kaldırılmıştır.
   Analiz ve başarı hesaplama mantığı korunmuştur.
   ========================================================= */
const DNA_CONFIG = {
  DATA_URL: "./data/matches.json",
  HISTORY_DAYS: 30,
  MIN_SAMPLE: 8,
  MIN_SUCCESS: 80,
  MIN_ODD: 1.35,
  MIN_TOTAL_ODD: 2,
  MAX_PICKS: 5,
  MAX_SAVED_COUPONS: 3,
  STORAGE_KEY: "dna_mixed_coupon_history_v2"
};
/* JSON'daki açılış oranlarıyla eşleştirilmiş marketler. */
const DNA_MARKETS = [
  { id: "ms1", label: "MS1", fields: ["ms1", "MS1"] },
  { id: "msX", label: "MSX", fields: ["msX", "msx", "MSX"] },
  { id: "ms2", label: "MS2", fields: ["ms2", "MS2"] },
  { id: "iy1", label: "İY1", fields: ["iy1", "IY1"] },
  { id: "iyX", label: "İYX", fields: ["iyX", "iyx", "IYX"] },
  { id: "iy2", label: "İY2", fields: ["iy2", "IY2"] },
  { id: "cs1X", label: "ÇŞ 1X", fields: ["cs1X", "CS1X"] },
  { id: "cs12", label: "ÇŞ 12", fields: ["cs12", "CS12"] },
  { id: "csX2", label: "ÇŞ X2", fields: ["csX2", "CSX2"] },
  { id: "au15Alt", label: "1.5 Alt", fields: ["au15Alt", "ms15Alt"] },
  { id: "au15Ust", label: "1.5 Üst", fields: ["au15Ust", "ms15Ust"] },
  { id: "au25Alt", label: "2.5 Alt", fields: ["au25Alt"] },
  { id: "au25Ust", label: "2.5 Üst", fields: ["au25Ust"] },
  { id: "au35Alt", label: "3.5 Alt", fields: ["au35Alt"] },
  { id: "au35Ust", label: "3.5 Üst", fields: ["au35Ust"] },
  { id: "kgVar", label: "KG Var", fields: ["kgVar"] },
  { id: "kgYok", label: "KG Yok", fields: ["kgYok"] },
  { id: "iy15Alt", label: "İY 1.5 Alt", fields: ["iy15Alt"] },
  { id: "iy15Ust", label: "İY 1.5 Üst", fields: ["iy15Ust"] },
  { id: "gol01", label: "0-1 Gol", fields: ["gol01"] },
  { id: "gol23", label: "2-3 Gol", fields: ["gol23"] },
  { id: "gol46", label: "4-6 Gol", fields: ["gol46"] },
  { id: "gol7", label: "7+ Gol", fields: ["gol7"] },
  { id: "handicap1", label: "Handikap 1", fields: ["handicap1"] },
  { id: "handicapX", label: "Handikap X", fields: ["handicapX"] },
  { id: "handicap2", label: "Handikap 2", fields: ["handicap2"] }
];
const DNA_RESULTS = {
  MS1: {
    label: "MS1",
    type: "ft",
    test: s => s.home > s.away
  },
  MSX: {
    label: "MSX",
    type: "ft",
    test: s => s.home === s.away
  },
  MS2: {
    label: "MS2",
    type: "ft",
    test: s => s.away > s.home
  },
  IY1: {
    label: "İY1",
    type: "ht",
    test: s => s.home > s.away
  },
  IYX: {
    label: "İYX",
    type: "ht",
    test: s => s.home === s.away
  },
  IY2: {
    label: "İY2",
    type: "ht",
    test: s => s.away > s.home
  },
  KG_VAR: {
    label: "KG Var",
    type: "ft",
    test: s => s.home > 0 && s.away > 0
  },
  KG_YOK: {
    label: "KG Yok",
    type: "ft",
    test: s => s.home === 0 || s.away === 0
  },
  IY15_ALT: {
    label: "İY 1.5 Alt",
    type: "ht",
    test: s => s.home + s.away <= 1
  },
  IY15_UST: {
    label: "İY 1.5 Üst",
    type: "ht",
    test: s => s.home + s.away >= 2
  },
  "15_ALT": {
    label: "1.5 Alt",
    type: "ft",
    test: s => s.home + s.away <= 1
  },
  "15_UST": {
    label: "1.5 Üst",
    type: "ft",
    test: s => s.home + s.away >= 2
  },
  "25_ALT": {
    label: "2.5 Alt",
    type: "ft",
    test: s => s.home + s.away <= 2
  },
  "25_UST": {
    label: "2.5 Üst",
    type: "ft",
    test: s => s.home + s.away >= 3
  },
  "35_ALT": {
    label: "3.5 Alt",
    type: "ft",
    test: s => s.home + s.away <= 3
  },
  "35_UST": {
    label: "3.5 Üst",
    type: "ft",
    test: s => s.home + s.away >= 4
  },
  GOL01: {
    label: "0-1 Gol",
    type: "ft",
    test: s => s.home + s.away <= 1
  },
  GOL23: {
    label: "2-3 Gol",
    type: "ft",
    test: s => s.home + s.away >= 2 && s.home + s.away <= 3
  },
  GOL46: {
    label: "4-6 Gol",
    type: "ft",
    test: s => s.home + s.away >= 4 && s.home + s.away <= 6
  },
  GOL7: {
    label: "7+ Gol",
    type: "ft",
    test: s => s.home + s.away >= 7
  }
};
let dnaMatches = [];
let dnaAnalysisRows = [];
const $ = id => document.getElementById(id);
/* =========================================================
   GENEL YARDIMCILAR
   ========================================================= */
function dnaEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function dnaNormalizeOdd(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(number) && number > 0
    ? number.toFixed(2)
    : null;
}
function dnaParseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  let match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  return null;
}
function dnaDateKey(match) {
  return dnaParseDate(
    match?.date ??
    match?.matchDate ??
    match?.gameDate ??
    match?.tarih ??
    match?.datetime ??
    match?.dateTime
  );
}
function dnaTodayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}
function dnaAddDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
function dnaFormatDate(dateKey) {
  if (!dateKey) return "-";
  const parts = dateKey.split("-");
  return parts.length === 3
    ? `${parts[2]}.${parts[1]}.${parts[0]}`
    : dateKey;
}
function dnaTeam(match, side) {
  return side === "home"
    ? match?.home ?? match?.homeTeam ?? match?.homeName ?? "-"
    : match?.away ?? match?.awayTeam ?? match?.awayName ?? "-";
}
function dnaLeague(match) {
  return match?.league ?? match?.leagueName ?? match?.competition ?? "-";
}
function dnaTime(match) {
  const value = match?.time ?? match?.matchTime ?? match?.startTime ?? "";
  const found = String(value).match(/(\d{1,2}):(\d{2})/);
  return found
    ? `${found[1].padStart(2, "0")}:${found[2]}`
    : "--:--";
}
/* =========================================================
   SKORLAR — matches.json YAPISINA GÖRE
   ========================================================= */
function dnaParseScore(value) {
  if (!value || typeof value !== "object") return null;
  const home = value.home;
  const away = value.away;
  if (
    home === null ||
    home === undefined ||
    away === null ||
    away === undefined ||
    home === "" ||
    away === "" ||
    !Number.isFinite(Number(home)) ||
    !Number.isFinite(Number(away))
  ) {
    return null;
  }
  return {
    home: Number(home),
    away: Number(away)
  };
}
function dnaScore(match, type) {
  return type === "ht"
    ? dnaParseScore(match?.halfTimeScore)
    : dnaParseScore(match?.score);
}
function dnaPlayed(match) {
  return dnaScore(match, "ft") !== null;
}
function dnaResult(match, resultId) {
  const definition = DNA_RESULTS[resultId];
  if (!definition) return null;
  const score = dnaScore(match, definition.type);
  if (!score) return null;
  return definition.test(score);
}
function dnaStatus(match, resultId) {
  const definition = DNA_RESULTS[resultId];
  const score = definition ? dnaScore(match, definition.type) : null;
  if (!definition || !score) {
    return {
      text: "Bekliyor",
      className: "sa-status-pending",
      score: "-"
    };
  }
  const success = definition.test(score);
  return {
    text: success ? "Başarılı" : "Başarısız",
    className: success ? "sa-status-success" : "sa-status-failed",
    score: `${score.home}-${score.away}`
  };
}
/* =========================================================
   ORANLAR — ÖNCELİK openingOdds
   ========================================================= */
function dnaOdds(match, market) {
  const containers = [
    match?.openingOdds,
    match?.openOdds,
    match?.odds,
    match?.opening,
    match?.oranlar,
    match
  ];
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
    for (const field of market.fields) {
      if (!Object.prototype.hasOwnProperty.call(container, field)) {
        continue;
      }
      const odd = dnaNormalizeOdd(container[field]);
      if (odd !== null) return odd;
    }
  }
  return null;
}
/* =========================================================
   VERİ YÜKLEME
   ========================================================= */
async function dnaLoadData() {
  const response = await fetch(`${DNA_CONFIG.DATA_URL}?t=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Veri alınamadı: ${response.status}`);
  }
  const json = await response.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.matches)) return json.matches;
  throw new Error("JSON içinde matches dizisi bulunamadı.");
}
/* =========================================================
   ANALİZ MOTORU
   ========================================================= */
function dnaRunAnalysis(targetDate, resultId) {
  if (!DNA_RESULTS[resultId]) {
    throw new Error(`Sonuç grubu tanımlı değil: ${resultId}`);
  }
  const startDate = dnaAddDays(targetDate, -DNA_CONFIG.HISTORY_DAYS);
  const history = dnaMatches.filter(match => {
    const date = dnaDateKey(match);
    return date &&
      date >= startDate &&
      date < targetDate &&
      dnaPlayed(match);
  });
  const targetIndex = new Map();
  for (const match of dnaMatches) {
    if (dnaDateKey(match) !== targetDate) continue;
    for (const market of DNA_MARKETS) {
      const odd = dnaOdds(match, market);
      if (odd === null) continue;
      // Minimum tekli oran: 1.35
      if (Number(odd) < DNA_CONFIG.MIN_ODD) continue;
      const key = `${market.id}|${odd}`;
      if (!targetIndex.has(key)) {
        targetIndex.set(key, []);
      }
      targetIndex.get(key).push(match);
    }
  }
  const groups = new Map();
  for (const match of history) {
    const success = dnaResult(match, resultId);
    if (success === null) continue;
    for (const market of DNA_MARKETS) {
      const odd = dnaOdds(match, market);
      if (odd === null) continue;
      const key = `${market.id}|${odd}`;
      if (!groups.has(key)) {
        groups.set(key, {
          marketId: market.id,
          marketLabel: market.label,
          odd,
          total: 0,
          success: 0
        });
      }
      const group = groups.get(key);
      group.total++;
      if (success) {
        group.success++;
      }
    }
  }
  const rows = [];
  for (const group of groups.values()) {
    if (group.total < DNA_CONFIG.MIN_SAMPLE) continue;
    // Minimum tekli oran: 1.35
    if (Number(group.odd) < DNA_CONFIG.MIN_ODD) continue;
    group.rate = group.success / group.total * 100;
    if (group.rate < DNA_CONFIG.MIN_SUCCESS) continue;
    const future = targetIndex.get(`${group.marketId}|${group.odd}`) || [];
    if (!future.length) continue;
    group.future = future;
    rows.push(group);
  }
  rows.sort((a, b) =>
    b.rate - a.rate ||
    b.total - a.total ||
    Number(a.odd) - Number(b.odd)
  );
  return { history, rows };
}
/* =========================================================
   ANALİZ SONUÇLARI
   Kupona ekleme düğmesi kaldırılmıştır.
   ========================================================= */
function dnaRenderMatches(row) {
  let html = `
    <div class="sa-details-title">
      <span>${dnaEscape(row.marketLabel)} · ${dnaEscape(row.odd)}</span>
      <strong>${row.rate.toFixed(1).replace(".0", "")}%</strong>
    </div>
  `;
  row.future.forEach(match => {
    html += `
      <div class="sa-match">
        <div class="sa-match-time">${dnaEscape(dnaTime(match))}</div>
        <div class="sa-match-info">
          <div class="sa-match-teams">
            ${dnaEscape(dnaTeam(match, "home"))}
            <span>vs</span>
            ${dnaEscape(dnaTeam(match, "away"))}
          </div>
          <div class="sa-match-meta">
            ${dnaEscape(dnaLeague(match))} ·
            ${dnaEscape(dnaFormatDate(dnaDateKey(match)))}
          </div>
        </div>
        <div class="sa-match-actions">
          <div class="sa-match-odd">
            ${dnaEscape(row.marketLabel)}
            <strong>${dnaEscape(row.odd)}</strong>
          </div>
        </div>
      </div>
    `;
  });
  return html;
}
function dnaRenderAnalysis(resultId, targetDate, analysis) {
  const content = $("saContent");
  const status = $("saStatus");
  if (!content || !status) return;
  const definition = DNA_RESULTS[resultId];
  const period = $("saPeriod");
  const historyCount = $("saHistoryCount");
  const oddsCount = $("saOddsCount");
  if (period) {
    period.textContent =
      `${dnaFormatDate(dnaAddDays(targetDate, -DNA_CONFIG.HISTORY_DAYS))} - ` +
      `${dnaFormatDate(dnaAddDays(targetDate, -1))}`;
  }
  if (historyCount) historyCount.textContent = analysis.history.length;
  if (oddsCount) oddsCount.textContent = analysis.rows.length;
  status.innerHTML =
    `<strong>${dnaEscape(dnaFormatDate(targetDate))}</strong> · ` +
    `<strong>${dnaEscape(definition.label)}</strong> · ` +
    `${analysis.history.length} geçmiş maç · ` +
    `${analysis.rows.length} uygun oran`;
  if (!analysis.rows.length) {
    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          Önceki ${DNA_CONFIG.HISTORY_DAYS} günde en az
          ${DNA_CONFIG.MIN_SAMPLE} örnek, %${DNA_CONFIG.MIN_SUCCESS}
          başarı ve ${DNA_CONFIG.MIN_ODD.toFixed(2)} minimum oran koşulunu
          sağlayan birebir oran eşleşmesi bulunamadı.
        </span>
      </div>
    `;
    return;
  }
  const marketGroups = new Map();
  for (const row of analysis.rows) {
    if (!marketGroups.has(row.marketId)) {
      marketGroups.set(row.marketId, []);
    }
    marketGroups.get(row.marketId).push(row);
  }
  let html = "";
  for (const market of DNA_MARKETS) {
    const rows = marketGroups.get(market.id);
    if (!rows?.length) continue;
    html += `
      <section class="sa-market">
        <div class="sa-market-title">
          <span>${dnaEscape(market.label)}</span>
          <span class="sa-market-count">${rows.length} oran</span>
        </div>
        <div class="sa-row sa-head">
          <div>ORAN</div>
          <div>ÖRNEK</div>
          <div>KAZANAN</div>
          <div>BAŞARI</div>
          <div>MAÇ</div>
        </div>
    `;
    rows.forEach((row, index) => {
      const rowId = `dna-${market.id}-${index}`;
      html += `
        <div class="sa-row" data-row-id="${dnaEscape(rowId)}">
          <div class="sa-odd">${dnaEscape(row.odd)}</div>
          <div class="sa-value sa-sample">${row.total}</div>
          <div class="sa-value sa-success">${row.success}</div>
          <div class="sa-rate">${row.rate.toFixed(1).replace(".0", "")}%</div>
          <div class="sa-expand">▶ ${row.future.length} maç</div>
        </div>
        <div id="${dnaEscape(rowId)}" class="sa-details">
          ${dnaRenderMatches(row)}
        </div>
      `;
    });
    html += "</section>";
  }
  content.innerHTML = html;
  content.querySelectorAll(".sa-row[data-row-id]").forEach(row => {
    row.addEventListener("click", () => {
      const details = $(row.dataset.rowId);
      if (!details) return;
      const wasOpen = details.classList.contains("open");
      content.querySelectorAll(".sa-details.open")
        .forEach(item => item.classList.remove("open"));
      content.querySelectorAll(".sa-row.active")
        .forEach(item => item.classList.remove("active"));
      if (!wasOpen) {
        details.classList.add("open");
        row.classList.add("active");
      }
    });
  });
}
/* =========================================================
   ANALİZİ ÇALIŞTIR
   ========================================================= */
async function dnaExecuteAnalysis() {
  const resultSelect = $("saResult");
  const dateInput = $("saDate");
  const status = $("saStatus");
  if (!resultSelect || !dateInput || !status) return;
  const resultId = resultSelect.value;
  const targetDate = dateInput.value;
  if (!targetDate) {
    status.textContent = "Lütfen analiz tarihi seçin.";
    return;
  }
  if (!DNA_RESULTS[resultId]) {
    status.textContent =
      `Sonuç seçeneği tanımlı değil: ${resultId}. DNA_RESULTS anahtarlarını kontrol edin.`;
    return;
  }
  if (!dnaMatches.length) {
    status.textContent = "Maç verileri henüz yüklenmedi.";
    return;
  }
  status.textContent = `${dnaFormatDate(targetDate)} analiz ediliyor...`;
  try {
    const analysis = dnaRunAnalysis(targetDate, resultId);
    dnaAnalysisRows = analysis.rows;
    dnaRenderAnalysis(resultId, targetDate, analysis);
  } catch (error) {
    console.error("DNA analiz hatası:", error);
    status.textContent = `Analiz hatası: ${error.message}`;
  }
}
/* =========================================================
   BAŞLAT
   ========================================================= */
async function dnaInit() {
  const dateInput = $("saDate");
  const runButton = $("saRun");
  const status = $("saStatus");
  if (!dateInput || !runButton || !status) {
    console.error("DNA: saDate, saRun veya saStatus HTML elemanı bulunamadı.");
    return;
  }
  dateInput.value = dateInput.value || dnaTodayKey();
  runButton.addEventListener("click", dnaExecuteAnalysis);
  try {
    status.textContent = "Maç verileri yükleniyor...";
    dnaMatches = await dnaLoadData();
    if (!dnaMatches.length) {
      status.textContent = "matches.json içinde maç bulunamadı.";
      return;
    }
    status.textContent = `${dnaMatches.length} maç yüklendi. Analiz hazırlanıyor...`;
    await dnaExecuteAnalysis();
  } catch (error) {
    console.error("DNA veri yükleme hatası:", error);
    status.textContent =
      `Veriler yüklenemedi: ${error.message}. data/matches.json yolunu kontrol edin.`;
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", dnaInit, { once: true });
} else {
  dnaInit();
}
