import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_URL = "https://arsiv.mackolik.com";
const BASKETBALL_URL = `${BASE_URL}/Basketbol/Canli-Sonuclar`;

const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "basketball-history.json"
);

const DAYS_BACK = 60;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36";


// ============================================================
// YARDIMCI
// ============================================================

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeam(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, "");
}

function parseDate(value) {
  const m = String(value || "").match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
  );

  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  const d = new Date(year, month - 1, day);

  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function historyStartDate() {
  const d = new Date();

  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - DAYS_BACK);

  return d;
}

function isWithinHistory(dateString) {
  if (!dateString) return false;

  const d = new Date(`${dateString}T00:00:00`);

  const start = historyStartDate();

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  return d >= start && d <= now;
}

function makeId(date, home, away) {
  return [
    date,
    normalizeTeam(home),
    normalizeTeam(away)
  ].join("_");
}


// ============================================================
// HTTP
// ============================================================

async function fetchHtml(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (attempt < 3) {
      console.log(
        `   ↻ Tekrar deneniyor (${attempt + 1}/3)...`
      );

      await new Promise(resolve =>
        setTimeout(resolve, 1500 * attempt)
      );

      return fetchHtml(url, attempt + 1);
    }

    throw error;
  }
}


// ============================================================
// MEVCUT DATA
// ============================================================

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

    if (Array.isArray(json.matches)) {
      return json.matches;
    }

    return [];
  } catch (error) {
    console.log("⚠️ Mevcut basketbol verisi okunamadı.");
    console.log(error.message);
    return [];
  }
}


// ============================================================
// LİG ID BULMA
// ============================================================

function addLeague(map, id, name = "") {
  if (!id) return;

  const cleanId = String(id).trim();

  if (!/^\d+$/.test(cleanId)) {
    return;
  }

  if (!map.has(cleanId)) {
    map.set(cleanId, {
      id: cleanId,
      name: normalizeText(name) || `Basketbol Ligi ${cleanId}`
    });
  } else {
    const old = map.get(cleanId);

    if (
      old.name.startsWith("Basketbol Ligi") &&
      normalizeText(name)
    ) {
      old.name = normalizeText(name);
    }
  }
}

function parseLeagueIds(html) {
  const $ = cheerio.load(html);

  const leagues = new Map();

  // ----------------------------------------------------------
  // 1) Normal href içindeki id / sId
  // ----------------------------------------------------------

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = normalizeText($(el).text());

    let match = href.match(
      /Basketball\/Standing\/Default\.aspx\?(?:[^#]*?&)?(?:id|sId)=(\d+)/i
    );

    if (match) {
      addLeague(leagues, match[1], text);
    }

    match = href.match(
      /Basketball\/Cups\/Default\.aspx\?(?:[^#]*?&)?(?:id|sId)=(\d+)/i
    );

    if (match) {
      addLeague(leagues, match[1], text);
    }
  });


  // ----------------------------------------------------------
  // 2) HTML içerisinde düz URL olarak geçiyorsa
  // ----------------------------------------------------------

  const patterns = [
    /Basketball\/Standing\/Default\.aspx\?[^"'<> ]*?(?:id|sId)=(\d+)/gi,
    /Basketball\/Cups\/Default\.aspx\?[^"'<> ]*?(?:id|sId)=(\d+)/gi
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(html)) !== null) {
      addLeague(leagues, match[1]);
    }
  }


  // ----------------------------------------------------------
  // 3) data-id / data-sid
  // ----------------------------------------------------------

  $("[data-id], [data-sid], [data-league-id]").each((_, el) => {
    const id =
      $(el).attr("data-id") ||
      $(el).attr("data-sid") ||
      $(el).attr("data-league-id");

    const text = normalizeText($(el).text());

    if (id && /^\d+$/.test(id)) {
      addLeague(leagues, id, text);
    }
  });


  // ----------------------------------------------------------
  // 4) onclick içerisinde id varsa
  // ----------------------------------------------------------

  $("[onclick]").each((_, el) => {
    const onclick = $(el).attr("onclick") || "";
    const text = normalizeText($(el).text());

    const patterns = [
      /(?:id|sId|leagueId|league_id)\s*[=:]\s*['"]?(\d+)/i,
      /Standing[^0-9]{0,100}(\d+)/i,
      /Cups[^0-9]{0,100}(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = onclick.match(pattern);

      if (match) {
        addLeague(leagues, match[1], text);
        break;
      }
    }
  });


  return [...leagues.values()];
}


// ============================================================
// LİG SAYFASINDAN MAÇLARI ÇEK
// ============================================================

function parseLeagueResults(html, league) {
  const $ = cheerio.load(html);

  const results = [];

  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) => normalizeText($(td).text()))
      .get();

    if (cells.length < 3) {
      return;
    }

    const rowText = normalizeText(cells.join(" | "));

    // Tarih
    const dateMatch = rowText.match(
      /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
    );

    if (!dateMatch) {
      return;
    }

    const date = parseDate(dateMatch[1]);

    if (!date) {
      return;
    }

    // 60 günlük pencerenin dışındaysa alma.
    if (!isWithinHistory(date)) {
      return;
    }

    // Skor
    const scoreMatch = rowText.match(
      /\b(\d{1,3})\s*-\s*(\d{1,3})\b/
    );

    if (!scoreMatch) {
      return;
    }

    const homeScore = Number(scoreMatch[1]);
    const awayScore = Number(scoreMatch[2]);

    if (
      !Number.isFinite(homeScore) ||
      !Number.isFinite(awayScore)
    ) {
      return;
    }

    // --------------------------------------------------------
    // Skor hücresini bul
    // --------------------------------------------------------

    let scoreIndex = -1;

    for (let i = 0; i < cells.length; i++) {
      if (
        /\b\d{1,3}\s*-\s*\d{1,3}\b/.test(cells[i])
      ) {
        scoreIndex = i;
        break;
      }
    }

    if (scoreIndex < 0) {
      return;
    }

    // --------------------------------------------------------
    // Takımları bul
    // --------------------------------------------------------

    let home = "";
    let away = "";

    if (
      scoreIndex > 0 &&
      scoreIndex + 1 < cells.length
    ) {
      home = cells[scoreIndex - 1];
      away = cells[scoreIndex + 1];
    }

    // --------------------------------------------------------
    // Takım isimleri kötü geldiyse alternatif yöntem
    // --------------------------------------------------------

    if (
      !home ||
      !away ||
      home === "MS" ||
      away === "MS" ||
      home === "UZ" ||
      away === "UZ"
    ) {
      const candidates = cells.filter(cell => {
        if (!cell) return false;

        if (
          /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(cell)
        ) {
          return false;
        }

        if (/^(MS|UZ|ERT|İPT|CANLI)$/i.test(cell)) {
          return false;
        }

        if (
          /^\d{1,3}\s*-\s*\d{1,3}$/.test(cell)
        ) {
          return false;
        }

        return true;
      });

      if (candidates.length >= 2) {
        home = candidates[candidates.length - 2];
        away = candidates[candidates.length - 1];
      }
    }

    if (!home || !away) {
      return;
    }

    if (
      home.length < 2 ||
      away.length < 2
    ) {
      return;
    }

    // Bazı tablolarda "MS" ayrı hücredir.
    if (/^(MS|UZ|ERT|İPT)$/i.test(home)) {
      return;
    }

    if (/^(MS|UZ|ERT|İPT)$/i.test(away)) {
      return;
    }

    const id = makeId(date, home, away);

    results.push({
      id,
      date,
      time: "",
      home,
      away,
      homeScore,
      awayScore,
      halfHomeScore: null,
      halfAwayScore: null,
      total: homeScore + awayScore,
      league: league.name,
      leagueId: league.id,
      source: "mackolik"
    });
  });

  // Aynı maç birden fazla satırdan geldiyse tekilleştir.
  const unique = new Map();

  for (const match of results) {
    unique.set(match.id, match);
  }

  return [...unique.values()];
}


// ============================================================
// TEK LİG GETİR
// ============================================================

async function fetchLeague(league, index, total) {
  const urls = [
    `${BASE_URL}/Basketball/Standing/Default.aspx?id=${league.id}`,
    `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${league.id}`
  ];

  console.log(
    `\n[${index}/${total}] ${league.name} (${league.id})`
  );

  let html = null;

  for (const url of urls) {
    try {
      html = await fetchHtml(url);

      if (
        html &&
        (
          html.includes("Basketbol") ||
          html.includes("basketbol") ||
          html.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
        )
      ) {
        break;
      }
    } catch (error) {
      console.log(
        `   ⚠️ ${url} → ${error.message}`
      );
    }
  }

  if (!html) {
    console.log("   ⚠️ Sayfa alınamadı.");
    return [];
  }

  const matches = parseLeagueResults(html, league);

  console.log(
    `   → ${matches.length} maç`
  );

  return matches;
}


// ============================================================
// TEMİZLE
// ============================================================

function cleanMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    if (!match) continue;

    if (
      !match.id ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    if (!isWithinHistory(match.date)) {
      continue;
    }

    if (
      !Number.isFinite(Number(match.homeScore)) ||
      !Number.isFinite(Number(match.awayScore))
    ) {
      continue;
    }

    map.set(match.id, {
      ...match,
      homeScore: Number(match.homeScore),
      awayScore: Number(match.awayScore),
      total:
        Number(match.homeScore) +
        Number(match.awayScore)
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    return (
      normalizeTeam(a.home) +
      normalizeTeam(a.away)
    ).localeCompare(
      normalizeTeam(b.home) +
      normalizeTeam(b.away)
    );
  });
}


// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("🏀 MACKOLİK BASKETBOL GEÇMİŞİ");
  console.log("==============================================");
  console.log(`📅 Geçmiş aralığı: ${DAYS_BACK} gün`);
  console.log("");

  const oldMatches = readHistory();

  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );

  // ----------------------------------------------------------
  // Basketbol ana sayfası
  // ----------------------------------------------------------

  console.log("");
  console.log("🏀 Mackolik basketbol sayfası alınıyor...");

  let basketballHtml;

  try {
    basketballHtml = await fetchHtml(BASKETBALL_URL);
  } catch (error) {
    console.error(
      "❌ Basketbol sayfası alınamadı:",
      error.message
    );

    process.exit(1);
  }

  console.log(
    `Basketbol HTML uzunluğu: ${basketballHtml.length}`
  );

  // ----------------------------------------------------------
  // Lig ID'leri
  // ----------------------------------------------------------

  const leagues = parseLeagueIds(basketballHtml);

  console.log(
    `🏆 Bulunan basketbol ligi: ${leagues.length}`
  );

  // ----------------------------------------------------------
  // Eğer ana sayfadan ID çıkarılamıyorsa,
  // bilinen aktif basketbol liglerini doğrudan dene.
  // ----------------------------------------------------------

  if (leagues.length === 0) {
    console.log("");
    console.log(
      "⚠️ Ana sayfadan lig ID çıkarılamadı."
    );

    console.log(
      "🔄 Bilinen Mackolik basketbol ligleri deneniyor..."
    );

    const fallbackIds = [
      ["NBA", "526"],
      ["EuroLeague", "30"],
      ["Türkiye Basketbol", "1"],
      ["Türkiye Basketbol 1.Lig", "1031"],
      ["EuroCup", "117"],
      ["Almanya", "0"],
      ["İspanya", "0"],
      ["İtalya", "0"],
      ["Fransa", "0"],
      ["Yunanistan", "0"],
      ["İngiltere", "0"],
      ["Avustralya", "0"],
      ["Arjantin", "0"],
      ["Brezilya", "0"],
      ["Japonya", "0"],
      ["Çin", "0"],
      ["Kore", "0"],
      ["Litvanya", "0"],
      ["Letonya", "0"],
      ["Polonya", "0"],
      ["Sırbistan", "0"],
      ["İsrail", "0"],
      ["Porto Riko", "0"]
    ];

    for (const [name, id] of fallbackIds) {
      if (id !== "0") {
        addLeague(
          new Map(),
          id,
          name
        );
      }
    }

    // Yukarıdaki Map lokal olduğu için tekrar düzgün oluştur.
    const fallbackMap = new Map();

    for (const [name, id] of fallbackIds) {
      if (id !== "0") {
        fallbackMap.set(id, {
          id,
          name
        });
      }
    }

    leagues.push(...fallbackMap.values());

    console.log(
      `   → ${leagues.length} temel lig bulundu.`
    );
  }


  // ----------------------------------------------------------
  // İlk ligleri göster
  // ----------------------------------------------------------

  if (leagues.length > 0) {
    console.log("");
    console.log("İlk bulunan ligler:");

    leagues.slice(0, 20).forEach((league, i) => {
      console.log(
        `   ${i + 1}. ${league.name} → ${league.id}`
      );
    });
  }


  // ----------------------------------------------------------
  // Ligleri tara
  // ----------------------------------------------------------

  console.log("");
  console.log("🔎 Basketbol lig geçmişleri taranıyor...");

  const allNewMatches = [];

  for (let i = 0; i < leagues.length; i++) {
    const matches = await fetchLeague(
      leagues[i],
      i + 1,
      leagues.length
    );

    allNewMatches.push(...matches);

    // Mackolik'i çok hızlı bombardıman etme.
    await new Promise(resolve =>
      setTimeout(resolve, 250)
    );
  }


  // ----------------------------------------------------------
  // BİRLEŞTİR
  // ----------------------------------------------------------

  console.log("");
  console.log("🔄 Veriler birleştiriliyor...");

  const merged = [
    ...oldMatches,
    ...allNewMatches
  ];

  const cleaned = cleanMatches(merged);

  const leagueNames = new Set(
    cleaned
      .map(x => x.league)
      .filter(Boolean)
  );

  const dates = new Set(
    cleaned
      .map(x => x.date)
      .filter(Boolean)
  );

  const output = {
    source: BASKETBALL_URL,
    updatedAt: new Date().toISOString(),
    historyDays: DAYS_BACK,
    leagueCount: leagueNames.size,
    dateCount: dates.size,
    matchCount: cleaned.length,
    matches: cleaned
  };

  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(output, null, 2),
    "utf8"
  );


  // ----------------------------------------------------------
  // SONUÇ
  // ----------------------------------------------------------

  console.log("");
  console.log("==============================================");
  console.log("✅ BASKETBOL GEÇMİŞİ TAMAMLANDI");
  console.log("==============================================");

  console.log(
    `🆕 Yeni bulunan maç: ${allNewMatches.length}`
  );

  console.log(
    `📦 Toplam benzersiz maç: ${cleaned.length}`
  );

  console.log(
    `🏆 Lig sayısı: ${leagueNames.size}`
  );

  console.log(
    `📅 Tarih sayısı: ${dates.size}`
  );

  console.log(
    `💾 Dosya: ${DATA_PATH}`
  );

  console.log("");
}

main().catch(error => {
  console.error("");
  console.error("❌ KRİTİK HATA");
  console.error(error);
  process.exit(1);
});
