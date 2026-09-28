```js
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
  value === null || value === undefined || value === ''
    ? '—'
    : Number(value).toFixed(2);

const score = (value) =>
  value?.home != null || value?.away != null
    ? `${value.home ?? '-'} - ${value.away ?? '-'}`
    : '—';

const sortKey = (match) => {
  const [day, month, year] = String(match.date ?? '').split('.');
  return `${year ?? ''}-${month ?? ''}-${day ?? ''} ${match.time ?? ''} ${match.code ?? ''}`;
};


/* =========================================================
   TARİHİ NORMALLEŞTİR
   28.09.2026
   2026-09-28
   28/09/2026
   gibi formatları aynı hale getirir.
========================================================= */

function normalizeDate(value) {
  if (!value) return '';

  const str = String(value).trim();

  let day, month, year;

  // 28.09.2026 / 28/09/2026 / 28-09-2026
  let m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

  if (m) {
    day = m[1].padStart(2, '0');
    month = m[2].padStart(2, '0');
    year = m[3];

    return `${day}.${month}.${year}`;
  }

  // 2026-09-28
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (m) {
    year = m[1];
    month = m[2].padStart(2, '0');
    day = m[3].padStart(2, '0');

    return `${day}.${month}.${year}`;
  }

  return str;
}


/* =========================================================
   TÜRKİYE SAATİNE GÖRE BUGÜN
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
   TARİHİ SIRALA
========================================================= */

function dateToNumber(value) {
  const normalized = normalizeDate(value);
  const [day, month, year] = normalized.split('.').map(Number);

  if (!day || !month || !year) return 0;

  return new Date(year, month - 1, day).getTime();
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
        (
          !state.filters.date ||
          normalizeDate(match.date) === state.filters.date
        ) &&
        (
          !state.filters.league ||
          match.league === state.filters.league
        ) &&
        (
          !state.filters.unplayed ||
          (!match.score?.home && !match.score?.away)
        )
      );
    })
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
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

  const dates = [
    ...new Set(
      state.matches
        .map(m => normalizeDate(m.date))
        .filter(Boolean)
    )
  ].sort((a, b) => dateToNumber(a) - dateToNumber(b));


  const leagues = [
    ...new Set(
      state.matches
        .map(m => m.league)
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, 'tr')
  );


  const dateFilter = $('dateFilter');


  /* Tarih listesini oluştur */

  dateFilter.innerHTML =
    `<option value="">Tüm tarihler</option>` +
    dates.map(date =>
      `<option value="${esc(date)}">${esc(date)}</option>`
    ).join('');


  /* Lig listesini oluştur */

  $('leagueFilter').innerHTML =
    `<option value="">Tüm ligler</option>` +
    leagues.map(league =>
      `<option value="${esc(league)}">${esc(league)}</option>`
    ).join('');


  /* =======================================================
     EN ÖNEMLİ KISIM:
     İLK AÇILIŞTA BUGÜNÜ OTOMATİK SEÇ
  ======================================================= */

  const today = getTodayTR();

  console.log('Bugünün tarihi:', today);
  console.log('Verideki tarihler:', dates);


  if (dates.includes(today)) {

    state.filters.date = today;

    dateFilter.value = today;

  } else {

    /*
      Eğer veri farklı formatta geldiyse
      tekrar kontrol et.
    */

    const todayMatch = state.matches.find(match =>
      normalizeDate(match.date) === today
    );

    if (todayMatch) {

      state.filters.date = today;

      dateFilter.value = today;

    } else {

      /*
        Bugünün verisi gerçekten yoksa
        tüm tarihler gösterilir.
      */

      state.filters.date = '';

      dateFilter.value = '';
    }
  }
}


/* =========================================================
   FİLTRE EVENTLERİ
========================================================= */

$('search').addEventListener('input', event => {
  state.filters.search = event.target.value;
  render();
});


$('dateFilter').addEventListener('change', event => {
  state.filters.date = event.target.value;
  render();
});


$('leagueFilter').addEventListener('change', event => {
  state.filters.league = event.target.value;
  render();
});


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
      `Veri dosyası yüklenemedi: ${response.status}`
    );
  }


  const data = await response.json();


  state.matches = data.matches ?? [];


  $('updatedAt').textContent =
    data.updatedAt
      ? `Son güncelleme: ${new Date(data.updatedAt).toLocaleString('tr-TR')}`
      : 'Henüz veri yok';


  fillFilters();


  render();


} catch (error) {

  $('message').textContent =
    'Veri yüklenemedi. GitHub Actions çalıştırılmış mı kontrol edin.';

  console.error(error);
}
```
