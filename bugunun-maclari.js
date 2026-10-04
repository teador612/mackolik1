(function () {
  "use strict";

  /*
   ============================================================
   BUGÜNÜN MAÇLARI
   ============================================================

   Veri:
   ./data/matches.json

   Geçmiş:
   Son 60 gün

   Minimum geçmiş maç:
   5

   Varsayılan başarı eşiği:
   %70

   ANALİZ EDİLEN MARKETLER:

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


  /* ============================================================
     AYARLAR
  ============================================================ */

  const DATA_URL = "./data/matches.json";

  const HISTORY_DAYS = 60;

  let MATCHES = [];
  let HISTORICAL = [];
  let HISTORY_START = "";


  /* ============================================================
     YARDIMCI
  ============================================================ */

  function $(id) {
    return document.getElementById(id);
  }


  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/[&<>"']/g, function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c];
      });
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


  /* ============================================================
     TARİH
  ============================================================ */

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


  function getHistoryStartDate() {

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


  function isoDate(value) {

    if (!value) {
      return "";
    }

    const s =
      String(value).trim();


    /*
      2026-10-04
    */

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(s)
    ) {
      return s;
    }


    /*
      04.10.2026
      04/10/2026
      04-10-2026
    */

    const m =
      s.match(
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

    if (!value) {
      return "";
    }

    const p =
      String(value).split("-");

    if (p.length !== 3) {
      return value;
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


  /* ============================================================
     SKOR OKUMA
  ============================================================ */

  function scoreObject(value) {

    if (
      !value ||
      typeof value !== "object"
    ) {
      return null;
    }

    const home =
      num(value.home);

    const away =
      num(value.away);

    if (
      Number.isFinite(home) &&
      Number.isFinite(away)
    ) {
      return [
        home,
        away
      ];
    }

    return null;
  }


  function scoreString(value) {

    if (!value) {
      return null;
    }

    const m =
      String(value).match(
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
      scoreObject(match.fullTimeScore);

    if (score) {
      return score;
    }


    score =
      scoreObject(match.finalScore);

    if (score) {
      return score;
    }


    return scoreString(
      match.score
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


    return null;
  }


  function isPlayed(match) {

    const ft =
      getFT(match);

    if (!ft) {
      return false;
    }

    const status =
      String(
        match.status == null
          ? ""
          : match.status
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
     ORAN OKUMA
  ============================================================ */

  function getOdds(match) {

    const source =
      match.odds ||
      match.openingOdds ||
      match.opening ||
      match.markets ||
      {};

    const odds = {};


    function add(name) {

      const keys =
        Array.prototype.slice.call(
          arguments,
          1
        );

      for (
        let i = 0;
        i < keys.length;
        i++
      ) {

        const key =
          keys[i];

        const value =
          num(source[key]);

        if (
          Number.isFinite(value)
        ) {

          odds[name] =
            value;

          return;
        }
      }
    }


    /*
      MS
    */

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


    /*
      KG
    */

    add(
      "kgVar",
      "kgVar",
      "kgvar",
      "kg1",
      "kg"
    );


    /*
      İY
    */

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


    /*
      İY 0,5 ÜST
    */

    add(
      "iyOver05",
      "iyOver05",
      "iy05Ust",
      "iy05Üst",
      "iy05Over",
      "iy05ust",
      "iy05_ust"
    );


    /*
      İY 0,5 ALT
    */

    add(
      "iyUnder05",
      "iyUnder05",
      "iy05Alt",
      "iy05alt",
      "iy05Under",
      "iy05_alt"
    );


    /*
      İY 1,5
    */

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


    /*
      MAÇ 1,5 ÜST
    */

    add(
      "over15",
      "over15",
      "au15Ust",
      "au15Üst",
      "au15Over",
      "au15ust",
      "au15_ust"
    );


    /*
      MAÇ 2,5 ÜST
    */

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


  /* ============================================================
     SADECE KULLANILACAK 14 MARKET
  ============================================================ */

  const RESULTS = [

    {
      key: "ms1",
      name: "MS1",
      test: function (ft) {
        return (
          ft &&
          ft[0] > ft[1]
        );
      }
    },

    {
      key: "ms0",
      name: "MSX",
      test: function (ft) {
        return (
          ft &&
          ft[0] === ft[1]
        );
      }
    },

    {
      key: "ms2",
      name: "MS2",
      test: function (ft) {
        return (
          ft &&
          ft[0] < ft[1]
        );
      }
    },

    {
      key: "kgVar",
      name: "KG Var",
      test: function (ft) {
        return (
          ft &&
          ft[0] > 0 &&
          ft[1] > 0
        );
      }
    },

    {
      key: "iy1",
      name: "İY1",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] > ht[1]
        );
      }
    },

    {
      key: "iy0",
      name: "İYX",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] === ht[1]
        );
      }
    },

    {
      key: "iy2",
      name: "İY2",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] < ht[1]
        );
      }
    },

    {
      key: "iyOver05",
      name: "İY 0,5 Üst",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] + ht[1] >= 1
        );
      }
    },

    {
      key: "iyUnder05",
      name: "İY 0,5 Alt",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] + ht[1] === 0
        );
      }
    },

    {
      key: "iyOver15",
      name: "İY 1,5 Üst",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] + ht[1] >= 2
        );
      }
    },

    {
      key: "iyUnder15",
      name: "İY 1,5 Alt",
      test: function (ft, ht) {
        return (
          ht &&
          ht[0] + ht[1] < 2
        );
      }
    },

    {
      key: "over15",
      name: "1,5 Üst",
      test: function (ft) {
        return (
          ft &&
          ft[0] + ft[1] >= 2
        );
      }
    },

    {
      key: "over25",
      name: "2,5 Üst",
      test: function (ft) {
        return (
          ft &&
          ft[0] + ft[1] >= 3
        );
      }
    }

  ];


  /* ============================================================
     AYARLAR
  ============================================================ */

  function getThreshold() {

    const el =
      $("tdThr");

    if (!el) {
      return 70;
    }

    const value =
      num(el.value);

    if (
      !Number.isFinite(value)
    ) {
      return 70;
    }

    return Math.max(
      0,
      Math.min(
        100,
        value
      )
    );
  }


  function getMinSample() {

    const el =
      $("tdMin");

    if (!el) {
      return 5;
    }

    const value =
      num(el.value);

    if (
      !Number.isFinite(value)
    ) {
      return 5;
    }

    return Math.max(
      1,
      Math.floor(value)
    );
  }


  function getMinOdd() {

    const el =
      $("tdOdd");

    if (!el) {
      return 1.4;
    }

    const value =
      num(el.value);

    if (
      !Number.isFinite(value)
    ) {
      return 1.4;
    }

    return Math.max(
      1,
      value
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
      function (history) {

        const oldOdd =
          history.odds[key];

        return (
          Number.isFinite(
            oldOdd
          ) &&
          sameOdd(
            currentOdd,
            oldOdd
          )
        );

      }
    );
  }


  /* ============================================================
     BAŞARI İSTATİSTİĞİ
  ============================================================ */

  function getStat(
    list,
    result
  ) {

    let total = 0;

    let success = 0;


    for (
      let i = 0;
      i < list.length;
      i++
    ) {

      const match =
        list[i];

      if (!match.scoreFT) {
        continue;
      }


      const ok =
        result.test(
          match.scoreFT,
          match.scoreHT
        );


      if (ok === null) {
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

      total: total,

      success: success,

      rate:
        (success / total) *
        100

    };
  }


  /* ============================================================
     TÜM MARKETLERİ TEK TEK ANALİZ ET
  ============================================================ */

  function analyzeEach(match) {

    const threshold =
      getThreshold();

    const minSample =
      getMinSample();

    const minOdd =
      getMinOdd();


    const results = [];


    for (
      let i = 0;
      i < RESULTS.length;
      i++
    ) {

      const result =
        RESULTS[i];

      const key =
        result.key;


      const odd =
        match.odds[key];


      /*
        Maçta bu oran yoksa
        o marketi geç.
      */

      if (
        !Number.isFinite(odd)
      ) {
        continue;
      }


      /*
        Minimum oran filtresi
      */

      if (
        odd < minOdd
      ) {
        continue;
      }


      /*
        Aynı açılış oranına sahip
        son 60 gündeki maçları bul.
      */

      const history =
        historicalByOdd(
          match,
          key
        );


      /*
        Geçmiş sonuç yüzdesi
      */

      const stat =
        getStat(
          history,
          result
        );


      if (!stat) {
        continue;
      }


      /*
        Minimum örneklem
      */

      if (
        stat.total < minSample
      ) {
        continue;
      }


      /*
        Başarı yüzdesi
      */

      if (
        stat.rate < threshold
      ) {
        continue;
      }


      results.push({

        name:
          result.name,

        key:
          key,

        odd:
          odd,

        rate:
          stat.rate,

        total:
          stat.total,

        success:
          stat.success

      });

    }


    /*
      En yüksek başarı oranı
      önce gelir.
    */

    results.sort(
      function (a, b) {

        return (
          b.rate - a.rate ||
          b.total - a.total
        );

      }
    );


    return results;
  }


  /* ============================================================
     ANALİZ
  ============================================================ */

  function analyze(match) {

    /*
      Bu sistemde artık:
      - handikap
      - çifte şans
      - İY/MS
      - toplam gol
      - alt marketleri
      - KG Yok

      analiz edilmiyor.

      Her izin verilen market
      kendi açılış oranıyla
      ayrı ayrı analiz ediliyor.
    */

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
      .map(
        function (p) {

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

        }
      )
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


    /*
      İlk tahmin kartın üzerinde.
      + açılınca diğerleri gelir.
    */

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

        Her market ayrı aranır ·
        ${dateTR(HISTORY_START)} ve sonrası ·
        son ${HISTORY_DAYS} gün ·
        eşik %${threshold} ·
        en az ${minSample} maç

      </div>


      ${
        others.length
          ? `

            <div style="
              display:flex;
              flex-wrap:wrap;
              gap:10px;
            ">

              ${predictionCards(
                others
              )}

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
     TARİH SEÇİMİ
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
            function (m) {
              return m.date;
            }
          )
          .filter(Boolean)
      )
    ];


    dates.sort();


    select.innerHTML = "";


    const todayDate =
      today();


    /*
      Tarihleri oluştur
    */

    dates.forEach(
      function (date) {

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
      Önce bugün
    */

    if (
      dates.indexOf(
        todayDate
      ) !== -1
    ) {

      select.value =
        todayDate;

    }


    /*
      Bugün yoksa bugüne
      en yakın tarihi seç.
    */

    if (
      !select.value &&
      dates.length
    ) {

      const future =
        dates.find(
          function (date) {
            return (
              date >= todayDate
            );
          }
        );


      select.value =
        future ||
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


    /*
      Seçilen tarihteki
      bütün maçlar.
    */

    const matches =
      MATCHES
        .filter(
          function (match) {

            return (
              match.date ===
              selectedDate
            );

          }
        )
        .sort(
          function (a, b) {

            return String(
              a.time
            ).localeCompare(
              String(b.time)
            );

          }
        );


    let html = "";

    let idealCount = 0;

    let shown = 0;


    /*
      Maçları analiz et
    */

    matches.forEach(
      function (match, index) {

        const predictions =
          analyze(match);


        if (
          predictions.length
        ) {
          idealCount++;
        }


        /*
          Sadece ideal sonucu olanlar
        */

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


    /* ==========================================================
       İSTATİSTİKLER
    ========================================================== */

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
        dateTR(
          selectedDate
        ) +
        " · " +
        shown +
        " maç";

    }


    /* ==========================================================
       BOŞ
    ========================================================== */

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


    /* ==========================================================
       MAÇLAR
    ========================================================== */

    resultsEl.innerHTML =
      html;


    /* ==========================================================
       + / -
    ========================================================== */

    resultsEl
      .querySelectorAll(
        ".plus"
      )
      .forEach(
        function (button) {

          button.addEventListener(
            "click",
            function () {

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

      /*
        Her açılışta son 60 gün
        yeniden hesaplanıyor.
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
          : Array.isArray(
              data.matches
            )
            ? data.matches
            : [];


      /*
        Tüm maçları normalize et
      */

      MATCHES =
        raw
          .map(normalize)
          .filter(
            function (match) {

              return (
                match.date &&
                match.home &&
                match.away
              );

            }
          );


      const todayDate =
        today();


      /*
        SADECE SON 60 GÜNDEKİ
        OYNANMIŞ MAÇLAR
        ANALİZ HAVUZU
      */

      HISTORICAL =
        MATCHES.filter(
          function (match) {

            return (
              match.played &&
              match.date >=
                HISTORY_START &&
              match.date <=
                todayDate
            );

          }
        );


      /*
        Tarihleri doldur
      */

      fillDates();


      /*
        Ekranı oluştur
      */

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

            ${esc(
              error.message
            )}

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
