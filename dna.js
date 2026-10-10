
"use strict";

/* =========================================================
   DNA — SONUÇTAN ORAN ANALİZİ + KUPON YÖNETİMİ

   Geçmiş: 30 gün
   Minimum örnek: 8
   Minimum başarı: %80
   Oran eşleşmesi: Birebir
   Kupon minimum oran: 1.35
   Kupon minimum toplam oran: 2.00
   Kupon başına maksimum maç: 5
   Maksimum kayıtlı kupon: 3
   Aynı maç aynı kuponda tekrar kullanılamaz
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

const DNA_MARKETS = [
  { id: "iy15Alt", label: "İY 1.5 Alt", fields: ["iy15Alt", "iy15A", "iy_15_alt", "IY15Alt"], result: "IY15_ALT", type: "ht" },
  { id: "iy15Ust", label: "İY 1.5 Üst", fields: ["iy15Ust", "iy15U", "iy_15_ust", "IY15Ust"], result: "IY15_UST", type: "ht" },
  { id: "iy1", label: "İY1", fields: ["iy1", "IY1"], result: "IY1", type: "ht" },
  { id: "iyX", label: "İYX", fields: ["iyX", "iyx", "IYX"], result: "IYX", type: "ht" },
  { id: "iy2", label: "İY2", fields: ["iy2", "IY2"], result: "IY2", type: "ht" },
  { id: "kgVar", label: "KG Var", fields: ["kgVar", "kgvar", "KGVar"], result: "KG_VAR", type: "ft" },
  { id: "kgYok", label: "KG Yok", fields: ["kgYok", "kgyok", "KGYok"], result: "KG_YOK", type: "ft" },
  { id: "iyKgVar", label: "İY KG Var", fields: ["iyKgVar", "iyKGVar", "iykgVar", "IYKGVar"], result: "IY_KG_VAR", type: "ht" },
  { id: "iyKgYok", label: "İY KG Yok", fields: ["iyKgYok", "iyKGYok", "iykgYok", "IYKGYok"], result: "IY_KG_YOK", type: "ht" },
  { id: "ms15Alt", label: "1.5 Alt", fields: ["au15Alt", "ms15Alt", "1.5Alt"], result: "15_ALT", type: "ft" },
  { id: "ms15Ust", label: "1.5 Üst", fields: ["au15Ust", "ms15Ust", "1.5Ust"], result: "15_UST", type: "ft" },
  { id: "ms25Ust", label: "2.5 Üst", fields: ["au25Ust", "ms25Ust", "2.5Ust"], result: "25_UST", type: "ft" },
  { id: "ms1", label: "MS1", fields: ["ms1", "MS1"], result: "MS1", type: "ft" },
  { id: "msX", label: "MSX", fields: ["msX", "msx", "MSX"], result: "MSX", type: "ft" },
  { id: "ms2", label: "MS2", fields: ["ms2", "MS2"], result: "MS2", type: "ft" }
];

const DNA_RESULTS = {
  MS1: { label: "MS1", type: "ft", test: s => s.home > s.away },
  MSX: { label: "MSX", type: "ft", test: s => s.home === s.away },
  MS2: { label: "MS2", type: "ft", test: s => s.away > s.home },
  IY1: { label: "İY1", type: "ht", test: s => s.home > s.away },
  IYX: { label: "İYX", type: "ht", test: s => s.home === s.away },
  IY2: { label: "İY2", type: "ht", test: s => s.away > s.home },
  KG_VAR: { label: "KG Var", type: "ft", test: s => s.home > 0 && s.away > 0 },
  KG_YOK: { label: "KG Yok", type: "ft", test: s => s.home === 0 || s.away === 0 },
  IY_KG_VAR: { label: "İY KG Var", type: "ht", test: s => s.home > 0 && s.away > 0 },
  IY_KG_YOK: { label: "İY KG Yok", type: "ht", test: s => s.home === 0 || s.away === 0 },
  IY15_ALT: { label: "İY 1.5 Alt", type: "ht", test: s => s.home + s.away <= 1 },
  IY15_UST: { label: "İY 1.5 Üst", type: "ht", test: s => s.home + s.away >= 2 },
  "15_ALT": { label: "1.5 Alt", type: "ft", test: s => s.home + s.away <= 1 },
  "15_UST": { label: "1.5 Üst", type: "ft", test: s => s.home + s.away >= 2 },
  "25_UST": { label: "2.5 Üst", type: "ft", test: s => s.home + s.away >= 3 }
};

let dnaMatches = [];
let dnaAnalysisRows = [];
let dnaSelectedPicks = [];
let dnaSavedCoupons = [];

const $ = id => document.getElementById(id);

function dnaEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dnaNormalizeOdd(value) {
  if (value === null || value === undefined || value === "") return null;

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
  for (const value of [
    match?.date,
    match?.matchDate,
    match?.gameDate,
    match?.tarih,
    match?.datetime,
    match?.dateTime
  ]) {
    const parsed = dnaParseDate(value);
    if (parsed) return parsed;
  }

  return null;
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
  if (side === "home") {
    return match?.homeTeam ?? match?.home ?? match?.homeName ??
      match?.ev ?? match?.evSahibi ?? "-";
  }

  return match?.awayTeam ?? match?.away ?? match?.awayName ??
    match?.dep ?? match?.deplasman ?? "-";
}

function dnaLeague(match) {
  return match?.league ?? match?.leagueName ??
    match?.lig ?? match?.competition ?? "-";
}

function dnaTime(match) {
  for (const value of [
    match?.time,
    match?.matchTime,
    match?.startTime,
    match?.hour,
    match?.saat
  ]) {
    if (!value) continue;

    const found = String(value).match(/(\d{1,2}):(\d{2})/);
    if (found) return `${found[1].padStart(2, "0")}:${found[2]}`;
  }

  return "--:--";
}

function dnaParseScore(value) {
  if (value === null || value === undefined || value === "") return null;

  const match = String(value).trim().match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!match) return null;

  return { home: Number(match[1]), away: Number(match[2]) };
}

function dnaScore(match, type) {
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
    const score = dnaParseScore(value);
    if (score) return score;
  }

  return null;
}

function dnaPlayed(match) {
  return dnaScore(match, "ft") !== null;
}

function dnaOdds(match, market) {
  const containers = [
    match,
    match?.openingOdds,
    match?.openOdds,
    match?.odds,
    match?.opening,
    match?.oranlar,
    match?.opening_prices
  ];

  for (const container of containers) {
    if (!container || typeof container !== "object") continue;

    for (const field of market.fields) {
      if (!Object.prototype.hasOwnProperty.call(container, field)) continue;

      const odd = dnaNormalizeOdd(container[field]);
      if (odd !== null) return odd;
    }
  }

  return null;
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
  const score = dnaScore(match, definition.type);

  if (!score) {
    return { text: "Bekliyor", className: "sa-status-pending", score: "-" };
  }

  const success = definition.test(score);

  return {
    text: success ? "Başarılı" : "Başarısız",
    className: success ? "sa-status-success" : "sa-status-failed",
    score: `${score.home}-${score.away}`
  };
}

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

  throw new Error("JSON içinde maç listesi bulunamadı.");
}

/* =========================================================
   ANALİZ
   ========================================================= */

function dnaRunAnalysis(targetDate, resultId) {
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

      const key = `${market.id}|${odd}`;

      if (!targetIndex.has(key)) targetIndex.set(key, []);
      targetIndex.get(key).push(match);
    }
  }

  const groups = new Map();

  for (const match of history) {
    const result = dnaResult(match, resultId);
    if (result === null) continue;

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

      if (result) group.success++;
    }
  }

  const rows = [];

  for (const item of groups.values()) {
    if (item.total < DNA_CONFIG.MIN_SAMPLE) continue;

    item.rate = item.success / item.total * 100;
    if (item.rate < DNA_CONFIG.MIN_SUCCESS) continue;

    const future = targetIndex.get(`${item.marketId}|${item.odd}`) || [];
    if (!future.length) continue;

    item.future = future;
    rows.push(item);
  }

  rows.sort((a, b) =>
    b.rate - a.rate ||
    b.total - a.total ||
    Number(a.odd) - Number(b.odd)
  );

  return { history, rows };
}

/* =========================================================
   ANALİZ GÖRÜNÜMÜ
   ========================================================= */

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
    `<strong>${dnaEscape(definition.label)}</strong> için ` +
    `<strong>${analysis.rows.length}</strong> uygun oran bulundu. ` +
    `Geçmiş maç: <strong>${analysis.history.length}</strong> · ` +
    `Minimum örnek: <strong>${DNA_CONFIG.MIN_SAMPLE}</strong> · ` +
    `Minimum başarı: <strong>%${DNA_CONFIG.MIN_SUCCESS}</strong>`;

  if (!analysis.rows.length) {
    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          Seçilen tarihte, önceki ${DNA_CONFIG.HISTORY_DAYS} gün içinde
          en az ${DNA_CONFIG.MIN_SAMPLE} örneği ve en az
          %${DNA_CONFIG.MIN_SUCCESS} başarısı olan birebir eşleşme yok.
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

function dnaRenderMatches(row) {
  let html = `
    <div class="sa-details-title">
      <span>${dnaEscape(row.marketLabel)} · ${dnaEscape(row.odd)}</span>
      <strong>${row.rate.toFixed(1).replace(".0", "")}%</strong>
    </div>
  `;

  row.future.forEach((match, index) => {
    const id = `${row.marketId}-${dnaDateKey(match)}-${dnaTeam(match, "home")}-${dnaTeam(match, "away")}`;
    const pickId = `${id}-${row.odd}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const alreadyAdded = dnaSelectedPicks.some(pick => pick.id === pickId);

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
            ${dnaEscape(dnaLeague(match))} · ${dnaEscape(dnaFormatDate(dnaDateKey(match)))}
          </div>
        </div>

        <div class="sa-match-actions">
          <div class="sa-match-odd">
            ${dnaEscape(row.marketLabel)}
            <strong>${dnaEscape(row.odd)}</strong>
          </div>
          <button
            type="button"
            class="btn btn-secondary"
            data-dna-add="${dnaEscape(pickId)}"
            ${Number(row.odd) < DNA_CONFIG.MIN_ODD || alreadyAdded ? "disabled" : ""}
          >
            ${alreadyAdded ? "Eklendi" : "Kupona ekle"}
          </button>
        </div>
      </div>
    `;

    const pick = {
      id: pickId,
      date: dnaDateKey(match),
      time: dnaTime(match),
      home: dnaTeam(match, "home"),
      away: dnaTeam(match, "away"),
      league: dnaLeague(match),
      marketId: row.marketId,
      market: row.marketLabel,
      odd: Number(row.odd),
      rate: row.rate,
      sample: row.total,
      match
    };

    if (!window.dnaPickRegistry) window.dnaPickRegistry = {};
    window.dnaPickRegistry[pickId] = pick;
  });

  html += `
    <div class="sa-details-subtitle">
      Kupona eklemek için oranı en az ${DNA_CONFIG.MIN_ODD.toFixed(2)} olan
      tahminleri kullanın.
    </div>
  `;

  return html;
}

/* =========================================================
   KUPON
   ========================================================= */

function dnaTotalOdds(picks = dnaSelectedPicks) {
  return picks.reduce((total, pick) => total * Number(pick.odd), 1);
}

function dnaStake() {
  const input = $("misliInput");
  const value = Number(String(input?.value ?? "1").replace(",", "."));

  return Number.isFinite(value) && value > 0 ? value : 1;
}

function dnaRenderCoupon() {
  const items = $("couponItems");
  const countBadge = $("couponCountBadge");
  const totalOddsText = $("totalOddsText");
  const totalPayoutText = $("totalPayoutText");

  if (countBadge) countBadge.textContent = String(dnaSelectedPicks.length);
  if (totalOddsText) totalOddsText.textContent = dnaTotalOdds().toFixed(2);
  if (totalPayoutText) {
    totalPayoutText.textContent =
      (dnaTotalOdds() * dnaStake()).toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
  }

  if (!items) return;

  if (!dnaSelectedPicks.length) {
    items.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🎟️</div>
        <strong>Kupon boş</strong>
        <span>Analiz bölümünden “Kupona ekle” düğmesine basın.</span>
      </div>
    `;
    return;
  }

  items.innerHTML = dnaSelectedPicks.map((pick, index) => `
    <div class="sa-match">
      <div class="sa-match-time">${index + 1}</div>
      <div class="sa-match-info">
        <div class="sa-match-teams">
          ${dnaEscape(pick.home)} <span>vs</span> ${dnaEscape(pick.away)}
        </div>
        <div class="sa-match-meta">
          ${dnaEscape(pick.market)} · Başarı ${pick.rate.toFixed(1)}%
        </div>
      </div>
      <div class="sa-match-actions">
        <strong>${Number(pick.odd).toFixed(2)}</strong>
        <button type="button" class="btn btn-secondary" data-dna-remove="${dnaEscape(pick.id)}">
          Kaldır
        </button>
      </div>
    </div>
  `).join("");

  items.querySelectorAll("[data-dna-remove]").forEach(button => {
    button.addEventListener("click", () => {
      dnaSelectedPicks = dnaSelectedPicks.filter(
        pick => pick.id !== button.dataset.dnaRemove
      );
      dnaRenderCoupon();
      dnaRefreshAddButtons();
    });
  });
}

function dnaRefreshAddButtons() {
  document.querySelectorAll("[data-dna-add]").forEach(button => {
    const id = button.dataset.dnaAdd;
    const exists = dnaSelectedPicks.some(pick => pick.id === id);

    button.disabled = exists ||
      dnaSelectedPicks.length >= DNA_CONFIG.MAX_PICKS;

    button.textContent = exists ? "Eklendi" : "Kupona ekle";
  });
}

function dnaAddPick(pickId) {
  const registry = window.dnaPickRegistry || {};
  const pick = registry[pickId];

  if (!pick) return;

  if (Number(pick.odd) < DNA_CONFIG.MIN_ODD) {
    alert(`Kupon için minimum oran ${DNA_CONFIG.MIN_ODD.toFixed(2)} olmalıdır.`);
    return;
  }

  if (dnaSelectedPicks.some(item => item.id === pickId)) {
    alert("Bu tahmin zaten kuponda.");
    return;
  }

  if (dnaSelectedPicks.length >= DNA_CONFIG.MAX_PICKS) {
    alert(`Bir kupona en fazla ${DNA_CONFIG.MAX_PICKS} maç eklenebilir.`);
    return;
  }

  const sameMatch = dnaSelectedPicks.some(item =>
    item.date === pick.date &&
    item.home === pick.home &&
    item.away === pick.away
  );

  if (sameMatch) {
    alert("Aynı maçtan birden fazla tahmin aynı kupona eklenemez.");
    return;
  }

  dnaSelectedPicks.push(pick);
  dnaRenderCoupon();
  dnaRefreshAddButtons();
}

function dnaReadHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(DNA_CONFIG.STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function dnaWriteHistory() {
  try {
    localStorage.setItem(
      DNA_CONFIG.STORAGE_KEY,
      JSON.stringify(dnaSavedCoupons)
    );
  } catch (error) {
    console.error("Kupon geçmişi kaydedilemedi:", error);
    alert("Kupon geçmişi tarayıcıya kaydedilemedi.");
  }
}

function dnaSaveCoupon() {
  if (!dnaSelectedPicks.length) {
    alert("Kaydetmek için önce kupona maç ekleyin.");
    return;
  }

  if (dnaSelectedPicks.length > DNA_CONFIG.MAX_PICKS) {
    alert(`Kupon başına en fazla ${DNA_CONFIG.MAX_PICKS} maç eklenebilir.`);
    return;
  }

  const total = dnaTotalOdds();

  if (total < DNA_CONFIG.MIN_TOTAL_ODD) {
    alert(`Kupon toplam oranı en az ${DNA_CONFIG.MIN_TOTAL_ODD.toFixed(2)} olmalıdır.`);
    return;
  }

  if (dnaSavedCoupons.length >= DNA_CONFIG.MAX_SAVED_COUPONS) {
    alert(`En fazla ${DNA_CONFIG.MAX_SAVED_COUPONS} kupon kaydedilebilir. Yeni kupon için geçmişten birini silin.`);
    return;
  }

  const coupon = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    stake: dnaStake(),
    totalOdds: total,
    payout: total * dnaStake(),
    picks: dnaSelectedPicks.map(pick => ({
      id: pick.id,
      date: pick.date,
      time: pick.time,
      home: pick.home,
      away: pick.away,
      league: pick.league,
      marketId: pick.marketId,
      market: pick.market,
      odd: pick.odd,
      rate: pick.rate,
      sample: pick.sample
    }))
  };

  dnaSavedCoupons.unshift(coupon);
  dnaSavedCoupons = dnaSavedCoupons.slice(0, DNA_CONFIG.MAX_SAVED_COUPONS);
  dnaWriteHistory();
  dnaRenderHistory();

  alert("Kupon geçmişe kaydedildi.");
}

function dnaRenderHistory() {
  const container = $("couponHistory");
  if (!container) return;

  if (!dnaSavedCoupons.length) {
    container.innerHTML = "<div class=\"sa-empty\"><span>Henüz kayıtlı kupon yok.</span></div>";
    return;
  }

  container.innerHTML = dnaSavedCoupons.map((coupon, index) => `
    <div class="sa-match">
      <div class="sa-match-time">#${index + 1}</div>
      <div class="sa-match-info">
        <div class="sa-match-teams">
          ${coupon.picks.length} maç · Toplam oran ${Number(coupon.totalOdds).toFixed(2)}
        </div>
        <div class="sa-match-meta">
          ${dnaEscape(new Date(coupon.createdAt).toLocaleString("tr-TR"))}
          · Misli: ${Number(coupon.stake).toLocaleString("tr-TR")}
        </div>
      </div>
      <div class="sa-match-actions">
        <strong>${Number(coupon.payout).toLocaleString("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}</strong>
        <button type="button" class="btn btn-secondary" data-dna-delete-coupon="${dnaEscape(coupon.id)}">
          Sil
        </button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-dna-delete-coupon]").forEach(button => {
    button.addEventListener("click", () => {
      dnaSavedCoupons = dnaSavedCoupons.filter(
        coupon => coupon.id !== button.dataset.dnaDeleteCoupon
      );
      dnaWriteHistory();
      dnaRenderHistory();
    });
  });
}

async function dnaCopyCoupon() {
  if (!dnaSelectedPicks.length) {
    alert("Kopyalamak için önce kupona maç ekleyin.");
    return;
  }

  const text = [
    "DNA KUPONU",
    ...dnaSelectedPicks.map((pick, index) =>
      `${index + 1}. ${pick.home} - ${pick.away} | ${pick.market} ${Number(pick.odd).toFixed(2)} | Başarı ${pick.rate.toFixed(1)}%`
    ),
    `Maç sayısı: ${dnaSelectedPicks.length}`,
    `Toplam oran: ${dnaTotalOdds().toFixed(2)}`,
    `Misli: ${dnaStake()}`,
    `Tahmini tutar: ${(dnaTotalOdds() * dnaStake()).toFixed(2)}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    alert("Kupon kopyalandı.");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    alert(copied ? "Kupon kopyalandı." : "Kopyalama başarısız oldu.");
  }
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
    status.textContent = "Sonuç seçimi bulunamadı veya geçersiz.";
    return;
  }

  status.textContent = `${dnaFormatDate(targetDate)} analiz ediliyor...`;

  try {
    const analysis = dnaRunAnalysis(targetDate, resultId);
    dnaAnalysisRows = analysis.rows;
    dnaRenderAnalysis(resultId, targetDate, analysis);
  } catch (error) {
    console.error("DNA analiz hatası:", error);
    status.textContent = "Analiz sırasında hata oluştu.";

    if ($("saContent")) {
      $("saContent").innerHTML = `
        <div class="sa-empty">
          <div class="sa-empty-icon">⚠️</div>
          <strong>Analiz yapılamadı</strong>
          <span>Veri yapısını ve tarayıcı konsolunu kontrol edin.</span>
        </div>
      `;
    }
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

  if ($("misliInput")) {
    $("misliInput").addEventListener("input", dnaRenderCoupon);
  }

  if ($("btnSaveCoupon")) {
    $("btnSaveCoupon").addEventListener("click", dnaSaveCoupon);
  }

  if ($("btnCopyCoupon")) {
    $("btnCopyCoupon").addEventListener("click", dnaCopyCoupon);
  }

  if ($("btnClearCoupon")) {
    $("btnClearCoupon").addEventListener("click", () => {
      dnaSelectedPicks = [];
      dnaRenderCoupon();
      dnaRefreshAddButtons();
    });
  }

  if ($("btnClearHistory")) {
    $("btnClearHistory").addEventListener("click", () => {
      if (!dnaSavedCoupons.length) return;

      if (!confirm("Kayıtlı kupon geçmişi silinsin mi?")) return;

      dnaSavedCoupons = [];
      dnaWriteHistory();
      dnaRenderHistory();
    });
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-dna-add]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    dnaAddPick(button.dataset.dnaAdd);
  });

  dnaSavedCoupons = dnaReadHistory();
  dnaRenderHistory();
  dnaRenderCoupon();

  try {
    status.textContent = "Maç verileri yükleniyor...";
    dnaMatches = await dnaLoadData();

    if (!dnaMatches.length) {
      status.textContent = "Veri dosyasında maç bulunamadı.";
      return;
    }

    status.textContent = `${dnaMatches.length} maç yüklendi. Analiz hazırlanıyor...`;
    await dnaExecuteAnalysis();
  } catch (error) {
    console.error("DNA veri yükleme hatası:", error);
    status.textContent = "Veriler yüklenemedi. data/matches.json yolunu kontrol edin.";

    if ($("saContent")) {
      $("saContent").innerHTML = `
        <div class="sa-empty">
          <div class="sa-empty-icon">⚠️</div>
          <strong>Veriler yüklenemedi</strong>
          <span>data/matches.json dosyasının erişilebilir olduğunu ve JSON biçimini kontrol edin.</span>
        </div>
      `;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", dnaInit, { once: true });
} else {
  dnaInit();
}
