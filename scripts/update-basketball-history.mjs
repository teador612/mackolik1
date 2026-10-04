/**
 * BILYONER BASKETBOL VERİ TESTİ
 *
 * SADECE TEST
 * basketball-history.json DEĞİŞTİRİLMEZ.
 */

const BASE = "https://www.bilyoner.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

  "Accept":
    "application/json,text/plain,*/*",

  "Accept-Language":
    "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",

  "Referer":
    "https://www.bilyoner.com/canli-skor/basketbol-canli-skor",

  "Origin":
    "https://www.bilyoner.com",

  "Cache-Control":
    "no-cache",

  "Pragma":
    "no-cache"
};

const ENDPOINTS = [
  "/mobile/live-score/header",

  "/mobile/live-stream/events",

  "/mobile/live-stream/header/v2",

  "/api/sse/subscribe",

  "/canli-iddaa/basketbol",

  "/canli-skor/basketbol-canli-skor",

  "/api"
];

function clean(value) {
  return String(value || "")
    .replace(/\\u002F/g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function printPreview(text) {
  const value = clean(text);

  console.log("");
  console.log("---------- CEVAP BAŞLANGICI ----------");
  console.log(value.slice(0, 10000));
  console.log("---------- CEVAP SONU ----------");
  console.log("");
}

function searchMatchPatterns(text) {
  const patterns = [
    /\d{1,3}\s*[-:]\s*\d{1,3}/g,

    /"homeTeam"\s*:\s*"([^"]+)"/gi,

    /"awayTeam"\s*:\s*"([^"]+)"/gi,

    /"home"\s*:\s*"([^"]+)"/gi,

    /"away"\s*:\s*"([^"]+)"/gi,

    /"homeScore"\s*:\s*(\d+)/gi,

    /"awayScore"\s*:\s*(\d+)/gi,

    /"eventId"\s*:\s*"?([^",}]+)"?/gi,

    /"betRadarId"\s*:\s*"?([^",}]+)"?/gi,

    /"leagueId"\s*:\s*"?([^",}]+)"?/gi,

    /"sportId"\s*:\s*"?([^",}]+)"?/gi
  ];

  for (const regex of patterns) {
    const matches = [...text.matchAll(regex)];

    if (matches.length) {
      console.log("");
      console.log(
        `🔎 ${regex} -> ${matches.length} eşleşme`
      );

      for (const match of matches.slice(0, 20)) {
        console.log(
          " ",
          match[0].slice(0, 500)
        );
      }
    }
  }
}

async function request(url, method = "GET") {
  console.log("");
  console.log("========================================");
  console.log("URL:", url);
  console.log("METHOD:", method);
  console.log("========================================");

  try {
    const response = await fetch(url, {
      method,
      headers: HEADERS,
      redirect: "follow"
    });

    const text = await response.text();

    console.log("HTTP:", response.status);
    console.log("Final URL:", response.url);
    console.log(
      "Content-Type:",
      response.headers.get("content-type")
    );
    console.log(
      "Uzunluk:",
      text.length
    );

    if (text) {
      printPreview(text);
      searchMatchPatterns(text);
    }

    return {
      status: response.status,
      ok: response.ok,
      text
    };

  } catch (error) {
    console.log(
      "❌ HATA:",
      error.message
    );

    return {
      status: 0,
      ok: false,
      text: ""
    };
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("🏀 BILYONER BASKETBOL VERİ TESTİ");
  console.log("========================================");
  console.log("");
  console.log(
    "📌 basketball-history.json DEĞİŞTİRİLMEYECEK."
  );
  console.log("");

  /*
   * --------------------------------------------------
   * 1. LIVE SCORE HEADER
   * --------------------------------------------------
   */

  await request(
    BASE + "/mobile/live-score/header"
  );

  /*
   * --------------------------------------------------
   * 2. LIVE STREAM EVENTS
   * --------------------------------------------------
   */

  await request(
    BASE + "/mobile/live-stream/events"
  );

  /*
   * --------------------------------------------------
   * 3. LIVE STREAM HEADER
   * --------------------------------------------------
   */

  await request(
    BASE + "/mobile/live-stream/header/v2"
  );

  /*
   * --------------------------------------------------
   * 4. CANLI IDDAA
   * --------------------------------------------------
   */

  await request(
    BASE + "/canli-iddaa/basketbol"
  );

  /*
   * --------------------------------------------------
   * 5. CANLI SKOR
   * --------------------------------------------------
   */

  await request(
    BASE + "/canli-skor/basketbol-canli-skor"
  );

  /*
   * --------------------------------------------------
   * 6. API ROOT
   * --------------------------------------------------
   */

  await request(
    BASE + "/api"
  );

  /*
   * --------------------------------------------------
   * SON
   * --------------------------------------------------
   */

  console.log("");
  console.log("========================================");
  console.log("🏁 BILYONER TEST TAMAMLANDI");
  console.log("========================================");
}

main().catch(error => {
  console.error("");
  console.error("❌ BEKLENMEYEN HATA");
  console.error(error);
  process.exit(1);
});
