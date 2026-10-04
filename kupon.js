"use strict";

/* =========================================================
   MACKOLIK KUPON SİSTEMİ
   Temiz sürüm
========================================================= */

const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;
const MIN_SUCCESS = 70;

const MAX_COUPONS = 3;
const MAX_MATCHES = 5;

/*
   Eski kuponları kullanmamak için yeni anahtar.
*/
const STORAGE_KEY = "mackolik_coupon_v2";

/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];

let selectedDate = new Date();
let calendarDate = new Date();

/* =========================================================
   DOM
========================================================= */

const calendar = document.getElementById("calendar");
const monthTitle = document.getElementById("monthTitle");
const selectedDateBox = document.getElementById("selectedDate");
const couponList = document.getElementById("couponList");
const statistics = document.getElementById("statistics");

const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

/* =========================================================
   GENEL
========================================================= */

function pad(n) {
    return String(n).padStart(2, "0");
}

function dateKey(date) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function isToday(date) {
    return dateKey(date) === dateKey(new Date());
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   TARİH
========================================================= */

function parseDate(value) {

    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        if (isNaN(value.getTime())) {
            return null;
        }

        return new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate()
        );
    }

    const text = String(value).trim();

    let m = text.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    );

    if (m) {
        return new Date(
            Number(m[3]),
            Number(m[2]) - 1,
            Number(m[1])
        );
    }

    m = text.match(
        /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
    );

    if (m) {
        return new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3])
        );
    }

    const parsed = new Date(text);

    if (!isNaN(parsed.getTime())) {
        return new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
        );
    }

    return null;
}

/* =========================================================
   ALAN OKUMA
========================================================= */

function getValue(obj, keys) {

    if (!obj || typeof obj !== "object") {
        return undefined;
    }

    for (const key of keys) {

        if (
            obj[key] !== undefined &&
            obj[key] !== null &&
            obj[key] !== ""
        ) {
            return obj[key];
        }
    }

    return undefined;
}

/* =========================================================
   MAÇ ALANLARI
========================================================= */

function getDate(match) {
    return getValue(match, [
        "date",
        "Date",
        "tarih",
        "Tarih",
        "matchDate",
        "match_date"
    ]);
}

function getHome(match) {
    return getValue(match, [
        "home",
        "Home",
        "homeTeam",
        "home_team",
        "ev",
        "Ev",
        "evSahibi"
    ]) || "-";
}

function getAway(match) {
    return getValue(match, [
        "away",
        "Away",
        "awayTeam",
        "away_team",
        "deplasman",
        "Deplasman"
    ]) || "-";
}

function getTime(match) {
    return getValue(match, [
        "time",
        "Time",
        "saat",
        "Saat",
        "matchTime"
    ]) || "";
}

function getLeague(match) {
    return getValue(match, [
        "league",
        "League",
        "lig",
        "Lig",
        "competition",
        "tournament"
    ]) || "";
}

/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {

    if (!value) {
        return null;
    }

    if (typeof value === "object") {

        const h = getValue(value, [
            "home",
            "Home",
            "ev",
            "h"
        ]);

        const a = getValue(value, [
            "away",
            "Away",
            "deplasman",
            "a"
        ]);

        if (
            h !== undefined &&
            a !== undefined
        ) {

            const home = Number(h);
            const away = Number(a);

            if (
                Number.isFinite(home) &&
                Number.isFinite(away)
            ) {
                return {
                    home,
                    away
                };
            }
        }
    }

    const text = String(value).trim();

    const m = text.match(
        /(\d+)\s*[-:]\s*(\d+)/
    );

    if (!m) {
        return null;
    }

    return {
        home: Number(m[1]),
        away: Number(m[2])
    };
}

function getFullTimeScore(match) {

    const value = getValue(match, [
        "score",
        "Score",
        "fullTimeScore",
        "fulltimeScore",
        "ftScore",
        "ft",
        "FT",
        "fullTime",
        "FullTime",
        "ms",
        "MS",
        "macSonucu",
        "MaçSonucu"
    ]);

    return parseScore(value);
}

function getHalfTimeScore(match) {

    const value = getValue(match, [
        "halfTimeScore",
        "halftimeScore",
        "half_score",
        "htScore",
        "HTScore",
        "ht",
        "HT",
        "halfTime",
        "half",
        "iy",
        "IY",
        "ilkYari"
    ]);

    return parseScore(value);
}

function isPlayed(match) {
    return !!getFullTimeScore(match);
}

/* =========================================================
   ORANLAR
========================================================= */

function normalizeOdd(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const n = Number(
        String(value)
            .replace(",", ".")
            .trim()
    );

    if (!Number.isFinite(n)) {
        return null;
    }

    if (n <= 1) {
        return null;
    }

    return n.toFixed(2);
}

function getOdds(match, keys) {

    const direct = getValue(match, keys);

    if (direct !== undefined) {
        return normalizeOdd(direct);
    }

    const containers = [
        match.openingOdds,
        match.opening_odds,
        match.opening,
        match.odds,
        match.Odds,
        match.oranlar,
        match.Oranlar
    ];

    for (const container of containers) {

        if (!container) {
            continue;
        }

        const value = getValue(
            container,
            keys
        );

        if (value !== undefined) {
            return normalizeOdd(value);
        }
    }

    return null;
}

/* =========================================================
   MARKETLER

   ÖNEMLİ:
   İY 0.5 ÜST KALDIRILDI.
========================================================= */

const MARKETS = [

    {
        id: "MS1",
        title: "MS 1",
        odds: m => getOdds(m, [
            "ms1",
            "MS1",
            "1",
            "MS_1"
        ])
    },

    {
        id: "MSX",
        title: "MS X",
        odds: m => getOdds(m, [
            "msX",
            "msx",
            "MSX",
            "ms0",
            "MS0",
            "X"
        ])
    },

    {
        id: "MS2",
        title: "MS 2",
        odds: m => getOdds(m, [
            "ms2",
            "MS2",
            "2",
            "MS_2"
        ])
    },

    {
        id: "IY1",
        title: "İY 1",
        odds: m => getOdds(m, [
            "iy1",
            "IY1",
            "İY1",
            "iy_1"
        ])
    },

    {
        id: "IY2",
        title: "İY 2",
        odds: m => getOdds(m, [
            "iy2",
            "IY2",
            "İY2",
            "iy_2"
        ])
    },

    {
        id: "IY15U",
        title: "İY 1.5 Üst",
        odds: m => getOdds(m, [
            "iy15U",
            "IY15U",
            "iy15u",
            "iy1_5U",
            "iy1_5Over",
            "iy15Over",
            "IY1.5U",
            "İY1.5Ü",
            "iy1.5ust",
            "iy15ust",
            "iy1.5üst",
            "iy15üst"
        ])
    },

    {
        id: "IY15A",
        title: "İY 1.5 Alt",
        odds: m => getOdds(m, [
            "iy15A",
            "IY15A",
            "iy15a",
            "iy1_5A",
            "iy1_5Under",
            "iy15Under",
            "IY1.5A",
            "İY1.5A",
            "iy1.5alt",
            "iy15alt",
            "iy1.5alt"
        ])
    },

    {
        id: "MS25U",
        title: "2.5 Üst",
        odds: m => getOdds(m, [
            "ms25U",
            "MS25U",
            "ms25u",
            "ms2_5U",
            "ms2_5Over",
            "ms25Over",
            "MS2.5U",
            "2.5U",
            "2_5U",
            "25U",
            "25ust",
            "25üst",
            "2.5ust",
            "2.5üst",
            "au25Ust",
            "au25üst"
        ])
    },

    {
        id: "MS15U",
        title: "1.5 Üst",
        odds: m => getOdds(m, [
            "ms15U",
            "MS15U",
            "ms15u",
            "ms1_5U",
            "ms1_5Over",
            "ms15Over",
            "1.5U",
            "15U",
            "15ust",
            "15üst",
            "au15Ust",
            "au15üst"
        ])
    },

    {
        id: "MS15A",
        title: "1.5 Alt",
        odds: m => getOdds(m, [
            "ms15A",
            "MS15A",
            "ms15a",
            "ms1_5A",
            "ms1_5Under",
            "ms15Under",
            "1.5A",
            "15A",
            "15alt",
            "au15Alt"
        ])
    },

    {
        id: "KG",
        title: "KG Var",
        odds: m => getOdds(m, [
            "kg",
            "KG",
            "kgVar",
            "KGVar",
            "kgvar",
            "kg1",
            "KG1",
            "kgVar"
        ])
    },

    {
        id: "KGY",
        title: "KG Yok",
        odds: m => getOdds(m, [
            "kgy",
            "KGY",
            "kgYok",
            "KGYok",
            "kgyok",
            "kg0",
            "KG0",
            "kgYok"
        ])
    }

];

/* =========================================================
   MARKET SONUCU
========================================================= */

function getMarketOutcome(match, marketId) {

    const full = getFullTimeScore(match);
    const half = getHalfTimeScore(match);

    /* MS */

    if (
        marketId === "MS1" ||
        marketId === "MSX" ||
        marketId === "MS2"
    ) {

        if (!full) {
            return null;
        }

        if (marketId === "MS1") {
            return full.home > full.away;
        }

        if (marketId === "MSX") {
            return full.home === full.away;
        }

        return full.away > full.home;
    }

    /* İY */

    if (
        marketId === "IY1" ||
        marketId === "IY2" ||
        marketId === "IY15U" ||
        marketId === "IY15A"
    ) {

        if (!half) {
            return null;
        }

        if (marketId === "IY1") {
            return half.home > half.away;
        }

        if (marketId === "IY2") {
            return half.away > half.home;
        }

        const total =
            half.home + half.away;

        if (marketId === "IY15U") {
            return total >= 2;
        }

        if (marketId === "IY15A") {
            return total < 2;
        }
    }

    /* MS 2.5 ÜST */

    if (marketId === "MS25U") {

        if (!full) {
            return null;
        }

        return (
            full.home +
            full.away
        ) >= 3;
    }

    /* MS 1.5 ÜST */

    if (marketId === "MS15U") {

        if (!full) {
            return null;
        }

        return (
            full.home +
            full.away
        ) >= 2;
    }

    /* MS 1.5 ALT */

    if (marketId === "MS15A") {

        if (!full) {
            return null;
        }

        return (
            full.home +
            full.away
        ) < 2;
    }

    /* KG */

    if (
        marketId === "KG" ||
        marketId === "KGY"
    ) {

        if (!full) {
            return null;
        }

        const both =
            full.home > 0 &&
            full.away > 0;

        if (marketId === "KG") {
            return both;
        }

        return !both;
    }

    return null;
}

/* =========================================================
   GEÇMİŞ
========================================================= */

function getHistoryMatches(targetDate) {

    const end = new Date(targetDate);

    end.setHours(
        0,
        0,
        0,
        0
    );

    const start =
        addDays(
            end,
            -HISTORY_DAYS
        );

    return allMatches.filter(match => {

        const d =
            parseDate(
                getDate(match)
            );

        if (!d) {
            return false;
        }

        d.setHours(
            0,
            0,
            0,
            0
        );

        return (
            d >= start &&
            d < end &&
            isPlayed(match)
        );

    });
}

/* =========================================================
   TEK MARKET ANALİZİ

   Artık source -> target çaprazlaması yok.

   Örneğin:
   Bugünkü MS 2 oranı 2.10 ise
   geçmiş 60 günde MS 2 oranı 2.10 olan
   maçlara bakılır.

   Bunların MS 2 sonucu kaç tanesinde tuttuğu
   hesaplanır.
========================================================= */

function analyzeMarket(
    match,
    market,
    history
) {

    const currentOdd =
        market.odds(match);

    if (!currentOdd) {
        return null;
    }

    const historical =
        history.filter(item => {

            const odd =
                market.odds(item);

            return (
                odd &&
                odd === currentOdd
            );

        });

    if (
        historical.length <
        MIN_SAMPLE
    ) {
        return null;
    }

    let total = 0;
    let success = 0;

    for (const item of historical) {

        const result =
            getMarketOutcome(
                item,
                market.id
            );

        if (result === null) {
            continue;
        }

        total++;

        if (result === true) {
            success++;
        }
    }

    if (total < MIN_SAMPLE) {
        return null;
    }

    const percentage =
        (success / total) * 100;

    if (
        percentage <
        MIN_SUCCESS
    ) {
        return null;
    }

    return {

        marketId:
            market.id,

        marketTitle:
            market.title,

        odds:
            Number(currentOdd),

        sample:
            total,

        success,

        percentage

    };
}

/* =========================================================
   MAÇ TAHMİNLERİ
========================================================= */

function getMatchPredictions(
    match,
    targetDate,
    history
) {

    const predictions = [];

    for (const market of MARKETS) {

        const result =
            analyzeMarket(
                match,
                market,
                history
            );

        if (!result) {
            continue;
        }

        predictions.push(result);
    }

    /*
       Önce başarı yüzdesi,
       sonra örneklem,
       sonra oran.
    */

    predictions.sort((a, b) => {

        if (
            b.percentage !==
            a.percentage
        ) {
            return (
                b.percentage -
                a.percentage
            );
        }

        if (
            b.sample !==
            a.sample
        ) {
            return (
                b.sample -
                a.sample
            );
        }

        return b.odds - a.odds;

    });

    return predictions;
}

/* =========================================================
   MAÇ ANAHTARI
========================================================= */

function matchKey(match) {

    const d =
        parseDate(
            getDate(match)
        );

    return [
        d ? dateKey(d) : "",
        getTime(match),
        getHome(match),
        getAway(match)
    ]
        .join("|")
        .toLowerCase();

}

/* =========================================================
   BUGÜNÜN ADAYLARI
========================================================= */

function getCandidates(targetDate) {

    const key =
        dateKey(targetDate);

    const history =
        getHistoryMatches(
            targetDate
        );

    const matches =
        allMatches.filter(match => {

            const d =
                parseDate(
                    getDate(match)
                );

            if (!d) {
                return false;
            }

            return (
                dateKey(d) === key
            );
        });

    const candidates = [];

    for (const match of matches) {

        /*
           Oynanmış maçı kupona alma.
        */

        if (isPlayed(match)) {
            continue;
        }

        const predictions =
            getMatchPredictions(
                match,
                targetDate,
                history
            );

        /*
           Tahmin yoksa maç tamamen
           gizlenir.
        */

        if (!predictions.length) {
            continue;
        }

        const best =
            predictions[0];

        candidates.push({

            key:
                matchKey(match),

            match,

            prediction:
                best,

            allPredictions:
                predictions

        });

    }

    /*
       En güçlü maçları öne çıkar.
    */

    candidates.sort((a, b) => {

        const pa =
            a.prediction;

        const pb =
            b.prediction;

        if (
            pb.percentage !==
            pa.percentage
        ) {
            return (
                pb.percentage -
                pa.percentage
            );
        }

        if (
            pb.sample !==
            pa.sample
        ) {
            return (
                pb.sample -
                pa.sample
            );
        }

        return (
            pb.odds -
            pa.odds
        );

    });

    return candidates;
}

/* =========================================================
   KUPON OLUŞTUR
========================================================= */

function createCoupons(targetDate) {

    const candidates =
        getCandidates(
            targetDate
        );

    const coupons = [];

    /*
       Hiç aday yok.
    */

    if (!candidates.length) {
        return [];
    }

    /*
       Her kupon mümkün olduğunca
       farklı maçlardan oluşur.
    */

    const used =
        new Set();

    for (
        let number = 1;
        number <= MAX_COUPONS;
        number++
    ) {

        const selections = [];

        let totalOdds = 1;

        /*
           Önce kullanılmamış adayları al.
        */

        for (const candidate of candidates) {

            if (
                used.has(
                    candidate.key
                )
            ) {
                continue;
            }

            if (
                selections.length >=
                MAX_MATCHES
            ) {
                break;
            }

            const p =
                candidate.prediction;

            selections.push({

                key:
                    candidate.key,

                home:
                    getHome(
                        candidate.match
                    ),

                away:
                    getAway(
                        candidate.match
                    ),

                time:
                    getTime(
                        candidate.match
                    ),

                league:
                    getLeague(
                        candidate.match
                    ),

                targetMarket:
                    p.marketId,

                targetTitle:
                    p.marketTitle,

                targetOdds:
                    p.odds,

                sample:
                    p.sample,

                success:
                    p.success,

                percentage:
                    p.percentage

            });

            totalOdds *=
                p.odds;

        }

        /*
           En az bir maç varsa kupon oluştur.
        */

        if (!selections.length) {
            break;
        }

        /*
           Bu kupondaki maçları
           sonraki kuponlardan çıkar.
        */

        selections.forEach(s => {
            used.add(s.key);
        });

        coupons.push({

            number,

            date:
                dateKey(
                    targetDate
                ),

            totalOdds:
                Number(
                    totalOdds.toFixed(2)
                ),

            selections

        });

        /*
           Başka aday kalmadıysa bitir.
        */

        if (
            used.size >=
            candidates.length
        ) {
            break;
        }
    }

    return coupons;
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                STORAGE_KEY
            ) || "{}"
        );

    } catch {

        return {};

    }
}

function saveCoupons(
    date,
    coupons
) {

    const history =
        getHistory();

    history[date] =
        coupons;

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                history
            )
        );

    } catch {

        // sorun olursa sistemi durdurma

    }
}

function getSavedCoupons(date) {

    const history =
        getHistory();

    const value =
        history[date];

    return Array.isArray(value)
        ? value
        : [];
}

/* =========================================================
   KUPON GETİR
========================================================= */

function getCouponsForDate(date) {

    const key =
        dateKey(date);

    /*
       BUGÜN:
       Her açılışta yeniden hesapla.
       Böylece yeni oranlar geldiğinde
       kupon güncellenir.
    */

    if (isToday(date)) {

        const coupons =
            createCoupons(
                date
            );

        saveCoupons(
            key,
            coupons
        );

        return coupons;
    }

    /*
       Geçmiş tarih:
       varsa kaydedilmiş kuponu göster.
    */

    return getSavedCoupons(
        key
    );
}

/* =========================================================
   KUPON SONUCU
========================================================= */

function couponResult(coupon) {

    if (
        !coupon ||
        !Array.isArray(
            coupon.selections
        ) ||
        !coupon.selections.length
    ) {
        return "pending";
    }

    let pending = false;

    for (
        const selection
        of coupon.selections
    ) {

        const match =
            allMatches.find(
                item =>
                    matchKey(item) ===
                    selection.key
            );

        if (!match) {
            pending = true;
            continue;
        }

        const result =
            getMarketOutcome(
                match,
                selection.targetMarket
            );

        if (result === false) {
            return "loss";
        }

        if (result === null) {
            pending = true;
        }
    }

    if (pending) {
        return "pending";
    }

    return "win";
}

/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

    if (
        !calendar ||
        !monthTitle
    ) {
        return;
    }

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();

    monthTitle.textContent =
        new Date(
            year,
            month,
            1
        ).toLocaleDateString(
            "tr-TR",
            {
                month: "long",
                year: "numeric"
            }
        );

    calendar.innerHTML = "";

    const firstDay =
        new Date(
            year,
            month,
            1
        );

    let startDay =
        firstDay.getDay();

    startDay =
        startDay === 0
            ? 6
            : startDay - 1;

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();

    /*
       Boş günler
    */

    for (
        let i = 0;
        i < startDay;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "calendar-day empty";

        calendar.appendChild(
            empty
        );
    }

    /*
       Günler
    */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const date =
            new Date(
                year,
                month,
                day
            );

        const key =
            dateKey(date);

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "calendar-day";

        button.textContent =
            day;

        if (
            dateKey(
                selectedDate
            ) === key
        ) {
            button.classList.add(
                "selected"
            );
        }

        const hasMatches =
            allMatches.some(match => {

                const d =
                    parseDate(
                        getDate(match)
                    );

                return (
                    d &&
                    dateKey(d) === key
                );

            });

        if (hasMatches) {

            button.classList.add(
                "has-data"
            );
        }

        button.addEventListener(
            "click",
            () => {

                selectedDate =
                    new Date(
                        date
                    );

                calendarDate =
                    new Date(
                        date
                    );

                renderCalendar();
                renderSelectedDate();

            }
        );

        calendar.appendChild(
            button
        );
    }
}

/* =========================================================
   TARİH
========================================================= */

function renderSelectedDate() {

    if (!selectedDateBox) {
        return;
    }

    const dateText =
        selectedDate.toLocaleDateString(
            "tr-TR",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );

    selectedDateBox.textContent =
        dateText;

    const coupons =
        getCouponsForDate(
            selectedDate
        );

    renderStatistics(
        coupons
    );

    renderCoupons(
        coupons
    );
}

/* =========================================================
   İSTATİSTİK
========================================================= */

function renderStatistics(
    selectedCoupons
) {

    if (!statistics) {
        return;
    }

    const history =
        getHistory();

    let total = 0;
    let win = 0;
    let loss = 0;
    let pending = 0;

    Object.values(history)
        .flat()
        .forEach(coupon => {

            total++;

            const result =
                couponResult(
                    coupon
                );

            if (
                result === "win"
            ) {
                win++;
            } else if (
                result === "loss"
            ) {
                loss++;
            } else {
                pending++;
            }

        });

    const finished =
        win + loss;

    const successRate =
        finished > 0
            ? (
                win /
                finished
            ) * 100
            : 0;

    statistics.innerHTML = `

        <div class="stat">

            <span class="stat-label">
                BUGÜN
            </span>

            <strong class="stat-value">
                ${selectedCoupons.length}
            </strong>

        </div>

        <div class="stat">

            <span class="stat-label">
                TOPLAM KUPON
            </span>

            <strong class="stat-value">
                ${total}
            </strong>

        </div>

        <div class="stat">

            <span class="stat-label">
                KAZANAN
            </span>

            <strong class="stat-value green">
                ${win}
            </strong>

        </div>

        <div class="stat">

            <span class="stat-label">
                BAŞARI
            </span>

            <strong class="stat-value">
                %${successRate.toFixed(1)}
            </strong>

        </div>

    `;
}

/* =========================================================
   KUPON GÖSTER
========================================================= */

function renderCoupons(coupons) {

    if (!couponList) {
        return;
    }

    couponList.innerHTML = "";

    if (!coupons.length) {

        /*
           Bugünün adaylarını kontrol edip
           neden kupon çıkmadığını söyle.
        */

        if (isToday(selectedDate)) {

            const candidates =
                getCandidates(
                    selectedDate
                );

            if (!candidates.length) {

                couponList.innerHTML = `

                    <div class="empty">

                        Bugün şartları sağlayan
                        yeterli tahmin bulunamadı.

                        <br><br>

                        Sistem;

                        <strong>
                        son ${HISTORY_DAYS} gün
                        </strong>

                        içindeki geçmiş maçları
                        inceliyor.

                        <br>

                        Minimum örneklem:
                        <strong>
                        ${MIN_SAMPLE}
                        </strong>

                        <br>

                        Minimum başarı:
                        <strong>
                        %${MIN_SUCCESS}
                        </strong>

                    </div>

                `;

                return;
            }
        }

        couponList.innerHTML = `

            <div class="empty">

                Bu tarih için kayıtlı kupon
                bulunamadı.

            </div>

        `;

        return;
    }

    coupons.forEach(coupon => {

        const result =
            couponResult(
                coupon
            );

        let statusText =
            "BEKLİYOR";

        let statusClass =
            "pending";

        if (
            result === "win"
        ) {

            statusText =
                "TUTTU";

            statusClass =
                "win";

        } else if (
            result === "loss"
        ) {

            statusText =
                "TUTMADI";

            statusClass =
                "loss";
        }

        let html = `

            <article class="coupon">

                <div class="coupon-header">

                    <span class="coupon-title">
                        Kupon ${coupon.number}
                    </span>

                    <span class="coupon-status ${statusClass}">
                        ${statusText}
                    </span>

                    <span class="coupon-odds">
                        ${Number(
                            coupon.totalOdds
                        ).toFixed(2)}
                    </span>

                </div>

        `;

        coupon.selections.forEach(
            selection => {

                html += `

                    <div class="coupon-match">

                        <div class="match-top">

                            <div class="teams">

                                ${escapeHtml(
                                    selection.home
                                )}

                                -

                                ${escapeHtml(
                                    selection.away
                                )}

                            </div>

                            <span class="match-time">

                                ${escapeHtml(
                                    selection.time
                                )}

                            </span>

                        </div>

                        <div class="pick">

                            <span class="pick-name">

                                ${escapeHtml(
                                    selection.targetTitle
                                )}

                            </span>

                            <span class="pick-odd">

                                ${Number(
                                    selection.targetOdds
                                ).toFixed(2)}

                            </span>

                            <span class="sample">

                                · ${selection.sample}
                                örneklem

                                ·

                                %${Number(
                                    selection.percentage
                                ).toFixed(1)}

                            </span>

                        </div>

                    </div>

                `;

            }
        );

        html += `

            </article>

        `;

        couponList.insertAdjacentHTML(
            "beforeend",
            html
        );

    });
}

/* =========================================================
   AY DEĞİŞTİR
========================================================= */

if (prevMonth) {

    prevMonth.addEventListener(
        "click",
        () => {

            calendarDate =
                new Date(
                    calendarDate
                );

            calendarDate.setDate(1);

            calendarDate.setMonth(
                calendarDate.getMonth() - 1
            );

            renderCalendar();

        }
    );
}

if (nextMonth) {

    nextMonth.addEventListener(
        "click",
        () => {

            calendarDate =
                new Date(
                    calendarDate
                );

            calendarDate.setDate(1);

            calendarDate.setMonth(
                calendarDate.getMonth() + 1
            );

            renderCalendar();

        }
    );
}

/* =========================================================
   VERİYİ YÜKLE
========================================================= */

async function loadData() {

    if (couponList) {

        couponList.innerHTML = `

            <div class="empty">

                Kupon verileri yükleniyor...

            </div>

        `;
    }

    try {

        const response =
            await fetch(
                DATA_URL +
                "?t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "Veri alınamadı: " +
                response.status
            );
        }

        const data =
            await response.json();

        if (
            Array.isArray(data)
        ) {

            allMatches = data;

        } else if (
            data &&
            Array.isArray(
                data.matches
            )
        ) {

            allMatches =
                data.matches;

        } else {

            throw new Error(
                "matches bulunamadı"
            );
        }

        /*
           Tarih başlangıçta bugün.
        */

        selectedDate =
            new Date();

        calendarDate =
            new Date();

        renderCalendar();
        renderSelectedDate();

    } catch (error) {

        console.error(
            "Kupon veri hatası:",
            error
        );

        if (couponList) {

            couponList.innerHTML = `

                <div class="empty">

                    Kupon verileri yüklenemedi.

                    <br><br>

                    <small>
                    ${escapeHtml(
                        error.message
                    )}
                    </small>

                </div>

            `;
        }
    }
}

/* =========================================================
   BAŞLAT
========================================================= */

loadData();
