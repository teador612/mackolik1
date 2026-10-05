import fs from "fs";

const FILE =
  "data/basketball-history.json";

const data =
  JSON.parse(
    fs.readFileSync(FILE, "utf8")
  );

const match =
  data.matches.find(
    m =>
      m.finished &&
      m.slug
  );

if (!match) {
  console.log("❌ Slug bulunan maç yok");
  process.exit(1);
}

console.log(
  `🏀 ${match.home} - ${match.away}`
);

console.log(
  `📅 ${match.date}`
);

console.log(
  `🔗 ${match.slug}`
);

const url =
  `https://sportscore.com/api/widget/match/` +
  `?sport=basketball` +
  `&slug=${encodeURIComponent(match.slug)}`;

try {
  const response =
    await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0"
      }
    });

  console.log(
    `HTTP=${response.status}`
  );

  if (!response.ok) {
    console.log("❌ Detay alınamadı");
    process.exit(1);
  }

  const data =
    await response.json();

  const matchData =
    data?.match ??
    data?.data ??
    data;

  console.log(
    `SKOR=${matchData?.home_score ?? "?"}-${matchData?.away_score ?? "?"}`
  );

  const periods =
    matchData?.periods ??
    matchData?.scores ??
    matchData?.quarters ??
    matchData?.periodScores ??
    null;

  if (periods) {
    console.log(
      "✅ PERİYOT VERİSİ VAR"
    );

    console.log(
      JSON.stringify(periods)
    );
  } else {
    console.log(
      "❌ Periyot alanı bulunamadı"
    );

    console.log(
      "ALANLAR=" +
      Object.keys(matchData || {}).join(",")
    );
  }

} catch (error) {
  console.log(
    `❌ HATA=${error.message}`
  );
}
