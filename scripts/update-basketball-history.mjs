import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_URL = "https://arsiv.mackolik.com";

const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "basketball-history.json"
);

const BASKETBALL_URL =
  `${BASE_URL}/Basketball/Default.aspx`;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";

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

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return (
    `${year}-` +
    `${String(month).padStart(2, "0")}-` +
    `${String(day).padStart(2, "0")}`
  );
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

async function fetchHtml(url) {
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
    throw error;
  }
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

    if (Array.isArray(json.matches)) {
      return json.matches;
    }

    return [];

  } catch (error) {
    console.log(
      "⚠️ basketball-history.json okunamadı:",
      error.message
    );

    return [];
  }
}

/* =========================================================
   SADECE GÜNCEL SEZON LİGLERİ
========================================================= */

function addLeague(map, id, name = "", type = "standing") {
  if (!id) return;

  id = String(id).trim();

  if (!/^\d+$/.test(id)) return;

  name = normalizeText(name);

  const key = `${type}:${id}`;

  if (!map.has(key)) {
    map.set(key, {
      id,
      name: name || `Basketbol ${id}`,
      type
    });
  } else {
    const current = map.get(key);

    if (
      current.name.startsWith("Basketbol ") &&
      name
    ) {
      current.name = name;
    }
  }
}

/*
  SADECE açıkça mevcut sezon sayfalarında bulunan
  bağlantıları yakalıyoruz.

  Eski sezon ID'lerini manuel olarak eklemiyoruz.
*/

function discoverCurrentSeasonLeagues(html) {
  const $ = cheerio.load(html);
  const leagues = new Map();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    const text = normalizeText($(element).text());

    let match;

    /*
      Standing
    */

    match = href.match(
      /\/Basketball\/Standing\/Default\.aspx\?[^#]*?\bid=(\d+)/i
    );

    if (match) {
      addLeague(
        leagues,
        match[1],
        text,
        "standing-id"
      );
      return;
    }

    match = href.match(
      /\/Basketball\/Standing\/Default\.aspx\?[^#]*?\bsId=(\d+)/i
    );

    if (match) {
      addLeague(
        leagues,
        match[1],
        text,
        "standing-sid"
      );
      return;
    }

    /*
      Cups
    */

    match = href.match(
      /\/Basketball\/Cups\/Default\.aspx\?[^#]*?\bid=(\d+)/i
    );

    if (match) {
      addLeague(
        leagues,
        match[1],
        text,
        "cup-id"
      );
      return;
    }

    match = href.match(
      /\/Basketball\/Cups\/Default\.aspx\?[^#]*?\bsId=(\d+)/i
    );

    if (match) {
      addLeague(
        leagues,
        match[1],
        text,
        "cup-sid"
      );
    }
  });

  return [...leagues.values()];
}

/* =========================================================
   BİLİNEN GÜNCEL SEZON LİGLERİ
========================================================= */

/*
  Bunlar mevcut sezon için bildiğimiz güncel sayfalar.

  ESKİ SEZON ID'LERİ BURADA YOK.
*/

function getKnownCurrentSeasonLeagues() {
  return [
    {
      id: "1",
      name: "Türkiye Basketbol",
      type: "standing-id"
    },
    {
      id: "300",
      name: "Türkiye Sigorta TBL",
      type: "standing-id"
    },
    {
      id: "8",
      name: "EuroLeague",
      type: "cup-id"
    },
    {
      id: "23",
      name: "Türkiye Cumhurbaşkanlığı Kupası",
      type: "cup-id"
    },
    {
      id: "1629",
      name: "Şampiyonlar Ligi",
      type: "cup-id"
    },
    {
      id: "10809",
      name: "Kıtalararası Kupası",
      type: "cup-id"
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

    const rowText = normalizeText(
      cells.join(" | ")
    );

    /*
      Tarih
    */

    const dateMatch = rowText.match(
      /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
    );

    if (!dateMatch) return;

    const date = parseDate(dateMatch[1]);

    if (!date) return;

    /*
      Skor
    */

    const scoreMatches =
      rowText.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\b/g);

    if (!scoreMatches || scoreMatches.length === 0) {
      return;
    }

    let finalScore = null;

    /*
      Genellikle son skor MS skorudur.
    */

    for (let i = scoreMatches.length - 1; i >= 0; i--) {
      const m = scoreMatches[i].match(
        /(\d+)\s*-\s*(\d+)/
      );

      if (!m) continue;

      const a = Number(m[1]);
      const b = Number(m[2]);

      /*
        Basketbolda geçerli skor.
      */

      if (
        a >= 0 &&
        b >= 0 &&
        a <= 250 &&
        b <= 250
      ) {
        finalScore = {
          home: a,
          away: b
        };
        break;
      }
    }

    if (!finalScore) return;

    const homeScore = finalScore.home;
    const awayScore = finalScore.away;

    /*
      Skorun bulunduğu hücre
    */

    let scoreIndex = -1;

    for (let i = 0; i < cells.length; i++) {
      if (
        /\b\d{1,3}\s*-\s*\d{1,3}\b/.test(
          cells[i]
        )
      ) {
        scoreIndex = i;
        break;
      }
    }

    if (scoreIndex === -1) return;

    let home = "";
    let away = "";

    /*
      En sık görülen yapı:

      Tarih | Ev Sahibi | Skor | Deplasman
    */

    if (
      scoreIndex > 0 &&
      scoreIndex + 1 < cells.length
    ) {
      home = cells[scoreIndex - 1];
      away = cells[scoreIndex + 1];
    }

    /*
      Alternatif yapı
    */

    if (!home || !away) {
      const candidates = cells.filter(cell => {
        if (!cell) return false;

        if (
          /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/
            .test(cell)
        ) {
          return false;
        }

        if (
          /^(MS|UZ|ERT|İPT|CANLI)$/i.test(cell)
        ) {
          return false;
        }

        if (
          /^\d{1,3}\s*-\s*\d{1,3}$/.test(cell)
        ) {
          return false;
        }

        return cell.length >= 2;
      });

      if (candidates.length >= 2) {
        home =
          candidates[candidates.length - 2];

        away =
          candidates[candidates.length - 1];
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
      İY skorunu bulmaya çalış.
    */

    let halfHomeScore = null;
    let halfAwayScore = null;

    if (scoreMatches.length >= 2) {
      for (
        let i = 0;
        i < scoreMatches.length - 1;
        i++
      ) {
        const first =
          scoreMatches[i].match(
            /(\d+)\s*-\s*(\d+)/
          );

        if (!first) continue;

        const firstHome = Number(first[1]);
        const firstAway = Number(first[2]);

        if (
          firstHome > 150 ||
          firstAway > 150
        ) {
          continue;
        }

        halfHomeScore = firstHome;
        halfAwayScore = firstAway;

        break;
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

      total:
        homeScore + awayScore,

      league:
        league.name ||
        "Bilinmeyen",

      leagueId:
        league.id || null,

      source:
        "mackolik"
    });
  });

  /*
    Aynı sayfadaki tekrarları temizle.
  */

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
  console.log(
    `\n[${index}/${total}] ` +
    `${league.name} (${league.id})`
  );

  const urls = [];

  if (league.type === "standing-id") {
    urls.push(
      `${BASE_URL}/Basketball/Standing/Default.aspx?id=${league.id}`
    );
  }

  if (league.type === "standing-sid") {
    urls.push(
      `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${league.id}`
    );
  }

  if (league.type === "cup-id") {
    urls.push(
      `${BASE_URL}/Basketball/Cups/Default.aspx?id=${league.id}`
    );
  }

  if (league.type === "cup-sid") {
    urls.push(
      `${BASE_URL}/Basketball/Cups/Default.aspx?sId=${league.id}`
    );
  }

  let bestMatches = [];

  for (const url of urls) {
    try {
      const html =
        await fetchHtml(url);

      const matches =
        parseMatchesFromPage(
          html,
          league
        );

      if (
        matches.length >
        bestMatches.length
      ) {
        bestMatches = matches;
      }

      if (matches.length > 0) {
        console.log(
          `   → ${matches.length} maç`
        );
        break;
      }

    } catch (error) {
      console.log(
        `   ⚠️ HTTP hata: ${error.message}`
      );
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
    if (!match) continue;

    if (
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    if (
      !Number.isFinite(
        Number(match.homeScore)
      ) ||
      !Number.isFinite(
        Number(match.awayScore)
      )
    ) {
      continue;
    }

    const id =
      match.id ||
      makeId(
        match.date,
        match.home,
        match.away
      );

    map.set(id, {
      ...match,

      id,

      homeScore:
        Number(match.homeScore),

      awayScore:
        Number(match.awayScore),

      total:
        Number(match.homeScore) +
        Number(match.awayScore)
    });
  }

  return [...map.values()].sort(
    (a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(
          b.date
        );
      }

      return (
        normalizeTeam(a.home) +
        normalizeTeam(a.away)
      ).localeCompare(
        normalizeTeam(b.home) +
        normalizeTeam(b.away)
      );
    }
  );
}

/* =========================================================
   MAIN
========================================================= */

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
    "📅 Sezon: SADECE MEVCUT SEZON"
  );
  console.log(
    "📚 Tarih sınırı: YOK"
  );
  console.log(
    "🚫 Eski sezonlar: KAPALI"
  );
  console.log("");

  /*
    Eski kayıtları koru.
  */

  const oldMatches =
    readHistory();

  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );

  /*
    Ana basketbol sayfası
  */

  console.log("");
  console.log(
    "🏀 Mackolik basketbol sayfası alınıyor..."
  );

  let basketballHtml;

  try {
    basketballHtml =
      await fetchHtml(
        BASKETBALL_URL
      );

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

  /*
    Ana sayfadan güncel sezon liglerini
    bulmayı dene.
  */

  const discovered =
    discoverCurrentSeasonLeagues(
      basketballHtml
    );

  console.log(
    `🏆 Ana sayfadan bulunan güncel lig: ${discovered.length}`
  );

  /*
    Sadece bilinen güncel sezon liglerini
    ekle.
  */

  const leagueMap =
    new Map();

  for (const league of discovered) {
    leagueMap.set(
      `${league.type}:${league.id}`,
      league
    );
  }

  /*
    Güncel sezon bilinen ligleri
    ekle.
  */

  for (
    const league of
    getKnownCurrentSeasonLeagues()
  ) {
    leagueMap.set(
      `${league.type}:${league.id}`,
      league
    );
  }

  const leagues =
    [...leagueMap.values()];

  console.log(
    `🏆 Taranacak güncel sezon ligleri: ${leagues.length}`
  );

  console.log("");

  /*
    Ligleri tara
  */

  const newMatches = [];

  for (
    let i = 0;
    i < leagues.length;
    i++
  ) {
    const matches =
      await fetchLeague(
        leagues[i],
        i + 1,
        leagues.length
      );

    newMatches.push(
      ...matches
    );

    /*
      Mackolik'i gereksiz
      zorlamamak için küçük bekleme.
    */

    await new Promise(
      resolve =>
        setTimeout(resolve, 200)
    );
  }

  /*
    Birleştir
  */

  console.log("");
  console.log(
    "🔄 Veriler birleştiriliyor..."
  );

  const merged = [
    ...oldMatches,
    ...newMatches
  ];

  const cleaned =
    cleanMatches(
      merged
    );

  /*
    İstatistik
  */

  const leagueNames =
    new Set(
      cleaned
        .map(
          match => match.league
        )
        .filter(Boolean)
    );

  const dates =
    new Set(
      cleaned
        .map(
          match => match.date
        )
        .filter(Boolean)
    );

  /*
    Çıktı
  */

  const output = {
    source:
      BASKETBALL_URL,

    updatedAt:
      new Date().toISOString(),

    season:
      "2026-2027",

    historyDays:
      null,

    historyLimit:
      "none",

    oldSeasons:
      false,

    leagueCount:
      leagueNames.size,

    dateCount:
      dates.size,

    matchCount:
      cleaned.length,

    matches:
      cleaned
  };

  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );

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
    Sonuç
  */

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
    `🆕 Yeni bulunan maç: ${newMatches.length}`
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
    "📚 Sezon: 2026-2027"
  );

  console.log(
    "🚫 Eski sezonlar: alınmadı"
  );

  console.log(
    `💾 Dosya: ${DATA_PATH}`
  );

  console.log("");
}

main().catch(error => {
  console.error("");
  console.error(
    "❌ KRİTİK HATA"
  );
  console.error(error);
  process.exit(1);
});
