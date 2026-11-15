
"""Independent AI V2 - MS 1-X-2 prediction engine.

Input:
    data/v2-data.json

Outputs:
    data/ai-v2-report.json
    data/ai-v2-predictions.json

Prediction target:
    MS 1-X-2 only.

Features:
    All 39 opening odds, including HT, BTTS, goals,
    over/under and other market odds.

Models:
    RandomForest
    XGBoost
    LightGBM
    CatBoost
    Equal-weight probability Ensemble

Evaluation:
    Chronological 70/15/15 split.

Existing ML, DNA, RNA and prediction archives
are not modified.
"""

from __future__ import annotations

import json
import re
import time
import warnings

from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    log_loss,
    f1_score,
    confusion_matrix,
)

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier

warnings.filterwarnings("ignore")


# =========================================================
# PATHS
# =========================================================

ROOT = Path(__file__).resolve().parents[1]

INPUT_FILE = ROOT / "data" / "v2-data.json"
REPORT_FILE = ROOT / "data" / "ai-v2-report.json"
PREDICTIONS_FILE = ROOT / "data" / "ai-v2-predictions.json"


# =========================================================
# SETTINGS
# =========================================================

RANDOM_STATE = 42

MIN_TRAIN_ROWS = 100

TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15

# MS class order:
# 1 = Home win
# 0 = Draw
# 2 = Away win

MS_CLASSES = [1, 0, 2]

CLASS_LABELS = {
    "1": "MS1",
    "0": "MSX",
    "2": "MS2",
}


# =========================================================
# ALL 39 OPENING ODDS
# =========================================================

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


# =========================================================
# GENERAL HELPERS
# =========================================================

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
        home = value.get(
            "home",
            value.get("homeScore"),
        )

        away = value.get(
            "away",
            value.get("awayScore"),
        )

        if home is not None and away is not None:
            try:
                return int(home), int(away)
            except (ValueError, TypeError):
                return None

    text = str(value).strip()

    if not text:
        return None

    match = re.search(
        r"(\d+)\s*[-:]\s*(\d+)",
        text,
    )

    if not match:
        return None

    try:
        return (
            int(match.group(1)),
            int(match.group(2)),
        )

    except ValueError:
        return None


def extract_matches(raw):
    if isinstance(raw, list):
        return raw

    if isinstance(raw, dict):
        for key in (
            "matches",
            "data",
            "results",
            "fixtures",
        ):
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


# =========================================================
# ONLY TARGET: MS 1-X-2
# =========================================================

def get_ms_target(match):
    full = parse_score(
        match.get("score")
        or match.get("fullTimeScore")
        or match.get("result")
    )

    if full is None:
        return None

    home, away = full

    if home > away:
        return 1

    if home == away:
        return 0

    return 2


# =========================================================
# DATASET
# =========================================================

def load_dataset():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Girdi dosyası bulunamadı: {INPUT_FILE}"
        )

    with INPUT_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:
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
        target = get_ms_target(match)

        rows.append({
            "date": date,
            "index": index,
            "features": features,
            "target": target,
            "match": match,
        })

    rows.sort(
        key=lambda row: (
            row["date"],
            row["index"],
        )
    )

    return rows


def make_dataset(rows):
    X = []
    y = []
    dates = []

    for row in rows:
        if row["target"] is None:
            continue

        X.append(row["features"])
        y.append(row["target"])
        dates.append(row["date"])

    if not X:
        return None, None, None

    return (
        np.asarray(X, dtype=float),
        np.asarray(y, dtype=int),
        np.asarray(dates),
    )


# =========================================================
# CHRONOLOGICAL SPLIT
# =========================================================

def chronological_split(dates):
    unique_dates = sorted(
        set(dates.tolist())
    )

    if len(unique_dates) < 5:
        raise ValueError(
            "Eğitim için yeterli farklı maç tarihi yok."
        )

    count = len(unique_dates)

    train_end = max(
        1,
        int(count * TRAIN_RATIO),
    )

    validation_end = max(
        train_end + 1,
        int(
            count * (
                TRAIN_RATIO + VALIDATION_RATIO
            )
        ),
    )

    validation_end = min(
        validation_end,
        count - 1,
    )

    train_dates = set(
        unique_dates[:train_end]
    )

    validation_dates = set(
        unique_dates[train_end:validation_end]
    )

    test_dates = set(
        unique_dates[validation_end:]
    )

    train_idx = np.isin(
        dates,
        list(train_dates),
    )

    validation_idx = np.isin(
        dates,
        list(validation_dates),
    )

    test_idx = np.isin(
        dates,
        list(test_dates),
    )

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


# =========================================================
# MODELS
# =========================================================

def create_models():
    models = {}

    models["RandomForest"] = RandomForestClassifier(
        n_estimators=180,
        max_depth=None,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    models["XGBoost"] = XGBClassifier(
        n_estimators=180,
        max_depth=5,
        learning_rate=0.045,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=2,
        random_state=RANDOM_STATE,
        n_jobs=2,
        tree_method="hist",
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        verbosity=0,
    )

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
        loss_function="MultiClass",
        verbose=False,
        random_seed=RANDOM_STATE,
        thread_count=2,
        allow_writing_files=False,
    )

    return models


def wrap_model(model):
    return Pipeline([
        (
            "imputer",
            SimpleImputer(
                strategy="median",
            ),
        ),
        (
            "model",
            model,
        ),
    ])


# =========================================================
# PROBABILITY HELPERS
# =========================================================

def normalize_probabilities(
    model,
    X,
    expected_classes=MS_CLASSES,
):
    raw = model.predict_proba(X)

    model_classes = (
        model.named_steps["model"].classes_
    )

    result = np.zeros(
        (
            len(X),
            len(expected_classes),
        ),
        dtype=float,
    )

    for index, class_value in enumerate(model_classes):
        if class_value in expected_classes:
            target_index = expected_classes.index(
                class_value
            )

            result[:, target_index] = raw[:, index]

    sums = result.sum(
        axis=1,
        keepdims=True,
    )

    result = np.divide(
        result,
        sums,
        out=np.full_like(
            result,
            1 / len(expected_classes),
        ),
        where=sums > 0,
    )

    return result


def ensemble_probabilities(probability_list):
    if not probability_list:
        raise ValueError(
            "Ensemble için kullanılabilir model yok."
        )

    stacked = np.stack(
        probability_list,
        axis=0,
    )

    # Equal-weight probability averaging.
    result = np.mean(
        stacked,
        axis=0,
    )

    sums = result.sum(
        axis=1,
        keepdims=True,
    )

    return np.divide(
        result,
        sums,
        out=np.full_like(
            result,
            1 / len(MS_CLASSES),
        ),
        where=sums > 0,
    )


# =========================================================
# METRICS
# =========================================================

def calculate_metrics(y_true, probabilities):
    predicted_indices = np.argmax(
        probabilities,
        axis=1,
    )

    predictions = np.asarray([
        MS_CLASSES[index]
        for index in predicted_indices
    ])

    accuracy = accuracy_score(
        y_true,
        predictions,
    )

    try:
        loss = log_loss(
            y_true,
            probabilities,
            labels=MS_CLASSES,
        )
    except Exception:
        loss = None

    f1 = f1_score(
        y_true,
        predictions,
        labels=MS_CLASSES,
        average="weighted",
        zero_division=0,
    )

    matrix = confusion_matrix(
        y_true,
        predictions,
        labels=MS_CLASSES,
    )

    return {
        "accuracy": round(
            float(accuracy),
            6,
        ),
        "logLoss": (
            round(float(loss), 6)
            if loss is not None
            else None
        ),
        "f1Weighted": round(
            float(f1),
            6,
        ),
        "samples": int(len(y_true)),
        "confusionMatrix": matrix.tolist(),
        "classOrder": MS_CLASSES,
    }


# =========================================================
# TRAINING
# =========================================================

def train_one(template, X, y):
    model = wrap_model(template)

    model.fit(
        X,
        y,
    )

    return model


def evaluate_market(X, y, dates):
    (
        train_idx,
        val_idx,
        test_idx,
        split_info,
    ) = chronological_split(dates)

    X_train = X[train_idx]
    y_train = y[train_idx]

    X_val = X[val_idx]
    y_val = y[val_idx]

    X_train_val = X[
        train_idx | val_idx
    ]

    y_train_val = y[
        train_idx | val_idx
    ]

    X_test = X[test_idx]
    y_test = y[test_idx]

    model_results = {}

    validation_probabilities = []
    test_probabilities = []

    validation_model_count = 0
    test_model_count = 0

    templates = create_models()

    for model_name, template in templates.items():
        print(
            f"  MS / {model_name}: validation eğitimi",
            flush=True,
        )

        if (
            len(y_train) < MIN_TRAIN_ROWS
            or len(np.unique(y_train)) < 2
        ):
            print(
                "    Eğitim verisi yetersiz, atlandı.",
                flush=True,
            )
            continue

        validation_model = train_one(
            template,
            X_train,
            y_train,
        )

        val_prob = normalize_probabilities(
            validation_model,
            X_val,
        )

        val_metrics = calculate_metrics(
            y_val,
            val_prob,
        )

        validation_probabilities.append(
            val_prob
        )

        validation_model_count += 1

        del validation_model

        print(
            f"  MS / {model_name}: test eğitimi",
            flush=True,
        )

        test_metrics = None

        if (
            len(y_train_val) >= MIN_TRAIN_ROWS
            and len(np.unique(y_train_val)) >= 2
            and len(y_test) > 0
        ):
            test_model = train_one(
                template,
                X_train_val,
                y_train_val,
            )

            test_prob = normalize_probabilities(
                test_model,
                X_test,
            )

            test_metrics = calculate_metrics(
                y_test,
                test_prob,
            )

            test_probabilities.append(
                test_prob
            )

            test_model_count += 1

            del test_model

        model_results[model_name] = {
            "validation": val_metrics,
            "test": test_metrics,
        }

    # -----------------------------------------------------
    # VALIDATION ENSEMBLE
    # -----------------------------------------------------

    ensemble_validation = None

    if validation_probabilities:
        combined_validation = (
            ensemble_probabilities(
                validation_probabilities
            )
        )

        ensemble_validation = calculate_metrics(
            y_val,
            combined_validation,
        )

    # -----------------------------------------------------
    # TEST ENSEMBLE
    # -----------------------------------------------------

    ensemble_test = None

    if (
        test_probabilities
        and len(test_probabilities) == test_model_count
    ):
        combined_test = ensemble_probabilities(
            test_probabilities
        )

        ensemble_test = calculate_metrics(
            y_test,
            combined_test,
        )

    return {
        "label": "Maç Sonucu 1-X-2",
        "classes": {
            "1": "Ev sahibi kazanır",
            "0": "Beraberlik",
            "2": "Deplasman kazanır",
        },
        "split": split_info,
        "models": model_results,
        "ensemble": {
            "method": "Equal-weight probability averaging",
            "validation": ensemble_validation,
            "test": ensemble_test,
        },
        "samples": {
            "total": int(len(y)),
            "train": int(train_idx.sum()),
            "validation": int(validation_idx.sum()),
            "test": int(test_idx.sum()),
        },
    }


# =========================================================
# FINAL MODELS
# =========================================================

def train_final_models(X, y):
    if (
        len(y) < MIN_TRAIN_ROWS
        or len(np.unique(y)) < 2
    ):
        raise RuntimeError(
            "MS final modelleri için yeterli eğitim verisi yok."
        )

    final_models = {}

    for model_name, template in create_models().items():
        print(
            f"  MS / {model_name}: final model",
            flush=True,
        )

        model = train_one(
            template,
            X,
            y,
        )

        final_models[model_name] = model

    return final_models


# =========================================================
# FUTURE PREDICTIONS
# =========================================================

def predict_future(rows, final_models):
    future = []

    for row in rows:
        # Only matches without a full-time result.
        if row["target"] is not None:
            continue

        # At least one opening odds value must exist.
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

        model_results = {}
        all_probabilities = []

        for model_name, model in final_models.items():
            probabilities = normalize_probabilities(
                model,
                X_one,
            )[0]

            all_probabilities.append(
                probabilities
            )

            predicted_index = int(
                np.argmax(probabilities)
            )

            predicted_class = MS_CLASSES[
                predicted_index
            ]

            model_results[model_name] = {
                "prediction": int(predicted_class),
                "predictionLabel": CLASS_LABELS[
                    str(predicted_class)
                ],
                "probabilities": {
                    str(class_value): round(
                        float(probabilities[index]),
                        6,
                    )
                    for index, class_value in enumerate(
                        MS_CLASSES
                    )
                },
            }

        # -------------------------------------------------
        # ENSEMBLE
        # -------------------------------------------------

        combined = ensemble_probabilities(
            [
                probability.reshape(1, -1)
                for probability in all_probabilities
            ]
        )[0]

        ensemble_index = int(
            np.argmax(combined)
        )

        ensemble_class = MS_CLASSES[
            ensemble_index
        ]

        ensemble_result = {
            "prediction": int(ensemble_class),
            "predictionLabel": CLASS_LABELS[
                str(ensemble_class)
            ],
            "probabilities": {
                str(class_value): round(
                    float(combined[index]),
                    6,
                )
                for index, class_value in enumerate(
                    MS_CLASSES
                )
            },
            "confidence": round(
                float(np.max(combined)),
                6,
            ),
        }

        item["predictions"]["MS"] = {
            "label": "Maç Sonucu 1-X-2",
            "classes": {
                "1": "Ev sahibi kazanır",
                "0": "Beraberlik",
                "2": "Deplasman kazanır",
            },
            "models": model_results,
            "ensemble": ensemble_result,
        }

        predictions.append(item)

    return predictions


# =========================================================
# MAIN
# =========================================================

def main():
    started = time.perf_counter()

    print("=" * 60)
    print("AI V2 - SADECE MS 1-X-2")
    print("=" * 60)

    rows = load_dataset()

    print(
        f"Toplam maç kaydı: {len(rows)}",
        flush=True,
    )

    if not rows:
        raise RuntimeError(
            "İşlenebilir maç kaydı bulunamadı."
        )

    X, y, dates = make_dataset(rows)

    if X is None:
        raise RuntimeError(
            "MS için etiketli veri bulunamadı."
        )

    print(
        f"MS etiketli maç: {len(y)}",
        flush=True,
    )

    print(
        f"Kullanılan oran sayısı: {len(MARKET_KEYS)}",
        flush=True,
    )

    print(
        f"MS sınıf dağılımı: "
        f"1={int(np.sum(y == 1))}, "
        f"X={int(np.sum(y == 0))}, "
        f"2={int(np.sum(y == 2))}",
        flush=True,
    )

    report = {
        "version": 2,
        "generatedAt": now_iso(),
        "source": "data/v2-data.json",
        "target": "MS",
        "targetLabel": "Maç Sonucu 1-X-2",
        "features": len(MARKET_KEYS),
        "featureNames": MARKET_KEYS,
        "markets": {},
    }

    # -----------------------------------------------------
    # 1. EVALUATION
    # -----------------------------------------------------

    print(
        "\n1/3 - Kronolojik MS model değerlendirmesi",
        flush=True,
    )

    report["markets"]["MS"] = evaluate_market(
        X,
        y,
        dates,
    )

    # -----------------------------------------------------
    # 2. FINAL TRAINING
    # -----------------------------------------------------

    print(
        "\n2/3 - MS gelecek maç modelleri eğitiliyor",
        flush=True,
    )

    final_models = train_final_models(
        X,
        y,
    )

    # -----------------------------------------------------
    # 3. PREDICTIONS
    # -----------------------------------------------------

    print(
        "\n3/3 - MS gelecek maç tahminleri üretiliyor",
        flush=True,
    )

    predictions = predict_future(
        rows,
        final_models,
    )

    elapsed = time.perf_counter() - started

    report["runtimeSeconds"] = round(
        elapsed,
        2,
    )

    report["runtimeMinutes"] = round(
        elapsed / 60,
        2,
    )

    report["dataset"] = {
        "totalRows": len(rows),
        "labeledMatches": len(y),
        "firstDate": min(
            row["date"] for row in rows
        ),
        "lastDate": max(
            row["date"] for row in rows
        ),
        "target": "MS",
        "algorithms": [
            "RandomForest",
            "XGBoost",
            "LightGBM",
            "CatBoost",
            "Ensemble",
        ],
    }

    prediction_output = {
        "version": 2,
        "generatedAt": now_iso(),
        "source": "data/v2-data.json",
        "target": "MS",
        "targetLabel": "Maç Sonucu 1-X-2",
        "features": len(MARKET_KEYS),
        "count": len(predictions),
        "predictions": predictions,
    }

    REPORT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with REPORT_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            report,
            file,
            ensure_ascii=False,
            indent=2,
        )

    with PREDICTIONS_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            prediction_output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    # -----------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------

    print("\n" + "=" * 60)
    print("AI V2 MS TAMAMLANDI")
    print("=" * 60)

    print(
        f"Toplam süre: {elapsed:.2f} saniye"
    )

    print(
        f"Gelecek maç: {len(predictions)}"
    )

    print(
        f"Rapor: {REPORT_FILE}"
    )

    print(
        f"Tahmin: {PREDICTIONS_FILE}"
    )

    print("\nTEST SONUÇLARI")

    market_result = report["markets"]["MS"]

    for model_name, metrics in market_result["models"].items():
        test = metrics.get("test")

        if test:
            print(
                f"  {model_name}: "
                f"Doğruluk %{test['accuracy'] * 100:.2f} | "
                f"Log Loss {test['logLoss']} | "
                f"F1 {test['f1Weighted']}"
            )

    ensemble_test = market_result["ensemble"].get("test")

    if ensemble_test:
        print(
            f"  ENSEMBLE: "
            f"Doğruluk %{ensemble_test['accuracy'] * 100:.2f} | "
            f"Log Loss {ensemble_test['logLoss']} | "
            f"F1 {ensemble_test['f1Weighted']}"
        )


if __name__ == "__main__":
    main()
