
"use strict";

/* =========================================================
   DNA — SKOR + BİREBİR AÇILIŞ ORANI ORTAK ÖRNEKLEM ANALİZİ

   Veri: ./data/matches.json
   Dönem: Seçilen tarihten önceki 30 gün
   Maç sonu skoru: Zorunlu
   İlk yarı skoru: İsteğe bağlı
   Oran toleransı: YOK
   Mevcut dna.js motorundan bağımsız çalışır.
   ========================================================= */

(() => {
  const DATA_URL = "./data/matches.json";
  const HISTORY_DAYS = 30;

  const MARKETS = [
    { id: "ms1", label: "MS1", fields: ["ms1", "MS1"] },
    { id: "msX", label: "MSX", fields: ["msX", "msx", "MSX"] },
    { id: "ms2", label: "MS2", fields: ["ms2", "MS2"] },
    { id: "iy1", label: "İY1", fields: ["iy1", "IY1"] },
    { id: "iyX", label: "İYX", fields: ["iyX", "iyx", "IYX"] },
    { id: "iy2", label: "İY2", fields: ["iy2", "IY2"] },
    { id: "cs1X", label: "ÇŞ 1X", fields: ["cs1X", "CS1X"] },
    { id: "cs12", label: "ÇŞ 12", fields: ["cs12", "CS12"] },
    { id: "csX2", label: "ÇŞ X2", fields: ["csX2", "CSX2"] },
    { id: "au15Alt", label: "1.5 Alt", fields: ["au15Alt", "ms15Alt"] },
    { id: "au15Ust", label: "1.5 Üst", fields: ["au15Ust", "ms15Ust"] },
    { id: "au25Alt", label: "2.5 Alt", fields: ["au25Alt"] },
    { id: "au25Ust", label: "2.5 Üst", fields: ["au25Ust"] },
    { id: "au35Alt", label: "3.5 Alt", fields: ["au35Alt"] },
    { id: "au35Ust", label: "3.5 Üst", fields: ["au35Ust"] },
    { id: "kgVar", label: "KG Var", fields: ["kgVar"] },
    { id: "kgYok", label: "KG Yok", fields: ["kgYok"] },
    { id: "iy15Alt", label: "İY 1.5 Alt", fields: ["iy15Alt"] },
    { id: "iy15Ust", label: "İY 1.5 Üst", fields: ["iy15Ust"] },
    { id: "gol01", label: "0-1 Gol", fields: ["gol01"] },
    { id: "gol23", label: "2-3 Gol", fields: ["gol23"] },
    { id: "gol46", label: "4-6 Gol", fields: ["gol46"] },
    { id: "gol7", label: "7+ Gol", fields: ["gol7"] },
    { id: "handicap1", label: "Handikap 1", fields: ["handicap1"] },
    { id: "handicapX", label: "Handikap X", fields: ["handicapX"] },
    { id: "handicap2", label: "Handikap 2", fields: ["handicap2"] }
  ];

  const RESULT_TESTS = {
    MS1: s => s.home > s.away,
    MSX: s => s.home === s.away,
    MS2: s => s.away > s.home,
    IY1: s => s.home > s.away,
    IYX: s => s.home === s.away,
    IY2: s => s.away > s.home,
    KG_VAR: s => s.home > 0 && s.away > 0,
    KG_YOK: s => s.home === 0 || s.away === 0,
    IY15_ALT: s => s.home + s.away <= 1,
    IY15_UST: s => s.home + s.away >= 2,
    "15_ALT": s => s.home + s.away <= 1,
    "15_UST": s => s.home + s.away >= 2,
    "25_ALT": s => s.home + s.away <= 2,
    "25_UST": s => s.home + s.away >= 3,
    "35_ALT": s => s.home + s.away <= 3,
    "35_UST": s => s.home + s.away >= 4,
    GOL01: s => s.home + s.away <= 1,
    GOL23: s => s.home + s.away >= 2 && s.home + s.away <= 3,
    GOL46: s => s.home + s.away >= 4 && s.home + s.away <= 6,
    GOL7: s => s.home + s.away >= 7
  };

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

  /*
   * Tolerans uygulanmaz.
   * 1,85 ile 1.85 aynı sayı olarak kabul edilir.
   * 1.851, 1.85'e yuvarlanmaz ve eşleşmez.
   */
  function normalizeOdd(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

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
        if (!Object.prototype.hasOwnProperty.call(container, field)) {
          continue;
        }

        const odd = normalizeOdd(container[field]);
        if (odd !== null) return odd;
      }
    }

    return null;
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

  function marketOutcome(match, resultId) {
    const test = RESULT_TESTS[resultId];
    if (!test) return null;

    const isHalf = ["IY1", "IYX", "IY2", "IY15_ALT", "IY15_UST"].includes(resultId);
    const score = scoreOf(match, isHalf);

    return score ? test(score) : null;
  }

  function addStyles() {
    if ($("dnaScoreAnalysisStyles")) return;

    const style = document.createElement("style");
    style.id = "dnaScoreAnalysisStyles";
    style.textContent = `
      .dsa-wrap {
        margin: 22px 0;
        padding: 18px;
        color: #e5edf8;
        background: linear-gradient(145deg,#111c30,#0b1424);
        border: 1px solid rgba(96,165,250,.24);
        border-radius: 17px;
        box-sizing: border-box;
      }
      .dsa-wrap * { box-sizing: border-box; }
      .dsa-title { margin: 0 0 7px; font-size: 20px; font-weight: 900; }
      .dsa-desc { margin: 0 0 16px; color: #aabbd2; font-size: 12px; line-height: 1.6; }
      .dsa-controls {
        display: grid;
        grid-template-columns: repeat(3,minmax(0,1fr));
        gap: 11px;
        margin-bottom: 13px;
      }
      .dsa-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .dsa-field label { color: #aabbd2; font-size: 11px; font-weight: 800; }
      .dsa-field select, .dsa-field input {
        width: 100%; min-width: 0; padding: 11px;
        color: #f8fafc; background: #17243a;
        border: 1px solid #334763; border-radius: 9px;
        font-size: 14px;
      }
      .dsa-field option { color: #fff; background: #17243a; }
      .dsa-run {
        width: 100%; padding: 12px 15px; margin-bottom: 13px;
        border: 0; border-radius: 10px; color: white;
        background: linear-gradient(135deg,#2563eb,#059669);
        font-weight: 900; cursor: pointer;
      }
      .dsa-status {
        margin: 0 0 13px; padding: 12px;
        color: #cbdcf2; background: #132139;
        border: 1px solid #293d5a; border-radius: 10px;
        font-size: 12px; line-height: 1.6;
      }
      .dsa-stats {
        display: grid; grid-template-columns: repeat(3,minmax(0,1fr));
        gap: 8px; margin-bottom: 14px;
      }
      .dsa-stat {
        padding: 12px; background: #17243a;
        border: 1px solid #2b405d; border-radius: 10px;
        min-width: 0;
      }
      .dsa-stat span { display: block; color: #9fb2cb; font-size: 10px; margin-bottom: 5px; }
      .dsa-stat strong { display: block; color: #60a5fa; font-size: 19px; overflow-wrap: anywhere; }
      .dsa-market { margin: 12px 0; overflow: hidden; border: 1px solid #293d59; border-radius: 11px; }
      .dsa-market-title { padding: 11px 13px; background: #1b304c; font-weight: 900; }
      .dsa-row {
        display: grid; grid-template-columns: 1fr .7fr .7fr .8fr;
        gap: 7px; align-items: center; padding: 11px 13px;
        border-top: 1px solid #22344c; cursor: pointer;
        font-size: 12px;
      }
      .dsa-row:hover, .dsa-row.dsa-active { background: #1b2d46; }
      .dsa-row strong { color: #60a5fa; font-size: 15px; }
      .dsa-row .dsa-rate { color: #4ade80; font-weight: 900; }
      .dsa-head { color: #8fa5c0; font-size: 10px; cursor: default; }
      .dsa-head:hover { background: transparent; }
      .dsa-details { display: none; padding: 4px 13px 10px; background: #0e192a; }
      .dsa-details.dsa-open { display: block; }
      .dsa-match {
        display: grid; grid-template-columns: 48px minmax(0,1fr) auto;
        gap: 9px; align-items: center; padding: 10px 0;
        border-bottom: 1px solid #26364b; font-size: 12px;
      }
      .dsa-match:last-child { border-bottom: 0; }
      .dsa-time { color: #fbbf24; font-weight: 800; }
      .dsa-teams { font-weight: 800; line-height: 1.5; overflow-wrap: anywhere; }
      .dsa-meta { margin-top: 3px; color: #8fa5c0; font-size: 10px; }
      .dsa-match-score { color: #4ade80; font-weight: 900; white-space: nowrap; }
      .dsa-empty { padding: 22px 12px; text-align: center; color: #9fb2cb; font-size: 12px; line-height: 1.7; }
      @media(max-width:600px) {
        .dsa-wrap { padding: 12px; }
        .dsa-controls { grid-template-columns: repeat(2,minmax(0,1fr)); }
        .dsa-stats { grid-template-columns: 1fr; }
        .dsa-row { grid-template-columns: 1fr 1fr; }
        .dsa-head { display: none; }
        .dsa-row > div:nth-child(2), .dsa-row > div:nth-child(3), .dsa-row > div:nth-child(4) { text-align: right; }
        .dsa-match { grid-template-columns: 42px minmax(0,1fr); }
        .dsa-match-score { grid-column: 2; }
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
      <h2 class="dsa-title">🎯 Skor + Açılış Oranı Örneklem Analizi</h2>
      <p class="dsa-desc">
        Seçtiğin maç sonu skoruyla bitmiş geçmiş maçlar taranır.
        İstersen ilk yarı skorunu da belirleyebilirsin.
        Açılış oranları yuvarlanmadan, toleranssız eşleştirilir.
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
        <div class="dsa-field">
          <label for="dsaResult">BAŞARISI HESAPLANACAK SONUÇ</label>
          <select id="dsaResult">
            <option value="MS1">MS1</option>
            <option value="MSX">MSX</option>
            <option value="MS2">MS2</option>
            <option value="IY1">İY1</option>
            <option value="IYX">İYX</option>
            <option value="IY2">İY2</option>
            <option value="KG_VAR">KG Var</option>
            <option value="KG_YOK">KG Yok</option>
            <option value="IY15_ALT">İY 1.5 Alt</option>
            <option value="IY15_UST">İY 1.5 Üst</option>
            <option value="15_ALT">1.5 Alt</option>
            <option value="15_UST">1.5 Üst</option>
            <option value="25_ALT">2.5 Alt</option>
            <option value="25_UST">2.5 Üst</option>
            <option value="35_ALT">3.5 Alt</option>
            <option value="35_UST">3.5 Üst</option>
            <option value="GOL01">0-1 Gol</option>
            <option value="GOL23">2-3 Gol</option>
            <option value="GOL46">4-6 Gol</option>
            <option value="GOL7">7+ Gol</option>
          </select>
        </div>
      </div>

      <button type="button" class="dsa-run" id="dsaRun">🔎 Skor ve Oranları Eşleştir</button>
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
      document.querySelector("main")?.appendChild(section);
    }

    $("dsaDate").value = $("saDate")?.value || todayKey();
    $("dsaRun").addEventListener("click", runAnalysis);

    // İlk yarı skorlarından biri seçilirse diğeri zorunlu olur.
    $("dsaHalfHome").addEventListener("change", () => {
      if ($("dsaHalfHome").value !== "") {
        $("dsaHalfAway").required = true;
      } else {
        $("dsaHalfAway").required = false;
        $("dsaHalfAway").value = "";
      }
    });

    $("dsaHalfAway").addEventListener("change", () => {
      if ($("dsaHalfAway").value !== "") {
        $("dsaHalfHome").required = true;
      } else {
        $("dsaHalfHome").required = false;
        $("dsaHalfHome").value = "";
      }
    });
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
    const resultId = $("dsaResult").value;

    if (!targetDate) {
      status.textContent = "Lütfen analiz tarihi seç.";
      return;
    }

    if ((halfHomeValue === "") !== (halfAwayValue === "")) {
      status.textContent = "İlk yarı skorunu kullanacaksan iki gol alanını da seç. Kullanmayacaksan ikisini de Farketmez bırak.";
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

      if (!date || date < startDate || date >= targetDate || !ft) {
        return false;
      }

      if (ft.home !== home || ft.away !== away) {
        return false;
      }

      if (selectedHalf) {
        if (!ht) return false;
        if (ht.home !== selectedHalf.home || ht.away !== selectedHalf.away) {
          return false;
        }
      }

      return true;
    });

    $("dsaScoreCount").textContent = history.length;
    $("dsaGroupCount").textContent = "0";
    $("dsaBestRate").textContent = "-";

    if (!history.length) {
      status.textContent = `Son ${HISTORY_DAYS} günde ${home}-${away}${selectedHalf ? ` ve İY ${selectedHalf.home}-${selectedHalf.away}` : ""} skoruyla biten maç bulunamadı.`;
      results.innerHTML = `<div class="dsa-empty">Seçilen skorla eşleşen geçmiş maç yok. Tarihi veya skoru değiştirebilirsin.</div>`;
      return;
    }

    const groups = new Map();

    for (const match of history) {
      const success = marketOutcome(match, resultId);

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

        if (success !== null) {
          group.known++;
          if (success) group.success++;
        }
      }
    }

    // Ortak örneklem: aynı market + aynı açılış oranı en az iki maçta bulunmalı.
    const rows = [...groups.values()]
      .filter(group => group.total >= 2)
      .map(group => ({
        ...group,
        rate: group.known ? group.success / group.known * 100 : null
      }))
      .sort((a, b) =>
        b.total - a.total ||
        (b.rate ?? -1) - (a.rate ?? -1) ||
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
      `${rows.length} market-oran grubu en az iki geçmiş maçta birebir eşleşti. ` +
      `Başarı hesabı: ${escapeHTML(resultId)}.`;

    if (!rows.length) {
      results.innerHTML = `
        <div class="dsa-empty">
          Skor eşleşmeleri bulundu ancak aynı açılış oranına sahip en az iki maçtan oluşan ortak grup yok.
          <br>Oran toleransı uygulanmadı.
        </div>
        <div class="dsa-market">
          <div class="dsa-market-title">Skor eşleşen maçlar</div>
          ${history.map(renderMatch).join("")}
        </div>
      `;
      return;
    }

    const byMarket = new Map();

    for (const row of rows) {
      if (!byMarket.has(row.marketId)) {
        byMarket.set(row.marketId, []);
      }
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
          ? "-"
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
              ${row.total} eşleşen maç · oran toleransı yok
            </div>
            ${row.matches.map(renderMatch).join("")}
          </div>
        `;
      });

      html += `</section>`;
    }

    html += `
      <div class="dsa-market">
        <div class="dsa-market-title">Seçilen skorla biten tüm maçlar (${history.length})</div>
        ${history.map(renderMatch).join("")}
      </div>
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
        `${matches.length} maç yüklendi. Skor ve oran analizi için seçim yapıp butona bas.`;
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
