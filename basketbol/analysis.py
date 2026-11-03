import json
import math
import os
from datetime import datetime, timezone
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "predictions.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "analysis.json")


def load_json(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dosya bulunamadı: {path}")

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def number(value):
    if value is None or isinstance(value, bool):
        return None

    try:
        result = float(value)
        if not math.isfinite(result):
            return None
        return result
    except (TypeError, ValueError):
        return None


def normalize_prediction(value):
    if value is None:
        return None

    value = str(value).strip().upper()

    if value in ("ALT", "UNDER"):
        return "ALT"

    if value in ("ÜST", "UST", "OVER", "ÜZERİ"):
        return "ÜST"

    return None


def get_bucket(value, buckets):
    for upper_limit, label in buckets:
        if value < upper_limit:
            return label
    return buckets[-1][1]


def create_stats():
    return {
        "total": 0,
        "successful": 0,
        "failed": 0,
        "push": 0,
        "successRate": 0,
        "averageError": 0,
        "totalError": 0
    }


def add_result(stats, prediction, line, actual):
    difference = abs(actual - line)

    stats["total"] += 1
    stats["totalError"] += difference

    if actual == line:
        stats["push"] += 1
    elif prediction == "ALT" and actual < line:
        stats["successful"] += 1
    elif prediction == "ÜST" and actual > line:
        stats["successful"] += 1
    else:
        stats["failed"] += 1


def finalize_stats(stats):
    evaluated = stats["successful"] + stats["failed"]

    if evaluated:
        stats["successRate"] = round(
            stats["successful"] / evaluated * 100, 2
        )
    else:
        stats["successRate"] = 0

    if stats["total"]:
        stats["averageError"] = round(
            stats["totalError"] / stats["total"], 2
        )
    else:
        stats["averageError"] = 0

    stats["totalError"] = round(stats["totalError"], 2)

    return stats


def get_team_name(match, primary, fallback):
    return match.get(primary) or match.get(fallback) or "Bilinmeyen"


def analyze():
    data = load_json(INPUT_FILE)

    if isinstance(data, dict):
        matches = data.get("predictions", [])
    elif isinstance(data, list):
        matches = data
    else:
        raise ValueError("predictions.json beklenen formatta değil.")

    if not isinstance(matches, list):
        raise ValueError("Tahmin listesi bulunamadı.")

    overall = create_stats()

    prediction_types = {
        "ALT": create_stats(),
        "ÜST": create_stats()
    }

    line_buckets = [
        (200, "<200"),
        (210, "200-209"),
        (220, "210-219"),
        (230, "220-229"),
        (240, "230-239"),
        (float("inf"), "240+")
    ]

    confidence_buckets = [
        (50, "<50"),
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

    line_ranges = defaultdict(create_stats)
    confidence_ranges = defaultdict(create_stats)
    sample_ranges = defaultdict(create_stats)
    leagues = defaultdict(create_stats)

    biggest_errors = []
    closest_predictions = []

    played_matches = 0
    upcoming_matches = 0
    invalid_matches = 0

    for match in matches:
        if not isinstance(match, dict):
            continue

        played = match.get("played") is True

        if not played:
            upcoming_matches += 1
            continue

        played_matches += 1

        # Gerçek maç skorlarını doğru alanlardan oku.
        home_score = number(match.get("homeScore"))
        away_score = number(match.get("awayScore"))

        # Skorlardan biri eksikse maçı analiz etme.
        if home_score is None or away_score is None:
            invalid_matches += 1
            continue

        actual_total = home_score + away_score

        prediction = normalize_prediction(match.get("prediction"))
        line = number(match.get("line"))

        # Geçerli Alt/Üst tahmini ve barem gereklidir.
        if prediction is None or line is None:
            invalid_matches += 1
            continue

        home_team = get_team_name(match, "homeTeam", "home")
        away_team = get_team_name(match, "awayTeam", "away")
        league = match.get("league") or "Bilinmeyen"

        error = abs(actual_total - line)

        # Genel istatistikler.
        add_result(overall, prediction, line, actual_total)

        # Alt / Üst istatistikleri.
        add_result(
            prediction_types[prediction],
            prediction,
            line,
            actual_total
        )

        # Barem aralıkları.
        line_label = get_bucket(line, line_buckets)
        add_result(
            line_ranges[line_label],
            prediction,
            line,
            actual_total
        )

        # Güven aralıkları.
        confidence = number(match.get("confidence"))

        if confidence is not None:
            confidence_label = get_bucket(
                confidence, confidence_buckets
            )

            add_result(
                confidence_ranges[confidence_label],
                prediction,
                line,
                actual_total
            )

        # Geçmiş maç örneklemi.
        home_sample = number(match.get("homeSample"))
        away_sample = number(match.get("awaySample"))

        if home_sample is not None and away_sample is not None:
            sample_count = min(home_sample, away_sample)
            sample_label = get_bucket(
                sample_count, sample_buckets
            )

            add_result(
                sample_ranges[sample_label],
                prediction,
                line,
                actual_total
            )

        # Lig istatistikleri.
        add_result(
            leagues[league],
            prediction,
            line,
            actual_total
        )

        match_info = {
            "homeTeam": home_team,
            "awayTeam": away_team,
            "league": league,
            "line": round(line, 2),
            "prediction": prediction,
            "actualTotal": round(actual_total, 2),
            "homeScore": home_score,
            "awayScore": away_score,
            "error": round(error, 2),
            "difference": round(actual_total - line, 2)
        }

        biggest_errors.append(match_info)

        closest_predictions.append(match_info)

    # İstatistikleri sonlandır.
    finalize_stats(overall)

    for stats in prediction_types.values():
        finalize_stats(stats)

    for stats in line_ranges.values():
        finalize_stats(stats)

    for stats in confidence_ranges.values():
        finalize_stats(stats)

    for stats in sample_ranges.values():
        finalize_stats(stats)

    for stats in leagues.values():
        finalize_stats(stats)

    biggest_errors.sort(
        key=lambda item: item["error"],
        reverse=True
    )

    closest_predictions.sort(
        key=lambda item: item["error"]
    )

    result = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "totalMatches": len(matches),
        "playedMatches": played_matches,
        "upcomingMatches": upcoming_matches,
        "invalidMatches": invalid_matches,
        "completedMatches": overall["total"],

        "overall": overall,

        "predictionTypes": {
            "ALT": prediction_types["ALT"],
            "ÜST": prediction_types["ÜST"]
        },

        "lineRanges": dict(line_ranges),
        "confidenceRanges": dict(confidence_ranges),
        "sampleRanges": dict(sample_ranges),
        "leagues": dict(leagues),

        "biggestErrors": biggest_errors[:10],
        "closestPredictions": closest_predictions[:10]
    }

    save_json(OUTPUT_FILE, result)

    # Konsol raporu.
    print("=" * 70)
    print("NBA BASKETBOL TAHMİN ANALİZİ")
    print("=" * 70)

    print("\nGENEL BAŞARI")
    print("-" * 70)
    print(f"Toplam maç: {len(matches)}")
    print(f"Oynanmış maç: {played_matches}")
    print(f"Gelecek maç: {upcoming_matches}")
    print(f"Geçersiz / eksik tahmin: {invalid_matches}")
    print(f"Analiz edilen: {overall['total']}")
    print(f"Başarılı: {overall['successful']}")
    print(f"Başarısız: {overall['failed']}")
    print(f"Push: {overall['push']}")
    print(f"Başarı oranı: %{overall['successRate']}")
    print(f"Ortalama hata: {overall['averageError']}")

    print("\nALT / ÜST")
    print("-" * 70)

    for label in ("ALT", "ÜST"):
        stats = prediction_types[label]
        evaluated = stats["successful"] + stats["failed"]

        print(
            f"{label}: {stats['successful']}/{evaluated} "
            f"-> %{stats['successRate']} "
            f"| Hata: {stats['averageError']}"
        )

    print("\nBAREM ARALIKLARI")
    print("-" * 70)

    for label in [item[1] for item in line_buckets]:
        if label not in line_ranges:
            continue

        stats = line_ranges[label]
        evaluated = stats["successful"] + stats["failed"]

        print(
            f"{label}: {stats['successful']}/{evaluated} "
            f"-> %{stats['successRate']} "
            f"| Hata: {stats['averageError']}"
        )

    print("\nGÜVEN ORANLARI")
    print("-" * 70)

    for label in [item[1] for item in confidence_buckets]:
        if label not in confidence_ranges:
            continue

        stats = confidence_ranges[label]
        evaluated = stats["successful"] + stats["failed"]

        print(
            f"{label}: {stats['successful']}/{evaluated} "
            f"-> %{stats['successRate']} "
            f"| Hata: {stats['averageError']}"
        )

    print("\nGEÇMİŞ MAÇ ÖRNEKLEMİ")
    print("-" * 70)

    for label in [item[1] for item in sample_buckets]:
        if label not in sample_ranges:
            continue

        stats = sample_ranges[label]
        evaluated = stats["successful"] + stats["failed"]

        print(
            f"{label}: {stats['successful']}/{evaluated} "
            f"-> %{stats['successRate']} "
            f"| Hata: {stats['averageError']}"
        )

    print("\nLİG BAŞARILARI")
    print("-" * 70)

    for league, stats in leagues.items():
        evaluated = stats["successful"] + stats["failed"]

        print(
            f"{league}: {stats['successful']}/{evaluated} "
            f"-> %{stats['successRate']} "
            f"| Hata: {stats['averageError']}"
        )

    print("\nEN BÜYÜK 10 HATA")
    print("-" * 70)

    for match in biggest_errors[:10]:
        print(
            f"{match['homeTeam']} - {match['awayTeam']} "
            f"| Barem: {match['line']} "
            f"| Tahmin: {match['prediction']} "
            f"| Gerçek: {match['actualTotal']} "
            f"| Fark: {match['difference']}"
        )

    print("\nEN YAKIN 10 TAHMİN")
    print("-" * 70)

    for match in closest_predictions[:10]:
        print(
            f"{match['homeTeam']} - {match['awayTeam']} "
            f"| Barem: {match['line']} "
            f"| Gerçek: {match['actualTotal']} "
            f"| Hata: {match['error']}"
        )

    print("\nAnaliz dosyası oluşturuldu:")
    print(OUTPUT_FILE)


if __name__ == "__main__":
    analyze()
