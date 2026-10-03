import fs from "node:fs";
import path from "node:path";
const DATA_PATH = path.resolve("data/spor-toto-data.js");
const SOURCES = [
  "https://totokazan.com/spor-toto"
];
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":
    "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache"
};
function log(...args) {
  console.log("[SPOR-TOTO]", ...args);
}
function cleanText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&Ouml;/gi, "Ö")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/gi, "Ç")
    .replace(/&scedil;/gi, "ş")
    .replace(/&Scedil;/gi, "Ş")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeResult(value) {
  const v = cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "");
  if (v === "1") return "1";
  if (v === "X" || v === "0") return "X";
  if (v === "2") return "2";
  return null;
}
function isTeamName(value) {
  const v = cleanText(value);
  if (!v) return false;
  if (v.length < 2) return false;
  if (/^\d+$/.test(v)) return false;
  if (/^(1|X|2|1X|X2|12)$/i.test(v)) return false;
  return /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v);
}
function getCells(rowHtml) {
  return [
    ...rowHtml.matchAll(
      /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
    )
  ].map(m => cleanText(m[1]));
}
function parseRow(rowHtml) {
  const cells = getCells(rowHtml);
  if (!cells.length) return null;
  let no = null;
  let home = null;
  let away = null;
  let result = null;
  if (/^\d{1,2}$/.test(cells[0])) {
    no = Number(cells[0]);
  }
  /*
   * Yaygın yapı:
   *
   * No | Ev Sahibi | Skor | Deplasman | Sonuç
   */
  if (cells.length >= 4) {
    const h = cells[1];
    const a = cells[3];
    if (isTeamName(h) && isTeamName(a)) {
      home = h;
      away = a;
      for (let i = 4; i < cells.length; i++) {
        const r = normalizeResult(cells[i]);
        if (r) {
          result = r;
          break;
        }
      }
    }
  }
  /*
   * Alternatif yapı:
   *
   * No | Ev Sahibi | Deplasman | Sonuç
   */
  if (!home || !away) {
    const teams = cells.filter(isTeamName);
    if (teams.length >= 2) {
      home = teams[0];
      away = teams[1];
      for (const cell of cells.slice(2)) {
        const r = normalizeResult(cell);
        if (r) {
          result = r;
          break;
        }
      }
    }
  }
  if (!home || !away) {
    return null;
  }
  return {
    no,
    home,
    away,
    result
  };
}
function extractRows(html) {
  const rows = [];
  const matches = html.matchAll(
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  );
  for (const match of matches) {
    const parsed = parseRow(match[1]);
    if (parsed) {
      rows.push(parsed);
    }
  }
  return rows;
}
function select15Matches(rows) {
  const numbered = rows
    .filter(
      row =>
        Number.isInteger(row.no) &&
        row.no >= 1 &&
        row.no <= 15
    )
    .sort((a, b) => a.no - b.no);
  if (numbered.length >= 15) {
    return numbered.slice(0, 15);
  }
  if (rows.length >= 15) {
    return rows.slice(0, 15);
  }
  return rows;
}
function findSeason(html) {
  const text = cleanText(html);
  const match = text.match(
    /20\d{2}\s*[-\/]\s*20\d{2}/
  );
  if (!match) {
    return "2026-2027";
  }
  return match[0]
    .replace(/\s+/g, "")
    .replace("/", "-");
}
function findWeek(html) {
  const text = cleanText(html);
  const patterns = [
    /(\d{1,2})\s*\.?\s*hafta/i,
    /hafta\s*(\d{1,2})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}
async function fetchSource(url) {
  log("Kaynak deneniyor:", url);
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }
  const html = await response.text();
  if (html.length < 500) {
    throw new Error(
      "Kaynak sayfası çok kısa."
    );
  }
  return {
    html,
    url: response.url || url
  };
}
/*
 * Mevcut data/spor-toto-data.js dosyasını
 * JSON.parse ile okumuyoruz.
 *
 * JavaScript dosyasındaki:
 *
 * window.SPORT_TOTO_DATA = {...}
 *
 * bölümünü VM ile çalıştırıp nesneyi alıyoruz.
 */
async function readExistingData() {
  if (!fs.existsSync(DATA_PATH)) {
    log(
      "Mevcut data/spor-toto-data.js bulunamadı. Yeni veri oluşturulacak."
    );
    return {
      season: "2026-2027",
      currentWeek: 1,
      weeks: {}
    };
  }
  try {
    const source = fs.readFileSync(
      DATA_PATH,
      "utf8"
    );
    const dataMatch = source.match(
      /window\.SPORT_TOTO_DATA\s*=\s*([\s\S]*?)(?:;\s*window\.SPORT_TOTO_META|;\s*$)/
    );
    if (!dataMatch) {
      throw new Error(
        "SPORT_TOTO_DATA bölümü bulunamadı."
      );
    }
    const objectText = dataMatch[1].trim();
    /*
     * Sadece JSON.parse kullanmak yerine
     * Function ile JavaScript nesnesini okuyoruz.
     *
     * Bu sayede dosyada JavaScript sözdizimi varsa
     * da bozulmaz.
     */
    const data = Function(
      `"use strict"; return (${objectText});`
    )();
    if (
      !data ||
      typeof data !== "object"
    ) {
      throw new Error(
        "SPORT_TOTO_DATA geçerli bir nesne değil."
      );
    }
    if (
      !data.weeks ||
      typeof data.weeks !== "object"
    ) {
      data.weeks = {};
    }
    return data;
  } catch (error) {
    throw new Error(
      `Mevcut data/spor-toto-data.js okunamadı: ${error.message}`
    );
  }
}
function mergeMatches(oldMatches, newMatches) {
  const old = Array.isArray(oldMatches)
    ? oldMatches
    : [];
  return newMatches.map(
    (match, index) => {
      const oldMatch = old[index] || {};
      /*
       * Yeni kaynak sonuç vermiyorsa
       * eski sonucu silme.
       */
      const result =
        match.result ||
        oldMatch.result ||
        null;
      return {
        home: match.home,
        away: match.away,
        result
      };
    }
  );
}
function buildFile(data) {
  const meta = {
    season: data.season,
    currentWeek: data.currentWeek,
    matchesPerWeek: 15,
    historyDays: 60,
    exactOdds: true,
    minimumSample: 5
  };
  return (
`window.SPORT_TOTO_DATA = ${JSON.stringify(
  data,
  null,
  2
)};
window.SPORT_TOTO_META = ${JSON.stringify(
  meta,
  null,
  2
)};
`
  );
}
async function main() {
  log(
    "Spor Toto güncellemesi başladı."
  );
  let page = null;
  let lastError = null;
  for (const url of SOURCES) {
    try {
      page = await fetchSource(url);
      break;
    } catch (error) {
      lastError = error;
      log(
        "Kaynak başarısız:",
        error.message
      );
    }
  }
  if (!page) {
    throw new Error(
      `Spor Toto kaynağı alınamadı: ${
        lastError?.message || "bilinmeyen hata"
      }`
    );
  }
  const html = page.html;
  log(
    "Kaynak:",
    page.url
  );
  log(
    "HTML uzunluğu:",
    html.length
  );
  const season = findSeason(html);
  const currentWeek = findWeek(html);
  log(
    "Sezon:",
    season
  );
  log(
    "Hafta:",
    currentWeek
  );
  if (!currentWeek) {
    throw new Error(
      "Güncel hafta bulunamadı."
    );
  }
  const rows = extractRows(html);
  const matches = select15Matches(rows);
  if (matches.length !== 15) {
    throw new Error(
      `15 maç bulunamadı. Bulunan: ${matches.length}`
    );
  }
  log(
    "15 maç başarıyla alındı."
  );
  /*
   * Mevcut dosyayı oku.
   */
  const data = await readExistingData();
  /*
   * Sezonu güncelle.
   */
  data.season = season;
  /*
   * Güncel haftayı ayarla.
   */
  data.currentWeek = currentWeek;
  if (
    !data.weeks ||
    typeof data.weeks !== "object"
  ) {
    data.weeks = {};
  }
  const weekKey = String(
    currentWeek
  );
  const oldWeek =
    data.weeks[weekKey] || {};
  const oldMatches =
    Array.isArray(oldWeek.matches)
      ? oldWeek.matches
      : [];
  const mergedMatches =
    mergeMatches(
      oldMatches,
      matches
    );
  /*
   * Haftayı kaydet.
   */
  data.weeks[weekKey] = {
    week: currentWeek,
    matches: mergedMatches
  };
  /*
   * Haftaları 1,2,3... şeklinde sırala.
   */
  const sortedWeeks = {};
  Object.keys(data.weeks)
    .sort(
      (a, b) =>
        Number(a) - Number(b)
    )
    .forEach(week => {
      sortedWeeks[week] =
        data.weeks[week];
    });
  data.weeks = sortedWeeks;
  /*
   * data klasörü yoksa oluştur.
   */
  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );
  /*
   * Dosyayı yaz.
   */
  fs.writeFileSync(
    DATA_PATH,
    buildFile(data),
    "utf8"
  );
  log(
    "Dosya başarıyla yazıldı:",
    DATA_PATH
  );
  log(
    "Sezon:",
    data.season
  );
  log(
    "Güncel hafta:",
    data.currentWeek
  );
  log(
    "Kayıtlı hafta sayısı:",
    Object.keys(data.weeks).length
  );
  for (
    const [week, value]
    of Object.entries(data.weeks)
  ) {
    const list =
      Array.isArray(value.matches)
        ? value.matches
        : [];
    const completed =
      list.filter(
        match => !!match.result
      ).length;
    log(
      `Hafta ${week}: ${list.length} maç / ${completed} sonuç`
    );
  }
  log(
    "Spor Toto güncellemesi tamamlandı."
  );
}
main().catch(error => {
  console.error("");
  console.error(
    "======================================"
  );
  console.error(
    "SPOR TOTO GÜNCELLEME HATASI"
  );
  console.error(
    "======================================"
  );
  console.error(
    error
  );
  console.error(
    "======================================"
  );
  console.error("");
  process.exit(1);
});
