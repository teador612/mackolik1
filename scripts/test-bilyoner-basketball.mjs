// scripts/find-bilyoner-gateway.mjs

const PAGE = "https://www.bilyoner.com/canli-skor/basketbol-canli-skor";

console.log("🔎 Bilyoner gateway");

try {
  const res = await fetch(PAGE, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    console.log(`❌ Sayfa: ${res.status}`);
    process.exit(1);
  }

  const html = await res.text();

  const scripts = [
    ...html.matchAll(
      /<script[^>]+src=["']([^"']+\.js)["']/gi
    )
  ].map(x => x[1]);

  const urls = scripts.map(x =>
    x.startsWith("http")
      ? x
      : new URL(x, PAGE).href
  );

  let found = new Set();

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!r.ok) continue;

      const js = await r.text();

      const patterns = [
        /API_GATEWAY\s*[:=]\s*["']([^"']+)["']/g,
        /API_GATEWAY.{0,150}?(https?:\/\/[^"'\\]+)/g,
        /aping\.bilyoner\.com/gi,
        /https?:\/\/[^"'\\\s]+/g
      ];

      for (const pattern of patterns) {
        for (const m of js.matchAll(pattern)) {
          const value = m[1] || m[0];

          if (
            value.includes("api") ||
            value.includes("bilyoner") ||
            value.includes("gateway")
          ) {
            found.add(value);
          }
        }
      }
    } catch {}
  }

  if (found.size === 0) {
    console.log("❌ Gateway bulunamadı");
    process.exit(1);
  }

  console.log(`✅ Bulundu: ${[...found].slice(0, 5).join(" | ")}`);

} catch {
  console.log("❌ Bilyoner bağlantısı başarısız");
  process.exit(1);
}
