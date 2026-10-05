// scripts/update-basketball-history.mjs
// SPORTScore Basketbol Geçmişi
// 2026-2027 sezonu
// 200 maç/gün sınırını competition filtresi ile aşar

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

// SADECE 2026/27 SEZONU
const START_DATE = "2026-08-01";

// İstekler arasında küçük bekleme
const REQUEST_DELAY = 120;

// --------------------------------------------------
// YARDIMCI
// --------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(date) {
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

function getDates(start, end) {
  const dates = [];

  let current =
    new Date(`${start}T00:00:00Z`);

  const last =
    new Date(`${end}T00:00:00Z`);

  while (current <= last) {
    dates.push(formatDate(current));

    current = new Date(
      current.getTime() + 86400000
    );
  }

  return dates;
}

// --------------------------------------------------
// TAKIM
// --------------------------------------------------

function getHome(match) {
  return (
    match.home ??
    match.home_team ??
    match.homeTeam ??
    match.home_name ??
    match.teams?.home?.name ??
    ""
  );
}

function getAway(match) {
  return (
    match.away ??
    match.away_team ??
    match.awayTeam ??
    match.away_name ??
    match.teams?.away?.name ??
    ""
  );
}

// --------------------------------------------------
// SKOR
// --------------------------------------------------

function getHomeScore(match) {
  const values = [
    match.home_score,
    match.homeScore,
    match.score?.home,
    match.scores?.home,
    match.teams?.home?.score
  ];

  for (const value of values) {
    const n = Number(value);

    if (Number.isFinite(n)) {
      return n;
    }
  }

  return null;
}

function getAwayScore(match) {
  const values = [
    match.away_score,
    match.awayScore,
    match.score?.away,
    match.scores?.away,
    match.teams?.away?.score
  ];

  for (const value of values) {
    const n = Number(value);

    if (Number.isFinite(n)) {
      return n;
    }
  }

  return null;
}

// --------------------------------------------------
// DURUM
// --------------------------------------------------

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

  if (
    [
      "finished",
      "ended",
      "final",
      "completed",
      "ft"
    ].includes(status)
  ) {
    return true;
  }

  const home = getHomeScore(match);
  const away = getAwayScore(match);

  return (
    home !== null &&
    away !== null
  );
}

// --------------------------------------------------
// LİG / COMPETITION
// --------------------------------------------------

function getCompetition(match) {
  const value =
    match.competition ??
    match.league ??
    match.tournament ??
    match.competition_name ??
    null;

  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      name: value,
      slug: normalize(value).replace(/ /g, "-")
    };
  }

  return {
    id:
      value.id ??
      value.competition_id ??
      null,

    name:
      value.name ??
      value.title ??
      value.label ??
      "",

    slug:
      value.slug ??
      value.competition_slug ??
      normalize(
        value.name ??
        value.title ??
        ""
      ).replace(/ /g, "-")
  };
}

// --------------------------------------------------
// API
// --------------------------------------------------

async function request(url) {
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

  return response.json();
}

// --------------------------------------------------
// GÜNÜN GENEL LİSTESİ
// --------------------------------------------------

async function getDayMatches(date) {
  const url =
    `${API}?sport=basketball` +
    `&date=${date}` +
    `&limit=200`;

  const data =
    await request(url);

  if (Array.isArray(data?.matches)) {
    return data.matches;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

// --------------------------------------------------
// LİGE GÖRE TÜM MAÇLAR
// --------------------------------------------------

async function getCompetitionMatches(
  date,
  competition
) {
  const slug =
    competition?.slug;

  if (!slug) {
    return [];
  }

  const url =
    `${API}?sport=basketball` +
    `&date=${date}` +
    `&competition=${encodeURIComponent(slug)}` +
    `&limit=200`;

  try {
    const data =
      await request(url);

    if (Array.isArray(data?.matches)) {
      return data.matches;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  } catch {
    return [];
  }
}

// --------------------------------------------------
// MAÇI KAYIT FORMATINA ÇEVİR
// --------------------------------------------------

function convertMatch(
  match,
  date
) {
  const home =
    getHome(match);

  const away =
    getAway(match);

  if (!home || !away) {
    return null;
  }

  const homeScore =
    getHomeScore(match);

  const awayScore =
    getAwayScore(match);

  const competition =
    getCompetition(match);

  const id =
    match.id ??
    match.match_id ??
    match.fixture_id ??
    match.slug ??
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

    homeNormalized:
      normalize(home),

    awayNormalized:
      normalize(away),

    score: {
      home: homeScore,
      away: awayScore
    },

    status:
      getStatus(match),

    finished:
      isFinished(match),

    competition,

    slug:
      match.slug ??
      match.match_slug ??
      "",

    source:
      "sportscore"
  };
}

// --------------------------------------------------
// ANA
// --------------------------------------------------

async function main() {
  const today =
    formatDate(new Date());

  const dates =
    getDates(
      START_DATE,
      today
    );

  const allMatches =
    new Map();

  const competitionsSeen =
    new Set();

  let failedDays = 0;

  console.log("");
  console.log(
    "🏀 SPORTScore BASKETBOL GEÇMİŞİ"
  );

  console.log(
    `📅 ${START_DATE} → ${today}`
  );

  console.log(
    `📆 Gün: ${dates.length}`
  );

  // ------------------------------------------------
  // HER GÜN
  // ------------------------------------------------

  for (const date of dates) {
    try {
      // Önce günü alıyoruz.
      const baseMatches =
        await getDayMatches(date);

      // Genel listeden ligleri bul.
      const competitions =
        new Map();

      for (
        const match of baseMatches
      ) {
        const competition =
          getCompetition(match);

        if (
          competition?.slug
        ) {
          competitions.set(
            competition.slug,
            competition
          );
        }
      }

      // Eğer 200 veya daha az maç varsa
      // genel liste yeterli.
      if (
        baseMatches.length < 200
      ) {
        for (
          const match of baseMatches
        ) {
          const converted =
            convertMatch(
              match,
              date
            );

          if (!converted) {
            continue;
          }

          allMatches.set(
            converted.id,
            converted
          );
        }
      }

      // 200'e ulaştıysa veya daha fazlaysa
      // bütün ligleri ayrı ayrı çekiyoruz.
      else {
        for (
          const competition
          of competitions.values()
        ) {
          const matches =
            await getCompetitionMatches(
              date,
              competition
            );

          for (
            const match of matches
          ) {
            const converted =
              convertMatch(
                match,
                date
              );

            if (!converted) {
              continue;
            }

            allMatches.set(
              converted.id,
              converted
            );
          }

          competitionsSeen.add(
            competition.slug
          );

          await sleep(
            REQUEST_DELAY
          );
        }
      }

      await sleep(
        REQUEST_DELAY
      );

    } catch (error) {
      failedDays++;

      console.log(
        `⚠️ ${date} | ${error.message}`
      );
    }
  }

  // ------------------------------------------------
  // SIRALA
  // ------------------------------------------------

  const matches =
    Array.from(
      allMatches.values()
    ).sort(
      (a, b) => {
        const da =
          `${a.date} ${a.time || ""}`;

        const db =
          `${b.date} ${b.time || ""}`;

        return da.localeCompare(db);
      }
    );

  // ------------------------------------------------
  // İSTATİSTİK
  // ------------------------------------------------

  const leagueSet =
    new Set();

  for (
    const match of matches
  ) {
    if (
      match.competition?.slug
    ) {
      leagueSet.add(
        match.competition.slug
      );
    }
  }

  const scored =
    matches.filter(
      match =>
        match.score.home !== null &&
        match.score.away !== null
    ).length;

  const finished =
    matches.filter(
      match =>
        match.finished
    ).length;

  // ------------------------------------------------
  // JSON
  // ------------------------------------------------

  const output = {
    source:
      "SportScore",

    sport:
      "basketball",

    season:
      "2026-2027",

    startDate:
      START_DATE,

    endDate:
      today,

    updatedAt:
      new Date().toISOString(),

    totalLeagues:
      leagueSet.size,

    totalMatches:
      matches.length,

    scoredMatches:
      scored,

    finishedMatches:
      finished,

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

  // ------------------------------------------------
  // KISA LOG
  // ------------------------------------------------

  console.log("");
  console.log(
    `🏆 Lig: ${leagueSet.size}`
  );

  console.log(
    `🏀 Maç: ${matches.length}`
  );

  console.log(
    `✅ Skorlu: ${scored}`
  );

  console.log(
    `🏁 Tamamlanan: ${finished}`
  );

  if (failedDays) {
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
    `❌ ${error.message}`
  );

  process.exit(1);
});
