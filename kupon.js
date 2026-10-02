"use strict";


/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL =
    "./data/matches.json";

const HISTORY_DAYS = 60;

const MIN_SAMPLE = 5;

const MIN_SUCCESS = 70;

const MAX_COUPONS = 3;

const MAX_MATCHES =
    5;

const MIN_TOTAL_ODDS =
    2.00;

const STORAGE_KEY =
    "mackolik_coupon_history_v1";


/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];

let selectedDate =
    new Date();

let calendarDate =
    new Date();


/* =========================================================
   DOM
========================================================= */

const calendar =
    document.getElementById(
        "calendar"
    );

const monthTitle =
    document.getElementById(
        "monthTitle"
    );

const selectedDateBox =
    document.getElementById(
        "selectedDate"
    );

const couponList =
    document.getElementById(
        "couponList"
    );

const statistics =
    document.getElementById(
        "statistics"
    );

const prevMonth =
    document.getElementById(
        "prevMonth"
    );

const nextMonth =
    document.getElementById(
        "nextMonth"
    );


/* =========================================================
   YARDIMCI
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function pad(number) {

    return String(number)
        .padStart(2, "0");
}


function dateKey(date) {

    return [
        date.getFullYear(),
        pad(
            date.getMonth() + 1
        ),
        pad(
            date.getDate()
        )
    ].join("-");
}


function addDays(
    date,
    days
) {

    const result =
        new Date(date);

    result.setDate(
        result.getDate() +
        days
    );

    return result;
}


function parseDate(value) {

    if (!value) {
        return null;
    }


    if (
        value instanceof Date
    ) {

        if (
            isNaN(
                value.getTime()
            )
        ) {
            return null;
        }

        return new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate()
        );
    }


    const text =
        String(value)
            .trim();


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


    if (
        !isNaN(
            parsed.getTime()
        )
    ) {

        return new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
        );
    }


    return null;
}


function getValue(
    object,
    keys
) {

    if (
        !object ||
        typeof object !==
            "object"
    ) {

        return undefined;
    }


    for (
        const key of keys
    ) {

        if (
            object[key] !==
                undefined &&
            object[key] !==
                null &&
            object[key] !== ""
        ) {

            return object[key];
        }
    }


    return undefined;
}


/* =========================================================
   MAÇ ALANLARI
========================================================= */

function getDate(match) {

    return getValue(
        match,
        [
            "date",
            "Date",
            "tarih",
            "Tarih",
            "matchDate",
            "match_date"
        ]
    );
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
    ) || "";
}


/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {

    if (!value) {
        return null;
    }


    if (
        typeof value ===
        "object"
    ) {

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
        String(value)
            .trim();


    const match =
        text.match(
            /(\d+)\s*[-:]\s*(\d+)/
        );


    if (!match) {
        return null;
    }


    return {

        home:
            Number(match[1]),

        away:
            Number(match[2])
    };
}


function getFullTimeScore(
    match
) {

    const value =
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
        );


    return parseScore(value);
}


function getHalfTimeScore(
    match
) {

    const value =
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
        );


    return parseScore(value);
}


function isPlayed(match) {

    return !!getFullTimeScore(
        match
    );
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


    const number =
        Number(
            String(value)
                .replace(
                    ",",
                    "."
                )
                .trim()
        );


    if (
        !Number.isFinite(number)
    ) {

        return null;
    }


    return number.toFixed(2);
}


function getOdds(
    match,
    names
) {

    const direct =
        getValue(
            match,
            names
        );


    if (
        direct !== undefined
    ) {

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
            value !==
            undefined
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
        id: "IY15U",

        title:
            "İY 1.5 Üst",

        odds: match =>
            getOdds(
                match,
                [
                    "iy15U",
                    "IY15U",
                    "iy1_5U",
                    "iy1_5Over",
                    "iy15Over",
                    "IY1.5U",
                    "İY1.5Ü",
                    "iy1.5ust",
                    "iy15ust"
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
            getFullTimeScore(
                match
            );


        if (!score) {
            return null;
        }


        if (
            marketId === "MS1"
        ) {

            return (
                score.home >
                score.away
            );
        }


        if (
            marketId === "MSX"
        ) {

            return (
                score.home ===
                score.away
            );
        }


        return (
            score.away >
            score.home
        );
    }


    const score =
        getHalfTimeScore(
            match
        );


    if (!score) {
        return null;
    }


    if (
        marketId === "IY1"
    ) {

        return (
            score.home >
            score.away
        );
    }


    if (
        marketId === "IYX"
    ) {

        return (
            score.home ===
            score.away
        );
    }


    if (
        marketId === "IY2"
    ) {

        return (
            score.away >
            score.home
        );
    }


    if (
        marketId === "IY15U"
    ) {

        return (
            score.home +
            score.away
        ) >= 2;
    }


    return null;
}


/* =========================================================
   TARİHİN GEÇMİŞİ
========================================================= */

function getHistoryMatches(
    targetDate
) {

    const end =
        new Date(
            targetDate
        );

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
                    getDate(match)
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

function getRecommendations(
    match,
    targetDate
) {

    const history =
        getHistoryMatches(
            targetDate
        );


    const recommendations = [];


    for (
        const source
        of MARKETS
    ) {

        const sourceOdds =
            source.odds(
                match
            );


        if (!sourceOdds) {
            continue;
        }


        const historical =
            history.filter(
                item =>
                    source.odds(
                        item
                    ) ===
                    sourceOdds
            );


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


            let total = 0;

            let success = 0;


            for (
                const item
                of historical
            ) {

                const result =
                    getMarketOutcome(
                        item,
                        target.id
                    );


                if (
                    result === null
                ) {

                    continue;
                }


                total++;


                if (
                    result === true
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


            const targetOdds =
                target.odds(
                    match
                );


            if (!targetOdds) {
                continue;
            }


            recommendations.push({

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


    recommendations.sort(
        (a, b) => {

            if (
                b.total !==
                a.total
            ) {

                return (
                    b.total -
                    a.total
                );
            }


            return (
                b.percentage -
                a.percentage
            );
        }
    );


    return recommendations;
}


/* =========================================================
   MAÇ ANAHTARI
========================================================= */

function matchKey(match) {

    const date =
        parseDate(
            getDate(match)
        );


    return [

        date
            ? dateKey(date)
            : "",

        getTime(match),

        getHome(match),

        getAway(match)

    ]
        .join("|")
        .toLowerCase();
}


/* =========================================================
   ADAYLAR
========================================================= */

function getCandidates(
    targetDate
) {

    const targetKey =
        dateKey(
            targetDate
        );


    const matches =
        allMatches.filter(
            match => {

                const date =
                    parseDate(
                        getDate(match)
                    );


                return (
                    date &&
                    dateKey(date) ===
                    targetKey
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
           Her maç için en yüksek
           örneklemli öneriyi seç.
        */

        recommendations.sort(
            (a, b) => {

                if (
                    b.total !==
                    a.total
                ) {

                    return (
                        b.total -
                        a.total
                    );
                }


                return (
                    b.percentage -
                    a.percentage
                );
            }
        );


        const recommendation =
            recommendations[0];


        candidates.push({

            key:
                matchKey(match),

            match,

            recommendation,

            sample:
                recommendation.total,

            percentage:
                recommendation.percentage,

            odds:
                Number(
                    recommendation.targetOdds
                )

        });
    }


    /*
       En yüksek örneklem önce.
    */

    candidates.sort(
        (a, b) => {

            if (
                b.sample !==
                a.sample
            ) {

                return (
                    b.sample -
                    a.sample
                );
            }


            return (
                b.percentage -
                a.percentage
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
        getCandidates(
            targetDate
        );


    const coupons = [];

    const used =
        new Set();


    for (
        let couponNumber = 1;

        couponNumber <=
        MAX_COUPONS;

        couponNumber++
    ) {

        const selections = [];

        let totalOdds = 1;


        for (
            const candidate
            of candidates
        ) {

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


            selections.push(
                candidate
            );


            used.add(
                candidate.key
            );


            totalOdds *=
                candidate.odds;


            if (
                totalOdds >=
                MIN_TOTAL_ODDS
            ) {

                break;
            }
        }


        /*
           2.00'ye ulaşmıyorsa
           kupon oluşturma.
        */

        if (
            totalOdds <
            MIN_TOTAL_ODDS
        ) {

            break;
        }


        coupons.push({

            number:
                couponNumber,

            date:
                dateKey(
                    targetDate
                ),

            totalOdds:
                Number(
                    totalOdds.toFixed(2)
                ),

            selections:
                selections.map(
                    candidate => ({

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
                            candidate
                                .recommendation
                                .targetMarket,

                        targetTitle:
                            candidate
                                .recommendation
                                .targetTitle,

                        targetOdds:
                            candidate.odds,

                        sourceTitle:
                            candidate
                                .recommendation
                                .sourceTitle,

                        sourceOdds:
                            candidate
                                .recommendation
                                .sourceOdds,

                        sample:
                            candidate.sample,

                        percentage:
                            candidate.percentage

                    })
                )
        });
    }


    return coupons;
}


/* =========================================================
   KUPON SONUCU
========================================================= */

function couponResult(
    coupon
) {

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


        if (
            result === false
        ) {

            return "loss";
        }


        if (
            result === null
        ) {

            pending = true;
        }
    }


    if (pending) {

        return "pending";
    }


    return "win";
}


/* =========================================================
   KUPON KAYIT
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


    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
            history
        )
    );
}


function getSavedCoupons(
    date
) {

    const history =
        getHistory();


    return (
        history[date] || []
    );
}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

    const year =
        calendarDate
            .getFullYear();


    const month =
        calendarDate
            .getMonth();


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


    calendar.innerHTML =
        "";


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    let startDay =
        firstDay.getDay();


    /*
       Pazartesi = 0
    */

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


        button.type =
            "button";


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
            allMatches.some(
                match => {

                    const matchDate =
                        parseDate(
                            getDate(
                                match
                            )
                        );


                    return (
                        matchDate &&
                        dateKey(
                            matchDate
                        ) === key
                    );
                }
            );


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


                /*
                   O günün kuponlarını
                   otomatik oluştur/kaydet.
                */

                ensureCoupons(
                    selectedDate
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
   KUPONU GARANTİ ET
========================================================= */

function ensureCoupons(
    date
) {

    const key =
        dateKey(date);


    const existing =
        getSavedCoupons(
            key
        );


    if (
        existing.length
    ) {

        return existing;
    }


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


/* =========================================================
   SEÇİLİ TARİH
========================================================= */

function renderSelectedDate() {

    const key =
        dateKey(
            selectedDate
        );


    const coupons =
        ensureCoupons(
            selectedDate
        );


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

    const history =
        getHistory();


    let total = 0;

    let win = 0;

    let loss = 0;

    let pending = 0;


    Object.values(history)
        .flat()
        .forEach(
            coupon => {

                total++;


                const result =
                    couponResult(
                        coupon
                    );


                if (
                    result ===
                    "win"
                ) {

                    win++;

                } else if (
                    result ===
                    "loss"
                ) {

                    loss++;

                } else {

                    pending++;
                }
            }
        );


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
   KUPON HTML
========================================================= */

function renderCoupons(
    coupons
) {

    couponList.innerHTML =
        "";


    if (
        !coupons.length
    ) {

        couponList.innerHTML = `

            <div class="empty">

                Bu tarih için şartları
                sağlayan kupon bulunamadı.

                <br><br>

                En az
                <strong>
                    ${MIN_SAMPLE}
                </strong>
                örneklem,

                <strong>
                    %${MIN_SUCCESS}
                </strong>
                başarı ve

                <strong>
                    ${MIN_TOTAL_ODDS.toFixed(2)}
                </strong>
                toplam oran gerekiyor.

            </div>

        `;

        return;
    }


    coupons.forEach(
        coupon => {

            const result =
                couponResult(
                    coupon
                );


            let statusText =
                "BEKLİYOR";


            let statusClass =
                "pending";


            if (
                result ===
                "win"
            ) {

                statusText =
                    "TUTTU";

                statusClass =
                    "win";

            } else if (
                result ===
                "loss"
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
                            ${coupon.totalOdds.toFixed(2)}
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


                                <span class="arrow">
                                    →
                                </span>


                                <span>

                                    ${escapeHtml(
                                        selection.sourceTitle
                                    )}

                                    ${escapeHtml(
                                        selection.sourceOdds
                                    )}

                                </span>


                                <span class="sample">

                                    · Örneklem:
                                    ${selection.sample}

                                    ·
                                    %${selection.percentage.toFixed(1)}

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
        }
    );
}


/* =========================================================
   AY DEĞİŞTİR
========================================================= */

prevMonth.addEventListener(
    "click",
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() - 1
        );

        renderCalendar();
    }
);


nextMonth.addEventListener(
    "click",
    () => {

        calendarDate.setMonth(
            calendarDate.getMonth() + 1
        );

        renderCalendar();
    }
);


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

async function loadData() {

    try {

        const response =
            await fetch(
                DATA_URL,
                {
                    cache: "no-store"
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                "Veri alınamadı."
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
            Array.isArray(
                data.matches
            )
        ) {

            allMatches =
                data.matches;

        } else {

            throw new Error(
                "Maç verisi bulunamadı."
            );
        }


        /*
           Veri içerisindeki ilk tarihi
           takvim için başlangıç yap.
        */

        const dates =
            allMatches
                .map(
                    match =>
                        parseDate(
                            getDate(
                                match
                            )
                        )
                )
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        a - b
                );


        if (dates.length) {

            /*
               Bugün varsa bugün,
               yoksa verideki son tarih.
            */

            const today =
                new Date();


            const todayExists =
                dates.some(
                    date =>
                        dateKey(date) ===
                        dateKey(today)
                );


            if (
                todayExists
            ) {

                selectedDate =
                    new Date(today);

            } else {

                selectedDate =
                    new Date(
                        dates[
                            dates.length - 1
                        ]
                    );
            }

            calendarDate =
                new Date(
                    selectedDate
                );
        }


        renderCalendar();

        renderSelectedDate();

    } catch (error) {

        couponList.innerHTML = `

            <div class="empty">

                Veriler yüklenemedi.

                <br><br>

                ${escapeHtml(
                    error.message
                )}

            </div>

        `;
    }
}


/* =========================================================
   BAŞLAT
========================================================= */

loadData();
