import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = `${SITE}/Genis-Iddaa-Programi`;

const DATA_PATH = path.resolve('data/matches.json');
const ANALYSIS_PATH = path.resolve('data/analysis.json');

const MIN_SUCCESS = 70;
const MIN_SAMPLE = 5;

/* =========================================================
   ANALİZ EDİLECEK ORANLAR
========================================================= */

const TARGETS = [
  { key: 'ms1',      label: 'MS 1' },
  { key: 'msX',      label: 'MS X' },
  { key: 'ms2',      label: 'MS 2' },

  { key: 'kgVar',    label: 'KG Var' },
  { key: 'kgYok',    label: 'KG Yok' },

  { key: 'au15Ust',  label: '1,5 Üst' },
  { key: 'au15Alt',  label: '1,5 Alt' },

  { key: 'au25Ust',  label: '2,5 Üst' },
  { key: 'au25Alt',  label: '2,5 Alt' },

  { key: 'au35Ust',  label: '3,5 Üst' },
  { key: 'au35Alt',  label: '3,5 Alt' },

  { key: 'iy15Ust',  label: 'İY 1,5 Üst' },
  { key: 'iy15Alt',  label: 'İY 1,5 Alt' },

  { key: 'iy1',      label: 'İY 1' },
  { key: 'iyX',      label: 'İY X' },
  { key: 'iy2',      label: 'İY 2' }
];

/* =========================================================
   GENEL YARDIMCI FONKSİYONLAR
========================================================= */

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const n = Number(
    String(value)
      .replace(',', '.')
      .trim()
  );

  return Number.isFinite(n) ? n : null;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeTeamName(value) {
  return cleanText(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

/*
 * Aynı maç için Mackolik kodu değişse bile
 * bu anahtar sayesinde eski kayıt bulunur.
 */
function matchKey(match) {
  return [
    cleanText(match.date),
    cleanText(match.time),
    normalizeTeamName(match.home),
    normalizeTeamName(match.away)
  ].join('|');
}

function isOldCode(code) {
  return String(code ?? '').startsWith('OLD-');
}

function validScoreValue(value) {
  if (value === null || value === undefined || value === '') {
    return false;
  }

  return /^-?\d+$/.test(String(value).trim());
}

function isPlayed(match) {
  if (!match?.score) return false;

  return (
    validScoreValue(match.score.home) &&
    validScoreValue(match.score.away)
  );
}

function scoreNumbers(match) {
  if (!isPlayed(match)) return null;

  return {
    home: Number(match.score.home),
    away: Number(match.score.away)
  };
}

function halfTimeNumbers(match) {
  const ht = match?.halfTimeScore;

  if (!ht) return null;

  if (
    !validScoreValue(ht.home) ||
    !validScoreValue(ht.away)
  ) {
    return null;
  }

  return {
    home: Number(ht.home),
    away: Number(ht.away)
  };
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* =========================================================
   AÇILIŞ ORANLARI
========================================================= */

const OPENING_KEYS = [
  'ms1',
  'msX',
  'ms2',

  'cs1X',
  'cs12',
  'csX2',

  'au25Alt',
  'au25Ust',

  'handicap',
  'handicap1',
  'handicapX',
  'handicap2',

  'kgVar',
  'kgYok',

  'iy15Alt',
  'iy15Ust',

  'au15Alt',
  'au15Ust',

  'au35Alt',
  'au35Ust',

  'gol01',
  'gol23',
  'gol46',
  'gol7',

  'iy1',
  'iyX',
  'iy2'
];

function extractOpeningOdds(row) {
  const odds = {};

  /*
   * Mackolik veri satırında oranlar farklı kolonlarda
   * bulunabildiğinden mümkün olan alanları tarıyoruz.
   *
   * Sayısal oranları yakalayıp mevcut açılış yapısına
   * dönüştürüyoruz.
   */

  for (const key of OPENING_KEYS) {
    const value = row?.[key];

    const n = numberOrNull(value);

    if (n !== null) {
      odds[key] = n;
    }
  }

  return odds;
}

/* =========================================================
   MACKOLİK HAFTA
========================================================= */

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${url}`
    );
  }

  return await response.text();
}

async function getCurrentWeek() {
  const html = await fetchText(PAGE);

  const patterns = [
    /currentWeek\s*=\s*["']?(\d+)/i,
    /week\s*[:=]\s*["']?(\d+)/i,
    /Week\s*[:=]\s*["']?(\d+)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return String(match[1]);
    }
  }

  /*
   * Sayfadan bulunamazsa mevcut JSON'daki haftayı kullan.
   */
  try {
    const old = JSON.parse(
      await fs.readFile(DATA_PATH, 'utf8')
    );

    if (old?.week) {
      return String(old.week);
    }
  } catch {}

  throw new Error('Mackolik hafta numarası bulunamadı.');
}

/* =========================================================
   MACKOLİK VERİSİNİ ÇEK
========================================================= */

async function fetchMatches() {
  const week = await getCurrentWeek();

  const url =
    `${SITE}/AjaxHandlers/ProgramDataHandler.ashx` +
    `?type=6` +
    `&sortValue=DATE` +
    `&day=-1` +
    `&sort=-1` +
    `&sortDir=-1` +
    `&groupId=-1` +
    `&np=0` +
    `&sport=1`;

  const text = await fetchText(url);

  let payload;

  /*
   * Mackolik AJAX cevabı bazen JavaScript nesnesi
   * biçiminde geldiği için VM ile parse ediyoruz.
   */
  try {
    payload = JSON.parse(text);
  } catch {
    try {
      payload = vm.runInNewContext(`(${text})`);
    } catch (error) {
      throw new Error(
        `Mackolik veri parse edilemedi: ${error.message}`
      );
    }
  }

  let days = [];

  if (Array.isArray(payload)) {
    days = payload;
  } else if (Array.isArray(payload?.data)) {
    days = payload.data;
  } else if (Array.isArray(payload?.days)) {
    days = payload.days;
  } else if (Array.isArray(payload?.d)) {
    days = payload.d;
  }

  const matches = [];

  for (const day of days) {
    const rows =
      day?.matches ??
      day?.rows ??
      day?.data ??
      day?.m ??
      [];

    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      if (!Array.isArray(row)) continue;

      const code = cleanText(row[0]);

      if (!code) continue;

      const home = cleanText(row[1]);
      const away = cleanText(row[3]);

      if (!home || !away) continue;

      const status = row[5];

      const date =
        cleanText(row[7]) ||
        cleanText(day?.d) ||
        null;

      const time =
        cleanText(row[6]) ||
        null;

      /*
       * ÖNEMLİ:
       * Kullanılan mevcut veri yapısına göre
       * tam skor row[8] / row[9]
       * ilk yarı row[11] / row[12]
       */
      const fullHome =
        validScoreValue(row[8])
          ? String(row[8])
          : null;

      const fullAway =
        validScoreValue(row[9])
          ? String(row[9])
          : null;

      const htHome =
        validScoreValue(row[11])
          ? String(row[11])
          : null;

      const htAway =
        validScoreValue(row[12])
          ? String(row[12])
          : null;

      const openingOdds = extractOpeningOdds(row);

      /*
       * Lig bilgisi
       */
      const league =
        cleanText(row[26]) ||
        cleanText(row[25]) ||
        '';

      /*
       * MBS
       */
      const mbs =
        numberOrNull(row[27]) ??
        numberOrNull(row[28]) ??
        null;

      matches.push({
        code,
        week,
        date,
        time,
        league,
        home,
        away,
        mbs,
        status,
        score: {
          home: fullHome,
          away: fullAway
        },
        halfTimeScore: {
          home: htHome,
          away: htAway
        },
        openingOdds,
        openingRecordedAt: null
      });
    }
  }

  /*
   * Aynı kod birden fazla geldiyse tek kayıt bırak.
   */
  const byCode = new Map();

  for (const match of matches) {
    byCode.set(String(match.code), match);
  }

  return Array.from(byCode.values());
}

/* =========================================================
   ESKİ VERİYİ OKU
========================================================= */

async function loadPrevious() {
  try {
    const text = await fs.readFile(
      DATA_PATH,
      'utf8'
    );

    const data = JSON.parse(text);

    if (!Array.isArray(data?.matches)) {
      return {
        source: PAGE,
        week: null,
        updatedAt: null,
        matches: []
      };
    }

    return data;
  } catch {
    return {
      source: PAGE,
      week: null,
      updatedAt: null,
      matches: []
    };
  }
}

/* =========================================================
   AÇILIŞ ORANLARINI KORUYARAK BİRLEŞTİR
========================================================= */

function mergeOpeningOdds(oldMatch, currentMatch) {
  const oldOdds =
    oldMatch?.openingOdds &&
    typeof oldMatch.openingOdds === 'object'
      ? oldMatch.openingOdds
      : {};

  const currentOdds =
    currentMatch?.openingOdds &&
    typeof currentMatch.openingOdds === 'object'
      ? currentMatch.openingOdds
      : {};

  /*
   * Eski açılış oranları her zaman öncelikli.
   *
   * Böylece:
   *
   * Salı:
   * 1.50
   *
   * Sonraki gün:
   * 1.60
   *
   * sonuç:
   * 1.50
   */
  return {
    ...currentOdds,
    ...oldOdds
  };
}

function mergeMatch(oldMatch, currentMatch) {
  return {
    ...oldMatch,

    /*
     * Artık gerçek Mackolik kodu kullanılır.
     * OLD-... kodu taşınmaz.
     */
    code: currentMatch.code,

    week: currentMatch.week,
    date: currentMatch.date,
    time: currentMatch.time,
    league: currentMatch.league,
    home: currentMatch.home,
    away: currentMatch.away,
    mbs: currentMatch.mbs,

    /*
     * Canlı bilgiler güncellenir.
     */
    status: currentMatch.status,
    score: currentMatch.score,
    halfTimeScore: currentMatch.halfTimeScore,

    /*
     * AÇILIŞ ORANLARI KORUNUR.
     */
    openingOdds:
      mergeOpeningOdds(
        oldMatch,
        currentMatch
      ),

    openingRecordedAt:
      oldMatch?.openingRecordedAt ??
      currentMatch?.openingRecordedAt ??
      new Date().toISOString()
  };
}

/* =========================================================
   MAÇLARI BİRLEŞTİR
========================================================= */

function mergeMatches(previousMatches, currentMatches) {
  /*
   * Önce eski kayıtları indexle.
   */
  const previousByCode = new Map();
  const previousByKey = new Map();

  for (const oldMatch of previousMatches) {
    const code = cleanText(oldMatch?.code);

    if (code) {
      previousByCode.set(code, oldMatch);
    }

    const key = matchKey(oldMatch);

    if (
      key &&
      key !== '|||'
    ) {
      /*
       * Gerçek kayıt OLD kaydına tercih edilir.
       */
      const existing = previousByKey.get(key);

      if (!existing) {
        previousByKey.set(key, oldMatch);
      } else if (
        isOldCode(existing.code) &&
        !isOldCode(oldMatch.code)
      ) {
        previousByKey.set(key, oldMatch);
      }
    }
  }

  /*
   * Sonuç olarak korunacak eski kayıtlar.
   */
  const result = new Map();

  /*
   * Eski bütün kayıtları başlangıçta koruyoruz.
   *
   * Çünkü Mackolik Salı günü eski maçları
   * arşivden kaldırabiliyor.
   *
   * Bu nedenle geçmiş veriler silinmemeli.
   */
  for (const oldMatch of previousMatches) {
    const code = cleanText(oldMatch?.code);

    if (code) {
      result.set(code, oldMatch);
    }
  }

  /*
   * Bu OLD kayıtlarının hangilerinin gerçek kayıtla
   * eşleştiğini takip ediyoruz.
   */
  const replacedOldCodes = new Set();

  for (const currentMatch of currentMatches) {
    const currentCode =
      cleanText(currentMatch.code);

    const key = matchKey(currentMatch);

    /*
     * 1. ÖNCE KOD İLE ARA
     */
    let oldMatch =
      previousByCode.get(currentCode);

    /*
     * 2. KOD BULUNAMAZSA MAÇ BİLGİLERİYLE ARA
     *
     * Bu bölüm OLD-... problemini çözüyor.
     */
    if (!oldMatch && key) {
      oldMatch =
        previousByKey.get(key);
    }

    /*
     * Eşleşen eski kayıt bulundu.
     */
    if (oldMatch) {
      const merged =
        mergeMatch(
          oldMatch,
          currentMatch
        );

      /*
       * Eski kod farklıysa kaldır.
       */
      if (
        oldMatch.code &&
        oldMatch.code !== currentCode
      ) {
        result.delete(
          String(oldMatch.code)
        );

        if (isOldCode(oldMatch.code)) {
          replacedOldCodes.add(
            String(oldMatch.code)
          );
        }
      }

      /*
       * Gerçek Mackolik kodunu kaydet.
       */
      result.set(
        currentCode,
        merged
      );

      continue;
    }

    /*
     * Yeni maç.
     *
     * Daha önce hiç görülmemiş.
     */
    result.set(
      currentCode,
      {
        ...currentMatch,
        openingRecordedAt:
          new Date().toISOString()
      }
    );
  }

  /*
   * Aynı maç için birden fazla kayıt kalmışsa
   * gerçek Mackolik kodunu tercih et.
   */
  const finalByKey = new Map();

  for (const match of result.values()) {
    const key = matchKey(match);

    if (
      !key ||
      key === '|||'
    ) {
      continue;
    }

    const existing =
      finalByKey.get(key);

    if (!existing) {
      finalByKey.set(key, match);
      continue;
    }

    /*
     * Gerçek kod OLD koduna tercih edilir.
     */
    if (
      isOldCode(existing.code) &&
      !isOldCode(match.code)
    ) {
      finalByKey.set(key, match);
      continue;
    }

    /*
     * İki kayıt da gerçekse:
     * yeni/current kayıt tercih edilir.
     */
    if (
      !isOldCode(match.code)
    ) {
      finalByKey.set(key, match);
    }
  }

  /*
   * Ancak burada önemli bir durum var:
   *
   * Tarihsel OLD kayıtları mevcut maç artık Mackolik'te
   * yoksa korunmalı.
   *
   * Bu nedenle finalByKey'e girmeyen OLD kayıtlarını
   * yalnızca gerçek eşleşmesi yoksa geri koyuyoruz.
   */
  for (const oldMatch of previousMatches) {
    if (!isOldCode(oldMatch?.code)) {
      continue;
    }

    const oldCode =
      String(oldMatch.code);

    if (replacedOldCodes.has(oldCode)) {
      continue;
    }

    const key = matchKey(oldMatch);

    if (!key || key === '|||') {
      continue;
    }

    if (!finalByKey.has(key)) {
      finalByKey.set(
        key,
        oldMatch
      );
    }
  }

  /*
   * Gerçek kayıtların tarihsel kayıtları silinmeden
   * sonuç dizisini oluştur.
   */
  const output = [];

  /*
   * Önce finalByKey kayıtları.
   */
  for (const match of finalByKey.values()) {
    output.push(match);
  }

  /*
   * Key üretilemeyen tarihsel kayıtları da koru.
   */
  for (const oldMatch of previousMatches) {
    const key = matchKey(oldMatch);

    if (
      key &&
      key !== '|||'
    ) {
      continue;
    }

    const code =
      String(oldMatch?.code ?? '');

    if (!code) continue;

    if (
      !output.some(
        item =>
          String(item.code) === code
      )
    ) {
      output.push(oldMatch);
    }
  }

  return output;
}

/* =========================================================
   ANALİZ SONUÇLARI
========================================================= */

function getResultForTarget(match, key) {
  const score = scoreNumbers(match);

  if (!score) {
    return null;
  }

  const home = score.home;
  const away = score.away;

  const total = home + away;

  const ht = halfTimeNumbers(match);

  switch (key) {
    case 'ms1':
      return home > away;

    case 'msX':
      return home === away;

    case 'ms2':
      return home < away;

    case 'kgVar':
      return home > 0 && away > 0;

    case 'kgYok':
      return home === 0 || away === 0;

    case 'au15Ust':
      return total >= 2;

    case 'au15Alt':
      return total <= 1;

    case 'au25Ust':
      return total >= 3;

    case 'au25Alt':
      return total <= 2;

    case 'au35Ust':
      return total >= 4;

    case 'au35Alt':
      return total <= 3;

    case 'iy15Ust':
      if (!ht) return null;
      return (
        ht.home + ht.away >= 2
      );

    case 'iy15Alt':
      if (!ht) return null;
      return (
        ht.home + ht.away <= 1
      );

    case 'iy1':
      if (!ht) return null;
      return ht.home > ht.away;

    case 'iyX':
      if (!ht) return null;
      return ht.home === ht.away;

    case 'iy2':
      if (!ht) return null;
      return ht.home < ht.away;

    default:
      return null;
  }
}

/* =========================================================
   ANALİZ OLUŞTUR
========================================================= */

function buildAnalysis(matches) {
  const completed =
    matches.filter(isPlayed);

  const analysis = {};

  for (const target of TARGETS) {
    const groups = new Map();

    for (const match of completed) {
      const odds =
        match?.openingOdds;

      if (!odds) continue;

      const odd =
        numberOrNull(
          odds[target.key]
        );

      /*
       * 0 veya olmayan oran analize alınmaz.
       */
      if (
        odd === null ||
        odd <= 0
      ) {
        continue;
      }

      const result =
        getResultForTarget(
          match,
          target.key
        );

      if (result === null) {
        continue;
      }

      /*
       * Aynı oranı tam eşitlik ile grupla.
       */
      const groupKey =
        String(odd);

      if (!groups.has(groupKey)) {
        groups.set(
          groupKey,
          {
            odd,
            total: 0,
            success: 0
          }
        );
      }

      const group =
        groups.get(groupKey);

      group.total++;

      if (result) {
        group.success++;
      }
    }

    const values = [];

    for (const group of groups.values()) {
      const successRate =
        group.total > 0
          ? (group.success / group.total) * 100
          : 0;

      values.push({
        odd: group.odd,
        total: group.total,
        success: group.success,
        successRate:
          Number(
            successRate.toFixed(2)
          ),
        qualified:
          group.total >= MIN_SAMPLE &&
          successRate >= MIN_SUCCESS
      });
    }

    values.sort(
      (a, b) =>
        a.odd - b.odd
    );

    analysis[target.key] = {
      key: target.key,
      label: target.label,
      totalMatches: values.reduce(
        (sum, item) =>
          sum + item.total,
        0
      ),
      groups: values
    };
  }

  return {
    generatedAt:
      new Date().toISOString(),

    minSuccess:
      MIN_SUCCESS,

    minSample:
      MIN_SAMPLE,

    completedMatches:
      completed.length,

    targets:
      analysis
  };
}

/* =========================================================
   DOSYA YAZ
========================================================= */

async function writeJsonIfChanged(
  filePath,
  oldData,
  newData
) {
  if (
    oldData &&
    sameJson(oldData, newData)
  ) {
    return false;
  }

  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  await fs.writeFile(
    filePath,
    JSON.stringify(
      newData,
      null,
      2
    ),
    'utf8'
  );

  return true;
}

/* =========================================================
   ANA İŞLEM
========================================================= */

async function main() {
  console.log(
    'Mackolik verileri çekiliyor...'
  );

  const previous =
    await loadPrevious();

  const fetched =
    await fetchMatches();

  console.log(
    `Mackolik'ten ${fetched.length} maç alındı.`
  );

  /*
   * Eski + yeni kayıtları birleştir.
   *
   * Burada:
   * - openingOdds korunur
   * - skor güncellenir
   * - status güncellenir
   * - OLD kayıt gerçek kayda dönüştürülür
   */
  const mergedMatches =
    mergeMatches(
      previous.matches ?? [],
      fetched
    );

  const data = {
    source: PAGE,

    /*
     * Güncel haftayı kullan.
     */
    week:
      fetched[0]?.week ??
      previous.week ??
      null,

    updatedAt:
      new Date().toISOString(),

    matches:
      mergedMatches
  };

  const changed =
    !sameJson(
      previous.matches ?? [],
      data.matches
    );

  if (changed) {
    await fs.mkdir(
      path.dirname(DATA_PATH),
      {
        recursive: true
      }
    );

    await fs.writeFile(
      DATA_PATH,
      JSON.stringify(
        data,
        null,
        2
      ),
      'utf8'
    );

    console.log(
      `matches.json güncellendi: ${mergedMatches.length} kayıt`
    );
  } else {
    console.log(
      'Maç verilerinde değişiklik yok.'
    );
  }

  /* =======================================================
     ANALİZ JSON
  ======================================================= */

  const analysis =
    buildAnalysis(
      mergedMatches
    );

  let oldAnalysis = null;

  try {
    oldAnalysis =
      JSON.parse(
        await fs.readFile(
          ANALYSIS_PATH,
          'utf8'
        )
      );
  } catch {}

  const analysisChanged =
    await writeJsonIfChanged(
      ANALYSIS_PATH,
      oldAnalysis,
      analysis
    );

  console.log(
    analysisChanged
      ? 'analysis.json güncellendi.'
      : 'analysis.json değişmedi.'
  );

  /* =======================================================
     ÖZET
  ======================================================= */

  const oldCount =
    (previous.matches ?? []).length;

  const currentCount =
    fetched.length;

  const finalCount =
    mergedMatches.length;

  console.log('');
  console.log('==============================');
  console.log('MACKOLIK GÜNCELLEME TAMAMLANDI');
  console.log('==============================');
  console.log(
    `Eski kayıt       : ${oldCount}`
  );
  console.log(
    `Yeni Mackolik    : ${currentCount}`
  );
  console.log(
    `Toplam kayıt     : ${finalCount}`
  );
  console.log(
    `Değişiklik       : ${changed}`
  );
  console.log(
    `Analiz değişti   : ${analysisChanged}`
  );
  console.log(
    `Güncelleme zamanı: ${data.updatedAt}`
  );
  console.log('==============================');
}

main().catch(error => {
  console.error('');
  console.error(
    'MACKOLIK GÜNCELLEME HATASI'
  );
  console.error(error);
  process.exit(1);
});
