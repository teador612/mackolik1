import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_URL = "https://arsiv.mackolik.com";

const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "basketball-history.json"
);

const BASKETBALL_URL = `${BASE_URL}/Basketball/Default.aspx`;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";

const CURRENT_SEASON = "2026-2027";

/* =========================================================
   YARDIMCI
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
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "");
}

function parseDate(value) {
  const match = String(value || "").match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return (
    `${year}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}`
  );
}

function isCurrentSeasonDate(dateStr) {
  if (!dateStr) return false;
  const year = Number(dateStr.split("-")[0]);
  return year === 2026 || year === 2027;
}

function makeId(date, home, away) {
  return [
    date,
    normalizeTeam(home),
    normalizeTeam(away)
  ].join("_");
}

/* =========================================================
   HTTP (SMART COOL-DOWN & RETRY)
========================================================= */

async function fetchHtml(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Referer": `${BASE_URL}/Basketball/Default.aspx`
        }
      });

      if (response.status === 502 || response.status === 429) {
        // Rate limit alındığında uzun bekleme
        console.log(`   ⏳ Rate limit/502 algılandı, bekleniyor... (${attempt * 3}s)`);
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();

    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }

  throw new Error("HTML alınamadı");
}

/* =========================================================
   MEVCUT DATA
========================================================= */

function readHistory() {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const json = JSON.parse(raw);

    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.matches)) return json.matches;

    return [];
  } catch (error) {
    console.log("⚠️ basketball-history.json okunamadı:", error.message);
    return [];
  }
}

/* =========================================================
   GÜNCEL SEZON BİLİNEN LİGLER
========================================================= */

function getKnownCurrentSeasonLeagues() {
  return [
    {
      id: "1",
      name: "Türkiye Basketbol Süper Ligi",
      urls: [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=1`
      ]
    },
    {
      id: "300",
      name: "Türkiye Sigorta TBL",
      urls: [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=300`
      ]
    },
    {
      id: "23",
      name: "Türkiye Cumhurbaşkanlığı Kupası",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=23`
      ]
    },
    {
      id: "8",
      name: "EuroLeague",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=8`
      ]
    },
    {
      id: "117",
      name: "EuroCup",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=117`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=117`
      ]
    },
    {
      id: "1629",
      name: "Şampiyonlar Ligi",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=1629`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=1629`
      ]
    },
    {
      id: "10809",
      name: "Kıtalararası Kupası",
      urls: [
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=10809`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=10809`
      ]
    },
    {
      id: "526",
      name: "NBA",
      urls: [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=526`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=526`
      ]
    }
  ];
}

/* =========================================================
   MAÇ PARSE
========================================================= */

function parseMatchesFromPage(html, league) {
  const $ = cheerio.load(html);
  const matches = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) => normalizeText($(td).text()))
      .get();

    if (cells.length < 3) return;

    const rowText = normalizeText(cells.join(" | "));

    const dateMatch = rowText.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
    if (!dateMatch) return;

    const date = parseDate(dateMatch[1]);
    if (!date || !isCurrentSeasonDate(date)) return;

    const scoreMatches = rowText.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\b/g);
    if (!scoreMatches || scoreMatches.length === 0) return;

    let finalScore = null;

    for (let i = scoreMatches.length - 1; i >= 0; i--) {
      const match = scoreMatches[i].match(/(\d+)\s*-\s*(\d+)/);
      if (!match) continue;

      const home = Number(match[1]);
      const away = Number(match[2]);

      if (home >= 0 && away >= 0 && home <= 250 && away <= 250) {
        finalScore = { home, away };
        break;
      }
    }

    if (!finalScore) return;

    let scoreIndex = -1;
    for (let i = 0; i < cells.length; i++) {
      if (/\b\d{1,3}\s*-\s*\d{1,3}\b/.test(cells[i])) {
        scoreIndex = i;
        break;
      }
    }

    if (scoreIndex === -1) return;

    let home = "";
    let away = "";

    if (scoreIndex > 0 && scoreIndex + 1 < cells.length) {
      home = cells[scoreIndex - 1];
      away = cells[scoreIndex + 1];
    }

    if (!home || !away) return;
    if (/^(MS|UZ|ERT|İPT|CANLI)$/i.test(home) \vert{}\vert{} /^(MS\vert{}UZ\vert{}ERT\vert{}İPT\vert{}CANLI)$/i.test(away)) return;

    matches.push({
      id: makeId(date, home, away),
      date,
      time: "",
      home,
      away,
      homeScore: finalScore.home,
      awayScore: finalScore.away,
      total: finalScore.home + finalScore.away,
      league: league.name || "Bilinmeyen",
      leagueId: league.id || null,
      source: "mackolik"
    });
  });

  const unique = new Map();
  for (const match of matches) {
    unique.set(match.id, match);
  }

  return [...unique.values()];
}

/* =========================================================
   LİG GETİR (EARLY EXIT İLE)
========================================================= */

async function fetchLeague(league, index, total) {
  console.log(`\n[${index}/${total}] ${league.name} (${league.id})`);

  let bestMatches = [];

  for (const url of league.urls) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1200)); // İstekler arası dinamik mola

      const html = await fetchHtml(url, 3);
      const matches = parseMatchesFromPage(html, league);

      if (matches.length > 0) {
        console.log(`   ✅ En iyi kaynak: ${url}`);
        console.log(`   ✅ ${matches.length} maç`);
        bestMatches = matches;
        // MAÇ BULUNDU: Diğer URL'lere gereksiz istek atma (Early Exit)
        break;
      }

    } catch (error) {
      console.log(`   ⚠️ ${url} → ${error.message}`);
    }
  }

  if (bestMatches.length === 0) {
    console.log("   → 0 maç");
  }

  return bestMatches;
}

/* =========================================================
   TEMİZLE
========================================================= */

function cleanMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    if (!match || !match.date || !match.home || !match.away) continue;
    if (!isCurrentSeasonDate(match.date)) continue;

    const id = match.id || makeId(match.date, match.home, match.away);
    map.set(id, match);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  console.log("\n==============================================");
  console.log("🏀 MACKOLİK BASKETBOL GEÇMİŞİ");
  console.log("==============================================");

  const oldMatches = readHistory();
  console.log(`Mevcut kayıt: ${oldMatches.length}`);

  const leagues = getKnownCurrentSeasonLeagues();
  console.log(`🏆 Taranacak lig sayısı: ${leagues.length}\n`);

  const newMatches = [];

  for (let i = 0; i < leagues.length; i++) {
    const matches = await fetchLeague(leagues[i], i + 1, leagues.length);
    newMatches.push(...matches);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log("\n🔄 Veriler birleştiriliyor...");

  const merged = [...oldMatches, ...newMatches];
  const cleaned = cleanMatches(merged);

  const leagueNames = new Set(cleaned.map(m => m.league));
  const dates = new Set(cleaned.map(m => m.date));

  const output = {
    source: BASKETBALL_URL,
    updatedAt: new Date().toISOString(),
    season: CURRENT_SEASON,
    matchCount: cleaned.length,
    matches: cleaned
  };

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log("\n==============================================");
  console.log("✅ BASKETBOL GEÇMİŞİ TAMAMLANDI");
  console.log("==============================================");
  console.log(`🆕 Bulunan yeni maç: ${newMatches.length}`);
  console.log(`📦 Toplam benzersiz maç: ${cleaned.length}`);
  console.log(`🏆 Lig sayısı: ${leagueNames.size}`);
  console.log(`📅 Tarih sayısı: ${dates.size}\n`);
}

main().catch(error => {
  console.error("\n❌ KRİTİK HATA", error);
  process.exit(1);
});
