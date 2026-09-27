import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const SITE = 'https://arsiv.mackolik.com';
const PAGE = `${SITE}/Genis-Iddaa-Programi`;
const DATA_PATH = path.resolve('data/matches.json');

const OPENING_ODDS = [
  'ms1', 'msX', 'ms2', 'iy1', 'iyX', 'iy2', 'cs1X', 'cs12', 'csX2',
  'au25Alt', 'au25Ust', 'kgVar', 'kgYok', 'iy15Alt', 'iy15Ust',
  'au15Alt', 'au15Ust', 'au35Alt', 'au35Ust', 'gol01', 'gol23', 'gol46', 'gol7',
  'handicap', 'handicap1', 'handicapX', 'handicap2'
];

function parseJsLiteral(text) {
  return vm.runInNewContext(`(${text.replace(/^\uFEFF/, '')})`, Object.create(null));
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined || typeof value === 'object') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

// Oynanmamış (status === 0) veya varsayılan "0" olarak gelen skorları null yapar
function parseScoreValue(value, status) {
  if (status === 0 || value === '' || value === null || value === undefined) return null;
  const strValue = String(value).trim();
  if (status === 0 && strValue === '0') return null;
  return strValue;
}

async function getCurrentWeek() {
  const html = await (await fetch(PAGE)).text();
  const match = html.match(/currentWeek\s*=\s*"(\d+)"/);
  if (!match) throw new Error('Mackolik güncel bülten haftası bulunamadı.');
  return Number(match[1]);
}

async function fetchMatches(week) {
  const url = `${SITE}/AjaxHandlers/ProgramDataHandler.ashx?type=6&sortValue=DATE&day=-1&sort=-1&sortDir=-1&groupId=-1&np=0&sport=1`;
  const payload = parseJsLiteral(await (await fetch(url)).text());
  const matches = [];
  for (const day of payload.m ?? []) {
    for (const row of day.m ?? []) {
      const matchStatus = row[5] ?? 0;

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
          ms1: numberOrNull(row[16]), msX: numberOrNull(row[17]), ms2: numberOrNull(row[18]),
          cs1X: numberOrNull(row[19]), cs12: numberOrNull(row[20]), csX2: numberOrNull(row[21]),
          au25Alt: numberOrNull(row[22]), au25Ust: numberOrNull(row[23]),
          handicap: row[14] || null,
          handicap1: numberOrNull(row[36]), handicapX: numberOrNull(row[37]), handicap2: numberOrNull(row[38]),
          kgVar: numberOrNull(row[39]), kgYok: numberOrNull(row[40]),
          iy15Alt: numberOrNull(row[42]), iy15Ust: numberOrNull(row[43]),
          au15Alt: numberOrNull(row[44]), au15Ust: numberOrNull(row[45]),
          au35Alt: numberOrNull(row[46]), au35Ust: numberOrNull(row[47]),
          gol01: numberOrNull(row[29]), gol23: numberOrNull(row[30]), gol46: numberOrNull(row[31]), gol7: numberOrNull(row[32]),
          iy1: numberOrNull(row[33]), iyX: numberOrNull(row[34]), iy2: numberOrNull(row[35])
        }
      });
    }
  }
  return matches;
}

function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

let previous = { week: null, updatedAt: null, matches: [] };
try { previous = JSON.parse(await fs.readFile(DATA_PATH, 'utf8')); } catch {}

const week = await getCurrentWeek();
const fetched = await fetchMatches(week);
const previousByCode = new Map((previous.matches ?? []).map(match => [String(match.code), match]));
let changed = false;

const matches = fetched.map(current => {
  const old = previousByCode.get(current.code);
  if (!old) {
    changed = true;
    return { ...current, openingRecordedAt: new Date().toISOString() };
  }

  const merged = {
    ...current,
    openingOdds: old.openingOdds,
    openingRecordedAt: old.openingRecordedAt ?? 'previous-record'
  };
  if (!sameJson(old.score, current.score) || !sameJson(old.halfTimeScore, current.halfTimeScore) || old.status !== current.status) changed = true;
  return merged;
});

const next = {
  source: PAGE,
  week,
  updatedAt: changed ? new Date().toISOString() : previous.updatedAt,
  matches
};

if (changed || !previous.matches?.length) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({ week, fetched: fetched.length, changed, dataPath: DATA_PATH }, null, 2));
