(function () {
  "use strict";

  /* =========================================================
     AYARLAR
  ========================================================= */

  const DATA_URL = "./data/matches.json";

  // SON 60 GÜN
  const HISTORY_DAYS = 60;

  let MATCHES = [];
  let HISTORICAL = [];
  let HISTORY_START = "";


  /* =========================================================
     DOM
  ========================================================= */

  const $ = (id) => document.getElementById(id);


  /* =========================================================
     YARDIMCI
  ========================================================= */

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c]));
  }


  function num(value) {
    if (value == null || value === "") return NaN;

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : NaN;
    }

    const n = Number(
      String(value)
        .trim()
        .replace(",", ".")
    );

    return Number.isFinite(n) ? n : NaN;
  }


  function pad(n) {
    return String(n).padStart(2, "0");
  }


  function today() {
    const d = new Date();

    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate())
    );
  }


  /*
    Bugün - 60 gün

    Örneğin:
    04.10.2026 -> 05.08.2026
  */
  function getHistoryStartDate() {
    const d = new Date();

    d.setHours(0, 0, 0, 0);

    d.setDate(d.getDate() - HISTORY_DAYS);

    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate())
    );
  }


  function isoDate(value) {
    if (!value) return "";

    const s = String(value).trim();

    // 2026-10-04
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }

    // 04.10.2026 / 04-10-2026 / 04/10/2026
    const m = s.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
    );

    if (!m) return "";

    return (
      m[3] +
      "-" +
      pad(m[2]) +
      "-" +
      pad(m[1])
    );
  }


  function dateTR(value) {
    const p = String(value || "").split("-");

    if (p.length !== 3) {
      return value || "";
    }

    const months = [
      "",
      "Oca",
      "Şub",
      "Mar",
      "Nis",
      "May",
      "Haz",
      "Tem",
      "Ağu",
      "Eyl",
      "Eki",
      "Kas",
      "Ara"
    ];

    return (
      p[2] +
      " " +
      (months[Number(p[1])] || p[1]) +
      " " +
      p[0]
    );
  }


  /* =========================================================
     SKOR
  ========================================================= */

  function scoreObject(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const home = num(value.home);
    const away = num(value.away);

    if (
      Number.isFinite(home) &&
      Number.isFinite(away)
    ) {
      return [home, away];
    }

    return null;
  }


  function scoreString(value) {
    if (!value) return null;

    const m = String(value).match(
      /(\d+)\s*[-:]\s*(\d+)/
    );

    if (!m) return null;

    return [
      Number(m[1]),
      Number(m[2])
    ];
  }


  function getFT(match) {
    let score = scoreObject(match.score);

    if (score) return score;

    score = scoreObject(match.fullTimeScore);

    if (score) return score;

    score = scoreObject(match.finalScore);

    if (score) return score;

    return scoreString(match.score);
  }


  function getHT(match) {
    let score = scoreObject(match.halfTimeScore);

    if (score) return score;

    score = scoreObject(match.htScore);

    if (score) return score;

    return null;
  }


  function isPlayed(match) {
    const ft = getFT(match);

    if (!ft) return false;

    const status = String(
      match.status == null ? "" : match.status
    ).toLowerCase();

    if (
      status === "not_started" ||
      status === "scheduled" ||
      status === "upcoming" ||
      status === "0"
    ) {
      return false;
    }

    return true;
  }


  /* =========================================================
     ORANLAR
  ========================================================= */

  function getOdds(match) {
    const source =
      match.odds ||
      match.openingOdds ||
      match.opening ||
      match.markets ||
      {};

    const odds = {};

    function add(name, ...keys) {
      for (const key of keys) {
        const value = num(source[key]);

        if (Number.isFinite(value)) {
          odds[name] = value;
          return;
        }
      }
    }

    // MS
    add("ms1", "ms1");
    add("ms0", "ms0", "msX");
    add("ms2", "ms2");

    // KG
    add("kgVar", "kgVar");
    add("kgYok", "kgYok");

    // 2,5
    add("over25", "over25", "au25Ust");
    add("under25", "under25", "au25Alt");

    // İY
    add("iy1", "iy1");
    add("iy0", "iy0", "iyX");
    add("iy2", "iy2");

    // İY 0,5
    add("iyOver05", "iyOver05");

    // İY 1,5
    add("iyOver15", "iyOver15", "iy15Ust");
    add("iyUnder15", "iyUnder15", "iy15Alt");

    return odds;
  }


  /* =========================================================
     NORMALIZE
  ========================================================= */

  function normalize(match) {
    return {
      raw: match,

      code: String(
        match.code ||
        match.id ||
        ""
      ),

      date: isoDate(
        match.date ||
        match.matchDate
      ),

      time: String(
        match.time ||
        match.startTime ||
        ""
      ),

      league: String(
        match.league ||
        match.leagueName ||
        ""
      ),

      home: String(
        match.home ||
        match.homeTeam ||
        ""
      ),

      away: String(
        match.away ||
        match.awayTeam ||
        ""
      ),

      odds: getOdds(match),

      scoreFT: getFT(match),

      scoreHT: getHT(match),

      played: isPlayed(match)
    };
  }


  /* =========================================================
     TAHMİN TÜRLERİ
  ========================================================= */

  const RESULTS = [

    {
      name: "MS1",
      keys: ["ms1"],
      test: (ft) =>
        ft &&
        ft[0] > ft[1]
    },

    {
      name: "MS0",
      keys: ["ms0"],
      test: (ft) =>
        ft &&
        ft[0] === ft[1]
    },

    {
      name: "MS2",
      keys: ["ms2"],
      test: (ft) =>
        ft &&
        ft[0] < ft[1]
    },

    {
      name: "KG Var",
      keys: ["kgVar"],
      test: (ft) =>
        ft &&
        ft[0] > 0 &&
        ft[1] > 0
    },

    {
      name: "2,5 Üst",
      keys: ["over25"],
      test: (ft) =>
        ft &&
        ft[0] + ft[1] > 2.5
    },

    {
      name: "İY 0,5 Üst",
      keys: ["iyOver05"],
      test: (ft, ht) =>
        ht &&
        ht[0] + ht[1] > 0.5
    },

    {
      name: "İY 1,5 Üst",
      keys: ["iyOver15"],
      test: (ft, ht) =>
        ht &&
        ht[0] + ht[1] > 1.5
    }

  ];


  /* =========================================================
     ORAN KARŞILAŞTIRMA
  ========================================================= */

  function sameOdd(a, b) {
    return Math.abs(
      Number(a) - Number(b)
    ) < 0.0001;
  }


  function historicalByOdd(match, key) {
    const currentOdd = match.odds[key];

    if (!Number.isFinite(currentOdd)) {
      return [];
    }

    return HISTORICAL.filter((history) => {

      const oldOdd = history.odds[key];

      return (
        Number.isFinite(oldOdd) &&
        sameOdd(oldOdd, currentOdd)
      );

    });
  }


  /* =========================================================
     AYARLAR
  ========================================================= */

  function getThreshold() {
    const el = $("tdThr");

    if (!el) return 70;

    const value = num(el.value);

    return Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(value)
          ? value
          : 70
      )
    );
  }


  function getMinSample() {
    const el = $("tdMin");

    if (!el) return 5;

    const value = num(el.value);

    return Math.max(
      1,
      Math.floor(
        Number.isFinite(value)
          ? value
          : 5
      )
    );
  }


  function getMinOdd() {
    const el = $("tdOdd");

    if (!el) return 1.4;

    const value = num(el.value);

    return Math.max(
      1,
      Number.isFinite(value)
        ? value
        : 1.4
    );
  }


  /* =========================================================
     BAŞARI HESABI
  ========================================================= */

  function getStat(list, result) {
    let total = 0;
    let success = 0;

    for (const match of list) {

      if (!match.scoreFT) {
        continue;
      }

      const ok = result.test(
        match.scoreFT,
        match.scoreHT
      );

      if (ok == null) {
        continue;
      }

      total++;

      if (ok) {
        success++;
      }
    }

    if (!total) {
      return null;
    }

    return {
      total,
      success,
      rate: (success / total) * 100
    };
  }


  /* =========================================================
     HER ORAN TÜRÜ AYRI AYRI
  ========================================================= */

  function analyzeEach(match) {

    const threshold = getThreshold();
    const minSample = getMinSample();
    const minOdd = getMinOdd();

    const results = [];

    for (const result of RESULTS) {

      let key = null;
      let odd = null;

      for (const possibleKey of result.keys) {

        if (
          Number.isFinite(
            match.odds[possibleKey]
          )
        ) {

          key = possibleKey;
          odd = match.odds[possibleKey];

          break;
        }
      }

      if (!key) {
        continue;
      }

      if (odd < minOdd) {
        continue;
      }

      const history =
        historicalByOdd(
          match,
          key
        );

      const stat =
        getStat(
          history,
          result
        );

      if (!stat) {
        continue;
      }

      if (stat.total < minSample) {
        continue;
      }

      if (stat.rate < threshold) {
        continue;
      }

      results.push({
        name: result.name,
        key,
        odd,
        rate: stat.rate,
        total: stat.total,
        success: stat.success
      });
    }

    return results.sort(
      (a, b) =>
        b.rate - a.rate ||
        b.total - a.total
    );
  }


  /* =========================================================
     BİRLEŞİK ORAN
  ========================================================= */

  function analyzeCombined(match, basis) {

    const threshold = getThreshold();
    const minSample = getMinSample();
    const minOdd = getMinOdd();

    const keys = basis
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const pool = HISTORICAL.filter(
      (history) => {

        return keys.every((key) => {

          const currentOdd =
            match.odds[key];

          const oldOdd =
            history.odds[key];

          return (
            Number.isFinite(currentOdd) &&
            Number.isFinite(oldOdd) &&
            sameOdd(
              currentOdd,
              oldOdd
            )
          );
        });
      }
    );

    const results = [];

    for (const result of RESULTS) {

      const stat =
        getStat(
          pool,
          result
        );

      if (!stat) {
        continue;
      }

      if (stat.total < minSample) {
        continue;
      }

      if (stat.rate < threshold) {
        continue;
      }

      let odd = null;

      for (const key of result.keys) {

        if (
          Number.isFinite(
            match.odds[key]
          )
        ) {

          odd =
            match.odds[key];

          break;
        }
      }

      if (
        odd !== null &&
        odd < minOdd
      ) {
        continue;
      }

      results.push({
        name: result.name,
        odd,
        rate: stat.rate,
        total: stat.total,
        success: stat.success
      });
    }

    return results.sort(
      (a, b) =>
        b.rate - a.rate ||
        b.total - a.total
    );
  }


  /* =========================================================
     ORANSIZ ANALİZ
  ========================================================= */

  function analyzeNoOdds(match, basis) {

    const threshold = getThreshold();
    const minSample = getMinSample();

    let pool = [];

    if (basis === "league") {

      pool = HISTORICAL.filter(
        (history) =>
          history.league &&
          history.league === match.league
      );

    } else if (basis === "team") {

      pool = HISTORICAL.filter(
        (history) =>
          history.home === match.home ||
          history.away === match.home ||
          history.home === match.away ||
          history.away === match.away
      );

    } else {

      pool = HISTORICAL.slice();

    }

    const results = [];

    for (const result of RESULTS) {

      const stat =
        getStat(
          pool,
          result
        );

      if (!stat) {
        continue;
      }

      if (stat.total < minSample) {
        continue;
      }

      if (stat.rate < threshold) {
        continue;
      }

      results.push({
        name: result.name,
        odd: null,
        rate: stat.rate,
        total: stat.total,
        success: stat.success
      });
    }

    return results.sort(
      (a, b) =>
        b.rate - a.rate ||
        b.total - a.total
    );
  }


  /* =========================================================
     ANA ANALİZ
  ========================================================= */

  function analyze(match) {

    const basisEl = $("tdBasis");

    const basis =
      basisEl
        ? basisEl.value
        : "each";

    if (basis === "each") {
      return analyzeEach(match);
    }

    if (
      basis === "league" ||
      basis === "team" ||
      basis === "all"
    ) {
      return analyzeNoOdds(
        match,
        basis
      );
    }

    return analyzeCombined(
      match,
      basis
    );
  }


  /* =========================================================
     TAHMİN KARTLARI
  ========================================================= */

  function predictionCards(predictions) {

    if (!predictions.length) {
      return `
        <div class="no-sample">
          Bu maç için başka uygun tahmin bulunamadı.
        </div>
      `;
    }

    return predictions.map((p) => {

      return `
        <div style="
          background:#15270b;
          border:2px solid #4baf16;
          border-radius:14px;
          padding:11px 10px;
          text-align:center;
          min-width:145px;
          flex:1;
        ">

          <div style="
            color:#e9f4df;
            font-size:14px;
            font-weight:800;
          ">
            ${esc(p.name)}
          </div>

          <div style="
            color:#86ed43;
            font-size:25px;
            font-weight:900;
            margin-top:3px;
          ">
            %${Number(p.rate).toFixed(1)}
          </div>

          <div style="
            color:#91a2bb;
            font-size:12px;
            margin-top:2px;
          ">
            ${p.success}/${p.total}
          </div>

          ${
            p.odd != null
              ? `
                <div style="
                  color:#8fa1bb;
                  font-size:11px;
                  margin-top:4px;
                ">
                  Oran ${Number(p.odd).toFixed(2)}
                </div>
              `
              : ""
          }

        </div>
      `;

    }).join("");
  }


  /* =========================================================
     + AÇILAN BÖLÜM
     SADECE DİĞER TAHMİNLER
  ========================================================= */

  function expandedHTML(match, predictions) {

    if (!predictions.length) {

      return `
        <div style="
          color:#8798b1;
          font-size:12px;
        ">
          Şartları sağlayan tahmin bulunamadı.
        </div>
      `;
    }

    const others =
      predictions.slice(1);

    const threshold =
      getThreshold();

    const minSample =
      getMinSample();

    return `
      <div style="
        color:#899ab3;
        font-size:12px;
        line-height:1.6;
        margin-bottom:10px;
      ">

        Her oran türü ayrı aranır ·
        ${dateTR(HISTORY_START)} ve sonrası ·
        eşik %${threshold} ·
        en az ${minSample} maç ·
        son ${HISTORY_DAYS} gün

      </div>

      ${
        others.length
          ? `
            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:10px;
            ">
              ${predictionCards(others)}
            </div>
          `
          : `
            <div style="
              background:#101c2e;
              border:1px solid #243958;
              border-radius:12px;
              padding:13px;
              color:#8a9ab3;
              font-size:12px;
            ">
              Bu maç için ilk tahmin dışında
              başka uygun tahmin yok.
            </div>
          `
      }
    `;
  }


  /* =========================================================
     MAÇ KARTI
  ========================================================= */

  function matchHTML(
    match,
    predictions,
    index
  ) {

    const detailId =
      "detail_" + index;

    const best =
      predictions[0];

    const score =
      match.scoreFT
        ? `${match.scoreFT[0]} - ${match.scoreFT[1]}`
        : "";

    return `
      <div class="match">

        <div class="match-main">

          <button
            class="plus"
            data-detail="${detailId}"
            type="button"
          >
            +
          </button>

          <div class="match-info">

            <div class="match-meta">

              <span>
                ${esc(match.time || "--:--")}
              </span>

              <span>·</span>

              <span>
                ${esc(match.league || "")}
              </span>

            </div>

            <div class="teams">
              ${esc(match.home)}
              -
              ${esc(match.away)}
            </div>

          </div>

          <div class="predictions">

            ${
              score
                ? `
                  <div style="
                    border:2px solid #29476b;
                    background:#10213a;
                    color:#12e6df;
                    border-radius:10px;
                    padding:7px 11px;
                    font-size:17px;
                    font-weight:900;
                    white-space:nowrap;
                  ">
                    ${score}
                  </div>
                `
                : ""
            }

            ${
              best
                ? `
                  <div class="prediction best">
                    ${esc(best.name)}
                    %${Number(best.rate).toFixed(1)}
                  </div>
                `
                : ""
            }

          </div>

        </div>

        <div
          class="match-detail"
          id="${detailId}"
        >
          ${expandedHTML(
            match,
            predictions
          )}
        </div>

      </div>
    `;
  }


  /* =========================================================
     TARİHLER
  ========================================================= */

  function fillDates() {

    const select =
      $("tdDate");

    if (!select) return;

    const dates = [
      ...new Set(
        MATCHES
          .map((m) => m.date)
          .filter(Boolean)
      )
    ].sort();

    select.innerHTML = "";

    const todayDate =
      today();

    /*
      Önce bugünü seç
    */

    for (const date of dates) {

      const option =
        document.createElement(
          "option"
        );

      option.value = date;

      option.textContent =
        dateTR(date);

      if (date === todayDate) {
        option.selected = true;
      }

      select.appendChild(
        option
      );
    }

    /*
      Bugün yoksa:
      bugüne en yakın ileri tarihi,
      o da yoksa son tarihi seç.
    */

    if (
      !select.value &&
      dates.length
    ) {

      const nearest =
        dates.find(
          (date) =>
            date >= todayDate
        );

      select.value =
        nearest ||
        dates[dates.length - 1];
    }
  }


  /* =========================================================
     RENDER
  ========================================================= */

  function render() {

    const dateEl =
      $("tdDate");

    const resultsEl =
      $("tdResults");

    if (!dateEl || !resultsEl) {
      return;
    }

    const selectedDate =
      dateEl.value;

    const onlyIdealEl =
      $("tdOnly");

    const onlyIdeal =
      onlyIdealEl
        ? onlyIdealEl.checked
        : false;

    /*
      Seçilen günün TÜM maçları
    */

    const matches =
      MATCHES
        .filter(
          (match) =>
            match.date === selectedDate
        )
        .sort(
          (a, b) =>
            String(a.time)
              .localeCompare(
                String(b.time)
              )
        );

    let html = "";

    let idealCount = 0;

    let shown = 0;

    for (
      let i = 0;
      i < matches.length;
      i++
    ) {

      const match =
        matches[i];

      const predictions =
        analyze(match);

      if (predictions.length) {
        idealCount++;
      }

      /*
        Sadece ideal sonucu olanlar
      */

      if (
        onlyIdeal &&
        predictions.length === 0
      ) {
        continue;
      }

      html +=
        matchHTML(
          match,
          predictions,
          i
        );

      shown++;
    }


    /* =======================================================
       İSTATİSTİKLER
    ======================================================= */

    const statMatches =
      $("statMatches");

    const statIdeal =
      $("statIdeal");

    const statPool =
      $("statPool");

    const status =
      $("tdStatus");


    if (statMatches) {
      statMatches.textContent =
        matches.length.toLocaleString(
          "tr-TR"
        );
    }


    if (statIdeal) {
      statIdeal.textContent =
        idealCount.toLocaleString(
          "tr-TR"
        );
    }


    if (statPool) {
      statPool.textContent =
        HISTORICAL.length.toLocaleString(
          "tr-TR"
        );
    }


    if (status) {
      status.textContent =
        `${dateTR(selectedDate)} · ${shown} maç`;
    }


    /* =======================================================
       SONUÇ YOK
    ======================================================= */

    if (!shown) {

      resultsEl.innerHTML = `
        <div class="empty">

          ${
            onlyIdeal
              ? "Bu tarihte şartları sağlayan tahminli maç yok."
              : "Bu tarihte maç bulunamadı."
          }

        </div>
      `;

      return;
    }


    /* =======================================================
       MAÇLARI YAZ
    ======================================================= */

    resultsEl.innerHTML =
      html;


    /* =======================================================
       + / -
    ======================================================= */

    resultsEl
      .querySelectorAll(".plus")
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const detailId =
              button.dataset.detail;

            const detail =
              document.getElementById(
                detailId
              );

            if (!detail) {
              return;
            }

            const open =
              detail.classList.toggle(
                "open"
              );

            button.classList.toggle(
              "open",
              open
            );

            button.textContent =
              open
                ? "−"
                : "+";
          }
        );

      });
  }


  /* =========================================================
     VERİ YÜKLE
  ========================================================= */

  async function load() {

    const status =
      $("tdStatus");

    if (status) {
      status.textContent =
        "Veriler yükleniyor...";
    }

    try {

      /*
        Son 60 gün başlangıcı
        her yüklemede yeniden hesaplanır.
      */

      HISTORY_START =
        getHistoryStartDate();


      const response =
        await fetch(
          DATA_URL +
          "?v=" +
          Date.now(),
          {
            cache: "no-store"
          }
        );


      if (!response.ok) {
        throw new Error(
          "matches.json HTTP " +
          response.status
        );
      }


      const data =
        await response.json();


      const raw =
        Array.isArray(data)
          ? data
          : Array.isArray(data.matches)
            ? data.matches
            : [];


      MATCHES =
        raw
          .map(normalize)
          .filter(
            (match) =>
              match.date &&
              match.home &&
              match.away
          );


      /*
        =====================================================
        SON 60 GÜN GEÇMİŞ HAVUZU

        Sadece:
        - oynanmış maçlar
        - HISTORY_START ve sonrası
        - bugün ve öncesi
        =====================================================
      */

      const todayDate =
        today();


      HISTORICAL =
        MATCHES.filter(
          (match) =>
            match.played &&
            match.date >= HISTORY_START &&
            match.date <= todayDate
        );


      fillDates();

      render();

    }
    catch (error) {

      console.error(
        "Bugünün Maçları:",
        error
      );

      if (status) {
        status.textContent =
          "Veri yüklenemedi";
      }

      const results =
        $("tdResults");

      if (results) {

        results.innerHTML = `
          <div class="empty">

            <b>Veriler yüklenemedi.</b>

            <br><br>

            data/matches.json kontrol edilmeli.

            <br><br>

            ${esc(error.message)}

          </div>
        `;
      }
    }
  }


  /* =========================================================
     EVENTLER
  ========================================================= */

  const analyzeButton =
    $("tdAnalyze");

  if (analyzeButton) {
    analyzeButton.addEventListener(
      "click",
      render
    );
  }


  const refreshButton =
    $("tdRefresh");

  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      load
    );
  }


  const dateSelect =
    $("tdDate");

  if (dateSelect) {
    dateSelect.addEventListener(
      "change",
      render
    );
  }


  const basisSelect =
    $("tdBasis");

  if (basisSelect) {
    basisSelect.addEventListener(
      "change",
      render
    );
  }


  const threshold =
    $("tdThr");

  if (threshold) {
    threshold.addEventListener(
      "change",
      render
    );
  }


  const minSample =
    $("tdMin");

  if (minSample) {
    minSample.addEventListener(
      "change",
      render
    );
  }


  const minOdd =
    $("tdOdd");

  if (minOdd) {
    minOdd.addEventListener(
      "change",
      render
    );
  }


  const onlyIdeal =
    $("tdOnly");

  if (onlyIdeal) {
    onlyIdeal.addEventListener(
      "change",
      render
    );
  }


  const allResults =
    $("tdAll");

  if (allResults) {
    allResults.addEventListener(
      "change",
      render
    );
  }


  /* =========================================================
     BAŞLAT
  ========================================================= */

  load();

})();
