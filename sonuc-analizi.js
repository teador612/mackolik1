
"use strict";

/* =========================================================
   MACKOLIK KUPON MOTORU
   Veri kaynağı: ./data/v2-data.json

   - Yeni JSON yapısı: { updatedAt, count, matches: [...] }
   - Tarih seçimi
   - Son 60 gün geçmiş analizi
   - Birebir aynı açılış oranı eşleştirmesi
   - Minimum geçmiş maç: 8
   - Minimum başarı: %80
   - Minimum tekli oran: 1.35
   - Minimum toplam kupon oranı: 2.00
   - Kupon başına maksimum 5 maç
   - Güvenli / Orta / Riskli kuponlar
   - Kazandı / Kaybetti / Bekliyor durumları
   - Oran kombinasyonu veya yeni tahmin algoritması yok
========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 30;
const MIN_SAMPLE = 8;
const MIN_SUCCESS = 80;
const MIN_ODD = 1.35;
const MIN_TOTAL_ODDS = 2.00;
const MAX_MATCHES = 5;

const MARKET_DEFINITIONS = [
  { key: "ms1", label: "MS 1", test: (h, a) => h > a },
  { key: "msX", label: "MS X", test: (h, a) => h === a },
  { key: "ms2", label: "MS 2", test: (h, a) => h < a },

  { key: "iy1", label: "İY 1", test: (h, a, ih, ia) => ih > ia, half: true },
  { key: "iyX", label: "İY X", test: (h, a, ih, ia) => ih === ia, half: true },
  { key: "iy2", label: "İY 2", test: (h, a, ih, ia) => ih < ia, half: true },

  { key: "iy15Ust", label: "İY 1,5 Üst", test: (h, a, ih, ia) => ih + ia > 1.5, half: true },
  { key: "iy15Alt", label: "İY 1,5 Alt", test: (h, a, ih, ia) => ih + ia < 1.5, half: true },

  { key: "au15Ust", label: "MS 1,5 Üst", test: (h, a) => h + a > 1.5 },
  { key: "au15Alt", label: "MS 1,5 Alt", test: (h, a) => h + a < 1.5 },

  { key: "au25Ust", label: "MS 2,5 Üst", test: (h, a) => h + a > 2.5 },
  { key: "au25Alt", label: "MS 2,5 Alt", test: (h, a) => h + a < 2.5 },

  { key: "au35Ust", label: "MS 3,5 Üst", test: (h, a) => h + a > 3.5 },
  { key: "au35Alt", label: "MS 3,5 Alt", test: (h, a) => h + a < 3.5 },

  { key: "kgVar", label: "KG Var", test: (h, a) => h > 0 && a > 0 },
  { key: "kgYok", label: "KG Yok", test: (h, a) => h === 0 || a === 0 },

  { key: "iyKgVar", label: "İY KG Var", test: (h, a, ih, ia) => ih > 0 && ia > 0, half: true },
  { key: "iyKgYok", label: "İY KG Yok", test: (h, a, ih, ia) => ih === 0 || ia === 0, half: true },

  { key: "gol01", label: "0-1 Gol", test: (h, a) => h + a <= 1 },
  { key: "gol23", label: "2-3 Gol", test: (h, a) => h + a >= 2 && h + a <= 3 },
  { key: "gol46", label: "4-6 Gol", test: (h, a) => h + a >= 4 && h + a <= 6 },
  { key: "gol7", label: "7+ Gol", test: (h, a) => h + a >= 7 },

  { key: "cs1X", label: "ÇŞ 1X", test: (h, a) => h >= a },
  { key: "cs12", label: "ÇŞ 12", test: (h, a) => h !== a },
  { key: "csX2", label: "ÇŞ X2", test: (h, a) => h <= a }
];

let allMatches = [];
let selectedDate = toDateInputValue(new Date());
let isLoading = false;
let loadError = "";

const numberFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/* =========================================================
   TARİH VE VERİ YARDIMCILARI
========================================================= */

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value).trim();
  let year, month, day;
  let match;

  match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

    if (!match) return null;

    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

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
  return date ? toDateInputValue(date) : "";
}

function dateDifferenceInDays(later, earlier) {
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

  const match = String(value).trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);

  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function getFullTimeScore(match) {
  return parseScore(
    match.score ??
    match.fullTimeScore ??
    match.full_time_score ??
    match.ftScore ??
    match.ms
  );
}

function getHalfTimeScore(match) {
  return parseScore(
    match.halfTimeScore ??
    match.half_time_score ??
    match.htScore ??
    match.ht ??
    match.iy
  );
}

function isPlayed(match) {
  return getFullTimeScore(match) !== null;
}

function getOdd(match, key) {
  const value = match?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const odd = Number(value);

  return Number.isFinite(odd) && odd > 1 ? odd : null;
}

function formatOdd(value) {
  return numberFormat.format(value);
}

function formatDateLabel(value) {
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

/* =========================================================
   MAÇ BİLGİLERİ
========================================================= */

function getMatchName(match) {
  const home = match.home ?? match.homeTeam ?? match.ev ?? "Ev sahibi";
  const away = match.away ?? match.awayTeam ?? match.dep ?? "Deplasman";

  return `${home} - ${away}`;
}

function getMatchTime(match) {
  return match.time ?? match.hour ?? match.saat ?? "";
}

function getLeague(match) {
  return match.league ?? match.lig ?? "";
}

function getMarketOutcome(match, market) {
  const full = getFullTimeScore(match);

  if (!full) return null;

  let half = getHalfTimeScore(match);

  if (market.half && !half) return null;

  if (!half) {
    half = { home: 0, away: 0 };
  }

  try {
    const result = market.test(
      full.home,
      full.away,
      half.home,
      half.away
    );

    return typeof result === "boolean" ? result : null;
  } catch {
    return null;
  }
}

/* =========================================================
   GEÇMİŞ EŞLEŞTİRMESİ
========================================================= */

function getHistoricalMatches(targetMatch, targetDate) {
  const targetOddDate = parseDate(targetMatch.date);
  if (!targetOddDate) return [];

  const targetDateKey = dateKey(targetMatch.date);

  return allMatches.filter(match => {
    if (match === targetMatch) return false;
    if (!isPlayed(match)) return false;

    const matchDate = parseDate(match.date);
    if (!matchDate) return false;

    const matchKey = dateKey(match.date);

    // Seçilen tarihteki maçlar geçmişe dahil edilmez.
    if (!matchKey || matchKey >= dateKey(targetDate)) return false;

    const daysBack = dateDifferenceInDays(targetDate, matchDate);

    if (daysBack < 1 || daysBack > HISTORY_DAYS) return false;

    return true;
  });
}

function analyzeMarket(targetMatch, targetDate, market) {
  const targetOdd = getOdd(targetMatch, market.key);

  if (targetOdd === null || targetOdd < MIN_ODD) {
    return null;
  }

  const history = getHistoricalMatches(targetMatch, targetDate);
  let sample = 0;
  let wins = 0;

  for (const historicalMatch of history) {
    const historicalOdd = getOdd(historicalMatch, market.key);

    if (historicalOdd === null) continue;

    // Birebir aynı açılış oranı.
    if (Math.abs(historicalOdd - targetOdd) > 0.000001) {
      continue;
    }

    const outcome = getMarketOutcome(historicalMatch, market);

    if (outcome === null) continue;

    sample++;

    if (outcome) wins++;
  }

  if (sample < MIN_SAMPLE) return null;

  const success = (wins / sample) * 100;

  if (success < MIN_SUCCESS) return null;

  return {
    match: targetMatch,
    market,
    marketKey: market.key,
    marketLabel: market.label,
    odd: targetOdd,
    sample,
    wins,
    losses: sample - wins,
    success,
    date: targetMatch.date,
    time: getMatchTime(targetMatch),
    league: getLeague(targetMatch),
    matchName: getMatchName(targetMatch)
  };
}

/* =========================================================
   GÜNLÜK ADAYLAR
========================================================= */

function getCandidatesForDate(dateValue) {
  const targetDate = parseDate(dateValue);

  if (!targetDate) return [];

  const targetKey = toDateInputValue(targetDate);

  const dailyMatches = allMatches.filter(match => {
    return dateKey(match.date) === targetKey;
  });

  const candidates = [];

  for (const match of dailyMatches) {
    // Aynı maçta yalnızca mevcut JSON'da bulunan oran alanları incelenir.
    for (const market of MARKET_DEFINITIONS) {
      const odd = getOdd(match, market.key);

      if (odd === null || odd < MIN_ODD) continue;

      const analysis = analyzeMarket(match, targetDate, market);

      if (analysis) candidates.push(analysis);
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

function getCouponStatus(coupon) {
  if (!coupon.items.length) return "empty";

  let hasPending = false;

  for (const item of coupon.items) {
    const score = getFullTimeScore(item.match);

    if (!score) {
      hasPending = true;
      continue;
    }

    const outcome = getMarketOutcome(item.match, item.market);

    if (outcome === false) return "lost";
    if (outcome === null) hasPending = true;
  }

  if (hasPending) return "pending";

  return "won";
}

function getCouponStatusLabel(status) {
  const labels = {
    won: "Kazandı",
    lost: "Kaybetti",
    pending: "Bekliyor",
    empty: "Uygun kupon yok"
  };

  return labels[status] || "Bekliyor";
}

/* =========================================================
   ARAYÜZ
========================================================= */

function installCouponStyles() {
  if (document.getElementById("mk-coupon-styles")) return;

  const style = document.createElement("style");
  style.id = "mk-coupon-styles";

  style.textContent = `
    #mk-coupon-root {
      color: #e7eef8;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
    }

    #mk-coupon-root *,
    #mk-coupon-root *::before,
    #mk-coupon-root *::after {
      box-sizing: border-box;
    }

    #mk-coupon-root .mk-panel {
      background: #0e1b2b;
      border: 1px solid #20344d;
      border-radius: 14px;
      padding: 14px;
      margin: 12px 0;
    }

    #mk-coupon-root .mk-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    #mk-coupon-root .mk-title {
      font-size: 19px;
      font-weight: 800;
      margin: 0;
    }

    #mk-coupon-root .mk-muted {
      color: #9eb0c8;
      font-size: 12px;
    }

    #mk-coupon-root .mk-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 12px;
    }

    #mk-coupon-root input[type="date"] {
      background: #091321;
      color: #e7eef8;
      border: 1px solid #30455e;
      border-radius: 9px;
      padding: 10px;
      min-height: 40px;
      max-width: 100%;
    }

    #mk-coupon-root button {
      background: #18304b;
      color: #edf5ff;
      border: 1px solid #36516e;
      border-radius: 9px;
      padding: 9px 12px;
      font-weight: 700;
      cursor: pointer;
    }

    #mk-coupon-root button:disabled {
      opacity: .55;
      cursor: wait;
    }

    #mk-coupon-root .mk-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }

    #mk-coupon-root .mk-stat {
      background: #091624;
      border: 1px solid #20344d;
      border-radius: 10px;
      padding: 10px;
      min-width: 0;
    }

    #mk-coupon-root .mk-stat-value {
      font-size: 19px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    #mk-coupon-root .mk-stat-label {
      color: #9eb0c8;
      font-size: 11px;
      margin-top: 3px;
    }

    #mk-coupon-root .mk-coupon-title {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 10px;
    }

    #mk-coupon-root .mk-row {
      background: #091624;
      border: 1px solid #20344d;
      border-radius: 10px;
      padding: 11px;
      margin-top: 8px;
    }

    #mk-coupon-root .mk-match {
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    #mk-coupon-root .mk-market {
      color: #9eb0c8;
      font-size: 12px;
      margin-top: 5px;
    }

    #mk-coupon-root .mk-row-bottom {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: space-between;
      align-items: center;
      margin-top: 9px;
      font-size: 12px;
    }

    #mk-coupon-root .mk-odd {
      font-size: 16px;
      font-weight: 850;
    }

    #mk-coupon-root .mk-status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 800;
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
      color: #9eb0c8;
      font-size: 13px;
      padding: 10px 0;
    }

    #mk-coupon-root .mk-total {
      border-top: 1px solid #20344d;
      margin-top: 12px;
      padding-top: 12px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      font-weight: 800;
    }

    #mk-coupon-root .mk-error {
      color: #ff9aa6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 13px;
    }

    @media (max-width: 420px) {
      #mk-coupon-root .mk-summary {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureCouponRoot() {
  let root = document.getElementById("mk-coupon-root");

  if (root) return root;

  root = document.createElement("section");
  root.id = "mk-coupon-root";

  const preferredParent =
    document.getElementById("couponSection") ||
    document.getElementById("coupon-section") ||
    document.getElementById("coupons") ||
    document.getElementById("coupon-root");

  if (preferredParent && preferredParent !== root) {
    preferredParent.appendChild(root);
  } else {
    document.body.appendChild(root);
  }

  return root;
}

function renderCouponShell() {
  const root = ensureCouponRoot();

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
    selectedDate = event.target.value || toDateInputValue(new Date());
    renderCouponsForDate(selectedDate);
  });

  root.querySelector("#mk-coupon-refresh").addEventListener("click", async () => {
    await loadCouponData(true);
  });
}

function renderCouponCard(coupon, title, description) {
  const status = getCouponStatus(coupon);

  let html = `
    <div class="mk-panel">
      <div class="mk-header">
        <div>
          <div class="mk-coupon-title">${escapeHtml(title)}</div>
          <div class="mk-muted">${escapeHtml(description)}</div>
        </div>
        <span class="mk-status mk-${status}">
          ${escapeHtml(getCouponStatusLabel(status))}
        </span>
      </div>
  `;

  if (!coupon.items.length) {
    html += `<div class="mk-empty">${escapeHtml(coupon.message || "Bu kategori için uygun seçim bulunamadı.")}</div>`;
    html += `</div>`;
    return html;
  }

  for (const item of coupon.items) {
    const score = getFullTimeScore(item.match);
    const scoreText = score ? `${score.home}-${score.away}` : "Başlamadı / skor yok";

    html += `
      <div class="mk-row">
        <div class="mk-match">${escapeHtml(item.matchName)}</div>
        <div class="mk-market">
          ${escapeHtml(item.league)} ${item.time ? "· " + escapeHtml(item.time) : ""}
        </div>
        <div class="mk-row-bottom">
          <span>${escapeHtml(item.marketLabel)}</span>
          <span class="mk-odd">${formatOdd(item.odd)}</span>
        </div>
        <div class="mk-row-bottom">
          <span class="mk-muted">
            Geçmiş: ${item.sample} maç · Başarı: %${item.success.toFixed(1)}
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
  `;

  html += `</div>`;

  return html;
}

function renderCouponsForDate(dateValue = selectedDate) {
  selectedDate = dateValue || toDateInputValue(new Date());

  const root = ensureCouponRoot();
  const content = root.querySelector("#mk-coupon-content");
  const message = root.querySelector("#mk-coupon-message");
  const dateInput = root.querySelector("#mk-coupon-date");

  if (dateInput && dateInput.value !== selectedDate) {
    dateInput.value = selectedDate;
  }

  if (!content) return [];

  if (loadError) {
    content.innerHTML = `<div class="mk-error">${escapeHtml(loadError)}</div>`;
    if (message) message.textContent = "Veriler yüklenemedi.";
    return [];
  }

  if (!allMatches.length) {
    content.innerHTML = `<div class="mk-empty">Veri bulunamadı.</div>`;
    if (message) message.textContent = "JSON dosyasında maç kaydı bulunamadı.";
    return [];
  }

  const targetDate = parseDate(selectedDate);

  if (!targetDate) {
    content.innerHTML = `<div class="mk-error">Geçerli bir tarih seç.</div>`;
    return [];
  }

  const targetKey = toDateInputValue(targetDate);

  const dailyMatches = allMatches.filter(match => {
    return dateKey(match.date) === targetKey;
  });

  const candidates = getCandidatesForDate(selectedDate);

  const safeCoupon = buildCoupon(candidates, "safe");
  const mediumCoupon = buildCoupon(candidates, "medium");
  const riskCoupon = buildCoupon(candidates, "risk");

  const playedCount = dailyMatches.filter(isPlayed).length;
  const pendingCount = dailyMatches.length - playedCount;

  if (message) {
    message.textContent =
      `${formatDateLabel(selectedDate)} · ` +
      `${dailyMatches.length} maç · ` +
      `${candidates.length} uygun seçim`;
  }

  content.innerHTML = `
    <div class="mk-summary">
      <div class="mk-stat">
        <div class="mk-stat-value">${dailyMatches.length}</div>
        <div class="mk-stat-label">Seçilen gündeki maç</div>
      </div>
      <div class="mk-stat">
        <div class="mk-stat-value">${candidates.length}</div>
        <div class="mk-stat-label">Geçmiş analizini geçen seçim</div>
      </div>
      <div class="mk-stat">
        <div class="mk-stat-value">${pendingCount}</div>
        <div class="mk-stat-label">Skoru bulunmayan maç</div>
      </div>
    </div>

    ${renderCouponCard(
      safeCoupon,
      "Güvenli Kupon",
      "En az %90 geçmiş başarı oranı"
    )}

    ${renderCouponCard(
      mediumCoupon,
      "Orta Riskli Kupon",
      "En az %85 geçmiş başarı oranı"
    )}

    ${renderCouponCard(
      riskCoupon,
      "Riskli Kupon",
      "En az %80 geçmiş başarı oranı"
    )}

    <div class="mk-muted" style="padding:4px 2px">
      Analiz: son ${HISTORY_DAYS} gün · En az ${MIN_SAMPLE} geçmiş maç ·
      Tekli oran ≥ ${formatOdd(MIN_ODD)} ·
      Kupon oranı ≥ ${formatOdd(MIN_TOTAL_ODDS)} ·
      En fazla ${MAX_MATCHES} maç
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

  renderCouponShell();

  const message = document.querySelector("#mk-coupon-message");
  if (message) message.textContent = "Veriler yükleniyor...";

  try {
    const url = force
      ? `${DATA_URL}${DATA_URL.includes("?") ? "&" : "?"}_=${Date.now()}`
      : DATA_URL;

    const response = await fetch(url, {
      cache: force ? "no-store" : "default"
    });

    if (!response.ok) {
      throw new Error(`JSON yükleme hatası: HTTP ${response.status}`);
    }

    const json = await response.json();

    if (Array.isArray(json)) {
      allMatches = json;
    } else if (Array.isArray(json.matches)) {
      allMatches = json.matches;
    } else {
      throw new Error('JSON içinde "matches" dizisi bulunamadı.');
    }

    allMatches = allMatches.filter(match => {
      return match && typeof match === "object" && parseDate(match.date);
    });

    renderCouponsForDate(selectedDate);
  } catch (error) {
    loadError =
      `Veriler yüklenemedi.\n` +
      `Kontrol et: ${DATA_URL}\n\n` +
      `${error?.message || error}`;

    renderCouponsForDate(selectedDate);
  } finally {
    isLoading = false;
  }
}

/* =========================================================
   DIŞARIDAN ÇAĞRILABİLEN FONKSİYONLAR
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
  installCouponStyles();
  renderCouponShell();
  loadCouponData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCouponEngine, { once: true });
} else {
  initCouponEngine();
}
