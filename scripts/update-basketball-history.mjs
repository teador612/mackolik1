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
  // Basketbol sezonu 2026 Sonbahar - 2027 İlkbahar arası oynanır
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
   HTTP
========================================================= */

async function fetchHtml(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          "Referer": `${BASE_URL}/Basketball/Default.aspx`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();

    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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

    if (Array.isArray(json)) {
      return json;
    }

    if (json && Array.isArray(json.matches)) {
      return json.matches;
    }

    return [];

  } catch (error) {
    console.log("⚠️ basketball-history.json okunamadı:", error.message);
    return [];
  }
}

/* =========================================================
   LİG EKLE
========================================================= */

function addLeague(map, id, name, urls) {
  if (!id) return;

  id = String(id).trim();
  if (!/^\d+$/.test(id)) return;

  name = normalizeText(name) || `Basketbol ${id}`;
  const key = id;

  if (!map.has(key)) {
    map.set(key, {
      id,
      name,
      urls: [...new Set(urls || [])]
    });
    return;
  }

  const current = map.get(key);

  if (current.name.startsWith("Basketbol ") && !name.startsWith("Basketbol ")) {
    current.name = name;
  }

  current.urls = [...new Set([...current.urls, ...(urls || [])])];
}

/* =========================================================
   GÜNCEL SEZON LİG KEŞFİ
========================================================= */

function discoverLeagues(html) {
  const $ = cheerio.load(html);
  const leagues = new Map();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    const text = normalizeText($(element).text());

    let match = href.match(/Basketball\/Standing\/Default\.aspx\?[^#]*?\bid=(\d+)/i);
    if (match) {
      const id = match[1];
      addLeague(leagues, id, text, [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=${id}`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${id}`
      ]);
      return;
    }

    match = href.match(/Basketball\/Standing\/Default\.aspx\?[^#]*?\bsId=(\d+)/i);
    if (match) {
      const id = match[1];
      addLeague(leagues, id, text, [
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${id}`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=${id}`
      ]);
      return;
    }

    match = href.match(/Basketball\/Cups\/Default\.aspx\?[^#]*?\bid=(\d+)/i);
    if (match) {
      const id = match[1];
      addLeague(leagues, id, text, [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=${id}`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=${id}`
      ]);
      return;
    }

    match = href.match(/Basketball\/Cups\/Default\.aspx\?[^#]*?\bsId=(\d+)/i);
    if (match) {
      const id = match[1];
      addLeague(leagues, id, text, [
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=${id}`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=${id}`
      ]);
    }
  });

  return [...leagues.values()];
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
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=1`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=1`
      ]
    },
    {
      id: "300",
      name: "Türkiye Sigorta TBL",
      urls: [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=300`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=300`
      ]
    },
    {
      id: "8",
      name: "EuroLeague",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=8`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=8`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=8`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=8`
      ]
    },
    {
      id: "23",
      name: "Türkiye Cumhurbaşkanlığı Kupası",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=23`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=23`
      ]
    },
    {
      id: "1629",
      name: "Şampiyonlar Ligi",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=1629`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=1629`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=1629`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=1629`
      ]
    },
    {
      id: "10809",
      name: "Kıtalararası Kupası",
      urls: [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=10809`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=10809`
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

    /*
      Tarih
    */

    const dateMatch = rowText.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
    if (!dateMatch) return;

    const date = parseDate(dateMatch[1]);
    if (!date) return;

    /*
      SADECE 2026 VE 2027 (2026-2027 SEZONU)
    */

    if (!isCurrentSeasonDate(date)) {
      return;
    }

    /*
      Skorlar
    */

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

    const homeScore = finalScore.home;
    const awayScore = finalScore.away;

    /*
      Takımlar
    */

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

    if (!home || !away) {
      const candidates = cells.filter(cell => {
        if (!cell) return false;
        if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(cell)) return false;
        if (/^(MS|UZ|ERT|İPT|CANLI)$/i.test(cell)) return false;
        if (/^\d{1,3}\s*-\s*\d{1,3}$/.test(cell)) return false;
        return cell.length >= 2;
      });

      if (candidates.length >= 2) {
        home = candidates[candidates.length - 2];
        away = candidates[candidates.length - 1];
      }
    }

    if (!home || !away) return;

    if (
      /^(MS|UZ|ERT|İPT|CANLI)$/i.test(home) ||
      /^(MS|UZ|ERT|İPT|CANLI)$/i.test(away)
    ) {
      return;
    }

    /*
      İY Skoru
    */

    let halfHomeScore = null;
    let halfAwayScore = null;

    if (scoreMatches.length >= 2) {
      for (let i = 0; i < scoreMatches.length - 1; i++) {
        const first = scoreMatches[i].match(/(\d+)\s*-\s*(\d+)/);
        if (!first) continue;

        const h = Number(first[1]);
        const a = Number(first[2]);

        if (h <= 150 && a <= 150) {
          halfHomeScore = h;
          halfAwayScore = a;
          break;
        }
      }
    }

    matches.push({
      id: makeId(date, home, away),
      date,
      time: "",
      home,
      away,
      homeScore,
      awayScore,
      halfHomeScore,
      halfAwayScore,
      total: homeScore + awayScore,
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
   LİG GETİR
========================================================= */

async function fetchLeague(league, index, total) {
  console.log(`\n[${index}/${total}] ${league.name} (${league.id})`);

  let bestMatches = [];

  for (const url of league.urls) {
    try {
      const html = await fetchHtml(url, 3);
      const matches = parseMatchesFromPage(html, league);

      if (matches.length > bestMatches.length) {
        bestMatches = matches;
      }

      if (matches.length > 0) {
        console.log(`   → ${matches.length} maç`);
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
   TEMİZLE / TEKİLLEŞTİR
========================================================= */

function cleanMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    if (!match || !match.date || !match.home || !match.away) {
      continue;
    }

    /*
      2026-2027 Sezonu Kontrolü
    */

    if (!isCurrentSeasonDate(match.date)) {
      continue;
    }

    if (
      !Number.isFinite(Number(match.homeScore)) ||
      !Number.isFinite(Number(match.awayScore))
    ) {
      continue;
    }

    const id = match.id || makeId(match.date, match.home, match.away);

    map.set(id, {
      ...match,
      id,
      homeScore: Number(match.homeScore),
      awayScore: Number(match.awayScore),
      total: Number(match.homeScore) + Number(match.awayScore)
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    return (normalizeTeam(a.home) + normalizeTeam(a.away)).localeCompare(
      normalizeTeam(b.home) + normalizeTeam(b.away)
    );
  });
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("🏀 MACKOLİK BASKETBOL GEÇMİŞİ");
  console.log("==============================================");
  console.log(`📅 Sezon: ${CURRENT_SEASON}`);
  console.log("📚 Tarih sınırı: YOK");
  console.log("🚫 Eski sezonlar: KAPALI");
  console.log("");

  const oldMatches = readHistory();
  console.log(`Mevcut kayıt: ${oldMatches.length}\n`);

  console.log("🏀 Mackolik basketbol sayfası alınıyor...");

  let basketballHtml;
  try {
    basketballHtml = await fetchHtml(BASKETBALL_URL, 3);
  } catch (error) {
    console.error("❌ Basketbol sayfası alınamadı:", error.message);
    process.exit(1);
  }

  console.log(`Basketbol HTML uzunluğu: ${basketballHtml.length}`);

  const discovered = discoverLeagues(basketballHtml);
  console.log(`🏆 Ana sayfadan bulunan güncel lig: ${discovered.length}`);

  const leagueMap = new Map();

  for (const league of discovered) {
    leagueMap.set(league.id, league);
  }

  for (const league of getKnownCurrentSeasonLeagues()) {
    if (leagueMap.has(league.id)) {
      const current = leagueMap.get(league.id);
      current.name = league.name;
      current.urls = [...new Set([...current.urls, ...league.urls])];
    } else {
      leagueMap.set(league.id, league);
    }
  }

  const leagues = [...leagueMap.values()];
  console.log(`🏆 Taranacak güncel sezon ligleri: ${leagues.length}`);

  const newMatches = [];

  for (let i = 0; i < leagues.length; i++) {
    const matches = await fetchLeague(leagues[i], i + 1, leagues.length);
    newMatches.push(...matches);

    // Rate-limit ve 502 engeli için 1 saniyelik bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("\n🔄 Veriler birleştiriliyor...");

  const merged = [...oldMatches, ...newMatches];
  const cleaned = cleanMatches(merged);

  const leagueNames = new Set(cleaned.map(m => m.league).filter(Boolean));
  const dates = new Set(cleaned.map(m => m.date).filter(Boolean));

  const output = {
    source: BASKETBALL_URL,
    updatedAt: new Date().toISOString(),
    season: CURRENT_SEASON,
    historyDays: null,
    historyLimit: "none",
    oldSeasons: false,
    leagueCount: leagueNames.size,
    dateCount: dates.size,
    matchCount: cleaned.length,
    matches: cleaned
  };

  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2), "utf8");

  console.log("\n==============================================");
  console.log("✅ BASKETBOL GEÇMİŞİ TAMAMLANDI");
  console.log("==============================================");
  console.log(`🆕 Yeni bulunan maç: ${newMatches.length}`);
  console.log(`📦 Toplam benzersiz maç: ${cleaned.length}`);
  console.log(`🏆 Lig sayısı: ${leagueNames.size}`);
  console.log(`📅 Tarih sayısı: ${dates.size}`);
  console.log(`📚 Sezon: ${CURRENT_SEASON}`);
  console.log("🚫 Eski sezonlar: alınmadı");
  console.log(`💾 Dosya: ${DATA_PATH}\n`);
}

main().catch(error => {
  console.error("\n❌ KRİTİK HATA");
  console.error(error);
  process.exit(1);
});
