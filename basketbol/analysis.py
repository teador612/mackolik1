
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone


BASE_DIR = Path(__file__).resolve().parent

INPUT_FILE = BASE_DIR / "predictions.json"
OUTPUT_FILE = BASE_DIR / "analysis.json"


def load_predictions():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Dosya bulunamadı: {INPUT_FILE}")

    with INPUT_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    predictions = data.get("predictions", [])

    if not isinstance(predictions, list):
        raise RuntimeError("predictions alanı liste değil.")

    return predictions


def safe_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def percentage(successful, total):
    if total <= 0:
        return 0.0
    return round(successful / total * 100, 2)


def normalize_prediction(value):
    if value is None:
        return None

    value = str(value).strip().upper()

    if value in ("ÜST", "UST", "OVER"):
        return "ÜST"

    if value in ("ALT", "UNDER"):
        return "ALT"

    return None


def empty_stats():
    return {
        "total": 0,
        "completed": 0,
        "successful": 0,
        "failed": 0,
        "push": 0,
        "successRate": 0.0,
        "averageError": 0.0,
        "_errorSum": 0.0,
        "_errorCount": 0
    }


def add_result(stats, prediction, actual_total):
    stats["total"] += 1
    stats["completed"] += 1

    line = safe_float(prediction.get("line"))
    predicted = normalize_prediction(prediction.get("prediction"))

    if line is None or actual_total is None or predicted is None:
        return

    difference = abs(actual_total - line)

    stats["_errorSum"] += difference
    stats["_errorCount"] += 1

    if actual_total == line:
        stats["push"] += 1
        return

    actual_result = "ÜST" if actual_total > line else "ALT"

    if predicted == actual_result:
        stats["successful"] += 1
    else:
        stats["failed"] += 1


def finalize_stats(stats):
    evaluated = stats["successful"] + stats["failed"]

    stats["successRate"] = percentage(
        stats["successful"],
        evaluated
    )

    if stats["_errorCount"]:
        stats["averageError"] = round(
            stats["_errorSum"] / stats["_errorCount"],
            2
        )

    stats.pop("_errorSum", None)
    stats.pop("_errorCount", None)

    return stats


def get_bucket(value, ranges):
    if value is None:
        return "Bilinmiyor"

    for upper, name in ranges:
        if value < upper:
            return name

    return ranges[-1][1]


def analyze():
    predictions = load_predictions()

    overall = empty_stats()

    leagues = defaultdict(empty_stats)
    prediction_types = defaultdict(empty_stats)
    line_ranges = defaultdict(empty_stats)
    confidence_ranges = defaultdict(empty_stats)
    sample_ranges = defaultdict(empty_stats)

    completed_rows = []

    line_buckets = [
        (210, "200-209"),
        (220, "210-219"),
        (230, "220-229"),
        (240, "230-239"),
        (float("inf"), "240+")
    ]

    confidence_buckets = [
        (60, "50-59"),
        (70, "60-69"),
        (80, "70-79"),
        (90, "80-89"),
        (float("inf"), "90+")
    ]

    sample_buckets = [
        (5, "0-4"),
        (8, "5-7"),
        (11, "8-10"),
        (float("inf"), "11+")
    ]

    for prediction in predictions:
        if not isinstance(prediction, dict):
            continue

        if prediction.get("played") is not True:
            continue

        home_score = safe_float(prediction.get("homeScore"))
        away_score = safe_float(prediction.get("awayScore"))

        if home_score is None or away_score is None:
            continue

        line = safe_float(prediction.get("line"))
        predicted = normalize_prediction(prediction.get("prediction"))

        # Ana Alt/Üst tahmini olmayan maçlar analize alınmaz.
        if line is None or predicted is None:
            continue

        actual_total = home_score + away_score

        league = prediction.get("league") or "Bilinmiyor"

        # Genel istatistik
        add_result(overall, prediction, actual_total)

        # Lig istatistiği
        add_result(
            leagues[league],
            prediction,
            actual_total
        )

        # ALT / ÜST istatistiği
        add_result(
            prediction_types[predicted],
            prediction,
            actual_total
        )

        # Barem aralığı
        line_range = get_bucket(line, line_buckets)

        add_result(
            line_ranges[line_range],
            prediction,
            actual_total
        )

        # Güven oranı
        confidence = safe_float(prediction.get("confidence"))

        if confidence is not None:
            confidence_range = get_bucket(
                confidence,
                confidence_buckets
            )

            add_result(
                confidence_ranges[confidence_range],
                prediction,
                actual_total
            )

        # Geçmiş maç örneklemi
        home_sample = safe_float(prediction.get("homeSample"))
        away_sample = safe_float(prediction.get("awaySample"))

        if home_sample is not None and away_sample is not None:
            sample_count = min(home_sample, away_sample)

            sample_range = get_bucket(
                sample_count,
                sample_buckets
            )

            add_result(
                sample_ranges[sample_range],
                prediction,
                actual_total
            )

        actual_result = (
            "ÜST" if actual_total > line
            else "ALT" if actual_total < line
            else "PUSH"
        )

        if actual_result == "PUSH":
            status = "Push"
            success = None
        else:
            success = predicted == actual_result
            status = "Başarılı" if success else "Başarısız"

        completed_rows.append({
            "id": prediction.get("id"),
            "league": league,
            "season": prediction.get("season"),
            "date": prediction.get("date"),
            "home": prediction.get("homeTeam") or prediction.get("home"),
            "away": prediction.get("awayTeam") or prediction.get("away"),
            "prediction": predicted,
            "line": line,
            "confidence": confidence,
            "homeSample": home_sample,
            "awaySample": away_sample,
            "expectedTotal": prediction.get("expectedTotal"),
            "homeScore": home_score,
            "awayScore": away_score,
            "actualTotal": actual_total,
            "difference": round(actual_total - line, 2),
            "absoluteError": round(abs(actual_total - line), 2),
            "actualResult": actual_result,
            "status": status,
            "success": success
        })

    overall = finalize_stats(overall)

    def finalize_group(group):
        return {
            key: finalize_stats(stats)
            for key, stats in group.items()
        }

    leagues = finalize_group(leagues)
    prediction_types = finalize_group(prediction_types)
    line_ranges = finalize_group(line_ranges)
    confidence_ranges = finalize_group(confidence_ranges)
    sample_ranges = finalize_group(sample_ranges)

    biggest_errors = sorted(
        completed_rows,
        key=lambda row: row["absoluteError"],
        reverse=True
    )[:20]

    closest_predictions = sorted(
        completed_rows,
        key=lambda row: row["absoluteError"]
    )[:20]

    result = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),

        "settings": {
            "mainMarket": "Maç Toplam Alt/Üst",
            "source": "predictions.json",
            "pushExcludedFromSuccessRate": True,
            "confidenceAnalysis": True,
            "sampleAnalysis": True,
            "lineAnalysis": True
        },

        "overall": overall,
        "leagues": leagues,
        "predictionTypes": prediction_types,
        "lineRanges": line_ranges,
        "confidenceRanges": confidence_ranges,
        "sampleRanges": sample_ranges,

        "over": prediction_types.get("ÜST", empty_stats()),
        "under": prediction_types.get("ALT", empty_stats()),

        "biggestErrors": biggest_errors,
        "closestPredictions": closest_predictions,
        "completedMatches": completed_rows
    }

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            result,
            file,
            ensure_ascii=False,
            indent=2
        )

    print("=" * 70)
    print("NBA BASKETBOL TAHMİN ANALİZİ")
    print("=" * 70)

    print("\nGENEL BAŞARI")
    print("-" * 70)
    print("Tamamlanan:", overall["completed"])
    print("Başarılı:", overall["successful"])
    print("Başarısız:", overall["failed"])
    print("Push:", overall["push"])
    print("Başarı oranı:", f"%{overall['successRate']}")
    print("Ortalama hata:", overall["averageError"])

    print("\nALT / ÜST")
    print("-" * 70)

    for name in ("ALT", "ÜST"):
        stats = prediction_types.get(name)

        if stats:
            evaluated = stats["successful"] + stats["failed"]
            print(
                f"{name}: {stats['successful']}/{evaluated} "
                f"-> %{stats['successRate']} "
                f"| Hata: {stats['averageError']}"
            )

    def print_group(title, group):
        print(f"\n{title}")
        print("-" * 70)

        for name, stats in group.items():
            evaluated = stats["successful"] + stats["failed"]

            print(
                f"{name}: {stats['successful']}/{evaluated} "
                f"-> %{stats['successRate']} "
                f"| Hata: {stats['averageError']}"
            )

    print_group("BAREM ARALIKLARI", line_ranges)
    print_group("GÜVEN ORANLARI", confidence_ranges)
    print_group("GEÇMİŞ MAÇ ÖRNEKLEMİ", sample_ranges)
    print_group("LİG BAŞARILARI", leagues)

    print("\nEN BÜYÜK 10 HATA")
    print("-" * 70)

    for row in biggest_errors[:10]:
        print(
            f"{row['home']} - {row['away']} | "
            f"Barem: {row['line']} | "
            f"Tahmin: {row['prediction']} | "
            f"Gerçek: {row['actualTotal']} | "
            f"Fark: {row['difference']}"
        )

    print("\nAnaliz dosyası oluşturuldu:", OUTPUT_FILE)
    print("=" * 70)


if __name__ == "__main__":
    analyze()
