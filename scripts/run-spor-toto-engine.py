
import json
import math
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import log_loss


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "spor-toto-analysis.json"
OUTPUT = ROOT / "data" / "spor-toto-predictions.json"

CLASSES = ["1", "X", "2"]

MARKETS = {
    "MS 1-X-2": ["ms1", "msX", "ms2"],
    "İY 1": ["iy1"],
    "İY 2": ["iy2"],
    "İY 1,5 Üst": ["iy15Ust"],
    "KG Var": ["kgVar"],
    "2,5 Üst": ["au25Ust"],
}

MIN_TRAIN_SAMPLES = 200
VALIDATION_RATIO = 0.20

BASE_WEIGHTS = {
    "MS 1-X-2": 1.50,
    "İY 1": 1.00,
    "İY 2": 1.00,
    "İY 1,5 Üst": 1.00,
    "KG Var": 1.00,
    "2,5 Üst": 1.00,
}


def parse_datetime(match):
    date_value = match.get("date", "")
    time_value = match.get("time", "00:00")

    try:
        return datetime.strptime(
            f"{date_value} {time_value}",
            "%Y-%m-%d %H:%M"
        )
    except (ValueError, TypeError):
        return None


def get_feature(match, market_keys):
    odds = match.get("odds") or {}

    try:
        values = [
            float(odds.get(key))
            for key in market_keys
        ]
    except (TypeError, ValueError):
        return None

    if any(
        not math.isfinite(value)
        or value <= 1.0
        or value > 1000
        for value in values
    ):
        return None

    if len(values) == 3:
        inverse = [1.0 / value for value in values]
        total = sum(inverse)

        if total <= 0:
            return None

        return [
            value / total
            for value in inverse
        ]

    return [math.log(values[0])]


def create_model():
    return HistGradientBoostingClassifier(
        learning_rate=0.05,
        max_iter=180,
        max_leaf_nodes=15,
        min_samples_leaf=25,
        l2_regularization=2.0,
        random_state=42,
        early_stopping=False
    )


def fit_market_model(matches, market_keys):
    x_values = []
    y_values = []

    for match in matches:
        result = match.get("result")

        if result not in CLASSES:
            continue

        feature = get_feature(match, market_keys)

        if feature is None:
            continue

        x_values.append(feature)
        y_values.append(result)

    if len(x_values) < MIN_TRAIN_SAMPLES:
        return None

    if len(set(y_values)) < 3:
        return None

    model = create_model()

    model.fit(
        np.asarray(x_values, dtype=float),
        np.asarray(y_values)
    )

    return {
        "model": model,
        "samples": len(x_values)
    }


def predict_probabilities(model_info, feature):
    model = model_info["model"]

    raw = model.predict_proba(
        np.asarray([feature], dtype=float)
    )[0]

    probabilities = {
        label: 0.0
        for label in CLASSES
    }

    for label, probability in zip(model.classes_, raw):
        probabilities[str(label)] = float(probability)

    total = sum(probabilities.values())

    if total <= 0:
        return None

    return [
        probabilities[label] / total
        for label in CLASSES
    ]


def get_validation_weights(train_matches, validation_matches):
    raw_weights = {}
    validation_report = {}

    for market_name, keys in MARKETS.items():
        model_info = fit_market_model(
            train_matches,
            keys
        )

        if model_info is None:
            validation_report[market_name] = {
                "trainingSamples": 0,
                "validationMatches": 0,
                "logLoss": None,
                "weight": 0
            }
            continue

        actual = []
        predicted = []

        for match in validation_matches:
            result = match.get("result")

            if result not in CLASSES:
                continue

            feature = get_feature(match, keys)

            if feature is None:
                continue

            probabilities = predict_probabilities(
                model_info,
                feature
            )

            if probabilities is None:
                continue

            actual.append(result)
            predicted.append(probabilities)

        if len(actual) < 30:
            validation_report[market_name] = {
                "trainingSamples": model_info["samples"],
                "validationMatches": len(actual),
                "logLoss": None,
                "weight": 0
            }
            continue

        loss = log_loss(
            actual,
            predicted,
            labels=CLASSES
        )

        performance = math.exp(-2.0 * loss)

        reliability = math.sqrt(
            len(actual) / (len(actual) + 300)
        )

        raw_weight = (
            BASE_WEIGHTS[market_name]
            * performance
            * reliability
        )

        raw_weights[market_name] = raw_weight

        validation_report[market_name] = {
            "trainingSamples": model_info["samples"],
            "validationMatches": len(actual),
            "logLoss": round(float(loss), 5),
            "rawWeight": round(raw_weight, 8),
            "weight": 0
        }

    total_weight = sum(raw_weights.values())

    if total_weight > 0:
        weights = {
            name: value / total_weight
            for name, value in raw_weights.items()
        }
    else:
        weights = {}

    for market_name, weight in weights.items():
        validation_report[market_name]["weight"] = round(
            weight, 6
        )

    return weights, validation_report


def build_prediction(match, models, weights):
    market_predictions = {}
    combined = np.zeros(3, dtype=float)
    total_weight = 0.0

    for market_name, keys in MARKETS.items():
        model_info = models.get(market_name)

        if model_info is None:
            continue

        feature = get_feature(match, keys)

        if feature is None:
            continue

        probabilities = predict_probabilities(
            model_info,
            feature
        )

        if probabilities is None:
            continue

        weight = weights.get(market_name, 0.0)

        if weight <= 0:
            continue

        market_predictions[market_name] = {
            "probabilities": probabilities,
            "weight": weight
        }

        combined += (
            np.asarray(probabilities) * weight
        )

        total_weight += weight

    if total_weight <= 0:
        return None

    combined /= total_weight
    combined = np.maximum(combined, 0)
    combined /= combined.sum()

    ms_model = models.get("MS 1-X-2")
    ms_samples = (
        ms_model["samples"]
        if ms_model
        else 0
    )

    joint_markets = {}

    for index, label in enumerate(CLASSES):
        joint_markets[f"MS {label}"] = {
            "probability": round(
                float(combined[index]), 6
            ),
            "correct": None,
            "odds_samples": ms_samples
        }

    ranked = sorted(
        range(3),
        key=lambda index: combined[index],
        reverse=True
    )

    primary_index = ranked[0]

    primary = {
        "label": f"MS {CLASSES[primary_index]}",
        "probability": round(
            float(combined[primary_index]), 6
        )
    }

    others = [
        {
            "label": f"MS {CLASSES[index]}",
            "probability": round(
                float(combined[index]), 6
            )
        }
        for index in ranked[1:]
    ]

    source_probabilities = {
        name: {
            CLASSES[index]: round(
                float(item["probabilities"][index]), 6
            )
            for index in range(3)
        }
        for name, item in market_predictions.items()
    }

    source_weights = {
        name: round(float(item["weight"]), 6)
        for name, item in market_predictions.items()
    }

    return {
        "date": match.get("date"),
        "time": match.get("time"),
        "league": match.get("league"),
        "home": match.get("home"),
        "away": match.get("away"),
        "primary": primary,
        "others": others,
        "joint_markets": joint_markets,
        "source_probabilities": source_probabilities,
        "source_weights": source_weights,
        "weight_scopes": "historical_validation",
        "odds_samples": {
            name: model_info["samples"]
            for name, model_info in models.items()
        },
        "primary_correct": None,
        "market_results": {},
        "score": match.get("score"),
        "ht_score": match.get("halfTimeScore"),
        "fixture_id": (
            f"{match.get('date', '')}_"
            f"{match.get('home', '')}_"
            f"{match.get('away', '')}"
        )
    }


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(
            f"Analiz dosyası bulunamadı: {SOURCE}"
        )

    with SOURCE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    matches = data.get("matches", [])

    if not matches:
        raise ValueError(
            "Analiz dosyasında maç bulunamadı."
        )

    now = datetime.now(
        ZoneInfo("Europe/Istanbul")
    ).replace(tzinfo=None)

    valid_matches = []

    for match in matches:
        timestamp = parse_datetime(match)

        if timestamp is None:
            continue

        item = dict(match)
        item["_timestamp"] = timestamp
        valid_matches.append(item)

    valid_matches.sort(
        key=lambda item: item["_timestamp"]
    )

    # Sadece zamanı geçmiş ve sonucu bulunan maçlar eğitimde.
    completed = [
        match for match in valid_matches
        if (
            match.get("result") in CLASSES
            and match["_timestamp"] <= now
        )
    ]

    # Sadece henüz başlamamış ve sonucu bulunmayan maçlar tahmin edilir.
    upcoming = [
        match for match in valid_matches
        if (
            match.get("result") not in CLASSES
            and match["_timestamp"] > now
        )
    ]

    unresolved_past = [
        match for match in valid_matches
        if (
            match.get("result") not in CLASSES
            and match["_timestamp"] <= now
        )
    ]

    if len(completed) < MIN_TRAIN_SAMPLES * 2:
        raise ValueError(
            "Motor için yeterli tamamlanmış maç bulunamadı."
        )

    timestamps = sorted({
        match["_timestamp"]
        for match in completed
    })

    split_index = int(
        len(timestamps) * (1 - VALIDATION_RATIO)
    )

    split_index = max(
        1,
        min(split_index, len(timestamps) - 1)
    )

    cutoff = timestamps[split_index]

    train_matches = [
        match for match in completed
        if match["_timestamp"] < cutoff
    ]

    validation_matches = [
        match for match in completed
        if match["_timestamp"] >= cutoff
    ]

    if not train_matches or not validation_matches:
        raise ValueError(
            "Eğitim ve doğrulama verisi ayrılamadı."
        )

    weights, validation_report = get_validation_weights(
        train_matches,
        validation_matches
    )

    if not weights or weights.get("MS 1-X-2", 0) <= 0:
        raise ValueError(
            "Ana MS 1-X-2 modeli oluşturulamadı. "
            "Oran ve sonuç verilerini kontrol edin."
        )

    # Nihai modeller tüm tamamlanmış geçmiş maçlarla eğitilir.
    models = {}

    for market_name, keys in MARKETS.items():
        model_info = fit_market_model(
            completed,
            keys
        )

        if model_info is not None:
            models[market_name] = model_info

    predictions = []

    for match in upcoming:
        prediction = build_prediction(
            match,
            models,
            weights
        )

        if prediction is not None:
            predictions.append(prediction)

    result = {
        "source": "spor-toto-analysis.json",
        "generatedAt": datetime.now(
            ZoneInfo("Europe/Istanbul")
        ).isoformat(),
        "sourceUpdatedAt": data.get("sourceUpdatedAt"),
        "trainingMatches": len(completed),
        "validationMatches": len(validation_matches),
        "validationStart": cutoff.isoformat(),
        "upcomingMatches": len(predictions),
        "unresolvedPastMatches": len(unresolved_past),
        "markets": list(MARKETS.keys()),
        "validation": validation_report,
        "marketWeights": {
            name: round(float(weight), 6)
            for name, weight in weights.items()
        },
        "predictions": predictions
    }

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary = OUTPUT.with_suffix(".tmp")

    with temporary.open("w", encoding="utf-8") as file:
        json.dump(
            result,
            file,
            ensure_ascii=False,
            separators=(",", ":")
        )

    temporary.replace(OUTPUT)

    print("Spor Toto tahmin motoru tamamlandı.")
    print(f"Eğitim maçları: {len(completed)}")
    print(f"Doğrulama maçları: {len(validation_matches)}")
    print(f"Gelecek maçlar: {len(predictions)}")
    print(f"Geçmişte sonucu eksik maçlar: {len(unresolved_past)}")
    print("Pazar ağırlıkları:")

    for name, weight in weights.items():
        print(f"  {name}: {weight:.6f}")

    print(f"Çıktı: {OUTPUT}")


if __name__ == "__main__":
    main()
