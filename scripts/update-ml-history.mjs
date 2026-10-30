
import fs from "node:fs/promises";
import path from "node:path";

const PREDICTIONS_PATH = "outputs/ml-predictions.json";
const DATA_PATH = "data/v2-data.json";
const HISTORY_PATH = "outputs/ml-prediction-history.json";

const ALGORITHMS = [
  "Random Forest",
  "XGBoost",
  "LightGBM",
  "CatBoost"
];

function parseScore(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2])
  };
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");
}

function makeMatchId(match) {
  return [
    match.date ?? "",
    match.time ?? "",
    match.league ?? "",
    match.home ?? "",
    match.away ?? ""
  ].join("|");
}

// Maçları boşluk ve harf farklılıklarından bağımsız karşılaştır.
function canonicalMatchId(match) {
  return [
    match.date,
    match.time,
    match.league,
    match.home,
    match.away
  ].map(normalize).join("|");
}

function parseKickoff(date, time) {
  const dateMatch = String(date ?? "").match(
    /^(\d{2})\.(\d{2})\.(\d{4})$/
  );

  const timeMatch = String(time ?? "").match(
    /^(\d{1,2}):(\d{2})$/
  );

  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) {
    return null;
  }

  const utc = Date.UTC(year, month - 1, day, hour - 3, minute);

  const check = new Date(utc + 3 * 60 * 60 * 1000);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  // Maç saatleri Türkiye yerel saati (UTC+3) kabul edilir.
  return utc;
}

function getConsensus(match, target) {
  const targetData = match.predictions?.[target];

  if (!targetData || typeof targetData !== "object") {
    return null;
  }

  const sums = new Map();
  const counts = new Map();

  for (const algorithm of ALGORITHMS) {
    const probabilities =
      targetData[algorithm]?.probabilities;

    if (!probabilities || typeof probabilities !== "object") {
      continue;
    }

    for (const [label, rawValue] of Object.entries(probabilities)) {
      const value = Number(rawValue);

      if (!Number.isFinite(value)) continue;

      sums.set(label, (sums.get(label) ?? 0) + value);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  if (!sums.size) return null;

  return [...sums.entries()]
    .map(([label, sum]) => ({
      label,
      probability: sum / counts.get(label)
    }))
    .sort((a, b) => b.probability - a.probability)[0].label;
}

function getActualTargets(ft, ht) {
  const actual = {};

  if (ft) {
    const total = ft.home + ft.away;

    actual["MS 1-X-2"] =
      ft.home > ft.away ? "1" :
      ft.home === ft.away ? "X" : "2";

    actual["KG Var-Yok"] =
      ft.home > 0 && ft.away > 0 ? "Var" : "Yok";

    actual["MS 1.5 Alt-Üst"] = total >= 2 ? "Üst" : "Alt";
    actual["MS 2.5 Alt-Üst"] = total >= 3 ? "Üst" : "Alt";
    actual["MS 3.5 Alt-Üst"] = total >= 4 ? "Üst" : "Alt";

    actual["Gol aralığı"] =
      total <= 1 ? "0-1" :
      total <= 3 ? "2-3" :
      total <= 5 ? "4-5" : "6+";
  }

  if (ht) {
    const total = ht.home + ht.away;

    actual["İY 0.5 Alt-Üst"] = total >= 1 ? "Üst" : "Alt";
    actual["İY 1.5 Alt-Üst"] = total >= 2 ? "Üst" : "Alt";

    actual["İY 1-X-2"] =
      ht.home > ht.away ? "1" :
      ht.home === ht.away ? "X" : "2";
  }

  return actual;
}

function getPredictedScore(match, period) {
  const scoreData = match.predictions?.["Skor tahmini"];

  if (!scoreData) return null;

  const homeValues = [];
  const awayValues = [];

  for (const algorithm of ALGORITHMS) {
    const item = scoreData[algorithm]?.[period];

    if (!item) continue;

    const home = Number(item.expectedHomeGoals);
    const away = Number(item.expectedAwayGoals);

    if (Number.isFinite(home)) homeValues.push(home);
    if (Number.isFinite(away)) awayValues.push(away);
  }

  if (!homeValues.length || !awayValues.length) return null;

  const average = values =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    home: Math.round(average(homeValues)),
    away: Math.round(average(awayValues))
  };
}

function evaluateMatch(archivedMatch, sourceMatch, now) {
  const ft = parseScore(sourceMatch.score);
  const ht = parseScore(sourceMatch.halfTimeScore);

  if (!ft) return false;

  const actualTargets = getActualTargets(ft, ht);
  const markets = {};

  for (const [target, actual] of Object.entries(actualTargets)) {
    const predicted = getConsensus(archivedMatch, target);

    if (predicted === null) continue;

    markets[target] = {
      prediction: predicted,
      actual,
      status: normalize(predicted) === normalize(actual)
        ? "correct"
        : "incorrect"
    };
  }

  const predictedFT = getPredictedScore(archivedMatch, "fullTime");
  const predictedHT = getPredictedScore(archivedMatch, "halfTime");

  const scores = {};

  if (predictedFT) {
    scores.fullTime = {
      prediction: `${predictedFT.home}-${predictedFT.away}`,
      actual: `${ft.home}-${ft.away}`,
      status:
        predictedFT.home === ft.home &&
        predictedFT.away === ft.away
          ? "correct"
          : "incorrect"
    };
  }

  if (predictedHT && ht) {
    scores.halfTime = {
      prediction: `${predictedHT.home}-${predictedHT.away}`,
      actual: `${ht.home}-${ht.away}`,
      status:
        predictedHT.home === ht.home &&
        predictedHT.away === ht.away
          ? "correct"
          : "incorrect"
    };
  }

  archivedMatch.evaluation = {
    status: "completed",
    evaluatedAt: new Date(now).toISOString(),
    fullTimeScore: `${ft.home}-${ft.away}`,
    halfTimeScore: ht ? `${ht.home}-${ht.away}` : null,
    markets,
    scores
  };

  return true;
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) {
      return fallback;
    }

    throw error;
  }
}

async function main() {
  const now = Date.now();

  const predictions = await readJson(PREDICTIONS_PATH);
  const sourceData = await readJson(DATA_PATH);

  if (!Array.isArray(predictions.matches)) {
    throw new Error("ml-predictions.json içinde matches listesi bulunamadı.");
  }

  if (!Array.isArray(sourceData.matches)) {
    throw new Error("v2-data.json içinde matches listesi bulunamadı.");
  }

  const history = await readJson(HISTORY_PATH, {
    createdAt: new Date(now).toISOString(),
    updatedAt: null,
    matchCount: 0,
    matches: []
  });

  if (!Array.isArray(history.matches)) {
    history.matches = [];
  }

  const archivedById = new Map();

  for (const item of history.matches) {
    const key = canonicalMatchId(item);

    if (key !== "||||") {
      archivedById.set(key, item);
    }
  }

  let added = 0;
  let evaluated = 0;
  let alreadyArchived = 0;
  let started = 0;
  let invalidDate = 0;
  let duplicateInPredictions = 0;
  let noPredictionData = 0;

  const predictionKeys = new Set();

  // 1. Yeni ve henüz başlamamış maçları arşivle.
  for (const match of predictions.matches) {
    const matchId = match.matchId || makeMatchId(match);
    const key = canonicalMatchId(match);

    if (key === "||||") {
      invalidDate++;
      continue;
    }

    if (predictionKeys.has(key)) {
      duplicateInPredictions++;
      continue;
    }

    predictionKeys.add(key);

    if (archivedById.has(key)) {
      alreadyArchived++;
      continue;
    }

    const kickoff = parseKickoff(match.date, match.time);

    if (kickoff === null) {
      invalidDate++;
      continue;
    }

    if (kickoff <= now) {
      started++;
      continue;
    }

    if (
      !match.predictions ||
      Object.keys(match.predictions).length === 0
    ) {
      noPredictionData++;
      continue;
    }

    const archivedMatch = {
      ...match,
      matchId,
      predictionCreatedAt:
        predictions.createdAt || new Date(now).toISOString(),
      evaluation: {
        status: "pending",
        evaluatedAt: null,
        fullTimeScore: null,
        halfTimeScore: null,
        markets: {},
        scores: {}
      }
    };

    history.matches.push(archivedMatch);
    archivedById.set(key, archivedMatch);
    added++;
  }

  // 2. Sonuçları maç kimliğine göre eşleştir.
  const sourceById = new Map();

  for (const match of sourceData.matches) {
    const key = canonicalMatchId(match);

    if (key !== "||||") {
      sourceById.set(key, match);
    }
  }

  // 3. Arşivdeki maçların sonuçlarını güncelle.
  for (const archivedMatch of history.matches) {
    const key = canonicalMatchId(archivedMatch);
    const sourceMatch = sourceById.get(key);

    if (!sourceMatch) continue;

    if (!parseScore(sourceMatch.score)) continue;

    const wasCompleted =
      archivedMatch.evaluation?.status === "completed";

    evaluateMatch(archivedMatch, sourceMatch, now);

    if (!wasCompleted) {
      evaluated++;
    }
  }

  // 4. Maçları tarihe göre sırala.
  history.matches.sort((a, b) => {
    const dateA = parseKickoff(a.date, a.time) ?? 0;
    const dateB = parseKickoff(b.date, b.time) ?? 0;

    return dateA - dateB;
  });

  history.updatedAt = new Date(now).toISOString();
  history.matchCount = history.matches.length;

  await fs.mkdir(path.dirname(HISTORY_PATH), {
    recursive: true
  });

  const temporaryPath = `${HISTORY_PATH}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(history, null, 2),
    "utf8"
  );

  await fs.rename(temporaryPath, HISTORY_PATH);

  console.log("-----------------------------------");
  console.log("ML TAHMİN ARŞİVİ GÜNCELLENDİ");
  console.log("-----------------------------------");
  console.log(`Tahmin dosyasındaki maç: ${predictions.matches.length}`);
  console.log(`Yeni arşivlenen maç: ${added}`);
  console.log(`Zaten arşivde olan maç: ${alreadyArchived}`);
  console.log(`Başlamış maç: ${started}`);
  console.log(`Geçersiz tarih/saat: ${invalidDate}`);
  console.log(`Tekrarlanan tahmin kaydı: ${duplicateInPredictions}`);
  console.log(`Tahmin verisi olmayan maç: ${noPredictionData}`);
  console.log(`Yeni sonuçlandırılan maç: ${evaluated}`);
  console.log(`Toplam arşiv maç sayısı: ${history.matchCount}`);
  console.log("-----------------------------------");
}

main().catch(error => {
  console.error("ML arşivleme hatası:", error);
  process.exit(1);
});
