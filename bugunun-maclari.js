(function () {
  'use strict';

  const DATA_URL = './data/matches.json';
  const START_DATE = '2026-09-01';

  const RES = [
    {
      label: 'MS1',
      keys: ['ms1'],
      test: (ft) => ft && ft[0] > ft[1]
    },
    {
      label: 'MS0',
      keys: ['ms0', 'msX'],
      test: (ft) => ft && ft[0] === ft[1]
    },
    {
      label: 'MS2',
      keys: ['ms2'],
      test: (ft) => ft && ft[0] < ft[1]
    },
    {
      label: 'KG Var',
      keys: ['kgVar'],
      test: (ft) => ft && ft[0] > 0 && ft[1] > 0
    },
    {
      label: '2,5 Üst',
      keys: ['over25'],
      test: (ft) => ft && (ft[0] + ft[1]) > 2.5
    },
    {
      label: 'İY 0,5 Üst',
      keys: ['iyOver05'],
      test: (ft, ht) => ht && (ht[0] + ht[1]) > 0.5
    },
    {
      label: 'İY 1,5 Üst',
      keys: ['iyOver15'],
      test: (ft, ht) => ht && (ht[0] + ht[1]) > 1.5
    }
  ];

  let RAW = [];
  let MATCHES = [];
  let HISTORICAL = [];
  let TODAY = [];

  const $ = id => document.getElementById(id);

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
  }

  function number(v) {
    if (v == null || v === '') return NaN;

    if (typeof v === 'number') {
      return Number.isFinite(v) ? v : NaN;
    }

    let s = String(v)
      .trim()
      .replace(',', '.');

    const n = Number(s);

    return Number.isFinite(n) ? n : NaN;
  }

  function dateToISO(v) {

    if (!v) return '';

    const s = String(v).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }

    const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

    if (m) {
      return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }

    return '';
  }

  function todayISO() {

    const d = new Date();

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }

  function formatDate(iso) {

    const p = String(iso).split('-');

    if (p.length !== 3) return iso;

    return `${p[2]}.${p[1]}.${p[0]}`;
  }

  function scoreObject(obj) {

    if (!obj) return null;

    const h = number(obj.home);
    const a = number(obj.away);

    if (!Number.isFinite(h) || !Number.isFinite(a)) {
      return null;
    }

    return [h, a];
  }

  function scoreString(v) {

    if (!v) return null;

    const m = String(v).match(/(\d+)\s*[-:]\s*(\d+)/);

    if (!m) return null;

    return [
      Number(m[1]),
      Number(m[2])
    ];
  }

  function getFT(m) {

    if (m.score) {
      const s = scoreObject(m.score);

      if (s) return s;
    }

    if (m.fullTimeScore) {
      const s = scoreObject(m.fullTimeScore);

      if (s) return s;
    }

    if (m.finalScore) {
      const s = scoreObject(m.finalScore);

      if (s) return s;
    }

    const s = scoreString(m.score);

    return s;
  }

  function getHT(m) {

    if (m.halfTimeScore) {
      const s = scoreObject(m.halfTimeScore);

      if (s) return s;
    }

    if (m.htScore) {
      const s = scoreObject(m.htScore);

      if (s) return s;
    }

    return scoreString(m.halfTimeScore);
  }

  function isPlayed(m) {

    const ft = getFT(m);

    if (!ft) return false;

    const status = String(m.status == null ? '' : m.status).toLowerCase();

    if (
      status === 'not_started' ||
      status === 'scheduled' ||
      status === 'upcoming' ||
      status === '0'
    ) {
      return false;
    }

    return true;
  }

  function oddsObject(m) {

    const source =
      m.odds ||
      m.openingOdds ||
      m.opening ||
      m.markets ||
      {};

    const out = {};

    function add(key, value) {

      const n = number(value);

      if (!Number.isFinite(n)) return;

      out[key] = n;
    }

    /*
      Mackolik isimleri
      ↓
      Analiz sisteminin isimleri
    */

    add('ms1', source.ms1);
    add('ms0', source.ms0);
    add('ms0', source.msX);
    add('ms2', source.ms2);

    add('kgVar', source.kgVar);
    add('kgYok', source.kgYok);

    add('over25', source.over25);
    add('over25', source.au25Ust);

    add('under25', source.under25);
    add('under25', source.au25Alt);

    add('iy1', source.iy1);
    add('iy0', source.iy0);
    add('iy0', source.iyX);
    add('iy2', source.iy2);

    add('iyOver15', source.iyOver15);
    add('iyOver15', source.iy15Ust);

    add('iyUnder15', source.iyUnder15);
    add('iyUnder15', source.iy15Alt);

    add('iyOver05', source.iyOver05);

    return out;
  }

  function normalize(m) {

    const date =
      dateToISO(m.date) ||
      dateToISO(m.matchDate);

    const played = isPlayed(m);

    return {
      raw: m,

      code: String(
        m.code ||
        m.id ||
        m.matchCode ||
        ''
      ),

      date,

      time: String(
        m.time ||
        m.startTime ||
        ''
      ),

      league: String(
        m.league ||
        m.leagueName ||
        ''
      ),

      home: String(
        m.home ||
        m.homeTeam ||
        ''
      ),

      away: String(
        m.away ||
        m.awayTeam ||
        ''
      ),

      odds: oddsObject(m),

      scoreFT: getFT(m),

      scoreHT: getHT(m),

      played
    };
  }

  function getHistoricalPool() {

    return MATCHES.filter(m => {

      if (!m.played) return false;

      if (!m.date) return false;

      return m.date >= START_DATE;
    });
  }

  function cleanName(v) {

    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/fc|sc|cd|de|club|atletico|deportivo|fk|sk|sporting/g, '')
      .replace(/[^a-z0-9ğüşıöç]/g, '')
      .trim();
  }

  function teamMatch(a, b) {

    const x = cleanName(a);
    const y = cleanName(b);

    if (!x || !y) return false;

    if (x === y) return true;

    if (x.length > 3 && y.length > 3) {
      return x.includes(y) || y.includes(x);
    }

    return false;
  }

  function oddsSame(a, b) {

    return Math.abs(Number(a) - Number(b)) < 0.0001;
  }

  function historicalByOdds(match, key) {

    const value = match.odds[key];

    if (!Number.isFinite(value)) {
      return [];
    }

    return HISTORICAL.filter(h => {

      if (!h.odds) return false;

      const hv = h.odds[key];

      if (!Number.isFinite(hv)) return false;

      return oddsSame(hv, value);
    });
  }

  function resultStat(list, result) {

    let total = 0;
    let success = 0;

    for (const h of list) {

      const ft = h.scoreFT;

      if (!ft) continue;

      const ht = h.scoreHT;

      const ok = result.test(ft, ht);

      if (ok == null) continue;

      total++;

      if (ok) success++;
    }

    if (!total) return null;

    return {
      total,
      success,
      rate: success / total * 100
    };
  }

  function getOddForResult(match, result) {

    for (const key of result.keys) {

      if (Number.isFinite(match.odds[key])) {
        return {
          key,
          value: match.odds[key]
        };
      }
    }

    return null;
  }

  function analyzeEach(match, minRate, minSample, minOdd) {

    const output = [];

    for (const result of RES) {

      const odd = getOddForResult(match, result);

      if (!odd) continue;

      if (odd.value < minOdd) continue;

      const historical = historicalByOdds(match, odd.key);

      const stat = resultStat(historical, result);

      if (!stat) continue;

      if (stat.total < minSample) continue;

      if (stat.rate < minRate) continue;

      output.push({
        result: result.label,
        odd: odd.value,
        rate: stat.rate,
        total: stat.total,
        success: stat.success,
        key: odd.key
      });
    }

    return output.sort((a, b) => {

      if (b.rate !== a.rate) {
        return b.rate - a.rate;
      }

      return b.total - a.total;
    });
  }

  function analyzeNoOdds(match, basis, minRate, minSample) {

    let pool = [];

    if (basis === 'league') {

      pool = HISTORICAL.filter(h =>
        h.league &&
        match.league &&
        h.league === match.league
      );

    } else if (basis === 'team') {

      pool = HISTORICAL.filter(h => {

        const homeMatch =
          teamMatch(h.home, match.home) ||
          teamMatch(h.away, match.home);

        const awayMatch =
          teamMatch(h.home, match.away) ||
          teamMatch(h.away, match.away);

        return homeMatch || awayMatch;
      });

    } else {

      pool = HISTORICAL.slice();
    }

    const output = [];

    for (const result of RES) {

      const stat = resultStat(pool, result);

      if (!stat) continue;

      if (stat.total < minSample) continue;

      if (stat.rate < minRate) continue;

      output.push({
        result: result.label,
        odd: null,
        rate: stat.rate,
        total: stat.total,
        success: stat.success,
        key: null
      });
    }

    return output.sort((a, b) => b.rate - a.rate);
  }

  function analyzeCombined(match, basis, minRate, minSample, minOdd) {

    const keys = basis.split(',').map(x => x.trim());

    let pool = HISTORICAL.filter(h => {

      for (const key of keys) {

        const current = match.odds[key];

        if (!Number.isFinite(current)) {
          return false;
        }

        const old = h.odds[key];

        if (!Number.isFinite(old)) {
          return false;
        }

        if (!oddsSame(current, old)) {
          return false;
        }
      }

      return true;
    });

    const output = [];

    for (const result of RES) {

      const odd = getOddForResult(match, result);

      if (odd && odd.value < minOdd) continue;

      const stat = resultStat(pool, result);

      if (!stat) continue;

      if (stat.total < minSample) continue;

      if (stat.rate < minRate) continue;

      output.push({
        result: result.label,
        odd: odd ? odd.value : null,
        rate: stat.rate,
        total: stat.total,
        success: stat.success,
        key: odd ? odd.key : null
      });
    }

    return output.sort((a, b) => b.rate - a.rate);
  }

  function analyze(match) {

    const minRate = Math.max(
      0,
      Math.min(100, number($('tdThr').value) || 70)
    );

    const minSample = Math.max(
      1,
      Math.floor(number($('tdMin').value) || 5)
    );

    const minOdd = Math.max(
      1,
      number($('tdOdd').value) || 1.4
    );

    const basis = $('tdBasis').value;

    if (basis === 'each') {

      return analyzeEach(
        match,
        minRate,
        minSample,
        minOdd
      );
    }

    if (
      basis === 'league' ||
      basis === 'team' ||
      basis === 'all'
    ) {

      return analyzeNoOdds(
        match,
        basis,
        minRate,
        minSample
      );
    }

    return analyzeCombined(
      match,
      basis,
      minRate,
      minSample,
      minOdd
    );
  }

  function rateClass(rate) {

    if (rate >= 80) return 'very-high';

    if (rate >= 70) return 'high';

    if (rate >= 60) return 'medium';

    return 'low';
  }

  function predictionHTML(p) {

    const rate = Number(p.rate.toFixed(1));

    return `
      <div class="prediction">

        <div class="prediction-top">

          <div class="prediction-name">
            ${esc(p.result)}
            ${
              p.odd != null
                ? `<div class="odd">Oran: ${p.odd.toFixed(2)}</div>`
                : ''
            }
          </div>

          <div class="rate">
            %${rate}
          </div>

        </div>

        <div class="bar">
          <div style="width:${Math.min(100, rate)}%"></div>
        </div>

        <div class="detail">
          ${p.success} başarılı / ${p.total} geçmiş maç
        </div>

      </div>
    `;
  }

  function matchHTML(match, predictions) {

    const score =
      match.played && match.scoreFT
        ? `${match.scoreFT[0]} - ${match.scoreFT[1]}`
        : 'Oynanmadı';

    return `
      <div class="match">

        <div class="match-head">

          <div class="league">
            ${esc(match.league || 'Lig bilgisi yok')}
          </div>

          <div class="time">
            ${esc(match.time || '--:--')}
          </div>

        </div>

        <div class="match-body">

          <div class="teams">

            <div class="team">
              ${esc(match.home)}
            </div>

            <div class="vs">
              VS
            </div>

            <div class="team away">
              ${esc(match.away)}
            </div>

          </div>

          <div class="score">
            ${score}
          </div>

          <div class="predictions">
            ${predictions.map(predictionHTML).join('')}
          </div>

        </div>

      </div>
    `;
  }

  function dates() {

    const set = new Set();

    MATCHES.forEach(m => {

      if (m.date) {
        set.add(m.date);
      }

    });

    return Array.from(set).sort();
  }

  function fillDates() {

    const select = $('tdDate');

    const allDates = dates();

    const today = todayISO();

    select.innerHTML = '';

    for (const date of allDates) {

      const option = document.createElement('option');

      option.value = date;
      option.textContent = formatDate(date);

      if (date === today) {
        option.selected = true;
      }

      select.appendChild(option);
    }

    if (!select.value && allDates.length) {

      const future =
        allDates.find(d => d >= today);

      select.value =
        future || allDates[allDates.length - 1];
    }
  }

  function render() {

    const date = $('tdDate').value;

    const onlyIdeal = $('tdOnly').checked;
    const showAll = $('tdAll').checked;

    TODAY = MATCHES
      .filter(m =>
        m.date === date &&
        !m.played
      )
      .sort((a, b) =>
        String(a.time).localeCompare(String(b.time))
      );

    const container = $('tdResults');

    if (!TODAY.length) {

      container.innerHTML = `
        <div class="empty">
          ${formatDate(date)} tarihinde oynanmamış maç bulunamadı.
        </div>
      `;

      $('tdStatus').textContent =
        `${formatDate(date)} • 0 maç`;

      return;
    }

    let html = '';

    let shown = 0;

    for (const match of TODAY) {

      const predictions = analyze(match);

      if (onlyIdeal && predictions.length === 0) {
        continue;
      }

      if (!showAll && predictions.length === 0) {
        continue;
      }

      html += matchHTML(
        match,
        predictions
      );

      shown++;
    }

    if (!shown) {

      container.innerHTML = `
        <div class="empty">
          Seçilen kriterlere uygun tahmin bulunan maç yok.
        </div>
      `;

    } else {

      container.innerHTML = html;
    }

    $('tdStatus').textContent =
      `${formatDate(date)} • ${shown} maç gösteriliyor • ${HISTORICAL.length} geçmiş maç analiz edildi`;
  }

  async function load() {

    $('tdStatus').textContent =
      'Mackolik verileri yükleniyor...';

    try {

      const response = await fetch(
        DATA_URL + '?v=' + Date.now(),
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(
          'Veri dosyası yüklenemedi: HTTP ' +
          response.status
        );
      }

      const data = await response.json();

      RAW = Array.isArray(data)
        ? data
        : Array.isArray(data.matches)
          ? data.matches
          : [];

      MATCHES = RAW
        .map(normalize)
        .filter(m =>
          m.date &&
          m.home &&
          m.away
        );

      HISTORICAL =
        getHistoricalPool();

      fillDates();

      render();

    } catch (error) {

      console.error(error);

      $('tdStatus').textContent =
        'Veri yüklenirken hata oluştu.';

      $('tdResults').innerHTML = `
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

  $('tdAnalyze').addEventListener(
    'click',
    render
  );

  $('tdRefresh').addEventListener(
    'click',
    load
  );

  $('tdDate').addEventListener(
    'change',
    render
  );

  $('tdBasis').addEventListener(
    'change',
    render
  );

  $('tdThr').addEventListener(
    'change',
    render
  );

  $('tdMin').addEventListener(
    'change',
    render
  );

  $('tdOdd').addEventListener(
    'change',
    render
  );

  $('tdOnly').addEventListener(
    'change',
    render
  );

  $('tdAll').addEventListener(
    'change',
    render
  );

  load();

})();
