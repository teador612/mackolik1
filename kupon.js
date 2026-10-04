"use strict";

/* =========================================================
   MACKOLIK KUPON SİSTEMİ
   ========================================================= */

const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;
const MIN_SUCCESS = 70;

const MIN_TOTAL_ODDS = 2.00;
const MAX_MATCHES = 5;
const MAX_COUPONS = 3;

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
   MARKETLER
   ========================================================= */

const MARKETS = [
    {
        id: "MS1",
        name: "MS 1",
        odds: ["ms1", "MS1"],
        result: "MS1"
    },
    {
        id: "MSX",
        name: "MS X",
        odds: ["msX", "msx", "MSX"],
        result: "MSX"
    },
    {
        id: "MS2",
        name: "MS 2",
        odds: ["ms2", "MS2"],
        result: "MS2"
    },

    {
        id: "IY1",
        name: "İY 1",
        odds: ["iy1", "IY1"],
        result: "IY1"
    },
    {
        id: "IY2",
        name: "İY 2",
        odds: ["iy2", "IY2"],
        result: "IY2"
    },

    {
        id: "IY15U",
        name: "İY 1.5 Üst",
        odds: [
            "iy15Ust",
            "iy15ust",
            "iy15U",
            "iy15u"
        ],
        result: "IY15U"
    },

    {
        id: "IY15A",
        name: "İY 1.5 Alt",
        odds: [
            "iy15Alt",
            "iy15alt",
            "iy15A",
            "iy15a"
        ],
        result: "IY15A"
    },

    {
        id: "MS25U",
        name: "2.5 Üst",
        odds: [
            "au25Ust",
            "au25ust",
            "au25U",
            "au25u"
        ],
        result: "MS25U"
    },

    {
        id: "MS15U",
        name: "1.5 Üst",
        odds: [
            "au15Ust",
            "au15ust",
            "au15U",
            "au15u"
        ],
        result: "MS15U"
    },

    {
        id: "MS15A",
        name: "1.5 Alt",
        odds: [
            "au15Alt",
            "au15alt",
            "au15A",
            "au15a"
        ],
        result: "MS15A"
    },

    {
        id: "KG",
        name: "KG Var",
        odds: [
            "kgVar",
            "kgvar",
            "KGVar",
            "kg"
        ],
        result: "KG"
    },

    {
        id: "KGY",
        name: "KG Yok",
        odds: [
            "kgYok",
            "kgyok",
            "KGYok",
            "kgy"
        ],
        result: "KGY"
    }
];

/* =========================================================
   YARDIMCI
   ========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function pad(n) {
    return String(n).padStart(2, "0");
}

function dateKey(date) {
    if (!(date instanceof Date)) {
        date = parseDate(date);
    }

    if (!date || isNaN(date.getTime())) {
        return "";
    }

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}

function cloneDate(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function addDays(date, days) {
    const d = cloneDate(date);
    d.setDate(d.getDate() + days);
    return d;
}

function isToday(date) {
    return dateKey(date) === dateKey(new Date());
}

/* =========================================================
   TARİH PARSE
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

    /* DD.MM.YYYY */
    let m = text.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    );

    if (m) {
        const d = new Date(
            Number(m[3]),
            Number(m[2]) - 1,
            Number(m[1])
        );

        if (!isNaN(d.getTime())) {
            return d;
        }
    }

    /* YYYY-MM-DD */
    m = text.match(
        /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/
    );

    if (m) {
        const d = new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3])
        );

        if (!isNaN(d.getTime())) {
            return d;
        }
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
   MAÇ ALANLARI
   ========================================================= */

function getValue(object, keys) {

    if (!object || typeof object !== "object") {
        return undefined;
    }

    for (const key of keys) {

        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ""
        ) {
            return object[key];
        }
    }

    return undefined;
}

function getDate(match) {

    return getValue(match, [
        "date",
        "Date",
        "tarih",
        "Tarih",
        "matchDate",
        "match_date",
        "gameDate",
        "startDate"
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
        "evSahibi",
        "home_name"
    ]) || "-";
}

function getAway(match) {

    return getValue(match, [
        "away",
        "Away",
        "awayTeam",
        "away_team",
        "deplasman",
        "Deplasman",
        "away_name"
    ]) || "-";
}

function getTime(match) {

    return getValue(match, [
        "time",
        "Time",
        "saat",
        "Saat",
        "matchTime",
        "kickoffTime"
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

function getMatchId(match) {

    return getValue(match, [
        "id",
        "matchId",
        "code",
        "fixtureId"
    ]) || (
        getHome(match) +
        "-" +
        getAway(match) +
        "-" +
        dateKey(parseDate(getDate(match)))
    );
}

/* =========================================================
   SKOR
   ========================================================= */

function parseScore(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    if (typeof value === "object") {

        const home = getValue(value, [
            "home",
            "Home",
            "ev",
            "h",
            "homeScore",
            "home_score"
        ]);

        const away = getValue(value, [
            "away",
            "Away",
            "deplasman",
            "a",
            "awayScore",
            "away_score"
        ]);

        const h = Number(home);
        const a = Number(away);

        if (
            Number.isFinite(h) &&
            Number.isFinite(a)
        ) {
            return {
                home: h,
                away: a
            };
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
        "half_time_score",
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

/* =========================================================
   OYNANMIŞ MI?
   ========================================================= */

function isPlayed(match) {

    const status = String(
        getValue(match, [
            "status",
            "state",
            "matchStatus"
        ]) || ""
    ).toLowerCase();

    if (
        status.includes("not_started") ||
        status.includes("not started") ||
        status.includes("scheduled") ||
        status.includes("upcoming") ||
        status.includes("bekliyor") ||
        status.includes("başlamadı")
    ) {
        return false;
    }

    return !!getFullTimeScore(match);
}

/* =========================================================
   ORAN
   ========================================================= */

function normalizeOdds(value) {

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

    return n;
}

function getOdd(match, market) {

    const direct = getValue(
        match,
        market.odds
    );

    if (direct !== undefined) {

        const n = normalizeOdds(direct);

        if (n !== null) {
            return n;
        }
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

        if (
            !container ||
            typeof container !== "object"
        ) {
            continue;
        }

        const value = getValue(
            container,
            market.odds
        );

        if (value !== undefined) {

            const n = normalizeOdds(value);

            if (n !== null) {
                return n;
            }
        }
    }

    return null;
}

/* =========================================================
   MARKET SONUCU
   ========================================================= */

function marketResult(match, marketId) {

    const ft = getFullTimeScore(match);
    const ht = getHalfTimeScore(match);

    switch (marketId) {

        case "MS1":
            if (!ft) return null;
            return ft.home > ft.away;

        case "MSX":
            if (!ft) return null;
            return ft.home === ft.away;

        case "MS2":
            if (!ft) return null;
            return ft.away > ft.home;

        case "IY1":
            if (!ht) return null;
            return ht.home > ht.away;

        case "IY2":
            if (!ht) return null;
            return ht.away > ht.home;

        case "IY15U":
            if (!ht) return null;
            return (
                ht.home + ht.away >= 2
            );

        case "IY15A":
            if (!ht) return null;
            return (
                ht.home + ht.away < 2
            );

        case "MS25U":
            if (!ft) return null;
            return (
                ft.home + ft.away >= 3
            );

        case "MS15U":
            if (!ft) return null;
            return (
                ft.home + ft.away >= 2
            );

        case "MS15A":
            if (!ft) return null;
            return (
                ft.home + ft.away < 2
            );

        case "KG":
            if (!ft) return null;
            return (
                ft.home > 0 &&
                ft.away > 0
            );

        case "KGY":
            if (!ft) return null;
            return !(
                ft.home > 0 &&
                ft.away > 0
            );

        default:
            return null;
    }
}

/* =========================================================
   GEÇMİŞ MAÇLAR
   ========================================================= */

function getHistoricalMatches(targetDate) {

    const target = parseDate(targetDate);

    if (!target) {
        return [];
    }

    return allMatches.filter(match => {

        const d = parseDate(
            getDate(match)
        );

        if (!d) {
            return false;
        }

        if (d >= target) {
            return false;
        }

        const diff =
            Math.abs(
                target.getTime() -
                d.getTime()
            ) / 86400000;

        if (diff > HISTORY_DAYS) {
            return false;
        }

        return isPlayed(match);
    });
}

/* =========================================================
   TARİHSEL ORAN ANALİZİ
   ========================================================= */

function analyzeMarket(
    targetMatch,
    market,
    targetDate
) {

    const targetOdd =
        getOdd(targetMatch, market);

    if (targetOdd === null) {
        return null;
    }

    const history =
        getHistoricalMatches(targetDate);

    let sample = 0;
    let wins = 0;

    for (const oldMatch of history) {

        const oldOdd =
            getOdd(oldMatch, market);

        if (oldOdd === null) {
            continue;
        }

        /*
         * BİREBİR ORAN
         * Tolerans yok.
         */

        if (oldOdd !== targetOdd) {
            continue;
        }

        const result =
            marketResult(
                oldMatch,
                market.id
            );

        if (result === null) {
            continue;
        }

        sample++;

        if (result === true) {
            wins++;
        }
    }

    if (sample < MIN_SAMPLE) {
        return null;
    }

    const percentage =
        (wins / sample) * 100;

    if (percentage < MIN_SUCCESS) {
        return null;
    }

    return {
        market: market.id,
        name: market.name,
        odd: targetOdd,
        sample,
        wins,
        percentage
    };
}

/* =========================================================
   MAÇ TAHMİNLERİ
   ========================================================= */

function getPredictions(
    match,
    targetDate
) {

    const predictions = [];

    for (const market of MARKETS) {

        const result =
            analyzeMarket(
                match,
                market,
                targetDate
            );

        if (result) {
            predictions.push(result);
        }
    }

    return predictions;
}

/* =========================================================
   SEÇİLİ TARİH MAÇLARI
   ========================================================= */

function getMatchesForDate(date) {

    const key = dateKey(
        parseDate(date)
    );

    return allMatches.filter(match => {

        const d = parseDate(
            getDate(match)
        );

        return (
            d &&
            dateKey(d) === key
        );
    });
}

/* =========================================================
   ADAY MAÇLAR
   ========================================================= */

function getCandidates(date) {

    const matches =
        getMatchesForDate(date);

    const result = [];

    for (const match of matches) {

        const predictions =
            getPredictions(
                match,
                date
            );

        if (!predictions.length) {
            continue;
        }

        result.push({
            match,
            predictions
        });
    }

    return result;
}

/* =========================================================
   TAHMİN SIRALAMA
   ========================================================= */

function bestPrediction(
    predictions,
    type
) {

    if (!predictions.length) {
        return null;
    }

    const list = [...predictions];

    if (type === "safe") {

        list.sort((a, b) => {

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

            return a.odd - b.odd;
        });
    }

    else if (type === "medium") {

        list.sort((a, b) => {

            const scoreA =
                a.percentage * 0.70 +
                Math.min(a.odd, 3) * 10;

            const scoreB =
                b.percentage * 0.70 +
                Math.min(b.odd, 3) * 10;

            return scoreB - scoreA;
        });
    }

    else {

        list.sort((a, b) => {

            if (b.odd !== a.odd) {
                return b.odd - a.odd;
            }

            return (
                b.percentage -
                a.percentage
            );
        });
    }

    return list[0];
}

/* =========================================================
   KUPON OLUŞTUR
   ========================================================= */

function buildCoupon(
    candidates,
    type,
    blockedIds = new Set()
) {

    const list = candidates
        .filter(item => {
            return !blockedIds.has(
                String(
                    getMatchId(
                        item.match
                    )
                )
            );
        })
        .map(item => {

            return {
                match: item.match,
                prediction:
                    bestPrediction(
                        item.predictions,
                        type
                    )
            };

        })
        .filter(item => item.prediction);

    if (!list.length) {
        return null;
    }

    /*
     * Sıralama
     */

    if (type === "safe") {

        list.sort((a, b) => {

            if (
                b.prediction.percentage !==
                a.prediction.percentage
            ) {
                return (
                    b.prediction.percentage -
                    a.prediction.percentage
                );
            }

            return (
                b.prediction.sample -
                a.prediction.sample
            );
        });

    } else if (type === "medium") {

        list.sort((a, b) => {

            const sa =
                a.prediction.percentage *
                    0.70 +
                Math.min(
                    a.prediction.odd,
                    3
                ) * 10;

            const sb =
                b.prediction.percentage *
                    0.70 +
                Math.min(
                    b.prediction.odd,
                    3
                ) * 10;

            return sb - sa;
        });

    } else {

        list.sort((a, b) => {

            if (
                b.prediction.odd !==
                a.prediction.odd
            ) {
                return (
                    b.prediction.odd -
                    a.prediction.odd
                );
            }

            return (
                b.prediction.percentage -
                a.prediction.percentage
            );
        });
    }

    /*
     * Önce 2.00'ı mümkün olan
     * en az maçla yakala.
     */

    let selected = [];
    let total = 1;

    for (const item of list) {

        if (
            selected.length >=
            MAX_MATCHES
        ) {
            break;
        }

        selected.push(item);

        total *= item.prediction.odd;

        if (
            total >=
            MIN_TOTAL_ODDS
        ) {
            break;
        }
    }

    if (
        total <
        MIN_TOTAL_ODDS
    ) {
        return null;
    }

    return {
        type,
        matches: selected,
        totalOdds: total
    };
}

/* =========================================================
   3 KUPON
   ========================================================= */

function createCoupons(date) {

    const candidates =
        getCandidates(date);

    if (!candidates.length) {
        return [];
    }

    const types = [
        {
            id: "safe",
            name: "Güvenli"
        },
        {
            id: "medium",
            name: "Orta Güvenli"
        },
        {
            id: "risky",
            name: "Risk Alınabilir"
        }
    ];

    const coupons = [];

    /*
     * Her kupon mümkün olduğunca
     * farklı maçlardan oluşsun.
     */

    const used = new Set();

    for (const type of types) {

        let coupon =
            buildCoupon(
                candidates,
                type.id,
                used
            );

        /*
         * Yeterli farklı maç yoksa
         * ikinci deneme.
         */

        if (!coupon) {

            coupon =
                buildCoupon(
                    candidates,
                    type.id,
                    new Set()
                );
        }

        if (!coupon) {
            continue;
        }

        for (
            const item of coupon.matches
        ) {

            used.add(
                String(
                    getMatchId(
                        item.match
                    )
                )
            );
        }

        coupons.push({
            ...coupon,
            name: type.name
        });
    }

    return coupons.slice(
        0,
        MAX_COUPONS
    );
}

/* =========================================================
   KUPON DURUMU
   ========================================================= */

function getCouponStatus(coupon) {

    let lost = false;
    let pending = false;

    for (
        const item of coupon.matches
    ) {

        const result =
            marketResult(
                item.match,
                item.prediction.market
            );

        if (result === false) {
            lost = true;
        }

        if (result === null) {
            pending = true;
        }
    }

    if (lost) {
        return {
            text: "Kaybetti",
            className: "lost"
        };
    }

    if (pending) {
        return {
            text: "Bekliyor",
            className: "pending"
        };
    }

    return {
        text: "Kazandı",
        className: "won"
    };
}

/* =========================================================
   TAKVİMDE KUPON VAR MI?
   ========================================================= */

function hasPredictionForDate(date) {

    const candidates =
        getCandidates(date);

    return candidates.length > 0;
}

/* =========================================================
   TAKVİM
   ========================================================= */

function renderCalendar() {

    if (!calendar || !monthTitle) {
        return;
    }

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();

    const monthNames = [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık"
    ];

    monthTitle.textContent =
        `${monthNames[month]} ${year}`;

    calendar.innerHTML = "";

    /*
     * Ayın ilk günü.
     */

    const firstDay =
        new Date(
            year,
            month,
            1
        );

    /*
     * Türkiye'de hafta Pazartesi
     * ile başlıyor.
     */

    let startDay =
        firstDay.getDay();

    if (startDay === 0) {
        startDay = 6;
    } else {
        startDay -= 1;
    }

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();

    /*
     * Boş günler
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
     * Günler
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

        const dayBox =
            document.createElement(
                "button"
            );

        dayBox.type = "button";

        dayBox.className =
            "calendar-day";

        if (
            key ===
            dateKey(selectedDate)
        ) {
            dayBox.classList.add(
                "selected"
            );
        }

        if (isToday(date)) {
            dayBox.classList.add(
                "today"
            );
        }

        /*
         * Sadece o gün maç varsa
         * nokta göster.
         */

        const matches =
            getMatchesForDate(date);

        const hasMatches =
            matches.length > 0;

        const hasPredictions =
            hasPredictionForDate(
                date
            );

        dayBox.innerHTML = `
            <span class="day-number">
                ${day}
            </span>

            ${
                hasMatches
                    ? `
                    <span class="day-dot ${
                        hasPredictions
                            ? "has-prediction"
                            : ""
                    }"></span>
                    `
                    : ""
            }
        `;

        dayBox.addEventListener(
            "click",
            () => {

                selectedDate =
                    cloneDate(date);

                renderCalendar();

                renderSelectedDate();

                renderCoupons();
            }
        );

        calendar.appendChild(
            dayBox
        );
    }
}

/* =========================================================
   SEÇİLİ TARİH
   ========================================================= */

function renderSelectedDate() {

    if (!selectedDateBox) {
        return;
    }

    const matches =
        getMatchesForDate(
            selectedDate
        );

    const dateText =
        selectedDate.toLocaleDateString(
            "tr-TR",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    selectedDateBox.innerHTML = `
        <strong>
            ${escapeHtml(dateText)}
        </strong>

        <span>
            ${matches.length} maç
        </span>
    `;
}

/* =========================================================
   İSTATİSTİK
   ========================================================= */

function renderStatistics(coupons) {

    if (!statistics) {
        return;
    }

    const matches =
        getMatchesForDate(
            selectedDate
        );

    const candidates =
        getCandidates(
            selectedDate
        );

    statistics.innerHTML = `
        <div class="stat-box">
            <strong>${matches.length}</strong>
            <span>Maç</span>
        </div>

        <div class="stat-box">
            <strong>${candidates.length}</strong>
            <span>Tahminli Maç</span>
        </div>

        <div class="stat-box">
            <strong>${coupons.length}</strong>
            <span>Kupon</span>
        </div>
    `;
}

/* =========================================================
   KUPON HTML
   ========================================================= */

function renderCoupons() {

    if (!couponList) {
        return;
    }

    const coupons =
        createCoupons(
            selectedDate
        );

    renderStatistics(
        coupons
    );

    if (!coupons.length) {

        couponList.innerHTML = `
            <div class="coupon-empty">
                <strong>
                    Bu tarih için kupon oluşturulamadı.
                </strong>

                <p>
                    Kupon oluşturmak için en az
                    ${MIN_SAMPLE} örneklem,
                    %${MIN_SUCCESS} başarı ve
                    toplam ${MIN_TOTAL_ODDS.toFixed(2)}
                    oran gerekiyor.
                </p>
            </div>
        `;

        return;
    }

    couponList.innerHTML =
        coupons.map(
            coupon => {

                const status =
                    getCouponStatus(
                        coupon
                    );

                let matchesHtml = "";

                coupon.matches.forEach(
                    item => {

                        const result =
                            marketResult(
                                item.match,
                                item.prediction.market
                            );

                        let icon = "●";
                        let resultClass =
                            "pending";

                        if (
                            result === true
                        ) {
                            icon = "✓";
                            resultClass =
                                "won";
                        }

                        if (
                            result === false
                        ) {
                            icon = "✕";
                            resultClass =
                                "lost";
                        }

                        const score =
                            getFullTimeScore(
                                item.match
                            );

                        const scoreText =
                            score
                                ? `${score.home}-${score.away}`
                                : "";

                        matchesHtml += `
                            <div class="coupon-match">

                                <div class="coupon-match-info">

                                    <div class="coupon-match-date">
                                        ${escapeHtml(
                                            getTime(
                                                item.match
                                            )
                                        )}
                                    </div>

                                    <div class="coupon-teams">
                                        <span>
                                            ${escapeHtml(
                                                getHome(
                                                    item.match
                                                )
                                            )}
                                        </span>

                                        <b> - </b>

                                        <span>
                                            ${escapeHtml(
                                                getAway(
                                                    item.match
                                                )
                                            )}
                                        </span>
                                    </div>

                                    ${
                                        scoreText
                                            ? `
                                                <div class="coupon-score">
                                                    ${scoreText}
                                                </div>
                                            `
                                            : ""
                                    }

                                </div>

                                <div class="coupon-prediction">

                                    <strong>
                                        ${escapeHtml(
                                            item.prediction.name
                                        )}
                                    </strong>

                                    <span>
                                        ${item.prediction.odd.toFixed(2)}
                                    </span>

                                    <small>
                                        %${item.prediction.percentage.toFixed(0)}
                                        · N=${item.prediction.sample}
                                    </small>

                                </div>

                                <div class="
                                    coupon-result
                                    ${resultClass}
                                ">
                                    ${icon}
                                </div>

                            </div>
                        `;
                    }
                );

                return `
                    <article class="coupon-card">

                        <div class="coupon-card-header">

                            <div>
                                <h3>
                                    ${escapeHtml(
                                        coupon.name
                                    )}
                                </h3>

                                <span>
                                    ${
                                        coupon.matches.length
                                    } maç
                                </span>
                            </div>

                            <div class="
                                coupon-status
                                ${status.className}
                            ">
                                ${status.text}
                            </div>

                        </div>

                        <div class="coupon-total">
                            Toplam Oran:
                            <strong>
                                ${coupon.totalOdds.toFixed(2)}
                            </strong>
                        </div>

                        <div class="coupon-matches">
                            ${matchesHtml}
                        </div>

                    </article>
                `;
            }
        ).join("");
}

/* =========================================================
   TARİH AYARLARI
   ========================================================= */

function setupCalendarButtons() {

    if (prevMonth) {

        prevMonth.addEventListener(
            "click",
            () => {

                calendarDate =
                    new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() - 1,
                        1
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
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() + 1,
                        1
                    );

                renderCalendar();
            }
        );
    }
}

/* =========================================================
   CSS
   ========================================================= */

function injectCSS() {

    if (
        document.getElementById(
            "coupon-extra-style"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "coupon-extra-style";

    style.textContent = `

        .calendar-day {
            position: relative;
            cursor: pointer;
            border: 0;
            background: transparent;
        }

        .calendar-day.selected {
            font-weight: 800;
        }

        .calendar-day.today {
            font-weight: 900;
        }

        .calendar-day.empty {
            cursor: default;
        }

        .day-dot {
            display: block;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            margin: 4px auto 0;
            background: #999;
        }

        .day-dot.has-prediction {
            background: #16a34a;
        }

        .coupon-card {
            background: #fff;
            border-radius: 14px;
            overflow: hidden;
            margin: 14px 0;
            border: 1px solid #e5e7eb;
            box-shadow:
                0 4px 14px
                rgba(0,0,0,.06);
        }

        .coupon-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 15px;
            border-bottom: 1px solid #eee;
        }

        .coupon-card-header h3 {
            margin: 0;
            font-size: 18px;
        }

        .coupon-card-header span {
            display: block;
            margin-top: 3px;
            font-size: 12px;
            color: #777;
        }

        .coupon-status {
            border-radius: 20px;
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 800;
        }

        .coupon-status.won {
            background: #dcfce7;
            color: #15803d;
        }

        .coupon-status.lost {
            background: #fee2e2;
            color: #dc2626;
        }

        .coupon-status.pending {
            background: #fef3c7;
            color: #b45309;
        }

        .coupon-total {
            padding: 10px 15px;
            background: #f8fafc;
            font-size: 14px;
        }

        .coupon-total strong {
            font-size: 17px;
            margin-left: 4px;
        }

        .coupon-match {
            display: grid;
            grid-template-columns:
                minmax(0,1fr)
                auto
                32px;
            align-items: center;
            gap: 12px;
            padding: 13px 15px;
            border-bottom: 1px solid #eee;
        }

        .coupon-match:last-child {
            border-bottom: 0;
        }

        .coupon-match-date {
            font-size: 11px;
            color: #888;
            margin-bottom: 3px;
        }

        .coupon-teams {
            font-size: 14px;
            font-weight: 700;
        }

        .coupon-score {
            font-size: 12px;
            font-weight: 800;
            margin-top: 4px;
        }

        .coupon-prediction {
            text-align: right;
        }

        .coupon-prediction strong {
            display: block;
            font-size: 13px;
        }

        .coupon-prediction span {
            font-size: 15px;
            font-weight: 800;
        }

        .coupon-prediction small {
            display: block;
            font-size: 10px;
            color: #777;
            margin-top: 2px;
        }

        .coupon-result {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 900;
        }

        .coupon-result.won {
            background: #dcfce7;
            color: #16a34a;
        }

        .coupon-result.lost {
            background: #fee2e2;
            color: #dc2626;
        }

        .coupon-result.pending {
            background: #fef3c7;
            color: #d97706;
            font-size: 11px;
        }

        .coupon-empty {
            text-align: center;
            padding: 30px 15px;
            color: #777;
        }

        .coupon-empty strong {
            color: #333;
        }

        .statistics {
            display: flex;
            gap: 8px;
            margin: 10px 0;
        }

        .stat-box {
            flex: 1;
            text-align: center;
            padding: 10px;
            border-radius: 10px;
            background: #f8fafc;
        }

        .stat-box strong {
            display: block;
            font-size: 18px;
        }

        .stat-box span {
            font-size: 11px;
            color: #777;
        }

        @media (max-width: 600px) {

            .coupon-match {
                grid-template-columns:
                    minmax(0,1fr)
                    32px;
            }

            .coupon-prediction {
                grid-column: 1 / 2;
                text-align: left;
                margin-top: 4px;
            }

            .coupon-result {
                grid-column: 2;
                grid-row: 1 / 3;
            }

            .statistics {
                gap: 5px;
            }
        }
    `;

    document.head.appendChild(
        style
    );
}

/* =========================================================
   DIŞARIDAN ÇAĞRILABİLİR
   ========================================================= */

window.getCouponsForDate = function(date) {

    const d =
        parseDate(date) ||
        selectedDate;

    return createCoupons(d);
};

window.renderCouponsForDate = function(date) {

    const d =
        parseDate(date) ||
        selectedDate;

    selectedDate =
        cloneDate(d);

    calendarDate =
        cloneDate(d);

    renderCalendar();
    renderSelectedDate();
    renderCoupons();

    return createCoupons(d);
};

/* =========================================================
   VERİ YÜKLE
   ========================================================= */

async function loadData() {

    const response =
        await fetch(
            `${DATA_URL}?t=${Date.now()}`,
            {
                cache: "no-store"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Veri yüklenemedi: HTTP ${response.status}`
        );
    }

    const json =
        await response.json();

    if (Array.isArray(json)) {
        allMatches = json;
    }

    else if (
        json &&
        Array.isArray(json.matches)
    ) {
        allMatches =
            json.matches;
    }

    else {
        throw new Error(
            "matches.json içinde maç verisi bulunamadı."
        );
    }

    console.log(
        "Kupon sistemi:",
        allMatches.length,
        "maç yüklendi."
    );
}

/* =========================================================
   BAŞLAT
   ========================================================= */

async function initCoupons() {

    injectCSS();

    try {

        await loadData();

        /*
         * Takvimi bugün aç.
         */

        selectedDate =
            new Date();

        calendarDate =
            new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                1
            );

        setupCalendarButtons();

        renderCalendar();

        renderSelectedDate();

        renderCoupons();

        console.log(
            "Kupon sistemi hazır."
        );

    } catch (error) {

        console.error(
            "Kupon verileri yüklenemedi:",
            error
        );

        if (couponList) {

            couponList.innerHTML = `
                <div class="coupon-empty">
                    <strong>
                        Kupon verileri yüklenemedi.
                    </strong>

                    <p>
                        ${escapeHtml(
                            error.message
                        )}
                    </p>
                </div>
            `;
        }
    }
}

/* =========================================================
   DOM READY
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initCoupons
    );

} else {

    initCoupons();

}
