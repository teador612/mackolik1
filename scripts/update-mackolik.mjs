
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = `${SITE}/Genis-Iddaa-Programi`;
const DATA_PATH = path.resolve('data/matches.json');

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

function parseJsLiteral(text) {
  const cleanText = text.replace(/^\uFEFF/, '');

  return vm.runInNewContext(
    '(' + cleanText + ')',
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

async function request(url, referer = PAGE) {
  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        ...REQUEST_HEADERS,
        Referer: referer
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000)
    });
  } catch (error) {
    throw new Error(
      `Mackolik isteği başarısız: ${url}\n` +
      `Ayrıntı: ${error.message}`
    );
  }

  if (!response.ok) {
    const detail =
      response.status === 403
        ? 'Sunucu erişimi reddetti. İstek başlıkları eklenmiş olsa da IP veya bot koruması engeli olabilir.'
        : response.status === 429
          ? 'İstek sınırına ulaşıldı.'
          : 'Sunucu başarılı yanıt vermedi.';

    throw new Error(
      `${detail}\n` +
      `HTTP ${response.status}\n` +
      `URL: ${url}`
    );
  }

  return response.text();
}

async function getCurrentWeek() {
  const html = await request(PAGE);

  const patterns = [
    /\bcurrentWeek\s*=\s*["']?(\d+)["']?/i,
    /\bcurrentWeek\s*:\s*["']?(\d+)["']?/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  throw new Error(
    'Mackolik sayfası alındı ancak güncel bülten haftası bulunamadı.'
  );
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

  const text = await request(url, PAGE);

  let payload;

  try {
    payload = parseJsLiteral(text);
  } catch (error) {
    throw new Error(
      'Mackolik yanıtı beklenen veri formatında değil. ' +
      'Yanıt HTML veya başka bir içerik olabilir. ' +
      `Ayrıntı: ${error.message}`
    );
  }

  if (!payload || !Array.isArray(payload.m)) {
    throw new Error(
      'Mackolik yanıtında beklenen maç listesi bulunamadı.'
    );
  }

  const matches = [];

  for (const day of payload.m) {
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

  if (matches.length === 0) {
    throw new Error(
      'Mackolik yanıtı boş maç listesi içeriyor. ' +
      'Mevcut veri dosyası korunacak.'
    );
  }

  return matches;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function loadPrevious() {
  try {
    const text = await fs.readFile(DATA_PATH, 'utf8');
    const data = JSON.parse(text);

    if (!Array.isArray(data.matches)) {
      throw new Error(
        'Mevcut matches.json içinde matches listesi bulunamadı.'
      );
    }

    return data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        source: PAGE,
        week: null,
        updatedAt: null,
        matches: []
      };
    }

    throw error;
  }
}

async function main() {
  // Önceki dosyayı yükle; hatalı JSON durumunda dur.
  const previous = await loadPrevious();

  // Her iki veri isteği de başarılı olmadan dosyaya yazılmaz.
  const week = await getCurrentWeek();
  const fetched = await fetchMatches(week);

  const previousByCode = new Map();

  for (const match of previous.matches) {
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

      // Kaydedilmiş açılış oranlarını değiştirme.
      openingOdds: old.openingOdds ?? current.openingOdds,

      openingRecordedAt:
        old.openingRecordedAt ?? 'previous-record'
    };

    if (
      !sameJson(old.score, merged.score) ||
      !sameJson(old.halfTimeScore, merged.halfTimeScore) ||
      Number(old.status) !== Number(merged.status)
    ) {
      changed = true;
    }

    previousByCode.set(code, merged);
  }

  const matches = Array.from(previousByCode.values());

  if (matches.length !== previous.matches.length) {
    changed = true;
  }

  const next = {
    source: PAGE,
    week,
    updatedAt: changed
      ? new Date().toISOString()
      : previous.updatedAt,
    matches
  };

  if (
    changed ||
    previous.matches.length === 0
  ) {
    await fs.mkdir(path.dirname(DATA_PATH), {
      recursive: true
    });

    const output = JSON.stringify(next, null, 2) + '\n';
    const tempPath = DATA_PATH + '.tmp';

    try {
      await fs.writeFile(tempPath, output, 'utf8');
      await fs.rename(tempPath, DATA_PATH);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  console.log(JSON.stringify({
    week,
    fetched: fetched.length,
    archived: matches.length,
    changed,
    dataPath: DATA_PATH
  }, null, 2));
}

main().catch(error => {
  console.error('Mackolik güncelleme hatası:');
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
