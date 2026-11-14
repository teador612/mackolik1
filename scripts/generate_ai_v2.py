
"""Independent AI V2 training and prediction engine.

Input:
    data/v2-data.json

Outputs:
    data/ai-v2-report.json
    data/ai-v2-predictions.json

Markets:
    MS 1-X-2
    2.5 Üst
    İY 1.5 Üst
    KG Var

Models:
    RandomForest
    XGBoost
    LightGBM
    CatBoost

Chronological 70/15/15 evaluation.
No changes to existing ML, DNA, RNA or prediction archives.
"""

from __future__ import annotations

import json
import re
import time
import warnings
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter

import numpy as np
import pandas as pd

from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, log_loss, f1_score

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier

warnings.filterwarnings("ignore")

# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]

INPUT_FILE = ROOT / "data" / "v2-data.json"
REPORT_FILE = ROOT / "data" / "ai-v2-report.json"
PREDICTIONS_FILE = ROOT / "data" / "ai-v2-predictions.json"

# ---------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------

RANDOM_STATE = 42

MIN_TRAIN_ROWS = 100
MIN_CLASS_ROWS = 5

TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15
TEST_RATIO = 0.15

MARKET_KEYS = [
    "ms1", "msX", "ms2",
    "h12", "h0", "h23",
    "i14", "olmaz", "i25",
    "ms1Alt", "msXAlt", "ms2Alt",
    "ms1Ust", "msXUst", "ms2Ust",
    "au25Alt", "au25Ust",
    "au35Alt", "au35Ust",
    "kgVar", "kgYok",
    "gol01", "gol23", "gol45", "gol6plus",
    "iy1", "iyX", "iy2",
    "iy15Alt", "iy15Ust",
    "iyms11", "iyms10", "iyms12",
    "iyms01", "iyms00", "iyms02",
    "iyms21", "iyms20", "iyms22",
]

MARKETS = {
    "MS": {
        "label": "Maç Sonucu 1-X-2",
        "type": "multiclass",
        "classes": [1, 0, 2],
    },
    "OVER_25": {
        "label": "2.5 Üst",
        "type": "binary",
        "classes": [0, 1],
    },
    "HT_OVER_15": {
        "label": "İY 1.5 Üst",
        "type": "binary",
        "classes": [0, 1],
    },
    "BTTS": {
        "label": "KG Var",
        "type": "binary",
        "classes": [0, 1],
    },
}

# ---------------------------------------------------------
# GENERAL HELPERS
# ---------------------------------------------------------

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def safe_float(value):
    if value is None:
        return np.nan

    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")

            if not value:
                return np.nan

        result = float(value)

        if not np.isfinite(result):
            return np.nan

        return result

    except (ValueError, TypeError):
        return np.nan


def parse_date(value):
    if value is None:
        return None

    try:
        dt = pd.to_datetime(
            value,
            errors="coerce",
            dayfirst=True,
            utc=True,
        )

        if pd.isna(dt):
            return None

        return dt.strftime("%Y-%m-%d")

    except Exception:
        return None


def parse_score(value):
    if value is None:
        return None

    if isinstance(value, dict):
        home = value.get("home", value.get("homeScore"))
        away = value.get("away", value.get("awayScore"))

        if home is not None and away is not None:
            try:
                return int(home), int(away)
            except (ValueError, TypeError):
                return None

    text = str(value).strip()

    if not text:
        return None

    match = re.search(r"(\d+)\s*[-:]\s*(\d+)", text)

    if not match:
        return None

    try:
        return int(match.group(1)), int(match.group(2))
    except ValueError:
        return None


def extract_matches(raw):
    if isinstance(raw, list):
        return raw

    if isinstance(raw, dict):
        for key in ("matches", "data", "results", "fixtures"):
            value = raw.get(key)

            if isinstance(value, list):
                return value

    raise ValueError(
        "JSON dosyasında maç listesi bulunamadı. "
        "Beklenen yapı: liste veya matches/data/results."
    )


def get_odds(match):
    odds = match.get("odds", {})

    if not isinstance(odds, dict):
        return {}

    return odds


def make_features(match):
    odds = get_odds(match)

    return [
        safe_float(odds.get(key))
        for key in MARKET_KEYS
    ]


# ---------------------------------------------------------
# TARGET GENERATION
# ---------------------------------------------------------

def get_targets(match):
    full = parse_score(
        match.get("score")
        or match.get("fullTimeScore")
        or match.get("result")
    )

    half = parse_score(
        match.get("halfTimeScore")
        or match.get("htScore")
        or match.get("half_score")
    )

    if full is None:
        return None

    home, away = full
    total = home + away

    if home > away:
        ms = 1
    elif home == away:
        ms = 0
    else:
        ms = 2

    targets = {
        "MS": ms,
        "OVER_25": int(total >= 3),
        "BTTS": int(home > 0 and away > 0),
    }

    if half is not None:
        ht_total = half[0] + half[1]
        targets["HT_OVER_15"] = int(ht_total >= 2)

    return targets


# ---------------------------------------------------------
# DATASET
# ---------------------------------------------------------

def load_dataset():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Girdi dosyası bulunamadı: {INPUT_FILE}"
        )

    with INPUT_FILE.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    matches = extract_matches(raw)

    rows = []

    for index, match in enumerate(matches):
        if not isinstance(match, dict):
            continue

        date = parse_date(match.get("date"))

        if date is None:
            continue

        features = make_features(match)
        targets = get_targets(match)

        row = {
            "date": date,
            "index": index,
            "features": features,
            "targets": targets,
            "match": match,
        }

        rows.append(row)

    rows.sort(key=lambda x: (x["date"], x["index"]))

    return rows


def make_market_dataset(rows, market):
    X = []
    y = []
    dates = []

    for row in rows:
        targets = row["targets"]

        if targets is None or market not in targets:
            continue

        X.append(row["features"])
        y.append(targets[market])
        dates.append(row["date"])

    if not X:
        return None, None, None

    return (
        np.asarray(X, dtype=float),
        np.asarray(y, dtype=int),
        np.asarray(dates),
    )


# ---------------------------------------------------------
# CHRONOLOGICAL SPLIT
# ---------------------------------------------------------

def chronological_split(dates):
    unique_dates = sorted(set(dates.tolist()))

    if len(unique_dates) < 5:
        raise ValueError(
            "Eğitim için yeterli sayıda farklı maç tarihi yok."
        )

    count = len(unique_dates)

    train_end = max(
        1,
        int(count * TRAIN_RATIO)
    )

    validation_end = max(
        train_end + 1,
        int(count * (TRAIN_RATIO + VALIDATION_RATIO))
    )

    validation_end = min(validation_end, count - 1)

    train_dates = set(unique_dates[:train_end])
    validation_dates = set(
        unique_dates[train_end:validation_end]
    )
    test_dates = set(unique_dates[validation_end:])

    train_idx = np.array([
        d in train_dates for d in dates
    ])

    validation_idx = np.array([
        d in validation_dates for d in dates
    ])

    test_idx = np.array([
        d in test_dates for d in dates
    ])

    return (
        train_idx,
        validation_idx,
        test_idx,
        {
            "train": len(train_dates),
            "validation": len(validation_dates),
            "test": len(test_dates),
            "total": count,
        },
    )


# ---------------------------------------------------------
# MODELS
# ---------------------------------------------------------

def create_models(market):
    multiclass = market == "MS"

    models = {}

    models["RandomForest"] = RandomForestClassifier(
        n_estimators=180,
        max_depth=None,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    xgb_params = {
        "n_estimators": 180,
        "max_depth": 5,
        "learning_rate": 0.045,
        "subsample": 0.85,
        "colsample_bytree": 0.85,
        "reg_lambda": 2,
        "random_state": RANDOM_STATE,
        "n_jobs": 2,
        "tree_method": "hist",
        "verbosity": 0,
    }

    if multiclass:
        xgb_params.update({
            "objective": "multi:softprob",
            "num_class": 3,
            "eval_metric": "mlogloss",
        })
    else:
        xgb_params.update({
            "objective": "binary:logistic",
            "eval_metric": "logloss",
        })

    models["XGBoost"] = XGBClassifier(**xgb_params)

    models["LightGBM"] = LGBMClassifier(
        n_estimators=180,
        learning_rate=0.045,
        max_depth=-1,
        num_leaves=31,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=2,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=2,
        verbosity=-1,
    )

    models["CatBoost"] = CatBoostClassifier(
        iterations=180,
        depth=6,
        learning_rate=0.045,
        loss_function="MultiClass" if multiclass else "Logloss",
        verbose=False,
        random_seed=RANDOM_STATE,
        thread_count=2,
        allow_writing_files=False,
    )

    return models


def wrap_model(model):
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", model),
    ])


# ---------------------------------------------------------
# PROBABILITY HELPERS
# ---------------------------------------------------------

def normalize_probabilities(model, X, expected_classes):
    raw = model.predict_proba(X)

    model_classes = model.named_steps["model"].classes_

    result = np.zeros(
        (len(X), len(expected_classes)),
        dtype=float,
    )

    for index, class_value in enumerate(model_classes):
        if class_value in expected_classes:
            target_index = expected_classes.index(class_value)
            result[:, target_index] = raw[:, index]

    sums = result.sum(axis=1, keepdims=True)

    result = np.divide(
        result,
        sums,
        out=np.full_like(result, 1 / len(expected_classes)),
        where=sums > 0,
    )

    return result


def calculate_metrics(y_true, probabilities, classes):
    predicted_indices = np.argmax(probabilities, axis=1)

    predictions = np.asarray([
        classes[index] for index in predicted_indices
    ])

    accuracy = accuracy_score(y_true, predictions)

    try:
        loss = log_loss(
            y_true,
            probabilities,
            labels=classes,
        )
    except Exception:
        loss = None

    try:
        f1 = f1_score(
            y_true,
            predictions,
            average="weighted",
            zero_division=0,
        )
    except Exception:
        f1 = None

    return {
        "accuracy": round(float(accuracy), 6),
        "logLoss": round(float(loss), 6) if loss is not None else None,
        "f1Weighted": round(float(f1), 6) if f1 is not None else None,
        "samples": int(len(y_true)),
    }


# ---------------------------------------------------------
# TRAINING
# ---------------------------------------------------------

def train_one(model_name, model_template, X, y):
    model = wrap_model(model_template)

    model.fit(X, y)

    return model


def evaluate_market(market, X, y, dates):
    classes = MARKETS[market]["classes"]

    train_idx, val_idx, test_idx, split_info = (
        chronological_split(dates)
    )

    X_train = X[train_idx]
    y_train = y[train_idx]

    X_val = X[val_idx]
    y_val = y[val_idx]

    X_train_val = X[train_idx | val_idx]
    y_train_val = y[train_idx | val_idx]

    X_test = X[test_idx]
    y_test = y[test_idx]

    results = {}

    for model_name, template in create_models(market).items():
        print(
            f"  {market} / {model_name}: validation eğitimi",
            flush=True,
        )

        if (
            len(y_train) < MIN_TRAIN_ROWS
            or len(np.unique(y_train)) < 2
        ):
            print("    Eğitim verisi yetersiz, atlandı.")
            continue

        validation_model = train_one(
            model_name,
            template,
            X_train,
            y_train,
        )

        validation_probabilities = normalize_probabilities(
            validation_model,
            X_val,
            classes,
        )

        validation_metrics = calculate_metrics(
            y_val,
            validation_probabilities,
            classes,
        )

        del validation_model

        print(
            f"  {market} / {model_name}: test eğitimi",
            flush=True,
        )

        test_metrics = None

        if (
            len(y_train_val) >= MIN_TRAIN_ROWS
            and len(np.unique(y_train_val)) >= 2
            and len(y_test) > 0
        ):
            test_model = train_one(
                model_name,
                template,
                X_train_val,
                y_train_val,
            )

            test_probabilities = normalize_probabilities(
                test_model,
                X_test,
                classes,
            )

            test_metrics = calculate_metrics(
                y_test,
                test_probabilities,
                classes,
            )

            del test_model

        results[model_name] = {
            "validation": validation_metrics,
            "test": test_metrics,
        }

    return {
        "label": MARKETS[market]["label"],
        "split": split_info,
        "models": results,
        "samples": {
            "total": int(len(y)),
            "train": int(train_idx.sum()),
            "validation": int(val_idx.sum()),
            "test": int(test_idx.sum()),
        },
    }


# ---------------------------------------------------------
# FINAL MODELS AND FUTURE PREDICTIONS
# ---------------------------------------------------------

def train_final_models(market, X, y):
    classes = MARKETS[market]["classes"]

    if (
        len(y) < MIN_TRAIN_ROWS
        or len(np.unique(y)) < 2
    ):
        return {}

    final_models = {}

    for model_name, template in create_models(market).items():
        print(
            f"  {market} / {model_name}: final model",
            flush=True,
        )

        model = train_one(
            model_name,
            template,
            X,
            y,
        )

        final_models[model_name] = model

    return final_models


def predict_future(rows, final_models):
    future = []

    for row in rows:
        if row["targets"] is not None:
            continue

        odds = get_odds(row["match"])

        if not odds:
            continue

        if not any(
            np.isfinite(value)
            for value in row["features"]
        ):
            continue

        future.append(row)

    predictions = []

    for row in future:
        X_one = np.asarray(
            [row["features"]],
            dtype=float,
        )

        match = row["match"]

        item = {
            "date": row["date"],
            "home": (
                match.get("home")
                or match.get("homeTeam")
                or match.get("home_team")
            ),
            "away": (
                match.get("away")
                or match.get("awayTeam")
                or match.get("away_team")
            ),
            "league": match.get("league"),
            "time": match.get("time"),
            "predictions": {},
        }

        for market, models in final_models.items():
            classes = MARKETS[market]["classes"]

            market_result = {
                "label": MARKETS[market]["label"],
                "models": {},
            }

            for model_name, model in models.items():
                probabilities = normalize_probabilities(
                    model,
                    X_one,
                    classes,
                )[0]

                predicted_index = int(
                    np.argmax(probabilities)
                )

                predicted_class = classes[predicted_index]

                market_result["models"][model_name] = {
                    "prediction": int(predicted_class),
                    "probabilities": {
                        str(class_value): round(
                            float(probabilities[index]),
                            6,
                        )
                        for index, class_value in enumerate(classes)
                    },
                }

            item["predictions"][market] = market_result

        predictions.append(item)

    return predictions


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():
    started = time.perf_counter()

    print("=" * 60)
    print("AI V2 - BAĞIMSIZ MAKİNE ÖĞRENMESİ")
    print("=" * 60)

    rows = load_dataset()

    print(f"Toplam maç kaydı: {len(rows)}")

    if not rows:
        raise RuntimeError("İşlenebilir maç kaydı bulunamadı.")

    report = {
        "version": 1,
        "generatedAt": now_iso(),
        "source": "data/v2-data.json",
        "features": len(MARKET_KEYS),
        "markets": {},
        "runtimeSeconds": None,
    }

    datasets = {}
    final_models = {}

    # -----------------------------------------------------
    # EVALUATION
    # -----------------------------------------------------

    print("\n1/3 - Kronolojik model değerlendirmesi")

    for market in MARKETS:
        X, y, dates = make_market_dataset(rows, market)

        if X is None:
            report["markets"][market] = {
                "error": "Bu piyasa için etiketli veri bulunamadı."
            }
            continue

        datasets[market] = (X, y, dates)

        print(
            f"\n{MARKETS[market]['label']} "
            f"- {len(y)} örnek",
            flush=True,
        )

        report["markets"][market] = evaluate_market(
            market,
            X,
            y,
            dates,
        )

    # -----------------------------------------------------
    # FINAL TRAINING
    # -----------------------------------------------------

    print("\n2/3 - Gelecek maç modelleri eğitiliyor")

    for market, (X, y, dates) in datasets.items():
        final_models[market] = train_final_models(
            market,
            X,
            y,
        )

    # -----------------------------------------------------
    # PREDICTIONS
    # -----------------------------------------------------

    print("\n3/3 - Gelecek maç tahminleri üretiliyor")

    predictions = predict_future(
        rows,
        final_models,
    )

    elapsed = time.perf_counter() - started

    report["runtimeSeconds"] = round(elapsed, 2)
    report["runtimeMinutes"] = round(elapsed / 60, 2)

    report["dataset"] = {
        "totalRows": len(rows),
        "firstDate": min(row["date"] for row in rows),
        "lastDate": max(row["date"] for row in rows),
        "markets": list(MARKETS.keys()),
        "algorithms": [
            "RandomForest",
            "XGBoost",
            "LightGBM",
            "CatBoost",
        ],
    }

    prediction_output = {
        "version": 1,
        "generatedAt": now_iso(),
        "source": "data/v2-data.json",
        "count": len(predictions),
        "predictions": predictions,
    }

    REPORT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with REPORT_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            report,
            file,
            ensure_ascii=False,
            indent=2,
        )

    with PREDICTIONS_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            prediction_output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print("\n" + "=" * 60)
    print("AI V2 TAMAMLANDI")
    print("=" * 60)

    print(f"Toplam süre: {elapsed:.2f} saniye")
    print(f"Gelecek maç: {len(predictions)}")
    print(f"Rapor: {REPORT_FILE}")
    print(f"Tahmin: {PREDICTIONS_FILE}")

    for market, result in report["markets"].items():
        if "models" not in result:
            continue

        print(f"\n{market}")

        for model_name, metrics in result["models"].items():
            test = metrics.get("test")

            if test:
                print(
                    f"  {model_name}: "
                    f"Test doğruluk %{test['accuracy'] * 100:.2f}"
                )


if __name__ == "__main__":
    main()
