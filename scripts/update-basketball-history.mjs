import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_URL = "https://arsiv.mackolik.com";

const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "basketball-history.json"
);

const BASKETBALL_URL = `${BASE_URL}/Basketbol/Canli-Sonuclar`;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";


// ============================================================
// YARDIMCI FONKSİYONLAR
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

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
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
        setTimeout(resolve, 1200 * attempt)
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
    console.log(
      "⚠️ basketball-history.json okunamadı:",
      error.message
    );

    return [];
  }
}


// ============================================================
// LİG ID TOPLAMA
// ============================================================

function addLeague(map, id, name = "") {
  if (!id) return;

  id = String(id).trim();

  if (!/^\d+$/.test(id)) {
    return;
  }

  name = normalizeText(name);

  if (!map.has(id)) {
    map.set(id, {
      id,
      name: name || `Basketbol ${id}`
    });
  } else {
    const current = map.get(id);

    if (
      current.name.startsWith("Basketbol ") &&
      name
    ) {
      current.name = name;
    }
  }
}

function collectIdsFromText(text, leagues) {
  if (!text) return;

  const patterns = [
    /Basketball\/Standing\/Default\.aspx\?[^"'<> ]*?(?:id|sId)=(\d+)/gi,

    /Basketball\/Cups\/Default\.aspx\?[^"'<> ]*?(?:id|sId)=(\d+)/gi,

    /Basketbol\/Standing\/Default\.aspx\?[^"'<> ]*?(?:id|sId)=(\d+)/gi,

    /Basketbol\/Cups\/Default\.aspx\?[^"'<> ]*?(?:id|sId)=(\d+)/gi
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(text)) !== null) {
      addLeague(leagues, match[1]);
    }
  }
}

function parseLeagueIds(html) {
  const $ = cheerio.load(html);

  const leagues = new Map();

  // ----------------------------------------------------------
  // HREF
  // ----------------------------------------------------------

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    const text = normalizeText($(element).text());

    const patterns = [
      /Basketball\/Standing\/Default\.aspx\?[^#]*?(?:id|sId)=(\d+)/i,
      /Basketball\/Cups\/Default\.aspx\?[^#]*?(?:id|sId)=(\d+)/i,
      /Basketbol\/Standing\/Default\.aspx\?[^#]*?(?:id|sId)=(\d+)/i,
      /Basketbol\/Cups\/Default\.aspx\?[^#]*?(?:id|sId)=(\d+)/i
    ];

    for (const regex of patterns) {
      const match = href.match(regex);

      if (match) {
        addLeague(
          leagues,
          match[1],
          text
        );

        break;
      }
    }
  });


  // ----------------------------------------------------------
  // RAW HTML
  // ----------------------------------------------------------

  collectIdsFromText(
    html,
    leagues
  );


  // ----------------------------------------------------------
  // DATA ATTRIBUTE
  // ----------------------------------------------------------

  $("[data-id], [data-sid], [data-league-id]").each(
    (_, element) => {
      const id =
        $(element).attr("data-id") ||
        $(element).attr("data-sid") ||
        $(element).attr("data-league-id");

      const name = normalizeText(
        $(element).text()
      );

      addLeague(
        leagues,
        id,
        name
      );
    }
  );


  // ----------------------------------------------------------
  // ONCLICK
  // ----------------------------------------------------------

  $("[onclick]").each((_, element) => {
    const onclick =
      $(element).attr("onclick") || "";

    const text =
      normalizeText($(element).text());

    const patterns = [
      /(?:id|sId|leagueId|league_id)\s*[=:]\s*['"]?(\d+)/i,
      /Standing[^0-9]{0,100}(\d+)/i,
      /Cups[^0-9]{0,100}(\d+)/i
    ];

    for (const regex of patterns) {
      const match = onclick.match(regex);

      if (match) {
        addLeague(
          leagues,
          match[1],
          text
        );

        break;
      }
    }
  });

  return [...leagues.values()];
}


// ============================================================
// MAÇ PARSER
// ============================================================

function parseMatchesFromPage(html, league) {
  const $ = cheerio.load(html);

  const matches = [];

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

    const rowText =
      normalizeText(cells.join(" | "));


    // --------------------------------------------------------
    // TARİH
    // --------------------------------------------------------

    const dateMatch =
      rowText.match(
        /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
      );

    if (!dateMatch) {
      return;
    }

    const date =
      parseDate(dateMatch[1]);

    if (!date) {
      return;
    }


    // --------------------------------------------------------
    // SKOR
    // --------------------------------------------------------

    const scoreMatch =
      rowText.match(
        /\b(\d{1,3})\s*-\s*(\d{1,3})\b/
      );

    if (!scoreMatch) {
      return;
    }

    const homeScore =
      Number(scoreMatch[1]);

    const awayScore =
      Number(scoreMatch[2]);


    // --------------------------------------------------------
    // SKOR HÜCRESİ
    // --------------------------------------------------------

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

    if (scoreIndex === -1) {
      return;
    }


    // --------------------------------------------------------
    // TAKIMLAR
    // --------------------------------------------------------

    let home = "";
    let away = "";

    if (
      scoreIndex > 0 &&
      scoreIndex + 1 < cells.length
    ) {
      home =
        cells[scoreIndex - 1];

      away =
        cells[scoreIndex + 1];
    }


    // --------------------------------------------------------
    // ALTERNATİF TAKIM BULMA
    // --------------------------------------------------------

    if (
      !home ||
      !away ||
      /^(MS|UZ|ERT|İPT)$/i.test(home) ||
      /^(MS|UZ|ERT|İPT)$/i.test(away)
    ) {
      const candidates =
        cells.filter(cell => {
          if (!cell) return false;

          if (
            /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(
              cell
            )
          ) {
            return false;
          }

          if (
            /^(MS|UZ|ERT|İPT|CANLI)$/i.test(
              cell
            )
          ) {
            return false;
          }

          if (
            /^\d{1,3}\s*-\s*\d{1,3}$/.test(
              cell
            )
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


    if (!home || !away) {
      return;
    }


    // --------------------------------------------------------
    // HATALI SATIRLAR
    // --------------------------------------------------------

    if (
      /^(MS|UZ|ERT|İPT|CANLI)$/i.test(home) ||
      /^(MS|UZ|ERT|İPT|CANLI)$/i.test(away)
    ) {
      return;
    }

    if (
      home.length < 2 ||
      away.length < 2
    ) {
      return;
    }


    // --------------------------------------------------------
    // İLK YARI SKORU
    // --------------------------------------------------------

    let halfHomeScore = null;
    let halfAwayScore = null;

    const halfMatches =
      rowText.match(
        /\b(\d{1,3})\s*-\s*(\d{1,3})\b/g
      );

    if (
      halfMatches &&
      halfMatches.length >= 2
    ) {
      const first =
        halfMatches[0].match(
          /(\d+)\s*-\s*(\d+)/
        );

      const second =
        halfMatches[1].match(
          /(\d+)\s*-\s*(\d+)/
        );

      if (first && second) {
        const a = Number(first[1]);
        const b = Number(first[2]);

        const c = Number(second[1]);
        const d = Number(second[2]);

        // Son skor kesin olarak ikinci skor ise
        // ilk skorun ilk yarı olma ihtimalini kontrol et.
        if (
          c === homeScore &&
          d === awayScore
        ) {
          halfHomeScore = a;
          halfAwayScore = b;
        }
      }
    }


    // --------------------------------------------------------
    // KAYIT
    // --------------------------------------------------------

    const match = {
      id: makeId(
        date,
        home,
        away
      ),

      date,

      time: "",

      home,

      away,

      homeScore,

      awayScore,

      halfHomeScore,

      halfAwayScore,

      total:
        homeScore +
        awayScore,

      league:
        league?.name ||
        "Bilinmeyen",

      leagueId:
        league?.id ||
        null,

      source:
        "mackolik"
    };

    matches.push(match);
  });


  // ----------------------------------------------------------
  // TEKİLLEŞTİR
  // ----------------------------------------------------------

  const unique =
    new Map();

  for (const match of matches) {
    unique.set(
      match.id,
      match
    );
  }

  return [...unique.values()];
}


// ============================================================
// TEK LİG
// ============================================================

async function fetchLeague(
  league,
  index,
  total
) {
  console.log(
    `\n[${index}/${total}] ${league.name} (${league.id})`
  );

  const urls = [
    `${BASE_URL}/Basketball/Standing/Default.aspx?id=${league.id}`,
    `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${league.id}`,
    `${BASE_URL}/Basketball/Cups/Default.aspx?id=${league.id}`,
    `${BASE_URL}/Basketball/Cups/Default.aspx?sId=${league.id}`
  ];

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

      if (
        matches.length > 0
      ) {
        console.log(
          `   → ${matches.length} maç`
        );

        // Aynı ID'nin Cups/Standing
        // varyasyonlarını gereksiz yere
        // çağırma.
        break;
      }
    } catch (error) {
      console.log(
        `   ⚠️ ${url} → ${error.message}`
      );
    }
  }

  if (
    bestMatches.length === 0
  ) {
    console.log(
      "   → 0 maç"
    );
  }

  return bestMatches;
}


// ============================================================
// TEMİZLE / BİRLEŞTİR
// ============================================================

function cleanMatches(matches) {
  const map =
    new Map();

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

    map.set(
      id,
      {
        ...match,
        id,

        homeScore:
          Number(match.homeScore),

        awayScore:
          Number(match.awayScore),

        total:
          Number(match.homeScore) +
          Number(match.awayScore)
      }
    );
  }

  return [...map.values()]
    .sort((a, b) => {
      if (
        a.date !== b.date
      ) {
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
    });
}


// ============================================================
// MAIN
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
    "📅 Geçmiş sınırı: YOK"
  );
  console.log(
    "📚 Bulunabilen tüm geçmiş veriler alınacak."
  );
  console.log("");

  const oldMatches =
    readHistory();

  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );


  // ----------------------------------------------------------
  // ANA SAYFA
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // LİG ID
  // ----------------------------------------------------------

  const leagues =
    parseLeagueIds(
      basketballHtml
    );

  console.log(
    `🏆 Ana sayfadan bulunan lig: ${leagues.length}`
  );


  // ----------------------------------------------------------
  // MEVCUT DATA İÇİNDEKİ ESKİ LİG ID'LERİ DE EKLE
  // ----------------------------------------------------------

  const leagueMap =
    new Map();

  for (const league of leagues) {
    leagueMap.set(
      league.id,
      league
    );
  }

  for (const match of oldMatches) {
    if (
      match?.leagueId
    ) {
      addLeague(
        leagueMap,
        match.leagueId,
        match.league
      );
    }
  }


  // ----------------------------------------------------------
  // BİLİNEN GÜNCEL ID'LER
  // ----------------------------------------------------------
  //
  // Bunlar sadece başlangıç noktası.
  // Sabit 60 günlük sınır YOK.
  //
  // Mackolik'te farklı sezon/tur sayfaları
  // farklı ID kullanabildiği için mevcut
  // kayıtların ID'leri de korunuyor.
  // ----------------------------------------------------------

  const knownLeagues = [
    ["Türkiye Sigorta Basketbol Süper Ligi", "1"],
    ["Türkiye Sigorta TBL", "300"],
    ["EuroLeague", "8"],
    ["Türkiye Cumhurbaşkanlığı Kupası", "23"],
    ["Şampiyonlar Ligi", "1629"],
    ["Kıtalararası Kupası", "10809"]
  ];

  for (
    const [name, id]
    of knownLeagues
  ) {
    addLeague(
      leagueMap,
      id,
      name
    );
  }


  const finalLeagues =
    [...leagueMap.values()];

  console.log(
    `🏆 Taranacak toplam lig: ${finalLeagues.length}`
  );


  // ----------------------------------------------------------
  // LİGLER
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "🔎 Basketbol lig geçmişleri taranıyor..."
  );

  const newMatches = [];

  for (
    let i = 0;
    i < finalLeagues.length;
    i++
  ) {
    const matches =
      await fetchLeague(
        finalLeagues[i],
        i + 1,
        finalLeagues.length
      );

    newMatches.push(
      ...matches
    );

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          250
        )
    );
  }


  // ----------------------------------------------------------
  // BİRLEŞTİR
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // İSTATİSTİK
  // ----------------------------------------------------------

  const leagueNames =
    new Set(
      cleaned
        .map(
          match =>
            match.league
        )
        .filter(Boolean)
    );

  const dates =
    new Set(
      cleaned
        .map(
          match =>
            match.date
        )
        .filter(Boolean)
    );


  // ----------------------------------------------------------
  // JSON
  // ----------------------------------------------------------

  const output = {
    source:
      BASKETBALL_URL,

    updatedAt:
      new Date().toISOString(),

    historyDays:
      null,

    historyLimit:
      "none",

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
    path.dirname(
      DATA_PATH
    ),
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


  // ----------------------------------------------------------
  // SONUÇ
  // ----------------------------------------------------------

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
