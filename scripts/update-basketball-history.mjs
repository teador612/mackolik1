// scripts/update-basketball-history.mjs

import fs from "node:fs";
import path from "node:path";

const API_BASE =
  "https://www.bilyoner.com/api/mobile/live-score";

const EVENT_API =
  `${API_BASE}/event/v2/basketball`;

const DETAIL_API =
  `${API_BASE}/event/sport-list`;

const DATA_PATH =
  path.resolve("data/basketball-history.json");

const START_DATE = "2026-08-01";

const SEASON = "2026-2027";


// --------------------------------------------------
// YARDIMCI
// --------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isObj(v) {
  return v && typeof v === "object";
}

function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }

  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function pair(v) {
  if (!isObj(v)) return null;

  const home =
    num(v.home) ??
    num(v.homeScore) ??
    num(v.homeTeam) ??
    num(v.h);

  const away =
    num(v.away) ??
    num(v.awayScore) ??
    num(v.awayTeam) ??
    num(v.a);

  if (home === null || away === null) {
    return null;
  }

  return {
    home,
    away
  };
}

function scoreText(v) {
  if (!isObj(v)) return null;

  const p = pair(v);

  if (!p) return null;

  return `${p.home}-${p.away}`;
}

function parseDate(value) {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const result = [];

  let d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (d <= last) {
    result.push(isoDate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return result;
}


// --------------------------------------------------
// HTTP
// --------------------------------------------------

async function getJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}


// --------------------------------------------------
// BİLYONER GÜNLÜK MAÇLAR
// --------------------------------------------------

async function getDay(date) {
  const url =
    `${EVENT_API}?date=${encodeURIComponent(date)}`;

  const data = await getJson(url);

  return Array.isArray(data?.competitions)
    ? data.competitions
    : [];
}


// --------------------------------------------------
// DETAY SKOR API
//
// Bilyoner frontend kodundaki yapı:
//
// POST /mobile/live-score/event/sport-list
//
// {
//   sports: [
//     {
//       sbsEventIds: [...],
//       sportType: 2
//     }
//   ]
// }
// --------------------------------------------------

async function getDetails(events) {
  if (!events.length) return [];

  const ids = events
    .map(e => e.sbsEventId || e.eventId)
    .filter(Boolean)
    .map(String);

  if (!ids.length) return [];

  const body = {
    sports: [
      {
        sbsEventIds: ids,
        sportType: 2
      }
    ]
  };

  try {
    const data = await getJson(DETAIL_API, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (Array.isArray(data?.events)) {
      return data.events;
    }

    if (Array.isArray(data?.body?.events)) {
      return data.body.events;
    }

    if (Array.isArray(data?.data?.events)) {
      return data.data.events;
    }

    return [];
  } catch {
    return [];
  }
}


// --------------------------------------------------
// DETAYLI SKOR BULMA
// --------------------------------------------------

function findPair(obj, names) {
  if (!isObj(obj)) return null;

  for (const name of names) {
    if (obj[name] !== undefined) {
      const p = pair(obj[name]);

      if (p) return p;
    }
  }

  return null;
}


// --------------------------------------------------
// PERİYOTLARI ÇIKAR
// --------------------------------------------------

function extractPeriods(event) {

  let p1 = null;
  let p2 = null;
  let p3 = null;
  let p4 = null;

  // Direkt alanlar
  p1 =
    findPair(event, [
      "period1",
      "firstPeriod",
      "firstQuarter",
      "quarter1",
      "q1",
      "periodOne",
      "quarterOne"
    ]);

  p2 =
    findPair(event, [
      "period2",
      "secondPeriod",
      "secondQuarter",
      "quarter2",
      "q2",
      "periodTwo",
      "quarterTwo"
    ]);

  p3 =
    findPair(event, [
      "period3",
      "thirdPeriod",
      "thirdQuarter",
      "quarter3",
      "q3",
      "periodThree",
      "quarterThree"
    ]);

  p4 =
    findPair(event, [
      "period4",
      "fourthPeriod",
      "fourthQuarter",
      "quarter4",
      "q4",
      "periodFour",
      "quarterFour"
    ]);


  // Dizi şeklindeki alanlar
  const arrays = [
    event.periodScores,
    event.periods,
    event.quarters,
    event.quarterScores,
    event.scores,
    event.eventScores
  ];

  for (const arr of arrays) {

    if (!Array.isArray(arr)) continue;

    for (const item of arr) {

      if (!isObj(item)) continue;

      const index =
        num(item.period) ??
        num(item.periodNo) ??
        num(item.periodNumber) ??
        num(item.quarter) ??
        num(item.quarterNo) ??
        num(item.number) ??
        num(item.order);

      const p = pair(item);

      if (!p) continue;

      if (index === 1 && !p1) p1 = p;
      if (index === 2 && !p2) p2 = p;
      if (index === 3 && !p3) p3 = p;
      if (index === 4 && !p4) p4 = p;
    }
  }

  return {
    p1,
    p2,
    p3,
    p4
  };
}


// --------------------------------------------------
// İLK YARI
// --------------------------------------------------

function getHalfScore(event, periods) {

  const direct =
    findPair(event, [
      "halfScore",
      "halfTimeScore",
      "firstHalf",
      "firstHalfScore"
    ]);

  if (direct) {
    return direct;
  }

  if (periods.p1 && periods.p2) {
    return {
      home:
        periods.p1.home +
        periods.p2.home,

      away:
        periods.p1.away +
        periods.p2.away
    };
  }

  return null;
}


// --------------------------------------------------
// MAÇ SKORU
// --------------------------------------------------

function getFullScore(event) {

  const direct =
    findPair(event, [
      "currentScore",
      "fullTimeScore",
      "score",
      "officialResult"
    ]);

  if (direct) {
    return direct;
  }

  if (isObj(event?.officialResult)) {

    const p =
      pair(event.officialResult.fullTime);

    if (p) return p;
  }

  return null;
}


// --------------------------------------------------
// DETAY EVENT EŞLEŞTİRME
// --------------------------------------------------

function mergeDetail(base, details) {

  if (!details.length) {
    return {
      ...base,
      period1: null,
      period2: null,
      period3: null,
      period4: null
    };
  }

  const id =
    String(base.sbsEventId || base.eventId);

  let detail =
    details.find(x =>
      String(
        x.sbsEventId ||
        x.eventId ||
        x.id
      ) === id
    );

  if (!detail) {

    const home =
      String(base.homeTeam || "")
        .toLowerCase();

    const away =
      String(base.awayTeam || "")
        .toLowerCase();

    detail = details.find(x => {

      const h =
        String(x.homeTeam || "")
          .toLowerCase();

      const a =
        String(x.awayTeam || "")
          .toLowerCase();

      return h === home && a === away;
    });
  }

  if (!detail) {
    return {
      ...base,
      period1: null,
      period2: null,
      period3: null,
      period4: null
    };
  }

  const periods =
    extractPeriods(detail);

  const half =
    getHalfScore(detail, periods);

  const full =
    getFullScore(detail);

  return {
    ...base,

    score:
      full
        ? `${full.home}-${full.away}`
        : base.score,

    halfTimeScore:
      half
        ? `${half.home}-${half.away}`
        : base.halfTimeScore,

    period1:
      scoreText(periods.p1),

    period2:
      scoreText(periods.p2),

    period3:
      scoreText(periods.p3),

    period4:
      scoreText(periods.p4)
  };
}


// --------------------------------------------------
// ANA MAÇ PARSER
// --------------------------------------------------

function parseCompetition(comp, date) {

  const league =
    comp.title ||
    comp.name ||
    comp.competitionName ||
    "Bilinmeyen Lig";

  const events =
    Array.isArray(comp.events)
      ? comp.events
      : [];

  return events
    .map(event => {

      const matchDate =
        parseDate(
          event.matchDate ||
          event.date ||
          date
        );

      const homeTeam =
        event.homeTeam ||
        event.home ||
        event.homeTeamName ||
        "";

      const awayTeam =
        event.awayTeam ||
        event.away ||
        event.awayTeamName ||
        "";

      if (!homeTeam || !awayTeam) {
        return null;
      }

      const full =
        pair(event.currentScore);

      const half =
        pair(event.halfScore);

      return {
        id:
          String(
            event.sbsEventId ||
            event.eventId ||
            `${date}-${homeTeam}-${awayTeam}`
          ),

        sbsEventId:
          event.sbsEventId
            ? String(event.sbsEventId)
            : null,

        eventId:
          event.eventId
            ? String(event.eventId)
            : null,

        date:
          matchDate
            ? isoDate(matchDate)
            : date,

        time:
          matchDate
            ? matchDate.toISOString().slice(11, 16)
            : null,

        league,

        homeTeam,

        awayTeam,

        score:
          full
            ? `${full.home}-${full.away}`
            : null,

        halfTimeScore:
          half
            ? `${half.home}-${half.away}`
            : null,

        period1: null,
        period2: null,
        period3: null,
        period4: null,

        status:
          event.matchStatus ||
          event.status ||
          null,

        source: "Bilyoner"
      };
    })
    .filter(Boolean);
}


// --------------------------------------------------
// ANA İŞLEM
// --------------------------------------------------

const today =
  new Date().toISOString().slice(0, 10);

const dates =
  dateRange(
    START_DATE,
    today
  );

console.log("");
console.log("🏀 BİLYONER BASKETBOL GEÇMİŞİ");
console.log(`📅 ${START_DATE} → ${today}`);


// Eski dosya varsa SADECE Bilyoner verisini
// kullanmak için yeniden oluşturuyoruz.

const allMatches = new Map();

let leagueCount = 0;
let detailCount = 0;
let periodCount = [0, 0, 0, 0];


// --------------------------------------------------
// GÜNLER
// --------------------------------------------------

for (const date of dates) {

  let competitions = [];

  try {
    competitions =
      await getDay(date);
  } catch {
    continue;
  }

  leagueCount += competitions.length;

  const dayMatches = [];

  for (const comp of competitions) {

    const matches =
      parseCompetition(
        comp,
        date
      );

    dayMatches.push(
      ...matches
    );
  }

  // Detay API'yi çok büyük istek
  // yapmaması için 40'arlı gönderiyoruz.

  for (
    let i = 0;
    i < dayMatches.length;
    i += 40
  ) {

    const batch =
      dayMatches.slice(
        i,
        i + 40
      );

    const details =
      await getDetails(batch);

    if (details.length) {
      detailCount += details.length;
    }

    for (const match of batch) {

      const merged =
        mergeDetail(
          match,
          details
        );

      const key =
        `${merged.date}|${merged.homeTeam}|${merged.awayTeam}`
          .toLowerCase();

      allMatches.set(
        key,
        merged
      );
    }

    await sleep(100);
  }
}


// --------------------------------------------------
// SONUÇLARI DÜZENLE
// --------------------------------------------------

const matches =
  Array.from(
    allMatches.values()
  )
  .filter(m =>
    m.date >= START_DATE &&
    m.date <= today
  )
  .sort((a, b) => {

    const da =
      `${a.date} ${a.time || ""}`;

    const db =
      `${b.date} ${b.time || ""}`;

    return da.localeCompare(db);
  });


// --------------------------------------------------
// İSTATİSTİK
// --------------------------------------------------

let scored = 0;
let completed = 0;

for (const m of matches) {

  if (m.score) {
    scored++;
  }

  if (
    m.score &&
    /^\d+-\d+$/.test(m.score)
  ) {
    completed++;
  }

  if (m.period1) periodCount[0]++;
  if (m.period2) periodCount[1]++;
  if (m.period3) periodCount[2]++;
  if (m.period4) periodCount[3]++;
}


// --------------------------------------------------
// DOSYA
// --------------------------------------------------

const output = {
  source:
    "https://www.bilyoner.com/canli-skor/basketbol-canli-skor",

  season: SEASON,

  updatedAt:
    new Date().toISOString(),

  dateRange: {
    start: START_DATE,
    end: today
  },

  stats: {
    leagues:
      new Set(
        matches.map(m => m.league)
      ).size,

    matches:
      matches.length,

    scored,

    completed,

    periods: {
      period1: periodCount[0],
      period2: periodCount[1],
      period3: periodCount[2],
      period4: periodCount[3]
    }
  },

  matches
};


fs.mkdirSync(
  path.dirname(DATA_PATH),
  { recursive: true }
);

fs.writeFileSync(
  DATA_PATH,
  JSON.stringify(
    output,
    null,
    2
  ),
  "utf8"
);


// --------------------------------------------------
// KISA LOG
// --------------------------------------------------

console.log(
  `🏆 Lig: ${output.stats.leagues}`
);

console.log(
  `🏀 Maç: ${output.stats.matches}`
);

console.log(
  `✅ Skorlu: ${output.stats.scored}`
);

console.log(
  `🏁 Tamamlanan: ${output.stats.completed}`
);

console.log(
  `📊 Periyot: ${periodCount.join("/")}`
);

console.log(
  `🔎 Detay: ${detailCount}`
);

console.log(
  `📁 ${DATA_PATH}`
);
