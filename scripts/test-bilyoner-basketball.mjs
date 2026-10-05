const ID = "3281968";

const urls = [
  `https://www.bilyoner.com/api/mobile/live-score/event/${ID}`,
  `https://www.bilyoner.com/api/mobile/live-score/event/${ID}/detail`,
  `https://www.bilyoner.com/api/mobile/live-score/event/${ID}/v2`,
  `https://www.bilyoner.com/api/mobile/live-score/event/v2/${ID}`,
  `https://www.bilyoner.com/api/mobile/live-score/event/${ID}/scores`
];

for (const url of urls) {
  try {
    const res = await fetch(url);

    console.log(
      res.status === 200 ? "✅" : "❌",
      new URL(url).pathname
    );

    if (res.status === 200) {
      const text = await res.text();

      console.log("📦 Boyut:", text.length);

      if (/period|quarter|score|half/i.test(text)) {
        console.log("🏀 Skor verisi bulundu");
      }
    }
  } catch {
    console.log("❌ Hata");
  }
}
