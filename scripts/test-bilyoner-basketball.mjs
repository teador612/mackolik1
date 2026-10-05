// scripts/test-bilyoner-basketball.mjs

const DATE = new Date().toISOString().slice(0, 10);

const API =
  `https://www.bilyoner.com/api/mobile/live-score/event/v2/basketball?date=${DATE}`;

console.log("🏀 Bilyoner Basketbol API");
console.log(`📅 ${DATE}`);

try {
  const res = await fetch(API, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://www.bilyoner.com/",
      "Origin": "https://www.bilyoner.com"
    }
  });

  console.log(`🌐 HTTP: ${res.status}`);

  const text = await res.text();

  if (!res.ok) {
    console.log("❌ API cevap vermedi");
    console.log(text.slice(0, 300));
    process.exit(1);
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.log("❌ JSON değil");
    console.log(text.slice(0, 200));
    process.exit(1);
  }

  const competitions = data?.competitions || [];

  let matches = 0;

  for (const competition of competitions) {
    const events =
      competition?.events ||
      competition?.basketballEvents ||
      [];

    if (Array.isArray(events)) {
      matches += events.length;
    }
  }

  console.log(`🏆 Lig: ${competitions.length}`);
  console.log(`🏀 Maç: ${matches}`);

  if (matches > 0) {
    console.log("✅ Bilyoner API ÇALIŞIYOR");
  } else {
    console.log("⚠️ API çalışıyor ama maç verisi yok");
  }

} catch (err) {
  console.log("❌ Bağlantı hatası");
  console.log(err.message);
  process.exit(1);
}
