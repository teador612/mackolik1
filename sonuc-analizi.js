
"use strict";

/* =========================================================
   SONUÇTAN ORAN ANALİZİ — OPTİMİZE EDİLMİŞ SÜRÜM

   Veri              : ./data/v2-data.json
   Analiz dönemi     : 10 gün
   Minimum örnek     : Yok
   Minimum başarı    : %80
   Oran eşleştirmesi : Birebir, 2 ondalık
   Başarı hesabı     : Aynı market + aynı oran için son 5 maç

   Optimizasyon:
   - Maç tarihleri ve skorları bir kez hazırlanır.
   - Market/oran geçmişi önceden indekslenir.
   - Her analizde geçmiş maçlar tekrar tekrar sıralanmaz.
   - Aynı geçmiş maç listesi her gelecek maçın altında
     yeniden oluşturulmaz.
   ========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 10;
const MIN_SUCCESS = 80;
const RECENT_MATCH_LIMIT = 5;

const MARKETS = [
  { id: "iy15Alt", label: "İY 1.5 Alt", fields: ["iy15Alt", "iy15A", "iy_15_alt", "IY15Alt"] },
  { id: "iy15Ust", label: "İY 1.5 Üst", fields: ["iy15Ust", "iy15U", "iy_15_ust", "IY15Ust"] },
  { id: "iy1", label: "İY 1", fields: ["iy1", "IY1"] },
  { id: "iyX", label: "İY X", fields: ["iyX", "iyx", "IYX"] },
  { id: "iy2", label: "İY 2", fields: ["iy2", "IY2"] },
  { id: "iyKgVar", label: "İY KG Var", fields: ["iyKgVar", "iyKGVar", "iykgVar", "IYKGVar"] },
  { id: "iyKgYok", label: "İY KG Yok", fields: ["iyKgYok", "iyKGYok", "iykgYok", "IYKGYok"] },

  { id: "ms15Alt", label: "MS 1.5 Alt", fields: ["au15Alt", "ms15Alt", "15_ALT", "ms15alt"] },
  { id: "ms15Ust", label: "MS 1.5 Üst", fields: ["au15Ust", "ms15Ust", "15_UST", "ms15ust"] },
  { id: "ms25Alt", label: "MS 2.5 Alt", fields: ["au25Alt", "ms25Alt", "25_ALT", "ms25alt"] },
  { id: "ms25Ust", label: "MS 2.5 Üst", fields: ["au25Ust", "ms25Ust", "25_UST", "ms25ust"] },
  { id: "ms35Alt", label: "MS 3.5 Alt", fields: ["au35Alt", "ms35Alt", "35_UST", "ms35ust", "35_ALT", "ms35alt"] },

  { id: "kgVar", label: "KG Var", fields: ["kgVar", "kgvar", "KGVar"] },
  { id: "kgYok", label: "KG Yok", fields: ["kgYok", "kgyok", "KGYok"] },

  { id: "ms1", label: "MS 1", fields: ["ms1", "MS1"] },
  { id: "msX", label: "MS X", fields: ["msX", "msx", "MSX", "MS0", "ms0"] },
  { id: "ms2", label: "MS 2", fields: ["ms2", "MS2"] },

  { id: "h12", label: "Çifte Şans 12", fields: ["h12", "H12"] },
  { id: "h0", label: "Çifte Şans 1X", fields: ["h0", "H0"] },
  { id: "h23", label: "Çifte Şans X2", fields: ["h23", "H23"] },

  { id: "i14", label: "İY 1-4 Gol", fields: ["i14", "I14"] },
  { id: "olmaz", label: "İY Gol Olmaz", fields: ["olmaz", "OLMAZ"] },
  { id: "i25", label: "İY 2-5 Gol", fields: ["i25", "I25"] },

  { id: "ms1Alt", label: "MS 1 ve Alt", fields: ["ms1Alt", "MS1Alt", "1VEALT"] },
  { id: "msXAlt", label: "MS X ve Alt", fields: ["msXAlt", "MSXAlt", "XVEALT"] },
  { id: "ms2Alt", label: "MS 2 ve Alt", fields: ["ms2Alt", "MS2Alt", "2VEALT"] },
  { id: "ms1Ust", label: "MS 1 ve Üst", fields: ["ms1Ust", "MS1Ust", "1VEUST"] },
  { id: "msXUst", label: "MS X ve Üst", fields: ["msXUst", "MSXUst", "XVEUST"] },
  { id: "ms2Ust", label: "MS 2 ve Üst", fields: ["ms2Ust", "MS2Ust", "2VEUST"] },

  { id: "gol01", label: "0-1 Gol", fields: ["gol01", "GOL01"] },
  { id: "gol23", label: "2-3 Gol", fields: ["gol23", "GOL23"] },
  { id: "gol45", label: "4-5 Gol", fields: ["gol45", "GOL45"] },
  { id: "gol6plus", label: "6+ Gol", fields: ["gol6plus", "GOL6PLUS", "gol6Plus"] },

  { id: "iyms11", label: "İY/MS 1/1", fields: ["iyms11", "IYMS11"] },
  { id: "iyms10", label: "İY/MS 1/X", fields: ["iyms10", "IYMS10"] },
  { id: "iyms12", label: "İY/MS 1/2", fields: ["iyms12", "IYMS12"] },
  { id: "iyms01", label: "İY/MS X/1", fields: ["iyms01", "IYMS01"] },
  { id: "iyms00", label: "İY/MS X/X", fields: ["iyms00", "IYMS00"] },
  { id: "iyms02", label: "İY/MS X/2", fields: ["iyms02", "IYMS02"] },
  { id: "iyms21", label: "İY/MS 2/1", fields: ["iyms21", "IYMS21"] },
  { id: "iyms20", label: "İY/MS 2/X", fields: ["iyms20", "IYMS20"] },
  { id: "iyms22", label: "İY/MS 2/2", fields: ["iyms22", "IYMS22"] }
];

const MARKET_BY_ID = new Map(MARKETS.map(market => [market.id, market]));

const RESULTS = {
  MS1: { label: "MS 1", type: "ft", test: s => s.home > s.away },
  MSX: { label: "MS X", type: "ft", test: s => s.home === s.away },
  MS2: { label: "MS 2", type: "ft", test: s => s.away > s.home },

  IY1: { label: "İY 1", type: "ht", test: s => s.home > s.away },
  IYX: { label: "İY X", type: "ht", test: s => s.home === s.away },
  IY2: { label: "İY 2", type: "ht", test: s => s.away > s.home },

  KG_VAR: { label: "KG Var", type: "ft", test: s => s.home > 0 && s.away > 0 },
  KG_YOK: { label: "KG Yok", type: "ft", test: s => s.home === 0 || s.away === 0 },

  IY_KG_VAR: { label: "İY KG Var", type: "ht", test: s => s.home > 0 && s.away > 0 },
  IY_KG_YOK: { label: "İY KG Yok", type: "ht", test: s => s.home === 0 || s.away === 0 },

  IY15_ALT: { label: "İY 1.5 Alt", type: "ht", test: s => s.home + s.away <= 1 },
  IY15_UST: { label: "İY 1.5 Üst", type: "ht", test: s => s.home + s.away >= 2 },

  "15_ALT": { label: "MS 1.5 Alt", type: "ft", test: s => s.home + s.away <= 1 },
  "15_UST": { label: "MS 1.5 Üst", type: "ft", test: s => s.home + s.away >= 2 },
  "25_UST": { label: "MS 2.5 Üst", type: "ft", test: s => s.home + s.away >= 3 }
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
  if (value === null || value === undefined || value === "") return null;

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

function addDays(dateKey, days) {
  const parts = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

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
    return match?.homeTeam ??
      match?.home ??
      match?.homeName ??
      match?.ev ??
      match?.evSahibi ??
      "-";
  }

  return match?.awayTeam ??
    match?.away ??
    match?.awayName ??
    match?.dep ??
    match?.deplasman ??
    "-";
}

function getLeague(match) {
  return match?.league ??
    match?.leagueName ??
    match?.lig ??
    match?.competition ??
    "-";
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
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object") {
    const home = value.home ?? value.homeScore ?? value.ev;
    const away = value.away ?? value.awayScore ?? value.dep;

    if (
      home !== undefined &&
      away !== undefined &&
      Number.isFinite(Number(home)) &&
      Number.isFinite(Number(away))
    ) {
      return { home: Number(home), away: Number(away) };
    }

    return null;
  }

  const match = String(value).trim().match(/(\d+)\s*[-:]\s*(\d+)/);

  if (!match) return null;

  return { home: Number(match[1]), away: Number(match[2]) };
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

/* =========================================================
   AÇILIŞ ORANLARI
   ========================================================= */

function getOddsContainers(match) {
  if (!match || typeof match !== "object") return [];

  return [
    match,
    match?.openingOdds,
    match?.openOdds,
    match?.odds,
    match?.opening,
    match?.oranlar,
    match?.opening_prices,
    match?.marketOdds,
    match?.markets
  ].filter(container => container && typeof container === "object");
}

function getOdds(match, market) {
  const containers = getOddsContainers(match);

  for (const container of containers) {
    for (const field of market.fields) {
      if (!Object.prototype.hasOwnProperty.call(container, field)) continue;

      const odd = normalizeOdd(container[field]);

      if (odd) return odd;
    }
  }

  return null;
}

function getTargetResult(matchInfo, resultId) {
  const definition = RESULTS[resultId];

  if (!definition) return null;

  const score = definition.type === "ht"
    ? matchInfo.ht
    : matchInfo.ft;

  if (!score) return null;

  return definition.test(score);
}

/* =========================================================
   VERİ VE İNDEKS ÖNBELLEĞİ
   ========================================================= */

let allMatches = [];
let matchInfos = [];
let oddsIndex = new Map();
let dataReady = false;

function compareNewestFirst(a, b) {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }

  return b.time.localeCompare(a.time);
}

function buildDataIndexes(matches) {
  const infos = [];
  const index = new Map();

  for (const match of matches) {
    const date = getDateKey(match);

    if (!date) continue;

    const ft = getScore(match, "ft");
    const ht = getScore(match, "ht");
    const played = Boolean(ft);
    const time = getTime(match);

    const info = {
      match,
      date,
      time,
      ft,
      ht,
      played,
      marketOdds: []
    };

    infos.push(info);

    for (const market of MARKETS) {
      const odd = getOdds(match, market);

      if (!odd) continue;

      const key = `${market.id}|${odd}`;
      const entry = { info, odd, marketId: market.id };

      info.marketOdds.push(entry);

      // Son 5 geçmiş maç hesabında yalnızca sonucu belli maçlar gerekir.
      if (played) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(info);
      }
    }
  }

  // Her market/oran grubunu yalnızca bir defa sırala.
  for (const list of index.values()) {
    list.sort(compareNewestFirst);
  }

  matchInfos = infos;
  oddsIndex = index;
  dataReady = true;
}

async function loadData() {
  // Her sayfa açılışında rastgele sorgu parametresi eklemek yerine
  // tarayıcının önbelleği doğrulamasına izin ver.
  const response = await fetch(DATA_URL, {
    cache: "no-cache"
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
   İNDEKSTEN SON 5 EŞLEŞEN MAÇ
   ========================================================= */

function getRecentOddsMatches(marketId, odd, targetDate) {
  const list = oddsIndex.get(`${marketId}|${odd}`);

  if (!list || !list.length) return [];

  const recent = [];

  // Liste zaten yeni tarihten eski tarihe sıralı.
  // Yeniden filtreleme ve sıralama yapmadan ilk 5 uygun maçı al.
  for (const info of list) {
    if (info.date >= targetDate) continue;

    recent.push(info);

    if (recent.length >= RECENT_MATCH_LIMIT) break;
  }

  return recent;
}

function calculateRecentSuccess(marketId, odd, targetDate, resultId) {
  const recentMatches = getRecentOddsMatches(
    marketId,
    odd,
    targetDate
  );

  let success = 0;

  for (const info of recentMatches) {
    if (getTargetResult(info, resultId) === true) {
      success++;
    }
  }

  return {
    recentMatches,
    total: recentMatches.length,
    success,
    rate: recentMatches.length
      ? success / recentMatches.length * 100
      : 0
  };
}

/* =========================================================
   GELECEK MAÇ İNDEKSİ
   ========================================================= */

function buildFutureIndex(targetDate) {
  const index = new Map();

  for (const info of matchInfos) {
    if (info.date !== targetDate || info.played) continue;

    for (const entry of info.marketOdds) {
      const key = `${entry.marketId}|${entry.odd}`;

      if (!index.has(key)) index.set(key, []);

      index.get(key).push(info);
    }
  }

  return index;
}

/* =========================================================
   ANALİZ MOTORU
   ========================================================= */

function runAnalysis(targetDate, resultId) {
  if (!dataReady) {
    throw new Error("Veriler henüz hazırlanmadı.");
  }

  const startDate = addDays(targetDate, -HISTORY_DAYS);
  const history = [];
  const groups = new Map();

  // Son 10 günlük oynanmış maçları tek geçişte bul.
  for (const info of matchInfos) {
    if (
      info.date < startDate ||
      info.date >= targetDate ||
      !info.played
    ) {
      continue;
    }

    history.push(info);

    for (const entry of info.marketOdds) {
      const key = `${entry.marketId}|${entry.odd}`;

      if (!groups.has(key)) {
        const market = MARKET_BY_ID.get(entry.marketId);

        groups.set(key, {
          marketId: entry.marketId,
          marketLabel: market ? market.label : entry.marketId,
          odd: entry.odd
        });
      }
    }
  }

  const futureIndex = buildFutureIndex(targetDate);
  const rows = [];

  for (const item of groups.values()) {
    const key = `${item.marketId}|${item.odd}`;
    const future = futureIndex.get(key);

    // Seçilen tarihte bu oranla oynanmamış maç yoksa hesaplama yapma.
    if (!future || !future.length) continue;

    const recent = calculateRecentSuccess(
      item.marketId,
      item.odd,
      targetDate,
      resultId
    );

    if (recent.total === 0) continue;
    if (recent.rate < MIN_SUCCESS) continue;

    rows.push({
      ...item,
      total: recent.total,
      success: recent.success,
      rate: recent.rate,
      future,
      recentMatches: recent.recentMatches
    });
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
   GEÇMİŞ MAÇ STİLLERİ
   ========================================================= */

function addRecentMatchStyles() {
  if (document.getElementById("saRecentMatchStyles")) return;

  const style = document.createElement("style");
  style.id = "saRecentMatchStyles";

  style.textContent = `
    .sa-future-block {
      padding-bottom: 9px;
      margin-bottom: 5px;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .sa-recent-wrap {
      margin: 5px 0 8px;
      padding: 8px 10px;
      border: 1px solid rgba(148,163,184,.14);
      border-radius: 9px;
      background: rgba(2,6,23,.42);
    }

    .sa-recent-heading {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 5px;
      color: #cbd5e1;
      font-size: 10px;
      font-weight: 900;
    }

    .sa-recent-count {
      color: #93c5fd;
      white-space: nowrap;
    }

    .sa-recent-item {
      display: grid;
      grid-template-columns: 60px minmax(0,1fr) auto;
      align-items: center;
      gap: 7px;
      padding: 6px 0;
      border-top: 1px solid rgba(255,255,255,.055);
      font-size: 10px;
      line-height: 1.4;
    }

    .sa-recent-date {
      color: #94a3b8;
      font-size: 9px;
      white-space: nowrap;
    }

    .sa-recent-teams {
      min-width: 0;
      color: #cbd5e1;
      overflow-wrap: anywhere;
    }

    .sa-recent-scores {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 3px;
      color: #94a3b8;
      font-size: 9px;
    }

    .sa-recent-scores strong {
      color: #4ade80;
      font-weight: 900;
    }

    .sa-recent-meta {
      margin-top: 2px;
      color: #64748b;
      font-size: 9px;
      overflow-wrap: anywhere;
    }

    .sa-recent-odd {
      color: #93c5fd;
      font-size: 10px;
      font-weight: 900;
      white-space: nowrap;
    }

    .sa-recent-empty {
      padding: 6px 0 2px;
      color: #94a3b8;
      font-size: 10px;
      line-height: 1.45;
    }

    @media (max-width: 420px) {
      .sa-recent-wrap {
        padding: 7px;
      }

      .sa-recent-item {
        grid-template-columns: 51px minmax(0,1fr) auto;
        gap: 5px;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   GEÇMİŞ MAÇ HTML'İ
   ========================================================= */

function renderRecentMatches(recentMatches, odd) {
  let html = `
    <div class="sa-recent-wrap">
      <div class="sa-recent-heading">
        <span>🕘 AYNI ORANIN SON ${RECENT_MATCH_LIMIT} MAÇI</span>
        <span class="sa-recent-count">${recentMatches.length} maç</span>
      </div>
  `;

  if (!recentMatches.length) {
    html += `
      <div class="sa-recent-empty">
        Bu market ve oran için geçmiş maç bulunamadı.
      </div>
    `;
  }

  for (const info of recentMatches) {
    const match = info.match;
    const ft = info.ft;
    const ht = info.ht;

    html += `
      <div class="sa-recent-item">
        <div class="sa-recent-date">
          ${escapeHtml(formatDate(info.date))}
        </div>

        <div class="sa-recent-teams">
          <div>
            ${escapeHtml(getTeamName(match, "home"))}
            <span> - </span>
            ${escapeHtml(getTeamName(match, "away"))}
          </div>

          <div class="sa-recent-scores">
            <span>İY: <strong>${
              ht ? `${ht.home}-${ht.away}` : "—"
            }</strong></span>
            <span>MS: <strong>${
              ft ? `${ft.home}-${ft.away}` : "—"
            }</strong></span>
          </div>

          <div class="sa-recent-meta">
            ${escapeHtml(getLeague(match))}
          </div>
        </div>

        <div class="sa-recent-odd">${escapeHtml(odd)}</div>
      </div>
    `;
  }

  html += `</div>`;

  return html;
}

/* =========================================================
   YÜZDE
   ========================================================= */

function formatPercent(value) {
  return `${Number(value).toFixed(1).replace(".0", "")}%`;
}

/* =========================================================
   OYNANMAMIŞ MAÇLARIN GÖRÜNÜMÜ

   Geçmiş maç listesi her gelecek maç için tekrar
   oluşturulmaz; ilgili oran grubunda bir kez gösterilir.
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

  for (const info of row.future) {
    const match = info.match;

    html += `
      <div class="sa-future-block">
        <div class="sa-match">
          <div class="sa-match-time">
            ${escapeHtml(info.time)}
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
      </div>
    `;
  }

  html += renderRecentMatches(row.recentMatches, row.odd);

  return html;
}

/* =========================================================
   ANA GÖRÜNÜM
   ========================================================= */

function renderAnalysis(resultId, targetDate, analysis) {
  const content = document.getElementById("saContent");
  const status = document.getElementById("saStatus");
  const period = document.getElementById("saPeriod");
  const historyCount = document.getElementById("saHistoryCount");
  const oddsCount = document.getElementById("saOddsCount");

  if (!content || !status || !period || !historyCount || !oddsCount) {
    console.error("Analiz görünüm elemanları bulunamadı.");
    return;
  }

  addRecentMatchStyles();

  const result = RESULTS[resultId];

  period.textContent =
    `${formatDate(addDays(targetDate, -HISTORY_DAYS))} - ` +
    `${formatDate(addDays(targetDate, -1))}`;

  historyCount.textContent = analysis.history.length;
  oddsCount.textContent = analysis.rows.length;

  status.innerHTML =
    `<strong>${escapeHtml(result.label)}</strong> için ` +
    `<strong>${analysis.rows.length}</strong> uygun oran bulundu. ` +
    `Başarı hesabı: <strong>son ${RECENT_MATCH_LIMIT} maç</strong> · ` +
    `Minimum başarı: <strong>%${MIN_SUCCESS}</strong>`;

  if (!analysis.rows.length) {
    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          Son ${HISTORY_DAYS} günlük analiz döneminde,
          son ${RECENT_MATCH_LIMIT} eşleşen maçta %${MIN_SUCCESS}
          başarıya ulaşan ve seçilen tarihte oynanmamış maçı bulunan
          birebir açılış oranı yok.
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
        `sa-${market.id}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "");

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
   SATIR AÇMA / KAPATMA
   ========================================================= */

function bindRows() {
  const content = document.getElementById("saContent");

  // Tek bir dinleyici kullan; her satıra ayrı dinleyici ekleme.
  content.onclick = event => {
    const row = event.target.closest(".sa-row[data-row-id]");

    if (!row || !content.contains(row)) return;

    const details = document.getElementById(row.dataset.rowId);

    if (!details) return;

    const wasOpen = details.classList.contains("open");

    content.querySelectorAll(".sa-details.open").forEach(item => {
      item.classList.remove("open");
    });

    content.querySelectorAll(".sa-row.active").forEach(item => {
      item.classList.remove("active");
    });

    if (!wasOpen) {
      details.classList.add("open");
      row.classList.add("active");
    }
  };
}

/* =========================================================
   ANALİZİ ÇALIŞTIR
   ========================================================= */

let isAnalyzing = false;

async function executeAnalysis() {
  const resultSelect = document.getElementById("saResult");
  const dateInput = document.getElementById("saDate");
  const status = document.getElementById("saStatus");
  const content = document.getElementById("saContent");
  const runButton = document.getElementById("saRun");

  if (!resultSelect || !dateInput || !status || !content) {
    console.error("Analiz için gerekli HTML elemanları bulunamadı.");
    return;
  }

  if (isAnalyzing) return;

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

  isAnalyzing = true;

  if (runButton) runButton.disabled = true;

  status.textContent = "Analiz hazırlanıyor...";

  try {
    const analysis = runAnalysis(targetDate, resultId);
    renderAnalysis(resultId, targetDate, analysis);
  } catch (error) {
    console.error(error);

    status.textContent = "Analiz sırasında hata oluştu.";

    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Analiz yapılamadı</strong>
        <span>Veri yapısını kontrol edin.</span>
      </div>
    `;
  } finally {
    isAnalyzing = false;
    if (runButton) runButton.disabled = false;
  }
}

/* =========================================================
   BAŞLANGIÇ
   ========================================================= */

async function init() {
  const dateInput = document.getElementById("saDate");
  const runButton = document.getElementById("saRun");
  const status = document.getElementById("saStatus");
  const content = document.getElementById("saContent");

  if (!dateInput || !runButton || !status || !content) {
    console.error("Analiz için gerekli HTML elemanları bulunamadı.");
    return;
  }

  dateInput.value = todayKey();
  runButton.addEventListener("click", executeAnalysis);

  try {
    status.textContent = "Veriler yükleniyor...";

    allMatches = await loadData();

    status.textContent =
      `${allMatches.length} maç verisi hazırlanıyor...`;

    // Pahalı hazırlık işlemleri yalnızca bir kez yapılır.
    buildDataIndexes(allMatches);

    status.textContent =
      `${allMatches.length} maç verisi yüklendi. Analiz hazırlanıyor...`;

    await executeAnalysis();
  } catch (error) {
    console.error(error);

    status.textContent = "Veriler yüklenemedi.";

    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Veriler yüklenemedi</strong>
        <span>data/v2-data.json dosyasını ve veri yolunu kontrol edin.</span>
      </div>
    `;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
