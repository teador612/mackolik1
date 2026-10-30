
import json
import re
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from collections import Counter

DATA_PATH = Path("data/v2-data.json")
TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15

def parse_date(value):
    try:
        return datetime.strptime(str(value).strip(), "%d.%m.%Y").date()
    except (ValueError, TypeError):
        return None

def parse_score(value):
    if not isinstance(value, str):
        return None

    match = re.fullmatch(r"\s*(\d+)\s*[-:]\s*(\d+)\s*", value)

    if not match:
        return None

    return int(match.group(1)), int(match.group(2))

def print_section(title):
    print("\n" + "=" * 65)
    print(title)
    print("=" * 65)

def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Veri dosyası bulunamadı: {DATA_PATH}")

    with DATA_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    matches = data.get("matches", [])

    if not isinstance(matches, list):
        raise ValueError("JSON içindeki matches alanı liste değil.")

    today = datetime.now(ZoneInfo("Europe/Istanbul")).date()

    print_section("ML VERİ BÖLÜNME KONTROLÜ")
    print(f"Bugünün tarihi       : {today.strftime('%d.%m.%Y')}")
    print(f"JSON kayıt sayısı    : {len(matches):,}")
    print(f"Veri güncelleme      : {data.get('updatedAt', 'Bilinmiyor')}")
    print(f"Market sayısı        : {data.get('marketCount', 'Bilinmiyor')}")

    dated_rows = []
    invalid_date_count = 0

    for index, match in enumerate(matches):
        if not isinstance(match, dict):
            invalid_date_count += 1
            continue

        match_date = parse_date(match.get("date"))

        if match_date is None:
            invalid_date_count += 1
            continue

        dated_rows.append({
            "date": match_date,
            "match": match,
            "index": index
        })

    historical_rows = [
        row for row in dated_rows
        if row["date"] < today
    ]

    today_rows = [
        row for row in dated_rows
        if row["date"] == today
    ]

    future_rows = [
        row for row in dated_rows
        if row["date"] > today
    ]

    # Eğitim ve test tarihlerini yalnızca geçmişteki,
    # geçerli maç sonu skoru bulunan maçlardan belirle.
    completed_rows = [
        row for row in historical_rows
        if parse_score(row["match"].get("score")) is not None
    ]

    excluded_past_rows = [
        row for row in historical_rows
        if parse_score(row["match"].get("score")) is None
    ]

    unique_dates = sorted({
        row["date"] for row in completed_rows
    })

    if len(unique_dates) < 3:
        raise ValueError(
            "Eğitim, doğrulama ve test için yeterli sayıda "
            "farklı maç tarihi bulunamadı."
        )

    train_end = int(len(unique_dates) * TRAIN_RATIO)
    validation_end = int(
        len(unique_dates) * (TRAIN_RATIO + VALIDATION_RATIO)
    )

    train_end = max(1, min(train_end, len(unique_dates) - 2))
    validation_end = max(
        train_end + 1,
        min(validation_end, len(unique_dates) - 1)
    )

    train_dates = set(unique_dates[:train_end])
    validation_dates = set(unique_dates[train_end:validation_end])
    test_dates = set(unique_dates[validation_end:])

    def rows_for_dates(rows, date_set):
        return [row for row in rows if row["date"] in date_set]

    train_rows = rows_for_dates(completed_rows, train_dates)
    validation_rows = rows_for_dates(completed_rows, validation_dates)
    test_rows = rows_for_dates(completed_rows, test_dates)

    def print_split(name, dates, rows):
        print_section(name)

        if not dates:
            print("Tarih bulunamadı.")
            return

        print(f"Tarih sayısı         : {len(dates):,}")
        print(f"İlk tarih            : {min(dates).strftime('%d.%m.%Y')}")
        print(f"Son tarih            : {max(dates).strftime('%d.%m.%Y')}")
        print(f"Maç sayısı           : {len(rows):,}")

        ht_count = sum(
            parse_score(row["match"].get("halfTimeScore")) is not None
            for row in rows
        )

        print(f"Geçerli İY skoru     : {ht_count:,}")
        print(f"Geçerli MS skoru     : {len(rows):,}")

    print_section("GENEL VERİ DURUMU")
    print(f"Geçerli tarihli kayıt: {len(dated_rows):,}")
    print(f"Geçersiz tarihli kayıt: {invalid_date_count:,}")
    print(f"Geçmiş maç           : {len(historical_rows):,}")
    print(f"Geçmişte MS skorlu   : {len(completed_rows):,}")
    print(f"Geçmişte MS skorsuz  : {len(excluded_past_rows):,}")
    print(f"Bugünkü maç          : {len(today_rows):,}")
    print(f"Gelecekteki maç      : {len(future_rows):,}")
    print(f"Farklı eğitim tarihi : {len(unique_dates):,}")

    print_split("1 - EĞİTİM VERİSİ (%70)", train_dates, train_rows)
    print_split(
        "2 - DOĞRULAMA VERİSİ (%15)",
        validation_dates,
        validation_rows
    )
    print_split("3 - SON TEST VERİSİ (%15)", test_dates, test_rows)

    print_section("İLK YARI SKORU KONTROLÜ")

    for name, rows in [
        ("Eğitim", train_rows),
        ("Doğrulama", validation_rows),
        ("Son test", test_rows)
    ]:
        valid_ht = sum(
            parse_score(row["match"].get("halfTimeScore")) is not None
            for row in rows
        )

        print(
            f"{name:12} | Toplam: {len(rows):,} "
            f"| İY skorlu: {valid_ht:,} "
            f"| İY skorsuz: {len(rows) - valid_ht:,}"
        )

    print_section("HEDEF ETİKET KONTROLÜ")

    def count_targets(rows):
        counts = {
            "MS 1-X-2": Counter(),
            "KG Var-Yok": Counter(),
            "İY 0.5 Alt-Üst": Counter(),
            "İY 1.5 Alt-Üst": Counter(),
            "MS 1.5 Alt-Üst": Counter(),
            "MS 2.5 Alt-Üst": Counter(),
            "MS 3.5 Alt-Üst": Counter(),
            "İY 1-X-2": Counter(),
            "Gol aralığı": Counter()
        }

        for row in rows:
            match = row["match"]
            ft = parse_score(match.get("score"))
            ht = parse_score(match.get("halfTimeScore"))

            if ft is not None:
                home, away = ft
                total = home + away

                if home > away:
                    counts["MS 1-X-2"]["1"] += 1
                elif home == away:
                    counts["MS 1-X-2"]["X"] += 1
                else:
                    counts["MS 1-X-2"]["2"] += 1

                counts["KG Var-Yok"][
                    "Var" if home > 0 and away > 0 else "Yok"
                ] += 1

                for threshold, label in [
                    (1.5, "MS 1.5 Alt-Üst"),
                    (2.5, "MS 2.5 Alt-Üst"),
                    (3.5, "MS 3.5 Alt-Üst")
                ]:
                    counts[label][
                        "Üst" if total > threshold else "Alt"
                    ] += 1

                if total <= 1:
                    counts["Gol aralığı"]["0-1"] += 1
                elif total <= 3:
                    counts["Gol aralığı"]["2-3"] += 1
                elif total <= 5:
                    counts["Gol aralığı"]["4-5"] += 1
                else:
                    counts["Gol aralığı"]["6+"] += 1

            if ht is not None:
                home, away = ht
                total = home + away

                counts["İY 0.5 Alt-Üst"][
                    "Üst" if total > 0.5 else "Alt"
                ] += 1

                counts["İY 1.5 Alt-Üst"][
                    "Üst" if total > 1.5 else "Alt"
                ] += 1

                if home > away:
                    counts["İY 1-X-2"]["1"] += 1
                elif home == away:
                    counts["İY 1-X-2"]["X"] += 1
                else:
                    counts["İY 1-X-2"]["2"] += 1

        return counts

    for split_name, rows in [
        ("EĞİTİM", train_rows),
        ("DOĞRULAMA", validation_rows),
        ("SON TEST", test_rows)
    ]:
        print(f"\n{split_name}")

        for target, classes in count_targets(rows).items():
            total = sum(classes.values())
            class_text = ", ".join(
                f"{key}: {value:,}"
                for key, value in sorted(classes.items())
            )

            print(f"{target:18} | {total:6,} | {class_text}")

    print_section("KONTROL SONUCU")
    print("Tarih bazlı bölme tamamlandı.")
    print("Aynı güne ait maçlar farklı bölümlere dağıtılmadı.")
    print("Skorsuz geçmiş maçlar eğitim ve test dışında bırakıldı.")
    print("İY hedefleri yalnızca İY skoru bulunan maçlardan hesaplandı.")
    print("Bu aşamada hiçbir model eğitilmedi.")
    print("\nSONRAKİ ADIM: Bu çıktıyı kontrol edip model eğitimine geçmek.")

if __name__ == "__main__":
    main()
