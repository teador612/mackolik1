(() => {
  "use strict";
  const DATA_URL = "./outputs/ml-predictions.json";
  const $ = id => document.getElementById(id);
  let payload = null;
  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  const pct = value => {
    const n = Number(value);
    return value != null && value !== "" && Number.isFinite(n)
      ? `${n.toFixed(1)}%`
      : "—";
  };
  const fmt = value => {
    const n = Number(value);
    return value != null && value !== "" && Number.isFinite(n)
      ? n.toLocaleString("tr-TR")
      : "—";
  };
  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function normalizeDate(value) {
    if (value == null || value === "") return "";
    const text = String(value).trim();
    // ISO: 2026-10-29 veya 2026-10-29T20:00:00
    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    // Türkiye biçimi: 29.10.2026 veya 29/10/2026
    match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (match) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
    // Tarih alanında Unix zaman damgası varsa
    if (/^\d{10,13}$/.test(text)) {
      const timestamp = Number(text);
      const milliseconds = text.length === 10 ? timestamp * 1000 : timestamp;
      const date = new Date(milliseconds);
      return Number.isNaN(date.getTime())
        ? ""
        : localDateString(date);
    }
    return "";
  }
  function updateDateLabel() {
    const input = $("matchDate");
    const label = $("selectedDateLabel");
    if (!input || !label || !input.value) return;
    const [year, month, day] = input.value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    label.textContent = new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
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
        "GitHub Actions üzerinden ML eğitim ve tahmin iş akışını çalıştırın.";
      $("summary").innerHTML = "";
      $("metrics").innerHTML = "";
      $("matches").innerHTML = "";
    }
  }
  function renderSummary() {
    const cards = [
      ["Eğitim maçı", fmt(payload.trainingMatches)],
      ["Tahmin üretilen maç", fmt(payload.predictionCount)],
      ["Model", payload.model || "—"],
      [
        "Son üretim",
        payload.generatedAt
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
    const names = {
      MS: "Maç Sonucu (1/X/2)",
      KG: "Karşılıklı Gol",
      U25: "2.5 Üst",
      IY15U: "İY 1.5 Üst"
    };
    const validation = payload.validation || {};
    $("metrics").innerHTML = Object.entries(names).map(([key, name]) => {
      const m = validation[key] || {};
      return `<div class="metric">
        <h3>${name}</h3>
        <p>Eğitim örneği: <b>${fmt(m.samples)}</b></p>
        <p>Zaman sıralı test doğruluğu:
          <b>${m.validationAccuracy == null
            ? "Hesaplanamadı"
            : pct(m.validationAccuracy)}</b>
        </p>
        <p>Test maçı: <b>${fmt(m.validationSamples)}</b></p>
        <p>Log loss: <b>${m.validationLogLoss == null
          ? "—"
          : esc(m.validationLogLoss)}</b></p>
        <p>Brier skoru: <b>${m.validationBrier == null
          ? "—"
          : esc(m.validationBrier)}</b></p>
        ${m.message ? `<p>${esc(m.message)}</p>` : ""}
      </div>`;
    }).join("");
  }
  function marketHtml(market) {
    if (!market) return "";
    const options = market.options || [];
    return `<div class="market">
      <div class="market-title">${esc(market.title)}</div>
      <div class="options">
        ${options.map(option => {
          const best = option.title === market.pick;
          return `<div class="option ${best ? "best" : ""}">
            <div>${esc(option.title)}</div>
            <div class="pct">${pct(option.probability)}</div>
            ${best ? '<div class="pick">MODEL SEÇİMİ</div>' : ""}
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  function renderMatches() {
    if (!payload) return;
    const search = $("search").value
      .trim()
      .toLocaleLowerCase("tr-TR");
    const marketFilter = $("market").value;
    const dateInput = $("matchDate");
    const selectedDate = dateInput ? dateInput.value : "";
    const allRows = Array.isArray(payload.predictions)
      ? payload.predictions
      : [];
    // Tarih seçilmişse yalnızca o günün maçlarını göster.
    const dateRows = selectedDate
      ? allRows.filter(match => {
          const matchDate = normalizeDate(match.date);
          return matchDate !== "" && matchDate === selectedDate;
        })
      : allRows;
    // Arama ve market filtresi tarih filtresinden sonra uygulanır.
    const rows = dateRows.filter(match => {
      const text = [
        match.home,
        match.away,
        match.league
      ].join(" ").toLocaleLowerCase("tr-TR");
      const searchMatches = !search || text.includes(search);
      const marketMatches =
        marketFilter === "all" ||
        Boolean(match.markets?.[marketFilter]);
      return searchMatches && marketMatches;
    });
    if (!rows.length) {
      let message = "Bu filtreye uygun tahmin bulunamadı.";
      if (selectedDate && dateRows.length === 0) {
        message =
          `Seçilen tarihte (${selectedDate}) tahmin bulunamadı. ` +
          "Bu tarih için tahmin dosyasında maç olmayabilir.";
      } else if (selectedDate) {
        message = "Bu tarihte arama veya market filtresine uygun maç bulunamadı.";
      }
      $("matches").innerHTML =
        `<div class="empty">${esc(message)}</div>`;
      return;
    }
    const marketKeys = marketFilter === "all"
      ? ["MS", "KG", "U25", "IY15U"]
      : [marketFilter];
    $("matches").innerHTML = rows.map(match => {
      const dateTime = [match.date, match.time]
        .filter(Boolean)
        .join(" · ");
      return `<article class="match">
        <div class="match-head">
          <span>${esc(match.league || "Lig belirtilmemiş")}</span>
          <span>${esc(dateTime)}</span>
        </div>
        <div class="teams">
          ${esc(match.home)}
          <span style="color:var(--muted)">—</span>
          ${esc(match.away)}
        </div>
        ${marketKeys.map(key =>
          marketHtml(match.markets?.[key])
        ).join("")}
        <div class="market-title">
          Kullanılan oran alanı: ${fmt(match.featuresAvailable)} ·
          Tahmin güveni gerçekleşme garantisi değildir.
        </div>
      </article>`;
    }).join("");
  }
  function render() {
    renderSummary();
    renderMetrics();
    renderMatches();
    $("status").textContent =
      `Son güncelleme: ${
        payload.generatedAt
          ? new Date(payload.generatedAt).toLocaleString("tr-TR")
          : "bilinmiyor"
      } · Atlanan maç: ${fmt(payload.skippedFixtures)} · Harici API kullanılmıyor.`;
  }
  function shiftDate(days) {
    const input = $("matchDate");
    if (!input) return;
    const selected = input.value || localDateString(new Date());
    const [year, month, day] = selected.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    input.value = localDateString(date);
    updateDateLabel();
    renderMatches();
  }
  $("search").addEventListener("input", renderMatches);
  $("market").addEventListener("change", renderMatches);
  $("refresh").addEventListener("click", load);
  if ($("matchDate")) {
    $("matchDate").value = localDateString(new Date());
    $("matchDate").addEventListener("change", () => {
      updateDateLabel();
      renderMatches();
    });
    updateDateLabel();
  }
  if ($("prevDate")) {
    $("prevDate").addEventListener("click", () => shiftDate(-1));
  }
  if ($("nextDate")) {
    $("nextDate").addEventListener("click", () => shiftDate(1));
  }
  if ($("todayDate")) {
    $("todayDate").addEventListener("click", () => {
      if (!$("matchDate")) return;
      $("matchDate").value = localDateString(new Date());
      updateDateLabel();
      renderMatches();
    });
  }
  load();
})();
