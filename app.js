const state = {
  matches: [],
  filters: {
    search: '',
    date: '',
    league: '',
    unplayed: false
  }
};

const $ = id => document.getElementById(id);


/* =========================================================
   HTML ESCAPE
========================================================= */

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));


/* =========================================================
   ORAN
========================================================= */

const odd = value => {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : '—';
};


/* =========================================================
   SKOR
========================================================= */

const score = value => {

  if (!value) {
    return '—';
  }

  if (
    value.home !== undefined &&
    value.home !== null &&
    value.home !== ''
  ) {
    return `${value.home ?? '-'} - ${value.away ?? '-'}`;
  }

  return '—';
};


/* =========================================================
   TARİHİ SAYIYA ÇEVİR
========================================================= */

function dateNumber(date) {

  const parts =
    String(date ?? '').split('.');

  if (parts.length !== 3) {
    return 0;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (!day || !month || !year) {
    return 0;
  }

  return new Date(
    year,
    month - 1,
    day
  ).getTime();
}


/* =========================================================
   BUGÜN
========================================================= */

function todayString() {

  const now = new Date();

  return (
    String(now.getDate()).padStart(2, '0') +
    '.' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '.' +
    now.getFullYear()
  );
}


/* =========================================================
   MAÇLARI FİLTRELE
========================================================= */

function filteredMatches() {

  const q =
    state.filters.search
      .toLocaleLowerCase('tr-TR');

  return state.matches
    .filter(match => {

      const text =
        `${match.home ?? ''} ${match.away ?? ''} ${match.code ?? ''}`
          .toLocaleLowerCase('tr-TR');

      return (

        (!q || text.includes(q)) &&

        (
          !state.filters.date ||
          match.date === state.filters.date
        ) &&

        (
          !state.filters.league ||
          match.league === state.filters.league
        ) &&

        (
          !state.filters.unplayed ||
          (
            !match.score?.home &&
            !match.score?.away
          )
        )

      );

    })
    .sort((a, b) => {

      const dateDiff =
        dateNumber(a.date) -
        dateNumber(b.date);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return String(a.time ?? '')
        .localeCompare(String(b.time ?? ''));

    });
}


/* =========================================================
   TABLOYU ÇİZ
========================================================= */

function render() {

  const rows =
    filteredMatches();

  $('message').textContent =
    `${rows.length} maç gösteriliyor.`;

  $('matches').innerHTML =
    rows.map(match => {

      const o =
        match.openingOdds ?? {};

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
   FİLTRELERİ DOLDUR
========================================================= */

function fillFilters() {

  const dates = [
    ...new Set(
      state.matches
        .map(match => match.date)
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      dateNumber(a) -
      dateNumber(b)
  );


  const leagues = [
    ...new Set(
      state.matches
        .map(match => match.league)
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      String(a).localeCompare(
        String(b),
        'tr'
      )
  );


  const dateFilter =
    $('dateFilter');


  /* Tarihler */

  dateFilter.innerHTML =
    '<option value="">Tüm tarihler</option>' +

    dates.map(date =>
      `<option value="${esc(date)}">${esc(date)}</option>`
    ).join('');


  /* Ligler */

  $('leagueFilter').innerHTML =
    '<option value="">Tüm ligler</option>' +

    leagues.map(league =>
      `<option value="${esc(league)}">${esc(league)}</option>`
    ).join('');


  /*
     BUGÜNÜ BUL
  */

  const today =
    todayString();


  console.log(
    'BUGÜN =',
    today
  );

  console.log(
    'TARİHLER =',
    dates
  );


  /*
     BUGÜN VERİDE VARSA SEÇ
  */

  if (dates.includes(today)) {

    state.filters.date =
      today;

    dateFilter.value =
      today;

    return;
  }


  /*
     BUGÜN YOKSA EN YAKIN TARİHİ SEÇ
  */

  if (dates.length) {

    const todayTime =
      dateNumber(today);

    let closest =
      dates[0];

    let difference =
      Math.abs(
        dateNumber(closest) -
        todayTime
      );


    for (const date of dates) {

      const currentDifference =
        Math.abs(
          dateNumber(date) -
          todayTime
        );

      if (
        currentDifference <
        difference
      ) {

        closest =
          date;

        difference =
          currentDifference;
      }
    }


    state.filters.date =
      closest;

    dateFilter.value =
      closest;

  }

}


/* =========================================================
   OLAYLAR
========================================================= */

$('search').addEventListener(
  'input',
  event => {

    state.filters.search =
      event.target.value;

    render();

  }
);


$('dateFilter').addEventListener(
  'change',
  event => {

    state.filters.date =
      event.target.value;

    render();

  }
);


$('leagueFilter').addEventListener(
  'change',
  event => {

    state.filters.league =
      event.target.value;

    render();

  }
);


$('unplayedOnly').addEventListener(
  'change',
  event => {

    state.filters.unplayed =
      event.target.checked;

    render();

  }
);


/* =========================================================
   VERİYİ ÇEK
========================================================= */

try {

  const response =
    await fetch(
      'data/matches.json?v=' +
      Date.now(),
      {
        cache: 'no-store'
      }
    );


  if (!response.ok) {

    throw new Error(
      'HTTP ' +
      response.status
    );

  }


  const data =
    await response.json();


  state.matches =
    Array.isArray(data.matches)
      ? data.matches
      : [];


  $('updatedAt').textContent =
    data.updatedAt
      ? 'Son güncelleme: ' +
        new Date(
          data.updatedAt
        ).toLocaleString('tr-TR')
      : 'Henüz veri yok';


  /*
     ÖNCE TARİHLERİ DOLDUR
  */

  fillFilters();


  /*
     SONRA TABLOYU ÇİZ
  */

  render();


} catch (error) {

  console.error(error);

  $('message').textContent =
    'Veri yüklenemedi. GitHub Actions çalıştırılmış mı kontrol edin.';

}
```
