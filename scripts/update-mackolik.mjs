import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = SITE + '/Genis-Iddaa-Programi';

const DATA_PATH = path.resolve('data/matches.json');
const ANALYSIS_PATH = path.resolve('data/analysis.json');

const MIN_SUCCESS = 70;
const MIN_SAMPLE = 5;

const TARGETS = [
  { source: 'ms1', label: 'MS 1' },
  { source: 'msX', label: 'MS X' },
  { source: 'ms2', label: 'MS 2' },

  { source: 'kgVar', label: 'KG Var' },
  { source: 'kgYok', label: 'KG Yok' },

  { source: 'au15Ust', label: '1,5 Üst' },
  { source: 'au15Alt', label: '1,5 Alt' },

  { source: 'au25Ust', label: '2,5 Üst' },
  { source: 'au25Alt', label: '2,5 Alt' },

  { source: 'au35Ust', label: '3,5 Üst' },
  { source: 'au35Alt', label: '3,5 Alt' },

  { source: 'iy15Ust', label: 'İY 1,5 Üst' },
  { source: 'iy15Alt', label: 'İY 1,5 Alt' },

  { source: 'iy1', label: 'İY 1' },
  { source: 'iyX', label: 'İY X' },
  { source: 'iy2', label: 'İY 2' }
];

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

  return Number.isFinite(number)
    ? number
    : null;
}

function parseScoreValue(value, status) {
  const normalizedStatus = Number(status);

  if (normalizedStatus === 0) {
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

function scoreNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function getFullTimeResult(match) {
  const home = scoreNumber(match?.score?.home);
  const away = scoreNumber(match?.score?.away);

  if (home === null || away === null) {
    return null;
  }

  return {
    home,
    away,
    total: home + away
  };
}

function getHalfTimeResult(match) {
  const home = scoreNumber(match?.halfTimeScore?.home);
  const away = scoreNumber(match?.halfTimeScore?.away);

  if (home === null || away === null) {
    return null;
  }

  return {
    home,
    away,
    total: home + away
  };
}

function getTargetSuccess(match, source) {
  const ft = getFullTimeResult(match);
  const ht = getHalfTimeResult(match);

  if (!ft) {
    return null;
  }

  switch (source) {
    case 'ms1':
      return ft.home > ft.away;

    case 'msX':
      return ft.home === ft.away;

    case 'ms2':
      return ft.away > ft.home;

    case 'kgVar':
      return ft.home > 0 && ft.away > 0;

    case 'kgYok':
      return ft.home === 0 || ft.away === 0;

    case 'au15Ust':
      return ft.total >= 2;

    case 'au15Alt':
      return ft.total <= 1;

    case 'au25Ust':
      return ft.total >= 3;

    case 'au25Alt':
      return ft.total <= 2;

    case 'au35Ust':
      return ft.total >= 4;

    case 'au35Alt':
      return ft.total <= 3;

    case 'iy15Ust':
      if (!ht) return null;
      return ht.total >= 2;

    case 'iy15Alt':
      if (!ht) return null;
      return ht.total <= 1;

    case 'iy1':
      if (!ht) return null;
      return ht.home > ht.away;

    case 'iyX':
      if (!ht) return null;
      return ht.home === ht.away;

    case 'iy2':
      if (!ht) return null;
      return ht.away > ht.home;

    default:
      return null;
  }
}

function makeStatKey(source, odd) {
  return `${source}|${Number(odd).toFixed(2)}`;
}

function isPlayed(match) {
  const ft = getFullTimeResult(match);

  return (
    Number(match?.status) !== 0 &&
    ft !== null
  );
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

      matches.push({
        code: String(row[0]),
        week: week,
        date: row[7] || day.d,
        time: row[6] || null,
        league: row[26] || '',
        home: row[1] || '',
        away: row[3] || '',
        mbs: numberOrNull(row[13]),
        status: matchStatus,

        score: {
          home: parseScoreValue(
            row[8],
            matchStatus
          ),
          away: parseScoreValue(
            row[9],
            matchStatus
          )
        },

        halfTimeScore: {
          home: parseScoreValue(
            row[11],
            matchStatus
          ),
          away: parseScoreValue(
            row[12],
            matchStatus
          )
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

function sortMatches(matches) {
  return matches.sort((a, b) => {
    const da = String(a.date || '').split('.');
    const db = String(b.date || '').split('.');

    const ta =
      da.length === 3
        ? `${da[2]}-${da[1]}-${da[0]}`
        : String(a.date || '');

    const tb =
      db.length === 3
        ? `${db[2]}-${db[1]}-${db[0]}`
        : String(b.date || '');

    const dateCompare = ta.localeCompare(tb);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return String(a.time || '')
      .localeCompare(String(b.time || ''));
  });
}

function buildAnalysis(matches) {
  const stats = Object.create(null);

  let completedMatches = 0;

  for (const match of matches) {
    if (!isPlayed(match)) {
      continue;
    }

    completedMatches++;

    const odds = match.openingOdds ?? {};

    for (const target of TARGETS) {
      const odd = numberOrNull(
        odds[target.source]
      );

      if (
        odd === null ||
        odd <= 0
      ) {
        continue;
      }

      const success = getTargetSuccess(
        match,
        target.source
      );

      if (success === null) {
        continue;
      }

      const key = makeStatKey(
        target.source,
        odd
      );

      if (!stats[key]) {
        stats[key] = {
          source: target.source,
          label: target.label,
          odd,
          sample: 0,
          success: 0,
          successRate: 0
        };
      }

      stats[key].sample++;

      if (success) {
        stats[key].success++;
      }
    }
  }

  for (const stat of Object.values(stats)) {
    stat.successRate =
      stat.sample > 0
        ? Number(
            (
              stat.success /
              stat.sample *
              100
            ).toFixed(2)
          )
        : 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    minSample: MIN_SAMPLE,
    minSuccess: MIN_SUCCESS,
    totalMatches: matches.length,
    completedMatches,
    targetCount: TARGETS.length,
    targets: TARGETS,
    stats
  };
}

let previous = {
  source: PAGE,
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
    source: PAGE,
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

  const oldScore = old.score ?? {};
  const oldHalf = old.halfTimeScore ?? {};

  const scoreChanged =
    !sameJson(
      oldScore,
      current.score
    );

  const halfTimeChanged =
    !sameJson(
      oldHalf,
      current.halfTimeScore
    );

  const statusChanged =
    Number(old.status) !==
    Number(current.status);

  const merged = {
    ...old,

    code: code,

    week: current.week,
    date: current.date,
    time: current.time,
    league: current.league,
    home: current.home,
    away: current.away,
    mbs: current.mbs,

    status: current.status,

    score: current.score,

    halfTimeScore:
      current.halfTimeScore,

    // ÖNEMLİ:
    // Eski açılış oranı varsa ASLA değiştirme.
    openingOdds:
      old.openingOdds ??
      current.openingOdds,

    openingRecordedAt:
      old.openingRecordedAt ??
      'previous-record'
  };

  if (
    scoreChanged ||
    halfTimeChanged ||
    statusChanged
  ) {
    changed = true;
  }

  previousByCode.set(
    code,
    merged
  );
}

// Eski maçlar kesinlikle korunur.
const matches = sortMatches(
  Array.from(
    previousByCode.values()
  )
);

if (
  matches.length !==
  (previous.matches ?? []).length
) {
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

await fs.mkdir(
  path.dirname(DATA_PATH),
  {
    recursive: true
  }
);

if (
  changed ||
  !previous.matches ||
  previous.matches.length === 0
) {
  const output =
    JSON.stringify(
      next,
      null,
      2
    ) + '\n';

  await fs.writeFile(
    DATA_PATH,
    output,
    'utf8'
  );
}

// ----------------------------------------------------
// ANALYSIS.JSON
// ----------------------------------------------------

const analysis = buildAnalysis(matches);

await fs.writeFile(
  ANALYSIS_PATH,
  JSON.stringify(
    analysis,
    null,
    2
  ) + '\n',
  'utf8'
);

console.log(
  JSON.stringify(
    {
      week,
      fetched: fetched.length,
      archived: matches.length,
      completed:
        analysis.completedMatches,
      analysisStats:
        Object.keys(
          analysis.stats
        ).length,
      changed,
      dataPath: DATA_PATH,
      analysisPath: ANALYSIS_PATH
    },
    null,
    2
  )
);
