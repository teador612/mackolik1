import json
import math
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "v2-data.json"

SCORE_PATTERN = re.compile(r"^\s*(\d+)\s*[-–—:]\s*(\d+)\s*$")


def parse_score(value):
    """Skoru (ev sahibi, deplasman) biçiminde okur."""
    if not isinstance(value, str):
        return None

    match = SCORE_PATTERN.fullmatch(value.strip())

    if not match:
        return None

    return int(match.group(1)), int(match.group(2))


def valid_odd(value):
    """Geçerli açılış oranını sayısal olarak döndürür."""
    if isinstance(value, bool) or value is None:
        return None

    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")

        number = float(value)

        if not math.isfinite(number) or number <= 0:
            return None

        return number

    except (TypeError, ValueError):
        return None


def get_market_keys(data, matches):
    markets = data.get("markets", [])

    keys = [
        market.get("key")
        for market in markets
        if isinstance(market, dict) and market.get("key")
    ]

    if keys:
        return list(dict.fromkeys(keys))

    # Market listesi yoksa ilk maçın odds alanından çıkar.
    for match in matches:
        odds = match.get("odds")

        if isinstance(odds, dict):
            return list(odds.keys())

    return []


def get_valid_odds(match, market_keys):
    odds = match.get("odds")

    if not isinstance(odds, dict):
        return {}

    result = {}

    for key in market_keys:
        value = valid_odd(odds.get(key))

        if value is not None:
            result[key] = value

    return result


def get_labels(match):
    """Maç skorlarından tahmin hedeflerini oluşturur."""
    labels = {}

    ft = parse_score(match.get("score"))
    ht = parse_score(match.get("halfTimeScore"))

    if ft is not None:
        home_goals, away_goals = ft
        total_goals = home_goals + away_goals

        if home_goals > away_goals:
            labels["MS 1-X-2"] = "1"
        elif home_goals == away_goals:
            labels["MS 1-X-2"] = "X"
        else:
            labels["MS 1-X-2"] = "2"

        labels["KG Var-Yok"] = (
            "Var" if home_goals > 0 and away_goals > 0 else "Yok"
        )

        labels["Toplam gol 1.5"] = (
            "Üst" if total_goals >= 2 else "Alt"
        )
        labels["Toplam gol 2.5"] = (
            "Üst" if total_goals >= 3 else "Alt"
        )
        labels["Toplam gol 3.5"] = (
            "Üst" if total_goals >= 4 else "Alt"
        )

        if total_goals <= 1:
            labels["Toplam gol aralığı"] = "0-1"
        elif total_goals <= 3:
            labels["Toplam gol aralığı"] = "2-3"
        elif total_goals <= 5:
            labels["Toplam gol aralığı"] = "4-5"
        else:
            labels["Toplam gol aralığı"] = "6+"

        labels["Skor tahmini"] = f"{home_goals}-{away_goals}"

    if ht is not None:
        ht_home, ht_away = ht
        ht_total = ht_home + ht_away

        if ht_home > ht_away:
            labels["İY 1-X-2"] = "1"
        elif ht_home == ht_away:
            labels["İY 1-X-2"] = "X"
        else:
            labels["İY 1-X-2"] = "2"

        labels["İY 0.5"] = "Üst" if ht_total >= 1 else "Alt"
        labels["İY 1.5"] = "Üst" if ht_total >= 2 else "Alt"

    return labels


def print_counter(counter):
    if not counter:
        return "Veri yok"

    return " | ".join(
        f"{label}: {count:,}"
        for label, count in sorted(counter.items())
    )


def main():
    print("=" * 65)
    print("MACKOLIK1 - ML VERİ ANALİZİ")
    print("=" * 65)

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Veri dosyası bulunamadı: {DATA_FILE}"
        )

    print("\nJSON dosyası okunuyor...")

    with DATA_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("JSON ana yapısı bir nesne olmalı.")

    matches = data.get("matches")

    if not isinstance(matches, list):
        raise ValueError("JSON içerisinde matches dizisi bulunamadı.")

    market_keys = get_market_keys(data, matches)
    market_count = len(market_keys)

    print("\n1. GENEL VERİ BİLGİLERİ")
    print("-" * 65)
    print(f"Kaynak dosya       : {data.get('source', 'Bilinmiyor')}")
    print(f"Güncelleme tarihi  : {data.get('updatedAt', 'Bilinmiyor')}")
    print(f"JSON toplam maç    : {data.get('count', 'Bilinmiyor')}")
    print(f"Okunan maç         : {len(matches):,}")
    print(f"Market sayısı      : {market_count}")

    if data.get("count") != len(matches):
        print("UYARI: Metadata maç sayısı ile gerçek kayıt sayısı farklı.")

    print("\n2. AÇILIŞ ORANI ANALİZİ")
    print("-" * 65)

    market_available = Counter()
    feature_count_distribution = Counter()
    rows_with_odds = 0
    rows_without_odds = 0

    for match in matches:
        if not isinstance(match, dict):
            continue

        valid_odds = get_valid_odds(match, market_keys)
        feature_count = len(valid_odds)

        feature_count_distribution[feature_count] += 1

        if feature_count:
            rows_with_odds += 1
        else:
            rows_without_odds += 1

        for key in valid_odds:
            market_available[key] += 1

    print(f"En az bir geçerli oranı olan maç : {rows_with_odds:,}")
    print(f"Hiç geçerli oranı olmayan maç   : {rows_without_odds:,}")

    print("\nMarket bazında geçerli oran sayıları:")

    for key in market_keys:
        available = market_available[key]
        missing = len(matches) - available

        print(
            f"{key:15} "
            f"Dolu: {available:7,} | "
            f"Eksik: {missing:7,}"
        )

    print("\nMaç başına kullanılabilir oran sayısı:")

    for feature_count in sorted(feature_count_distribution):
        print(
            f"{feature_count:2} oran bulunan maç: "
            f"{feature_count_distribution[feature_count]:,}"
        )

    print("\n3. SKOR VERİSİ ANALİZİ")
    print("-" * 65)

    valid_ft = 0
    valid_ht = 0
    invalid_ft = 0
    invalid_ht = 0
    exact_scores = Counter()

    for match in matches:
        if not isinstance(match, dict):
            continue

        ft = parse_score(match.get("score"))
        ht = parse_score(match.get("halfTimeScore"))

        if ft is not None:
            valid_ft += 1
            exact_scores[f"{ft[0]}-{ft[1]}"] += 1
        else:
            invalid_ft += 1

        if ht is not None:
            valid_ht += 1
        else:
            invalid_ht += 1

    print(f"Geçerli maç sonu skoru : {valid_ft:,}")
    print(f"Geçersiz/eksik MS skoru: {invalid_ft:,}")
    print(f"Geçerli devre skoru    : {valid_ht:,}")
    print(f"Geçersiz/eksik İY skoru: {invalid_ht:,}")
    print(f"Farklı skor çeşidi     : {len(exact_scores):,}")

    print("\nEn sık görülen 10 maç skoru:")

    for score, count in exact_scores.most_common(10):
        print(f"{score:8} {count:,} maç")

    print("\n4. TAHMİN GRUPLARI - EĞİTİM ÖRNEĞİ ANALİZİ")
    print("-" * 65)

    target_counts = Counter()
    target_feature_counts = Counter()
    target_classes = {}

    for match in matches:
        if not isinstance(match, dict):
            continue

        labels = get_labels(match)
        valid_odds = get_valid_odds(match, market_keys)

        for target, label in labels.items():
            target_counts[target] += 1
            target_classes.setdefault(target, Counter())[label] += 1

            if valid_odds:
                target_feature_counts[target] += 1

    target_order = [
        "MS 1-X-2",
        "KG Var-Yok",
        "İY 0.5",
        "İY 1.5",
        "Toplam gol 1.5",
        "Toplam gol 2.5",
        "Toplam gol 3.5",
        "İY 1-X-2",
        "Toplam gol aralığı",
        "Skor tahmini",
    ]

    for target in target_order:
        total = target_counts[target]
        usable = target_feature_counts[target]
        no_features = total - usable

        print(f"\n{target}")
        print(f"  Geçerli hedef sayısı       : {total:,}")
        print(f"  En az bir oranı olan örnek : {usable:,}")
        print(f"  Oranı olmayan örnek        : {no_features:,}")
        print(f"  Sınıf dağılımı             : "
              f"{print_counter(target_classes.get(target, Counter()))}")

    print("\n5. ANALİZ SONU")
    print("-" * 65)
    print("Veri analizi tamamlandı.")
    print("Bu işlem hiçbir veriyi değiştirmedi.")
    print("Hiçbir model eğitilmedi.")
    print("=" * 65)


if __name__ == "__main__":
    main()
