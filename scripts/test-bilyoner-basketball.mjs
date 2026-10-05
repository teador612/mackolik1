// scripts/test-bilyoner-basketball.mjs

const API = "https://aping.bilyoner.com";
const date = new Date().toISOString().slice(0, 10);

console.log("🏀 Bilyoner test");
console.log(`📅 ${date}`);

try {
  const url =
    `${API}/mobile/live-score/event/v2/basketball?date=${date}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
      "Referer": "https://www.bilyoner.com/"
    },
    signal: AbortSignal.timeout(15000)
  });

  console.log(`🌐 HTTP: ${response.status}`);

  if (!response.ok) {
    console.log("❌ API erişilemedi");
    process.exit(1);
  }

  const data = await response.json();

  const competitions = Array.isArray(data?.competitions)
    ? data.competitions
    : [];

  let matches = 0;

  for (const league of competitions) {
    if (Array.isArray(league?.events)) {
      matches += league.events.length;
    }
  }

  console.log(`🏀 Lig: ${competitions.length}`);
  console.log(`🏀 Maç: ${matches}`);

  if (matches > 0) {
    console.log("✅ Bilyoner çalışıyor");
  } else {
    console.log("⚠️ Veri yok");
  }

} catch (error) {
  console.log("❌ Bağlantı başarısız");
  process.exit(1);
}
