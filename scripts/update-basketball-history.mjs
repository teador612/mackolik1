// scripts/update-basketball-history.mjs

import fs from "node:fs/promises";

const API =
  "https://www.bilyoner.com/api/mobile/live-score/event/v2/basketball";

const OUTPUT =
  "data/basketball-history.json";

const START_DATE = "2026-08-01";

const TODAY =
  new Date().toISOString().slice(0, 10);

const SEASON_START_YEAR = 2026;
const SEASON_END_YEAR = 2027;


// ======================================================
// YARDIMCILAR
// ======================================================

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}


function dateRange(start, end) {

  const result = [];

  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (d <= last) {

    result.push(
      d.toISOString().slice(0, 10)
    );

    d.setUTCDate(
      d.getUTCDate() + 1
    );
  }

  return result;
}


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

  const iso =
    s.match(/^(\d{4}-\d{2}-\d{2})/);

  if (iso) {
    return iso[1];
  }

  const tr =
    s.match(
      /^(\d{2})[./-](\d{2})[./-](\d{4})/
    );

  if (tr) {

    return (
      `${tr[3]}-${tr[2]}-${tr[1]}`
    );
  }

  return "";
}


function number(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n =
    Number(
      String(value)
        .replace(",", ".")
        .trim()
    );

  return Number.isFinite(n)
    ? n
    : null;
}


// ======================================================
// SKOR OKUMA
// ======================================================

function parseScore(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  if (typeof value === "string") {

    const m =
      value.match(
        /(\d+)\s*[-:]\s*(\d+)/
      );

    if (!m) return null;

    return {
      home: Number(m[1]),
      away: Number(m[2])
    };
  }


  if (typeof value === "object") {

    const home =
      number(
        value.home ??
        value.homeScore ??
        value.homeTeamScore ??
        value.homePoints
      );

    const away =
      number(
        value.away ??
        value.awayScore ??
        value.awayTeamScore ??
        value.awayPoints
      );

    if (
      home !== null &&
      away !== null
    ) {

      return {
        home,
        away
      };
    }
  }

  return null;
}


// ======================================================
// PERİYOT OKUMA
// ======================================================

function parsePeriodObject(value) {

  if (!value) {
    return null;
  }


  const score =
    parseScore(value);

  if (score) {
    return score;
  }


  if (
    typeof value === "object"
  ) {

    const home =
      number(
        value.home ??
        value.homeScore ??
        value.homeTeamScore ??
        value.homePoints ??
        value.h
      );

    const away =
      number(
        value.away ??
        value.awayScore ??
        value.awayTeamScore ??
        value.awayPoints ??
        value.a
      );

    if (
      home !== null &&
      away !== null
    ) {

      return {
        home,
        away
      };
    }
  }

  return null;
}


// ======================================================
// EVENT İÇİNDEN PERİYOTLARI BUL
// ======================================================

function extractPeriods(event) {

  let p1 = null;
  let p2 = null;
  let p3 = null;
  let p4 = null;


  // ----------------------------------------------
  // Olası doğrudan alanlar
  // ----------------------------------------------

  p1 =
    parsePeriodObject(
      event.period1 ??
      event.period01 ??
      event.firstPeriod ??
      event.firstQuarter ??
      event.quarter1 ??
      event.q1
    );


  p2 =
    parsePeriodObject(
      event.period2 ??
      event.period02 ??
      event.secondPeriod ??
      event.secondQuarter ??
      event.quarter2 ??
      event.q2
    );


  p3 =
    parsePeriodObject(
      event.period3 ??
      event.period03 ??
      event.thirdPeriod ??
      event.thirdQuarter ??
      event.quarter3 ??
      event.q3
    );


  p4 =
    parsePeriodObject(
      event.period4 ??
      event.period04 ??
      event.fourthPeriod ??
      event.fourthQuarter ??
      event.quarter4 ??
      event.q4
    );


  // ----------------------------------------------
  // periodScores / periods
  // ----------------------------------------------

  const containers = [
    event.periodScores,
    event.periods,
    event.quarters,
    event.quarterScores,
    event.score?.periods,
    event.scores?.periods,
    event.currentScore?.periods,
    event.eventScores?.periods
  ];


  for (const container of containers) {

    if (!container) continue;


    if (Array.isArray(container)) {

      for (
        let i = 0;
        i < container.length;
        i++
      ) {

        const score =
          parsePeriodObject(
            container[i]
          );

        if (!score) continue;

        if (i === 0 && !p1) p1 = score;
        if (i === 1 && !p2) p2 = score;
        if (i === 2 && !p3) p3 = score;
        if (i === 3 && !p4) p4 = score;
      }
    }


    else if (
      typeof container === "object"
    ) {

      const candidates1 = [
        container[1],
        container["1"],
        container.p1,
        container.period1,
        container.q1,
        container.quarter1
      ];

      const candidates2 = [
        container[2],
        container["2"],
        container.p2,
        container.period2,
        container.q2,
        container.quarter2
      ];

      const candidates3 = [
        container[3],
        container["3"],
        container.p3,
        container.period3,
        container.q3,
        container.quarter3
      ];

      const candidates4 = [
        container[4],
        container["4"],
        container.p4,
        container.period4,
        container.q4,
        container.quarter4
      ];


      if (!p1) {

        for (const x of candidates1) {

          const score =
            parsePeriodObject(x);

          if (score) {
            p1 = score;
            break;
          }
        }
      }


      if (!p2) {

        for (const x of candidates2) {

          const score =
            parsePeriodObject(x);

          if (score) {
            p2 = score;
            break;
          }
        }
      }


      if (!p3) {

        for (const x of candidates3) {

          const score =
            parsePeriodObject(x);

          if (score) {
            p3 = score;
            break;
          }
        }
      }


      if (!p4) {

        for (const x of candidates4) {

          const score =
            parsePeriodObject(x);

          if (score) {
            p4 = score;
            break;
          }
        }
      }
    }
  }


  // ----------------------------------------------
  // cumulative skor desteği
  //
  // Bazı sistemlerde:
  // 1. periyot = 20-18
  // devre = 42-37
  // 3. periyot sonu = 65-55
  // maç = 88-74
  //
  // Bu durumda farklardan periyot çıkarılabilir.
  // ----------------------------------------------

  const cumulative =
    event.periodScoresCumulative ??
    event.cumulativeScores ??
    event.score?.cumulativePeriods;


  if (
    Array.isArray(cumulative) &&
    cumulative.length >= 4
  ) {

    const c1 =
      parsePeriodObject(cumulative[0]);

    const c2 =
      parsePeriodObject(cumulative[1]);

    const c3 =
      parsePeriodObject(cumulative[2]);

    const c4 =
      parsePeriodObject(cumulative[3]);


    if (c1 && !p1) {

      p1 = c1;
    }


    if (c1 && c2 && !p2) {

      p2 = {
        home:
          c2.home - c1.home,

        away:
          c2.away - c1.away
      };
    }


    if (c2 && c3 && !p3) {

      p3 = {
        home:
          c3.home - c2.home,

        away:
          c3.away - c2.away
      };
    }


    if (c3 && c4 && !p4) {

      p4 = {
        home:
          c4.home - c3.home,

        away:
          c4.away - c3.away
      };
    }
  }


  return {
    p1,
    p2,
    p3,
    p4
  };
}


// ======================================================
// MAÇIN ANA SKORUNU BUL
// ======================================================

function extractFullScore(event) {

  const candidates = [

    event.currentScore,

    event.score,

    event.fullScore,

    event.finalScore,

    event.result,

    event.eventScore,

    event.scores?.full,

    event.scores?.final,

    event.eventScores?.full,

    event.eventScores?.final

  ];


  for (const candidate of candidates) {

    const score =
      parseScore(candidate);

    if (score) {
      return score;
    }
  }

  return null;
}


// ======================================================
// İLK YARI SKORU
// ======================================================

function extractHalfScore(
  event,
  periods
) {

  const candidates = [

    event.halfTimeScore,

    event.halfScore,

    event.firstHalfScore,

    event.htScore,

    event.score?.halfTime,

    event.score?.half,

    event.scores?.halfTime,

    event.scores?.half,

    event.eventScores?.halfTime,

    event.eventScores?.half

  ];


  for (const candidate of candidates) {

    const score =
      parseScore(candidate);

    if (score) {
      return score;
    }
  }


  // İlk iki periyottan hesapla
  if (
    periods.p1 &&
    periods.p2
  ) {

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


// ======================================================
// EVENT İÇİNDEN TAKIM İSMİ
// ======================================================

function getTeamName(
  value
) {

  if (
    typeof value === "string"
  ) {
    return cleanName(value);
  }


  if (
    value &&
    typeof value === "object"
  ) {

    return cleanName(
      value.name ??
      value.teamName ??
      value.displayName ??
      value.shortName ??
      ""
    );
  }


  return "";
}


// ======================================================
// EVENT NORMALİZASYONU
// ======================================================

function normalizeEvent(
  event,
  league,
  requestedDate
) {

  if (
    !event ||
    typeof event !== "object"
  ) {
    return null;
  }


  const home =
    getTeamName(
      event.homeTeam ??
      event.home ??
      event.homeParticipant ??
      event.participants?.home
    );


  const away =
    getTeamName(
      event.awayTeam ??
      event.away ??
      event.awayParticipant ??
      event.participants?.away
    );


  if (!home || !away) {
    return null;
  }


  const date =
    getDate(
      event.matchDate ??
      event.date ??
      event.startDate ??
      event.eventDate ??
      event.startTime
    ) ||
    requestedDate;


  // Sadece 2026-27 sezonu
  const year =
    Number(date.slice(0, 4));

  if (
    year !== SEASON_START_YEAR &&
    year !== SEASON_END_YEAR
  ) {
    return null;
  }


  const score =
    extractFullScore(event);


  const periods =
    extractPeriods(event);


  const halfScore =
    extractHalfScore(
      event,
      periods
    );


  const status =
    String(
      event.matchStatus ??
      event.status ??
      event.eventStatus ??
      ""
    ).toLowerCase();


  const finished =
    score &&
    (
      date < TODAY ||
      /finish|ended|complete|closed|result|played/.test(status)
    );


  return {

    id:
      event.sbsEventId ??
      event.eventId ??
      event.id ??
      `${date}-${home}-${away}`,

    date,

    time:
      event.matchTime ??
      event.time ??
      event.startTime ??
      "",

    league,

    homeTeam: home,

    awayTeam: away,

    score:
      score
        ? `${score.home}-${score.away}`
        : null,

    halfTimeScore:
      halfScore
        ? `${halfScore.home}-${halfScore.away}`
        : null,


    // ==========================================
    // PERİYOTLAR
    // ==========================================

    period1:
      periods.p1
        ? `${periods.p1.home}-${periods.p1.away}`
        : null,

    period2:
      periods.p2
        ? `${periods.p2.home}-${periods.p2.away}`
        : null,

    period3:
      periods.p3
        ? `${periods.p3.home}-${periods.p3.away}`
        : null,

    period4:
      periods.p4
        ? `${periods.p4.home}-${periods.p4.away}`
        : null,


    status:
      finished
        ? "finished"
        : status || "not_started",

    source:
      "Bilyoner",

    updatedAt:
      new Date().toISOString()

  };
}


// ======================================================
// COMPETITION İÇİ MAÇLARI BUL
// ======================================================

function getCompetitionEvents(
  competition
) {

  const candidates = [

    competition.events,

    competition.basketballEvents,

    competition.matches,

    competition.games,

    competition.eventList,

    competition.items

  ];


  for (const list of candidates) {

    if (
      Array.isArray(list)
    ) {
      return list;
    }
  }


  return [];
}


// ======================================================
// BİLYONER'DAN BİR GÜN AL
// ======================================================

async function fetchDate(
  date
) {

  const url =
    `${API}?date=${date}`;


  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0"
        }
      }
    );


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );
  }


  return response.json();
}


// ======================================================
// ANA
// ======================================================

async function main() {

  console.log(
    "🏀 BİLYONER BASKETBOL GEÇMİŞİ"
  );

  console.log(
    `📅 ${START_DATE} → ${TODAY}`
  );

  const dates =
    dateRange(
      START_DATE,
      TODAY
    );


  const allMatches = new Map();

  let leagueCount = 0;


  for (
    let i = 0;
    i < dates.length;
    i++
  ) {

    const date =
      dates[i];


    try {

      const data =
        await fetchDate(date);


      const competitions =
        Array.isArray(
          data.competitions
        )
          ? data.competitions
          : [];


      leagueCount +=
        competitions.length;


      for (
        const competition
        of competitions
      ) {

        const league =
          cleanName(
            competition.name ??
            competition.leagueName ??
            competition.competitionName ??
            competition.title ??
            "Basketbol"
          );


        const events =
          getCompetitionEvents(
            competition
          );


        for (
          const event
          of events
        ) {

          const match =
            normalizeEvent(
              event,
              league,
              date
            );


          if (!match) {
            continue;
          }


          /*
           * Aynı maç farklı günlerde
           * tekrar gelirse ID ile
           * tek kayıt tut.
           */

          const key =
            String(match.id);


          const old =
            allMatches.get(key);


          if (!old) {

            allMatches.set(
              key,
              match
            );

          }
          else {

            // Yeni kayıtta skor varsa
            // eski kaydı güncelle.

            const oldFinished =
              old.status ===
              "finished";

            const newFinished =
              match.status ===
              "finished";


            if (
              !oldFinished &&
              newFinished
            ) {

              allMatches.set(
                key,
                match
              );

            }
            else {

              // Periyotlardan biri
              // sonradan geldiyse ekle.

              if (
                !old.period1 &&
                match.period1
              ) {
                old.period1 =
                  match.period1;
              }

              if (
                !old.period2 &&
                match.period2
              ) {
                old.period2 =
                  match.period2;
              }

              if (
                !old.period3 &&
                match.period3
              ) {
                old.period3 =
                  match.period3;
              }

              if (
                !old.period4 &&
                match.period4
              ) {
                old.period4 =
                  match.period4;
              }

              if (
                !old.halfTimeScore &&
                match.halfTimeScore
              ) {
                old.halfTimeScore =
                  match.halfTimeScore;
              }

              if (
                !old.score &&
                match.score
              ) {
                old.score =
                  match.score;
              }
            }
          }
        }
      }


      // Bilyoner'ı gereksiz yormamak için
      // küçük bekleme.
      await sleep(80);

    }
    catch (error) {

      console.log(
        `⚠️ ${date}: veri alınamadı`
      );
    }
  }


  // ====================================================
  // SON FİLTRE
  // ====================================================

  let matches =
    Array.from(
      allMatches.values()
    );


  matches =
    matches.filter(
      match => {

        const year =
          Number(
            match.date.slice(0, 4)
          );

        return (
          year === 2026 ||
          (
            year === 2027 &&
            match.date <= TODAY
          )
        );
      }
    );


  matches.sort(
    (a, b) => {

      const dateCompare =
        a.date.localeCompare(
          b.date
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
      }

      return String(
        a.time
      ).localeCompare(
        String(b.time)
      );
    }
  );


  // ====================================================
  // İSTATİSTİK
  // ====================================================

  const scored =
    matches.filter(
      m => !!m.score
    ).length;


  const finished =
    matches.filter(
      m =>
        m.status ===
        "finished"
    ).length;


  const p1 =
    matches.filter(
      m => !!m.period1
    ).length;


  const p2 =
    matches.filter(
      m => !!m.period2
    ).length;


  const p3 =
    matches.filter(
      m => !!m.period3
    ).length;


  const p4 =
    matches.filter(
      m => !!m.period4
    ).length;


  const leagues =
    new Set(
      matches.map(
        m => m.league
      )
    ).size;


  // ====================================================
  // KAYDET
  // ====================================================

  const output = {

    source:
      "https://www.bilyoner.com/canli-skor/basketbol-canli-skor",

    season:
      "2026-2027",

    updatedAt:
      new Date().toISOString(),

    dateRange: {
      start: START_DATE,
      end: TODAY
    },

    stats: {

      leagues,

      matches:
        matches.length,

      scored,

      finished,

      period1: p1,

      period2: p2,

      period3: p3,

      period4: p4

    },

    matches

  };


  await fs.mkdir(
    "data",
    {
      recursive: true
    }
  );


  await fs.writeFile(
    OUTPUT,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );


  // ====================================================
  // KISA LOG
  // ====================================================

  console.log(
    `🏆 Lig: ${leagues}`
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

  console.log(
    `📊 Periyot: ${p1}/${p2}/${p3}/${p4}`
  );

  console.log(
    `📁 ${OUTPUT}`
  );
}


main().catch(
  error => {

    console.error(
      `❌ ${error.message}`
    );

    process.exit(1);
  }
);
