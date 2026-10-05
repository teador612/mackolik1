const API =
  "https://www.bilyoner.com/api/mobile/live-score/event/v2/basketball?date=2026-10-05";

const res = await fetch(API);
const data = await res.json();

const competitions = data.competitions || [];

let event = null;

for (const comp of competitions) {
  if (Array.isArray(comp.events) && comp.events.length) {
    event = comp.events.find(e =>
      JSON.stringify(e).match(/period|quarter|halfScore|score/i)
    );

    if (event) break;
  }
}

console.log("🏆 Lig:", competitions.length);
console.log("🏀 Maç:", competitions.reduce((n, c) => n + (c.events?.length || 0), 0));
console.log("📋 Alanlar:", event ? Object.keys(event).join(", ") : "bulunamadı");

if (event) {
  console.log(
    "📊 Skor:",
    Object.entries(event)
      .filter(([k]) => /period|quarter|score|half/i.test(k))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" | ")
      .slice(0, 3000)
  );
}
