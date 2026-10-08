import json
import math
import os
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
def clean_text(value):
    """Excel hücresini temiz metne çevirir."""
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value).strip()
    if text.lower() in ("nan", "none", "nat"):
        return ""
    return text
def clean_odd(value):
    """
    Oranı güvenli şekilde sayıya çevirir.
    Örnek:
        1,83 -> 1.83
        2,50 -> 2.50
        boş -> None
    """
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace(",", ".")
    try:
        number = float(text)
    except (ValueError, TypeError):
        return None
    if not math.isfinite(number):
        return None
    # 1.00 ve altındaki değerleri oran olarak kabul etmiyoruz.
    if number <= 1.00:
        return None
    return round(number, 2)
def format_date(value):
    """Excel tarihini GG.AA.YYYY formatına çevirir."""
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    try:
        date = pd.to_datetime(value, errors="coerce")
        if pd.isna(date):
            return ""
        return date.strftime("%d.%m.%Y")
    except Exception:
        return clean_text(value)
def format_time(value):
    """Excel saatini HH:MM formatına çevirir."""
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    # Pandas Timestamp / datetime / time
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%H:%M")
        except Exception:
            pass
    text = clean_text(value)
    if not text:
        return ""
    # 00:30:00 -> 00:30
    if len(text) >= 5 and ":" in text:
        parts = text.split(":")
        if len(parts) >= 2:
            return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    return text
def clean_score(value):
    """
    Skoru Excel'den alıp standart hale getirir.
    Örnek:
        1 - 1 -> 1-1
        0 - 0 -> 0-0
    """
    text = clean_text(value)
    if not text:
        return None
    text = text.replace("–", "-")
    text = text.replace("—", "-")
    text = text.replace(":", "-")
    text = text.replace(" ", "")
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
    """
    Excel sütununu büyük/küçük harf ve boşluk farklarını
    dikkate almadan bulur.
    """
    normalized = {}
    for column in df.columns:
        key = clean_text(column)
        key = key.replace(" ", "").lower()
        normalized[key] = column
    for name in possible_names:
        key = name.replace(" ", "").lower()
        if key in normalized:
            return normalized[key]
    return None
def get_value(row, column):
    """Satırdan güvenli değer alır."""
    if column is None:
        return None
    try:
        return row[column]
    except Exception:
        return None
# =========================================================
# EXCEL BAŞLIK SATIRINI BUL
# =========================================================
def load_excel():
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(
            f"Excel dosyası bulunamadı: {INPUT_FILE}"
        )
    # Önce ham olarak oku.
    raw = pd.read_excel(
        INPUT_FILE,
        sheet_name=SHEET_NAME,
        header=None
    )
    header_row = None
    # İçinde TARİH + EV SAHİBİ + DEPLASMAN olan satırı bul.
    for index, row in raw.iterrows():
        values = [
            clean_text(value).upper()
            for value in row.tolist()
        ]
        if (
            "TARİH" in values
            and "EV SAHİBİ" in values
            and "DEPLASMAN" in values
        ):
            header_row = index
            break
    if header_row is None:
        raise RuntimeError(
            "Excel içinde başlık satırı bulunamadı."
        )
    print(
        f"Excel başlık satırı bulundu: {header_row + 1}. satır"
    )
    df = pd.read_excel(
        INPUT_FILE,
        sheet_name=SHEET_NAME,
        header=header_row
    )
    # Tamamen boş satırları kaldır.
    df = df.dropna(
        how="all"
    ).reset_index(
        drop=True
    )
    return df
# =========================================================
# SÜTUNLARI BUL
# =========================================================
def prepare_columns(df):
    columns = {}
    columns["date"] = find_column(
        df,
        ["TARİH", "Tarih", "DATE"]
    )
    columns["league"] = find_column(
        df,
        ["LİG", "LIG", "Lig", "LEAGUE"]
    )
    columns["time"] = find_column(
        df,
        ["SAAT", "Saat", "TIME"]
    )
    columns["home"] = find_column(
        df,
        ["EV SAHİBİ", "EVSAHİBİ", "HOME", "HOME TEAM"]
    )
    columns["away"] = find_column(
        df,
        ["DEPLASMAN", "AWAY", "AWAY TEAM"]
    )
    columns["half_score"] = find_column(
        df,
        ["SKOR İY", "SKOR IY", "İY SKOR", "IY SKOR"]
    )
    columns["full_score"] = find_column(
        df,
        ["SKOR MS", "MS SKOR", "SKOR"]
    )
    # -----------------------------------------------------
    # V2 SOURCE MARKETLERİ
    # -----------------------------------------------------
    columns["iy15Ust"] = find_column(
        df,
        [
            "İY 1.5 Ü",
            "İY 1,5 Ü",
            "İY 1.5 ÜST",
            "İY 1,5 ÜST"
        ]
    )
    columns["iy1"] = find_column(
        df,
        [
            "İY 1",
            "IY 1"
        ]
    )
    columns["iy2"] = find_column(
        df,
        [
            "İY 2",
            "IY 2"
        ]
    )
    columns["au15Alt"] = find_column(
        df,
        [
            "MS 1.5",
            "MS 1,5",
            "1,5 A",
            "1.5 A"
        ]
    )
    columns["au15Ust"] = find_column(
        df,
        [
            "MS 1.5",
            "MS 1,5",
            "1,5 Ü",
            "1.5 Ü"
        ]
    )
    # -----------------------------------------------------
    # V2 TARGET MARKETLERİ
    # -----------------------------------------------------
    columns["iy15Alt"] = find_column(
        df,
        [
            "İY 1,5 A",
            "İY 1.5 A",
            "İY 1,5 ALT",
            "İY 1.5 ALT"
        ]
    )
    columns["kgVar"] = find_column(
        df,
        [
            "VAR",
            "KG VAR",
            "KGVAR"
        ]
    )
    columns["kgYok"] = find_column(
        df,
        [
            "YOK",
            "KG YOK",
            "KGYOK"
        ]
    )
    columns["iyKgVar"] = find_column(
        df,
        [
            "İY KG VAR",
            "İYKG VAR",
            "İY KG",
            "IY KG VAR"
        ]
    )
    columns["au25Ust"] = find_column(
        df,
        [
            "2,5 Ü",
            "2.5 Ü",
            "2,5 ÜST",
            "2.5 ÜST"
        ]
    )
    return columns
# =========================================================
# MAÇI JSON'A ÇEVİR
# =========================================================
def build_match(row, columns):
    date = format_date(
        get_value(row, columns["date"])
    )
    league = clean_text(
        get_value(row, columns["league"])
    )
    time = format_time(
        get_value(row, columns["time"])
    )
    home = clean_text(
        get_value(row, columns["home"])
    )
    away = clean_text(
        get_value(row, columns["away"])
    )
    half_score = clean_score(
        get_value(row, columns["half_score"])
    )
    full_score = clean_score(
        get_value(row, columns["full_score"])
    )
    match = {
        "date": date,
        "league": league,
        "time": time,
        "home": home,
        "away": away,
        "score": full_score,
        "halfTimeScore": half_score,
        # V2 SOURCE MARKETLERİ
        "iy15Ust": clean_odd(
            get_value(row, columns["iy15Ust"])
        ),
        "iy1": clean_odd(
            get_value(row, columns["iy1"])
        ),
        "iy2": clean_odd(
            get_value(row, columns["iy2"])
        ),
        "au15Alt": clean_odd(
            get_value(row, columns["au15Alt"])
        ),
        "au15Ust": clean_odd(
            get_value(row, columns["au15Ust"])
        ),
        # V2 TARGET MARKETLERİ
        "iy15Alt": clean_odd(
            get_value(row, columns["iy15Alt"])
        ),
        "kgVar": clean_odd(
            get_value(row, columns["kgVar"])
        ),
        "kgYok": clean_odd(
            get_value(row, columns["kgYok"])
        ),
        "iyKgVar": clean_odd(
            get_value(row, columns["iyKgVar"])
        ),
        "au25Ust": clean_odd(
            get_value(row, columns["au25Ust"])
        )
    }
    return match
# =========================================================
# GEÇERSİZ / BOŞ MAÇLARI TEMİZLE
# =========================================================
def valid_match(match):
    if not match["date"]:
        return False
    if not match["home"]:
        return False
    if not match["away"]:
        return False
    return True
# =========================================================
# ANA İŞLEM
# =========================================================
def main():
    print("=" * 60)
    print("V2 EXCEL → JSON DÖNÜŞTÜRÜCÜ")
    print("=" * 60)
    df = load_excel()
    print(
        f"Excel satır sayısı: {len(df)}"
    )
    columns = prepare_columns(df)
    print("\nBulunan sütunlar:")
    for key, value in columns.items():
        print(
            f"  {key:<15} -> {value}"
        )
    matches = []
    for _, row in df.iterrows():
        match = build_match(
            row,
            columns
        )
        if not valid_match(match):
            continue
        matches.append(match)
    # Aynı maçın tamamen tekrar eden kayıtlarını temizle.
    unique = []
    seen = set()
    for match in matches:
        key = (
            match["date"],
            match["time"],
            match["home"].upper(),
            match["away"].upper()
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(match)
    matches = unique
    # Tarih + saat sıralaması
    matches.sort(
        key=lambda item: (
            item.get("date", ""),
            item.get("time", ""),
            item.get("home", "")
        )
    )
    # Çıkış klasörünü oluştur.
    os.makedirs(
        os.path.dirname(OUTPUT_FILE),
        exist_ok=True
    )
    output = {
        "source": "acilis.xlsx",
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "count": len(matches),
        "matches": matches
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
            indent=2
        )
    print("\n" + "=" * 60)
    print("TAMAMLANDI")
    print("=" * 60)
    print(
        f"JSON kayıt sayısı : {len(matches)}"
    )
    print(
        f"Çıkış dosyası     : {OUTPUT_FILE}"
    )
    print("=" * 60)
if __name__ == "__main__":
    main()
