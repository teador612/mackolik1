const state = { matches: [], filters: { search: '', date: '', league: '', unplayed: false } };
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// 1. Data formatındaki virgüllü veya boş oranları güvenle basar
const odd = (value) => (value && value !== '' ? value : '—');

// ISO Tarih (YYYY-MM-DD) ve Saat sıralaması
const sortKey = (match) => `${match.date ?? ''} ${match.time ?? ''} ${match.code ?? ''}`;

function filteredMatches() {
  const q = state.filters.search.toLocaleLowerCase('tr-TR');
  return state.matches.filter(match => {
    const text = `${match.home} ${match.away} ${match.code}`.toLocaleLowerCase('tr-TR');
    
    // Oynanmamış maç kontrolü (played === false veya scoreFT boş)
    const isUnplayed = !match.played && !match.scoreFT;

    return (!q || text.includes(q)) &&
      (!state.filters.date || match.date === state.filters.date) &&
      (!state.filters.league || match.league === state.filters.league) &&
      (!state.filters.unplayed || isUnplayed);
  }).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

function render() {
  const rows = filteredMatches();
  $('message').textContent = `${rows.length} maç gösteriliyor.`;
  
  $('matches').innerHTML = rows.map(match => {
    const o = match.odds ?? {};
    return `<tr>
      <td>${esc(match.date)}</td>
      <td>${esc(match.time || '—')}</td>
      <td>${esc(match.league)}</td>
      <td>${esc(match.code)}</td>
      <td>${esc(match.home)}</td>
      <td>${esc(match.away)}</td>
      <td>${esc(match.scoreHT || '—')}</td>
      <td class="score">${esc(match.scoreFT || '—')}</td>
      <td>${odd(o.ms1)}</td>
      <td>${odd(o.ms0)}</td>
      <td>${odd(o.ms2)}</td>
      <td>${odd(o.kgVar)}</td>
      <td>${odd(o.kgYok)}</td>
      <td>${odd(o.under25)}</td>
      <td>${odd(o.over25)}</td>
    </tr>`;
  }).join('');
}

function fillFilters() {
  const dates = [...new Set(state.matches.map(m => m.date).filter(Boolean))].sort();
  const leagues = [...new Set(state.matches.map(m => m.league).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  $('dateFilter').innerHTML = '<option value="">Tüm tarihler</option>' + dates.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('leagueFilter').innerHTML = '<option value="">Tüm ligler</option>' + leagues.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

for (const [id, key] of [['search', 'search'], ['dateFilter', 'date'], ['leagueFilter', 'league']]) {
  $(id).addEventListener('input', event => { state.filters[key] = event.target.value; render(); });
}
$('unplayedOnly').addEventListener('change', event => { state.filters.unplayed = event.target.checked; render(); });

try {
  const response = await fetch('data/matches.json', { cache: 'no-store' });
  const data = await response.json();
  
  // JSON kökünde "matches" dizisi var mı kontrolü
  state.matches = data.matches ?? (Array.isArray(data) ? data : []);
  
  $('updatedAt').textContent = data.updatedAt ? `Son güncelleme: ${new Date(data.updatedAt).toLocaleString('tr-TR')}` : 'Henüz veri yok';
  fillFilters();
  render();
} catch (error) {
  $('message').textContent = 'Veri yüklenemedi. GitHub Actions çalıştırılmış mı kontrol edin.';
  console.error(error);
}
