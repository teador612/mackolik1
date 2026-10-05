const BASE = "https://sportscore.com/api/v1/fixtures/";

const dates = [
  "2026-10-05",
  "2026-10-04",
  "2026-10-03"
];

console.log("🏀 SPORTScore BASKETBOL TESTİ");

for (const date of dates) {
  try {
    const url =
      `${BASE}?sport=basketball&date=${date}&limit=200`;

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      console.log(`${date} | HTTP=${response.status}`);
      continue;
    }

    const data = await response.json();

    const matches = Array.isArray(data?.matches)
      ? data.matches
      : Array.isArray(data?.data)
        ? data.data
        : [];

    const finished = matches.filter(m =>
      String(m?.status || "").toLowerCase() === "finished"
    );

    console.log(
      `${date} | MAC=${matches.length} | BITEN=${finished.length}`
    );

    if (matches.length > 0) {
      const m = matches[0];

      console.log(
        `ÖRNEK: ${m.home || m.home_team || "?"} - ${m.away || m.away_team || "?"}`
      );

      console.log(
        `SKOR: ${m.home_score ?? "?"}-${m.away_score ?? "?"}`
      );

      console.log(
        `DURUM: ${m.status || "?"}`
      );
    }

  } catch (err) {
    console.log(`${date} | HATA=${err.message}`);
  }
}
