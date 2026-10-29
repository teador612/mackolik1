
(() => {
  "use strict";

  const DATA_URL = "./outputs/ml-predictions.json";

  // Tahmin filtreleri
  const MIN_PROBABILITY = 65;
  const MIN_VALIDATION_SAMPLES = 200;

  // Market bazında asgari zaman sıralı test doğruluğu
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

  // Açık maç detaylarını yenileme sırasında koru
  const openDetails = new Set();

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
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

  // Olasılık 0–1 veya 0–100 biçiminde gelebilir.
  function probabilityPct(value) {
    if (value == null || value === "") return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return null;

    return number >= 0 && number <= 1
      ? number * 100
      : number;
  }

  function validationPct(value) {
    const number = validationFraction(value);
    return number == null
      ? "Hesaplanamadı"
      : pct(number * 100);
  }

  function validationFraction(value) {
    if (value == null || value === "") return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return null;

    return number > 1 ? number / 100 : number;
  }

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function parseDate(value) {
    const string = String(value ?? "").trim();
    if (!string) return "";

    let match = string.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }

    match = string.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    );

    if (match) {
      return [
        match[3],
        match[2].padStart(2, "0"),
        match[1].padStart(2, "0")
      ].join("-");
    }

    return "";
  }

  function getValidation(key) {
    return payload?.validation?.[key] || {};
  }

  function marketPassesValidation(key) {
    const metrics = getValidation(key);
    const samples = Number(metrics.validationSamples || 0);
    const accuracy = validationFraction(
      metrics.validationAccuracy
    );
    const required = MIN_VALIDATION_ACCURACY[key];

    if (accuracy == null || required == null) return false;
    if (samples < MIN_VALIDATION_SAMPLES) return false;

    return accuracy >= required;
  }

  function getMarketOptions(market) {
    if (!market || !Array.isArray(market.options)) {
      return [];
    }

    return market.options
      .map(option => ({
        ...option,
        probability: probabilityPct(option.probability)
      }))
      .filter(option =>
        option.probability != null &&
        option.probability >= 0 &&
        option.probability <= 100
      );
  }

  function getBestOption(market) {
    const options = getMarketOptions(market);
    if (!options.length) return null;

    // Önce modelin seçtiği seçeneği kullan.
    const picked = options.find(option =>
      String(option.title ?? "") ===
      String(market.pick ?? "")
    );

    // Model seçimi yoksa en yüksek olasılığı kullan.
    return picked || options.reduce((best, option) =>
      option.probability > best.probability
        ? option
        : best
    );
  }

  function getMatchKey(match) {
    return JSON.stringify([
      parseDate(match.date),
      String(match.time || ""),
      String(match.league || ""),
      String(match.home || ""),
      String(match.away || "")
    ]);
  }

  function getEligibleMarketPicks(match) {
    const picks = [];

    for (const [key, market] of Object.entries(
      match.markets || {}
    )) {
      if (!MARKET_NAMES[key]) continue;
      if (!marketPassesValidation(key)) continue;

      const option = getBestOption(market);
      if (!option) continue;

      if (option.probability < MIN_PROBABILITY) continue;

      picks.push({
        key,
        market,
        option,
        probability: option.probability
      });
    }

    return picks.sort((a, b) =>
      b.probability - a.probability
    );
  }

  function collectPicks() {
    const today = localDateKey();
    const grouped = new Map();

    for (const match of payload?.predictions || []) {
      if (parseDate(match.date) !== today) continue;

      const matchKey = getMatchKey(match);
      const eligiblePicks = getEligibleMarketPicks(match);

      if (!eligiblePicks.length) continue;

      if (!grouped.has(matchKey)) {
        grouped.set(matchKey, {
          key: matchKey,
          match,
          picks: eligiblePicks
        });
      } else {
        // Aynı maç birden fazla kayıtta bulunursa
        // mevcut marketleri birleştir.
        const existing = grouped.get(matchKey);
        const existingKeys = new Set(
          existing.picks.map(pick => pick.key)
        );

        for (const pick of eligiblePicks) {
          if (!existingKeys.has(pick.key)) {
            existing.picks.push(pick);
          }
        }

        existing.picks.sort((a, b) =>
          b.probability - a.probability
        );
      }
    }

    const matches = Array.from(grouped.values());

    // Her maçın ana tahmini, uygun marketler arasındaki
    // en yüksek olasılıklı tahmindir.
    matches.sort((a, b) =>
      b.picks[0].probability - a.picks[0].probability ||
      String(a.match.time || "").localeCompare(
        String(b.match.time || "")
      )
    );

    return matches;
  }

  function renderSummary() {
    const cards = [
      ["Eğitim maçı", fmt(payload?.trainingMatches)],
      ["Bugünkü maç", fmt(selectedPicks.length)],
      ["Asgari tahmin olasılığı", `${MIN_PROBABILITY}%`],
      [
        "Son üretim",
        payload?.generatedAt
          ? new Date(payload.generatedAt).toLocaleString("tr-TR")
          : "—"
      ]
    ];

    $("summary").innerHTML = cards.map(([label, value]) =>
      `<div class="card">
        <div class="label">${esc(label)}</div>
        <div class="value">${esc(value)}</div>
      </div>`
    ).join("");
  }

  function renderMetrics() {
    const validation = payload?.validation || {};

    $("metrics").innerHTML = Object.keys(MARKET_NAMES)
      .map(key => {
        const metrics = validation[key] || {};
        const accuracy = validationFraction(
          metrics.validationAccuracy
        );
        const threshold = MIN_VALIDATION_ACCURACY[key];

        const enoughSamples =
          Number(metrics.validationSamples || 0) >=
          MIN_VALIDATION_SAMPLES;

        const passes =
          accuracy != null &&
          threshold != null &&
          accuracy >= threshold &&
          enoughSamples;

        return `<div class="metric">
          <h3>${esc(MARKET_NAMES[key])}</h3>
          <p>Eğitim örneği: <b>${fmt(metrics.samples)}</b></p>
          <p>Zaman sıralı test doğruluğu:
            <b>${validationPct(metrics.validationAccuracy)}</b>
          </p>
          <p>Test maçı:
            <b>${fmt(metrics.validationSamples)}</b>
          </p>
          <p>Filtre durumu:
            <b>${passes ? "Filtreyi geçiyor" : "Yeterli destek yok"}</b>
          </p>
          <p>Geçmiş test başarısı gelecekteki sonucu garanti etmez.</p>
          ${metrics.message
            ? `<p>${esc(metrics.message)}</p>`
            : ""}
        </div>`;
      })
      .join("");
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

  function renderDetails(group) {
    return group.picks.map(pick => {
      const options = getMarketOptions(pick.market);

      const optionRows = options.map(option => {
        const isBest =
          String(option.title ?? "") ===
          String(pick.option.title ?? "");

        return `<div class="ml-detail-option${isBest ? " ml-detail-best" : ""}">
          <span>${esc(option.title || "Seçenek")}</span>
          <strong>${pct(option.probability)}</strong>
        </div>`;
      }).join("");

      return `<section class="ml-detail-market">
        <div class="ml-detail-heading">
          <strong>${esc(MARKET_NAMES[pick.key])}</strong>
          <span>${pct(pick.probability)}</span>
        </div>
        <div class="ml-detail-options">
          ${optionRows}
        </div>
      </section>`;
    }).join("");
  }

  function renderMatches() {
    const container = $("matches");
    if (!container) return;

    const query = ($("search")?.value || "")
      .trim()
      .toLocaleLowerCase("tr-TR");

    const marketFilter = $("market")?.value || "all";

    const rows = selectedPicks.filter(group => {
      const match = group.match;

      const searchText = [
        match.home || "",
        match.away || "",
        match.league || ""
      ].join(" ").toLocaleLowerCase("tr-TR");

      const matchesSearch =
        !query || searchText.includes(query);

      const matchesMarket =
        marketFilter === "all" ||
        group.picks.some(pick => pick.key === marketFilter);

      return matchesSearch && matchesMarket;
    });

    if (!rows.length) {
      container.innerHTML =
        '<div class="empty">Bugün belirlenen olasılık ve doğrulama filtrelerini geçen maç bulunamadı. Filtreler otomatik olarak düşürülmedi.</div>';
      return;
    }

    container.innerHTML = rows.map(group => {
      const match = group.match;
      const mainPick = group.picks[0];
      const isOpen = openDetails.has(group.key);
      const dateTime = [
        match.date,
        match.time
      ].filter(Boolean).join(" · ");

      const detailButtonLabel = isOpen
        ? "Maç Detaylarını Gizle"
        : `Maç Detayları (${group.picks.length} market)`;

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
          <div class="market-title">ANA TAHMİN</div>

          <div class="options">
            <div class="option best">
              <div>${esc(MARKET_NAMES[mainPick.key])}</div>
              <div class="pct">${esc(mainPick.option.title || "Seçim belirtilmemiş")}</div>
              <div class="pick">${pct(mainPick.probability)} model olasılığı</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="ml-details-button"
          data-match-key="${esc(group.key)}"
          aria-expanded="${isOpen ? "true" : "false"}"
        >${esc(detailButtonLabel)}</button>

        <div
          class="ml-details-panel"
          ${isOpen ? "" : "hidden"}
        >
          <div class="ml-details-title">
            Diğer marketlerin tahmin yüzdeleri
          </div>

          ${renderDetails(group)}

          <p class="ml-disclaimer">
            Yalnızca asgari olasılık ve geçmiş doğrulama filtrelerini
            geçen marketler gösterilir. Yüzdeler kesin sonuç garantisi
            değildir.
          </p>
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
      `Gösterilen maç: ${selectedPicks.length} · ` +
      `Asgari olasılık: %${MIN_PROBABILITY} · ` +
      `Günlük maç sınırı yok · ` +
      `Kaynak: outputs/ml-predictions.json`;
  }

  async function load() {
    $("status").textContent = "Tahmin dosyası yükleniyor...";

    try {
      const response = await fetch(
        `${DATA_URL}?v=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      payload = await response.json();
      render();
    } catch (error) {
      $("status").textContent =
        `Veri yüklenemedi: ${error.message}. ` +
        "Önce ML eğitim iş akışını çalıştırın.";

      $("summary").innerHTML = "";
      $("metrics").innerHTML = "";
      $("matches").innerHTML = "";
    }
  }

  // Detay düğmeleri için tek olay dinleyicisi
  $("matches")?.addEventListener("click", event => {
    const button = event.target.closest("[data-match-key]");
    if (!button) return;

    const key = button.dataset.matchKey;

    if (openDetails.has(key)) {
      openDetails.delete(key);
    } else {
      openDetails.add(key);
    }

    renderMatches();
  });

  $("search")?.addEventListener("input", renderMatches);
  $("market")?.addEventListener("change", renderMatches);
  $("refresh")?.addEventListener("click", load);

  // Detay paneli için temel stiller
  if (!document.getElementById("ml-details-styles")) {
    const style = document.createElement("style");
    style.id = "ml-details-styles";
    style.textContent = `
      .ml-details-button {
        display: block;
        width: 100%;
        margin-top: 14px;
        padding: 11px 14px;
        border: 1px solid var(--border, #555);
        border-radius: 10px;
        background: var(--card, transparent);
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .ml-details-button:hover {
        opacity: .85;
      }

      .ml-details-panel {
        margin-top: 12px;
        padding: 14px;
        border: 1px solid var(--border, #555);
        border-radius: 10px;
      }

      .ml-details-panel[hidden] {
        display: none !important;
      }

      .ml-details-title {
        margin-bottom: 12px;
        font-weight: 700;
      }

      .ml-detail-market {
        padding: 12px 0;
        border-top: 1px solid var(--border, #555);
      }

      .ml-detail-heading,
      .ml-detail-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .ml-detail-heading {
        margin-bottom: 8px;
      }

      .ml-detail-heading > span {
        font-weight: 700;
      }

      .ml-detail-options {
        display: grid;
        gap: 7px;
      }

      .ml-detail-option {
        padding: 8px 10px;
        border-radius: 7px;
        background: var(--surface, rgba(127,127,127,.08));
      }

      .ml-detail-best {
        outline: 1px solid var(--accent, #5b9b70);
      }

      .ml-disclaimer {
        margin: 12px 0 0;
        font-size: .85em;
        opacity: .8;
        line-height: 1.5;
      }
    `;

    document.head.appendChild(style);
  }

  load();
})();
