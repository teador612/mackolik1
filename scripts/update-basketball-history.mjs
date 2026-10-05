// scripts/update-basketball-history.mjs
// BİLYONER BASKETBOL - 2026/2027 SEZONU
//
// Kaynak:
// https://www.bilyoner.com/canli-skor/basketbol-canli-skor
//
// API:
// /mobile/live-score/event/v2/basketball
// /mobile/live-score/event/v2/sport-list?eventList=2:SBS_ID
//
// ÖNEMLİ:
// Basketbol detay sorgusunda EVENT ID değil SBS EVENT ID kullanılır.

import fs from "node:fs/promises";
import path from "node:path";

const API = "https://www.bilyoner.com/api";

const EVENT_URL =
  `${API}/mobile/live-score/event/v2/basketball`;

const DETAIL_URL =
  `${API}/mobile/live-score/event/v2/sport-list`;

const DATA_PATH = path.resolve(
  "data",
  "basketball-history.json"
);

// 2026-2027 sezonu.
// 60 günlük sınır YOK.
const SEASON_START = "2026-08-01";

const TODAY = new Date().toISOString().slice(0, 10);

const REQUEST_DELAY = 80;
const DETAIL_BATCH_SIZE = 30;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(value) {
  if (value == null) return "";

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function number(value) {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value)
    .replace(",", ".")
    .trim();

  const n = Number(text);

  return Number.isFinite(n) ? n : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = number(value);

    if (n !== null) {
      return n;
    }
  }

  return null;
}

function eventIdOf(event) {
  return (
    event?.eventId ??
    (typeof event?.id === "number" ? event.id : null) ??
    null
  );
}

function sbsEventIdOf(event) {
  return (
    event?.sbsEventId ??
    event?.sbsEventID ??
    event?.sbsId ??
    null
  );
}

function teamName(team) {
  if (!team) return "";

  if (typeof team === "string") {
    return cleanText(team);
  }

  return cleanText(
    team.name ??
    team.teamName ??
    team.displayName ??
    team.shortName ??
    team.title ??
    ""
  );
}

function getHomeTeam(event) {
  return cleanText(
    event?.homeTeam?.name ??
    event?.homeTeam?.teamName ??
    event?.homeTeamName ??
    event?.home?.name ??
    event?.home?.teamName ??
    event?.participants?.home?.name ??
    event?.participants?.[0]?.name ??
    ""
  );
}

function getAwayTeam(event) {
  return cleanText(
    event?.awayTeam?.name ??
    event?.awayTeam?.teamName ??
    event?.awayTeamName ??
    event?.away?.name ??
    event?.away?.teamName ??
    event?.participants?.away?.name ??
    event?.participants?.[1]?.name ??
    ""
  );
}

function getLeagueName(event, competitionName = "") {
  return cleanText(
    competitionName ||
    event?.competition?.name ||
    event?.competitionName ||
    event?.league?.name ||
    event?.leagueName ||
    event?.tournament?.name ||
    ""
  );
}

function getMatchDate(event, fallbackDate) {
  return (
    event?.matchDate ||
    event?.date ||
    event?.startDate ||
    event?.startTime ||
    fallbackDate
  );
}

function getScorePair(value) {
  if (value == null) return null;

  if (Array.isArray(value)) {
    if (value.length >= 2) {
      const home = number(value[0]);
      const away = number(value[1]);

      if (home !== null && away !== null) {
        return {
          home,
          away
        };
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const home = firstNumber(
    value.home,
    value.homeScore,
    value.homeTeamScore,
    value.homePoints,
    value.host,
    value.hostScore,
    value.team1,
    value.score1,
    value.left
  );

  const away = firstNumber(
    value.away,
    value.awayScore,
    value.awayTeamScore,
    value.awayPoints,
    value.guest,
    value.guestScore,
    value.team2,
    value.score2,
    value.right
  );

  if (home !== null && away !== null) {
    return {
      home,
      away
    };
  }

  return null;
}

function scoreFromObject(obj) {
  if (!obj || typeof obj !== "object") {
    return null;
  }

  const direct = getScorePair(obj);

  if (direct) {
    return direct;
  }

  for (const key of [
    "score",
    "currentScore",
    "result",
    "points",
    "value"
  ]) {
    const pair = getScorePair(obj[key]);

    if (pair) {
      return pair;
    }
  }

  return null;
}

function periodNumberFromObject(obj) {
  if (!obj || typeof obj !== "object") {
    return null;
  }

  const raw = firstNumber(
    obj.period,
    obj.periodNo,
    obj.periodNumber,
    obj.quarter,
    obj.quarterNo,
    obj.quarterNumber,
    obj.sequence,
    obj.order,
    obj.index
  );

  if (raw !== null && raw >= 1 && raw <= 10) {
    return raw;
  }

  const text = cleanText(
    obj.periodName ??
    obj.periodType ??
    obj.name ??
    obj.label ??
    obj.type ??
    ""
  ).toLowerCase();

  if (
    text === "1" ||
    text.includes("1. per") ||
    text.includes("1st") ||
    text.includes("quarter 1") ||
    text.includes("quarter1") ||
    text === "q1"
  ) {
    return 1;
  }

  if (
    text === "2" ||
    text.includes("2. per") ||
    text.includes("2nd") ||
    text.includes("quarter 2") ||
    text.includes("quarter2") ||
    text === "q2"
  ) {
    return 2;
  }

  if (
    text === "3" ||
    text.includes("3. per") ||
    text.includes("3rd") ||
    text.includes("quarter 3") ||
    text.includes("quarter3") ||
    text === "q3"
  ) {
    return 3;
  }

  if (
    text === "4" ||
    text.includes("4. per") ||
    text.includes("4th") ||
    text.includes("quarter 4") ||
    text.includes("quarter4") ||
    text === "q4"
  ) {
    return 4;
  }

  return null;
}

function extractPeriods(scores) {
  const periods = {
    1: null,
    2: null,
    3: null,
    4: null
  };

  const visit = (node, depth = 0) => {
    if (node == null || depth > 8) {
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const item = node[i];

        if (item && typeof item === "object") {
          const p =
            periodNumberFromObject(item) ??
            (
              i < 4
                ? i + 1
                : null
            );

          const pair = scoreFromObject(item);

          if (
            p >= 1 &&
            p <= 4 &&
            pair &&
            periods[p] == null
          ) {
            periods[p] = pair;
          }
        }

        visit(item, depth + 1);
      }

      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const p = periodNumberFromObject(node);
    const pair = scoreFromObject(node);

    if (
      p >= 1 &&
      p <= 4 &&
      pair &&
      periods[p] == null
    ) {
      periods[p] = pair;
    }

    for (const [key, value] of Object.entries(node)) {
      const lower = key.toLowerCase();

      let forcedPeriod = null;

      if (
        lower.includes("period1") ||
        lower.includes("quarter1") ||
        lower === "q1"
      ) {
        forcedPeriod = 1;
      } else if (
        lower.includes("period2") ||
        lower.includes("quarter2") ||
        lower === "q2"
      ) {
        forcedPeriod = 2;
      } else if (
        lower.includes("period3") ||
        lower.includes("quarter3") ||
        lower === "q3"
      ) {
        forcedPeriod = 3;
      } else if (
        lower.includes("period4") ||
        lower.includes("quarter4") ||
        lower === "q4"
      ) {
        forcedPeriod = 4;
      }

      if (forcedPeriod) {
        const forcedPair = scoreFromObject(value);

        if (
          forcedPair &&
          periods[forcedPeriod] == null
        ) {
          periods[forcedPeriod] = forcedPair;
        }
      }

      visit(value, depth + 1);
    }
  };

  visit(scores);

  return periods;
}

function getFinalScore(event, detail) {
  const sources = [
    detail?.currentScore,
    event?.currentScore,
    detail?.score,
    event?.score,
    detail?.scores,
    event?.scores
  ];

  for (const source of sources) {
    const pair = scoreFromObject(source);

    if (pair) {
      return pair;
    }
  }

  return null;
}

function getHalfTime(periods, detail, event) {
  if (periods[1] && periods[2]) {
    return {
      home: periods[1].home + periods[2].home,
      away: periods[1].away + periods[2].away
    };
  }

  for (const source of [
    detail?.halfScore,
    detail?.halfTimeScore,
    event?.halfScore,
    event?.halfTimeScore
  ]) {
    const pair = scoreFromObject(source);

    if (pair) {
      return pair;
    }
  }

  return null;
}

function isFinished(event, detail, finalScore) {
  const text = cleanText(
    detail?.matchStatus ??
    detail?.status ??
    event?.matchStatus ??
    event?.status ??
    event?.state ??
    ""
  ).toLowerCase();

  if (
    text.includes("finished") ||
    text.includes("completed") ||
    text.includes("ended") ||
    text.includes("closed") ||
    text.includes("final") ||
    text.includes("bit")
  ) {
    return true;
  }

  if (
    finalScore &&
    finalScore.home !== null &&
    finalScore.away !== null
  ) {
    return true;
  }

  return false;
}

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function getDayEvents(date) {
  const url =
    `${EVENT_URL}?date=${encodeURIComponent(date)}`;

  const data = await getJson(url);

  const competitions =
    Array.isArray(data?.competitions)
      ? data.competitions
      : [];

  const result = [];

  for (const competition of competitions) {
    const leagueName = cleanText(
      competition?.name ??
      competition?.competitionName ??
      competition?.leagueName ??
      ""
    );

    const events =
      Array.isArray(competition?.events)
        ? competition.events
        : [];

    for (const event of events) {
      const eventId = eventIdOf(event);
      const sbsEventId = sbsEventIdOf(event);

      const homeTeam = getHomeTeam(event);
      const awayTeam = getAwayTeam(event);

      if (!homeTeam || !awayTeam) {
        continue;
      }

      if (!sbsEventId) {
        continue;
      }

      result.push({
        ...event,
        eventId,
        sbsEventId,
        homeTeam,
        awayTeam,
        competitionName: leagueName,
        matchDate: getMatchDate(event, date)
      });
    }
  }

  return result;
}

async function getDetails(events) {
  const map = new Map();

  for (
    let start = 0;
    start < events.length;
    start += DETAIL_BATCH_SIZE
  ) {
    const chunk =
      events.slice(
        start,
        start + DETAIL_BATCH_SIZE
      );

    const ids = chunk
      .map(e => String(e.sbsEventId))
      .filter(Boolean);

    if (!ids.length) {
      continue;
    }

    const eventList =
      `2:${ids.join(";")}`;

    const url =
      `${DETAIL_URL}?eventList=${encodeURIComponent(eventList)}`;

    try {
      const data = await getJson(url);

      const details =
        Array.isArray(data?.events)
          ? data.events
          : [];

      for (const detail of details) {
        const id = String(
          detail?.sbsEventId ??
          detail?.sbsEventID ??
          detail?.id ??
          detail?.eventId ??
          ""
        );

        if (id) {
          map.set(id, detail);
        }
      }
    } catch (error) {
      // Toplu istek hata verirse tek tek dene.
      for (const event of chunk) {
        try {
          const singleUrl =
            `${DETAIL_URL}?eventList=2:${event.sbsEventId}`;

          const data =
            await getJson(singleUrl);

          const detail =
            Array.isArray(data?.events)
              ? data.events[0]
              : null;

          if (detail) {
            map.set(
              String(event.sbsEventId),
              detail
            );
          }
        } catch {
          // Bu maçın detayı yoksa devam.
        }

        await sleep(REQUEST_DELAY);
      }
    }

    await sleep(REQUEST_DELAY);
  }

  return map;
}

function makeRecord(event, detail) {
  const periods = extractPeriods(
    detail?.scores ??
    detail?.eventScores ??
    detail?.scoreDetails ??
    detail?.periodScores ??
    detail?.quarters ??
    detail
  );

  const finalScore =
    getFinalScore(event, detail);

  const halfTimeScore =
    getHalfTime(
      periods,
      detail,
      event
    );

  const finished =
    isFinished(
      event,
      detail,
      finalScore
    );

  return {
    id:
      event.eventId ??
      event.sbsEventId,

    eventId:
      event.eventId ?? null,

    sbsEventId:
      event.sbsEventId ?? null,

    date:
      String(event.matchDate || "").slice(0, 10),

    matchDate:
      event.matchDate ?? null,

    league:
      getLeagueName(
        event,
        event.competitionName
      ),

    homeTeam:
      event.homeTeam,

    awayTeam:
      event.awayTeam,

    score:
      finalScore
        ? `${finalScore.home}-${finalScore.away}`
        : null,

    homeScore:
      finalScore?.home ?? null,

    awayScore:
      finalScore?.away ?? null,

    halfTimeScore:
      halfTimeScore
        ? `${halfTimeScore.home}-${halfTimeScore.away}`
        : null,

    period1:
      periods[1],

    period2:
      periods[2],

    period3:
      periods[3],

    period4:
      periods[4],

    status:
      finished
        ? "finished"
        : (
          detail?.matchStatus ??
          event?.matchStatus ??
          event?.status ??
          "unknown"
        ),

    source:
      "Bilyoner",

    updatedAt:
      new Date().toISOString()
  };
}

function validFinishedRecord(record) {
  return (
    record &&
    record.homeTeam &&
    record.awayTeam &&
    record.homeScore !== null &&
    record.awayScore !== null
  );
}

async function loadOldData() {
  try {
    const text =
      await fs.readFile(
        DATA_PATH,
        "utf8"
      );

    const json =
      JSON.parse(text);

    return Array.isArray(json?.matches)
      ? json.matches
      : [];
  } catch {
    return [];
  }
}

function uniqueMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    const key =
      match.sbsEventId ??
      match.eventId ??
      `${match.date}|${match.homeTeam}|${match.awayTeam}`;

    map.set(String(key), match);
  }

  return [...map.values()];
}

function isCurrentSeason(match) {
  const date =
    String(
      match?.date ??
      match?.matchDate ??
      ""
    ).slice(0, 10);

  return (
    date >= SEASON_START &&
    date <= TODAY
  );
}

async function main() {
  console.log("🏀 BİLYONER BASKETBOL GEÇMİŞİ");
  console.log(
    `📅 ${SEASON_START} → ${TODAY}`
  );

  const dates = [];

  const cursor =
    new Date(`${SEASON_START}T00:00:00Z`);

  const end =
    new Date(`${TODAY}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(
      cursor.toISOString().slice(0, 10)
    );

    cursor.setUTCDate(
      cursor.getUTCDate() + 1
    );
  }

  const allEvents = [];
  const seen = new Set();

  for (const date of dates) {
    try {
      const events =
        await getDayEvents(date);

      for (const event of events) {
        const key =
          String(
            event.sbsEventId ??
            event.eventId
          );

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        allEvents.push(event);
      }
    } catch {
      // Tek gün başarısızsa diğer günler devam eder.
    }

    await sleep(REQUEST_DELAY);
  }

  console.log(
    `🏆 Lig: ${new Set(
      allEvents
        .map(e => e.competitionName)
        .filter(Boolean)
    ).size}`
  );

  console.log(
    `🏀 Maç: ${allEvents.length}`
  );

  const details =
    await getDetails(allEvents);

  const newRecords = [];

  let scored = 0;
  let completed = 0;
  let periodCount = 0;

  for (const event of allEvents) {
    const detail =
      details.get(
        String(event.sbsEventId)
      );

    const record =
      makeRecord(
        event,
        detail
      );

    if (
      record.homeScore !== null &&
      record.awayScore !== null
    ) {
      scored++;
    }

    if (
      validFinishedRecord(record)
    ) {
      completed++;
    }

    if (
      record.period1 ||
      record.period2 ||
      record.period3 ||
      record.period4
    ) {
      periodCount++;
    }

    newRecords.push(record);
  }

  // Sadece Bilyoner + 2026/27 sezonu.
  // Eski Mackolik kayıtlarını korumuyoruz.
  const currentSeason =
    newRecords.filter(
      isCurrentSeason
    );

  const unique =
    uniqueMatches(
      currentSeason
    );

  unique.sort((a, b) => {
    const da =
      String(a.date || "");

    const db =
      String(b.date || "");

    return da.localeCompare(db);
  });

  const output = {
    source:
      "https://www.bilyoner.com/canli-skor/basketbol-canli-skor",

    season:
      "2026-2027",

    startDate:
      SEASON_START,

    endDate:
      TODAY,

    updatedAt:
      new Date().toISOString(),

    total:
      unique.length,

    completed:
      unique.filter(
        validFinishedRecord
      ).length,

    withPeriods:
      unique.filter(
        m =>
          m.period1 ||
          m.period2 ||
          m.period3 ||
          m.period4
      ).length,

    matches:
      unique
  };

  await fs.mkdir(
    path.dirname(DATA_PATH),
    { recursive: true }
  );

  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `✅ Skorlu: ${scored}`
  );

  console.log(
    `🏁 Tamamlanan: ${completed}`
  );

  console.log(
    `📊 Periyotlu: ${periodCount}`
  );

  console.log(
    `📁 ${DATA_PATH}`
  );
}

main().catch(error => {
  console.error(
    "❌ HATA:",
    error.message
  );

  process.exit(1);
});
