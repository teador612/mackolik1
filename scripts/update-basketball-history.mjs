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
  "https://arsiv.mackolik.com/Program/Program.aspx?st=2";

const DAYS_BACK = 90;


/* =========================================================
   YARDIMCILAR
========================================================= */

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

function parseScore(value) {
  const text = normalizeText(value);

  const match = text.match(
    /(\d+)\s*[-:]\s*(\d+)/
  );

  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function parseDate(value) {
  const text = normalizeText(value);

  let m = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );

  if (!m) {
    return null;
  }

  return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}

function dateDaysAgo(days) {
  const d = new Date();

  d.setDate(d.getDate() - days);

  return d;
}

function isOldEnough(date) {
  const d = new Date(`${date}T00:00:00`);

  return d >= dateDaysAgo(DAYS_BACK);
}


/* =========================================================
   DOSYA
========================================================= */

function readHistory() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      return [];
    }

    const raw = fs.readFileSync(
      DATA_PATH,
      "utf8"
    );

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


/* =========================================================
   PROGRAM SAYFASI
========================================================= */

async function fetchProgram() {
  console.log("🏀 Basketbol programı alınıyor...");

  const response = await fetch(
    PROGRAM_URL,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Program HTTP ${response.status}`
    );
  }

  return await response.text();
}


/* =========================================================
   PROGRAMDAN MAÇLARI OKU
========================================================= */

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

    /*
     * Tarih bul
     */
    const dateMatch = rowText.match(
      /\b\d{1,2}\.\d{1,2}\.\d{4}\b/
    );

    if (!dateMatch) {
      return;
    }

    const date = parseDate(
      dateMatch[0]
    );

    if (!date) {
      return;
    }

    /*
     * Saat
     */
    const timeMatch = rowText.match(
      /\b\d{1,2}:\d{2}\b/
    );

    const time = timeMatch
      ? timeMatch[0]
      : "";

    /*
     * Takım isimlerini bulmaya çalış
     */

    let teams = [];

    for (const cell of cells) {

      if (
        cell.includes(" - ") ||
        cell.includes(" v ")
      ) {
        teams = cell
          .split(/\s+v\s+|\s+-\s+/i)
          .map(normalizeText)
          .filter(Boolean);

        if (teams.length === 2) {
          break;
        }
      }
    }

    if (teams.length !== 2) {
      return;
    }

    const home = teams[0];
    const away = teams[1];

    if (
      home.length < 2 ||
      away.length < 2
    ) {
      return;
    }

    if (
      normalizeTeam(home) ===
      normalizeTeam(away)
    ) {
      return;
    }

    /*
     * TS / toplam çizgisi
     */

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
      id:
        `${date}_${time}_${normalizeTeam(home)}_${normalizeTeam(away)}`,

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


/* =========================================================
   GEÇMİŞ SONUÇ SAYFALARINI PARSE ETME
========================================================= */

function parseResultsFromPage(html) {
  const $ = cheerio.load(html);

  const results = [];

  $("tr").each((_, row) => {

    const text = normalizeText(
      $(row).text()
    );

    if (!text) {
      return;
    }

    /*
     * Örnek:
     *
     * 27.09.2026
     * Beşiktaş Boa (K)
     * 65 - 56
     * Melikgazi Kayseri B. (K)
     * 35 - 30
     */

    const dateMatch = text.match(
      /\b(\d{1,2}\.\d{1,2}\.\d{4})\b/
    );

    if (!dateMatch) {
      return;
    }

    const date = parseDate(
      dateMatch[1]
    );

    if (!date || !isOldEnough(date)) {
      return;
    }

    /*
     * Skorları yakala
     */

    const scores = [
      ...text.matchAll(
        /(\d+)\s*-\s*(\d+)/g
      )
    ].map(m => ({
      home: Number(m[1]),
      away: Number(m[2])
    }));

    if (scores.length < 2) {
      return;
    }

    /*
     * İlk skor genellikle ilk yarı,
     * ikinci skor maç sonudur.
     */

    const half = scores[0];
    const final = scores[scores.length - 1];

    if (
      final.home < 30 ||
      final.away < 30
    ) {
      return;
    }

    /*
     * Takım isimlerini skorlardan ayır.
     */

    let rowHtml = $(row).html() || "";

    /*
     * Metin içerisinden score çevresindeki
     * takım isimlerini almaya çalış.
     */

    const plainCells = $(row)
      .find("td")
      .map((_, td) =>
        normalizeText($(td).text())
      )
      .get();

    let home = "";
    let away = "";

    for (const cell of plainCells) {

      if (
        cell.includes(
          `${final.home} - ${final.away}`
        )
      ) {
        const parts = cell.split(
          `${final.home} - ${final.away}`
        );

        if (parts.length >= 2) {
          home = normalizeText(parts[0]);
          away = normalizeText(parts[1]);
        }
      }
    }

    /*
     * Hücre yapısı farklıysa maç isimlerini
     * skorların çevresinden bul.
     */

    if (!home || !away) {

      const possibleTeams = plainCells.filter(
        x =>
          x.length >= 3 &&
          !x.match(
            /^\d+(?:\s*-\s*\d+)?$/
          ) &&
          !x.match(
            /^\d{1,2}\.\d{1,2}\.\d{4}$/
          ) &&
          !x.match(
            /^\d{1,2}:\d{2}$/
          )
      );

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
      id:
        `${date}_${normalizeTeam(home)}_${normalizeTeam(away)}`,

      date,

      time: "",

      home,

      away,

      homeScore: final.home,
      awayScore: final.away,

      halfHomeScore: half.home,
      halfAwayScore: half.away,

      total:
        final.home + final.away,

      source: "mackolik"
    });
  });

  return results;
}


/* =========================================================
   VERİ BİRLEŞTİR
========================================================= */

function mergeMatches(oldMatches, newMatches) {

  const map = new Map();

  for (const match of oldMatches) {

    if (
      !match ||
      !match.id ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    map.set(match.id, match);
  }

  for (const match of newMatches) {

    if (
      !match ||
      !match.id ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    const old = map.get(match.id);

    if (!old) {
      map.set(match.id, match);
      continue;
    }

    map.set(match.id, {
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
        null
    });
  }

  return [...map.values()];
}


/* =========================================================
   TEMİZLE
========================================================= */

function cleanMatches(matches) {

  const map = new Map();

  for (const match of matches) {

    if (!match.date) {
      continue;
    }

    if (!match.home || !match.away) {
      continue;
    }

    if (
      normalizeTeam(match.home) ===
      normalizeTeam(match.away)
    ) {
      continue;
    }

    /*
     * En azından final skoru veya maç bilgisi olsun.
     */

    const valid =
      (
        match.homeScore !== null &&
        match.awayScore !== null
      ) ||
      match.total !== null ||
      match.time;

    if (!valid) {
      continue;
    }

    map.set(match.id, match);
  }

  return [...map.values()]
    .sort((a, b) => {
      return `${a.date} ${a.time || ""}`
        .localeCompare(
          `${b.date} ${b.time || ""}`
        );
    });
}


/* =========================================================
   ANA
========================================================= */

async function main() {

  console.log("");
  console.log("================================");
  console.log("🏀 BASKETBOL GEÇMİŞ VERİSİ");
  console.log("================================");

  const oldMatches = readHistory();

  console.log(
    "Mevcut geçmiş kayıt:",
    oldMatches.length
  );

  try {

    const html = await fetchProgram();

    console.log(
      "Program HTML:",
      html.length
    );

    const currentMatches =
      parseProgram(html);

    console.log(
      "Program maçları:",
      currentMatches.length
    );

    /*
     * Şimdilik programdaki verileri de geçmiş
     * havuzuna ekliyoruz.
     *
     * Gerçek sonuçlar ayrı kaynaklardan geldikçe
     * skorlarla güncellenecek.
     */

    const merged = mergeMatches(
      oldMatches,
      currentMatches
    );

    const cleaned =
      cleanMatches(merged);

    fs.mkdirSync(
      path.dirname(DATA_PATH),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify(
        {
          source:
            "https://arsiv.mackolik.com",
          updatedAt:
            new Date().toISOString(),
          historyDays:
            DAYS_BACK,
          matches:
            cleaned
        },
        null,
        2
      );

    console.log("");
    console.log("================================");
    console.log("✅ BASKETBOL GEÇMİŞ VERİSİ YAZILDI");
    console.log("================================");
    console.log(
      "Toplam kayıt:",
      cleaned.length
    );

  } catch (error) {

    console.error("");
    console.error(
      "❌ Basketbol geçmiş verisi alınamadı:"
    );

    console.error(
      error.stack || error.message
    );

    process.exitCode = 1;
  }
}

main();
