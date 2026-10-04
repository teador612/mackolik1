(function () {
  "use strict";

  /*
  ============================================================
  MACKOLIK - BUGÜNÜN MAÇLARI
  ORAN-ANALİZ MANTIĞI
  ============================================================

  Veri:
  ./data/matches.json

  Geçmiş:
  Son 60 gün

  Varsayılan:
  Eşik       : %70
  Min maç    : 5
  Min oran   : 1.40

  MARKETLER:
  MS1
  MSX
  MS2
  KG Var
  İY1
  İYX
  İY2
  İY 0,5 Üst
  İY 0,5 Alt
  İY 1,5 Üst
  İY 1,5 Alt
  1,5 Üst
  2,5 Üst

  ============================================================
  */

  const DATA_URL = "./data/matches.json";
  const HISTORY_DAYS = 60;

  let DATA = [];
  let HISTORY = [];
  let INDEX = Object.create(null);

  let HISTORY_START = "";

  const $ = id => document.getElementById(id);

  /* ============================================================
     YARDIMCI
  ============================================================ */

  function esc(value) {
    return String(value ?? "")
      .replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
  }

  function num(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return NaN;
    }

    if (typeof value === "number") {
      return Number.isFinite(value)
        ? value
        : NaN;
    }

    const n = Number(
      String(value)
        .trim()
        .replace(",", ".")
    );

    return Number.isFinite(n)
      ? n
      : NaN;
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

  function historyStart() {
    const d = new Date();

    d.setHours(0, 0, 0, 0);

    d.setDate(
      d.getDate() - HISTORY_DAYS
    );

    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate())
    );
  }

  function normalizeDate(value) {
    if (!value) {
      return "";
    }

    const s = String(value).trim();

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(s)
    ) {
      return s;
    }

    const m = s.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
    );

    if (!m) {
      return "";
    }

    return (
      m[3] +
      "-" +
      pad(m[2]) +
      "-" +
      pad(m[1])
    );
  }

  function dateTR(value) {
    const p = String(value).split("-");

    if (p.length !== 3) {
      return value;
    }

    return (
      p[2] +
      "." +
      p[1] +
      "." +
      p[0]
    );
  }

  /* ============================================================
     SKOR
  ============================================================ */

  function scoreObject(value) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return null;
    }

    const h = num(value.home);
    const a = num(value.away);

    if (
      Number.isFinite(h) &&
      Number.isFinite(a)
    ) {
      return [h, a];
    }

    return null;
  }

  function scoreText(value) {
    if (!value) {
      return null;
    }

    const m = String(value).match(
      /(\d+)\s*[-:]\s*(\d+)/
    );

    if (!m) {
      return null;
    }

    return [
      Number(m[1]),
      Number(m[2])
    ];
  }

  function getFT(match) {
    let score =
      scoreObject(match.score);

    if (score) {
      return score;
    }

    score =
      scoreObject(
        match.fullTimeScore
      );

    if (score) {
      return score;
    }

    score =
      scoreObject(
        match.finalScore
      );

    if (score) {
      return score;
    }

    return scoreText(
      match.scoreFT
    );
  }

  function getHT(match) {
    let score =
      scoreObject(
        match.halfTimeScore
      );

    if (score) {
      return score;
    }

    score =
      scoreObject(
        match.htScore
      );

    if (score) {
      return score;
    }

    return scoreText(
      match.scoreHT
    );
  }

  function isPlayed(match) {
    const ft =
      getFT(match);

    if (!ft) {
      return false;
    }

    const status =
      String(
        match.status ?? ""
      ).toLowerCase();

    if (
      status === "0" ||
      status === "not_started" ||
      status === "scheduled" ||
      status === "upcoming"
    ) {
      return false;
    }

    return true;
  }

  /* ============================================================
     ORANLAR
     ============================================================ */

  function getOdds(match) {

    const source =
      match.openingOdds ||
      match.odds ||
      match.opening ||
      match.markets ||
      {};

    const odds = {};

    function add(
      target,
      ...keys
    ) {
      for (
        const key of keys
      ) {

        const value =
          num(source[key]);

        if (
          Number.isFinite(value)
        ) {

          odds[target] =
            value;

          return;
        }

      }
    }

    /* MS */

    add(
      "ms1",
      "ms1"
    );

    add(
      "ms0",
      "ms0",
      "msX",
      "msx"
    );

    add(
      "ms2",
      "ms2"
    );

    /* KG */

    add(
      "kgVar",
      "kgVar",
      "kgvar",
      "kg1",
      "kg"
    );

    /* İY */

    add(
      "iy1",
      "iy1"
    );

    add(
      "iy0",
      "iy0",
      "iyX",
      "iyx"
    );

    add(
      "iy2",
      "iy2"
    );

    /* İY 0,5 */

    add(
      "iyOver05",
      "iyOver05",
      "iy05Ust",
      "iy05Üst",
      "iy05Over",
      "iy05ust",
      "iy05_ust"
    );

    add(
      "iyUnder05",
      "iyUnder05",
      "iy05Alt",
      "iy05alt",
      "iy05Under",
      "iy05_alt"
    );

    /* İY 1,5 */

    add(
      "iyOver15",
      "iyOver15",
      "iy15Ust",
      "iy15Üst",
      "iy15Over",
      "iy15ust",
      "iy15_ust"
    );

    add(
      "iyUnder15",
      "iyUnder15",
      "iy15Alt",
      "iy15alt",
      "iy15Under",
      "iy15_alt"
    );

    /* MAÇ 1,5 ÜST */

    add(
      "over15",
      "over15",
      "au15Ust",
      "au15Üst",
      "au15Over",
      "au15ust",
      "au15_ust"
    );

    /* MAÇ 2,5 ÜST */

    add(
      "over25",
      "over25",
      "au25Ust",
      "au25Üst",
      "au25Over",
      "au25ust",
      "au25_ust"
    );

    return odds;
  }

  /* ============================================================
     NORMALIZE
  ============================================================ */

  function normalize(match) {

    return {

      raw: match,

      code: String(
        match.code ||
        match.id ||
        ""
      ),

      date:
        normalizeDate(
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

      odds:
        getOdds(match),

      scoreFT:
        getFT(match),

      scoreHT:
        getHT(match),

      played:
        isPlayed(match)

    };
  }

  /* ============================================================
     MARKETLER
  ============================================================ */

  const RESULTS = [

    {
      key: "ms1",
      name: "MS1",
      test: ft =>
        ft &&
        ft[0] > ft[1]
    },

    {
      key: "ms0",
      name: "MSX",
      test: ft =>
        ft &&
        ft[0] === ft[1]
    },

    {
      key: "ms2",
      name: "MS2",
      test: ft =>
        ft &&
        ft[0] < ft[1]
    },

    {
      key: "kgVar",
      name: "KG Var",
      test: ft =>
        ft &&
        ft[0] > 0 &&
        ft[1] > 0
    },

    {
      key: "iy1",
      name: "İY1",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] > ht[1]
    },

    {
      key: "iy0",
      name: "İYX",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] === ht[1]
    },

    {
      key: "iy2",
      name: "İY2",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] < ht[1]
    },

    {
      key: "iyOver05",
      name: "İY 0,5 Üst",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] +
        ht[1] >= 1
    },

    {
      key: "iyUnder05",
      name: "İY 0,5 Alt",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] +
        ht[1] === 0
    },

    {
      key: "iyOver15",
      name: "İY 1,5 Üst",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] +
        ht[1] >= 2
    },

    {
      key: "iyUnder15",
      name: "İY 1,5 Alt",
      test: (
        ft,
        ht
      ) =>
        ht &&
        ht[0] +
        ht[1] < 2
    },

    {
      key: "over15",
      name: "1,5 Üst",
      test: ft =>
        ft &&
        ft[0] +
        ft[1] >= 2
    },

    {
      key: "over25",
      name: "2,5 Üst",
      test: ft =>
        ft &&
        ft[0] +
        ft[1] >= 3
    }

  ];

  /* ============================================================
     AYARLAR
  ============================================================ */

  function getThreshold() {

    const el =
      $("tdThr");

    const n =
      el
        ? num(el.value)
        : 70;

    return Number.isFinite(n)
      ? n
      : 70;
  }

  function getMinSample() {

    const el =
      $("tdMin");

    const n =
      el
        ? num(el.value)
        : 5;

    return Math.max(
      1,
      Math.floor(
        Number.isFinite(n)
          ? n
          : 5
      )
    );
  }

  function getMinOdd() {

    const el =
      $("tdOdd");

    const n =
      el
        ? num(el.value)
        : 1.4;

    return Number.isFinite(n)
      ? n
      : 1.4;
  }

  /* ============================================================
     ORAN ANAHTARI
     ============================================================ */

  function oddKey(
    market,
    odd
  ) {
    return (
      market +
      "|" +
      Number(odd).toFixed(2)
    );
  }

  /* ============================================================
     ORAN İNDEKSİ
     
     ORAN-ANALİZDEKİ BUILD INDEX
     MANTIĞI BURADA KULLANILIYOR.
  ============================================================ */

  function buildIndex() {

    INDEX =
      Object.create(null);

    for (
      let i = 0;
      i < HISTORY.length;
      i++
    ) {

      const match =
        HISTORY[i];

      const odds =
        match.odds || {};

      Object.keys(
        odds
      ).forEach(
        key => {

          const odd =
            num(odds[key]);

          if (
            !Number.isFinite(odd) ||
            odd <= 0
          ) {
            return;
          }

          const k =
            oddKey(
              key,
              odd
            );

          if (
            !INDEX[k]
          ) {
            INDEX[k] = [];
          }

          INDEX[k].push(
            match
          );

        }
      );

    }
  }

  /* ============================================================
     İSTATİSTİK
  ============================================================ */

  function statsOf(
    history,
    result
  ) {

    let total = 0;
    let success = 0;

    for (
      let i = 0;
      i < history.length;
      i++
    ) {

      const match =
        history[i];

      if (
        !match.scoreFT
      ) {
        continue;
      }

      const value =
        result.test(
          match.scoreFT,
          match.scoreHT
        );

      if (
        value === null ||
        value === undefined
      ) {
        continue;
      }

      total++;

      if (value) {
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
        100 *
        success /
        total

    };
  }

  /* ============================================================
     TEK MARKET ANALİZİ
  ============================================================ */

  function analyzeMarket(
    match,
    result
  ) {

    const odds =
      match.odds || {};

    const odd =
      num(
        odds[result.key]
      );

    if (
      !Number.isFinite(odd)
    ) {
      return null;
    }

    const minOdd =
      getMinOdd();

    if (
      odd < minOdd
    ) {
      return null;
    }

    const key =
      oddKey(
        result.key,
        odd
      );

    const history =
      INDEX[key] || [];

    if (
      history.length === 0
    ) {
      return null;
    }

    const stat =
      statsOf(
        history,
        result
      );

    if (!stat) {
      return null;
    }

    const minSample =
      getMinSample();

    const threshold =
      getThreshold();

    if (
      stat.total <
      minSample
    ) {
      return null;
    }

    if (
      stat.rate <
      threshold
    ) {
      return null;
    }

    return {

      key:
        result.key,

      name:
        result.name,

      odd,

      total:
        stat.total,

      success:
        stat.success,

      rate:
        stat.rate,

      history

    };
  }

  /* ============================================================
     MAÇ ANALİZİ
  ============================================================ */

  function analyzeMatch(
    match
  ) {

    const predictions = [];

    for (
      let i = 0;
      i < RESULTS.length;
      i++
    ) {

      const result =
        RESULTS[i];

      const prediction =
        analyzeMarket(
          match,
          result
        );

      if (
        prediction
      ) {
        predictions.push(
          prediction
        );
      }

    }

    /*
     * Önce başarı yüzdesi
     * sonra örneklem sayısı
     */

    predictions.sort(
      (a, b) => {

        if (
          b.rate !==
          a.rate
        ) {
          return (
            b.rate -
            a.rate
          );
        }

        return (
          b.total -
          a.total
        );

      }
    );

    return predictions;
  }

  /* ============================================================
     TARİH
  ============================================================ */

  function fillDates() {

    const select =
      $("tdDate");

    if (!select) {
      return;
    }

    const dates = [
      ...new Set(
        DATA
          .map(
            m => m.date
          )
          .filter(Boolean)
      )
    ].sort();

    select.innerHTML = "";

    const now =
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

    if (
      dates.includes(now)
    ) {

      select.value =
        now;

      return;
    }

    const future =
      dates.find(
        date =>
          date >= now
      );

    if (future) {

      select.value =
        future;

      return;
    }

    if (dates.length) {

      select.value =
        dates[
          dates.length - 1
        ];

    }

  }

  /* ============================================================
     TAHMİN KARTLARI
  ============================================================ */

  function predictionCard(
    prediction
  ) {

    return `

      <div class="prediction-box">

        <div class="prediction-name">
          ${esc(
            prediction.name
          )}
        </div>

        <div class="prediction-rate">
          %${prediction.rate.toFixed(1)}
        </div>

        <div class="prediction-count">
          ${prediction.success}/${prediction.total}
        </div>

        <div class="prediction-odd">
          Oran ${prediction.odd.toFixed(2)}
        </div>

      </div>

    `;
  }

  /* ============================================================
     + AÇILAN ALAN
  ============================================================ */

  function detailHTML(
    predictions
  ) {

    if (
      predictions.length <= 1
    ) {

      return `

        <div class="detail-empty">
          Bu maç için başka uygun
          tahmin bulunamadı.
        </div>

      `;

    }

    const others =
      predictions.slice(1);

    return `

      <div class="detail-info">

        Her oran türü ayrı aranır ·
        son ${HISTORY_DAYS} gün ·
        eşik %${getThreshold()} ·
        en az ${getMinSample()} maç

      </div>

      <div class="prediction-grid">

        ${others
          .map(
            predictionCard
          )
          .join("")}

      </div>

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

    const detailId =
      "prediction_detail_" +
      index;

    return `

      <div class="match-card">

        <div class="match-main">

          <button
            type="button"
            class="plus"
            data-detail="${detailId}"
          >
            +
          </button>

          <div class="match-info">

            <div class="match-meta">

              ${esc(
                match.time ||
                "--:--"
              )}

              ·

              ${esc(
                match.league ||
                ""
              )}

            </div>

            <div class="teams">

              ${esc(
                match.home
              )}

              -

              ${esc(
                match.away
              )}

            </div>

          </div>

          <div class="match-right">

            ${
              score
                ? `
                  <div class="score">
                    ${score}
                  </div>
                `
                : ""
            }

            ${
              best
                ? `
                  <div class="best-prediction">
                    ${esc(
                      best.name
                    )}
                    %${best.rate.toFixed(1)}
                  </div>
                `
                : `
                  <div class="no-prediction">
                    Tahmin yok
                  </div>
                `
            }

          </div>

        </div>

        <div
          id="${detailId}"
          class="match-detail"
        >

          ${detailHTML(
            predictions
          )}

        </div>

      </div>

    `;
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

    const onlyIdeal =
      $("tdOnly")
        ? $("tdOnly").checked
        : false;

    const showAll =
      $("tdAll")
        ? $("tdAll").checked
        : false;

    /*
     * Seçilen günün maçları
     */

    const matches =
      DATA
        .filter(
          match =>
            match.date ===
            selectedDate
        )
        .sort(
          (a, b) =>
            String(
              a.time
            ).localeCompare(
              String(
                b.time
              )
            )
        );

    let html = "";

    let idealCount = 0;

    let shownCount = 0;

    matches.forEach(
      (match, index) => {

        const predictions =
          analyzeMatch(
            match
          );

        if (
          predictions.length
        ) {
          idealCount++;
        }

        /*
         * Sadece ideal tahminli maçlar
         */

        if (
          onlyIdeal &&
          !predictions.length
        ) {
          return;
        }

        /*
         * Tüm sonuçları göster:
         *
         * Bu seçenek açık değilse
         * tahmini olmayan maçlar da
         * listelenebilir fakat
         * sağ tarafta "Tahmin yok" görünür.
         */

        if (
          !showAll &&
          !predictions.length &&
          onlyIdeal
        ) {
          return;
        }

        html +=
          matchHTML(
            match,
            predictions,
            index
          );

        shownCount++;

      }
    );

    /*
     * İstatistikler
     */

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
        HISTORY.length.toLocaleString(
          "tr-TR"
        );

    }

    if (status) {

      status.textContent =
        dateTR(
          selectedDate
        ) +
        " · " +
        shownCount +
        " maç";

    }

    /*
     * Hiç maç yok
     */

    if (
      !matches.length
    ) {

      resultsEl.innerHTML = `

        <div class="empty">

          ${dateTR(
            selectedDate
          )}

          için maç bulunamadı.

        </div>

      `;

      return;
    }

    /*
     * Hiç tahmin yok
     */

    if (
      onlyIdeal &&
      !shownCount
    ) {

      resultsEl.innerHTML = `

        <div class="empty">

          Bu tarihte %${getThreshold()}
          ve en az ${getMinSample()}
          maç şartını sağlayan
          tahmin bulunamadı.

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
      .querySelectorAll(
        ".plus"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const id =
                button.dataset.detail;

              const detail =
                document.getElementById(
                  id
                );

              if (!detail) {
                return;
              }

              const open =
                detail.classList.toggle(
                  "open"
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
     EVENT
  ============================================================ */

  [
    "tdDate",
    "tdBasis",
    "tdThr",
    "tdMin",
    "tdOdd",
    "tdOnly",
    "tdAll"
  ].forEach(
    id => {

      const el =
        $(id);

      if (!el) {
        return;
      }

      el.addEventListener(
        "change",
        render
      );

      el.addEventListener(
        "input",
        render
      );

    }
  );

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

  /* ============================================================
     VERİYİ YÜKLE
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
        historyStart();

      const response =
        await fetch(
          DATA_URL +
          "?v=" +
          Date.now(),
          {
            cache:
              "no-store"
          }
        );

      if (
        !response.ok
      ) {

        throw new Error(
          "matches.json HTTP " +
          response.status
        );

      }

      const json =
        await response.json();

      const raw =
        Array.isArray(json)
          ? json
          : Array.isArray(
              json.matches
            )
            ? json.matches
            : [];

      if (
        !raw.length
      ) {

        throw new Error(
          "matches.json içinde maç yok."
        );

      }

      /*
       * Tüm veriyi normalize et
       */

      DATA =
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

      const now =
        today();

      HISTORY =
        DATA.filter(
          match =>
            match.played &&
            match.date >=
              HISTORY_START &&
            match.date <=
              now
        );

      /*
       * ORAN İNDEKSİ
       */

      buildIndex();

      /*
       * TARİHLER
       */

      fillDates();

      /*
       * EKRAN
       */

      render();

    }
    catch (error) {

      console.error(
        "Bugünün maçları:",
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

            ${esc(
              error.message
            )}

          </div>

        `;

      }

    }

  }

  /* ============================================================
     BAŞLAT
  ============================================================ */

  load();

})();
