"use strict";

/* =========================================================
   SONUÇTAN ORAN ANALİZİ

   - Seçilen tarihten önceki 30 günlük geçmiş
   - Birebir açılış oranı eşleştirmesi
   - Oran toleransı ve kombinasyonu yok
   - Minimum örnek: 8
   - Minimum başarı: %80
   - Seçilen tarihteki maçlar oynanmış olsa da gösterilir
   - Oynanmış maçlar sonuç durumuyla gösterilir
   ========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 30;
const MIN_SAMPLE = 8;
const MIN_SUCCESS = 80;

/* =========================================================
   MARKETLER
   ========================================================= */

const MARKETS = [
  { id: "iy15Alt", label: "İY 1.5 Alt", fields: ["iy15Alt", "iy15A", "iy_15_alt", "IY15Alt"] },
  { id: "iy15Ust", label: "İY 1.5 Üst", fields: ["iy15Ust", "iy15U", "iy_15_ust", "IY15Ust"] },
  { id: "iy1", label: "İY1", fields: ["iy1", "IY1"] },
  { id: "iyX", label: "İYX", fields: ["iyX", "iyx", "IYX"] },
  { id: "iy2", label: "İY2", fields: ["iy2", "IY2"] },
  { id: "kgVar", label: "KG Var", fields: ["kgVar", "kgvar", "KGVar"] },
  { id: "kgYok", label: "KG Yok", fields: ["kgYok", "kgyok", "KGYok"] },
  { id: "iyKgVar", label: "İY KG Var", fields: ["iyKgVar", "iyKGVar", "iykgVar", "IYKGVar"] },
  { id: "iyKgYok", label: "İY KG Yok", fields: ["iyKgYok", "iyKGYok", "iykgYok", "IYKGYok"] },
  { id: "ms15Alt", label: "1.5 Alt", fields: ["au15Alt", "ms15Alt", "1.5Alt"] },
  { id: "ms15Ust", label: "1.5 Üst", fields: ["au15Ust", "ms15Ust", "1.5Ust"] },
  { id: "ms25Ust", label: "2.5 Üst", fields: ["au25Ust", "ms25Ust", "2.5Ust"] },
  { id: "ms1", label: "MS1", fields: ["ms1", "MS1"] },
  { id: "msX", label: "MSX", fields: ["msX", "msx", "MSX"] },
  { id: "ms2", label: "MS2", fields: ["ms2", "MS2"] }
];

/* =========================================================
   SONUÇ TANIMLARI
   ========================================================= */

const RESULTS = {
  MS1: { label: "MS1", type: "ft", test: s => s.home > s.away },
  MSX: { label: "MSX", type: "ft", test: s => s.home === s.away },
  MS2: { label: "MS2", type: "ft", test: s => s.away > s.home },

  IY1: { label: "İY1", type: "ht", test: s => s.home > s.away },
  IYX: { label: "İYX", type: "ht", test: s => s.home === s.away },
  IY2: { label: "İY2", type: "ht", test: s => s.away > s.home },

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

  const number = Number(String(value).trim().replace(",", "."));

  return Number.isFinite(number) && number > 0
    ? number.toFixed(2)
    : null;
}

function parseDateKey(value) {
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

  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
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

function getTeamName(match, side) {
  if (side === "home") {
    return match?.homeTeam ?? match?.home ?? match?.homeName ??
      match?.ev ?? match?.evSahibi ?? "-";
  }

  return match?.awayTeam ?? match?.away ?? match?.awayName ??
    match?.dep ?? match?.deplasman ?? "-";
}

function getLeague(match) {
  return match?.league ?? match?.leagueName ??
    match?.lig ?? match?.competition ?? "-";
}

function getTime(match) {
  const candidates = [
    match?.time,
    match?.matchTime,
    match?.startTime,
    match?.hour,
    match?.saat
  ];

  for (const value of candidates) {
    if (!value) continue;

    const matchTime = String(value).trim().match(/(\d{1,2}):(\d{2})/);

    if (matchTime) {
      return `${matchTime[1].padStart(2, "0")}:${matchTime[2]}`;
    }
  }

  return "--:--";
}

/* =========================================================
   SKOR İŞLEMLERİ
   ========================================================= */

function parseScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const match = String(value).trim().match(/(\d+)\s*[-:]\s*(\d+)/);

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
    if (container && typeof container === "object") {
      return container;
    }
  }

  return null;
}

function getOdds(match, market) {
  const containers = [match, getOddsContainer(match)];

  for (const container of containers) {
    if (!container) continue;

    for (const field of market.fields) {
      if (!Object.prototype.hasOwnProperty.call(container, field)) continue;

      const odd = normalizeOdd(container[field]);
      if (odd !== null) return odd;
    }
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
  if (score === null) return null;

  return definition.test(score);
}

/* =========================================================
   VERİ YÜKLEME
   ========================================================= */

let allMatches = [];

async function loadData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Veri alınamadı: ${response.status}`);
  }

  const json = await response.json();

  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.matches)) return json.matches;

  return [];
}

/* =========================================================
   SEÇİLEN TARİHTEKİ TÜM MAÇLARI ORANLA EŞLEŞTİR
   Geçmiş tarih seçildiğinde oynanmış maçlar da dahil edilir.
   ========================================================= */

function buildTargetIndex(matches, targetDate) {
  const index = new Map();

  for (const match of matches) {
    if (getDateKey(match) !== targetDate) continue;

    for (const market of MARKETS) {
      const odd = getOdds(match, market);
      if (odd === null) continue;

      const key = `${market.id}|${odd}`;

      if (!index.has(key)) index.set(key, []);
      index.get(key).push(match);
    }
  }

  return index;
}

/* =========================================================
   ANALİZ
   ========================================================= */

function runAnalysis(targetDate, resultId) {
  const startDate = addDays(targetDate, -HISTORY_DAYS);

  // Seçilen tarihten önceki 30 gün içindeki sonuçlanmış maçlar.
  const history = allMatches.filter(match => {
    const date = getDateKey(match);

    return Boolean(
      date &&
      date >= startDate &&
      date < targetDate &&
      isPlayed(match)
    );
  });

  // Hedef tarihte oynanmış veya oynanmamış bütün maçlar.
  const targetIndex = buildTargetIndex(allMatches, targetDate);
  const groups = new Map();

  for (const match of history) {
    const result = getTargetResult(match, resultId);
    if (result === null) continue;

    for (const market of MARKETS) {
      const odd = getOdds(match, market);
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

      if (result) group.success++;
    }
  }

  const rows = Array.from(groups.values())
    .filter(item => {
      if (item.total < MIN_SAMPLE) return false;

      const rate = (item.success / item.total) * 100;
      if (rate < MIN_SUCCESS) return false;

      // Seçilen tarihte aynı market ve birebir aynı oran bulunmalı.
      return (targetIndex.get(`${item.marketId}|${item.odd}`) || []).length > 0;
    });

  for (const row of rows) {
    row.rate = (row.success / row.total) * 100;
    row.future = targetIndex.get(`${row.marketId}|${row.odd}`) || [];
  }

  rows.sort((a, b) =>
    b.rate - a.rate ||
    b.total - a.total ||
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

function getMatchStatus(match, resultId) {
  const definition = RESULTS[resultId];
  const score = getScore(match, definition.type);

  if (score === null) {
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

function renderAnalysis(resultId, targetDate, analysis) {
  const content = document.getElementById("saContent");
  const status = document.getElementById("saStatus");
  const period = document.getElementById("saPeriod");
  const historyCount = document.getElementById("saHistoryCount");
  const oddsCount = document.getElementById("saOddsCount");

  const result = RESULTS[resultId];

  period.textContent =
    `${formatDate(addDays(targetDate, -HISTORY_DAYS))} - ${formatDate(addDays(targetDate, -1))}`;

  historyCount.textContent = analysis.history.length;
  oddsCount.textContent = analysis.rows.length;

  status.innerHTML =
    `<strong>${escapeHtml(formatDate(targetDate))}</strong> · ` +
    `<strong>${escapeHtml(result.label)}</strong> için ` +
    `<strong>${analysis.rows.length}</strong> uygun oran bulundu. ` +
    `Geçmiş maç: <strong>${analysis.history.length}</strong> · ` +
    `Minimum örnek: <strong>${MIN_SAMPLE}</strong> · ` +
    `Minimum başarı: <strong>%${MIN_SUCCESS}</strong>`;

  if (!analysis.rows.length) {
    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          ${escapeHtml(formatDate(targetDate))} tarihindeki maçlarla birebir
          eşleşen; önceki ${HISTORY_DAYS} günde en az ${MIN_SAMPLE} örneği
          ve en az %${MIN_SUCCESS} başarı oranı bulunan bir oran grubu yok.
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
          <div>MAÇ</div>
        </div>
    `;

    group.rows.forEach((row, index) => {
      const rowId = `sa-${market.id}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "");

      html += `
        <div class="sa-row" data-row-id="${rowId}">
          <div class="sa-odd">${escapeHtml(row.odd)}</div>
          <div class="sa-value sa-sample">${row.total}</div>
          <div class="sa-value sa-success">${row.success}</div>
          <div class="sa-rate">${formatPercent(row.rate)}</div>
          <div class="sa-expand">▶ ${row.future.length} maç</div>
        </div>

        <div id="${rowId}" class="sa-details">
          ${renderTargetMatches(row, resultId)}
        </div>
      `;
    });

    html += `</section>`;
  }

  content.innerHTML = html;
  bindRows();
}

/* =========================================================
   SEÇİLEN TARİHTEKİ MAÇ DETAYLARI
   ========================================================= */

function renderTargetMatches(row, resultId) {
  if (!row.future.length) return "";

  let html = `
    <div class="sa-details-title">
      <span>${escapeHtml(row.marketLabel)} · ${escapeHtml(row.odd)}</span>
      <strong>${formatPercent(row.rate)}</strong>
    </div>

    <div class="sa-details-subtitle">
      ${escapeHtml(formatDate(getDateKey(row.future[0])))} ·
      Aynı market ve birebir aynı açılış oranına sahip maçlar
    </div>
  `;

  for (const match of row.future) {
    const matchStatus = getMatchStatus(match, resultId);

    html += `
      <div class="sa-match">
        <div class="sa-match-time">${escapeHtml(getTime(match))}</div>

        <div class="sa-match-main">
          <div class="sa-match-teams">
            ${escapeHtml(getTeamName(match, "home"))}
            <span>vs</span>
            ${escapeHtml(getTeamName(match, "away"))}
          </div>
          <div class="sa-match-meta">
            ${escapeHtml(getLeague(match))}
            · Skor: ${escapeHtml(matchStatus.score)}
          </div>
        </div>

        <div class="sa-match-odd">
          ${escapeHtml(row.marketLabel)}
          <strong>${escapeHtml(row.odd)}</strong>
          <span class="${matchStatus.className}">
            ${escapeHtml(matchStatus.text)}
          </span>
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
  document.querySelectorAll("#saContent .sa-row[data-row-id]")
    .forEach(row => {
      row.addEventListener("click", () => {
        const details = document.getElementById(row.dataset.rowId);
        if (!details) return;

        const wasOpen = details.classList.contains("open");

        document.querySelectorAll("#saContent .sa-details.open")
          .forEach(item => item.classList.remove("open"));

        document.querySelectorAll("#saContent .sa-row.active")
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

async function executeAnalysis() {
  const resultSelect = document.getElementById("saResult");
  const dateInput = document.getElementById("saDate");
  const status = document.getElementById("saStatus");

  if (!resultSelect || !dateInput || !status) return;

  const resultId = resultSelect.value;
  const targetDate = dateInput.value;

  if (!targetDate) {
    status.textContent = "Lütfen analiz tarihi seçin.";
    return;
  }

  if (!RESULTS[resultId]) {
    status.textContent = "Geçersiz sonuç seçildi.";
    return;
  }

  status.innerHTML = `⏳ ${escapeHtml(formatDate(targetDate))} tarihi analiz ediliyor...`;

  try {
    const analysis = runAnalysis(targetDate, resultId);
    renderAnalysis(resultId, targetDate, analysis);
  } catch (error) {
    console.error(error);
    status.textContent = "Analiz sırasında hata oluştu.";

    document.getElementById("saContent").innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Analiz yapılamadı</strong>
        <span>Veri yapısını ve tarayıcı konsolunu kontrol edin.</span>
      </div>
    `;
  }
}

/* =========================================================
   BAŞLANGIÇ
   ========================================================= */

async function init() {
  const dateInput = document.getElementById("saDate");
  const runButton = document.getElementById("saRun");
  const status = document.getElementById("saStatus");

  if (!dateInput || !runButton || !status) {
    console.error("Sonuçtan oran analizi için gerekli HTML elemanları bulunamadı.");
    return;
  }

  dateInput.value = todayKey();

  runButton.addEventListener("click", executeAnalysis);

  try {
    status.textContent = "Veriler yükleniyor...";
    allMatches = await loadData();

    status.innerHTML =
      `<strong>${allMatches.length}</strong> maç verisi yüklendi. Analiz hazırlanıyor...`;

    await executeAnalysis();
  } catch (error) {
    console.error(error);
    status.textContent = "Veriler yüklenemedi.";

    document.getElementById("saContent").innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Veriler yüklenemedi</strong>
        <span>data/v2-data.json dosyasını kontrol edin.</span>
      </div>
    `;
  }
}

init();
