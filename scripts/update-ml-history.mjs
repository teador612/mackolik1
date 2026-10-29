
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "data/v2-data.json");
const PREDICTIONS_PATH = path.join(ROOT, "outputs/ml-predictions.json");
const HISTORY_PATH = path.join(ROOT, "outputs/ml-prediction-history.json");

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function getRows(data) {
  if (Array.isArray(data)) return data;

  for (const key of ["matches", "data", "items", "results"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  throw new Error("v2-data.json içinde maç listesi bulunamadı.");
}

function text(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value) {
  return text(value).replace(/\s+/g, "");
}

function dateKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const local = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

  if (local) {
    return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toISOString().slice(0, 10);
}

function score(value) {
  if (value && typeof value === "object") {
    const home = Number(value.home ?? value.h ?? value.homeScore);
    const away = Number(value.away ?? value.a ?? value.awayScore);

    if (
      Number.isInteger(home) && home >= 0 &&
      Number.isInteger(away) && away >= 0
    ) {
      return [home, away];
    }

    return null;
  }

  const match = String(value ?? "").match(
    /^\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*$/
  );

  return match
    ? [Number(match[1]), Number(match[2])]
    : null;
}

function getScore(match, keys) {
  for (const key of keys) {
    const result = score(match?.[key]);
    if (result) return result;
  }

  return null;
}

function fullScore(match) {
  return getScore(match, [
    "score",
    "fullTimeScore",
    "full_time_score",
    "ft",
    "resultScore",
    "skor",
    "sonuc"
  ]);
}

function halfScore(match) {
  return getScore(match, [
    "halfTimeScore",
    "half_time_score",
    "ht",
    "iySkor",
    "halfScore",
    "devreSkoru"
  ]);
}

function matchKey(match) {
  const home = text(
    match.home ?? match.homeTeam
  );

  const away = text(
    match.away ?? match.awayTeam
  );

  const date = dateKey(
    match.date ??
    match.matchDate ??
    match.match_date ??
    match.tarih ??
    match.datetime ??
    match.kickoff
  );

  if (!home || !away || !date) return "";

  return `${date}|${home}|${away}`;
}

function mainPrediction(match) {
  const markets = Object.entries(match.markets ?? {})
    .map(([key, market]) => ({
      key,
      title: market?.title ?? key,
      pick: market?.pick,
      probability: Number(market?.probability)
    }))
    .filter(item =>
      item.pick != null &&
      Number.isFinite(item.probability) &&
      item.probability >= 0 &&
      item.probability <= 100
    )
    .sort((a, b) => b.probability - a.probability);

  return markets[0] ?? null;
}

/*
 * Tahmin seçeneklerini ortak biçime dönüştürür.
 * Örnek:
 * "İY 1" -> "iy1"
 * "MS 1" -> "ms1"
 * "X"    -> "x"
 */
function outcome(marketKey, pick, match) {
  const ft = fullScore(match);
  const ht = halfScore(match);
  const selected = compact(pick);

  if (marketKey === "MS") {
    if (!ft) return null;

    const [home, away] = ft;
    const actual = home > away
      ? "1"
      : home === away
        ? "x"
        : "2";

    const aliases = {
      "1": ["1", "ms1", "evsahibi", "home"],
      "x": ["x", "0", "msx", "ms0", "beraberlik", "draw"],
      "2": ["2", "ms2", "deplasman", "away"]
    };

    return aliases[actual].includes(selected);
  }

  if (marketKey === "KG") {
    if (!ft) return null;

    const actual = ft[0] > 0 && ft[1] > 0;

    if (["var", "kgvar", "yes"].includes(selected)) {
      return actual;
    }

    if (["yok", "kgyok", "no"].includes(selected)) {
      return !actual;
    }

    return null;
  }

  if (marketKey === "U25") {
    if (!ft) return null;

    const over = ft[0] + ft[1] >= 3;

    if (["ust", "over", "25ust"].includes(selected)) {
      return over;
    }

    if (["alt", "under", "25alt"].includes(selected)) {
      return !over;
    }

    return null;
  }

  if (marketKey === "IY15U") {
    if (!ht) return null;

    const over = ht[0] + ht[1] >= 2;

    if (["ust", "over", "iy15ust"].includes(selected)) {
      return over;
    }

    if (["alt", "under", "iy15alt"].includes(selected)) {
      return !over;
    }

    return null;
  }

  if (marketKey === "IY") {
    if (!ht) return null;

    const [home, away] = ht;

    const actual = home > away
      ? "1"
      : home === away
        ? "x"
        : "2";

    const aliases = {
      "1": ["1", "iy1", "iyevsahibi", "home"],
      "x": ["x", "0", "iyx", "iy0", "iyberaberlik", "draw"],
      "2": ["2", "iy2", "iydeplasman", "away"]
    };

    return aliases[actual].includes(selected);
  }

  return null;
}

function getMatchDate(match) {
  return String(
    match.date ??
    match.matchDate ??
    match.match_date ??
    match.tarih ??
    match.datetime ??
    match.kickoff ??
    ""
  );
}

function settledStatus(match, marketKey, pick) {
  const result = outcome(marketKey, pick, match);

  if (result === null) return "pending";

  return result ? "successful" : "failed";
}

async function main() {
  const sourceData = await readJson(DATA_PATH);
  const predictionData = await readJson(PREDICTIONS_PATH);

  const historyData = await readJson(
    HISTORY_PATH,
    { predictions: [] }
  );

  const sourceMatches = getRows(sourceData);
  const currentPredictions = predictionData?.predictions;

  if (!Array.isArray(currentPredictions)) {
    throw new Error(
      "ml-predictions.json içinde predictions listesi bulunamadı."
    );
  }

  const history = Array.isArray(historyData.predictions)
    ? historyData.predictions
    : [];

  const sourceByKey = new Map();

  for (const match of sourceMatches) {
    const key = matchKey(match);

    if (!key) continue;

    if (
      !sourceByKey.has(key) ||
      (!fullScore(sourceByKey.get(key)) && fullScore(match))
    ) {
      sourceByKey.set(key, match);
    }
  }

  const historyByKey = new Map(
    history
      .filter(item => item.matchKey)
      .map(item => [item.matchKey, item])
  );

  let added = 0;

  for (const match of currentPredictions) {
    const key = matchKey(match);

    if (!key || historyByKey.has(key)) continue;

    const best = mainPrediction(match);

    if (!best) continue;

    const record = {
      matchKey: key,
      date: getMatchDate(match),
      time: String(match.time ?? ""),
      league: String(match.league ?? ""),
      home: String(match.home ?? match.homeTeam ?? ""),
      away: String(match.away ?? match.awayTeam ?? ""),
      marketKey: best.key,
      marketTitle: best.title,
      pick: best.pick,
      probability: best.probability,
      predictedAt: predictionData.generatedAt ?? new Date().toISOString(),
      status: "pending",
      actualScore: null,
      actualHalfTimeScore: null
    };

    history.push(record);
    historyByKey.set(key, record);
    added++;
  }

  let settled = 0;
  let checked = 0;

  for (const record of history) {
    const sourceMatch = sourceByKey.get(record.matchKey);

    if (!sourceMatch) continue;

    const ft = fullScore(sourceMatch);

    // Tam maç sonucu bulunmadan tahmin sonuçlandırılmaz.
    if (!ft) continue;

    const result = settledStatus(
      sourceMatch,
      record.marketKey,
      record.pick
    );

    if (result === "pending") continue;

    checked++;

    const ht = halfScore(sourceMatch);
    const previousStatus = record.status;

    record.actualScore = `${ft[0]}-${ft[1]}`;
    record.actualHalfTimeScore = ht
      ? `${ht[0]}-${ht[1]}`
      : null;

    record.status = result;

    if (
      previousStatus !== result ||
      !record.settledAt
    ) {
      record.settledAt = new Date().toISOString();
      settled++;
    }
  }

  history.sort((a, b) =>
    dateKey(b.date).localeCompare(dateKey(a.date)) ||
    String(b.time).localeCompare(String(a.time))
  );

  const successful = history.filter(
    item => item.status === "successful"
  ).length;

  const failed = history.filter(
    item => item.status === "failed"
  ).length;

  const completed = successful + failed;

  await writeJson(HISTORY_PATH, {
    updatedAt: new Date().toISOString(),
    source: "data/v2-data.json",
    totalPredictions: history.length,
    completedPredictions: completed,
    successfulPredictions: successful,
    failedPredictions: failed,
    successRate: completed
      ? Number((successful / completed * 100).toFixed(2))
      : null,
    predictions: history
  });

  console.log(`Yeni geçmiş kaydı: ${added}`);
  console.log(`Sonuç eşleştirmesi yapılan kayıt: ${checked}`);
  console.log(`Yeni sonuçlandırılan kayıt: ${settled}`);
  console.log(`Toplam geçmiş tahmin: ${history.length}`);
  console.log(`Başarılı: ${successful}`);
  console.log(`Başarısız: ${failed}`);
  console.log(`Başarı oranı: ${completed ? (successful / completed * 100).toFixed(2) + "%" : "Henüz hesaplanamadı"}`);
}

main().catch(error => {
  console.error("ML geçmiş güncelleme hatası:", error);
  process.exitCode = 1;
});
