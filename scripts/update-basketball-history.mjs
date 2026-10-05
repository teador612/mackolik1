const API =
  "https://www.bilyoner.com/api/mobile/live-score/event/v2/basketball?date=2026-10-05";

const res = await fetch(API);
const data = await res.json();

const events = [];

function walk(x) {
  if (!x || typeof x !== "object") return;

  if (
    x.sbsEventId ||
    x.eventId ||
    x.id
  ) {
    events.push(x);
    return;
  }

  if (Array.isArray(x)) {
    for (const v of x) walk(v);
  } else {
    for (const v of Object.values(x)) walk(v);
  }
}

walk(data);

const e = events.find(x =>
  JSON.stringify(x).match(/period|quarter|halfScore|score/i)
);

console.log("🏀 Event:", events.length);
console.log("📋 Alanlar:", e ? Object.keys(e).join(", ") : "bulunamadı");

if (e) {
  console.log(
    "📊 Skor alanları:",
    Object.entries(e)
      .filter(([k]) => /period|quarter|score|half/i.test(k))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" | ")
      .slice(0, 2500)
  );
}
