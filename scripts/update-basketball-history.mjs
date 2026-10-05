// scripts/update-basketball-history.mjs
// Bilyoner 2026-2027 Basketbol Geçmişi

import fs from "fs";
import path from "path";

const API_BASE = "https://www.bilyoner.com/api";
const API_PATH = "/mobile/live-score/event/v2/basketball";

const DATA_PATH = path.resolve(
  "data",
  "basketball-history.json"
);

// 2026-2027 sezonu başlangıcı.
// Geçmiş sezonlara kesinlikle girilmez.
const SEASON_START = "2026-08-01";

const today = new Date();
const TODAY = today.toISOString().slice(0, 10);

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.bilyoner.com/",
  "Origin": "https://www.bilyoner.com"
};

// ---------------------------------------------------------
// YARDIMCILAR
// ---------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dateRange(start, end) {
  const result = [];

  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);

  while (d <= e) {
    result.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return result;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!cleaned) return null;

  const n = Number(cleaned);

  return Number.isFinite(n) ? n : null;
}

function scoreObject(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const home = toNumber(
    firstValue(
      value.home,
      value.homeScore,
      value.homeTeamScore,
      value.homeValue
    )
  );

  const away = toNumber(
    firstValue(
      value.away,
      value.awayScore,
      value.awayTeamScore,
      value.awayValue
    )
  );

  if (home === null || away === null) {
    return null;
  }

  return {
    home,
    away
  };
}

function findScore(obj, keys = []) {
  if (!obj || typeof obj !== "object") {
    return null;
  }

  for (const key of keys) {
    const score = scoreObject(obj[key]);

    if (score) {
      return score;
    }
  }

  return null;
}

// ---------------------------------------------------------
// EVENT TESPİTİ
// ---------------------------------------------------------

function looksLikeEvent(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const id = firstValue(
    obj.sbsEventId,
    obj.eventId,
    obj.id
  );

  const home = firstValue(
    obj.homeTeam,
    obj.homeTeamName,
    obj.home
  );

  const away = firstValue(
    obj.awayTeam,
    obj.awayTeamName,
    obj.away
  );

  return Boolean(
    id &&
    home &&
    away &&
    typeof home !== "object" &&
    typeof away !== "object"
  );
}

function collectEvents(node, output = []) {
  if (!node || typeof node !== "object") {
    return output;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectEvents(item, output);
    }

    return output;
  }

  if (looksLikeEvent(node)) {
    output.push(node);
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      collectEvents(value, output);
    }
  }

  return output;
}

// ---------------------------------------------------------
// TAKIM / LİG / TARİH
// ---------------------------------------------------------

function getTeamName(team) {
  if (!team) return "";

  if (typeof team === "string") {
    return cleanText(team);
  }

  return cleanText(
    firstValue(
      team.name,
      team.teamName,
      team.displayName,
      team.title,
      team.label
    )
  );
}

function getCompetition(event) {
  const competition =
    event.competition ||
    event.competitionInfo ||
    event.league ||
    event.tournament ||
    {};

  if (typeof competition === "string") {
    return cleanText(competition);
  }

  return cleanText(
    firstValue(
      competition.name,
      competition.competitionName,
      competition.leagueName,
      competition.title,
      event.competitionName,
      event.leagueName,
      event.league,
      event.tournamentName
    )
  );
}

function getEventDate(event, fallbackDate) {
  const raw = firstValue(
    event.matchDate,
    event.eventDate,
    event.startDate,
    event.startTime,
    event.date,
    event.scheduledDate
  );

  if (!raw) {
    return fallbackDate;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return fallbackDate;
  }

  return parsed.toISOString().slice(0, 10);
}

function getEventTime(event) {
  const raw = firstValue(
    event.matchDate,
    event.eventDate,
    event.startDate,
    event.startTime,
    event.scheduledDate
  );

  if (!raw) return "";

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(11, 16);
}

// ---------------------------------------------------------
// SKOR
// ---------------------------------------------------------

function getScores(event) {
  let fullTime =
    findScore(event, [
      "currentScore",
      "finalScore",
      "fullTimeScore",
      "score",
      "matchScore",
      "result"
    ]);

  let halfTime =
    findScore(event, [
      "halfScore",
      "halfTimeScore",
      "htScore",
      "firstHalfScore",
      "firstPeriodScore"
    ]);

  // Bazı Bilyoner cevaplarında score doğrudan eventScores
  // altında bulunabiliyor.
  if (!fullTime && event.eventScores) {
    fullTime =
      findScore(event.eventScores, [
        "currentScore",
        "finalScore",
        "fullTimeScore",
        "score"
      ]) ||
      scoreObject(event.eventScores);
  }

  if (!halfTime && event.eventScores) {
    halfTime =
      findScore(event.eventScores, [
        "halfScore",
        "halfTimeScore",
        "htScore"
      ]);
  }

  return {
    score: fullTime,
    halfTime
  };
}

function getStatus(event, score) {
  const raw = cleanText(
    firstValue(
      event.matchStatus,
      event.status,
      event.eventStatus,
      event.gameStatus,
      event.state
    )
  ).toLowerCase();

  if (score) {
    if (
      raw.includes("finished") ||
      raw.includes("complete") ||
      raw.includes("ended") ||
      raw.includes("final")
    ) {
      return "finished";
    }
  }

  if (
    raw.includes("live") ||
    raw.includes("playing") ||
    raw.includes("started") ||
    raw.includes("period")
  ) {
    return "live";
  }

  if (
    raw.includes("cancel") ||
    raw.includes("postpon")
  ) {
    return "cancelled";
  }

  if (
    raw.includes("finished") ||
    raw.includes("complete") ||
    raw.includes("ended") ||
    raw.includes("final")
  ) {
    return "finished";
  }

  return "not_started";
}

// ---------------------------------------------------------
// EVENT -> KAYIT
// ---------------------------------------------------------

function normalizeEvent(event, requestDate) {
  const id = String(
    firstValue(
      event.sbsEventId,
      event.eventId,
      event.id
    )
  );

  const home = getTeamName(
    firstValue(
      event.homeTeam,
      event.homeTeamInfo,
      event.home
    )
  );

  const away = getTeamName(
    firstValue(
      event.awayTeam,
      event.awayTeamInfo,
      event.away
    )
  );

  if (!id || !home || !away) {
    return null;
  }

  const date = getEventDate(event, requestDate);
  const time = getEventTime(event);
  const competition = getCompetition(event);

  const scores = getScores(event);
  const status = getStatus(
    event,
    scores.score
  );

  return {
    id,
    date,
    time,
    league: competition || "Bilinmiyor",
    homeTeam: home,
    awayTeam: away,

    score: scores.score
      ? `${scores.score.home}-${scores.score.away}`
      : null,

    halfTimeScore: scores.halfTime
      ? `${scores.halfTime.home}-${scores.halfTime.away}`
      : null,

    status,

    source: "bilyoner",

    updatedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------
// API
// ---------------------------------------------------------

async function fetchDate(date) {
  const url =
    `${API_BASE}${API_PATH}?date=${date}`;

  try {
    const response = await fetch(url, {
      headers: HEADERS
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    return collectEvents(data);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------
// ANA İŞLEM
// ---------------------------------------------------------

async function main() {
  console.log("🏀 BİLYONER BASKETBOL GEÇMİŞİ");
  console.log(`📅 Sezon: 2026-2027`);
  console.log(`📅 Aralık: ${SEASON_START} → ${TODAY}`);

  const dates = dateRange(
    SEASON_START,
    TODAY
  );

  const allMatches = new Map();

  let successfulDays = 0;

  for (const date of dates) {
    const events = await fetchDate(date);

    if (events.length > 0) {
      successfulDays++;

      for (const event of events) {
        const match = normalizeEvent(
          event,
          date
        );

        if (!match) continue;

        // Geçmiş sezonların girmesini engelle.
        if (match.date < SEASON_START) {
          continue;
        }

        // ID benzersiz.
        const key =
          `${match.id}`;

        const old = allMatches.get(key);

        // Aynı maç tekrar geldiyse daha dolu
        // olan kaydı tercih et.
        if (!old) {
          allMatches.set(key, match);
        } else {
          const oldScore =
            old.score !== null;

          const newScore =
            match.score !== null;

          if (
            (!oldScore && newScore) ||
            match.status === "finished"
          ) {
            allMatches.set(key, match);
          }
        }
      }
    }

    // API'yi gereksiz hızlandırmamak için.
    await sleep(120);
  }

  const matches = Array.from(
    allMatches.values()
  ).sort((a, b) => {
    const da =
      `${a.date} ${a.time}`;

    const db =
      `${b.date} ${b.time}`;

    return da.localeCompare(db);
  });

  // -------------------------------------------------------
  // ESKİ DOSYA BİLEREK YOK SAYILIYOR
  // -------------------------------------------------------

  const output = {
    source:
      "https://www.bilyoner.com",
    season: "2026-2027",
    updatedAt:
      new Date().toISOString(),
    totalMatches:
      matches.length,
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

  const leagues = new Set(
    matches.map(
      m => m.league
    )
  );

  const finished =
    matches.filter(
      m => m.status === "finished"
    ).length;

  const withScore =
    matches.filter(
      m => m.score
    ).length;

  console.log(`🏆 Lig: ${leagues.size}`);
  console.log(`🏀 Maç: ${matches.length}`);
  console.log(`✅ Skorlu: ${withScore}`);
  console.log(`🏁 Tamamlanan: ${finished}`);
  console.log(`📁 Kaydedildi: data/basketball-history.json`);
}

main().catch(error => {
  console.error(
    "❌ HATA:",
    error.message
  );

  process.exit(1);
});
