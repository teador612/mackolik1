import https from "https";

const URLS = [
  "https://www.bilyoner.com/static/LiveScores.9c1b4952.js",
  "https://www.bilyoner.com/static/main.be011cf9.js",
  "https://www.bilyoner.com/static/1713.b62e873b.js",
  "https://www.bilyoner.com/static/4368.7cee4712.js"
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          Accept: "*/*"
        }
      },
      res => {
        let data = "";

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            type: res.headers["content-type"] || "",
            data
          });
        });
      }
    ).on("error", reject);
  });
}

function showContext(text, needle, radius = 1000) {
  let pos = 0;
  let count = 0;

  while (true) {
    const i = text.indexOf(needle, pos);

    if (i === -1) break;

    count++;

    console.log("\n----------------------------------------");
    console.log(`"${needle}" #${count}`);
    console.log("----------------------------------------");

    const start = Math.max(0, i - radius);
    const end = Math.min(text.length, i + needle.length + radius);

    console.log(text.slice(start, end));

    pos = i + needle.length;

    if (count >= 20) break;
  }

  return count;
}

function extractUrls(text) {
  const found = new Set();

  const patterns = [
    /https?:\/\/[^"'`\\\s)]+/g,
    /["'`]((?:\/|https?:\/\/)[^"'`\\\s)]+)["'`]/g
  ];

  for (const regex of patterns) {
    for (const match of text.matchAll(regex)) {
      const url = match[1] || match[0];

      if (
        url.includes("api") ||
        url.includes("score") ||
        url.includes("event") ||
        url.includes("sport") ||
        url.includes("match") ||
        url.includes("basket") ||
        url.includes("live") ||
        url.includes("sbs")
      ) {
        found.add(url);
      }
    }
  }

  return [...found];
}

for (const url of URLS) {
  console.log("\n\n========================================");
  console.log("JS:", url);
  console.log("========================================");

  try {
    const result = await fetchText(url);

    console.log("HTTP:", result.status);
    console.log("Content-Type:", result.type);
    console.log("Uzunluk:", result.data.length);

    if (result.status !== 200) {
      continue;
    }

    const text = result.data;

    const needles = [
      "getLiveScoresEvents",
      "liveScoresEvents",
      "getLiveScoresHeaders",
      "eventScores",
      "basketballEvents",
      "sbsEventId",
      "currentScore",
      "halfScore",
      "matchStatus",
      "axios",
      "fetch(",
      ".get(",
      ".post(",
      "/api/",
      "aping.bilyoner.com",
      "sportcenter.sir.sportradar.com",
      "live-score",
      "live-scores",
      "scores",
      "events"
    ];

    for (const needle of needles) {
      const count = showContext(text, needle, 1200);

      if (count > 0) {
        console.log(`\n➡️ ${needle}: ${count}`);
      }
    }

    console.log("\n\n🔗 URL ADAYLARI:");

    const urls = extractUrls(text);

    for (const candidate of urls) {
      console.log(candidate);
    }

  } catch (err) {
    console.log("HATA:", err.message);
  }
}

console.log("\n========================================");
console.log("🏁 KEŞİF BİTTİ");
console.log("========================================");
