
"use strict";

/* =========================================================
   MACKOLIK KUPON MOTORU — OPTİMİZE SÜRÜM

   Veri: ./data/v2-data.json
   Geçmiş: 60 gün
   Minimum örnek: 8
   Minimum başarı: %80
   Minimum tekli oran: 1.35
   Minimum kupon oranı: 2.00
   Maksimum maç: 5

   Hesaplama mantığı:
   - Aynı market
   - Birebir aynı açılış oranı
   - Yalnızca sonuçlanmış geçmiş maçlar
   - Seçilen tarihten önceki 60 gün
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

  { key: "iy15Ust", label: "İY 1,5 Üst", half: true, test: (h, a) => h + a > 1.5 },
  { key: "iy15Alt", label: "İY 1,5 Alt", half: true, test: (h, a) => h + a < 1.5 },

  { key: "au15Ust", label: "MS 1,5 Üst", half: false, test: (h, a) => h + a > 1.5 },
  { key: "au15Alt", label: "MS 1,5 Alt", half: false, test: (h, a) => h + a < 1.5 },

  { key: "au25Ust", label: "MS 2,5 Üst", half: false, test: (h, a) => h + a > 2.5 },
  { key: "au25Alt", label: "MS 2,5 Alt", half: false, test: (h, a) => h + a < 2.5 },

  { key: "au35Ust", label: "MS 3,5 Üst", half: false, test: (h, a) => h + a > 3.5 },
  { key: "au35Alt", label: "MS 3,5 Alt", half: false, test: (h, a) => h + a < 3.5 },

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
   GLOBAL
========================================================= */

let allMatches = [];
let matchesByDate = new Map();

let selectedDate = localDateValue(new Date());
let isLoading = false;
let loadError = "";

/*
  Aynı gün yeniden seçilirse geçmiş analizi tekrar hesaplanmaz.
  Çok fazla tarih seçilirse eski önbellekler silinir.
*/
const historyCache = new Map();
const MAX_HISTORY_CACHE = 8;

const formatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/* =========================================================
   GENEL YARDIMCILAR
========================================================= */

function localDateValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  const text = String(value).trim();
  let match;

  // YYYY-MM-DD
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (match) {
    return makeValidDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  // DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  if (match) {
    return makeValidDate(
      Number(match[3]),
      Number(match[2]),
      Number(match[1])
    );
  }

  return null;
}

function makeValidDate(year, month, day) {
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
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
  const a = Date.UTC(
    later.getFullYear(),
    later.getMonth(),
    later.getDate()
  );

  const b = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate()
  );

  return Math.round((a - b) / 86400000);
}

function parseScore(value) {
  if (value === null || value === undefined) return null;

  const match = String(value)
    .trim()
    .match(/^(\d+)\s*[-:]\s*(\d+)$/);

  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function fullScore(match) {
  return parseScore(
    match.score ??
    match.fullTimeScore ??
    match.full_time_score ??
    match.ftScore ??
    match.ms
  );
}

function halfScore(match) {
  return parseScore(
    match.halfTimeScore ??
    match.half_time_score ??
    match.htScore ??
    match.ht ??
    match.iy
  );
}

function isPlayed(match) {
  return fullScore(match) !== null;
}

function getOdd(match, key) {
  const value = match?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const odd = Number(value);

  return Number.isFinite(odd) && odd > 1 ? odd : null;
}

function oddKey(odd) {
  // JSON'daki 1.8 ile 1.80 aynı sayısal oran kabul edilir.
  return Number(odd).toFixed(6);
}

function formatOdd(value) {
  return formatter.format(value);
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function matchName(match) {
  const home = match.home ?? match.homeTeam ?? "Ev sahibi";
  const away = match.away ?? match.awayTeam ?? "Deplasman";

  return `${home} - ${away}`;
}

function matchTime(match) {
  return match.time ?? match.hour ?? match.saat ?? "";
}

function matchLeague(match) {
  return match.league ?? match.lig ?? "";
}

/* =========================================================
   MARKET SONUCU

   Tarihsel sonuç sadece maç skoru mevcutsa hesaplanır.
========================================================= */

function marketOutcome(match, market) {
  const score = fullScore(match);

  if (!score) return null;

  if (market.half) {
    const half = halfScore(match);

    if (!half) return null;

    return market.test(half.home, half.away);
  }

  return market.test(score.home, score.away);
}

/* =========================================================
   VERİYİ TARİH BAZINDA İNDEKSLE
========================================================= */

function buildDateIndex() {
  matchesByDate = new Map();

  for (const match of allMatches) {
    const key = dateKey(match.date);

    if (!key) continue;

    if (!matchesByDate.has(key)) {
      matchesByDate.set(key, []);
    }

    matchesByDate.get(key).push(match);
  }

  // Tarih değişince geçmiş veriyi tekrar baştan okumayalım.
  historyCache.clear();
}

/* =========================================================
   HIZLI GEÇMİŞ ANALİZİ

   Önceki yöntem:
   Her hedef maç için tüm maç listesini tarıyordu.

   Bu yöntem:
   Seçilen tarihten önceki 60 günlük maçları bir kez tarar.
   Sonuçları market + aynı oran anahtarında toplar.
========================================================= */

function buildHistoryIndex(targetDate) {
  const targetKey = localDateValue(targetDate);

  if (historyCache.has(targetKey)) {
    return historyCache.get(targetKey);
  }

  const historyIndex = new Map();

  for (let offset = 1; offset <= HISTORY_DAYS; offset++) {
    const day = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate() - offset
    );

    const dayKey = localDateValue(day);
    const historicalMatches = matchesByDate.get(dayKey);

    if (!historicalMatches) continue;

    for (const match of historicalMatches) {
      if (!isPlayed(match)) continue;

      for (const market of MARKETS) {
        const odd = getOdd(match, market.key);

        if (odd === null || odd < MIN_ODD) continue;

        const outcome = marketOutcome(match, market);

        if (outcome === null) continue;

        const key = `${market.key}|${oddKey(odd)}`;

        let stats = historyIndex.get(key);

        if (!stats) {
          stats = { sample: 0, wins: 0 };
          historyIndex.set(key, stats);
        }

        stats.sample++;

        if (outcome) {
          stats.wins++;
        }
      }
    }
  }

  historyCache.set(targetKey, historyIndex);

  // Önbelleğin sınırsız büyümesini engelle.
  while (historyCache.size > MAX_HISTORY_CACHE) {
    const oldestKey = historyCache.keys().next().value;
    historyCache.delete(oldestKey);
  }

  return historyIndex;
}

/* =========================================================
   MAÇ ADAYLARI
========================================================= */

function analyzeMarket(match, market, historyIndex) {
  const odd = getOdd(match, market.key);

  if (odd === null || odd < MIN_ODD) return null;

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
    odd,
    sample: stats.sample,
    wins: stats.wins,
    losses: stats.sample - stats.wins,
    success,
    date: match.date,
    time: matchTime(match),
    league: matchLeague(match),
    matchName: matchName(match)
  };
}

function getCandidatesForDate(dateValue) {
  const targetDate = parseDate(dateValue);

  if (!targetDate) return [];

  const targetKey = localDateValue(targetDate);
  const dailyMatches = matchesByDate.get(targetKey) || [];

  if (!dailyMatches.length) return [];

  // Geçmiş indeksi yalnızca bir kez oluşturulur.
  const historyIndex = buildHistoryIndex(targetDate);
  const candidates = [];

  for (const match of dailyMatches) {
    for (const market of MARKETS) {
      const candidate = analyzeMarket(match, market, historyIndex);

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  candidates.sort((a, b) =>
    b.success - a.success ||
    b.sample - a.sample ||
    a.odd - b.odd
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

  const threshold = thresholds[type];

  const eligible = candidates
    .filter(item => item.success >= threshold)
    .slice()
    .sort((a, b) => {
      if (type === "safe") {
        return b.success - a.success ||
          b.sample - a.sample ||
          a.odd - b.odd;
      }

      if (type === "medium") {
        return b.success - a.success ||
          b.odd - a.odd ||
          b.sample - a.sample;
      }

      return b.odd - a.odd ||
        b.success - a.success ||
        b.sample - a.sample;
    });

  const selected = [];
  const usedMatches = new Set();
  let totalOdd = 1;

  for (const candidate of eligible) {
    const matchId = [
      dateKey(candidate.match.date),
      candidate.match.time ?? "",
      candidate.match.home ?? "",
      candidate.match.away ?? ""
    ].join("|");

    // Aynı maçtan bir kupona birden fazla seçim eklenmez.
    if (usedMatches.has(matchId)) continue;

    if (selected.length >= MAX_MATCHES) break;

    selected.push(candidate);
    usedMatches.add(matchId);
    totalOdd *= candidate.odd;

    if (totalOdd >= MIN_TOTAL_ODDS) break;
  }

  if (!selected.length || totalOdd < MIN_TOTAL_ODDS) {
    return {
      type,
      items: [],
      totalOdd: 0,
      message: `Toplam oran ${formatOdd(MIN_TOTAL_ODDS)} seviyesine ulaşan uygun seçim bulunamadı.`
    };
  }

  return {
    type,
    items: selected,
    totalOdd,
    message: ""
  };
}

function couponStatus(coupon) {
  if (!coupon.items.length) return "empty";

  let pending = false;

  for (const item of coupon.items) {
    const score = fullScore(item.match);

    if (!score) {
      pending = true;
      continue;
    }

    const result = marketOutcome(item.match, item.market);

    if (result === false) return "lost";
    if (result === null) pending = true;
  }

  return pending ? "pending" : "won";
}

function couponStatusLabel(status) {
  return {
    won: "Kazandı",
    lost: "Kaybetti",
    pending: "Bekliyor",
    empty: "Uygun kupon yok"
  }[status] || "Bekliyor";
}

/* =========================================================
   CSS
========================================================= */

function installStyles() {
  if (document.getElementById("mk-coupon-styles")) return;

  const style = document.createElement("style");
  style.id = "mk-coupon-styles";

  style.textContent = `
    #mk-coupon-root {
      width: 100%;
      color: #e7eef8;
      font-family: inherit;
    }

    #mk-coupon-root * {
      box-sizing: border-box;
    }

    #mk-coupon-root .mk-panel {
      margin: 12px 0;
      padding: 14px;
      border: 1px solid #20344d;
      border-radius: 14px;
      background: #0e1b2b;
    }

    #mk-coupon-root .mk-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    #mk-coupon-root .mk-title {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
    }

    #mk-coupon-root .mk-muted {
      color: #9eb0c8;
      font-size: 11px;
      line-height: 1.5;
    }

    #mk-coupon-root .mk-controls {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 9px;
      margin-top: 14px;
    }

    #mk-coupon-root input[type="date"] {
      min-height: 42px;
      max-width: 100%;
      padding: 9px 10px;
      border: 1px solid #304760;
      border-radius: 9px;
      background: #091321;
      color: #e7eef8;
    }

    #mk-coupon-root button {
      min-height: 40px;
      padding: 9px 13px;
      border: 1px solid #36516e;
      border-radius: 9px;
      background: #18304b;
      color: #e7eef8;
      font-weight: 800;
      cursor: pointer;
    }

    #mk-coupon-root button:disabled {
      opacity: .6;
      cursor: wait;
    }

    #mk-coupon-root .mk-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }

    #mk-coupon-root .mk-stat {
      min-width: 0;
      padding: 12px;
      border: 1px solid #20344d;
      border-radius: 11px;
      background: #091624;
    }

    #mk-coupon-root .mk-stat-value {
      font-size: 22px;
      font-weight: 900;
    }

    #mk-coupon-root .mk-stat-label {
      margin-top: 4px;
      color: #9eb0c8;
      font-size: 10px;
      line-height: 1.4;
    }

    #mk-coupon-root .mk-coupon-title {
      font-size: 16px;
      font-weight: 900;
    }

    #mk-coupon-root .mk-row {
      margin-top: 9px;
      padding: 12px;
      border: 1px solid #20344d;
      border-radius: 11px;
      background: #091624;
    }

    #mk-coupon-root .mk-match {
      font-size: 13px;
      font-weight: 850;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    #mk-coupon-root .mk-market {
      margin-top: 4px;
      color: #9eb0c8;
      font-size: 11px;
    }

    #mk-coupon-root .mk-row-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      font-size: 12px;
    }

    #mk-coupon-root .mk-odd {
      font-size: 17px;
      font-weight: 900;
    }

    #mk-coupon-root .mk-status {
      display: inline-block;
      padding: 5px 8px;
      border-radius: 7px;
      font-size: 10px;
      font-weight: 900;
    }

    #mk-coupon-root .mk-won {
      background: #123b2b;
      color: #67e5a5;
    }

    #mk-coupon-root .mk-lost {
      background: #451f2a;
      color: #ff8795;
    }

    #mk-coupon-root .mk-pending {
      background: #473719;
      color: #ffd16a;
    }

    #mk-coupon-root .mk-empty {
      padding: 12px 0;
      color: #9eb0c8;
      font-size: 12px;
      line-height: 1.6;
    }

    #mk-coupon-root .mk-total {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 13px;
      padding-top: 13px;
      border-top: 1px solid #20344d;
      font-size: 14px;
      font-weight: 900;
    }

    #mk-coupon-root .mk-error {
      padding: 12px;
      border: 1px solid #713b48;
      border-radius: 10px;
      background: #2b1520;
      color: #ffabb6;
      font-size: 12px;
      line-height: 1.6;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    @media (max-width: 440px) {
      #mk-coupon-root .mk-summary {
        gap: 6px;
      }

      #mk-coupon-root .mk-stat {
        padding: 9px 7px;
      }

      #mk-coupon-root .mk-stat-value {
        font-size: 19px;
      }

      #mk-coupon-root .mk-stat-label {
        font-size: 9px;
      }

      #mk-coupon-root .mk-panel {
        padding: 11px;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   ARAYÜZ
========================================================= */

function ensureRoot() {
  let root = document.getElementById("mk-coupon-root");

  if (root) return root;

  root = document.createElement("section");
  root.id = "mk-coupon-root";
  document.body.appendChild(root);

  return root;
}

function renderShell() {
  const root = ensureRoot();

  root.innerHTML = `
    <div class="mk-panel">
      <div class="mk-header">
        <h2 class="mk-title">Mackolik Otomatik Kupon</h2>
        <span class="mk-muted">V2 veri kaynağı</span>
      </div>

      <div class="mk-controls">
        <label for="mk-coupon-date" class="mk-muted">Maç tarihi</label>
        <input id="mk-coupon-date" type="date" value="${escapeHtml(selectedDate)}">
        <button type="button" id="mk-coupon-refresh">Yenile</button>
      </div>

      <div id="mk-coupon-message" class="mk-muted" style="margin-top:10px">
        ${isLoading ? "Veriler yükleniyor..." : ""}
      </div>

      <div id="mk-coupon-content"></div>
    </div>
  `;

  root.querySelector("#mk-coupon-date").addEventListener("change", event => {
    selectedDate = event.target.value || localDateValue(new Date());
    renderCouponsForDate(selectedDate);
  });

  root.querySelector("#mk-coupon-refresh").addEventListener("click", () => {
    loadCouponData(true);
  });
}

function renderCouponCard(coupon, title, description) {
  const status = couponStatus(coupon);

  let html = `
    <div class="mk-panel">
      <div class="mk-header">
        <div>
          <div class="mk-coupon-title">${escapeHtml(title)}</div>
          <div class="mk-muted">${escapeHtml(description)}</div>
        </div>

        <span class="mk-status mk-${status}">
          ${escapeHtml(couponStatusLabel(status))}
        </span>
      </div>
  `;

  if (!coupon.items.length) {
    html += `
      <div class="mk-empty">
        ${escapeHtml(coupon.message || "Bu kategori için uygun seçim bulunamadı.")}
      </div>
    `;

    return html + "</div>";
  }

  for (const item of coupon.items) {
    const score = fullScore(item.match);
    const scoreText = score
      ? `${score.home}-${score.away}`
      : "Skor bekleniyor";

    html += `
      <div class="mk-row">
        <div class="mk-match">${escapeHtml(item.matchName)}</div>

        <div class="mk-market">
          ${escapeHtml(item.league)}
          ${item.time ? " · " + escapeHtml(item.time) : ""}
        </div>

        <div class="mk-row-bottom">
          <span>${escapeHtml(item.marketLabel)}</span>
          <span class="mk-odd">${formatOdd(item.odd)}</span>
        </div>

        <div class="mk-row-bottom">
          <span class="mk-muted">
            Geçmiş ${item.sample} maç · Başarı %${item.success.toFixed(1)}
          </span>
          <span class="mk-muted">${escapeHtml(scoreText)}</span>
        </div>
      </div>
    `;
  }

  html += `
      <div class="mk-total">
        <span>Toplam oran</span>
        <span>${formatOdd(coupon.totalOdd)}</span>
      </div>
    </div>
  `;

  return html;
}

function renderCouponsForDate(dateValue = selectedDate) {
  selectedDate = dateValue || localDateValue(new Date());

  const root = ensureRoot();
  const content = root.querySelector("#mk-coupon-content");
  const message = root.querySelector("#mk-coupon-message");
  const dateInput = root.querySelector("#mk-coupon-date");

  if (dateInput && dateInput.value !== selectedDate) {
    dateInput.value = selectedDate;
  }

  if (!content) return [];

  if (loadError) {
    content.innerHTML = `
      <div class="mk-error">
        ${escapeHtml(loadError)}
      </div>
    `;

    if (message) message.textContent = "Veri yükleme hatası.";

    return [];
  }

  if (!allMatches.length) {
    content.innerHTML = `
      <div class="mk-empty">
        JSON dosyasında maç bulunamadı.
      </div>
    `;

    if (message) message.textContent = "Veri bulunamadı.";

    return [];
  }

  const targetDate = parseDate(selectedDate);

  if (!targetDate) {
    content.innerHTML = `
      <div class="mk-error">Lütfen geçerli bir tarih seç.</div>
    `;

    return [];
  }

  const targetKey = localDateValue(targetDate);
  const dailyMatches = matchesByDate.get(targetKey) || [];
  const candidates = getCandidatesForDate(selectedDate);

  const safe = buildCoupon(candidates, "safe");
  const medium = buildCoupon(candidates, "medium");
  const risk = buildCoupon(candidates, "risk");

  const playedCount = dailyMatches.filter(isPlayed).length;
  const pendingCount = dailyMatches.length - playedCount;

  if (message) {
    message.textContent =
      `${formatDate(selectedDate)} · ${dailyMatches.length} maç · ` +
      `${candidates.length} uygun seçim · ${allMatches.length} toplam kayıt`;
  }

  content.innerHTML = `
    <div class="mk-summary">
      <div class="mk-stat">
        <div class="mk-stat-value">${dailyMatches.length}</div>
        <div class="mk-stat-label">Seçilen gündeki maç</div>
      </div>

      <div class="mk-stat">
        <div class="mk-stat-value">${candidates.length}</div>
        <div class="mk-stat-label">Uygun oran seçimi</div>
      </div>

      <div class="mk-stat">
        <div class="mk-stat-value">${pendingCount}</div>
        <div class="mk-stat-label">Skoru olmayan maç</div>
      </div>
    </div>

    ${renderCouponCard(
      safe,
      "Güvenli Kupon",
      "En az %90 geçmiş başarı oranı"
    )}

    ${renderCouponCard(
      medium,
      "Orta Riskli Kupon",
      "En az %85 geçmiş başarı oranı"
    )}

    ${renderCouponCard(
      risk,
      "Riskli Kupon",
      "En az %80 geçmiş başarı oranı"
    )}

    <div class="mk-muted" style="padding:4px 2px">
      Son ${HISTORY_DAYS} gün · En az ${MIN_SAMPLE} örnek ·
      Minimum tekli oran ${formatOdd(MIN_ODD)} ·
      Minimum kupon oranı ${formatOdd(MIN_TOTAL_ODDS)} ·
      Maksimum ${MAX_MATCHES} maç
    </div>
  `;

  return candidates;
}

/* =========================================================
   VERİ YÜKLEME
========================================================= */

async function loadCouponData(force = false) {
  if (isLoading) return;

  isLoading = true;
  loadError = "";

  renderShell();

  const root = ensureRoot();
  const message = root.querySelector("#mk-coupon-message");

  if (message) {
    message.textContent = "Veriler yükleniyor...";
  }

  /*
    Tarayıcının yükleniyor yazısını çizmesine fırsat ver.
    Ardından JSON'u ve analiz indekslerini hazırla.
  */
  await new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });

  try {
    const dataUrl = new URL(DATA_URL, document.baseURI);

    if (force) {
      dataUrl.searchParams.set("_", String(Date.now()));
    }

    const response = await fetch(dataUrl.href, {
      cache: force ? "no-store" : "default"
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}\n` +
        `İstenen dosya: ${dataUrl.href}`
      );
    }

    const contentType = response.headers.get("content-type") || "";

    let json;

    try {
      json = await response.json();
    } catch {
      throw new Error(
        "Yanıt geçerli JSON değil. Dosya yolu yanlış olabilir veya sunucu HTML hata sayfası döndürmüş olabilir.\n" +
        `İstenen dosya: ${dataUrl.href}\n` +
        `Content-Type: ${contentType || "belirtilmemiş"}`
      );
    }

    let matches;

    if (Array.isArray(json)) {
      matches = json;
    } else if (Array.isArray(json.matches)) {
      matches = json.matches;
    } else {
      throw new Error(
        'JSON içinde "matches" dizisi bulunamadı. Beklenen yapı: { "matches": [...] }'
      );
    }

    allMatches = matches.filter(match => {
      return match &&
        typeof match === "object" &&
        dateKey(match.date);
    });

    if (!allMatches.length) {
      throw new Error(
        "JSON yüklendi ama geçerli tarih içeren maç kaydı bulunamadı."
      );
    }

    buildDateIndex();

    // Veri yüklendiğinde analizi ayrı bir çizim turunda çalıştır.
    await new Promise(resolve => {
      requestAnimationFrame(() => resolve());
    });

    isLoading = false;
    renderCouponsForDate(selectedDate);

  } catch (error) {
    loadError =
      "Veriler yüklenemedi.\n\n" +
      (error?.message || String(error)) +
      "\n\nKontrol et: kupon.html ve data/v2-data.json doğru konumda mı?";

    isLoading = false;
    renderCouponsForDate(selectedDate);
  }
}

/* =========================================================
   DIŞARIDAN KULLANIM
========================================================= */

window.getCouponsForDate = function (date) {
  const candidates = getCandidatesForDate(date);

  return {
    candidates,
    safe: buildCoupon(candidates, "safe"),
    medium: buildCoupon(candidates, "medium"),
    risk: buildCoupon(candidates, "risk")
  };
};

window.renderCouponsForDate = renderCouponsForDate;

window.reloadCouponData = function () {
  return loadCouponData(true);
};

/* =========================================================
   BAŞLAT
========================================================= */

function initCouponEngine() {
  installStyles();
  renderShell();
  loadCouponData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCouponEngine, {
    once: true
  });
} else {
  initCouponEngine();
}
