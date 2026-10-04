import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const DATA_FILE = path.join(
  ROOT,
  "data",
  "basketball-history.json"
);

const BASE_URL = "https://arsiv.mackolik.com";

const STANDING_URL =
  `${BASE_URL}/Basketbol/Puan-Durumu`;

const DAYS_BACK = 60;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";


/* =========================================================
   YARDIMCILAR
========================================================= */

function normalize(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function cleanTeam(value) {
  return normalize(value)
    .replace(/\s+\([^)]+\)$/g, "")
    .trim();
}


function parseScore(value) {
  if (!value) return null;

  const m = String(value).match(
    /(\d+)\s*[-:]\s*(\d+)/
  );

  if (!m) return null;

  return {
    home: Number(m[1]),
    away: Number(m[2])
  };
}


function parseDate(value) {
  if (!value) return null;

  const text = normalize(value);

  let m = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})/
  );

  if (m) {
    const day = String(m[1]).padStart(2, "0");
    const month = String(m[2]).padStart(2, "0");
    const year = m[3];

    return `${year}-${month}-${day}`;
  }

  m = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }

  return null;
}


function daysAgo(days) {
  const d = new Date();

  d.setHours(0, 0, 0, 0);

  d.setDate(d.getDate() - days);

  return d;
}


function isWithin60Days(date) {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const minDate = daysAgo(DAYS_BACK);

  return parsed >= minDate && parsed <= today;
}


function makeId(date, home, away) {
  return [
    date,
    normalize(home).toLowerCase(),
    normalize(away).toLowerCase()
  ].join("|");
}


/* =========================================================
   HTTP
========================================================= */

async function get(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language":
        "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} - ${url}`
    );
  }

  return await response.text();
}


/* =========================================================
   HTML TEMİZLEME
========================================================= */

function stripHtml(html) {
  return normalize(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );
}


/* =========================================================
   SONUÇ SATIRI PARSER
========================================================= */

function parseResultRows(html) {

  const matches = [];

  /*
    Mackolik'in sonuç tablosu zaman zaman farklı
    class isimleri kullanabildiği için burada
    <tr> bazlı genel parser kullanıyoruz.
  */

  const rows =
    String(html || "")
      .match(/<tr[\s\S]*?<\/tr>/gi) || [];


  for (const row of rows) {

    const text = stripHtml(row);

    if (!text) continue;


    /*
      Tarih
      ör:
      4.10.2026
      03.10.2026
    */

    const dateMatch = text.match(
      /\b(\d{1,2}\.\d{1,2}\.\d{4})\b/
    );

    if (!dateMatch) continue;


    const date = parseDate(
      dateMatch[1]
    );

    if (!date) continue;

    if (!isWithin60Days(date)) continue;


    /*
      Maç skoru arıyoruz.
    */

    const scoreMatches = [
      ...text.matchAll(
        /(\d{1,3})\s*-\s*(\d{1,3})/g
      )
    ];

    if (!scoreMatches.length) {
      continue;
    }


    /*
      Genellikle ilk skor İY,
      ikinci skor MS olur.
    */

    let halfScore = null;
    let fullScore = null;


    if (scoreMatches.length >= 2) {

      halfScore = {
        home: Number(scoreMatches[0][1]),
        away: Number(scoreMatches[0][2])
      };

      fullScore = {
        home: Number(scoreMatches[1][1]),
        away: Number(scoreMatches[1][2])
      };

    } else {

      fullScore = {
        home: Number(scoreMatches[0][1]),
        away: Number(scoreMatches[0][2])
      };

    }


    /*
      Takım isimlerini skorun çevresinden
      yakalamaya çalışıyoruz.
    */

    const scoreIndex =
      text.indexOf(
        `${scoreMatches[0][1]} - ${scoreMatches[0][2]}`
      );


    let before = "";

    let after = "";


    if (scoreIndex >= 0) {

      before =
        text.slice(
          dateMatch.index + dateMatch[0].length,
          scoreIndex
        );

      after =
        text.slice(
          scoreIndex +
          `${scoreMatches[0][1]} - ${scoreMatches[0][2]}`.length
        );

    }


    /*
      before içerisindeki son anlamlı ifade
      ev sahibi olabilir.
    */

    let home = null;
    let away = null;


    const beforeParts =
      before
        .split(/\s{2,}|\|/)
        .map(cleanTeam)
        .filter(Boolean);


    const afterParts =
      after
        .split(/\s{2,}|\|/)
        .map(cleanTeam)
        .filter(Boolean);


    if (beforeParts.length) {
      home =
        beforeParts[beforeParts.length - 1];
    }


    if (afterParts.length) {

      away =
        afterParts.find(
          x =>
            x.length > 2 &&
            !/^(MS|UZ|İY|IY|H1|H2|TS)$/i.test(x)
        ) || null;

    }


    /*
      Yukarıdaki yöntem takım adlarını bulamazsa
      Mackolik'in yaygın " | " yapısını deneyelim.
    */

    if (!home || !away) {

      const parts =
        text
          .split(/\s{2,}|\|/)
          .map(cleanTeam)
          .filter(Boolean);


      const scoreText =
        `${scoreMatches[0][1]} - ${scoreMatches[0][2]}`;


      const index =
        parts.findIndex(
          x => x.includes(scoreText)
        );


      if (index > 0) {

        home =
          cleanTeam(parts[index - 1]);

        if (index + 1 < parts.length) {

          away =
            cleanTeam(parts[index + 1]);

        }

      }

    }


    /*
      Takım isimleri skor içinden bozulduysa
      satırın tamamından daha güvenli regex.
    */

    if (!home || !away) {

      const teamMatch =
        text.match(
          /(?:MS|UZ)?\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9.&'()\- ]{2,})\s+(\d{1,3})\s*-\s*(\d{1,3})\s+([A-Za-zÇĞİÖŞÜçğıöşü0-9.&'()\- ]{2,})/i
        );


      if (teamMatch) {

        home =
          cleanTeam(teamMatch[1]);

        away =
          cleanTeam(teamMatch[4]);

      }

    }


    if (!home || !away) continue;


    /*
      Çöp satırlarını engelle.
    */

    const invalid = [
      "puan",
      "fikstür",
      "sonuçlar",
      "macsonucu",
      "ilk yarı",
      "ilk yarı sonucu",
      "alt üst",
      "iddaa",
      "takım",
      "ms",
      "iy",
      "h1",
      "h2"
    ];


    const homeLower =
      normalize(home).toLowerCase();

    const awayLower =
      normalize(away).toLowerCase();


    if (
      invalid.includes(homeLower) ||
      invalid.includes(awayLower)
    ) {
      continue;
    }


    if (
      /^\d+(?:[.,]\d+)?$/.test(home) ||
      /^\d+(?:[.,]\d+)?$/.test(away)
    ) {
      continue;
    }


    if (
      homeLower === awayLower
    ) {
      continue;
    }


    /*
      Fazla uzun / tablo başlığı benzeri
      satırları ele.
    */

    if (
      home.length > 80 ||
      away.length > 80
    ) {
      continue;
    }


    const id =
      makeId(
        date,
        home,
        away
      );


    matches.push({

      id,

      date,

      home,

      away,

      homeScore:
        fullScore?.home ?? null,

      awayScore:
        fullScore?.away ?? null,

      halfHomeScore:
        halfScore?.home ?? null,

      halfAwayScore:
        halfScore?.away ?? null,

      totalScore:
        fullScore
          ? fullScore.home + fullScore.away
          : null,

      status:
        fullScore
          ? "finished"
          : "not_started",

      source:
        "mackolik",

      updatedAt:
        new Date().toISOString()

    });

  }


  return matches;
}


/* =========================================================
   PUAN DURUMU SAYFASINDAN LİG ID'LERİ
========================================================= */

function parseLeagueIds(html) {

  const ids = new Set();


  /*
    BasketbolStanding / Puan-Durumu
    bağlantılarındaki id değerlerini yakala.
  */

  const regex =
    /(?:Basketball\/Standing\/Default\.aspx\?id=|Basketbol\/Puan-Durumu\?id=)(\d+)/gi;


  for (
    const match of String(html).matchAll(regex)
  ) {

    ids.add(
      Number(match[1])
    );

  }


  /*
    Sayfada id bulunamazsa ana lig
    olarak 1'i kullan.
  */

  if (!ids.size) {
    ids.add(1);
  }


  return [...ids];
}


/* =========================================================
   FİKSTÜR AJAX SAYFASI
========================================================= */

async function fetchFixturePage(leagueId) {

  const urls = [

    `${BASE_URL}/AjaxHandlers/BasketballTabsHandler.aspx?id=${leagueId}&tab=2&type=tabs`,

    `${BASE_URL}/AjaxHandlers/BasketballTabsHandler.aspx?id=${leagueId}&tab=2&type=tabs&lang=tr`

  ];


  for (const url of urls) {

    try {

      const html =
        await get(url);

      if (
        html &&
        html.length > 100
      ) {

        return html;

      }

    } catch (error) {

      console.log(
        `⚠️ Fikstür alınamadı: ${error.message}`
      );

    }

  }


  return "";
}


/* =========================================================
   ANA İŞLEM
========================================================= */

async function main() {

  console.log("");
  console.log("========================================");
  console.log("🏀 MACKOLİK BASKETBOL GEÇMİŞİ");
  console.log("========================================");
  console.log(
    `📅 Geçmiş aralığı: ${DAYS_BACK} gün`
  );
  console.log("");


  let oldData = {
    matches: []
  };


  if (
    fs.existsSync(DATA_FILE)
  ) {

    try {

      oldData =
        JSON.parse(
          fs.readFileSync(
            DATA_FILE,
            "utf8"
          )
        );

    } catch {

      console.log(
        "⚠️ Eski history JSON okunamadı."
      );

    }

  }


  const oldMatches =
    Array.isArray(oldData.matches)
      ? oldData.matches
      : [];


  console.log(
    `Mevcut kayıt: ${oldMatches.length}`
  );


  /*
    Ana puan durumu sayfası
  */

  console.log("");
  console.log(
    "🏀 Mackolik basketbol sayfası alınıyor..."
  );


  let standingHtml = "";


  try {

    standingHtml =
      await get(
        STANDING_URL
      );

    console.log(
      `HTML uzunluğu: ${standingHtml.length}`
    );

  } catch (error) {

    console.error(
      `❌ Puan durumu alınamadı: ${error.message}`
    );

  }


  /*
    Lig ID'lerini bul
  */

  const leagueIds =
    parseLeagueIds(
      standingHtml
    );


  console.log(
    `Bulunan lig ID: ${leagueIds.join(", ")}`
  );


  /*
    Sonuçları birleştir
  */

  const allNew =
    [];


  /*
    Önce ana sayfadaki sonuçları dene.
  */

  const mainResults =
    parseResultRows(
      standingHtml
    );


  if (mainResults.length) {

    console.log(
      `Ana sayfa sonuçları: ${mainResults.length}`
    );

    allNew.push(
      ...mainResults
    );

  }


  /*
    Her lig için Fikstür AJAX.
  */

  for (
    const leagueId of leagueIds
  ) {

    console.log("");
    console.log(
      `📋 Lig ${leagueId} fikstürü alınıyor...`
    );


    const fixtureHtml =
      await fetchFixturePage(
        leagueId
      );


    if (!fixtureHtml) {

      console.log(
        "⚠️ Fikstür verisi boş."
      );

      continue;

    }


    console.log(
      `Fikstür HTML: ${fixtureHtml.length}`
    );


    const fixtureMatches =
      parseResultRows(
        fixtureHtml
      );


    console.log(
      `Fikstür sonuçları: ${fixtureMatches.length}`
    );


    allNew.push(
      ...fixtureMatches
    );

  }


  /*
    Tekilleştir
  */

  const map =
    new Map();


  for (
    const match of oldMatches
  ) {

    if (
      !match ||
      !match.id
    ) {
      continue;
    }


    if (
      !match.date ||
      !isWithin60Days(match.date)
    ) {
      continue;
    }


    map.set(
      match.id,
      match
    );

  }


  for (
    const match of allNew
  ) {

    if (
      !match ||
      !match.id
    ) {
      continue;
    }


    const old =
      map.get(
        match.id
      );


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
          Skor eski kayıtta varsa koru.
        */

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
          null

      }
    );

  }


  /*
    Sadece 60 günlük kayıtlar
  */

  const finalMatches =
    [...map.values()]
      .filter(
        match =>
          match.date &&
          isWithin60Days(
            match.date
          )
      )
      .sort(
        (a, b) =>
          String(b.date)
            .localeCompare(
              String(a.date)
            )
      );


  /*
    Yaz
  */

  const output = {

    source:
      STANDING_URL,

    updatedAt:
      new Date().toISOString(),

    daysBack:
      DAYS_BACK,

    matches:
      finalMatches

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


  const scored =
    finalMatches.filter(
      m =>
        Number.isFinite(
          m.homeScore
        ) &&
        Number.isFinite(
          m.awayScore
        )
    );


  const withHalf =
    finalMatches.filter(
      m =>
        Number.isFinite(
          m.halfHomeScore
        ) &&
        Number.isFinite(
          m.halfAwayScore
        )
    );


  console.log("");
  console.log("========================================");
  console.log("✅ BASKETBOL GEÇMİŞİ GÜNCELLENDİ");
  console.log("========================================");
  console.log(
    `Toplam kayıt: ${finalMatches.length}`
  );
  console.log(
    `Skorlu maç: ${scored.length}`
  );
  console.log(
    `İY skorlu maç: ${withHalf.length}`
  );
  console.log(
    `Geçmiş: ${DAYS_BACK} gün`
  );
  console.log(
    `Lig sayısı: ${leagueIds.length}`
  );
  console.log(
    `Dosya: ${DATA_FILE}`
  );
  console.log("========================================");


  /*
    Debug için son 10 kayıt
  */

  console.log("");
  console.log("SON KAYITLAR:");

  for (
    const match of finalMatches.slice(0, 10)
  ) {

    console.log(
      `${match.date} | ` +
      `${match.home} - ${match.away} | ` +
      `İY: ${
        match.halfHomeScore ?? "-"
      }-${
        match.halfAwayScore ?? "-"
      } | ` +
      `MS: ${
        match.homeScore ?? "-"
      }-${
        match.awayScore ?? "-"
      }`
    );

  }

  console.log("");

}


main().catch(
  error => {

    console.error("");
    console.error(
      "❌ BASKETBOL HISTORY HATASI"
    );

    console.error(
      error
    );

    process.exit(1);

  }
);
