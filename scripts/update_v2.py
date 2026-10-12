
import json
import math
import os
import re
import unicodedata
from datetime import datetime

import pandas as pd

# =========================================================
# AYARLAR
# =========================================================

INPUT_FILE = "input/acilis.xlsx"
OUTPUT_FILE = "data/v2-data.json"
SHEET_NAME = "Acilis"

# =========================================================
# YARDIMCI FONKSİYONLAR
# =========================================================

def is_empty(value):
    if value is None:
        return True

    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def clean_text(value):
    if is_empty(value):
        return ""

    text = str(value).strip()

    if text.lower() in ("nan", "none", "nat", "null"):
        return ""

    return text


def normalize_header(value):
    """Başlık karşılaştırması için Türkçe karakterleri normalize eder."""
    text = clean_text(value).upper()
    text = text.replace("İ", "I").replace("Ü", "U")
    text = text.replace("Ö", "O").replace("Ş", "S")
    text = text.replace("Ğ", "G").replace("Ç", "C")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(
        char for char in text
        if not unicodedata.combining(char)
    )
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_odd(value):
    """Oranı sayıya çevirir; boş/geçersiz değerleri None yapar."""
    if is_empty(value):
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = clean_text(value)
        if not text:
            return None

        text = text.replace(" ", "")

        if "," in text and "." in text:
            # Türkçe biçim: 1.234,56
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", ".")

        try:
            number = float(text)
        except (ValueError, TypeError):
            return None

    if not math.isfinite(number) or number <= 1.00:
        return None

    return round(number, 2)


def format_date(value):
    if is_empty(value):
        return ""

    try:
        parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)

        if pd.isna(parsed):
            return clean_text(value)

        return parsed.strftime("%d.%m.%Y")
    except Exception:
        return clean_text(value)


def format_time(value):
    if is_empty(value):
        return ""

    if hasattr(value, "strftime"):
        try:
            return value.strftime("%H:%M")
        except Exception:
            pass

    text = clean_text(value)

    if not text:
        return ""

    match = re.match(r"^(\d{1,2}):(\d{2})", text)

    if match:
        return f"{match.group(1).zfill(2)}:{match.group(2)}"

    return text


def clean_score(value):
    text = clean_text(value)

    if not text:
        return None

    text = (
        text.replace("–", "-")
        .replace("—", "-")
        .replace(":", "-")
        .replace(" ", "")
    )

    parts = text.split("-")

    if len(parts) != 2:
        return None

    try:
        home = int(float(parts[0]))
        away = int(float(parts[1]))
    except (ValueError, TypeError):
        return None

    if home < 0 or away < 0:
        return None

    return f"{home}-{away}"


def find_column(df, possible_names):
    normalized = {
        normalize_header(column).replace(" ", ""): column
        for column in df.columns
    }

    for name in possible_names:
        key = normalize_header(name).replace(" ", "")

        if key in normalized:
            return normalized[key]

    return None


def get_value(row, column):
    if column is None:
        return None

    try:
        return row[column]
    except (KeyError, IndexError, TypeError):
        return None


def make_market_key(header, column_position):
    """
    Her market için JSON alanı oluşturur.
    Aynı başlık birden fazla kez bulunursa alan adını benzersiz yapar.
    """
    normalized = normalize_header(header)

    aliases = {
        "1": "ms1",
        "0": "msX",
        "2": "ms2",
        "H12": "h12",
        "H0": "h0",
        "H23": "h23",
        "I14": "i14",
        "OLMAZ": "olmaz",
        "I25": "i25",
        "1VEALT": "ms1Alt",
        "0VEALT": "msXAlt",
        "2VEALT": "ms2Alt",
        "1VEUST": "ms1Ust",
        "0VEUST": "msXUst",
        "2VEUST": "ms2Ust",
        "2,5 A": "au25Alt",
        "2,5 U": "au25Ust",
        "3,5 A": "au35Alt",
        "3,5 U": "au35Ust",
        "VAR": "kgVar",
        "YOK": "kgYok",
        "0-1": "gol01",
        "2-3": "gol23",
        "4-5": "gol45",
        "6+": "gol6plus",
        "IY 1": "iy1",
        "IY 0": "iyX",
        "IY 2": "iy2",
        "IY 1,5 A": "iy15Alt",
        "IY 1,5 U": "iy15Ust",
        "1/1": "iyms11",
        "1/0": "iyms10",
        "1/2": "iyms12",
        "0/1": "iyms01",
        "0/0": "iyms00",
        "0/2": "iyms02",
        "2/1": "iyms21",
        "2/0": "iyms20",
        "2/2": "iyms22",
    }

    if normalized in aliases:
        return aliases[normalized]

    # Genel market başlıkları için güvenli alan adı.
    key = normalized.lower()
    key = key.replace(",", "_")
    key = key.replace(".", "_")
    key = key.replace("/", "_")
    key = key.replace("+", "plus")
    key = re.sub(r"[^a-z0-9]+", "_", key)
    key = key.strip("_")

    if not key:
        key = f"market_{column_position}"

    if key[0].isdigit():
        key = "market_" + key

    return key


# =========================================================
# EXCEL'İ OKU VE BAŞLIK SATIRINI BUL
# =========================================================

def load_excel():
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(
            f"Excel dosyası bulunamadı: {INPUT_FILE}"
        )

    raw = pd.read_excel(
        INPUT_FILE,
        sheet_name=SHEET_NAME,
        header=None
    )

    header_row = None

    for index, row in raw.iterrows():
        values = {
            normalize_header(value)
            for value in row.tolist()
            if not is_empty(value)
        }

        if (
            "TARIH" in values
            and "EV SAHIBI" in values
            and "DEPLASMAN" in values
        ):
            header_row = index
            break

    if header_row is None:
        raise RuntimeError(
            "Excel içinde TARİH, EV SAHİBİ ve DEPLASMAN "
            "başlıklarını içeren satır bulunamadı."
        )

    print(f"Başlık satırı: {header_row + 1}")

    df = pd.read_excel(
        INPUT_FILE,
        sheet_name=SHEET_NAME,
        header=header_row
    )

    df = df.dropna(how="all").reset_index(drop=True)

    return df


# =========================================================
# MAÇ BİLGİLERİNİ BUL
# =========================================================

def prepare_columns(df):
    columns = {}

    columns["date"] = find_column(
        df, ["TARİH", "DATE"]
    )
    columns["league"] = find_column(
        df, ["LİG", "LIG", "LEAGUE"]
    )
    columns["time"] = find_column(
        df, ["SAAT", "TIME"]
    )
    columns["home"] = find_column(
        df, ["EV SAHİBİ", "EVSAHİBİ", "HOME", "HOME TEAM"]
    )
    columns["away"] = find_column(
        df, ["DEPLASMAN", "AWAY", "AWAY TEAM"]
    )
    columns["half_score"] = find_column(
        df, ["SKOR İY", "SKOR IY", "İY SKOR", "IY SKOR"]
    )
    columns["full_score"] = find_column(
        df, ["SKOR MS", "MS SKOR", "SKOR"]
    )

    required = ["date", "home", "away"]

    missing = [
        key for key in required
        if columns[key] is None
    ]

    if missing:
        raise RuntimeError(
            "Zorunlu Excel sütunları bulunamadı: "
            + ", ".join(missing)
        )

    return columns


# =========================================================
# TÜM MARKET SÜTUNLARINI OTOMATİK BUL
# =========================================================

def prepare_markets(df, columns):
    """
    DEPLASMAN sütunundan sonraki tüm sütunları market
    sütunları olarak aktarır.

    Bu yöntem sabit market listesine bağlı değildir.
    Excel'e yeni market sütunu eklendiğinde de aktarılır.
    """
    away_index = list(df.columns).index(columns["away"])

    market_columns = []
    used_keys = set()

    for position in range(away_index + 1, len(df.columns)):
        header = df.columns[position]
        header_text = clean_text(header)

        if not header_text:
            continue

        key = make_market_key(header_text, position + 1)

        # Başlıklar tekrar ederse veriyi ezme.
        if key in used_keys:
            key = f"{key}_{position + 1}"

        used_keys.add(key)

        market_columns.append({
            "column": header,
            "position": position + 1,
            "name": header_text,
            "key": key,
        })

    return market_columns


# =========================================================
# MAÇI JSON'A ÇEVİR
# =========================================================

def build_match(row, columns, market_columns):
    date_value = format_date(
        get_value(row, columns["date"])
    )
    league_value = clean_text(
        get_value(row, columns["league"])
    )
    time_value = format_time(
        get_value(row, columns["time"])
    )
    home_value = clean_text(
        get_value(row, columns["home"])
    )
    away_value = clean_text(
        get_value(row, columns["away"])
    )
    half_score = clean_score(
        get_value(row, columns["half_score"])
    )
    full_score = clean_score(
        get_value(row, columns["full_score"])
    )

    match = {
        "date": date_value,
        "league": league_value,
        "time": time_value,
        "home": home_value,
        "away": away_value,
        "score": full_score,
        "halfTimeScore": half_score,

        # Bütün marketler bu nesnede saklanır.
        "odds": {},

        # Orijinal Excel başlıkları da kaybolmaz.
        "marketOdds": {},
    }

    for market in market_columns:
        value = clean_odd(
            get_value(row, market["column"])
        )

        key = market["key"]
        original_name = market["name"]

        match["odds"][key] = value
        match["marketOdds"][original_name] = value

        # Eski RNA sürümünün kullandığı alanlar korunur.
        match[key] = value

    return match


# =========================================================
# GEÇERLİ MAÇ KONTROLÜ
# =========================================================

def valid_match(match):
    return bool(
        match.get("date")
        and match.get("home")
        and match.get("away")
    )


# =========================================================
# ANA İŞLEM
# =========================================================

def main():
    print("=" * 60)
    print("TÜM MARKETLERİ AKTARAN EXCEL → JSON DÖNÜŞTÜRÜCÜ")
    print("=" * 60)

    df = load_excel()

    print(f"Excel satır sayısı: {len(df)}")

    columns = prepare_columns(df)
    market_columns = prepare_markets(df, columns)

    print(f"Bulunan market sütunu: {len(market_columns)}")

    print("\nMarket eşleştirmeleri:")

    for market in market_columns:
        print(
            f"  Excel {market['position']:>2} | "
            f"{market['name']:<24} -> {market['key']}"
        )

    matches = []

    for _, row in df.iterrows():
        match = build_match(
            row,
            columns,
            market_columns
        )

        if valid_match(match):
            matches.append(match)

    # Aynı maçın tekrar eden kayıtlarını temizle.
    unique = []
    seen = set()

    for match in matches:
        key = (
            match["date"],
            match["time"],
            match["home"].strip().upper(),
            match["away"].strip().upper()
        )

        if key in seen:
            continue

        seen.add(key)
        unique.append(match)

    matches = unique

    # Tarih ve saat sıralaması.
    matches.sort(
        key=lambda item: (
            item.get("date", ""),
            item.get("time", ""),
            item.get("home", "")
        )
    )

    # Market bazında dolu oran sayıları.
    market_stats = []

    for market in market_columns:
        count = sum(
            1
            for match in matches
            if match["odds"].get(market["key"]) is not None
        )

        market_stats.append({
            "key": market["key"],
            "name": market["name"],
            "excelColumn": market["position"],
            "availableOdds": count,
        })

    os.makedirs(
        os.path.dirname(OUTPUT_FILE) or ".",
        exist_ok=True
    )

    output = {
        "source": os.path.basename(INPUT_FILE),
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "count": len(matches),
        "marketCount": len(market_columns),
        "markets": market_stats,
        "matches": matches,
    }

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
            allow_nan=False
        )

    print("\n" + "=" * 60)
    print("DÖNÜŞÜM TAMAMLANDI")
    print("=" * 60)
    print(f"JSON kayıt sayısı : {len(matches)}")
    print(f"Market sayısı     : {len(market_columns)}")
    print(f"Çıkış dosyası     : {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
