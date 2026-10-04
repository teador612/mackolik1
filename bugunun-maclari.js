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
      key: 'au25Ust',
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

  function $(id) {
    return document.getElementById(id);
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function num(v) {
    if (v == null || String(v).trim() === '') return NaN;
    var n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }

  function score(v) {
    if (v == null) return null;

    var s = String(v).trim();

    var m = s.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (m) return [+m[1], +m[2]];

    return null;
  }

  function getDate(m) {
    if (!m) return '';

    var d = String(m.date || '');

    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return d;
    }

    var p = d.split('.');

    if (p.length === 3) {
      return p[2] + '-' +
             String(p[1]).padStart(2, '0') + '-' +
             String(p[0]).padStart(2, '0');
    }

    return d;
  }

  function formatDate(d) {
    var p = String(d || '').split('-');

    if (p.length === 3) {
      return p[2] + '.' + p[1] + '.' + p[0];
    }

    return d || '';
  }

  function todayISO() {
    var d = new Date();

    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function daysAgoISO(days) {
    var d = new Date();
    d.setDate(d.getDate() - days);

    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function getOpeningOdds(m) {
    if (!m) return {};

    return m.openingOdds ||
           m.odds ||
           {};
  }

  function getFT(m) {
    if (!m) return null;

    if (
      m.score &&
      /^\d+$/.test(String(m.score.home)) &&
      /^\d+$/.test(String(m.score.away))
    ) {
      return [
        Number(m.score.home),
        Number(m.score.away)
      ];
    }

    if (m.scoreFT) {
      return score(m.scoreFT);
    }

    return null;
  }

  function getHT(m) {
    if (!m) return null;

    if (
      m.halfTimeScore &&
      /^\d+$/.test(String(m.halfTimeScore.home)) &&
      /^\d+$/.test(String(m.halfTimeScore.away))
    ) {
      return [
        Number(m.halfTimeScore.home),
        Number(m.halfTimeScore.away)
      ];
    }

    if (m.scoreHT) {
      return score(m.scoreHT);
    }

    return null;
  }

  function isPlayed(m) {
    return !!getFT(m);
  }

  function normalizeMatch(m) {
    return {
      raw: m,
      date: getDate(m),
      league: m.league || '',
      home: m.home || '',
      away: m.away || '',
      time: m.time || '',
      code: m.code || '',
      ft: getFT(m),
      ht: getHT(m),
      odds: getOpeningOdds(m)
    };
  }

  /* ---------------------------------------------------------
     INDEX
     Aynı ORAN TÜRÜ + aynı ORAN değerine sahip maçlar
     --------------------------------------------------------- */

  function buildIndex() {
    INDEX = Object.create(null);

    DATA.forEach(function (m) {
      if (!m.ft) return;

      Object.keys(m.odds || {}).forEach(function (key) {
        var n = num(m.odds[key]);

        if (!(n > 0)) return;

        var indexKey = key + '|' + n;

        if (!INDEX[indexKey]) {
          INDEX[indexKey] = [];
        }

        INDEX[indexKey].push(m);
      });
    });
  }

  /* ---------------------------------------------------------
     13 SONUCUN TAMAMINI HESAPLA
     --------------------------------------------------------- */

  function calculateStats(hist) {
    return RESULTS.map(function (result) {

      var success = 0;
      var total = 0;

      hist.forEach(function (m) {

        var value = result.test(m.ft, m.ht);

        if (value === null || value === undefined) {
          return;
        }

        total++;

        if (value) {
          success++;
        }
      });

      var percent = total
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

  /* ---------------------------------------------------------
     HER ORAN GRUBU İÇİN ANALİZ

     ÖNEMLİ:
     MS1 oranı 1.80 ise:
       MS1 1.80 olan geçmiş maçları bul
       sonra bu maçların:
       MS1
       MSX
       MS2
       KG Var
       İY1
       İYX
       ...
       2,5 Üst

     sonuçlarının HEPSİNİ hesapla.
     --------------------------------------------------------- */

  function analyzeMatch(match) {

    var odds = match.odds || {};
    var groups = [];
    var seen = Object.create(null);

    Object.keys(odds).forEach(function (marketKey) {

      if (MARKET_KEYS.indexOf(marketKey) === -1) {
        return;
      }

      var odd = num(odds[marketKey]);

      if (!(odd >= CFG.minOdd)) {
        return;
      }

      var indexKey = marketKey + '|' + odd;
      var hist = INDEX[indexKey];

      if (!hist || !hist.length) {
        return;
      }

      /*
       Aynı oran grubunu tekrar hesaplama.
      */
      var signature = hist
        .map(function (m) {
          return m.date + '|' +
                 m.home + '|' +
                 m.away;
        })
        .sort()
        .join('||');

      var uniqueKey = marketKey + '|' + odd + '|' + signature;

      if (seen[uniqueKey]) {
        return;
      }

      seen[uniqueKey] = true;

      var stats = calculateStats(hist);

      var ideals = stats.filter(function (x) {
        return x.ideal;
      });

      groups.push({
        marketKey: marketKey,
        odd: odd,
        hist: hist,
        stats: stats,
        ideals: ideals
      });
    });

    /*
     Aynı tahmin birden fazla oran grubundan çıkabilir.
     En güçlü olanı bırakıyoruz.
     */
    var predictionMap = Object.create(null);

    groups.forEach(function (group) {

      group.ideals.forEach(function (p) {

        var old = predictionMap[p.label];

        var item = {
          key: p.key,
          label: p.label,
          percent: p.percent,
          success: p.success,
          total: p.total,
          sourceMarket: group.marketKey,
          sourceOdd: group.odd
        };

        if (
          !old ||
          item.percent > old.percent ||
          (
            item.percent === old.percent &&
            item.total > old.total
          )
        ) {
          predictionMap[p.label] = item;
        }
      });
    });

    var predictions = Object.keys(predictionMap)
      .map(function (k) {
        return predictionMap[k];
      })
      .sort(function (a, b) {
        return (
          b.percent - a.percent ||
          b.total - a.total
        );
      });

    return {
      groups: groups,
      predictions: predictions,
      best: predictions.length
        ? predictions[0]
        : null
    };
  }

  /* ---------------------------------------------------------
     CSS
     --------------------------------------------------------- */

  var css = `
    .bm-wrap{
      background:#07111f;
      color:#eaf1ff;
      padding:14px;
      border-radius:14px;
      margin:12px 0;
    }

    .bm-title{
      font-size:18px;
      font-weight:800;
      margin-bottom:12px;
    }

    .bm-controls{
      display:grid;
      grid-template-columns:repeat(5,1fr);
      gap:8px;
      margin-bottom:10px;
    }

    .bm-field{
      display:flex;
      flex-direction:column;
      gap:4px;
    }

    .bm-field label{
      font-size:11px;
      color:#8fa1bd;
    }

    .bm-field input,
    .bm-field select{
      width:100%;
      box-sizing:border-box;
      background:#101d30;
      border:1px solid #263852;
      color:#fff;
      border-radius:8px;
      padding:9px;
      outline:none;
    }

    .bm-checks{
      display:flex;
      gap:16px;
      flex-wrap:wrap;
      font-size:12px;
      color:#aab9cf;
      margin:10px 0;
    }

    .bm-stats{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:7px;
      margin:10px 0;
    }

    .bm-stat{
      background:#0d1929;
      border:1px solid #1d2d46;
      border-radius:9px;
      padding:9px;
    }

    .bm-stat small{
      display:block;
      color:#8191a9;
      font-size:10px;
    }

    .bm-stat b{
      display:block;
      margin-top:3px;
      font-size:16px;
    }

    .bm-card{
      background:#0c1727;
      border:1px solid #1d2d46;
      border-radius:11px;
      margin:7px 0;
      overflow:hidden;
    }

    .bm-head{
      display:flex;
      align-items:center;
      gap:8px;
      padding:9px;
    }

    .bm-plus{
      width:32px;
      height:32px;
      flex:0 0 32px;
      border-radius:8px;
      border:1px solid #304766;
      background:#122139;
      color:#9bb2d0;
      font-size:20px;
      cursor:pointer;
    }

    .bm-card.open .bm-plus{
      background:#1769e8;
      border-color:#1769e8;
      color:#fff;
    }

    .bm-info{
      min-width:0;
      flex:1;
    }

    .bm-meta{
      font-size:10px;
      color:#7f90aa;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .bm-teams{
      margin-top:3px;
      font-size:13px;
      font-weight:800;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .bm-score{
      background:#14243a;
      border:1px solid #28425f;
      color:#50e4d4;
      border-radius:7px;
      padding:5px 7px;
      font-weight:800;
      font-size:12px;
      white-space:nowrap;
    }

    .bm-best{
      background:#122c27;
      border:1px solid #246b5e;
      color:#55e1ca;
      border-radius:7px;
      padding:5px 7px;
      font-size:11px;
      font-weight:800;
      white-space:nowrap;
    }

    .bm-none{
      background:#161d29;
      border-color:#2a3445;
      color:#738198;
    }

    .bm-body{
      display:none;
      padding:9px;
      border-top:1px solid #19283d;
      background:#091321;
    }

    .bm-card.open .bm-body{
      display:block;
    }

    .bm-note{
      color:#8191a9;
      font-size:10px;
      line-height:1.5;
      margin-bottom:8px;
    }

    .bm-preds{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:6px;
    }

    .bm-pred{
      background:#101f32;
      border:1px solid #24405e;
      border-radius:8px;
      padding:8px 5px;
      text-align:center;
    }

    .bm-pred b{
      display:block;
      color:#5fe3d0;
      font-size:15px;
    }

    .bm-pred span{
      display:block;
      font-size:10px;
      color:#dbe5f4;
      margin-top:2px;
    }

    .bm-pred small{
      display:block;
      font-size:9px;
      color:#7f91aa;
      margin-top:3px;
    }

    .bm-empty{
      text-align:center;
      padding:22px 10px;
      color:#7f90a8;
      font-size:13px;
    }

    @media(max-width:800px){
      .bm-controls{
        grid-template-columns:repeat(2,1fr);
      }
    }

    @media(max-width:520px){
      .bm-wrap{
        padding:10px;
      }

      .bm-controls{
        grid-template-columns:1fr 1fr;
      }

      .bm-preds{
        grid-template-columns:repeat(2,1fr);
      }

      .bm-best{
        font-size:10px;
        padding:4px 5px;
      }

      .bm-teams{
        font-size:12px;
      }
    }
  `;

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------------------------------------------------
     HTML
     --------------------------------------------------------- */

  function createUI() {

    var old = document.getElementById('bugununMaclariStandalone');

    if (old) {
      old.remove();
    }

    var wrap = document.createElement('section');
    wrap.id = 'bugununMaclariStandalone';

    wrap.innerHTML = `
      <div class="bm-wrap">

        <div class="bm-title">
          Bugünün Maçları
        </div>

        <div class="bm-controls">

          <div class="bm-field">
            <label>Maç günü</label>
            <input id="bmDate" type="date">
          </div>

          <div class="bm-field">
            <label>Eşleştirme</label>
            <select id="bmMatch">
              <option value="each">Her oran türü tek tek</option>
            </select>
          </div>

          <div class="bm-field">
            <label>İdeal eşik (%)</label>
            <input id="bmThreshold" type="number"
                   min="0" max="100" value="${CFG.threshold}">
          </div>

          <div class="bm-field">
            <label>Min. geçmiş maç</label>
            <input id="bmMin" type="number"
                   min="1" value="${CFG.minMatches}">
          </div>

          <div class="bm-field">
            <label>Min. oran</label>
            <input id="bmOdd" type="number"
                   min="1" step="0.01" value="${CFG.minOdd}">
          </div>

        </div>

        <div class="bm-checks">

          <label>
            <input id="bmOnly" type="checkbox">
            Sadece ideal sonucu olan maçlar
          </label>

          <label>
            <input id="bmAll" type="checkbox" checked>
            Tüm sonuçları göster
          </label>

        </div>

        <div id="bmStats"></div>

        <div id="bmList"></div>

      </div>
    `;

    document.body.appendChild(wrap);

    $('bmDate').value = todayISO();

    ['bmDate', 'bmThreshold', 'bmMin', 'bmOdd', 'bmOnly', 'bmAll']
      .forEach(function (id) {
        $(id).addEventListener('change', render);
        $(id).addEventListener('input', render);
      });
  }

  /* ---------------------------------------------------------
     KART
     --------------------------------------------------------- */

  function cardHtml(match, analysis, index) {

    var best = analysis.best;

    var scoreHtml = '';

    if (match.ft) {
      scoreHtml =
        '<div class="bm-score">' +
        match.ft[0] + ' - ' + match.ft[1] +
        '</div>';
    }

    var bestHtml = best
      ? '<div class="bm-best">' +
          esc(best.label) +
          ' %' +
          best.percent.toFixed(0) +
        '</div>'
      : '<div class="bm-best bm-none">Tahmin yok</div>';

    return `
      <div class="bm-card" data-index="${index}">

        <div class="bm-head">

          <button class="bm-plus" type="button">
            +
          </button>

          <div class="bm-info">

            <div class="bm-meta">
              ${esc(match.time)}
              ${match.league ? ' · ' + esc(match.league) : ''}
            </div>

            <div class="bm-teams">
              ${esc(match.home)}
              -
              ${esc(match.away)}
            </div>

          </div>

          ${scoreHtml}

          ${bestHtml}

        </div>

        <div class="bm-body">

          ${
            best
            ? predictionHtml(analysis)
            : '<div class="bm-empty">Bu maç için kriterlere uygun tahmin bulunamadı.</div>'
          }

        </div>

      </div>
    `;
  }

  function predictionHtml(analysis) {

    var predictions = analysis.predictions || [];

    if (!predictions.length) {
      return '<div class="bm-empty">Tahmin yok.</div>';
    }

    var html =
      '<div class="bm-note">' +
      'Aynı oran grubundaki geçmiş maçlardan 13 sonuç türü hesaplandı. ' +
      'Eşik: %' + CFG.threshold +
      ' · Minimum geçmiş: ' + CFG.minMatches +
      ' maç' +
      '</div>';

    html += '<div class="bm-preds">';

    predictions.forEach(function (p) {

      html += `
        <div class="bm-pred">

          <b>%${p.percent.toFixed(0)}</b>

          <span>
            ${esc(p.label)}
          </span>

          <small>
            ${p.success}/${p.total}
            · oran ${p.sourceOdd}
          </small>

        </div>
      `;
    });

    html += '</div>';

    return html;
  }

  /* ---------------------------------------------------------
     RENDER
     --------------------------------------------------------- */

  function render() {

    if (!DATA.length) {
      return;
    }

    CFG.threshold =
      Math.max(
        0,
        Math.min(
          100,
          num($('bmThreshold').value) || 70
        )
      );

    CFG.minMatches =
      Math.max(
        1,
        parseInt($('bmMin').value, 10) || 5
      );

    CFG.minOdd =
      Math.max(
        1,
        num($('bmOdd').value) || 1.40
      );

    var selectedDate =
      $('bmDate').value || todayISO();

    var startDate =
      daysAgoISO(CFG.days);

    var currentMatches =
      DATA.filter(function (m) {
        return m.date === selectedDate;
      });

    var playedHistory =
      DATA.filter(function (m) {
        return (
          m.ft &&
          m.date >= startDate &&
          m.date < selectedDate
        );
      });

    /*
     Analiz indeksini sadece son 60 gün için kur.
     */
    var oldIndex = INDEX;

    INDEX = Object.create(null);

    playedHistory.forEach(function (m) {

      Object.keys(m.odds || {}).forEach(function (key) {

        var odd = num(m.odds[key]);

        if (!(odd > 0)) return;

        var k = key + '|' + odd;

        if (!INDEX[k]) {
          INDEX[k] = [];
        }

        INDEX[k].push(m);
      });
    });

    var analyzed = currentMatches.map(function (m) {
      return {
        match: m,
        analysis: analyzeMatch(m)
      };
    });

    /*
     Sadece ideal seçiliyse tahminsizleri kaldır.
     */
    if ($('bmOnly').checked) {
      analyzed = analyzed.filter(function (x) {
        return !!x.analysis.best;
      });
    }

    var idealCount =
      analyzed.filter(function (x) {
        return !!x.analysis.best;
      }).length;

    var poolCount =
      playedHistory.length;

    $('bmStats').innerHTML = `
      <div class="bm-stats">

        <div class="bm-stat">
          <small>Oynanmamış / Seçilen Gün</small>
          <b>${currentMatches.length}</b>
        </div>

        <div class="bm-stat">
          <small>İdeal Sonuçlu</small>
          <b>${idealCount}</b>
        </div>

        <div class="bm-stat">
          <small>60 Gün Analiz Havuzu</small>
          <b>${poolCount}</b>
        </div>

      </div>
    `;

    if (!analyzed.length) {

      $('bmList').innerHTML =
        '<div class="bm-empty">' +
        formatDate(selectedDate) +
        ' tarihinde kriterlere uygun maç bulunamadı.' +
        '</div>';

      return;
    }

    /*
     Tahminli maçları önce göster.
     */
    analyzed.sort(function (a, b) {

      var ap = a.analysis.best;
      var bp = b.analysis.best;

      if (!!bp !== !!ap) {
        return bp ? 1 : -1;
      }

      if (ap && bp) {
        return bp.percent - ap.percent;
      }

      return a.match.time.localeCompare(b.match.time);
    });

    $('bmList').innerHTML =
      analyzed.map(function (x, i) {
        return cardHtml(
          x.match,
          x.analysis,
          i
        );
      }).join('');

    INDEX = oldIndex;
  }

  /* ---------------------------------------------------------
     TIKLAMA
     --------------------------------------------------------- */

  document.addEventListener('click', function (e) {

    var btn = e.target.closest('.bm-plus');

    if (!btn) return;

    var card = btn.closest('.bm-card');

    if (!card) return;

    card.classList.toggle('open');

    btn.textContent =
      card.classList.contains('open')
        ? '−'
        : '+';
  });

  /* ---------------------------------------------------------
     JSON YÜKLE
     --------------------------------------------------------- */

  function loadData() {

    fetch(
      DATA_URL + '?v=' + Date.now(),
      {
        cache: 'no-store'
      }
    )
      .then(function (res) {

        if (!res.ok) {
          throw new Error(
            'matches.json yüklenemedi: ' +
            res.status
          );
        }

        return res.json();
      })
      .then(function (json) {

        var matches =
          Array.isArray(json)
            ? json
            : (json.matches || []);

        DATA =
          matches
            .map(normalizeMatch)
            .filter(function (m) {
              return m.date;
            });

        buildIndex();

        createUI();

        render();
      })
      .catch(function (err) {

        console.error(
          'Bugünün maçları veri hatası:',
          err
        );

        var box =
          document.createElement('div');

        box.className = 'bm-empty';

        box.innerHTML =
          'Veriler yüklenemedi.<br>' +
          '<small>' +
          esc(err.message) +
          '</small>';

        document.body.appendChild(box);
      });
  }

  /* ---------------------------------------------------------
     BAŞLAT
     --------------------------------------------------------- */

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      loadData
    );
  } else {
    loadData();
  }

})();
