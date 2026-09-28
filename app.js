const state = {
  matches: [],
  filters: {
    search: '',
    date: '',
    league: '',
    unplayed: false
  }
};

const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

const odd = (value) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toFixed(2);

const score = (value) =>
  value?.home || value?.away
    ? `${value.home ?? '-'} - ${value.away ?? '-'}`
    : '—';

const sortKey = (match) => {
  const [day, month, year] =
    String(match.date ?? '').split('.');

  return `${year ?? ''}-${month ?? ''}-${day ?? ''} ${match.time ?? ''} ${match.code ?? ''}`;
};


/* =========================================================
   MAÇLARI FİLTRELE
========================================================= */

function filteredMatches() {

  const q =
    state.filters.search.toLocaleLowerCase('tr-TR');

  return state.matches
    .filter(match => {

      const text =
        `${match.home ?? ''} ${match.away ?? ''} ${match.code ?? ''}`
          .toLocaleLowerCase('tr-TR');

      return (
        (!q || text.includes(q)) &&
        (!state.filters.date ||
          match.date === state.filters.date) &&
        (!state.filters.league ||
          match.league === state.filters.league) &&
        (!state.filters.unplayed ||
          (!match.score?.home &&
           !match.score?.away))
      );

    })
    .sort((a, b) =>
      sortKey(a).localeCompare(sortKey(b))
    );
}


/* =========================================================
   TABLOYU GÖSTER
========================================================= */

function render() {

  const rows = filteredMatches();

  $('message').textContent =
    `${rows.length} maç gösteriliyor.`;

  $('matches').innerHTML =
    rows.map(match => {

      const o = match.openingOdds ?? {};

      return `
        <tr>
          <td>${esc(match.date)}</td>
          <td>${esc(match.time ?? '—')}</td>
          <td>${esc(match.league)}</td>
          <td>${esc(match.code)}</td>
          <td>${esc(match.home)}</td>
          <td>${esc(match.away)}</td>
          <td>${esc(score(match.halfTimeScore))}</td>
          <td class="score">${esc(score(match.score))}</td>
          <td>${odd(o.ms1)}</td>
          <td>${odd(o.msX)}</td>
          <td>${odd(o.ms2)}</td>
          <td>${odd(o.kgVar)}</td>
          <td>${odd(o.kgYok)}</td>
          <td>${odd(o.au25Alt)}</td>
          <td>${odd(o.au25Ust)}</td>
        </tr>
      `;

    }).join('');
}


/* =========================================================
   BUGÜNÜ BUL
   ÖRNEK: 28.09.2026
========================================================= */

function getToday() {

  const now = new Date();

  const day =
    String(now.getDate()).padStart(2, '0');

  const month =
    String(now.getMonth() + 1).padStart(2, '0');

  const year =
    String(now.getFullYear());

  return `${day}.${month}.${year}`;
}


/* =========================================================
   FİLTRELERİ DOLDUR
========================================================= */

function fillFilters() {

  const dates = [
    ...new Set(
      state.matches
        .map(m => m.date)
        .filter(Boolean)
    )
  ].sort((a, b) => {

    const [ad, am, ay] =
      a.split('.').map(Number);

    const [bd, bm, by] =
      b.split('.').map(Number);

    return new Date(
      ay,
      am - 1,
      ad
    ) - new Date(
      by,
      bm - 1,
      bd
    );

  });


  const leagues = [
    ...new Set(
      state.matches
        .map(m => m.league)
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, 'tr')
  );


  /* =======================================================
     TARİH MENÜSÜ
  ======================================================= */

  const dateFilter = $('dateFilter');

  dateFilter.innerHTML =
    '<option value="">Tüm tarihler</option>' +
    dates.map(date =>
      `<option value="${esc(date)}">${esc(date)}</option>`
    ).join('');


  /* =======================================================
     LİG MENÜSÜ
  ======================================================= */

  $('leagueFilter').innerHTML =
    '<option value="">Tüm ligler</option>' +
    leagues.map(league =>
      `<option value="${esc(league)}">${esc(league)}</option>`
    ).join('');


  /* =======================================================
     BUGÜNÜ OTOMATİK SEÇ
  ======================================================= */

  const today = getToday();


  console.log('Bugün:', today);
  console.log('Verideki tarihler:', dates);


  if (dates.includes(today)) {

    state.filters.date = today;

    dateFilter.value = today;

  } else {

    /*
      Bugünün tarihi veride yoksa
      "Tüm tarihler" bırakılır.
    */

    state.filters.date = '';

    dateFilter.value = '';

  }
}


/* =========================================================
   ARAMA
========================================================= */

$('search').addEventListener(
  'input',
  event => {

    state.filters.search =
      event.target.value;

    render();

  }
);


/* =========================================================
   TARİH
========================================================= */

$('dateFilter').addEventListener(
  'change',
  event => {

    state.filters.date =
      event.target.value;

    render();

  }
);


/* =========================================================
   LİG
========================================================= */

$('leagueFilter').addEventListener(
  'change',
  event => {

    state.filters.league =
      event.target.value;

    render();

  }
);


/* =========================================================
   OYNANMAMIŞLAR
========================================================= */

$('unplayedOnly').addEventListener(
  'change',
  event => {

    state.filters.unplayed =
      event.target.checked;

    render();

  }
);


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

try {

  const response =
    await fetch(
      'data/matches.json',
      {
        cache: 'no-store'
      }
    );


  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }


  const data =
    await response.json();


  state.matches =
    data.matches ?? [];


  $('updatedAt').textContent =
    data.updatedAt
      ? `Son güncelleme: ${
          new Date(
            data.updatedAt
          ).toLocaleString('tr-TR')
        }`
      : 'Henüz veri yok';


  /* Önce filtreleri oluştur */
  fillFilters();


  /* Sonra tabloyu çiz */
  render();


} catch (error) {

  $('message').textContent =
    'Veri yüklenemedi. GitHub Actions çalıştırılmış mı kontrol edin.';

  console.error(error);

}
```
