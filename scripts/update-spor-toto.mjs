/**
 * Spor Toto veri güncelleme
 *
 * Görev:
 * - Spor Toto'nun güncel haftasını bulur.
 * - 15 maçlık programı alır.
 * - Önceki haftaları korur.
 * - Güncel haftanın sonuçlarını günceller.
 * - Sonuç belli değilse null bırakır.
 * - data/spor-toto-data.js dosyasını üretir.
 *
 * GitHub Actions:
 * node scripts/update-spor-toto.mjs
 */
import fs from "node:fs";
import path from "node:path";
const DATA_PATH = path.resolve("data/spor-toto-data.js");
const SOURCES = [
  "https://totokazan.com/spor-toto",
  "https://www.totokazan.com/spor-toto"
];
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache"
};
function log(...args) {
  console.log("[SPOR-TOTO]", ...args);
}
function normalizeText(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&uuml;/gi, "ü")
    .replace(/&Uuml;/gi, "Ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&Ouml;/gi, "Ö")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/gi, "Ç")
    .replace(/&scedil;/gi, "ş")
    .replace(/&Scedil;/gi, "Ş")
    .replace(/&iacute;/gi, "í")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&igrave;/gi, "ì")
    .replace(/&Igrave;/gi, "Ì")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCharCode(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}
function cleanTeamName(value) {
  return normalizeText(value)
    .replace(/^\d+\s*[\.\-\)]\s*/, "")
    .replace(/^\s*[\-\–—]\s*/, "")
    .trim();
}
function normalizeResult(value) {
  const v = normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, "");
  if (v === "1") return "1";
  if (v === "X" || v === "0") return "X";
  if (v === "2") return "2";
  return null;
}
function extractCells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map(m => cleanTeamName(m[1]));
}
function looksLikeTeam(value) {
  if (!value) return false;
  const v = cleanTeamName(value);
  if (v.length < 2) return false;
  if (/^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15)$/.test(v)) return false;
  if (/^(x|1x|x2|12)$/i.test(v)) return false;
  if (/^\d{1,2}:\d{1,2}$/.test(v)) return false;
  return /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v);
}
function parseRow(rowHtml) {
  const cells = extractCells(rowHtml);
  if (!cells.length) return null;
  let number = null;
  let home = null;
  let away = null;
  let result = null;
  /*
   * Tipik tablo:
   * No | Ev Sahibi | Skor | Deplasman | Sonuç
   */
  const first = cells[0];
  if (/^\d{1,2}$/.test(first)) {
    number = Number(first);
  }
  /*
   * Önce doğrudan 15 satırlık klasik yapıyı deniyoruz.
   */
  if (cells.length >= 4) {
    const possibleHome = cells[1];
    const possibleAway = cells[3];
    if (looksLikeTeam(possibleHome) && looksLikeTeam(possibleAway)) {
      home = possibleHome;
      away = possibleAway;
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
   * No | Ev Sahibi | Deplasman | Sonuç
   */
  if (!home || !away) {
    const teamCells = cells.filter(looksLikeTeam);
    if (teamCells.length >= 2) {
      home = teamCells[0];
      away = teamCells[1];
      for (let i = 2; i < cells.length; i++) {
        const r = normalizeResult(cells[i]);
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
    no: number,
    home: cleanTeamName(home),
    away: cleanTeamName(away),
    result
  };
}
function extractRows(html) {
  const rows = [];
  const rowMatches = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const match of rowMatches) {
    const row = parseRow(match[1]);
    if (!row) continue;
    rows.push(row);
  }
  return rows;
}
function findSeasonWeek(html) {
  const text = normalizeText(html);
  let season = null;
  let week = null;
  const seasonPatterns = [
    /20\d{2}\s*[-\/]\s*20\d{2}/,
    /20\d{2}\s*-\s*20\d{2}/
  ];
  for (const pattern of seasonPatterns) {
    const m = text.match(pattern);
    if (m) {
      season = m[0]
        .replace(/\s+/g, "")
        .replace("/", "-");
      break;
    }
  }
  const weekPatterns = [
    /(\d{1,2})\s*\.?\s*hafta/i,
    /hafta\s*(\d{1,2})/i
  ];
  for (const pattern of weekPatterns) {
    const m = text.match(pattern);
    if (m) {
      week = Number(m[1]);
      break;
    }
  }
  return {
    season,
    week
  };
}
function extractWeekFromUrl(url) {
  const match = url.match(/20\d{2}-20\d{2}-(\d{1,2})-hafta/i);
  if (match) {
    return Number(match[1]);
  }
  return null;
}
function extractSeasonFromUrl(url) {
  const match = url.match(/(20\d{2}-20\d{2})/);
  return match ? match[1] : null;
}
async function fetchHtml(url) {
  log("Kaynak deneniyor:", url);
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${url}`);
  }
  const html = await response.text();
  if (!html || html.length < 500) {
    throw new Error("Sayfa içeriği boş veya çok kısa.");
  }
  return {
    html,
    finalUrl: response.url || url
  };
}
function findBestRows(html) {
  const allRows = extractRows(html);
  /*
   * Spor Toto listesi tam olarak 15 maç olmalı.
   *
   * Birden fazla tablo varsa 15 veya daha fazla
   * takım çifti bulunan bölümü seçiyoruz.
   */
  if (allRows.length === 15) {
    return allRows;
  }
  if (allRows.length > 15) {
    const exact15 = allRows.filter(row => row.home && row.away);
    if (exact15.length >= 15) {
      return exact15.slice(0, 15);
    }
  }
  /*
   * No numarası 1-15 olanları tercih et.
   */
  const numbered = allRows
    .filter(row => row.no >= 1 && row.no <= 15)
    .sort((a, b) => a.no - b.no);
  if (numbered.length >= 15) {
    return numbered.slice(0, 15);
  }
  return allRows.slice(0, 15);
}
function validateMatches(matches) {
  if (!Array.isArray(matches)) {
    throw new Error("Maç listesi dizi değil.");
  }
  if (matches.length !== 15) {
    throw new Error(
      `Spor Toto listesi 15 maç olmalı. Bulunan: ${matches.length}`
    );
  }
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (!match.home || !match.away) {
      throw new Error(
        `${i + 1}. maçta takım adı eksik.`
      );
    }
  }
}
function readExistingData() {
  if (!fs.existsSync(DATA_PATH)) {
    log("Mevcut Spor Toto veri dosyası yok. Yeni dosya oluşturulacak.");
    return {
      season: "2026-2027",
      currentWeek: 1,
      weeks: {}
    };
  }
  const source = fs.readFileSync(DATA_PATH, "utf8");
  /*
   * window.SPORT_TOTO_DATA = {...};
   * içindeki JSON'u güvenli şekilde al.
   */
  const match = source.match(
    /window\.SPORT_TOTO_DATA\s*=\s*([\s\S]*?);\s*(?:window\.SPORT_TOTO_META|$)/
  );
  if (!match) {
    throw new Error(
      "Mevcut data/spor-toto-data.js içinde SPORT_TOTO_DATA bulunamadı."
    );
  }
  let jsonText = match[1].trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error(
      "Mevcut SPORT_TOTO_DATA JSON olarak okunamadı."
    );
  }
}
function mergeWeek(existingWeek, newMatches) {
  const oldMatches = Array.isArray(existingWeek?.matches)
    ? existingWeek.matches
    : [];
  return newMatches.map((newMatch, index) => {
    const oldMatch = oldMatches[index] || {};
    /*
     * Takım isimleri kaynaktan güncellenir.
     *
     * Sonuç:
     * - Yeni sonuç varsa kullanılır.
     * - Yeni sonuç yoksa eski sonuç korunur.
     */
    const result =
      newMatch.result ||
      oldMatch.result ||
      null;
    return {
      home: newMatch.home,
      away: newMatch.away,
      result
    };
  });
}
function createOutput(data) {
  const meta = {
    season: data.season,
    currentWeek: data.currentWeek,
    matchesPerWeek: 15,
    historyDays: 60,
    exactOdds: true,
    minimumSample: 5
  };
  return `window.SPORT_TOTO_DATA = ${JSON.stringify(data, null, 2)};
window.SPORT_TOTO_META = ${JSON.stringify(meta, null, 2)};
`;
}
async function main() {
  log("Spor Toto güncellemesi başladı.");
  let fetched = null;
  let lastError = null;
  for (const url of SOURCES) {
    try {
      fetched = await fetchHtml(url);
      break;
    } catch (error) {
      lastError = error;
      console.log(
        "[SPOR-TOTO] Kaynak başarısız:",
        error.message
      );
    }
  }
  if (!fetched) {
    throw new Error(
      `Spor Toto kaynağı alınamadı. Son hata: ${lastError?.message || "bilinmiyor"}`
    );
  }
  const html = fetched.html;
  const finalUrl = fetched.finalUrl;
  log("Kaynak:", finalUrl);
  log("HTML uzunluğu:", html.length);
  const detected = findSeasonWeek(html);
  let season =
    detected.season ||
    extractSeasonFromUrl(finalUrl) ||
    "2026-2027";
  let currentWeek =
    detected.week ||
    extractWeekFromUrl(finalUrl);
  /*
   * Ana sayfada hafta bilgisi bulunmazsa sezonun
   * haftalarını arıyoruz.
   */
  if (!currentWeek) {
    const weekLinks = [
      ...html.matchAll(
        /href=["']([^"']*20\d{2}-20\d{2}-(\d{1,2})-hafta[^"']*)["']/gi
      )
    ];
    if (weekLinks.length) {
      const weeks = weekLinks
        .map(m => Number(m[2]))
        .filter(Number.isFinite);
      if (weeks.length) {
        currentWeek = Math.max(...weeks);
      }
    }
  }
  if (!currentWeek) {
    throw new Error(
      "Güncel Spor Toto haftası tespit edilemedi."
    );
  }
  log("Sezon:", season);
  log("Hafta:", currentWeek);
  /*
   * Ana sayfadan 15 maç çıkar.
   */
  let matches = findBestRows(html);
  /*
   * Ana sayfadan 15 maç çıkmazsa doğrudan hafta URL'sini deniyoruz.
   */
  if (matches.length !== 15) {
    const weekUrl =
      `https://totokazan.com/spor-toto/${season}-${currentWeek}-hafta`;
    log(
      "Ana sayfadan 15 maç bulunamadı.",
      "Hafta sayfası deneniyor:",
      weekUrl
    );
    const weekPage = await fetchHtml(weekUrl);
    matches = findBestRows(weekPage.html);
    if (matches.length === 15) {
      log("Hafta sayfasından 15 maç bulundu.");
    }
  }
  validateMatches(matches);
  matches = matches.map((match, index) => ({
    home: cleanTeamName(match.home),
    away: cleanTeamName(match.away),
    result: normalizeResult(match.result),
    no: index + 1
  }));
  log("15 maç başarıyla alındı.");
  const data = readExistingData();
  if (!data.weeks || typeof data.weeks !== "object") {
    data.weeks = {};
  }
  data.season = season;
  data.currentWeek = currentWeek;
  const oldWeek = data.weeks[String(currentWeek)];
  const mergedMatches = mergeWeek(
    oldWeek,
    matches
  );
  data.weeks[String(currentWeek)] = {
    week: currentWeek,
    matches: mergedMatches
  };
  /*
   * Haftaları sayısal sıraya göre düzenle.
   */
  const sortedWeeks = {};
  Object.keys(data.weeks)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(week => {
      sortedWeeks[week] = data.weeks[week];
    });
  data.weeks = sortedWeeks;
  fs.mkdirSync(
    path.dirname(DATA_PATH),
    { recursive: true }
  );
  const output = createOutput(data);
  fs.writeFileSync(
    DATA_PATH,
    output,
    "utf8"
  );
  log("Dosya yazıldı:", DATA_PATH);
  log("Sezon:", data.season);
  log("Güncel hafta:", data.currentWeek);
  log(
    "Toplam kayıtlı hafta:",
    Object.keys(data.weeks).length
  );
  for (const [week, value] of Object.entries(data.weeks)) {
    const count = Array.isArray(value.matches)
      ? value.matches.length
      : 0;
    const completed = Array.isArray(value.matches)
      ? value.matches.filter(m => m.result).length
      : 0;
    log(
      `Hafta ${week}: ${count} maç / ${completed} sonuç`
    );
  }
  log("Spor Toto güncellemesi tamamlandı.");
}
main().catch(error => {
  console.error("");
  console.error("======================================");
  console.error("SPOR TOTO GÜNCELLEME HATASI");
  console.error("======================================");
  console.error(error);
  console.error("======================================");
  console.error("");
  process.exit(1);
});
