
import json
import re
import hashlib
from pathlib import Path
from datetime import datetime, timedelta, timezone

import requests


# ============================================================
# AYARLAR
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_FILE = DATA_DIR / "basketball.json"

TODAY = datetime.now(timezone.utc).date()

NBA_DAYS_BACK = 180
NBA_DAYS_FORWARD = 30

TIMEOUT = 30

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
}


# ============================================================
# HTTP
# ============================================================

def get_json(url):
    try:
        response = requests.get(
            url,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        return response.json()

    except Exception as error:
        print(f"❌ İstek hatası: {url}")
        print(f"   {error}")
        return None


# ============================================================
# GENEL YARDIMCILAR
# ============================================================

def clean_text(value):
    if value is None:
        return ""

    return re.sub(r"\s+", " ", str(value).strip())


def normalize_team(name):
    name = clean_text(name).lower()

    replacements = {
        "ı": "i",
        "ğ": "g",
        "ü": "u",
        "ş": "s",
        "ö": "o",
        "ç": "c",
        "é": "e",
        "á": "a",
        "à": "a",
        "ä": "a",
        "-": " ",
        "_": " ",
        ".": " ",
        ",": " ",
        "'": "",
        '"': "",
    }

    for old, new in replacements.items():
        name = name.replace(old, new)

    return re.sub(r"\s+", " ", name).strip()


def safe_int(value):
    if value is None:
        return None

    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def make_match_id(league, season, home, away, utc_date):
    raw = "|".join([
        clean_text(league),
        clean_text(season),
        normalize_team(home),
        normalize_team(away),
        clean_text(utc_date),
    ])

    return hashlib.sha1(
        raw.encode("utf-8")
    ).hexdigest()[:20]


def match_key(match):
    return (
        clean_text(match.get("league")).upper(),
        clean_text(match.get("season")),
        normalize_team(match.get("homeTeam")),
        normalize_team(match.get("awayTeam")),
        clean_text(
            match.get("date")
            or match.get("utcDate", "")[:10]
        ),
    )


# ============================================================
# PERİYOT İŞLEMLERİ
# ============================================================

def make_period(home, away):
    home = safe_int(home)
    away = safe_int(away)

    if home is None or away is None:
        return None

    return {
        "home": home,
        "away": away,
        "total": home + away,
    }


def build_periods(home_values, away_values):
    periods = {}

    for index in range(4):
        home = (
            home_values[index]
            if index < len(home_values)
            else None
        )

        away = (
            away_values[index]
            if index < len(away_values)
            else None
        )

        period = make_period(home, away)

        if period is not None:
            periods[f"q{index + 1}"] = period

    return periods


def has_four_periods(periods):
    return (
        isinstance(periods, dict)
        and all(
            f"q{index}" in periods
            for index in range(1, 5)
        )
    )


# ============================================================
# MAÇ OLUŞTUR
# ============================================================

def build_match(
    home_team,
    away_team,
    home_score,
    away_score,
    utc_date,
    played,
    status="",
    periods=None,
    match_id=None,
):
    home_team = clean_text(home_team)
    away_team = clean_text(away_team)
    utc_date = clean_text(utc_date)

    if not home_team or not away_team or not utc_date:
        return None

    home_score = safe_int(home_score)
    away_score = safe_int(away_score)

    if not isinstance(periods, dict):
        periods = {}

    if not match_id:
        match_id = make_match_id(
            "NBA",
            "2026",
            home_team,
            away_team,
            utc_date,
        )

    match = {
        "id": str(match_id),
        "league": "NBA",
        "season": "2026",
        "date": utc_date[:10],
        "utcDate": utc_date,
        "homeTeam": home_team,
        "awayTeam": away_team,
        "homeScore": home_score,
        "awayScore": away_score,
        "played": bool(played),
        "hasPeriodData": has_four_periods(periods),
    }

    if status:
        match["status"] = clean_text(status)

    if has_four_periods(periods):
        match["periods"] = periods

    return match


# ============================================================
# ESKİ NBA VERİLERİNİ YÜKLE
# ============================================================

def load_existing_matches():
    if not OUTPUT_FILE.exists():
        print("📂 Önceki basketball.json bulunamadı.")
        return []

    try:
        with OUTPUT_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)

        matches = data.get("matches", [])

        if not isinstance(matches, list):
            raise ValueError("matches alanı liste değil.")

        nba_matches = [
            match
            for match in matches
            if isinstance(match, dict)
            and clean_text(match.get("league")).upper() == "NBA"
        ]

        removed = len(matches) - len(nba_matches)

        print(f"📚 Önceki toplam kayıt: {len(matches)}")
        print(f"🏀 Korunan NBA kaydı: {len(nba_matches)}")

        if removed:
            print(f"🗑️ NBA dışı kayıt: {removed}")

        return nba_matches

    except Exception as error:
        raise RuntimeError(
            "Eski basketball.json okunamadı. "
            f"Dosya korunuyor: {error}"
        )


# ============================================================
# ESKİ VE YENİ MAÇLARI BİRLEŞTİR
# ============================================================

def merge_match(old, new):
    merged = dict(old)

    old_played = old.get("played") is True
    new_played = new.get("played") is True

    old_has_score = (
        safe_int(old.get("homeScore")) is not None
        and safe_int(old.get("awayScore")) is not None
    )

    new_has_score = (
        safe_int(new.get("homeScore")) is not None
        and safe_int(new.get("awayScore")) is not None
    )

    # Yeni maç bilgilerini uygula.
    for field in (
        "league",
        "season",
        "date",
        "utcDate",
        "homeTeam",
        "awayTeam",
    ):
        if new.get(field) not in (None, ""):
            merged[field] = new[field]

    # Eski maç ID'sini koru.
    if old.get("id"):
        merged["id"] = old["id"]
    elif new.get("id"):
        merged["id"] = new["id"]

    # Skorları güncelle.
    if new_has_score:
        if new_played or not old_played or not old_has_score:
            merged["homeScore"] = new["homeScore"]
            merged["awayScore"] = new["awayScore"]

    # Tamamlanmış maç geriye dönmesin.
    merged["played"] = old_played or new_played

    # Durum bilgisi.
    if new.get("status"):
        if not old_played or new_played:
            merged["status"] = new["status"]

    # Periyot bilgilerini birleştir.
    old_periods = old.get("periods")
    new_periods = new.get("periods")

    periods = (
        dict(old_periods)
        if isinstance(old_periods, dict)
        else {}
    )

    if isinstance(new_periods, dict):
        for key, value in new_periods.items():
            if value is not None:
                periods[key] = value

    if has_four_periods(periods):
        merged["periods"] = periods
        merged["hasPeriodData"] = True
    else:
        merged["hasPeriodData"] = False

        if periods:
            merged["periods"] = periods

    # Eski tamamlanmış maçın skoru korunur.
    if old_played and old_has_score and not new_has_score:
        merged["homeScore"] = old["homeScore"]
        merged["awayScore"] = old["awayScore"]

    return merged


def merge_matches(old_matches, new_matches):
    merged = {}

    for match in old_matches:
        if not isinstance(match, dict):
            continue

        if clean_text(match.get("league")).upper() != "NBA":
            continue

        key = match_key(match)

        if all(key):
            merged[key] = match

    added = 0
    updated = 0

    for match in new_matches:
        if not isinstance(match, dict):
            continue

        if clean_text(match.get("league")).upper() != "NBA":
            continue

        key = match_key(match)

        if not all(key):
            continue

        old = merged.get(key)

        if old is None:
            merged[key] = match
            added += 1
        else:
            merged[key] = merge_match(old, match)
            updated += 1

    result = list(merged.values())

    print()
    print("=" * 60)
    print("🔄 NBA VERİ BİRLEŞTİRME")
    print("=" * 60)
    print(f"📚 Önceki NBA kaydı: {len(old_matches)}")
    print(f"🆕 Yeni maç: {added}")
    print(f"🔁 Güncellenen maç: {updated}")
    print(f"📦 Birleşik toplam: {len(result)}")

    return result


# ============================================================
# NBA TARİH ARALIĞI
# ============================================================

def nba_date_range():
    start = TODAY - timedelta(days=NBA_DAYS_BACK)
    end = TODAY + timedelta(days=NBA_DAYS_FORWARD)

    current = start

    while current <= end:
        yield current
        current += timedelta(days=1)


# ============================================================
# ESPN MAÇ DURUMU
# ============================================================

def espn_completed(event):
    status = event.get("status", {})
    status_type = status.get("type", {})

    if status_type.get("completed") is True:
        return True

    name = clean_text(status_type.get("name")).lower()
    state = clean_text(status_type.get("state")).lower()

    completed_values = {
        "final",
        "post",
        "finished",
        "complete",
        "completed",
    }

    return (
        name in completed_values
        or state in completed_values
    )


# ============================================================
# ESPN MAÇINI PARSE ET
# ============================================================

def parse_espn_event(event):
    competitions = event.get("competitions", [])

    if not competitions:
        return None

    competition = competitions[0]
    competitors = competition.get("competitors", [])

    if len(competitors) < 2:
        return None

    home = None
    away = None

    for item in competitors:
        if item.get("homeAway") == "home":
            home = item
        elif item.get("homeAway") == "away":
            away = item

    if not home or not away:
        return None

    home_data = home.get("team", {})
    away_data = away.get("team", {})

    home_team = (
        home_data.get("displayName")
        or home_data.get("name")
        or home_data.get("shortDisplayName")
        or ""
    )

    away_team = (
        away_data.get("displayName")
        or away_data.get("name")
        or away_data.get("shortDisplayName")
        or ""
    )

    utc_date = (
        event.get("date")
        or competition.get("date")
        or ""
    )

    if not utc_date:
        return None

    home_score = safe_int(home.get("score"))
    away_score = safe_int(away.get("score"))

    status = (
        event.get("status", {})
        .get("type", {})
        .get("description")
        or event.get("status", {})
        .get("type", {})
        .get("name")
        or ""
    )

    played = espn_completed(event)

    home_linescores = home.get("linescores") or []
    away_linescores = away.get("linescores") or []

    home_periods = []
    away_periods = []

    for item in home_linescores[:4]:
        if isinstance(item, dict):
            home_periods.append(safe_int(item.get("value")))
        else:
            home_periods.append(safe_int(item))

    for item in away_linescores[:4]:
        if isinstance(item, dict):
            away_periods.append(safe_int(item.get("value")))
        else:
            away_periods.append(safe_int(item))

    periods = build_periods(
        home_periods,
        away_periods,
    )

    return build_match(
        home_team=home_team,
        away_team=away_team,
        home_score=home_score,
        away_score=away_score,
        utc_date=utc_date,
        played=played,
        status=status,
        periods=periods,
        match_id=event.get("id"),
    )


# ============================================================
# NBA VERİSİNİ ÇEK
# ============================================================

def fetch_nba():
    print()
    print("=" * 60)
    print("🏀 NBA VERİLERİ ÇEKİLİYOR")
    print("=" * 60)

    matches = []
    successful_days = 0
    failed_days = 0

    for current_date in nba_date_range():
        date_string = current_date.strftime("%Y%m%d")

        url = (
            "https://site.api.espn.com/apis/site/v2/"
            "sports/basketball/nba/scoreboard"
            f"?dates={date_string}"
        )

        data = get_json(url)

        if data is None:
            failed_days += 1
            continue

        successful_days += 1

        for event in data.get("events", []):
            try:
                match = parse_espn_event(event)

                if match:
                    matches.append(match)

            except Exception as error:
                print(f"⚠️ Maç okunamadı: {error}")

    matches = deduplicate(matches)

    print(f"📅 Başarılı API günü: {successful_days}")
    print(f"⚠️ Başarısız API günü: {failed_days}")
    print(f"📦 Bulunan NBA maçı: {len(matches)}")
    print(
        f"🏁 Tamamlanan: "
        f"{sum(1 for m in matches if m['played'])}"
    )
    print(
        f"⏱️ Periyotlu: "
        f"{sum(1 for m in matches if m['hasPeriodData'])}"
    )

    return matches, successful_days


# ============================================================
# TEKRAR EDEN MAÇLARI TEMİZLE
# ============================================================

def deduplicate(matches):
    unique = {}

    for match in matches:
        if not isinstance(match, dict):
            continue

        if clean_text(match.get("league")).upper() != "NBA":
            continue

        key = match_key(match)

        if not all(key):
            continue

        old = unique.get(key)

        if old is None:
            unique[key] = match
            continue

        old_has_score = (
            old.get("homeScore") is not None
            and old.get("awayScore") is not None
        )

        new_has_score = (
            match.get("homeScore") is not None
            and match.get("awayScore") is not None
        )

        if new_has_score and not old_has_score:
            unique[key] = match
            continue

        if match.get("played") and not old.get("played"):
            unique[key] = match
            continue

        if (
            match.get("hasPeriodData")
            and not old.get("hasPeriodData")
        ):
            unique[key] = match

    return list(unique.values())


# ============================================================
# MAÇLARI SIRALA
# ============================================================

def sort_matches(matches):
    return sorted(
        matches,
        key=lambda match: (
            match.get("date", ""),
            match.get("utcDate", ""),
            match.get("homeTeam", ""),
            match.get("awayTeam", ""),
        ),
    )


# ============================================================
# JSON KAYDET
# ============================================================

def save_json(matches):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    played_count = sum(
        1 for match in matches
        if match.get("played") is True
    )

    period_count = sum(
        1 for match in matches
        if match.get("hasPeriodData") is True
    )

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "nba": "ESPN NBA Scoreboard",
        },
        "settings": {
            "nbaHistoryDays": NBA_DAYS_BACK,
            "nbaFutureDays": NBA_DAYS_FORWARD,
        },
        "statistics": {
            "totalMatches": len(matches),
            "playedMatches": played_count,
            "periodMatches": period_count,
            "nbaMatches": len(matches),
            "nbaPlayed": played_count,
        },
        "matches": matches,
    }

    temp_file = OUTPUT_FILE.with_suffix(".tmp")

    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(
            payload,
            file,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    temp_file.replace(OUTPUT_FILE)

    size_mb = OUTPUT_FILE.stat().st_size / 1024 / 1024

    print()
    print("=" * 60)
    print("💾 BASKETBALL.JSON KAYDEDİLDİ")
    print("=" * 60)
    print(f"📁 Dosya: {OUTPUT_FILE}")
    print(f"📦 Toplam maç: {len(matches)}")
    print(f"📁 Dosya boyutu: {size_mb:.2f} MB")

    if size_mb >= 95:
        print("⚠️ GitHub 100 MB sınırına yaklaşıldı.")


# ============================================================
# SONUÇ ÖZETİ
# ============================================================

def print_summary(matches):
    total = len(matches)

    played = sum(
        1 for match in matches
        if match.get("played") is True
    )

    scheduled = total - played

    periods = sum(
        1 for match in matches
        if match.get("hasPeriodData") is True
    )

    print()
    print("=" * 60)
    print("🏀 NBA GÜNCELLEME SONUCU")
    print("=" * 60)
    print(f"🏀 Toplam NBA maçı: {total}")
    print(f"🏁 Tamamlanan: {played}")
    print(f"⏳ Oynanmamış: {scheduled}")
    print(f"⏱️ Periyot verisi olan: {periods}")
    print("📌 Veri kaynağı: ESPN")
    print("📌 Lig: Yalnızca NBA")
    print("📌 EuroLeague: Kullanılmıyor")
    print("📌 EuroCup: Kullanılmıyor")
    print(f"📁 Veri dosyası: {OUTPUT_FILE}")


# ============================================================
# MAIN
# ============================================================

def main():
    print("=" * 60)
    print("🏀 NBA VERİ GÜNCELLEYİCİ")
    print("=" * 60)
    print(f"📅 Tarih: {TODAY}")
    print(f"📁 Proje klasörü: {BASE_DIR}")
    print(f"📄 Veri dosyası: {OUTPUT_FILE}")

    old_matches = load_existing_matches()

    new_matches, successful_days = fetch_nba()

    # Tüm API istekleri başarısızsa dosyaya dokunma.
    if successful_days == 0:
        raise RuntimeError(
            "NBA API isteklerinin tamamı başarısız oldu. "
            "Eski veri dosyası korunuyor."
        )

    # Yeni veri bulunamadığında eski kayıtları silme.
    if not new_matches and old_matches:
        raise RuntimeError(
            "Yeni NBA maçı bulunamadı. "
            "Eski veri dosyası korunuyor."
        )

    if not new_matches and not old_matches:
        raise RuntimeError("NBA verisi alınamadı.")

    all_matches = merge_matches(
        old_matches,
        new_matches,
    )

    all_matches = sort_matches(all_matches)

    save_json(all_matches)
    print_summary(all_matches)

    print()
    print("✅ NBA veri güncellemesi tamamlandı.")


if __name__ == "__main__":
    main()
