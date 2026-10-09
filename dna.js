"use strict";
/* =========================================================
   SONUÇTAN ORAN ANALİZİ
   Veri kaynağı: ./data/matches.json
   - Son 30 günlük geçmiş
   - Birebir açılış oranı eşleştirmesi
   - Oran toleransı ve kombinasyonu yok
   - Minimum örnek: 8
   - Minimum başarı: %80
   - Oynanmamış maçı olmayan oran grupları gösterilmez
   ========================================================= */
const DATA_URL = "./data/matches.json";
const HISTORY_DAYS = 30;
const MIN_SAMPLE = 8;
const MIN_SUCCESS = 80;
/* =========================================================
   MARKETLER
   Oranlar matches.json içindeki openingOdds alanından okunur.
   ========================================================= */
const MARKETS = [
  {
    id: "iy15Alt",
    label: "İY 1.5 Alt",
    fields: ["iy15Alt"]
  },
  {
    id: "iy15Ust",
    label: "İY 1.5 Üst",
    fields: ["iy15Ust"]
  },
  {
    id: "iy1",
    label: "İY1",
    fields: ["iy1"]
  },
  {
    id: "iyX",
    label: "İYX",
    fields: ["iyX"]
  },
  {
    id: "iy2",
    label: "İY2",
    fields: ["iy2"]
  },
  {
    id: "kgVar",
    label: "KG Var",
    fields: ["kgVar"]
  },
  {
    id: "kgYok",
    label: "KG Yok",
    fields: ["kgYok"]
  },
  {
    id: "iyKgVar",
    label: "İY KG Var",
    fields: ["iyKGVar", "iyKgVar", "iykgVar"]
  },
  {
    id: "iyKgYok",
    label: "İY KG Yok",
    fields: ["iyKGYok", "iyKgYok", "iykgyok"]
  },
  {
    id: "ms15Alt",
    label: "1.5 Alt",
    fields: ["au15Alt"]
  },
  {
    id: "ms15Ust",
    label: "1.5 Üst",
    fields: ["au15Ust"]
  },
  {
    id: "ms25Ust",
    label: "2.5 Üst",
    fields: ["au25Ust"]
  },
  {
    id: "ms1",
    label: "MS1",
    fields: ["ms1"]
  },
  {
    id: "msX",
    label: "MSX",
    fields: ["msX"]
  },
  {
    id: "ms2",
    label: "MS2",
    fields: ["ms2"]
  }
];
/* =========================================================
   SONUÇ TANIMLARI
   ========================================================= */
const RESULTS = {
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
  IY_KG_VAR: {
    label: "İY KG Var",
    type: "ht",
    test: s => s.home > 0 && s.away > 0
  },
  IY_KG_YOK: {
    label: "İY KG Yok",
    type: "ht",
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
  "25_UST": {
    label: "2.5 Üst",
    type: "ft",
    test: s => s.home + s.away >= 3
  }
};
/* =========================================================
   YARDIMCI FONKSİYONLAR
   ========================================================= */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function normalizeOdd(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(
    String(value).trim().replace(",", ".")
  );
  return Number.isFinite(number) && number > 0
    ? number.toFixed(2)
    : null;
}
/* =========================================================
   TARİH İŞLEMLERİ
   matches.json: 29.05.2026
   ========================================================= */
function parseDateKey(value) {
  if (!value) return null;
  const text = String(value).trim();
  let match = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );
  if (match) {
    return [
      match[3],
      match[2].padStart(2, "0"),
      match[1].padStart(2, "0")
    ].join("-");
  }
  match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );
  if (match) {
    return [
      match[1],
      match[2].padStart(2, "0"),
      match[3].padStart(2, "0")
    ].join("-");
  }
  return null;
}
function getDateKey(match) {
  const candidates = [
    match?.date,
    match?.matchDate,
    match?.gameDate,
    match?.tarih,
    match?.datetime,
    match?.dateTime
  ];
  for (const value of candidates) {
    const date = parseDateKey(value);
    if (date) return date;
  }
  return null;
}
function dateToNumber(dateKey) {
  const parts = String(dateKey).split("-").map(Number);
  if (parts.length !== 3) return NaN;
  return Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}
function addDays(dateKey, days) {
  const date = new Date(dateToNumber(dateKey));
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}
function formatDate(dateKey) {
  if (!dateKey) return "-";
  const parts = dateKey.split("-");
  return parts.length === 3
    ? `${parts[2]}.${parts[1]}.${parts[0]}`
    : dateKey;
}
/* =========================================================
   MAÇ BİLGİLERİ
   ========================================================= */
function getTeamName(match, side) {
  if (side === "home") {
    return match?.home ?? match?.homeTeam ??
      match?.homeName ?? "-";
  }
  return match?.away ?? match?.awayTeam ??
    match?.awayName ?? "-";
}
function getLeague(match) {
  return match?.league ??
    match?.leagueName ??
    match?.competition ??
    "-";
}
function getTime(match) {
  const candidates = [
    match?.time,
    match?.matchTime,
    match?.startTime,
    match?.hour
  ];
  for (const value of candidates) {
    if (!value) continue;
    const matchTime = String(value)
      .trim()
      .match(/(\d{1,2}):(\d{2})/);
    if (matchTime) {
      return `${matchTime[1].padStart(2, "0")}:${matchTime[2]}`;
    }
  }
  return "--:--";
}
/* =========================================================
   SKOR İŞLEMLERİ
   matches.json:
   score: { home: "2", away: "0" }
   halfTimeScore: { home: "0", away: "0" }
   ========================================================= */
function parseScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  // JSON içindeki skor nesnesi.
  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const homeValue = value.home ?? value.homeScore;
    const awayValue = value.away ?? value.awayScore;
    if (
      homeValue === null ||
      homeValue === undefined ||
      awayValue === null ||
      awayValue === undefined ||
      String(homeValue).trim() === "" ||
      String(awayValue).trim() === ""
    ) {
      return null;
    }
    const home = Number(homeValue);
    const away = Number(awayValue);
    if (
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0
    ) {
      return null;
    }
    return { home, away };
  }
  // Alternatif "2-0" veya "2:0" biçimleri.
  const match = String(value)
    .trim()
    .match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!match) return null;
  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}
function getScore(match, type) {
  const candidates = type === "ht"
    ? [
        match?.halfTimeScore,
        match?.halftimeScore,
        match?.htScore,
        match?.iyScore,
        match?.firstHalfScore,
        match?.ilkYari,
        match?.ilkYariSkor,
        match?.devre
      ]
    : [
        match?.score,
        match?.ftScore,
        match?.fullTimeScore,
        match?.result,
        match?.macSonucu,
        match?.finalScore
      ];
  for (const value of candidates) {
    const score = parseScore(value);
    if (score) return score;
  }
  return null;
}
function isPlayed(match) {
  return getScore(match, "ft") !== null;
}
/* =========================================================
   AÇILIŞ ORANLARI
   Öncelikli kaynak: openingOdds
   ========================================================= */
function getOddsContainer(match) {
  const containers = [
    match?.openingOdds,
    match?.openOdds,
    match?.odds,
    match?.opening,
    match?.oranlar,
    match?.opening_prices
  ];
  for (const container of containers) {
    if (
      container &&
      typeof container === "object" &&
      !Array.isArray(container)
    ) {
      return container;
    }
  }
  return null;
}
function getOdds(match, market) {
  const container = getOddsContainer(match);
  if (!container) return null;
  for (const field of market.fields) {
    if (
      !Object.prototype.hasOwnProperty.call(
        container,
        field
      )
    ) {
      continue;
    }
    const odd = normalizeOdd(container[field]);
    if (odd !== null) return odd;
  }
  return null;
}
/* =========================================================
   SONUÇ KONTROLÜ
   ========================================================= */
function getTargetResult(match, resultId) {
  const definition = RESULTS[resultId];
  if (!definition) return null;
  const score = getScore(match, definition.type);
  if (!score) return null;
  return definition.test(score);
}
/* =========================================================
   VERİ YÜKLEME
   ========================================================= */
let allMatches = [];
async function loadData() {
  const response = await fetch(
    `${DATA_URL}?t=${Date.now()}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(
      `Veri alınamadı: ${response.status}`
    );
  }
  const json = await response.json();
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.matches)) {
    return json.matches;
  }
  if (json && Array.isArray(json.data)) {
    return json.data;
  }
  throw new Error(
    "matches.json içinde maç listesi bulunamadı."
  );
}
/* =========================================================
   SEÇİLEN TARİHTEKİ OYNANMAMIŞ MAÇLAR
   ========================================================= */
function buildFutureIndex(matches, targetDate) {
  const index = new Map();
  for (const match of matches) {
    if (getDateKey(match) !== targetDate) continue;
    if (isPlayed(match)) continue;
    for (const market of MARKETS) {
      const odd = getOdds(match, market);
      if (!odd) continue;
      const key = `${market.id}|${odd}`;
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(match);
    }
  }
  return index;
}
/* =========================================================
   ANALİZ
   ========================================================= */
function runAnalysis(targetDate, resultId) {
  const startDate = addDays(
    targetDate,
    -HISTORY_DAYS
  );
  const history = allMatches.filter(match => {
    const date = getDateKey(match);
    return Boolean(
      date &&
      date >= startDate &&
      date < targetDate &&
      isPlayed(match)
    );
  });
  const futureIndex = buildFutureIndex(
    allMatches,
    targetDate
  );
  const groups = new Map();
  for (const match of history) {
    const result = getTargetResult(match, resultId);
    if (result === null) continue;
    for (const market of MARKETS) {
      const odd = getOdds(match, market);
      if (!odd) continue;
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
      if (result) {
        group.success++;
      }
    }
  }
  const rows = Array.from(groups.values())
    .filter(item => {
      if (item.total < MIN_SAMPLE) return false;
      if (item.success <= 0) return false;
      const rate =
        (item.success / item.total) * 100;
      if (rate < MIN_SUCCESS) return false;
      const futureKey =
        `${item.marketId}|${item.odd}`;
      const futureMatches =
        futureIndex.get(futureKey) || [];
      return futureMatches.length > 0;
    });
  for (const row of rows) {
    row.rate =
      (row.success / row.total) * 100;
    row.future =
      futureIndex.get(
        `${row.marketId}|${row.odd}`
      ) || [];
  }
  rows.sort((a, b) =>
    b.rate - a.rate ||
    b.total - a.total ||
    b.success - a.success ||
    Number(a.odd) - Number(b.odd)
  );
  return { history, rows };
}
/* =========================================================
   GÖRÜNÜM
   ========================================================= */
function formatPercent(value) {
  return `${Number(value).toFixed(1).replace(".0", "")}%`;
}
function renderAnalysis(resultId, targetDate, analysis) {
  const content =
    document.getElementById("saContent");
  const status =
    document.getElementById("saStatus");
  const period =
    document.getElementById("saPeriod");
  const historyCount =
    document.getElementById("saHistoryCount");
  const oddsCount =
    document.getElementById("saOddsCount");
  const result = RESULTS[resultId];
  period.textContent =
    `${formatDate(addDays(targetDate, -HISTORY_DAYS))} - ` +
    `${formatDate(addDays(targetDate, -1))}`;
  historyCount.textContent =
    analysis.history.length;
  oddsCount.textContent =
    analysis.rows.length;
  status.innerHTML =
    `<strong>${escapeHtml(result.label)}</strong> için ` +
    `<strong>${analysis.rows.length}</strong> uygun oran bulundu. ` +
    `Minimum örnek: <strong>${MIN_SAMPLE}</strong> · ` +
    `Minimum başarı: <strong>%${MIN_SUCCESS}</strong>`;
  if (!analysis.rows.length) {
    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          Son ${HISTORY_DAYS} günlük geçmişte en az ${MIN_SAMPLE}
          örneği ve %${MIN_SUCCESS} başarı oranı olan,
          seçilen tarihte oynanmamış maçı bulunan birebir açılış oranı yok.
        </span>
      </div>
    `;
    return;
  }
  const marketMap = new Map();
  for (const row of analysis.rows) {
    if (!marketMap.has(row.marketId)) {
      marketMap.set(row.marketId, {
        label: row.marketLabel,
        rows: []
      });
    }
    marketMap.get(row.marketId).rows.push(row);
  }
  let html = "";
  for (const market of MARKETS) {
    const group = marketMap.get(market.id);
    if (!group) continue;
    html += `
      <section class="sa-market">
        <div class="sa-market-title">
          <span>${escapeHtml(group.label)}</span>
          <span class="sa-market-count">${group.rows.length} oran</span>
        </div>
        <div class="sa-row sa-head">
          <div>ORAN</div>
          <div>ÖRNEK</div>
          <div>${escapeHtml(result.label)}</div>
          <div>BAŞARI</div>
          <div>GELECEK</div>
        </div>
    `;
    group.rows.forEach((row, index) => {
      const rowId =
        `sa-${market.id}-${index}`
          .replace(/[^a-zA-Z0-9_-]/g, "");
      const futureCount = row.future.length;
      html += `
        <div class="sa-row" data-row-id="${rowId}">
          <div class="sa-odd">${escapeHtml(row.odd)}</div>
          <div class="sa-value sa-sample">${row.total}</div>
          <div class="sa-value sa-success">${row.success}</div>
          <div class="sa-rate">${formatPercent(row.rate)}</div>
          <div class="sa-expand">▶ ${futureCount} maç</div>
        </div>
        <div id="${rowId}" class="sa-details">
          ${renderFutureMatches(row)}
        </div>
      `;
    });
    html += `</section>`;
  }
  content.innerHTML = html;
  bindRows();
}
/* =========================================================
   OYNANMAMIŞ MAÇ DETAYLARI
   ========================================================= */
function renderFutureMatches(row) {
  if (!row.future.length) return "";
  let html = `
    <div class="sa-details-title">
      <span>
        ${escapeHtml(row.marketLabel)} · ${escapeHtml(row.odd)}
      </span>
      <strong>${formatPercent(row.rate)}</strong>
    </div>
    <div class="sa-details-subtitle">
      Aynı açılış oranına sahip oynanmamış maçlar
    </div>
  `;
  for (const match of row.future) {
    html += `
      <div class="sa-match">
        <div class="sa-match-time">
          ${escapeHtml(getTime(match))}
        </div>
        <div class="sa-match-main">
          <div class="sa-match-teams">
            ${escapeHtml(getTeamName(match, "home"))}
            <span>vs</span>
            ${escapeHtml(getTeamName(match, "away"))}
          </div>
          <div class="sa-match-meta">
            ${escapeHtml(getLeague(match))}
          </div>
        </div>
        <div class="sa-match-odd">
          ${escapeHtml(row.marketLabel)}
          <strong>${escapeHtml(row.odd)}</strong>
        </div>
      </div>
    `;
  }
  return html;
}
/* =========================================================
   SATIR AÇMA / KAPATMA
   ========================================================= */
function bindRows() {
  document
    .querySelectorAll("#saContent .sa-row[data-row-id]")
    .forEach(row => {
      row.addEventListener("click", () => {
        const details =
          document.getElementById(row.dataset.rowId);
        if (!details) return;
        const wasOpen =
          details.classList.contains("open");
        document
          .querySelectorAll("#saContent .sa-details.open")
          .forEach(item => {
            item.classList.remove("open");
          });
        document
          .querySelectorAll("#saContent .sa-row.active")
          .forEach(item => {
            item.classList.remove("active");
          });
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
async function executeAnalysis() {
  const resultSelect =
    document.getElementById("saResult");
  const dateInput =
    document.getElementById("saDate");
  const status =
    document.getElementById("saStatus");
  const resultId = resultSelect.value;
  const targetDate = dateInput.value;
  if (!targetDate) {
    status.textContent =
      "Lütfen analiz tarihi seçin.";
    return;
  }
  if (!RESULTS[resultId]) {
    status.textContent =
      "Geçersiz sonuç seçildi.";
    return;
  }
  status.innerHTML =
    `⏳ Son ${HISTORY_DAYS} günlük geçmiş analiz ediliyor...`;
  try {
    const analysis =
      runAnalysis(targetDate, resultId);
    renderAnalysis(
      resultId,
      targetDate,
      analysis
    );
  } catch (error) {
    console.error(error);
    status.textContent =
      "Analiz sırasında hata oluştu.";
    document.getElementById("saContent").innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Analiz yapılamadı</strong>
        <span>Veri yapısını kontrol edin.</span>
      </div>
    `;
  }
}
/* =========================================================
   BAŞLANGIÇ
   ========================================================= */
async function init() {
  const dateInput =
    document.getElementById("saDate");
  const runButton =
    document.getElementById("saRun");
  const status =
    document.getElementById("saStatus");
  if (!dateInput || !runButton || !status) {
    console.error(
      "Sonuçtan oran analizi için gerekli HTML elemanları bulunamadı."
    );
    return;
  }
  dateInput.value = todayKey();
  runButton.addEventListener(
    "click",
    executeAnalysis
  );
  try {
    status.textContent =
      "Veriler yükleniyor...";
    allMatches = await loadData();
    status.innerHTML =
      `<strong>${allMatches.length}</strong> maç verisi yüklendi. ` +
      `Analiz hazırlanıyor...`;
    await executeAnalysis();
  } catch (error) {
    console.error(error);
    status.textContent =
      "Veriler yüklenemedi.";
    document.getElementById("saContent").innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Veriler yüklenemedi</strong>
        <span>
          data/matches.json dosyasını ve JSON içindeki matches alanını kontrol edin.
        </span>
      </div>
    `;
  }
}
init();
