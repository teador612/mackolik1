// scripts/find-bilyoner-gateway.mjs

const PAGE = "https://www.bilyoner.com/canli-skor/basketbol-canli-skor";

console.log("🔎 Bilyoner API gateway");

try {
  const page = await fetch(PAGE, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const html = await page.text();

  const scripts = [
    ...html.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/gi)
  ].map(x => new URL(x[1], PAGE).href);

  let found = null;

  for (const url of scripts) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      if (!r.ok) continue;

      const js = await r.text();

      // API_GATEWAY tanımını ara
      const patterns = [
        /API_GATEWAY\s*[:=]\s*["'`](https?:\/\/[^"'`]+)["'`]/,
        /API_GATEWAY\s*=\s*["'`](https?:\/\/[^"'`]+)["'`]/,
        /API_GATEWAY\s*:\s*["'`](https?:\/\/[^"'`]+)["'`]/
      ];

      for (const pattern of patterns) {
        const m = js.match(pattern);

        if (m && m[1]) {
          found = m[1];
          break;
        }
      }

      if (found) break;

      // API_GATEWAY geçiyor ama değer başka değişkenden geliyor olabilir
      const pos = js.indexOf("API_GATEWAY");

      if (pos !== -1) {
        const context = js.slice(
          Math.max(0, pos - 500),
          pos + 1000
        );

        const urls = context.match(/https?:\/\/[^"'`\\\s]+/g) || [];

        const candidate = urls.find(u =>
          !u.includes("gateway.efilli.com") &&
          !u.includes("mixpanel") &&
          !u.includes("ipify") &&
          !u.includes("/static/")
        );

        if (candidate) {
          found = candidate;
          break;
        }
      }

    } catch {}
  }

  if (found) {
    console.log(`✅ API: ${found}`);
  } else {
    console.log("❌ API_GATEWAY değeri bulunamadı");
    process.exit(1);
  }

} catch {
  console.log("❌ Bilyoner bağlantısı başarısız");
  process.exit(1);
}
