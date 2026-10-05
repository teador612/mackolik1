// scripts/update-basketball-history.mjs
// SportScore - 2026/27 Basketbol Geçmişi
//
// Kaynak:
// https://sportscore.com/
// API:
// https://sportscore.com/api/v1/fixtures/
//
// Amaç:
// - Sadece 2026/27 sezonu
// - 60 gün sınırı YOK
// - 01.08.2026'dan bugüne kadar
// - Basketbol maçlarını toplar
// - Bitmiş maçların skorlarını kaydeder
// - Aynı maçı tekrar eklemez
// - Eski Mackolik/Bilyoner verilerini kullanmaz

import fs from "fs";
import path from "path";

const API =
  "https://sportscore.com/api/v1/fixtures/";

const OUTPUT =
  path.join(
    process.cwd(),
    "data",
    "basketball-history.json"
  );

// 2026/27 sezon başlangıcı
const START_DATE = "2026-08-01";

// --------------------------------------------------
// YARDIMCILAR
// --------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTeamName(match, side) {
  if (side === "home") {
    return (
      match.home ??
      match.home_team ??
      match.homeTeam ??
      match.home_name ??
      match.teams?.home?.name ??
      ""
    );
  }

  return (
    match.away ??
    match.away_team ??
    match.awayTeam ??
    match.away_name ??
    match.teams?.away?.name ??
    ""
  );
}

function getScore(match, side) {
  const direct =
    side === "home"
      ? [
          match.home_score,
          match.homeScore,
          match.score?.home,
          match.scores?.home,
          match.teams?.home?.score
        ]
      : [
          match.away_score,
          match.awayScore,
          match.score?.away,
          match.scores?.away,
          match.teams?.away?.score
        ];

  for (const value of direct) {
    const n = Number(value);

    if (Number.isFinite(n)) {
      return n;
    }
  }

  return null;
}

function getStatus(match) {
  return String(
    match.status ??
    match.match_status ??
    match.state ??
    ""
  ).toLowerCase();
}

function isFinished(match) {
  const status = getStatus(match);

  return [
    "finished",
    "ended",
    "final",
    "completed",
    "ft"
  ].includes(status);
}

// --------------------------------------------------
// TARİH LİSTESİ
// --------------------------------------------------

function makeDates(start, end) {
  const result = [];

  let current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (current <= last) {
    result.push(isoDate(current));

    current = new Date(
      current.getTime() + 86400000
    );
  }

  return result;
}

// --------------------------------------------------
// SPORT SCORE
// --------------------------------------------------

async function fetchDay(date) {
  const url =
    `${API}?sport=basketball&date=${date}&limit=200`;

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (compatible; MackolikBasketball/1.0)"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  const data = await response.json();

  return Array.isArray(data?.matches)
    ? data.matches
    : Array.isArray(data?.data)
      ? data.data
      : [];
}

// --------------------------------------------------
// MAÇ DÖNÜŞÜMÜ
// --------------------------------------------------

function convertMatch(match, date) {
  const home = getTeamName(match, "home");
  const away = getTeamName(match, "away");

  if (!home || !away) {
    return null;
  }

  const homeScore = getScore(match, "home");
  const awayScore = getScore(match, "away");

  const status = getStatus(match);

  const slug =
    match.slug ??
    match.match_slug ??
    "";

  const id =
    match.id ??
    match.match_id ??
    match.fixture_id ??
    slug ??
    `${date}-${normalize(home)}-${normalize(away)}`;

  return {
    id: String(id),

    date,

    time:
      match.time ??
      match.start_time ??
      match.date ??
      null,

    home,
    away,

    homeNormalized: normalize(home),
    awayNormalized: normalize(away),

    score: {
      home: homeScore,
      away: awayScore
    },

    status,

    finished:
      isFinished(match) ||
      (
        homeScore !== null &&
        awayScore !== null
      ),

    slug,

    competition:
      match.competition ??
      match.league ??
      match.tournament ??
      match.competition_name ??
      null,

    source: "sportscore"
  };
}

// --------------------------------------------------
// ANA İŞLEM
// --------------------------------------------------

async function main() {
  const today = isoDate(new Date());

  const dates = makeDates(
    START_DATE,
    today
  );

  console.log("");
  console.log("🏀 SPORTScore BASKETBOL GEÇMİŞİ");
  console.log(
    `📅 ${START_DATE} → ${today}`
  );

  const all = new Map();

  let finishedCount = 0;
  let scoredCount = 0;
  let failedDays = 0;

  for (const date of dates) {
    try {
      const matches = await fetchDay(date);

      let dayFinished = 0;

      for (const match of matches) {
        const converted =
          convertMatch(match, date);

        if (!converted) {
          continue;
        }

        const old =
          all.get(converted.id);

        // Aynı maç daha önce geldiyse
        // daha dolu olan kaydı tercih et.
        if (!old) {
          all.set(
            converted.id,
            converted
          );
        } else {
          const oldScore =
            old.score?.home !== null &&
            old.score?.away !== null;

          const newScore =
            converted.score?.home !== null &&
            converted.score?.away !== null;

          if (!oldScore && newScore) {
            all.set(
              converted.id,
              converted
            );
          }
        }

        if (
          converted.score.home !== null &&
          converted.score.away !== null
        ) {
          scoredCount++;
        }

        if (converted.finished) {
          dayFinished++;
        }
      }

      finishedCount += dayFinished;

      // Her gün için gereksiz log basmıyoruz.
      // GitHub Actions logu kısa kalacak.

      await sleep(100);
    } catch (error) {
      failedDays++;

      console.log(
        `⚠️ ${date} | ${error.message}`
      );
    }
  }

  // ------------------------------------------------
  // SONUÇ
  // ------------------------------------------------

  const matches =
    Array.from(all.values())
      .sort((a, b) => {
        const da =
          `${a.date} ${a.time || ""}`;

        const db =
          `${b.date} ${b.time || ""}`;

        return da.localeCompare(db);
      });

  const leagues = new Set();

  for (const match of matches) {
    if (match.competition) {
      leagues.add(
        typeof match.competition === "string"
          ? match.competition
          : JSON.stringify(match.competition)
      );
    }
  }

  const finalFinished =
    matches.filter(
      m => m.finished
    ).length;

  const finalScored =
    matches.filter(
      m =>
        m.score?.home !== null &&
        m.score?.away !== null
    ).length;

  const output = {
    source: "SportScore",
    sport: "basketball",
    season: "2026-2027",

    startDate: START_DATE,
    endDate: today,

    updatedAt:
      new Date().toISOString(),

    totalLeagues:
      leagues.size,

    totalMatches:
      matches.length,

    scoredMatches:
      finalScored,

    finishedMatches:
      finalFinished,

    matches
  };

  fs.mkdirSync(
    path.dirname(OUTPUT),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    OUTPUT,
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
    `🏀 Maç: ${matches.length}`
  );

  console.log(
    `✅ Skorlu: ${finalScored}`
  );

  console.log(
    `🏁 Tamamlanan: ${finalFinished}`
  );

  if (failedDays > 0) {
    console.log(
      `⚠️ Hatalı gün: ${failedDays}`
    );
  }

  console.log(
    `📁 ${OUTPUT}`
  );

  console.log("");
}

main().catch(error => {
  console.error(
    "❌ HATA:",
    error.message
  );

  process.exit(1);
});
