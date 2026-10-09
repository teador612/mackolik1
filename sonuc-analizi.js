"use strict";

/* =========================================================
   SONUÇTAN ORAN ANALİZİ
   ---------------------------------------------------------
   - V2 MOTORUNDAN BAĞIMSIZDIR
   - V2 TAHMİNLERİNE DOKUNMAZ
   - SON 30 GÜN
   - BİREBİR AÇILIŞ ORANI
   - ORAN TOLERANSI YOK
   - ORAN KOMBİNASYONU YOK
   - MİNİMUM ÖRNEK: 5
   - MİNİMUM BAŞARI: %80
   - SADECE %80 VE ÜZERİ GRUPLAR GÖSTERİLİR
   - TIKLANAN ORANDA OYNANMAMIŞ MAÇLARI GÖSTERİR
   ========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 30;
const MIN_SAMPLE = 8;
const MIN_SUCCESS = 90;


/* =========================================================
   MARKETLER
   ========================================================= */

const MARKETS = [
  {
    id: "iy15Alt",
    label: "İY 1.5 Alt",
    fields: [
      "iy15Alt",
      "iy15A",
      "iy_15_alt",
      "IY15Alt"
    ]
  },

  {
    id: "iy15Ust",
    label: "İY 1.5 Üst",
    fields: [
      "iy15Ust",
      "iy15U",
      "iy_15_ust",
      "IY15Ust"
    ]
  },

  {
    id: "iy1",
    label: "İY1",
    fields: [
      "iy1",
      "IY1"
    ]
  },

  {
    id: "iyX",
    label: "İYX",
    fields: [
      "iyX",
      "iyx",
      "IYX"
    ]
  },

  {
    id: "iy2",
    label: "İY2",
    fields: [
      "iy2",
      "IY2"
    ]
  },

  {
    id: "kgVar",
    label: "KG Var",
    fields: [
      "kgVar",
      "kgvar",
      "KGVar"
    ]
  },

  {
    id: "kgYok",
    label: "KG Yok",
    fields: [
      "kgYok",
      "kgyok",
      "KGYok"
    ]
  },

  {
    id: "iyKgVar",
    label: "İY KG Var",
    fields: [
      "iyKGVar",
      "iyKgVar",
      "iykgVar",
      "IYKGVar"
    ]
  },

  {
    id: "iyKgYok",
    label: "İY KG Yok",
    fields: [
      "iyKGYok",
      "iyKgYok",
      "iykgYok",
      "IYKGYok"
    ]
  },

  {
    id: "ms15Alt",
    label: "1.5 Alt",
    fields: [
      "au15Alt",
      "ms15Alt",
      "1.5Alt"
    ]
  },

  {
    id: "ms15Ust",
    label: "1.5 Üst",
    fields: [
      "au15Ust",
      "ms15Ust",
      "1.5Ust"
    ]
  },

  {
    id: "ms25Ust",
    label: "2.5 Üst",
    fields: [
      "au25Ust",
      "ms25Ust",
      "2.5Ust"
    ]
  },

  {
    id: "ms1",
    label: "MS1",
    fields: [
      "ms1",
      "MS1"
    ]
  },

  {
    id: "msX",
    label: "MSX",
    fields: [
      "msX",
      "msx",
      "MSX"
    ]
  },

  {
    id: "ms2",
    label: "MS2",
    fields: [
      "ms2",
      "MS2"
    ]
  }
];


/* =========================================================
   SONUÇLAR
   ========================================================= */

const RESULTS = {

  MS1: {
    label: "MS1",
    type: "ft",
    test: (s) => s.home > s.away
  },

  MSX: {
    label: "MSX",
    type: "ft",
    test: (s) => s.home === s.away
  },

  MS2: {
    label: "MS2",
    type: "ft",
    test: (s) => s.away > s.home
  },

  IY1: {
    label: "İY1",
    type: "ht",
    test: (s) => s.home > s.away
  },

  IYX: {
    label: "İYX",
    type: "ht",
    test: (s) => s.home === s.away
  },

  IY2: {
    label: "İY2",
    type: "ht",
    test: (s) => s.away > s.home
  },

  KG_VAR: {
    label: "KG Var",
    type: "ft",
    test: (s) =>
      s.home > 0 && s.away > 0
  },

  KG_YOK: {
    label: "KG Yok",
    type: "ft",
    test: (s) =>
      s.home === 0 || s.away === 0
  },

  IY_KG_VAR: {
    label: "İY KG Var",
    type: "ht",
    test: (s) =>
      s.home > 0 && s.away > 0
  },

  IY_KG_YOK: {
    label: "İY KG Yok",
    type: "ht",
    test: (s) =>
      s.home === 0 || s.away === 0
  },

  IY15_ALT: {
    label: "İY 1.5 Alt",
    type: "ht",
    test: (s) =>
      s.home + s.away <= 1
  },

  IY15_UST: {
    label: "İY 1.5 Üst",
    type: "ht",
    test: (s) =>
      s.home + s.away >= 2
  },

  "15_ALT": {
    label: "1.5 Alt",
    type: "ft",
    test: (s) =>
      s.home + s.away <= 1
  },

  "15_UST": {
    label: "1.5 Üst",
    type: "ft",
    test: (s) =>
      s.home + s.away >= 2
  },

  "25_UST": {
    label: "2.5 Üst",
    type: "ft",
    test: (s) =>
      s.home + s.away >= 3
  }
};


/* =========================================================
   YARDIMCILAR
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

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text = String(value)
    .trim()
    .replace(",", ".");

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (number <= 0) {
    return null;
  }

  return number.toFixed(2);
}


function parseDateKey(value) {

  if (!value) {
    return null;
  }

  const text = String(value).trim();

  let match = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );

  if (match) {

    const day =
      String(match[1]).padStart(2, "0");

    const month =
      String(match[2]).padStart(2, "0");

    const year = match[3];

    return `${year}-${month}-${day}`;
  }

  match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (match) {

    const year = match[1];

    const month =
      String(match[2]).padStart(2, "0");

    const day =
      String(match[3]).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

    const result =
      parseDateKey(value);

    if (result) {
      return result;
    }
  }

  return null;
}


function dateToNumber(dateKey) {

  const parts =
    String(dateKey)
      .split("-")
      .map(Number);

  if (parts.length !== 3) {
    return NaN;
  }

  return Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}


function addDays(dateKey, days) {

  const date =
    new Date(
      dateToNumber(dateKey)
    );

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getUTCDate()
    ).padStart(2, "0")
  ].join("-");
}


function todayKey() {

  const now = new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, "0"),
    String(
      now.getDate()
    ).padStart(2, "0")
  ].join("-");
}


function formatDate(dateKey) {

  if (!dateKey) {
    return "-";
  }

  const parts =
    dateKey.split("-");

  if (parts.length !== 3) {
    return dateKey;
  }

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}


/* =========================================================
   TAKIM / LİG / SAAT
   ========================================================= */

function getTeamName(match, side) {

  if (side === "home") {

    return (
      match?.homeTeam ??
      match?.home ??
      match?.homeName ??
      match?.ev ??
      match?.evSahibi ??
      "-"
    );
  }

  return (
    match?.awayTeam ??
    match?.away ??
    match?.awayName ??
    match?.dep ??
    match?.deplasman ??
    "-"
  );
}


function getLeague(match) {

  return (
    match?.league ??
    match?.leagueName ??
    match?.lig ??
    match?.competition ??
    "-"
  );
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

    if (!value) {
      continue;
    }

    const text =
      String(value).trim();

    const timeMatch =
      text.match(
        /(\d{1,2}):(\d{2})/
      );

    if (timeMatch) {

      return (
        String(
          timeMatch[1]
        ).padStart(2, "0") +
        ":" +
        timeMatch[2]
      );
    }
  }

  return "--:--";
}


/* =========================================================
   SKOR
   ========================================================= */

function parseScore(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text =
    String(value).trim();

  const match =
    text.match(
      /(\d+)\s*[-:]\s*(\d+)/
    );

  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}


function getScore(match, type) {

  const candidates =
    type === "ht"
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

    const score =
      parseScore(value);

    if (score) {
      return score;
    }
  }

  return null;
}


function isPlayed(match) {

  return Boolean(
    getScore(match, "ft")
  );
}


/* =========================================================
   ORAN BUL
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
      typeof container === "object"
    ) {
      return container;
    }
  }

  return null;
}


function getOdds(match, market) {

  const containers = [
    match,
    getOddsContainer(match)
  ];

  for (const container of containers) {

    if (!container) {
      continue;
    }

    for (const field of market.fields) {

      if (
        Object.prototype.hasOwnProperty.call(
          container,
          field
        )
      ) {

        const odd =
          normalizeOdd(
            container[field]
          );

        if (odd) {
          return odd;
        }
      }
    }
  }

  return null;
}


/* =========================================================
   SONUÇ TESTİ
   ========================================================= */

function getTargetResult(
  match,
  resultId
) {

  const definition =
    RESULTS[resultId];

  if (!definition) {
    return null;
  }

  const score =
    getScore(
      match,
      definition.type
    );

  if (!score) {
    return null;
  }

  return definition.test(score);
}


/* =========================================================
   VERİ
   ========================================================= */

let allMatches = [];


async function loadData() {

  const url =
    `${DATA_URL}?t=${Date.now()}`;

  const response =
    await fetch(
      url,
      {
        cache: "no-store"
      }
    );

  if (!response.ok) {

    throw new Error(
      `Veri alınamadı: ${response.status}`
    );
  }

  const json =
    await response.json();

  if (Array.isArray(json)) {
    return json;
  }

  if (
    json &&
    Array.isArray(json.matches)
  ) {
    return json.matches;
  }

  return [];
}


/* =========================================================
   GELECEK MAÇ İNDEKSİ
   ========================================================= */

function buildFutureIndex(
  matches,
  targetDate
) {

  const index = new Map();

  for (const match of matches) {

    const date =
      getDateKey(match);

    if (date !== targetDate) {
      continue;
    }

    if (isPlayed(match)) {
      continue;
    }

    for (const market of MARKETS) {

      const odd =
        getOdds(
          match,
          market
        );

      if (!odd) {
        continue;
      }

      const key =
        `${market.id}|${odd}`;

      if (!index.has(key)) {
        index.set(key, []);
      }

      index
        .get(key)
        .push(match);
    }
  }

  return index;
}


/* =========================================================
   ANALİZ
   ========================================================= */

function runAnalysis(
  targetDate,
  resultId
) {

  const startDate =
    addDays(
      targetDate,
      -HISTORY_DAYS
    );

  const history =
    allMatches.filter(
      (match) => {

        const date =
          getDateKey(match);

        if (!date) {
          return false;
        }

        if (
          date < startDate ||
          date >= targetDate
        ) {
          return false;
        }

        return isPlayed(match);
      }
    );

  const futureIndex =
    buildFutureIndex(
      allMatches,
      targetDate
    );

  const groups =
    new Map();

  for (const match of history) {

    const result =
      getTargetResult(
        match,
        resultId
      );

    if (result === null) {
      continue;
    }

    for (const market of MARKETS) {

      const odd =
        getOdds(
          match,
          market
        );

      if (!odd) {
        continue;
      }

      const key =
        `${market.id}|${odd}`;

      if (!groups.has(key)) {

        groups.set(
          key,
          {
            marketId: market.id,
            marketLabel: market.label,
            odd,
            total: 0,
            success: 0
          }
        );
      }

      const group =
        groups.get(key);

      group.total++;

      if (result) {
        group.success++;
      }
    }
  }

  const rows =
    Array.from(
      groups.values()
    )
    .filter(
      (item) => {

        if (
          item.total <
          MIN_SAMPLE
        ) {
          return false;
        }

        if (
          item.success <= 0
        ) {
          return false;
        }

        const rate =
          (
            item.success /
            item.total
          ) * 100;

        return rate >= MIN_SUCCESS;
      }
    );

  for (const row of rows) {

    row.rate =
      (
        row.success /
        row.total
      ) * 100;

    row.future =
      futureIndex.get(
        `${row.marketId}|${row.odd}`
      ) || [];
  }

  rows.sort(
    (a, b) => {

      if (
        b.rate !== a.rate
      ) {
        return b.rate - a.rate;
      }

      if (
        b.total !== a.total
      ) {
        return b.total - a.total;
      }

      if (
        b.success !== a.success
      ) {
        return b.success - a.success;
      }

      return (
        Number(a.odd) -
        Number(b.odd)
      );
    }
  );

  return {
    history,
    rows
  };
}


/* =========================================================
   YÜZDE
   ========================================================= */

function formatPercent(value) {

  return (
    Number(value)
      .toFixed(1)
      .replace(".0", "") +
    "%"
  );
}


/* =========================================================
   HTML
   ========================================================= */

function renderAnalysis(
  resultId,
  targetDate,
  analysis
) {

  const content =
    document.getElementById(
      "saContent"
    );

  const status =
    document.getElementById(
      "saStatus"
    );

  const period =
    document.getElementById(
      "saPeriod"
    );

  const historyCount =
    document.getElementById(
      "saHistoryCount"
    );

  const oddsCount =
    document.getElementById(
      "saOddsCount"
    );

  const result =
    RESULTS[resultId];

  period.textContent =
    `${formatDate(
      addDays(
        targetDate,
        -HISTORY_DAYS
      )
    )} - ${formatDate(
      addDays(
        targetDate,
        -1
      )
    )}`;

  historyCount.textContent =
    analysis.history.length;

  oddsCount.textContent =
    analysis.rows.length;

  status.innerHTML =
    `<strong>${escapeHtml(
      result.label
    )}</strong> için ` +
    `<strong>${analysis.rows.length}</strong> ` +
    `farklı birebir oran bulundu. ` +
    `Minimum örnek: <strong>${MIN_SAMPLE}</strong> · ` +
    `Minimum başarı: <strong>%${MIN_SUCCESS}</strong>`;

  if (!analysis.rows.length) {

    content.innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">🔎</div>
        <strong>Uygun oran bulunamadı</strong>
        <span>
          Son ${HISTORY_DAYS} gün içinde
          en az ${MIN_SAMPLE} örneğe sahip
          ve başarı oranı en az %${MIN_SUCCESS}
          olan birebir açılış oranı bulunamadı.
        </span>
      </div>
    `;

    return;
  }

  const marketMap =
    new Map();

  for (const row of analysis.rows) {

    if (!marketMap.has(
      row.marketId
    )) {

      marketMap.set(
        row.marketId,
        {
          label:
            row.marketLabel,
          rows: []
        }
      );
    }

    marketMap
      .get(row.marketId)
      .rows
      .push(row);
  }

  let html = "";

  for (const market of MARKETS) {

    const group =
      marketMap.get(
        market.id
      );

    if (!group) {
      continue;
    }

    html += `
      <section class="sa-market">

        <div class="sa-market-title">
          <span>
            ${escapeHtml(
              group.label
            )}
          </span>

          <span class="sa-market-count">
            ${group.rows.length} oran
          </span>
        </div>

        <div class="sa-row sa-head">
          <div>ORAN</div>
          <div>ÖRNEK</div>
          <div>
            ${escapeHtml(
              result.label
            )}
          </div>
          <div>BAŞARI</div>
          <div>GELECEK</div>
        </div>
    `;

    for (
      let index = 0;
      index < group.rows.length;
      index++
    ) {

      const row =
        group.rows[index];

      const futureCount =
        row.future.length;

      const rowId =
        `sa-${market.id}-${index}`
          .replace(
            /[^a-zA-Z0-9_-]/g,
            ""
          );

      html += `
        <div
          class="sa-row"
          data-row-id="${rowId}"
        >

          <div class="sa-odd">
            ${escapeHtml(row.odd)}
          </div>

          <div class="sa-value sa-sample">
            ${row.total}
          </div>

          <div class="sa-value sa-success">
            ${row.success}
          </div>

          <div class="sa-rate">
            ${formatPercent(row.rate)}
          </div>

          <div class="sa-expand">
            ${
              futureCount > 0
                ? `▶ ${futureCount} maç`
                : "Oynanmamış yok"
            }
          </div>

        </div>

        <div
          id="${rowId}"
          class="sa-details"
        >
          ${renderFutureMatches(
            row,
            result
          )}
        </div>
      `;
    }

    html += `
      </section>
    `;
  }

  content.innerHTML =
    html;

  bindRows();
}


/* =========================================================
   OYNANMAMIŞ MAÇLAR
   ========================================================= */

function renderFutureMatches(
  row,
  result
) {

  if (!row.future.length) {

    return `
      <div class="sa-empty sa-empty-small">
        Bu birebir oranla
        ${formatDate(
          document.getElementById(
            "saDate"
          ).value
        )}
        tarihinde oynanmamış maç
        bulunmuyor.
      </div>
    `;
  }

  let html = `
    <div class="sa-details-title">
      <span>
        ${escapeHtml(
          row.marketLabel
        )}
        ·
        ${escapeHtml(row.odd)}
      </span>

      <strong>
        ${formatPercent(
          row.rate
        )}
      </strong>
    </div>

    <div class="sa-details-subtitle">
      Aynı açılış oranına sahip
      oynanmamış maçlar
    </div>
  `;

  for (const match of row.future) {

    const home =
      getTeamName(
        match,
        "home"
      );

    const away =
      getTeamName(
        match,
        "away"
      );

    const league =
      getLeague(match);

    const time =
      getTime(match);

    html += `
      <div class="sa-match">

        <div class="sa-match-time">
          ${escapeHtml(time)}
        </div>

        <div class="sa-match-main">

          <div class="sa-match-teams">
            ${escapeHtml(home)}
            <span>vs</span>
            ${escapeHtml(away)}
          </div>

          <div class="sa-match-meta">
            ${escapeHtml(league)}
          </div>

        </div>

        <div class="sa-match-odd">
          ${escapeHtml(
            row.marketLabel
          )}
          <strong>
            ${escapeHtml(row.odd)}
          </strong>
        </div>

      </div>
    `;
  }

  return html;
}


/* =========================================================
   SATIR TIKLAMA
   ========================================================= */

function bindRows() {

  const rows =
    document.querySelectorAll(
      "#saContent .sa-row[data-row-id]"
    );

  rows.forEach(
    (row) => {

      row.addEventListener(
        "click",
        () => {

          const id =
            row.dataset.rowId;

          const details =
            document.getElementById(
              id
            );

          if (!details) {
            return;
          }

          const isOpen =
            details.classList.contains(
              "open"
            );

          document
            .querySelectorAll(
              "#saContent .sa-details.open"
            )
            .forEach(
              (item) =>
                item.classList.remove(
                  "open"
                )
            );

          document
            .querySelectorAll(
              "#saContent .sa-row.active"
            )
            .forEach(
              (item) =>
                item.classList.remove(
                  "active"
                )
            );

          if (!isOpen) {

            details.classList.add(
              "open"
            );

            row.classList.add(
              "active"
            );
          }
        }
      );
    }
  );
}


/* =========================================================
   ÇALIŞTIR
   ========================================================= */

async function executeAnalysis() {

  const resultSelect =
    document.getElementById(
      "saResult"
    );

  const dateInput =
    document.getElementById(
      "saDate"
    );

  const status =
    document.getElementById(
      "saStatus"
    );

  const resultId =
    resultSelect.value;

  const targetDate =
    dateInput.value;

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
      runAnalysis(
        targetDate,
        resultId
      );

    renderAnalysis(
      resultId,
      targetDate,
      analysis
    );

  } catch (error) {

    console.error(error);

    status.textContent =
      "Analiz sırasında hata oluştu.";

    document.getElementById(
      "saContent"
    ).innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Analiz yapılamadı</strong>
        <span>
          Veri yapısını kontrol edin.
        </span>
      </div>
    `;
  }
}


/* =========================================================
   BAŞLANGIÇ
   ========================================================= */

async function init() {

  const dateInput =
    document.getElementById(
      "saDate"
    );

  const runButton =
    document.getElementById(
      "saRun"
    );

  const status =
    document.getElementById(
      "saStatus"
    );

  dateInput.value =
    todayKey();

  runButton.addEventListener(
    "click",
    executeAnalysis
  );

  try {

    status.textContent =
      "Veriler yükleniyor...";

    allMatches =
      await loadData();

    status.innerHTML =
      `<strong>${allMatches.length}</strong> maç verisi yüklendi. ` +
      `Analiz hazırlanıyor...`;

    await executeAnalysis();

  } catch (error) {

    console.error(error);

    status.textContent =
      "Veriler yüklenemedi.";

    document.getElementById(
      "saContent"
    ).innerHTML = `
      <div class="sa-empty">
        <div class="sa-empty-icon">⚠️</div>
        <strong>Veriler yüklenemedi</strong>
        <span>
          data/v2-data.json kontrol edin.
        </span>
      </div>
    `;
  }
}


init();
