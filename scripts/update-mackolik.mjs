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

function numberOrNull(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined ||
    typeof value === 'object'
  ) {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));

  return Number.isFinite(number) ? number : null;
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

  if (result === '') {
    return null;
  }

  return result;
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
console.log(
  JSON.stringify({
    code: row[0],
    home: row[1],
    away: row[3],
    status: row[5],
    row8: row[8],
    row9: row[9],
    row11: row[11],
    row12: row[12]
  })
);
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
home: parseScoreValue(row[11], matchStatus),
away: parseScoreValue(row[12], matchStatus)
},

halfTimeScore: {
home: parseScoreValue(row[8], matchStatus),
away: parseScoreValue(row[9], matchStatus)
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

const previousByCode = new Map(
  (previous.matches ?? []).map(function(match) {
    return [
      String(match.code),
      match
    ];
  })
);

let changed = false;

const matches = fetched.map(function(current) {
  const old = previousByCode.get(current.code);

  if (!old) {
    changed = true;

    return {
      ...current,
      openingRecordedAt: new Date().toISOString()
    };
  }

  const merged = {
    ...current,
    openingOdds: old.openingOdds ?? current.openingOdds,
    openingRecordedAt:
      old.openingRecordedAt ?? 'previous-record'
  };

  if (
    !sameJson(old.score, current.score) ||
    !sameJson(
      old.halfTimeScore,
      current.halfTimeScore
    ) ||
    Number(old.status) !== Number(current.status)
  ) {
    changed = true;
  }

  return merged;
});

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
    JSON.stringify(next, null, 2) + '\n';

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
      changed: changed,
      dataPath: DATA_PATH
    },
    null,
    2
  )
);
