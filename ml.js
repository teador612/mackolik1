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
  const pct = n =>
    Number.isFinite(Number(n))
      ? `${Number(n).toFixed(1)}%`
      : "—";
  const fmt = n =>
    Number.isFinite(Number(n))
      ? Number(n).toLocaleString("tr-TR")
      : "—";
  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function normalizeDate(value) {
    if (value == null || value === "") return "";
    const text = String(value).trim();
    // YYYY-MM-DD veya YYYY-MM-DDTHH:mm:ss
    let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    // DD.MM.YYYY veya DD/MM/YYYY
    match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
    // ISO tarih-saat biçimindeki diğer değerler
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return localDateString(parsed);
    }
    return "";
  }
  function getSelectedDate() {
    const input = $("matchDate");
    return input ? input.value : "";
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
    } catch (e) {
      $("status").textContent =
        `Veri yüklenemedi: ${e.message}. ` +
        `Önce GitHub Actions sekmesinden ` +
        `“Mackolik ML eğitim ve tahmin” iş akışını çalıştırın.`;
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
    const val = payload.validation || {};
    $("metrics").innerHTML = Object.keys(names).map(key => {
      const m = val[key] || {};
      return `<div class="metric">
        <h3>${names[key]}</h3>
        <p>Eğitim örneği: <b>${fmt(m.samples)}</b></p>
        <p>Zaman sıralı test doğruluğu:
          <b>${m.validationAccuracy == null
            ? "Hesaplanamadı"
            : pct(m.validationAccuracy)}</b>
        </p>
        <p>Test maçı: <b>${fmt(m.validationSamples)}</b></p>
        <p>Log loss:
          <b>${m.validationLogLoss == null
            ? "—"
            : esc(m.validationLogLoss)}</b>
        </p>
        <p>Brier skoru:
          <b>${m.validationBrier == null
            ? "—"
            : esc(m.validationBrier)}</b>
        </p>
        ${m.message ? `<p>${esc(m.message)}</p>` : ""}
      </div>`;
    }).join("");
  }
  function marketHtml(key, market) {
    if (!market) return "";
    const opts = market.options || [];
    return `<div class="market">
      <div class="market-title">${esc(market.title)}</div>
      <div class="options">
        ${opts.map(o => {
          const best = o.title === market.pick;
          return `<div class="option ${best ? "best" : ""}">
            <div>${esc(o.title)}</div>
            <div class="pct">${pct(o.probability)}</div>
            ${best ? '<div class="pick">MODEL SEÇİMİ</div>' : ""}
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  function renderMatches() {
    if (!payload) return;
    const q = $("search").value
      .trim()
      .toLocaleLowerCase("tr-TR");
    const marketFilter = $("market").value;
    const selectedDate = getSelectedDate();
    const allRows = payload.predictions || [];
    const dateRows = selectedDate
      ? allRows.filter(m => normalizeDate(m.date) === selectedDate)
      : allRows;
    const rows = dateRows.filter(m => {
      const text = `${m.home || ""} ${m.away || ""} ${m.league || ""}`
        .toLocaleLowerCase("tr-TR");
      return (!q || text.includes(q)) &&
        (marketFilter === "all" || Boolean(m.markets?.[marketFilter]));
    });
    if (!rows.length) {
      let message = "Bu filtrede tahmin bulunamadı.";
      if (selectedDate && dateRows.length === 0) {
        message = "Seçilen tarihte tahmin üretilmiş maç bulunamadı.";
      } else if (dateRows.length > 0) {
        message = "Seçilen tarihte arama veya market filtresine uygun maç bulunamadı.";
      }
      $("matches").innerHTML =
        `<div class="empty">${esc(message)}</div>`;
      return;
    }
    const marketKeys = marketFilter === "all"
      ? ["MS", "KG", "U25", "IY15U"]
      : [marketFilter];
    $("matches").innerHTML = rows.map(m => {
      const date = [m.date, m.time]
        .filter(Boolean)
        .join(" · ");
      return `<article class="match">
        <div class="match-head">
          <span>${esc(m.league || "Lig belirtilmemiş")}</span>
          <span>${esc(date)}</span>
        </div>
        <div class="teams">
          ${esc(m.home)}
          <span style="color:var(--muted)">—</span>
          ${esc(m.away)}
        </div>
        ${marketKeys.map(k =>
          marketHtml(k, m.markets?.[k])
        ).join("")}
        <div class="market-title">
          Kullanılan oran alanı: ${fmt(m.featuresAvailable)} ·
          tahmin güveni, gerçekleşme garantisi değildir.
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
      } · Atlanan maç: ${fmt(payload.skippedFixtures)} · ` +
      `Harici API kullanılmıyor.`;
  }
  // Arama ve market filtreleri
  $("search").addEventListener("input", renderMatches);
  $("market").addEventListener("change", renderMatches);
  // Takvimden tarih seçildiğinde maç listesini güncelle
  const dateInput = $("matchDate");
  if (dateInput) {
    dateInput.addEventListener("change", renderMatches);
  }
  // Tarih kontrol düğmeleri
  function shiftDate(days) {
    if (!dateInput) return;
    const currentValue = dateInput.value || localDateString(new Date());
    const parts = currentValue.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    dateInput.value = localDateString(date);
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    const label = $("selectedDateLabel");
    if (label) {
      label.textContent = new Intl.DateTimeFormat("tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(date);
    }
  }
  if ($("prevDate")) {
    $("prevDate").addEventListener("click", () => shiftDate(-1));
  }
  if ($("nextDate")) {
    $("nextDate").addEventListener("click", () => shiftDate(1));
  }
  if ($("todayDate")) {
    $("todayDate").addEventListener("click", () => {
      if (!dateInput) return;
      dateInput.value = localDateString(new Date());
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      const label = $("selectedDateLabel");
      if (label) {
        label.textContent = new Intl.DateTimeFormat("tr-TR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(new Date());
      }
    });
  }
  load();
})();
