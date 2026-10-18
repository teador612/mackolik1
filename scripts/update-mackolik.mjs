
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = `${SITE}/Genis-Iddaa-Programi`;
const DATA_PATH = path.resolve('data/matches.json');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, extraHeaders = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          Accept: '*/*',
          Referer: PAGE,
          ...extraHeaders
        },
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);

      // 403 genellikle sunucu tarafındaki erişim engelidir.
      if (
        response.status !== 403 &&
        response.status !== 408 &&
        response.status !== 429 &&
        response.status < 500
      ) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
    }

    console.warn(
      `İstek başarısız: ${url} | ` +
      `${lastError.message} | Deneme ${attempt}/3`
    );

    if (attempt < 3) {
      await sleep(attempt * 2000);
    }
  }

  throw new Error(
    `Mackolik verisi alınamadı: ${lastError?.message ?? 'Bilinmeyen hata'}`
  );
}

function parseJsLiteral(text) {
  const cleanText = text.replace(/^\uFEFF/, '');

  return vm.runInNewContext(
    `(${cleanText})`,
    Object.create(null)
  );
}

function numberOrNull(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined ||
    typeof value === 'object'
  ) {
    return null;
  }

  const number = Number(
    String(value).replace(',', '.')
  );

  return Number.isFinite(number) ? number : null;
}

function parseScoreValue(value, status) {
  if (Number(status) === 0) {
    return null;
  }

  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const result = String(value).trim();
  return result === '' ? null : result;
}

async function getCurrentWeek() {
  const response = await fetchWithRetry(PAGE);
  const html = await response.text();

  const match = html.match(
    /currentWeek\s*=\s*"(\d+)"/
  );

  if (!match) {
    throw new Error(
      'Mackolik güncel bülten haftası bulunamadı.'
    );
  }

  return Number(match[1]);
}

async function fetchMatches(week) {
  const url =
    `${SITE}/AjaxHandlers/ProgramDataHandler.ashx` +
    '?type=6' +
    '&sortValue=DATE' +
    '&day=-1' +
    '&sort=-1' +
    '&sortDir=-1' +
    '&groupId=-1' +
    '&np=0' +
    '&sport=1';

  const response = await fetchWithRetry(url, {
    Accept: '*/*',
    'X-Requested-With': 'XMLHttpRequest'
  });

  const text = await response.text();
  const payload = parseJsLiteral(text);

  if (!payload || !Array.isArray(payload.m)) {
    throw new Error(
      'Mackolik yanıtı beklenen veri formatında değil.'
    );
  }

  const matches = [];

  for (const day of payload.m ?? []) {
    for (const row of day.m ?? []) {
      const matchStatus = Number(row[5] ?? 0);

      matches.push({
        code: String(row[0]),
        week,
        date: row[7] || day.d,
        time: row[6] || null,
        league: row[26] || '',
        home: row[1] || '',
        away: row[3] || '',
        mbs: numberOrNull(row[13]),
        status: matchStatus,

        score: {
          home: parseScoreValue(row[8], matchStatus),
          away: parseScoreValue(row[9], matchStatus)
        },

        halfTimeScore: {
          home: parseScoreValue(row[11], matchStatus),
          away: parseScoreValue(row[12], matchStatus)
        },

        openingOdds: {
          ms1: numberOrNull(row[16]),
          msX: numberOrNull(row[17]),
          ms2: numberOrNull(row[18]),

          cs1X: numberOrNull(row[19]),
          cs12: numberOrNull(row[20]),
          csX2: numberOrNull(row[21]),

          au25Alt: numberOrNull(row[22]),
          au25Ust: numberOrNull(row[23]),

          handicap: row[14] || null,

          handicap1: numberOrNull(row[36]),
          handicapX: numberOrNull(row[37]),
          handicap2: numberOrNull(row[38]),

          kgVar: numberOrNull(row[39]),
          kgYok: numberOrNull(row[40]),

          iy15Alt: numberOrNull(row[42]),
          iy15Ust: numberOrNull(row[43]),

          au15Alt: numberOrNull(row[44]),
          au15Ust: numberOrNull(row[45]),

          au35Alt: numberOrNull(row[46]),
          au35Ust: numberOrNull(row[47]),

          gol01: numberOrNull(row[29]),
          gol23: numberOrNull(row[30]),
          gol46: numberOrNull(row[31]),
          gol7: numberOrNull(row[32]),

          iy1: numberOrNull(row[33]),
          iyX: numberOrNull(row[34]),
          iy2: numberOrNull(row[35])
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
  const previousText = await fs.readFile(DATA_PATH, 'utf8');
  previous = JSON.parse(previousText);

  if (!Array.isArray(previous.matches)) {
    throw new Error('Mevcut maç arşivi geçersiz.');
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const week = await getCurrentWeek();
const fetched = await fetchMatches(week);

if (fetched.length === 0) {
  throw new Error(
    'Mackolik sıfır maç döndürdü. Mevcut arşiv korundu.'
  );
}

const previousByCode = new Map();

for (const match of previous.matches ?? []) {
  previousByCode.set(String(match.code), match);
}

let changed = false;

for (const current of fetched) {
  const code = String(current.code);
  const old = previousByCode.get(code);

  if (!old) {
    previousByCode.set(code, {
      ...current,
      openingRecordedAt: new Date().toISOString()
    });

    changed = true;
    continue;
  }

  const merged = {
    ...old,
    week: current.week,
    date: current.date,
    time: current.time,
    league: current.league,
    home: current.home,
    away: current.away,
    mbs: current.mbs,
    status: current.status,
    score: current.score,
    halfTimeScore: current.halfTimeScore,

    // İlk kaydedilen açılış oranlarını değiştirme.
    openingOdds: old.openingOdds ?? current.openingOdds,

    openingRecordedAt:
      old.openingRecordedAt ?? 'previous-record'
  };

  if (
    !sameJson(old.score, merged.score) ||
    !sameJson(old.halfTimeScore, merged.halfTimeScore) ||
    Number(old.status) !== Number(merged.status) ||
    !sameJson(old, merged)
  ) {
    changed = true;
  }

  previousByCode.set(code, merged);
}

const matches = Array.from(previousByCode.values());

if (matches.length !== (previous.matches ?? []).length) {
  changed = true;
}

const next = {
  ...previous,
  source: PAGE,
  week,
  updatedAt: changed
    ? new Date().toISOString()
    : previous.updatedAt,
  matches
};

if (changed || !previous.matches?.length) {
  await fs.mkdir(path.dirname(DATA_PATH), {
    recursive: true
  });

  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(next, null, 2) + '\n',
    'utf8'
  );
}

console.log(
  JSON.stringify(
    {
      week,
      fetched: fetched.length,
      archived: matches.length,
      changed,
      dataPath: DATA_PATH
    },
    null,
    2
  )
);
