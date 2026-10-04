import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const SITE = "https://arsiv.mackolik.com";
const DATA_PATH = new URL("../data/basketball-history.json", import.meta.url);

// ============================================================
// AYARLAR
// ============================================================

const SEASON_START = new Date("2026-08-01T00:00:00");
const SEASON_END = new Date("2027-07-31T23:59:59");

// 60 GÜN SINIRI YOK.
// SADECE 2026-27 SEZONU.
// ESKİ SEZONLAR ALINMAZ.

const REQUEST_TIMEOUT = 20000;

const KNOWN_LEAGUES = [
  {
    name: "Türkiye Basketbol Süper Ligi",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?id=1`,
      `${SITE}/Basketball/Standing/Default.aspx?sId=1`,
    ],
  },

  {
    name: "Türkiye Sigorta TBL",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?id=300`,
      `${SITE}/Basketball/Standing/Default.aspx?sId=300`,
    ],
  },

  {
    name: "Türkiye Cumhurbaşkanlığı Kupası",
    urls: [
      `${SITE}/Basketball/Cups/Default.aspx?id=23`,
      `${SITE}/Basketball/Cups/Default.aspx?sId=23`,
      `${SITE}/Basketball/Standing/Default.aspx?id=23`,
      `${SITE}/Basketball/Standing/Default.aspx?sId=23`,
    ],
  },

  {
    name: "EuroLeague",
    urls: [
      `${SITE}/Basketball/Cups/Default.aspx?id=8`,
      `${SITE}/Basketball/Cups/Default.aspx?sId=8`,
      `${SITE}/Basketball/Standing/Default.aspx?id=8`,
      `${SITE}/Basketball/Standing/Default.aspx?sId=8`,
    ],
  },

  {
    name: "EuroCup",
    urls: [
      `${SITE}/Basketball/Cups/Default.aspx?id=117`,
      `${SITE}/Basketball/Cups/Default.aspx?sId=117`,
      `${SITE}/Basketball/Standing/Default.aspx?id=117`,
      `${SITE}/Basketball/Standing/Default.aspx?sId=117`,
    ],
  },

  // ŞAMPİYONLAR LİGİ
  {
    name: "Şampiyonlar Ligi - Eleme Turu",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?id=1619`,
      `${SITE}/Basketball/Standing/Default.aspx?id=3040`,
      `${SITE}/Basketball/Standing/Default.aspx?sId=10743`,
      `${SITE}/Basketball/Standing/Default.aspx?id=3042`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup A",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10521`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10521`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup B",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10522`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10522`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup C",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10523`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10523`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup D",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10524`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10524`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup E",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10525`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10525`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup F",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10526`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10526`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup G",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10527`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10527`,
    ],
  },

  {
    name: "Şampiyonlar Ligi - Grup H",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10528`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10528`,
    ],
  },

  {
    name: "NBA",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=526`,
      `${SITE}/Basketball/Standing/Default.aspx?id=526`,
      `${SITE}/Basketball/Cups/Default.aspx?sId=526`,
      `${SITE}/Basketball/Cups/Default.aspx?id=526`,
    ],
  },

  {
    name: "Kıtalararası Kupası",
    urls: [
      `${SITE}/Basketball/Standing/Default.aspx?sId=10809`,
      `${SITE}/Basketball/Standing/Default.aspx?id=10809`,
      `${SITE}/Basketball/Cups/Default.aspx?sId=10809`,
      `${SITE}/Basketball/Cups/Default.aspx?id=10809`,
    ],
  },
];

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeam(value) {
  return cleanText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ");
}

function parseDate(value) {
  const text = cleanText(value);

  let m = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/
  );

  if (!m) return null;

  let day = Number(m[1]);
  let month = Number(m[2]);
  let year = Number(m[3]);

  if (year < 100) {
    year += 2000;
  }

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
}

function isCurrentSeasonDate(date) {
  if (!date) return false;

  return (
    date >= SEASON_START &&
    date <= SEASON_END
  );
}

function parseScore(value) {
  const text = cleanText(value);

  const m = text.match(/^(\d+)\s*[-:]\s*(\d+)$/);

  if (!m) return null;

  return {
    home: Number(m[1]),
    away: Number(m[2]),
  };
}

function isStatusText(value) {
  return /^(MS|UZ|ERT|İPT|IPT|CANLI)$/i.test(
    cleanText(value)
  );
}

function isScoreText(value) {
  return /^\d+\s*[-:]\s*\d+$/.test(
    cleanText(value)
  );
}

function uniqueMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    const key = [
      match.date,
      normalizeTeam(match.home),
      normalizeTeam(match.away),
    ].join("|");

    if (!map.has(key)) {
      map.set(key, match);
    }
  }

  return [...map.values()];
}

// ============================================================
// FETCH
// ============================================================

async function fetchHtml(url) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "tr-TR,tr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// MAÇ PARSER
// ============================================================

function parseMatchRow($, row, leagueName) {
  const cells = [];

  $(row)
    .find("td")
    .each((_, td) => {
      const text = cleanText($(td).text());

      if (text) {
        cells.push(text);
      }
    });

  if (cells.length < 3) {
    return null;
  }

  let date = null;
  let dateIndex = -1;

  for (let i = 0; i < cells.length; i++) {
    const parsed = parseDate(cells[i]);

    if (parsed && isCurrentSeasonDate(parsed)) {
      date = parsed;
      dateIndex = i;
      break;
    }
  }

  if (!date) {
    return null;
  }

  const afterDate = cells.slice(dateIndex + 1);

  if (afterDate.length < 2) {
    return null;
  }

  let scoreIndex = -1;
  let score = null;

  for (let i = 0; i < afterDate.length; i++) {
    const parsedScore = parseScore(afterDate[i]);

    if (parsedScore) {
      scoreIndex = i;
      score = parsedScore;
      break;
    }
  }

  let home = "";
  let away = "";

  if (scoreIndex >= 1) {
    home = afterDate[scoreIndex - 1];

    if (scoreIndex + 1 < afterDate.length) {
      away = afterDate[scoreIndex + 1];
    }
  }

  if (!home || !away) {
    const useful = afterDate.filter(
      (x) =>
        !isStatusText(x) &&
        !isScoreText(x)
    );

    if (useful.length >= 2) {
      home = useful[0];
      away = useful[1];
    }
  }

  if (!home || !away) {
    return null;
  }

  if (isStatusText(home) || isStatusText(away)) {
    return null;
  }

  if (isScoreText(home) || isScoreText(away)) {
    return null;
  }

  // Tarihten sonra gereksiz başlıkları ele
  if (
    home.length < 2 ||
    away.length < 2 ||
    home.length > 100 ||
    away.length > 100
  ) {
    return null;
  }

  return {
    date: formatDate(date),
    home: cleanText(home),
    away: cleanText(away),
    homeScore: score ? score.home : null,
    awayScore: score ? score.away : null,
    league: leagueName,
    status: score ? "finished" : "scheduled",
  };
}

// ============================================================
// SAYFA PARSER
// ============================================================

function parseMatches(html, leagueName) {
  const $ = cheerio.load(html);
  const matches = [];

  $("tr").each((_, row) => {
    const match = parseMatchRow(
      $,
      row,
      leagueName
    );

    if (match) {
      matches.push(match);
    }
  });

  return uniqueMatches(matches);
}

// ============================================================
// LİG FETCH
// ============================================================

async function fetchLeague(league) {
  console.log(`\n🏀 ${league.name}`);

  let bestMatches = [];
  let bestUrl = null;

  for (const url of league.urls) {
    try {
      const html = await fetchHtml(url);
      const matches = parseMatches(
        html,
        league.name
      );

      console.log(
        `   → ${url}\n      ${matches.length} maç`
      );

      if (matches.length > bestMatches.length) {
        bestMatches = matches;
        bestUrl = url;
      }
    } catch (error) {
      console.log(
        `   → ${url}\n      ⚠️ ${error.message}`
      );
    }
  }

  if (bestUrl) {
    console.log(
      `   ✅ En iyi kaynak: ${bestUrl}`
    );

    console.log(
      `   ✅ ${bestMatches.length} maç`
    );
  } else {
    console.log("   → 0 maç");
  }

  return bestMatches;
}

// ============================================================
// MEVCUT DATA
// ============================================================

async function loadExistingData() {
  try {
    const raw = await fs.readFile(
      DATA_PATH,
      "utf8"
    );

    const data = JSON.parse(raw);

    if (
      !data ||
      !Array.isArray(data.matches)
    ) {
      return [];
    }

    return data.matches;
  } catch {
    return [];
  }
}

// ============================================================
// ANA PROGRAM
// ============================================================

async function main() {
  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "🏀 MACKOLİK BASKETBOL GEÇMİŞİ"
  );
  console.log(
    "=============================================="
  );

  console.log(
    "📅 Sezon: 2026-2027"
  );

  console.log(
    "📚 Tarih sınırı: YOK"
  );

  console.log(
    "🚫 Eski sezonlar: KAPALI"
  );

  console.log(
    "📆 Sezon aralığı: 01.08.2026 - 31.07.2027"
  );

  const existing =
    await loadExistingData();

  console.log(
    `\nMevcut kayıt: ${existing.length}`
  );

  // ==========================================================
  // ANA SAYFA
  // ==========================================================

  console.log(
    "\n🏀 Mackolik basketbol sayfası alınıyor..."
  );

  try {
    const html = await fetchHtml(
      `${SITE}/Basketball/Default.aspx`
    );

    console.log(
      `Basketbol HTML uzunluğu: ${html.length}`
    );

    // Ana sayfada lig linkleri varsa yakalamayı dene.
    const $ = cheerio.load(html);

    const discovered = [];

    $("a[href]").each((_, a) => {
      const href = $(a).attr("href") || "";
      const text = cleanText($(a).text());

      if (
        /Basketball\/(Standing|Cups)\/Default\.aspx/i.test(
          href
        )
      ) {
        if (text) {
          discovered.push({
            text,
            href,
          });
        }
      }
    });

    console.log(
      `🏆 Ana sayfadan bulunan lig: ${discovered.length}`
    );
  } catch (error) {
    console.log(
      `⚠️ Ana sayfa alınamadı: ${error.message}`
    );
  }

  console.log(
    `🏆 Taranacak lig sayısı: ${KNOWN_LEAGUES.length}`
  );

  // ==========================================================
  // TÜM LİGLER
  // ==========================================================

  const allNewMatches = [];

  for (
    let i = 0;
    i < KNOWN_LEAGUES.length;
    i++
  ) {
    const league = KNOWN_LEAGUES[i];

    console.log(
      `\n[${i + 1}/${KNOWN_LEAGUES.length}] ${league.name}`
    );

    const matches =
      await fetchLeague(league);

    allNewMatches.push(...matches);
  }

  // ==========================================================
  // BİRLEŞTİR
  // ==========================================================

  console.log(
    "\n🔄 Veriler birleştiriliyor..."
  );

  const combined = [
    ...existing,
    ...allNewMatches,
  ];

  const unique = uniqueMatches(
    combined
  );

  // ==========================================================
  // SADECE MEVCUT SEZON
  // ==========================================================

  const currentSeason = unique.filter(
    (match) => {
      const date = parseDate(
        match.date
          .split("-")
          .reverse()
          .join(".")
      );

      return isCurrentSeasonDate(date);
    }
  );

  // ==========================================================
  // TARİHE GÖRE SIRALA
  // ==========================================================

  currentSeason.sort((a, b) => {
    const da = new Date(
      `${a.date}T12:00:00`
    ).getTime();

    const db = new Date(
      `${b.date}T12:00:00`
    ).getTime();

    if (da !== db) {
      return da - db;
    }

    return (
      `${a.home} ${a.away}`.localeCompare(
        `${b.home} ${b.away}`,
        "tr"
      )
    );
  });

  // ==========================================================
  // KAÇ YENİ MAÇ?
  // ==========================================================

  const existingKeys = new Set(
    existing.map(
      (m) =>
        [
          m.date,
          normalizeTeam(m.home),
          normalizeTeam(m.away),
        ].join("|")
    )
  );

  const newCount =
    currentSeason.filter(
      (m) =>
        !existingKeys.has(
          [
            m.date,
            normalizeTeam(m.home),
            normalizeTeam(m.away),
          ].join("|")
        )
    ).length;

  // ==========================================================
  // DATA
  // ==========================================================

  const output = {
    source: `${SITE}/Basketball/`,
    season: "2026-2027",
    updatedAt: new Date().toISOString(),
    matches: currentSeason,
  };

  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  // ==========================================================
  // ÖZET
  // ==========================================================

  const leagues = new Set(
    currentSeason.map(
      (m) => m.league
    )
  );

  const dates = new Set(
    currentSeason.map(
      (m) => m.date
    )
  );

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "✅ BASKETBOL GEÇMİŞİ TAMAMLANDI"
  );
  console.log(
    "=============================================="
  );

  console.log(
    `🆕 Bu çalışmada bulunan: ${newCount}`
  );

  console.log(
    `📦 Toplam benzersiz maç: ${currentSeason.length}`
  );

  console.log(
    `🏆 Lig sayısı: ${leagues.size}`
  );

  console.log(
    `📅 Tarih sayısı: ${dates.size}`
  );

  console.log(
    "📚 Sezon: 2026-2027"
  );

  console.log(
    "📆 01.08.2026 - 31.07.2027"
  );

  console.log(
    "🚫 Eski sezonlar: alınmadı"
  );

  console.log(
    `💾 Dosya: ${DATA_PATH.pathname}`
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "❌ BASKETBOL GÜNCELLEME HATASI"
  );
  console.error(error);
  process.exit(1);
});
