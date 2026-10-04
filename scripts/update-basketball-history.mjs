import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT = path.join(DATA_DIR, "basketball-history.json");

const DAYS_BACK = 60;

const API =
  "https://www.sofascore.com/api/v1/sport/basketball/scheduled-events";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://www.sofascore.com/",
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function getScore(score) {
  if (!score) return null;

  return (
    safeNumber(score.current) ??
    safeNumber(score.normaltime) ??
    safeNumber(score.display) ??
    null
  );
}

function getHalfScore(score) {
  if (!score) return null;

  /*
   * Basketbolda SofaScore:
   * period1 = 1. çeyrek
   * period2 = 2. çeyrek
   *
   * İlk yarı = period1 + period2
   */
  const p1 = safeNumber(score.period1);
  const p2 = safeNumber(score.period2);

  if (p1 === null || p2 === null) return null;

  return p1 + p2;
}

function isFinished(event) {
  const type = event?.status?.type;

  return [
    "finished",
    "afterpenalties",
    "afterovertime",
  ].includes(type);
}

function normalizeMatch(event) {
  const home = event?.homeTeam?.name;
  const away = event?.awayTeam?.name;

  if (!event?.id || !home || !away) {
    return null;
  }

  const homeScore = getScore(event.homeScore);
  const awayScore = getScore(event.awayScore);

  /*
   * Sadece sonucu belli olmuş maçları geçmişe alıyoruz.
   */
  if (!isFinished(event)) {
    return null;
  }

  if (homeScore === null || awayScore === null) {
    return null;
  }

  const timestamp = Number(event.startTimestamp);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp * 1000);

  const halfHomeScore = getHalfScore(event.homeScore);
  const halfAwayScore = getHalfScore(event.awayScore);

  return {
    id: `sofa-${event.id}`,

    source: "sofascore",

    sourceId: String(event.id),

    date: formatDate(date),

    timestamp,

    time: date.toISOString(),

    league:
      event?.tournament?.uniqueTournament?.name ||
      event?.tournament?.name ||
      "Basketbol",

    category:
      event?.tournament?.category?.name ||
      "",

    home,

    away,

    homeTeamId: event?.homeTeam?.id ?? null,

    awayTeamId: event?.awayTeam?.id ?? null,

    homeScore,

    awayScore,

    totalScore: homeScore + awayScore,

    halfHomeScore,

    halfAwayScore,

    halfTotal:
      halfHomeScore !== null && halfAwayScore !== null
        ? halfHomeScore + halfAwayScore
        : null,

    quarterScores: {
      home: {
        q1: safeNumber(event?.homeScore?.period1),
        q2: safeNumber(event?.homeScore?.period2),
        q3: safeNumber(event?.homeScore?.period3),
        q4: safeNumber(event?.homeScore?.period4),
      },

      away: {
        q1: safeNumber(event?.awayScore?.period1),
        q2: safeNumber(event?.awayScore?.period2),
        q3: safeNumber(event?.awayScore?.period3),
        q4: safeNumber(event?.awayScore?.period4),
      },
    },

    status: event?.status?.type || "finished",

    winner:
      homeScore > awayScore
        ? "home"
        : awayScore > homeScore
        ? "away"
        : "draw",

    homeWinnerCode: event?.homeScore?.current
      ? event?.homeScore?.current > event?.awayScore?.current
        ? 1
        : event?.homeScore?.current < event?.awayScore?.current
        ? 2
        : 0
      : null,
  };
}

async function fetchDay(date) {
  const url = `${API}/${date}`;

  try {
    const response = await fetch(url, {
      headers: HEADERS,
    });

    if (!response.ok) {
      console.log(`❌ ${date} HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data?.events)) {
      console.log(`⚠️ ${date}: events bulunamadı`);
      return [];
    }

    const matches = [];

    for (const event of data.events) {
      const match = normalizeMatch(event);

      if (match) {
        matches.push(match);
      }
    }

    console.log(
      `📅 ${date} | Toplam: ${data.events.length} | Skorlu: ${matches.length}`
    );

    return matches;
  } catch (error) {
    console.log(`❌ ${date} hata: ${error.message}`);
    return [];
  }
}

function loadOldData() {
  if (!fs.existsSync(OUTPUT)) {
    return [];
  }

  try {
    const json = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));

    if (Array.isArray(json)) {
      return json;
    }

    if (Array.isArray(json.matches)) {
      return json.matches;
    }

    return [];
  } catch {
    console.log("⚠️ Eski basketball-history.json okunamadı.");
    return [];
  }
}

function cleanOldData(matches) {
  const minDate = dateDaysAgo(DAYS_BACK);
  const minTimestamp = minDate.getTime();

  return matches.filter(match => {
    if (!match?.date) return false;

    const time = new Date(match.date).getTime();

    if (!Number.isFinite(time)) return false;

    return time >= minTimestamp;
  });
}

function mergeMatches(oldMatches, newMatches) {
  const map = new Map();

  for (const match of oldMatches) {
    if (!match?.id) continue;

    map.set(String(match.id), match);
  }

  for (const match of newMatches) {
    if (!match?.id) continue;

    const id = String(match.id);

    const old = map.get(id);

    if (!old) {
      map.set(id, match);
      continue;
    }

    /*
     * Yeni SofaScore verisi eski kaydı günceller.
     */
    map.set(id, {
      ...old,
      ...match,

      homeScore:
        match.homeScore !== null
          ? match.homeScore
          : old.homeScore ?? null,

      awayScore:
        match.awayScore !== null
          ? match.awayScore
          : old.awayScore ?? null,

      halfHomeScore:
        match.halfHomeScore !== null
          ? match.halfHomeScore
          : old.halfHomeScore ?? null,

      halfAwayScore:
        match.halfAwayScore !== null
          ? match.halfAwayScore
          : old.halfAwayScore ?? null,

      totalScore:
        match.totalScore !== null
          ? match.totalScore
          : old.totalScore ?? null,

      halfTotal:
        match.halfTotal !== null
          ? match.halfTotal
          : old.halfTotal ?? null,
    });
  }

  return [...map.values()];
}

function sortMatches(matches) {
  return matches.sort((a, b) => {
    const ta = Number(a.timestamp || 0);
    const tb = Number(b.timestamp || 0);

    return ta - tb;
  });
}

async function main() {
  console.log("========================================");
  console.log("🏀 SOFASCORE BASKETBOL GEÇMİŞİ");
  console.log("========================================");
  console.log(`📅 Geçmiş aralığı: ${DAYS_BACK} gün`);
  console.log("");

  fs.mkdirSync(DATA_DIR, {
    recursive: true,
  });

  const oldMatches = loadOldData();

  console.log(`Mevcut kayıt: ${oldMatches.length}`);
  console.log("");

  const allNewMatches = [];

  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = formatDate(dateDaysAgo(i));

    const matches = await fetchDay(date);

    allNewMatches.push(...matches);

    /*
     * Sofascore'a çok hızlı yüklenmemek için
     * istekler arasında küçük bekleme.
     */
    await sleep(250);
  }

  console.log("");
  console.log("========================================");
  console.log("🔄 VERİLER BİRLEŞTİRİLİYOR");
  console.log("========================================");

  let merged = mergeMatches(oldMatches, allNewMatches);

  merged = cleanOldData(merged);

  merged = sortMatches(merged);

  /*
   * Aynı event ID tekrar oluşmuşsa Map zaten tek kayıt bırakıyor.
   */
  const output = {
    source:
      "https://www.sofascore.com/basketball",

    sourceApi:
      "https://www.sofascore.com/api/v1/sport/basketball/scheduled-events/{date}",

    updatedAt: new Date().toISOString(),

    days: DAYS_BACK,

    matches: merged,
  };

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log("");
  console.log("========================================");
  console.log("✅ SOFASCORE GEÇMİŞ VERİSİ GÜNCELLENDİ");
  console.log("========================================");
  console.log(`Yeni çekilen: ${allNewMatches.length}`);
  console.log(`Toplam kayıt: ${merged.length}`);
  console.log(`Geçmiş: ${DAYS_BACK} gün`);
  console.log(`Dosya: ${OUTPUT}`);
  console.log("========================================");

  console.log("");

  /*
   * Örnek birkaç kayıt göster.
   */
  for (const match of merged.slice(-10)) {
    console.log(
      `${match.date} | ${match.league} | ${match.home} - ${match.away} | ${match.homeScore}-${match.awayScore} | İY ${match.halfHomeScore ?? "-"}-${match.halfAwayScore ?? "-"}`
    );
  }
}

main().catch(error => {
  console.error("");
  console.error("========================================");
  console.error("❌ SOFASCORE GEÇMİŞ GÜNCELLEME HATASI");
  console.error("========================================");
  console.error(error);
  process.exit(1);
});
