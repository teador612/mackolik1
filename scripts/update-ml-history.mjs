
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
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function score(value) {
  if (value && typeof value === "object") {
    const home = Number(value.home ?? value.h ?? value.homeScore);
    const away = Number(value.away ?? value.a ?? value.awayScore);
    if (
      Number.isInteger(home) && home >= 0 &&
      Number.isInteger(away) && away >= 0
    ) return [home, away];
    return null;
  }

  const match = String(value ?? "").match(/^\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
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
    "score", "fullTimeScore", "full_time_score", "ft",
    "resultScore", "skor", "sonuc"
  ]);
}

function halfScore(match) {
  return getScore(match, [
    "halfTimeScore", "half_time_score", "ht",
    "iySkor", "halfScore", "devreSkoru"
  ]);
}

function matchKey(match) {
  const home = text(match.home ?? match.homeTeam);
  const away = text(match.away ?? match.awayTeam);
  const date = dateKey(match.date ?? match.matchDate ?? match.match_date ?? match.tarih ?? match.datetime ?? match.kickoff);

  if (!home || !away || !date) return "";
  return `${date}|${home}|${away}`;
}

function mainPrediction(match) {
  const markets = Object.entries(match.markets ?? {})
    .map(([key, market]) => ({
      key,
      title: market?.title ?? key,
      pick: market?.pick,
      probability: Number(market?.probability),
      options: Array.isArray(market?.options) ? market.options : []
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

function outcome(marketKey, pick, match) {
  const ft = fullScore(match);
  const ht = halfScore(match);
  const selected = text(pick);

  if (marketKey === "MS") {
    if (!ft) return null;
    const [h, a] = ft;
    const actual = h > a ? "ms1" : h === a ? "msx" : "ms2";
    return selected === actual;
  }

  if (marketKey === "KG") {
    if (!ft) return null;
    const actual = ft[0] > 0 && ft[1] > 0;
    if (selected === "var") return actual;
    if (selected === "yok") return !actual;
    return null;
  }

  if (marketKey === "U25") {
    if (!ft) return null;
    const over = ft[0] + ft[1] >= 3;
    if (selected === "ust") return over;
    if (selected === "alt") return !over;
    return null;
  }

  if (marketKey === "IY15U") {
    if (!ht) return null;
    const over = ht[0] + ht[1] >= 2;
    if (selected === "ust") return over;
    if (selected === "alt") return !over;
    return null;
  }

  if (marketKey === "IY") {
    if (!ht) return null;
    const [h, a] = ht;
    const actual = h > a ? "iy1" : h === a ? "iyx" : "iy2";
    return selected === actual;
  }

  return null;
}

function getMatchDate(match) {
  return String(
    match.date ?? match.matchDate ?? match.match_date ??
    match.tarih ?? match.datetime ?? match.kickoff ?? ""
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
  const historyData = await readJson(HISTORY_PATH, { predictions: [] });

  const sourceMatches = getRows(sourceData);
  const currentPredictions = predictionData?.predictions;

  if (!Array.isArray(currentPredictions)) {
    throw new Error("ml-predictions.json içinde predictions listesi bulunamadı.");
  }

  const history = Array.isArray(historyData.predictions)
    ? historyData.predictions
    : [];

  const sourceByKey = new Map();
  for (const match of sourceMatches) {
    const key = matchKey(match);
    if (key) {
      // Aynı takım ve tarihe ait kayıtlar varsa skoru bulunan kayıt tercih edilir.
      if (!sourceByKey.has(key) || fullScore(match)) {
        sourceByKey.set(key, match);
      }
    }
  }

  const historyByKey = new Map(
    history.filter(item => item.matchKey).map(item => [item.matchKey, item])
  );

  let added = 0;

  for (const match of currentPredictions) {
    const key = matchKey(match);
    if (!key) continue;

    const best = mainPrediction(match);
    if (!best) continue;

    if (!historyByKey.has(key)) {
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
  }

  let settled = 0;

  for (const record of history) {
    const sourceMatch = sourceByKey.get(record.matchKey);
    if (!sourceMatch) continue;

    const ft = fullScore(sourceMatch);
    if (!ft) continue;

    const result = settledStatus(sourceMatch, record.marketKey, record.pick);
    if (result === "pending") continue;

    record.actualScore = `${ft[0]}-${ft[1]}`;

    const ht = halfScore(sourceMatch);
    record.actualHalfTimeScore = ht ? `${ht[0]}-${ht[1]}` : null;

    record.status = result;
    record.settledAt = new Date().toISOString();
    settled++;
  }

  history.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.time).localeCompare(String(a.time))
  );

  const successful = history.filter(item => item.status === "successful").length;
  const failed = history.filter(item => item.status === "failed").length;
  const completed = successful + failed;

  await writeJson(HISTORY_PATH, {
    updatedAt: new Date().toISOString(),
    source: "data/v2-data.json",
    totalPredictions: history.length,
    completedPredictions: completed,
    successfulPredictions: successful,
    failedPredictions: failed,
    successRate: completed ? Number((successful / completed * 100).toFixed(2)) : null,
    predictions: history
  });

  console.log(`Yeni geçmiş kaydı: ${added}`);
  console.log(`Sonuçlanmış kayıt kontrolü: ${settled}`);
  console.log(`Toplam geçmiş tahmin: ${history.length}`);
  console.log(`Başarılı: ${successful}, başarısız: ${failed}`);
}

main().catch(error => {
  console.error("ML geçmiş güncelleme hatası:", error);
  process.exitCode = 1;
});
