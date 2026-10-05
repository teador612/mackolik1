import fs from "node:fs/promises";
import path from "node:path";

const API = "https://www.bilyoner.com/api";
const OUT = path.resolve("data/basketball-history.json");

const START_DATE = "2026-08-01";
const END_DATE = new Date().toISOString().slice(0, 10);

const EVENT_URL =
  `${API}/mobile/live-score/event/v2/basketball`;

const DETAIL_URL =
  `${API}/mobile/live-score/event/sport-list`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function dateRange(start, end) {
  const out = [];
  let d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);

  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return out;
}

async function getJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }

  const n = Number(
    String(v)
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(n) ? n : null;
}

function scoreObject(v) {
  if (!v || typeof v !== "object") return null;

  const home =
    num(v.home) ??
    num(v.homeScore) ??
    num(v.homeTeam) ??
    num(v.homePoints);

  const away =
    num(v.away) ??
    num(v.awayScore) ??
    num(v.awayTeam) ??
    num(v.awayPoints);

  if (home === null || away === null) return null;

  return {
    home,
    away,
    display: `${home}-${away}`
  };
}

function parseScore(v) {
  if (!v) return null;

  if (typeof v === "object") {
    return scoreObject(v);
  }

  if (typeof v === "string") {
    const m = v.match(/(\d+)\s*[-:]\s*(\d+)/);

    if (m) {
      return {
        home: Number(m[1]),
        away: Number(m[2]),
        display: `${m[1]}-${m[2]}`
      };
    }
  }

  return null;
}

function findScoreDeep(obj, wanted) {
  if (!obj || typeof obj !== "object") return null;

  const keys = Object.keys(obj);

  for (const key of keys) {
    const lower = key.toLowerCase();

    if (wanted.some(x => lower === x || lower.includes(x))) {
      const s = parseScore(obj[key]);
      if (s) return s;
    }
  }

  for (const key of keys) {
    const value = obj[key];

    if (value && typeof value === "object") {
      const found = findScoreDeep(value, wanted);
      if (found) return found;
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findScoreDeep(item, wanted);
      if (found) return found;
    }
  }

  return null;
}

function extractPeriods(event) {
  const result = {
    period1: null,
    period2: null,
    period3: null,
    period4: null
  };

  const aliases = {
    period1: [
      "period1",
      "period_1",
      "quarter1",
      "quarter_1",
      "q1",
      "firstperiod",
      "firstquarter",
      "1period",
      "1quarter"
    ],

    period2: [
      "period2",
      "period_2",
      "quarter2",
      "quarter_2",
      "q2",
      "secondperiod",
      "secondquarter",
      "2period",
      "2quarter"
    ],

    period3: [
      "period3",
      "period_3",
      "quarter3",
      "quarter_3",
      "q3",
      "thirdperiod",
      "thirdquarter",
      "3period",
      "3quarter"
    ],

    period4: [
      "period4",
      "period_4",
      "quarter4",
      "quarter_4",
      "q4",
      "fourthperiod",
      "fourthquarter",
      "4period",
      "4quarter"
    ]
  };

  for (const [name, keys] of Object.entries(aliases)) {
    result[name] = findScoreDeep(event, keys);
  }

  /*
    Bazı Bilyoner cevaplarında periyotlar dizi halinde gelebilir.
    Örnek:
    [
      { home: 20, away: 18 },
      { home: 22, away: 20 },
      ...
    ]
  */

  const arrays = [];

  function scanArrays(obj) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      if (obj.length >= 4) {
        const parsed = obj
          .slice(0, 4)
          .map(parseScore);

        if (parsed.filter(Boolean).length >= 2) {
          arrays.push(parsed);
        }
      }

      for (const item of obj) {
        scanArrays(item);
      }

      return;
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        scanArrays(value);
      }
    }
  }

  scanArrays(event);

  for (const arr of arrays) {
    if (!result.period1 && arr[0]) result.period1 = arr[0];
    if (!result.period2 && arr[1]) result.period2 = arr[1];
    if (!result.period3 && arr[2]) result.period3 = arr[2];
    if (!result.period4 && arr[3]) result.period4 = arr[3];

    if (
      result.period1 &&
      result.period2 &&
      result.period3 &&
      result.period4
    ) {
      break;
    }
  }

  /*
    Eğer Bilyoner kümülatif skor döndürüyorsa:
      Q1 = 20-18
      Q2 = 42-38
      Q3 = 61-57
      Q4 = 82-75

    Bunları çeyrek skorlarına çeviriyoruz.
  */

  if (
    result.period1 &&
    result.period2 &&
    result.period3 &&
    result.period4
  ) {
    const cumulative = [
      result.period1,
      result.period2,
      result.period3,
      result.period4
    ];

    const converted = [];

    for (let i = 0; i < cumulative.length; i++) {
      if (i === 0) {
        converted.push(cumulative[i]);
      } else {
        converted.push({
          home:
            cumulative[i].home -
            cumulative[i - 1].home,

          away:
            cumulative[i].away -
            cumulative[i - 1].away
        });
      }
    }

    result.period1 = {
      home: converted[0].home,
      away: converted[0].away,
      display: `${converted[0].home}-${converted[0].away}`
    };

    result.period2 = {
      home: converted[1].home,
      away: converted[1].away,
      display: `${converted[1].home}-${converted[1].away}`
    };

    result.period3 = {
      home: converted[2].home,
      away: converted[2].away,
      display: `${converted[2].home}-${converted[2].away}`
    };

    result.period4 = {
      home: converted[3].home,
      away: converted[3].away,
      display: `${converted[3].home}-${converted[3].away}`
    };
  }

  return result;
}

function getFullScore(event) {
  return (
    findScoreDeep(event, [
      "fulltime",
      "full_time",
      "finalscore",
      "final_score",
      "officialresult",
      "current_score",
      "currentscore"
    ]) ||
    findScoreDeep(event, ["score"])
  );
}

function getHalfScore(event) {
  return (
    findScoreDeep(event, [
      "halftime",
      "half_time",
      "halfscore",
      "half_score"
    ])
  );
}

function eventIdOf(e) {
  return (
    num(e.eventId) ??
    num(e.id)
  );
}

function sbsIdOf(e) {
  return (
    num(e.sbsEventId) ??
    num(e.sbsId)
  );
}

function keyOf(e) {
  const id = eventIdOf(e);

  if (id !== null) {
    return `id:${id}`;
  }

  const home = String(e.homeTeam || "")
    .trim()
    .toLowerCase();

  const away = String(e.awayTeam || "")
    .trim()
    .toLowerCase();

  const date = String(e.matchDate || "")
    .slice(0, 10);

  return `${date}|${home}|${away}`;
}

async function getDayEvents(date) {
  try {
    const data = await getJson(
      `${EVENT_URL}?date=${date}`
    );

    const competitions =
      Array.isArray(data?.competitions)
        ? data.competitions
        : [];

    const events = [];

    for (const competition of competitions) {
      const leagueName =
        competition.name ||
        competition.title ||
        competition.competitionName ||
        "";

      const list =
        Array.isArray(competition.events)
          ? competition.events
          : [];

      for (const e of list) {
        if (!e) continue;

        events.push({
          ...e,
          league:
            e.league ||
            e.leagueName ||
            leagueName
        });
      }
    }

    return events;
  } catch {
    return [];
  }
}

async function getDetails(eventIds) {
  const result = new Map();

  if (!eventIds.length) return result;

  const CHUNK = 40;

  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);

    try {
      const body = {
        sports: [
          {
            /*
              ÖNEMLİ:
              Bilyoner frontend'i sport-list çağrısında
              eventId kullanıyor.
            */
            sbsEventIds: chunk,
            sportType: 2
          }
        ]
      };

      const data = await getJson(
        DETAIL_URL,
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      );

      const events =
        data?.events ||
        data?.data?.events ||
        data?.result?.events ||
        [];

      if (Array.isArray(events)) {
        for (const e of events) {
          const id =
            eventIdOf(e) ??
            sbsIdOf(e);

          if (id !== null) {
            result.set(String(id), e);
          }

          if (e?.sbsEventId !== undefined) {
            result.set(
              `sbs:${e.sbsEventId}`,
              e
            );
          }

          if (e?.eventId !== undefined) {
            result.set(
              `event:${e.eventId}`,
              e
            );
          }
        }
      }
    } catch {
      // Sessiz geç
    }

    await sleep(80);
  }

  return result;
}

function mergeDetail(base, detail) {
  if (!detail) return base;

  return {
    ...base,
    ...detail,

    homeTeam:
      base.homeTeam ||
      detail.homeTeam,

    awayTeam:
      base.awayTeam ||
      detail.awayTeam,

    league:
      base.league ||
      detail.league ||
      detail.competitionName
  };
}

function buildMatch(event, detail) {
  const merged = mergeDetail(event, detail);

  const fullScore = getFullScore(merged);
  const halfScore = getHalfScore(merged);
  const periods = extractPeriods(merged);

  const matchDate =
    String(
      merged.matchDate ||
      merged.date ||
      ""
    ).slice(0, 10);

  return {
    eventId:
      eventIdOf(merged),

    sbsEventId:
      sbsIdOf(merged),

    date:
      matchDate,

    time:
      merged.matchDate || null,

    league:
      merged.league ||
      merged.leagueName ||
      merged.competitionName ||
      "",

    homeTeam:
      merged.homeTeam ||
      merged.home ||
      "",

    awayTeam:
      merged.awayTeam ||
      merged.away ||
      "",

    score:
      fullScore,

    halfTimeScore:
      halfScore,

    period1:
      periods.period1,

    period2:
      periods.period2,

    period3:
      periods.period3,

    period4:
      periods.period4,

    status:
      merged.matchStatus ||
      merged.status ||
      null,

    completed:
      Boolean(
        fullScore &&
        fullScore.home !== null &&
        fullScore.away !== null
      )
  };
}

async function main() {
  console.log("");
  console.log("🏀 BİLYONER BASKETBOL GEÇMİŞİ");
  console.log(
    `📅 ${START_DATE} → ${END_DATE}`
  );

  const dates = dateRange(
    START_DATE,
    END_DATE
  );

  const allEvents = [];

  for (const date of dates) {
    const events = await getDayEvents(date);

    allEvents.push(...events);
  }

  const unique = new Map();

  for (const event of allEvents) {
    const key = keyOf(event);

    if (!unique.has(key)) {
      unique.set(key, event);
    }
  }

  const events = [...unique.values()];

  /*
    DETAY İÇİN EVENT ID KULLAN.
    Bilyoner frontend'inin sport-list çağrısındaki
    event kimliği budur.
  */
  const eventIds = [
    ...new Set(
      events
        .map(eventIdOf)
        .filter(x => x !== null)
    )
  ];

  const details = await getDetails(
    eventIds
  );

  const matches = [];

  for (const event of events) {
    const eventId = eventIdOf(event);
    const sbsId = sbsIdOf(event);

    let detail = null;

    if (eventId !== null) {
      detail =
        details.get(String(eventId)) ||
        details.get(`event:${eventId}`);
    }

    if (!detail && sbsId !== null) {
      detail =
        details.get(`sbs:${sbsId}`) ||
        details.get(String(sbsId));
    }

    const match = buildMatch(
      event,
      detail
    );

    /*
      Sadece 2026-2027 sezonundaki
      bu tarih aralığındaki kayıtları tut.
    */
    if (
      !match.date ||
      match.date < START_DATE ||
      match.date > END_DATE
    ) {
      continue;
    }

    if (
      !match.homeTeam ||
      !match.awayTeam
    ) {
      continue;
    }

    matches.push(match);
  }

  /*
    Son kez maçları benzersizleştir.
  */
  const finalMap = new Map();

  for (const match of matches) {
    const key =
      match.eventId !== null
        ? `id:${match.eventId}`
        : `${match.date}|${match.homeTeam}|${match.awayTeam}`;

    finalMap.set(key, match);
  }

  const finalMatches = [
    ...finalMap.values()
  ].sort((a, b) => {
    const da =
      `${a.date} ${a.time || ""}`;

    const db =
      `${b.date} ${b.time || ""}`;

    return da.localeCompare(db);
  });

  const leagues = new Set(
    finalMatches
      .map(x => x.league)
      .filter(Boolean)
  );

  const scored = finalMatches.filter(
    x =>
      x.score &&
      x.score.home !== null &&
      x.score.away !== null
  );

  const completed = finalMatches.filter(
    x => x.completed
  );

  const p1 = finalMatches.filter(
    x => x.period1
  ).length;

  const p2 = finalMatches.filter(
    x => x.period2
  ).length;

  const p3 = finalMatches.filter(
    x => x.period3
  ).length;

  const p4 = finalMatches.filter(
    x => x.period4
  ).length;

  const output = {
    source:
      "https://www.bilyoner.com/canli-skor/basketbol-canli-skor",

    provider: "Bilyoner",

    sport: "basketball",

    season: "2026-2027",

    updatedAt:
      new Date().toISOString(),

    dateRange: {
      from: START_DATE,
      to: END_DATE
    },

    stats: {
      leagues: leagues.size,
      matches: finalMatches.length,
      scored: scored.length,
      completed: completed.length,

      periods: {
        period1: p1,
        period2: p2,
        period3: p3,
        period4: p4
      },

      detailRequests:
        details.size
    },

    matches: finalMatches
  };

  await fs.mkdir(
    path.dirname(OUT),
    { recursive: true }
  );

  await fs.writeFile(
    OUT,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `🏆 Lig: ${leagues.size}`
  );

  console.log(
    `🏀 Maç: ${finalMatches.length}`
  );

  console.log(
    `✅ Skorlu: ${scored.length}`
  );

  console.log(
    `🏁 Tamamlanan: ${completed.length}`
  );

  console.log(
    `📊 Periyot: ${p1}/${p2}/${p3}/${p4}`
  );

  console.log(
    `🔎 Detay: ${details.size}`
  );

  console.log(
    `📁 ${OUT}`
  );
}

main().catch(error => {
  console.error(
    "❌ HATA:",
    error.message
  );

  process.exit(1);
});
