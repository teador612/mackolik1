const DATA_PATHS = [
  './data/maclar.json',
  './data/bulten.json',
  './outputs/maclar.json',
  './outputs/bulten.json'
];

let macVerileri = [];
const AUTO_REFRESH_MS = 15 * 60 * 1000; // 15 Dakika (milisaniye cinsinden)

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  otomatikVeriYukle();
  
  // 15 dakikada bir verileri otomatik yenile
  setInterval(() => {
    otomatikVeriYukle();
  }, AUTO_REFRESH_MS);
});

function initEventListeners() {
  ['f-ms1', 'f-ms0', 'f-ms2', 'f-ust', 'f-kg'].forEach(id => {
    document.getElementById(id).addEventListener('change', analizEt);
  });
}

// Sekme Değiştirme
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

// 15 dk bir çağrılan otomatik veri çekici
async function otomatikVeriYukle() {
  const statusBadge = document.getElementById('data-status');
  let loaded = false;

  for (const path of DATA_PATHS) {
    try {
      const response = await fetch(`${path}?v=${new Date().getTime()}`);
      if (response.ok) {
        const rawData = await response.json();
        processData(rawData);
        statusBadge.innerText = `Canlı Veri Aktif`;
        statusBadge.style.background = '#15803d';
        
        const simdi = new Date();
        document.getElementById('last-update-time').innerText = 
          simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        
        loaded = true;
        break;
      }
    } catch (e) {
      // Bir sonraki yolu dener
    }
  }

  if (!loaded) {
    statusBadge.innerText = 'Veri Çekilemedi';
    statusBadge.style.background = '#b91c1c';
  }
}

function processData(rawData) {
  macVerileri = rawData.map(row => {
    const msEv = row.msEv !== undefined ? row.msEv : row['MS Ev'];
    const msDep = row.msDep !== undefined ? row.msDep : row['MS Dep'];
    const durum = row.durum || row.Status || row.statu || (msEv !== null && msEv !== undefined ? 'MS' : 'Oynanmadı');

    return {
      tarih: row.tarih || row.Tarih || row.date || '-',
      saat: row.saat || row.Saat || row.time || '--:--',
      lig: row.lig || row.Lig || row.league || '-',
      ev: row.ev || row['Ev Sahibi'] || row.home || '-',
      dep: row.dep || row['Deplasman'] || row.away || '-',
      ms1: parseFloat(row.ms1 || row.MS1 || row['1'] || 0),
      ms0: parseFloat(row.ms0 || row.MSX || row.MS0 || row['X'] || 0),
      ms2: parseFloat(row.ms2 || row.MS2 || row['2'] || 0),
      ust: parseFloat(row.ust || row['2.5 Üst'] || row['2.5 U'] || 0),
      kg: parseFloat(row.kg || row['KG Var'] || 0),
      iyEv: row.iyEv !== undefined ? row.iyEv : row['İY Ev'],
      iyDep: row.iyDep !== undefined ? row.iyDep : row['İY Dep'],
      msEv: msEv,
      msDep: msDep,
      durum: durum // MS, Canlı, İY, Oynanmadı vb.
    };
  });

  document.getElementById('total-matches-count').innerText = macVerileri.length;
  gununMaclariniListele();
  dropdownlariDoldur();
  analizEt();
}

// 1. Sekme: Günün Maçları ve Canlı Skorlar
function gununMaclariniListele() {
  const tbody = document.getElementById('gunun-maclari-body');
  tbody.innerHTML = '';

  if (macVerileri.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Bugün için kayıtlı maç bulunamadı.</td></tr>';
    return;
  }

  macVerileri.forEach(m => {
    let skorMetni = '-';
    let durumBadge = '<span class="status-tag tag-normal">Başlamadı</span>';

    // Maç Başlamış veya Bitmişse Skorları Düzenle
    if (m.msEv !== null && m.msEv !== undefined && m.msDep !== null && m.msDep !== undefined) {
      skorMetni = `<b>${m.msEv} - ${m.msDep}</b>`;
      if (m.iyEv !== null && m.iyDep !== null) {
        skorMetni += ` <small>(${m.iyEv}-${m.iyDep})</small>`;
      }

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
      <td><span class="score-badge">${skorMetni}</span></td>
      <td><small>${m.ms1 ? m.ms1.toFixed(2) : '-'} / ${m.ms0 ? m.ms0.toFixed(2) : '-'} / ${m.ms2 ? m.ms2.toFixed(2) : '-'}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// 2. Sekme: Dropdown Doldurma ve Kombinasyon Analizi
function dropdownlariDoldur() {
  const populate = (id, key) => {
    const select = document.getElementById(id);
    const uniqueVals = [...new Set(macVerileri.map(m => m[key]))]
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    select.innerHTML = '<option value="">Tümü</option>';
    uniqueVals.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val.toFixed(2);
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
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Seçilen kombinasyona uygun maç bulunamadı.</td></tr>';
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.tarih}</td>
      <td><span class="league-badge">${m.lig}</span></td>
      <td><b>${m.ev}</b> - ${m.dep}</td>
      <td><small>${m.ms1 ? m.ms1.toFixed(2) : '-'} / ${m.ms0 ? m.ms0.toFixed(2) : '-'} / ${m.ms2 ? m.ms2.toFixed(2) : '-'}</small></td>
      <td><span class="score-badge">${m.msEv !== null ? m.msEv + ' - ' + m.msDep : '-'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
