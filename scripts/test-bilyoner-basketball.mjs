import fs from "node:fs/promises";

const FILE = "data/basketball-history.json";
const API = "https://www.bilyoner.com/api";

async function main() {
  const data = JSON.parse(
    await fs.readFile(FILE, "utf8")
  );

  const match = data.matches.find(
    x =>
      x.completed &&
      x.eventId &&
      x.sbsEventId
  );

  if (!match) {
    console.log("❌ Test maçı bulunamadı");
    return;
  }

  console.log(
    `MAÇ: ${match.homeTeam} - ${match.awayTeam}`
  );

  console.log(
    `ID: event=${match.eventId} sbs=${match.sbsEventId}`
  );

  const urls = [
    `${API}/mobile/live-score/event/v2/sport-list?eventList=2:${match.eventId}`,
    `${API}/mobile/live-score/event/v2/sport-list?eventList=2:${match.sbsEventId}`
  ];

  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i], {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      });

      const json = await res.json();

      const events =
        json?.events ||
        json?.data?.events ||
        [];

      console.log(
        `TEST ${i + 1}: HTTP=${res.status} EVENT=${Array.isArray(events) ? events.length : 0}`
      );

      if (Array.isArray(events) && events.length) {
        const e = events[0];

        console.log(
          `BULUNDU: ${e.homeTeam || "?"}-${e.awayTeam || "?"}`
        );

        console.log(
          `ALANLAR: ${Object.keys(e)
            .filter(k =>
              /period|quarter|score|result/i.test(k)
            )
            .join(",") || "YOK"}`
        );

        break;
      }
    } catch (err) {
      console.log(
        `TEST ${i + 1}: HATA`
      );
    }
  }
}

main().catch(() => {
  console.log("❌ Test başarısız");
});
