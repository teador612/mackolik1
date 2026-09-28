let macVerileri = [];
const REFRESH_MS = 15 * 60 * 1000; // 15 Dakikada Bir Otomatik Yenileme

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  verileriYukle();

  // 15 Dakikada Bir Otomatik Veri Yenile
  setInterval(verileriYukle, REFRESH_MS);
});

function initEventListeners() {
  ['f-ms1', 'f-ms0', 'f-ms2', 'f-ust', 'f-kg'].forEach(id => {
    const select = document.getElementById(id);
    if (select) select.addEventListener('change', analizEt);
  });
}

function sekmeDegistir(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  if (tabName === 'gunun-maclari') {
    document.getElementById('tab-gunun-maclari').style.display = 'block';
    document.getElementById('btn-gunun-maclari').classList.add('active');
  } else {
    document.getElementById('tab-oran-analizi').style.display = 'block';
    document.getElementById('btn-oran-analizi').classList.add('active');
  }
}

// Repodaki JSON verisini çek
async function verileriYukle() {
  const statusBadge = document.getElementById('data-status');
  const possiblePaths = [
    './data/maclar.json',
    './data/bulten.json',
    './outputs/maclar.json',
    './outputs/bulten.json'
  ];

  let loaded = false;

  for (const path of possiblePaths) {
    try {
      const res = await fetch(`${path}?t=${new Date().getTime()}`);
      if (res.ok) {
        const rawData = await res.json();
        if (Array.isArray(rawData) && rawData.length > 0) {
          verileriIsle(rawData);
          statusBadge.innerText = 'Canlı Veri Aktif';
          statusBadge.style.background = '#15803d';
          loaded = true;
          break;
        }
      }
    } catch (e) {
      // Diğer yolu dener
    }
  }

  if (!loaded) {
    statusBadge.innerText = 'Veri Bağlantısı Bekleniyor';
    statusBadge.style.background = '#b45309';
  }

  const simdi = new Date();
  document.getElementById('last-update-time').innerText = 
    simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// Script'inizden gelen tüm olası kolon adlarını standart JSON objesine çevir
function verileriIsle(rawData) {
  macVerileri = rawData.map(row => {
    const msEv = parseScore(row.msEv ?? row['MS Ev'] ?? row.homeScore ?? row.ftHome);
    const msDep = parseScore(row.msDep ?? row['MS Dep'] ?? row.awayScore ?? row.ftAway);
    const iyEv = parseScore(row.iyEv ?? row['İY Ev'] ?? row.htHome);
    const iyDep = parseScore(row.iyDep ?? row['İY Dep'] ?? row.htAway);

    let durum = row.durum || row.status || row.statu || 'Oynanmadı';
    if (msEv !== null && msDep !== null && (durum === 'Oynanmadı' || !durum)) {
      durum = 'MS';
    }

    return {
      tarih: row.tarih || row.Tarih || row.date || 'Bugün',
      saat: row.saat || row.Saat || row.time || '--:--',
      lig: row.lig || row.Lig || row.league || 'Genel',
      ev: row.ev || row['Ev Sahibi'] || row.home || 'Ev',
      dep: row.dep || row['Deplasman'] || row.away || 'Dep',
      ms1: parseFloat(row.ms1 || row.MS1 || row['1'] || 0),
      ms0: parseFloat(row.ms0 || row.MSX || row.MS0 || row['X'] || 0),
      ms2: parseFloat(row.ms2 || row.MS2 || row['2'] || 0),
      ust: parseFloat(row.ust || row['2.5 Üst'] || row['2.5 U'] || row.over25 || 0),
      kg: parseFloat(row.kg || row['KG Var'] || row.btts || 0),
      iyEv: iyEv,
      iyDep: iyDep,
      msEv: msEv,
      msDep: msDep,
      durum: durum
    };
  });

  document.getElementById('total-matches-count').innerText = macVerileri.length;
  gununMaclariniYazdir();
  dropdownlariDoldur();
  analizEt();
}

function parseScore(val) {
  if (val === null || val === undefined || val === '') return null;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

// 1. Sekme: Günün Maçları ve Canlı Skorlar
function gununMaclariniYazdir() {
  const tbody = document.getElementById('gunun-maclari-body');
  tbody.innerHTML = '';

  if (macVerileri.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Listelenecek maç bulunamadı.</td></tr>';
    return;
  }

  macVerileri.forEach(m => {
    let skorText = '-';
    let durumBadge = '<span class="status-tag tag-normal">Başlamadı</span>';

    if (m.msEv !== null && m.msDep !== null) {
      let iyStr = (m.iyEv !== null && m.iyDep !== null) ? ` <small>(${m.iyEv}-${m.iyDep})</small>` : '';
      skorText = `<b>${m.msEv} - ${m.msDep}</b>${iyStr}`;

      if (m.durum === 'MS' || m.durum === 'Bitti') {
        durumBadge = '<span class="status-tag tag-ended">MS</span>';
      } else {
        durumBadge = `<span class="status-tag tag-live">Canlı (${m.durum})</span>`;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.saat}</td>
      <td><span class="league-badge">${m.lig}</span></td>
      <td><b>${m.ev}</b> - ${m.dep}</td>
      <td>${durumBadge}</td>
      <td><span class="score-badge">${skorText}</span></td>
      <td><small>${m.ms1 ? m.ms1.toFixed(2) : '-'} / ${m.ms0 ? m.ms0.toFixed(2) : '-'} / ${m.ms2 ? m.ms2.toFixed(2) : '-'}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// 2. Sekme: Dropdown ve Oran Kombinasyon Analizi
function dropdownlariDoldur() {
  const populate = (id, key) => {
    const select = document.getElementById(id);
    if (!select) return;

    const values = [...new Set(macVerileri.map(m => m[key]))].filter(v => v > 0).sort((a, b) => a - b);
    select.innerHTML = '<option value="">Tümü</option>';
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v.toFixed(2);
      select.appendChild(opt);
    });
  };

  populate('f-ms1', 'ms1');
  populate('f-ms0', 'ms0');
  populate('f-ms2', 'ms2');
  populate('f-ust', 'ust');
  populate('f-kg', 'kg');
}

function analizEt() {
  const f1 = document.getElementById('f-ms1').value;
  const f0 = document.getElementById('f-ms0').value;
  const f2 = document.getElementById('f-ms2').value;
  const fUst = document.getElementById('f-ust').value;
  const fKg = document.getElementById('f-kg').value;

  const eslesenler = macVerileri.filter(m => {
    if (f1 && String(m.ms1) !== String(f1)) return false;
    if (f0 && String(m.ms0) !== String(f0)) return false;
    if (f2 && String(m.ms2) !== String(f2)) return false;
    if (fUst && String(m.ust) !== String(fUst)) return false;
    if (fKg && String(m.kg) !== String(fKg)) return false;
    return true;
  });

  const total = eslesenler.length;
  document.getElementById('st-count').innerText = total;

  const tbody = document.getElementById('analiz-body');

  if (total === 0) {
    ['st-ms1', 'st-ms0', 'st-ms2', 'st-ust', 'st-kg'].forEach(id => {
      document.getElementById(id).innerText = '%0';
    });
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Seçilen oran kombinasyonuna uyan maç bulunamadı.</td></tr>';
    return;
  }

  let cMs1 = 0, cMs0 = 0, cMs2 = 0, cUst = 0, cKg = 0;

  eslesenler.forEach(m => {
    if (m.msEv > m.msDep) cMs1++;
    else if (m.msEv === m.msDep) cMs0++;
    else if (m.msEv < m.msDep) cMs2++;

    if ((m.msEv + m.msDep) > 2.5) cUst++;
    if (m.msEv > 0 && m.msDep > 0) cKg++;
  });

  document.getElementById('st-ms1').innerText = `%${((cMs1 / total) * 100).toFixed(1)}`;
  document.getElementById('st-ms0').innerText = `%${((cMs0 / total) * 100).toFixed(1)}`;
  document.getElementById('st-ms2').innerText = `%${((cMs2 / total) * 100).toFixed(1)}`;
  document.getElementById('st-ust').innerText = `%${((cUst / total) * 100).toFixed(1)}`;
  document.getElementById('st-kg').innerText = `%${((cKg / total) * 100).toFixed(1)}`;

  tbody.innerHTML = '';
  eslesenler.forEach(m => {
    let iyStr = (m.iyEv !== null && m.iyDep !== null) ? ` (${m.iyEv}-${m.iyDep})` : '';
    let msStr = (m.msEv !== null && m.msDep !== null) ? `${m.msEv} - ${m.msDep}${iyStr}` : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.tarih} ${m.saat}</td>
      <td><span class="league-badge">${m.lig}</span></td>
      <td><b>${m.ev}</b> - ${m.dep}</td>
      <td><small>${m.ms1 ? m.ms1.toFixed(2) : '-'} / ${m.ms0 ? m.ms0.toFixed(2) : '-'} / ${m.ms2 ? m.ms2.toFixed(2) : '-'}</small></td>
      <td><span class="score-badge">${msStr}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
