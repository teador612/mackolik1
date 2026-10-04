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

const CURRENT_SEASON = "2026-2027";

/*
  2026-2027 basketbol sezonu:
  Başlangıç : 01.08.2026
  Bitiş     : 31.07.2027
*/

const SEASON_START = new Date(2026, 7, 1);
const SEASON_END = new Date(2027, 6, 31);

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
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .replace(/[^a-z0-9]+/g, "");
}

/* =========================================================
   TARİH
========================================================= */

function parseDate(value) {
  const text = normalizeText(value);

  /*
    Desteklenen örnekler:

    24/09/26
    24/09/2026
    24.09.26
    24.09.2026
    24-09-26
    24-09-2026
  */

  const match = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);

  let year = Number(match[3]);

  /*
    Mackolik 2 haneli yıl kullanabiliyor.

    26 -> 2026
    27 -> 2027
  */

  if (String(match[3]).length === 2) {
    year += 2000;
  }

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year)
  ) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  if (day < 1 || day > 31) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day
  );

  /*
    Geçersiz tarih kontrolü
  */

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

/* =========================================================
   SEZON KONTROLÜ
========================================================= */

function isCurrentSeasonDate(dateStr) {
  if (!dateStr) {
    return false;
  }

  const parts = dateStr.split("-").map(Number);

  if (parts.length !== 3) {
    return false;
  }

  const [year, month, day] = parts;

  const date = new Date(
    year,
    month - 1,
    day
  );

  return (
    date >= SEASON_START &&
    date <= SEASON_END
  );
}

/* =========================================================
   ID
========================================================= */

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
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language":
            "tr-TR,tr;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Referer":
            `${BASE_URL}/Basketball/Default.aspx`
        }
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const html = await response.text();

      if (!html || html.length < 1000) {
        throw new Error(
          `HTML çok kısa: ${html.length}`
        );
      }

      return html;

    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise(resolve =>
          setTimeout(
            resolve,
            1000 * attempt
          )
        );
      }
    }
  }

  throw lastError || new Error(
    "HTML alınamadı"
  );
}

/* =========================================================
   MEVCUT DATA
========================================================= */

function readHistory() {
  if (!fs.existsSync(DATA_PATH)) {
    return [];
  }

  try {
    const raw =
      fs.readFileSync(
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
      "⚠️ basketball-history.json okunamadı:",
      error.message
    );

    return [];
  }
}

/* =========================================================
   LİG
========================================================= */

function createLeague(
  id,
  name,
  urls
) {
  return {
    id: String(id),
    name: normalizeText(name),
    urls: [
      ...new Set(urls)
    ]
  };
}

function addLeague(
  map,
  id,
  name,
  urls
) {
  if (!id) {
    return;
  }

  id = String(id).trim();

  if (!/^\d+$/.test(id)) {
    return;
  }

  if (!map.has(id)) {
    map.set(
      id,
      createLeague(
        id,
        name || `Basketbol ${id}`,
        urls || []
      )
    );

    return;
  }

  const current = map.get(id);

  if (
    current.name.startsWith("Basketbol ") &&
    name &&
    !name.startsWith("Basketbol ")
  ) {
    current.name =
      normalizeText(name);
  }

  current.urls = [
    ...new Set([
      ...current.urls,
      ...(urls || [])
    ])
  ];
}

/* =========================================================
   ANA SAYFADAN LİG KEŞFİ
========================================================= */

function discoverLeagues(html) {
  const $ = cheerio.load(html);

  const leagues = new Map();

  $("a[href]").each((_, element) => {
    const href =
      $(element).attr("href") || "";

    const text =
      normalizeText(
        $(element).text()
      );

    let match =
      href.match(
        /Basketball\/Standing\/Default\.aspx\?[^#]*?\bid=(\d+)/i
      );

    if (match) {
      const id = match[1];

      addLeague(
        leagues,
        id,
        text,
        [
          `${BASE_URL}/Basketball/Standing/Default.aspx?id=${id}`,
          `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${id}`
        ]
      );

      return;
    }

    match =
      href.match(
        /Basketball\/Standing\/Default\.aspx\?[^#]*?\bsId=(\d+)/i
      );

    if (match) {
      const id = match[1];

      addLeague(
        leagues,
        id,
        text,
        [
          `${BASE_URL}/Basketball/Standing/Default.aspx?sId=${id}`,
          `${BASE_URL}/Basketball/Standing/Default.aspx?id=${id}`
        ]
      );

      return;
    }

    match =
      href.match(
        /Basketball\/Cups\/Default\.aspx\?[^#]*?\bid=(\d+)/i
      );

    if (match) {
      const id = match[1];

      addLeague(
        leagues,
        id,
        text,
        [
          `${BASE_URL}/Basketball/Cups/Default.aspx?id=${id}`,
          `${BASE_URL}/Basketball/Cups/Default.aspx?sId=${id}`
        ]
      );

      return;
    }

    match =
      href.match(
        /Basketball\/Cups\/Default\.aspx\?[^#]*?\bsId=(\d+)/i
      );

    if (match) {
      const id = match[1];

      addLeague(
        leagues,
        id,
        text,
        [
          `${BASE_URL}/Basketball/Cups/Default.aspx?sId=${id}`,
          `${BASE_URL}/Basketball/Cups/Default.aspx?id=${id}`
        ]
      );
    }
  });

  return [
    ...leagues.values()
  ];
}

/* =========================================================
   GÜNCEL SEZON BİLİNEN LİGLER
========================================================= */

function getKnownCurrentSeasonLeagues() {
  return [

    /*
      TÜRKİYE
    */

    createLeague(
      "1",
      "Türkiye Basketbol Süper Ligi",
      [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=1`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=1`
      ]
    ),

    createLeague(
      "300",
      "Türkiye Sigorta TBL",
      [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=300`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=300`
      ]
    ),

    createLeague(
      "23",
      "Türkiye Cumhurbaşkanlığı Kupası",
      [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=23`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=23`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=23`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=23`
      ]
    ),

    /*
      EUROPE
    */

    createLeague(
      "8",
      "EuroLeague",
      [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=8`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=8`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=8`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=8`
      ]
    ),

    createLeague(
      "117",
      "EuroCup",
      [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=117`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=117`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=117`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=117`
      ]
    ),

    createLeague(
      "1629",
      "Şampiyonlar Ligi",
      [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=1629`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=1629`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=1629`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=1629`
      ]
    ),

    createLeague(
      "10809",
      "Kıtalararası Kupası",
      [
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=10809`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=10809`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=10809`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=10809`
      ]
    ),

    /*
      NBA
    */

    createLeague(
      "526",
      "NBA",
      [
        `${BASE_URL}/Basketball/Standing/Default.aspx?id=526`,
        `${BASE_URL}/Basketball/Standing/Default.aspx?sId=526`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?id=526`,
        `${BASE_URL}/Basketball/Cups/Default.aspx?sId=526`
      ]
    )
  ];
}

/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {
  const match =
    normalizeText(value).match(
      /^(\d{1,3})\s*-\s*(\d{1,3})$/
    );

  if (!match) {
    return null;
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  if (
    !Number.isFinite(home) ||
    !Number.isFinite(away)
  ) {
    return null;
  }

  if (
    home < 0 ||
    away < 0 ||
    home > 250 ||
    away > 250
  ) {
    return null;
  }

  return {
    home,
    away
  };
}

/* =========================================================
   MAÇ SATIRI PARSE
========================================================= */

function parseMatchRow(
  cells,
  league
) {
  if (!cells || cells.length < 4) {
    return null;
  }

  const cleanCells =
    cells.map(normalizeText);

  const rowText =
    cleanCells.join(" | ");

  /*
    Satırdaki tarihi bul.

    24/09/26
    24/09/2026
  */

  const dateMatch =
    rowText.match(
      /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/
    );

  if (!dateMatch) {
    return null;
  }

  const date =
    parseDate(dateMatch[0]);

  if (!date) {
    return null;
  }

  /*
    SADECE 2026-2027 SEZONU
  */

  if (
    !isCurrentSeasonDate(date)
  ) {
    return null;
  }

  /*
    Skor hücresini bul
  */

  let scoreIndex = -1;
  let finalScore = null;

  for (
    let i = 0;
    i < cleanCells.length;
    i++
  ) {
    const score =
      parseScore(
        cleanCells[i]
      );

    if (score) {
      scoreIndex = i;
      finalScore = score;
      break;
    }
  }

  /*
    Bazı satırlarda skor aynı hücrede
    değilse tüm row text içerisinde ara.
  */

  if (!finalScore) {
    const scoreMatch =
      rowText.match(
        /\b(\d{1,3})\s*-\s*(\d{1,3})\b/
      );

    if (scoreMatch) {
      const score =
        parseScore(
          `${scoreMatch[1]}-${scoreMatch[2]}`
        );

      if (score) {
        finalScore = score;
      }
    }
  }

  /*
    Oynanmamış maçlar tarih geçmişinde
    bulunabilir.

    Bu dosyanın amacı geçmiş sonuç olduğu
    için skor olmadan kayıt eklemiyoruz.
  */

  if (!finalScore) {
    return null;
  }

  let home = "";
  let away = "";

  /*
    Mackolik tipik yapı:

    tarih
    MS
    Ev Sahibi
    78 - 77
    Deplasman
  */

  if (
    scoreIndex > 0 &&
    scoreIndex < cleanCells.length - 1
  ) {
    const before =
      cleanCells[scoreIndex - 1];

    const after =
      cleanCells[scoreIndex + 1];

    if (
      before &&
      after &&
      !parseDate(before)
    ) {
      home = before;
      away = after;
    }
  }

  /*
    Eğer scoreIndex yöntemi takım bulamadıysa
    satırdaki takım linklerini kullan.
  */

  if (!home || !away) {
    /*
      Takım isimlerini genellikle a taglerinden
      alabiliyoruz.
    */

    /*
      Bu fonksiyon yalnızca cells aldığı için
      aşağıdaki fallback kullanılır.
    */

    const candidates =
      cleanCells.filter(cell => {
        if (!cell) {
          return false;
        }

        if (parseDate(cell)) {
          return false;
        }

        if (
          /^(MS|UZ|ERT|İPT|CANLI|V)$/i.test(cell)
        ) {
          return false;
        }

        if (
          parseScore(cell)
        ) {
          return false;
        }

        if (
          /^\d{1,2}:\d{2}$/.test(cell)
        ) {
          return false;
        }

        /*
          Sadece kısa numara/puan hücrelerini
          takım adından ayır.
        */

        if (
          /^\d+$/.test(cell)
        ) {
          return false;
        }

        if (
          cell.length < 2
        ) {
          return false;
        }

        return true;
      });

    if (
      candidates.length >= 2
    ) {
      home =
        candidates[
          candidates.length - 2
        ];

      away =
        candidates[
          candidates.length - 1
        ];
    }
  }

  if (!home || !away) {
    return null;
  }

  /*
    Yanlışlıkla durum bilgisi takım adı olmasın
  */

  if (
    /^(MS|UZ|ERT|İPT|CANLI|V)$/i.test(home)
  ) {
    return null;
  }

  if (
    /^(MS|UZ|ERT|İPT|CANLI|V)$/i.test(away)
  ) {
    return null;
  }

  /*
    Eğer ev/deplasman aynıysa
    hatalı parse kabul et.
  */

  if (
    normalizeTeam(home) ===
    normalizeTeam(away)
  ) {
    return null;
  }

  return {
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

    /*
      Mackolik bazı basketbol sayfalarında
      yalnızca MS skorunu veriyor.

      İlk yarı bulunamazsa null kalacak.
    */

    halfHomeScore: null,
    halfAwayScore: null,

    total:
      finalScore.home +
      finalScore.away,

    league:
      league.name ||
      "Bilinmeyen",

    leagueId:
      league.id || null,

    source:
      "mackolik"
  };
}

/* =========================================================
   MAÇLARI SAYFADAN ÇEK
========================================================= */

function parseMatchesFromPage(
  html,
  league
) {
  const $ = cheerio.load(html);

  const matches = [];

  $("tr").each((_, row) => {

    const cells =
      $(row)
        .find("td")
        .map((_, td) =>
          normalizeText(
            $(td).text()
          )
        )
        .get();

    const match =
      parseMatchRow(
        cells,
        league
      );

    if (match) {
      matches.push(match);
    }
  });

  /*
    Bazı Mackolik sayfalarında tablo yapısı
    değişebiliyor.

    Bu durumda div/line tabanlı fallback.
  */

  if (matches.length === 0) {

    const bodyText =
      normalizeText(
        $("body").text()
      );

    /*
      Örneğin:

      24/09/26 MS BC Dubai 78 - 77 Real Madrid
    */

    const regex =
      /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(?:MS|UZ)\s+(.+?)\s+(\d{1,3})\s*-\s*(\d{1,3})\s+(.+?)(?=\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|$)/gi;

    let match;

    while (
      (match = regex.exec(bodyText)) !== null
    ) {

      const date =
        parseDate(match[1]);

      if (
        !isCurrentSeasonDate(date)
      ) {
        continue;
      }

      const home =
        normalizeText(match[2]);

      const homeScore =
        Number(match[3]);

      const awayScore =
        Number(match[4]);

      const away =
        normalizeText(match[5]);

      if (
        !home ||
        !away ||
        !Number.isFinite(homeScore) ||
        !Number.isFinite(awayScore)
      ) {
        continue;
      }

      matches.push({
        id:
          makeId(
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

        halfHomeScore: null,
        halfAwayScore: null,

        total:
          homeScore +
          awayScore,

        league:
          league.name ||
          "Bilinmeyen",

        leagueId:
          league.id || null,

        source:
          "mackolik"
      });
    }
  }

  /*
    Tekilleştir
  */

  const unique =
    new Map();

  for (
    const match of matches
  ) {
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
   LİG GETİR
========================================================= */

async function fetchLeague(
  league,
  index,
  total
) {
  console.log(
    `\n[${index}/${total}] ${league.name} (${league.id})`
  );

  let bestMatches = [];
  let bestUrl = "";

  for (
    const url of league.urls
  ) {
    try {

      console.log(
        `   → ${url}`
      );

      const html =
        await fetchHtml(
          url,
          3
        );

      const matches =
        parseMatchesFromPage(
          html,
          league
        );

      console.log(
        `      ${matches.length} maç`
      );

      /*
        İLK BULDUĞUNDA DURMUYORUZ.

        En çok maç veren endpoint'i seçiyoruz.
      */

      if (
        matches.length >
        bestMatches.length
      ) {
        bestMatches =
          matches;

        bestUrl =
          url;
      }

    } catch (error) {

      console.log(
        `      ⚠️ ${error.message}`
      );
    }

    /*
      Mackolik'e fazla yüklenmemek için
      endpointler arasında kısa bekleme.
    */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          500
        )
    );
  }

  if (
    bestMatches.length > 0
  ) {
    console.log(
      `   ✅ En iyi kaynak: ${bestUrl}`
    );

    console.log(
      `   ✅ ${bestMatches.length} maç`
    );
  } else {
    console.log(
      "   → 0 maç"
    );
  }

  return bestMatches;
}

/* =========================================================
   TEMİZLE
========================================================= */

function cleanMatches(
  matches
) {
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

    /*
      SADECE 2026-2027
    */

    if (
      !isCurrentSeasonDate(
        match.date
      )
    ) {
      continue;
    }

    /*
      Geçmiş maç olması için MS skor şart.
    */

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
          Number(
            match.homeScore
          ),

        awayScore:
          Number(
            match.awayScore
          ),

        total:
          Number(
            match.homeScore
          ) +
          Number(
            match.awayScore
          )
      }
    );
  }

  return [
    ...map.values()
  ].sort(
    (a, b) => {

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
    `📅 Sezon: ${CURRENT_SEASON}`
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

  console.log("");

  /*
    MEVCUT KAYITLAR
  */

  const oldMatches =
    readHistory();

  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );

  console.log("");

  /*
    ANA SAYFA
  */

  console.log(
    "🏀 Mackolik basketbol sayfası alınıyor..."
  );

  let basketballHtml;

  try {

    basketballHtml =
      await fetchHtml(
        BASKETBALL_URL,
        3
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
    OTOMATİK KEŞİF
  */

  const discovered =
    discoverLeagues(
      basketballHtml
    );

  console.log(
    `🏆 Ana sayfadan bulunan lig: ${discovered.length}`
  );

  /*
    LİGLERİ BİRLEŞTİR
  */

  const leagueMap =
    new Map();

  for (
    const league of discovered
  ) {
    leagueMap.set(
      league.id,
      league
    );
  }

  /*
    BİLİNEN GÜNCEL LİGLER
  */

  for (
    const league of
    getKnownCurrentSeasonLeagues()
  ) {

    if (
      leagueMap.has(
        league.id
      )
    ) {

      const current =
        leagueMap.get(
          league.id
        );

      current.name =
        league.name;

      current.urls = [
        ...new Set([
          ...current.urls,
          ...league.urls
        ])
      ];

    } else {

      leagueMap.set(
        league.id,
        league
      );
    }
  }

  const leagues =
    [
      ...leagueMap.values()
    ];

  console.log(
    `🏆 Taranacak lig sayısı: ${leagues.length}`
  );

  console.log("");

  /*
    TÜM MAÇLAR
  */

  const newMatches =
    [];

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
      Rate limit
    */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          1000
        )
    );
  }

  console.log("");

  console.log(
    "🔄 Veriler birleştiriliyor..."
  );

  /*
    ESKİ + YENİ
  */

  const merged =
    [
      ...oldMatches,
      ...newMatches
    ];

  /*
    TEMİZLE + TEKİLLEŞTİR
  */

  const cleaned =
    cleanMatches(
      merged
    );

  /*
    İSTATİSTİK
  */

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

  /*
    ÇIKTI
  */

  const output = {

    source:
      BASKETBALL_URL,

    updatedAt:
      new Date().toISOString(),

    season:
      CURRENT_SEASON,

    seasonStart:
      "2026-08-01",

    seasonEnd:
      "2027-07-31",

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

  /*
    KLASÖR
  */

  fs.mkdirSync(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );

  /*
    DOSYA
  */

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
    SONUÇ
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
    `🆕 Bu çalışmada bulunan: ${newMatches.length}`
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
    `📚 Sezon: ${CURRENT_SEASON}`
  );

  console.log(
    "📆 01.08.2026 - 31.07.2027"
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

  console.error(
    error
  );

  process.exit(1);
});
