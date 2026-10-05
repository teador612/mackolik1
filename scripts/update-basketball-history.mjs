// scripts/update-basketball-history.mjs

import fs from "fs";
import path from "path";

const API_BASE = "https://www.bilyoner.com/api";
const API_PATH = "/mobile/live-score/event/v2/basketball";

const DATA_PATH = path.resolve(
  "data",
  "basketball-history.json"
);

const SEASON_START = "2026-08-01";
const TODAY = new Date().toISOString().slice(0, 10);

const HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://www.bilyoner.com/",
  "Origin": "https://www.bilyoner.com"
};

// --------------------------------------------------
// YARDIMCILAR
// --------------------------------------------------

function clean(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function first(...values) {
  for (const v of values) {
    if (
      v !== undefined &&
      v !== null &&
      v !== ""
    ) {
      return v;
    }
  }

  return null;
}

function number(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const n = Number(
    value
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(n) ? n : null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dateRange(start, end) {
  const dates = [];

  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);

  while (d <= e) {
    dates.push(
      d.toISOString().slice(0, 10)
    );

    d.setUTCDate(
      d.getUTCDate() + 1
    );
  }

  return dates;
}

// --------------------------------------------------
// TAKIM
// --------------------------------------------------

function teamName(team) {
  if (!team) return "";

  if (typeof team === "string") {
    return clean(team);
  }

  return clean(
    first(
      team.name,
      team.teamName,
      team.displayName,
      team.title,
      team.label
    )
  );
}

// --------------------------------------------------
// SKOR
// --------------------------------------------------

function scoreFrom(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const home = number(
    first(
      value.home,
      value.homeScore,
      value.homeTeamScore,
      value.homeValue
    )
  );

  const away = number(
    first(
      value.away,
      value.awayScore,
      value.awayTeamScore,
      value.awayValue
    )
  );

  if (
    home === null ||
    away === null
  ) {
    return null;
  }

  return {
    home,
    away
  };
}

function getScore(event) {
  const candidates = [
    event.currentScore,
    event.finalScore,
    event.fullTimeScore,
    event.score,
    event.matchScore,
    event.result,
    event.eventScores?.currentScore,
    event.eventScores?.finalScore,
    event.eventScores?.score
  ];

  for (const candidate of candidates) {
    const score = scoreFrom(candidate);

    if (score) {
      return score;
    }
  }

  return null;
}

function getHalfScore(event) {
  const candidates = [
    event.halfScore,
    event.halfTimeScore,
    event.htScore,
    event.firstHalfScore,
    event.firstPeriodScore,
    event.eventScores?.halfScore,
    event.eventScores?.halfTimeScore
  ];

  for (const candidate of candidates) {
    const score = scoreFrom(candidate);

    if (score) {
      return score;
    }
  }

  return null;
}

// --------------------------------------------------
// TARİH
// --------------------------------------------------

function getDate(event, requestedDate) {
  const raw = first(
    event.matchDate,
    event.eventDate,
    event.startDate,
    event.startTime,
    event.scheduledDate,
    event.date
  );

  if (!raw) {
    return requestedDate;
  }

  const d = new Date(raw);

  if (Number.isNaN(d.getTime())) {
    return requestedDate;
  }

  return d.toISOString().slice(0, 10);
}

function getTime(event) {
  const raw = first(
    event.matchDate,
    event.eventDate,
    event.startDate,
    event.startTime,
    event.scheduledDate
  );

  if (!raw) return "";

  const d = new Date(raw);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toISOString().slice(11, 16);
}

// --------------------------------------------------
// LİG
// --------------------------------------------------

function getCompetitionName(competition) {
  if (!competition) {
    return "Bilinmiyor";
  }

  if (typeof competition === "string") {
    return clean(competition);
  }

  return clean(
    first(
      competition.name,
      competition.competitionName,
      competition.leagueName,
      competition.title,
      competition.displayName,
      competition.label
    )
  ) || "Bilinmiyor";
}

// --------------------------------------------------
// STATUS
// --------------------------------------------------

function getStatus(
  event,
  date,
  fullScore
) {
  const raw = clean(
    first(
      event.matchStatus,
      event.status,
      event.eventStatus,
      event.gameStatus,
      event.state
    )
  ).toLowerCase();

  // Açıkça iptal/ertelenmişse
  if (
    raw.includes("cancel") ||
    raw.includes("postpon") ||
    raw.includes("abandon")
  ) {
    return "cancelled";
  }

  // Bilyoner status değerini yakalayamazsak
  // skor + geçmiş tarih üzerinden tamamlandı.
  if (
    fullScore &&
    date < TODAY
  ) {
    return "finished";
  }

  // Yaygın canlı ifadeleri
  if (
    raw.includes("live") ||
    raw.includes("playing") ||
    raw.includes("period") ||
    raw.includes("started") ||
    raw.includes("quarter")
  ) {
    return "live";
  }

  // Yaygın tamamlanmış ifadeleri
  if (
    raw.includes("finish") ||
    raw.includes("complete") ||
    raw.includes("ended") ||
    raw.includes("final")
  ) {
    return "finished";
  }

  return "not_started";
}

// --------------------------------------------------
// EVENT ÇIKARMA
// --------------------------------------------------

function isEvent(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const id = first(
    obj.sbsEventId,
    obj.eventId,
    obj.id
  );

  const home = first(
    obj.homeTeam,
    obj.homeTeamInfo,
    obj.home
  );

  const away = first(
    obj.awayTeam,
    obj.awayTeamInfo,
    obj.away
  );

  return Boolean(
    id &&
    home &&
    away
  );
}

// --------------------------------------------------
// COMPETITION -> EVENT
// --------------------------------------------------

function extractCompetitionEvents(
  competition,
  fallbackLeague
) {
  const league =
    getCompetitionName(
      competition
    ) || fallbackLeague;

  const events = [];

  const possibleArrays = [
    competition.events,
    competition.basketballEvents,
    competition.matches,
    competition.games
  ];

  for (const list of possibleArrays) {
    if (!Array.isArray(list)) {
      continue;
    }

    for (const event of list) {
      if (isEvent(event)) {
        events.push({
          event,
          league
        });
      }
    }
  }

  // Bazı cevaplarda events daha derinde olabilir.
  if (events.length === 0) {
    scanObject(
      competition,
      league,
      events
    );
  }

  return events;
}

function scanObject(
  obj,
  league,
  output
) {
  if (!obj || typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      scanObject(
        item,
        league,
        output
      );
    }

    return;
  }

  if (isEvent(obj)) {
    output.push({
      event: obj,
      league
    });

    return;
  }

  for (const value of Object.values(obj)) {
    if (
      value &&
      typeof value === "object"
    ) {
      scanObject(
        value,
        league,
        output
      );
    }
  }
}

// --------------------------------------------------
// API
// --------------------------------------------------

async function fetchDate(date) {
  const url =
    `${API_BASE}${API_PATH}?date=${date}`;

  try {
    const response = await fetch(
      url,
      {
        headers: HEADERS
      }
    );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    const competitions =
      Array.isArray(
        data?.competitions
      )
        ? data.competitions
        : [];

    const result = [];

    for (
      const competition
      of competitions
    ) {
      result.push(
        ...extractCompetitionEvents(
          competition,
          "Bilinmiyor"
        )
      );
    }

    return result;

  } catch {
    return [];
  }
}

// --------------------------------------------------
// NORMALIZE
// --------------------------------------------------

function normalize(
  event,
  league,
  requestedDate
) {
  const id = String(
    first(
      event.sbsEventId,
      event.eventId,
      event.id
    ) || ""
  );

  const home = teamName(
    first(
      event.homeTeam,
      event.homeTeamInfo,
      event.home
    )
  );

  const away = teamName(
    first(
      event.awayTeam,
      event.awayTeamInfo,
      event.away
    )
  );

  if (
    !id ||
    !home ||
    !away
  ) {
    return null;
  }

  const date =
    getDate(
      event,
      requestedDate
    );

  // 2026-27 sezon sınırı
  if (
    date < SEASON_START
  ) {
    return null;
  }

  if (
    date > TODAY
  ) {
    return null;
  }

  const fullScore =
    getScore(event);

  const halfScore =
    getHalfScore(event);

  const status =
    getStatus(
      event,
      date,
      fullScore
    );

  return {
    id,

    date,

    time:
      getTime(event),

    league:
      league || "Bilinmiyor",

    homeTeam:
      home,

    awayTeam:
      away,

    score:
      fullScore
        ? `${fullScore.home}-${fullScore.away}`
        : null,

    halfTimeScore:
      halfScore
        ? `${halfScore.home}-${halfScore.away}`
        : null,

    status,

    source:
      "bilyoner",

    updatedAt:
      new Date().toISOString()
  };
}

// --------------------------------------------------
// ANA
// --------------------------------------------------

async function main() {
  console.log(
    "🏀 BİLYONER BASKETBOL GEÇMİŞİ"
  );

  console.log(
    `📅 2026-08-01 → ${TODAY}`
  );

  const dates =
    dateRange(
      SEASON_START,
      TODAY
    );

  const matches =
    new Map();

  let daysWithData = 0;

  for (
    const date of dates
  ) {
    const items =
      await fetchDate(date);

    if (
      items.length > 0
    ) {
      daysWithData++;
    }

    for (
      const item of items
    ) {
      const match =
        normalize(
          item.event,
          item.league,
          date
        );

      if (!match) {
        continue;
      }

      const old =
        matches.get(match.id);

      if (!old) {
        matches.set(
          match.id,
          match
        );
        continue;
      }

      // Skor sonradan geldiyse güncelle.
      if (
        !old.score &&
        match.score
      ) {
        matches.set(
          match.id,
          match
        );
        continue;
      }

      // Tamamlanmış kayıt öncelikli.
      if (
        match.status === "finished" &&
        old.status !== "finished"
      ) {
        matches.set(
          match.id,
          match
        );
      }
    }

    await sleep(100);
  }

  const list =
    Array.from(
      matches.values()
    ).sort((a, b) => {
      const A =
        `${a.date} ${a.time}`;

      const B =
        `${b.date} ${b.time}`;

      return A.localeCompare(B);
    });

  const leagues =
    new Set(
      list.map(
        x => x.league
      )
    );

  const scored =
    list.filter(
      x => x.score
    ).length;

  const finished =
    list.filter(
      x =>
        x.status ===
        "finished"
    ).length;

  const output = {
    source:
      "https://www.bilyoner.com",

    season:
      "2026-2027",

    updatedAt:
      new Date().toISOString(),

    totalMatches:
      list.length,

    matches:
      list
  };

  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
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

  console.log(
    `🏆 Lig: ${leagues.size}`
  );

  console.log(
    `🏀 Maç: ${list.length}`
  );

  console.log(
    `✅ Skorlu: ${scored}`
  );

  console.log(
    `🏁 Tamamlanan: ${finished}`
  );

  console.log(
    "📁 data/basketball-history.json"
  );
}

main().catch(error => {
  console.error(
    "❌ HATA:",
    error.message
  );

  process.exit(1);
});
