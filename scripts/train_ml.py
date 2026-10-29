
#!/usr/bin/env python3
# Mackolik ML - Log Loss Weighted Ensemble
# Marketler: MS, KG, U25, IY15U, IY

import json
import math
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
V2_PATH = ROOT / "data" / "v2-data.json"
LIVE_PATH = ROOT / "data" / "matches.json"
OUT_PATH = ROOT / "outputs" / "ml-predictions.json"

MIN_TRAIN = 80
RANDOM_STATE = 42
MIN_LOG_LOSS = 0.01

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline
    from sklearn.metrics import accuracy_score, log_loss
except ImportError:
    print("HATA: numpy ve scikit-learn kurulu değil.", file=sys.stderr)
    raise

ACTIVE_ALGORITHMS = ["RandomForestClassifier"]
HAS_XGB = False
HAS_LGB = False

try:
    import xgboost as xgb
    HAS_XGB = True
    ACTIVE_ALGORITHMS.append("XGBoost")
except ImportError:
    pass

try:
    import lightgbm as lgb
    HAS_LGB = True
    ACTIVE_ALGORITHMS.append("LightGBM")
except ImportError:
    pass

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


def load_json(path):
    if not path.exists():
        print(f"UYARI: dosya bulunamadı: {path}")
        return []

    with path.open("r", encoding="utf-8-sig") as file:
        obj = json.load(file)

    if isinstance(obj, list):
        return obj

    if isinstance(obj, dict):
        for key in ("matches", "data", "items", "results"):
            if isinstance(obj.get(key), list):
                return obj[key]

    raise ValueError(f"{path} içinde maç listesi bulunamadı.")


def num(value):
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        number = float(value)
    else:
        value = str(value).strip().replace(",", ".")
        if not value or value in ("-", "—", "null", "None", "0.00"):
            return None

        match = re.search(r"\d+(?:\.\d+)?", value)
        if not match:
            return None

        number = float(match.group(0))

    return number if math.isfinite(number) and 1.01 <= number <= 100 else None


def get_nested(obj, keys):
    containers = (
        obj,
        obj.get("openingOdds"),
        obj.get("odds"),
        obj.get("markets"),
        obj.get("opening_odds"),
    )

    for container in containers:
        if not isinstance(container, dict):
            continue

        for key in keys:
            if key in container:
                value = num(container.get(key))
                if value is not None:
                    return value

    return None


def get_date(match):
    for key in (
        "date", "matchDate", "match_date",
        "tarih", "datetime", "kickoff",
    ):
        if match.get(key):
            return str(match[key])

    return ""


def parse_score(value):
    if isinstance(value, dict):
        home = value.get("home", value.get("h", value.get("homeScore")))
        away = value.get("away", value.get("a", value.get("awayScore")))

        try:
            home = int(home)
            away = int(away)

            if home < 0 or away < 0:
                return None

            return home, away
        except (ValueError, TypeError):
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


def full_score(match):
    for key in (
        "score", "fullTimeScore", "full_time_score",
        "ft", "resultScore", "skor", "sonuc",
    ):
        if key in match:
            parsed = parse_score(match[key])
            if parsed is not None:
                return parsed

    return None


def half_score(match):
    for key in (
        "halfTimeScore", "half_time_score", "ht",
        "iySkor", "halfScore", "devreSkoru",
    ):
        if key in match:
            parsed = parse_score(match[key])
            if parsed is not None:
                return parsed

    return None


def feature_row(match):
    row = []
    found = 0

    for aliases in ODDS_ALIASES.values():
        value = get_nested(match, aliases)
        row.append(value if value is not None else np.nan)

        if value is not None:
            found += 1

    home_odd, draw_odd, away_odd = row[:3]

    if all(
        np.isfinite(value) and value > 0
        for value in (home_odd, draw_odd, away_odd)
    ):
        inverse = [1 / home_odd, 1 / draw_odd, 1 / away_odd]
        total = sum(inverse)
        row.extend([value / total for value in inverse])
    else:
        row.extend([np.nan, np.nan, np.nan])

    return row, found


def targets(match):
    ft = full_score(match)

    if ft is None:
        return None

    home, away = ft

    # MS: 0=ev sahibi, 1=beraberlik, 2=deplasman
    ms = 0 if home > away else (1 if home == away else 2)

    # İkili hedeflerde 1=evet, 0=hayır
    kg = int(home > 0 and away > 0)
    over25 = int(home + away >= 3)

    ht = half_score(match)

    iy15u = None
    iy = None

    if ht is not None:
        ht_home, ht_away = ht
        iy15u = int(ht_home + ht_away >= 2)
        iy = 0 if ht_home > ht_away else (
            1 if ht_home == ht_away else 2
        )

    return {
        "MS": ms,
        "KG": kg,
        "U25": over25,
        "IY15U": iy15u,
        "IY": iy,
    }


def valid_train_row(match):
    features, count = feature_row(match)
    labels = targets(match)

    valid = (
        labels is not None
        and count >= 2
        and not all(np.isnan(value) for value in features)
    )

    return valid, features, labels, count


def required_classes(target):
    return [0, 1, 2] if target in ("MS", "IY") else [0, 1]


def create_model(algo, target, seed):
    multiclass = len(required_classes(target)) > 2
    eval_metric = "mlogloss" if multiclass else "logloss"

    if algo == "rf":
        estimator = RandomForestClassifier(
            n_estimators=240,
            min_samples_leaf=3,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=seed,
            n_jobs=-1,
        )

    elif algo == "xgb" and HAS_XGB:
        estimator = xgb.XGBClassifier(
            n_estimators=150,
            learning_rate=0.03,
            max_depth=4,
            random_state=seed,
            eval_metric=eval_metric,
            n_jobs=-1,
        )

    elif algo == "lgb" and HAS_LGB:
        estimator = lgb.LGBMClassifier(
            n_estimators=150,
            learning_rate=0.03,
            max_depth=4,
            random_state=seed,
            verbose=-1,
            n_jobs=-1,
        )

    else:
        return None

    # Boş sütunlar eğitim öncesinde çıkarıldığı için medyan uyarısı
    # oluşmamalıdır. add_indicator mevcut eksiklik bilgisini korur.
    return Pipeline([
        (
            "imputer",
            SimpleImputer(strategy="median", add_indicator=True),
        ),
        ("model", estimator),
    ])


def aligned_probabilities(model, X, expected_classes):
    """Model olasılıklarını beklenen sınıf sırasına göre hizala."""
    raw = model.predict_proba(X)

    model_classes = [
        int(value) for value in model.named_steps["model"].classes_
    ]

    aligned = np.zeros(
        (len(X), len(expected_classes)),
        dtype=float,
    )

    expected_index = {
        class_value: idx
        for idx, class_value in enumerate(expected_classes)
    }

    for source_idx, class_value in enumerate(model_classes):
        if class_value in expected_index:
            aligned[:, expected_index[class_value]] = raw[:, source_idx]

    totals = aligned.sum(axis=1)

    for idx, total in enumerate(totals):
        if total > 0:
            aligned[idx] /= total
        else:
            aligned[idx] = 1.0 / len(expected_classes)

    return aligned


def train_target(rows, target):
    expected = required_classes(target)

    eligible = [
        (features, labels[target])
        for features, labels, _ in rows
        if labels.get(target) is not None
    ]

    if len(eligible) < MIN_TRAIN:
        return None, {
            "samples": len(eligible),
            "message": f"Eğitim için en az {MIN_TRAIN} maç gerekli.",
        }

    X = np.asarray(
        [features for features, _ in eligible],
        dtype=float,
    )
    y = np.asarray(
        [label for _, label in eligible],
        dtype=int,
    )

    overall_classes = set(int(value) for value in np.unique(y))

    if not set(expected).issubset(overall_classes):
        return None, {
            "samples": len(y),
            "classes": sorted(overall_classes),
            "message": (
                f"Veride gerekli sınıflar eksik. Beklenen={expected}."
            ),
        }

    # Son %20 kronolojik doğrulama kümesidir.
    split = max(int(len(y) * 0.8), 1)

    if split >= len(y):
        return None, {
            "samples": len(y),
            "message": "Doğrulama kümesi oluşturulamadı.",
        }

    X_train_full, X_val_full = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    train_classes = set(int(value) for value in np.unique(y_train))

    if not set(expected).issubset(train_classes):
        return None, {
            "samples": len(y),
            "trainSamples": len(y_train),
            "validationSamples": len(y_val),
            "classes": sorted(train_classes),
            "message": (
                "Kronolojik eğitim bölümünde gerekli sınıflar yok. "
                f"Beklenen={expected}, bulunan={sorted(train_classes)}."
            ),
        }

    # ÖNEMLİ DÜZELTME:
    # Sadece kronolojik eğitim bölümüne bakılır.
    # Bu bölümde tamamı NaN olan sütunlar modelden çıkarılır.
    # Aynı sütun seçimi doğrulama, final eğitim ve canlı tahminde kullanılır.
    feature_indices = np.flatnonzero(
        np.isfinite(X_train_full).any(axis=0)
    )

    if len(feature_indices) == 0:
        return None, {
            "samples": len(y),
            "message": "Eğitim bölümünde kullanılabilir oran özelliği yok.",
        }

    X_train = X_train_full[:, feature_indices]
    X_val = X_val_full[:, feature_indices]
    X_final = X[:, feature_indices]

    removed_features = int(X.shape[1] - len(feature_indices))

    algos = ["rf"]

    if HAS_XGB:
        algos.append("xgb")

    if HAS_LGB:
        algos.append("lgb")

    validation_metrics = {}

    # Modeller yalnızca eğitim bölümünde eğitilir.
    for algo in algos:
        model = create_model(algo, target, RANDOM_STATE)

        if model is None:
            continue

        try:
            model.fit(X_train, y_train)

            probabilities = aligned_probabilities(
                model,
                X_val,
                expected,
            )

            loss = float(log_loss(
                y_val,
                probabilities,
                labels=expected,
            ))

            accuracy = float(accuracy_score(
                y_val,
                model.predict(X_val),
            ))

            if not math.isfinite(loss):
                continue

            validation_metrics[algo] = {
                "log_loss": max(loss, MIN_LOG_LOSS),
                "accuracy": accuracy,
            }

        except Exception as exc:
            print(
                f"[{target}] {algo.upper()} doğrulama hatası: {exc}",
                file=sys.stderr,
            )

    if not validation_metrics:
        return None, {
            "samples": len(y),
            "trainSamples": len(y_train),
            "validationSamples": len(y_val),
            "removedEmptyFeatures": removed_features,
            "message": "Hiçbir model doğrulama aşamasını geçemedi.",
        }

    # Düşük Log Loss = yüksek ağırlık.
    inverse_scores = {
        algo: 1.0 / max(data["log_loss"], MIN_LOG_LOSS)
        for algo, data in validation_metrics.items()
    }

    inverse_total = sum(inverse_scores.values())

    if not math.isfinite(inverse_total) or inverse_total <= 0:
        weights = {
            algo: 1.0 / len(inverse_scores)
            for algo in inverse_scores
        }
    else:
        weights = {
            algo: score / inverse_total
            for algo, score in inverse_scores.items()
        }

    # Final modeller tüm uygun tarihsel veriyle eğitilir.
    # Özellik sütunları, eğitim bölümünde seçilenlerle aynı kalır.
    final_models = {}

    for algo in weights:
        model = create_model(algo, target, RANDOM_STATE)

        if model is None:
            continue

        try:
            model.fit(X_final, y)
            final_models[algo] = model

        except Exception as exc:
            print(
                f"[{target}] {algo.upper()} final eğitim hatası: {exc}",
                file=sys.stderr,
            )

    if not final_models:
        return None, {
            "samples": len(y),
            "removedEmptyFeatures": removed_features,
            "message": "Final eğitim aşamasında hiçbir model çalışmadı.",
        }

    # Başarısız final modellerinin ağırlıklarını çıkar ve yeniden normalize et.
    weights = {
        algo: weights[algo]
        for algo in final_models
    }

    weight_total = sum(weights.values())

    if weight_total > 0:
        weights = {
            algo: value / weight_total
            for algo, value in weights.items()
        }
    else:
        weights = {
            algo: 1.0 / len(final_models)
            for algo in final_models
        }

    report = {
        "samples": len(y),
        "trainSamples": len(y_train),
        "validationSamples": len(y_val),
        "classes": expected,
        "inputFeatures": int(X.shape[1]),
        "usedFeatures": int(len(feature_indices)),
        "removedEmptyFeatures": removed_features,
        "subModels": {
            algo: {
                "validationAccuracy": round(
                    data["accuracy"] * 100, 2
                ),
                "validationLogLoss": round(data["log_loss"], 4),
            }
            for algo, data in validation_metrics.items()
        },
        "ensembleWeights": {
            algo: round(weight, 4)
            for algo, weight in weights.items()
        },
    }

    return {
        "models": final_models,
        "weights": weights,
        "classes": expected,
        "featureIndices": feature_indices.tolist(),
    }, report


def get_ensemble_probabilities(ensemble, features):
    expected = ensemble["classes"]

    # Eğitimde kullanılan sütunları aynı sırayla seç.
    feature_indices = ensemble["featureIndices"]
    selected_features = np.asarray(
        features,
        dtype=float,
    )[feature_indices]

    combined = {
        int(class_value): 0.0
        for class_value in expected
    }

    for algo, model in ensemble["models"].items():
        weight = ensemble["weights"].get(algo, 0.0)

        if weight <= 0:
            continue

        try:
            probabilities = aligned_probabilities(
                model,
                np.asarray([selected_features], dtype=float),
                expected,
            )[0]

            for idx, class_value in enumerate(expected):
                combined[int(class_value)] += (
                    weight * float(probabilities[idx])
                )

        except Exception as exc:
            print(
                f"Tahmin uyarısı ({algo}): {exc}",
                file=sys.stderr,
            )

    total = sum(combined.values())

    if total > 0 and math.isfinite(total):
        combined = {
            key: value / total
            for key, value in combined.items()
        }
    else:
        equal_probability = 1.0 / len(expected)
        combined = {
            int(key): equal_probability
            for key in expected
        }

    return combined


def fmt_pct(value):
    return round(float(value) * 100, 1)


def is_finished(match):
    if full_score(match) is not None:
        return True

    status = str(
        match.get("status", match.get("state", ""))
    ).strip().lower()

    return status in ("finished", "ended", "ft", "4", "5")


def main():
    print(f"Kurulu algoritmalar: {ACTIVE_ALGORITHMS}")

    v2 = load_json(V2_PATH)
    live = load_json(LIVE_PATH)

    if not v2:
        raise RuntimeError(
            "data/v2-data.json boş veya bulunamadı; eğitim yapılamıyor."
        )

    if not live:
        print(
            "UYARI: data/matches.json boş veya bulunamadı; "
            "tahmin listesi boş olacak."
        )

    training = []

    for match in v2:
        valid, features, labels, _ = valid_train_row(match)

        if valid:
            training.append((features, labels, get_date(match)))

    if not training:
        raise RuntimeError(
            "v2-data.json içinden uygun eğitim maçı çıkarılamadı."
        )

    # Tarih sırası, geçmişten geleceğe.
    training.sort(key=lambda row: row[2] or "")

    trained_models = {}
    validation_report = {}

    for target in ("MS", "KG", "U25", "IY15U", "IY"):
        ensemble, report = train_target(training, target)
        validation_report[target] = report

        if ensemble is not None:
            trained_models[target] = ensemble

    predictions = []
    skipped = 0

    market_labels = (
        ("MS", "Maç Sonucu"),
        ("KG", "Karşılıklı Gol"),
        ("U25", "2.5 Gol Alt/Üst"),
        ("IY15U", "İlk Yarı 1.5 Gol Alt/Üst"),
        ("IY", "İlk Yarı Sonucu"),
    )

    for match in live:
        if not isinstance(match, dict) or is_finished(match):
            continue

        features, feature_count = feature_row(match)

        if feature_count < 2:
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

        prediction = {
            "date": get_date(match),
            "time": str(
                match.get("time", match.get("kickoffTime", ""))
            ),
            "league": str(
                match.get("league", match.get("competition", ""))
            ),
            "home": home,
            "away": away,
            "featuresAvailable": feature_count,
            "markets": {},
        }

        for target, title in market_labels:
            ensemble = trained_models.get(target)

            if ensemble is None:
                continue

            probabilities = get_ensemble_probabilities(
                ensemble,
                features,
            )

            if target in ("MS", "IY"):
                if target == "IY":
                    specs = [
                        (0, "IY1", "İY 1"),
                        (1, "IYX", "İY X"),
                        (2, "IY2", "İY 2"),
                    ]
                else:
                    specs = [
                        (0, "MS1", "1"),
                        (1, "MSX", "X"),
                        (2, "MS2", "2"),
                    ]

                options = [
                    {
                        "key": key,
                        "title": option_title,
                        "probability": fmt_pct(
                            probabilities.get(class_value, 0.0)
                        ),
                    }
                    for class_value, key, option_title in specs
                ]

                best = max(
                    options,
                    key=lambda option: option["probability"],
                )

                prediction["markets"][target] = {
                    "title": title,
                    "options": options,
                    "pick": best["title"],
                    "probability": best["probability"],
                }

            else:
                yes = fmt_pct(probabilities.get(1, 0.0))
                no = round(100.0 - yes, 1)

                yes_title, no_title = {
                    "KG": ("Var", "Yok"),
                    "U25": ("Üst", "Alt"),
                    "IY15U": ("Üst", "Alt"),
                }[target]

                pick = yes_title if yes >= no else no_title

                prediction["markets"][target] = {
                    "title": title,
                    "options": [
                        {
                            "title": yes_title,
                            "probability": yes,
                        },
                        {
                            "title": no_title,
                            "probability": no,
                        },
                    ],
                    "pick": pick,
                    "probability": max(yes, no),
                }

        if prediction["markets"]:
            predictions.append(prediction)

    predictions.sort(
        key=lambda item: (
            item["date"],
            item["time"],
            item["league"],
            item["home"],
        )
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    algorithm_names = {
        "rf": "RandomForestClassifier",
        "xgb": "XGBoost",
        "lgb": "LightGBM",
    }

    used_algorithms = []

    for ensemble in trained_models.values():
        for algo in ensemble["models"]:
            if algo not in used_algorithms:
                used_algorithms.append(algo)

    used_algorithm_names = [
        algorithm_names[algo]
        for algo in used_algorithms
    ]

    output = {
        "generatedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "source": {
            "training": "data/v2-data.json",
            "fixtures": "data/matches.json",
        },
        "model": (
            "Log Loss Weighted Ensemble ("
            + " + ".join(used_algorithm_names)
            + ")"
        ),
        "activeAlgorithms": used_algorithm_names,
        "trainingMatches": len(training),
        "validation": validation_report,
        "predictionCount": len(predictions),
        "skippedFixtures": skipped,
        "predictions": predictions,
        "notes": [
            "Harici tahmin API'si kullanılmaz.",
            "Ağırlıklar kronolojik doğrulama kümesindeki Log Loss değerlerine dayanır.",
            "Final modeller tüm uygun tarihsel veriyle yeniden eğitilir.",
            "Sınıf olasılıkları beklenen sınıf sırasına hizalanır.",
            "Eğitim bölümünde tamamen boş olan özellik sütunları otomatik çıkarılır.",
        ],
    }

    # Çıktıyı yaz ve dosya/JSON yapısını doğrula.
    OUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    if not OUT_PATH.exists() or OUT_PATH.stat().st_size == 0:
        raise RuntimeError(
            "ml-predictions.json oluşturulamadı veya boş."
        )

    with OUT_PATH.open("r", encoding="utf-8") as file:
        checked = json.load(file)

    if not isinstance(checked.get("predictions"), list):
        raise RuntimeError(
            "ML çıktısındaki predictions alanı geçersiz."
        )

    if not isinstance(checked.get("validation"), dict):
        raise RuntimeError(
            "ML çıktısındaki validation alanı geçersiz."
        )

    print(
        "ML tamamlandı: "
        f"eğitim={len(training)}, "
        f"tahmin={len(predictions)}, "
        f"atlanan={skipped}"
    )

    print(f"Kullanılan algoritmalar: {used_algorithm_names}")
    print(f"Çıktı: {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
