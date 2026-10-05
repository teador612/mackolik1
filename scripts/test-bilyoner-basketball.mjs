// scripts/test-bilyoner-basketball.mjs

const PAGE = "https://www.bilyoner.com/canli-skor/basketbol-canli-skor";

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function get(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*"
    }
  });

  return {
    ok: res.ok,
    status: res.status,
    text: await res.text()
  };
}

console.log("🏀 Bilyoner API test");
console.log(`📅 Tarih: ${today()}`);

try {
  // Bilyoner ana sayfasından API gateway'i bul
  const page = await get(PAGE);

  if (!page.ok) {
    console.log(`❌ Sayfa HATASI: ${page.status}`);
    process.exit(1);
  }

  let gateway = null;

  const match = page.text.match(
    /API_GATEWAY.{0,100}?(https?:\/\/[^"'\\]+)/i
  );

  if (match) {
    gateway = match[1];
  }

  // Sayfada gateway görünmezse bilinen Bilyoner gateway adayını dene
  if (!gateway) {
    gateway = "https://aping.bilyoner.com";
  }

  gateway = gateway.replace(/\\u002F/g, "/").replace(/\\\//g, "/");

  const url =
    `${gateway}/mobile/live-score/event/v2/basketball?date=${today()}`;

  const result = await get(url);

  if (!result.ok) {
    console.log(`❌ API HATASI: ${result.status}`);
    process.exit(1);
  }

  let data;

  try {
    data = JSON.parse(result.text);
  } catch {
    console.log("❌ API JSON döndürmedi");
    process.exit(1);
  }

  const competitions = Array.isArray(data?.competitions)
    ? data.competitions
    : [];

  let matches = 0;

  for (const competition of competitions) {
    const events =
      competition?.events ||
      competition?.matches ||
      [];

    if (Array.isArray(events)) {
      matches += events.length;
    }
  }

  console.log("🌐 API: OK");
  console.log(`🏀 Lig: ${competitions.length}`);
  console.log(`⚽ Maç: ${matches}`);

  if (matches > 0) {
    console.log("✅ Veri başarıyla alındı");
  } else {
    console.log("⚠️ Maç bulunamadı");
  }

} catch (err) {
  console.log(`❌ HATA: ${err.message}`);
  process.exit(1);
}
