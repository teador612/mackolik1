"use strict";

/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;

const MIN_SAMPLE = 5;

const MIN_SUCCESS = 70;

const MAX_COUPONS_PER_DAY = 3;

const MAX_SELECTIONS = 5;

const MIN_TOTAL_ODDS = 2.00;

const STORAGE_KEY =
    "mackolik_coupon_history_v2";


/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];

let selectedDate = new Date();

let calendarDate = new Date();

const analysisCache = new Map();


/* =========================================================
   DOM
========================================================= */

const calendarDays =
    document.getElementById("calendarDays");

const calendarMonth =
    document.getElementById("calendarMonth");

const selectedDateText =
    document.getElementById("selectedDateText");

const couponList =
    document.getElementById("couponList");

const couponStats =
    document.getElementById("couponStats");

const prevMonth =
    document.getElementById("prevMonth");

const nextMonth =
    document.getElementById("nextMonth");


/* =========================================================
   YARDIMCILAR
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

    const result =
        new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;
}


function sameDate(a, b) {

    return (
        dateKey(a) ===
        dateKey(b)
    );
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


    const text =
        String(value).trim();


    let match =
        text.match(
            /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
        );


    if (match) {

        return new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );
    }


    match =
        text.match(
            /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
        );


    if (match) {

        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );
    }


    const parsed =
        new Date(text);


    if (isNaN(parsed.getTime())) {
        return null;
    }


    return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate()
    );
}


/* =========================================================
   ALAN OKUMA
========================================================= */

function getValue(object, keys) {

    if (
        !object ||
        typeof object !== "object"
    ) {
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


function getHome(match) {

    return getValue(
        match,
        [
            "home",
            "Home",
            "homeTeam",
            "home_team",
            "ev",
            "Ev",
            "evSahibi"
        ]
    ) || "-";
}


function getAway(match) {

    return getValue(
        match,
        [
            "away",
            "Away",
            "awayTeam",
            "away_team",
            "deplasman",
            "Deplasman"
        ]
    ) || "-";
}


function getLeague(match) {

    return getValue(
        match,
        [
            "league",
            "League",
            "lig",
            "Lig",
            "competition",
            "tournament"
        ]
    ) || "Lig belirtilmemiş";
}


function getTime(match) {

    return getValue(
        match,
        [
            "time",
            "Time",
            "saat",
            "Saat",
            "matchTime"
        ]
    ) || "";
}


/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {

    if (!value) {
        return null;
    }


    if (typeof value === "object") {

        const home =
            getValue(
                value,
                [
                    "home",
                    "Home",
                    "ev",
                    "h"
                ]
            );


        const away =
            getValue(
                value,
                [
                    "away",
                    "Away",
                    "deplasman",
                    "a"
                ]
            );


        if (
            home !== undefined &&
            away !== undefined
        ) {

            const h =
                Number(home);

            const a =
                Number(away);


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
    }


    const text =
        String(value).trim();


    const match =
        text.match(
            /(\d+)\s*[-:]\s*(\d+)/
        );


    if (!match) {
        return null;
    }


    return {
        home: Number(match[1]),
        away: Number(match[2])
    };
}


function getFullTimeScore(match) {

    return parseScore(
        getValue(
            match,
            [
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
            ]
        )
    );
}


function getHalfTimeScore(match) {

    return parseScore(
        getValue(
            match,
            [
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
            ]
        )
    );
}


function isPlayed(match) {

    return !!getFullTimeScore(match);
}


/* =========================================================
   ORANLAR
========================================================= */

function normalizeOdds(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }


    const number =
        Number(
            String(value)
                .replace(",", ".")
                .trim()
        );


    if (!Number.isFinite(number)) {
        return null;
    }


    return number.toFixed(2);
}


function getOdds(match, names) {

    const direct =
        getValue(
            match,
            names
        );


    if (direct !== undefined) {

        return normalizeOdds(
            direct
        );
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


    for (
        const container
        of containers
    ) {

        if (!container) {
            continue;
        }


        const value =
            getValue(
                container,
                names
            );


        if (
            value !== undefined
        ) {

            return normalizeOdds(
                value
            );
        }
    }


    return null;
}


/* =========================================================
   MARKETLER
========================================================= */

const MARKETS = [

    {
        id: "MS1",
        title: "MS 1",

        odds: match =>
            getOdds(
                match,
                [
                    "ms1",
                    "MS1",
                    "1",
                    "MS_1"
                ]
            )
    },


    {
        id: "MSX",
        title: "MS X",

        odds: match =>
            getOdds(
                match,
                [
                    "msX",
                    "msx",
                    "MSX",
                    "ms0",
                    "MS0",
                    "X"
                ]
            )
    },


    {
        id: "MS2",
        title: "MS 2",

        odds: match =>
            getOdds(
                match,
                [
                    "ms2",
                    "MS2",
                    "2",
                    "MS_2"
                ]
            )
    },


    {
        id: "IY1",
        title: "İY 1",

        odds: match =>
            getOdds(
                match,
                [
                    "iy1",
                    "IY1",
                    "İY1",
                    "iy_1"
                ]
            )
    },


    {
        id: "IYX",
        title: "İY X",

        odds: match =>
            getOdds(
                match,
                [
                    "iyX",
                    "iyx",
                    "IYX",
                    "iy0",
                    "IY0",
                    "İYX"
                ]
            )
    },


    {
        id: "IY2",
        title: "İY 2",

        odds: match =>
            getOdds(
                match,
                [
                    "iy2",
                    "IY2",
                    "İY2",
                    "iy_2"
                ]
            )
    },


    {
        id: "IY05U",
        title: "İY 0.5 Üst",

        odds: match =>
            getOdds(
                match,
                [
                    "iy05U",
                    "IY05U",
                    "iy05u",
                    "iy0_5U",
                    "iy0_5Over",
                    "iy05Over",
                    "IY0.5U",
                    "İY0.5Ü",
                    "iy05ust",
                    "iy0.5ust",
                    "iy05üst"
                ]
            )
    },


    {
        id: "IY15U",
        title: "İY 1.5 Üst",

        odds: match =>
            getOdds(
                match,
                [
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
                ]
            )
    },


    {
        id: "MS25U",
        title: "2.5 Üst",

        odds: match =>
            getOdds(
                match,
                [
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
                    "2.5üst"
                ]
            )
    },


    {
        id: "KG",
        title: "KG Var",

        odds: match =>
            getOdds(
                match,
                [
                    "kg",
                    "KG",
                    "kgVar",
                    "KGVar",
                    "kgvar",
                    "kg1",
                    "KG1"
                ]
            )
    },


    {
        id: "KGY",
        title: "KG Yok",

        odds: match =>
            getOdds(
                match,
                [
                    "kgy",
                    "KGY",
                    "kgYok",
                    "KGYok",
                    "kgyok",
                    "kg0",
                    "KG0"
                ]
            )
    }

];


/* =========================================================
   MARKET SONUCU
========================================================= */

function getMarketOutcome(
    match,
    marketId
) {

    if (
        marketId === "MS1" ||
        marketId === "MSX" ||
        marketId === "MS2"
    ) {

        const score =
            getFullTimeScore(match);


        if (!score) {
            return null;
        }


        if (marketId === "MS1") {
            return score.home > score.away;
        }


        if (marketId === "MSX") {
            return score.home === score.away;
        }


        return score.away > score.home;
    }


    if (
        marketId === "IY1" ||
        marketId === "IYX" ||
        marketId === "IY2" ||
        marketId === "IY05U" ||
        marketId === "IY15U"
    ) {

        const score =
            getHalfTimeScore(match);


        if (!score) {
            return null;
        }


        if (marketId === "IY1") {
            return score.home > score.away;
        }


        if (marketId === "IYX") {
            return score.home === score.away;
        }


        if (marketId === "IY2") {
            return score.away > score.home;
        }


        const total =
            score.home +
            score.away;


        if (marketId === "IY05U") {
            return total >= 1;
        }


        if (marketId === "IY15U") {
            return total >= 2;
        }
    }


    if (
        marketId === "MS25U"
    ) {

        const score =
            getFullTimeScore(match);


        if (!score) {
            return null;
        }


        return (
            score.home +
            score.away
        ) >= 3;
    }


    if (
        marketId === "KG" ||
        marketId === "KGY"
    ) {

        const score =
            getFullTimeScore(match);


        if (!score) {
            return null;
        }


        const bothScored =
            score.home > 0 &&
            score.away > 0;


        if (
            marketId === "KG"
        ) {

            return bothScored;
        }


        return !bothScored;
    }


    return null;
}


/* =========================================================
   GEÇMİŞ
========================================================= */

function getHistoryMatches(
    targetDate
) {

    const end =
        new Date(targetDate);


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


    return allMatches.filter(
        match => {

            const date =
                parseDate(
                    getValue(
                        match,
                        [
                            "date",
                            "Date",
                            "tarih",
                            "Tarih",
                            "matchDate",
                            "match_date"
                        ]
                    )
                );


            if (!date) {
                return false;
            }


            date.setHours(
                0,
                0,
                0,
                0
            );


            return (
                date >= start &&
                date < end &&
                isPlayed(match)
            );
        }
    );
}


/* =========================================================
   ANALİZ
========================================================= */

function buildAnalysisIndex(
    targetDate
) {

    const key =
        dateKey(targetDate);


    if (
        analysisCache.has(key)
    ) {

        return analysisCache.get(
            key
        );
    }


    const history =
        getHistoryMatches(
            targetDate
        );


    const index =
        new Map();


    for (
        const match
        of history
    ) {

        for (
            const market
            of MARKETS
        ) {

            const odds =
                market.odds(match);


            if (!odds) {
                continue;
            }


            const key =
                `${market.id}|${odds}`;


            if (
                !index.has(key)
            ) {

                index.set(
                    key,
                    []
                );
            }


            index.get(key).push(
                match
            );
        }
    }


    analysisCache.set(
        dateKey(targetDate),
        index
    );


    return index;
}


/* =========================================================
   UYGUN TAHMİNLER
========================================================= */

function getRecommendations(
    match,
    targetDate
) {

    const index =
        buildAnalysisIndex(
            targetDate
        );


    const result = [];


    for (
        const source
        of MARKETS
    ) {

        const sourceOdds =
            source.odds(match);


        if (!sourceOdds) {
            continue;
        }


        const key =
            `${source.id}|${sourceOdds}`;


        const historical =
            index.get(key) || [];


        if (
            historical.length <
            MIN_SAMPLE
        ) {
            continue;
        }


        for (
            const target
            of MARKETS
        ) {

            if (
                source.id ===
                target.id
            ) {
                continue;
            }


            const targetOdds =
                target.odds(match);


            if (!targetOdds) {
                continue;
            }


            let success = 0;

            let total = 0;


            for (
                const oldMatch
                of historical
            ) {

                const outcome =
                    getMarketOutcome(
                        oldMatch,
                        target.id
                    );


                if (
                    outcome === null
                ) {
                    continue;
                }


                total++;


                if (
                    outcome === true
                ) {
                    success++;
                }
            }


            if (
                total <
                MIN_SAMPLE
            ) {
                continue;
            }


            const percentage =
                (
                    success /
                    total
                ) * 100;


            if (
                percentage <
                MIN_SUCCESS
            ) {
                continue;
            }


            result.push({

                sourceMarket:
                    source.id,

                sourceTitle:
                    source.title,

                sourceOdds,

                targetMarket:
                    target.id,

                targetTitle:
                    target.title,

                targetOdds,

                success,

                total,

                percentage

            });
        }
    }


    result.sort(
        (a, b) => {

            if (
                b.percentage !==
                a.percentage
            ) {

                return (
                    b.percentage -
                    a.percentage
                );
            }


            return (
                b.total -
                a.total
            );
        }
    );


    return result;
}


/* =========================================================
   KUPON ADAYLARI
========================================================= */

function getCouponCandidates(
    targetDate
) {

    const dayKey =
        dateKey(targetDate);


    const matches =
        allMatches.filter(
            match => {

                const date =
                    parseDate(
                        getValue(
                            match,
                            [
                                "date",
                                "Date",
                                "tarih",
                                "Tarih",
                                "matchDate",
                                "match_date"
                            ]
                        )
                    );


                return (
                    date &&
                    dateKey(date) ===
                    dayKey
                );
            }
        );


    const candidates = [];


    for (
        const match
        of matches
    ) {

        const recommendations =
            getRecommendations(
                match,
                targetDate
            );


        if (
            !recommendations.length
        ) {
            continue;
        }


        /*
           Aynı maç için tek seçim.

           En yüksek başarı oranı,
           eşitse daha büyük örneklem.
        */

        const best =
            recommendations[0];


        candidates.push({

            match,

            recommendation:
                best

        });
    }


    candidates.sort(
        (a, b) => {

            if (
                b.recommendation.percentage !==
                a.recommendation.percentage
            ) {

                return (
                    b.recommendation.percentage -
                    a.recommendation.percentage
                );
            }


            return (
                b.recommendation.total -
                a.recommendation.total
            );
        }
    );


    return candidates;
}


/* =========================================================
   KUPON OLUŞTUR
========================================================= */

function createCoupons(
    targetDate
) {

    const candidates =
        getCouponCandidates(
            targetDate
        );


    const coupons = [];

    const usedMatches =
        new Set();


    for (
        let couponIndex = 0;
        couponIndex <
        MAX_COUPONS_PER_DAY;
        couponIndex++
    ) {

        const selections = [];

        let totalOdds = 1;


        for (
            const candidate
            of candidates
        ) {

            const match =
                candidate.match;


            const recommendation =
                candidate.recommendation;


            const matchId =
                getMatchId(
                    match
                );


            if (
                usedMatches.has(
                    matchId
                )
            ) {
                continue;
            }


            const odds =
                Number(
                    recommendation.targetOdds
                );


            if (
                !Number.isFinite(odds)
            ) {
                continue;
            }


            if (
                selections.length >=
                MAX_SELECTIONS
            ) {
                break;
            }


            selections.push({

                matchId,

                home:
                    getHome(match),

                away:
                    getAway(match),

                time:
                    getTime(match),

                league:
                    getLeague(match),

                market:
                    recommendation.targetMarket,

                title:
                    recommendation.targetTitle,

                odds:
                    recommendation.targetOdds,

                sourceTitle:
                    recommendation.sourceTitle,

                sourceOdds:
                    recommendation.sourceOdds,

                success:
                    recommendation.success,

                sample:
                    recommendation.total,

                percentage:
                    recommendation.percentage

            });


            totalOdds *= odds;
        }


        if (
            selections.length === 0
        ) {
            break;
        }


        /*
           2.00 altındaysa,
           yeni seçimlerle tamamlamaya çalış.
        */

        if (
            totalOdds <
            MIN_TOTAL_ODDS
        ) {

            for (
                const candidate
                of candidates
            ) {

                if (
                    selections.length >=
                    MAX_SELECTIONS
                ) {
                    break;
                }


                const id =
                    getMatchId(
                        candidate.match
                    );


                if (
                    usedMatches.has(id) ||
                    selections.some(
                        selection =>
                            selection.matchId ===
                            id
                    )
                ) {
                    continue;
                }


                const odds =
                    Number(
                        candidate
                            .recommendation
                            .targetOdds
                    );


                if (
                    !Number.isFinite(odds)
                ) {
                    continue;
                }


                selections.push({

                    matchId: id,

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

                    market:
                        candidate
                            .recommendation
                            .targetMarket,

                    title:
                        candidate
                            .recommendation
                            .targetTitle,

                    odds:
                        candidate
                            .recommendation
                            .targetOdds,

                    sourceTitle:
                        candidate
                            .recommendation
                            .sourceTitle,

                    sourceOdds:
                        candidate
                            .recommendation
                            .sourceOdds,

                    success:
                        candidate
                            .recommendation
                            .success,

                    sample:
                        candidate
                            .recommendation
                            .total,

                    percentage:
                        candidate
                            .recommendation
                            .percentage

                });


                totalOdds *= odds;


                if (
                    totalOdds >=
                    MIN_TOTAL_ODDS
                ) {
                    break;
                }
            }
        }


        /*
           2.00'a ulaşmadıysa
           zayıf kupon oluşturma.
        */

        if (
            totalOdds <
            MIN_TOTAL_ODDS
        ) {
            break;
        }


        for (
            const selection
            of selections
        ) {

            usedMatches.add(
                selection.matchId
            );
        }


        coupons.push({

            id:
                `${dateKey(targetDate)}-${couponIndex + 1}`,

            date:
                dateKey(targetDate),

            selections,

            totalOdds:
                Number(
                    totalOdds.toFixed(2)
                )

        });
    }


    return coupons;
}


/* =========================================================
   MAÇ ID
========================================================= */

function getMatchId(match) {

    const direct =
        getValue(
            match,
            [
                "id",
                "ID",
                "matchId",
                "match_id",
                "fixtureId",
                "fixture_id"
            ]
        );


    if (
        direct !== undefined
    ) {

        return String(direct);
    }


    return [

        getHome(match),

        getAway(match),

        getTime(match),

        getValue(
            match,
            [
                "date",
                "Date",
                "tarih",
                "Tarih"
            ]
        )

    ].join("|");
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function loadCouponHistory() {

    try {

        const data =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!data) {
            return {};
        }


        return JSON.parse(
            data
        );

    } catch {

        return {};
    }
}


function saveCouponHistory(
    history
) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(history)
    );
}


/* =========================================================
   KUPON GETİR
========================================================= */

function getCouponsForDate(
    date
) {

    const key =
        dateKey(date);


    const history =
        loadCouponHistory();


    if (
        history[key]
    ) {

        return history[key];
    }


    /*
       Sadece bugün için otomatik
       kupon oluştur.

       Geçmiş tarihlerde kayıt yoksa
       yeni kupon üretme.
    */

    const today =
        new Date();


    if (
        !sameDate(
            date,
            today
        )
    ) {

        return [];
    }


    const coupons =
        createCoupons(
            date
        );


    history[key] =
        coupons;


    saveCouponHistory(
        history
    );


    return coupons;
}


/* =========================================================
   KUPON DURUMU
========================================================= */

function getSelectionStatus(
    selection,
    match
) {

    const outcome =
        getMarketOutcome(
            match,
            selection.market
        );


    if (
        outcome === null
    ) {

        return "pending";
    }


    return outcome
        ? "success"
        : "failed";
}


/* =========================================================
   KUPON DURUMU
========================================================= */

function getCouponStatus(
    coupon
) {

    let pending = false;

    let failed = false;


    for (
        const selection
        of coupon.selections
    ) {

        const match =
            findMatchById(
                selection.matchId
            );


        if (!match) {
            pending = true;
            continue;
        }


        const status =
            getSelectionStatus(
                selection,
                match
            );


        if (
            status === "failed"
        ) {

            failed = true;
        }


        if (
            status === "pending"
        ) {

            pending = true;
        }
    }


    if (failed) {
        return "failed";
    }


    if (pending) {
        return "pending";
    }


    return "success";
}


/* =========================================================
   MAÇ BUL
========================================================= */

function findMatchById(
    id
) {

    return allMatches.find(
        match =>
            getMatchId(match) ===
            id
    );
}


/* =========================================================
   KUPON HTML
========================================================= */

function renderCoupon(
    coupon,
    number
) {

    const status =
        getCouponStatus(
            coupon
        );


    let statusText =
        "🟡 Bekliyor";


    if (
        status === "success"
    ) {

        statusText =
            "🟢 Tuttu";
    }


    if (
        status === "failed"
    ) {

        statusText =
            "🔴 Tutmadı";
    }


    return `

        <article
            class="coupon-card ${status}"
        >

            <div class="coupon-header">

                <div>

                    <span class="coupon-number">
                        Kupon ${number}
                    </span>

                    <strong>
                        ${statusText}
                    </strong>

                </div>


                <div class="coupon-total">

                    <small>
                        Toplam Oran
                    </small>

                    <b>
                        ${coupon.totalOdds.toFixed(2)}
                    </b>

                </div>

            </div>


            <div class="coupon-selections">

                ${coupon.selections.map(
                    selection => {

                        const match =
                            findMatchById(
                                selection.matchId
                            );


                        const selectionStatus =
                            match
                                ? getSelectionStatus(
                                    selection,
                                    match
                                )
                                : "pending";


                        const icon =
                            selectionStatus ===
                            "success"
                                ? "🟢"
                                : selectionStatus ===
                                  "failed"
                                    ? "🔴"
                                    : "🟡";


                        return `

                            <div class="coupon-selection">

                                <div class="selection-top">

                                    <span>
                                        ${icon}
                                    </span>

                                    <span>
                                        ${escapeHtml(
                                            selection.time
                                        )}
                                    </span>

                                    <span class="selection-league">
                                        ${escapeHtml(
                                            selection.league
                                        )}
                                    </span>

                                </div>


                                <div class="selection-match">

                                    ${escapeHtml(
                                        selection.home
                                    )}

                                    <span>
                                        -
                                    </span>

                                    ${escapeHtml(
                                        selection.away
                                    )}

                                </div>


                                <div class="selection-pick">

                                    <strong>
                                        ${escapeHtml(
                                            selection.title
                                        )}
                                    </strong>

                                    <b>
                                        ${escapeHtml(
                                            selection.odds
                                        )}
                                    </b>

                                </div>


                                <div class="selection-analysis">

                                    Örneklem:

                                    ${escapeHtml(
                                        selection.sourceTitle
                                    )}

                                    ${escapeHtml(
                                        selection.sourceOdds
                                    )}

                                    →

                                    ${selection.sample}
                                    örnek

                                    ·

                                    %${Number(
                                        selection.percentage
                                    ).toFixed(1)}

                                </div>

                            </div>

                        `;
                    }
                ).join("")}

            </div>

        </article>

    `;
}


/* =========================================================
   İSTATİSTİK
========================================================= */

function renderStats(
    coupons
) {

    if (!couponStats) {
        return;
    }


    let won = 0;

    let lost = 0;

    let pending = 0;


    for (
        const coupon
        of coupons
    ) {

        const status =
            getCouponStatus(
                coupon
            );


        if (
            status === "success"
        ) {

            won++;

        } else if (
            status === "failed"
        ) {

            lost++;

        } else {

            pending++;
        }
    }


    const resolved =
        won + lost;


    const percentage =
        resolved
            ? (
                won /
                resolved
            ) * 100
            : null;


    couponStats.innerHTML = `

        <div class="coupon-stat">

            <span>
                Toplam
            </span>

            <strong>
                ${coupons.length}
            </strong>

        </div>


        <div class="coupon-stat">

            <span>
                🟢 Tuttu
            </span>

            <strong>
                ${won}
            </strong>

        </div>


        <div class="coupon-stat">

            <span>
                🔴 Tutmadı
            </span>

            <strong>
                ${lost}
            </strong>

        </div>


        <div class="coupon-stat">

            <span>
                🟡 Bekliyor
            </span>

            <strong>
                ${pending}
            </strong>

        </div>


        <div class="coupon-stat">

            <span>
                Başarı
            </span>

            <strong>
                ${
                    percentage === null
                        ? "-"
                        : `%${percentage.toFixed(1)}`
                }
            </strong>

        </div>

    `;
}


/* =========================================================
   KUPONLARI RENDER
========================================================= */

function renderCoupons() {

    if (!couponList) {
        return;
    }


    const coupons =
        getCouponsForDate(
            selectedDate
        );


    renderStats(
        coupons
    );


    if (!coupons.length) {

        couponList.innerHTML = `

            <div class="empty-coupon">

                Bu tarih için kayıtlı kupon bulunmuyor.

            </div>

        `;

        return;
    }


    couponList.innerHTML =
        coupons.map(
            (coupon, index) =>
                renderCoupon(
                    coupon,
                    index + 1
                )
        ).join("");
}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

    if (
        !calendarDays ||
        !calendarMonth
    ) {
        return;
    }


    const year =
        calendarDate.getFullYear();


    const month =
        calendarDate.getMonth();


    calendarMonth.textContent =
        calendarDate.toLocaleDateString(
            "tr-TR",
            {
                month: "long",
                year: "numeric"
            }
        );


    calendarDays.innerHTML = "";


    const first =
        new Date(
            year,
            month,
            1
        );


    let start =
        first.getDay();


    start =
        start === 0
            ? 6
            : start - 1;


    const days =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    for (
        let i = 0;
        i < start;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "calendar-day empty";


        calendarDays.appendChild(
            empty
        );
    }


    const today =
        new Date();


    for (
        let day = 1;
        day <= days;
        day++
    ) {

        const date =
            new Date(
                year,
                month,
                day
            );


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "calendar-day";


        if (
            sameDate(
                date,
                selectedDate
            )
        ) {

            button.classList.add(
                "selected"
            );
        }


        if (
            sameDate(
                date,
                today
            )
        ) {

            button.classList.add(
                "today"
            );
        }


        button.textContent =
            day;


        button.addEventListener(
            "click",
            () => {

                selectedDate =
                    new Date(date);


                calendarDate =
                    new Date(date);


                if (
                    selectedDateText
                ) {

                    selectedDateText.textContent =
                        selectedDate.toLocaleDateString(
                            "tr-TR",
                            {
                                weekday: "long",
                                day: "2-digit",
                                month: "long",
                                year: "numeric"
                            }
                        );
                }


                renderCalendar();

                renderCoupons();
            }
        );


        calendarDays.appendChild(
            button
        );
    }
}


/* =========================================================
   VERİ YÜKLE
========================================================= */

async function loadData() {

    try {

        const response =
            await fetch(
                `${DATA_URL}?v=${Date.now()}`,
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Veri dosyası yüklenemedi."
            );
        }


        const data =
            await response.json();


        if (
            Array.isArray(data)
        ) {

            allMatches =
                data;

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
                "matches.json formatı geçersiz."
            );
        }


        analysisCache.clear();


        renderCalendar();

        renderCoupons();

    } catch (error) {

        console.error(error);


        if (couponList) {

            couponList.innerHTML = `

                <div class="empty-coupon">

                    Veri yüklenemedi.

                    <br><br>

                    ${escapeHtml(
                        error.message
                    )}

                </div>

            `;
        }
    }
}


/* =========================================================
   BAŞLAT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const today =
            new Date();


        selectedDate =
            new Date(today);


        calendarDate =
            new Date(today);


        if (
            selectedDateText
        ) {

            selectedDateText.textContent =
                today.toLocaleDateString(
                    "tr-TR",
                    {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric"
                    }
                );
        }


        if (prevMonth) {

            prevMonth.addEventListener(
                "click",
                () => {

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

                    calendarDate.setMonth(
                        calendarDate.getMonth() + 1
                    );


                    renderCalendar();
                }
            );
        }


        loadData();

    }
);
