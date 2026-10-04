import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const SITE = "https://ofsayt.com";

const DATA_PATH = new URL(
  "../data/basketball-history.json",
  import.meta.url
);

// ============================================================
// AYARLAR
// ============================================================

const SEASON_START = new Date("2026-08-01T00:00:00");
const SEASON_END = new Date("2027-07-31T23:59:59");

const REQUEST_TIMEOUT = 20000;

// Aynı takım sayfasını birden fazla ligden bulabiliriz.
// Tekrar indirmemek için cache kullanıyoruz.

const TEAM_CONCURRENCY = 6;

// 2026/27 OFSAYT LİG SAYFALARI
const LEAGUE_PAGES = [
  {
    name: "Türkiye Basketbol Süper Ligi",
    url:
      `${SITE}/basketbol/lig/turkiye-basketbol-super-ligi/` +
      `2fed80f9-a6ae-46a6-ba42-2b4b9cb61232/detay/puan-durumu`,
  },

  {
    name: "Türkiye Basketbol Ligi",
    url:
      `${SITE}/basketbol/lig/turkiye-basketbol-ligi/` +
      `03800d93-32c9-470f-8de5-6bc90efdfb51/detay/puan-durumu`,
  },

  {
    name: "EuroLeague",
    url:
      `${SITE}/basketbol/lig/euroleague/` +
      `b3cbc6e8-3abf-4a23-ba0b-4065ef669cdf/detay/puan-durumu`,
  },

  {
    name: "EuroCup",
    url:
      `${SITE}/basketbol/lig/eurocup/` +
      `ba366b4a-76f9-4a32-ae36-ce9a8822a7df/detay/puan-durumu`,
  },

  {
    name: "NBA",
    url:
      `${SITE}/basketbol/lig/abd-nba/` +
      `810a2821-3fe1-46ec-a0c6-627c51fe292b/detay/puan-durumu`,
  },
];

// ============================================================
// YARDIMCI
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

function parseScore(text) {
  const value = cleanText(text);

  const match = value.match(
    /^(\d+)\s*[-:]\s*(\d+)$/
  );

  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

function makeDate(day, month) {
  const d = Number(day);
  const m = Number(month);

  if (
    !Number.isInteger(d) ||
    !Number.isInteger(m) ||
    d < 1 ||
    d > 31 ||
    m < 1 ||
    m > 12
  ) {
    return null;
  }

  // 26/27 sezonu:
  // Ağustos-Aralık => 2026
  // Ocak-Temmuz   => 2027

  const year = m >= 8 ? 2026 : 2027;

  const date = new Date(
    year,
    m - 1,
    d,
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function isCurrentSeason(date) {
  if (!date) {
    return false;
  }

  return (
    date >= SEASON_START &&
    date <= SEASON_END
  );
}

function isScoreText(text) {
  return /^\d+\s*[-:]\s*\d+$/.test(
    cleanText(text)
  );
}

function isTimeText(text) {
  return /^\d{1,2}:\d{2}$/.test(
    cleanText(text)
  );
}

function isResultMark(text) {
  return /^(G|M|B|E|ERT|-|MS)$/i.test(
    cleanText(text)
  );
}

function isDateText(text) {
  return /^\d{1,2}\/\d{1,2}$/.test(
    cleanText(text)
  );
}

// ============================================================
// FETCH
// ============================================================

async function fetchHtml(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

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
        "Cache-Control":
          "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// LİG SAYFASINDAN TAKIMLARI BUL
// ============================================================

function extractTeamLinks(html) {
  const $ = cheerio.load(html);

  const teams = new Map();

  $("a[href]").each((_, a) => {
    const href =
      $(a).attr("href") || "";

    const text = cleanText(
      $(a).text()
    );

    if (!text) {
      return;
    }

    if (
      !href.includes("/basketbol/takim/")
    ) {
      return;
    }

    const match = href.match(
      /\/basketbol\/takim\/([^/]+)\/([0-9a-f-]{36})\/detay/i
    );

    if (!match) {
      return;
    }

    const absolute = href.startsWith("http")
      ? href
      : `${SITE}${href}`;

    teams.set(absolute, {
      name: text,
      url: absolute,
    });
  });

  return [...teams.values()];
}

// ============================================================
// TAKIM SAYFASINDA MAÇ PARSE ET
// ============================================================

function parseTeamMatches(
  html,
  teamName,
  sourceLeague
) {
  const $ = cheerio.load(html);

  const matches = [];

  // Sayfada 26/27 sezonunun maç tablolarını tarıyoruz.
  //
  // Ofsayt takım sayfalarında:
  //
  // Tarih | Maç | Durum
  //
  // şeklinde satırlar bulunuyor.
  //
  // Örnek:
  // 27/09 | Finalspor 75 - 74 Fenerbahçe Gelişim | G

  $("tr").each((_, row) => {
    const cells = [];

    $(row)
      .find("td")
      .each((_, td) => {
        const text = cleanText(
          $(td).text()
        );

        if (text) {
          cells.push(text);
        }
      });

    if (cells.length < 2) {
      return;
    }

    let dateIndex = -1;
    let date = null;

    for (let i = 0; i < cells.length; i++) {
      if (!isDateText(cells[i])) {
        continue;
      }

      const match = cells[i].match(
        /^(\d{1,2})\/(\d{1,2})$/
      );

      if (!match) {
        continue;
      }

      const parsed = makeDate(
        match[1],
        match[2]
      );

      if (
        parsed &&
        isCurrentSeason(parsed)
      ) {
        dateIndex = i;
        date = parsed;
        break;
      }
    }

    if (
      dateIndex === -1 ||
      !date
    ) {
      return;
    }

    const afterDate =
      cells.slice(dateIndex + 1);

    if (!afterDate.length) {
      return;
    }

    // Skor içeren hücreyi bul.
    let scoreIndex = -1;
    let score = null;

    for (
      let i = 0;
      i < afterDate.length;
      i++
    ) {
      const parsed = parseScore(
        afterDate[i]
      );

      if (parsed) {
        scoreIndex = i;
        score = parsed;
        break;
      }
    }

    // Skorsuz gelecek maçları history'ye almıyoruz.
    // Bu dosya geçmiş maç verisi.
    if (
      scoreIndex === -1 ||
      !score
    ) {
      return;
    }

    // Skorun çevresindeki takım isimlerini bul.
    const beforeScore =
      afterDate
        .slice(0, scoreIndex)
        .filter((x) => {
          return (
            !isTimeText(x) &&
            !isResultMark(x)
          );
        });

    const afterScore =
      afterDate
        .slice(scoreIndex + 1)
        .filter((x) => {
          return (
            !isTimeText(x) &&
            !isResultMark(x)
          );
        });

    if (
      !beforeScore.length ||
      !afterScore.length
    ) {
      return;
    }

    const home = cleanText(
      beforeScore[
        beforeScore.length - 1
      ]
    );

    const away = cleanText(
      afterScore[0]
    );

    if (!home || !away) {
      return;
    }

    if (
      isScoreText(home) ||
      isScoreText(away)
    ) {
      return;
    }

    if (
      home.length < 2 ||
      away.length < 2
    ) {
      return;
    }

    // Sayfadaki "ERT" gibi durumları
    // takım adı sanmayalım.
    if (
      /^(ERT|İPT|IPT|CANLI|MS|UZ)$/i.test(
        home
      )
    ) {
      return;
    }

    if (
      /^(ERT|İPT|IPT|CANLI|MS|UZ)$/i.test(
        away
      )
    ) {
      return;
    }

    matches.push({
      date: formatDate(date),
      home,
      away,
      homeScore: score.home,
      awayScore: score.away,
      league: sourceLeague,
      status: "finished",
      source: "ofsayt",
      sourceTeam: teamName,
    });
  });

  return matches;
}

// ============================================================
// TAKIM SAYFASINI ÇEK
// ============================================================

async function fetchTeam(team, sourceLeague) {
  try {
    const html =
      await fetchHtml(team.url);

    const matches =
      parseTeamMatches(
        html,
        team.name,
        sourceLeague
      );

    return {
      team,
      matches,
    };
  } catch (error) {
    return {
      team,
      matches: [],
      error: error.message,
    };
  }
}

// ============================================================
// BENZER MAÇLARI TEK KAYDA DÖNÜŞTÜR
// ============================================================

function mergeMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    if (
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    const home =
      normalizeTeam(match.home);

    const away =
      normalizeTeam(match.away);

    const key = [
      match.date,
      home,
      away,
    ].join("|");

    const reverseKey = [
      match.date,
      away,
      home,
    ].join("|");

    if (map.has(key)) {
      continue;
    }

    if (map.has(reverseKey)) {
      continue;
    }

    map.set(key, {
      date: match.date,
      home: match.home,
      away: match.away,
      homeScore:
        Number.isFinite(
          Number(match.homeScore)
        )
          ? Number(match.homeScore)
          : null,
      awayScore:
        Number.isFinite(
          Number(match.awayScore)
        )
          ? Number(match.awayScore)
          : null,
      league: match.league,
      status: "finished",
      source: "ofsayt",
    });
  }

  return [...map.values()];
}

// ============================================================
// MEVCUT DATA
// ============================================================

async function loadExisting() {
  try {
    const raw =
      await fs.readFile(
        DATA_PATH,
        "utf8"
      );

    const data =
      JSON.parse(raw);

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
// PARALEL TAKIM İŞLEME
// ============================================================

async function processTeams(
  teams,
  leagueName
) {
  const all = [];

  for (
    let i = 0;
    i < teams.length;
    i += TEAM_CONCURRENCY
  ) {
    const batch =
      teams.slice(
        i,
        i + TEAM_CONCURRENCY
      );

    const results =
      await Promise.all(
        batch.map((team) =>
          fetchTeam(
            team,
            leagueName
          )
        )
      );

    for (const result of results) {
      if (result.error) {
        console.log(
          `   ⚠️ ${result.team.name}: ${result.error}`
        );
        continue;
      }

      if (
        result.matches.length
      ) {
        console.log(
          `   🏀 ${result.team.name}: ${result.matches.length} maç`
        );
      }

      all.push(
        ...result.matches
      );
    }
  }

  return all;
}

// ============================================================
// ANA
// ============================================================

async function main() {
  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "🏀 OFSAYT BASKETBOL GEÇMİŞİ"
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
    "🌐 Kaynak: Ofsayt"
  );

  console.log(
    "📆 01.08.2026 - 31.07.2027"
  );

  const existing =
    await loadExisting();

  console.log(
    `\nMevcut kayıt: ${existing.length}`
  );

  const discoveredTeams =
    new Map();

  const allFetchedMatches = [];

  // ==========================================================
  // LİGLER
  // ==========================================================

  for (
    let i = 0;
    i < LEAGUE_PAGES.length;
    i++
  ) {
    const league =
      LEAGUE_PAGES[i];

    console.log("");
    console.log(
      `[${i + 1}/${LEAGUE_PAGES.length}] ${league.name}`
    );

    try {
      const html =
        await fetchHtml(
          league.url
        );

      console.log(
        `   HTML: ${html.length}`
      );

      const teams =
        extractTeamLinks(html);

      console.log(
        `   👥 Bulunan takım: ${teams.length}`
      );

      for (const team of teams) {
        if (
          !discoveredTeams.has(
            team.url
          )
        ) {
          discoveredTeams.set(
            team.url,
            {
              ...team,
              leagues: [
                league.name,
              ],
            }
          );
        } else {
          const existingTeam =
            discoveredTeams.get(
              team.url
            );

          if (
            !existingTeam.leagues.includes(
              league.name
            )
          ) {
            existingTeam.leagues.push(
              league.name
            );
          }
        }
      }
    } catch (error) {
      console.log(
        `   ⚠️ ${error.message}`
      );
    }
  }

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `👥 Toplam benzersiz takım: ${discoveredTeams.size}`
  );

  console.log(
    "=============================================="
  );

  // ==========================================================
  // TAKIM SAYFALARI
  // ==========================================================

  let teamCounter = 0;

  for (const team of discoveredTeams.values()) {
    teamCounter++;

    console.log(
      `\n[TAKIM ${teamCounter}/${discoveredTeams.size}] ${team.name}`
    );

    const leagueName =
      team.leagues[0] ||
      "Basketbol";

    const result =
      await fetchTeam(
        team,
        leagueName
      );

    if (result.error) {
      console.log(
        `   ⚠️ ${result.error}`
      );
      continue;
    }

    console.log(
      `   → ${result.matches.length} maç`
    );

    allFetchedMatches.push(
      ...result.matches
    );
  }

  // ==========================================================
  // BİRLEŞTİR
  // ==========================================================

  console.log("");
  console.log(
    "🔄 Veriler birleştiriliyor..."
  );

  const combined = [
    ...existing,
    ...allFetchedMatches,
  ];

  let merged =
    mergeMatches(combined);

  // ==========================================================
  // SADECE 2026/27
  // ==========================================================

  merged = merged.filter(
    (match) => {
      const date =
        new Date(
          `${match.date}T12:00:00`
        );

      return isCurrentSeason(
        date
      );
    }
  );

  // ==========================================================
  // TARİHE GÖRE
  // ==========================================================

  merged.sort((a, b) => {
    const da =
      new Date(
        `${a.date}T12:00:00`
      ).getTime();

    const db =
      new Date(
        `${b.date}T12:00:00`
      ).getTime();

    if (da !== db) {
      return da - db;
    }

    return `${a.home} ${a.away}`.localeCompare(
      `${b.home} ${b.away}`,
      "tr"
    );
  });

  // ==========================================================
  // YENİ KAYIT SAYISI
  // ==========================================================

  const oldKeys =
    new Set(
      existing.map((m) =>
        [
          m.date,
          normalizeTeam(m.home),
          normalizeTeam(m.away),
        ].join("|")
      )
    );

  let newCount = 0;

  for (const match of merged) {
    const key = [
      match.date,
      normalizeTeam(match.home),
      normalizeTeam(match.away),
    ].join("|");

    if (!oldKeys.has(key)) {
      newCount++;
    }
  }

  // ==========================================================
  // LİGLER
  // ==========================================================

  const leagueSet =
    new Set(
      merged.map(
        (m) => m.league
      )
    );

  const dateSet =
    new Set(
      merged.map(
        (m) => m.date
      )
    );

  // ==========================================================
  // KAYDET
  // ==========================================================

  const output = {
    source: SITE,
    season: "2026-2027",
    updatedAt:
      new Date().toISOString(),
    matches: merged,
  };

  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  // ==========================================================
  // ÖZET
  // ==========================================================

  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "✅ OFSAYT BASKETBOL GEÇMİŞİ TAMAMLANDI"
  );
  console.log(
    "=============================================="
  );

  console.log(
    `🆕 Bu çalışmada bulunan: ${newCount}`
  );

  console.log(
    `📦 Toplam benzersiz maç: ${merged.length}`
  );

  console.log(
    `👥 Taranan takım: ${discoveredTeams.size}`
  );

  console.log(
    `🏆 Lig etiketi: ${leagueSet.size}`
  );

  console.log(
    `📅 Tarih sayısı: ${dateSet.size}`
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
    "❌ OFSAYT BASKETBOL GÜNCELLEME HATASI"
  );
  console.error(error);
  process.exit(1);
});
