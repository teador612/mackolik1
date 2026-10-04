(function () {
  "use strict";

  /*
   * ============================================================
   * BUGÜNÜN MAÇLARI
   * ============================================================
   *
   * Veri:
   * GitHub repository'deki matches.json
   *
   * Analiz:
   * Son 60 gün
   *
   * Eşik:
   * %70
   *
   * Minimum örneklem:
   * 5 maç
   *
   * Minimum oran:
   * 1.40
   *
   * ============================================================
   */

  const DATA_URL =
    "https://raw.githubusercontent.com/teador612/mackolik1/main/data/matches.json";

  const HISTORY_DAYS = 60;

  let MATCHES = [];
  let HISTORICAL = [];
  let HISTORY_START = "";

  const $ = id => document.getElementById(id);

  /* ============================================================
     GENEL
  ============================================================ */

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c]));
  }

  function num(v) {
    if (v == null || v === "") return NaN;

    if (typeof v === "number") {
      return Number.isFinite(v) ? v : NaN;
    }

    const n = Number(
      String(v)
        .trim()
        .replace(",", ".")
    );

    return Number.isFinite(n) ? n : NaN;
  }

  function today() {
    const d = new Date();

    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function getHistoryStartDate() {
    const d = new Date();

    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - HISTORY_DAYS);

    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function isoDate(v) {
    if (!v) return "";

    const s = String(v).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }

    const m = s.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
    );

    if (!m) return "";

    return (
      m[3] +
      "-" +
      String(m[2]).padStart(2, "0") +
      "-" +
      String(m[1]).padStart(2, "0")
    );
  }

  function dateTR(v) {
    const p = String(v).split("-");

    if (p.length !== 3) return v;

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

  /* ============================================================
     SKOR
  ============================================================ */

  function scoreObject(v) {
    if (!v || typeof v !== "object") {
      return null;
    }

    const h = num(v.home);
    const a = num(v.away);

    if (
      Number.isFinite(h) &&
      Number.isFinite(a)
    ) {
      return [h, a];
    }

    return null;
  }

  function scoreString(v) {
    if (!v) return null;

    const m = String(v).match(
      /(\d+)\s*[-:]\s*(\d+)/
    );

    if (!m) return null;

    return [
      Number(m[1]),
      Number(m[2])
    ];
  }

  function getFT(m) {
    let s = scoreObject(m.score);

    if (s) return s;

    s = scoreObject(m.fullTimeScore);

    if (s) return s;

    s = scoreObject(m.finalScore);

    if (s) return s;

    return scoreString(m.score);
  }

  function getHT(m) {
    let s = scoreObject(m.halfTimeScore);

    if (s) return s;

    s = scoreObject(m.htScore);

    if (s) return s;

    return null;
  }

  function isPlayed(m) {
    const ft = getFT(m);

    if (!ft) return false;

    const status = String(
      m.status == null ? "" : m.status
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

  /* ============================================================
     ORANLAR
  ============================================================ */

  function getOdds(m) {
    const o =
      m.odds ||
      m.openingOdds ||
      m.opening ||
      m.markets ||
      {};

    const r = {};

    function add(name, ...keys) {
      for (const key of keys) {
        const n = num(o[key]);

        if (Number.isFinite(n)) {
          r[name] = n;
          return;
        }
      }
    }

    /*
     * SADECE İSTEDİĞİMİZ MARKETLER
     */

    add("ms1", "ms1");
    add("ms0", "ms0", "msX");
    add("ms2", "ms2");

    add("kgVar", "kgVar");

    add("iy1", "iy1");
    add("iy0", "iy0", "iyX");
    add("iy2", "iy2");

    add("iyOver05", "iyOver05");
    add("iyUnder05", "iyUnder05");

    add(
      "iyOver15",
      "iyOver15",
      "iy15Ust"
    );

    add(
      "iyUnder15",
      "iyUnder15",
      "iy15Alt"
    );

    add(
      "over15",
      "over15",
      "au15Ust"
    );

    add(
      "over25",
      "over25",
      "au25Ust"
    );

    return r;
  }

  /* ============================================================
     NORMALIZE
  ============================================================ */

  function normalize(m) {
    return {
      raw: m,

      code: String(
        m.code ||
        m.id ||
        ""
      ),

      date: isoDate(
        m.date ||
        m.matchDate
      ),

      time: String(
        m.time ||
        m.startTime ||
        ""
      ),

      league: String(
        m.league ||
        m.leagueName ||
        ""
      ),

      home: String(
        m.home ||
        m.homeTeam ||
        ""
      ),

      away: String(
        m.away ||
        m.awayTeam ||
        ""
      ),

      odds: getOdds(m),

      scoreFT: getFT(m),

      scoreHT: getHT(m),

      played: isPlayed(m)
    };
  }

  /* ============================================================
     TAHMİN TÜRLERİ
  ============================================================ */

  const RESULTS = [

    {
      name: "MS1",
      keys: ["ms1"],
      test: ft =>
        ft &&
        ft[0] > ft[1]
    },

    {
      name: "MSX",
      keys: ["ms0"],
      test: ft =>
        ft &&
        ft[0] === ft[1]
    },

    {
      name: "MS2",
      keys: ["ms2"],
      test: ft =>
        ft &&
        ft[0] < ft[1]
    },

    {
      name: "KG Var",
      keys: ["kgVar"],
      test: ft =>
        ft &&
        ft[0] > 0 &&
        ft[1] > 0
    },

    {
      name: "İY1",
      keys: ["iy1"],
      test: (ft, ht) =>
        ht &&
        ht[0] > ht[1]
    },

    {
      name: "İYX",
      keys: ["iy0"],
      test: (ft, ht) =>
        ht &&
        ht[0] === ht[1]
    },

    {
      name: "İY2",
      keys: ["iy2"],
      test: (ft, ht) =>
        ht &&
        ht[0] < ht[1]
    },

    {
      name: "İY 0,5 Üst",
      keys: ["iyOver05"],
      test: (ft, ht) =>
        ht &&
        ht[0] + ht[1] >= 1
    },

    {
      name: "İY 0,5 Alt",
      keys: ["iyUnder05"],
      test: (ft, ht) =>
        ht &&
        ht[0] + ht[1] === 0
    },

    {
      name: "İY 1,5 Üst",
      keys: ["iyOver15"],
      test: (ft, ht) =>
        ht &&
        ht[0] + ht[1] >= 2
    },

    {
      name: "İY 1,5 Alt",
      keys: ["iyUnder15"],
      test: (ft, ht) =>
        ht &&
        ht[0] + ht[1] < 2
    },

    {
      name: "1,5 Üst",
      keys: ["over15"],
      test: ft =>
        ft &&
        ft[0] + ft[1] >= 2
    },

    {
      name: "2,5 Üst",
      keys: ["over25"],
      test: ft =>
        ft &&
        ft[0] + ft[1] >= 3
    }

  ];

  /* ============================================================
     AYARLAR
  ============================================================ */

  function getThreshold() {
    const el = $("tdThr");

    const value =
      el ? num(el.value) : 70;

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

    const value =
      el ? num(el.value) : 5;

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

    const value =
      el ? num(el.value) : 1.4;

    return Math.max(
      1,
      Number.isFinite(value)
        ? value
        : 1.4
    );
  }

  /* ============================================================
     ORAN EŞLEŞTİRME
  ============================================================ */

  function sameOdd(a, b) {
    return (
      Math.abs(
        Number(a) -
        Number(b)
      ) < 0.0001
    );
  }

  function historicalByOdd(
    match,
    key
  ) {
    const currentOdd =
      match.odds[key];

    if (
      !Number.isFinite(
        currentOdd
      )
    ) {
      return [];
    }

    return HISTORICAL.filter(
      h => {

        const oldOdd =
          h.odds[key];

        return (
          Number.isFinite(oldOdd) &&
          sameOdd(
            oldOdd,
            currentOdd
          )
        );

      }
    );
  }

  /* ============================================================
     BAŞARI HESABI
  ============================================================ */

  function getStat(
    list,
    result
  ) {
    let total = 0;
    let success = 0;

    for (const m of list) {

      if (!m.scoreFT) {
        continue;
      }

      const ok =
        result.test(
          m.scoreFT,
          m.scoreHT
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
      rate:
        (success / total) * 100
    };
  }

  /* ============================================================
     HER MARKET AYRI AYRI
  ============================================================ */

  function analyzeEach(match) {

    const threshold =
      getThreshold();

    const minSample =
      getMinSample();

    const minOdd =
      getMinOdd();

    const results = [];

    for (const result of RESULTS) {

      let key = null;
      let odd = null;

      for (const k of result.keys) {

        if (
          Number.isFinite(
            match.odds[k]
          )
        ) {

          key = k;
          odd = match.odds[k];

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

      if (
        stat.total <
        minSample
      ) {
        continue;
      }

      if (
        stat.rate <
        threshold
      ) {
        continue;
      }

      results.push({

        name:
          result.name,

        key,

        odd,

        rate:
          stat.rate,

        total:
          stat.total,

        success:
          stat.success

      });

    }

    return results.sort(
      (a, b) =>
        b.rate - a.rate ||
        b.total - a.total
    );
  }

  /* ============================================================
     ANALİZ
  ============================================================ */

  function analyze(match) {
    return analyzeEach(match);
  }

  /* ============================================================
     TAHMİN KARTLARI
  ============================================================ */

  function predictionCards(
    predictions
  ) {

    if (!predictions.length) {
      return `
        <div style="
          color:#8496b1;
          font-size:12px;
          padding:10px;
        ">
          Başka uygun tahmin bulunamadı.
        </div>
      `;
    }

    return predictions
      .map(p => {

        return `
          <div style="
            background:#15270b;
            border:2px solid #4baf16;
            border-radius:14px;
            padding:11px 10px;
            text-align:center;
            min-width:130px;
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

            <div style="
              color:#8092ad;
              font-size:11px;
              margin-top:4px;
            ">
              Oran ${Number(p.odd).toFixed(2)}
            </div>

          </div>
        `;

      })
      .join("");
  }

  /* ============================================================
     + AÇILAN BÖLÜM
  ============================================================ */

  function expandedHTML(
    match,
    predictions
  ) {

    if (!predictions.length) {

      return `
        <div style="
          color:#8798b1;
          font-size:12px;
        ">
          Bu maç için şartları sağlayan
          tahmin bulunamadı.
        </div>
      `;

    }

    const others =
      predictions.slice(1);

    return `

      <div style="
        color:#899ab3;
        font-size:12px;
        line-height:1.6;
        margin-bottom:10px;
      ">

        Her oran türü ayrı aranır ·
        son ${HISTORY_DAYS} gün ·
        eşik %${getThreshold()} ·
        en az ${getMinSample()} maç

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

  /* ============================================================
     MAÇ KARTI
  ============================================================ */

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
        ? (
            match.scoreFT[0] +
            " - " +
            match.scoreFT[1]
          )
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
                ${esc(
                  match.time ||
                  "--:--"
                )}
              </span>

              <span>·</span>

              <span>
                ${esc(
                  match.league ||
                  ""
                )}
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

                    %${Number(
                      best.rate
                    ).toFixed(1)}

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

  /* ============================================================
     TARİHLER
  ============================================================ */

  function fillDates() {

    const select =
      $("tdDate");

    if (!select) {
      return;
    }

    const dates = [
      ...new Set(
        MATCHES
          .map(
            m => m.date
          )
          .filter(Boolean)
      )
    ].sort();

    select.innerHTML = "";

    const todayDate =
      today();

    dates.forEach(
      date => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          date;

        option.textContent =
          dateTR(date);

        select.appendChild(
          option
        );

      }
    );

    /*
     * Önce bugün
     */

    if (
      dates.includes(
        todayDate
      )
    ) {

      select.value =
        todayDate;

      return;
    }

    /*
     * Bugün yoksa bugünden
     * sonraki ilk tarih
     */

    const future =
      dates.find(
        date =>
          date >= todayDate
      );

    if (future) {

      select.value =
        future;

      return;
    }

    /*
     * Gelecek tarih yoksa
     * en son tarihi seç
     */

    if (dates.length) {

      select.value =
        dates[
          dates.length - 1
        ];

    }

  }

  /* ============================================================
     RENDER
  ============================================================ */

  function render() {

    const dateEl =
      $("tdDate");

    const resultsEl =
      $("tdResults");

    if (
      !dateEl ||
      !resultsEl
    ) {
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

    const matches =
      MATCHES
        .filter(
          match =>
            match.date ===
            selectedDate
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

    matches.forEach(
      (match, index) => {

        const predictions =
          analyze(match);

        if (
          predictions.length
        ) {
          idealCount++;
        }

        if (
          onlyIdeal &&
          !predictions.length
        ) {
          return;
        }

        html +=
          matchHTML(
            match,
            predictions,
            index
          );

        shown++;

      }
    );

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
        dateTR(selectedDate) +
        " · " +
        shown +
        " maç";

    }

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

    resultsEl.innerHTML =
      html;

    /*
     * + / -
     */

    resultsEl
      .querySelectorAll(".plus")
      .forEach(
        button => {

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

        }
      );

  }

  /* ============================================================
     VERİ YÜKLE
  ============================================================ */

  async function load() {

    const status =
      $("tdStatus");

    if (status) {
      status.textContent =
        "Veriler yükleniyor...";
    }

    try {

      HISTORY_START =
        getHistoryStartDate();

      /*
       * GitHub RAW'dan alıyoruz.
       *
       * cache:
       * no-store
       *
       * timestamp:
       * tarayıcı eski JSON'u kullanmasın.
       */

      const response =
        await fetch(
          DATA_URL +
          "?v=" +
          Date.now(),
          {
            method: "GET",
            cache: "no-store",
            credentials: "omit"
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
          : Array.isArray(
              data.matches
            )
              ? data.matches
              : [];

      if (!raw.length) {

        throw new Error(
          "matches.json içinde maç bulunamadı."
        );

      }

      MATCHES =
        raw
          .map(normalize)
          .filter(
            match =>
              match.date &&
              match.home &&
              match.away
          );

      /*
       * SON 60 GÜN
       *
       * Sadece oynanmış maçlar
       */

      const todayDate =
        today();

      HISTORICAL =
        MATCHES.filter(
          match =>
            match.played &&
            match.date >=
              HISTORY_START &&
            match.date <=
              todayDate
        );

      /*
       * Tarihleri doldur
       */

      fillDates();

      /*
       * Ekranı oluştur
       */

      render();

    } catch (error) {

      console.error(
        "Bugünün Maçları veri hatası:",
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

            matches.json bağlantısı kurulamadı.

            <br><br>

            <small>
              ${esc(
                error.message
              )}
            </small>

          </div>

        `;

      }

    }

  }

  /* ============================================================
     EVENTLER
  ============================================================ */

  const dateEl =
    $("tdDate");

  if (dateEl) {

    dateEl.addEventListener(
      "change",
      render
    );

  }

  const basisEl =
    $("tdBasis");

  if (basisEl) {

    basisEl.addEventListener(
      "change",
      render
    );

  }

  const thresholdEl =
    $("tdThr");

  if (thresholdEl) {

    thresholdEl.addEventListener(
      "change",
      render
    );

  }

  const minEl =
    $("tdMin");

  if (minEl) {

    minEl.addEventListener(
      "change",
      render
    );

  }

  const oddEl =
    $("tdOdd");

  if (oddEl) {

    oddEl.addEventListener(
      "change",
      render
    );

  }

  const onlyEl =
    $("tdOnly");

  if (onlyEl) {

    onlyEl.addEventListener(
      "change",
      render
    );

  }

  const allEl =
    $("tdAll");

  if (allEl) {

    allEl.addEventListener(
      "change",
      render
    );

  }

  const analyzeEl =
    $("tdAnalyze");

  if (analyzeEl) {

    analyzeEl.addEventListener(
      "click",
      render
    );

  }

  const refreshEl =
    $("tdRefresh");

  if (refreshEl) {

    refreshEl.addEventListener(
      "click",
      load
    );

  }

  /* ============================================================
     BAŞLAT
  ============================================================ */

  load();

})();
