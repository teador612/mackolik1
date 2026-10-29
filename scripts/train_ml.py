#!/usr/bin/env python3
import hashlib
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, log_loss
ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "v2-data.json"
MODEL_PATH = ROOT / "models" / "ml-models.joblib"
META_PATH = ROOT / "models" / "ml-models-meta.json"
OUT_PATH = ROOT / "outputs" / "ml-predictions.json"
MIN_TRAIN = 80
RANDOM_STATE = 42
MIN_LOG_LOSS = 0.01
try:
    import xgboost as xgb
except ImportError:
    xgb = None
try:
    import lightgbm as lgb
except ImportError:
    lgb = None
ODDS_ALIASES = {
    "ms1": ["ms1", "MS1", "1", "home", "homeWin", "odds1"],
    "msx": ["msX", "msx", "MSX", "X", "draw", "oddsX"],
    "ms2": ["ms2", "MS2", "2", "away", "awayWin", "odds2"],
    "kgvar": ["kgVar", "kgvar", "KGVar", "KG", "kg", "bttsYes"],
    "kgyok": ["kgYok", "kgyok", "KGYok", "KGY", "bttsNo"],
    "over15": ["au15Ust", "au15U", "ms15U", "over15", "1.5Ust", "15Ust"],
    "under15": ["au15Alt", "ms15A", "under15", "1.5Alt", "15Alt"],
    "over25": ["au25Ust", "au25U", "ms25U", "over25", "2.5Ust", "25Ust"],
    "under25": ["au25Alt", "ms25A", "under25", "2.5Alt", "25Alt"],
    "over35": ["au35Ust", "ms35U", "over35", "3.5Ust"],
    "under35": ["au35Alt", "ms35A", "under35", "3.5Alt"],
    "ht1": ["iy1", "IY1", "iy1Odds"],
    "htx": ["iyX", "iyx", "IYX", "iy0", "IY0"],
    "ht2": ["iy2", "IY2"],
    "ht_over05": ["iy05Ust", "iy05U", "iy05Over", "iy05"],
    "ht_over15": ["iy15Ust", "iy15U", "iy1_5U", "IY15U"],
    "ht_under15": ["iy15Alt", "iy15A", "iy1_5Alt", "IY15A"],
}
TARGETS = ("MS", "KG", "U25", "IY15U", "IY")
TARGET_TITLES = {
    "MS": "Maç Sonucu",
    "KG": "Karşılıklı Gol",
    "U25": "2.5 Gol Alt/Üst",
    "IY15U": "İlk Yarı 1.5 Gol Alt/Üst",
    "IY": "İlk Yarı Sonucu",
}
def load_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Veri dosyası bulunamadı: {DATA_PATH}")
    with DATA_PATH.open("r", encoding="utf-8-sig") as file:
        data = json.load(file)
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        rows = next(
            (
                data[key]
                for key in ("matches", "data", "items", "results")
                if isinstance(data.get(key), list)
            ),
            None,
        )
    else:
        rows = None
    if not isinstance(rows, list):
        raise ValueError("v2-data.json içinde maç listesi bulunamadı.")
    return [row for row in rows if isinstance(row, dict)]
def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")
            match = re.search(r"\d+(?:\.\d+)?", value)
            if not match:
                return None
            value = match.group(0)
        result = float(value)
        if math.isfinite(result) and 1.01 <= result <= 100:
            return result
    except (ValueError, TypeError):
        pass
    return None
def get_odd(match, aliases):
    containers = [
        match,
        match.get("openingOdds"),
        match.get("odds"),
        match.get("markets"),
        match.get("opening_odds"),
    ]
    for container in containers:
        if not isinstance(container, dict):
            continue
        for key in aliases:
            if key in container:
                value = number(container[key])
                if value is not None:
                    return value
    return None
def parse_score(value):
    if isinstance(value, dict):
        home = value.get("home", value.get("h", value.get("homeScore")))
        away = value.get("away", value.get("a", value.get("awayScore")))
        try:
            home, away = int(home), int(away)
            if home >= 0 and away >= 0:
                return home, away
        except (TypeError, ValueError):
            return None
    if value is None:
        return None
    match = re.fullmatch(
        r"\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*",
        str(value).strip(),
    )
    if match:
        return int(match.group(1)), int(match.group(2))
    return None
def get_full_score(match):
    for key in (
        "score", "fullTimeScore", "full_time_score",
        "ft", "resultScore", "skor", "sonuc",
    ):
        if key in match:
            result = parse_score(match[key])
            if result is not None:
                return result
    return None
def get_half_score(match):
    for key in (
        "halfTimeScore", "half_time_score", "ht",
        "iySkor", "halfScore", "devreSkoru",
    ):
        if key in match:
            result = parse_score(match[key])
            if result is not None:
                return result
    return None
def get_date(match):
    for key in (
        "date", "matchDate", "match_date",
        "tarih", "datetime", "kickoff",
    ):
        if match.get(key):
            return str(match[key])
    return ""
def get_features(match):
    features = []
    for aliases in ODDS_ALIASES.values():
        value = get_odd(match, aliases)
        features.append(value if value is not None else np.nan)
    home, draw, away = features[:3]
    if all(np.isfinite(value) and value > 0 for value in (home, draw, away)):
        inverse = [1 / home, 1 / draw, 1 / away]
        total = sum(inverse)
        features.extend([value / total for value in inverse])
    else:
        features.extend([np.nan, np.nan, np.nan])
    return features
def get_targets(match):
    ft = get_full_score(match)
    if ft is None:
        return None
    home, away = ft
    labels = {
        "MS": 0 if home > away else (1 if home == away else 2),
        "KG": int(home > 0 and away > 0),
        "U25": int(home + away >= 3),
        "IY15U": None,
        "IY": None,
    }
    ht = get_half_score(match)
    if ht is not None:
        ht_home, ht_away = ht
        labels["IY15U"] = int(ht_home + ht_away >= 2)
        labels["IY"] = (
            0 if ht_home > ht_away
            else (1 if ht_home == ht_away else 2)
        )
    return labels
def expected_classes(target):
    return [0, 1, 2] if target in ("MS", "IY") else [0, 1]
def make_model(algorithm, target):
    multiclass = len(expected_classes(target)) == 3
    if algorithm == "rf":
        estimator = RandomForestClassifier(
            n_estimators=180,
            min_samples_leaf=3,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    elif algorithm == "xgb" and xgb is not None:
        estimator = xgb.XGBClassifier(
            n_estimators=120,
            learning_rate=0.04,
            max_depth=4,
            random_state=RANDOM_STATE,
            eval_metric="mlogloss" if multiclass else "logloss",
            n_jobs=-1,
        )
    elif algorithm == "lgb" and lgb is not None:
        estimator = lgb.LGBMClassifier(
            n_estimators=120,
            learning_rate=0.04,
            max_depth=4,
            random_state=RANDOM_STATE,
            verbose=-1,
            n_jobs=-1,
        )
    else:
        return None
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("model", estimator),
    ])
def aligned_probabilities(model, X, classes):
    raw = model.predict_proba(X)
    fitted_classes = [
        int(value) for value in model.named_steps["model"].classes_
    ]
    aligned = np.zeros((len(X), len(classes)), dtype=float)
    class_positions = {value: i for i, value in enumerate(classes)}
    for source_index, class_value in enumerate(fitted_classes):
        if class_value in class_positions:
            aligned[:, class_positions[class_value]] = raw[:, source_index]
    totals = aligned.sum(axis=1)
    for index, total in enumerate(totals):
        if total > 0 and math.isfinite(float(total)):
            aligned[index] /= total
        else:
            aligned[index] = 1 / len(classes)
    return aligned
def train_one_target(rows, target):
    classes = expected_classes(target)
    eligible = [
        (features, labels[target])
        for features, labels in rows
        if labels.get(target) is not None
    ]
    if len(eligible) < MIN_TRAIN:
        return None, {
            "samples": len(eligible),
            "message": f"En az {MIN_TRAIN} eğitim örneği gerekli.",
        }
    X = np.asarray([item[0] for item in eligible], dtype=float)
    y = np.asarray([item[1] for item in eligible], dtype=int)
    if not set(classes).issubset(set(np.unique(y))):
        return None, {
            "samples": len(y),
            "message": "Tarihsel veride gerekli sonuç sınıfları eksik.",
        }
    split = int(len(y) * 0.8)
    split = max(1, min(split, len(y) - 1))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    if not set(classes).issubset(set(np.unique(y_train))):
        return None, {
            "samples": len(y),
            "trainSamples": len(y_train),
            "validationSamples": len(y_val),
            "message": "Kronolojik eğitim bölümünde gerekli sınıflar eksik.",
        }
    feature_indices = np.flatnonzero(np.isfinite(X_train).any(axis=0))
    if len(feature_indices) == 0:
        return None, {
            "samples": len(y),
            "message": "Kullanılabilir oran özelliği bulunamadı.",
        }
    X_train = X_train[:, feature_indices]
    X_val = X_val[:, feature_indices]
    X_all = X[:, feature_indices]
    algorithms = ["rf"]
    if xgb is not None:
        algorithms.append("xgb")
    if lgb is not None:
        algorithms.append("lgb")
    validation_models = {}
    metrics = {}
    for algorithm in algorithms:
        model = make_model(algorithm, target)
        try:
            model.fit(X_train, y_train)
            probs = aligned_probabilities(model, X_val, classes)
            loss = max(
                float(log_loss(y_val, probs, labels=classes)),
                MIN_LOG_LOSS,
            )
            predicted = np.asarray(classes)[np.argmax(probs, axis=1)]
            accuracy = float(accuracy_score(y_val, predicted))
            if math.isfinite(loss) and math.isfinite(accuracy):
                validation_models[algorithm] = model
                metrics[algorithm] = {
                    "accuracy": accuracy,
                    "logLoss": loss,
                }
        except Exception as exc:
            print(
                f"{target}/{algorithm} doğrulama hatası: {exc}",
                file=sys.stderr,
            )
    if not metrics:
        return None, {
            "samples": len(y),
            "message": "Hiçbir algoritma doğrulama aşamasını geçemedi.",
        }
    inverse_losses = {
        name: 1 / value["logLoss"]
        for name, value in metrics.items()
    }
    total_weight = sum(inverse_losses.values())
    weights = {
        name: value / total_weight
        for name, value in inverse_losses.items()
    }
    val_probs = np.zeros((len(y_val), len(classes)), dtype=float)
    for name, model in validation_models.items():
        val_probs += weights[name] * aligned_probabilities(
            model, X_val, classes
        )
    sums = val_probs.sum(axis=1)
    for index, total in enumerate(sums):
        if total > 0:
            val_probs[index] /= total
        else:
            val_probs[index] = 1 / len(classes)
    predicted = np.asarray(classes)[np.argmax(val_probs, axis=1)]
    accuracy = float(accuracy_score(y_val, predicted))
    ensemble_loss = float(log_loss(y_val, val_probs, labels=classes))
    positions = {value: i for i, value in enumerate(classes)}
    one_hot = np.zeros_like(val_probs)
    for index, actual in enumerate(y_val):
        one_hot[index, positions[int(actual)]] = 1
    brier = float(np.mean(np.sum((val_probs - one_hot) ** 2, axis=1)))
    final_models = {}
    for algorithm in weights:
        model = make_model(algorithm, target)
        try:
            model.fit(X_all, y)
            final_models[algorithm] = model
        except Exception as exc:
            print(
                f"{target}/{algorithm} final eğitim hatası: {exc}",
                file=sys.stderr,
            )
    if not final_models:
        return None, {
            "samples": len(y),
            "message": "Final modeller eğitilemedi.",
        }
    final_weights = {
        name: weights[name]
        for name in final_models
    }
    weight_sum = sum(final_weights.values())
    final_weights = {
        name: value / weight_sum
        for name, value in final_weights.items()
    }
    report = {
        "samples": int(len(y)),
        "trainSamples": int(len(y_train)),
        "validationSamples": int(len(y_val)),
        "validationAccuracy": round(accuracy, 6),
        "validationLogLoss": round(ensemble_loss, 6),
        "validationBrier": round(brier, 6),
        "classes": classes,
        "usedFeatures": int(len(feature_indices)),
        "removedEmptyFeatures": int(X.shape[1] - len(feature_indices)),
        "subModels": metrics,
        "ensembleWeights": final_weights,
    }
    ensemble = {
        "models": final_models,
        "weights": final_weights,
        "classes": classes,
        "featureIndices": feature_indices.tolist(),
    }
    return ensemble, report
def training_fingerprint(rows):
    # Yalnızca sonuçlanmış maçlar ve eğitimde kullanılabilir etiketler.
    # Yeni, henüz oynanmamış maç eklemek parmak izini değiştirmez.
    payload = []
    for features, labels in rows:
        payload.append({
            "features": [
                None if not math.isfinite(float(value)) else round(float(value), 6)
                for value in features
            ],
            "labels": labels,
        })
    raw = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
def load_or_train(rows, fingerprint):
    if MODEL_PATH.exists() and META_PATH.exists():
        try:
            with META_PATH.open("r", encoding="utf-8") as file:
                meta = json.load(file)
            if meta.get("fingerprint") == fingerprint:
                bundle = joblib.load(MODEL_PATH)
                if bundle.get("fingerprint") == fingerprint:
                    print("Eğitim verisi değişmemiş; kayıtlı modeller yükleniyor.")
                    return bundle, meta.get("validation", {})
        except Exception as exc:
            print(f"Model önbelleği kullanılamadı; yeniden eğitilecek: {exc}")
    print("Eğitim verisi değişti veya model yok; yeniden eğitim başlıyor.")
    models = {}
    validation = {}
    for target in TARGETS:
        ensemble, report = train_one_target(rows, target)
        validation[target] = report
        if ensemble is not None:
            models[target] = ensemble
    if not models:
        raise RuntimeError(
            "Hiçbir market için model eğitilemedi. "
            "v2-data.json içindeki skor ve oran alanlarını kontrol et."
        )
    bundle = {
        "fingerprint": fingerprint,
        "models": models,
        "validation": validation,
    }
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH, compress=3)
    with META_PATH.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "fingerprint": fingerprint,
                "validation": validation,
                "trainedAt": datetime.now(timezone.utc).isoformat(),
            },
            file,
            ensure_ascii=False,
            indent=2,
        )
    return bundle, validation
def predict(ensemble, features):
    indices = ensemble["featureIndices"]
    selected = np.asarray(features, dtype=float)[indices]
    classes = ensemble["classes"]
    combined = np.zeros(len(classes), dtype=float)
    for name, model in ensemble["models"].items():
        weight = ensemble["weights"].get(name, 0)
        if weight <= 0:
            continue
        probs = aligned_probabilities(
            model,
            np.asarray([selected], dtype=float),
            classes,
        )[0]
        combined += weight * probs
    total = combined.sum()
    if total > 0:
        combined /= total
    else:
        combined[:] = 1 / len(classes)
    return {
        int(class_value): float(combined[index])
        for index, class_value in enumerate(classes)
    }
def percent(value):
    return round(float(value) * 100, 1)
def build_market(target, probabilities):
    title = TARGET_TITLES[target]
    if target in ("MS", "IY"):
        if target == "MS":
            options = [
                (0, "MS1", "1"),
                (1, "MSX", "X"),
                (2, "MS2", "2"),
            ]
        else:
            options = [
                (0, "IY1", "İY 1"),
                (1, "IYX", "İY X"),
                (2, "IY2", "İY 2"),
            ]
        rendered = [
            {
                "key": key,
                "title": name,
                "probability": percent(probabilities.get(value, 0)),
            }
            for value, key, name in options
        ]
        best = max(rendered, key=lambda item: item["probability"])
        return {
            "title": title,
            "options": rendered,
            "pick": best["title"],
            "probability": best["probability"],
        }
    yes_title, no_title = {
        "KG": ("Var", "Yok"),
        "U25": ("Üst", "Alt"),
        "IY15U": ("Üst", "Alt"),
    }[target]
    yes = percent(probabilities.get(1, 0))
    no = round(100 - yes, 1)
    pick = yes_title if yes >= no else no_title
    return {
        "title": title,
        "options": [
            {"title": yes_title, "probability": yes},
            {"title": no_title, "probability": no},
        ],
        "pick": pick,
        "probability": max(yes, no),
    }
def main():
    matches = load_data()
    matches.sort(key=lambda match: get_date(match))
    # Eğitim yalnızca sonucu bulunan maçlardan yapılır.
    training_rows = []
    for match in matches:
        labels = get_targets(match)
        if labels is None:
            continue
        features = get_features(match)
        if sum(np.isfinite(value) for value in features) < 2:
            continue
        training_rows.append((features, labels))
    if not training_rows:
        raise RuntimeError(
            "v2-data.json içinde skoru ve kullanılabilir oranı bulunan "
            "eğitim maçı yok."
        )
    fingerprint = training_fingerprint(training_rows)
    bundle, validation = load_or_train(training_rows, fingerprint)
    models = bundle["models"]
    predictions = []
    skipped = 0
    for match in matches:
        # Skoru bulunan maçlar tahmin listesine eklenmez.
        if get_full_score(match) is not None:
            continue
        features = get_features(match)
        if sum(np.isfinite(value) for value in features) < 2:
            skipped += 1
            continue
        home = str(
            match.get("home", match.get("homeTeam", ""))
        ).strip()
        away = str(
            match.get("away", match.get("awayTeam", ""))
        ).strip()
        if not home or not away:
            skipped += 1
            continue
        item = {
            "date": get_date(match),
            "time": str(match.get("time", match.get("kickoffTime", ""))),
            "league": str(match.get("league", match.get("competition", ""))),
            "home": home,
            "away": away,
            "featuresAvailable": int(
                sum(np.isfinite(value) for value in features)
            ),
            "markets": {},
        }
        for target, ensemble in models.items():
            probabilities = predict(ensemble, features)
            item["markets"][target] = build_market(target, probabilities)
        if item["markets"]:
            predictions.append(item)
    predictions.sort(
        key=lambda item: (
            item["date"],
            item["time"],
            item["league"],
            item["home"],
        )
    )
    active_algorithms = sorted({
        name
        for ensemble in models.values()
        for name in ensemble["models"]
    })
    algorithm_names = {
        "rf": "RandomForestClassifier",
        "xgb": "XGBoost",
        "lgb": "LightGBM",
    }
    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "data/v2-data.json",
        "model": "Log Loss Weighted Ensemble",
        "activeAlgorithms": [
            algorithm_names[name]
            for name in active_algorithms
        ],
        "trainingMatches": len(training_rows),
        "trainingFingerprint": fingerprint,
        "validation": validation,
        "predictionCount": len(predictions),
        "skippedFixtures": skipped,
        "predictions": predictions,
        "notes": [
            "Tek veri kaynağı data/v2-data.json dosyasıdır.",
            "matches.json kullanılmaz.",
            "Sonucu bulunan maçlar eğitim verisi olarak kullanılır.",
            "Sonucu bulunmayan maçlar için tahmin üretilir.",
            "Eğitim verisi değişmediyse kaydedilmiş modeller yeniden kullanılır.",
            "Açılış oranlarının veri dosyasında korunması gerekir.",
        ],
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)
    # Üretilen JSON dosyasını tekrar okuyarak kontrol et.
    with OUT_PATH.open("r", encoding="utf-8") as file:
        checked = json.load(file)
    if not isinstance(checked.get("predictions"), list):
        raise RuntimeError("Tahmin JSON dosyası doğrulanamadı.")
    print(f"Eğitim örneği: {len(training_rows)}")
    print(f"Tahmin edilen maç: {len(predictions)}")
    print(f"Atlanan maç: {skipped}")
    print(f"Algoritmalar: {output['activeAlgorithms']}")
    print(f"Model dosyası: {MODEL_PATH.relative_to(ROOT)}")
    print(f"Tahmin dosyası: {OUT_PATH.relative_to(ROOT)}")
if __name__ == "__main__":
    main()
