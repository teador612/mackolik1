/**
 * BILYONER BASKETBOL API TEST
 *
 * AMAÇ:
 * Bilyoner sayfasındaki INITIAL_STATE ve JavaScript bundle
 * içindeki API endpointlerini bulmak.
 *
 * basketball-history.json DEĞİŞTİRİLMEZ.
 */

const PAGE =
  "https://www.bilyoner.com/canli-skor/basketbol-canli-skor";

const BASE =
  "https://www.bilyoner.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",

  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9," +
    "image/avif,image/webp,*/*;q=0.8",

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

function unique(arr) {
  return [...new Set(arr)];
}

function extractScriptUrls(html) {
  const urls = [];

  const regex =
    /<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    let url = match[1];

    if (url.startsWith("/")) {
      url = BASE + url;
    } else if (url.startsWith("//")) {
      url = "https:" + url;
    }

    urls.push(url);
  }

  return unique(urls);
}

function extractApiCandidates(text) {
  const results = [];

  /*
   * URL formatları
   */
  const urlRegex =
    /https?:\/\/[^"'`\\\s]+/gi;

  for (const match of text.matchAll(urlRegex)) {
    const value = clean(match[0]);

    if (
      /api|aping|score|match|event|basket|sport|live/i.test(value)
    ) {
      results.push(value);
    }
  }

  /*
   * Relative API yolları
   */
  const relativeRegex =
    /["'`]((?:\/|api\/|v\d\/)[A-Za-z0-9_?=&./:{}-]*(?:api|score|match|event|sport|live|basket)[A-Za-z0-9_?=&./:{}-]*)["'`]/gi;

  for (const match of text.matchAll(relativeRegex)) {
    results.push(clean(match[1]));
  }

  /*
   * Özellikle aping.bilyoner.com geçen parçalar
   */
  const apiingRegex =
    /aping\.bilyoner\.com[^"'`\\\s]*/gi;

  for (const match of text.matchAll(apiingRegex)) {
    results.push(
      "https://" + clean(match[0])
    );
  }

  return unique(results);
}

function findStateInfo(html) {
  const result = {};

  const initialIndex =
    html.indexOf("window.INITIAL_STATE");

  if (initialIndex < 0) {
    result.found = false;
    return result;
  }

  result.found = true;

  const start =
    Math.max(0, initialIndex - 500);

  const end =
    Math.min(html.length, initialIndex + 150000);

  result.sample =
    html.slice(start, end);

  return result;
}

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      redirect: "follow"
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text
    };

  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      text: "",
      error: error.message
    };
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("🏀 BILYONER API KEŞİF TESTİ");
  console.log("========================================");
  console.log("");
  console.log("📌 basketball-history.json DEĞİŞTİRİLMEYECEK");
  console.log("");

  /*
   * ----------------------------------------------------
   * 1) ANA SAYFA
   * ----------------------------------------------------
   */

  console.log("1️⃣ Bilyoner basketbol sayfası alınıyor...");

  const page = await fetchText(PAGE);

  console.log("HTTP:", page.status);
  console.log("Final URL:", page.url);
  console.log("HTML:", page.text.length);

  if (!page.ok) {
    console.log("");
    console.log("❌ Bilyoner sayfası alınamadı.");
    console.log(page.error || "");
    process.exit(1);
  }

  console.log("✅ Ana sayfa alındı.");

  /*
   * ----------------------------------------------------
   * 2) SCRIPT DOSYALARI
   * ----------------------------------------------------
   */

  console.log("");
  console.log("2️⃣ JavaScript dosyaları aranıyor...");

  const scripts =
    extractScriptUrls(page.text);

  console.log(
    "Bulunan JS:",
    scripts.length
  );

  for (const url of scripts) {
    console.log(" -", url);
  }

  /*
   * ----------------------------------------------------
   * 3) INITIAL_STATE
   * ----------------------------------------------------
   */

  console.log("");
  console.log("3️⃣ INITIAL_STATE kontrol ediliyor...");

  const state =
    findStateInfo(page.text);

  if (state.found) {
    console.log("✅ window.INITIAL_STATE bulundu.");

    const candidates =
      extractApiCandidates(state.sample);

    console.log(
      "INITIAL_STATE içinden API adayı:",
      candidates.length
    );

    for (const item of candidates) {
      console.log("API:", item);
    }

  } else {
    console.log(
      "⚠️ INITIAL_STATE bulunamadı."
    );
  }

  /*
   * ----------------------------------------------------
   * 4) ANA HTML'DEN API ARAMA
   * ----------------------------------------------------
   */

  console.log("");
  console.log("4️⃣ HTML içerisinden API aranıyor...");

  const htmlApis =
    extractApiCandidates(page.text);

  console.log(
    "HTML API adayı:",
    htmlApis.length
  );

  for (const api of htmlApis) {
    console.log("API:", api);
  }

  /*
   * ----------------------------------------------------
   * 5) LIVE SCORES JS
   * ----------------------------------------------------
   */

  console.log("");
  console.log("5️⃣ LiveScores JavaScript aranıyor...");

  const liveScripts =
    scripts.filter(url =>
      /LiveScores/i.test(url)
    );

  console.log(
    "LiveScores JS:",
    liveScripts.length
  );

  const allApis = [];

  for (const url of liveScripts) {
    console.log("");
    console.log("JS:", url);

    const result =
      await fetchText(url);

    console.log(
      "HTTP:",
      result.status
    );

    console.log(
      "Boyut:",
      result.text.length
    );

    if (!result.ok) {
      console.log("❌ JS alınamadı.");
      continue;
    }

    const apis =
      extractApiCandidates(result.text);

    console.log(
      "API adayı:",
      apis.length
    );

    for (const api of apis) {
      console.log("API:", api);
      allApis.push(api);
    }
  }

  /*
   * ----------------------------------------------------
   * 6) DİĞER JS DOSYALARINI TARA
   * ----------------------------------------------------
   */

  console.log("");
  console.log("6️⃣ Diğer JS dosyaları taranıyor...");

  for (const url of scripts) {
    if (/LiveScores/i.test(url)) {
      continue;
    }

    /*
     * Çok fazla dosya varsa ilk 30 dosyayla sınırlıyoruz.
     */
    if (
      scripts.indexOf(url) >= 30
    ) {
      break;
    }

    const result =
      await fetchText(url);

    if (!result.ok) {
      continue;
    }

    const apis =
      extractApiCandidates(result.text);

    if (apis.length) {
      console.log("");
      console.log("JS:", url);

      for (const api of apis) {
        console.log("API:", api);
        allApis.push(api);
      }
    }
  }

  /*
   * ----------------------------------------------------
   * 7) SONUÇ
   * ----------------------------------------------------
   */

  const uniqueApis =
    unique(allApis);

  console.log("");
  console.log("========================================");
  console.log("🔎 API KEŞİF SONUCU");
  console.log("========================================");

  console.log(
    "Toplam benzersiz API adayı:",
    uniqueApis.length
  );

  if (!uniqueApis.length) {
    console.log("");
    console.log(
      "⚠️ JavaScript içinde açık API adresi bulunamadı."
    );

    console.log("");
    console.log(
      "Bilyoner'in veri yapısı muhtemelen runtime request"
    );

    console.log(
      "veya farklı bir bundle üzerinden çağrılıyor."
    );
  }

  for (const api of uniqueApis) {
    console.log(api);
  }

  console.log("");
  console.log("========================================");
  console.log("🏁 TEST TAMAMLANDI");
  console.log("========================================");
}

main().catch(error => {
  console.error("");
  console.error("❌ BEKLENMEYEN HATA");
  console.error(error);
  process.exit(1);
});
