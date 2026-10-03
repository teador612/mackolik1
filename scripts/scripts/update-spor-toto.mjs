import fs from "fs";
import path from "path";

const SOURCE = "https://totokazan.com/spor-toto";
const DATA_PATH = path.resolve("data/spor-toto-data.js");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function decodeHtml(str) {
  return String(str || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  console.log("GET:", url);

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }

  return await res.text();
}

function getCells(row) {
  const cells = [];
  const re = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  let m;

  while ((m = re.exec(row)) !== null) {
    cells.push(decodeHtml(m[2]));
  }

  return cells;
}

function extractRows(html) {
  const rows = [];
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let m;

  while ((m = re.exec(html)) !== null) {
    const cells = getCells(m[1]);

    if (cells.length >= 4) {
      rows.push(cells);
    }
  }

  return rows;
}

function findSeasonAndWeek(html) {
  const clean = decodeHtml(html);

  let match = clean.match(
    /(\d{4})\s*\/\s*(\d{4}).{0,120}?Spor Toto\s*(\d+)\.?\s*Hafta/i
  );

  if (!match) {
    match = clean.match(
      /(\d{4})\s*[-\/]\s*(\d{4}).{0,120}?(\d+)\.\s*Hafta/i
    );
  }

  if (!match) {
    throw new Error("Güncel Spor Toto sezon/hafta bilgisi bulunamadı.");
  }

  return {
    season: `${match[1]}-${match[2]}`,
    week: Number(match[3])
  };
}

function normalizeResult(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();

  if (v === "1") return "1";
  if (v === "X" || v === "0") return "X";
  if (v === "2") return "2";

  return null;
}

function parseWeekPage(html, season, week) {
  const rows = extractRows(html);

  const matches = [];

  for (const cells of rows) {
    if (cells.length < 4) continue;

    const no = Number(
      String(cells[0]).replace(/[^\d]/g, "")
    );

    if (!Number.isInteger(no) || no < 1 || no > 15) {
      continue;
    }

    /*
      Beklenen yapı:

      No
      Ev sahibi
      Skor
      Deplasman
      MS
    */

    let home = "";
    let score = "";
    let away = "";
    let result = null;

    if (cells.length >= 5) {
      home = cells[1];
      score = cells[2];
      away = cells[3];
      result = normalizeResult(cells[4]);
    } else {
      continue;
    }

    if (!home || !away) continue;

    let parsedScore = null;

    const scoreMatch = String(score).match(
      /(\d+)\s*[-:]\s*(\d+)/
    );

    if (scoreMatch) {
      parsedScore = {
        home: Number(scoreMatch[1]),
        away: Number(scoreMatch[2])
      };
    }

    matches.push({
      no,
      home,
      away,
      score: parsedScore,
      result
    });
  }

  const unique = new Map();

  for (const match of matches) {
    unique.set(match.no, match);
  }

  const finalMatches = [];

  for (let i = 1; i <= 15; i++) {
    const match = unique.get(i);

    if (!match) {
      throw new Error(
        `${season} ${week}. hafta ${i}. maç bulunamadı.`
      );
    }

    finalMatches.push(match);
  }

  return finalMatches;
}

function readExistingData() {
  if (!fs.existsSync(DATA_PATH)) {
    return {
      season: "",
      currentWeek: 0,
      weeks: {}
    };
  }

  const source = fs.readFileSync(DATA_PATH, "utf8");

  const match = source.match(
    /window\.SPORT_TOTO_DATA\s*=\s*([\s\S]*?);\s*(?:window\.SPORT_TOTO_META|$)/
  );

  if (!match) {
    throw new Error(
      "data/spor-toto-data.js içinde window.SPORT_TOTO_DATA bulunamadı."
    );
  }

  try {
    return JSON.parse(match[1]);
  } catch (err) {
    throw new Error(
      "Mevcut Spor Toto JSON verisi okunamadı: " + err.message
    );
  }
}

function writeData(data) {
  const output =
`window.SPORT_TOTO_DATA = ${JSON.stringify(data, null, 2)};

window.SPORT_TOTO_META = {
  season: ${JSON.stringify(data.season)},
  currentWeek: ${Number(data.currentWeek || 0)},
  matchesPerWeek: 15,
  historyDays: 60,
  exactOdds: true,
  minimumSample: 5,
  updatedAt: ${JSON.stringify(new Date().toISOString())}
};
`;

  fs.writeFileSync(DATA_PATH, output, "utf8");
}

async function main() {
  console.log("==========================================");
  console.log("SPOR TOTO OTOMATİK GÜNCELLEME");
  console.log("==========================================");

  if (!fs.existsSync(path.dirname(DATA_PATH))) {
    fs.mkdirSync(path.dirname(DATA_PATH), {
      recursive: true
    });
  }

  const mainHtml = await fetchText(SOURCE);

  const { season, week: currentWeek } =
    findSeasonAndWeek(mainHtml);

  console.log("Sezon:", season);
  console.log("Güncel hafta:", currentWeek);

  const existing = readExistingData();

  if (!existing.weeks || typeof existing.weeks !== "object") {
    existing.weeks = {};
  }

  existing.season = season;
  existing.currentWeek = currentWeek;

  /*
    Güncel haftayı çek.
  */
  const weekUrl =
    `https://totokazan.com/spor-toto/${season}-${currentWeek}-hafta`;

  const weekHtml = await fetchText(weekUrl);

  const matches =
    parseWeekPage(
      weekHtml,
      season,
      currentWeek
    );

  /*
    Eski haftalar korunur.
    Yeni hafta varsa eklenir.
    Mevcut hafta varsa sonuçları güncellenir.
  */
  const oldWeek =
    existing.weeks[String(currentWeek)] || null;

  const oldMatches =
    oldWeek?.matches ||
    (Array.isArray(oldWeek) ? oldWeek : null);

  const merged = [];

  for (const match of matches) {
    const oldMatch =
      oldMatches?.find(
        x => Number(x.no) === Number(match.no)
      );

    merged.push({
      no: match.no,
      home: match.home,
      away: match.away,
      score:
        match.score ??
        oldMatch?.score ??
        null,
      result:
        match.result ??
        oldMatch?.result ??
        null
    });
  }

  existing.weeks[String(currentWeek)] = {
    status: merged.every(x => x.result)
      ? "finished"
      : "active",
    matches: merged
  };

  /*
    Haftaları numerik sıraya sok.
  */
  const sortedWeeks = {};

  Object.keys(existing.weeks)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(week => {
      sortedWeeks[week] =
        existing.weeks[week];
    });

  existing.weeks = sortedWeeks;

  writeData(existing);

  console.log("");
  console.log("GÜNCELLEME TAMAMLANDI");
  console.log("Sezon:", existing.season);
  console.log("Güncel hafta:", existing.currentWeek);
  console.log(
    "Toplam kayıtlı hafta:",
    Object.keys(existing.weeks).length
  );

  console.log("");

  for (const match of merged) {
    console.log(
      `${match.no}. ${match.home} - ${match.away} =>`,
      match.result || "-"
    );
  }

  console.log("==========================================");
}

main().catch(err => {
  console.error("");
  console.error("SPOR TOTO HATASI:");
  console.error(err);
  process.exit(1);
});
