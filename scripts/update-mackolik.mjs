import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = SITE + '/Genis-Iddaa-Programi';
const DATA_PATH = path.resolve('data/matches.json');

function parseJsLiteral(text) {
  const cleanText = text.replace(/^\uFEFF/, '');

  return vm.runInNewContext(
    '(' + cleanText + ')',
    Object.create(null)
  );
}

// -------------------------------------------------------------
// 1. DATA FORMATINA DÖNÜŞTÜRME YARDIMCI FONKSİYONLARI
// -------------------------------------------------------------

// Float veya string veriyi "1,51" virgüllü string formata çevirir
function formatOddString(value) {
  if (value === '' || value === null || value === undefined || typeof value === 'object') {
    return '';
  }
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num) || num === 0) {
    return '';
  }
  return num.toFixed(2).replace('.', ',');
}

// "24.09.2026" tarihini -> "2026-09-24" ve "Perşembe" formatına çevirir
function parseDateAndDay(rawDate) {
  if (!rawDate) return { date: '', day: '' };
  
  const parts = String(rawDate).split('.');
  if (parts.length === 3) {
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    const dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const dayName = isNaN(dt.getDay()) ? "" : days[dt.getDay()];
    return { date: formattedDate, day: dayName };
  }
  
  return { date: rawDate, day: '' };
}

// Skor değerini "X - Y" string formatına dönüştürür
function buildScoreString(homeVal, awayVal, status) {
  const normalizedStatus = Number(status);
  if (normalizedStatus === 0 || homeVal === null || homeVal === undefined || awayVal === null || awayVal === undefined) {
    return '';
  }
  const h = String(homeVal).trim();
  const a = String(awayVal).trim();
  return (h !== '' && a !== '') ? `${h} - ${a}` : '';
}

async function getCurrentWeek() {
  const response = await fetch(PAGE);

  if (!response.ok) {
    throw new Error(
      'Mackolik sayfasi alinamadi. HTTP ' +
      response.status
    );
  }

  const html = await response.text();

  const match = html.match(
    /currentWeek\s*=\s*"(\d+)"/
  );

  if (!match) {
    throw new Error(
      'Mackolik guncel bulten haftasi bulunamadi.'
    );
  }

  return Number(match[1]);
}

async function fetchMatches(week) {
  const url =
    SITE +
    '/AjaxHandlers/ProgramDataHandler.ashx' +
    '?type=6' +
    '&sortValue=DATE' +
    '&day=-1' +
    '&sort=-1' +
    '&sortDir=-1' +
    '&groupId=-1' +
    '&np=0' +
    '&sport=1';

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      'Mackolik mac verisi alinamadi. HTTP ' +
      response.status
    );
  }

  const text = await response.text();
  const payload = parseJsLiteral(text);

  const matches = [];

  for (const day of payload.m ?? []) {
    for (const row of day.m ?? []) {
      const matchStatus = Number(row[5] ?? 0);
      const rawDate = row[7] || day.d;
      const { date, day: dayName } = parseDateAndDay(rawDate);

      const homeScoreRaw = row[8];
      const awayScoreRaw = row[9];
      const htHomeScoreRaw = row[11];
      const htAwayScoreRaw = row[12];

      const scoreFTStr = buildScoreString(homeScoreRaw, awayScoreRaw, matchStatus);
      const scoreHTStr = buildScoreString(htHomeScoreRaw, htAwayScoreRaw, matchStatus);

      // Maç Sonu Kazanma Sonuçları (1. Data formatına göre 1/0/2 İşaretleme)
      const hScoreNum = Number(homeScoreRaw);
      const aScoreNum = Number(awayScoreRaw);
      const isFinished = matchStatus === 4;

      const ms1Result = (isFinished && hScoreNum > aScoreNum) ? "1" : "";
      const ms0Result = (isFinished && hScoreNum === aScoreNum) ? "1" : "";
      const ms2Result = (isFinished && aScoreNum > hScoreNum) ? "1" : "";

      // 1. DATA FORMATINDA NESNE OLUŞTURULUYOR
      matches.push({
        code: String(row[0]),
        week: week,
        date: date,
        day: dayName,
        time: row[6] || '',
        league: row[26] || '',
        home: String(row[1] || '').toUpperCase(),
        away: String(row[3] || '').toUpperCase(),
        played: isFinished,

        scoreHT: scoreHTStr,
        scoreFT: scoreFTStr,

        results: {
          ms1: ms1Result,
          ms0: ms0Result,
          ms2: ms2Result,
          kgVar: "",
          over25: ""
        },

        odds: {
          ms1: formatOddString(row[16]),
          ms0: formatOddString(row[17]),             // msX -> ms0
          ms2: formatOddString(row[18]),

          over25: formatOddString(row[23]),          // au25Ust -> over25
          under25: formatOddString(row[22]),         // au25Alt -> under25

          kgVar: formatOddString(row[39]),
          kgYok: formatOddString(row[40]),

          iy1: formatOddString(row[33]),
          iy0: formatOddString(row[34]),             // iyX -> iy0
          iy2: formatOddString(row[35]),

          iyOver15: formatOddString(row[43]),        // iy15Ust -> iyOver15
          iyUnder15: formatOddString(row[42]),       // iy15Alt -> iyUnder15

          // Ekstra Alanlar (col_XX)
          col_37: formatOddString(row[16]),
          col_38: formatOddString(row[17]),
          col_39: formatOddString(row[18]),
          col_40: formatOddString(row[19]),          // cs1X
          col_41: formatOddString(row[20]),          // cs12
          col_42: formatOddString(row[21]),          // csX2
          col_52: formatOddString(row[22]),          // au25Alt
          col_53: formatOddString(row[23]),          // au25Ust
          col_56: formatOddString(row[39]),          // kgVar
          col_57: formatOddString(row[40]),          // kgYok
          col_62: formatOddString(row[33]),          // iy1
          col_63: formatOddString(row[34]),          // iy0
          col_64: formatOddString(row[35]),          // iy2
          col_65: formatOddString(row[42]),          // iy15Alt
          col_66: formatOddString(row[43])           // iy15Ust
        }
      });
    }
  }

  return matches;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let previous = {
  week: null,
  updatedAt: null,
  matches: []
};

try {
  const previousText = await fs.readFile(
    DATA_PATH,
    'utf8'
  );

  previous = JSON.parse(previousText);
} catch {
  previous = {
    week: null,
    updatedAt: null,
    matches: []
  };
}

const week = await getCurrentWeek();
const fetched = await fetchMatches(week);

const previousByCode = new Map();

for (const match of previous.matches ?? []) {
  previousByCode.set(
    String(match.code),
    match
  );
}

let changed = false;

for (const current of fetched) {
  const code = String(current.code);
  const old = previousByCode.get(code);

  // Yeni maç
  if (!old) {
    previousByCode.set(code, {
      ...current,
      openingRecordedAt:
        new Date().toISOString()
    });

    changed = true;
    continue;
  }

  // Mevcut maç:
  // Güncel bilgileri yenile, fakat açılış oranlarını koru.
  const merged = {
    ...old,

    week: current.week,
    date: current.date,
    day: current.day,
    time: current.time,
    league: current.league,
    home: current.home,
    away: current.away,

    played: current.played,

    scoreHT: current.scoreHT,
    scoreFT: current.scoreFT,

    results: current.results,

    odds:
      old.odds ??
      current.odds,

    openingRecordedAt:
      old.openingRecordedAt ??
      'previous-record'
  };

  if (
    old.scoreFT !== current.scoreFT ||
    old.scoreHT !== current.scoreHT ||
    old.played !== current.played
  ) {
    changed = true;
  }

  previousByCode.set(
    code,
    merged
  );
}

// Eski maçlar + yeni maçlar
const matches = Array.from(
  previousByCode.values()
);

if (
  matches.length !==
  (previous.matches ?? []).length
) {
  changed = true;
}

const next = {
  source: PAGE,
  week: week,
  updatedAt: changed
    ? new Date().toISOString()
    : previous.updatedAt,
  matches: matches
};

if (
  changed ||
  !previous.matches ||
  previous.matches.length === 0
) {
  await fs.mkdir(
    path.dirname(DATA_PATH),
    {
      recursive: true
    }
  );

  const output =
    JSON.stringify(next, null, 2) +
    '\n';

  await fs.writeFile(
    DATA_PATH,
    output,
    'utf8'
  );
}

console.log(
  JSON.stringify(
    {
      week: week,
      fetched: fetched.length,
      archived:
        matches.length,
      changed: changed,
      dataPath: DATA_PATH
    },
    null,
    2
  )
);
