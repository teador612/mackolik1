"use strict";

/* =========================================================
   SONUÇTAN ORAN ANALİZİ
   - Son 30 günlük geçmiş
   - Minimum 8 örnek
   - Minimum %80 başarı
   - Her market kendi sonucuna göre değerlendirilir
   - Birebir açılış oranı eşleştirmesi
   - Oran toleransı ve kombinasyonu yok
   - Seçilen tarihteki oynanmamış maçları gösterir
   - Veri kaynağı: ./data/matches.json
   ========================================================= */

const DATA_URL = "./data/matches.json";
const HISTORY_DAYS = 30;
const MIN_SAMPLE = 8;
const MIN_SUCCESS = 80;

/* =========================================================
   MARKETLER
   ========================================================= */

const MARKETS = [
  {
    id: "iy15Alt",
    label: "İY 1.5 Alt",
    fields: ["iy15Alt"],
    resultId: "IY15_ALT"
  },
  {
    id: "iy15Ust",
    label: "İY 1.5 Üst",
    fields: ["iy15Ust"],
    resultId: "IY15_UST"
  },
  {
    id: "iy1",
    label: "İY1",
    fields: ["iy1"],
    resultId: "IY1"
  },
  {
    id: "iyX",
    label: "İYX",
    fields: ["iyX"],
    resultId: "IYX"
  },
  {
    id: "iy2",
    label: "İY2",
    fields: ["iy2"],
    resultId: "IY2"
  },
  {
    id: "kgVar",
    label: "KG Var",
    fields: ["kgVar"],
    resultId: "KG_VAR"
  },
  {
    id: "kgYok",
    label: "KG Yok",
    fields: ["kgYok"],
    resultId: "KG_YOK"
  },
  {
    id: "iyKgVar",
    label: "İY KG Var",
    fields: ["iyKGVar", "iyKgVar", "iykgVar"],
    resultId: "IY_KG_VAR"
  },
  {
    id: "iyKgYok",
    label: "İY KG Yok",
    fields: ["iyKGYok", "iyKgYok", "iykgyok"],
    resultId: "IY_KG_YOK"
  },
  {
    id: "ms15Alt",
    label: "1.5 Alt",
    fields: ["au15Alt"],
    resultId: "15_ALT"
  },
  {
    id: "ms15Ust",
    label: "1.5 Üst",
    fields: ["au15Ust"],
    resultId: "15_UST"
  },
  {
    id: "ms25Ust",
    label: "2.5 Üst",
    fields: ["au25Ust"],
    resultId: "25_UST"
  },
  {
    id: "ms1",
    label: "MS1",
    fields: ["ms1"],
    resultId: "MS1"
  },
  {
    id: "msX",
    label: "MSX",
    fields: ["msX"],
    resultId: "MSX"
  },
  {
    id: "ms2",
    label: "MS2",
    fields: ["ms2"],
    resultId: "MS2"
  }
];

/* =========================================================
   SONUÇ TANIMLARI
   ========================================================= */

const RESULTS = {
  MS1: {
    type: "ft",
    test: score => score.home > score.away
  },
  MSX: {
    type: "ft",
    test: score => score.home === score.away
  },
  MS2: {
    type: "ft",
    test: score => score.away > score.home
  },
  IY1: {
    type: "ht",
    test: score => score.home > score.away
  },
  IYX: {
    type: "ht",
    test: score => score.home === score.away
  },
  IY2: {
    type: "ht",
    test: score => score.away > score.home
  },
  KG_VAR: {
    type: "ft",
    test: score => score.home > 0 && score.away > 0
  },
  KG_YOK: {
    type: "ft",
    test: score => score.home === 0 || score.away === 0
  },
  IY_KG_VAR: {
    type: "ht",
    test: score => score.home > 0 && score.away > 0
  },
  IY_KG_YOK: {
    type: "ht",
    test: score => score.home === 0 || score.away === 0
  },
  IY15_ALT: {
    type: "ht",
    test: score => score.home + score.away <= 1
  },
  IY15_UST: {
    type: "ht",
    test: score => score.home + score.away >= 2
  },
  "15_ALT": {
    type: "ft",
    test: score => score.home + score.away <= 1
  },
  "15_UST": {
    type: "ft",
    test: score => score.home + score.away >= 2
  },
  "25_UST": {
    type: "ft",
    test: score => score.home + score.away >= 3
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
  const [year, month, day] = String(dateKey)
    .split("-")
    .map(Number);

  return Date.UTC(year, month - 1, day);
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
    return match?.home ??
      match?.homeTeam ??
      match?.homeName ??
      "-";
  }

  return match?.away ??
    match?.awayTeam ??
    match?.awayName ??
    "-";
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
   ========================================================= */

function parseScore(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
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
   openingOdds ve alternatif alanları desteklenir.
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

  // Bazı matches.json dosyalarında oranlar doğrudan maç nesnesinde.
  return match && typeof match === "object"
    ? match
    : null;
}

function getOdds(match, market) {
  const container = getOddsContainer(match);
  if (!container) return null;

  for (const field of market.fields) {
    if (
      !Object.prototype.hasOwnProperty.call(container, field)
    ) {
      continue;
    }

    const odd = normalizeOdd(container[field]);
    if (odd !== null) return odd;
  }

  return null;
}

/* =========================================================
   MARKET SONUCUNU DEĞERLENDİR
   ========================================================= */

function getMarketResult(match, market) {
  const definition = RESULTS[market.resultId];
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
    throw new Error(`Veri alınamadı: ${response.status}`);
  }

  const json = await response.json();

  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.matches)) return json.matches;
  if (json && Array.isArray(json.data)) return json.data;

  throw new Error("matches.json içinde maç listesi bulunamadı.");
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
      if (odd === null) continue;

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
   Her market, yalnızca kendi sonucuyla ölçülür.
   ========================================================= */

function runAnalysis(targetDate) {
  const startDate = addDays(targetDate, -HISTORY_DAYS);

  const history = allMatches.filter(match => {
    const date = getDateKey(match);

    return Boolean(
      date &&
      date >= startDate &&
      date < targetDate &&
      isPlayed(match)
    );
  });

  const futureIndex = buildFutureIndex(allMatches, targetDate);
  const groups = new Map();

  for (const match of history) {
    for (const market of MARKETS) {
      const odd = getOdds(match, market);
      if (odd === null) continue;

      const result = getMarketResult(match, market);
      if (result === null) continue;

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

      const rate = (item.success / item.total) * 100;
      if (rate < MIN_SUCCESS) return false;

      const futureKey = `${item.marketId}|${item.odd}`;
      const futureMatches = futureIndex.get(futureKey) || [];

      return futureMatches.length > 0;
    })
    .map(item => {
      const futureKey = `${item.marketId}|${item.odd}`;

      return {
        ...item,
        rate: (item.success / item.total) * 100,
        future: futureIndex.get(futureKey) || []
      };
    });

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

function renderAnalysis(targetDate, analysis) {
  const content = document.getElementById("saContent");
  const status = document.getElementById("saStatus");
  const period = document.getElementById("saPeriod");
  const historyCount = document.getElementById("saHistoryCount");
  const oddsCount = document.getElementById("saOddsCount");

  period.textContent =
    `${formatDate(addDays(targetDate, -HISTORY_DAYS))} - ` +
    `${formatDate(addDays(targetDate, -1))}`;

  historyCount.textContent = analysis.history.length;
  oddsCount.textContent = analysis.rows.length;

  status.innerHTML =
    `<strong>${analysis.rows.length}</strong> uygun oran bulundu. ` +
    `Minimum örnek: <strong>${MIN_SAMPLE}</strong> · ` +
    `Minimum başarı: <strong>%${MIN_SUCCESS}</strong>`;

  if (!analysis.rows.length) {
    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          Son ${HISTORY_DAYS} günde en az ${MIN_SAMPLE} örneği,
          en az %${MIN_SUCCESS} başarısı ve seçilen tarihte
          aynı açılış oranına sahip oynanmamış maçı olan grup bulunamadı.
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
          <div>KAZANAN</div>
          <div>BAŞARI</div>
          <div>MAÇLAR</div>
        </div>
    `;

    group.rows.forEach((row, index) => {
      const rowId = `sa-${market.id}-${index}`
        .replace(/[^a-zA-Z0-9_-]/g, "");

      html += `
        <div class="sa-row" data-row-id="${rowId}">
          <div class="sa-odd">${escapeHtml(row.odd)}</div>
          <div class="sa-value sa-sample">${row.total}</div>
          <div class="sa-value sa-success">${row.success}</div>
          <div class="sa-rate">${formatPercent(row.rate)}</div>
          <div class="sa-expand">▶ ${row.future.length} maç</div>
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
        const details = document.getElementById(row.dataset.rowId);
        if (!details) return;

        const wasOpen = details.classList.contains("open");

        document
          .querySelectorAll("#saContent .sa-details.open")
          .forEach(item => item.classList.remove("open"));

        document
          .querySelectorAll("#saContent .sa-row.active")
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
  const dateInput = document.getElementById("saDate");
  const status = document.getElementById("saStatus");
  const targetDate = dateInput.value;

  if (!targetDate) {
    status.textContent = "Lütfen analiz tarihi seçin.";
    return;
  }

  status.innerHTML =
    `⏳ Son ${HISTORY_DAYS} günlük geçmiş analiz ediliyor...`;

  try {
    const analysis = runAnalysis(targetDate);
    renderAnalysis(targetDate, analysis);
  } catch (error) {
    console.error(error);

    status.textContent = "Analiz sırasında hata oluştu.";

    document.getElementById("saContent").innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Analiz yapılamadı</strong>
        <span>Veri yapısını ve konsol hatalarını kontrol edin.</span>
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
    console.error(
      "Sonuçtan oran analizi için gerekli HTML elemanları bulunamadı."
    );
    return;
  }

  dateInput.value = todayKey();
  runButton.addEventListener("click", executeAnalysis);

  try {
    status.textContent = "Veriler yükleniyor...";

    allMatches = await loadData();

    status.innerHTML =
      `<strong>${allMatches.length}</strong> maç verisi yüklendi. ` +
      `Analiz hazırlanıyor...`;

    await executeAnalysis();
  } catch (error) {
    console.error(error);

    status.textContent = "Veriler yüklenemedi.";

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
