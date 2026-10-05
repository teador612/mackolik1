const API =
  "https://www.bilyoner.com/api/mobile/live-score/event/v2/basketball?date=2026-10-05";

const res = await fetch(API);
const data = await res.json();

const event = data.competitions
  ?.flatMap(c => c.events || [])
  ?.find(e => e.sbsEventId);

if (!event) {
  console.log("❌ Maç bulunamadı");
  process.exit(0);
}

console.log("🏀 Maç:", event.homeTeam, "-", event.awayTeam);
console.log("🆔 sbsEventId:", event.sbsEventId);
console.log("🆔 eventId:", event.eventId);
console.log("📊 İlk skor:", JSON.stringify(event.halfScore));
