
import json
import math
import statistics
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from xgboost import XGBRegressor
from lightgbm import LGBMRegressor
from catboost import CatBoostRegressor


# ============================================================
# AYARLAR
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

INPUT_CANDIDATES = [
    BASE_DIR / "basketball.json",
    BASE_DIR / "data" / "basketball.json",
]

OUTPUT_FILE = BASE_DIR / "ml-predictions.json"

LEAGUE_NAME = "NBA"

MIN_TEAM_HISTORY = 3
MIN_TRAINING_ROWS = 40

RANDOM_STATE = 42

MODEL_NAMES = [
    "RandomForest",
    "XGBoost",
    "LightGBM",
    "CatBoost",
]


# ============================================================
# VERİ OKUMA
# ============================================================

def load_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(data):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2
        )


def find_input_file():
    for path in INPUT_CANDIDATES:
        if path.is_file():
            return path

    raise FileNotFoundError(
        "basketball.json bulunamadi."
    )


# ============================================================
# TARİH VE MAÇ KONTROLLERİ
# ============================================================

def parse_date(value):
    if not value:
        return None

    try:
        text = str(value).strip()

        if text.endswith("Z"):
            text = text[:-1] + "+00:00"

        result = datetime.fromisoformat(text)

        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)

        return result.astimezone(timezone.utc)

    except (ValueError, TypeError):
        return None


def get_match_date(match):
    return (
        parse_date(match.get("utcDate"))
        or parse_date(match.get("date"))
    )


def is_nba(match):
    return str(match.get("league", "")).strip().upper() == LEAGUE_NAME


def get_score(match, key):
    value = match.get(key)

    try:
        if value is None:
            return None

        score = float(value)

        if not math.isfinite(score) or score < 0:
            return None

        return score

    except (ValueError, TypeError):
        return None


def is_finished(match):
    if not is_nba(match):
        return False

    if match.get("played") is False:
        return False

    status = str(match.get("status", "")).upper()

    if status and any(
        word in status
        for word in ("SCHEDULED", "IN_PROGRESS", "POSTPONED", "CANCELED")
    ):
        return False

    home_score = get_score(match, "homeScore")
    away_score = get_score(match, "awayScore")

    return (
        home_score is not None
        and away_score is not None
        and status != "STATUS_CANCELED"
    )


def is_upcoming(match):
    if not is_nba(match):
        return False

    if match.get("played") is True:
        return False

    return (
        get_score(match, "homeScore") is None
        and get_score(match, "awayScore") is None
        and get_match_date(match) is not None
    )


# ============================================================
# TAKIM GEÇMİŞİ
# ============================================================

def collect_team_history(matches, team_name, target_date):
    history = []

    for match in matches:
        if not is_finished(match):
            continue

        match_date = get_match_date(match)

        if match_date is None or match_date >= target_date:
            continue

        home = str(match.get("homeTeam", "")).strip()
        away = str(match.get("awayTeam", "")).strip()

        home_score = get_score(match, "homeScore")
        away_score = get_score(match, "awayScore")

        if home_score is None or away_score is None:
            continue

        if home == team_name:
            history.append({
                "date": match_date,
                "scored": home_score,
                "conceded": away_score,
                "is_home": True,
                "opponent": away,
                "won": home_score > away_score,
            })

        elif away == team_name:
            history.append({
                "date": match_date,
                "scored": away_score,
                "conceded": home_score,
                "is_home": False,
                "opponent": home,
                "won": away_score > home_score,
            })

    history.sort(key=lambda item: item["date"])

    return history


def average(values, default=0.0):
    return float(statistics.mean(values)) if values else default


def safe_std(values):
    if len(values) < 2:
        return 0.0

    return float(statistics.pstdev(values))


# ============================================================
# ÖZELLİK ÜRETİMİ
# ============================================================

def team_features(history, target_date, prefix, target_is_home):
    if len(history) < MIN_TEAM_HISTORY:
        return None

    recent5 = history[-5:]
    recent10 = history[-10:]

    scored = [item["scored"] for item in history]
    conceded = [item["conceded"] for item in history]
    totals = [
        item["scored"] + item["conceded"]
        for item in history
    ]

    recent_scored = [item["scored"] for item in recent5]
    recent_conceded = [item["conceded"] for item in recent5]

    recent10_scored = [item["scored"] for item in recent10]
    recent10_conceded = [item["conceded"] for item in recent10]

    home_games = [
        item for item in history
        if item["is_home"]
    ]

    away_games = [
        item for item in history
        if not item["is_home"]
    ]

    role_games = home_games if target_is_home else away_games

    recent_wins = sum(item["won"] for item in recent5)
    total_wins = sum(item["won"] for item in history)

    last_date = history[-1]["date"]
    rest_days = max(
        0,
        (target_date.date() - last_date.date()).days
    )

    games_last_7_days = sum(
        1
        for item in history
        if 0 <= (target_date - item["date"]).days <= 7
    )

    values = {
        f"{prefix}_games": len(history),

        f"{prefix}_last5_scored": average(recent_scored),
        f"{prefix}_last5_conceded": average(recent_conceded),

        f"{prefix}_last10_scored": average(recent10_scored),
        f"{prefix}_last10_conceded": average(recent10_conceded),

        f"{prefix}_all_scored": average(scored),
        f"{prefix}_all_conceded": average(conceded),

        f"{prefix}_last5_total": average(
            [
                item["scored"] + item["conceded"]
                for item in recent5
            ]
        ),

        f"{prefix}_all_total": average(totals),

        f"{prefix}_scored_std": safe_std(recent10_scored),
        f"{prefix}_conceded_std": safe_std(recent10_conceded),

        f"{prefix}_win_rate": total_wins / len(history),
        f"{prefix}_last5_win_rate": recent_wins / len(recent5),

        f"{prefix}_home_scored": average(
            [item["scored"] for item in home_games],
            average(scored)
        ),

        f"{prefix}_home_conceded": average(
            [item["conceded"] for item in home_games],
            average(conceded)
        ),

        f"{prefix}_away_scored": average(
            [item["scored"] for item in away_games],
            average(scored)
        ),

        f"{prefix}_away_conceded": average(
            [item["conceded"] for item in away_games],
            average(conceded)
        ),

        f"{prefix}_role_scored": average(
            [item["scored"] for item in role_games],
            average(scored)
        ),

        f"{prefix}_role_conceded": average(
            [item["conceded"] for item in role_games],
            average(conceded)
        ),

        f"{prefix}_role_games": len(role_games),

        f"{prefix}_rest_days": min(rest_days, 14),
        f"{prefix}_games_last7": games_last_7_days,
    }

    return values


def build_features(matches, match):
    target_date = get_match_date(match)

    if target_date is None:
        return None

    home_team = str(match.get("homeTeam", "")).strip()
    away_team = str(match.get("awayTeam", "")).strip()

    if not home_team or not away_team:
        return None

    home_history = collect_team_history(
        matches,
        home_team,
        target_date
    )

    away_history = collect_team_history(
        matches,
        away_team,
        target_date
    )

    if (
        len(home_history) < MIN_TEAM_HISTORY
        or len(away_history) < MIN_TEAM_HISTORY
    ):
        return None

    home_data = team_features(
        home_history,
        target_date,
        "home",
        True
    )

    away_data = team_features(
        away_history,
        target_date,
        "away",
        False
    )

    if home_data is None or away_data is None:
        return None

    features = {}
    features.update(home_data)
    features.update(away_data)

    # Önceki karşılaşmalar.
    home_vs_away = [
        item for item in home_history
        if item["opponent"] == away_team
    ]

    away_vs_home = [
        item for item in away_history
        if item["opponent"] == home_team
    ]

    h2h = home_vs_away + away_vs_home

    h2h.sort(key=lambda item: item["date"])

    recent_h2h = h2h[-5:]

    features["h2h_games"] = len(h2h)

    features["h2h_home_scored"] = average(
        [item["scored"] for item in recent_h2h],
        home_data["home_all_scored"]
    )

    features["h2h_away_scored"] = average(
        [item["conceded"] for item in recent_h2h],
        away_data["away_all_scored"]
    )

    features["h2h_home_win_rate"] = (
        average([1.0 if item["won"] else 0.0 for item in recent_h2h])
        if recent_h2h else 0.5
    )

    # Takvim özellikleri.
    features["month"] = target_date.month
    features["weekday"] = target_date.weekday()

    features["month_sin"] = math.sin(
        2 * math.pi * target_date.month / 12
    )

    features["month_cos"] = math.cos(
        2 * math.pi * target_date.month / 12
    )

    features["weekday_sin"] = math.sin(
        2 * math.pi * target_date.weekday() / 7
    )

    features["weekday_cos"] = math.cos(
        2 * math.pi * target_date.weekday() / 7
    )

    return features


# ============================================================
# MODEL TANIMLARI
# ============================================================

def create_models():
    return {
        "RandomForest": RandomForestRegressor(
            n_estimators=350,
            max_depth=8,
            min_samples_leaf=2,
            max_features=0.85,
            random_state=RANDOM_STATE,
            n_jobs=2
        ),

        "XGBoost": XGBRegressor(
            n_estimators=250,
            max_depth=3,
            learning_rate=0.04,
            subsample=0.85,
            colsample_bytree=0.85,
            objective="reg:squarederror",
            random_state=RANDOM_STATE,
            n_jobs=2,
            verbosity=0
        ),

        "LightGBM": LGBMRegressor(
            n_estimators=250,
            max_depth=-1,
            num_leaves=15,
            learning_rate=0.03,
            min_child_samples=5,
            verbosity=-1,
            random_state=RANDOM_STATE,
            n_jobs=2
        ),

        "CatBoost": CatBoostRegressor(
            iterations=250,
            depth=5,
            learning_rate=0.04,
            loss_function="RMSE",
            random_seed=RANDOM_STATE,
            verbose=False,
            allow_writing_files=False,
            thread_count=2
        ),
    }


# ============================================================
# EĞİTİM VERİSİ
# ============================================================

def build_training_data(matches):
    finished = [
        match for match in matches
        if is_finished(match)
    ]

    finished.sort(key=lambda item: get_match_date(item))

    feature_rows = []
    home_targets = []
    away_targets = []
    training_dates = []

    for match in finished:
        features = build_features(matches, match)

        if features is None:
            continue

        home_score = get_score(match, "homeScore")
        away_score = get_score(match, "awayScore")

        if home_score is None or away_score is None:
            continue

        feature_rows.append(features)
        home_targets.append(home_score)
        away_targets.append(away_score)
        training_dates.append(get_match_date(match))

    return (
        feature_rows,
        home_targets,
        away_targets,
        training_dates
    )


# ============================================================
# MODEL EĞİTİMİ VE DOĞRULAMA
# ============================================================

def train_models(X, y_home, y_away):
    row_count = len(X)

    split_index = int(row_count * 0.80)

    validation_available = (
        split_index >= 25
        and row_count - split_index >= 5
    )

    validation = {}

    if validation_available:
        X_train = X[:split_index]
        X_valid = X[split_index:]

        y_home_train = y_home[:split_index]
        y_home_valid = y_home[split_index:]

        y_away_train = y_away[:split_index]
        y_away_valid = y_away[split_index:]

        for model_name, model_factory in create_models().items():
            home_model = model_factory
            away_model = create_models()[model_name]

            home_model.fit(X_train, y_home_train)
            away_model.fit(X_train, y_away_train)

            home_pred = home_model.predict(X_valid)
            away_pred = away_model.predict(X_valid)

            validation[model_name] = {
                "homeMAE": round(
                    float(mean_absolute_error(y_home_valid, home_pred)),
                    3
                ),
                "awayMAE": round(
                    float(mean_absolute_error(y_away_valid, away_pred)),
                    3
                ),
                "totalMAE": round(
                    float(
                        mean_absolute_error(
                            np.array(y_home_valid) + np.array(y_away_valid),
                            np.array(home_pred) + np.array(away_pred)
                        )
                    ),
                    3
                ),
                "validationMatches": len(X_valid),
            }

    # Son tahminler için tüm geçmiş veriyle yeniden eğitim.
    trained_models = {}

    for model_name, model_factory in create_models().items():
        home_model = model_factory
        away_model = create_models()[model_name]

        home_model.fit(X, y_home)
        away_model.fit(X, y_away)

        trained_models[model_name] = {
            "home": home_model,
            "away": away_model,
        }

    return trained_models, validation


# ============================================================
# TAHMİN
# ============================================================

def clamp_score(value):
    return round(
        max(60.0, min(180.0, float(value))),
        1
    )


def make_model_prediction(models, features):
    feature_vector = np.array(
        [[features[key] for key in features]],
        dtype=float
    )

    model_results = {}

    home_values = []
    away_values = []

    for model_name, model_pair in models.items():
        home_score = clamp_score(
            model_pair["home"].predict(feature_vector)[0]
        )

        away_score = clamp_score(
            model_pair["away"].predict(feature_vector)[0]
        )

        total_score = round(home_score + away_score, 1)

        if home_score > away_score:
            winner = "HOME"
        elif away_score > home_score:
            winner = "AWAY"
        else:
            winner = "TIE"

        model_results[model_name] = {
            "homeScore": home_score,
            "awayScore": away_score,
            "totalScore": total_score,
            "winner": winner,
        }

        home_values.append(home_score)
        away_values.append(away_score)

    ensemble_home = clamp_score(average(home_values))
    ensemble_away = clamp_score(average(away_values))

    ensemble_total = round(
        ensemble_home + ensemble_away,
        1
    )

    if ensemble_home > ensemble_away:
        ensemble_winner = "HOME"
    elif ensemble_away > ensemble_home:
        ensemble_winner = "AWAY"
    else:
        ensemble_winner = "TIE"

    return {
        "models": model_results,

        "ensemble": {
            "homeScore": ensemble_home,
            "awayScore": ensemble_away,
            "totalScore": ensemble_total,
            "winner": ensemble_winner,
        },
    }


# ============================================================
# ANA İŞLEM
# ============================================================

def main():
    input_file = find_input_file()
    data = load_json(input_file)

    all_matches = data.get("matches", [])

    nba_matches = [
        match for match in all_matches
        if is_nba(match)
    ]

    finished_matches = [
        match for match in nba_matches
        if is_finished(match)
    ]

    upcoming_matches = [
        match for match in nba_matches
        if is_upcoming(match)
    ]

    print("=" * 60)
    print("NBA MACHINE LEARNING")
    print("=" * 60)

    print("Toplam NBA maci:", len(nba_matches))
    print("Tamamlanan NBA maci:", len(finished_matches))
    print("Oynanmamis NBA maci:", len(upcoming_matches))

    (
        feature_rows,
        home_targets,
        away_targets,
        training_dates
    ) = build_training_data(nba_matches)

    print("Egitim ornegi:", len(feature_rows))

    output = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(input_file.name),
        "league": "NBA",
        "models": MODEL_NAMES,
        "training": {
            "completedMatches": len(finished_matches),
            "trainingSamples": len(feature_rows),
            "minimumTeamHistory": MIN_TEAM_HISTORY,
            "validation": {},
        },
        "predictions": [],
    }

    if len(feature_rows) < MIN_TRAINING_ROWS:
        output["training"]["status"] = "insufficient_data"
        output["training"]["message"] = (
            f"Model egitimi icin en az {MIN_TRAINING_ROWS} "
            "gecerli egitim ornegi gerekiyor."
        )

        save_json(output)

        print("YETERSIZ EGITIM VERISI")
        print("Gerekli:", MIN_TRAINING_ROWS)
        print("Mevcut:", len(feature_rows))
        print("Dosya kaydedildi:", OUTPUT_FILE)

        return

    feature_names = list(feature_rows[0].keys())

    X = np.array(
        [
            [row[name] for name in feature_names]
            for row in feature_rows
        ],
        dtype=float
    )

    y_home = np.array(home_targets, dtype=float)
    y_away = np.array(away_targets, dtype=float)

    trained_models, validation = train_models(
        X,
        y_home,
        y_away
    )

    output["training"]["status"] = "trained"
    output["training"]["featureCount"] = len(feature_names)
    output["training"]["validation"] = validation

    print()
    print("MODEL DOGRULAMA")

    for name, metrics in validation.items():
        print(
            f"{name}: "
            f"Ev MAE={metrics['homeMAE']} | "
            f"Dep MAE={metrics['awayMAE']} | "
            f"Toplam MAE={metrics['totalMAE']}"
        )

    print()
    print("NBA TAHMINLERI")

    upcoming_matches.sort(
        key=lambda item: get_match_date(item)
    )

    for match in upcoming_matches:
        features = build_features(nba_matches, match)

        if features is None:
            print(
                "Atlandi - yeterli gecmis yok:",
                match.get("homeTeam"),
                "-",
                match.get("awayTeam")
            )
            continue

        # Eğitimde kullanılan özellik sırasını koru.
        features = {
            name: features.get(name, 0.0)
            for name in feature_names
        }

        prediction = make_model_prediction(
            trained_models,
            features
        )

        result = {
            "matchId": match.get("id"),
            "date": match.get("date"),
            "utcDate": match.get("utcDate"),
            "league": "NBA",
            "homeTeam": match.get("homeTeam"),
            "awayTeam": match.get("awayTeam"),
            "modelCount": len(MODEL_NAMES),
            "prediction": prediction,
        }

        output["predictions"].append(result)

        ensemble = prediction["ensemble"]

        print(
            f"{result['homeTeam']} - {result['awayTeam']} | "
            f"{ensemble['homeScore']}-"
            f"{ensemble['awayScore']} | "
            f"Toplam: {ensemble['totalScore']} | "
            f"Kazanan: {ensemble['winner']}"
        )

    output["summary"] = {
        "upcomingMatches": len(upcoming_matches),
        "predictedMatches": len(output["predictions"]),
        "modelCount": len(MODEL_NAMES),
    }

    save_json(output)

    print()
    print("=" * 60)
    print("ML TAHMINLERI TAMAMLANDI")
    print("Egitim ornegi:", len(feature_rows))
    print("Tahmin sayisi:", len(output["predictions"]))
    print("Cikti:", OUTPUT_FILE)
    print("=" * 60)


if __name__ == "__main__":
    main()
