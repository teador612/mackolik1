import fs from "fs/promises";

const BASE = "https://www.bilyoner.com";

const JS_URLS = [
  "https://www.bilyoner.com/static/LiveScores.9c1b4952.js",
  "https://www.bilyoner.com/static/main.be011cf9.js",
];

const SEARCH_TERMS = [
  "/api/",
  "api/",
  "api.",
  "fetch(",
  "axios",
  "live-score",
  "liveScore",
  "live-score/header",
  "live-stream",
  "basketball",
  "basketbol",
  "matches",
  "events",
  "scores",
  "score",
  "fixture",
  "fixtures",
  "results",
  "result",
  "match",
  "event",
  "league",
  "lig-karti",
  "mac-karti",
  "spor-data",
  "aggregator",
];

function unique(arr) {
  return [...new Set(arr)];
}

function extractUrls(text) {
  const urls = [];

  const patterns = [
    /https?:\/\/[^"'`\s\\]+/g,
    /["'`]((?:\/|https?:\/\/)[^"'`]+)["'`]/g,
  ];

  for (const regex of patterns) {
    for (const m of text.matchAll(regex)) {
      const value = m[1] || m[0];

      if (
        value.includes("bilyoner") ||
        value.startsWith("/api") ||
        value.startsWith("/mobile") ||
        value.startsWith("/v3") ||
        value.startsWith("/sports-data") ||
        value.startsWith("/lig-") ||
        value.startsWith("/mac-") ||
        value.startsWith("/canli-")
      ) {
        urls.push(value);
      }
    }
  }

  return unique(urls);
}

function context(text, index, radius = 500) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);

  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url) {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return BASE + url;
  }

  return null;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  return {
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    text: await res.text(),
  };
}

console.log("========================================");
console.log("🏀 BILYONER GERÇEK API KEŞİF TESTİ");
console.log("========================================\n");

const allCandidates = [];

for (const jsUrl of JS_URLS) {
  console.log("\n========================================");
  console.log("📦 JS:", jsUrl);
  console.log("========================================");

  try {
    const result = await fetchText(jsUrl);

    console.log("HTTP:", result.status);
    console.log("Content-Type:", result.contentType);
    console.log("Uzunluk:", result.text.length);

    if (result.status !== 200) {
      continue;
    }

    const js = result.text;

    const urls = extractUrls(js);

    console.log("Bulunan URL adayı:", urls.length);

    for (const url of urls) {
      allCandidates.push(url);
    }

    for (const term of SEARCH_TERMS) {
      const lower = js.toLowerCase();
      const needle = term.toLowerCase();

      let pos = 0;
      let count = 0;

      while (true) {
        const found = lower.indexOf(needle, pos);

        if (found === -1) break;

        count++;

        if (count <= 3) {
          console.log(`\n🔎 "${term}" bulundu:`);
          console.log(context(js, found, 700));
        }

        pos = found + needle.length;
      }

      if (count > 0) {
        console.log(`➡️ "${term}" toplam: ${count}`);
      }
    }

    console.log("\n--- URL ADAYLARI ---");

    for (const url of unique(urls)) {
      console.log(url);
    }
  } catch (err) {
    console.log("❌ HATA:", err.message);
  }
}

console.log("\n========================================");
console.log("🌐 TOPLAM URL ADAYLARI");
console.log("========================================");

const normalized = unique(
  allCandidates
    .map(normalizeUrl)
    .filter(Boolean)
);

for (const url of normalized) {
  console.log(url);
}

console.log("\n========================================");
console.log("🧪 MUHTEMEL API URL'LERİ TEST EDİLİYOR");
console.log("========================================");

const likely = normalized.filter((url) => {
  const x = url.toLowerCase();

  return (
    x.includes("/api") ||
    x.includes("aggregator") ||
    x.includes("sports-data") ||
    x.includes("live-score") ||
    x.includes("live-stream") ||
    x.includes("match") ||
    x.includes("event") ||
    x.includes("score") ||
    x.includes("fixture") ||
    x.includes("result") ||
    x.includes("league") ||
    x.includes("lig-") ||
    x.includes("mac-")
  );
});

for (const url of unique(likely)) {
  try {
    const result = await fetchText(url);

    console.log("\n----------------------------------------");
    console.log("URL:", url);
    console.log("HTTP:", result.status);
    console.log("Type:", result.contentType);
    console.log("Length:", result.text.length);

    if (
      result.contentType.includes("json") ||
      result.text.trim().startsWith("{") ||
      result.text.trim().startsWith("[")
    ) {
      console.log(
        result.text
          .slice(0, 5000)
          .replace(/\s+/g, " ")
      );
    }
  } catch (err) {
    console.log("❌", err.message);
  }
}

console.log("\n========================================");
console.log("🏁 TEST BİTTİ");
console.log("========================================");
