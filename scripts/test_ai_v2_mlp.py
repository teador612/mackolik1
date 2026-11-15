
"""Independent AI V2 MLP experiment.

This script does NOT modify the production AI V2 engine.

Input:
    data/v2-data.json
    data/ai-v2-report.json (existing model comparison)

Output:
    data/ai-v2-mlp-report.json

Uses:
    All 39 opening odds
    Same chronological 70/15/15 split
    MLP neural network with feature scaling

The production models and predictions remain untouched.
"""

from __future__ import annotations

import json
import time
import warnings

from pathlib import Path

import numpy as np

from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPClassifier
from sklearn.exceptions import ConvergenceWarning

import generate_ai_v2 as ai


warnings.filterwarnings("ignore", category=ConvergenceWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)


# =========================================================
# PATHS
# =========================================================

ROOT = Path(__file__).resolve().parents[1]

OUTPUT_FILE = ROOT / "data" / "ai-v2-mlp-report.json"


# =========================================================
# MLP SETTINGS
# =========================================================

RANDOM_STATE = 42

HIDDEN_LAYER_SIZES = (128, 64)

MAX_ITER = 400

LEARNING_RATE = 0.001

ALPHA = 0.001

BATCH_SIZE = 128


# =========================================================
# MODEL
# =========================================================

def create_mlp():
    return Pipeline([
        (
            "imputer",
            SimpleImputer(
                strategy="median",
                keep_empty_features=True,
            ),
        ),
        (
            "scaler",
            StandardScaler(),
        ),
        (
            "model",
            MLPClassifier(
                hidden_layer_sizes=HIDDEN_LAYER_SIZES,
                activation="relu",
                solver="adam",
                alpha=ALPHA,
                batch_size=BATCH_SIZE,
                learning_rate_init=LEARNING_RATE,
                max_iter=MAX_ITER,
                early_stopping=True,
                validation_fraction=0.10,
                n_iter_no_change=25,
                random_state=RANDOM_STATE,
                shuffle=True,
            ),
        ),
    ])


# =========================================================
# HELPERS
# =========================================================

def normalize_probabilities(model, X):
    raw = model.predict_proba(X)

    model_classes = (
        model.named_steps["model"].classes_
    )

    return ai.normalize_probability_array(
        raw,
        model_classes,
        ai.MS_CLASSES,
    )


def load_existing_report():
    if not ai.REPORT_FILE.exists():
        return None

    try:
        with ai.REPORT_FILE.open(
            "r",
            encoding="utf-8",
        ) as file:
            return json.load(file)

    except Exception:
        return None


def get_existing_test_results(report):
    if not isinstance(report, dict):
        return {}

    market = (
        report.get("markets", {})
        .get("MS", {})
    )

    results = {}

    for name, item in market.get("models", {}).items():
        test = item.get("test")

        if test:
            results[name] = test

    ensemble = market.get("ensemble", {}).get("test")

    if ensemble:
        results["Ensemble"] = ensemble

    return results


def print_metrics(name, metrics):
    if not metrics:
        return

    print(
        f"{name}: "
        f"Doğruluk %{metrics['accuracy'] * 100:.2f} | "
        f"Log Loss {metrics['logLoss']} | "
        f"Brier {metrics['brierScore']}"
    )


# =========================================================
# MAIN
# =========================================================

def main():
    started = time.perf_counter()

    print("=" * 60)
    print("AI V2 - INDEPENDENT MLP EXPERIMENT")
    print("=" * 60)

    # -----------------------------------------------------
    # LOAD DATA
    # -----------------------------------------------------

    rows = ai.load_dataset()

    X, y, dates, leagues = ai.make_dataset(rows)

    if X is None or len(y) < ai.MIN_TRAIN_ROWS:
        raise RuntimeError(
            "MLP eğitimi için yeterli MS verisi bulunamadı."
        )

    print(f"Toplam etiketli maç: {len(y)}")
    print(f"Kullanılan oran sayısı: {X.shape[1]}")

    # -----------------------------------------------------
    # SAME CHRONOLOGICAL SPLIT
    # -----------------------------------------------------

    (
        train_idx,
        validation_idx,
        test_idx,
        split_info,
    ) = ai.chronological_split(dates)

    X_train = X[train_idx]
    y_train = y[train_idx]

    X_train_validation = X[
        train_idx | validation_idx
    ]

    y_train_validation = y[
        train_idx | validation_idx
    ]

    X_validation = X[validation_idx]
    y_validation = y[validation_idx]

    X_test = X[test_idx]
    y_test = y[test_idx]

    print("\nKRONOLOJİK VERİ AYRIMI")
    print(f"Eğitim: {len(y_train)}")
    print(f"Doğrulama: {len(y_validation)}")
    print(f"Test: {len(y_test)}")

    if (
        len(np.unique(y_train)) < 3
        or len(np.unique(y_train_validation)) < 3
    ):
        raise RuntimeError(
            "Eğitim verisinde üç MS sınıfının tamamı bulunmalı."
        )

    # -----------------------------------------------------
    # VALIDATION TRAINING
    # -----------------------------------------------------

    print("\n1/2 - MLP doğrulama eğitimi", flush=True)

    validation_model = create_mlp()

    validation_model.fit(
        X_train,
        y_train,
    )

    validation_probabilities = normalize_probabilities(
        validation_model,
        X_validation,
    )

    validation_metrics = ai.calculate_metrics(
        y_validation,
        validation_probabilities,
    )

    validation_iterations = int(
        validation_model.named_steps["model"].n_iter_
    )

    print(
        f"Doğrulama tamamlandı. "
        f"İterasyon: {validation_iterations}",
        flush=True,
    )

    del validation_model

    # -----------------------------------------------------
    # FINAL TEST TRAINING
    # -----------------------------------------------------

    print("\n2/2 - MLP test eğitimi", flush=True)

    test_model = create_mlp()

    test_model.fit(
        X_train_validation,
        y_train_validation,
    )

    test_probabilities = normalize_probabilities(
        test_model,
        X_test,
    )

    test_metrics = ai.calculate_metrics(
        y_test,
        test_probabilities,
    )

    test_iterations = int(
        test_model.named_steps["model"].n_iter_
    )

    print(
        f"Test tamamlandı. "
        f"İterasyon: {test_iterations}",
        flush=True,
    )

    # -----------------------------------------------------
    # EXISTING MODEL COMPARISON
    # -----------------------------------------------------

    existing_report = load_existing_report()

    existing_results = get_existing_test_results(
        existing_report
    )

    comparison_available = False

    if existing_report:
        existing_samples = (
            existing_report.get("markets", {})
            .get("MS", {})
            .get("samples", {})
            .get("test")
        )

        if existing_samples == len(y_test):
            comparison_available = True

    comparison = {}

    if comparison_available:
        comparison = {
            name: {
                "accuracy": metrics.get("accuracy"),
                "logLoss": metrics.get("logLoss"),
                "brierScore": metrics.get("brierScore"),
                "samples": metrics.get("samples"),
            }
            for name, metrics in existing_results.items()
        }

    comparison["MLP"] = {
        "accuracy": test_metrics["accuracy"],
        "logLoss": test_metrics["logLoss"],
        "brierScore": test_metrics["brierScore"],
        "samples": test_metrics["samples"],
    }

    # -----------------------------------------------------
    # RESULT
    # -----------------------------------------------------

    elapsed = time.perf_counter() - started

    output = {
        "version": 1,
        "experiment": "Independent MLP MS 1-X-2",
        "generatedAt": ai.now_iso(),
        "productionEngineModified": False,
        "source": "data/v2-data.json",
        "target": "MS",
        "features": len(ai.MARKET_KEYS),
        "featureNames": ai.MARKET_KEYS,
        "split": split_info,
        "samples": {
            "train": int(len(y_train)),
            "validation": int(len(y_validation)),
            "test": int(len(y_test)),
        },
        "modelSettings": {
            "type": "MLPClassifier",
            "hiddenLayerSizes": list(HIDDEN_LAYER_SIZES),
            "activation": "relu",
            "solver": "adam",
            "learningRate": LEARNING_RATE,
            "alpha": ALPHA,
            "batchSize": BATCH_SIZE,
            "maxIterations": MAX_ITER,
            "earlyStopping": True,
            "featureScaling": "StandardScaler",
            "randomState": RANDOM_STATE,
        },
        "validation": validation_metrics,
        "test": test_metrics,
        "iterations": {
            "validation": validation_iterations,
            "test": test_iterations,
        },
        "existingModelComparison": {
            "available": comparison_available,
            "note": (
                "Existing report uses the same test sample count."
                if comparison_available
                else "Existing report missing or test sample count differs."
            ),
            "results": comparison,
        },
        "runtimeSeconds": round(elapsed, 2),
    }

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with OUTPUT_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    # -----------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------

    print("\n" + "=" * 60)
    print("MLP DENEYİ TAMAMLANDI")
    print("=" * 60)

    print(f"Süre: {elapsed:.2f} saniye")

    print("\nMLP DOĞRULAMA")
    print_metrics("MLP", validation_metrics)

    print("\nMLP TEST")
    print_metrics("MLP", test_metrics)

    print("\nMEVCUT MODELLERLE KARŞILAŞTIRMA")

    if comparison_available:
        for name, metrics in comparison.items():
            print_metrics(name, metrics)
    else:
        print(
            "Mevcut raporla test örnek sayısı eşleşmedi. "
            "Karşılaştırma yalnızca MLP sonucu için kaydedildi."
        )

    print(f"\nRapor: {OUTPUT_FILE}")

    print(
        "\nÜretim AI V2 kodu ve tahminleri değiştirilmedi."
    )


if __name__ == "__main__":
    main()
