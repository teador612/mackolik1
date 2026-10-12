import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const BASE_URL = "https://totokazan.com";
const INDEX_URL = `${BASE_URL}/spor-toto`;
const OUTPUT = "data/spor-toto-data.js";
const SEASON = "2026-2027";

function decodeHTML(text) {
  return String(text || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function cleanHTML(text) {
  return decodeHTML(
    String(text || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

async function getPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 SporTotoDataUpdater/1.0",
      "Accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.text();
}

function loadExisting() {
  if (!fs.existsSync(OUTPUT)) {
    return {
      season: SEASON,
      currentWeek: 0,
      weeks: {}
    };
  }

  const source = fs.readFileSync(OUTPUT, "utf8");
  const context = { window: {} };

  vm.runInNewContext(source, context, {
    timeout: 3000
  });

  return context.window.SPORT_TOTO_DATA || {
    season: SEASON,
    currentWeek: 0,
    weeks: {}
  };
}

function findCurrentWeek(html) {
  const text = cleanHTML(html);

  const match =
    text.match(/Spor Toto\s+(\d+)\.\s*Hafta/i) ||
    text.match(/(\d+)\.\s*Hafta/i);

  return match ? Number(match[1]) : null;
}

function findWeekLinks(html) {
  const links = new Map();

  const regex =
    /href=["']([^"']*\/spor-toto\/(\d{4})-(\d{4})-(\d+)-hafta)["']/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const url = new URL(match[1], BASE_URL).href;
    const season = `${match[2]}-${match[3]}`;
    const week = Number(match[4]);

    if (season !== SEASON) continue;
    if (week < 1 || week > 60) continue;

    links.set(week, url);
  }

  return [...links.entries()]
    .sort((a, b) => a[0] - b[0]);
}

function parseRows(html) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHTML = rowMatch[1];
    const cells = [];

    const cellRegex =
      /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;

    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      cells.push(cleanHTML(cellMatch[1]));
    }

    if (cells.length < 5) continue;

    // Beklenen sütunlar:
    // No | Ev Sahibi | Skor | Deplasman | MS
    const number = Number(cells[0]);
    if (!Number.isInteger(number) || number < 1 || number > 15) {
      continue;
    }

    const home = cells[1];
    const score = cells[2];
    const away = cells[3];
    const resultText = cells[4].toUpperCase();

    if (!home || !away) continue;

    const result = ["1", "X", "2"].includes(resultText)
      ? resultText
      : null;

    rows.push({
      number,
      home,
      away,
      score,
      result
    });
  }

  return rows.sort((a, b) => a.number - b.number);
}

function mergeWeek(oldGames, newGames) {
  const previous = Array.isArray(oldGames) ? oldGames : [];

  if (newGames.length !== 15) {
    throw new Error(
      `Haftada 15 maç bekleniyordu, ${newGames.length} bulundu. ` +
      "Veri yapısı değişmiş olabilir; eski hafta korunuyor."
    );
  }

  return newGames.map((game, index) => {
    const old = previous[index] || {};

    const sameTeams =
      normalize(old.home) === normalize(game.home) &&
      normalize(old.away) === normalize(game.away);

    const oldResult = sameTeams ? old.result : null;

    return {
      home: game.home,
      away: game.away,
      result: game.result || oldResult || null
    };
  });
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

function renderFile(data) {
  const weeks = Object.keys(data.weeks)
    .sort((a, b) => Number(a) - Number(b));

  const lines = [
    "/* Otomatik oluşturulan Spor Toto verisi. */",
    "window.SPORT_TOTO_DATA = {",
    `  season: ${JSON.stringify(data.season)},`,
    `  currentWeek: ${data.currentWeek},`,
    "  weeks: {"
  ];

  for (const week of weeks) {
    lines.push(`    ${week}: [`);

    for (const game of data.weeks[week]) {
      lines.push(
        "      " +
        JSON.stringify({
          home: game.home,
          away: game.away,
          result: game.result ?? null
        }) +
        ","
      );
    }

    lines.push("    ],");
  }

  lines.push(
    "  }",
    "};",
    "",
    "window.SPORT_TOTO_META = {",
    `  season: ${JSON.stringify(data.season)},`,
    `  currentWeek: ${data.currentWeek},`,
    "  matchesPerWeek: 15,",
    "  historyDays: 60,",
    "  exactOdds: true,",
    "  minimumSample: 5",
    "};",
    ""
  );

  return lines.join("\n");
}

async function main() {
  console.log("Spor Toto güncellemesi başladı.");

  const indexHTML = await getPage(INDEX_URL);
  const currentWeek = findCurrentWeek(indexHTML);
  const links = findWeekLinks(indexHTML);

  if (!links.length) {
    throw new Error(
      "Güncel sezona ait hafta bağlantıları bulunamadı."
    );
  }

  if (!currentWeek) {
    throw new Error("Güncel hafta tespit edilemedi.");
  }

  const data = loadExisting();

  data.season = SEASON;
  data.currentWeek = currentWeek;
  data.weeks ||= {};

  for (const [week, url] of links) {
    console.log(`${week}. hafta indiriliyor: ${url}`);

    try {
      const html = await getPage(url);
      const games = parseRows(html);

      if (games.length !== 15) {
        console.warn(
          `${week}. hafta atlandı: ${games.length}/15 maç bulundu.`
        );
        continue;
      }

      data.weeks[week] = mergeWeek(
        data.weeks[week],
        games
      );

      console.log(`${week}. hafta kaydedildi.`);
    } catch (error) {
      console.error(
        `${week}. hafta alınamadı: ${error.message}`
      );
    }
  }

  // Hiçbir geçerli hafta alınamadıysa mevcut dosyayı bozma.
  const validWeeks = Object.values(data.weeks)
    .filter(games => Array.isArray(games) && games.length === 15);

  if (!validWeeks.length) {
    throw new Error("Kaydedilecek geçerli hafta bulunamadı.");
  }

  fs.mkdirSync(path.dirname(OUTPUT), {
    recursive: true
  });

  fs.writeFileSync(
    OUTPUT,
    renderFile(data),
    "utf8"
  );

  console.log(
    `Tamamlandı. Güncel hafta: ${currentWeek}. ` +
    `Toplam kayıtlı hafta: ${validWeeks.length}.`
  );
}

main().catch(error => {
  console.error("Spor Toto güncellemesi başarısız:", error);
  process.exitCode = 1;
});
