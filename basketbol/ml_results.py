
import json
import math
from datetime import datetime, timezone
from pathlib import Path


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
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )

    temp_file.replace(OUTPUT_FILE)


def find_input_file():
    for path in INPUT_CANDIDATES:
        if path.is_file():
            return path

    raise FileNotFoundError("basketball.json bulunamadı.")


def load_existing_results():
    if not OUTPUT_FILE.exists():
        return {
            "createdAt": now_utc().isoformat(),
            "pending": [],
            "history": [],
            "backtestHistory": [],
        }

    data = load_json(OUTPUT_FILE)

    if not isinstance(data, dict):
        raise ValueError("ml-results.json formatı geçersiz.")

    data.setdefault("pending", [])
    data.setdefault("history", [])
    data.setdefault("backtestHistory", [])

    if not isinstance(data["pending"], list):
        data["pending"] = []

    if not isinstance(data["history"], list):
        data["history"] = []

    if not isinstance(data["backtestHistory"], list):
        data["backtestHistory"] = []

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


def normalize_match_id(value):
    """
    ESPN maç kimliğinin nba- gibi ön eklerini kaldırır.
    Örnek: nba-401909922 -> 401909922
    """
    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    lowered = value.lower()

    for prefix in ("nba-", "nba_", "nba:"):
        if lowered.startswith(prefix):
            return value[len(prefix):].strip()

    return value


def get_match_id(match):
    value = match.get("id")

    if value is None:
        value = match.get("sourceId")

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


def get_prediction_type(prediction):
    prediction_type = str(
        prediction.get("predictionType", "upcoming")
    ).strip().lower()

    if prediction_type == "historical_backtest":
        return "historical_backtest"

    return "upcoming"


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

    return match.get("played") is True


# ============================================================
# TAHMİN TEMİZLEME
# ============================================================

def clean_prediction(prediction):
    """
    Tahminin gerekli alanlarını kalıcı olarak saklar.
    Walk-forward geçmiş tahminleri de ayrıca tanımlar.
    """

    prediction_data = prediction.get("prediction", {})

    if not isinstance(prediction_data, dict):
        return None

    models = prediction_data.get("models", {})
    ensemble = prediction_data.get("ensemble", {})

    if not isinstance(models, dict):
        models = {}

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
                away_score,
            ),
        }

    clean_ensemble = None

    if isinstance(ensemble, dict):
        ensemble_home = safe_number(
            ensemble.get("homeScore")
        )

        ensemble_away = safe_number(
            ensemble.get("awayScore")
        )

        if (
            ensemble_home is not None
            and ensemble_away is not None
        ):
            clean_ensemble = {
                "homeScore": ensemble_home,
                "awayScore": ensemble_away,
                "totalScore": safe_number(
                    ensemble.get("totalScore")
                ),
                "winner": get_winner(
                    ensemble_home,
                    ensemble_away,
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
        "predictionType": get_prediction_type(prediction),
        "trainingSamplesBeforeMatch": prediction.get(
            "trainingSamplesBeforeMatch"
        ),
        "trainingCutoff": prediction.get("trainingCutoff"),
        "models": clean_models,
        "ensemble": clean_ensemble,
        "predictionCreatedAt": now_utc().isoformat(),
    }


# ============================================================
# SONUÇ EŞLEŞTİRME
# ============================================================

def build_match_lookup(matches):
    """
    Maçları hem id hem sourceId hem de normalize edilmiş kimlikleriyle
    indeksler. Böylece nba-401909922 ile 401909922 aynı maçı bulur.
    """
    lookup = {}

    for match in matches:
        if not isinstance(match, dict):
            continue

        raw_ids = (
            match.get("id"),
            match.get("sourceId"),
        )

        aliases = set()

        for raw_id in raw_ids:
            if raw_id is None:
                continue

            raw_id = str(raw_id).strip()

            if not raw_id:
                continue

            aliases.add(raw_id)

            normalized_id = normalize_match_id(raw_id)

            if normalized_id:
                aliases.add(normalized_id)

        if not aliases:
            continue

        # Aynı kimlik birden fazla kayıtta varsa tamamlanmış olanı koru.
        for alias in aliases:
            previous = lookup.get(alias)

            if previous is None:
                lookup[alias] = match
            elif is_finished(match) and not is_finished(previous):
                lookup[alias] = match

    return lookup


def evaluate_prediction(prediction, actual_match):
    actual_home = safe_score(
        actual_match,
        "homeScore",
    )

    actual_away = safe_score(
        actual_match,
        "awayScore",
    )

    if actual_home is None or actual_away is None:
        return None

    actual_total = actual_home + actual_away

    actual_winner = get_winner(
        actual_home,
        actual_away,
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

        if (
            predicted_home is None
            or predicted_away is None
        ):
            continue

        predicted_total = (
            predicted_home + predicted_away
        )

        predicted_winner = get_winner(
            predicted_home,
            predicted_away,
        )

        model_results[model_name] = {
            "predictedHome": round(predicted_home, 1),
            "predictedAway": round(predicted_away, 1),
            "predictedTotal": round(predicted_total, 1),

            "actualHome": actual_home,
            "actualAway": actual_away,
            "actualTotal": actual_total,

            "homeError": round(
                abs(predicted_home - actual_home),
                2,
            ),

            "awayError": round(
                abs(predicted_away - actual_away),
                2,
            ),

            "totalError": round(
                abs(predicted_total - actual_total),
                2,
            ),

            "predictedWinner": predicted_winner,
            "actualWinner": actual_winner,

            "winnerCorrect": (
                predicted_winner == actual_winner
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

        if (
            predicted_home is not None
            and predicted_away is not None
        ):
            predicted_total = (
                predicted_home + predicted_away
            )

            predicted_winner = get_winner(
                predicted_home,
                predicted_away,
            )

            model_results["Ensemble"] = {
                "predictedHome": round(predicted_home, 1),
                "predictedAway": round(predicted_away, 1),
                "predictedTotal": round(predicted_total, 1),

                "actualHome": actual_home,
                "actualAway": actual_away,
                "actualTotal": actual_total,

                "homeError": round(
                    abs(predicted_home - actual_home),
                    2,
                ),

                "awayError": round(
                    abs(predicted_away - actual_away),
                    2,
                ),

                "totalError": round(
                    abs(predicted_total - actual_total),
                    2,
                ),

                "predictedWinner": predicted_winner,
                "actualWinner": actual_winner,

                "winnerCorrect": (
                    predicted_winner == actual_winner
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

        "predictionType": get_prediction_type(
            prediction
        ),

        "trainingSamplesBeforeMatch": prediction.get(
            "trainingSamplesBeforeMatch"
        ),

        "trainingCutoff": prediction.get(
            "trainingCutoff"
        ),

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
# TAHMİN EKLEME
# ============================================================

def add_live_predictions(pending, history, predictions):
    """
    Yalnızca upcoming tahminlerini pending listesine ekler.
    Geçmiş backtest tahminlerini buraya almaz.
    """

    existing_ids = set()

    for item in pending + history:
        match_id = item.get("matchId")

        if match_id is not None:
            existing_ids.add(str(match_id))

    added = 0
    skipped_without_id = 0
    skipped_historical = 0
    skipped_existing = 0

    for prediction in predictions:
        if get_prediction_type(prediction) == "historical_backtest":
            skipped_historical += 1
            continue

        match_id = get_prediction_id(prediction)

        if not match_id:
            skipped_without_id += 1
            continue

        if match_id in existing_ids:
            skipped_existing += 1
            continue

        clean = clean_prediction(prediction)

        if clean is None:
            continue

        pending.append(clean)
        existing_ids.add(match_id)
        added += 1

    return {
        "added": added,
        "skippedWithoutId": skipped_without_id,
        "skippedHistorical": skipped_historical,
        "skippedExisting": skipped_existing,
    }


# ============================================================
# GEÇMİŞ WALK-FORWARD DEĞERLENDİRMESİ
# ============================================================

def process_backtest_predictions(
    backtest_history,
    predictions,
    match_lookup,
):
    """
    historical_backtest tahminlerini doğrudan değerlendirir.
    Bunlar canlı pending/history listelerine girmez.
    """

    existing_ids = {
        str(item.get("matchId"))
        for item in backtest_history
        if item.get("matchId") is not None
    }

    evaluated_count = 0
    skipped_existing = 0
    missing_matches = 0
    unfinished_matches = 0
    invalid_predictions = 0

    for prediction in predictions:
        if get_prediction_type(prediction) != "historical_backtest":
            continue

        match_id = get_prediction_id(prediction)

        if not match_id:
            invalid_predictions += 1
            continue

        if match_id in existing_ids:
            skipped_existing += 1
            continue

        actual_match = match_lookup.get(match_id)

        if actual_match is None:
            missing_matches += 1
            continue

        if not is_finished(actual_match):
            unfinished_matches += 1
            continue

        clean = clean_prediction(prediction)

        if clean is None:
            invalid_predictions += 1
            continue

        evaluated = evaluate_prediction(
            clean,
            actual_match,
        )

        if evaluated is None:
            invalid_predictions += 1
            continue

        backtest_history.append(evaluated)
        existing_ids.add(match_id)
        evaluated_count += 1

    return {
        "evaluated": evaluated_count,
        "alreadyExists": skipped_existing,
        "missingMatches": missing_matches,
        "unfinishedMatches": unfinished_matches,
        "invalidPredictions": invalid_predictions,
    }


# ============================================================
# ESKİ KAYITLARI AYIRMA
# ============================================================

def migrate_legacy_backtest_records(
    history,
    backtest_history,
    predictions,
):
    """
    Önceki sürümde historical_backtest kayıtları
    yanlışlıkla history listesine girmişse,
    güncel tahmin dosyasındaki predictionType bilgisiyle
    bunları backtestHistory listesine taşır.
    """

    historical_ids = {
        get_prediction_id(prediction)
        for prediction in predictions
        if get_prediction_type(prediction) == "historical_backtest"
    }

    historical_ids.discard(None)

    backtest_ids = {
        str(item.get("matchId"))
        for item in backtest_history
        if item.get("matchId") is not None
    }

    migrated = 0
    remaining_history = []

    for item in history:
        match_id = item.get("matchId")

        if (
            match_id is not None
            and str(match_id) in historical_ids
        ):
            match_id = str(match_id)

            if match_id not in backtest_ids:
                item["predictionType"] = "historical_backtest"
                backtest_history.append(item)
                backtest_ids.add(match_id)
                migrated += 1

            continue

        remaining_history.append(item)

    history[:] = remaining_history

    return migrated


def remove_historical_from_pending(
    pending,
    predictions,
):
    """
    Eski sürümden pending listesine girmiş geçmiş
    simülasyon tahminlerini temizler.
    """

    historical_ids = {
        get_prediction_id(prediction)
        for prediction in predictions
        if get_prediction_type(prediction) == "historical_backtest"
    }

    historical_ids.discard(None)

    remaining = []
    removed = 0

    for item in pending:
        match_id = item.get("matchId")

        if (
            match_id is not None
            and str(match_id) in historical_ids
        ):
            removed += 1
            continue

        remaining.append(item)

    pending[:] = remaining

    return removed


# ============================================================
# PERFORMANS HESAPLAMA
# ============================================================

def mean(values):
    valid = [
        value
        for value in values
        if value is not None
        and math.isfinite(float(value))
    ]

    if not valid:
        return None

    return round(
        sum(valid) / len(valid),
        3,
    )


def calculate_model_metrics(history):
    metrics = {}

    for model_name in ALL_MODELS:
        rows = [
            item.get("models", {}).get(model_name)
            for item in history
            if isinstance(
                item.get("models", {}).get(model_name),
                dict,
            )
        ]

        if not rows:
            continue

        count = len(rows)

        winner_correct = sum(
            1
            for row in rows
            if row.get("winnerCorrect") is True
        )

        total_errors = [
            row.get("totalError")
            for row in rows
        ]

        valid_total_errors = [
            value
            for value in total_errors
            if value is not None
        ]

        metrics[model_name] = {
            "matches": count,

            "homeMAE": mean([
                row.get("homeError")
                for row in rows
            ]),

            "awayMAE": mean([
                row.get("awayError")
                for row in rows
            ]),

            "totalMAE": mean(total_errors),

            "winnerCorrect": winner_correct,

            "winnerAccuracy": round(
                winner_correct / count * 100,
                2,
            ),

            "totalWithin5": (
                round(
                    sum(
                        1
                        for value in valid_total_errors
                        if value <= 5
                    ) / len(valid_total_errors) * 100,
                    2,
                )
                if valid_total_errors else None
            ),

            "totalWithin10": (
                round(
                    sum(
                        1
                        for value in valid_total_errors
                        if value <= 10
                    ) / len(valid_total_errors) * 100,
                    2,
                )
                if valid_total_errors else None
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
    print("=" * 65)
    print("NBA ML SONUÇ VE PERFORMANS SİSTEMİ")
    print("=" * 65)

    input_file = find_input_file()

    basketball_data = load_json(input_file)
    prediction_data = load_json(PREDICTIONS_FILE)

    matches = basketball_data.get("matches", [])
    predictions = prediction_data.get("predictions", [])

    if not isinstance(matches, list):
        raise ValueError(
            "basketball.json matches alanı geçersiz."
        )

    if not isinstance(predictions, list):
        raise ValueError(
            "ml-predictions.json predictions alanı geçersiz."
        )

    results = load_existing_results()

    pending = results["pending"]
    history = results["history"]
    backtest_history = results["backtestHistory"]

    print("Basketbol kayıtları:", len(matches))
    print("ML tahminleri:", len(predictions))
    print("Önceki canlı bekleyen:", len(pending))
    print("Önceki canlı geçmiş:", len(history))
    print("Önceki backtest geçmişi:", len(backtest_history))

    match_lookup = build_match_lookup(matches)

    # --------------------------------------------------------
    # 1. Önceki sürümden kalan kayıtları ayır.
    # --------------------------------------------------------

    migrated = migrate_legacy_backtest_records(
        history,
        backtest_history,
        predictions,
    )

    removed_historical_pending = (
        remove_historical_from_pending(
            pending,
            predictions,
        )
    )

    # --------------------------------------------------------
    # 2. Geçmiş walk-forward tahminlerini değerlendir.
    # --------------------------------------------------------

    backtest_report = process_backtest_predictions(
        backtest_history,
        predictions,
        match_lookup,
    )

    # --------------------------------------------------------
    # 3. Sadece gelecek tahminlerini pending'e ekle.
    # --------------------------------------------------------

    live_add_report = add_live_predictions(
        pending,
        history,
        predictions,
    )

    # --------------------------------------------------------
    # 4. Canlı tahminleri sonuçlandıkça değerlendir.
    # --------------------------------------------------------

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
        match_id = str(
            prediction.get("matchId", "")
        ).strip()

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
            actual_match,
        )

        if evaluated is None:
            remaining.append(prediction)
            invalid_predictions += 1
            continue

        evaluated["predictionType"] = "upcoming"

        history.append(evaluated)
        evaluated_ids.add(match_id)
        newly_evaluated += 1

        actual = evaluated["actual"]

        print(
            "CANLI SONUÇ:",
            evaluated["homeTeam"],
            actual["homeScore"],
            "-",
            actual["awayScore"],
            evaluated["awayTeam"],
        )

    # --------------------------------------------------------
    # 5. İki sistemin performansını ayrı hesapla.
    # --------------------------------------------------------

    live_metrics = calculate_model_metrics(history)
    live_rankings = build_rankings(live_metrics)

    backtest_metrics = calculate_model_metrics(
        backtest_history
    )

    backtest_rankings = build_rankings(
        backtest_metrics
    )

    # --------------------------------------------------------
    # 6. JSON çıktısını oluştur.
    # --------------------------------------------------------

    results["updatedAt"] = now_utc().isoformat()

    results["source"] = (
        "basketball.json + ml-predictions.json"
    )

    results["league"] = "NBA"

    results["summary"] = {
        "totalEvaluatedMatches": len(history),
        "pendingMatches": len(remaining),
        "newlyEvaluatedMatches": newly_evaluated,
        "newPredictionsAdded": live_add_report["added"],
        "missingSourceMatches": missing_matches,
        "invalidPredictions": invalid_predictions,
        "predictionsWithoutMatchId": (
            live_add_report["skippedWithoutId"]
        ),
        "modelCount": len(live_metrics),
    }

    results["backtestSummary"] = {
        "totalHistoricalCandidates": sum(
            1
            for prediction in predictions
            if get_prediction_type(prediction) == "historical_backtest"
        ),
        "totalEvaluatedMatches": len(backtest_history),
        "newlyEvaluatedMatches": backtest_report["evaluated"],
        "alreadyEvaluatedMatches": (
            backtest_report["alreadyExists"]
        ),
        "missingSourceMatches": (
            backtest_report["missingMatches"]
        ),
        "unfinishedMatches": (
            backtest_report["unfinishedMatches"]
        ),
        "invalidPredictions": (
            backtest_report["invalidPredictions"]
        ),
        "migratedLegacyRecords": migrated,
        "removedHistoricalPending": (
            removed_historical_pending
        ),
        "modelCount": len(backtest_metrics),
    }

    # Canlı tahmin performansı
    results["metrics"] = live_metrics
    results["rankings"] = live_rankings

    # Geçmiş walk-forward performansı
    results["backtestMetrics"] = backtest_metrics
    results["backtestRankings"] = backtest_rankings

    # Ayrı kayıt listeleri
    results["pending"] = remaining
    results["history"] = history
    results["backtestHistory"] = backtest_history

    save_json(results)

    # --------------------------------------------------------
    # 7. Konsol raporu.
    # --------------------------------------------------------

    print("\n" + "=" * 65)
    print("GEÇMİŞ WALK-FORWARD PERFORMANSI")
    print("-" * 65)

    if not backtest_metrics:
        print("Henüz değerlendirilen geçmiş maç yok.")
    else:
        for item in backtest_rankings:
            name = item["model"]
            data = backtest_metrics[name]

            print(
                f"{name}: "
                f"Maç={data['matches']} | "
                f"Toplam MAE={data['totalMAE']} | "
                f"Kazanan={data['winnerAccuracy']}%"
            )

    print("\n" + "=" * 65)
    print("GERÇEK ZAMANLI TAHMİN PERFORMANSI")
    print("-" * 65)

    if not live_metrics:
        print("Henüz değerlendirilen canlı tahmin yok.")
    else:
        for item in live_rankings:
            name = item["model"]
            data = live_metrics[name]

            print(
                f"{name}: "
                f"Maç={data['matches']} | "
                f"Toplam MAE={data['totalMAE']} | "
                f"Kazanan={data['winnerAccuracy']}%"
            )

    print("\n" + "=" * 65)
    print("İŞLEM ÖZETİ")
    print("-" * 65)

    print(
        "Yeni backtest değerlendirmesi:",
        backtest_report["evaluated"],
    )

    print(
        "Toplam backtest geçmişi:",
        len(backtest_history),
    )

    print(
        "Yeni canlı tahmin:",
        live_add_report["added"],
    )

    print(
        "Yeni canlı değerlendirme:",
        newly_evaluated,
    )

    print(
        "Bekleyen canlı tahmin:",
        len(remaining),
    )

    print(
        "Toplam canlı geçmiş:",
        len(history),
    )

    print("Eski kayıt taşınması:", migrated)
    print("Çıktı:", OUTPUT_FILE)

    print("=" * 65)


if __name__ == "__main__":
    main()
