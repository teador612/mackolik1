/* =========================================================
   BUGÜNÜN MAÇLARI - MACKOLIK1
   Açılış oranlarından son 60 gün analizi
   ========================================================= */

(function () {
  'use strict';

  var DATA_URL = './data/matches.json';

  var CFG = {
    days: 60,
    threshold: 70,
    minMatches: 5,
    minOdd: 1.40
  };

  var DATA = [];
  var INDEX = Object.create(null);

  var RESULTS = [
    {
      key: 'ms1',
      label: 'MS1',
      test: function (f) {
        return f ? f[0] > f[1] : null;
      }
    },
    {
      key: 'msX',
      label: 'MSX',
      test: function (f) {
        return f ? f[0] === f[1] : null;
      }
    },
    {
      key: 'ms2',
      label: 'MS2',
      test: function (f) {
        return f ? f[0] < f[1] : null;
      }
    },
    {
      key: 'kgVar',
      label: 'KG Var',
      test: function (f) {
        return f ? (f[0] > 0 && f[1] > 0) : null;
      }
    },
    {
      key: 'iy1',
      label: 'İY1',
      test: function (f, h) {
        return h ? h[0] > h[1] : null;
      }
    },
    {
      key: 'iyX',
      label: 'İYX',
      test: function (f, h) {
        return h ? h[0] === h[1] : null;
      }
    },
    {
      key: 'iy2',
      label: 'İY2',
      test: function (f, h) {
        return h ? h[0] < h[1] : null;
      }
    },
    {
      key: 'iyOver05',
      label: 'İY 0,5 Üst',
      test: function (f, h) {
        return h ? (h[0] + h[1]) > 0.5 : null;
      }
    },
    {
      key: 'iyUnder05',
      label: 'İY 0,5 Alt',
      test: function (f, h) {
        return h ? (h[0] + h[1]) <= 0.5 : null;
      }
    },
    {
      key: 'iy15Ust',
      label: 'İY 1,5 Üst',
      test: function (f, h) {
        return h ? (h[0] + h[1]) > 1.5 : null;
      }
    },
    {
      key: 'iy15Alt',
      label: 'İY 1,5 Alt',
      test: function (f, h) {
        return h ? (h[0] + h[1]) <= 1.5 : null;
      }
    },
    {
      key: 'au15Ust',
      label: '1,5 Üst',
      test: function (f) {
        return f ? (f[0] + f[1]) > 1.5 : null;
      }
    },
    {
      key: 'au25Ust',
      label: '2,5 Üst',
      test: function (f) {
        return f ? (f[0] + f[1]) > 2.5 : null;
      }
    }
  ];

  var MARKET_KEYS = [
    'ms1',
    'msX',
    'ms2',
    'kgVar',
    'iy1',
    'iyX',
    'iy2',
    'iyOver05',
    'iyUnder05',
    'iy15Ust',
    'iy15Alt',
    'au15Ust',
    'au25Ust'
  ];

  function $(selector) {
    return document.querySelector(selector);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function num(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    var n = Number(
      String(value)
        .replace(',', '.')
        .replace(/[^\d.-]/g, '')
    );

    return Number.isFinite(n) ? n : null;
  }

  function score(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value) && value.length >= 2) {
      var a = num(value[0]);
      var b = num(value[1]);

      if (a !== null && b !== null) {
        return [a, b];
      }
    }

    var text = String(value).trim();

    var m = text.match(/(-?\d+)\s*[-:]\s*(-?\d+)/);

    if (!m) {
      return null;
    }

    return [
      Number(m[1]),
      Number(m[2])
    ];
  }

  function getDate(match) {
    return (
      match.date ||
      match.tarih ||
      match.matchDate ||
      match.macTarihi ||
      ''
    );
  }

  function formatDate(value) {
    if (!value) {
      return '';
    }

    var text = String(value);

    var m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (m) {
      return (
        m[3] +
        '-' +
        m[2] +
        '-' +
        m[1]
      );
    }

    m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (m) {
      return (
        m[1] +
        '-' +
        m[2] +
        '-' +
        m[3]
      );
    }

    var d = new Date(text);

    if (!Number.isNaN(d.getTime())) {
      return (
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0')
      );
    }

    return text;
  }

  function todayISO() {
    var d = new Date();

    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function daysAgoISO(days) {
    var d = new Date();

    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days);

    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function getOpeningOdds(match) {
    return (
      match.openingOdds ||
      match.opening ||
      match.oddsOpening ||
      match.odds ||
      match.oranlar ||
      match.openOdds ||
      {}
    );
  }

  function getFT(match) {
    return score(
      match.ft ||
      match.fullTime ||
      match.score ||
      match.skor ||
      match.result ||
      null
    );
  }

  function getHT(match) {
    return score(
      match.ht ||
      match.halfTime ||
      match.halfTimeScore ||
      match.iySkor ||
      match.ilkYari ||
      null
    );
  }

  function normalizeMatch(match) {
    var m = Object.assign({}, match);

    m.date = formatDate(getDate(match));
    m.ft = getFT(match);
    m.ht = getHT(match);
    m.openingOdds = getOpeningOdds(match);

    return m;
  }

  function isPlayed(match) {
    return !!getFT(match);
  }

  function buildIndex(history) {
    INDEX = Object.create(null);

    history.forEach(function (match) {
      var odds = getOpeningOdds(match);

      MARKET_KEYS.forEach(function (marketKey) {
        var odd = num(
          odds && odds[marketKey]
        );

        if (odd === null || odd < CFG.minOdd) {
          return;
        }

        var key =
          marketKey +
          '|' +
          odd.toFixed(2);

        if (!INDEX[key]) {
          INDEX[key] = [];
        }

        INDEX[key].push(match);
      });
    });
  }

  function calculateStats(history) {
    return RESULTS.map(function (result) {
      var success = 0;
      var total = 0;

      history.forEach(function (match) {
        var ft = getFT(match);
        var ht = getHT(match);

        if (!ft) {
          return;
        }

        var answer = result.test(ft, ht);

        if (answer === null) {
          return;
        }

        total++;

        if (answer === true) {
          success++;
        }
      });

      var percent =
        total > 0
          ? (success / total) * 100
          : 0;

      return {
        key: result.key,
        label: result.label,
        success: success,
        total: total,
        percent: percent,
        ideal:
          total >= CFG.minMatches &&
          percent >= CFG.threshold
      };
    });
  }

  function analyzeMatch(match) {
    var odds = getOpeningOdds(match);

    var groups = [];
    var predictionMap = Object.create(null);

    MARKET_KEYS.forEach(function (marketKey) {
      var odd = num(
        odds && odds[marketKey]
      );

      if (odd === null || odd < CFG.minOdd) {
        return;
      }

      var indexKey =
        marketKey +
        '|' +
        odd.toFixed(2);

      var history =
        INDEX[indexKey] || [];

      if (history.length < CFG.minMatches) {
        return;
      }

      var stats =
        calculateStats(history);

      stats.forEach(function (stat) {
        if (!stat.ideal) {
          return;
        }

        var prediction = {
          key: stat.key,
          label: stat.label,
          odd: odd,
          success: stat.success,
          total: stat.total,
          percent: stat.percent,
          marketKey: marketKey
        };

        groups.push(prediction);

        var existing =
          predictionMap[stat.label];

        if (
          !existing ||
          prediction.percent > existing.percent ||
          (
            prediction.percent === existing.percent &&
            prediction.total > existing.total
          )
        ) {
          predictionMap[stat.label] = prediction;
        }
      });
    });

    var predictions =
      Object.keys(predictionMap)
        .map(function (key) {
          return predictionMap[key];
        })
        .sort(function (a, b) {
          if (b.percent !== a.percent) {
            return b.percent - a.percent;
          }

          return b.total - a.total;
        });

    return {
      groups: groups,
      predictions: predictions,
      best:
        predictions.length
          ? predictions[0]
          : null
    };
  }

  function getPredictionStatus(
    prediction,
    match
  ) {
    if (!prediction) {
      return 'pending';
    }

    var result =
      RESULTS.find(function (item) {
        return (
          item.key === prediction.key &&
          item.label === prediction.label
        );
      });

    if (!result) {
      return 'pending';
    }

    var ft = getFT(match);
    var ht = getHT(match);

    if (!ft) {
      return 'pending';
    }

    var answer =
      result.test(ft, ht);

    if (answer === true) {
      return 'success';
    }

    if (answer === false) {
      return 'fail';
    }

    return 'pending';
  }

  /*
   * =====================================================
   * SADECE ANA TAHMİNLER
   *
   * 60 günlük başarı hesabı.
   *
   * Her maçta yalnızca analysis.best sayılır.
   * =====================================================
   */
  function calculateMainPredictionStats(history) {
    var success = 0;
    var total = 0;

    history.forEach(function (match) {
      if (!isPlayed(match)) {
        return;
      }

      var analysis =
        analyzeMatch(match);

      if (
        !analysis ||
        !analysis.best
      ) {
        return;
      }

      var status =
        getPredictionStatus(
          analysis.best,
          match
        );

      if (status === 'success') {
        success++;
        total++;
      } else if (status === 'fail') {
        total++;
      }
    });

    return {
      success: success,
      total: total,
      percent:
        total > 0
          ? (success / total) * 100
          : 0
    };
  }

  /*
   * =====================================================
   * GÜNLÜK ANA TAHMİN BAŞARISI
   *
   * Seçilen gündeki oynanmış maçlardan yalnızca
   * ana tahminler hesaba katılır.
   * =====================================================
   */
  function calculateDailyMainPredictionStats(
    matches
  ) {
    var success = 0;
    var total = 0;

    matches.forEach(function (match) {
      if (!isPlayed(match)) {
        return;
      }

      var analysis =
        analyzeMatch(match);

      if (
        !analysis ||
        !analysis.best
      ) {
        return;
      }

      var status =
        getPredictionStatus(
          analysis.best,
          match
        );

      if (status === 'success') {
        success++;
        total++;
      } else if (status === 'fail') {
        total++;
      }
    });

    return {
      success: success,
      total: total,
      percent:
        total > 0
          ? (success / total) * 100
          : 0
    };
  }

  function statusClass(status) {
    if (status === 'success') {
      return 'success';
    }

    if (status === 'fail') {
      return 'fail';
    }

    return 'pending';
  }

  function statusIcon(status) {
    if (status === 'success') {
      return '✓';
    }

    if (status === 'fail') {
      return '✕';
    }

    return '•';
  }

  function predictionHtml(
    prediction,
    match,
    isBest
  ) {
    var status =
      getPredictionStatus(
        prediction,
        match
      );

    var cls =
      statusClass(status);

    return (
      '<div class="bm-pred ' +
      cls +
      (isBest ? ' main' : '') +
      '">' +

        '<div class="bm-pred-left">' +

          '<span class="bm-pred-icon">' +
            statusIcon(status) +
          '</span>' +

          '<span class="bm-pred-label">' +
            esc(prediction.label) +
          '</span>' +

          '<span class="bm-pred-odd">' +
            Number(prediction.odd).toFixed(2) +
          '</span>' +

        '</div>' +

        '<div class="bm-pred-right">' +

          '<strong>' +
            prediction.percent.toFixed(1) +
            '%' +
          '</strong>' +

          '<span>' +
            prediction.success +
            '/' +
            prediction.total +
          '</span>' +

        '</div>' +

      '</div>'
    );
  }

  function predictionHtmlList(
    analysis,
    match
  ) {
    if (
      !analysis ||
      !analysis.predictions ||
      !analysis.predictions.length
    ) {
      return (
        '<div class="bm-empty">' +
          'İdeal tahmin bulunamadı' +
        '</div>'
      );
    }

    return analysis.predictions
      .map(function (prediction, index) {
        return predictionHtml(
          prediction,
          match,
          index === 0
        );
      })
      .join('');
  }

  function cardHtml(
    match,
    analysis,
    index
  ) {
    var ft = getFT(match);
    var ht = getHT(match);

    var home =
      match.home ||
      match.homeTeam ||
      match.ev ||
      match.evSahibi ||
      'Ev Sahibi';

    var away =
      match.away ||
      match.awayTeam ||
      match.deplasman ||
      match.misafir ||
      'Deplasman';

    var league =
      match.league ||
      match.lig ||
      '';

    var best =
      analysis && analysis.best
        ? analysis.best
        : null;

    var bestStatus =
      best
        ? getPredictionStatus(
            best,
            match
          )
        : 'pending';

    var bestClass =
      statusClass(bestStatus);

    var scoreText =
      ft
        ? ft[0] + ' - ' + ft[1]
        : 'vs';

    var htText =
      ht
        ? 'İY ' + ht[0] + '-' + ht[1]
        : '';

    return (
      '<div class="bm-card" data-index="' +
      index +
      '">' +

        '<div class="bm-card-head">' +

          '<div class="bm-teams">' +

            '<div class="bm-league">' +
              esc(league) +
            '</div>' +

            '<div class="bm-team">' +
              esc(home) +
            '</div>' +

            '<div class="bm-team">' +
              esc(away) +
            '</div>' +

          '</div>' +

          '<div class="bm-score">' +

            '<strong>' +
              scoreText +
            '</strong>' +

            (
              htText
                ? '<small>' +
                    htText +
                  '</small>'
                : ''
            ) +

          '</div>' +

        '</div>' +

        (
          best
            ? (
              '<div class="bm-best ' +
              bestClass +
              '">' +

                '<div class="bm-best-main">' +

                  '<span class="bm-status-icon">' +
                    statusIcon(bestStatus) +
                  '</span>' +

                  '<span class="bm-best-label">' +
                    esc(best.label) +
                  '</span>' +

                  '<span class="bm-best-odd">' +
                    Number(best.odd).toFixed(2) +
                  '</span>' +

                '</div>' +

                '<div class="bm-best-percent">' +

                  best.percent.toFixed(1) +
                  '%' +

                  '<small>' +
                    best.success +
                    '/' +
                    best.total +
                  '</small>' +

                '</div>' +

              '</div>'
            )
            : (
              '<div class="bm-no-best">' +
                'Ana tahmin bulunamadı' +
              '</div>'
            )
        ) +

        '<div class="bm-details">' +
          predictionHtmlList(
            analysis,
            match
          ) +
        '</div>' +

      '</div>'
    );
  }

  function createUI() {
    document.body.innerHTML =
      '<div class="bm-wrap">' +

        '<div class="bm-top">' +

          '<div>' +
            '<h1>Bugünün Maçları</h1>' +

            '<div class="bm-sub">' +
              'Açılış oranlarından son 60 gün analizi' +
            '</div>' +

          '</div>' +

          '<div class="bm-controls">' +

            '<label>' +
              '<span>Tarih</span>' +
              '<input type="date" id="dateFilter">' +
            '</label>' +

            '<label class="bm-check">' +
              '<input type="checkbox" id="bmOnly">' +
              '<span>Sadece ideal sonucu olan maçlar</span>' +
            '</label>' +

          '</div>' +

        '</div>' +

        '<div id="bmStats" class="bm-stats"></div>' +

        '<div id="bmInfo" class="bm-info"></div>' +

        '<div id="bmList" class="bm-list"></div>' +

      '</div>' +

      '<style>' +

        '* {' +
          'box-sizing: border-box;' +
        '}' +

        'body {' +
          'background: #080f20;' +
          'color: #e7edf8;' +
        '}' +

        '.bm-wrap {' +
          'width: 100%;' +
          'max-width: 1100px;' +
          'margin: 0 auto;' +
          'padding: 14px;' +
        '}' +

        '.bm-top {' +
          'display: flex;' +
          'justify-content: space-between;' +
          'gap: 14px;' +
          'align-items: flex-start;' +
          'margin-bottom: 14px;' +
        '}' +

        'h1 {' +
          'font-size: 23px;' +
          'margin: 0 0 4px;' +
        '}' +

        '.bm-sub {' +
          'font-size: 12px;' +
          'color: #8d9ab2;' +
        '}' +

        '.bm-controls {' +
          'display: flex;' +
          'gap: 10px;' +
          'align-items: flex-end;' +
          'flex-wrap: wrap;' +
          'justify-content: flex-end;' +
        '}' +

        '.bm-controls label {' +
          'display: flex;' +
          'flex-direction: column;' +
          'gap: 5px;' +
          'font-size: 11px;' +
          'color: #91a0ba;' +
        '}' +

        '.bm-controls input[type="date"] {' +
          'background: #101a31;' +
          'border: 1px solid #263452;' +
          'color: #fff;' +
          'border-radius: 9px;' +
          'padding: 8px 9px;' +
          'outline: none;' +
        '}' +

        '.bm-check {' +
          'flex-direction: row !important;' +
          'align-items: center;' +
          'margin-top: 19px;' +
        '}' +

        '.bm-check input {' +
          'accent-color: #4f8cff;' +
        '}' +

        '.bm-stats {' +
          'display: grid;' +
          'grid-template-columns: repeat(5, 1fr);' +
          'gap: 8px;' +
          'margin-bottom: 10px;' +
        '}' +

        '.bm-stat {' +
          'background: #0e172b;' +
          'border: 1px solid #1c2944;' +
          'border-radius: 12px;' +
          'padding: 11px;' +
          'min-height: 82px;' +
        '}' +

        '.bm-stat-title {' +
          'font-size: 10px;' +
          'color: #8290aa;' +
          'text-transform: uppercase;' +
          'letter-spacing: .3px;' +
        '}' +

        '.bm-stat-value {' +
          'font-size: 22px;' +
          'font-weight: 800;' +
          'margin-top: 5px;' +
        '}' +

        '.bm-stat-sub {' +
          'font-size: 10px;' +
          'color: #77849d;' +
          'margin-top: 3px;' +
        '}' +

        '.bm-stat.success-stat .bm-stat-value {' +
          'color: #35d07f;' +
        '}' +

        '.bm-stat.fail-stat .bm-stat-value {' +
          'color: #ff6262;' +
        '}' +

        '.bm-info {' +
          'font-size: 12px;' +
          'color: #8d9ab2;' +
          'margin: 8px 2px 10px;' +
        '}' +

        '.bm-list {' +
          'display: flex;' +
          'flex-direction: column;' +
          'gap: 9px;' +
        '}' +

        '.bm-card {' +
          'background: #0d1629;' +
          'border: 1px solid #1b2944;' +
          'border-radius: 14px;' +
          'overflow: hidden;' +
        '}' +

        '.bm-card-head {' +
          'display: flex;' +
          'justify-content: space-between;' +
          'gap: 10px;' +
          'padding: 13px;' +
          'cursor: pointer;' +
        '}' +

        '.bm-teams {' +
          'min-width: 0;' +
          'flex: 1;' +
        '}' +

        '.bm-league {' +
          'font-size: 10px;' +
          'color: #6f7e99;' +
          'margin-bottom: 6px;' +
        '}' +

        '.bm-team {' +
          'font-size: 14px;' +
          'font-weight: 700;' +
          'line-height: 1.5;' +
          'white-space: nowrap;' +
          'overflow: hidden;' +
          'text-overflow: ellipsis;' +
        '}' +

        '.bm-score {' +
          'min-width: 62px;' +
          'text-align: center;' +
          'display: flex;' +
          'flex-direction: column;' +
          'justify-content: center;' +
        '}' +

        '.bm-score strong {' +
          'font-size: 18px;' +
        '}' +

        '.bm-score small {' +
          'font-size: 10px;' +
          'color: #8190aa;' +
          'margin-top: 2px;' +
        '}' +

        '.bm-best {' +
          'margin: 0 10px 10px;' +
          'padding: 10px 11px;' +
          'border: 1px solid #283957;' +
          'border-radius: 10px;' +
          'display: flex;' +
          'justify-content: space-between;' +
          'align-items: center;' +
          'gap: 10px;' +
        '}' +

        '.bm-best.success,' +
        '.bm-pred.success {' +
          'background: rgba(34, 197, 94, .11);' +
          'border-color: rgba(34, 197, 94, .55);' +
        '}' +

        '.bm-best.fail,' +
        '.bm-pred.fail {' +
          'background: rgba(239, 68, 68, .11);' +
          'border-color: rgba(239, 68, 68, .55);' +
        '}' +

        '.bm-best.pending,' +
        '.bm-pred.pending {' +
          'background: rgba(234, 179, 8, .10);' +
          'border-color: rgba(234, 179, 8, .50);' +
        '}' +

        '.bm-best-main {' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 8px;' +
          'min-width: 0;' +
        '}' +

        '.bm-status-icon {' +
          'width: 23px;' +
          'height: 23px;' +
          'border-radius: 50%;' +
          'display: flex;' +
          'align-items: center;' +
          'justify-content: center;' +
          'font-weight: 900;' +
          'font-size: 13px;' +
          'background: rgba(255, 255, 255, .08);' +
        '}' +

        '.success .bm-status-icon {' +
          'color: #35d07f;' +
        '}' +

        '.fail .bm-status-icon {' +
          'color: #ff6262;' +
        '}' +

        '.pending .bm-status-icon {' +
          'color: #f1c84b;' +
        '}' +

        '.bm-best-label {' +
          'font-weight: 800;' +
          'font-size: 14px;' +
        '}' +

        '.bm-best-odd {' +
          'font-size: 11px;' +
          'color: #9ba8bf;' +
          'background: #111c32;' +
          'padding: 3px 6px;' +
          'border-radius: 6px;' +
        '}' +

        '.bm-best-percent {' +
          'font-size: 18px;' +
          'font-weight: 900;' +
          'white-space: nowrap;' +
          'display: flex;' +
          'flex-direction: column;' +
          'align-items: flex-end;' +
        '}' +

        '.bm-best-percent small {' +
          'font-size: 9px;' +
          'font-weight: 500;' +
          'color: #7e8ba2;' +
          'margin-top: 2px;' +
        '}' +

        '.bm-no-best {' +
          'margin: 0 10px 10px;' +
          'padding: 9px 11px;' +
          'font-size: 11px;' +
          'color: #68758e;' +
          'background: #0a1222;' +
          'border-radius: 9px;' +
        '}' +

        '.bm-details {' +
          'display: none;' +
          'padding: 0 10px 10px;' +
        '}' +

        '.bm-card.open .bm-details {' +
          'display: block;' +
        '}' +

        '.bm-pred {' +
          'display: flex;' +
          'align-items: center;' +
          'justify-content: space-between;' +
          'gap: 10px;' +
          'padding: 8px 9px;' +
          'border: 1px solid #1d2a43;' +
          'border-radius: 9px;' +
          'margin-top: 6px;' +
        '}' +

        '.bm-pred-left {' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 7px;' +
          'min-width: 0;' +
        '}' +

        '.bm-pred-icon {' +
          'width: 19px;' +
          'height: 19px;' +
          'border-radius: 50%;' +
          'display: flex;' +
          'align-items: center;' +
          'justify-content: center;' +
          'font-size: 11px;' +
          'font-weight: 900;' +
        '}' +

        '.success .bm-pred-icon {' +
          'color: #35d07f;' +
        '}' +

        '.fail .bm-pred-icon {' +
          'color: #ff6262;' +
        '}' +

        '.pending .bm-pred-icon {' +
          'color: #f1c84b;' +
        '}' +

        '.bm-pred-label {' +
          'font-size: 12px;' +
          'font-weight: 700;' +
        '}' +

        '.bm-pred-odd {' +
          'font-size: 10px;' +
          'color: #7e8ba2;' +
        '}' +

        '.bm-pred-right {' +
          'display: flex;' +
          'align-items: center;' +
          'gap: 7px;' +
        '}' +

        '.bm-pred-right strong {' +
          'font-size: 13px;' +
        '}' +

        '.bm-pred-right span {' +
          'font-size: 9px;' +
          'color: #74829b;' +
        '}' +

        '.bm-empty {' +
          'padding: 12px;' +
          'text-align: center;' +
          'font-size: 11px;' +
          'color: #69768d;' +
          'background: #0a1221;' +
          'border-radius: 9px;' +
        '}' +

        '@media (max-width: 760px) {' +

          '.bm-top {' +
            'flex-direction: column;' +
          '}' +

          '.bm-controls {' +
            'width: 100%;' +
            'justify-content: flex-start;' +
          '}' +

          '.bm-stats {' +
            'grid-template-columns: repeat(2, 1fr);' +
          '}' +

          '.bm-stat:last-child {' +
            'grid-column: span 2;' +
          '}' +

        '}' +

        '@media (max-width: 430px) {' +

          '.bm-wrap {' +
            'padding: 9px;' +
          '}' +

          '.bm-stat-value {' +
            'font-size: 19px;' +
          '}' +

          '.bm-best-percent {' +
            'font-size: 16px;' +
          '}' +

        '}' +

      '</style>';
  }

  function render() {
    var dateInput = $('#dateFilter');
    var onlyIdeal = $('#bmOnly');

    var selectedDate =
      dateInput && dateInput.value
        ? dateInput.value
        : todayISO();

    if (dateInput) {
      dateInput.value = selectedDate;
    }

    var startDate =
      daysAgoISO(CFG.days);

    /*
     * Son 60 günün tamamlanmış maçları.
     */
    var playedHistory =
      DATA.filter(function (match) {
        var d = getDate(match);

        return (
          isPlayed(match) &&
          d >= startDate &&
          d < selectedDate
        );
      });

    /*
     * Açılış oranı analiz havuzu.
     */
    buildIndex(playedHistory);

    /*
     * Seçilen günün maçları.
     */
    var currentMatches =
      DATA.filter(function (match) {
        return (
          getDate(match) ===
          selectedDate
        );
      });

    /*
     * Günlük sadece ana tahmin başarı.
     */
    var dailyStats =
      calculateDailyMainPredictionStats(
        currentMatches
      );

    /*
     * 60 günlük sadece ana tahmin başarı.
     */
    var mainStats =
      calculateMainPredictionStats(
        playedHistory
      );

    /*
     * Günün maçlarını analiz et.
     */
    var analyzed =
      currentMatches.map(function (match) {
        return {
          match: match,
          analysis: analyzeMatch(match)
        };
      });

    /*
     * Sadece ideal sonucu olanlar.
     */
    if (
      onlyIdeal &&
      onlyIdeal.checked
    ) {
      analyzed =
        analyzed.filter(function (item) {
          return !!item.analysis.best;
        });
    }

    /*
     * Ana tahmin yüzdesine göre sırala.
     */
    analyzed.sort(function (a, b) {
      var ap = a.analysis.best;
      var bp = b.analysis.best;

      if (bp && !ap) {
        return 1;
      }

      if (ap && !bp) {
        return -1;
      }

      if (ap && bp) {
        if (bp.percent !== ap.percent) {
          return (
            bp.percent -
            ap.percent
          );
        }

        return (
          bp.total -
          ap.total
        );
      }

      return 0;
    });

    var idealCount =
      analyzed.filter(function (item) {
        return !!item.analysis.best;
      }).length;

    var unplayedCount =
      currentMatches.filter(function (match) {
        return !isPlayed(match);
      }).length;

    /*
     * =====================================================
     * İSTATİSTİK KUTULARI
     * =====================================================
     */
    var dailyClass = '';

    if (dailyStats.total > 0) {
      dailyClass =
        dailyStats.percent >= CFG.threshold
          ? 'success-stat'
          : 'fail-stat';
    }

    var mainClass = '';

    if (mainStats.total > 0) {
      mainClass =
        mainStats.percent >= CFG.threshold
          ? 'success-stat'
          : 'fail-stat';
    }

    var statsHtml =

      '<div class="bm-stat">' +
        '<div class="bm-stat-title">' +
          'Oynanmamış' +
        '</div>' +

        '<div class="bm-stat-value">' +
          unplayedCount +
        '</div>' +

        '<div class="bm-stat-sub">' +
          'Seçilen gün' +
        '</div>' +
      '</div>' +

      '<div class="bm-stat">' +
        '<div class="bm-stat-title">' +
          'İdeal Sonuçlu' +
        '</div>' +

        '<div class="bm-stat-value">' +
          idealCount +
        '</div>' +

        '<div class="bm-stat-sub">' +
          'Ana tahmin bulunan maç' +
        '</div>' +
      '</div>' +

      '<div class="bm-stat">' +
        '<div class="bm-stat-title">' +
          '60 Gün Analiz Havuzu' +
        '</div>' +

        '<div class="bm-stat-value">' +
          playedHistory.length +
        '</div>' +

        '<div class="bm-stat-sub">' +
          'Tamamlanmış maç' +
        '</div>' +
      '</div>' +

      '<div class="bm-stat ' +
        dailyClass +
      '">' +

        '<div class="bm-stat-title">' +
          'Günlük Ana Tahmin Başarısı' +
        '</div>' +

        '<div class="bm-stat-value">' +
          (
            dailyStats.total > 0
              ? dailyStats.percent.toFixed(1) + '%'
              : '-'
          ) +
        '</div>' +

        '<div class="bm-stat-sub">' +
          dailyStats.success +
          '/' +
          dailyStats.total +
          ' ana tahmin' +
        '</div>' +

      '</div>' +

      '<div class="bm-stat ' +
        mainClass +
      '">' +

        '<div class="bm-stat-title">' +
          '60 Gün Ana Tahmin Başarısı' +
        '</div>' +

        '<div class="bm-stat-value">' +
          (
            mainStats.total > 0
              ? mainStats.percent.toFixed(1) + '%'
              : '-'
          ) +
        '</div>' +

        '<div class="bm-stat-sub">' +
          mainStats.success +
          '/' +
          mainStats.total +
          ' ana tahmin' +
        '</div>' +

      '</div>';

    var statsBox =
      $('#bmStats');

    if (statsBox) {
      statsBox.innerHTML =
        statsHtml;
    }

    var info =
      $('#bmInfo');

    if (info) {
      info.innerHTML =
        esc(selectedDate) +
        ' · ' +
        currentMatches.length +
        ' maç · ' +
        analyzed.length +
        ' gösteriliyor';
    }

    var list =
      $('#bmList');

    if (!list) {
      return;
    }

    if (!analyzed.length) {
      list.innerHTML =
        '<div class="bm-empty">' +
          'Bu tarihte gösterilecek maç bulunamadı.' +
        '</div>';

      return;
    }

    list.innerHTML =
      analyzed.map(function (item, index) {
        return cardHtml(
          item.match,
          item.analysis,
          index
        );
      }).join('');
  }

  function loadData() {
    fetch(
      DATA_URL +
      '?v=' +
      Date.now(),
      {
        cache: 'no-store'
      }
    )
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            'Veri alınamadı: ' +
            response.status
          );
        }

        return response.json();
      })
      .then(function (json) {

        var matches =
          Array.isArray(json)
            ? json
            : (
              Array.isArray(json.matches)
                ? json.matches
                : []
            );

        DATA =
          matches.map(
            normalizeMatch
          );

        createUI();

        var dateInput =
          $('#dateFilter');

        if (dateInput) {
          dateInput.value =
            todayISO();

          dateInput.addEventListener(
            'change',
            render
          );
        }

        var onlyIdeal =
          $('#bmOnly');

        if (onlyIdeal) {
          onlyIdeal.addEventListener(
            'change',
            render
          );
        }

        var list =
          $('#bmList');

        if (list) {
          list.addEventListener(
            'click',
            function (event) {

              var card =
                event.target.closest(
                  '.bm-card'
                );

              if (!card) {
                return;
              }

              card.classList.toggle(
                'open'
              );
            }
          );
        }

        render();
      })
      .catch(function (error) {

        console.error(error);

        document.body.innerHTML =
          '<div style="' +
            'padding:30px;' +
            'background:#080f20;' +
            'color:#ff7777;' +
            'font-family:Arial;' +
            'min-height:100vh;' +
          '">' +

            '<h2>Veriler yüklenemedi</h2>' +

            '<div style="color:#9aa7bd;">' +
              esc(error.message) +
            '</div>' +

          '</div>';
      });
  }

  loadData();

})();
