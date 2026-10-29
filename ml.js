
(() => {
  "use strict";

  const DATA_URL = "./outputs/ml-predictions.json";
  const RESULTS_URL = "./data/matches.json";
  const HISTORY_KEY = "ml-main-prediction-history-v1";

  const MIN_PROBABILITY = 65;
  const MIN_VALIDATION_SAMPLES = 200;

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
  let history = [];
  let results = [];
  const openDetails = new Set();

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  const pct = value =>
    Number.isFinite(Number(value))
      ? `${Number(value).toFixed(1)}%`
      : "—";

  function probabilityPct(value) {
    if (value == null || value === "") return null;

    const n = Number(value);
    if (!Number.isFinite(n)) return null;

    return n >= 0 && n <= 1 ? n * 100 : n;
  }

  function validationFraction(value) {
    if (value == null || value === "") return null;

    const n = Number(value);
    if (!Number.isFinite(n)) return null;

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

    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }

    return "";
  }

  function normalizeText(value) {
    return String(value ?? "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]/g, "");
  }

  function getValidation(key) {
    return payload?.validation?.[key] || {};
  }

  function marketPassesValidation(key) {
    const metrics = getValidation(key);
    const samples = Number(metrics.validationSamples || 0);
    const accuracy = validationFraction(metrics.validationAccuracy);
    const required = MIN_VALIDATION_ACCURACY[key];

    return accuracy != null &&
      required != null &&
      samples >= MIN_VALIDATION_SAMPLES &&
      accuracy >= required;
  }

  function getMarketOptions(market) {
    if (!Array.isArray(market?.options)) return [];

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

    const selected = options.find(option =>
      String(option.title ?? "") === String(market.pick ?? "")
    );

    return selected || options.reduce((best, option) =>
      option.probability > best.probability ? option : best
    );
  }

  function getMatchKey(match) {
    return [
      parseDate(match.date),
      normalizeText(match.home),
      normalizeText(match.away)
    ].join("|");
  }

  function collectPicks() {
    const today = localDateKey();
    const grouped = new Map();

    for (const match of payload?.predictions || []) {
      if (parseDate(match.date) !== today) continue;

      const key = getMatchKey(match);
      const picks = [];

      for (const [marketKey, market] of Object.entries(match.markets || {})) {
        if (!MARKET_NAMES[marketKey]) continue;
        if (!marketPassesValidation(marketKey)) continue;

        const option = getBestOption(market);
        if (!option || option.probability < MIN_PROBABILITY) continue;

        picks.push({
          key: marketKey,
          market,
          option,
          probability: option.probability
        });
      }

      if (!picks.length) continue;

      picks.sort((a, b) => b.probability - a.probability);

      if (!grouped.has(key)) {
        grouped.set(key, { key, match, picks });
      } else {
        const group = grouped.get(key);
        const existing = new Set(group.picks.map(p => p.key));

        for (const pick of picks) {
          if (!existing.has(pick.key)) group.picks.push(pick);
        }

        group.picks.sort((a, b) => b.probability - a.probability);
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      b.picks[0].probability - a.picks[0].probability ||
      String(a.match.time || "").localeCompare(String(b.match.time || ""))
    );
  }

  // Tahmin ilk kaydedildiğinde ana tahmin sabitlenir.
  // Sayfa sonraki günlerde açıldığında eski tahmin değiştirilmez.
  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      return true;
    } catch (error) {
      console.error("Tahmin geçmişi kaydedilemedi:", error);
      return false;
    }
  }

  function snapshotTodayPicks() {
    const known = new Set(history.map(item => item.id));
    const now = new Date().toISOString();

    for (const group of selectedPicks) {
      const main = group.picks[0];
      const id = `${group.key}|${main.key}`;

      if (known.has(id)) continue;

      history.push({
        id,
        date: parseDate(group.match.date),
        time: String(group.match.time || ""),
        league: String(group.match.league || ""),
        home: String(group.match.home || ""),
        away: String(group.match.away || ""),
        market: main.key,
        marketName: MARKET_NAMES[main.key],
        pick: String(main.option.title || ""),
        probability: main.probability,
        savedAt: now,
        outcome: null,
        actualScore: null,
        resultChecked: false
      });

      known.add(id);
    }

    saveHistory();
  }

  function scorePair(value) {
    if (value == null) return null;

    if (typeof value === "object") {
      const home = Number(value.home ?? value.homeScore);
      const away = Number(value.away ?? value.awayScore);

      if (Number.isFinite(home) && Number.isFinite(away)) {
        return [home, away];
      }

      return null;
    }

    const match = String(value).match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
    if (!match) return null;

    return [Number(match[1]), Number(match[2])];
  }

  function isFinished(match) {
    const status = match.status;

    if (typeof status === "number" || /^\d+$/.test(String(status ?? ""))) {
      return Number(status) === 4;
    }

    const text = normalizeText(status);
    return [
      "ft", "finished", "ended", "fulltime",
      "macbitti", "tamamlandi", "sonaerdi"
    ].includes(text);
  }

  function findResult(historyItem) {
    const targetDate = parseDate(historyItem.date);
    const targetHome = normalizeText(historyItem.home);
    const targetAway = normalizeText(historyItem.away);

    return results.find(match =>
      parseDate(match.date) === targetDate &&
      normalizeText(match.home) === targetHome &&
      normalizeText(match.away) === targetAway &&
      isFinished(match)
    ) || null;
  }

  function normalizeOutcome(key, title) {
    const text = normalizeText(title);

    if (key === "KG") {
      if (["var", "kgvar", "yes", "bothteamscore"].includes(text)) return "yes";
      if (["yok", "kgyok", "no", "bothteamsdontscore"].includes(text)) return "no";
      return null;
    }

    if (key === "U25" || key === "IY15U") {
      if (text.includes("ust") || text.includes("over")) return "over";
      if (text.includes("alt") || text.includes("under")) return "under";
      return null;
    }

    // Maç sonucu ve ilk yarı sonucu: 1 / X / 2
    if (["1", "ms1", "iy1", "evsahibi", "home"].includes(text)) return "1";
    if (["x", "0", "msx", "ms0", "iyx", "iy0", "beraberlik", "draw"].includes(text)) return "X";
    if (["2", "ms2", "iy2", "deplasman", "away"].includes(text)) return "2";

    return null;
  }

  function evaluatePrediction(item, match) {
    const fullScore = scorePair(match.score);
    if (!fullScore) return null;

    const [home, away] = fullScore;
    let actual;

    if (item.market === "MS") {
      actual = home > away ? "1" : home < away ? "2" : "X";
    } else if (item.market === "KG") {
      actual = home > 0 && away > 0 ? "yes" : "no";
    } else if (item.market === "U25") {
      actual = home + away > 2.5 ? "over" : "under";
    } else if (item.market === "IY15U") {
      const half = scorePair(match.halfTimeScore);
      if (!half) return null;
      actual = half[0] + half[1] > 1.5 ? "over" : "under";
    } else if (item.market === "IY") {
      const half = scorePair(match.halfTimeScore);
      if (!half) return null;
      actual = half[0] > half[1] ? "1" : half[0] < half[1] ? "2" : "X";
    } else {
      return null;
    }

    const predicted = normalizeOutcome(item.market, item.pick);
    if (predicted == null) return null;

    return {
      outcome: predicted === actual,
      actualScore: String(match.score),
      actualHalfTimeScore: match.halfTimeScore == null
        ? null
        : String(match.halfTimeScore)
    };
  }

  function updateHistoryResults() {
    let changed = false;

    for (const item of history) {
      if (item.outcome !== null) continue;

      const result = findResult(item);
      if (!result) continue;

      const evaluation = evaluatePrediction(item, result);
      if (!evaluation) continue;

      item.outcome = evaluation.outcome;
      item.actualScore = evaluation.actualScore;
      item.actualHalfTimeScore = evaluation.actualHalfTimeScore;
      item.resultChecked = true;
      changed = true;
    }

    if (changed) saveHistory();
  }

  function last30DayStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 29);
    return localDateKey(date);
  }

  function getStats(items) {
    const finished = items.filter(item =>
      item.outcome === true || item.outcome === false
    );

    const correct = finished.filter(item => item.outcome === true).length;
    const wrong = finished.length - correct;

    return {
      correct,
      wrong,
      total: finished.length,
      percentage: finished.length
        ? correct / finished.length * 100
        : null
    };
  }

  function statsCard(title, stats) {
    return `<div class="card ml-success-card">
      <div class="label">${esc(title)}</div>
      <div class="value">${stats.percentage == null ? "—" : pct(stats.percentage)}</div>
      <div class="ml-success-sub">
        <span class="ml-green-text">${stats.correct} başarılı</span>
        <span class="ml-red-text">${stats.wrong} başarısız</span>
      </div>
      <div class="ml-success-foot">
        Sonucu belli ${stats.total} ana tahmin
      </div>
    </div>`;
  }

  function renderSummary() {
    const today = localDateKey();
    const start = last30DayStart();

    const daily = getStats(history.filter(item =>
      item.date === today
    ));

    const monthly = getStats(history.filter(item =>
      item.date >= start && item.date <= today
    ));

    $("summary").innerHTML =
      statsCard("Günlük tahmin başarı oranı", daily) +
      statsCard("Son 30 gün başarı oranı", monthly);

    // Eski model doğrulama kartlarını kaldır.
    if ($("metrics")) $("metrics").innerHTML = "";
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

      return `<section class="ml-detail-market">
        <div class="ml-detail-heading">
          <strong>${esc(MARKET_NAMES[pick.key])}</strong>
          <span>${pct(pick.probability)}</span>
        </div>
        <div class="ml-detail-options">
          ${options.map(option => {
            const isBest =
              String(option.title ?? "") ===
              String(pick.option.title ?? "");

            return `<div class="ml-detail-option${isBest ? " ml-detail-best" : ""}">
              <span>${esc(option.title || "Seçenek")}</span>
              <strong>${pct(option.probability)}</strong>
            </div>`;
          }).join("")}
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
      const text = `${match.home || ""} ${match.away || ""} ${match.league || ""}`
        .toLocaleLowerCase("tr-TR");

      return (!query || text.includes(query)) &&
        (marketFilter === "all" ||
          group.picks.some(pick => pick.key === marketFilter));
    });

    if (!rows.length) {
      container.innerHTML =
        '<div class="empty">Bugün filtreleri geçen ana tahmin bulunamadı.</div>';
      renderPastPredictions();
      return;
    }

    container.innerHTML = rows.map(group => {
      const match = group.match;
      const main = group.picks[0];
      const opened = openDetails.has(group.key);
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
          <div class="market-title">ANA TAHMİN</div>
          <div class="options">
            <div class="option best">
              <div>${esc(MARKET_NAMES[main.key])}</div>
              <div class="pct">${esc(main.option.title || "Seçim belirtilmemiş")}</div>
              <div class="pick">${pct(main.probability)} model olasılığı</div>
            </div>
          </div>
        </div>

        <button type="button"
          class="ml-details-button"
          data-match-key="${esc(group.key)}"
          aria-expanded="${opened ? "true" : "false"}">
          ${opened ? "Maç Detaylarını Gizle" : `Maç Detayları (${group.picks.length} market)`}
        </button>

        <div class="ml-details-panel" ${opened ? "" : "hidden"}>
          <div class="ml-details-title">Market tahmin yüzdeleri</div>
          ${renderDetails(group)}
          <p class="ml-disclaimer">Yüzdeler kesin sonuç garantisi değildir.</p>
        </div>
      </article>`;
    }).join("");

    renderPastPredictions();
  }

  function renderPastPredictions() {
    let container = $("ml-history");
    if (!container) {
      container = document.createElement("section");
      container.id = "ml-history";
      container.className = "ml-history";
      $("matches")?.insertAdjacentElement("afterend", container);
    }

    const start = last30DayStart();
    const today = localDateKey();

    const items = history
      .filter(item => item.date >= start && item.date <= today)
      .sort((a, b) =>
        `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
      );

    container.innerHTML = `
      <h2>Geçmiş Ana Tahminler</h2>
      <p class="ml-history-note">
        Yeşil: doğru tahmin · Kırmızı: yanlış tahmin · Gri: sonuç bekleniyor
      </p>
      ${items.length ? items.map(item => {
        const state = item.outcome === true
          ? "ml-history-correct"
          : item.outcome === false
            ? "ml-history-wrong"
            : "ml-history-pending";

        const stateText = item.outcome === true
          ? "Başarılı"
          : item.outcome === false
            ? "Başarısız"
            : "Sonuç bekleniyor";

        return `<article class="ml-history-item ${state}">
          <div class="ml-history-top">
            <strong>${esc(item.home)} – ${esc(item.away)}</strong>
            <span>${esc(item.date)} ${esc(item.time)}</span>
          </div>
          <div class="ml-history-pick">
            ${esc(item.marketName)}: <strong>${esc(item.pick)}</strong>
            <span>${pct(item.probability)}</span>
          </div>
          <div class="ml-history-bottom">
            <span class="ml-history-state">${stateText}</span>
            ${item.actualScore
              ? `<span>Skor: ${esc(item.actualScore)}</span>`
              : ""}
          </div>
        </article>`;
      }).join("") : '<div class="empty">Henüz kayıtlı geçmiş tahmin yok.</div>'}
    `;
  }

  function installStyles() {
    if (document.getElementById("ml-history-styles")) return;

    const style = document.createElement("style");
    style.id = "ml-history-styles";
    style.textContent = `
      .ml-success-card { min-width: 0; }
      .ml-success-sub {
        display: flex; flex-wrap: wrap; gap: 12px;
        margin-top: 8px; font-size: .9em;
      }
      .ml-success-foot, .ml-history-note {
        margin-top: 7px; font-size: .85em; opacity: .75;
      }
      .ml-green-text { color: #18864b; font-weight: 700; }
      .ml-red-text { color: #d63b45; font-weight: 700; }

      .ml-details-button {
        display: block; width: 100%; margin-top: 14px;
        padding: 11px 14px; border: 1px solid var(--border, #555);
        border-radius: 10px; background: var(--card, transparent);
        color: inherit; font: inherit; font-weight: 600; cursor: pointer;
      }
      .ml-details-panel {
        margin-top: 12px; padding: 14px;
        border: 1px solid var(--border, #555); border-radius: 10px;
      }
      .ml-details-panel[hidden] { display: none !important; }
      .ml-details-title { margin-bottom: 12px; font-weight: 700; }
      .ml-detail-market { padding: 12px 0; border-top: 1px solid var(--border, #555); }
      .ml-detail-heading, .ml-detail-option {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
      }
      .ml-detail-heading { margin-bottom: 8px; }
      .ml-detail-options { display: grid; gap: 7px; }
      .ml-detail-option {
        padding: 8px 10px; border-radius: 7px;
        background: var(--surface, rgba(127,127,127,.08));
      }
      .ml-detail-best { outline: 1px solid var(--accent, #5b9b70); }
      .ml-disclaimer { margin: 12px 0 0; font-size: .85em; opacity: .8; line-height: 1.5; }

      .ml-history { margin-top: 28px; }
      .ml-history h2 { margin-bottom: 6px; }
      .ml-history-item {
        margin: 10px 0; padding: 13px; border: 1px solid #888;
        border-left: 5px solid #888; border-radius: 10px;
      }
      .ml-history-correct {
        border-color: #249653; border-left-color: #249653;
        background: rgba(36,150,83,.09);
      }
      .ml-history-wrong {
        border-color: #d63b45; border-left-color: #d63b45;
        background: rgba(214,59,69,.09);
      }
      .ml-history-pending { border-left-color: #888; }
      .ml-history-top, .ml-history-pick, .ml-history-bottom {
        display: flex; align-items: center; justify-content: space-between;
        flex-wrap: wrap; gap: 8px;
      }
      .ml-history-top { margin-bottom: 10px; }
      .ml-history-top span, .ml-history-bottom { font-size: .88em; opacity: .85; }
      .ml-history-pick { margin-bottom: 8px; }
      .ml-history-correct .ml-history-state { color: #18864b; font-weight: 700; }
      .ml-history-wrong .ml-history-state { color: #d63b45; font-weight: 700; }
    `;
    document.head.appendChild(style);
  }

  async function loadResults() {
    try {
      const response = await fetch(`${RESULTS_URL}?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      results = Array.isArray(data)
        ? data
        : Array.isArray(data.matches)
          ? data.matches
          : [];
    } catch (error) {
      results = [];
      console.warn("Maç sonuçları yüklenemedi:", error);
    }
  }

  async function load() {
    $("status").textContent = "Tahminler yükleniyor...";

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      payload = await response.json();
      history = readHistory();

      await loadResults();

      selectedPicks = collectPicks();
      snapshotTodayPicks();
      updateHistoryResults();

      installStyles();
      ensureMarketOptions();
      renderSummary();
      renderMatches();

      $("status").textContent =
        `Bugünün tarihi: ${new Date().toLocaleDateString("tr-TR")} · ` +
        `Bugünkü ana tahmin: ${selectedPicks.length} · ` +
        `Başarı oranları yalnızca sonucu belli ana tahminlerden hesaplanır.`;
    } catch (error) {
      $("status").textContent =
        `Veri yüklenemedi: ${error.message}. ML eğitim iş akışını ve JSON dosyasını kontrol edin.`;

      if ($("summary")) $("summary").innerHTML = "";
      if ($("metrics")) $("metrics").innerHTML = "";
      if ($("matches")) $("matches").innerHTML = "";
    }
  }

  $("matches")?.addEventListener("click", event => {
    const button = event.target.closest("[data-match-key]");
    if (!button) return;

    const key = button.dataset.matchKey;

    if (openDetails.has(key)) openDetails.delete(key);
    else openDetails.add(key);

    renderMatches();
  });

  $("search")?.addEventListener("input", renderMatches);
  $("market")?.addEventListener("change", renderMatches);
  $("refresh")?.addEventListener("click", load);

  load();
})();
