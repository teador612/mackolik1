import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = `${SITE}/Genis-Iddaa-Programi`;
const outputDir = path.resolve('outputs');
const statePath = path.join(outputDir, 'mackolik_onceki_bulten.json');
const outputPath = path.join(outputDir, 'mackolik_bulten.xlsx');
const OPENING_FIELDS = [
  'Handikap', 'MS_1', 'MS_X', 'MS_2', 'CifteSans_1X', 'CifteSans_12', 'CifteSans_X2',
  'AU25_Alt', 'AU25_Ust', 'Handikap_1', 'Handikap_X', 'Handikap_2', 'KG_Var', 'KG_Yok',
  'IY15_Alt', 'IY15_Ust', 'AU15_Alt', 'AU15_Ust', 'AU35_Alt', 'AU35_Ust',
  'ToplamGol_01', 'ToplamGol_23', 'ToplamGol_46', 'ToplamGol_7', 'IY_1', 'IY_X', 'IY_2'
];

function parseJsLiteral(text) {
  // The site returns a JavaScript object literal rather than strict JSON.
  return vm.runInNewContext(`(${text.replace(/^\uFEFF/, '')})`, Object.create(null));
}

function odd(v) {
  if (v === '' || v === null || v === undefined || typeof v === 'object') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseDateText(s) {
  const [d, m, y] = String(s).split('.').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateKey(v) {
  const [d, m, y] = String(v).split('.').map(Number);
  return `${y ?? 0}-${String(m ?? 0).padStart(2, '0')}-${String(d ?? 0).padStart(2, '0')}`;
}

function flatten(payload, week) {
  const rows = [];
  for (const day of payload.m ?? []) {
    for (const r of day.m ?? []) {
      rows.push({
        Bülten: Number(week),
        AcilisZamani: null,
        Tarih: r[7] || day.d,
        Saat: r[6] ?? null,
        Kod: String(r[0]),
        Lig: r[26] ?? '',
        EvSahibi: r[1] ?? '',
        Misafir: r[3] ?? '',
        MBS: odd(r[13]),
        MS_1: odd(r[16]), MS_X: odd(r[17]), MS_2: odd(r[18]),
        CifteSans_1X: odd(r[19]), CifteSans_12: odd(r[20]), CifteSans_X2: odd(r[21]),
        AU25_Alt: odd(r[22]), AU25_Ust: odd(r[23]),
        Handikap: r[14] ?? '', Handikap_1: odd(r[36]), Handikap_X: odd(r[37]), Handikap_2: odd(r[38]),
        KG_Var: odd(r[39]), KG_Yok: odd(r[40]),
        IY15_Alt: odd(r[42]), IY15_Ust: odd(r[43]),
        AU15_Alt: odd(r[44]), AU15_Ust: odd(r[45]),
        AU35_Alt: odd(r[46]), AU35_Ust: odd(r[47]),
        ToplamGol_01: odd(r[29]), ToplamGol_23: odd(r[30]), ToplamGol_46: odd(r[31]), ToplamGol_7: odd(r[32]),
        IY_1: odd(r[33]), IY_X: odd(r[34]), IY_2: odd(r[35]),
        Durum: r[5] ?? 0,
      });
    }
  }
  rows.sort((a, b) => `${dateKey(a.Tarih)} ${a.Saat} ${a.Kod}`.localeCompare(`${dateKey(b.Tarih)} ${b.Saat} ${b.Kod}`));
  return rows;
}

async function getCurrentWeek() {
  const page = await (await fetch(PAGE)).text();
  const m = page.match(/currentWeek\s*=\s*"(\d+)"/);
  if (!m) throw new Error('Güncel bülten haftası bulunamadı.');
  return m[1];
}

async function fetchWeek(week) {
  const url = `${SITE}/AjaxHandlers/ProgramDataHandler.ashx?type=6&sortValue=DATE&day=-1&sort=-1&sortDir=-1&groupId=-1&np=1&sport=1`;
  const payload = parseJsLiteral(await (await fetch(url)).text());
  return flatten(payload, week);
}

function matrix(rows, headers, displayHeaders = headers) { return [displayHeaders, ...rows.map(r => headers.map(h => r[h] ?? null))]; }
function colName(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

async function makeWorkbook(allRows, newRows, week) {
  const wb = Workbook.create();
  const fresh = wb.worksheets.add('Yeni Maçlar');
  const all = wb.worksheets.add('Tüm Bülten');
  const notes = wb.worksheets.add('Açıklama');
  const headers = Object.keys(allRows[0] ?? {
    Bülten:'',AcilisZamani:'',Tarih:'',Saat:'',Kod:'',Lig:'',EvSahibi:'',Misafir:'',MBS:'',MS_1:'',MS_X:'',MS_2:'',CifteSans_1X:'',CifteSans_12:'',CifteSans_X2:'',AU25_Alt:'',AU25_Ust:'',Handikap:'',Handikap_1:'',Handikap_X:'',Handikap_2:'',KG_Var:'',KG_Yok:'',IY15_Alt:'',IY15_Ust:'',AU15_Alt:'',AU15_Ust:'',AU35_Alt:'',AU35_Ust:'',ToplamGol_01:'',ToplamGol_23:'',ToplamGol_46:'',ToplamGol_7:'',IY_1:'',IY_X:'',IY_2:'',Durum:''
  });
  const displayHeaders = headers.map(h => h === 'AcilisZamani' ? 'Açılış Zamanı' : OPENING_FIELDS.includes(h) ? `Açılış ${h}` : h);
  const source = '(Kaynak: Mackolik Geniş Ekran İddaa Programı, https://arsiv.mackolik.com/Genis-Iddaa-Programi)';
  fresh.getRange('A1').values = [['Yeni gelen maçlar']];
  fresh.getRange('A2').values = [[`Bülten haftası: ${week} | Yeni kayıt: ${newRows.length} | Çalışma zamanı: ${new Date().toISOString()}`]];
  fresh.getRange('A3').values = [[source]];
  const endCol = colName(headers.length);
  fresh.getRange(`A5:${endCol}${5 + newRows.length}`).values = matrix(newRows, headers, displayHeaders);
  all.getRange('A1').values = [['Güncel bülten']];
  all.getRange('A2').values = [[`Bülten haftası: ${week} | Toplam maç: ${allRows.length}`]];
  all.getRange('A3').values = [[source]];
  all.getRange(`A5:${endCol}${5 + allRows.length}`).values = matrix(allRows, headers, displayHeaders);
  notes.getRange('A1:B8').values = [
    ['Kullanım', 'Bu dosya salı gecesi yeni bülten çıktığında güncellenmek üzere hazırlanmıştır.'],
    ['Yeni Maçlar', 'Son çalıştırmada önceki bülten durum dosyasında bulunmayan maç kodlarını, ilk görülen oranlarıyla gösterir.'],
    ['Tüm Bülten', 'Güncel bültendeki maçlar. Oran sütunları maçın ilk görüldüğü açılış oranlarını korur.'],
    ['Açılış oranı kuralı', 'Bir maç kodu ilk kez görüldüğünde oranlar kaydedilir. Sonraki çalıştırmalarda değişen oranlar mevcut açılış oranlarının üzerine yazılmaz.'],
    ['Karşılaştırma anahtarı', 'Maç kodu (Kod sütunu).'],
    ['Otomatik güncelleme', 'calistir_mackolik.ps1 dosyasını salı gecesi Windows Görev Zamanlayıcı ile çalıştırabilirsiniz.'],
    ['Not', 'İlk çalıştırmada mevcut bülten başlangıç noktası kabul edilir; sonraki çalıştırmada gerçek yeni kayıtlar ayrışır.'],
    ['Kaynak', PAGE],
  ];
  for (const s of [fresh, all, notes]) { s.showGridLines = false; const used = s.getUsedRange(); if (used) used.format.font = { name: 'Arial', size: 10, color: '#222222' }; }
  for (const s of [fresh, all]) {
    s.getRange('A1').format = { font: { name: 'Arial', size: 14, bold: true, color: '#1F4E78' } };
    s.getRange(`A5:${endCol}5`).format = { fill: '#1F4E78', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' }, wrapText: true, verticalAlignment: 'center' };
    s.getRange(`A5:${endCol}5`).format.borders = { preset: 'outside', style: 'thin', color: '#1F4E78' };
    s.getRange(`A6:${endCol}5000`).format.verticalAlignment = 'center';
    s.getRange('A6:A5000').format.numberFormat = '@';
    s.getRange('D6:D5000').format.numberFormat = '@';
    s.getRange(`I6:${endCol}5000`).format.numberFormat = '0.00';
    s.freezePanes.freezeRows(5);
    s.freezePanes.freezeColumns(7);
    s.getUsedRange()?.format.autofitColumns();
    s.getRange('A:A').format.columnWidth = 12;
    s.getRange('B:B').format.columnWidth = 12;
    s.getRange('C:C').format.columnWidth = 9;
    s.getRange('D:D').format.columnWidth = 10;
    s.getRange('E:G').format.columnWidth = 18;
  }
  if (newRows.length) fresh.getRange(`A6:AJ${5 + newRows.length}`).conditionalFormats.add('expression', { formula: '=$D6<>""', format: { fill: '#E2F0D9' } });
  all.tables.add(`A5:${endCol}${5 + Math.max(1, allRows.length)}`, true, 'TumBultenTable');
  fresh.tables.add(`A5:${endCol}${5 + Math.max(1, newRows.length)}`, true, 'YeniMaclarTable');
  wb.recalculate();
  const preview = await wb.render({ sheetName: 'Yeni Maçlar', range: `A1:Q${Math.min(25, 6 + newRows.length)}`, scale: 1, format: 'png' });
  await fs.writeFile(path.join('work', 'mackolik_preview.png'), new Uint8Array(await preview.arrayBuffer()));
  const check = await wb.inspect({ kind: 'table', range: `Yeni Maçlar!A1:Q${Math.min(15, 6 + newRows.length)}`, include: 'values,formulas', tableMaxRows: 15, tableMaxCols: 17 });
  await fs.writeFile(path.join('work', 'mackolik_check.ndjson'), check.ndjson ?? String(check));
  const out = await SpreadsheetFile.exportXlsx(wb);
  await out.save(outputPath);
}

await fs.mkdir(outputDir, { recursive: true });
const week = await getCurrentWeek();
const fetchedRows = await fetchWeek(week);
let previous = [];
try { previous = JSON.parse(await fs.readFile(statePath, 'utf8')); } catch {}
const previousByCode = new Map(previous.map(r => [String(r.Kod), r]));
const runTime = new Date().toISOString();
const allRows = fetchedRows.map(current => {
  const old = previousByCode.get(String(current.Kod));
  if (!old) return { ...current, AcilisZamani: runTime };
  const merged = { ...current, AcilisZamani: old.AcilisZamani ?? 'Önceki kayıt' };
  for (const field of OPENING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(old, field)) {
      merged[field] = field === 'Handikap' ? old[field] : odd(old[field]);
    }
  }
  return merged;
});
const newRows = allRows.filter(r => !previousByCode.has(String(r.Kod)));
await makeWorkbook(allRows, newRows, week);
await fs.writeFile(statePath, JSON.stringify(allRows, null, 2), 'utf8');
console.log(JSON.stringify({ week, total: allRows.length, newCount: newRows.length, outputPath }, null, 2));
