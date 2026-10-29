
(() => {
  "use strict";

  const DATA_URL = "./outputs/ml-predictions.json";

  // Başlangıç filtreleri; gerçek başarı garantisi değildir.
  const MIN_PROBABILITY = 65;
  const MAX_DAILY_PICKS = 8;
  const MIN_VALIDATION_SAMPLES = 200;

  // Market bazında asgari zaman sıralı test doğruluğu.
  const MIN_VALIDATION_ACCURACY = {
    MS: 0.45,
    KG: 0.55,
    U25: 0.55,
    IY15U: 0.55,
    IY: 0.40
  };

  const MARKET_NAMES = {
    MS: "Maç Sonucu",
    KG: "Karşılıklı Gol",
    U25: "2.5 Gol Alt/Üst",
    IY15U: "İlk Yarı 1.5 Gol Alt/Üst",
    IY: "İlk Yarı Sonucu"
  };

  const $ = id => document.getElementById(id);
  let payload = null;
  let selectedPicks = [];

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);

  const fmt = value =>
    Number.isFinite(Number(value))
      ? Number(value).toLocaleString("tr-TR")
      : "—";

  const pct = value =>
    Number.isFinite(Number(value))
      ? `${Number(value).toFixed(1)}%`
      : "—";

  // Doğrulama metrikleri 0–1 veya 0–100 formatında gelebilir.
  function validationPct(value) {
    if (value == null || !Number.isFinite(Number(value))) return "Hesaplanamadı";
    const n = Number(value);
    return pct(n <= 1 ? n * 100 : n);
  }

  function validationFraction(value) {
    if (value == null || !Number.isFinite(Number(value))) return null;
    const n = Number(value);
    return n > 1 ? n / 100 : n;
  }

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function parseDate(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";

    // ISO: YYYY-MM-DD
    let match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    // Türkiye biçimi: DD.MM.YYYY veya DD/MM/YYYY
    match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (match) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }

    return "";
  }

  function getValidation(key) {
    return payload?.validation?.[key] || {};
  }

  function marketPassesValidation(key) {
    const metrics = getValidation(key);
    const samples = Number(metrics.validationSamples || 0);
    const accuracy = validationFraction(metrics.validationAccuracy);
    const required = MIN_VALIDATION_ACCURACY[key];

    if (accuracy == null || required == null) return false;
    if (samples < MIN_VALIDATION_SAMPLES) return false;

    return accuracy >= required;
  }

  function getBestOption(market) {
    if (!market || !Array.isArray(market.options) || !market.options.length) {
      return null;
    }

    const options = market.options
      .map(option => ({
        ...option,
        probability: Number(option.probability)
      }))
      .filter(option => Number.isFinite(option.probability));

    if (!options.length) return null;

    // Modelin kendi pick alanı varsa onu kullan; yoksa olasılığı en yüksek seçeneği al.
    const picked = options.find(option => option.title === market.pick);
    return picked || options.reduce((best, option) =>
      option.probability > best.probability ? option : best
    );
  }

  function collectPicks() {
    const today = localDateKey();
    const picks = [];

    for (const match of payload?.predictions || []) {
      if (parseDate(match.date) !== today) continue;

      for (const [key, market] of Object.entries(match.markets || {})) {
        if (!MARKET_NAMES[key]) continue;
        if (!marketPassesValidation(key)) continue;

        const option = getBestOption(market);
        if (!option || option.probability < MIN_PROBABILITY) continue;

        picks.push({
          match,
          key,
          market,
          option,
          probability: option.probability
        });
      }
    }

    // En yüksek olasılıklı adaylar önce.
    picks.sort((a, b) =>
      b.probability - a.probability ||
      String(a.match.time || "").localeCompare(String(b.match.time || ""))
    );

    return picks;
  }

  function renderSummary() {
    const cards = [
      ["Eğitim maçı", fmt(payload.trainingMatches)],
      ["Bugünkü güçlü tahmin", fmt(selectedPicks.length)],
      ["Asgari tahmin olasılığı", `${MIN_PROBABILITY}%`],
      ["Son üretim", payload.generatedAt
        ? new Date(payload.generatedAt).toLocaleString("tr-TR")
        : "—"]
    ];

    $("summary").innerHTML = cards.map(([label, value]) =>
      `<div class="card">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(value)}</div>
      </div>`
    ).join("");
  }

  function renderMetrics() {
    const keys = Object.keys(MARKET_NAMES);
    const validation = payload.validation || {};

    $("metrics").innerHTML = keys.map(key => {
      const metrics = validation[key] || {};
      const accuracy = validationFraction(metrics.validationAccuracy);
      const threshold = MIN_VALIDATION_ACCURACY[key];
      const enoughSamples =
        Number(metrics.validationSamples || 0) >= MIN_VALIDATION_SAMPLES;
      const passes =
        accuracy != null &&
        threshold != null &&
        accuracy >= threshold &&
        enoughSamples;

      return `<div class="metric">
        <h3>${esc(MARKET_NAMES[key])}</h3>
        <p>Eğitim örneği: <b>${fmt(metrics.samples)}</b></p>
        <p>Zaman sıralı test doğruluğu: <b>${validationPct(metrics.validationAccuracy)}</b></p>
        <p>Test maçı: <b>${fmt(metrics.validationSamples)}</b></p>
        <p>Filtre durumu: <b>${passes ? "Filtreyi geçiyor" : "Yeterli destek yok"}</b></p>
        <p>Bu test oranı tek başına gelecekteki başarıyı göstermez.</p>
        ${metrics.message ? `<p>${esc(metrics.message)}</p>` : ""}
      </div>`;
    }).join("");
  }

  function ensureMarketOptions() {
    const select = $("market");
    if (!select) return;

    const existing = new Set(
      Array.from(select.options).map(option => option.value)
    );

    for (const [key, label] of Object.entries(MARKET_NAMES)) {
      if (existing.has(key)) continue;
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  function renderMatches() {
    const query = ($("search")?.value || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    const marketFilter = $("market")?.value || "all";

    const rows = selectedPicks.filter(pick => {
      const match = pick.match;
      const searchText =
        `${match.home || ""} ${match.away || ""} ${match.league || ""}`
          .toLocaleLowerCase("tr-TR");

      return (!query || searchText.includes(query)) &&
        (marketFilter === "all" || pick.key === marketFilter);
    });

    if (!rows.length) {
      $("matches").innerHTML =
        '<div class="empty">Bugün filtreleri geçen tahmin bulunamadı. Listeyi doldurmak için eşikleri otomatik düşürmüyoruz.</div>';
      return;
    }

    $("matches").innerHTML = rows.map(pick => {
      const match = pick.match;
      const dateTime = [match.date, match.time].filter(Boolean).join(" · ");

      return `<article class="match">
        <div class="match-head">
          <span>${esc(match.league || "Lig belirtilmemiş")}</span>
          <span>${esc(dateTime)}</span>
        </div>
        <div class="teams">
          ${esc(match.home || "Ev sahibi")}
          <span style="color:var(--muted)"> — </span>
          ${esc(match.away || "Deplasman")}
        </div>
        <div class="market">
          <div class="market-title">${esc(MARKET_NAMES[pick.key])}</div>
          <div class="options">
            <div class="option best">
              <div>Önerilen seçim</div>
              <div class="pct">${esc(pick.option.title)}</div>
              <div class="pick">${pct(pick.probability)} model olasılığı</div>
            </div>
          </div>
        </div>
        <div class="market-title">
          Bu seçim olasılık ve geçmiş test filtrelerini geçti; kesin sonuç garantisi değildir.
        </div>
      </article>`;
    }).join("");
  }

  function render() {
    ensureMarketOptions();
    selectedPicks = collectPicks();

    renderSummary();
    renderMetrics();
    renderMatches();

    $("status").textContent =
      `Bugünün tarihi: ${new Date().toLocaleDateString("tr-TR")} · ` +
      `Gösterilen tahmin: ${selectedPicks.length}/${MAX_DAILY_PICKS} · ` +
      `Asgari olasılık: %${MIN_PROBABILITY} · ` +
      `Kaynak: outputs/ml-predictions.json`;
  }

  async function load() {
    $("status").textContent = "Tahmin dosyası yükleniyor...";

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      payload = await response.json();
      render();
    } catch (error) {
      $("status").textContent =
        `Veri yüklenemedi: ${error.message}. Önce ML eğitim iş akışını çalıştırın.`;
      $("summary").innerHTML = "";
      $("metrics").innerHTML = "";
      $("matches").innerHTML = "";
    }
  }

  $("search")?.addEventListener("input", renderMatches);
  $("market")?.addEventListener("change", renderMatches);
  $("refresh")?.addEventListener("click", load);

  load();
})();
