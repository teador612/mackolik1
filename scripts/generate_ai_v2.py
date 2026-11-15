
"""Independent AI V2 - Dynamic five-source MS 1-X-2 prediction engine.

Input:
    data/v2-data.json

Outputs:
    data/ai-v2-report.json
    data/ai-v2-predictions.json

Prediction target:
    MS 1-X-2 only.

Features:
    All 39 opening odds.

Sources:
    RandomForest
    XGBoost
    LightGBM
    CatBoost
    Odds historical matching

Odds matching:
    MS1, MSX and MS2 odds are matched independently.
    Exact odds rounded to two decimals.
    Minimum five previous matches for each outcome.
    Same-day and future matches are excluded.

Ensemble:
    Dynamic Brier Score weighting.
    Equal weights until every active source has 30 prior observations.
    Optional league-specific weights after 30 observations.

Evaluation:
    Chronological 70/15/15 split.
    Same-day results never influence same-day weights.
"""

from __future__ import annotations

import json
import re
import time
import warnings

from pathlib import Path
from datetime import datetime, timezone
from bisect import bisect_left
from collections import defaultdict

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

MIN_WEIGHT_SAMPLES = 30
BRIER_TEMPERATURE = 0.12
MIN_ODDS_MATCHES = 5

MS_CLASSES = [1, 0, 2]

CLASS_LABELS = {
    "1": "MS1",
    "0": "MSX",
    "2": "MS2",
}

CLASS_DESCRIPTIONS = {
    "1": "Ev sahibi kazanır",
    "0": "Beraberlik",
    "2": "Deplasman kazanır",
}

MODEL_NAMES = [
    "RandomForest",
    "XGBoost",
    "LightGBM",
    "CatBoost",
]

SOURCE_NAMES = MODEL_NAMES + ["Odds"]


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


def normalize_league(value):
    if value is None:
        return "UNKNOWN"

    result = str(value).strip().lower()

    return result if result else "UNKNOWN"


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
            "league": normalize_league(
                match.get("league")
            ),
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
    leagues = []

    for row in rows:
        if row["target"] is None:
            continue

        X.append(row["features"])
        y.append(row["target"])
        dates.append(row["date"])
        leagues.append(row["league"])

    if not X:
        return None, None, None, None

    return (
        np.asarray(X, dtype=float),
        np.asarray(y, dtype=int),
        np.asarray(dates),
        np.asarray(leagues, dtype=object),
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
                keep_empty_features=True,
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

def normalize_probability_array(
    raw,
    model_classes,
    expected_classes=MS_CLASSES,
):
    result = np.zeros(
        (
            len(raw),
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


def normalize_probabilities(
    model,
    X,
    expected_classes=MS_CLASSES,
):
    raw = model.predict_proba(X)

    model_classes = (
        model.named_steps["model"].classes_
    )

    return normalize_probability_array(
        raw,
        model_classes,
        expected_classes,
    )


# =========================================================
# ODDS SOURCE - INDEPENDENT OUTCOME MATCHING
# =========================================================

def make_individual_odds_key(outcome, value):
    """
    Creates an independent historical matching key.

    MS1, MSX and MS2 are never matched as one combined
    three-odds tuple.

    Each outcome has its own exact odds bucket.
    """

    if outcome not in MS_CLASSES:
        return None

    value = safe_float(value)

    if not np.isfinite(value) or value <= 1.0:
        return None

    return (
        int(outcome),
        round(float(value), 2),
    )


def build_odds_history(rows):
    """
    Index historical results independently for each outcome.

    Example:
        (1, 1.85) -> historical MS1 odds observations
        (0, 3.20) -> historical MSX odds observations
        (2, 4.10) -> historical MS2 odds observations

    Each observation stores whether that particular
    outcome actually occurred.
    """

    history = defaultdict(list)

    for row in rows:
        target = row["target"]

        if target is None:
            continue

        features = row["features"]

        if len(features) < 3:
            continue

        for feature_index, outcome in enumerate(MS_CLASSES):
            key = make_individual_odds_key(
                outcome,
                features[feature_index],
            )

            if key is None:
                continue

            history[key].append({
                "date": row["date"],
                "hit": int(target == outcome),
            })

    for key in history:
        history[key].sort(
            key=lambda item: item["date"]
        )

    # Precompute date arrays for faster historical lookup.
    indexed_history = {}

    for key, observations in history.items():
        indexed_history[key] = {
            "dates": [
                item["date"]
                for item in observations
            ],
            "hits": [
                item["hit"]
                for item in observations
            ],
        }

    return indexed_history


def get_odds_probability(
    features,
    match_date,
    odds_history,
):
    """
    Calculates historical probabilities independently
    for MS1, MSX and MS2.

    For each outcome:
        1. Find the exact two-decimal odds bucket.
        2. Exclude same-day and future observations.
        3. Require at least MIN_ODDS_MATCHES observations.
        4. Calculate the smoothed historical hit rate.

    Final probabilities are normalized to sum to 1.

    Returns:
        probabilities, minimum_sample_count

    The minimum count represents the least-supported
    of the three independently matched outcomes.
    """

    if len(features) < 3:
        return None, 0

    raw_probabilities = []
    sample_counts = []

    for feature_index, outcome in enumerate(MS_CLASSES):
        key = make_individual_odds_key(
            outcome,
            features[feature_index],
        )

        if key is None:
            return None, 0

        bucket = odds_history.get(key)

        if bucket is None:
            return None, 0

        candidate_dates = bucket["dates"]

        # Exclude same-day and future matches.
        cutoff = bisect_left(
            candidate_dates,
            match_date,
        )

        if cutoff < MIN_ODDS_MATCHES:
            return None, cutoff

        previous_hits = bucket["hits"][:cutoff]

        sample_count = len(previous_hits)
        wins = sum(previous_hits)

        # Smoothed P(outcome | exact individual odds).
        probability = (
            wins + 0.5
        ) / (
            sample_count + 1.0
        )

        raw_probabilities.append(
            float(probability)
        )

        sample_counts.append(
            int(sample_count)
        )

    probabilities = np.asarray(
        raw_probabilities,
        dtype=float,
    )

    total = probabilities.sum()

    if (
        not np.isfinite(total)
        or total <= 0
    ):
        return None, 0

    probabilities /= total

    return probabilities, min(sample_counts)


def make_odds_probabilities(rows, odds_history):
    results = []

    for row in rows:
        probabilities, sample_count = (
            get_odds_probability(
                row["features"],
                row["date"],
                odds_history,
            )
        )

        results.append({
            "probabilities": probabilities,
            "sampleCount": sample_count,
        })

    return results


# =========================================================
# PERFORMANCE LEDGER
# =========================================================

class PerformanceLedger:
    """
    Chronological source performance tracking.

    Brier score:
        Mean squared error across the three MS classes.

    Dynamic weight:
        exp(-average_brier / BRIER_TEMPERATURE)

    Until every active source has MIN_WEIGHT_SAMPLES:
        Equal weights.

    League weights:
        Used only after every active source has enough
        prior observations in that league.
    """

    def __init__(self):
        self.global_scores = {
            name: {
                "sum": 0.0,
                "count": 0,
            }
            for name in SOURCE_NAMES
        }

        self.league_scores = defaultdict(
            lambda: {
                name: {
                    "sum": 0.0,
                    "count": 0,
                }
                for name in SOURCE_NAMES
            }
        )

    @staticmethod
    def probability_brier(
        actual,
        probabilities,
    ):
        actual_vector = np.asarray([
            1.0 if class_value == actual else 0.0
            for class_value in MS_CLASSES
        ])

        return float(
            np.mean(
                (probabilities - actual_vector) ** 2
            )
        )

    def update(
        self,
        actual,
        source_probabilities,
        league,
    ):
        """
        Update only after all predictions for a date
        have been generated.
        """

        for source_name, probabilities in (
            source_probabilities.items()
        ):
            if probabilities is None:
                continue

            score = self.probability_brier(
                actual,
                probabilities,
            )

            global_item = self.global_scores[
                source_name
            ]

            global_item["sum"] += score
            global_item["count"] += 1

            league_item = self.league_scores[
                league
            ][source_name]

            league_item["sum"] += score
            league_item["count"] += 1

    @staticmethod
    def _calculate_weights(
        score_data,
        available_sources,
    ):
        if not available_sources:
            return {}

        counts = [
            score_data[name]["count"]
            for name in available_sources
        ]

        # Equal weights until EVERY active source
        # has enough historical observations.
        if min(counts) < MIN_WEIGHT_SAMPLES:
            equal_weight = 1.0 / len(
                available_sources
            )

            return {
                name: equal_weight
                for name in available_sources
            }

        raw_weights = {}

        for name in available_sources:
            item = score_data[name]

            average_brier = (
                item["sum"] / item["count"]
            )

            raw_weights[name] = float(
                np.exp(
                    -average_brier / BRIER_TEMPERATURE
                )
            )

        total = sum(
            raw_weights.values()
        )

        if total <= 0:
            equal_weight = 1.0 / len(
                available_sources
            )

            return {
                name: equal_weight
                for name in available_sources
            }

        return {
            name: value / total
            for name, value in raw_weights.items()
        }

    def get_weights(
        self,
        league,
        available_sources,
    ):
        if not available_sources:
            return {}

        league_data = self.league_scores.get(
            league
        )

        if league_data is not None:
            league_counts = [
                league_data[name]["count"]
                for name in available_sources
            ]

            if (
                league_counts
                and min(league_counts) >= MIN_WEIGHT_SAMPLES
            ):
                return self._calculate_weights(
                    league_data,
                    available_sources,
                )

        return self._calculate_weights(
            self.global_scores,
            available_sources,
        )

    def snapshot(self):
        return {
            "minimumSamples": MIN_WEIGHT_SAMPLES,
            "brierTemperature": BRIER_TEMPERATURE,
            "global": self._snapshot_group(
                self.global_scores
            ),
            "leagues": {
                league: self._snapshot_group(data)
                for league, data in self.league_scores.items()
            },
        }

    @staticmethod
    def _snapshot_group(data):
        result = {}

        for name, item in data.items():
            count = item["count"]

            result[name] = {
                "samples": int(count),
                "averageBrier": (
                    round(
                        item["sum"] / count,
                        8,
                    )
                    if count
                    else None
                ),
            }

        return result


# =========================================================
# DYNAMIC ENSEMBLE
# =========================================================

def combine_source_probabilities(
    source_probabilities,
    league,
    ledger,
):
    available = {
        name: probabilities
        for name, probabilities in (
            source_probabilities.items()
        )
        if probabilities is not None
    }

    if not available:
        raise ValueError(
            "Ensemble için kullanılabilir kaynak yok."
        )

    weights = ledger.get_weights(
        league,
        list(available.keys()),
    )

    combined = np.zeros(
        len(MS_CLASSES),
        dtype=float,
    )

    for name, probabilities in available.items():
        combined += (
            weights[name] * probabilities
        )

    total = combined.sum()

    if total <= 0:
        combined = np.full(
            len(MS_CLASSES),
            1 / len(MS_CLASSES),
        )
    else:
        combined /= total

    return combined, weights


def process_chronological_ensemble(
    source_probability_rows,
    y,
    dates,
    leagues,
    ledger,
):
    """
    Generate ensemble predictions date by date.

    1. Get weights using only previous dates.
    2. Generate all predictions for the current date.
    3. After the entire date is finished, update the ledger.

    This prevents same-day result leakage.
    """

    combined_results = np.zeros(
        (
            len(y),
            len(MS_CLASSES),
        ),
        dtype=float,
    )

    weight_history = []

    unique_dates = sorted(
        set(dates.tolist())
    )

    for date in unique_dates:
        indices = np.where(
            dates == date
        )[0]

        pending_updates = []

        for index in indices:
            source_probabilities = (
                source_probability_rows[index]
            )

            combined, weights = (
                combine_source_probabilities(
                    source_probabilities,
                    leagues[index],
                    ledger,
                )
            )

            combined_results[index] = combined

            pending_updates.append((
                int(y[index]),
                source_probabilities,
                leagues[index],
            ))

            weight_history.append({
                "date": date,
                "league": leagues[index],
                "weights": weights,
            })

        # Update only after every match on this date
        # has received its prediction.
        for actual, source_probabilities, league in (
            pending_updates
        ):
            ledger.update(
                actual,
                source_probabilities,
                league,
            )

    return combined_results, weight_history


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

    actual_matrix = np.asarray([
        [
            1.0 if class_value == actual else 0.0
            for class_value in MS_CLASSES
        ]
        for actual in y_true
    ])

    brier = float(
        np.mean(
            (probabilities - actual_matrix) ** 2
        )
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
        "brierScore": round(
            brier,
            8,
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


def evaluate_market(
    X,
    y,
    dates,
    leagues,
    odds_probability_rows,
):
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

    dates_val = dates[val_idx]
    dates_test = dates[test_idx]

    leagues_val = leagues[val_idx]
    leagues_test = leagues[test_idx]

    model_results = {}

    validation_source_rows = [
        {}
        for _ in range(len(y_val))
    ]

    test_source_rows = [
        {}
        for _ in range(len(y_test))
    ]

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

        for index, probabilities in enumerate(val_prob):
            validation_source_rows[index][
                model_name
            ] = probabilities

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

            for index, probabilities in enumerate(test_prob):
                test_source_rows[index][
                    model_name
                ] = probabilities

            del test_model

        model_results[model_name] = {
            "validation": val_metrics,
            "test": test_metrics,
        }

    # -----------------------------------------------------
    # ADD ODDS SOURCE
    # -----------------------------------------------------

    odds_val_metrics = None
    odds_test_metrics = None

    for local_index, global_index in enumerate(
        np.where(val_idx)[0]
    ):
        odds_data = odds_probability_rows[
            global_index
        ]

        validation_source_rows[local_index][
            "Odds"
        ] = odds_data["probabilities"]

    for local_index, global_index in enumerate(
        np.where(test_idx)[0]
    ):
        odds_data = odds_probability_rows[
            global_index
        ]

        test_source_rows[local_index][
            "Odds"
        ] = odds_data["probabilities"]

    val_odds_indices = [
        index
        for index, item in enumerate(
            odds_probability_rows
        )
        if val_idx[index]
        and item["probabilities"] is not None
    ]

    if val_odds_indices:
        odds_val_metrics = calculate_metrics(
            y[val_odds_indices],
            np.asarray([
                odds_probability_rows[index]["probabilities"]
                for index in val_odds_indices
            ]),
        )

    test_odds_indices = [
        index
        for index, item in enumerate(
            odds_probability_rows
        )
        if test_idx[index]
        and item["probabilities"] is not None
    ]

    if test_odds_indices:
        odds_test_metrics = calculate_metrics(
            y[test_odds_indices],
            np.asarray([
                odds_probability_rows[index]["probabilities"]
                for index in test_odds_indices
            ]),
        )

    model_results["Odds"] = {
        "validation": odds_val_metrics,
        "test": odds_test_metrics,
        "minimumHistoricalMatches": MIN_ODDS_MATCHES,
        "matchingMethod": (
            "Independent exact MS1/MSX/MS2 opening odds "
            "rounded to 2 decimals"
        ),
    }

    # -----------------------------------------------------
    # CHRONOLOGICAL DYNAMIC ENSEMBLE
    # -----------------------------------------------------

    ledger = PerformanceLedger()

    combined_validation, validation_weights = (
        process_chronological_ensemble(
            validation_source_rows,
            y_val,
            dates_val,
            leagues_val,
            ledger,
        )
    )

    ensemble_validation = calculate_metrics(
        y_val,
        combined_validation,
    )

    combined_test, test_weights = (
        process_chronological_ensemble(
            test_source_rows,
            y_test,
            dates_test,
            leagues_test,
            ledger,
        )
    ) if len(y_test) else (
        np.empty((0, len(MS_CLASSES))),
        [],
    )

    ensemble_test = (
        calculate_metrics(
            y_test,
            combined_test,
        )
        if len(y_test)
        else None
    )

    return {
        "label": "Maç Sonucu 1-X-2",
        "classes": CLASS_DESCRIPTIONS,
        "split": split_info,
        "models": model_results,
        "ensemble": {
            "method": "Dynamic Brier Score weighted probability averaging",
            "sources": SOURCE_NAMES,
            "minimumSamples": MIN_WEIGHT_SAMPLES,
            "brierTemperature": BRIER_TEMPERATURE,
            "validation": ensemble_validation,
            "test": ensemble_test,
            "validationWeightRecords": len(validation_weights),
            "testWeightRecords": len(test_weights),
            "performanceLedger": ledger.snapshot(),
        },
        "samples": {
            "total": int(len(y)),
            "train": int(train_idx.sum()),
            "validation": int(val_idx.sum()),
            "test": int(test_idx.sum()),
        },
    }, ledger


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

def predict_future(
    rows,
    final_models,
    odds_history,
    ledger,
):
    future = []

    for row in rows:
        if row["target"] is not None:
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

        source_probabilities = {}
        model_results = {}

        for model_name, model in final_models.items():
            probabilities = normalize_probabilities(
                model,
                X_one,
            )[0]

            source_probabilities[
                model_name
            ] = probabilities

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
        # ODDS SOURCE
        # -------------------------------------------------

        odds_probabilities, odds_sample_count = (
            get_odds_probability(
                row["features"],
                row["date"],
                odds_history,
            )
        )

        source_probabilities["Odds"] = (
            odds_probabilities
        )

        odds_result = None

        if odds_probabilities is not None:
            odds_index = int(
                np.argmax(odds_probabilities)
            )

            odds_class = MS_CLASSES[
                odds_index
            ]

            odds_result = {
                "prediction": int(odds_class),
                "predictionLabel": CLASS_LABELS[
                    str(odds_class)
                ],
                "probabilities": {
                    str(class_value): round(
                        float(odds_probabilities[index]),
                        6,
                    )
                    for index, class_value in enumerate(
                        MS_CLASSES
                    )
                },
                "historicalMatches": int(
                    odds_sample_count
                ),
                "matchingMethod": "Independent MS1/MSX/MS2 odds matching",
            }

        # -------------------------------------------------
        # DYNAMIC ENSEMBLE
        # -------------------------------------------------

        combined, weights = (
            combine_source_probabilities(
                source_probabilities,
                row["league"],
                ledger,
            )
        )

        ensemble_index = int(
            np.argmax(combined)
        )

        ensemble_class = MS_CLASSES[
            ensemble_index
        ]

        league_data = ledger.league_scores.get(
            row["league"]
        )

        use_league_weights = False

        if league_data is not None and weights:
            league_counts = [
                league_data[name]["count"]
                for name in weights
            ]

            use_league_weights = (
                bool(league_counts)
                and min(league_counts) >= MIN_WEIGHT_SAMPLES
            )

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
            "sourceWeights": {
                name: round(
                    float(weight),
                    6,
                )
                for name, weight in weights.items()
            },
            "weightMethod": (
                "League-specific Brier Score"
                if use_league_weights
                else "Global Brier Score or equal-weight fallback"
            ),
        }

        item["predictions"]["MS"] = {
            "label": "Maç Sonucu 1-X-2",
            "classes": CLASS_DESCRIPTIONS,
            "models": model_results,
            "odds": odds_result,
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
    print("AI V2 - DYNAMIC FIVE-SOURCE MS 1-X-2")
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

    X, y, dates, leagues = make_dataset(rows)

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

    print(
        "\nOdds geçmiş eşleşmeleri hazırlanıyor...",
        flush=True,
    )

    odds_history = build_odds_history(rows)

    odds_probability_rows = make_odds_probabilities(
        [
            row
            for row in rows
            if row["target"] is not None
        ],
        odds_history,
    )

    odds_available = sum(
        item["probabilities"] is not None
        for item in odds_probability_rows
    )

    print(
        f"Bağımsız Odds geçmiş eşleşmesi bulunan etiketli maç: "
        f"{odds_available}",
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
        "ensembleSettings": {
            "sources": SOURCE_NAMES,
            "method": "Dynamic Brier Score weighted probability averaging",
            "minimumWeightSamples": MIN_WEIGHT_SAMPLES,
            "brierTemperature": BRIER_TEMPERATURE,
            "oddsMatching": {
                "method": "Independent exact odds matching per MS outcome",
                "markets": [
                    "ms1",
                    "msX",
                    "ms2",
                ],
                "rounding": 2,
                "minimumHistoricalMatchesPerOutcome": MIN_ODDS_MATCHES,
                "sameDayMatchesExcluded": True,
                "requiresAllThreeOutcomes": True,
                "probabilityNormalization": True,
            },
            "chronologicalUpdates": True,
            "leagueSpecificWeights": True,
        },
    }

    # -----------------------------------------------------
    # 1. EVALUATION
    # -----------------------------------------------------

    print(
        "\n1/3 - Kronolojik MS model değerlendirmesi",
        flush=True,
    )

    market_result, performance_ledger = evaluate_market(
        X,
        y,
        dates,
        leagues,
        odds_probability_rows,
    )

    report["markets"]["MS"] = market_result

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
        odds_history,
        performance_ledger,
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
        "algorithms": SOURCE_NAMES + ["Ensemble"],
        "oddsSourceAvailableMatches": int(
            odds_available
        ),
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
        f"Bağımsız Odds geçmiş eşleşmesi: {odds_available}"
    )

    print(
        f"Rapor: {REPORT_FILE}"
    )

    print(
        f"Tahmin: {PREDICTIONS_FILE}"
    )

    print("\nTEST SONUÇLARI")

    for source_name, metrics in (
        market_result["models"].items()
    ):
        test = metrics.get("test")

        if test:
            print(
                f"  {source_name}: "
                f"Doğruluk %{test['accuracy'] * 100:.2f} | "
                f"Log Loss {test['logLoss']} | "
                f"Brier {test['brierScore']}"
            )

    ensemble_test = (
        market_result["ensemble"].get("test")
    )

    if ensemble_test:
        print(
            f"  ENSEMBLE: "
            f"Doğruluk %{ensemble_test['accuracy'] * 100:.2f} | "
            f"Log Loss {ensemble_test['logLoss']} | "
            f"Brier {ensemble_test['brierScore']}"
        )

    print("\nSON PERFORMANS KAYDI")

    print(
        json.dumps(
            performance_ledger.snapshot()["global"],
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
