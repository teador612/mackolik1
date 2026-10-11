
"use strict";

/* =========================================================
   DNA — SKOR + BİREBİR AÇILIŞ ORANI ANALİZİ

   Veri: ./data/matches.json
   Geçmiş: Analiz tarihinden önceki 30 gün
   Maç sonu skoru: Zorunlu
   İlk yarı skoru: İsteğe bağlı
   Oran toleransı: YOK
   Başarı: Her marketin kendi gerçek sonucuna göre
   ========================================================= */

(() => {
  const DATA_URL = "./data/matches.json";
  const HISTORY_DAYS = 30;

  const MARKETS = [
    { id: "ms1", label: "MS1", fields: ["ms1", "MS1"], test: m => outcome(m, "MS1") },
    { id: "msX", label: "MSX", fields: ["msX", "msx", "MSX"], test: m => outcome(m, "MSX") },
    { id: "ms2", label: "MS2", fields: ["ms2", "MS2"], test: m => outcome(m, "MS2") },

    { id: "iy1", label: "İY 1", fields: ["iy1", "IY1"], test: m => outcome(m, "IY1") },
    { id: "iyX", label: "İY X", fields: ["iyX", "iyx", "IYX"], test: m => outcome(m, "IYX") },
    { id: "iy2", label: "İY 2", fields: ["iy2", "IY2"], test: m => outcome(m, "IY2") },

    { id: "cs1X", label: "Çifte Şans 1X", fields: ["cs1X", "CS1X"], test: m => outcome(m, "CS1X") },
    { id: "cs12", label: "Çifte Şans 12", fields: ["cs12", "CS12"], test: m => outcome(m, "CS12") },
    { id: "csX2", label: "Çifte Şans X2", fields: ["csX2", "CSX2"], test: m => outcome(m, "CSX2") },

    { id: "au15Alt", label: "1.5 Alt", fields: ["au15Alt", "ms15Alt"], test: m => outcome(m, "15ALT") },
    { id: "au15Ust", label: "1.5 Üst", fields: ["au15Ust", "ms15Ust"], test: m => outcome(m, "15UST") },
    { id: "au25Alt", label: "2.5 Alt", fields: ["au25Alt"], test: m => outcome(m, "25ALT") },
    { id: "au25Ust", label: "2.5 Üst", fields: ["au25Ust"], test: m => outcome(m, "25UST") },
    { id: "au35Alt", label: "3.5 Alt", fields: ["au35Alt"], test: m => outcome(m, "35ALT") },
    { id: "au35Ust", label: "3.5 Üst", fields: ["au35Ust"], test: m => outcome(m, "35UST") },

    { id: "kgVar", label: "KG Var", fields: ["kgVar"], test: m => outcome(m, "KGVAR") },
    { id: "kgYok", label: "KG Yok", fields: ["kgYok"], test: m => outcome(m, "KGYOK") },

    { id: "iy15Alt", label: "İY 1.5 Alt", fields: ["iy15Alt"], test: m => outcome(m, "IY15ALT") },
    { id: "iy15Ust", label: "İY 1.5 Üst", fields: ["iy15Ust"], test: m => outcome(m, "IY15UST") },

    { id: "gol01", label: "0-1 Gol", fields: ["gol01"], test: m => outcome(m, "GOL01") },
    { id: "gol23", label: "2-3 Gol", fields: ["gol23"], test: m => outcome(m, "GOL23") },
    { id: "gol46", label: "4-6 Gol", fields: ["gol46"], test: m => outcome(m, "GOL46") },
    { id: "gol7", label: "7+ Gol", fields: ["gol7"], test: m => outcome(m, "GOL7") },

    // Handikap oranlarında handikap çizgisi ve sonucu bulunmuyorsa
    // yanlış başarı yüzdesi üretmemek için sonuç hesaplanmaz.
    { id: "handicap1", label: "Handikap 1", fields: ["handicap1"], test: () => null },
    { id: "handicapX", label: "Handikap X", fields: ["handicapX"], test: () => null },
    { id: "handicap2", label: "Handikap 2", fields: ["handicap2"], test: () => null }
  ];

  const $ = id => document.getElementById(id);

  const escapeHTML = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function parseDate(value) {
    if (!value) return null;
    const text = String(value).trim();

    let m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }

    m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }

    return null;
  }

  function matchDate(match) {
    return parseDate(
      match?.date ??
      match?.matchDate ??
      match?.gameDate ??
      match?.tarih ??
      match?.datetime ??
      match?.dateTime
    );
  }

  function addDays(dateKey, days) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);

    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(dateKey) {
    if (!dateKey) return "-";
    const [y, m, d] = dateKey.split("-");
    return `${d}.${m}.${y}`;
  }

  function parseScore(value) {
    if (!value || typeof value !== "object") return null;

    const home = value.home;
    const away = value.away;

    if (
      home === null || home === undefined || home === "" ||
      away === null || away === undefined || away === "" ||
      !Number.isFinite(Number(home)) ||
      !Number.isFinite(Number(away))
    ) {
      return null;
    }

    return { home: Number(home), away: Number(away) };
  }

  function scoreOf(match, half = false) {
    return half
      ? parseScore(match?.halfTimeScore)
      : parseScore(match?.score);
  }

  // Tolerans yok: 2,10 ve 2.10 aynı; 2.1001 ve 2.10 farklı.
  function normalizeOdd(value) {
    if (value === null || value === undefined || value === "") return null;

    const text = String(value).trim().replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(text)) return null;

    const number = Number(text);
    if (!Number.isFinite(number) || number <= 0) return null;

    return number.toString();
  }

  function getOdd(match, market) {
    const containers = [
      match?.openingOdds,
      match?.openOdds,
      match?.opening,
      match?.odds,
      match?.oranlar,
      match
    ];

    for (const container of containers) {
      if (!container || typeof container !== "object") continue;

      for (const field of market.fields) {
        if (!Object.prototype.hasOwnProperty.call(container, field)) continue;

        const odd = normalizeOdd(container[field]);
        if (odd !== null) return odd;
      }
    }

    return null;
  }

  function outcome(match, type) {
    const isHalf = ["IY1", "IYX", "IY2", "IY15ALT", "IY15UST"].includes(type);
    const score = scoreOf(match, isHalf);
    if (!score) return null;

    const h = score.home;
    const a = score.away;
    const total = h + a;

    switch (type) {
      case "MS1": return h > a;
      case "MSX": return h === a;
      case "MS2": return h < a;

      case "IY1": return h > a;
      case "IYX": return h === a;
      case "IY2": return h < a;

      case "CS1X": return h >= a;
      case "CS12": return h !== a;
      case "CSX2": return h <= a;

      case "KGVAR": return h > 0 && a > 0;
      case "KGYOK": return h === 0 || a === 0;

      case "IY15ALT": return total <= 1;
      case "IY15UST": return total >= 2;

      case "15ALT": return total <= 1;
      case "15UST": return total >= 2;
      case "25ALT": return total <= 2;
      case "25UST": return total >= 3;
      case "35ALT": return total <= 3;
      case "35UST": return total >= 4;

      case "GOL01": return total <= 1;
      case "GOL23": return total >= 2 && total <= 3;
      case "GOL46": return total >= 4 && total <= 6;
      case "GOL7": return total >= 7;

      default: return null;
    }
  }

  function teamName(match, side) {
    return side === "home"
      ? match?.home ?? match?.homeTeam ?? match?.homeName ?? "Ev sahibi"
      : match?.away ?? match?.awayTeam ?? match?.awayName ?? "Deplasman";
  }

  function leagueName(match) {
    return match?.league ?? match?.leagueName ?? match?.competition ?? "-";
  }

  function timeOf(match) {
    const value = match?.time ?? match?.matchTime ?? match?.startTime ?? "";
    const m = String(value).match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "--:--";
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function addStyles() {
    if ($("dnaScoreAnalysisStyles")) return;

    const style = document.createElement("style");
    style.id = "dnaScoreAnalysisStyles";
    style.textContent = `
      .dsa-wrap {
        margin:22px 0;padding:18px;color:#e5edf8;
        background:linear-gradient(145deg,#111c30,#0b1424);
        border:1px solid rgba(96,165,250,.24);border-radius:17px;
        box-sizing:border-box;
      }
      .dsa-wrap * { box-sizing:border-box; }
      .dsa-title { margin:0 0 7px;font-size:20px;font-weight:900; }
      .dsa-desc { margin:0 0 16px;color:#aabbd2;font-size:12px;line-height:1.6; }
      .dsa-controls {
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
        gap:11px;margin-bottom:13px;
      }
      .dsa-field { display:flex;flex-direction:column;gap:6px;min-width:0; }
      .dsa-field label { color:#aabbd2;font-size:11px;font-weight:800; }
      .dsa-field select,.dsa-field input {
        width:100%;min-width:0;padding:11px;color:#f8fafc;
        background:#17243a;border:1px solid #334763;border-radius:9px;font-size:14px;
      }
      .dsa-field option { color:#fff;background:#17243a; }
      .dsa-run {
        width:100%;padding:12px 15px;margin-bottom:13px;border:0;border-radius:10px;
        color:white;background:linear-gradient(135deg,#2563eb,#059669);
        font-weight:900;cursor:pointer;
      }
      .dsa-status {
        margin:0 0 13px;padding:12px;color:#cbdcf2;background:#132139;
        border:1px solid #293d5a;border-radius:10px;font-size:12px;line-height:1.6;
      }
      .dsa-stats {
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;margin-bottom:14px;
      }
      .dsa-stat {
        padding:12px;background:#17243a;border:1px solid #2b405d;
        border-radius:10px;min-width:0;
      }
      .dsa-stat span { display:block;color:#9fb2cb;font-size:10px;margin-bottom:5px; }
      .dsa-stat strong { display:block;color:#60a5fa;font-size:19px;overflow-wrap:anywhere; }
      .dsa-market { margin:12px 0;overflow:hidden;border:1px solid #293d59;border-radius:11px; }
      .dsa-market-title { padding:11px 13px;background:#1b304c;font-weight:900; }
      .dsa-row {
        display:grid;grid-template-columns:1fr .7fr .7fr .8fr;gap:7px;
        align-items:center;padding:11px 13px;border-top:1px solid #22344c;
        cursor:pointer;font-size:12px;
      }
      .dsa-row:hover,.dsa-row.dsa-active { background:#1b2d46; }
      .dsa-row strong { color:#60a5fa;font-size:15px; }
      .dsa-row .dsa-rate { color:#4ade80;font-weight:900; }
      .dsa-head { color:#8fa5c0;font-size:10px;cursor:default; }
      .dsa-head:hover { background:transparent; }
      .dsa-details { display:none;padding:4px 13px 10px;background:#0e192a; }
      .dsa-details.dsa-open { display:block; }
      .dsa-match {
        display:grid;grid-template-columns:48px minmax(0,1fr) auto;
        gap:9px;align-items:center;padding:10px 0;
        border-bottom:1px solid #26364b;font-size:12px;
      }
      .dsa-match:last-child { border-bottom:0; }
      .dsa-time { color:#fbbf24;font-weight:800; }
      .dsa-teams { font-weight:800;line-height:1.5;overflow-wrap:anywhere; }
      .dsa-meta { margin-top:3px;color:#8fa5c0;font-size:10px; }
      .dsa-match-score { color:#4ade80;font-weight:900;white-space:nowrap; }
      .dsa-empty { padding:22px 12px;text-align:center;color:#9fb2cb;font-size:12px;line-height:1.7; }
      @media(max-width:600px) {
        .dsa-wrap { padding:12px; }
        .dsa-controls { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .dsa-stats { grid-template-columns:1fr; }
        .dsa-row { grid-template-columns:1fr 1fr; }
        .dsa-head { display:none; }
        .dsa-row>div:nth-child(2),.dsa-row>div:nth-child(3),.dsa-row>div:nth-child(4) { text-align:right; }
        .dsa-match { grid-template-columns:42px minmax(0,1fr); }
        .dsa-match-score { grid-column:2; }
      }
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    if ($("dnaScoreAnalysis")) return;

    const section = document.createElement("section");
    section.id = "dnaScoreAnalysis";
    section.className = "dsa-wrap";

    const options = Array.from({ length: 11 }, (_, i) =>
      `<option value="${i}">${i}</option>`
    ).join("");

    section.innerHTML = `
      <h2 class="dsa-title">🎯 Skor + Açılış Oranı İstatistiği</h2>
      <p class="dsa-desc">
        Seçilen maç sonu skoruyla biten geçmiş maçlar bulunur.
        Her market, kendi gerçek sonucuna göre ayrı hesaplanır.
        Oran toleransı yoktur; oranlar birebir eşleşmelidir.
      </p>

      <div class="dsa-controls">
        <div class="dsa-field">
          <label for="dsaHome">MAÇ SONU EV SAHİBİ GOLÜ</label>
          <select id="dsaHome">${options}</select>
        </div>
        <div class="dsa-field">
          <label for="dsaAway">MAÇ SONU DEPLASMAN GOLÜ</label>
          <select id="dsaAway">${options}</select>
        </div>
        <div class="dsa-field">
          <label for="dsaDate">ANALİZ TARİHİ</label>
          <input id="dsaDate" type="date">
        </div>
        <div class="dsa-field">
          <label for="dsaHalfHome">İLK YARI EV GOLÜ (İSTEĞE BAĞLI)</label>
          <select id="dsaHalfHome">
            <option value="">Farketmez</option>${options}
          </select>
        </div>
        <div class="dsa-field">
          <label for="dsaHalfAway">İLK YARI DEPLASMAN GOLÜ</label>
          <select id="dsaHalfAway">
            <option value="">Farketmez</option>${options}
          </select>
        </div>
      </div>

      <button type="button" class="dsa-run" id="dsaRun">
        🔎 Skor ve Oranları Eşleştir
      </button>

      <div class="dsa-status" id="dsaStatus">Maç verileri yükleniyor...</div>

      <div class="dsa-stats">
        <div class="dsa-stat"><span>SKOR EŞLEŞEN MAÇ</span><strong id="dsaScoreCount">-</strong></div>
        <div class="dsa-stat"><span>ORTAK ORAN GRUBU</span><strong id="dsaGroupCount">-</strong></div>
        <div class="dsa-stat"><span>EN YÜKSEK BAŞARI</span><strong id="dsaBestRate">-</strong></div>
      </div>

      <div id="dsaResults"></div>
    `;

    const existing = $("saContent");
    if (existing?.parentNode) {
      existing.insertAdjacentElement("afterend", section);
    } else {
      (document.querySelector("main") || document.body).appendChild(section);
    }

    $("dsaDate").value = $("saDate")?.value || todayKey();
    $("dsaRun").addEventListener("click", runAnalysis);

    const halfHome = $("dsaHalfHome");
    const halfAway = $("dsaHalfAway");

    halfHome.addEventListener("change", () => {
      if (halfHome.value === "") {
        halfAway.value = "";
        halfAway.required = false;
      } else {
        halfAway.required = true;
      }
    });

    halfAway.addEventListener("change", () => {
      if (halfAway.value === "") {
        halfHome.value = "";
        halfHome.required = false;
      } else {
        halfHome.required = true;
      }
    });
  }

  let matches = [];

  async function loadData() {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`matches.json yüklenemedi: HTTP ${response.status}`);
    }

    const json = await response.json();

    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.matches)) return json.matches;

    throw new Error("JSON içinde matches dizisi bulunamadı.");
  }

  function renderMatch(match) {
    const score = scoreOf(match);
    const half = scoreOf(match, true);

    return `
      <div class="dsa-match">
        <div class="dsa-time">${escapeHTML(timeOf(match))}</div>
        <div>
          <div class="dsa-teams">
            ${escapeHTML(teamName(match, "home"))} – ${escapeHTML(teamName(match, "away"))}
          </div>
          <div class="dsa-meta">
            ${escapeHTML(leagueName(match))} · ${escapeHTML(formatDate(matchDate(match)))}
            ${half ? ` · İY ${half.home}-${half.away}` : ""}
          </div>
        </div>
        <div class="dsa-match-score">${score ? `${score.home}-${score.away}` : "-"}</div>
      </div>
    `;
  }

  function runAnalysis() {
    const status = $("dsaStatus");
    const results = $("dsaResults");

    const targetDate = $("dsaDate").value;
    const home = Number($("dsaHome").value);
    const away = Number($("dsaAway").value);
    const halfHomeValue = $("dsaHalfHome").value;
    const halfAwayValue = $("dsaHalfAway").value;

    if (!targetDate) {
      status.textContent = "Lütfen analiz tarihi seç.";
      return;
    }

    if ((halfHomeValue === "") !== (halfAwayValue === "")) {
      status.textContent = "İlk yarı skorunu kullanacaksan iki gol alanını da seç.";
      return;
    }

    if (!matches.length) {
      status.textContent = "Maç verileri henüz yüklenmedi.";
      return;
    }

    const startDate = addDays(targetDate, -HISTORY_DAYS);
    const selectedHalf = halfHomeValue !== ""
      ? { home: Number(halfHomeValue), away: Number(halfAwayValue) }
      : null;

    const history = matches.filter(match => {
      const date = matchDate(match);
      const ft = scoreOf(match);
      const ht = scoreOf(match, true);

      if (!date || date < startDate || date >= targetDate || !ft) return false;
      if (ft.home !== home || ft.away !== away) return false;

      if (selectedHalf) {
        if (!ht) return false;
        if (ht.home !== selectedHalf.home || ht.away !== selectedHalf.away) return false;
      }

      return true;
    });

    $("dsaScoreCount").textContent = history.length;
    $("dsaGroupCount").textContent = "0";
    $("dsaBestRate").textContent = "-";

    if (!history.length) {
      status.textContent =
        `Son ${HISTORY_DAYS} günde ${home}-${away}` +
        `${selectedHalf ? ` ve İY ${selectedHalf.home}-${selectedHalf.away}` : ""}` +
        ` skoruyla biten maç bulunamadı.`;

      results.innerHTML = `
        <div class="dsa-empty">
          Seçilen skorla eşleşen geçmiş maç yok. Tarihi veya skoru değiştirebilirsin.
        </div>
      `;
      return;
    }

    const groups = new Map();

    for (const match of history) {
      for (const market of MARKETS) {
        const odd = getOdd(match, market);
        if (odd === null) continue;

        const key = `${market.id}|${odd}`;

        if (!groups.has(key)) {
          groups.set(key, {
            marketId: market.id,
            marketLabel: market.label,
            odd,
            total: 0,
            success: 0,
            known: 0,
            matches: []
          });
        }

        const group = groups.get(key);
        group.total++;
        group.matches.push(match);

        // KRİTİK DÜZELTME:
        // Her market kendi sonucuna göre değerlendirilir.
        const won = market.test(match);

        if (won !== null) {
          group.known++;
          if (won) group.success++;
        }
      }
    }

    // Yalnızca aynı market + birebir aynı oran + en az iki maç.
    const rows = [...groups.values()]
      .filter(group => group.total >= 2)
      .map(group => ({
        ...group,
        rate: group.known ? group.success / group.known * 100 : null
      }))
      .sort((a, b) =>
        (b.rate ?? -1) - (a.rate ?? -1) ||
        b.total - a.total ||
        Number(a.odd) - Number(b.odd)
      );

    $("dsaGroupCount").textContent = rows.length;

    const validRates = rows.filter(row => row.rate !== null);
    const bestRate = validRates.length
      ? Math.max(...validRates.map(row => row.rate))
      : null;

    $("dsaBestRate").textContent =
      bestRate === null ? "-" : `%${bestRate.toFixed(1).replace(".0", "")}`;

    status.innerHTML =
      `<strong>${escapeHTML(formatDate(targetDate))}</strong> · ` +
      `Maç sonu: <strong>${home}-${away}</strong>` +
      (selectedHalf
        ? ` · İlk yarı: <strong>${selectedHalf.home}-${selectedHalf.away}</strong>`
        : " · İlk yarı skoru filtresi kullanılmadı") +
      `<br>${history.length} skor eşleşmesi incelendi. ` +
      `${rows.length} market-oran grubu bulundu. ` +
      `Her marketin başarısı kendi sonucuna göre hesaplandı.`;

    if (!rows.length) {
      results.innerHTML = `
        <div class="dsa-empty">
          Skor eşleşmeleri bulundu ancak aynı açılış oranına sahip en az iki maçtan
          oluşan ortak grup bulunamadı.
          <br>Oran toleransı uygulanmadı.
          <br><br>Seçilen skorla biten maçlar:
          ${history.map(renderMatch).join("")}
        </div>
      `;
      return;
    }

    const byMarket = new Map();

    for (const row of rows) {
      if (!byMarket.has(row.marketId)) byMarket.set(row.marketId, []);
      byMarket.get(row.marketId).push(row);
    }

    let html = "";

    for (const market of MARKETS) {
      const marketRows = byMarket.get(market.id);
      if (!marketRows?.length) continue;

      html += `
        <section class="dsa-market">
          <div class="dsa-market-title">
            ${escapeHTML(market.label)} · ${marketRows.length} ortak oran grubu
          </div>
          <div class="dsa-row dsa-head">
            <div>AÇILIŞ ORANI</div>
            <div>ÖRNEKLEM</div>
            <div>KAZANAN</div>
            <div>BAŞARI</div>
          </div>
      `;

      marketRows.forEach((row, index) => {
        const detailId = `dsa-detail-${market.id}-${index}`;
        const rateText = row.rate === null
          ? "Hesaplanamadı"
          : `%${row.rate.toFixed(1).replace(".0", "")}`;

        html += `
          <div class="dsa-row" data-dsa-detail="${escapeHTML(detailId)}">
            <div><strong>${escapeHTML(row.odd)}</strong></div>
            <div>${row.total}</div>
            <div>${row.known ? row.success : "-"}</div>
            <div class="dsa-rate">${rateText}</div>
          </div>
          <div class="dsa-details" id="${escapeHTML(detailId)}">
            <div class="dsa-meta" style="padding:10px 0">
              ${escapeHTML(row.marketLabel)} oranı ${escapeHTML(row.odd)} ·
              ${row.total} eşleşen maç · tolerans yok
              ${row.known ? ` · ${row.success}/${row.known} kazanan` : ""}
            </div>
            ${row.matches.map(renderMatch).join("")}
          </div>
        `;
      });

      html += `</section>`;
    }

    html += `
      <section class="dsa-market">
        <div class="dsa-market-title">
          Seçilen skorla biten tüm maçlar (${history.length})
        </div>
        ${history.map(renderMatch).join("")}
      </section>
    `;

    results.innerHTML = html;

    results.querySelectorAll("[data-dsa-detail]").forEach(row => {
      row.addEventListener("click", () => {
        const detail = $(row.dataset.dsaDetail);
        if (!detail) return;

        const wasOpen = detail.classList.contains("dsa-open");

        results.querySelectorAll(".dsa-details.dsa-open")
          .forEach(el => el.classList.remove("dsa-open"));

        results.querySelectorAll(".dsa-row.dsa-active")
          .forEach(el => el.classList.remove("dsa-active"));

        if (!wasOpen) {
          detail.classList.add("dsa-open");
          row.classList.add("dsa-active");
        }
      });
    });
  }

  async function init() {
    addStyles();
    buildUI();

    try {
      $("dsaStatus").textContent = "Geçmiş maçlar yükleniyor...";
      matches = await loadData();

      $("dsaStatus").textContent =
        `${matches.length} maç yüklendi. Skoru seçip analiz butonuna bas.`;
    } catch (error) {
      console.error("DNA skor analizi:", error);
      $("dsaStatus").textContent =
        `Veriler yüklenemedi: ${error.message}. ./data/matches.json dosyasını kontrol et.`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
