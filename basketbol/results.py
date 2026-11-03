
import json
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict


BASE_DIR = Path(__file__).resolve().parent
INPUT_FILE = BASE_DIR / "predictions.json"
OUTPUT_FILE = BASE_DIR / "results.json"


def load_json(path):
    if not path.exists():
        raise FileNotFoundError(f"Dosya bulunamadı: {path}")

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, data):
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def normalize_prediction(value):
    if value is None:
        return None

    value = str(value).strip().upper()

    if value in ("ALT", "UNDER"):
        return "ALT"

    if value in ("ÜST", "UST", "OVER"):
        return "ÜST"

    return None


def normalize_1x2(value):
    if value is None:
        return None

    value = str(value).strip().upper()

    if value in ("1", "HOME"):
        return "1"

    if value in ("X", "DRAW"):
        return "X"

    if value in ("2", "AWAY"):
        return "2"

    return None


def is_played(match):
    if match.get("played") is True:
        return True

    if match.get("isFinished") is True:
        return True

    status = str(match.get("status", "")).strip().lower()

    if status in ("finished", "final", "completed", "ft"):
        return True

    home_score = match.get("homeScore")
    away_score = match.get("awayScore")

    return (
        home_score is not None
        and away_score is not None
        and match.get("isUnstarted") is not True
    )


def calculate_actual_result(home_score, away_score):
    if home_score > away_score:
        return "1"

    if away_score > home_score:
        return "2"

    return "X"


def calculate_main_result(prediction, line, actual_total):
    prediction = normalize_prediction(prediction)

    if prediction is None or line is None:
        return None, None

    try:
        line = float(line)
    except (TypeError, ValueError):
        return None, None

    if prediction == "ÜST":
        if actual_total > line:
            return "ÜST", True

        if actual_total < line:
            return "ALT", False

        return "PUSH", None

    if prediction == "ALT":
        if actual_total < line:
            return "ALT", True

        if actual_total > line:
            return "ÜST", False

        return "PUSH", None

    return None, None


def calculate_statistics(matches):
    total = len(matches)
    played = 0
    upcoming = 0

    evaluated = 0
    successful = 0
    failed = 0
    push = 0
    invalid = 0

    one_x_two_evaluated = 0
    one_x_two_successful = 0
    one_x_two_failed = 0

    alt_total = 0
    alt_successful = 0

    ust_total = 0
    ust_successful = 0

    league_stats = defaultdict(lambda: {
        "total": 0,
        "played": 0,
        "upcoming": 0,
        "evaluated": 0,
        "successful": 0,
        "failed": 0,
        "push": 0,
        "invalid": 0,
        "successRate": 0,
        "oneXTwoEvaluated": 0,
        "oneXTwoSuccessful": 0,
        "oneXTwoFailed": 0,
        "oneXTwoSuccessRate": 0
    })

    for match in matches:
        league = match.get("league") or "Bilinmeyen"
        stats = league_stats[league]
        stats["total"] += 1

        if not match.get("played"):
            upcoming += 1
            stats["upcoming"] += 1
            continue

        played += 1
        stats["played"] += 1

        if match.get("mainEvaluated"):
            evaluated += 1
            stats["evaluated"] += 1

            if match.get("success") is True:
                successful += 1
                stats["successful"] += 1

                if match.get("prediction") == "ALT":
                    alt_successful += 1

                elif match.get("prediction") == "ÜST":
                    ust_successful += 1

            elif match.get("success") is False:
                failed += 1
                stats["failed"] += 1

            elif match.get("result") == "PUSH":
                push += 1
                stats["push"] += 1

            if match.get("prediction") == "ALT":
                alt_total += 1

            elif match.get("prediction") == "ÜST":
                ust_total += 1

        else:
            invalid += 1
            stats["invalid"] += 1

        if match.get("oneXTwoEvaluated"):
            one_x_two_evaluated += 1
            stats["oneXTwoEvaluated"] += 1

            if match.get("success1X2") is True:
                one_x_two_successful += 1
                stats["oneXTwoSuccessful"] += 1

            elif match.get("success1X2") is False:
                one_x_two_failed += 1
                stats["oneXTwoFailed"] += 1

    success_rate = (
        round(successful / evaluated * 100, 1)
        if evaluated else 0
    )

    one_x_two_rate = (
        round(one_x_two_successful / one_x_two_evaluated * 100, 1)
        if one_x_two_evaluated else 0
    )

    for stats in league_stats.values():
        stats["successRate"] = (
            round(stats["successful"] / stats["evaluated"] * 100, 1)
            if stats["evaluated"] else 0
        )

        stats["oneXTwoSuccessRate"] = (
            round(
                stats["oneXTwoSuccessful"]
                / stats["oneXTwoEvaluated"] * 100,
                1
            )
            if stats["oneXTwoEvaluated"] else 0
        )

    return {
        "total": total,
        "played": played,
        "upcoming": upcoming,
        "evaluated": evaluated,
        "successful": successful,
        "failed": failed,
        "push": push,
        "invalid": invalid,
        "successRate": success_rate,
        "successRateMainPrediction": success_rate,
        "oneXTwoEvaluated": one_x_two_evaluated,
        "oneXTwoSuccessful": one_x_two_successful,
        "oneXTwoFailed": one_x_two_failed,
        "oneXTwoSuccessRate": one_x_two_rate,
        "altTotal": alt_total,
        "altSuccessful": alt_successful,
        "altSuccessRate": (
            round(alt_successful / alt_total * 100, 1)
            if alt_total else 0
        ),
        "ustTotal": ust_total,
        "ustSuccessful": ust_successful,
        "ustSuccessRate": (
            round(ust_successful / ust_total * 100, 1)
            if ust_total else 0
        ),
        "leagues": dict(league_stats)
    }


def evaluate_matches(data):
    predictions = data.get("predictions", [])

    if not isinstance(predictions, list):
        raise ValueError("predictions.json içindeki predictions bir liste değil.")

    evaluated_matches = []

    for original in predictions:
        match = dict(original)

        home_score = match.get("homeScore")
        away_score = match.get("awayScore")

        match["home"] = match.get("homeTeam")
        match["away"] = match.get("awayTeam")

        match["played"] = is_played(match)

        match["mainEvaluated"] = False
        match["oneXTwoEvaluated"] = False

        match["result"] = None
        match["success"] = None
        match["actualTotal"] = None

        match["result1X2"] = None
        match["success1X2"] = None

        if not match["played"]:
            evaluated_matches.append(match)
            continue

        if home_score is None or away_score is None:
            evaluated_matches.append(match)
            continue

        try:
            home_score = float(home_score)
            away_score = float(away_score)
        except (TypeError, ValueError):
            evaluated_matches.append(match)
            continue

        actual_total = home_score + away_score

        match["homeScore"] = home_score
        match["awayScore"] = away_score
        match["actualTotal"] = actual_total

        # Ana Alt / Üst tahmini
        prediction = normalize_prediction(match.get("prediction"))
        line = match.get("line")

        match["prediction"] = prediction

        result, success = calculate_main_result(
            prediction,
            line,
            actual_total
        )

        if result is not None:
            match["mainEvaluated"] = True
            match["result"] = result
            match["success"] = success

        # 1X2 tahmini ana tahminden bağımsız değerlendirilir.
        prediction_1x2 = normalize_1x2(
            match.get("prediction1X2")
        )

        actual_1x2 = calculate_actual_result(
            home_score,
            away_score
        )

        match["prediction1X2"] = prediction_1x2
        match["actualResult1X2"] = actual_1x2
        match["result1X2"] = actual_1x2

        if prediction_1x2 is not None:
            match["oneXTwoEvaluated"] = True
            match["success1X2"] = (
                prediction_1x2 == actual_1x2
            )

        evaluated_matches.append(match)

    return evaluated_matches


def print_report(stats, matches):
    print("=" * 70)
    print("BASKETBOL ANA TAHMİN SONUÇ ANALİZİ")
    print("=" * 70)

    print(f"\nToplam tahmin : {stats['total']}")
    print(f"Oynanan       : {stats['played']}")
    print(f"Oynanmamış    : {stats['upcoming']}")

    print("\n" + "=" * 70)
    print("ALT / ÜST GENEL BAŞARI")
    print("=" * 70)

    print(f"Değerlendirilen: {stats['evaluated']}")
    print(f"Başarılı       : {stats['successful']}")
    print(f"Başarısız      : {stats['failed']}")
    print(f"Push           : {stats['push']}")
    print(f"Geçersiz       : {stats['invalid']}")
    print(f"Başarı oranı   : %{stats['successRate']}")

    print("\n" + "=" * 70)
    print("1X2 GENEL BAŞARI")
    print("=" * 70)

    print(f"Değerlendirilen: {stats['oneXTwoEvaluated']}")
    print(f"Başarılı       : {stats['oneXTwoSuccessful']}")
    print(f"Başarısız      : {stats['oneXTwoFailed']}")
    print(f"Başarı oranı   : %{stats['oneXTwoSuccessRate']}")

    print("\n" + "=" * 70)
    print("ALT / ÜST DAĞILIMI")
    print("=" * 70)

    print(
        f"Alt: {stats['altSuccessful']}/{stats['altTotal']} "
        f"-> %{stats['altSuccessRate']}"
    )

    print(
        f"Üst: {stats['ustSuccessful']}/{stats['ustTotal']} "
        f"-> %{stats['ustSuccessRate']}"
    )

    print("\n" + "=" * 70)
    print("LİG BAŞARILARI")
    print("=" * 70)

    for league, league_stats in stats["leagues"].items():
        print(
            f"{league}: "
            f"{league_stats['successful']}/"
            f"{league_stats['evaluated']} "
            f"-> %{league_stats['successRate']} "
            f"| 1X2: "
            f"{league_stats['oneXTwoSuccessful']}/"
            f"{league_stats['oneXTwoEvaluated']} "
            f"-> %{league_stats['oneXTwoSuccessRate']}"
        )

    invalid_matches = [
        match for match in matches
        if match.get("played") and not match.get("mainEvaluated")
    ]

    print("\n" + "=" * 70)
    print("İLK 10 ANA TAHMİNİ OLMAYAN / GEÇERSİZ MAÇ")
    print("=" * 70)

    for match in invalid_matches[:10]:
        print({
            "id": match.get("id"),
            "home": match.get("homeTeam"),
            "away": match.get("awayTeam"),
            "prediction": match.get("prediction"),
            "line": match.get("line"),
            "played": match.get("played"),
            "homeScore": match.get("homeScore"),
            "awayScore": match.get("awayScore"),
            "prediction1X2": match.get("prediction1X2"),
            "success1X2": match.get("success1X2")
        })


def main():
    print("Tahmin dosyası okunuyor...")

    data = load_json(INPUT_FILE)

    matches = evaluate_matches(data)
    stats = calculate_statistics(matches)

    output = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "predictions.json",
        "summary": {
            key: value
            for key, value in stats.items()
            if key != "leagues"
        },
        "leagues": stats["leagues"],
        "predictions": matches
    }

    save_json(OUTPUT_FILE, output)

    print_report(stats, matches)

    print("\n" + "=" * 70)
    print(f"results.json oluşturuldu: {OUTPUT_FILE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
