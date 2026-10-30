import json
import math
import re
from collections import Counter
from datetime import datetime, date
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "v2-data.json"

TIMEZONE = ZoneInfo("Europe/Istanbul")

SCORE_PATTERN = re.compile(r"^\s*(\d+)\s*[-–—:]\s*(\d+)\s*$")


def parse_date(value):
    if not isinstance(value, str):
        return None

    try:
        return datetime.strptime(value.strip(), "%d.%m.%Y").date()
    except ValueError:
        return None


def parse_score(value):
    if not isinstance(value, str):
        return None

    match = SCORE_PATTERN.fullmatch(value.strip())

    if not match:
        return None

    return int(match.group(1)), int(match.group(2))


def valid_odd(value):
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

    for match in matches:
        if isinstance(match, dict):
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
    labels = {}

    ft = parse_score(match.get("score"))
    ht = parse_score(match.get("halfTimeScore"))

    if ft is not None:
        home, away = ft
        total = home + away

        if home > away:
            labels["MS 1-X-2"] = "1"
        elif home == away:
            labels["MS 1-X-2"] = "X"
        else:
            labels["MS 1-X-2"] = "2"

        labels["KG Var-Yok"] = (
            "Var" if home > 0 and away > 0 else "Yok"
        )

        labels["Toplam gol 1.5"] = "Üst" if total >= 2 else "Alt"
        labels["Toplam gol 2.5"] = "Üst" if total >= 3 else "Alt"
        labels["Toplam gol 3.5"] = "Üst" if total >= 4 else "Alt"

        if total <= 1:
            labels["Toplam gol aralığı"] = "0-1"
        elif total <= 3:
            labels["Toplam gol aralığı"] = "2-3"
        elif total <= 5:
            labels["Toplam gol aralığı"] = "4-5"
        else:
            labels["Toplam gol aralığı"] = "6+"

        labels["Skor tahmini"] = f"{home}-{away}"

    if ht is not None:
        home, away = ht
        total = home + away

        if home > away:
            labels["İY 1-X-2"] = "1"
        elif home == away:
            labels["İY 1-X-2"] = "X"
        else:
            labels["İY 1-X-2"] = "2"

        labels["İY 0.5"] = "Üst" if total >= 1 else "Alt"
        labels["İY 1.5"] = "Üst" if total >= 2 else "Alt"

    return labels


def print_counter(counter):
    if not counter:
        return "Veri yok"

    return " | ".join(
        f"{key}: {value:,}"
        for key, value in sorted(counter.items())
    )


def analyze_dates(matches, today):
    stats = Counter()
    monthly = Counter()
    valid_dates = []
    date_order = []

    for match in matches:
        if not isinstance(match, dict):
            stats["gecersiz_kayit"] += 1
            continue

        match_date = parse_date(match.get("date"))
        ft = parse_score(match.get("score"))
        ht = parse_score(match.get("halfTimeScore"))

        if match_date is None:
            stats["gecersiz_tarih"] += 1
            continue

        valid_dates.append(match_date)
        date_order.append(match_date)
        monthly[match_date.strftime("%Y-%m")] += 1

        if ft is not None:
            stats["gecerli_ms"] += 1

            if match_date > today:
                stats["gelecek_tarihli_skorlu"] += 1
            elif match_date == today:
                stats["bugun_skorlu"] += 1
            else:
                stats["gecmis_skorlu"] += 1

        else:
            stats["skorsuz"] += 1

            if match_date > today:
                stats["gelecek_skor_yok"] += 1

            elif match_date == today:
                stats["bugun_skor_yok"] += 1

            else:
                stats["gecmis_skor_yok"] += 1

                if ht is not None:
                    stats["gecmis_skor_yok_devre_var"] += 1
                else:
                    stats["gecmis_skor_yok_devre_yok"] += 1

        if ht is not None:
            stats["gecerli_iy"] += 1

        if ft is None and ht is not None:
            stats["ms_yok_iy_var"] += 1

        if ft is not None and ht is None:
            stats["ms_var_iy_yok"] += 1

    ascending = 0
    descending = 0
    equal = 0

    for previous, current in zip(date_order, date_order[1:]):
        if current > previous:
            ascending += 1
        elif current < previous:
            descending += 1
        else:
            equal += 1

    if ascending > 0 and descending == 0:
        order = "Artan tarih sırası"
    elif descending > 0 and ascending == 0:
        order = "Azalan tarih sırası"
    elif ascending == 0 and descending == 0:
        order = "Tüm kayıtlar aynı tarihte"
    else:
        order = "Karışık sıralama"

    return stats, monthly, valid_dates, order, ascending, descending, equal


def main():
    today = datetime.now(TIMEZONE).date()

    print("=" * 70)
    print("MACKOLIK1 - GELİŞMİŞ ML VERİ ANALİZİ")
    print("=" * 70)
    print(f"Analiz tarihi: {today.strftime('%d.%m.%Y')}")

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Veri dosyası bulunamadı: {DATA_FILE}"
        )

    print("\nJSON dosyası okunuyor...")

    with DATA_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError("JSON ana yapısı nesne olmalı.")

    matches = data.get("matches")

    if not isinstance(matches, list):
        raise ValueError("matches dizisi bulunamadı.")

    matches = [
        match for match in matches
        if isinstance(match, dict)
    ]

    market_keys = get_market_keys(data, matches)

    print("\n1. GENEL VERİ")
    print("-" * 70)
    print(f"Kaynak             : {data.get('source', 'Bilinmiyor')}")
    print(f"Güncelleme         : {data.get('updatedAt', 'Bilinmiyor')}")
    print(f"Metadata maç      : {data.get('count', 'Bilinmiyor')}")
    print(f"Okunan maç         : {len(matches):,}")
    print(f"Market sayısı      : {len(market_keys)}")

    print("\n2. TARİH ANALİZİ")
    print("-" * 70)

    date_stats, monthly, valid_dates, order, asc, desc, equal = (
        analyze_dates(matches, today)
    )

    if valid_dates:
        print(
            f"İlk maç tarihi     : "
            f"{min(valid_dates).strftime('%d.%m.%Y')}"
        )
        print(
            f"Son maç tarihi     : "
            f"{max(valid_dates).strftime('%d.%m.%Y')}"
        )

    print(f"Geçerli tarih      : {len(valid_dates):,}")
    print(
        f"Geçersiz tarih     : "
        f"{date_stats['gecersiz_tarih']:,}"
    )

    print("\nTarih sıralaması:")
    print(f"Durum              : {order}")
    print(f"Artan geçiş        : {asc:,}")
    print(f"Azalan geçiş       : {desc:,}")
    print(f"Aynı tarih geçişi  : {equal:,}")

    print("\n3. MAÇ SONUCU DURUMU")
    print("-" * 70)

    print(f"Geçerli MS skoru   : {date_stats['gecerli_ms']:,}")
    print(f"Geçerli İY skoru   : {date_stats['gecerli_iy']:,}")
    print(f"Skorsuz maç        : {date_stats['skorsuz']:,}")

    print("\nSkorsuz maçların tarih durumları:")
    print(
        f"Gelecek tarihli    : "
        f"{date_stats['gelecek_skor_yok']:,}"
    )
    print(
        f"Bugünün maçı       : "
        f"{date_stats['bugun_skor_yok']:,}"
    )
    print(
        f"Geçmiş tarihli     : "
        f"{date_stats['gecmis_skor_yok']:,}"
    )

    print("\nGeçmiş tarihli skorsuz maçların devre durumu:")
    print(
        f"Devre skoru var    : "
        f"{date_stats['gecmis_skor_yok_devre_var']:,}"
    )
    print(
        f"Devre skoru yok    : "
        f"{date_stats['gecmis_skor_yok_devre_yok']:,}"
    )

    print("\nDiğer tutarsızlık kontrolleri:")
    print(
        f"MS skoru yok, İY var: "
        f"{date_stats['ms_yok_iy_var']:,}"
    )
    print(
        f"MS skoru var, İY yok: "
        f"{date_stats['ms_var_iy_yok']:,}"
    )
    print(
        f"Gelecek tarihli ama MS skorlu: "
        f"{date_stats['gelecek_tarihli_skorlu']:,}"
    )

    print("\n4. AYLARA GÖRE MAÇ DAĞILIMI")
    print("-" * 70)

    for month, count in sorted(monthly.items()):
        print(f"{month}: {count:,} maç")

    print("\n5. ORAN ANALİZİ")
    print("-" * 70)

    market_available = Counter()
    feature_distribution = Counter()

    for match in matches:
        odds = get_valid_odds(match, market_keys)
        feature_distribution[len(odds)] += 1

        for key in odds:
            market_available[key] += 1

    for key in market_keys:
        available = market_available[key]
        missing = len(matches) - available

        print(
            f"{key:15} "
            f"Dolu: {available:7,} | "
            f"Eksik: {missing:7,}"
        )

    print("\nMaç başına geçerli oran sayısı:")

    for count in sorted(feature_distribution):
        print(
            f"{count:2} oran: "
            f"{feature_distribution[count]:,} maç"
        )

    print("\n6. TAHMİN GRUPLARI")
    print("-" * 70)

    target_counts = Counter()
    target_feature_counts = Counter()
    target_classes = {}

    for match in matches:
        labels = get_labels(match)
        odds = get_valid_odds(match, market_keys)

        for target, label in labels.items():
            target_counts[target] += 1

            target_classes.setdefault(
                target, Counter()
            )[label] += 1

            if odds:
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

        print(f"\n{target}")
        print(f"Etiketli örnek       : {total:,}")
        print(f"Oranlı örnek         : {usable:,}")
        print(
            f"Sınıf dağılımı       : "
            f"{print_counter(target_classes.get(target, Counter()))}"
        )

    print("\n7. EĞİTİM VERİSİ İÇİN ÖN DEĞERLENDİRME")
    print("-" * 70)

    completed_before_today = 0
    completed_today = 0
    future_matches = 0
    past_without_result = 0

    for match in matches:
        match_date = parse_date(match.get("date"))

        if match_date is None:
            continue

        ft = parse_score(match.get("score"))

        if match_date < today and ft is not None:
            completed_before_today += 1

        elif match_date == today and ft is not None:
            completed_today += 1

        elif match_date > today:
            future_matches += 1

        elif match_date < today and ft is None:
            past_without_result += 1

    print(f"Bugünden önce MS skoru bulunan: {completed_before_today:,}")
    print(f"Bugün MS skoru bulunan       : {completed_today:,}")
    print(f"Gelecek tarihli maç          : {future_matches:,}")
    print(f"Geçmiş tarihli skorsuz maç   : {past_without_result:,}")

    print("\n" + "=" * 70)
    print("GELİŞMİŞ ANALİZ TAMAMLANDI")
    print("Hiçbir dosya değiştirilmedi.")
    print("Hiçbir model eğitilmedi.")
    print("=" * 70)


if __name__ == "__main__":
    main()
