import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_URL = "https://arsiv.mackolik.com";

const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "basketball-history.json"
);

const PROGRAM_URL =
  `${BASE_URL}/Program/Program.aspx?st=2`;

const RESULTS_URL =
  `${BASE_URL}/Basketbol/Canli-Sonuclar`;

/*
=========================================================
AYAR
=========================================================
*/

const DAYS_BACK = 60;

/*
=========================================================
YARDIMCILAR
=========================================================
*/

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeam(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const n = Number(
    String(value)
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  const text = normalizeText(value);

  const match = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );

  if (!match) {
    return null;
  }

  return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
}

function dateDaysAgo(days) {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);

  return date;
}

function isWithinHistory(date) {
  if (!date) {
    return false;
  }

  const d = new Date(`${date}T00:00:00`);

  if (Number.isNaN(d.getTime())) {
    return false;
  }

  return d >= dateDaysAgo(DAYS_BACK);
}

function makeId(date, home, away) {
  return [
    date,
    normalizeTeam(home),
    normalizeTeam(away)
  ].join("_");
}

/*
=========================================================
DOSYA OKU
=========================================================
*/

function readHistory() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(
      DATA_PATH,
      "utf8"
    );

    if (!raw.trim()) {
      return [];
    }

    const json = JSON.parse(raw);

    if (Array.isArray(json)) {
      return json;
    }

    if (Array.isArray(json.matches)) {
      return json.matches;
    }

    return [];

  } catch (error) {
    console.log(
      "Eski basketbol geçmişi okunamadı:",
      error.message
    );

    return [];
  }
}

/*
=========================================================
HTTP
=========================================================
*/

async function fetchHtml(url) {
  const response = await fetch(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "tr-TR,tr;q=0.9,en;q=0.8"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${url}`
    );
  }

  return await response.text();
}

/*
=========================================================
PROGRAM SAYFASI
=========================================================
*/

function parseProgram(html) {
  const $ = cheerio.load(html);

  const results = [];

  $("tr").each((_, row) => {

    const cells = $(row)
      .find("td")
      .map((_, td) =>
        normalizeText($(td).text())
      )
      .get();

    if (cells.length < 3) {
      return;
    }

    const rowText = cells.join(" | ");

    const dateMatch = rowText.match(
      /\b\d{1,2}\.\d{1,2}\.\d{4}\b/
    );

    if (!dateMatch) {
      return;
    }

    const date = parseDate(
      dateMatch[0]
    );

    if (!date || !isWithinHistory(date)) {
      return;
    }

    const timeMatch = rowText.match(
      /\b\d{1,2}:\d{2}\b/
    );

    const time = timeMatch
      ? timeMatch[0]
      : "";

    let home = "";
    let away = "";

    for (const cell of cells) {

      if (
        cell.includes(" v ") ||
        cell.includes(" - ")
      ) {

        const parts = cell
          .split(/\s+v\s+|\s+-\s+/i)
          .map(normalizeText)
          .filter(Boolean);

        if (parts.length === 2) {
          home = parts[0];
          away = parts[1];
          break;
        }
      }
    }

    if (!home || !away) {
      return;
    }

    if (
      normalizeTeam(home) ===
      normalizeTeam(away)
    ) {
      return;
    }

    let total = null;

    const totalMatch = rowText.match(
      /\bTS\s*:?\s*(\d+(?:[.,]\d+)?)/
    );

    if (totalMatch) {
      total = parseNumber(
        totalMatch[1]
      );
    }

    results.push({
      id: makeId(
        date,
        home,
        away
      ),

      date,
      time,

      home,
      away,

      total,

      homeScore: null,
      awayScore: null,

      halfHomeScore: null,
      halfAwayScore: null,

      source: "mackolik"
    });
  });

  return results;
}

/*
=========================================================
SONUÇ SAYFASI
=========================================================
*/

function parseResults(html) {
  const $ = cheerio.load(html);

  const results = [];

  $("tr").each((_, row) => {

    const cells = $(row)
      .find("td")
      .map((_, td) =>
        normalizeText($(td).text())
      )
      .get();

    if (cells.length < 3) {
      return;
    }

    const text = normalizeText(
      cells.join(" | ")
    );

    const dateMatch = text.match(
      /\b\d{1,2}\.\d{1,2}\.\d{4}\b/
    );

    if (!dateMatch) {
      return;
    }

    const date = parseDate(
      dateMatch[0]
    );

    if (!date || !isWithinHistory(date)) {
      return;
    }

    /*
    -----------------------------------------------------
    SKORLARI BUL
    -----------------------------------------------------
    */

    const scores = [
      ...text.matchAll(
        /(\d+)\s*-\s*(\d+)/g
      )
    ].map(match => ({
      home: Number(match[1]),
      away: Number(match[2])
    }));

    if (!scores.length) {
      return;
    }

    /*
    İlk skor genellikle ilk yarı,
    son skor maç sonucu.
    */

    const finalScore =
      scores[scores.length - 1];

    const halfScore =
      scores.length >= 2
        ? scores[0]
        : null;

    if (
      finalScore.home < 30 ||
      finalScore.away < 30
    ) {
      return;
    }

    /*
    -----------------------------------------------------
    TAKIMLARI BUL
    -----------------------------------------------------
    */

    let home = "";
    let away = "";

    /*
    Önce hücreleri kontrol et.
    */

    for (const cell of cells) {

      const finalPattern =
        `${finalScore.home} - ${finalScore.away}`;

      if (
        cell.includes(finalPattern)
      ) {

        const parts =
          cell.split(finalPattern);

        if (parts.length >= 2) {

          const left =
            normalizeText(parts[0]);

          const right =
            normalizeText(parts[1]);

          if (left && right) {
            home = left;
            away = right;
          }
        }
      }
    }

    /*
    -----------------------------------------------------
    TAKIMLARI HÜCRELERDEN AL
    -----------------------------------------------------
    */

    if (!home || !away) {

      const possibleTeams =
        cells.filter(cell => {

          if (!cell) {
            return false;
          }

          if (
            /^\d+$/.test(cell)
          ) {
            return false;
          }

          if (
            /^\d+\s*-\s*\d+$/.test(cell)
          ) {
            return false;
          }

          if (
            /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cell)
          ) {
            return false;
          }

          if (
            /^\d{1,2}:\d{2}$/.test(cell)
          ) {
            return false;
          }

          if (
            cell === "MS" ||
            cell === "UZ" ||
            cell === "ERT"
          ) {
            return false;
          }

          return cell.length >= 3;
        });

      if (possibleTeams.length >= 2) {

        home =
          possibleTeams[
            possibleTeams.length - 2
          ];

        away =
          possibleTeams[
            possibleTeams.length - 1
          ];
      }
    }

    /*
    -----------------------------------------------------
    TAKIMLARI AYIR
    -----------------------------------------------------
    */

    if (
      home.includes(" v ")
    ) {

      const parts =
        home.split(/\s+v\s+/i);

      if (parts.length === 2) {
        home = parts[0];
        away = parts[1];
      }
    }

    if (!home || !away) {
      return;
    }

    if (
      normalizeTeam(home) ===
      normalizeTeam(away)
    ) {
      return;
    }

    results.push({
      id: makeId(
        date,
        home,
        away
      ),

      date,
      time: "",

      home,
      away,

      homeScore:
        finalScore.home,

      awayScore:
        finalScore.away,

      halfHomeScore:
        halfScore
          ? halfScore.home
          : null,

      halfAwayScore:
        halfScore
          ? halfScore.away
          : null,

      total:
        finalScore.home +
        finalScore.away,

      source: "mackolik"
    });
  });

  return results;
}

/*
=========================================================
BİRLEŞTİR
=========================================================
*/

function mergeMatches(
  oldMatches,
  newMatches
) {

  const map = new Map();

  /*
  Eski veriler
  */

  for (const match of oldMatches) {

    if (
      !match ||
      !match.id ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    if (
      !isWithinHistory(match.date)
    ) {
      continue;
    }

    map.set(
      match.id,
      match
    );
  }

  /*
  Yeni veriler
  */

  for (const match of newMatches) {

    if (
      !match ||
      !match.id ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    if (
      !isWithinHistory(match.date)
    ) {
      continue;
    }

    const old =
      map.get(match.id);

    if (!old) {

      map.set(
        match.id,
        match
      );

      continue;
    }

    map.set(
      match.id,
      {
        ...old,
        ...match,

        homeScore:
          match.homeScore ??
          old.homeScore ??
          null,

        awayScore:
          match.awayScore ??
          old.awayScore ??
          null,

        halfHomeScore:
          match.halfHomeScore ??
          old.halfHomeScore ??
          null,

        halfAwayScore:
          match.halfAwayScore ??
          old.halfAwayScore ??
          null,

        total:
          match.total ??
          old.total ??
          null
      }
    );
  }

  return [
    ...map.values()
  ];
}

/*
=========================================================
TEMİZLE
=========================================================
*/

function cleanMatches(matches) {

  const map = new Map();

  for (const match of matches) {

    if (
      !match ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    if (
      !isWithinHistory(match.date)
    ) {
      continue;
    }

    if (
      normalizeTeam(match.home) ===
      normalizeTeam(match.away)
    ) {
      continue;
    }

    /*
    Geçmiş için skor yoksa
    kayıt tutulabilir.
    */

    map.set(
      match.id,
      match
    );
  }

  return [
    ...map.values()
  ].sort((a, b) =>
    `${a.date} ${a.time || ""}`
      .localeCompare(
        `${b.date} ${b.time || ""}`
      )
  );
}

/*
=========================================================
ANA
=========================================================
*/

async function main() {

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "🏀 BASKETBOL GEÇMİŞ VERİSİ"
  );
  console.log(
    "========================================"
  );

  console.log(
    `📅 Geçmiş aralığı: ${DAYS_BACK} gün`
  );

  const oldMatches =
    readHistory();

  console.log(
    "Mevcut kayıt:",
    oldMatches.length
  );

  try {

    /*
    -----------------------------------------------------
    PROGRAM
    -----------------------------------------------------
    */

    console.log("");
    console.log(
      "🏀 Basketbol programı alınıyor..."
    );

    const programHtml =
      await fetchHtml(
        PROGRAM_URL
      );

    console.log(
      "Program HTML:",
      programHtml.length
    );

    const programMatches =
      parseProgram(
        programHtml
      );

    console.log(
      "Program maçları:",
      programMatches.length
    );

    /*
    -----------------------------------------------------
    SONUÇLAR
    -----------------------------------------------------
    */

    console.log("");
    console.log(
      "🏀 Basketbol sonuçları alınıyor..."
    );

    const resultsHtml =
      await fetchHtml(
        RESULTS_URL
      );

    console.log(
      "Sonuç HTML:",
      resultsHtml.length
    );

    const resultMatches =
      parseResults(
        resultsHtml
      );

    console.log(
      "Sonuç maçları:",
      resultMatches.length
    );

    /*
    -----------------------------------------------------
    BİRLEŞTİR
    -----------------------------------------------------
    */

    const merged =
      mergeMatches(
        oldMatches,
        [
          ...programMatches,
          ...resultMatches
        ]
      );

    const cleaned =
      cleanMatches(
        merged
      );

    /*
    -----------------------------------------------------
    KLASÖR
    -----------------------------------------------------
    */

    fs.mkdirSync(
      path.dirname(DATA_PATH),
      {
        recursive: true
      }
    );

    /*
    -----------------------------------------------------
    DOSYAYI YAZ
    -----------------------------------------------------
    */

    const output = {
      source: BASE_URL,

      updatedAt:
        new Date().toISOString(),

      historyDays:
        DAYS_BACK,

      matches:
        cleaned
    };

    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify(
        output,
        null,
        2
      ),
      "utf8"
    );

    /*
    -----------------------------------------------------
    ÖZET
    -----------------------------------------------------
    */

    const completed =
      cleaned.filter(
        match =>
          Number.isFinite(
            Number(match.homeScore)
          ) &&
          Number.isFinite(
            Number(match.awayScore)
          )
      );

    console.log("");
    console.log(
      "========================================"
    );

    console.log(
      "✅ BASKETBOL GEÇMİŞ VERİSİ GÜNCELLENDİ"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Toplam kayıt:",
      cleaned.length
    );

    console.log(
      "Skorlu maç:",
      completed.length
    );

    console.log(
      "Geçmiş:",
      `${DAYS_BACK} gün`
    );

    console.log(
      "Dosya:",
      DATA_PATH
    );

    console.log(
      "========================================"
    );

  } catch (error) {

    console.error("");

    console.error(
      "❌ Basketbol geçmiş verisi alınamadı:"
    );

    console.error(
      error.stack ||
      error.message
    );

    process.exitCode = 1;
  }
}

main();
