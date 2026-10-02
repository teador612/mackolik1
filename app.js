"use strict";


/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;

const MIN_SAMPLE = 5;

const MIN_SUCCESS = 70;


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

const content = document.getElementById("content");
const message = document.getElementById("message");
const updatedAt = document.getElementById("updatedAt");

const summary = document.getElementById("summary");

const searchInput = document.getElementById("search");
const leagueFilter = document.getElementById("leagueFilter");
const unplayedOnly = document.getElementById("unplayedOnly");

const refreshButton = document.getElementById("refreshButton");

const calendarToggle = document.getElementById("calendarToggle");
const calendarPopup = document.getElementById("calendarPopup");
const calendarMonth = document.getElementById("calendarMonth");
const calendarDays = document.getElementById("calendarDays");

const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

const selectedDateText =
    document.getElementById("selectedDateText");

const pageTitle =
    document.getElementById("pageTitle");

const pageDescription =
    document.getElementById("pageDescription");


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


function pad(number) {

    return String(number).padStart(2, "0");
}


function dateKey(date) {

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}


function addDays(date, days) {

    const result = new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;
}


function sameDate(a, b) {

    return dateKey(a) === dateKey(b);
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


    /*
       DD.MM.YYYY
       DD-MM-YYYY
       DD/MM/YYYY
    */

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


    /*
       YYYY-MM-DD
    */

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


    if (!isNaN(parsed.getTime())) {

        return new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
        );
    }


    return null;
}


function formatDateTR(date) {

    return date.toLocaleDateString(
        "tr-TR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    );
}


/* =========================================================
   ALANLAR
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
    ) || "Lig belirtilmemiş";
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

    const direct =
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


    return parseScore(direct);
}


function getHalfTimeScore(match) {

    const direct =
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


    return parseScore(direct);
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


    /*
       BİREBİR EŞLEŞME

       1.85 = 1.85
       1.85 != 1.86
    */

    return number.toFixed(2);
}


function getOdds(match, names) {

    const direct =
        getValue(match, names);


    if (direct !== undefined) {

        return normalizeOdds(direct);
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


        const value =
            getValue(
                container,
                names
            );


        if (value !== undefined) {

            return normalizeOdds(value);
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
        title: "İY 1.5 Üst",

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


        if (marketId === "MS2") {

            return score.away > score.home;
        }
    }


    if (
        marketId === "IY1" ||
        marketId === "IYX" ||
        marketId === "IY2" ||
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


        if (marketId === "IY15U") {

            return (
                score.home +
                score.away
            ) >= 2;
        }
    }


    return null;
}


/* =========================================================
   60 GÜNLÜK GEÇMİŞ
========================================================= */

function getHistoryMatches(
    targetDate
) {

    const end =
        new Date(targetDate);


    end.setHours(
        0, 0, 0, 0
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
                0, 0, 0, 0
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
   ANALİZ İNDEKSİ
========================================================= */

function buildAnalysisIndex(
    targetDate
) {

    const key =
        dateKey(targetDate);


    if (
        analysisCache.has(key)
    ) {

        return analysisCache.get(key);
    }


    const history =
        getHistoryMatches(
            targetDate
        );


    const index =
        new Map();


    for (
        const historical
        of history
    ) {

        for (
            const source
            of MARKETS
        ) {

            const odds =
                source.odds(
                    historical
                );


            if (!odds) {
                continue;
            }


            const key =
                `${source.id}|${odds}`;


            if (!index.has(key)) {

                index.set(
                    key,
                    []
                );
            }


            index.get(key).push(
                historical
            );
        }
    }


    analysisCache.set(
        key,
        index
    );


    return index;
}


/* =========================================================
   TAHMİNLER
========================================================= */

function getRecommendations(
    match,
    targetDate
) {

    const index =
        buildAnalysisIndex(
            targetDate
        );


    const recommendations = [];


    /*
       Mevcut maçın her oranını
       geçmişteki aynı oranla eşleştir.
    */

    for (
        const source
        of MARKETS
    ) {

        const sourceOdds =
            source.odds(match);


        if (!sourceOdds) {
            continue;
        }


        const sourceKey =
            `${source.id}|${sourceOdds}`;


        const historicalMatches =
            index.get(sourceKey) || [];


        if (
            historicalMatches.length <
            MIN_SAMPLE
        ) {
            continue;
        }


        /*
           Aynı oran hangi sonucu
           doğurmuş?
        */

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
                const historical
                of historicalMatches
            ) {

                const result =
                    getMarketOutcome(
                        historical,
                        target.id
                    );


                if (
                    result === null
                ) {
                    continue;
                }


                total++;


                if (result === true) {
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

                success,

                total,

                percentage

            });
        }
    }


    /*
       En başarılı üstte.
    */

    recommendations.sort(
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


    /*
       Aynı kombinasyonu tekrar gösterme.
    */

    const unique = [];
    const seen = new Set();


    for (
        const item
        of recommendations
    ) {

        const key =
            [
                item.sourceMarket,
                item.sourceOdds,
                item.targetMarket
            ].join("|");


        if (
            seen.has(key)
        ) {
            continue;
        }


        seen.add(key);

        unique.push(item);
    }


    return unique;
}


/* =========================================================
   TAHMİN DURUMU
========================================================= */

function getRecommendationStatus(
    match,
    recommendation
) {

    if (
        !isPlayed(match)
    ) {

        return "pending";
    }


    const result =
        getMarketOutcome(
            match,
            recommendation.targetMarket
        );


    if (
        result === true
    ) {

        return "success";
    }


    return "failed";
}


/* =========================================================
   TAHMİN HTML
========================================================= */

function recommendationHtml(
    match,
    recommendation
) {

    const status =
        getRecommendationStatus(
            match,
            recommendation
        );


    return `

        <div class="recommendation ${status}">

            <span class="recommendation-dot"></span>

            <div class="recommendation-main">

                <div class="recommendation-line">

                    <strong>
                        ${escapeHtml(
                            recommendation.sourceTitle
                        )}
                    </strong>

                    <span class="odd">
                        ${escapeHtml(
                            recommendation.sourceOdds
                        )}
                    </span>

                    <span class="arrow">
                        →
                    </span>

                    <strong>
                        ${escapeHtml(
                            recommendation.targetTitle
                        )}
                    </strong>

                </div>


                <div class="recommendation-stats">

                    ${recommendation.success}
                    /
                    ${recommendation.total}

                    ·

                    %${recommendation.percentage.toFixed(1)}

                </div>

            </div>

        </div>

    `;
}


/* =========================================================
   SKOR
========================================================= */

function scoreHtml(match) {

    const ht =
        getHalfTimeScore(match);

    const ft =
        getFullTimeScore(match);


    if (!ht && !ft) {
        return "";
    }


    let html =
        `<div class="scores">`;


    if (ht) {

        html += `

            <span>
                İY
                ${ht.home}-${ht.away}
            </span>

        `;
    }


    if (ft) {

        html += `

            <span>
                MS
                ${ft.home}-${ft.away}
            </span>

        `;
    }


    html += `
        </div>
    `;


    return html;
}


/* =========================================================
   MAÇ KARTI
========================================================= */

function matchHtml(
    match,
    recommendations,
    index
) {

    const first =
        recommendations[0];


    const extra =
        recommendations.slice(1);


    let html = `

        <article class="match-card">

            <div class="match-top">

                <span class="match-time">
                    ${escapeHtml(
                        getTime(match)
                    )}
                </span>

                <span class="match-league">
                    ${escapeHtml(
                        getLeague(match)
                    )}
                </span>

            </div>


            <div class="teams">

                <div class="team home">
                    ${escapeHtml(
                        getHome(match)
                    )}
                </div>


                <div class="vs">
                    VS
                </div>


                <div class="team away">
                    ${escapeHtml(
                        getAway(match)
                    )}
                </div>

            </div>


            ${scoreHtml(match)}


            <div class="recommendations">

                <div class="recommendation-list">

                    ${recommendationHtml(
                        match,
                        first
                    )}

                </div>
    `;


    if (
        extra.length
    ) {

        html += `

            <button
                class="more-recommendations"
                type="button"
                data-index="${index}"
            >
                +${extra.length}
            </button>


            <div
                id="extra-${index}"
                class="extra-recommendations hidden"
            >

                ${extra.map(
                    item =>
                        recommendationHtml(
                            match,
                            item
                        )
                ).join("")}

            </div>

        `;
    }


    html += `

            </div>

        </article>

    `;


    return html;
}


/* =========================================================
   FİLTRELENMİŞ MAÇLAR
========================================================= */

function getDayMatches() {

    const key =
        dateKey(selectedDate);


    let result =
        allMatches.filter(
            match => {

                const date =
                    parseDate(
                        getDate(match)
                    );


                if (!date) {
                    return false;
                }


                return (
                    dateKey(date) ===
                    key
                );
            }
        );


    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLocaleLowerCase(
                    "tr-TR"
                )
            : "";


    if (search) {

        result =
            result.filter(
                match => {

                    const text =
                        [
                            getHome(match),
                            getAway(match),
                            getLeague(match)
                        ]
                            .join(" ")
                            .toLocaleLowerCase(
                                "tr-TR"
                            );


                    return text.includes(
                        search
                    );
                }
            );
    }


    const league =
        leagueFilter
            ? leagueFilter.value
            : "";


    if (league) {

        result =
            result.filter(
                match =>
                    getLeague(match) ===
                    league
            );
    }


    if (
        unplayedOnly &&
        unplayedOnly.checked
    ) {

        result =
            result.filter(
                match =>
                    !isPlayed(match)
            );
    }


    result.sort(
        (a, b) =>
            String(
                getTime(a)
            ).localeCompare(
                String(getTime(b))
            )
    );


    return result;
}


/* =========================================================
   BAŞARI ÖZETİ
========================================================= */

function calculateTodaySummary(
    predictedMatches
) {

    let success = 0;
    let total = 0;


    for (
        const item
        of predictedMatches
    ) {

        if (
            !isPlayed(item.match)
        ) {
            continue;
        }


        for (
            const rec
            of item.recommendations
        ) {

            total++;


            const result =
                getMarketOutcome(
                    item.match,
                    rec.targetMarket
                );


            if (
                result === true
            ) {
                success++;
            }
        }
    }


    return {
        success,
        total,
        percentage:
            total
                ? (success / total) * 100
                : null
    };
}


/*
   Son 60 günlük başarı:

   Seçilen günün analizinde kullanılan
   son 60 günlük geçmişteki tüm
   source → target kombinasyonlarının
   gerçek başarı oranı.
*/

function calculate60DaySummary() {

    const history =
        getHistoryMatches(
            selectedDate
        );


    let success = 0;
    let total = 0;


    const index =
        buildAnalysisIndex(
            selectedDate
        );


    /*
       Sadece en az 5 örnek ve %70+
       seviyesine ulaşan source oranlarını
       hesapla.
    */

    for (
        const [key, historicalMatches]
        of index.entries()
    ) {

        if (
            historicalMatches.length <
            MIN_SAMPLE
        ) {
            continue;
        }


        const parts =
            key.split("|");


        const sourceMarket =
            parts[0];


        /*
           Her hedef market için
           gerçek geçmiş sonucu hesapla.
        */

        for (
            const target
            of MARKETS
        ) {

            if (
                target.id ===
                sourceMarket
            ) {
                continue;
            }


            let localTotal = 0;
            let localSuccess = 0;


            for (
                const match
                of historicalMatches
            ) {

                const result =
                    getMarketOutcome(
                        match,
                        target.id
                    );


                if (
                    result === null
                ) {
                    continue;
                }


                localTotal++;


                if (
                    result === true
                ) {
                    localSuccess++;
                }
            }


            if (
                localTotal <
                MIN_SAMPLE
            ) {
                continue;
            }


            const percentage =
                (
                    localSuccess /
                    localTotal
                ) * 100;


            if (
                percentage >=
                MIN_SUCCESS
            ) {

                success +=
                    localSuccess;

                total +=
                    localTotal;
            }
        }
    }


    return {
        success,
        total,
        percentage:
            total
                ? (success / total) * 100
                : null
    };
}


function renderSummary(
    predictedMatches
) {

    if (!summary) {
        return;
    }


    const today =
        calculateTodaySummary(
            predictedMatches
        );


    const sixty =
        calculate60DaySummary();


    const todayPercentage =
        today.percentage === null
            ? "-"
            : `%${today.percentage.toFixed(1)}`;


    const sixtyPercentage =
        sixty.percentage === null
            ? "-"
            : `%${sixty.percentage.toFixed(1)}`;


    summary.innerHTML = `

        <div class="summary-grid">

            <div class="summary-card">

                <span class="summary-label">
                    BUGÜN
                </span>

                <strong>
                    ${todayPercentage}
                </strong>

                <small>
                    ${today.success}/${today.total}
                    gerçekleşen tahmin
                </small>

            </div>


            <div class="summary-card">

                <span class="summary-label">
                    SON 60 GÜN
                </span>

                <strong>
                    ${sixtyPercentage}
                </strong>

                <small>
                    ${sixty.success}/${sixty.total}
                    başarılı sonuç
                </small>

            </div>

        </div>

    `;
}


/* =========================================================
   LİG FİLTRESİ
========================================================= */

function fillLeagueFilter() {

    if (!leagueFilter) {
        return;
    }


    const leagues =
        new Set();


    for (
        const match
        of allMatches
    ) {

        const league =
            getLeague(match);


        if (league) {
            leagues.add(league);
        }
    }


    const sorted =
        [...leagues].sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "tr"
                )
        );


    leagueFilter.innerHTML =
        `
            <option value="">
                Tüm Ligler
            </option>
        `;


    for (
        const league
        of sorted
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            league;


        option.textContent =
            league;


        leagueFilter.appendChild(
            option
        );
    }
}


/* =========================================================
   RENDER
========================================================= */

function render() {

    if (!selectedDate) {
        return;
    }


    const allDay =
        getDayMatches();


    /*
       Tahmini olan maçları bul.
    */

    const predicted = [];


    for (
        const match
        of allDay
    ) {

        const recommendations =
            getRecommendations(
                match,
                selectedDate
            );


        /*
           TAHMİN YOKSA MAÇI
           HİÇ GÖSTERME.
        */

        if (
            recommendations.length
        ) {

            predicted.push({

                match,

                recommendations

            });
        }
    }


    /*
       Başlık
    */

    const today =
        new Date();


    today.setHours(
        0, 0, 0, 0
    );


    if (
        sameDate(
            selectedDate,
            today
        )
    ) {

        pageTitle.textContent =
            "Bugünün Maçları";

    } else {

        pageTitle.textContent =
            `${formatDateTR(
                selectedDate
            )} Maçları`;
    }


    pageDescription.textContent =
        `Geçmiş ${HISTORY_DAYS} gündeki birebir aynı oranlar analiz ediliyor.`;


    /*
       Özet
    */

    renderSummary(
        predicted
    );


    /*
       Durum
    */

    const history =
        getHistoryMatches(
            selectedDate
        );


    if (message) {

        message.textContent =
            `${predicted.length} tahminli maç · ${history.length} geçmiş maç analiz edildi`;
    }


    if (updatedAt) {

        const start =
            addDays(
                selectedDate,
                -HISTORY_DAYS
            );


        const end =
            addDays(
                selectedDate,
                -1
            );


        updatedAt.textContent =
            `Geçmiş: ${formatDateTR(start)} - ${formatDateTR(end)}`;
    }


    /*
       Hiç tahmin yok.
    */

    if (
        !predicted.length
    ) {

        content.innerHTML = `

            <div class="empty-state">

                Bu tarihte uygun tahmin bulunamadı.

            </div>

        `;

        return;
    }


    /*
       Maçları göster.
    */

    content.innerHTML = `

        <div class="match-list">

            ${predicted.map(
                (item, index) =>
                    matchHtml(
                        item.match,
                        item.recommendations,
                        index
                    )
            ).join("")}

        </div>

    `;
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


    /*
       Pazartesi = 0
    */

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


    today.setHours(
        0, 0, 0, 0
    );


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


                if (
                    calendarPopup
                ) {

                    calendarPopup.classList.add(
                        "hidden"
                    );
                }


                renderCalendar();

                render();
            }
        );


        calendarDays.appendChild(
            button
        );
    }
}


/* =========================================================
   BUGÜN
========================================================= */

function setToday() {

    const today =
        new Date();


    today.setHours(
        0, 0, 0, 0
    );


    /*
       ÖNEMLİ:

       Veri içindeki en yeni tarihi
       kullanmıyoruz.

       HER ZAMAN BUGÜN.
    */

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
}


/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {

    if (calendarToggle) {

        calendarToggle.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                calendarPopup.classList.toggle(
                    "hidden"
                );
            }
        );
    }


    if (prevMonth) {

        prevMonth.addEventListener(
            "click",
            event => {

                event.stopPropagation();


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
            event => {

                event.stopPropagation();


                calendarDate.setMonth(
                    calendarDate.getMonth() + 1
                );


                renderCalendar();
            }
        );
    }


    document.addEventListener(
        "click",
        event => {

            if (
                calendarPopup &&
                calendarToggle &&
                !calendarPopup.contains(
                    event.target
                ) &&
                !calendarToggle.contains(
                    event.target
                )
            ) {

                calendarPopup.classList.add(
                    "hidden"
                );
            }
        }
    );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            render
        );
    }


    if (leagueFilter) {

        leagueFilter.addEventListener(
            "change",
            render
        );
    }


    if (unplayedOnly) {

        unplayedOnly.addEventListener(
            "change",
            render
        );
    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            () => {

                analysisCache.clear();

                loadData(true);
            }
        );
    }


    /*
       Diğer tahminleri aç/kapat.
    */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".more-recommendations"
                );


            if (!button) {
                return;
            }


            const index =
                button.dataset.index;


            const extra =
                document.getElementById(
                    `extra-${index}`
                );


            if (!extra) {
                return;
            }


            const isHidden =
                extra.classList.toggle(
                    "hidden"
                );


            button.textContent =
                isHidden
                    ? `+${extra.children.length}`
                    : "−";
        }
    );
}


/* =========================================================
   VERİ YÜKLE
========================================================= */

async function loadData(
    forceRefresh = false
) {

    try {

        message.textContent =
            "Veriler yükleniyor...";


        content.innerHTML = `

            <div class="empty-state">

                Veriler yükleniyor...

            </div>

        `;


        const url =
            forceRefresh
                ? `${DATA_URL}?v=${Date.now()}`
                : DATA_URL;


        const response =
            await fetch(
                url,
                {
                    cache:
                        forceRefresh
                            ? "no-store"
                            : "default"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Veri dosyası yüklenemedi: ${response.status}`
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


        /*
           Tarihi olmayan kayıtları çıkar.
        */

        allMatches =
            allMatches.filter(
                match =>
                    !!parseDate(
                        getDate(match)
                    )
            );


        if (
            !allMatches.length
        ) {

            throw new Error(
                "Geçerli maç bulunamadı."
            );
        }


        analysisCache.clear();


        fillLeagueFilter();


        /*
           DAİMA BUGÜN
        */

        setToday();


        renderCalendar();

        render();


        const now =
            new Date();


        if (updatedAt) {

            updatedAt.textContent +=
                ` · Güncellendi ${
                    now.toLocaleTimeString(
                        "tr-TR",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    )
                }`;
        }

    } catch (error) {

        console.error(error);


        message.textContent =
            "Veri yüklenemedi";


        content.innerHTML = `

            <div class="empty-state">

                <strong>
                    Veri yükleme hatası
                </strong>

                <br>

                <small>
                    ${escapeHtml(
                        error.message
                    )}
                </small>

            </div>

        `;
    }
}


/* =========================================================
   BAŞLAT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        setToday();

        renderCalendar();

        loadData();

    }
);
