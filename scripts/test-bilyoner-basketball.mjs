const API = "https://www.bilyoner.com/api";

const EVENT_ID = 2391949;

async function main() {
  const url =
    `${API}/mobile/live-score/event/v2/sport-list?eventList=2:${EVENT_ID}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  console.log(`HTTP: ${res.status}`);

  if (!res.ok) {
    console.log("❌ GET başarısız");
    return;
  }

  const data = await res.json();

  const events =
    data?.events ||
    data?.data?.events ||
    [];

  console.log(`EVENT: ${Array.isArray(events) ? events.length : 0}`);

  if (!Array.isArray(events) || !events.length) {
    console.log("❌ Event bulunamadı");
    return;
  }

  const e = events[0];

  console.log(
    `MAÇ: ${e.homeTeam || "?"} - ${e.awayTeam || "?"}`
  );

  console.log(
    `SKOR: ${JSON.stringify(e.currentScore || null)}`
  );

  console.log(
    `İY: ${JSON.stringify(e.halfScore || null)}`
  );

  const keys = Object.keys(e).filter(k =>
    /period|quarter|score|result|official/i.test(k)
  );

  console.log(
    `ALANLAR: ${keys.join(",") || "YOK"}`
  );
}

main().catch(e => {
  console.log(`❌ ${e.message}`);
});
