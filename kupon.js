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

/* =========================================================
   GLOBAL
   ========================================================= */

let allMatches = [];
let selectedDate = new Date();
let calendarDate = new Date();

let matchDates = new Set();
let matchesByDate = new Map();
let historyCache = new Map();

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
        odds: ["ms1", "MS1"]
    },
    {
        id: "MSX",
        name: "MS X",
        odds: ["msX", "msx", "MSX"]
    },
    {
        id: "MS2",
        name: "MS 2",
        odds: ["ms2", "MS2"]
    },

    {
        id: "IY1",
        name: "İY 1",
        odds: ["iy1", "IY1"]
    },
    {
        id: "IY2",
        name: "İY 2",
        odds: ["iy2", "IY2"]
    },

    {
        id: "IY15U",
        name: "İY 1.5 Üst",
        odds: [
            "iy15Ust",
            "iy15ust",
            "iy15U",
            "iy15u"
        ]
    },

    {
        id: "IY15A",
        name: "İY 1.5 Alt",
        odds: [
            "iy15Alt",
            "iy15alt",
            "iy15A",
            "iy15a"
        ]
    },

    {
        id: "MS25U",
        name: "2.5 Üst",
        odds: [
            "au25Ust",
            "au25ust",
            "au25U",
            "au25u"
        ]
    },

    {
        id: "MS15U",
        name: "1.5 Üst",
        odds: [
            "au15Ust",
            "au15ust",
            "au15U",
            "au15u"
        ]
    },

    {
        id: "MS15A",
        name: "1.5 Alt",
        odds: [
            "au15Alt",
            "au15alt",
            "au15A",
            "au15a"
        ]
    },

    {
        id: "KG",
        name: "KG Var",
        odds: [
            "kgVar",
            "kgvar",
            "KGVar",
            "kg"
        ]
    },

    {
        id: "KGY",
        name: "KG Yok",
        odds: [
            "kgYok",
            "kgyok",
            "KGYok",
            "kgy"
        ]
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

function isToday(date) {
    return dateKey(date) === dateKey(new Date());
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
        const d = new Date(
            Number(m[3]),
            Number(m[2]) - 1,
            Number(m[1])
        );

        if (!isNaN(d.getTime())) {
            return d;
        }
    }

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
   GENEL ALAN OKUMA
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
   OYNANMIŞ MI
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
   TARİH İNDEKSİ
   ========================================================= */

function buildIndexes() {
    matchDates = new Set();
    matchesByDate = new Map();

    for (const match of allMatches) {
        const d = parseDate(getDate(match));

        if (!d) {
            continue;
        }

        const key = dateKey(d);

        matchDates.add(key);

        if (!matchesByDate.has(key)) {
            matchesByDate.set(key, []);
        }

        matchesByDate
            .get(key)
            .push(match);
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

    const key = dateKey(target);

    if (historyCache.has(key)) {
        return historyCache.get(key);
    }

    const minDate = addDays(
        target,
        -HISTORY_DAYS
    );

    const result = [];

    for (const match of allMatches) {
        const d = parseDate(
            getDate(match)
        );

        if (!d) {
            continue;
        }

        if (d >= target) {
            continue;
        }

        if (d < minDate) {
            continue;
        }

        if (!isPlayed(match)) {
            continue;
        }

        result.push(match);
    }

    historyCache.set(key, result);

    return result;
}

/* =========================================================
   ORAN ANALİZİ
   ========================================================= */

function analyzeMarket(
    targetMatch,
    market,
    targetDate,
    history
) {
    const targetOdd =
        getOdd(targetMatch, market);

    if (targetOdd === null) {
        return null;
    }

    let sample = 0;
    let wins = 0;

    for (const oldMatch of history) {
        const oldOdd =
            getOdd(oldMatch, market);

        if (oldOdd === null) {
            continue;
        }

        /* TAM EŞLEŞME */
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
    targetDate,
    history = null
) {
    if (!history) {
        history =
            getHistoricalMatches(
                targetDate
            );
    }

    const predictions = [];

    for (const market of MARKETS) {
        const result =
            analyzeMarket(
                match,
                market,
                targetDate,
                history
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

    return matchesByDate.get(key) || [];
}

/* =========================================================
   ADAY MAÇLAR
   ========================================================= */

function getCandidates(date) {
    const matches =
        getMatchesForDate(date);

    if (!matches.length) {
        return [];
    }

    const history =
        getHistoricalMatches(date);

    const result = [];

    for (const match of matches) {

        const predictions =
            getPredictions(
                match,
                date,
                history
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

    } else if (type === "medium") {

        list.sort((a, b) => {

            const scoreA =
                a.percentage * 0.70 +
                Math.min(a.odd, 3) * 10;

            const scoreB =
                b.percentage * 0.70 +
                Math.min(b.odd, 3) * 10;

            return scoreB - scoreA;
        });

    } else {

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
        .filter(item =>
            item.prediction
        );

    if (!list.length) {
        return null;
    }

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

            if (
                b.prediction.sample !==
                a.prediction.sample
            ) {
                return (
                    b.prediction.sample -
                    a.prediction.sample
                );
            }

            return (
                a.prediction.odd -
                b.prediction.odd
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
     * Önce en az maç ile 2.00'a ulaşmayı dene.
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

        total *=
            Number(
                item.prediction.odd
            );

        if (
            total >=
            MIN_TOTAL_ODDS
        ) {
            break;
        }
    }

    /*
     * 2.00 oluşmadıysa,
     * 5 maça kadar devam ederek
     * ikinci kez dene.
     */

    if (
        total <
        MIN_TOTAL_ODDS
    ) {

        selected = [];
        total = 1;

        for (const item of list) {

            if (
                selected.length >=
                MAX_MATCHES
            ) {
                break;
            }

            selected.push(item);

            total *=
                Number(
                    item.prediction.odd
                );
        }
    }

    if (!selected.length) {
        return null;
    }

    /*
     * Minimum toplam oran şartı.
     */

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

    const coupons = [];
    const blocked = new Set();

    const types = [
        {
            key: "safe",
            name: "Güvenli"
        },
        {
            key: "medium",
            name: "Orta Güvenli"
        },
        {
            key: "risk",
            name: "Risk Alınabilir"
        }
    ];

    for (const item of types) {

        const coupon =
            buildCoupon(
                candidates,
                item.key,
                blocked
            );

        if (!coupon) {
            continue;
        }

        coupon.name = item.name;

        coupons.push(coupon);

        /*
         * Aynı maçı mümkün olduğunca
         * diğer kuponlardan çıkar.
         */

        for (
            const couponMatch
            of coupon.matches
        ) {
            blocked.add(
                String(
                    getMatchId(
                        couponMatch.match
                    )
                )
            );
        }

        if (coupons.length >= 3) {
            break;
        }
    }

    /*
     * İlk turda 3 kupon çıkmadıysa,
     * kalan kuponları tekrar kullanılabilir
     * maçlarla tamamlamayı dene.
     */

    if (coupons.length < 3) {

        for (const item of types) {

            if (
                coupons.some(
                    c => c.type === item.key
                )
            ) {
                continue;
            }

            const coupon =
                buildCoupon(
                    candidates,
                    item.key,
                    new Set()
                );

            if (!coupon) {
                continue;
            }

            coupon.name = item.name;

            coupons.push(coupon);

            if (coupons.length >= 3) {
                break;
            }
        }
    }

    return coupons;
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

        if (result === null) {
            pending = true;
        }
        else if (result === false) {
            lost = true;
        }
    }

    if (lost) {
        return {
            key: "lost",
            text: "Kaybetti"
        };
    }

    if (pending) {
        return {
            key: "pending",
            text: "Bekliyor"
        };
    }

    return {
        key: "won",
        text: "Kazandı"
    };
}

/* =========================================================
   TAKVİM
   ========================================================= */

function renderCalendar() {

    if (!calendar) {
        return;
    }

    calendar.innerHTML = "";

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

    if (monthTitle) {
        monthTitle.textContent =
            `${monthNames[month]} ${year}`;
    }

    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();

    const offset =
        firstDay === 0
            ? 6
            : firstDay - 1;

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();

    const fragment =
        document.createDocumentFragment();

    /*
     * Pazartesi başlangıç.
     */

    for (let i = 0; i < offset; i++) {

        const empty =
            document.createElement("div");

        empty.className =
            "calendar-day empty";

        fragment.appendChild(empty);
    }

    /*
     * ÖNEMLİ:
     * Burada artık getCandidates()
     * çalıştırılmıyor.
     *
     * Sadece maç tarihi kontrol ediliyor.
     * Bu sayede takvim çok hızlı açılır.
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
            document.createElement("button");

        button.type = "button";

        button.className =
            "calendar-day";

        if (
            key ===
            dateKey(selectedDate)
        ) {
            button.classList.add(
                "selected"
            );
        }

        if (isToday(date)) {
            button.classList.add(
                "today"
            );
        }

        if (matchDates.has(key)) {
            button.classList.add(
                "has-matches"
            );
        }

        button.innerHTML = `
            <span class="day-number">
                ${day}
            </span>
            ${
                matchDates.has(key)
                    ? `<span class="match-dot"></span>`
                    : ""
            }
        `;

        button.addEventListener(
            "click",
            () => {

                selectedDate =
                    cloneDate(date);

                renderCalendar();
                renderSelectedDate();
                renderStatistics();
                renderCoupons();
            }
        );

        fragment.appendChild(button);
    }

    calendar.appendChild(
        fragment
    );
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
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    selectedDateBox.innerHTML = `
        <div class="selected-date-title">
            ${escapeHtml(dateText)}
        </div>

        <div class="selected-date-count">
            ${matches.length}
            maç
        </div>
    `;
}

/* =========================================================
   İSTATİSTİK
   ========================================================= */

function renderStatistics() {

    if (!statistics) {
        return;
    }

    const matches =
        getMatchesForDate(
            selectedDate
        );

    const played =
        matches.filter(
            isPlayed
        ).length;

    const upcoming =
        matches.length -
        played;

    statistics.innerHTML = `
        <div class="stat-box">
            <strong>${matches.length}</strong>
            <span>Toplam Maç</span>
        </div>

        <div class="stat-box">
            <strong>${played}</strong>
            <span>Oynanan</span>
        </div>

        <div class="stat-box">
            <strong>${upcoming}</strong>
            <span>Bekleyen</span>
        </div>
    `;
}

/* =========================================================
   MAÇ DURUM İKONU
   ========================================================= */

function getPredictionResult(
    match,
    prediction
) {
    const result =
        marketResult(
            match,
            prediction.market
        );

    if (result === true) {
        return `
            <span class="result-icon won">
                ✓
            </span>
        `;
    }

    if (result === false) {
        return `
            <span class="result-icon lost">
                ✕
            </span>
        `;
    }

    return `
        <span class="result-icon pending">
            •
        </span>
    `;
}

/* =========================================================
   KUPONLAR
   ========================================================= */

function renderCoupons() {

    if (!couponList) {
        return;
    }

    couponList.innerHTML = `
        <div class="loading-coupon">
            Kuponlar hesaplanıyor...
        </div>
    `;

    /*
     * Büyük JSON üzerinde tarayıcıyı kilitlememek
     * için hesaplamayı sonraki event loop'a bırak.
     */

    setTimeout(() => {

        try {

            const coupons =
                createCoupons(
                    selectedDate
                );

            if (!coupons.length) {

                couponList.innerHTML = `
                    <div class="no-coupon">
                        <div class="no-coupon-title">
                            Bu tarih için uygun kupon bulunamadı.
                        </div>

                        <div class="no-coupon-text">
                            En az ${MIN_SAMPLE} geçmiş örnek,
                            %${MIN_SUCCESS} başarı ve
                            minimum ${MIN_TOTAL_ODDS.toFixed(2)}
                            toplam oran şartı aranıyor.
                        </div>
                    </div>
                `;

                return;
            }

            const fragment =
                document.createDocumentFragment();

            for (const coupon of coupons) {

                const status =
                    getCouponStatus(
                        coupon
                    );

                const card =
                    document.createElement(
                        "div"
                    );

                card.className =
                    `coupon-card ${status.key}`;

                const matchesHtml =
                    coupon.matches
                        .map(item => {

                            const match =
                                item.match;

                            const prediction =
                                item.prediction;

                            return `
                                <div class="coupon-match">

                                    <div class="match-info">

                                        <div class="match-teams">
                                            ${escapeHtml(
                                                getHome(match)
                                            )}
                                            -
                                            ${escapeHtml(
                                                getAway(match)
                                            )}
                                        </div>

                                        <div class="match-meta">
                                            ${escapeHtml(
                                                getTime(match)
                                            )}
                                            ${
                                                getLeague(match)
                                                    ? " • " +
                                                      escapeHtml(
                                                          getLeague(match)
                                                      )
                                                    : ""
                                            }
                                        </div>

                                    </div>

                                    <div class="prediction">

                                        <div class="prediction-name">
                                            ${escapeHtml(
                                                prediction.name
                                            )}
                                        </div>

                                        <div class="prediction-odd">
                                            ${Number(
                                                prediction.odd
                                            ).toFixed(2)}
                                        </div>

                                        <div class="prediction-rate">
                                            %${Number(
                                                prediction.percentage
                                            ).toFixed(0)}
                                            /
                                            ${prediction.sample}
                                        </div>

                                        ${getPredictionResult(
                                            match,
                                            prediction
                                        )}

                                    </div>

                                </div>
                            `;
                        })
                        .join("");

                card.innerHTML = `

                    <div class="coupon-header">

                        <div>
                            <div class="coupon-name">
                                ${escapeHtml(
                                    coupon.name
                                )}
                            </div>

                            <div class="coupon-count">
                                ${coupon.matches.length}
                                maç
                            </div>
                        </div>

                        <div class="coupon-status">
                            ${escapeHtml(
                                status.text
                            )}
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
                `;

                fragment.appendChild(
                    card
                );
            }

            couponList.innerHTML = "";

            couponList.appendChild(
                fragment
            );

        }
        catch (error) {

            console.error(
                "Kupon hesaplama hatası:",
                error
            );

            couponList.innerHTML = `
                <div class="no-coupon error">
                    Kupon verileri hesaplanamadı.
                    <br>
                    <small>
                        ${escapeHtml(
                            error.message
                        )}
                    </small>
                </div>
            `;
        }

    }, 0);
}

/* =========================================================
   TAKVİM BUTONLARI
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
            "kupon-auto-css"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "kupon-auto-css";

    style.textContent = `

        .calendar-day {
            position: relative;
            cursor: pointer;
            min-height: 52px;
        }

        .calendar-day.empty {
            visibility: hidden;
            cursor: default;
        }

        .calendar-day.has-matches {
            font-weight: 700;
        }

        .calendar-day.selected {
            outline: 2px solid currentColor;
            outline-offset: -2px;
        }

        .calendar-day.today {
            font-weight: 900;
        }

        .day-number {
            display: block;
        }

        .match-dot {
            display: block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin: 4px auto 0;
            background: currentColor;
        }

        .selected-date-title {
            font-size: 20px;
            font-weight: 800;
        }

        .selected-date-count {
            margin-top: 4px;
            opacity: .7;
        }

        .statistics {
            display: grid;
            grid-template-columns:
                repeat(3, 1fr);
            gap: 10px;
            margin: 15px 0;
        }

        .stat-box {
            padding: 12px;
            border-radius: 12px;
            background: rgba(127,127,127,.10);
            text-align: center;
        }

        .stat-box strong {
            display: block;
            font-size: 20px;
        }

        .stat-box span {
            font-size: 12px;
            opacity: .7;
        }

        .coupon-card {
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 16px;
            border: 1px solid rgba(127,127,127,.25);
            overflow: hidden;
        }

        .coupon-card.won {
            border-color: #25a55f;
        }

        .coupon-card.lost {
            border-color: #d64545;
        }

        .coupon-card.pending {
            border-color: #d39b25;
        }

        .coupon-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
        }

        .coupon-name {
            font-size: 19px;
            font-weight: 900;
        }

        .coupon-count {
            font-size: 12px;
            opacity: .65;
        }

        .coupon-status {
            font-weight: 800;
        }

        .coupon-total {
            padding: 10px;
            border-radius: 10px;
            background: rgba(127,127,127,.10);
            margin-bottom: 10px;
        }

        .coupon-match {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding: 12px 0;
            border-top: 1px solid rgba(127,127,127,.18);
        }

        .match-info {
            min-width: 0;
        }

        .match-teams {
            font-weight: 700;
            line-height: 1.35;
        }

        .match-meta {
            margin-top: 4px;
            font-size: 12px;
            opacity: .65;
        }

        .prediction {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 7px;
            text-align: right;
        }

        .prediction-name {
            font-weight: 800;
        }

        .prediction-odd {
            font-weight: 900;
        }

        .prediction-rate {
            font-size: 11px;
            opacity: .7;
        }

        .result-icon {
            width: 23px;
            height: 23px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-weight: 900;
        }

        .result-icon.won {
            color: #178b4d;
        }

        .result-icon.lost {
            color: #d33d3d;
        }

        .result-icon.pending {
            color: #d09216;
        }

        .no-coupon,
        .loading-coupon {
            padding: 25px 15px;
            text-align: center;
            border-radius: 15px;
            background: rgba(127,127,127,.08);
        }

        .no-coupon-title {
            font-weight: 800;
            margin-bottom: 7px;
        }

        .no-coupon-text {
            font-size: 13px;
            opacity: .7;
            line-height: 1.5;
        }

        @media (max-width: 600px) {

            .statistics {
                grid-template-columns:
                    repeat(3, 1fr);
            }

            .coupon-match {
                align-items: flex-start;
            }

            .prediction {
                flex-direction: column;
                align-items: flex-end;
                gap: 2px;
            }

            .prediction-rate {
                display: none;
            }

        }

    `;

    document.head.appendChild(
        style
    );
}

/* =========================================================
   DIŞARIDAN ERİŞİM
   ========================================================= */

window.getCouponsForDate =
    function(date) {
        return createCoupons(
            parseDate(date) || new Date()
        );
    };

window.renderCouponsForDate =
    function(date) {

        selectedDate =
            parseDate(date) || new Date();

        calendarDate =
            cloneDate(selectedDate);

        renderCalendar();
        renderSelectedDate();
        renderStatistics();
        renderCoupons();
    };

/* =========================================================
   VERİ YÜKLE
   ========================================================= */

async function loadData() {

    const response =
        await fetch(
            DATA_URL,
            {
                cache: "no-store"
            }
        );

    if (!response.ok) {
        throw new Error(
            `Veri yüklenemedi: HTTP ${response.status}`
        );
    }

    const data =
        await response.json();

    /*
     * matches dizisi bekleniyor.
     */

    if (Array.isArray(data)) {
        allMatches = data;
    }
    else if (
        data &&
        Array.isArray(data.matches)
    ) {
        allMatches =
            data.matches;
    }
    else {
        throw new Error(
            "matches.json içinde maç listesi bulunamadı."
        );
    }

    buildIndexes();

    historyCache.clear();
}

/* =========================================================
   BAŞLAT
   ========================================================= */

async function initCoupons() {

    try {

        if (couponList) {
            couponList.innerHTML = `
                <div class="loading-coupon">
                    Veriler yükleniyor...
                </div>
            `;
        }

        await loadData();

        /*
         * Bugün başlangıç.
         */

        selectedDate =
            new Date();

        calendarDate =
            new Date();

        setupCalendarButtons();
        injectCSS();

        renderCalendar();
        renderSelectedDate();
        renderStatistics();
        renderCoupons();

        console.log(
            "Kupon sistemi hazır:",
            allMatches.length,
            "maç"
        );

    }
    catch (error) {

        console.error(
            "Kupon sistemi başlatılamadı:",
            error
        );

        if (couponList) {

            couponList.innerHTML = `
                <div class="no-coupon error">

                    <div class="no-coupon-title">
                        Kupon verileri yüklenemedi.
                    </div>

                    <div class="no-coupon-text">
                        ${escapeHtml(
                            error.message
                        )}
                    </div>

                </div>
            `;
        }
    }
}

/* =========================================================
   ÇALIŞTIR
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initCoupons
    );

}
else {
    initCoupons();
}
