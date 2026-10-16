import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const BASE_URL = "https://totokazan.com";
const INDEX_URL = `${BASE_URL}/spor-toto`;
const OUTPUT = "data/spor-toto-data.js";
const SEASON = "2026-2027";
const MIN_WEEK = 1;
const MAX_WEEK = 60;
function decodeHTML(text) {
  return String(text || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(30000),
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.text();
}
function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
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
  vm.runInNewContext(source, context, { timeout: 3000 });
  const old = context.window.SPORT_TOTO_DATA;
  if (!old || typeof old !== "object") {
    return {
      season: SEASON,
      currentWeek: 0,
      weeks: {}
    };
  }
  return {
    season: old.season || SEASON,
    currentWeek: Number(old.currentWeek) || 0,
    weeks: old.weeks && typeof old.weeks === "object"
      ? old.weeks
      : {}
  };
}
function findCurrentWeek(html) {
  const text = cleanHTML(html);
  const patterns = [
    /Güncel\s*Hafta\s*:\s*(?:\d{4}\s*\/\s*\d{4}\s*)?Spor\s*Toto\s*(\d+)\s*\.\s*Hafta/i,
    /Güncel\s*Hafta\s*:\s*(\d+)\s*\.\s*Hafta/i,
    /Güncel\s*Hafta[\s\S]{0,100}?Spor\s*Toto\s*(\d+)\s*\.\s*Hafta/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const week = Number(match[1]);
      if (week >= MIN_WEEK && week <= MAX_WEEK) return week;
    }
  }
  // Genel hafta başlığı yalnızca son çare olarak değerlendirilir.
  const fallback = text.match(/Spor\s*Toto\s*(\d+)\s*\.\s*Hafta/i);
  if (fallback) {
    const week = Number(fallback[1]);
    if (week >= MIN_WEEK && week <= MAX_WEEK) return week;
  }
  return null;
}
function getWeekFromURL(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, BASE_URL).pathname);
  } catch {
    return null;
  }
  const patterns = [
    /\/spor-toto\/(\d{4})-(\d{4})-(\d+)-hafta\/?$/i,
    /\/spor-toto\/(\d{4})-(\d{4})-spor-toto-(\d+)-hafta\/?$/i,
    /\/spor-toto\/.*?(\d{4})-(\d{4}).*?(\d+)-hafta\/?$/i
  ];
  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (!match) continue;
    const season = `${match[1]}-${match[2]}`;
    const week = Number(match[3]);
    if (
      season === SEASON &&
      week >= MIN_WEEK &&
      week <= MAX_WEEK
    ) {
      return week;
    }
  }
  return null;
}
function findWeekLinks(html) {
  const links = new Map();
  const anchorRegex = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = decodeHTML(match[2]).trim();
    const label = cleanHTML(match[3]);
    let url;
    try {
      url = new URL(href, BASE_URL);
    } catch {
      continue;
    }
    if (url.hostname !== new URL(BASE_URL).hostname) continue;
    let week = getWeekFromURL(url.href);
    // URL kalıbı değişirse bağlantı metninden sezon ve haftayı dene.
    if (week === null) {
      const combined = `${url.pathname} ${label}`;
      const seasonMatch = combined.match(/2026\s*[-/]\s*2027/i);
      const weekMatch = label.match(/(\d+)\s*\.\s*Hafta/i);
      if (seasonMatch && weekMatch) {
        const candidate = Number(weekMatch[1]);
        if (candidate >= MIN_WEEK && candidate <= MAX_WEEK) {
          week = candidate;
        }
      }
    }
    if (week !== null) {
      links.set(week, url.href);
    }
  }
  return [...links.entries()].sort((a, b) => a[0] - b[0]);
}
function parseRows(html) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells = [];
    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cleanHTML(cellMatch[1]));
    }
    if (cells.length < 5) continue;
    const number = Number(cells[0]);
    if (!Number.isInteger(number) || number < 1 || number > 15) {
      continue;
    }
    const home = cells[1];
    const score = cells[2];
    const away = cells[3];
    const resultText = String(cells[4] || "")
      .trim()
      .toUpperCase();
    if (!home || !away) continue;
    const result = ["1", "X", "2"].includes(resultText)
      ? resultText
      : null;
    rows.push({ number, home, away, score, result });
  }
  const unique = new Map();
  for (const row of rows) {
    if (!unique.has(row.number)) unique.set(row.number, row);
  }
  return [...unique.values()].sort((a, b) => a.number - b.number);
}
function mergeWeek(oldGames, newGames) {
  if (newGames.length !== 15) {
    throw new Error(
      `15 maç bekleniyordu, ${newGames.length} maç bulundu.`
    );
  }
  const previous = Array.isArray(oldGames) ? oldGames : [];
  return newGames.map((game, index) => {
    const old = previous.find(item =>
      Number(item.number) === game.number
    ) || previous[index] || {};
    const sameTeams =
      normalize(old.home) === normalize(game.home) &&
      normalize(old.away) === normalize(game.away);
    // Kaynak sonuç vermiyorsa aynı takımların eski sonucu korunur.
    const oldResult = sameTeams ? old.result : null;
    return {
      number: game.number,
      home: game.home,
      away: game.away,
      result: game.result || oldResult || null
    };
  });
}
function renderFile(data) {
  const weeks = Object.keys(data.weeks)
    .filter(week => Array.isArray(data.weeks[week]))
    .sort((a, b) => Number(a) - Number(b));
  const lines = [
    "/* Otomatik oluşturulan Spor Toto verisi. */",
    "window.SPORT_TOTO_DATA = {",
    `  season: ${JSON.stringify(data.season)},`,
    `  currentWeek: ${data.currentWeek},`,
    "  weeks: {"
  ];
  for (const week of weeks) {
    lines.push(`    ${JSON.stringify(week)}: [`);
    for (const game of data.weeks[week]) {
      lines.push("      " + JSON.stringify({
        number: game.number,
        home: game.home,
        away: game.away,
        result: game.result ?? null
      }) + ",");
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
  if (!currentWeek) {
    throw new Error(
      "Güncel hafta ana sayfadan tespit edilemedi. Mevcut dosya korunuyor."
    );
  }
  console.log(`Kaynakta bildirilen güncel hafta: ${currentWeek}`);
  const links = new Map(findWeekLinks(indexHTML));
  const data = loadExisting();
  /*
   * Güncel hafta arşiv bağlantılarında yoksa doğrudan URL denenir.
   * Bu bağlantı başarısız olursa mevcut kayıt silinmez.
   */
  if (!links.has(currentWeek)) {
    const directURL =
      `${BASE_URL}/spor-toto/${SEASON}-${currentWeek}-hafta`;
    links.set(currentWeek, directURL);
    console.log("Güncel hafta bağlantısı ayrıca eklendi.");
  }
  // Güncel haftayı ilk sırada indir, ardından diğer arşiv haftalarını işle.
  const orderedLinks = [...links.entries()].sort((a, b) => {
    if (a[0] === currentWeek) return -1;
    if (b[0] === currentWeek) return 1;
    return a[0] - b[0];
  });
  data.season = SEASON;
  data.weeks ||= {};
  let currentWeekSaved = false;
  let successfulWeeks = 0;
  for (const [week, url] of orderedLinks) {
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
      data.weeks[week] = mergeWeek(data.weeks[week], games);
      successfulWeeks++;
      if (week === currentWeek) currentWeekSaved = true;
      console.log(`${week}. hafta kaydedildi (15/15).`);
    } catch (error) {
      console.error(`${week}. hafta alınamadı: ${error.message}`);
    }
  }
  /*
   * Güncel hafta doğrulanmadan dosyaya yazma.
   * Böylece eski verinin yanlışlıkla güncelmiş gibi işaretlenmesi önlenir.
   */
  if (!currentWeekSaved) {
    throw new Error(
      `Güncel ${currentWeek}. hafta 15 maçla doğrulanamadı. ` +
      "Mevcut JSON dosyası değiştirilmedi."
    );
  }
  const validWeeks = Object.values(data.weeks)
    .filter(games => Array.isArray(games) && games.length === 15);
  if (!validWeeks.length) {
    throw new Error("Kaydedilecek geçerli hafta bulunamadı.");
  }
  data.currentWeek = currentWeek;
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, renderFile(data), "utf8");
  console.log(
    `Tamamlandı. Güncel hafta: ${currentWeek}. ` +
    `Başarıyla indirilen hafta: ${successfulWeeks}. ` +
    `Toplam kayıtlı hafta: ${validWeeks.length}.`
  );
}
main().catch(error => {
  console.error("Spor Toto güncellemesi başarısız:", error);
  process.exitCode = 1;
});
