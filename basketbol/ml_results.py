
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter


# ============================================================
# AYARLAR
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

INPUT_CANDIDATES = [
    BASE_DIR / "basketball.json",
    BASE_DIR / "data" / "basketball.json",
]

PREDICTIONS_FILE = BASE_DIR / "ml-predictions.json"
OUTPUT_FILE = BASE_DIR / "ml-results.json"

MODEL_NAMES = [
    "RandomForest",
    "XGBoost",
    "LightGBM",
    "CatBoost",
]

ALL_MODELS = MODEL_NAMES + ["Ensemble"]


# ============================================================
# DOSYA İŞLEMLERİ
# ============================================================

def load_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(data):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    temp_file = OUTPUT_FILE.with_suffix(".tmp")

    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)

    temp_file.replace(OUTPUT_FILE)


def find_input_file():
    for path in INPUT_CANDIDATES:
        if path.is_file():
            return path

    raise FileNotFoundError("basketball.json bulunamadı.")


def load_existing_results():
    if not OUTPUT_FILE.exists():
        return {
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "pending": [],
            "history": [],
        }

    data = load_json(OUTPUT_FILE)

    if not isinstance(data, dict):
        raise ValueError("ml-results.json formatı geçersiz.")

    data.setdefault("pending", [])
    data.setdefault("history", [])

    return data


# ============================================================
# GENEL YARDIMCILAR
# ============================================================

def now_utc():
    return datetime.now(timezone.utc)


def safe_number(value):
    try:
        if value is None or value == "":
            return None

        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (ValueError, TypeError):
        return None


def safe_score(match, key):
    score = safe_number(match.get(key))

    if score is None or score < 0:
        return None

    return score


def get_match_id(match):
    value = match.get("id")

    if value is None:
        return None

    return str(value).strip()


def get_prediction_id(prediction):
    value = prediction.get("matchId")

    if value is None:
        return None

    return str(value).strip()


def get_status(match):
    return str(match.get("status", "")).strip().upper()


def get_winner(home_score, away_score):
    if home_score > away_score:
        return "HOME"

    if away_score > home_score:
        return "AWAY"

    return "TIE"


# ============================================================
# MAÇ SONU KONTROLÜ
# ============================================================

def is_finished(match):
    status = get_status(match)

    cancelled_words = (
        "POSTPONED",
        "CANCELED",
        "CANCELLED",
        "ABANDONED",
        "SUSPENDED",
    )

    if any(word in status for word in cancelled_words):
        return False

    live_words = (
        "IN_PROGRESS",
        "IN PROGRESS",
        "LIVE",
        "HALFTIME",
        "HALF_TIME",
        "STATUS_IN_PROGRESS",
    )

    if any(word in status for word in live_words):
        return False

    home_score = safe_score(match, "homeScore")
    away_score = safe_score(match, "awayScore")

    if home_score is None or away_score is None:
        return False

    final_words = (
        "FINAL",
        "COMPLETED",
        "FINISHED",
        "STATUS_FINAL",
        "STATUS_COMPLETED",
    )

    if any(word in status for word in final_words):
        return True

    played = match.get("played")

    return played is True


# ============================================================
# TAHMİN KAYITLARI
# ============================================================

def clean_prediction(prediction):
    """
    Tahmin dosyasındaki gerekli alanları saklar.
    Sonradan ml-predictions.json değişse bile
    eski tahminler kaybolmaz.
    """

    prediction_data = prediction.get("prediction", {})

    models = prediction_data.get("models", {})
    ensemble = prediction_data.get("ensemble", {})

    clean_models = {}

    for model_name in MODEL_NAMES:
        model = models.get(model_name)

        if not isinstance(model, dict):
            continue

        home_score = safe_number(model.get("homeScore"))
        away_score = safe_number(model.get("awayScore"))

        if home_score is None or away_score is None:
            continue

        clean_models[model_name] = {
            "homeScore": home_score,
            "awayScore": away_score,
            "totalScore": safe_number(
                model.get("totalScore")
            ),
            "winner": get_winner(
                home_score,
                away_score
            ),
        }

    ensemble_home = safe_number(
        ensemble.get("homeScore")
    )

    ensemble_away = safe_number(
        ensemble.get("awayScore")
    )

    clean_ensemble = None

    if ensemble_home is not None and ensemble_away is not None:
        clean_ensemble = {
            "homeScore": ensemble_home,
            "awayScore": ensemble_away,
            "totalScore": safe_number(
                ensemble.get("totalScore")
            ),
            "winner": get_winner(
                ensemble_home,
                ensemble_away
            ),
        }

    if not clean_models and clean_ensemble is None:
        return None

    return {
        "matchId": get_prediction_id(prediction),
        "date": prediction.get("date"),
        "utcDate": prediction.get("utcDate"),
        "league": prediction.get("league", "NBA"),
        "homeTeam": prediction.get("homeTeam"),
        "awayTeam": prediction.get("awayTeam"),
        "models": clean_models,
        "ensemble": clean_ensemble,
        "predictionCreatedAt": now_utc().isoformat(),
    }


def add_new_predictions(pending, predictions):
    existing_ids = {
        str(item.get("matchId"))
        for item in pending
        if item.get("matchId") is not None
    }

    added = 0
    skipped_without_id = 0

    for prediction in predictions:
        match_id = get_prediction_id(prediction)

        if not match_id:
            skipped_without_id += 1
            continue

        if match_id in existing_ids:
            continue

        clean = clean_prediction(prediction)

        if clean is None:
            continue

        pending.append(clean)
        existing_ids.add(match_id)
        added += 1

    return added, skipped_without_id


# ============================================================
# SONUÇ EŞLEŞTİRME
# ============================================================

def build_match_lookup(matches):
    lookup = {}

    for match in matches:
        match_id = get_match_id(match)

        if not match_id:
            continue

        lookup[match_id] = match

    return lookup


def evaluate_prediction(prediction, actual_match):
    actual_home = safe_score(
        actual_match, "homeScore"
    )

    actual_away = safe_score(
        actual_match, "awayScore"
    )

    if actual_home is None or actual_away is None:
        return None

    actual_total = actual_home + actual_away
    actual_winner = get_winner(
        actual_home,
        actual_away
    )

    model_results = {}

    for model_name, model in prediction.get(
        "models", {}
    ).items():

        predicted_home = safe_number(
            model.get("homeScore")
        )

        predicted_away = safe_number(
            model.get("awayScore")
        )

        if predicted_home is None or predicted_away is None:
            continue

        predicted_total = predicted_home + predicted_away

        model_results[model_name] = {
            "predictedHome": round(predicted_home, 1),
            "predictedAway": round(predicted_away, 1),
            "predictedTotal": round(predicted_total, 1),
            "actualHome": actual_home,
            "actualAway": actual_away,
            "actualTotal": actual_total,
            "homeError": round(
                abs(predicted_home - actual_home), 2
            ),
            "awayError": round(
                abs(predicted_away - actual_away), 2
            ),
            "totalError": round(
                abs(predicted_total - actual_total), 2
            ),
            "predictedWinner": get_winner(
                predicted_home,
                predicted_away
            ),
            "actualWinner": actual_winner,
            "winnerCorrect": (
                get_winner(
                    predicted_home,
                    predicted_away
                ) == actual_winner
            ),
        }

    ensemble = prediction.get("ensemble")

    if isinstance(ensemble, dict):
        predicted_home = safe_number(
            ensemble.get("homeScore")
        )

        predicted_away = safe_number(
            ensemble.get("awayScore")
        )

        if predicted_home is not None and predicted_away is not None:
            predicted_total = predicted_home + predicted_away

            model_results["Ensemble"] = {
                "predictedHome": round(predicted_home, 1),
                "predictedAway": round(predicted_away, 1),
                "predictedTotal": round(predicted_total, 1),
                "actualHome": actual_home,
                "actualAway": actual_away,
                "actualTotal": actual_total,
                "homeError": round(
                    abs(predicted_home - actual_home), 2
                ),
                "awayError": round(
                    abs(predicted_away - actual_away), 2
                ),
                "totalError": round(
                    abs(predicted_total - actual_total), 2
                ),
                "predictedWinner": get_winner(
                    predicted_home,
                    predicted_away
                ),
                "actualWinner": actual_winner,
                "winnerCorrect": (
                    get_winner(
                        predicted_home,
                        predicted_away
                    ) == actual_winner
                ),
            }

    if not model_results:
        return None

    return {
        "matchId": prediction.get("matchId"),
        "date": prediction.get("date"),
        "utcDate": prediction.get("utcDate"),
        "homeTeam": prediction.get("homeTeam"),
        "awayTeam": prediction.get("awayTeam"),
        "status": "evaluated",
        "evaluatedAt": now_utc().isoformat(),
        "actual": {
            "homeScore": actual_home,
            "awayScore": actual_away,
            "totalScore": actual_total,
            "winner": actual_winner,
        },
        "models": model_results,
    }


# ============================================================
# PERFORMANS HESAPLAMA
# ============================================================

def mean(values):
    valid = [
        value for value in values
        if value is not None
        and math.isfinite(float(value))
    ]

    if not valid:
        return None

    return round(sum(valid) / len(valid), 3)


def calculate_model_metrics(history):
    metrics = {}

    for model_name in ALL_MODELS:
        rows = [
            item.get("models", {}).get(model_name)
            for item in history
            if isinstance(
                item.get("models", {}).get(model_name),
                dict
            )
        ]

        if not rows:
            continue

        count = len(rows)

        winner_correct = sum(
            1 for row in rows
            if row.get("winnerCorrect") is True
        )

        total_errors = [
            row.get("totalError") for row in rows
        ]

        winner_accuracy = (
            round(winner_correct / count * 100, 2)
        )

        metrics[model_name] = {
            "matches": count,

            "homeMAE": mean([
                row.get("homeError") for row in rows
            ]),

            "awayMAE": mean([
                row.get("awayError") for row in rows
            ]),

            "totalMAE": mean(total_errors),

            "winnerCorrect": winner_correct,

            "winnerAccuracy": winner_accuracy,

            "totalWithin5": round(
                sum(
                    1 for value in total_errors
                    if value is not None and value <= 5
                ) / count * 100,
                2
            ),

            "totalWithin10": round(
                sum(
                    1 for value in total_errors
                    if value is not None and value <= 10
                ) / count * 100,
                2
            ),
        }

    return metrics


def build_rankings(metrics):
    rankings = []

    for model_name, values in metrics.items():
        rankings.append({
            "model": model_name,
            "matches": values["matches"],
            "totalMAE": values["totalMAE"],
            "winnerAccuracy": values["winnerAccuracy"],
        })

    rankings.sort(
        key=lambda item: (
            item["totalMAE"]
            if item["totalMAE"] is not None
            else float("inf")
        )
    )

    for index, item in enumerate(rankings, start=1):
        item["rank"] = index

    return rankings


# ============================================================
# ANA İŞLEM
# ============================================================

def main():
    print("=" * 60)
    print("NBA ML SONUÇ VE PERFORMANS SİSTEMİ")
    print("=" * 60)

    input_file = find_input_file()

    basketball_data = load_json(input_file)
    prediction_data = load_json(PREDICTIONS_FILE)

    matches = basketball_data.get("matches", [])
    predictions = prediction_data.get("predictions", [])

    if not isinstance(matches, list):
        raise ValueError("basketball.json matches alanı geçersiz.")

    if not isinstance(predictions, list):
        raise ValueError("ml-predictions.json predictions alanı geçersiz.")

    results = load_existing_results()

    pending = results["pending"]
    history = results["history"]

    print("Basketbol kayıtları:", len(matches))
    print("Yeni ML tahminleri:", len(predictions))
    print("Önceki bekleyen tahmin:", len(pending))
    print("Önceki değerlendirilen maç:", len(history))

    # 1. Yeni tahminleri kalıcı bekleyen listeye ekle.
    added, skipped_without_id = add_new_predictions(
        pending,
        predictions
    )

    # 2. Maçları ID üzerinden eşleştir.
    match_lookup = build_match_lookup(matches)

    evaluated_ids = {
        str(item.get("matchId"))
        for item in history
        if item.get("matchId") is not None
    }

    remaining = []
    newly_evaluated = 0
    missing_matches = 0
    invalid_predictions = 0

    for prediction in pending:
        match_id = str(prediction.get("matchId", ""))

        if not match_id:
            invalid_predictions += 1
            continue

        if match_id in evaluated_ids:
            continue

        actual_match = match_lookup.get(match_id)

        if actual_match is None:
            remaining.append(prediction)
            missing_matches += 1
            continue

        if not is_finished(actual_match):
            remaining.append(prediction)
            continue

        evaluated = evaluate_prediction(
            prediction,
            actual_match
        )

        if evaluated is None:
            remaining.append(prediction)
            invalid_predictions += 1
            continue

        history.append(evaluated)
        evaluated_ids.add(match_id)
        newly_evaluated += 1

        actual = evaluated["actual"]

        print(
            "SONUÇ:",
            evaluated["homeTeam"],
            actual["homeScore"],
            "-",
            actual["awayScore"],
            evaluated["awayTeam"]
        )

    # 3. Güncel performans hesapla.
    metrics = calculate_model_metrics(history)
    rankings = build_rankings(metrics)

    # 4. Bekleyen maçları ve geçmişi kaydet.
    results["updatedAt"] = now_utc().isoformat()
    results["source"] = "basketball.json + ml-predictions.json"
    results["league"] = "NBA"

    results["summary"] = {
        "totalEvaluatedMatches": len(history),
        "pendingMatches": len(remaining),
        "newlyEvaluatedMatches": newly_evaluated,
        "newPredictionsAdded": added,
        "missingSourceMatches": missing_matches,
        "invalidPredictions": invalid_predictions,
        "predictionsWithoutMatchId": skipped_without_id,
        "modelCount": len(metrics),
    }

    results["metrics"] = metrics
    results["rankings"] = rankings
    results["pending"] = remaining
    results["history"] = history

    save_json(results)

    # 5. Konsol raporu.
    print("\nMODEL PERFORMANSI")
    print("-" * 60)

    if not metrics:
        print("Henüz değerlendirilen maç yok.")
    else:
        for item in rankings:
            name = item["model"]
            data = metrics[name]

            print(
                f"{name}: "
                f"Maç={data['matches']} | "
                f"Toplam MAE={data['totalMAE']} | "
                f"Kazanan={data['winnerAccuracy']}%"
            )

    print("\nİŞLEM ÖZETİ")
    print("-" * 60)
    print("Yeni eklenen tahmin:", added)
    print("Yeni değerlendirilen maç:", newly_evaluated)
    print("Bekleyen tahmin:", len(remaining))
    print("Toplam değerlendirilen maç:", len(history))
    print("Çıktı:", OUTPUT_FILE)
    print("=" * 60)


if __name__ == "__main__":
    main()
