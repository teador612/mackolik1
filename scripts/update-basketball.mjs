import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data", "basketball.json");

const URL =
  "https://arsiv.mackolik.com/Program/Program.aspx?st=2";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";

async function main() {
  console.log("🏀 Basketbol verisi güncelleniyor...");

  const html = await fetchPage(URL);

  console.log(`HTML uzunluğu: ${html.length}`);

  const matches = parseProgram(html);

  console.log(`Bulunan basketbol maçı: ${matches.length}`);

  if (matches.length === 0) {
    console.error("❌ Hiç basketbol maçı bulunamadı.");
    console.error("Mackolik HTML yapısı kontrol edilmeli.");
    process.exit(1);
  }

  const old = readOld();

  const merged = merge(old, matches);

  const output = {
    source: URL,
    updatedAt: new Date().toISOString(),
    matches: merged
  };

  fs.mkdirSync(
    path.dirname(DATA_FILE),
    { recursive: true }
  );

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(`✅ JSON yazıldı: ${merged.length} maç`);

  console.log("");

  for (const m of matches.slice(0, 10)) {
    console.log(
      `${m.date} ${m.time} | ${m.league} | ${m.home} - ${m.away} | TS: ${m.totalLine ?? "-"}`
    );
  }
}


/* =========================================================
   FETCH
========================================================= */

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language":
        "tr-TR,tr;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return await response.text();
}


/* =========================================================
   PROGRAM PARSER
========================================================= */

function parseProgram(html) {
  const matches = [];

  /*
   * Önce gerçek <tr> satırlarını al.
   */

  const trMatches =
    html.match(
      /<tr\b[^>]*>[\s\S]*?<\/tr>/gi
    ) || [];

  console.log(
    `HTML tablo satırı: ${trMatches.length}`
  );

  let currentLeague = "Basketbol";
  let currentDate = null;

  for (const tr of trMatches) {
    const rowText = htmlToText(tr);

    if (!rowText) {
      continue;
    }

    /*
     * Lig başlığı.
     */

    const league =
      detectLeagueRow(rowText);

    if (league) {
      currentLeague = league;
      continue;
    }

    /*
     * Tarih.
     */

    const dateMatch =
      rowText.match(
        /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/
      );

    if (dateMatch) {
      currentDate =
        `${dateMatch[3]}-${pad(dateMatch[2])}-${pad(dateMatch[1])}`;
    }

    /*
     * Maç satırı.
     */

    const timeMatch =
      rowText.match(
        /\b([01]?\d|2[0-3]):([0-5]\d)\b/
      );

    if (!timeMatch) {
      continue;
    }

    if (!currentDate) {
      continue;
    }

    /*
     * Takım adını HTML içinden bul.
     *
     * Örnek:
     *
     * Los Angeles Cl - Golden State
     */

    const teamMatch =
      rowText.match(
        /(?:\|\s*)?([^|]+?)\s+-\s+([^|]+?)(?=\s*\||$)/
      );

    if (!teamMatch) {
      continue;
    }

    let home =
      cleanTeam(teamMatch[1]);

    let away =
      cleanTeam(teamMatch[2]);

    /*
     * Başlıkların takım olarak yakalanmasını engelle.
     */

    if (
      !isTeam(home) ||
      !isTeam(away)
    ) {
      continue;
    }

    /*
     * TS.
     */

    const totalLine =
      extractTotal(rowText);

    /*
     * Gerçek maç kaydı.
     */

    const match = {
      id: makeId(
        currentDate,
        home,
        away
      ),

      date: currentDate,

      time:
        `${pad(timeMatch[1])}:${timeMatch[2]}`,

      league: currentLeague,

      home,

      away,

      homeScore: null,
      awayScore: null,

      halfHomeScore: null,
      halfAwayScore: null,

      totalLine,

      status: "not_started"
    };

    matches.push(match);
  }

  /*
   * Bazı Mackolik sürümlerinde maç bilgileri
   * <tr> yerine div yapısında bulunabiliyor.
   *
   * Eğer tr yöntemi sonuç vermediyse ikinci
   * güvenli yöntem çalışır.
   */

  if (matches.length === 0) {
    console.log(
      "TR parser sonuç vermedi, alternatif parser deneniyor..."
    );

    return parseFallback(html);
  }

  return unique(matches);
}


/* =========================================================
   FALLBACK
========================================================= */

function parseFallback(html) {
  const result = [];

  const clean =
    htmlToText(html);

  const lines =
    clean
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean);

  let date = null;
  let league = "Basketbol";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dateMatch =
      line.match(
        /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/
      );

    if (dateMatch) {
      date =
        `${dateMatch[3]}-${pad(dateMatch[2])}-${pad(dateMatch[1])}`;
    }

    const possibleLeague =
      detectLeagueRow(line);

    if (possibleLeague) {
      league = possibleLeague;
    }

    const timeMatch =
      line.match(
        /\b([01]?\d|2[0-3]):([0-5]\d)\b/
      );

    if (!timeMatch || !date) {
      continue;
    }

    /*
     * Önceki ve sonraki birkaç satırı birleştir.
     */

    const block =
      lines
        .slice(
          Math.max(0, i),
          Math.min(
            lines.length,
            i + 4
          )
        )
        .join(" | ");

    const teamMatch =
      block.match(
        /([^|]+?)\s+-\s+([^|]+?)(?=\s*\||$)/
      );

    if (!teamMatch) {
      continue;
    }

    const home =
      cleanTeam(teamMatch[1]);

    const away =
      cleanTeam(teamMatch[2]);

    if (
      !isTeam(home) ||
      !isTeam(away)
    ) {
      continue;
    }

    result.push({
      id: makeId(
        date,
        home,
        away
      ),

      date,

      time:
        `${pad(timeMatch[1])}:${timeMatch[2]}`,

      league,

      home,
      away,

      homeScore: null,
      awayScore: null,

      halfHomeScore: null,
      halfAwayScore: null,

      totalLine:
        extractTotal(block),

      status:
        "not_started"
    });
  }

  return unique(result);
}


/* =========================================================
   HTML -> TEXT
========================================================= */

function htmlToText(html) {
  return html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<br\s*\/?>/gi,
      " | "
    )
    .replace(
      /<\/td>/gi,
      " | "
    )
    .replace(
      /<\/th>/gi,
      " | "
    )
    .replace(
      /<\/div>/gi,
      " "
    )
    .replace(
      /<\/li>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   LİG
========================================================= */

function detectLeagueRow(text) {
  const leagues = [
    "ABD NBA Ön Sezon",
    "ABD WNBA Yarı Final",
    "Güney Kore KBL",
    "Arjantin A Lig",
    "Türkiye Sigorta Basketbol Süper Ligi",
    "İspanya ACB Ligi",
    "Fransa LNB Pro A",
    "İtalya Serie A",
    "Almanya BBL",
    "Yunanistan Basket Ligi",
    "VTB Ligi Normal Sezon",
    "Polonya Energa Basket Liga",
    "Çek Cumhuriyeti NBL",
    "Avusturya Superliga"
  ];

  const n =
    normalize(text);

  for (const league of leagues) {
    if (
      n.includes(
        normalize(league)
      )
    ) {
      return league;
    }
  }

  /*
   * Mackolik bazen lig adını tek başına verir.
   */

  if (
    /NBA|WNBA|KBL|ACB|BBL|LNB|Basket|Liga|League|Serie/i.test(
      text
    )
  ) {
    if (
      !/\d{1,2}:\d{2}/.test(text) &&
      !/\d{1,2}\.\d{1,2}\.\d{4}/.test(text)
    ) {
      return cleanTeam(text);
    }
  }

  return null;
}


/* =========================================================
   TAKIM
========================================================= */

function cleanTeam(value) {
  return String(value || "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTeam(value) {
  if (!value) {
    return false;
  }

  const n =
    normalize(value);

  if (n.length < 2) {
    return false;
  }

  const forbidden = [
    "macsonucu",
    "ilkyarisonucu",
    "altust",
    "tumu",
    "iy",
    "ms",
    "h1",
    "h2",
    "iy1",
    "iy2",
    "alt",
    "ust",
    "ts"
  ];

  if (
    forbidden.includes(n)
  ) {
    return false;
  }

  /*
   * Sadece sayı olan değerleri reddet.
   */

  if (
    /^\d+(?:[,.]\d+)?$/.test(value)
  ) {
    return false;
  }

  return true;
}


/* =========================================================
   TOPLAM
========================================================= */

function extractTotal(text) {
  const values =
    [
      ...String(text).matchAll(
        /\b(\d{3}[,.]\d{1,2})\b/g
      )
    ];

  if (!values.length) {
    return null;
  }

  const last =
    values[values.length - 1][1];

  const number =
    Number(
      last.replace(",", ".")
    );

  return Number.isFinite(number)
    ? number
    : null;
}


/* =========================================================
   ESKİ VERİ
========================================================= */

function readOld() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      matches: []
    };
  }

  try {
    const data =
      JSON.parse(
        fs.readFileSync(
          DATA_FILE,
          "utf8"
        )
      );

    if (
      Array.isArray(data)
    ) {
      return {
        matches: data
      };
    }

    return {
      matches:
        Array.isArray(data.matches)
          ? data.matches
          : []
    };

  } catch {
    return {
      matches: []
    };
  }
}


/* =========================================================
   MERGE
========================================================= */

function merge(oldMatches, newMatches) {
  const map =
    new Map();

  /*
   * Eski kayıtları koru.
   */

  for (const match of oldMatches) {
    if (
      match &&
      match.id
    ) {
      map.set(
        match.id,
        match
      );
    }
  }

  /*
   * Yeni kayıtlar.
   */

  for (const match of newMatches) {
    if (!match.id) {
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

    map.set(
      match.id,
      {
        ...old,

        ...match,

        /*
         * Geçmiş skorları koru.
         */

        homeScore:
          old.homeScore ??
          match.homeScore,

        awayScore:
          old.awayScore ??
          match.awayScore,

        halfHomeScore:
          old.halfHomeScore ??
          match.halfHomeScore,

        halfAwayScore:
          old.halfAwayScore ??
          match.halfAwayScore
      }
    );
  }

  return [
    ...map.values()
  ];
}


/* =========================================================
   UNIQUE
========================================================= */

function unique(matches) {
  const map =
    new Map();

  for (const match of matches) {
    if (
      !match.home ||
      !match.away ||
      !match.date
    ) {
      continue;
    }

    if (
      !map.has(match.id)
    ) {
      map.set(
        match.id,
        match
      );
    }
  }

  return [
    ...map.values()
  ];
}


/* =========================================================
   HELPERS
========================================================= */

function makeId(
  date,
  home,
  away
) {
  return [
    date,
    normalize(home),
    normalize(away)
  ].join("_");
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "");
}

function pad(value) {
  return String(value).padStart(2, "0");
}


/* =========================================================
   START
========================================================= */

main().catch(error => {
  console.error("");
  console.error("❌ Basketbol güncelleme hatası:");
  console.error(error);
  process.exit(1);
});
