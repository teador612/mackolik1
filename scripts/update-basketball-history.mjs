import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
const BASE_URL = "https://arsiv.mackolik.com";
const DATA_PATH = path.join(
  process.cwd(),
  "data",
  "basketball-history.json"
);
const DAYS_BACK = 60;
// Basketbol programı
const PROGRAM_URL =
  `${BASE_URL}/Program/Program.aspx?st=2`;
// Mackolik basketbol sonuçlarında kullanılan olası sayfalar
const RESULT_URLS = [
  `${BASE_URL}/Program/Program.aspx?st=2`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=1`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=2`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=3`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=4`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=5`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=6`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=7`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=8`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=9`,
  `${BASE_URL}/Program/Program.aspx?st=2&dt=10`
];
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
};
/* =========================================================
   YARDIMCILAR
========================================================= */
function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeTeam(value) {
  return normalizeText(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[()]/g, "")
    .replace(/[.,'’"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function parseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const n = Number(
    String(value)
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );
  return Number.isFinite(n) ? n : null;
}
function parseDate(value) {
  const text = normalizeText(value);
  const m = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );
  if (!m) {
    return null;
  }
  return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(
    m[1]
  ).padStart(2, "0")}`;
}
function getCutoffDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - DAYS_BACK);
  return d;
}
function isWithinHistory(date) {
  if (!date) {
    return false;
  }
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return d >= getCutoffDate();
}
function makeId(date, home, away, time = "") {
  return [
    date,
    time || "",
    normalizeTeam(home),
    normalizeTeam(away)
  ].join("_");
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
/* =========================================================
   DOSYA
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
      "⚠️ Eski basketbol geçmişi okunamadı:",
      error.message
    );
    return [];
  }
}
/* =========================================================
   HTML AL
========================================================= */
async function fetchHtml(url) {
  try {
    const response = await fetch(url, {
      headers: HEADERS
    });
    if (!response.ok) {
      console.log(
        `⚠️ HTTP ${response.status}: ${url}`
      );
      return "";
    }
    return await response.text();
  } catch (error) {
    console.log(
      `⚠️ Sayfa alınamadı: ${url}`,
      error.message
    );
    return "";
  }
}
/* =========================================================
   SKOR BUL
========================================================= */
function extractScores(text) {
  const matches = [
    ...text.matchAll(
      /(\d{1,3})\s*[-:]\s*(\d{1,3})/g
    )
  ];
  return matches.map(match => ({
    home: Number(match[1]),
    away: Number(match[2])
  }));
}
/* =========================================================
   TAKIM BUL
========================================================= */
function findTeams(cells, text) {
  let home = "";
  let away = "";
  /*
   Önce hücrelerde:
   Takım - Takım
   Takım v Takım
   formatını ara.
  */
  for (const cell of cells) {
    const value = normalizeText(cell);
    const match = value.match(
      /^(.+?)\s+(?:v|-)\s+(.+?)$/i
    );
    if (match) {
      const h = normalizeText(match[1]);
      const a = normalizeText(match[2]);
      if (
        h.length >= 2 &&
        a.length >= 2 &&
        normalizeTeam(h) !== normalizeTeam(a)
      ) {
        return {
          home: h,
          away: a
        };
      }
    }
  }
  /*
   Bazı Mackolik satırlarında takımlar ayrı
   hücrelerde bulunuyor.
  */
  const candidates = cells
    .map(normalizeText)
    .filter(value => {
      if (!value || value.length < 2) {
        return false;
      }
      if (
        /^\d+(?:\s*[-:]\s*\d+)?$/.test(value)
      ) {
        return false;
      }
      if (
        /^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(value)
      ) {
        return false;
      }
      if (
        /^\d{1,2}:\d{2}$/.test(value)
      ) {
        return false;
      }
      if (
        /^TS\s*:?\s*\d+(?:[.,]\d+)?$/i.test(value)
      ) {
        return false;
      }
      return true;
    });
  if (candidates.length >= 2) {
    /*
     Son iki anlamlı hücre çoğu sonuç satırında
     takım isimlerine karşılık geliyor.
    */
    for (let i = 0; i < candidates.length - 1; i++) {
      const h = candidates[i];
      const a = candidates[i + 1];
      if (
        h.length >= 2 &&
        a.length >= 2 &&
        normalizeTeam(h) !== normalizeTeam(a)
      ) {
        /*
         Açıkça lig adı gibi duran satırları
         mümkün olduğunca ele.
        */
        if (
          !/^(basketbol|basket|basketball)$/i.test(h) &&
          !/^(basketbol|basket|basketball)$/i.test(a)
        ) {
          home = h;
          away = a;
        }
      }
    }
  }
  /*
   Son çare:
   metinde "Takım - skor - skor - Takım"
   benzeri yapı varsa çevresinden yakala.
  */
  if (!home || !away) {
    const scoreMatches = [
      ...text.matchAll(
        /(\d{1,3})\s*-\s*(\d{1,3})/g
      )
    ];
    if (scoreMatches.length) {
      const firstScore =
        scoreMatches[0];
      const before =
        text.slice(0, firstScore.index);
      const after =
        text.slice(
          firstScore.index +
          firstScore[0].length
        );
      const beforeParts =
        before
          .split(/\s{2,}|\|/)
          .map(normalizeText)
          .filter(Boolean);
      const afterParts =
        after
          .split(/\s{2,}|\|/)
          .map(normalizeText)
          .filter(Boolean);
      if (beforeParts.length) {
        home =
          beforeParts[
            beforeParts.length - 1
          ];
      }
      if (afterParts.length) {
        away =
          afterParts[0];
      }
    }
  }
  if (
    !home ||
    !away ||
    normalizeTeam(home) === normalizeTeam(away)
  ) {
    return null;
  }
  return {
    home,
    away
  };
}
/* =========================================================
   GENEL SONUÇ PARSER
========================================================= */
function parseBasketballResults(html) {
  const $ = cheerio.load(html);
  const results = [];
  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) =>
        normalizeText($(td).text())
      )
      .get();
    if (cells.length < 2) {
      return;
    }
    const text = normalizeText(
      cells.join(" | ")
    );
    if (!text) {
      return;
    }
    /*
     * Tarih
     */
    const dateMatch = text.match(
      /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
    );
    if (!dateMatch) {
      return;
    }
    const date = parseDate(
      dateMatch[1]
    );
    if (!date || !isWithinHistory(date)) {
      return;
    }
    /*
     * Saat
     */
    const timeMatch = text.match(
      /\b\d{1,2}:\d{2}\b/
    );
    const time =
      timeMatch
        ? timeMatch[0]
        : "";
    /*
     * Skorlar
     */
    const scores =
      extractScores(text);
    if (!scores.length) {
      return;
    }
    /*
     * Basketbolda final skorun makul olması
     * gerekiyor. Çok küçük değerleri veri hatası
     * olarak değerlendir.
     */
    const final =
      scores[scores.length - 1];
    if (
      final.home < 30 ||
      final.away < 30
    ) {
      return;
    }
    /*
     * İlk yarı skorunu bul.
     * Mackolik satırlarında birden fazla skor
     * bulunabiliyor. Finalden önceki skor en
     * güvenli adaydır.
     */
    let half = null;
    if (scores.length >= 2) {
      half =
        scores[scores.length - 2];
    }
    /*
     * Takımlar
     */
    const teams =
      findTeams(
        cells,
        text
      );
    if (!teams) {
      return;
    }
    /*
     * Lig bilgisini mümkünse al.
     */
    let league = "";
    for (const cell of cells) {
      const value =
        normalizeText(cell);
      if (
        value &&
        value.length > 2 &&
        !value.match(
          /\d{1,2}[./]\d{1,2}[./]\d{4}/
        ) &&
        !value.match(
          /^\d{1,2}:\d{2}$/
        ) &&
        !value.match(
          /^\d+\s*-\s*\d+$/
        ) &&
        value !== teams.home &&
        value !== teams.away
      ) {
        /*
         Çok uzun hücreleri lig olarak
         kabul etmiyoruz.
         */
        if (
          value.length <= 80 &&
          !/^\d+$/.test(value)
        ) {
          league = value;
        }
      }
    }
    const id =
      makeId(
        date,
        teams.home,
        teams.away,
        time
      );
    results.push({
      id,
      date,
      time,
      home: teams.home,
      away: teams.away,
      league,
      homeScore: final.home,
      awayScore: final.away,
      halfHomeScore:
        half
          ? half.home
          : null,
      halfAwayScore:
        half
          ? half.away
          : null,
      total:
        final.home +
        final.away,
      source:
        "mackolik"
    });
  });
  return results;
}
/* =========================================================
   PROGRAMDAN MAÇLAR
========================================================= */
function parseProgram(html) {
  const $ = cheerio.load(html);
  const results = [];
  $("tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .map((_, td) =>
        normalizeText($(td).text())
      )
      .get();
    if (cells.length < 2) {
      return;
    }
    const text =
      normalizeText(
        cells.join(" | ")
      );
    const dateMatch =
      text.match(
        /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
      );
    if (!dateMatch) {
      return;
    }
    const date =
      parseDate(
        dateMatch[1]
      );
    if (
      !date ||
      !isWithinHistory(date)
    ) {
      return;
    }
    const timeMatch =
      text.match(
        /\b\d{1,2}:\d{2}\b/
      );
    const time =
      timeMatch
        ? timeMatch[0]
        : "";
    const teams =
      findTeams(
        cells,
        text
      );
    if (!teams) {
      return;
    }
    let total = null;
    const totalMatch =
      text.match(
        /\bTS\s*:?\s*(\d+(?:[.,]\d+)?)\b/i
      );
    if (totalMatch) {
      total =
        parseNumber(
          totalMatch[1]
        );
    }
    results.push({
      id:
        makeId(
          date,
          teams.home,
          teams.away,
          time
        ),
      date,
      time,
      home:
        teams.home,
      away:
        teams.away,
      league: "",
      homeScore: null,
      awayScore: null,
      halfHomeScore: null,
      halfAwayScore: null,
      total,
      source:
        "mackolik"
    });
  });
  return results;
}
/* =========================================================
   MAÇLARI BİRLEŞTİR
========================================================= */
function mergeMatches(
  oldMatches,
  newMatches
) {
  const map =
    new Map();
  for (const match of oldMatches) {
    if (
      !match ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }
    const id =
      match.id ||
      makeId(
        match.date,
        match.home,
        match.away,
        match.time || ""
      );
    map.set(
      id,
      {
        ...match,
        id
      }
    );
  }
  for (const match of newMatches) {
    if (
      !match ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }
    const id =
      match.id ||
      makeId(
        match.date,
        match.home,
        match.away,
        match.time || ""
      );
    const old =
      map.get(id);
    if (!old) {
      map.set(
        id,
        {
          ...match,
          id
        }
      );
      continue;
    }
    map.set(
      id,
      {
        ...old,
        ...match,
        id,
        home:
          match.home ||
          old.home,
        away:
          match.away ||
          old.away,
        league:
          match.league ||
          old.league ||
          "",
        homeScore:
          match.homeScore !== null &&
          match.homeScore !== undefined
            ? match.homeScore
            : old.homeScore ?? null,
        awayScore:
          match.awayScore !== null &&
          match.awayScore !== undefined
            ? match.awayScore
            : old.awayScore ?? null,
        halfHomeScore:
          match.halfHomeScore !== null &&
          match.halfHomeScore !== undefined
            ? match.halfHomeScore
            : old.halfHomeScore ?? null,
        halfAwayScore:
          match.halfAwayScore !== null &&
          match.halfAwayScore !== undefined
            ? match.halfAwayScore
            : old.halfAwayScore ?? null,
        total:
          match.total !== null &&
          match.total !== undefined
            ? match.total
            : old.total ?? null
      }
    );
  }
  return [
    ...map.values()
  ];
}
/* =========================================================
   DUPLICATE TEMİZLEME
========================================================= */
function cleanMatches(matches) {
  const map =
    new Map();
  for (const match of matches) {
    if (
      !match ||
      !match.date ||
      !match.home ||
      !match.away
    ) {
      continue;
    }
    if (
      !isWithinHistory(
        match.date
      )
    ) {
      continue;
    }
    if (
      normalizeTeam(match.home) ===
      normalizeTeam(match.away)
    ) {
      continue;
    }
    /*
     * Final skoru varsa kesinlikle sakla.
     * Program maçıysa skor olmayabilir.
     */
    const hasScore =
      Number.isFinite(
        Number(match.homeScore)
      ) &&
      Number.isFinite(
        Number(match.awayScore)
      );
    const hasProgramInfo =
      match.time ||
      match.total !== null;
    if (
      !hasScore &&
      !hasProgramInfo
    ) {
      continue;
    }
    const id =
      match.id ||
      makeId(
        match.date,
        match.home,
        match.away,
        match.time || ""
      );
    const old =
      map.get(id);
    if (!old) {
      map.set(
        id,
        {
          ...match,
          id
        }
      );
      continue;
    }
    /*
     * Skorlu kayıt her zaman öncelikli.
     */
    const oldHasScore =
      Number.isFinite(
        Number(old.homeScore)
      ) &&
      Number.isFinite(
        Number(old.awayScore)
      );
    if (
      hasScore &&
      !oldHasScore
    ) {
      map.set(
        id,
        {
          ...old,
          ...match,
          id
        }
      );
    } else {
      map.set(
        id,
        {
          ...old,
          ...match,
          id,
          homeScore:
            match.homeScore ??
            old.homeScore ??
            null,
          awayScore:
            match.awayScore ??
            old.awayScore ??
            null,
          halfHomeScore:
            match.halfHomeScore ??
            old.halfHomeScore ??
            null,
          halfAwayScore:
            match.halfAwayScore ??
            old.halfAwayScore ??
            null,
          league:
            match.league ||
            old.league ||
            ""
        }
      );
    }
  }
  return [
    ...map.values()
  ].sort((a, b) => {
    const aa =
      `${a.date} ${a.time || ""}`;
    const bb =
      `${b.date} ${b.time || ""}`;
    return bb.localeCompare(aa);
  });
}
/* =========================================================
   ANA
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
    `📅 Geçmiş aralığı: ${DAYS_BACK} gün`
  );
  console.log("");
  const oldMatches =
    readHistory();
  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );
  let allMatches = [
    ...oldMatches
  ];
  /*
   * -------------------------------------------------------
   * 1) ANA PROGRAM
   * -------------------------------------------------------
   */
  console.log("");
  console.log(
    "🏀 Mackolik basketbol programı alınıyor..."
  );
  const programHtml =
    await fetchHtml(
      PROGRAM_URL
    );
  if (programHtml) {
    console.log(
      `Program HTML uzunluğu: ${programHtml.length}`
    );
    const programMatches =
      parseProgram(
        programHtml
      );
    console.log(
      `Programdan bulunan maç: ${programMatches.length}`
    );
    allMatches.push(
      ...programMatches
    );
  }
  /*
   * -------------------------------------------------------
   * 2) TÜM OLASI SONUÇ SAYFALARINI TARA
   * -------------------------------------------------------
   */
  console.log("");
  console.log(
    "🔎 Basketbol sonuç sayfaları taranıyor..."
  );
  const uniqueUrls =
    [
      ...new Set(
        RESULT_URLS
      )
    ];
  let totalFound = 0;
  for (
    let i = 0;
    i < uniqueUrls.length;
    i++
  ) {
    const url =
      uniqueUrls[i];
    console.log(
      `[${i + 1}/${uniqueUrls.length}] ${url}`
    );
    const html =
      await fetchHtml(url);
    if (!html) {
      continue;
    }
    const matches =
      parseBasketballResults(
        html
      );
    console.log(
      `   → ${matches.length} basketbol sonucu`
    );
    totalFound +=
      matches.length;
    allMatches.push(
      ...matches
    );
    /*
     * Mackolik'i gereksiz yere
     * arka arkaya bombardıman etme.
     */
    await sleep(500);
  }
  /*
   * -------------------------------------------------------
   * 3) BİRLEŞTİR
   * -------------------------------------------------------
   */
  console.log("");
  console.log(
    "🔄 Veriler birleştiriliyor..."
  );
  const cleaned =
    cleanMatches(
      mergeMatches(
        oldMatches,
        allMatches
      )
    );
  /*
   * -------------------------------------------------------
   * 4) İSTATİSTİK
   * -------------------------------------------------------
   */
  const withScore =
    cleaned.filter(
      m =>
        Number.isFinite(
          Number(m.homeScore)
        ) &&
        Number.isFinite(
          Number(m.awayScore)
        )
    );
  const leagues =
    new Set(
      cleaned
        .map(m =>
          normalizeText(
            m.league
          )
        )
        .filter(Boolean)
    );
  const dates =
    new Set(
      cleaned.map(
        m => m.date
      )
    );
  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "📊 SONUÇ"
  );
  console.log(
    "=============================================="
  );
  console.log(
    `Bulunan yeni sonuç: ${totalFound}`
  );
  console.log(
    `Toplam benzersiz maç: ${cleaned.length}`
  );
  console.log(
    `Skorlu maç: ${withScore.length}`
  );
  console.log(
    `Lig sayısı: ${leagues.size}`
  );
  console.log(
    `Tarih sayısı: ${dates.size}`
  );
  /*
   * -------------------------------------------------------
   * 5) JSON YAZ
   * -------------------------------------------------------
   */
  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );
  const output = {
    source:
      BASE_URL,
    updatedAt:
      new Date().toISOString(),
    historyDays:
      DAYS_BACK,
    matchCount:
      cleaned.length,
    leagues:
      [...leagues].sort(),
    matches:
      cleaned
  };
  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );
  console.log("");
  console.log(
    "=============================================="
  );
  console.log(
    "✅ BASKETBOL GEÇMİŞİ YAZILDI"
  );
  console.log(
    "=============================================="
  );
  console.log(
    `📁 ${DATA_PATH}`
  );
  console.log(
    `🏀 ${cleaned.length} maç`
  );
  console.log(
    `🏆 ${leagues.size} lig`
  );
  console.log(
    `📅 ${dates.size} farklı tarih`
  );
  console.log("");
}
main().catch(error => {
  console.error("");
  console.error(
    "❌ Basketbol geçmiş güncellemesi başarısız:"
  );
  console.error(
    error.stack ||
    error.message
  );
  process.exitCode = 1;
});
