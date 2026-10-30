
import json
import re
import warnings
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    log_loss,
    mean_absolute_error,
    mean_squared_error
)

from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier, LGBMRegressor
from catboost import CatBoostClassifier, CatBoostRegressor

warnings.filterwarnings("ignore")

# =========================================================
# AYARLAR
# =========================================================

DATA_PATH = Path("data/v2-data.json")
OUTPUT_DIR = Path("outputs")

TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15
RANDOM_STATE = 42

# Yalnızca match["odds"] içindeki 39 açılış oranı kullanılır.
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
    "iyms21", "iyms20", "iyms22"
]

ALGORITHMS = [
    "Random Forest",
    "XGBoost",
    "LightGBM",
    "CatBoost"
]

CLASS_TARGETS = [
    "MS 1-X-2",
    "KG Var-Yok",
    "İY 0.5 Alt-Üst",
    "İY 1.5 Alt-Üst",
    "MS 1.5 Alt-Üst",
    "MS 2.5 Alt-Üst",
    "MS 3.5 Alt-Üst",
    "İY 1-X-2",
    "Gol aralığı"
]

REGRESSION_TARGETS = [
    "MS ev sahibi gol",
    "MS deplasman gol",
    "İY ev sahibi gol",
    "İY deplasman gol"
]


# =========================================================
# YARDIMCI FONKSİYONLAR
# =========================================================

def parse_date(value):
    try:
        return datetime.strptime(
            str(value).strip(), "%d.%m.%Y"
        ).date()
    except (ValueError, TypeError):
        return None


def parse_score(value):
    if not isinstance(value, str):
        return None

    match = re.fullmatch(
        r"\s*(\d+)\s*[-:]\s*(\d+)\s*", value
    )

    if not match:
        return None

    return int(match.group(1)), int(match.group(2))


def make_features(match):
    odds = match.get("odds")

    if not isinstance(odds, dict):
        odds = {}

    features = []

    for key in MARKET_KEYS:
        value = odds.get(key)

        try:
            number = float(value)

            if not np.isfinite(number) or number <= 0:
                number = np.nan

        except (ValueError, TypeError):
            number = np.nan

        features.append(number)

    return features


def make_match_id(match):
    return "|".join([
        str(match.get("date", "")),
        str(match.get("time", "")),
        str(match.get("league", "")),
        str(match.get("home", "")),
        str(match.get("away", ""))
    ])


def json_safe(value):
    if isinstance(value, dict):
        return {
            str(key): json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]

    if isinstance(value, np.ndarray):
        return json_safe(value.tolist())

    if isinstance(value, (np.integer,)):
        return int(value)

    if isinstance(value, (np.floating,)):
        return float(value) if np.isfinite(value) else None

    if isinstance(value, (np.bool_,)):
        return bool(value)

    if isinstance(value, float) and not np.isfinite(value):
        return None

    return value


def print_section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# =========================================================
# HEDEF ETİKETLER
# =========================================================

def get_class_targets(match):
    ft = parse_score(match.get("score"))
    ht = parse_score(match.get("halfTimeScore"))

    targets = {}

    if ft is not None:
        home, away = ft
        total = home + away

        if home > away:
            targets["MS 1-X-2"] = "1"
        elif home == away:
            targets["MS 1-X-2"] = "X"
        else:
            targets["MS 1-X-2"] = "2"

        targets["KG Var-Yok"] = (
            "Var" if home > 0 and away > 0 else "Yok"
        )

        targets["MS 1.5 Alt-Üst"] = (
            "Üst" if total >= 2 else "Alt"
        )

        targets["MS 2.5 Alt-Üst"] = (
            "Üst" if total >= 3 else "Alt"
        )

        targets["MS 3.5 Alt-Üst"] = (
            "Üst" if total >= 4 else "Alt"
        )

        if total <= 1:
            targets["Gol aralığı"] = "0-1"
        elif total <= 3:
            targets["Gol aralığı"] = "2-3"
        elif total <= 5:
            targets["Gol aralığı"] = "4-5"
        else:
            targets["Gol aralığı"] = "6+"

    if ht is not None:
        home, away = ht
        total = home + away

        targets["İY 0.5 Alt-Üst"] = (
            "Üst" if total >= 1 else "Alt"
        )

        targets["İY 1.5 Alt-Üst"] = (
            "Üst" if total >= 2 else "Alt"
        )

        if home > away:
            targets["İY 1-X-2"] = "1"
        elif home == away:
            targets["İY 1-X-2"] = "X"
        else:
            targets["İY 1-X-2"] = "2"

    return targets


def get_regression_targets(match):
    ft = parse_score(match.get("score"))
    ht = parse_score(match.get("halfTimeScore"))

    targets = {}

    if ft is not None:
        targets["MS ev sahibi gol"] = ft[0]
        targets["MS deplasman gol"] = ft[1]

    if ht is not None:
        targets["İY ev sahibi gol"] = ht[0]
        targets["İY deplasman gol"] = ht[1]

    return targets


# =========================================================
# MODEL OLUŞTURMA
# =========================================================

def make_classifier(algorithm, class_count):

    if algorithm == "Random Forest":
        return Pipeline([
            (
                "imputer",
                SimpleImputer(
                    strategy="median",
                    add_indicator=True,
                    keep_empty_features=True
                )
            ),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=180,
                    max_features="sqrt",
                    min_samples_leaf=2,
                    class_weight="balanced_subsample",
                    random_state=RANDOM_STATE,
                    n_jobs=2
                )
            )
        ])

    if algorithm == "XGBoost":
        return XGBClassifier(
            n_estimators=250,
            max_depth=5,
            learning_rate=0.045,
            subsample=0.85,
            colsample_bytree=0.85,
            objective=(
                "multi:softprob"
                if class_count > 2
                else "binary:logistic"
            ),
            eval_metric=(
                "mlogloss"
                if class_count > 2
                else "logloss"
            ),
            tree_method="hist",
            random_state=RANDOM_STATE,
            n_jobs=2
        )

    if algorithm == "LightGBM":
        return LGBMClassifier(
            n_estimators=250,
            num_leaves=25,
            learning_rate=0.04,
            verbosity=-1,
            random_state=RANDOM_STATE,
            n_jobs=2
        )

    if algorithm == "CatBoost":
        return CatBoostClassifier(
            iterations=250,
            depth=6,
            learning_rate=0.04,
            loss_function=(
                "MultiClass"
                if class_count > 2
                else "Logloss"
            ),
            verbose=False,
            allow_writing_files=False,
            thread_count=2,
            random_seed=RANDOM_STATE
        )

    raise ValueError(f"Bilinmeyen algoritma: {algorithm}")


def make_regressor(algorithm):

    if algorithm == "Random Forest":
        return Pipeline([
            (
                "imputer",
                SimpleImputer(
                    strategy="median",
                    add_indicator=True,
                    keep_empty_features=True
                )
            ),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=180,
                    min_samples_leaf=2,
                    random_state=RANDOM_STATE,
                    n_jobs=2
                )
            )
        ])

    if algorithm == "XGBoost":
        return XGBRegressor(
            n_estimators=250,
            max_depth=5,
            learning_rate=0.045,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="reg:squarederror",
            eval_metric="mae",
            tree_method="hist",
            random_state=RANDOM_STATE,
            n_jobs=2
        )

    if algorithm == "LightGBM":
        return LGBMRegressor(
            n_estimators=250,
            num_leaves=25,
            learning_rate=0.04,
            verbosity=-1,
            random_state=RANDOM_STATE,
            n_jobs=2
        )

    if algorithm == "CatBoost":
        return CatBoostRegressor(
            iterations=250,
            depth=6,
            learning_rate=0.04,
            loss_function="RMSE",
            verbose=False,
            allow_writing_files=False,
            thread_count=2,
            random_seed=RANDOM_STATE
        )

    raise ValueError(f"Bilinmeyen algoritma: {algorithm}")


# =========================================================
# SINIFLANDIRMA METRİKLERİ
# =========================================================

def aligned_probabilities(model, X, class_names):
    raw = model.predict_proba(X)

    result = np.zeros(
        (len(X), len(class_names)),
        dtype=float
    )

    model_classes = list(model.classes_)

    for source_index, encoded_class in enumerate(model_classes):
        class_index = int(encoded_class)

        if 0 <= class_index < len(class_names):
            result[:, class_index] = raw[:, source_index]

    row_sums = result.sum(axis=1)
    valid = row_sums > 0

    result[valid] = (
        result[valid] / row_sums[valid, None]
    )

    return result


def classification_metrics(y_true, probabilities, class_names):

    class_to_index = {
        label: index
        for index, label in enumerate(class_names)
    }

    # Eğitimde hiç görülmemiş sınıf varsa metriğe dahil edilmez.
    valid_indices = [
        index for index, label in enumerate(y_true)
        if label in class_to_index
    ]

    if not valid_indices:
        return None

    filtered_y = [y_true[index] for index in valid_indices]
    filtered_probabilities = probabilities[valid_indices]

    y_indexes = np.array([
        class_to_index[label]
        for label in filtered_y
    ])

    predictions = [
        class_names[index]
        for index in np.argmax(
            filtered_probabilities,
            axis=1
        )
    ]

    accuracy = accuracy_score(filtered_y, predictions)

    macro_f1 = f1_score(
        filtered_y,
        predictions,
        labels=class_names,
        average="macro",
        zero_division=0
    )

    try:
        loss = log_loss(
            y_indexes,
            filtered_probabilities,
            labels=list(range(len(class_names)))
        )
    except ValueError:
        loss = None

    one_hot = np.eye(len(class_names))[y_indexes]

    brier = float(np.mean(np.sum(
        (filtered_probabilities - one_hot) ** 2,
        axis=1
    )))

    return {
        "accuracy": float(accuracy),
        "macroF1": float(macro_f1),
        "logLoss": float(loss) if loss is not None else None,
        "brierScore": brier,
        "evaluatedSamples": len(filtered_y)
    }


def regression_metrics(y_true, predictions):
    return {
        "mae": float(
            mean_absolute_error(y_true, predictions)
        ),
        "rmse": float(
            np.sqrt(mean_squared_error(y_true, predictions))
        )
    }


# =========================================================
# ANA PROGRAM
# =========================================================

def main():

    print_section("ML MODEL EĞİTİMİ BAŞLIYOR")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Veri dosyası bulunamadı: {DATA_PATH}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    with DATA_PATH.open(
        "r",
        encoding="utf-8"
    ) as file:
        data = json.load(file)

    matches = data.get("matches", [])

    if not isinstance(matches, list):
        raise ValueError("matches alanı liste değil.")

    today = datetime.now(
        ZoneInfo("Europe/Istanbul")
    ).date()

    print(f"Bugünün tarihi: {today}")
    print(f"Toplam kayıt: {len(matches):,}")
    print(f"Özellik sayısı: {len(MARKET_KEYS)}")

    rows = []

    for match in matches:

        if not isinstance(match, dict):
            continue

        match_date = parse_date(match.get("date"))

        if match_date is None:
            continue

        rows.append({
            "date": match_date,
            "match": match,
            "features": make_features(match),
            "class_targets": get_class_targets(match),
            "regression_targets": get_regression_targets(match)
        })

    # Geçmişteki geçerli MS skorlu maçlar.
    completed_rows = [
        row for row in rows
        if row["date"] < today
        and parse_score(
            row["match"].get("score")
        ) is not None
    ]

    unique_dates = sorted({
        row["date"]
        for row in completed_rows
    })

    if len(unique_dates) < 3:
        raise ValueError(
            "Tarih bazlı bölme için yeterli veri yok."
        )

    train_end = int(
        len(unique_dates) * TRAIN_RATIO
    )

    validation_end = int(
        len(unique_dates) *
        (TRAIN_RATIO + VALIDATION_RATIO)
    )

    train_end = max(
        1,
        min(train_end, len(unique_dates) - 2)
    )

    validation_end = max(
        train_end + 1,
        min(validation_end, len(unique_dates) - 1)
    )

    train_dates = set(unique_dates[:train_end])

    validation_dates = set(
        unique_dates[train_end:validation_end]
    )

    test_dates = set(
        unique_dates[validation_end:]
    )

    train_rows = [
        row for row in completed_rows
        if row["date"] in train_dates
    ]

    validation_rows = [
        row for row in completed_rows
        if row["date"] in validation_dates
    ]

    test_rows = [
        row for row in completed_rows
        if row["date"] in test_dates
    ]

    print_section("VERİ BÖLÜNME SONUCU")

    print(
        f"Eğitim: {len(train_rows):,} maç | "
        f"{min(train_dates)} - {max(train_dates)}"
    )

    print(
        f"Doğrulama: {len(validation_rows):,} maç | "
        f"{min(validation_dates)} - {max(validation_dates)}"
    )

    print(
        f"Son test: {len(test_rows):,} maç | "
        f"{min(test_dates)} - {max(test_dates)}"
    )

    X_train_all = np.asarray(
        [row["features"] for row in train_rows],
        dtype=float
    )

    X_validation_all = np.asarray(
        [row["features"] for row in validation_rows],
        dtype=float
    )

    X_test_all = np.asarray(
        [row["features"] for row in test_rows],
        dtype=float
    )

    report = {
        "createdAt": datetime.now(
            ZoneInfo("Europe/Istanbul")
        ).isoformat(),
        "dataUpdatedAt": data.get("updatedAt"),
        "today": today.isoformat(),
        "featureCount": len(MARKET_KEYS),
        "features": MARKET_KEYS,
        "split": {
            "train": {
                "matches": len(train_rows),
                "startDate": min(train_dates).isoformat(),
                "endDate": max(train_dates).isoformat()
            },
            "validation": {
                "matches": len(validation_rows),
                "startDate": min(validation_dates).isoformat(),
                "endDate": max(validation_dates).isoformat()
            },
            "test": {
                "matches": len(test_rows),
                "startDate": min(test_dates).isoformat(),
                "endDate": max(test_dates).isoformat()
            }
        },
        "classification": {},
        "regression": {},
        "algorithms": ALGORITHMS
    }

    # =====================================================
    # 9 SINIFLANDIRMA HEDEFİ
    # =====================================================

    for target_name in CLASS_TARGETS:

        print_section(
            f"SINIFLANDIRMA: {target_name}"
        )

        train_indices = [
            index for index, row in enumerate(train_rows)
            if target_name in row["class_targets"]
        ]

        validation_indices = [
            index for index, row in enumerate(validation_rows)
            if target_name in row["class_targets"]
        ]

        test_indices = [
            index for index, row in enumerate(test_rows)
            if target_name in row["class_targets"]
        ]

        y_train = [
            train_rows[index]["class_targets"][target_name]
            for index in train_indices
        ]

        y_validation = [
            validation_rows[index]["class_targets"][target_name]
            for index in validation_indices
        ]

        y_test = [
            test_rows[index]["class_targets"][target_name]
            for index in test_indices
        ]

        X_train = X_train_all[train_indices]
        X_validation = X_validation_all[validation_indices]
        X_test = X_test_all[test_indices]

        classes = sorted(set(y_train))

        print(f"Eğitim örneği: {len(y_train):,}")
        print(f"Doğrulama örneği: {len(y_validation):,}")
        print(f"Test örneği: {len(y_test):,}")
        print(f"Sınıflar: {classes}")

        if len(classes) < 2:
            print(
                "Atlandı: Eğitim verisinde en az iki sınıf gerekli."
            )
            continue

        class_to_number = {
            label: index
            for index, label in enumerate(classes)
        }

        y_train_encoded = np.asarray([
            class_to_number[label]
            for label in y_train
        ], dtype=int)

        report["classification"][target_name] = {
            "trainSamples": len(y_train),
            "validationSamples": len(y_validation),
            "testSamples": len(y_test),
            "classes": classes,
            "models": {}
        }

        for algorithm in ALGORITHMS:

            print(f"\n{algorithm} eğitiliyor...")

            model = make_classifier(
                algorithm,
                len(classes)
            )

            model.fit(
                X_train,
                y_train_encoded
            )

            validation_result = None
            test_result = None

            if len(y_validation):

                validation_probabilities = aligned_probabilities(
                    model,
                    X_validation,
                    classes
                )

                validation_result = classification_metrics(
                    y_validation,
                    validation_probabilities,
                    classes
                )

            if len(y_test):

                test_probabilities = aligned_probabilities(
                    model,
                    X_test,
                    classes
                )

                test_result = classification_metrics(
                    y_test,
                    test_probabilities,
                    classes
                )

            report["classification"][target_name][
                "models"
            ][algorithm] = {
                "validation": validation_result,
                "test": test_result
            }

            if test_result:
                print(
                    f"Test Accuracy: "
                    f"{test_result['accuracy']:.4f} | "
                    f"Macro F1: "
                    f"{test_result['macroF1']:.4f} | "
                    f"Log Loss: "
                    f"{test_result['logLoss']}"
                )

            del model

    # =====================================================
    # 4 SKOR REGRESYON HEDEFİ
    # =====================================================

    for target_name in REGRESSION_TARGETS:

        print_section(
            f"SKOR REGRESYONU: {target_name}"
        )

        train_indices = [
            index for index, row in enumerate(train_rows)
            if target_name in row["regression_targets"]
        ]

        validation_indices = [
            index for index, row in enumerate(validation_rows)
            if target_name in row["regression_targets"]
        ]

        test_indices = [
            index for index, row in enumerate(test_rows)
            if target_name in row["regression_targets"]
        ]

        y_train = np.asarray([
            train_rows[index]["regression_targets"][target_name]
            for index in train_indices
        ], dtype=float)

        y_validation = np.asarray([
            validation_rows[index]["regression_targets"][target_name]
            for index in validation_indices
        ], dtype=float)

        y_test = np.asarray([
            test_rows[index]["regression_targets"][target_name]
            for index in test_indices
        ], dtype=float)

        X_train = X_train_all[train_indices]
        X_validation = X_validation_all[validation_indices]
        X_test = X_test_all[test_indices]

        print(f"Eğitim örneği: {len(y_train):,}")
        print(f"Doğrulama örneği: {len(y_validation):,}")
        print(f"Test örneği: {len(y_test):,}")

        report["regression"][target_name] = {
            "trainSamples": len(y_train),
            "validationSamples": len(y_validation),
            "testSamples": len(y_test),
            "models": {}
        }

        for algorithm in ALGORITHMS:

            print(f"\n{algorithm} eğitiliyor...")

            model = make_regressor(algorithm)

            model.fit(
                X_train,
                y_train
            )

            validation_result = None
            test_result = None

            if len(y_validation):

                validation_predictions = model.predict(
                    X_validation
                )

                validation_result = regression_metrics(
                    y_validation,
                    validation_predictions
                )

            if len(y_test):

                test_predictions = model.predict(
                    X_test
                )

                test_result = regression_metrics(
                    y_test,
                    test_predictions
                )

            report["regression"][target_name][
                "models"
            ][algorithm] = {
                "validation": validation_result,
                "test": test_result
            }

            if test_result:
                print(
                    f"Test MAE: {test_result['mae']:.4f} | "
                    f"RMSE: {test_result['rmse']:.4f}"
                )

            del model

    # =====================================================
    # YENİ MAÇLARI BELİRLE
    # =====================================================

    print_section(
        "YENİ MAÇLAR İÇİN MODEL EĞİTİMİ"
    )

    prediction_rows = [
        row for row in rows
        if row["date"] >= today
        and parse_score(
            row["match"].get("score")
        ) is None
    ]

    X_prediction = np.asarray(
        [row["features"] for row in prediction_rows],
        dtype=float
    )

    print(
        f"Tahmin edilecek maç: {len(prediction_rows):,}"
    )

    predictions_output = {
        "createdAt": datetime.now(
            ZoneInfo("Europe/Istanbul")
        ).isoformat(),
        "dataUpdatedAt": data.get("updatedAt"),
        "today": today.isoformat(),
        "featureCount": len(MARKET_KEYS),
        "algorithms": ALGORITHMS,
        "predictionCount": len(prediction_rows),
        "matches": []
    }

    for row in prediction_rows:

        match = row["match"]

        predictions_output["matches"].append({
            "matchId": make_match_id(match),
            "date": match.get("date"),
            "time": match.get("time"),
            "league": match.get("league"),
            "home": match.get("home"),
            "away": match.get("away"),
            "predictions": {}
        })

    # =====================================================
    # SINIFLANDIRMA TAHMİNLERİ
    # =====================================================

    for target_name in CLASS_TARGETS:

        print(
            f"\nTahmin modeli: {target_name}"
        )

        full_indices = [
            index for index, row in enumerate(completed_rows)
            if target_name in row["class_targets"]
        ]

        if not full_indices or not prediction_rows:
            continue

        X_full = np.asarray([
            completed_rows[index]["features"]
            for index in full_indices
        ], dtype=float)

        y_full = [
            completed_rows[index]["class_targets"][target_name]
            for index in full_indices
        ]

        classes = sorted(set(y_full))

        if len(classes) < 2:
            continue

        class_to_number = {
            label: index
            for index, label in enumerate(classes)
        }

        y_full_encoded = np.asarray([
            class_to_number[label]
            for label in y_full
        ], dtype=int)

        for algorithm in ALGORITHMS:

            print(
                f"{algorithm}: yeniden eğitim"
            )

            model = make_classifier(
                algorithm,
                len(classes)
            )

            model.fit(
                X_full,
                y_full_encoded
            )

            probabilities = aligned_probabilities(
                model,
                X_prediction,
                classes
            )

            for match_index, row_probabilities in enumerate(
                probabilities
            ):

                class_probabilities = {
                    class_name: round(
                        float(row_probabilities[class_index]) * 100,
                        2
                    )
                    for class_index, class_name in enumerate(classes)
                }

                best_class = max(
                    class_probabilities,
                    key=class_probabilities.get
                )

                predictions_output["matches"][match_index][
                    "predictions"
                ].setdefault(
                    target_name, {}
                )[algorithm] = {
                    "probabilities": class_probabilities,
                    "prediction": best_class
                }

            del model

    # =====================================================
    # SKOR TAHMİNLERİ
    # =====================================================

    regression_predictions = {}

    for target_name in REGRESSION_TARGETS:

        print(
            f"\nSkor modeli: {target_name}"
        )

        full_indices = [
            index for index, row in enumerate(completed_rows)
            if target_name in row["regression_targets"]
        ]

        if not full_indices or not prediction_rows:
            continue

        X_full = np.asarray([
            completed_rows[index]["features"]
            for index in full_indices
        ], dtype=float)

        y_full = np.asarray([
            completed_rows[index]["regression_targets"][target_name]
            for index in full_indices
        ], dtype=float)

        regression_predictions[target_name] = {}

        for algorithm in ALGORITHMS:

            print(
                f"{algorithm}: yeniden eğitim"
            )

            model = make_regressor(algorithm)

            model.fit(
                X_full,
                y_full
            )

            regression_predictions[target_name][algorithm] = (
                model.predict(X_prediction)
            )

            del model

    for match_index, match_output in enumerate(
        predictions_output["matches"]
    ):

        for algorithm in ALGORITHMS:

            score_data = {}

            score_groups = [
                (
                    "fullTime",
                    "MS ev sahibi gol",
                    "MS deplasman gol"
                ),
                (
                    "halfTime",
                    "İY ev sahibi gol",
                    "İY deplasman gol"
                )
            ]

            for prefix, home_key, away_key in score_groups:

                if (
                    home_key not in regression_predictions
                    or away_key not in regression_predictions
                ):
                    continue

                home_goals = max(
                    0.0,
                    float(
                        regression_predictions[
                            home_key
                        ][algorithm][match_index]
                    )
                )

                away_goals = max(
                    0.0,
                    float(
                        regression_predictions[
                            away_key
                        ][algorithm][match_index]
                    )
                )

                rounded_home = int(
                    np.floor(home_goals + 0.5)
                )

                rounded_away = int(
                    np.floor(away_goals + 0.5)
                )

                score_data[prefix] = {
                    "expectedHomeGoals": round(
                        home_goals, 3
                    ),
                    "expectedAwayGoals": round(
                        away_goals, 3
                    ),
                    "predictedScore": (
                        f"{rounded_home}-{rounded_away}"
                    )
                }

            if score_data:

                match_output["predictions"].setdefault(
                    "Skor tahmini", {}
                )[algorithm] = score_data

    # =====================================================
    # JSON DOSYALARINI KAYDET
    # =====================================================

    report_path = (
        OUTPUT_DIR / "ml-training-report.json"
    )

    predictions_path = (
        OUTPUT_DIR / "ml-predictions.json"
    )

    with report_path.open(
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            json_safe(report),
            file,
            ensure_ascii=False,
            indent=2
        )

    with predictions_path.open(
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            json_safe(predictions_output),
            file,
            ensure_ascii=False,
            indent=2
        )

    print_section("İŞLEM TAMAMLANDI")

    print(
        f"Eğitim raporu: {report_path}"
    )

    print(
        f"Tahmin dosyası: {predictions_path}"
    )

    print(
        f"Tahmin edilen maç: {len(prediction_rows):,}"
    )

    print(
        "Model dosyaları kalıcı olarak kaydedilmedi."
    )

    print(
        "Eğitim ve tahmin JSON dosyaları oluşturuldu."
    )


if __name__ == "__main__":
    main()
