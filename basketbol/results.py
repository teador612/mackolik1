import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
# ============================================================
# DOSYA YOLLARI
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
PREDICTIONS_FILE = BASE_DIR / "predictions.json"
OUTPUT_FILE = BASE_DIR / "results.json"
# ============================================================
# YARDIMCI
# ============================================================
def safe_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
def safe_int(value):
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None
def get_league_name(item):
    league = str(item.get("league", "")).upper()
    if league == "NBA":
        return "NBA"
    if league in (
        "E",
        "E2026",
        "EUROLEAGUE",
        "EUROLEGUE",
        "EUROPE",
    ):
        return "EuroLeague"
    return item.get("league", "Diğer")
def calculate_percentage(successful, total):
    if total <= 0:
        return None
    return round(successful / total * 100, 2)
# ============================================================
# ANA TAHMİN SONUCU
# ============================================================
def evaluate_prediction(item):
    """
    SADECE ANA TAHMİN:
    Maç Toplam Alt/Üst
    """
    prediction = item.get("prediction")
    line = safe_float(item.get("line"))
    home_score = safe_float(item.get("homeScore"))
    away_score = safe_float(item.get("awayScore"))
    played = bool(item.get("played"))
    if not played:
        return {
            "status": "not_played",
            "prediction": prediction,
            "line": line,
            "actualTotal": None,
            "success": None,
        }
    if (
        prediction not in ("Alt", "Üst")
        or line is None
        or home_score is None
        or away_score is None
    ):
        return {
            "status": "invalid",
            "prediction": prediction,
            "line": line,
            "actualTotal": None,
            "success": None,
        }
    actual_total = home_score + away_score
    if actual_total == line:
        return {
            "status": "push",
            "prediction": prediction,
            "line": line,
            "actualTotal": actual_total,
            "success": None,
        }
    actual_result = "Üst" if actual_total > line else "Alt"
    success = prediction == actual_result
    return {
        "status": "success" if success else "failed",
        "prediction": prediction,
        "line": line,
        "actualTotal": actual_total,
        "actualResult": actual_result,
        "success": success,
    }
# ============================================================
# GENEL İSTATİSTİK
# ============================================================
def calculate_stats(items):
    completed = [
        item for item in items
        if item["evaluation"]["status"] in ("success", "failed")
    ]
    successful = [
        item for item in completed
        if item["evaluation"]["success"] is True
    ]
    failed = [
        item for item in completed
        if item["evaluation"]["success"] is False
    ]
    pushes = [
        item for item in items
        if item["evaluation"]["status"] == "push"
    ]
    not_played = [
        item for item in items
        if item["evaluation"]["status"] == "not_played"
    ]
    invalid = [
        item for item in items
        if item["evaluation"]["status"] == "invalid"
    ]
    total = len(completed)
    return {
        "totalPredictions": len(items),
        "completed": total,
        "successful": len(successful),
        "failed": len(failed),
        "push": len(pushes),
        "notPlayed": len(not_played),
        "invalid": len(invalid),
        "successRate": calculate_percentage(len(successful), total),
    }
# ============================================================
# LİG İSTATİSTİKLERİ
# ============================================================
def calculate_league_stats(items):
    groups = defaultdict(list)
    for item in items:
        league = get_league_name(item["prediction"])
        groups[league].append(item)
    return {
        league: calculate_stats(league_items)
        for league, league_items in groups.items()
    }
# ============================================================
# TARİH İSTATİSTİKLERİ
# ============================================================
def calculate_daily_stats(items):
    groups = defaultdict(list)
    for item in items:
        date = item["prediction"].get("date") or "unknown"
        groups[date].append(item)
    return {
        date: calculate_stats(date_items)
        for date, date_items in sorted(groups.items())
    }
# ============================================================
# TAHMİN DAĞILIMI
# ============================================================
def calculate_prediction_distribution(items):
    result = {
        "Alt": {
            "total": 0,
            "successful": 0,
            "failed": 0,
        },
        "Üst": {
            "total": 0,
            "successful": 0,
            "failed": 0,
        },
    }
    for item in items:
        evaluation = item["evaluation"]
        prediction = evaluation.get("prediction")
        status = evaluation.get("status")
        if prediction not in result:
            continue
        if status not in ("success", "failed"):
            continue
        result[prediction]["total"] += 1
        if status == "success":
            result[prediction]["successful"] += 1
        else:
            result[prediction]["failed"] += 1
    for prediction in result:
        total = result[prediction]["total"]
        successful = result[prediction]["successful"]
        result[prediction]["successRate"] = calculate_percentage(
            successful,
            total,
        )
    return result
# ============================================================
# SONUÇ KAYITLARI
# ============================================================
def build_result_item(item):
    prediction = item["prediction"]
    evaluation = item["evaluation"]
    return {
        "id": prediction.get("id"),
        "league": get_league_name(prediction),
        "season": prediction.get("season"),
        "date": prediction.get("date"),
        "home": prediction.get("home"),
        "away": prediction.get("away"),
        "prediction": evaluation.get("prediction"),
        "line": evaluation.get("line"),
        "homeScore": prediction.get("homeScore"),
        "awayScore": prediction.get("awayScore"),
        "actualTotal": evaluation.get("actualTotal"),
        "actualResult": evaluation.get("actualResult"),
        "status": evaluation.get("status"),
        "success": evaluation.get("success"),
    }
# ============================================================
# DOSYA OKU
# ============================================================
def load_predictions():
    if not PREDICTIONS_FILE.exists():
        raise FileNotFoundError(
            f"predictions.json bulunamadı: {PREDICTIONS_FILE}"
        )
    with PREDICTIONS_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)
# ============================================================
# KAYDET
# ============================================================
def save_results(output):
    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )
# ============================================================
# ANA PROGRAM
# ============================================================
def main():
    print("=" * 70)
    print("🏀 BASKETBOL ANA TAHMİN SONUÇ ANALİZİ")
    print("=" * 70)
    data = load_predictions()
    predictions = data.get("predictions", [])
    print(f"\n📦 Toplam tahmin: {len(predictions)}")
    print(f"📂 Kaynak dosya: {PREDICTIONS_FILE}")
    results = []
    for prediction in predictions:
        evaluation = evaluate_prediction(prediction)
        results.append({
            "prediction": prediction,
            "evaluation": evaluation,
        })
    overall = calculate_stats(results)
    league_stats = calculate_league_stats(results)
    daily_stats = calculate_daily_stats(results)
    distribution = calculate_prediction_distribution(results)
    output = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "predictions.json",
        "settings": {
            "mainMarket": "Maç Toplam Alt/Üst",
            "successRateOnlyMainPrediction": True,
            "excludedFromMainSuccessRate": [
                "1/X/2",
                "İY Alt/Üst",
                "Q1 Alt/Üst",
                "Q2 Alt/Üst",
                "Q3 Alt/Üst",
                "Q4 Alt/Üst",
            ],
            "pushExcludedFromSuccessRate": True,
        },
        "statistics": {
            "overall": overall,
            "leagues": league_stats,
            "daily": daily_stats,
            "predictionDistribution": distribution,
        },
        "results": [
            build_result_item(item)
            for item in results
        ],
    }
    save_results(output)
    print("\n" + "=" * 70)
    print("📊 GENEL BAŞARI")
    print("=" * 70)
    print("Toplam tahmin   :", overall["totalPredictions"])
    print("Tamamlanan      :", overall["completed"])
    print("✅ Başarılı      :", overall["successful"])
    print("❌ Başarısız     :", overall["failed"])
    print("⏸️ Push          :", overall["push"])
    print("⏳ Oynanmamış    :", overall["notPlayed"])
    rate = overall["successRate"]
    print("📊 Başarı oranı  :", f"%{rate}" if rate is not None else "-")
    print("\n" + "=" * 70)
    print("🏆 LİG BAŞARILARI")
    print("=" * 70)
    for league, stats in league_stats.items():
        rate = stats["successRate"]
        rate_text = f"%{rate}" if rate is not None else "-"
        print(
            f"{league}: {stats['successful']}/"
            f"{stats['completed']} → {rate_text}"
        )
    print("\n" + "=" * 70)
    print("📈 ALT / ÜST DAĞILIMI")
    print("=" * 70)
    for prediction, stats in distribution.items():
        rate = stats["successRate"]
        rate_text = f"%{rate}" if rate is not None else "-"
        print(
            f"{prediction}: {stats['successful']}/"
            f"{stats['total']} → {rate_text}"
        )
    print("\n" + "=" * 70)
    print(f"✅ results.json oluşturuldu: {OUTPUT_FILE}")
    print("=" * 70)
if __name__ == "__main__":
    main()
