// scripts/update-basketball.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const DATA_FILE = path.join(
  ROOT,
  "data",
  "basketball.json"
);

const PROGRAM_URL =
  "https://arsiv.mackolik.com/Program/Program.aspx?st=2";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const MAX_HISTORY_DAYS = 120;

async function main() {
  console.log("");
  console.log("======================================");
  console.log("🏀 MACKOLİK BASKETBOL GÜNCELLEYİCİ");
  console.log("======================================");

  const oldData = readOldData();

  console.log(
    `Eski kayıt: ${oldData.matches.length}`
  );

  console.log("");
  console.log("📥 Mackolik basketbol programı çekiliyor...");

  const html = await fetchPage(PROGRAM_URL);

  const programMatches =
    parseBasketballProgram(html);

  console.log(
    `Programdan bulunan maç: ${programMatches.length}`
  );

  if (programMatches.length === 0) {
    console.log("");
    console.log("❌ Hiç basketbol maçı bulunamadı.");
    console.log(
      "Mackolik sayfasının yapısı değişmiş olabilir."
    );

    // Mevcut veriyi silme.
    return;
  }

  const merged =
    mergeMatches(
      oldData.matches,
      programMatches
    );

  merged.sort((a, b) => {
    const aa =
      `${a.date} ${a.time || "99:99"}`;

    const bb =
      `${b.date} ${b.time || "99:99"}`;

    return aa.localeCompare(bb);
  });

  const output = {
    source: PROGRAM_URL,
    updatedAt: new Date().toISOString(),
    matches: merged
  };

  fs.mkdirSync(
    path.dirname(DATA_FILE),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log("======================================");
  console.log("✅ BASKETBOL VERİSİ GÜNCELLENDİ");
  console.log("======================================");

  console.log(
    `Yeni program maçı: ${programMatches.length}`
  );

  console.log(
    `Toplam kayıt: ${merged.length}`
  );

  console.log(
    `Dosya: ${DATA_FILE}`
  );

  console.log("");
}


/* =========================================================
   SAYFAYI ÇEK
========================================================= */

async function fetchPage(url) {
  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept":
            "text/html,application/xhtml+xml,text/html"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} - ${url}`
    );
  }

  return await response.text();
}


/* =========================================================
   BASKETBOL PROGRAMINI PARSE ET
========================================================= */

function parseBasketballProgram(html) {
  const matches = [];

  /*
   * Mackolik'in basketbol programında maç satırı
   * kabaca:
   *
   * 18:00 ... Pizza Bulls Bo - Anadolu Efes ... 165,50
   *
   * şeklinde geliyor.
   */

  const text =
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/td>/gi, " | ")
      .replace(/<\/th>/gi, " | ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ");

  const lines =
    text
      .split("\n")
      .map(cleanLine)
      .filter(Boolean);

  let currentDate = null;
  let currentLeague = "BASKETBOL";

  for (const line of lines) {

    /*
     * Tarih yakala.
     */

    const dateMatch =
      line.match(
        /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/
      );

    if (dateMatch) {
      currentDate =
        toIsoDate(
          dateMatch[1],
          dateMatch[2],
          dateMatch[3]
        );
    }

    /*
     * Lig başlıklarını yakala.
     */

    const possibleLeague =
      detectLeague(line);

    if (possibleLeague) {
      currentLeague = possibleLeague;
    }

    /*
     * Saat yakala.
     */

    const timeMatch =
      line.match(
        /\b([01]?\d|2[0-3]):([0-5]\d)\b/
      );

    if (!timeMatch || !currentDate) {
      continue;
    }

    const time =
      String(timeMatch[1]).padStart(2, "0") +
      ":" +
      timeMatch[2];

    /*
     * Saatten sonraki bölümü al.
     */

    const timeIndex =
      line.indexOf(timeMatch[0]);

    let rest =
      line.slice(
        timeIndex +
        timeMatch[0].length
      );

    /*
     * Gereksiz kolonları temizle.
     */

    rest =
      rest
        .replace(
          /^\s*\|\s*/,
          ""
        )
        .replace(
          /\s*\|\s*/g,
          " | "
        )
        .trim();

    /*
     * Takım çiftini bul.
     */

    const teams =
      extractTeams(rest);

    if (!teams) {
      continue;
    }

    /*
     * Yanlış eşleşmeleri engelle.
     */

    if (
      isInvalidTeamName(teams.home) ||
      isInvalidTeamName(teams.away)
    ) {
      continue;
    }

    /*
     * Toplam sayı çizgisi.
     *
     * Örnek:
     * 165,50
     * 182,50
     * 174,50
     */

    const totalLine =
      extractTotalLine(rest);

    const id =
      makeId(
        currentDate,
        teams.home,
        teams.away
      );

    matches.push({
      id,

      date:
        currentDate,

      time,

      league:
        currentLeague,

      home:
        teams.home,

      away:
        teams.away,

      homeScore:
        null,

      awayScore:
        null,

      halfHomeScore:
        null,

      halfAwayScore:
        null,

      totalLine,

      status:
        "not_started"
    });
  }

  return uniqueMatches(matches);
}


/* =========================================================
   TAKIMLARI BUL
========================================================= */

function extractTeams(text) {
  if (!text) {
    return null;
  }

  /*
   * Öncelikle "|" bölümlerini kontrol et.
   */

  const parts =
    text
      .split("|")
      .map(x => cleanLine(x))
      .filter(Boolean);

  for (const part of parts) {

    /*
     * Takım - Takım
     */

    const m =
      part.match(
        /^(.+?)\s+-\s+(.+?)$/
      );

    if (!m) {
      continue;
    }

    const home =
      cleanTeamName(m[1]);

    const away =
      cleanTeamName(m[2]);

    if (
      !home ||
      !away
    ) {
      continue;
    }

    if (
      isInvalidTeamName(home) ||
      isInvalidTeamName(away)
    ) {
      continue;
    }

    return {
      home,
      away
    };
  }

  /*
   * "|" bulunamadıysa tüm metinde ara.
   */

  const m =
    text.match(
      /([A-Za-zÇĞİÖŞÜçğıöşü0-9().&'’/\\\- ]+?)\s+-\s+([A-Za-zÇĞİÖŞÜçğıöşü0-9().&'’/\\\- ]+)/
    );

  if (!m) {
    return null;
  }

  const home =
    cleanTeamName(m[1]);

  const away =
    cleanTeamName(m[2]);

  if (
    !home ||
    !away
  ) {
    return null;
  }

  if (
    isInvalidTeamName(home) ||
    isInvalidTeamName(away)
  ) {
    return null;
  }

  return {
    home,
    away
  };
}


/* =========================================================
   TAKIM ADI TEMİZLE
========================================================= */

function cleanTeamName(name) {
  if (!name) {
    return "";
  }

  let result =
    name
      .replace(/\s+/g, " ")
      .replace(/^[|:;,]+/, "")
      .replace(/[|:;,]+$/, "")
      .trim();

  /*
   * Oran / kolon bilgisi takım adına sızmışsa temizle.
   */

  result =
    result.replace(
      /\b(İY|MS|H1|H2|Alt|Üst|TS|Tümü)\b.*$/i,
      ""
    ).trim();

  return result;
}


/* =========================================================
   GEÇERSİZ TAKIM KONTROLÜ
========================================================= */

function isInvalidTeamName(name) {
  if (!name) {
    return true;
  }

  const value =
    name.trim();

  if (value.length < 2) {
    return true;
  }

  if (
    /^\d+(?:[,.]\d+)?$/.test(value)
  ) {
    return true;
  }

  if (
    /^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(value)
  ) {
    return true;
  }

  const bad =
    [
      "Maç Sonucu",
      "İlk Yarı Sonucu",
      "Alt Üst",
      "İY",
      "MS",
      "H1",
      "H2",
      "İY1",
      "İY2",
      "Tümü",
      "Sadece Oynanmamış Maçlar"
    ];

  const normalized =
    normalize(value);

  for (const item of bad) {
    if (
      normalized ===
      normalize(item)
    ) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   TOPLAM SAYI
========================================================= */

function extractTotalLine(text) {
  if (!text) {
    return null;
  }

  /*
   * TS genellikle son tarafta:
   *
   * 165,50
   * 182,50
   * 174,50
   */

  const values =
    [...text.matchAll(
      /\b(\d{3}[,.]\d{1,2})\b/g
    )];

  if (!values.length) {
    return null;
  }

  const value =
    values[values.length - 1][1];

  const number =
    Number(
      value.replace(",", ".")
    );

  return Number.isFinite(number)
    ? number
    : null;
}


/* =========================================================
   LİG BUL
========================================================= */

function detectLeague(line) {
  if (!line) {
    return null;
  }

  const known =
    [
      "Türkiye Sigorta Basketbol Süper Ligi",
      "İspanya ACB Ligi",
      "Fransa LNB Pro A",
      "ABD NBA Ön Sezon",
      "İtalya Serie A",
      "ABD WNBA Yarı Final",
      "Almanya BBL",
      "Yunanistan Basket Ligi",
      "VTB Ligi Normal Sezon",
      "Adriyatik ABA Ligi Grup A",
      "Adriyatik ABA Ligi Grup B",
      "Güney Kore KBL",
      "Polonya Energa Basket Liga",
      "Almanya Pro A",
      "İngiltere Britanya Basketbol Ligi",
      "İspanya Primera FEB Ligi",
      "İtalya Serie A2",
      "Çek Cumhuriyeti NBL",
      "Avusturya Superliga",
      "Arjantin A Lig",
      "İspanya Kadınlar Basketbol Ligi",
      "İtalya Lega Basket Kadınlar"
    ];

  const normalizedLine =
    normalize(line);

  for (const league of known) {

    if (
      normalizedLine.includes(
        normalize(league)
      )
    ) {
      return league;
    }
  }

  return null;
}


/* =========================================================
   TARİH
========================================================= */

function toIsoDate(
  day,
  month,
  year
) {
  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}


/* =========================================================
   ID
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
  ]
    .join("_")
    .replace(/[^a-z0-9çğıöşü]+/gi, "_");
}


/* =========================================================
   ESKİ VERİYİ OKU
========================================================= */

function readOldData() {
  try {
    if (
      !fs.existsSync(DATA_FILE)
    ) {
      return {
        matches: []
      };
    }

    const raw =
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      );

    const json =
      JSON.parse(raw);

    if (
      Array.isArray(json)
    ) {
      return {
        matches: json
      };
    }

    return {
      matches:
        Array.isArray(json.matches)
          ? json.matches
          : []
    };

  } catch (error) {

    console.log(
      "⚠️ Eski veri okunamadı."
    );

    return {
      matches: []
    };
  }
}


/* =========================================================
   ESKİ + YENİ VERİ
========================================================= */

function mergeMatches(
  oldMatches,
  newMatches
) {
  const map =
    new Map();

  /*
   * Önce eski verileri koru.
   */

  for (
    const match of oldMatches
  ) {
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
   * Yeni program verisi eski
   * kaydın üzerine gelir.
   */

  for (
    const match of newMatches
  ) {

    if (!match.id) {
      continue;
    }

    const old =
      map.get(match.id);

    if (old) {

      map.set(
        match.id,
        {
          ...old,
          ...match,

          /*
           * Eğer eski maçta skor varsa
           * yeni program skorları null diye
           * ezmesin.
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
            match.halfAwayScore,

          status:
            old.status === "finished"
              ? "finished"
              : match.status
        }
      );

    } else {

      map.set(
        match.id,
        match
      );
    }
  }

  /*
   * Aşırı büyümeyi engelle.
   * Eski verilerden son 120 gün tutulur.
   */

  const cutoff =
    new Date();

  cutoff.setDate(
    cutoff.getDate() -
    MAX_HISTORY_DAYS
  );

  return [
    ...map.values()
  ].filter(match => {

    if (!match.date) {
      return false;
    }

    const date =
      new Date(
        `${match.date}T23:59:59`
      );

    return (
      !Number.isNaN(
        date.getTime()
      ) &&
      date >= cutoff
    );
  });
}


/* =========================================================
   DUPLICATE TEMİZLE
========================================================= */

function uniqueMatches(
  matches
) {
  const map =
    new Map();

  for (
    const match of matches
  ) {

    if (
      !match ||
      !match.home ||
      !match.away ||
      !match.date
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

    if (
      !map.has(id)
    ) {
      map.set(
        id,
        {
          ...match,
          id
        }
      );
    }
  }

  return [
    ...map.values()
  ];
}


/* =========================================================
   TEMİZLE
========================================================= */

function cleanLine(line) {
  if (!line) {
    return "";
  }

  return line
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   NORMALIZE
========================================================= */

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}


/* =========================================================
   ÇALIŞTIR
========================================================= */

main()
  .catch(error => {

    console.error("");
    console.error(
      "❌ BASKETBOL GÜNCELLEME HATASI"
    );

    console.error(
      error
    );

    process.exit(1);
  });
