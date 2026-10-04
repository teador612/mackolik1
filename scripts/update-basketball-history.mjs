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
const DAYS_BACK = 60;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};
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
    .toLocaleLowerCase("tr-TR")
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
    /(\d{1,3})\s*[-:]\s*(\d{1,3})/
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
  let match = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );
  if (match) {
    return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  }
  match = text.match(
    /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
  );
  if (match) {
    return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  }
  return null;
}
function daysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}
function isWithinHistory(date) {
  if (!date) {
    return false;
  }
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d >= daysAgo(DAYS_BACK) && d <= today;
}
function makeId(date, home, away) {
  return [
    date,
    normalizeTeam(home),
    normalizeTeam(away)
  ].join("_");
}
/* =========================================================
   DOSYA
========================================================= */
function readHistory() {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }
  try {
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
      "Eski geçmiş okunamadı:",
      error.message
    );
    return [];
  }
}
/* =========================================================
   HTTP
========================================================= */
async function fetchHtml(url) {
  const response = await fetch(
    url,
    {
      headers: HEADERS
    }
  );
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${url}`
    );
  }
  return await response.text();
}
/* =========================================================
   PROGRAM
========================================================= */
function parseProgram(html) {
  const $ = cheerio.load(html);
  const matches = [];
  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) =>
        normalizeText($(td).text())
      )
      .get();
    if (cells.length === 0) {
      return;
    }
    const text = normalizeText(
      cells.join(" | ")
    );
    const dateMatch = text.match(
      /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/
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
    const timeMatch = text.match(
      /\b\d{1,2}:\d{2}\b/
    );
    const time = timeMatch
      ? timeMatch[0]
      : "";
    let home = "";
    let away = "";
    /*
      Takım eşleşmesi hücre içinde olabilir.
    */
    for (const cell of cells) {
      const match = cell.match(
        /^(.+?)\s+(?:-|vs|v)\s+(.+?)$/i
      );
      if (!match) {
        continue;
      }
      const a = normalizeText(match[1]);
      const b = normalizeText(match[2]);
      if (
        a.length >= 2 &&
        b.length >= 2 &&
        !/^\d+$/.test(a) &&
        !/^\d+$/.test(b)
      ) {
        home = a;
        away = b;
        break;
      }
    }
    /*
      Bazı eski Mackolik satırlarında
      takım isimleri ayrı hücrelerde olabilir.
    */
    if (!home || !away) {
      const possible = cells.filter(cell => {
        if (!cell || cell.length < 2) {
          return false;
        }
        if (
          /\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(cell)
        ) {
          return false;
        }
        if (
          /^\d{1,2}:\d{2}$/.test(cell)
        ) {
          return false;
        }
        if (
          /^\d+(?:[.,]\d+)?$/.test(cell)
        ) {
          return false;
        }
        if (
          /^\d+\s*-\s*\d+$/.test(cell)
        ) {
          return false;
        }
        if (
          /^TS\s*:?\s*\d+/i.test(cell)
        ) {
          return false;
        }
        return true;
      });
      if (possible.length >= 2) {
        home = possible[possible.length - 2];
        away = possible[possible.length - 1];
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
    const totalMatch = text.match(
      /\bTS\s*:?\s*(\d+(?:[.,]\d+)?)\b/i
    );
    if (totalMatch) {
      total = parseNumber(
        totalMatch[1]
      );
    }
    matches.push({
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
  return matches;
}
/* =========================================================
   SONUÇ SAYFASI
========================================================= */
function parseResults(html) {
  const $ = cheerio.load(html);
  const matches = [];
  /*
    Mackolik'in farklı HTML yapıları
    için birden fazla selector deniyoruz.
  */
  const rows = [];
  $("tr").each((_, row) => {
    rows.push(row);
  });
  /*
    Tablo dışındaki maç kartlarını da
    yakalamaya çalış.
  */
  $(
    "[class*='match'], [class*='Match'], [class*='fixture'], [class*='Fixture']"
  ).each((_, element) => {
    rows.push(element);
  });
  const seen = new Set();
  for (const row of rows) {
    const text = normalizeText(
      $(row).text()
    );
    if (!text) {
      continue;
    }
    /*
      Tarih.
    */
    const dateMatch = text.match(
      /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
    );
    if (!dateMatch) {
      continue;
    }
    const date = parseDate(
      dateMatch[1]
    );
    if (!date || !isWithinHistory(date)) {
      continue;
    }
    /*
      Sayfadaki bütün skorları yakala.
    */
    const scoreMatches = [
      ...text.matchAll(
        /(\d{1,3})\s*[-:]\s*(\d{1,3})/g
      )
    ].map(match => ({
      home: Number(match[1]),
      away: Number(match[2])
    }));
    if (!scoreMatches.length) {
      continue;
    }
    /*
      Basketbol final skorları genellikle
      50+ seviyesindedir.
      İlk yarı da ayrıca bulunabilir.
    */
    const validScores =
      scoreMatches.filter(score =>
        score.home >= 20 &&
        score.away >= 20
      );
    if (!validScores.length) {
      continue;
    }
    /*
      En yüksek toplamlı skor genellikle
      maç sonu skorudur.
    */
    const final = validScores.reduce(
      (best, current) => {
        const bestTotal =
          best.home + best.away;
        const currentTotal =
          current.home + current.away;
        return currentTotal >= bestTotal
          ? current
          : best;
      }
    );
    if (
      final.home < 30 ||
      final.away < 30
    ) {
      continue;
    }
    /*
      İlk yarı skorunu bul.
    */
    let half = null;
    for (const score of validScores) {
      if (
        score === final
      ) {
        continue;
      }
      if (
        score.home <= final.home &&
        score.away <= final.away
      ) {
        half = score;
        break;
      }
    }
    /*
      Takım isimlerini HTML linklerinden
      yakalamaya çalış.
    */
    let teams = [];
    $(row)
      .find("a")
      .each((_, a) => {
        const name = normalizeText(
          $(a).text()
        );
        if (
          !name ||
          name.length < 2
        ) {
          return;
        }
        if (
          /^\d+$/.test(name)
        ) {
          return;
        }
        if (
          /\b(mac sonucu|ilk yarı|iddaa|canlı|puan durumu)\b/i.test(
            name
          )
        ) {
          return;
        }
        teams.push(name);
      });
    teams = [
      ...new Set(teams)
    ];
    /*
      Linklerden çıkmadıysa td hücrelerini
      kullan.
    */
    if (teams.length < 2) {
      const cells = $(row)
        .find("td")
        .map((_, td) =>
          normalizeText(
            $(td).text()
          )
        )
        .get();
      const possible = cells.filter(cell => {
        if (!cell || cell.length < 2) {
          return false;
        }
        if (
          /\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(
            cell
          )
        ) {
          return false;
        }
        if (
          /^\d{1,2}:\d{2}$/.test(cell)
        ) {
          return false;
        }
        if (
          /^\d+\s*[-:]\s*\d+$/.test(cell)
        ) {
          return false;
        }
        if (
          /^\d+$/.test(cell)
        ) {
          return false;
        }
        return true;
      });
      teams = possible;
    }
    /*
      Bazı yapılarda takım isimleri tek
      hücrede "Takım A - Takım B" şeklinde.
    */
    if (teams.length < 2) {
      const combined = text.match(
        /(.{2,80}?)\s+(?:-|vs|v)\s+(.{2,80}?)(?=\s+\d+\s*[-:]\s*\d+)/i
      );
      if (combined) {
        teams = [
          normalizeText(combined[1]),
          normalizeText(combined[2])
        ];
      }
    }
    if (teams.length < 2) {
      continue;
    }
    const home = teams[0];
    const away = teams[1];
    if (
      !home ||
      !away ||
      normalizeTeam(home) ===
        normalizeTeam(away)
    ) {
      continue;
    }
    const id = makeId(
      date,
      home,
      away
    );
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const timeMatch = text.match(
      /\b\d{1,2}:\d{2}\b/
    );
    const time = timeMatch
      ? timeMatch[0]
      : "";
    matches.push({
      id,
      date,
      time,
      home,
      away,
      homeScore: final.home,
      awayScore: final.away,
      halfHomeScore:
        half
          ? half.home
          : null,
      halfAwayScore:
        half
          ? half.away
          : null,
      total:
        final.home +
        final.away,
      source: "mackolik"
    });
  }
  return matches;
}
/* =========================================================
   MAÇ DETAY LİNKLERİ
========================================================= */
function extractMatchLinks(html) {
  const $ = cheerio.load(html);
  const links = new Set();
  $("a[href]").each((_, a) => {
    const href =
      $(a).attr("href") || "";
    if (
      /Basket.*Mac/i.test(href) ||
      /Basket-Mac/i.test(href) ||
      /Basketbol.*Mac/i.test(href)
    ) {
      const absolute =
        href.startsWith("http")
          ? href
          : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
      links.add(absolute);
    }
  });
  return [...links];
}
/* =========================================================
   DETAY SAYFASI
========================================================= */
async function fetchMatchDetail(url) {
  try {
    const html =
      await fetchHtml(url);
    const $ =
      cheerio.load(html);
    const text =
      normalizeText(
        $("body").text()
      );
    const dateMatch =
      text.match(
        /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
      );
    if (!dateMatch) {
      return null;
    }
    const date =
      parseDate(
        dateMatch[1]
      );
    if (
      !date ||
      !isWithinHistory(date)
    ) {
      return null;
    }
    const scores = [
      ...text.matchAll(
        /(\d{1,3})\s*[-:]\s*(\d{1,3})/g
      )
    ].map(match => ({
      home: Number(match[1]),
      away: Number(match[2])
    }));
    const valid =
      scores.filter(score =>
        score.home >= 30 &&
        score.away >= 30
      );
    if (!valid.length) {
      return null;
    }
    const final =
      valid.reduce(
        (best, current) =>
          current.home +
            current.away >
          best.home + best.away
            ? current
            : best
      );
    /*
      Takım isimleri için başlıklara
      ve linklere bak.
    */
    let teams = [];
    $("h1, h2, h3, h4, a").each(
      (_, element) => {
        const value =
          normalizeText(
            $(element).text()
          );
        if (
          value.length < 3 ||
          value.length > 100
        ) {
          return;
        }
        if (
          /^\d+$/.test(value)
        ) {
          return;
        }
        if (
          /\b(mac sonucu|iddaa|canlı sonuçlar|basketbol)\b/i.test(
            value
          )
        ) {
          return;
        }
        teams.push(value);
      }
    );
    teams = [
      ...new Set(teams)
    ];
    /*
      Aynı sayfada çok sayıda menü
      bağlantısı olabileceğinden takım
      isimlerini skor çevresinden seç.
    */
    const scoreIndex =
      text.indexOf(
        `${final.home} - ${final.away}`
      );
    let home = "";
    let away = "";
    if (scoreIndex >= 0) {
      const before =
        text.slice(
          Math.max(
            0,
            scoreIndex - 200
          ),
          scoreIndex
        );
      const after =
        text.slice(
          scoreIndex + 20,
          scoreIndex + 220
        );
      const beforeWords =
        before
          .split(/\n|\r/)
          .map(normalizeText)
          .filter(
            value =>
              value.length >= 3 &&
              value.length <= 80
          );
      const afterWords =
        after
          .split(/\n|\r/)
          .map(normalizeText)
          .filter(
            value =>
              value.length >= 3 &&
              value.length <= 80
          );
      if (beforeWords.length) {
        home =
          beforeWords[
            beforeWords.length - 1
          ];
      }
      if (afterWords.length) {
        away =
          afterWords[0];
      }
    }
    if (
      !home ||
      !away ||
      normalizeTeam(home) ===
        normalizeTeam(away)
    ) {
      if (teams.length >= 2) {
        home = teams[teams.length - 2];
        away = teams[teams.length - 1];
      }
    }
    if (!home || !away) {
      return null;
    }
    let half = null;
    for (const score of valid) {
      if (
        score.home === final.home &&
        score.away === final.away
      ) {
        continue;
      }
      if (
        score.home <= final.home &&
        score.away <= final.away
      ) {
        half = score;
        break;
      }
    }
    return {
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
        final.home,
      awayScore:
        final.away,
      halfHomeScore:
        half
          ? half.home
          : null,
      halfAwayScore:
        half
          ? half.away
          : null,
      total:
        final.home +
        final.away,
      source:
        "mackolik"
    };
  } catch {
    return null;
  }
}
/* =========================================================
   BİRLEŞTİR
========================================================= */
function mergeMatches(
  oldMatches,
  newMatches
) {
  const map = new Map();
  for (const match of oldMatches) {
    if (
      !match ||
      !match.id ||
      !match.home ||
      !match.away ||
      !match.date
    ) {
      continue;
    }
    if (
      !isWithinHistory(
        match.date
      )
    ) {
      continue;
    }
    map.set(
      match.id,
      match
    );
  }
  for (const match of newMatches) {
    if (
      !match ||
      !match.id ||
      !match.home ||
      !match.away ||
      !match.date
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
/* =========================================================
   TEMİZLE
========================================================= */
function cleanMatches(
  matches
) {
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
      !isWithinHistory(
        match.date
      )
    ) {
      continue;
    }
    if (
      normalizeTeam(match.home) ===
      normalizeTeam(match.away)
    ) {
      continue;
    }
    const hasScore =
      Number.isFinite(
        Number(match.homeScore)
      ) &&
      Number.isFinite(
        Number(match.awayScore)
      );
    const hasData =
      hasScore ||
      match.total !== null;
    if (!hasData) {
      continue;
    }
    map.set(
      match.id,
      match
    );
  }
  return [
    ...map.values()
  ].sort(
    (a, b) =>
      `${b.date} ${b.time || ""}`
        .localeCompare(
          `${a.date} ${a.time || ""}`
        )
  );
}
/* =========================================================
   ANA
========================================================= */
async function main() {
  console.log("");
  console.log("========================================");
  console.log("🏀 BASKETBOL GEÇMİŞ VERİSİ");
  console.log("========================================");
  console.log(
    `📅 Geçmiş aralığı: ${DAYS_BACK} gün`
  );
  const oldMatches =
    readHistory();
  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );
  try {
    /*
      -------------------------------------------------------
      1. PROGRAM
      -------------------------------------------------------
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
      `Program HTML: ${programHtml.length}`
    );
    const programMatches =
      parseProgram(
        programHtml
      );
    console.log(
      `Program maçları: ${programMatches.length}`
    );
    /*
      -------------------------------------------------------
      2. CANLI / SONUÇ SAYFASI
      -------------------------------------------------------
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
      `Sonuç HTML: ${resultsHtml.length}`
    );
    let resultMatches =
      parseResults(
        resultsHtml
      );
    console.log(
      `Sonuç maçları: ${resultMatches.length}`
    );
    /*
      -------------------------------------------------------
      3. DETAY SAYFALARINDAN EK SONUÇLAR
      -------------------------------------------------------
    */
    const detailLinks =
      extractMatchLinks(
        resultsHtml
      );
    console.log(
      `Maç detay linki: ${detailLinks.length}`
    );
    /*
      Aynı anda yüzlerce istek atmayalım.
      İlk 200 detay yeterli.
    */
    const limitedLinks =
      detailLinks.slice(
        0,
        200
      );
    if (limitedLinks.length) {
      console.log(
        `Detay sayfaları okunuyor: ${limitedLinks.length}`
      );
      const detailResults =
        await Promise.all(
          limitedLinks.map(
            url =>
              fetchMatchDetail(
                url
              )
          )
        );
      const details =
        detailResults.filter(
          Boolean
        );
      console.log(
        `Detaydan bulunan maç: ${details.length}`
      );
      resultMatches = [
        ...resultMatches,
        ...details
      ];
    }
    /*
      -------------------------------------------------------
      4. BİRLEŞTİR
      -------------------------------------------------------
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
      -------------------------------------------------------
      5. YAZ
      -------------------------------------------------------
    */
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
            BASE_URL,
          updatedAt:
            new Date().toISOString(),
          historyDays:
            DAYS_BACK,
          matches:
            cleaned
        },
        null,
        2
      ),
      "utf8"
    );
    const scored =
      cleaned.filter(
        match =>
          Number.isFinite(
            Number(
              match.homeScore
            )
          ) &&
          Number.isFinite(
            Number(
              match.awayScore
            )
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
      `Toplam kayıt: ${cleaned.length}`
    );
    console.log(
      `Skorlu maç: ${scored.length}`
    );
    console.log(
      `Geçmiş: ${DAYS_BACK} gün`
    );
    console.log(
      `Dosya: ${DATA_PATH}`
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
