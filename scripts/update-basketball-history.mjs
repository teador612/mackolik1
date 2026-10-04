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
  `${BASE_URL}/Basketbol/Canli-Sonuclar`;

const DAYS_BACK = 60;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

/* =========================================================
   YARDIMCILAR
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
    .replace(/[()]/g, "")
    .replace(/[.,']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value) {
  const text = normalizeText(value);

  const m = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
  );

  if (!m) return null;

  return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(
    m[1]
  ).padStart(2, "0")}`;
}

function getStartDate() {
  const d = new Date();

  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - DAYS_BACK);

  return d;
}

function isWithinHistory(date) {
  const d = new Date(`${date}T00:00:00`);

  return (
    Number.isFinite(d.getTime()) &&
    d >= getStartDate()
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
      console.log(
        `   ⚠️ HTTP ${response.status}: ${url}`
      );

      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(
      `   ⚠️ İstek hatası: ${url}`
    );

    console.log(
      `      ${error.message}`
    );

    return null;
  }
}

/* =========================================================
   DOSYA
========================================================= */

function readHistory() {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(
      DATA_PATH,
      "utf8"
    );

    const json = JSON.parse(raw);

    if (Array.isArray(json)) {
      return json;
    }

    if (
      json &&
      Array.isArray(json.matches)
    ) {
      return json.matches;
    }

    return [];
  } catch (error) {
    console.log(
      "⚠️ Eski geçmiş okunamadı:",
      error.message
    );

    return [];
  }
}

/* =========================================================
   BASKETBOL ANA SAYFASINDAN TÜM LİGLERİ BUL
========================================================= */

function parseLeagueLinks(html) {
  const $ = cheerio.load(html);

  const leagues = new Map();

  $("a[href]").each((_, element) => {
    const href =
      $(element).attr("href") || "";

    const text =
      normalizeText($(element).text());

    /*
     * Mackolik basketbol lig sayfaları:
     *
     * /Basketball/Standing/Default.aspx?sId=8630
     *
     * Bazı sayfalarda büyük/küçük harf değişebilir.
     */

    const match = href.match(
      /Basketball\/Standing\/Default\.aspx\?sId=(\d+)/i
    );

    if (!match) {
      return;
    }

    const sId = match[1];

    let name = text;

    if (!name) {
      name = `Lig ${sId}`;
    }

    leagues.set(
      sId,
      {
        id: sId,
        name,
        url:
          `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${sId}`
      }
    );
  });

  return [...leagues.values()];
}

/* =========================================================
   ALTERNATİF LİG LINKİ BULUCU
========================================================= */

function parseAlternativeLeagueLinks(html) {
  const $ = cheerio.load(html);

  const leagues = new Map();

  $("a[href]").each((_, element) => {
    const href =
      $(element).attr("href") || "";

    const text =
      normalizeText($(element).text());

    /*
     * Bazı eski Mackolik sayfalarında
     * Basketbol/Basketball URL yapıları farklı
     * olabilir.
     */

    const match = href.match(
      /(?:Basketball|Basketbol)\/[^"'?#]*?(?:\?|&)sId=(\d+)/i
    );

    if (!match) {
      return;
    }

    const sId = match[1];

    if (!leagues.has(sId)) {
      leagues.set(
        sId,
        {
          id: sId,
          name: text || `Lig ${sId}`,
          url: new URL(
            href,
            BASE_URL
          ).href
        }
      );
    }
  });

  return [...leagues.values()];
}

/* =========================================================
   LİG SAYFASINDAN MAÇLARI ÇIKAR
========================================================= */

function parseLeagueResults(html, league) {
  const $ = cheerio.load(html);

  const results = [];

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

    /*
     * Tarih
     */

    const dateMatch =
      rowText.match(
        /\b(\d{1,2}\.\d{1,2}\.\d{4})\b/
      );

    if (!dateMatch) {
      return;
    }

    const date =
      parseDate(dateMatch[1]);

    if (!date) {
      return;
    }

    /*
     * 60 günlük pencerenin dışında kalanları
     * almıyoruz.
     */

    if (!isWithinHistory(date)) {
      return;
    }

    /*
     * Tüm skorları bul.
     *
     * Örnek Mackolik satırı:
     *
     * 119 - 124
     * 58 - 60
     * 119 - 124
     *
     * İlk skor MS,
     * ikinci skor İY.
     */

    const scoreMatches = [
      ...rowText.matchAll(
        /(\d+)\s*-\s*(\d+)/g
      )
    ];

    if (scoreMatches.length === 0) {
      return;
    }

    const scores = scoreMatches.map(
      match => ({
        home: Number(match[1]),
        away: Number(match[2])
      })
    );

    /*
     * Takım isimlerini bul.
     *
     * Mackolik yapısında çoğunlukla takım
     * isimleri ayrı hücrelerdedir.
     */

    const possibleTeams = [];

    for (const cell of cells) {
      if (!cell) continue;

      if (
        /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(
          cell
        )
      ) {
        continue;
      }

      if (
        /^\d{1,2}:\d{2}$/.test(
          cell
        )
      ) {
        continue;
      }

      if (
        /^\d+\s*-\s*\d+$/.test(
          cell
        )
      ) {
        continue;
      }

      if (
        /^(MS|H1|H2|İY|UZ|ERT|CANLI)$/i.test(
          cell
        )
      ) {
        continue;
      }

      /*
       * Çok kısa veya yalnızca sayı olan
       * hücreleri geç.
       */

      if (
        cell.length < 3 ||
        /^\d+$/.test(cell)
      ) {
        continue;
      }

      possibleTeams.push(cell);
    }

    if (possibleTeams.length < 2) {
      return;
    }

    /*
     * Takım isimlerinde skor/statistik kolonları
     * araya girebildiği için ilk iki mantıklı
     * takım adayını kullanıyoruz.
     */

    let home = "";
    let away = "";

    /*
     * Skor hücresinin hemen çevresindeki
     * takım isimlerini önce dene.
     */

    for (
      let i = 0;
      i < cells.length;
      i++
    ) {
      const cell = cells[i];

      if (
        /\d+\s*-\s*\d+/.test(cell)
      ) {
        const before =
          cells[i - 1];

        const after =
          cells[i + 1];

        if (
          before &&
          after &&
          before.length >= 3 &&
          after.length >= 3 &&
          !/\d+\s*-\s*\d+/.test(before) &&
          !/\d+\s*-\s*\d+/.test(after)
        ) {
          home = before;
          away = after;
          break;
        }
      }
    }

    /*
     * Yukarıdaki yöntem olmadıysa takım
     * adaylarından ilk ikisini al.
     */

    if (!home || !away) {
      home =
        possibleTeams[0];

      away =
        possibleTeams[1];
    }

    if (!home || !away) {
      return;
    }

    /*
     * Aynı isimli takım kontrolü
     */

    if (
      normalizeTeam(home) ===
      normalizeTeam(away)
    ) {
      return;
    }

    /*
     * MS skoru
     *
     * Mackolik sonuç tablosunda ilk skor
     * genellikle MS skorudur.
     */

    const finalScore =
      scores[0];

    if (
      !finalScore ||
      !Number.isFinite(
        finalScore.home
      ) ||
      !Number.isFinite(
        finalScore.away
      )
    ) {
      return;
    }

    /*
     * Basketbol final skoru için çok düşük
     * değerleri ele.
     *
     * Ancak kadın/genç liglerinde düşük
     * skorlar olabileceği için 30 sınırı
     * kullanmıyoruz.
     */

    /*
     * İY skoru:
     *
     * İkinci skor varsa kullan.
     */

    const halfScore =
      scores.length >= 2
        ? scores[1]
        : null;

    /*
     * Bazı liglerde aynı skor tekrar
     * edilebilir. Yine de ilk iki skor
     * veri yapısı için yeterli.
     */

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

      homeScore:
        finalScore.home,

      awayScore:
        finalScore.away,

      halfHomeScore:
        halfScore
          ? halfScore.home
          : null,

      halfAwayScore:
        halfScore
          ? halfScore.away
          : null,

      total:
        finalScore.home +
        finalScore.away,

      league:
        league.name,

      leagueId:
        league.id,

      source:
        "mackolik"
    };

    results.push(match);
  });

  /*
   * Bazı sayfalarda aynı maç birden fazla
   * HTML satırında bulunabiliyor.
   */

  const unique =
    new Map();

  for (const match of results) {
    unique.set(
      match.id,
      match
    );
  }

  return [
    ...unique.values()
  ];
}

/* =========================================================
   ESKİ + YENİ VERİLERİ BİRLEŞTİR
========================================================= */

function mergeMatches(
  oldMatches,
  newMatches
) {
  const map =
    new Map();

  /*
   * Önce eski kayıtlar.
   */

  for (
    const match of oldMatches
  ) {
    if (
      !match ||
      !match.id ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    map.set(
      match.id,
      match
    );
  }

  /*
   * Sonra yeni kayıtlar.
   */

  for (
    const match of newMatches
  ) {
    if (
      !match ||
      !match.id ||
      !match.home ||
      !match.away
    ) {
      continue;
    }

    const old =
      map.get(match.id);

    if (!old) {
      map.set(
        match.id,
        match
      );

      continue;
    }

    /*
     * Yeni skor varsa eski skoru güncelle.
     * Yeni alan yoksa eskisini koru.
     */

    map.set(
      match.id,
      {
        ...old,
        ...match,

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
          "",

        leagueId:
          match.leagueId ||
          old.leagueId ||
          ""
      }
    );
  }

  return [
    ...map.values()
  ];
}

/* =========================================================
   TEMİZLE
========================================================= */

function cleanMatches(matches) {
  const map =
    new Map();

  for (
    const match of matches
  ) {
    if (
      !match ||
      !match.date ||
      !match.home ||
      !match.away
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
     * Sadece gerçekten skor veya maç
     * bilgisi olan kayıtları tut.
     */

    const hasScore =
      Number.isFinite(
        Number(match.homeScore)
      ) &&
      Number.isFinite(
        Number(match.awayScore)
      );

    const hasBasicInfo =
      Boolean(
        match.home &&
        match.away
      );

    if (
      !hasScore &&
      !hasBasicInfo
    ) {
      continue;
    }

    map.set(
      match.id,
      match
    );
  }

  return [
    ...map.values()
  ].sort(
    (a, b) =>
      `${b.date} ${b.time || ""}`
        .localeCompare(
          `${a.date} ${a.time || ""}`
        )
  );
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

  const oldMatches =
    readHistory();

  console.log(
    `\nMevcut kayıt: ${oldMatches.length}`
  );

  /*
   * -------------------------------------------------------
   * 1. Basketbol ana sayfasını al
   * -------------------------------------------------------
   */

  console.log(
    "\n🏀 Mackolik basketbol ligleri alınıyor..."
  );

  const basketballHtml =
    await fetchHtml(
      BASKETBALL_URL
    );

  if (!basketballHtml) {
    throw new Error(
      "Basketbol ana sayfası alınamadı."
    );
  }

  console.log(
    `Basketbol HTML uzunluğu: ${basketballHtml.length}`
  );

  /*
   * -------------------------------------------------------
   * 2. Tüm ligleri bul
   * -------------------------------------------------------
   */

  let leagues =
    parseLeagueLinks(
      basketballHtml
    );

  /*
   * Alternatif yapı da denensin.
   */

  if (
    leagues.length === 0
  ) {
    leagues =
      parseAlternativeLeagueLinks(
        basketballHtml
      );
  }

  console.log(
    `🏆 Bulunan basketbol ligi: ${leagues.length}`
  );

  if (
    leagues.length === 0
  ) {
    console.log(
      "\n⚠️ Hiç lig bulunamadı."
    );

    console.log(
      "Mackolik sayfa yapısı değişmiş olabilir."
    );

    /*
     * Eski veriyi silme.
     */

    const cleaned =
      cleanMatches(
        oldMatches
      );

    fs.mkdirSync(
      path.dirname(DATA_PATH),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify(
        {
          source:
            BASE_URL,

          updatedAt:
            new Date().toISOString(),

          historyDays:
            DAYS_BACK,

          matches:
            cleaned
        },
        null,
        2
      )
    );

    return;
  }

  /*
   * -------------------------------------------------------
   * 3. Her ligi tara
   * -------------------------------------------------------
   */

  console.log(
    "\n🔎 TÜM basketbol ligleri taranıyor..."
  );

  const allNewMatches =
    [];

  let successfulLeagues = 0;

  let failedLeagues = 0;

  for (
    let i = 0;
    i < leagues.length;
    i++
  ) {
    const league =
      leagues[i];

    console.log(
      `\n[${i + 1}/${leagues.length}] ${league.name} (sId=${league.id})`
    );

    const html =
      await fetchHtml(
        league.url
      );

    if (!html) {
      failedLeagues++;

      continue;
    }

    const results =
      parseLeagueResults(
        html,
        league
      );

    console.log(
      `   → ${results.length} maç`
    );

    if (
      results.length > 0
    ) {
      successfulLeagues++;

      allNewMatches.push(
        ...results
      );
    }

    /*
     * Mackolik'i aşırı hızlı isteklerle
     * yormamak için küçük bekleme.
     */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          120
        )
    );
  }

  /*
   * -------------------------------------------------------
   * 4. Birleştir
   * -------------------------------------------------------
   */

  console.log(
    "\n🔄 Veriler birleştiriliyor..."
  );

  const merged =
    mergeMatches(
      oldMatches,
      allNewMatches
    );

  const cleaned =
    cleanMatches(
      merged
    );

  /*
   * -------------------------------------------------------
   * 5. İstatistik
   * -------------------------------------------------------
   */

  const leaguesFound =
    new Set(
      cleaned
        .map(
          match =>
            match.leagueId ||
            match.league
        )
        .filter(Boolean)
    );

  const datesFound =
    new Set(
      cleaned
        .map(
          match =>
            match.date
        )
        .filter(Boolean)
    );

  const scored =
    cleaned.filter(
      match =>
        Number.isFinite(
          Number(
            match.homeScore
          )
        ) &&
        Number.isFinite(
          Number(
            match.awayScore
          )
        )
    );

  const newIds =
    new Set(
      allNewMatches.map(
        match =>
          match.id
      )
    );

  console.log(
    "\n=============================================="
  );

  console.log(
    "📊 SONUÇ"
  );

  console.log(
    "=============================================="
  );

  console.log(
    `Bulunan yeni sonuç: ${newIds.size}`
  );

  console.log(
    `Toplam benzersiz maç: ${cleaned.length}`
  );

  console.log(
    `Skorlu maç: ${scored.length}`
  );

  console.log(
    `Lig sayısı: ${leaguesFound.size}`
  );

  console.log(
    `Tarih sayısı: ${datesFound.size}`
  );

  console.log(
    `Başarılı lig: ${successfulLeagues}`
  );

  console.log(
    `Boş/hatalı lig: ${failedLeagues}`
  );

  /*
   * -------------------------------------------------------
   * 6. JSON yaz
   * -------------------------------------------------------
   */

  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify(
      {
        source:
          BASE_URL,

        updatedAt:
          new Date().toISOString(),

        historyDays:
          DAYS_BACK,

        leagueCount:
          leaguesFound.size,

        dateCount:
          datesFound.size,

        matches:
          cleaned
      },
      null,
      2
    )
  );

  console.log(
    "\n=============================================="
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
    `🏆 ${leaguesFound.size} lig`
  );

  console.log(
    `📅 ${datesFound.size} farklı tarih`
  );

  console.log("");
}

main().catch(
  error => {
    console.error("");
    console.error(
      "❌ BASKETBOL GEÇMİŞİ HATASI"
    );

    console.error(
      error.stack ||
      error.message
    );

    process.exitCode = 1;
  }
);
