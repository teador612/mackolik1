// basketball-app.js

const HISTORY_URL = "./data/basketball-history.json";

const TODAY_API =
  "https://www.bilyoner.com/api/mobile/live-score/event/v2/basketball";

// =====================================================
// AYARLAR
// =====================================================

// Yeterli geçmiş yoksa maç gösterilmez.
const MIN_SAMPLE = 3;

// Alt/Üst çizgileri.
// İstersen daha sonra bunları gerçek bahis oranlarındaki
// maç çizgilerine göre otomatikleştirebiliriz.
const TOTAL_LINE = 160.5;
const FIRST_HALF_LINE = 80.5;

// Minimum tahmin güveni
const MIN_CONFIDENCE = 55;

// Kaç son maç kullanılacak
const FORM_MATCHES = 5;


// =====================================================
// GLOBAL
// =====================================================

let history = [];
let todayMatches = [];


// =====================================================
// YARDIMCILAR
// =====================================================

function normalizeName(value = "") {
  return String(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}


function cleanName(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}


function getDate(value) {
  if (!value) return "";

  const s = String(value);

  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);

  if (iso) {
    return iso[1];
  }

  const tr = s.match(
    /^(\d{2})[./-](\d{2})[./-](\d{4})/
  );

  if (tr) {
    return `${tr[3]}-${tr[2]}-${tr[1]}`;
  }

  return "";
}


function today() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}


function parseScore(value) {
  if (value == null) return null;

  if (typeof value === "string") {
    const m = value.match(
      /(\d+)\s*[-:]\s*(\d+)/
    );

    if (!m) return null;

    return {
      home: Number(m[1]),
      away: Number(m[2])
    };
  }

  if (typeof value === "object") {
    const home = Number(
      value.home ??
      value.homeScore ??
      value.homeTeamScore
    );

    const away = Number(
      value.away ??
      value.awayScore ??
      value.awayTeamScore
    );

    if (
      Number.isFinite(home) &&
      Number.isFinite(away)
    ) {
      return {
        home,
        away
      };
    }
  }

  return null;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// GEÇMİŞ VERİSİNİ OKU
// =====================================================

async function loadHistory() {

  const response = await fetch(
    `${HISTORY_URL}?v=${Date.now()}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Geçmiş veri HTTP ${response.status}`
    );
  }

  const data = await response.json();

  let rows = [];

  if (Array.isArray(data)) {
    rows = data;
  }
  else if (Array.isArray(data.matches)) {
    rows = data.matches;
  }
  else if (Array.isArray(data.data)) {
    rows = data.data;
  }

  history = rows
    .map(normalizeHistory)
    .filter(Boolean);

  console.log(
    `🏀 Geçmiş: ${history.length} maç`
  );
}


// =====================================================
// GEÇMİŞ MAÇ NORMALİZASYONU
// =====================================================

function normalizeHistory(match) {

  const home = cleanName(
    match.homeTeam ??
    match.home ??
    match.homeName
  );

  const away = cleanName(
    match.awayTeam ??
    match.away ??
    match.awayName
  );

  if (!home || !away) {
    return null;
  }

  const date =
    getDate(match.date) ||
    getDate(match.matchDate) ||
    getDate(match.startDate);

  if (!date) {
    return null;
  }

  const score =
    parseScore(match.score) ||
    parseScore(match.fullScore) ||
    parseScore(match.finalScore);

  if (!score) {
    return null;
  }

  // İlk yarı
  const half =
    parseScore(match.halfTimeScore) ||
    parseScore(match.halfScore) ||
    parseScore(match.firstHalfScore);

  return {

    id:
      match.id ??
      match.sbsEventId ??
      `${date}-${home}-${away}`,

    date,

    league:
      match.league ??
      match.competition ??
      match.leagueName ??
      "",

    home,

    away,

    homeKey: normalizeName(home),

    awayKey: normalizeName(away),

    homeScore: score.home,

    awayScore: score.away,

    total:
      score.home +
      score.away,

    halfHome:
      half
        ? half.home
        : null,

    halfAway:
      half
        ? half.away
        : null,

    halfTotal:
      half
        ? half.home + half.away
        : null

  };
}


// =====================================================
// BİLYONER BUGÜN
// =====================================================

async function loadTodayMatches() {

  const date = today();

  const response = await fetch(
    `${TODAY_API}?date=${date}`,
    {
      headers: {
        Accept: "application/json"
      },

      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Bilyoner HTTP ${response.status}`
    );
  }

  const data = await response.json();

  todayMatches = [];

  const competitions =
    Array.isArray(data.competitions)
      ? data.competitions
      : [];

  for (const competition of competitions) {

    const league =
      competition.name ||
      competition.leagueName ||
      competition.competitionName ||
      "Basketbol";

    const events =
      competition.events ||
      competition.basketballEvents ||
      competition.matches ||
      competition.games ||
      [];

    if (!Array.isArray(events)) {
      continue;
    }

    for (const event of events) {

      const match =
        normalizeTodayEvent(
          event,
          league
        );

      if (match) {
        todayMatches.push(match);
      }
    }
  }

  // Tekrarları kaldır
  const seen = new Set();

  todayMatches =
    todayMatches.filter(match => {

      const key =
        match.id ||
        `${match.homeKey}-${match.awayKey}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });

  console.log(
    `📅 Bugün: ${todayMatches.length} maç`
  );
}


// =====================================================
// BUGÜNÜN MAÇINI NORMALİZE ET
// =====================================================

function normalizeTodayEvent(
  event,
  league
) {

  const home =
    cleanName(
      event.homeTeam?.name ??
      event.homeTeam ??
      event.home?.name ??
      event.home ??
      event.homeName
    );

  const away =
    cleanName(
      event.awayTeam?.name ??
      event.awayTeam ??
      event.away?.name ??
      event.away ??
      event.awayName
    );

  if (!home || !away) {
    return null;
  }

  return {

    id:
      event.sbsEventId ??
      event.eventId ??
      event.id ??
      `${home}-${away}`,

    date:
      getDate(event.matchDate) ||
      getDate(event.date) ||
      today(),

    time:
      event.matchTime ??
      event.time ??
      event.startTime ??
      "",

    league,

    home,

    away,

    homeKey:
      normalizeName(home),

    awayKey:
      normalizeName(away)

  };
}


// =====================================================
// TAKIMIN MAÇLARINI BUL
// =====================================================

function teamGames(
  teamKey,
  venue = null
) {

  let games =
    history.filter(match => {

      const isHome =
        match.homeKey === teamKey;

      const isAway =
        match.awayKey === teamKey;

      if (!isHome && !isAway) {
        return false;
      }

      if (venue === "home") {
        return isHome;
      }

      if (venue === "away") {
        return isAway;
      }

      return true;
    });

  // En yeni maçlar
  games.sort(
    (a, b) =>
      b.date.localeCompare(a.date)
  );

  return games;
}


// =====================================================
// SON 5 MAÇ İSTATİSTİĞİ
// =====================================================

function formStats(
  teamKey,
  venue
) {

  const games =
    teamGames(
      teamKey,
      venue
    ).slice(
      0,
      FORM_MATCHES
    );

  if (games.length < MIN_SAMPLE) {
    return null;
  }

  let scored = 0;
  let conceded = 0;

  let halfScored = 0;
  let halfConceded = 0;

  let halfCount = 0;

  let wins = 0;

  for (const game of games) {

    const isHome =
      game.homeKey === teamKey;

    const forScore =
      isHome
        ? game.homeScore
        : game.awayScore;

    const againstScore =
      isHome
        ? game.awayScore
        : game.homeScore;

    scored += forScore;
    conceded += againstScore;

    if (forScore > againstScore) {
      wins++;
    }

    if (
      game.halfHome != null &&
      game.halfAway != null
    ) {

      const hf =
        isHome
          ? game.halfHome
          : game.halfAway;

      const ha =
        isHome
          ? game.halfAway
          : game.halfHome;

      halfScored += hf;
      halfConceded += ha;

      halfCount++;
    }
  }

  return {

    games: games.length,

    scored:
      scored / games.length,

    conceded:
      conceded / games.length,

    margin:
      (scored - conceded) /
      games.length,

    winRate:
      wins / games.length,

    halfScored:
      halfCount
        ? halfScored / halfCount
        : null,

    halfConceded:
      halfCount
        ? halfConceded / halfCount
        : null,

    halfGames:
      halfCount

  };
}


// =====================================================
// İKİ TAKIM ARASI GEÇMİŞ
// =====================================================

function headToHead(
  homeKey,
  awayKey
) {

  const games =
    history
      .filter(match =>
        (
          match.homeKey === homeKey &&
          match.awayKey === awayKey
        ) ||
        (
          match.homeKey === awayKey &&
          match.awayKey === homeKey
        )
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date)
      )
      .slice(0, 5);

  if (!games.length) {
    return null;
  }

  let homeWins = 0;
  let awayWins = 0;

  for (const game of games) {

    if (
      game.homeKey === homeKey
    ) {

      if (
        game.homeScore >
        game.awayScore
      ) {
        homeWins++;
      }
      else {
        awayWins++;
      }

    }
    else {

      if (
        game.homeScore >
        game.awayScore
      ) {
        awayWins++;
      }
      else {
        homeWins++;
      }

    }
  }

  return {
    games: games.length,
    homeWins,
    awayWins
  };
}


// =====================================================
// BEKLENEN SAYILAR
// =====================================================

function calculateExpected(
  match
) {

  const home =
    formStats(
      match.homeKey,
      "home"
    );

  const away =
    formStats(
      match.awayKey,
      "away"
    );

  if (!home || !away) {
    return null;
  }

  /*
   * Ev sahibinin beklenen sayısı:
   *
   * kendi iç saha hücum gücü
   * +
   * rakibin deplasman savunması
   *
   * ikiye bölünüyor.
   */

  const expectedHome =
    (
      home.scored +
      away.conceded
    ) / 2;

  const expectedAway =
    (
      away.scored +
      home.conceded
    ) / 2;

  const expectedTotal =
    expectedHome +
    expectedAway;


  // İlk yarı
  let expectedHalfHome = null;
  let expectedHalfAway = null;
  let expectedHalfTotal = null;

  if (
    home.halfScored != null &&
    away.halfConceded != null &&
    away.halfScored != null &&
    home.halfConceded != null
  ) {

    expectedHalfHome =
      (
        home.halfScored +
        away.halfConceded
      ) / 2;

    expectedHalfAway =
      (
        away.halfScored +
        home.halfConceded
      ) / 2;

    expectedHalfTotal =
      expectedHalfHome +
      expectedHalfAway;
  }


  // Maç sonucu
  const h2h =
    headToHead(
      match.homeKey,
      match.awayKey
    );

  let homeStrength =
    home.winRate;

  let awayStrength =
    away.winRate;

  // Sayı farkı etkisi
  const marginTotal =
    Math.abs(home.margin) +
    Math.abs(away.margin) +
    1;

  homeStrength +=
    (
      home.margin /
      marginTotal
    ) * 0.25;

  awayStrength +=
    (
      away.margin /
      marginTotal
    ) * 0.25;


  // H2H varsa küçük bir katkı
  if (h2h) {

    const totalH2H =
      h2h.homeWins +
      h2h.awayWins;

    if (totalH2H > 0) {

      homeStrength +=
        (
          h2h.homeWins /
          totalH2H
        ) * 0.10;

      awayStrength +=
        (
          h2h.awayWins /
          totalH2H
        ) * 0.10;
    }
  }


  const resultTotal =
    homeStrength +
    awayStrength;

  const homeProbability =
    resultTotal > 0
      ? homeStrength /
        resultTotal *
        100
      : 50;

  const awayProbability =
    resultTotal > 0
      ? awayStrength /
        resultTotal *
        100
      : 50;


  return {

    home,
    away,

    expectedHome,
    expectedAway,
    expectedTotal,

    expectedHalfHome,
    expectedHalfAway,
    expectedHalfTotal,

    h2h,

    homeProbability,
    awayProbability,

    prediction:
      homeProbability >=
      awayProbability
        ? "1"
        : "2",

    confidence:
      Math.round(
        Math.max(
          homeProbability,
          awayProbability
        )
      )

  };
}


// =====================================================
// ALT / ÜST
// =====================================================

function totalPrediction(
  expected
) {

  if (
    expected == null
  ) {
    return null;
  }

  const difference =
    expected - TOTAL_LINE;

  const confidence =
    Math.min(
      95,
      Math.round(
        55 +
        Math.abs(difference) * 3
      )
    );

  return {

    line: TOTAL_LINE,

    prediction:
      expected >= TOTAL_LINE
        ? "ÜST"
        : "ALT",

    confidence

  };
}


function firstHalfPrediction(
  expected
) {

  if (
    expected == null
  ) {
    return null;
  }

  const difference =
    expected -
    FIRST_HALF_LINE;

  const confidence =
    Math.min(
      95,
      Math.round(
        55 +
        Math.abs(difference) * 4
      )
    );

  return {

    line: FIRST_HALF_LINE,

    prediction:
      expected >= FIRST_HALF_LINE
        ? "ÜST"
        : "ALT",

    confidence

  };
}


// =====================================================
// KART
// =====================================================

function createCard(
  match,
  stats
) {

  const total =
    totalPrediction(
      stats.expectedTotal
    );

  const firstHalf =
    firstHalfPrediction(
      stats.expectedHalfTotal
    );


  const card =
    document.createElement("div");

  card.className =
    "basketball-analysis-card";


  card.innerHTML = `

    <div class="ba-league">
      ${escapeHtml(match.league)}
    </div>

    <div class="ba-header">

      <div>
        <div class="ba-time">
          ${escapeHtml(match.time)}
        </div>

        <div class="ba-team">
          ${escapeHtml(match.home)}
        </div>

        <div class="ba-team">
          ${escapeHtml(match.away)}
        </div>
      </div>

      <div class="ba-result">

        <div class="ba-result-title">
          MS
        </div>

        <strong>
          ${stats.prediction}
        </strong>

        <span>
          %${stats.confidence}
        </span>

      </div>

    </div>


    <div class="ba-title">
      BASKETBOL MAÇ ANALİZİ
    </div>

    <div class="ba-subtitle">
      Son 5 iç saha / son 5 deplasman
      maçına göre hesaplanmıştır.
    </div>


    <div class="ba-grid">

      <div class="ba-box">

        <small>
          EV SAHİBİ
        </small>

        <strong>
          ${stats.expectedHome.toFixed(1)}
        </strong>

        <span>
          BEKLENEN SAYI
        </span>

      </div>


      <div class="ba-box">

        <small>
          DEPLASMAN
        </small>

        <strong>
          ${stats.expectedAway.toFixed(1)}
        </strong>

        <span>
          BEKLENEN SAYI
        </span>

      </div>


      <div class="ba-box highlight">

        <small>
          BEKLENEN MAÇ TOPLAMI
        </small>

        <strong>
          ${stats.expectedTotal.toFixed(1)}
        </strong>

        <span>
          SAYI
        </span>

      </div>

    </div>


    <div class="ba-section-title">
      İLK YARI
    </div>


    <div class="ba-grid">

      <div class="ba-box">

        <small>
          EV SAHİBİ
        </small>

        <strong>
          ${
            stats.expectedHalfHome != null
              ? stats.expectedHalfHome.toFixed(1)
              : "-"
          }
        </strong>

        <span>
          SAYI
        </span>

      </div>


      <div class="ba-box">

        <small>
          DEPLASMAN
        </small>

        <strong>
          ${
            stats.expectedHalfAway != null
              ? stats.expectedHalfAway.toFixed(1)
              : "-"
          }
        </strong>

        <span>
          SAYI
        </span>

      </div>


      <div class="ba-box highlight">

        <small>
          İLK YARI TOPLAMI
        </small>

        <strong>
          ${
            stats.expectedHalfTotal != null
              ? stats.expectedHalfTotal.toFixed(1)
              : "-"
          }
        </strong>

        <span>
          SAYI
        </span>

      </div>

    </div>


    <div class="ba-section-title">
      TAHMİNLER
    </div>


    <div class="ba-predictions">

      <div class="ba-prediction">

        <span>
          MAÇ SONUCU
        </span>

        <strong>
          ${stats.prediction}
        </strong>

        <em>
          %${stats.confidence}
        </em>

      </div>


      ${
        total
          ? `
          <div class="ba-prediction">

            <span>
              MAÇ TOPLAM
            </span>

            <strong>
              ${total.line}
              ${total.prediction}
            </strong>

            <em>
              %${total.confidence}
            </em>

          </div>
          `
          : ""
      }


      ${
        firstHalf
          ? `
          <div class="ba-prediction">

            <span>
              İLK YARI
            </span>

            <strong>
              ${firstHalf.line}
              ${firstHalf.prediction}
            </strong>

            <em>
              %${firstHalf.confidence}
            </em>

          </div>
          `
          : ""
      }

    </div>


    <div class="ba-form">

      <div>
        Ev sahibi son ${stats.home.games}
        iç saha:
        <b>
          ${Math.round(
            stats.home.winRate * 100
          )}% galibiyet
        </b>
      </div>

      <div>
        Deplasman son ${stats.away.games}
        deplasman:
        <b>
          ${Math.round(
            stats.away.winRate * 100
          )}% galibiyet
        </b>
      </div>

    </div>

  `;

  return card;
}


// =====================================================
// CSS
// =====================================================

function addStyles() {

  if (
    document.getElementById(
      "basketball-analysis-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "basketball-analysis-style";

  style.textContent = `

    .basketball-analysis-card {
      background: #10161d;
      color: #fff;
      border: 1px solid #26313b;
      border-radius: 16px;
      padding: 16px;
      margin: 14px 0;
      box-shadow: 0 5px 20px rgba(0,0,0,.18);
    }

    .ba-league {
      color: #67d9bd;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .ba-header {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      align-items: center;
    }

    .ba-time {
      color: #67d9bd;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .ba-team {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.7;
    }

    .ba-result {
      min-width: 70px;
      text-align: center;
      border-left: 1px solid #26313b;
      padding-left: 15px;
    }

    .ba-result-title {
      color: #87919a;
      font-size: 11px;
    }

    .ba-result strong {
      display: block;
      font-size: 28px;
      color: #67d9bd;
    }

    .ba-result span {
      font-size: 11px;
      color: #aab4bd;
    }

    .ba-title {
      margin-top: 20px;
      color: #67d9bd;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .5px;
    }

    .ba-subtitle {
      color: #7e8992;
      font-size: 11px;
      margin: 5px 0 12px;
    }

    .ba-grid {
      display: grid;
      grid-template-columns:
        repeat(3, 1fr);
      gap: 8px;
    }

    .ba-box {
      border: 1px solid #26313b;
      border-radius: 10px;
      padding: 12px 8px;
      text-align: center;
      background: #121a22;
    }

    .ba-box.highlight {
      border-color: #315c56;
    }

    .ba-box small {
      display: block;
      color: #7f8a94;
      font-size: 9px;
      margin-bottom: 7px;
    }

    .ba-box strong {
      display: block;
      font-size: 22px;
      color: #fff;
    }

    .ba-box.highlight strong {
      color: #67d9bd;
    }

    .ba-box span {
      display: block;
      color: #68747e;
      font-size: 9px;
      margin-top: 4px;
    }

    .ba-section-title {
      color: #67d9bd;
      font-size: 12px;
      font-weight: 800;
      margin: 18px 0 9px;
    }

    .ba-predictions {
      display: grid;
      gap: 8px;
    }

    .ba-prediction {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 11px;
      border-radius: 10px;
      background: #151e27;
      border: 1px solid #27333d;
    }

    .ba-prediction span {
      color: #8a969f;
      font-size: 11px;
    }

    .ba-prediction strong {
      color: #67d9bd;
      font-size: 17px;
    }

    .ba-prediction em {
      color: #b7c1c8;
      font-size: 11px;
      font-style: normal;
    }

    .ba-form {
      border-top: 1px solid #26313b;
      margin-top: 15px;
      padding-top: 12px;
      color: #7f8a94;
      font-size: 11px;
      display: grid;
      gap: 5px;
    }

    .ba-form b {
      color: #cbd3d8;
    }

    @media (max-width: 600px) {

      .ba-grid {
        grid-template-columns: 1fr;
      }

      .ba-header {
        align-items: flex-start;
      }

      .ba-team {
        font-size: 15px;
      }

    }

  `;

  document.head.appendChild(style);
}


// =====================================================
// RENDER
// =====================================================

function render() {

  const container =
    document.querySelector(
      "#basketballMatches"
    ) ||
    document.querySelector(
      "#matches"
    ) ||
    document.querySelector(
      "#basketball-list"
    ) ||
    document.querySelector(
      ".basketball-matches"
    );

  if (!container) {
    console.error(
      "❌ #basketballMatches bulunamadı"
    );
    return;
  }

  container.innerHTML = "";

  let count = 0;

  for (const match of todayMatches) {

    const stats =
      calculateExpected(match);

    // Yeterli geçmiş yoksa gizle
    if (!stats) {
      continue;
    }

    // Güven düşükse gizle
    if (
      stats.confidence <
      MIN_CONFIDENCE
    ) {
      continue;
    }

    const card =
      createCard(
        match,
        stats
      );

    container.appendChild(card);

    count++;
  }


  if (count === 0) {

    container.innerHTML = `
      <div style="
        padding:25px;
        text-align:center;
        color:#888;
      ">
        Bugün yeterli geçmiş veriye sahip
        basketbol tahmini bulunamadı.
      </div>
    `;

  }

  console.log(
    `✅ Gösterilen tahmin: ${count}`
  );
}


// =====================================================
// BAŞLAT
// =====================================================

async function initBasketball() {

  try {

    addStyles();

    await loadHistory();

    await loadTodayMatches();

    render();

  }
  catch (error) {

    console.error(
      "❌ Basketbol sistemi:",
      error
    );

    const container =
      document.querySelector(
        "#basketballMatches"
      );

    if (container) {

      container.innerHTML = `
        <div style="
          padding:20px;
          text-align:center;
          color:#888;
        ">
          Basketbol verileri alınamadı.
        </div>
      `;
    }
  }
}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initBasketball
  );

}
else {

  initBasketball();

}
