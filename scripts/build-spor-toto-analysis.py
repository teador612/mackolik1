
import json
import re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "v2-data.json"
OUTPUT = ROOT / "data" / "spor-toto-analysis.json"

SELECTED_MARKETS = [
    "iy1",
    "iy2",
    "iy15Ust",
    "ms1",
    "msX",
    "ms2",
    "kgVar",
    "au25Ust",
]


def parse_score(value):
    if not isinstance(value, str):
        return None

    match = re.fullmatch(r"\s*(\d+)\s*[-:]\s*(\d+)\s*", value)
    if not match:
        return None

    home, away = map(int, match.groups())

    if home > away:
        return "1"
    if home < away:
        return "2"
    return "X"


def parse_date(value):
    try:
        return datetime.strptime(value, "%d.%m.%Y").strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def clean_odds(value):
    if isinstance(value, bool):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if number <= 1.0 or number > 1000:
        return None

    return round(number, 4)


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Kaynak dosya bulunamadı: {SOURCE}")

    with SOURCE.open("r", encoding="utf-8") as file:
        source_data = json.load(file)

    source_matches = source_data.get("matches")

    if not isinstance(source_matches, list):
        raise ValueError("v2-data.json içinde matches listesi bulunamadı.")

    output_matches = []
    market_counts = {key: 0 for key in SELECTED_MARKETS}
    completed_count = 0

    for match in source_matches:
        if not isinstance(match, dict):
            continue

        date = parse_date(match.get("date"))
        if not date:
            continue

        odds_source = match.get("odds")
        if not isinstance(odds_source, dict):
            odds_source = {}

        odds = {
            key: clean_odds(odds_source.get(key))
            for key in SELECTED_MARKETS
        }

        for key, value in odds.items():
            if value is not None:
                market_counts[key] += 1

        result = parse_score(match.get("score"))

        if result is not None:
            completed_count += 1

        output_matches.append({
            "date": date,
            "time": str(match.get("time") or ""),
            "league": str(match.get("league") or ""),
            "home": str(match.get("home") or ""),
            "away": str(match.get("away") or ""),
            "score": match.get("score"),
            "halfTimeScore": match.get("halfTimeScore"),
            "result": result,
            "odds": odds
        })

    output_matches.sort(
        key=lambda item: (item["date"], item["time"])
    )

    result_data = {
        "source": "data/v2-data.json",
        "sourceUpdatedAt": source_data.get("updatedAt"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceCount": len(source_matches),
        "matchCount": len(output_matches),
        "completedCount": completed_count,
        "marketCount": len(SELECTED_MARKETS),
        "markets": SELECTED_MARKETS,
        "availableOdds": market_counts,
        "matches": output_matches
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    temporary_file = OUTPUT.with_suffix(".tmp")
    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(
            result_data,
            file,
            ensure_ascii=False,
            separators=(",", ":")
        )

    temporary_file.replace(OUTPUT)

    print("Spor Toto analiz verisi oluşturuldu.")
    print(f"Kaynak maç: {len(source_matches)}")
    print(f"Aktarılan maç: {len(output_matches)}")
    print(f"Sonucu belli maç: {completed_count}")
    print("Pazar bazında geçerli oran sayıları:")

    for key, count in market_counts.items():
        print(f"  {key}: {count}")

    print(f"Çıktı: {OUTPUT}")


if __name__ == "__main__":
    main()
