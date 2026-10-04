(() => {
  "use strict";

  const DATA_URL = "./data/matches.json";

  const START_DATE = "2026-09-01";

  const RESULT_TYPES = [
    {
      key: "ms1",
      label: "MS1",
      market: "ms1",
      test: ft => ft ? ft[0] > ft[1] : null
    },
    {
      key: "ms0",
      label: "MS X",
      market: "ms0",
      test: ft => ft ? ft[0] === ft[1] : null
    },
    {
      key: "ms2",
      label: "MS2",
      market: "ms2",
      test: ft => ft ? ft[0] < ft[1] : null
    },
    {
      key: "kgVar",
      label: "KG Var",
      market: "kgVar",
      test: ft =>
        ft ? ft[0] > 0 && ft[1] > 0 : null
    },
    {
      key: "over25",
      label: "2,5 Üst",
      market: "over25",
      test: ft =>
        ft ? ft[0] + ft[1] > 2.5 : null
    },
    {
      key: "iyOver05",
      label: "İY 0,5 Üst",
      market: "iyOver05",
      test: (ft, ht) =>
        ht ? ht[0] + ht[1] > 0.5 : null
    },
    {
      key: "iyOver15",
      label: "İY 1,5 Üst",
      market: "iyOver15",
      test: (ft, ht) =>
        ht ? ht[0] + ht[1] > 1.5 : null
    }
  ];

  let matches = [];
  let selectedDate = todayISO();

  const $ = id =>
    document.getElementById(id);

  const content =
    $("bmContent");

  /* ==========================================================
     HELPERS
  ========================================================== */

  function todayISO() {

    const d = new Date();

    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function num(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return NaN;
    }

    const n = Number(
      String(value)
        .replace(",", ".")
        .trim()
    );

    return Number.isFinite(n)
      ? n
      : NaN;
  }

  function normalizeDate(value) {

    if (!value) return "";

    const s =
      String(value).trim();

    let m =
      s.match(
        /^(\d{2})\.(\d{2})\.(\d{4})$/
      );

    if (m) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    m =
      s.match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
      );

    if (m) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(s)
    ) {
      return s;
    }

    return "";
  }

  function displayDate(date) {

    const p =
      String(date).split("-");

    if (p.length !== 3) {
      return date;
    }

    return `${p[2]}.${p[1]}.${p[0]}`;
  }

  function parseScore(value) {

    if (!value) return null;

    if (
      typeof value === "object" &&
      !Array.isArray(value)
    ) {

      const h =
        num(
          value.home ??
          value.homeScore ??
          value.ev
        );

      const a =
        num(
          value.away ??
          value.awayScore ??
          value.dep
        );

      if (
        Number.isFinite(h) &&
        Number.isFinite(a)
      ) {
        return [h, a];
      }
    }

    if (Array.isArray(value)) {

      const h = num(value[0]);
      const a = num(value[1]);

      if (
        Number.isFinite(h) &&
        Number.isFinite(a)
      ) {
        return [h, a];
      }
    }

    const m =
      String(value).match(
        /(\d+)\s*[-:]\s*(\d+)/
      );

    if (m) {
      return [
        Number(m[1]),
        Number(m[2])
      ];
    }

    return null;
  }

  function scoreText(score) {

    return score
      ? `${score[0]}-${score[1]}`
      : "-";
  }

  /* ==========================================================
     OYNANMIŞ MI?
  ========================================================== */

  function isPlayed(raw, ft, ht) {

    if (
      typeof raw.played === "boolean"
    ) {
      return raw.played;
    }

    /*
      İY skoru varsa maç başlamıştır.
    */

    if (ht) {
      return true;
    }

    const status =
      String(
        raw.status ?? ""
      ).toLowerCase();

    const notStarted = [
      "not_started",
      "not-started",
      "scheduled",
      "upcoming",
      "pending",
      "waiting"
    ];

    const started = [
      "live",
      "playing",
      "finished",
      "ended",
      "completed",
      "ft"
    ];

    if (
      notStarted.includes(status)
    ) {
      return false;
    }

    if (
      started.includes(status)
    ) {
      return true;
    }

    /*
      Score varsa oynanmış kabul edilir.
    */

    return !!ft;
  }

  /* ==========================================================
     ORANLAR
  ========================================================== */

  function getOdds(raw) {

    const source =
      raw.odds ||
      raw.openingOdds ||
      raw.openOdds ||
      {};

    const odds = {};

    if (
      source &&
      typeof source === "object"
    ) {

      Object.keys(source)
        .forEach(key => {

          const v =
            num(source[key]);

          if (
            Number.isFinite(v)
          ) {
            odds[key] = v;
          }

        });
    }

    const aliases = {

      ms1: [
        "ms1",
        "MS1"
      ],

      ms0: [
        "ms0",
        "msX",
        "msx",
        "MS0",
        "MSX"
      ],

      ms2: [
        "ms2",
        "MS2"
      ],

      kgVar: [
        "kgVar",
        "kgvar",
        "KGVar"
      ],

      over25: [
        "over25",
        "au25Ust",
        "au25ust"
      ],

      iyOver05: [
        "iyOver05",
        "iy05Ust",
        "iy05ust",
        "iy05"
      ],

      iyOver15: [
        "iyOver15",
        "iy15Ust",
        "iy15ust",
        "iy15"
      ]
    };

    Object.keys(aliases)
      .forEach(target => {

        if (
          Number.isFinite(
            odds[target]
          )
        ) {
          return;
        }

        for (
          const alias of aliases[target]
        ) {

          if (
            Number.isFinite(
              odds[alias]
            )
          ) {

            odds[target] =
              odds[alias];

            break;
          }

          const direct =
            num(raw[alias]);

          if (
            Number.isFinite(direct)
          ) {

            odds[target] =
              direct;

            break;
          }
        }

      });

    return odds;
  }

  /* ==========================================================
     NORMALIZE
  ========================================================== */

  function normalizeMatch(raw) {

    const ft =
      parseScore(
        raw.score ||
        raw.fullTimeScore
      );

    const ht =
      parseScore(
        raw.halfTimeScore ||
        raw.scoreHT
      );

    return {

      code:
        String(
          raw.code ??
          raw.id ??
          ""
        ),

      date:
        normalizeDate(
          raw.date
        ),

      time:
        String(
          raw.time ?? ""
        ),

      league:
        String(
          raw.league ?? ""
        ),

      home:
        String(
          raw.home ?? ""
        ),

      away:
        String(
          raw.away ?? ""
        ),

      ft,

      ht,

      played:
        isPlayed(
          raw,
          ft,
          ht
        ),

      odds:
        getOdds(raw),

      raw
    };
  }

  /* ==========================================================
     VERİYİ ÇEK
  ========================================================== */

  async function loadData() {

    content.innerHTML =
      `<div class="bm-loading">
        Maçlar yükleniyor...
       </div>`;

    try {

      const response =
        await fetch(
          DATA_URL + "?v=" + Date.now(),
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        throw new Error(
          "matches.json yüklenemedi."
        );
      }

      const json =
        await response.json();

      const rawMatches =
        Array.isArray(json)
          ? json
          : Array.isArray(json.matches)
            ? json.matches
            : [];

      matches =
        rawMatches
          .map(normalizeMatch)
          .filter(
            m => m.date
          );

      render();

    } catch (error) {

      console.error(error);

      content.innerHTML =
        `<div class="bm-error">
          Veri yüklenirken hata oluştu.<br><br>
          ${escapeHTML(error.message)}
        </div>`;
    }
  }

  /* ==========================================================
     BUGÜNÜN MAÇLARI
  ========================================================== */

  function getTodayMatches() {

    return matches
      .filter(
        m =>
          m.date === selectedDate &&
          !m.played
      )
      .sort(
        (a, b) =>
          a.time.localeCompare(b.time)
      );
  }

  /* ==========================================================
     GEÇMİŞ HAVUZU
  ========================================================== */

  function historicalMatches() {

    return matches.filter(
      m =>
        m.played &&
        m.date >= START_DATE
    );
  }

  /* ==========================================================
     TAKIM KARŞILAŞTIRMA
  ========================================================== */

  function cleanTeam(name) {

    return String(name || "")
      .toLowerCase()
      .replace(
        /\b(fc|sc|cd|fk|sk|club|deportivo|atletico|sporting)\b/g,
        ""
      )
      .replace(
        /[^a-z0-9ğüşıöç]/g,
        ""
      );
  }

  function sameTeam(a, b) {

    const x =
      cleanTeam(a);

    const y =
      cleanTeam(b);

    if (!x || !y) {
      return false;
    }

    return (
      x === y ||
      (
        x.length > 3 &&
        y.length > 3 &&
        (
          x.includes(y) ||
          y.includes(x)
        )
      )
    );
  }

  /* ==========================================================
     EŞLEŞME
  ========================================================== */

  function sameOdds(match, keys) {

    return keys.every(key => {

      const a =
        num(match.odds[key]);

      const b =
        num(
          CURRENT_MATCH.odds[key]
        );

      if (
        !Number.isFinite(a) ||
        !Number.isFinite(b)
      ) {
        return false;
      }

      return Math.abs(a - b) < 0.0001;
    });
  }

  let CURRENT_MATCH = null;

  /* ==========================================================
     ANALİZ
  ========================================================== */

  function analyze(match) {

    CURRENT_MATCH = match;

    const threshold =
      Math.max(
        1,
        Math.min(
          100,
          num(
            $("bmThreshold").value
          ) || 70
        )
      );

    const minSample =
      Math.max(
        1,
        num(
          $("bmMinSample").value
        ) || 5
      );

    const minOdd =
      Math.max(
        1,
        num(
          $("bmMinOdd").value
        ) || 1.4
      );

    const basis =
      $("bmBasis").value;

    const history =
      historicalMatches();

    const predictions = [];

    RESULT_TYPES.forEach(result => {

      const odd =
        num(
          match.odds[result.market]
        );

      if (
        !Number.isFinite(odd) ||
        odd < minOdd
      ) {
        return;
      }

      let pool = [];

      if (basis === "each") {

        pool =
          history.filter(
            h =>
              Number.isFinite(
                h.odds[result.market]
              ) &&
              Math.abs(
                h.odds[result.market] - odd
              ) < 0.0001
          );

      }

      else if (
        basis === "ms1" ||
        basis === "ms1,ms2" ||
        basis === "ms1,ms0,ms2"
      ) {

        const keys =
          basis.split(",");

        pool =
          history.filter(
            h =>
              sameOdds(
                h,
                keys
              )
          );

      }

      else if (basis === "league") {

        pool =
          history.filter(
            h =>
              String(h.league)
                .toLowerCase() ===
              String(match.league)
                .toLowerCase()
          );

      }

      else if (basis === "team") {

        pool =
          history.filter(
            h =>
              (
                sameTeam(
                  h.home,
                  match.home
                ) &&
                sameTeam(
                  h.away,
                  match.away
                )
              ) ||
              (
                sameTeam(
                  h.home,
                  match.away
                ) &&
                sameTeam(
                  h.away,
                  match.home
                )
              )
          );

      }

      else if (basis === "all") {

        pool =
          history.slice();

      }

      let success = 0;
      let total = 0;

      pool.forEach(h => {

        const resultValue =
          result.test(
            h.ft,
            h.ht
          );

        if (
          resultValue === null ||
          resultValue === undefined
        ) {
          return;
        }

        total++;

        if (resultValue) {
          success++;
        }

      });

      if (total < minSample) {
        return;
      }

      const rate =
        total > 0
          ? (success / total) * 100
          : 0;

      predictions.push({

        label:
          result.label,

        market:
          result.market,

        odd,

        success,

        total,

        rate
      });

    });

    return predictions
      .filter(
        p =>
          p.rate >= threshold
      )
      .sort(
        (a, b) =>
          b.rate - a.rate ||
          b.total - a.total
      );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  function render() {

    if (!matches.length) {
      return;
    }

    $("bmDate").value =
      selectedDate;

    $("bmDateText").textContent =
      displayDate(selectedDate);

    const today =
      getTodayMatches();

    if (!today.length) {

      content.innerHTML =
        `<div class="bm-empty">
          <strong>${displayDate(selectedDate)}</strong>
          tarihinde oynanmamış maç bulunamadı.
        </div>`;

      return;
    }

    const onlyIdeal =
      $("bmOnlyIdeal").checked;

    const showAll =
      $("bmShowAll").checked;

    let html = "";

    let shown = 0;

    today.forEach(match => {

      const predictions =
        analyze(match);

      if (
        onlyIdeal &&
        predictions.length === 0 &&
        !showAll
      ) {
        return;
      }

      shown++;

      html += `
        <article class="bm-match">

          <div class="bm-match-head">

            <div class="bm-time">
              ${escapeHTML(match.time || "--:--")}
            </div>

            <div class="bm-league">
              ${escapeHTML(match.league || "Lig bilinmiyor")}
            </div>

          </div>

          <div class="bm-teams">

            <div class="bm-team">
              ${escapeHTML(match.home)}
            </div>

            <div class="bm-score">
              ${match.played
                ? scoreText(match.ft)
                : "-"}
            </div>

            <div class="bm-team away">
              ${escapeHTML(match.away)}
            </div>

          </div>
      `;

      if (predictions.length) {

        html += `
          <div class="bm-predictions">
        `;

        predictions.forEach(p => {

          const rate =
            Math.round(
              p.rate * 10
            ) / 10;

          let cls =
            "bm-bad";

          if (rate >= 80) {
            cls = "bm-good";
          }
          else if (rate >= 70) {
            cls = "bm-medium";
          }

          html += `
            <div class="bm-prediction">

              <div class="bm-prediction-top">

                <div class="bm-market">
                  ${escapeHTML(p.label)}
                </div>

                <div class="bm-odd">
                  ${p.odd.toFixed(2)}
                </div>

              </div>

              <div class="bm-result ${cls}">
                %${rate} başarı
              </div>

              <div class="bm-rate">
                <div
                  class="bm-rate-bar"
                  style="width:${Math.min(rate,100)}%"
                ></div>
              </div>

              <div class="bm-detail">
                ${p.success} başarılı /
                ${p.total} geçmiş maç
              </div>

            </div>
          `;
        });

        html += `
          </div>
        `;

      } else {

        html += `
          <div class="bm-no-prediction">
            Bu maç için kriterlere uygun tahmin bulunamadı.
          </div>
        `;
      }

      html += `
        </article>
      `;
    });

    if (!shown) {

      content.innerHTML =
        `<div class="bm-empty">
          Seçilen kriterlere uygun tahmini olan maç bulunamadı.
        </div>`;

      return;
    }

    content.innerHTML = `
      <div class="bm-summary">
        <div class="bm-count">
          ${shown} maç gösteriliyor
        </div>

        <div>
          ${displayDate(selectedDate)}
        </div>
      </div>

      ${html}
    `;
  }

  /* ==========================================================
     TARİH
  ========================================================== */

  function changeDate(days) {

    const d =
      new Date(
        selectedDate + "T12:00:00"
      );

    d.setDate(
      d.getDate() + days
    );

    selectedDate =
      [
        d.getFullYear(),
        String(
          d.getMonth() + 1
        ).padStart(2, "0"),
        String(
          d.getDate()
        ).padStart(2, "0")
      ].join("-");

    render();
  }

  /* ==========================================================
     EVENTS
  ========================================================== */

  $("bmDate").addEventListener(
    "change",
    e => {

      selectedDate =
        e.target.value ||
        todayISO();

      render();
    }
  );

  $("bmPrev").addEventListener(
    "click",
    () =>
      changeDate(-1)
  );

  $("bmNext").addEventListener(
    "click",
    () =>
      changeDate(1)
  );

  [
    "bmBasis",
    "bmThreshold",
    "bmMinSample",
    "bmMinOdd",
    "bmOnlyIdeal",
    "bmShowAll"
  ].forEach(id => {

    $(id).addEventListener(
      "change",
      render
    );

    $(id).addEventListener(
      "input",
      render
    );

  });

  /* ==========================================================
     BAŞLAT
  ========================================================== */

  $("bmDate").value =
    selectedDate;

  $("bmDateText").textContent =
    displayDate(selectedDate);

  loadData();

})();
