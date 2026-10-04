/**
 * BILYONER BASKETBOL TEST
 *
 * AMAÇ:
 * - Bilyoner basketbol sayfasına erişebiliyor muyuz?
 * - HTML / JSON içinde maç verisi geliyor mu?
 * - Takım, lig ve skor bilgileri bulunabiliyor mu?
 *
 * ÖNEMLİ:
 * Bu dosya basketball-history.json DOSYASINA YAZMAZ.
 */

const URLS = [
  "https://www.bilyoner.com/canli-skor/basketbol-canli-skor",
  "https://www.bilyoner.com/canli-iddaa/basketbol"
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

  "Accept-Language":
    "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",

  "Cache-Control": "no-cache",

  "Pragma": "no-cache"
};

function clean(value) {
  return String(value || "")
    .replace(/\\u002F/g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonCandidates(html) {
  const found = [];

  const patterns = [
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,

    /<script[^>]*>([\s\S]*?__NEXT_DATA__[\s\S]*?)<\/script>/gi,

    /window\.__INITIAL_STATE__\s*=\s*([\s\S]*?);/gi,

    /window\.__NEXT_DATA__\s*=\s*([\s\S]*?);/gi
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      if (match[1]) {
        found.push(clean(match[1]));
      }
    }
  }

  return found;
}

function findInterestingStrings(html) {
  const keywords = [
    "basketbol",
    "basketball",
    "EuroLeague",
    "EuroCup",
    "NBA",
    "FIBA",
    "MS",
    "PERİYOT",
    "period",
    "score",
    "homeTeam",
    "awayTeam",
    "match"
  ];

  const lines = html
    .replace(/></g, ">\n<")
    .split("\n")
    .map(x => clean(x))
    .filter(Boolean);

  const result = [];

  for (const line of lines) {
    const low = line.toLowerCase();

    if (keywords.some(k => low.includes(k.toLowerCase()))) {
      result.push(line);
    }

    if (result.length >= 80) {
      break;
    }
  }

  return result;
}

async function fetchPage(url) {
  console.log("\n========================================");
  console.log("URL:", url);
  console.log("========================================");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      redirect: "follow"
    });

    console.log("HTTP:", response.status);
    console.log("Final URL:", response.url);

    const text = await response.text();

    console.log("HTML uzunluğu:", text.length);

    if (!text) {
      console.log("❌ Boş cevap");
      return null;
    }

    if (response.status !== 200) {
      console.log("❌ HTTP başarılı değil");
      console.log(text.slice(0, 1000));
      return null;
    }

    return text;

  } catch (error) {
    console.log("❌ İstek hatası:", error.message);
    return null;
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("🏀 BILYONER BASKETBOL TEST");
  console.log("========================================");
  console.log("📌 Mevcut basketball-history.json değiştirilmeyecek.");
  console.log("");

  let successful = false;

  for (const url of URLS) {
    const html = await fetchPage(url);

    if (!html) {
      continue;
    }

    successful = true;

    console.log("");
    console.log("---------- JSON ADAYLARI ----------");

    const jsonCandidates = extractJsonCandidates(html);

    console.log(
      "Bulunan JSON/script adayı:",
      jsonCandidates.length
    );

    for (let i = 0; i < Math.min(jsonCandidates.length, 10); i++) {
      console.log("");
      console.log(`JSON ADAYI #${i + 1}`);
      console.log(jsonCandidates[i].slice(0, 2000));
    }

    console.log("");
    console.log("---------- İLGİLİ SATIRLAR ----------");

    const interesting = findInterestingStrings(html);

    console.log(
      "Bulunan ilgili satır:",
      interesting.length
    );

    for (const line of interesting) {
      console.log(line.slice(0, 1000));
    }

    console.log("");
    console.log("---------- HAM HTML BAŞLANGICI ----------");
    console.log(html.slice(0, 3000));

    console.log("");
    console.log("---------- TEST SONUCU ----------");

    if (
      html.includes("basketbol") ||
      html.includes("Basketbol") ||
      html.includes("basketball") ||
      html.includes("Basketball")
    ) {
      console.log("✅ Basketbol içeriği bulundu.");
    } else {
      console.log("⚠️ Basketbol kelimesi HTML içinde bulunamadı.");
    }

    if (
      html.includes("EuroLeague") ||
      html.includes("Euroleague") ||
      html.includes("NBA") ||
      html.includes("EuroCup")
    ) {
      console.log("✅ Lig bilgisi bulundu.");
    } else {
      console.log("⚠️ Bilinen lig adı bulunamadı.");
    }

    if (
      /\d+\s*-\s*\d+/.test(html)
    ) {
      console.log("✅ Skor formatına benzeyen veri bulundu.");
    } else {
      console.log("⚠️ Skor bulunamadı.");
    }

    console.log("");
    console.log("Bu URL başarıyla cevap verdi.");
    console.log("Veri yapısını bir sonraki aşamada ayrıştırabiliriz.");

    break;
  }

  if (!successful) {
    console.log("");
    console.log("========================================");
    console.log("❌ BILYONER TEST BAŞARISIZ");
    console.log("========================================");
    console.log("");
    console.log("GitHub Actions üzerinden Bilyoner'e erişilemiyor.");
    console.log("");
  }

  console.log("");
  console.log("🏁 Test tamamlandı.");
}

main().catch(error => {
  console.error("");
  console.error("❌ BEKLENMEYEN HATA");
  console.error(error);
  process.exit(1);
});
