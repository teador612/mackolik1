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

const odd = value => {
  if (value == null || value === '' || Number(value) <= 0) {
    return '—';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(2)
    : '—';
};

const score = value => {
  if (
    value &&
    value.home !== '' &&
    value.home != null &&
    value.away !== '' &&
    value.away != null
  ) {
    return `${value.home} - ${value.away}`;
  }

  return '—';
};


/* =========================================================
   TARİH KARŞILAŞTIRMA
   Bugünün tarihini DD.MM.YYYY olarak üretir
========================================================= */

function todayTR() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return `${day}.${month}.${year}`;
}


/* =========================================================
   MAÇLARI FİLTRELE
========================================================= */

function filteredMatches() {
  const q = state.filters.search
    .toLocaleLowerCase('tr-TR');

  return state.matches
    .filter(m => {

      const text = `
        ${m.home ?? ''}
        ${m.away ?? ''}
        ${m.code ?? ''}
      `.toLocaleLowerCase('tr-TR');

      return (
        (!q || text.includes(q)) &&

        (!state.filters.date ||
          m.date === state.filters.date) &&

        (!state.filters.league ||
          m.league === state.filters.league) &&

        (
          !state.filters.unplayed ||
          (
            m.score?.home == null &&
            m.score?.away == null
          )
        )
      );
    })
    .sort((a, b) => {

      const key = m => {
        const [day, month, year] =
          String(m.date ?? '').split('.');

        return (
          `${year ?? ''}-${month ?? ''}-${day ?? ''} ` +
          `${m.time ?? ''} ` +
          `${m.code ?? ''}`
        );
      };

      return key(a).localeCompare(key(b));
    });
}


/* =========================================================
   EKRANI OLUŞTUR
========================================================= */

function render() {
  const rows = filteredMatches();

  const message = $('message');
  const matches = $('matches');

  if (message) {
    message.textContent =
      `${rows.length} maç gösteriliyor.`;
  }

  if (!matches) {
    return;
  }

  matches.innerHTML = rows.map(m => {

    const o = m.openingOdds ?? {};

    return `
      <tr>
        <td>${esc(m.date)}</td>
        <td>${esc(m.time ?? '—')}</td>
        <td>${esc(m.league)}</td>
        <td>${esc(m.code)}</td>
        <td>${esc(m.home)}</td>
        <td>${esc(m.away)}</td>

        <td>
          ${esc(score(m.halfTimeScore))}
        </td>

        <td class="score">
          ${esc(score(m.score))}
        </td>

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

  const dateFilter = $('dateFilter');
  const leagueFilter = $('leagueFilter');

  if (!dateFilter || !leagueFilter) {
    return;
  }


  /* ---------- TARİHLER ---------- */

  const dates = [
    ...new Set(
      state.matches
        .map(m => m.date)
        .filter(Boolean)
    )
  ].sort((a, b) => {

    const parse = value => {
      const [d, m, y] = value.split('.');
      return `${y}-${m}-${d}`;
    };

    return parse(a).localeCompare(parse(b));
  });


  /* ---------- LİGLER ---------- */

  const leagues = [
    ...new Set(
      state.matches
        .map(m => m.league)
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, 'tr')
  );


  /* ---------- TARİH SELECT ---------- */

  dateFilter.innerHTML =
    `<option value="">Tüm tarihler</option>` +
    dates
      .map(date =>
        `<option value="${esc(date)}">${esc(date)}</option>`
      )
      .join('');


  /* ---------- LİG SELECT ---------- */

  leagueFilter.innerHTML =
    `<option value="">Tüm ligler</option>` +
    leagues
      .map(league =>
        `<option value="${esc(league)}">${esc(league)}</option>`
      )
      .join('');


  /* =======================================================
     BUGÜNÜ OTOMATİK SEÇ
  ======================================================= */

  const today = todayTR();

  if (dates.includes(today)) {

    state.filters.date = today;

    dateFilter.value = today;

  } else {

    /*
      Eğer bugünün tarihi veri içinde yoksa
      tüm tarihleri göster.
    */

    state.filters.date = '';

    dateFilter.value = '';
  }
}


/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {

  const search = $('search');
  const dateFilter = $('dateFilter');
  const leagueFilter = $('leagueFilter');
  const unplayedOnly = $('unplayedOnly');


  if (search) {
    search.addEventListener('input', event => {

      state.filters.search =
        event.target.value;

      render();
    });
  }


  if (dateFilter) {
    dateFilter.addEventListener('change', event => {

      state.filters.date =
        event.target.value;

      render();
    });
  }


  if (leagueFilter) {
    leagueFilter.addEventListener('change', event => {

      state.filters.league =
        event.target.value;

      render();
    });
  }


  if (unplayedOnly) {
    unplayedOnly.addEventListener('change', event => {

      state.filters.unplayed =
        event.target.checked;

      render();
    });
  }
}


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

async function loadData() {

  try {

    const message = $('message');

    if (message) {
      message.textContent =
        'Veriler yükleniyor…';
    }


    const url =
      new URL(
        './data/matches.json',
        document.baseURI
      );

    /*
      GitHub Pages cache problemlerini azaltır.
    */

    url.searchParams.set(
      '_',
      Date.now()
    );


    const response =
      await fetch(
        url.href,
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


    if (
      !data ||
      !Array.isArray(data.matches)
    ) {

      throw new Error(
        'matches verisi bulunamadı'
      );
    }


    /* ---------- VERİYİ STATE'E AL ---------- */

    state.matches =
      data.matches;


    /* ---------- SON GÜNCELLEME ---------- */

    const updatedAt =
      $('updatedAt');

    if (updatedAt) {

      updatedAt.textContent =
        data.updatedAt
          ? `Son güncelleme: ${
              new Date(
                data.updatedAt
              ).toLocaleString('tr-TR')
            }`
          : 'Henüz veri yok';
    }


    /* ---------- FİLTRELER ---------- */

    fillFilters();


    /* ---------- EKRANI ÇİZ ---------- */

    render();


  } catch (error) {

    console.error(
      'Veri yükleme hatası:',
      error
    );


    const matches =
      $('matches');

    const message =
      $('message');

    const updatedAt =
      $('updatedAt');


    if (matches) {
      matches.innerHTML = '';
    }


    if (message) {

      message.textContent =
        `Veri yüklenemedi: ${error.message}`;
    }


    if (updatedAt) {

      updatedAt.textContent =
        'Veri bağlantısı başarısız';
    }
  }
}


/* =========================================================
   BAŞLAT
========================================================= */

setupEvents();
loadData();
