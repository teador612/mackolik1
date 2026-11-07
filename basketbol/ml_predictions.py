
import json
import math
import statistics
import re
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
    BASE_DIR / "data" / "basketball.json",
    BASE_DIR / "basketball.json",
]

OUTPUT_FILE = BASE_DIR / "ml-predictions.json"

LEAGUE_NAME = "NBA"

MIN_TEAM_HISTORY = 3
MIN_TRAINING_ROWS = 40

RANDOM_STATE = 42

TOTAL_LINE_HISTORY = 50
MIN_LINE_HISTORY = 10

MODEL_NAMES = [
    "RandomForest",
    "XGBoost",
    "LightGBM",
    "CatBoost",
]


# ============================================================
# DOSYA İŞLEMLERİ
# ============================================================

def load_json(path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(data):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    temp_file = OUTPUT_FILE.with_suffix(".tmp")

    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)

    temp_file.replace(OUTPUT_FILE)


def find_input_file():
    for path in INPUT_CANDIDATES:
        if path.is_file():
            return path

    raise FileNotFoundError("basketball.json bulunamadı.")


# ============================================================
# MAÇ KİMLİĞİ VE TEKİLLEŞTİRME
# ============================================================

def normalize_match_id(value):
    if value is None:
        return ""

    value = str(value).strip().lower()

    # nba-401871334 ve 401871334 aynı kimliktir.
    value = re.sub(r"^(nba[-_:]?)", "", value)

    return value


def normalize_team(value):
    return " ".join(
        str(value or "").strip().lower().split()
    )


def match_identity(match):
    match_id = normalize_match_id(match.get("id"))

    if match_id:
        return "id:" + match_id

    date = get_match_date(match)

    home = normalize_team(match.get("homeTeam"))
    away = normalize_team(match.get("awayTeam"))

    if date and home and away:
        return (
            "match:"
            + date.isoformat()
            + "|"
            + home
            + "|"
            + away
        )

    return None


def match_quality(match):
    quality = 0

    if is_finished(match):
        quality += 100

    if get_score(match, "homeScore") is not None:
        quality += 10

    if get_score(match, "awayScore") is not None:
        quality += 10

    if match.get("homeTeam"):
        quality += 5

    if match.get("awayTeam"):
        quality += 5

    if match.get("utcDate"):
        quality += 2

    if match.get("date"):
        quality += 1

    return quality


def deduplicate_matches(matches):
    """
    Aynı maçın farklı ID biçimleriyle gelen kayıtlarını
    tek kayda indirger.

    Tamamlanmış ve daha dolu kayıt tercih edilir.
    """

    unique = {}

    for match in matches:
        if not isinstance(match, dict):
            continue

        key = match_identity(match)

        if key is None:
            unique[
                "unknown:" + str(len(unique))
            ] = match
            continue

        existing = unique.get(key)

        if existing is None:
            unique[key] = match
            continue

        if match_quality(match) > match_quality(existing):
            unique[key] = match

    return list(unique.values())


# ============================================================
# TARİH İŞLEMLERİ
# ============================================================

def parse_date(value):
    if not value:
        return None

    try:
        value = str(value).strip()

        if value.endswith("Z"):
            value = value[:-1] + "+00:00"

        result = datetime.fromisoformat(value)

        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)

        return result.astimezone(timezone.utc)

    except (ValueError, TypeError, OverflowError):
        return None


def get_match_date(match):
    return (
        parse_date(match.get("utcDate"))
        or parse_date(match.get("date"))
    )


def current_utc():
    return datetime.now(timezone.utc)


# ============================================================
# MAÇ KONTROLLERİ
# ============================================================

def is_nba(match):
    league = str(match.get("league", "NBA")).strip().upper()

    return league == LEAGUE_NAME


def get_score(match, key):
    value = match.get(key)

    try:
        if value is None or value == "":
            return None

        score = float(value)

        if not math.isfinite(score) or score < 0:
            return None

        return score

    except (ValueError, TypeError):
        return None


def played_value(match):
    value = match.get("played")

    if value is True:
        return True

    if value is False or value is None:
        return False

    return str(value).strip().lower() in (
        "true", "1", "yes", "evet"
    )


def get_status(match):
    return str(match.get("status", "")).strip().upper()


def is_finished(match):
    if not is_nba(match):
        return False

    status = get_status(match)

    unfinished_words = (
        "SCHEDULED",
        "IN_PROGRESS",
        "IN PROGRESS",
        "POSTPONED",
        "CANCELED",
        "CANCELLED",
        "NOT_STARTED",
        "NOT STARTED",
        "PRE_GAME",
        "PREGAME",
        "LIVE",
        "HALFTIME",
    )

    if any(word in status for word in unfinished_words):
        return False

    if not played_value(match):
        return False

    home_score = get_score(match, "homeScore")
    away_score = get_score(match, "awayScore")

    if home_score is None or away_score is None:
        return False

    if home_score == 0 and away_score == 0:
        if status not in (
            "FINAL",
            "STATUS_FINAL",
            "COMPLETED",
            "FINISHED",
        ):
            return False

    return True


def is_upcoming(match):
    if not is_nba(match):
        return False

    if played_value(match):
        return False

    match_date = get_match_date(match)

    if match_date is None:
        return False

    if match_date.date() < current_utc().date():
        return False

    status = get_status(match)

    completed_words = (
        "FINAL",
        "COMPLETED",
        "FINISHED",
        "POSTPONED",
        "CANCELED",
        "CANCELLED",
        "IN_PROGRESS",
        "IN PROGRESS",
        "LIVE",
        "HALFTIME",
    )

    if any(word in status for word in completed_words):
        return False

    scheduled_words = (
        "SCHEDULED",
        "NOT_STARTED",
        "NOT STARTED",
        "PRE_GAME",
        "PREGAME",
        "STATUS_SCHEDULED",
    )

    if any(word in status for word in scheduled_words):
        return True

    return (
        get_score(match, "homeScore") is None
        and get_score(match, "awayScore") is None
    )


# ============================================================
# MAKİNENİN ALT / ÜST BAREMİ
# ============================================================

def get_historical_total_line(matches, target_date):
    historical_totals = []

    for match in matches:
        if not is_finished(match):
            continue

        match_date = get_match_date(match)

        if match_date is None or match_date >= target_date:
            continue

        home_score = get_score(match, "homeScore")
        away_score = get_score(match, "awayScore")

        if home_score is None or away_score is None:
            continue

        historical_totals.append({
            "date": match_date,
            "total": home_score + away_score,
        })

    historical_totals.sort(key=lambda item: item["date"])

    recent = historical_totals[-TOTAL_LINE_HISTORY:]

    if len(recent) < MIN_LINE_HISTORY:
        return None

    average_total = statistics.mean(
        item["total"] for item in recent
    )

    line = round(average_total * 2) / 2

    return {
        "line": round(line, 1),
        "historyCount": len(recent),
        "historyAverage": round(average_total, 2),
        "method": "previous_nba_matches_average",
    }


def get_total_direction(predicted_total, total_line):
    if predicted_total is None or total_line is None:
        return None

    if predicted_total > total_line:
        return "OVER"

    if predicted_total < total_line:
        return "UNDER"

    return "PUSH"


def evaluate_total_direction(predicted_direction, actual_total, total_line):
    if actual_total is None or total_line is None:
        return None

    if math.isclose(actual_total, total_line, abs_tol=0.000001):
        return "push"

    if predicted_direction == "OVER":
        return "success" if actual_total > total_line else "failed"

    if predicted_direction == "UNDER":
        return "success" if actual_total < total_line else "failed"

    return "push"


# ============================================================
# MAÇ SONUCU
# ============================================================

def get_winner(home_score, away_score):
    if home_score > away_score:
        return "HOME"

    if away_score > home_score:
        return "AWAY"

    return "TIE"


def evaluate_winner(predicted_winner, actual_winner):
    if not predicted_winner or not actual_winner:
        return None

    return (
        "success"
        if predicted_winner == actual_winner
        else "failed"
    )


# ============================================================
# TAKIM GEÇMİŞİ
# ============================================================

def collect_team_history(matches, team_name, target_date):
    history = []

    target_team = normalize_team(team_name)

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

        if normalize_team(home) == target_team:
            history.append({
                "date": match_date,
                "scored": home_score,
                "conceded": away_score,
                "is_home": True,
                "opponent": away,
                "won": home_score > away_score,
            })

        elif normalize_team(away) == target_team:
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
# TAKIM ÖZELLİKLERİ
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
        item for item in history if item["is_home"]
    ]

    away_games = [
        item for item in history if not item["is_home"]
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

    return {
        f"{prefix}_games": len(history),

        f"{prefix}_last5_scored": average(recent_scored),
        f"{prefix}_last5_conceded": average(recent_conceded),

        f"{prefix}_last10_scored": average(recent10_scored),
        f"{prefix}_last10_conceded": average(recent10_conceded),

        f"{prefix}_all_scored": average(scored),
        f"{prefix}_all_conceded": average(conceded),

        f"{prefix}_last5_total": average([
            item["scored"] + item["conceded"]
            for item in recent5
        ]),

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


# ============================================================
# ÖZELLİK ÜRETİMİ
# ============================================================

def build_features(matches, match):
    target_date = get_match_date(match)

    if target_date is None:
        return None

    home_team = str(match.get("homeTeam", "")).strip()
    away_team = str(match.get("awayTeam", "")).strip()

    if not home_team or not away_team:
        return None

    home_history = collect_team_history(
        matches, home_team, target_date
    )

    away_history = collect_team_history(
        matches, away_team, target_date
    )

    if (
        len(home_history) < MIN_TEAM_HISTORY
        or len(away_history) < MIN_TEAM_HISTORY
    ):
        return None

    home_data = team_features(
        home_history, target_date, "home", True
    )

    away_data = team_features(
        away_history, target_date, "away", False
    )

    if home_data is None or away_data is None:
        return None

    features = {}

    features.update(home_data)
    features.update(away_data)

    home_vs_away = [
        item for item in home_history
        if normalize_team(item["opponent"]) == normalize_team(away_team)
    ]

    away_vs_home = [
        item for item in away_history
        if normalize_team(item["opponent"]) == normalize_team(home_team)
    ]

    h2h = home_vs_away + away_vs_home

    unique_h2h = {}

    for item in h2h:
        key = item["date"]
        unique_h2h[key] = item

    h2h = sorted(
        unique_h2h.values(),
        key=lambda item: item["date"]
    )

    recent_h2h = h2h[-5:]

    features["h2h_games"] = len(h2h)

    features["h2h_home_scored"] = average(
        [item["scored"] for item in recent_h2h],
        home_data["home_all_scored"]
    )

    features["h2h_away_scored"] = average(
        [item["scored"] for item in recent_h2h],
        away_data["away_all_scored"]
    )

    features["h2h_home_win_rate"] = (
        average([
            1.0 if item["won"] else 0.0
            for item in recent_h2h
        ])
        if recent_h2h else 0.5
    )

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
# MODELLER - MEVCUT PARAMETRELER KORUNDU
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
# GEÇMİŞ EĞİTİM VERİSİ
# ============================================================

def build_training_data(matches):
    finished = [
        match for match in matches
        if is_finished(match)
        and get_match_date(match) is not None
    ]

    finished.sort(key=lambda item: get_match_date(item))

    feature_rows = []
    home_targets = []
    away_targets = []
    sample_dates = []

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
        sample_dates.append(get_match_date(match))

    return feature_rows, home_targets, away_targets, sample_dates


# ============================================================
# MODEL EĞİTİMİ
# ============================================================

def fit_models(X, y_home, y_away):
    trained_models = {}

    definitions = create_models()

    for model_name in MODEL_NAMES:
        home_model = definitions[model_name]
        away_model = create_models()[model_name]

        home_model.fit(X, y_home)
        away_model.fit(X, y_away)

        trained_models[model_name] = {
            "home": home_model,
            "away": away_model,
        }

    return trained_models


def build_validation(X, y_home, y_away):
    row_count = len(X)
    split_index = int(row_count * 0.80)

    validation = {}

    if split_index < 25 or row_count - split_index < 5:
        return validation

    X_train = X[:split_index]
    X_valid = X[split_index:]

    y_home_train = y_home[:split_index]
    y_home_valid = y_home[split_index:]

    y_away_train = y_away[:split_index]
    y_away_valid = y_away[split_index:]

    for model_name in MODEL_NAMES:
        home_model = create_models()[model_name]
        away_model = create_models()[model_name]

        home_model.fit(X_train, y_home_train)
        away_model.fit(X_train, y_away_train)

        home_pred = home_model.predict(X_valid)
        away_pred = away_model.predict(X_valid)

        validation[model_name] = {
            "homeMAE": round(
                float(mean_absolute_error(y_home_valid, home_pred)), 3
            ),
            "awayMAE": round(
                float(mean_absolute_error(y_away_valid, away_pred)), 3
            ),
            "totalMAE": round(
                float(mean_absolute_error(
                    y_home_valid + y_away_valid,
                    home_pred + away_pred
                )), 3
            ),
            "validationMatches": len(X_valid),
        }

    return validation


# ============================================================
# TAHMİN
# ============================================================

def clamp_score(value):
    return round(max(60.0, min(180.0, float(value))), 1)


def make_model_prediction(models, features, feature_names, total_line):
    feature_vector = np.array(
        [[features[name] for name in feature_names]],
        dtype=float
    )

    model_output = {}
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

        winner = get_winner(home_score, away_score)

        direction = get_total_direction(total_score, total_line)

        model_output[model_name] = {
            "homeScore": home_score,
            "awayScore": away_score,
            "totalScore": total_score,
            "totalLine": total_line,
            "totalDirection": direction,
            "winner": winner,
        }

        home_values.append(home_score)
        away_values.append(away_score)

    ensemble_home = clamp_score(average(home_values))
    ensemble_away = clamp_score(average(away_values))

    ensemble_total = round(ensemble_home + ensemble_away, 1)

    ensemble = {
        "homeScore": ensemble_home,
        "awayScore": ensemble_away,
        "totalScore": ensemble_total,
        "totalLine": total_line,
        "totalDirection": get_total_direction(
            ensemble_total, total_line
        ),
        "winner": get_winner(ensemble_home, ensemble_away),
    }

    return {
        "models": model_output,
        "ensemble": ensemble,
    }


# ============================================================
# HEDEF MAÇLAR
# ============================================================

def build_target_matches(matches):
    targets = []
    seen = set()

    for match in matches:
        if not is_nba(match):
            continue

        if not (is_finished(match) or is_upcoming(match)):
            continue

        match_date = get_match_date(match)

        if match_date is None:
            continue

        key = match_identity(match)

        if key in seen:
            continue

        seen.add(key)
        targets.append(match)

    targets.sort(key=lambda item: get_match_date(item))

    return targets


# ============================================================
# WALK-FORWARD TAHMİN
# ============================================================

def generate_predictions(
    nba_matches,
    targets,
    feature_rows,
    home_targets,
    away_targets,
    sample_dates,
    feature_names
):
    predictions = []

    stats = {
        "historicalCandidates": sum(
            1 for match in targets if is_finished(match)
        ),
        "historicalPredicted": 0,
        "upcomingCandidates": sum(
            1 for match in targets if is_upcoming(match)
        ),
        "upcomingPredicted": 0,
        "skippedInsufficientHistory": 0,
        "skippedInsufficientTraining": 0,
        "skippedInsufficientLineHistory": 0,
    }

    if not feature_rows:
        return predictions, stats

    X_all = np.array([
        [row[name] for name in feature_names]
        for row in feature_rows
    ], dtype=float)

    y_home_all = np.array(home_targets, dtype=float)
    y_away_all = np.array(away_targets, dtype=float)

    model_cache = {}

    for match in targets:
        target_date = get_match_date(match)

        if target_date is None:
            continue

        features = build_features(nba_matches, match)

        if features is None:
            stats["skippedInsufficientHistory"] += 1
            continue

        train_indices = [
            index
            for index, sample_date in enumerate(sample_dates)
            if sample_date < target_date
        ]

        if len(train_indices) < MIN_TRAINING_ROWS:
            stats["skippedInsufficientTraining"] += 1
            continue

        line_data = get_historical_total_line(
            nba_matches, target_date
        )

        if line_data is None:
            stats["skippedInsufficientLineHistory"] += 1
            continue

        cache_key = target_date.isoformat()

        if cache_key not in model_cache:
            model_cache[cache_key] = fit_models(
                X_all[train_indices],
                y_home_all[train_indices],
                y_away_all[train_indices]
            )

        features = {
            name: features.get(name, 0.0)
            for name in feature_names
        }

        prediction = make_model_prediction(
            model_cache[cache_key],
            features,
            feature_names,
            line_data["line"]
        )

        historical = is_finished(match)

        actual_home = (
            get_score(match, "homeScore") if historical else None
        )

        actual_away = (
            get_score(match, "awayScore") if historical else None
        )

        actual_total = (
            round(actual_home + actual_away, 1)
            if actual_home is not None and actual_away is not None
            else None
        )

        actual_winner = (
            get_winner(actual_home, actual_away)
            if actual_home is not None and actual_away is not None
            else None
        )

        if historical:
            for model_result in prediction["models"].values():
                model_result["totalResult"] = evaluate_total_direction(
                    model_result["totalDirection"],
                    actual_total,
                    model_result["totalLine"]
                )

                model_result["winnerResult"] = evaluate_winner(
                    model_result["winner"],
                    actual_winner
                )

            ensemble = prediction["ensemble"]

            ensemble["totalResult"] = evaluate_total_direction(
                ensemble["totalDirection"],
                actual_total,
                ensemble["totalLine"]
            )

            ensemble["winnerResult"] = evaluate_winner(
                ensemble["winner"],
                actual_winner
            )

        result = {
            "matchId": normalize_match_id(match.get("id")) or None,
            "sourceMatchId": match.get("id"),

            "date": match.get("date"),
            "utcDate": match.get("utcDate"),

            "league": LEAGUE_NAME,

            "homeTeam": match.get("homeTeam"),
            "awayTeam": match.get("awayTeam"),

            "predictionType": (
                "historical_backtest" if historical else "upcoming"
            ),

            "trainingSamplesBeforeMatch": len(train_indices),
            "trainingCutoff": target_date.isoformat(),

            "modelCount": len(MODEL_NAMES),

            "totalLine": line_data["line"],

            "totalLineInfo": {
                "method": line_data["method"],
                "historyCount": line_data["historyCount"],
                "historyAverage": line_data["historyAverage"],
            },

            "actualHomeScore": actual_home,
            "actualAwayScore": actual_away,
            "actualTotal": actual_total,
            "actualWinner": actual_winner,

            "prediction": prediction,
        }

        predictions.append(result)

        if historical:
            stats["historicalPredicted"] += 1
        else:
            stats["upcomingPredicted"] += 1

        ensemble = prediction["ensemble"]

        print(
            f"[{'GEÇMİŞ' if historical else 'GELECEK'}] "
            f"{result['homeTeam']} - {result['awayTeam']} | "
            f"Tahmin: {ensemble['homeScore']}-"
            f"{ensemble['awayScore']} | "
            f"Barem: {line_data['line']} | "
            f"{ensemble['totalDirection']} | "
            f"{ensemble['winner']} | "
            f"Eğitim: {len(train_indices)} maç"
        )

    return predictions, stats


# ============================================================
# ANA İŞLEM
# ============================================================

def main():
    print("=" * 65)
    print("NBA MACHINE LEARNING - WALK FORWARD")
    print("ALT / ÜST + MS1 / MS2 TAHMİN SİSTEMİ")
    print("=" * 65)

    input_file = find_input_file()
    data = load_json(input_file)

    all_matches = data.get("matches", [])

    if not isinstance(all_matches, list):
        raise ValueError(
            "basketball.json içindeki matches alanı geçersiz."
        )

    original_count = len(all_matches)

    all_matches = deduplicate_matches(all_matches)

    removed_duplicates = original_count - len(all_matches)

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

    targets = build_target_matches(nba_matches)

    print("Veri dosyası:", input_file)
    print("İlk kayıt:", original_count)
    print("Tekilleştirme sonrası:", len(all_matches))
    print("Temizlenen tekrar:", removed_duplicates)
    print("NBA maçları:", len(nba_matches))
    print("Tamamlanan NBA maçları:", len(finished_matches))
    print("Yaklaşan NBA maçları:", len(upcoming_matches))

    print("\nGeçmiş eğitim verisi hazırlanıyor...")

    (
        feature_rows,
        home_targets,
        away_targets,
        sample_dates
    ) = build_training_data(nba_matches)

    print("Eğitim örneği:", len(feature_rows))

    output = {
        "updatedAt": current_utc().isoformat(),
        "source": input_file.name,
        "league": LEAGUE_NAME,
        "predictionMethod": "walk_forward",
        "historicalPredictionsEnabled": True,
        "models": MODEL_NAMES,

        "deduplication": {
            "originalRecords": original_count,
            "uniqueRecords": len(all_matches),
            "removedDuplicates": removed_duplicates,
            "method": "normalized_match_id",
        },

        "totalLineMethod": {
            "name": "previous_nba_matches_average",
            "historyMatches": TOTAL_LINE_HISTORY,
            "minimumHistory": MIN_LINE_HISTORY,
            "rounding": 0.5,
            "description": (
                "Hedef maçtan önce tamamlanmış son NBA maçlarının "
                "toplam sayı ortalaması 0.5 bareme yuvarlanır."
            ),
        },

        "training": {
            "completedMatches": len(finished_matches),
            "trainingSamples": len(feature_rows),
            "minimumTeamHistory": MIN_TEAM_HISTORY,
            "minimumTrainingRows": MIN_TRAINING_ROWS,
            "featureCount": 0,
            "validation": {},
        },

        "diagnostics": {
            "totalRecords": original_count,
            "uniqueRecords": len(all_matches),
            "removedDuplicates": removed_duplicates,
            "nbaMatches": len(nba_matches),
            "finishedMatches": len(finished_matches),
            "upcomingMatches": len(upcoming_matches),
            "historicalCandidates": 0,
            "historicalPredicted": 0,
            "upcomingPredicted": 0,
            "skippedInsufficientHistory": 0,
            "skippedInsufficientTraining": 0,
            "skippedInsufficientLineHistory": 0,
            "todayUTC": current_utc().date().isoformat(),
        },

        "predictions": [],
    }

    if len(feature_rows) < MIN_TRAINING_ROWS:
        output["training"]["status"] = "insufficient_data"
        output["training"]["message"] = (
            f"En az {MIN_TRAINING_ROWS} eğitim örneği gerekiyor."
        )

        output["summary"] = {
            "historicalMatches": len(finished_matches),
            "historicalPredictedMatches": 0,
            "upcomingMatches": len(upcoming_matches),
            "predictedUpcomingMatches": 0,
            "predictedMatches": 0,
        }

        save_json(output)

        print("\nYeterli eğitim verisi bulunamadı.")
        print("Çıktı:", OUTPUT_FILE)
        return

    feature_names = list(feature_rows[0].keys())

    output["training"]["status"] = "trained"
    output["training"]["featureCount"] = len(feature_names)

    print("\nGenel model doğrulaması hazırlanıyor...")

    X_all = np.array([
        [row[name] for name in feature_names]
        for row in feature_rows
    ], dtype=float)

    y_home_all = np.array(home_targets, dtype=float)
    y_away_all = np.array(away_targets, dtype=float)

    validation = build_validation(
        X_all,
        y_home_all,
        y_away_all
    )

    output["training"]["validation"] = validation

    for name, metrics in validation.items():
        print(
            f"{name}: "
            f"Ev MAE={metrics['homeMAE']} | "
            f"Dep MAE={metrics['awayMAE']} | "
            f"Toplam MAE={metrics['totalMAE']}"
        )

    print("\nWalk-forward tahminleri başlıyor...")

    predictions, stats = generate_predictions(
        nba_matches,
        targets,
        feature_rows,
        home_targets,
        away_targets,
        sample_dates,
        feature_names
    )

    output["predictions"] = predictions
    output["diagnostics"].update(stats)

    output["summary"] = {
        "historicalMatches": stats["historicalCandidates"],
        "historicalPredictedMatches": stats["historicalPredicted"],
        "upcomingMatches": stats["upcomingCandidates"],
        "predictedUpcomingMatches": stats["upcomingPredicted"],
        "predictedMatches": len(predictions),
        "modelCount": len(MODEL_NAMES),
    }

    save_json(output)

    print("\n" + "=" * 65)
    print("NBA ML TAHMİN RAPORU")
    print("=" * 65)

    print("Geçmiş maç adayı:", stats["historicalCandidates"])
    print("Tahmini üretilen geçmiş maç:", stats["historicalPredicted"])
    print("Gelecek maç adayı:", stats["upcomingCandidates"])
    print("Tahmini üretilen gelecek maç:", stats["upcomingPredicted"])
    print("Temizlenen mükerrer kayıt:", removed_duplicates)
    print("Yetersiz takım geçmişi:", stats["skippedInsufficientHistory"])
    print("Yetersiz eğitim verisi:", stats["skippedInsufficientTraining"])
    print("Yetersiz barem geçmişi:", stats["skippedInsufficientLineHistory"])
    print("Toplam ML tahmini:", len(predictions))

    print("Çıktı:", OUTPUT_FILE)
    print("=" * 65)


if __name__ == "__main__":
    main()
