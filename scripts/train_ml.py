#!/usr/bin/env python3
# Mackolik ML: ücretsiz, yerel verilerle eğitim ve tahmin üretimi.
# DNA/RNA dosyalarına dokunmaz. Girdi: data/v2-data.json + data/matches.json
import json, math, os, re, sys
from pathlib import Path
from datetime import datetime
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
V2_PATH = ROOT / "data" / "v2-data.json"
LIVE_PATH = ROOT / "data" / "matches.json"
OUT_PATH = ROOT / "outputs" / "ml-predictions.json"
MIN_TRAIN = 80
RANDOM_STATE = 42

try:
    from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier, VotingClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline
    from sklearn.metrics import accuracy_score, log_loss, brier_score_loss
except ImportError:
    print("scikit-learn/numpy kurulu değil. requirements dosyasını yükleyin.", file=sys.stderr)
    raise

# Fields are deliberately alias-tolerant because the project has multiple data generations.
ODDS_ALIASES = {
    "ms1": ["ms1","MS1","1","home","homeWin","odds1"],
    "msx": ["msX","msx","MSX","X","draw","oddsX"],
    "ms2": ["ms2","MS2","2","away","awayWin","odds2"],
    "kgvar": ["kgVar","kgvar","KGVar","KG","kg","bttsYes"],
    "kgyok": ["kgYok","kgyok","KGYok","KGY","bttsNo"],
    "over15": ["au15Ust","au15U","ms15U","over15","1.5Ust","15Ust"],
    "under15": ["au15Alt","ms15A","under15","1.5Alt","15Alt"],
    "over25": ["au25Ust","au25U","ms25U","over25","2.5Ust","25Ust"],
    "under25": ["au25Alt","au25A","ms25A","under25","2.5Alt","25Alt"],
    "over35": ["au35Ust","ms35U","over35","3.5Ust"],
    "under35": ["au35Alt","ms35A","under35","3.5Alt"],
    "ht1": ["iy1","IY1","iy1Odds"],
    "htx": ["iyX","iyx","IYX","iy0","IY0"],
    "ht2": ["iy2","IY2"],
    "ht_over05": ["iy05Ust","iy05U","iy05Over","iy05"],
    "ht_over15": ["iy15Ust","iy15U","iy1_5U","IY15U"],
    "ht_under15": ["iy15Alt","iy15A","iy1_5Alt","IY15A"],
}
FEATURES = list(ODDS_ALIASES.keys())

def load_json(path):
    if not path.exists():
        print(f"UYARI: dosya bulunamadı: {path.relative_to(ROOT)}")
        return []
    with path.open("r", encoding="utf-8-sig") as f:
        obj = json.load(f)
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        for key in ("matches", "data", "items", "results"):
            if isinstance(obj.get(key), list):
                return obj[key]
    raise ValueError(f"{path} içinde maç listesi bulunamadı (array veya matches array bekleniyor).")

def num(value):
    if value is None: return None
    if isinstance(value, (int, float)):
        x = float(value)
    else:
        s = str(value).strip().replace(",", ".")
        if not s or s in ("-", "—", "null", "None", "0.00"): return None
        m = re.search(r"\d+(?:\.\d+)?", s)
        if not m: return None
        x = float(m.group(0))
    return x if math.isfinite(x) and 1.01 <= x <= 100 else None

def get_nested(obj, keys):
    # Odds may be top-level fields or nested inside openingOdds/odds/markets.
    for container in (obj, obj.get("openingOdds"), obj.get("odds"), obj.get("markets"), obj.get("opening_odds")):
        if isinstance(container, dict):
            for key in keys:
                if key in container:
                    v = num(container.get(key))
                    if v is not None: return v
    return None

def get_date(m):
    for k in ("date","matchDate","match_date","tarih","datetime","kickoff"):
        if m.get(k): return str(m[k])
    return ""

def parse_score(value):
    if isinstance(value, dict):
        h = value.get("home", value.get("h", value.get("homeScore")))
        a = value.get("away", value.get("a", value.get("awayScore")))
        try: return int(h), int(a)
        except (ValueError, TypeError): return None
    if value is None: return None
    s = str(value).strip()
    # Accept "2-1", "2:1", "2 - 1", but not dates or half labels.
    match = re.fullmatch(r"\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*", s)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None

def full_score(m):
    for k in ("score","fullTimeScore","full_time_score","ft","resultScore","skor","sonuc"):
        if k in m:
            parsed = parse_score(m[k])
            if parsed is not None: return parsed
    return None

def half_score(m):
    for k in ("halfTimeScore","half_time_score","ht","iySkor","halfScore","devreSkoru"):
        if k in m:
            parsed = parse_score(m[k])
            if parsed is not None: return parsed
    return None

def feature_row(m):
    row = []
    found = 0
    for name, aliases in ODDS_ALIASES.items():
        value = get_nested(m, aliases)
        row.append(value if value is not None else np.nan)
        if value is not None: found += 1
    # Include simple market-implied probabilities from 1X2, normalized to remove overround.
    a, x, b = row[0], row[1], row[2]
    if a and x and b:
        inv = [1/a, 1/x, 1/b]
        total = sum(inv)
        row.extend([v/total for v in inv])
    else:
        row.extend([np.nan, np.nan, np.nan])
    return row, found

FEATURE_NAMES = FEATURES + ["p_ms1_market","p_msx_market","p_ms2_market"]

def targets(m):
    ft = full_score(m)
    if ft is None: return None
    h, a = ft
    result = 0 if h > a else (1 if h == a else 2)
    kg = int(h > 0 and a > 0)
    over25 = int(h + a >= 3)
    ht = half_score(m)
    ht_over15 = None if ht is None else int(ht[0] + ht[1] >= 2)
    return {"MS": result, "KG": kg, "U25": over25, "IY15U": ht_over15}

def team_name(m, side):
    aliases = ("home","homeTeam","home_team","ev","evSahibi","team1") if side == "home" else ("away","awayTeam","away_team","dep","deplasman","team2")
    for k in aliases:
        if m.get(k): return str(m[k]).strip()
    return ""

def valid_train_row(m):
    x, count = feature_row(m)
    y = targets(m)
    return y is not None and count >= 2 and not all(np.isnan(v) for v in x), x, y, count

def model_for(seed):
    # Random forests work with mixed-scale odds and tolerate non-linear interactions.
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("model", RandomForestClassifier(
            n_estimators=240, min_samples_leaf=3, max_features="sqrt",
            class_weight="balanced_subsample", random_state=seed, n_jobs=-1
        ))
    ])

def train_target(rows, target):
    eligible = [(x, y[target]) for x, y, _ in rows if y.get(target) is not None]
    if len(eligible) < MIN_TRAIN:
        return None, {"samples": len(eligible), "message": f"Eğitim için en az {MIN_TRAIN} etiketli maç gerekli."}
    X = np.asarray([a for a, _ in eligible], dtype=float)
    y = np.asarray([b for _, b in eligible], dtype=int)
    classes = np.unique(y)
    if len(classes) < 2:
        return None, {"samples": len(eligible), "message": "Eğitim verisinde tek sınıf var; model eğitilemedi."}
    # Time-ordered holdout: latest 20% are validation, not used to fit validation score.
    split = max(int(len(y) * 0.8), 1)
    metrics = {"samples": len(y), "classes": [int(c) for c in classes]}
    if split < len(y) and len(np.unique(y[:split])) >= 2:
        test_model = model_for(RANDOM_STATE)
        test_model.fit(X[:split], y[:split])
        pred = test_model.predict(X[split:])
        metrics["validationAccuracy"] = round(float(accuracy_score(y[split:], pred)) * 100, 2)
        try:
            probs = test_model.predict_proba(X[split:])
            metrics["validationLogLoss"] = round(float(log_loss(y[split:], probs, labels=test_model.named_steps["model"].classes_)), 4)
            if target in ("KG","U25") and len(test_model.named_steps["model"].classes_) == 2:
                metrics["validationBrier"] = round(float(brier_score_loss(y[split:], probs[:, list(test_model.named_steps["model"].classes_).index(1)])), 4)
        except Exception:
            pass
        metrics["validationSamples"] = len(y) - split
    final_model = model_for(RANDOM_STATE)
    final_model.fit(X, y)
    return final_model, metrics

def safe_probabilities(model, x):
    probs = model.predict_proba(np.asarray([x], dtype=float))[0]
    classes = model.named_steps["model"].classes_
    return {int(c): float(p) for c, p in zip(classes, probs)}

def fmt_pct(v):
    return round(v * 100, 1)

def main():
    v2 = load_json(V2_PATH)
    live = load_json(LIVE_PATH)
    training = []
    usable = 0
    for m in v2:
        ok, x, y, count = valid_train_row(m)
        if ok:
            training.append((x, y, get_date(m)))
            usable += 1
    if not training:
        raise RuntimeError("v2-data.json içinden skor + en az iki oran alanı bulunan eğitim maçı çıkarılamadı. Veri şemasını kontrol edin.")
    # Keep the validation split chronological, regardless of JSON row order.
    training.sort(key=lambda row: row[2] or "")
    models, metrics = {}, {}
    for target in ("MS","KG","U25","IY15U"):
        model, report = train_target(training, target)
        metrics[target] = report
        if model is not None: models[target] = model

    predictions = []
    skipped = 0
    for m in live:
        ft = full_score(m)
        # Only predict matches without a final score.
        status = str(m.get("status", m.get("state", ""))).lower()
        if ft is not None or status in ("finished","ended","ft","finished","4","5"):
            continue
        x, count = feature_row(m)
        if count < 2:
            skipped += 1
            continue
        row = {
            "date": get_date(m),
            "time": str(m.get("time", m.get("kickoffTime", ""))),
            "league": str(m.get("league", m.get("competition", ""))),
            "home": team_name(m, "home"),
            "away": team_name(m, "away"),
            "featuresAvailable": count,
            "markets": {}
        }
        if not row["home"] or not row["away"]:
            skipped += 1
            continue
        for target, label in (("MS","Maç Sonucu"),("KG","Karşılıklı Gol"),("U25","2.5 Üst"),("IY15U","İY 1.5 Üst")):
            model = models.get(target)
            if model is None: continue
            p = safe_probabilities(model, x)
            if target == "MS":
                options = [{"key": "MS1", "title":"1", "probability": fmt_pct(p.get(0,0))},
                           {"key": "MSX", "title":"X", "probability": fmt_pct(p.get(1,0))},
                           {"key": "MS2", "title":"2", "probability": fmt_pct(p.get(2,0))}]
                best = max(options, key=lambda a:a["probability"])
                row["markets"][target] = {"title":label,"options":options,"pick":best["title"],"probability":best["probability"]}
            else:
                yes_class = 1
                yes = fmt_pct(p.get(yes_class, 0))
                no = round(100 - yes, 1)
                yes_title = {"KG":"Var","U25":"Üst","IY15U":"Üst"}[target]
                no_title = {"KG":"Yok","U25":"Alt","IY15U":"Alt"}[target]
                pick = yes_title if yes >= no else no_title
                row["markets"][target] = {"title":label,"options":[{"title":yes_title,"probability":yes},{"title":no_title,"probability":no}],"pick":pick,"probability":max(yes,no)}
        if row["markets"]:
            predictions.append(row)
    predictions.sort(key=lambda r: (r["date"], r["time"], r["league"], r["home"]))
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": {"training":"data/v2-data.json","fixtures":"data/matches.json"},
        "model": "RandomForestClassifier",
        "trainingMatches": len(training),
        "validation": metrics,
        "predictionCount": len(predictions),
        "skippedFixtures": skipped,
        "predictions": predictions,
        "notes": [
            "Ücretsiz; harici API kullanılmaz.",
            "Bu çıktı olasılık tahminidir, kesin sonuç veya bahis tavsiyesi değildir.",
            "Doğrulama skoru zaman sıralı son %20 üzerinde hesaplanır; geçmiş performans geleceği garanti etmez."
        ]
    }
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ML tamamlandı: eğitim={len(training)}, tahmin={len(predictions)}, atlanan={skipped}")
    print(f"Çıktı: {OUT_PATH.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
