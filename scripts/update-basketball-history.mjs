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

  d.setDate(
    d.getDate() - DAYS_BACK
  );

  return d;
}

function isWithinHistory(date) {
  const d = new Date(
    `${date}T00:00:00`
  );

  return (
    Number.isFinite(d.getTime()) &&
    d >= getStartDate()
  );
}

function makeId(
  date,
  home,
  away
) {
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
    const response = await fetch(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language":
            "tr-TR,tr;q=0.9,en;q=0.8",
          "Cache-Control":
            "no-cache"
        }
      }
    );

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
   ESKİ VERİ
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

    const json =
      JSON.parse(raw);

    if (Array.isArray(json)) {
      return json;
    }

    if (
      json &&
      Array.isArray(
        json.matches
      )
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
   TÜM BASKETBOL LİGLERİNİ BUL
========================================================= */

function parseLeagueLinks(html) {
  const $ = cheerio.load(html);

  const leagues =
    new Map();

  $("a[href]").each(
    (_, element) => {
      const href =
        $(element).attr("href") ||
        "";

      const text =
        normalizeText(
          $(element).text()
        );

      /*
       * GERÇEK MACKOLIK YAPISI
       *
       * Basketball/Standing/Default.aspx?id=1
       *
       * Bazı eski sayfalarda:
       *
       * Basketball/Standing/Default.aspx?sId=1031
       */

      const match =
        href.match(
          /\/Basketball\/Standing\/Default\.aspx\?(?:[^"'#]*&)?(?:id|sId)=(\d+)/i
        );

      if (!match) {
        return;
      }

      const id =
        match[1];

      /*
       * Aynı lig birden fazla kez
       * görünmesin.
       */

      if (
        leagues.has(id)
      ) {
        return;
      }

      const absoluteUrl =
        new URL(
          href,
          BASE_URL
        ).href;

      leagues.set(
        id,
        {
          id,
          name:
            text ||
            `Basketbol Ligi ${id}`,
          url:
            absoluteUrl
        }
      );
    }
  );

  return [
    ...leagues.values()
  ];
}

/* =========================================================
   LİG SAYFASINDAN SONUÇLARI ÇIKAR
========================================================= */

function parseLeagueResults(
  html,
  league
) {
  const $ =
    cheerio.load(html);

  const results = [];

  $("tr").each(
    (_, row) => {

      const cells =
        $(row)
          .find("td")
          .map(
            (_, td) =>
              normalizeText(
                $(td).text()
              )
          )
          .get();

      if (
        cells.length < 3
      ) {
        return;
      }

      const rowText =
        normalizeText(
          cells.join(" | ")
        );

      /*
       * Tarih
       */

      const dateMatch =
        rowText.match(
          /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/
        );

      if (!dateMatch) {
        return;
      }

      const date =
        parseDate(
          dateMatch[1]
        );

      if (!date) {
        return;
      }

      /*
       * Son 60 gün
       */

      if (
        !isWithinHistory(
          date
        )
      ) {
        return;
      }

      /*
       * Skorları bul
       */

      const scoreMatches = [
        ...rowText.matchAll(
          /(\d+)\s*-\s*(\d+)/g
        )
      ];

      if (
        scoreMatches.length === 0
      ) {
        return;
      }

      /*
       * Lig sayfasındaki ilk gerçek
       * maç skoru MS skorudur.
       */

      const score =
        scoreMatches[
          0
        ];

      const homeScore =
        Number(score[1]);

      const awayScore =
        Number(score[2]);

      if (
        !Number.isFinite(
          homeScore
        ) ||
        !Number.isFinite(
          awayScore
        )
      ) {
        return;
      }

      /*
       * Takımları bul.
       *
       * Mackolik sonuç yapısı genellikle:
       *
       * tarih
       * MS
       * ev sahibi
       * 80 - 88
       * deplasman
       */

      let home = "";
      let away = "";

      /*
       * Skorun bulunduğu hücrenin
       * çevresindeki hücrelere bak.
       */

      for (
        let i = 0;
        i < cells.length;
        i++
      ) {
        const cell =
          cells[i];

        if (
          !/\d+\s*-\s*\d+/.test(
            cell
          )
        ) {
          continue;
        }

        const before =
          cells[i - 1] ||
          "";

        const after =
          cells[i + 1] ||
          "";

        /*
         * Önceki hücre ev sahibi,
         * sonraki hücre deplasman.
         */

        if (
          before &&
          after &&
          !/\d+\.\d+\.\d+/.test(
            before
          ) &&
          !/\d+\.\d+\.\d+/.test(
            after
          ) &&
          !/^\d{1,2}:\d{2}$/.test(
            before
          ) &&
          !/^\d{1,2}:\d{2}$/.test(
            after
          )
        ) {
          home =
            before;

          away =
            after;

          break;
        }
      }

      /*
       * Alternatif yapı:
       *
       * tarih | MS | ev sahibi | skor | deplasman
       */

      if (
        !home ||
        !away
      ) {
        const teamCandidates =
          cells.filter(
            cell => {

              if (!cell) {
                return false;
              }

              if (
                /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(
                  cell
                )
              ) {
                return false;
              }

              if (
                /^\d{1,2}:\d{2}$/.test(
                  cell
                )
              ) {
                return false;
              }

              if (
                /^\d+\s*-\s*\d+$/.test(
                  cell
                )
              ) {
                return false;
              }

              if (
                /^(MS|İY|UZ|ERT|CANLI)$/i.test(
                  cell
                )
              ) {
                return false;
              }

              return (
                cell.length >= 2
              );
            }
          );

        if (
          teamCandidates.length >= 2
        ) {
          home =
            teamCandidates[
              teamCandidates.length - 2
            ];

          away =
            teamCandidates[
              teamCandidates.length - 1
            ];
        }
      }

      /*
       * Bazı satırlarda takım isimleri
       * tek hücrede olabilir.
       */

      if (
        (!home || !away) &&
        cells.length >= 3
      ) {
        for (
          const cell of cells
        ) {

          if (
            !cell.includes(
              `${homeScore} - ${awayScore}`
            )
          ) {
            continue;
          }

          const parts =
            cell.split(
              `${homeScore} - ${awayScore}`
            );

          if (
            parts.length >= 2
          ) {
            const left =
              normalizeText(
                parts[0]
              );

            const right =
              normalizeText(
                parts[1]
              );

            if (
              left &&
              right
            ) {
              home =
                left;

              away =
                right;
            }
          }
        }
      }

      if (
        !home ||
        !away
      ) {
        return;
      }

      /*
       * Yanlış takım eşleşmesi
       */

      if (
        normalizeTeam(home) ===
        normalizeTeam(away)
      ) {
        return;
      }

      /*
       * Takım isminde gereksiz kolon
       * kalmışsa temizle.
       */

      home =
        normalizeText(
          home
        );

      away =
        normalizeText(
          away
        );

      /*
       * İlk yarı şimdilik null.
       *
       * Lig sonuç sayfasında MS skor
       * kesin olarak alınır.
       */

      const match = {
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

        halfHomeScore:
          null,

        halfAwayScore:
          null,

        total:
          homeScore +
          awayScore,

        league:
          league.name,

        leagueId:
          league.id,

        source:
          "mackolik"
      };

      results.push(
        match
      );
    }
  );

  /*
   * Aynı maçı iki kez alma.
   */

  const unique =
    new Map();

  for (
    const match of results
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
   BİRLEŞTİR
========================================================= */

function mergeMatches(
  oldMatches,
  newMatches
) {
  const map =
    new Map();

  /*
   * Eski veriler korunur.
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
   * Yeni sonuçlar eklenir.
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

    if (
      normalizeTeam(
        match.home
      ) ===
      normalizeTeam(
        match.away
      )
    ) {
      continue;
    }

    /*
     * Skorlu basketbol maçı.
     */

    const validScore =
      Number.isFinite(
        Number(
          match.homeScore
        )
      ) &&
      Number.isFinite(
        Number(
          match.awayScore
        )
      );

    /*
     * Eski program kayıtları da
     * korunabilsin.
     */

    const validBasic =
      match.total !== null &&
      match.total !== undefined;

    if (
      !validScore &&
      !validBasic
    ) {
      continue;
    }

    map.set(
      match.id ||
        makeId(
          match.date,
          match.home,
          match.away
        ),
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
   * BASKETBOL ANA SAYFASI
   * -------------------------------------------------------
   */

  console.log(
    "\n🏀 Mackolik basketbol sayfası alınıyor..."
  );

  const html =
    await fetchHtml(
      BASKETBALL_URL
    );

  if (!html) {
    throw new Error(
      "Basketbol ana sayfası alınamadı."
    );
  }

  console.log(
    `Basketbol HTML uzunluğu: ${html.length}`
  );

  /*
   * -------------------------------------------------------
   * TÜM LİGLER
   * -------------------------------------------------------
   */

  const leagues =
    parseLeagueLinks(
      html
    );

  console.log(
    `🏆 Bulunan basketbol ligi: ${leagues.length}`
  );

  if (
    leagues.length === 0
  ) {

    console.log(
      "\n⚠️ Hiç basketbol ligi bulunamadı."
    );

    console.log(
      "Mackolik HTML yapısı kontrol edilmeli."
    );

    /*
     * Eski veriyi koru.
     */

    return;
  }

  /*
   * İlk birkaç ligi logla.
   * Böylece Actions çıktısından
   * gerçekten linkleri bulduğumuzu
   * görebiliriz.
   */

  console.log(
    "\n📋 İlk bulunan ligler:"
  );

  leagues
    .slice(0, 10)
    .forEach(
      league => {
        console.log(
          `   • ${league.name} → ${league.url}`
        );
      }
    );

  /*
   * -------------------------------------------------------
   * TÜM LİGLERİ TARA
   * -------------------------------------------------------
   */

  console.log(
    "\n🔎 Basketbol ligleri taranıyor..."
  );

  const allNewMatches =
    [];

  let successful =
    0;

  let failed =
    0;

  for (
    let i = 0;
    i < leagues.length;
    i++
  ) {

    const league =
      leagues[i];

    console.log(
      `\n[${i + 1}/${leagues.length}] ${league.name}`
    );

    console.log(
      `   🔗 ${league.url}`
    );

    const leagueHtml =
      await fetchHtml(
        league.url
      );

    if (!leagueHtml) {
      failed++;
      continue;
    }

    const results =
      parseLeagueResults(
        leagueHtml,
        league
      );

    console.log(
      `   → ${results.length} maç`
    );

    if (
      results.length > 0
    ) {
      successful++;

      allNewMatches.push(
        ...results
      );
    }

    /*
     * Mackolik'e çok hızlı
     * istek göndermeyelim.
     */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );
  }

  /*
   * -------------------------------------------------------
   * BİRLEŞTİR
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
   * İSTATİSTİK
   * -------------------------------------------------------
   */

  const leagueSet =
    new Set(
      cleaned
        .map(
          match =>
            match.leagueId ||
            match.league
        )
        .filter(Boolean)
    );

  const dateSet =
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

  /*
   * -------------------------------------------------------
   * JSON
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
          BASKETBALL_URL,

        updatedAt:
          new Date().toISOString(),

        historyDays:
          DAYS_BACK,

        leagueCount:
          leagueSet.size,

        dateCount:
          dateSet.size,

        matches:
          cleaned
      },
      null,
      2
    )
  );

  /*
   * -------------------------------------------------------
   * SONUÇ
   * -------------------------------------------------------
   */

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
    `Bulunan yeni sonuç: ${newIds.size}`
  );

  console.log(
    `Toplam benzersiz maç: ${cleaned.length}`
  );

  console.log(
    `Skorlu maç: ${scored.length}`
  );

  console.log(
    `Lig sayısı: ${leagueSet.size}`
  );

  console.log(
    `Tarih sayısı: ${dateSet.size}`
  );

  console.log(
    `Başarılı lig: ${successful}`
  );

  console.log(
    `Hatalı/boş lig: ${failed}`
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
    `🏆 ${leagueSet.size} lig`
  );

  console.log(
    `📅 ${dateSet.size} farklı tarih`
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
