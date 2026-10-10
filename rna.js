
"use strict";

/* =========================================================
   RNA — DNA HESAPLAMA YÖNTEMİYLE KUPON MOTORU

   Veri: ./data/v2-data.json
   Geçmiş: 30 gün
   Minimum örnek: 8
   Minimum başarı: %80
   Minimum tekli oran: 1.35
   Minimum kupon oranı: 2.00
   Maksimum maç: 5

   Hesaplama:
   - Aynı market ve aynı açılış oranı
   - Oranlar iki ondalık basamağa normalize edilir
   - Yalnızca sonuçlanmış geçmiş maçlar
   - Seçilen tarihten önceki 30 günlük geçmiş
   - Her market kendi gerçek maç sonucuyla değerlendirilir
   ========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 30;
const MIN_SAMPLE = 8;
const MIN_SUCCESS = 80;
const MIN_ODD = 1.35;
const MIN_TOTAL_ODDS = 2.00;
const MAX_MATCHES = 5;

const MARKETS = [
  { key: "ms1", label: "MS 1", half: false, test: (h, a) => h > a },
  { key: "msX", label: "MS X", half: false, test: (h, a) => h === a },
  { key: "ms2", label: "MS 2", half: false, test: (h, a) => h < a },

  { key: "iy1", label: "İY 1", half: true, test: (h, a) => h > a },
  { key: "iyX", label: "İY X", half: true, test: (h, a) => h === a },
  { key: "iy2", label: "İY 2", half: true, test: (h, a) => h < a },

  { key: "iy15Ust", label: "İY 1,5 Üst", half: true, test: (h, a) => h + a >= 2 },
  { key: "iy15Alt", label: "İY 1,5 Alt", half: true, test: (h, a) => h + a <= 1 },

  { key: "au15Ust", label: "MS 1,5 Üst", half: false, test: (h, a) => h + a >= 2 },
  { key: "au15Alt", label: "MS 1,5 Alt", half: false, test: (h, a) => h + a <= 1 },
  { key: "au25Ust", label: "MS 2,5 Üst", half: false, test: (h, a) => h + a >= 3 },
  { key: "au25Alt", label: "MS 2,5 Alt", half: false, test: (h, a) => h + a <= 2 },
  { key: "au35Ust", label: "MS 3,5 Üst", half: false, test: (h, a) => h + a >= 4 },
  { key: "au35Alt", label: "MS 3,5 Alt", half: false, test: (h, a) => h + a <= 3 },

  { key: "kgVar", label: "KG Var", half: false, test: (h, a) => h > 0 && a > 0 },
  { key: "kgYok", label: "KG Yok", half: false, test: (h, a) => h === 0 || a === 0 },
  { key: "iyKgVar", label: "İY KG Var", half: true, test: (h, a) => h > 0 && a > 0 },
  { key: "iyKgYok", label: "İY KG Yok", half: true, test: (h, a) => h === 0 || a === 0 },

  { key: "gol01", label: "0-1 Gol", half: false, test: (h, a) => h + a <= 1 },
  { key: "gol23", label: "2-3 Gol", half: false, test: (h, a) => h + a >= 2 && h + a <= 3 },
  { key: "gol46", label: "4-6 Gol", half: false, test: (h, a) => h + a >= 4 && h + a <= 6 },
  { key: "gol7", label: "7+ Gol", half: false, test: (h, a) => h + a >= 7 },

  { key: "cs1X", label: "ÇŞ 1X", half: false, test: (h, a) => h >= a },
  { key: "cs12", label: "ÇŞ 12", half: false, test: (h, a) => h !== a },
  { key: "csX2", label: "ÇŞ X2", half: false, test: (h, a) => h <= a }
];

/* =========================================================
   GLOBAL DURUM
   ========================================================= */

let allMatches = [];
let matchesByDate = new Map();

let selectedDate = localDateValue(new Date());
let isLoading = false;
let loadError = "";

const historyCache = new Map();
const MAX_HISTORY_CACHE = 8;

const formatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/* =========================================================
   TARİH YARDIMCILARI
   ========================================================= */

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  let match;

  if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    const date = new Date(+match[1], +match[2] - 1, +match[3]);
    return validDateParts(date, +match[1], +match[2] - 1, +match[3]);
  }

  if ((match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) {
    const date = new Date(+match[3], +match[2] - 1, +match[1]);
    return validDateParts(date, +match[3], +match[2] - 1, +match[1]);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function validDateParts(date, year, month, day) {
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function dateKey(value) {
  const date = parseDate(value);
  return date ? localDateValue(date) : "";
}

function daysBetween(later, earlier) {
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / 86400000);
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return String(value || "-");

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/* =========================================================
   SKOR YARDIMCILARI
   ========================================================= */

function parseScore(value) {
  if (value == null || value === "") return null;

  if (typeof value === "object") {
    const home = Number(
      value.home ?? value.homeScore ?? value.homeGoals ??
      value.h ?? value.ev ?? value.evSahibi
    );

    const away = Number(
      value.away ?? value.awayScore ?? value.awayGoals ??
      value.a ?? value.dep ?? value.deplasman
    );

    if (
      Number.isFinite(home) &&
      Number.isFinite(away) &&
      home >= 0 &&
      away >= 0
    ) {
      return { home, away };
    }

    return null;
  }

  const match = String(value).match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function firstScore(match, fields) {
  for (const field of fields) {
    const score = parseScore(match?.[field]);
    if (score) return score;
  }

  return null;
}

function fullScore(match) {
  const direct = firstScore(match, [
    "score",
    "fullTimeScore",
    "full_time_score",
    "ftScore",
    "ms",
    "result"
  ]);

  if (direct) return direct;

  const nested = [
    match?.scores?.fullTime,
    match?.scores?.full_time,
    match?.scores?.ft,
    match?.result?.fullTime,
    match?.result?.ft
  ];

  for (const value of nested) {
    const score = parseScore(value);
    if (score) return score;
  }

  return null;
}

function halfScore(match) {
  const direct = firstScore(match, [
    "halfTimeScore",
    "half_time_score",
    "htScore",
    "ht",
    "iy",
    "firstHalfScore",
    "first_half_score"
  ]);

  if (direct) return direct;

  const nested = [
    match?.scores?.halfTime,
    match?.scores?.half_time,
    match?.scores?.ht,
    match?.result?.halfTime,
    match?.result?.ht
  ];

  for (const value of nested) {
    const score = parseScore(value);
    if (score) return score;
  }

  return null;
}

function isPlayed(match) {
  return fullScore(match) !== null;
}

/* =========================================================
   TAKIM, SAAT VE LİG
   ========================================================= */

function matchName(match) {
  const home =
    match?.home ??
    match?.homeTeam ??
    match?.homeName ??
    match?.team1 ??
    match?.evSahibi ??
    "Ev sahibi";

  const away =
    match?.away ??
    match?.awayTeam ??
    match?.awayName ??
    match?.team2 ??
    match?.deplasman ??
    "Deplasman";

  return `${home} - ${away}`;
}

function matchTime(match) {
  const value =
    match?.time ??
    match?.matchTime ??
    match?.hour ??
    match?.saat ??
    match?.datetime ??
    match?.dateTime ??
    "";

  const text = String(value);

  const timeMatch = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  return timeMatch ? timeMatch[0] : (text.length <= 8 ? text : "");
}

function matchLeague(match) {
  return String(
    match?.league ??
    match?.leagueName ??
    match?.competition ??
    match?.tournament ??
    match?.lig ??
    ""
  );
}

/* =========================================================
   ORAN OKUMA

   DNA yöntemindeki gibi oran iki ondalık basamağa
   normalize edilir. İç içe oran nesneleri de desteklenir.
   ========================================================= */

function normalizeOdd(value) {
  if (value == null || value === "") return null;

  const parsed = Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 1) return null;

  return Number(parsed.toFixed(2));
}

function oddKey(value) {
  const odd = normalizeOdd(value);
  return odd == null ? "" : odd.toFixed(2);
}

function getOdd(match, key) {
  const containers = [
    match,
    match?.openingOdds,
    match?.openOdds,
    match?.odds,
    match?.opening,
    match?.oranlar,
    match?.markets
  ];

  const aliases = {
    msX: ["msX", "msx", "MSX", "MS0", "ms0"],
    iyX: ["iyX", "iyx", "IYX", "İYX", "iy0"],
    au15Alt: ["au15Alt", "ms15Alt", "15_ALT", "ms15alt"],
    au15Ust: ["au15Ust", "ms15Ust", "15_UST", "ms15ust"],
    au25Alt: ["au25Alt", "25_ALT"],
    au25Ust: ["au25Ust", "25_UST"],
    au35Alt: ["au35Alt", "35_ALT"],
    au35Ust: ["au35Ust", "35_UST"],
    iy15Alt: ["iy15Alt", "IY15_ALT"],
    iy15Ust: ["iy15Ust", "IY15_UST"],
    iyKgVar: ["iyKgVar", "iyKGVar", "IYKG_VAR"],
    iyKgYok: ["iyKgYok", "iyKGYok", "IYKG_YOK"]
  };

  const fields = [...new Set([key, ...(aliases[key] || [])])];

  for (const container of containers) {
    if (!container || typeof container !== "object") continue;

    for (const field of fields) {
      const odd = normalizeOdd(container[field]);
      if (odd != null) return odd;
    }
  }

  return null;
}

/* =========================================================
   MARKET SONUCU

   Her market, yalnızca kendi gerçek sonucuyla karşılaştırılır.
   ========================================================= */

function marketOutcome(match, market) {
  const score = market.half ? halfScore(match) : fullScore(match);
  if (!score) return null;

  return Boolean(market.test(score.home, score.away));
}

/* =========================================================
   TARİH İNDEKSİ
   ========================================================= */

function buildDateIndex() {
  matchesByDate = new Map();
  historyCache.clear();

  for (const match of allMatches) {
    const key = dateKey(
      match?.date ??
      match?.matchDate ??
      match?.gameDate ??
      match?.tarih ??
      match?.datetime ??
      match?.dateTime
    );

    if (!key) continue;

    if (!matchesByDate.has(key)) matchesByDate.set(key, []);
    matchesByDate.get(key).push(match);
  }
}

/* =========================================================
   GEÇMİŞ ANALİZİ

   Anahtar: market + iki ondalıklı açılış oranı.
   Geçmiş maçlar yalnızca seçilen tarihten önceki
   30 günlük aralıktan alınır.
   ========================================================= */

function buildHistoryIndex(targetDate) {
  if (historyCache.has(targetDate)) {
    return historyCache.get(targetDate);
  }

  const target = parseDate(targetDate);
  if (!target) return new Map();

  const index = new Map();

  for (let offset = 1; offset <= HISTORY_DAYS; offset++) {
    const date = new Date(target);
    date.setDate(date.getDate() - offset);

    const key = localDateValue(date);
    const matches = matchesByDate.get(key) || [];

    for (const match of matches) {
      if (!isPlayed(match)) continue;

      for (const market of MARKETS) {
        const odd = getOdd(match, market.key);
        if (odd == null || odd < MIN_ODD) continue;

        const outcome = marketOutcome(match, market);
        if (outcome == null) continue;

        const groupKey = `${market.key}|${oddKey(odd)}`;

        if (!index.has(groupKey)) {
          index.set(groupKey, {
            marketKey: market.key,
            odd: Number(oddKey(odd)),
            sample: 0,
            wins: 0,
            losses: 0
          });
        }

        const group = index.get(groupKey);
        group.sample++;

        if (outcome) group.wins++;
        else group.losses++;
      }
    }
  }

  if (historyCache.size >= MAX_HISTORY_CACHE) {
    const oldestKey = historyCache.keys().next().value;
    historyCache.delete(oldestKey);
  }

  historyCache.set(targetDate, index);
  return index;
}

/* =========================================================
   TEK MAÇ ANALİZİ
   ========================================================= */

function analyzeMarket(match, market, historyIndex) {
  const odd = getOdd(match, market.key);
  if (odd == null || odd < MIN_ODD) return null;

  const key = `${market.key}|${oddKey(odd)}`;
  const stats = historyIndex.get(key);

  if (!stats || stats.sample < MIN_SAMPLE) return null;

  const success = (stats.wins / stats.sample) * 100;
  if (success < MIN_SUCCESS) return null;

  return {
    match,
    market,
    marketKey: market.key,
    marketLabel: market.label,
    odd: Number(oddKey(odd)),
    sample: stats.sample,
    wins: stats.wins,
    losses: stats.losses,
    success,
    date: dateKey(
      match?.date ??
      match?.matchDate ??
      match?.gameDate ??
      match?.tarih ??
      match?.datetime ??
      match?.dateTime
    ),
    time: matchTime(match),
    league: matchLeague(match),
    matchName: matchName(match)
  };
}

/* =========================================================
   SEÇİLEN TARİHİN ADAYLARI
   ========================================================= */

function getCandidatesForDate(dateValue) {
  const targetDate = dateKey(dateValue);
  if (!targetDate) return [];

  const dayMatches = matchesByDate.get(targetDate) || [];
  if (!dayMatches.length) return [];

  const historyIndex = buildHistoryIndex(targetDate);
  const candidates = [];

  for (const match of dayMatches) {
    for (const market of MARKETS) {
      const candidate = analyzeMarket(match, market, historyIndex);
      if (candidate) candidates.push(candidate);
    }
  }

  candidates.sort((a, b) =>
    b.success - a.success ||
    b.sample - a.sample ||
    b.odd - a.odd
  );

  return candidates;
}

/* =========================================================
   KUPON OLUŞTURMA
   ========================================================= */

function buildCoupon(candidates, type) {
  const thresholds = {
    safe: 90,
    medium: 85,
    risk: MIN_SUCCESS
  };

  const threshold = thresholds[type] ?? MIN_SUCCESS;

  const ordered = candidates
    .filter(item => item.success >= threshold && item.odd >= MIN_ODD)
    .slice()
    .sort((a, b) =>
      b.success - a.success ||
      b.sample - a.sample ||
      b.odd - a.odd
    );

  const selected = [];
  const usedMatches = new Set();
  let totalOdd = 1;

  for (const candidate of ordered) {
    if (selected.length >= MAX_MATCHES) break;

    const identity = [
      candidate.date,
      candidate.time,
      candidate.matchName
    ].join("|").toLocaleLowerCase("tr-TR");

    if (usedMatches.has(identity)) continue;

    usedMatches.add(identity);
    selected.push(candidate);
    totalOdd *= candidate.odd;

    if (totalOdd >= MIN_TOTAL_ODDS) break;
  }

  if (!selected.length || totalOdd < MIN_TOTAL_ODDS) {
    return {
      type,
      items: [],
      totalOdd: 0,
      message: `Toplam oranı ${formatter.format(MIN_TOTAL_ODDS)} yapacak yeterli uygun maç bulunamadı.`
    };
  }

  return {
    type,
    items: selected,
    totalOdd,
    message: ""
  };
}

/* =========================================================
   KUPON SONUCU
   ========================================================= */

function couponStatus(coupon) {
  if (!coupon?.items?.length) return "empty";

  let hasPending = false;

  for (const item of coupon.items) {
    const outcome = marketOutcome(item.match, item.market);

    if (outcome === false) return "lost";
    if (outcome == null) hasPending = true;
  }

  return hasPending ? "pending" : "won";
}

function couponStatusLabel(status) {
  const labels = {
    won: "Kazandı",
    lost: "Kaybetti",
    pending: "Bekliyor",
    empty: "Kupon oluşturulamadı"
  };

  return labels[status] || "Bekliyor";
}

/* =========================================================
   GÜVENLİ HTML
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatOdd(value) {
  return formatter.format(Number(value) || 0);
}

/* =========================================================
   STİLLER
   ========================================================= */

function installStyles() {
  if (document.getElementById("mk-coupon-styles")) return;

  const style = document.createElement("style");
  style.id = "mk-coupon-styles";

  style.textContent = `
    #mk-coupon-root {
      box-sizing: border-box;
      width: 100%;
      color: #e8eef8;
      background: #07111f;
      padding: 16px;
      border-radius: 16px;
      font-family: Arial, Helvetica, sans-serif;
    }

    #mk-coupon-root *,
    #mk-coupon-root *::before,
    #mk-coupon-root *::after {
      box-sizing: border-box;
    }

    #mk-coupon-root .mk-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    #mk-coupon-root .mk-title {
      margin: 0;
      font-size: 21px;
      font-weight: 800;
      color: #f3f7ff;
    }

    #mk-coupon-root .mk-subtitle {
      color: #9caec7;
      font-size: 12px;
      margin-top: 6px;
    }

    #mk-coupon-root .mk-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    #mk-coupon-root input[type="date"] {
      min-height: 40px;
      padding: 8px 10px;
      border: 1px solid #2b3b52;
      border-radius: 9px;
      background: #101d2e;
      color: #f3f7ff;
      color-scheme: dark;
      font: inherit;
    }

    #mk-coupon-root button {
      min-height: 40px;
      padding: 9px 13px;
      border: 1px solid #2c7ce5;
      border-radius: 9px;
      background: #1768c4;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }

    #mk-coupon-root button:disabled {
      opacity: .55;
      cursor: wait;
    }

    #mk-coupon-root .mk-message {
      padding: 11px 13px;
      margin: 10px 0 14px;
      border: 1px solid #263950;
      border-radius: 10px;
      background: #0d1a2b;
      color: #b8c7dc;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    #mk-coupon-root .mk-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 14px 0;
    }

    #mk-coupon-root .mk-stat {
      min-width: 0;
      padding: 12px;
      border: 1px solid #23364e;
      border-radius: 11px;
      background: #0d1a2b;
    }

    #mk-coupon-root .mk-stat-label {
      color: #98aac3;
      font-size: 11px;
      margin-bottom: 6px;
    }

    #mk-coupon-root .mk-stat-value {
      font-size: 19px;
      font-weight: 800;
      color: #f5f8ff;
      overflow-wrap: anywhere;
    }

    #mk-coupon-root .mk-coupon-card {
      border: 1px solid #2a3c54;
      border-radius: 13px;
      background: #0b1727;
      margin: 12px 0;
      overflow: hidden;
    }

    #mk-coupon-root .mk-coupon-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid #25364c;
      background: #101e31;
    }

    #mk-coupon-root .mk-coupon-title {
      color: #f2f6ff;
      font-size: 16px;
      font-weight: 800;
    }

    #mk-coupon-root .mk-coupon-description {
      color: #9caec7;
      font-size: 12px;
      margin-top: 4px;
    }

    #mk-coupon-root .mk-total {
      color: #6ee7a0;
      font-size: 22px;
      font-weight: 900;
      white-space: nowrap;
    }

    #mk-coupon-root .mk-leg {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid #1b2b3e;
    }

    #mk-coupon-root .mk-leg:last-child {
      border-bottom: 0;
    }

    #mk-coupon-root .mk-match-name {
      font-size: 14px;
      line-height: 1.45;
      font-weight: 700;
      color: #edf3ff;
      overflow-wrap: anywhere;
    }

    #mk-coupon-root .mk-match-meta {
      margin-top: 4px;
      color: #91a5bf;
      font-size: 11px;
      line-height: 1.5;
    }

    #mk-coupon-root .mk-market {
      display: inline-block;
      margin-top: 7px;
      padding: 5px 8px;
      border: 1px solid #31547b;
      border-radius: 7px;
      background: #122b46;
      color: #c4e1ff;
      font-size: 12px;
      font-weight: 800;
    }

    #mk-coupon-root .mk-odd {
      align-self: center;
      font-size: 17px;
      font-weight: 900;
      color: #f4f7ff;
      white-space: nowrap;
    }

    #mk-coupon-root .mk-result {
      display: inline-block;
      margin-top: 6px;
      font-size: 11px;
      font-weight: 800;
    }

    #mk-coupon-root .mk-won { color: #54e08a; }
    #mk-coupon-root .mk-lost { color: #ff7373; }
    #mk-coupon-root .mk-pending { color: #f6ca61; }

    #mk-coupon-root .mk-empty {
      padding: 18px 14px;
      color: #b3c1d5;
      font-size: 13px;
      line-height: 1.6;
    }

    #mk-coupon-root .mk-footnote {
      margin-top: 15px;
      color: #8ea2bd;
      font-size: 11px;
      line-height: 1.7;
    }

    @media (max-width: 480px) {
      #mk-coupon-root { padding: 11px; }
      #mk-coupon-root .mk-title { font-size: 18px; }
      #mk-coupon-root .mk-summary { grid-template-columns: 1fr; }
      #mk-coupon-root .mk-stat { padding: 10px; }
      #mk-coupon-root .mk-stat-value { font-size: 17px; }
      #mk-coupon-root .mk-leg { padding: 11px; }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   ANA ARAYÜZ
   ========================================================= */

function ensureRoot() {
  let root = document.getElementById("mk-coupon-root");
  if (root) return root;

  root = document.createElement("section");
  root.id = "mk-coupon-root";

  const host =
    document.querySelector("#coupon-root") ||
    document.querySelector("#kupon-root") ||
    document.querySelector("[data-coupon-root]") ||
    document.querySelector("main") ||
    document.body;

  host.appendChild(root);
  return root;
}

function renderShell() {
  const root = ensureRoot();

  root.innerHTML = `
    <div class="mk-head">
      <div>
        <h2 class="mk-title">Otomatik Kupon</h2>
        <div class="mk-subtitle">
          DNA hesaplama yöntemi · ${HISTORY_DAYS} günlük geçmiş
        </div>
      </div>

      <div class="mk-controls">
        <input
          id="mk-coupon-date"
          type="date"
          value="${escapeHtml(selectedDate)}"
          aria-label="Maç tarihi"
        >
        <button id="mk-coupon-refresh" type="button">
          Yenile
        </button>
      </div>
    </div>

    <div id="mk-coupon-message" class="mk-message">
      Veriler hazırlanıyor...
    </div>

    <div id="mk-coupon-content"></div>
  `;

  const dateInput = root.querySelector("#mk-coupon-date");
  const refreshButton = root.querySelector("#mk-coupon-refresh");

  dateInput.addEventListener("change", () => {
    if (!dateInput.value) return;

    selectedDate = dateInput.value;
    renderCouponsForDate(selectedDate);
  });

  refreshButton.addEventListener("click", () => {
    loadCouponData(true);
  });

  return root;
}

function setMessage(message) {
  const element = document.getElementById("mk-coupon-message");
  if (element) element.textContent = message;
}

/* =========================================================
   KUPON KARTI
   ========================================================= */

function renderCouponCard(coupon, title, description) {
  if (!coupon.items.length) {
    return `
      <article class="mk-coupon-card">
        <div class="mk-coupon-head">
          <div>
            <div class="mk-coupon-title">${escapeHtml(title)}</div>
            <div class="mk-coupon-description">${escapeHtml(description)}</div>
          </div>
        </div>
        <div class="mk-empty">${escapeHtml(coupon.message)}</div>
      </article>
    `;
  }

  const status = couponStatus(coupon);
  const statusClass = {
    won: "mk-won",
    lost: "mk-lost",
    pending: "mk-pending"
  }[status] || "mk-pending";

  const legs = coupon.items.map(item => {
    const score = item.market.half
      ? halfScore(item.match)
      : fullScore(item.match);

    const result = marketOutcome(item.match, item.market);

    let resultText = "Bekliyor";
    let resultClass = "mk-pending";

    if (result === true) {
      resultText = "Kazandı";
      resultClass = "mk-won";
    } else if (result === false) {
      resultText = "Kaybetti";
      resultClass = "mk-lost";
    }

    const scoreText = score
      ? `${score.home} - ${score.away}`
      : "Skor bekleniyor";

    return `
      <div class="mk-leg">
        <div>
          <div class="mk-match-name">${escapeHtml(item.matchName)}</div>

          <div class="mk-match-meta">
            ${escapeHtml(item.time || "Saat belirtilmemiş")}
            ${item.league ? ` · ${escapeHtml(item.league)}` : ""}
            · Skor: ${escapeHtml(scoreText)}
          </div>

          <div class="mk-market">${escapeHtml(item.marketLabel)}</div>

          <div class="mk-match-meta">
            Başarı: ${Math.round(item.success)}%
            · Geçmiş: ${item.wins}/${item.sample}
          </div>

          <div class="mk-result ${resultClass}">
            ${resultText}
          </div>
        </div>

        <div class="mk-odd">${formatOdd(item.odd)}</div>
      </div>
    `;
  }).join("");

  return `
    <article class="mk-coupon-card">
      <div class="mk-coupon-head">
        <div>
          <div class="mk-coupon-title">${escapeHtml(title)}</div>
          <div class="mk-coupon-description">
            ${escapeHtml(description)}
            · ${coupon.items.length} maç
            · <span class="${statusClass}">${couponStatusLabel(status)}</span>
          </div>
        </div>

        <div class="mk-total">${formatOdd(coupon.totalOdd)}</div>
      </div>

      ${legs}
    </article>
  `;
}

/* =========================================================
   SEÇİLEN TARİHİ GÖSTER
   ========================================================= */

function renderCouponsForDate(dateValue = selectedDate) {
  selectedDate = dateKey(dateValue) || localDateValue(new Date());

  const dateInput = document.getElementById("mk-coupon-date");
  if (dateInput) dateInput.value = selectedDate;

  const content = document.getElementById("mk-coupon-content");
  if (!content) return [];

  if (loadError) {
    setMessage(loadError);
    content.innerHTML = "";
    return [];
  }

  if (!allMatches.length) {
    setMessage("Veri bulunamadı. Veri dosyasını kontrol et.");
    content.innerHTML = "";
    return [];
  }

  const dayMatches = matchesByDate.get(selectedDate) || [];
  const candidates = getCandidatesForDate(selectedDate);

  const safe = buildCoupon(candidates, "safe");
  const medium = buildCoupon(candidates, "medium");
  const risk = buildCoupon(candidates, "risk");

  const playedCount = dayMatches.filter(isPlayed).length;
  const pendingCount = dayMatches.length - playedCount;

  setMessage(
    `${formatDate(selectedDate)} · ${dayMatches.length} maç · ` +
    `${playedCount} sonuçlanmış · ${pendingCount} bekleyen · ` +
    `${candidates.length} uygun tahmin`
  );

  content.innerHTML = `
    <div class="mk-summary">
      <div class="mk-stat">
        <div class="mk-stat-label">Günün maçları</div>
        <div class="mk-stat-value">${dayMatches.length}</div>
      </div>

      <div class="mk-stat">
        <div class="mk-stat-label">Uygun tahmin</div>
        <div class="mk-stat-value">${candidates.length}</div>
      </div>

      <div class="mk-stat">
        <div class="mk-stat-label">Geçmiş şartı</div>
        <div class="mk-stat-value">%${MIN_SUCCESS}</div>
      </div>
    </div>

    ${renderCouponCard(
      safe,
      "Güvenli Kupon",
      "%90 ve üzeri geçmiş başarı"
    )}

    ${renderCouponCard(
      medium,
      "Orta Risk Kupon",
      "%85 ve üzeri geçmiş başarı"
    )}

    ${renderCouponCard(
      risk,
      "Alternatif Kupon",
      `%${MIN_SUCCESS} ve üzeri geçmiş başarı`
    )}

    <div class="mk-footnote">
      Hesaplama: Son ${HISTORY_DAYS} gün · En az ${MIN_SAMPLE} geçmiş maç
      · Aynı market ve aynı iki ondalıklı oran.
      Minimum tekli oran ${formatOdd(MIN_ODD)}.
      Minimum kupon oranı ${formatOdd(MIN_TOTAL_ODDS)}.
      En fazla ${MAX_MATCHES} maç.
    </div>
  `;

  return candidates;
}

/* =========================================================
   VERİYİ YÜKLE
   ========================================================= */

async function loadCouponData(force = false) {
  if (isLoading) return;

  isLoading = true;
  loadError = "";

  const root = renderShell();
  const refreshButton = root.querySelector("#mk-coupon-refresh");

  if (refreshButton) refreshButton.disabled = true;
  setMessage("Veriler yükleniyor...");

  try {
    const url = force
      ? `${DATA_URL}${DATA_URL.includes("?") ? "&" : "?"}_=${Date.now()}`
      : DATA_URL;

    const response = await fetch(url, {
      cache: force ? "no-store" : "default"
    });

    if (!response.ok) {
      throw new Error(`Veri dosyası yüklenemedi (HTTP ${response.status}).`);
    }

    const data = await response.json();

    const records = Array.isArray(data)
      ? data
      : Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data?.data)
          ? data.data
          : [];

    allMatches = records.filter(match => {
      if (!match || typeof match !== "object") return false;

      return Boolean(dateKey(
        match.date ??
        match.matchDate ??
        match.gameDate ??
        match.tarih ??
        match.datetime ??
        match.dateTime
      ));
    });

    buildDateIndex();

    if (!allMatches.length) {
      setMessage("Veri dosyası açıldı ancak geçerli tarihli maç bulunamadı.");
      const content = document.getElementById("mk-coupon-content");
      if (content) content.innerHTML = "";
      return;
    }

    renderCouponsForDate(selectedDate);
  } catch (error) {
    loadError = error?.message || "Veriler yüklenirken hata oluştu.";
    setMessage(loadError);

    const content = document.getElementById("mk-coupon-content");
    if (content) content.innerHTML = "";
  } finally {
    isLoading = false;

    const button = document.getElementById("mk-coupon-refresh");
    if (button) button.disabled = false;
  }
}

/* =========================================================
   DIŞARIDAN ERİŞİM
   ========================================================= */

window.getCouponsForDate = function(date) {
  const candidates = getCandidatesForDate(date);

  return {
    candidates,
    safe: buildCoupon(candidates, "safe"),
    medium: buildCoupon(candidates, "medium"),
    risk: buildCoupon(candidates, "risk")
  };
};

window.renderCouponsForDate = renderCouponsForDate;

window.reloadCouponData = function() {
  return loadCouponData(true);
};

/* =========================================================
   BAŞLAT
   ========================================================= */

function initializeCouponEngine() {
  installStyles();
  renderShell();
  loadCouponData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCouponEngine, {
    once: true
  });
} else {
  initializeCouponEngine();
}
