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

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

const odd = value =>
  value === null || value === undefined || value === ''
    ? '—'
    : Number(value).toFixed(2);

const score = value =>
  value?.home != null || value?.away != null
    ? `${value.home ?? '-'} - ${value.away ?? '-'}`
    : '—';


/* =========================================================
   TARİHİ SAYISAL DEĞERE ÇEVİR
   24.09.2026 -> timestamp
========================================================= */

function dateValue(date) {
  if (!date) return 0;

  const parts = String(date).split('.');

  if (parts.length !== 3) return 0;

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (!day || !month || !year) return 0;

  return new Date(year, month - 1, day).getTime();
}


/* =========================================================
   BUGÜNÜ TÜRKİYE SAATİNE GÖRE AL
========================================================= */

function getTodayTR() {
  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(new Date());

  const day = parts.find(x => x.type === 'day')?.value;
  const month = parts.find(x => x.type === 'month')?.value;
  const year = parts.find(x => x.type === 'year')?.value;

  return `${day}.${month}.${year}`;
}


/* =========================================================
   FİLTRELENMİŞ MAÇLAR
========================================================= */

function filteredMatches() {
  const q = state.filters.search.toLocaleLowerCase('tr-TR');

  return state.matches
    .filter(match => {

      const text =
        `${match.home ?? ''} ${match.away ?? ''} ${match.code ?? ''}`
          .toLocaleLowerCase('tr-TR');

      return (
        (!q || text.includes(q)) &&
        (!state.filters.date || match.date === state.filters.date) &&
        (!state.filters.league || match.league === state.filters.league) &&
        (
          !state.filters.unplayed ||
          (!match.score?.home && !match.score?.away)
        )
      );
    })
    .sort((a, b) => {

      const dateDiff =
        dateValue(a.date) - dateValue(b.date);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return String(a.time ?? '')
        .localeCompare(String(b.time ?? ''));
    });
}


/* =========================================================
   TABLOYU OLUŞTUR
========================================================= */

function render() {

  const rows = filteredMatches();

  $('message').textContent =
    `${rows.length} maç gösteriliyor.`;

  $('matches').innerHTML = rows.map(match => {

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
   FİLTRELERİ DOLDUR
========================================================= */

function fillFilters() {

  /* -------------------------
     TARİHLER
  ------------------------- */

  const dates = [
    ...new Set(
      state.matches
        .map(match => match.date)
        .filter(Boolean)
    )
  ].sort((a, b) => dateValue(a) - dateValue(b));


  /* -------------------------
     LİGLER
  ------------------------- */

  const leagues = [
    ...new Set(
      state.matches
        .map(match => match.league)
        .filter(Boolean)
    )
  ].sort((a, b) =>
    String(a).localeCompare(String(b), 'tr')
  );


  /* -------------------------
     TARİH SELECT
  ------------------------- */

  const dateFilter = $('dateFilter');

  dateFilter.innerHTML =
    `<option value="">Tüm tarihler</option>` +
    dates.map(date =>
      `<option value="${esc(date)}">${esc(date)}</option>`
    ).join('');


  /* -------------------------
     LİG SELECT
  ------------------------- */

  $('leagueFilter').innerHTML =
    `<option value="">Tüm ligler</option>` +
    leagues.map(league =>
      `<option value="${esc(league)}">${esc(league)}</option>`
    ).join('');


  /* =======================================================
     İLK AÇILIŞTA TARİH SEÇİMİ
  ======================================================= */

  const today = getTodayTR();


  /*
     1. Önce doğrudan bugünü ara
  */

  if (dates.includes(today)) {

    state.filters.date = today;
    dateFilter.value = today;

    return;
  }


  /*
     2. Bugün yoksa bugüne en yakın tarihi bul
  */

  if (dates.length > 0) {

    const todayTime = dateValue(today);

    let closestDate = dates[0];
    let closestDifference =
      Math.abs(dateValue(dates[0]) - todayTime);

    for (const date of dates) {

      const difference =
        Math.abs(dateValue(date) - todayTime);

      if (difference < closestDifference) {

        closestDifference = difference;
        closestDate = date;
      }
    }

    state.filters.date = closestDate;
    dateFilter.value = closestDate;

  } else {

    state.filters.date = '';
    dateFilter.value = '';
  }
}


/* =========================================================
   ARAMA
========================================================= */

$('search').addEventListener('input', event => {

  state.filters.search = event.target.value;

  render();

});


/* =========================================================
   TARİH
========================================================= */

$('dateFilter').addEventListener('change', event => {

  state.filters.date = event.target.value;

  render();

});


/* =========================================================
   LİG
========================================================= */

$('leagueFilter').addEventListener('change', event => {

  state.filters.league = event.target.value;

  render();

});


/* =========================================================
   OYNANMAMIŞLAR
========================================================= */

$('unplayedOnly').addEventListener('change', event => {

  state.filters.unplayed = event.target.checked;

  render();

});


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

try {

  const response = await fetch(
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


  const data = await response.json();


  state.matches =
    Array.isArray(data.matches)
      ? data.matches
      : [];


  /* -------------------------
     SON GÜNCELLEME
  ------------------------- */

  $('updatedAt').textContent =
    data.updatedAt
      ? `Son güncelleme: ${
          new Date(data.updatedAt).toLocaleString('tr-TR')
        }`
      : 'Henüz veri yok';


  /* -------------------------
     FİLTRELER
  ------------------------- */

  fillFilters();


  /* -------------------------
     TABLO
  ------------------------- */

  render();


} catch (error) {

  $('message').textContent =
    'Veri yüklenemedi. GitHub Actions çalıştırılmış mı kontrol edin.';

  console.error(error);

}
```
