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

let selectedDate = null;

let calendarDate = new Date();

let analysisCache = new Map();


/* =========================================================
   DOM
========================================================= */

const content = document.getElementById("content");
const message = document.getElementById("message");
const updatedAt = document.getElementById("updatedAt");

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


function pad(value) {

    return String(value).padStart(2, "0");
}


/* =========================================================
   TARİH
========================================================= */

function dateToKey(date) {

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}


function parseDate(value) {

    if (!value) {
        return null;
    }


    if (value instanceof Date) {

        return new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate()
        );
    }


    const text =
        String(value).trim();


    /* DD.MM.YYYY */

    let match =
        text.match(
            /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
        );


    if (match) {

        return new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );
    }


    /* YYYY-MM-DD */

    match =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
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
        !Number.isNaN(
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


function formatDateTR(date) {

    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
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


/* =========================================================
   MAÇ BİLGİLERİ
========================================================= */

function getDate(match) {

    return getValue(match, [
        "date",
        "Date",
        "tarih",
        "Tarih"
    ]);
}


function getHome(match) {

    return getValue(match, [
        "home",
        "Home",
        "homeTeam",
        "home_team",
        "ev",
        "Ev"
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
        "Saat"
    ]) || "";
}


function getLeague(match) {

    return getValue(match, [
        "league",
        "League",
        "lig",
        "Lig"
    ]) || "Lig belirtilmemiş";
}


/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {

    if (!value) {
        return null;
    }


    if (
        typeof value === "object"
    ) {

        const home =
            getValue(value, [
                "home",
                "Home",
                "ev",
                "h"
            ]);


        const away =
            getValue(value, [
                "away",
                "Away",
                "deplasman",
                "a"
            ]);


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

    const score =
        getValue(match, [
            "score",
            "Score",
            "fullTimeScore",
            "fulltimeScore",
            "ftScore"
        ]);


    const parsed =
        parseScore(score);


    if (parsed) {
        return parsed;
    }


    return parseScore(
        getValue(match, [
            "ft",
            "FT",
            "fullTime",
            "FullTime",
            "ms",
            "MS",
            "macSonucu",
            "MaçSonucu"
        ])
    );
}


function getHalfTimeScore(match) {

    const score =
        getValue(match, [
            "halfTimeScore",
            "halftimeScore",
            "half_score",
            "htScore",
            "HTScore"
        ]);


    const parsed =
        parseScore(score);


    if (parsed) {
        return parsed;
    }


    return parseScore(
        getValue(match, [
            "ht",
            "HT",
            "halfTime",
            "half",
            "iy",
            "IY",
            "ilkYari"
        ])
    );
}


function isPlayed(match) {

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
       Birebir eşleşme.

       1.85 = 1.85
       1.85 != 1.86
    */

    return number.toFixed(2);
}


function getOdds(match, keys) {

    const direct =
        getValue(match, keys);


    if (direct !== undefined) {

        return normalizeOdds(direct);
    }


    const containers = [
        match.openingOdds,
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
                keys
            );


        if (value !== undefined) {

            return normalizeOdds(value);
        }
    }


    return null;
}


/* =========================================================
   MARKET ORANLARI
========================================================= */

const MARKETS = [

    {
        id: "MS1",
        title: "MS 1",

        odds: match =>
            getOdds(match, [
                "ms1",
                "MS1",
                "1",
                "MS_1"
            ])
    },


    {
        id: "MSX",
        title: "MS X",

        odds: match =>
            getOdds(match, [
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

        odds: match =>
            getOdds(match, [
                "ms2",
                "MS2",
                "2",
                "MS_2"
            ])
    },


    {
        id: "IY1",
        title: "İY 1",

        odds: match =>
            getOdds(match, [
                "iy1",
                "IY1",
                "İY1",
                "iy_1"
            ])
    },


    {
        id: "IYX",
        title: "İY X",

        odds: match =>
            getOdds(match, [
                "iyX",
                "iyx",
                "IYX",
                "iy0",
                "IY0",
                "İYX"
            ])
    },


    {
        id: "IY2",
        title: "İY 2",

        odds: match =>
            getOdds(match, [
                "iy2",
                "IY2",
                "İY2",
                "iy_2"
            ])
    },


    {
        id: "IY15U",
        title: "İY 1.5 Üst",

        odds: match =>
            getOdds(match, [
                "iy15U",
                "iy1_5U",
                "iy1_5Over",
                "iy15Over",
                "IY1.5U",
                "İY1.5Ü",
                "iy1.5ust",
                "iy15ust"
            ])
    }

];


/* =========================================================
   MARKET SONUCU
========================================================= */

function getMarketOutcome(
    match,
    market
) {

    let score;


    /* MS 1 */

    if (market === "MS1") {

        score =
            getFullTimeScore(match);


        if (!score) {
            return null;
        }


        return score.home > score.away
            ? "win"
            : "lose";
    }


    /* MS X */

    if (market === "MSX") {

        score =
            getFullTimeScore(match);


        if (!score) {
            return null;
        }


        return score.home === score.away
            ? "win"
            : "lose";
    }


    /* MS 2 */

    if (market === "MS2") {

        score =
            getFullTimeScore(match);


        if (!score) {
            return null;
        }


        return score.away > score.home
            ? "win"
            : "lose";
    }


    /* İY 1 */

    if (market === "IY1") {

        score =
            getHalfTimeScore(match);


        if (!score) {
            return null;
        }


        return score.home > score.away
            ? "win"
            : "lose";
    }


    /* İY X */

    if (market === "IYX") {

        score =
            getHalfTimeScore(match);


        if (!score) {
            return null;
        }


        return score.home === score.away
            ? "win"
            : "lose";
    }


    /* İY 2 */

    if (market === "IY2") {

        score =
            getHalfTimeScore(match);


        if (!score) {
            return null;
        }


        return score.away > score.home
            ? "win"
            : "lose";
    }


    /* İY 1.5 ÜST */

    if (market === "IY15U") {

        score =
            getHalfTimeScore(match);


        if (!score) {
            return null;
        }


        const total =
            score.home +
            score.away;


        return total >= 2
            ? "win"
            : "lose";
    }


    return null;
}


/* =========================================================
   SON 60 GÜN
========================================================= */

function getHistoryMatches(targetDate) {

    const end =
        new Date(targetDate);


    end.setHours(
        0,
        0,
        0,
        0
    );


    const start =
        new Date(end);


    start.setDate(
        start.getDate() - HISTORY_DAYS
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
   GEÇMİŞ ORAN INDEX
========================================================= */

function buildAnalysisIndex(
    targetDate
) {

    const cacheKey =
        dateToKey(targetDate);


    if (
        analysisCache.has(
            cacheKey
        )
    ) {

        return analysisCache.get(
            cacheKey
        );
    }


    const history =
        getHistoryMatches(
            targetDate
        );


    const index =
        new Map();


    for (const match of history) {

        for (const market of MARKETS) {

            const odds =
                market.odds(match);


            if (!odds) {
                continue;
            }


            const key =
                `${market.id}|${odds}`;


            if (!index.has(key)) {

                index.set(
                    key,
                    []
                );
            }


            index
                .get(key)
                .push(match);
        }
    }


    analysisCache.set(
        cacheKey,
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
       ÖNEMLİ:

       Kaynak oran:

       İY 1.5 Üst 1.85

       Geçmişte birebir:

       İY 1.5 Üst 1.85

       olan maçları buluyoruz.

       Daha sonra bunların MS1,
       MSX, MS2 vb. sonuçlarına bakıyoruz.
    */

    for (
        const source of MARKETS
    ) {

        const sourceOdds =
            source.odds(match);


        if (!sourceOdds) {
            continue;
        }


        const sourceKey =
            `${source.id}|${sourceOdds}`;


        const historicalMatches =
            index.get(sourceKey);


        if (
            !historicalMatches ||
            historicalMatches.length <
                MIN_SAMPLE
        ) {

            continue;
        }


        for (
            const target of MARKETS
        ) {

            let success = 0;

            let total = 0;


            for (
                const oldMatch
                of historicalMatches
            ) {

                const result =
                    getMarketOutcome(
                        oldMatch,
                        target.id
                    );


                if (!result) {
                    continue;
                }


                total++;


                if (
                    result === "win"
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


            recommendations.push({

                source:
                    source.title,

                sourceMarket:
                    source.id,

                sourceOdds:


                    sourceOdds,


                target:
                    target.title,

                targetMarket:
                    target.id,


                success:
                    success,

                total:
                    total,

                percentage:
                    percentage
            });
        }
    }


    /*
       En yüksek başarı oranı
       önce.

       Eşitse örnek sayısı fazla
       olan önce.
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


    return recommendations;
}


/* =========================================================
   TAHMİN DURUMU
========================================================= */

function getRecommendationStatus(
    match,
    recommendation
) {

    if (!isPlayed(match)) {

        return "yellow";
    }


    const result =
        getMarketOutcome(
            match,
            recommendation.targetMarket
        );


    return result === "win"
        ? "green"
        : "red";
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
        <div class="
            recommendation
            status-${status}
        ">

            <div class="rec-left">

                <span class="rec-status"></span>

                <span class="rec-market">

                    ${escapeHtml(
                        recommendation.source
                    )}

                    <b>
                        ${escapeHtml(
                            recommendation.sourceOdds
                        )}
                    </b>

                    →

                    ${escapeHtml(
                        recommendation.target
                    )}

                </span>

            </div>


            <span class="rec-stat">

                ${recommendation.success}/${recommendation.total}

                ·

                ${recommendation.percentage.toFixed(1)}%

            </span>

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


    let html = `
        <div class="scores">
    `;


    if (ht) {

        html += `
            <span>
                İY
                <span class="score-value">
                    ${ht.home}-${ht.away}
                </span>
            </span>
        `;
    }


    if (ft) {

        html += `
            <span>
                MS
                <span class="score-value">
                    ${ft.home}-${ft.away}
                </span>
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
    targetDate,
    index
) {

    const recommendations =
        getRecommendations(
            match,
            targetDate
        );


    let analysisHtml;


    if (
        recommendations.length === 0
    ) {

        analysisHtml = `
            <div class="no-prediction">
                Tahmin yok
            </div>
        `;

    } else {

        const first =
            recommendations[0];


        const extra =
            recommendations.slice(1);


        analysisHtml = `
            <div class="recommendation-row">

                ${recommendationHtml(
                    match,
                    first
                )}

                ${
                    extra.length
                        ? `
                            <button
                                class="more-btn"
                                data-more="${index}"
                            >
                                +
                            </button>
                        `
                        : ""
                }

            </div>
        `;


        if (extra.length) {

            analysisHtml += `
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
    }


    return `
        <article class="match-card">

            <div class="match-main">

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


                <div class="match-teams">

                    <div class="team">
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

            </div>


            <div class="analysis">

                <div class="analysis-title">

                    <span>
                        Geçmiş Oran Analizi
                    </span>

                    <span class="analysis-window">
                        Son ${HISTORY_DAYS} gün
                    </span>

                </div>


                ${analysisHtml}

            </div>

        </article>
    `;
}


/* =========================================================
   GÜNLÜK MAÇLAR
========================================================= */

function getSelectedMatches() {

    if (!selectedDate) {
        return [];
    }


    const selectedKey =
        dateToKey(
            selectedDate
        );


    let matches =
        allMatches.filter(
            match => {

                const date =
                    parseDate(
                        getDate(match)
                    );


                return (
                    date &&
                    dateToKey(date) ===
                    selectedKey
                );
            }
        );


    const search =
        searchInput.value
            .trim()
            .toLocaleLowerCase(
                "tr-TR"
            );


    if (search) {

        matches =
            matches.filter(
                match => {

                    const text = (

                        getHome(match) +
                        " " +
                        getAway(match) +
                        " " +
                        getLeague(match)

                    ).toLocaleLowerCase(
                        "tr-TR"
                    );


                    return text.includes(
                        search
                    );
                }
            );
    }


    if (leagueFilter.value) {

        matches =
            matches.filter(
                match =>
                    getLeague(match) ===
                    leagueFilter.value
            );
    }


    if (unplayedOnly.checked) {

        matches =
            matches.filter(
                match =>
                    !isPlayed(match)
            );
    }


    matches.sort(
        (a, b) =>
            String(
                getTime(a)
            ).localeCompare(
                String(getTime(b))
            )
    );


    return matches;
}


/* =========================================================
   BAŞARI ÖZETİ
========================================================= */

function calculateSummary(
    matches,
    targetDate
) {

    let dailySuccess = 0;

    let dailyTotal = 0;


    /*
       Aynı geçmiş örneği birden
       fazla tahmin için tekrar
       saymamak adına unique kullanıyoruz.
    */

    const historyMap =
        new Map();


    for (const match of matches) {

        const recommendations =
            getRecommendations(
                match,
                targetDate
            );


        /*
           GÜNLÜK BAŞARI
        */

        if (isPlayed(match)) {

            for (
                const recommendation
                of recommendations
            ) {

                dailyTotal++;


                const result =
                    getMarketOutcome(
                        match,
                        recommendation.targetMarket
                    );


                if (
                    result === "win"
                ) {

                    dailySuccess++;
                }
            }
        }


        /*
           SON 60 GÜN
        */

        for (
            const recommendation
            of recommendations
        ) {

            const key = [
                recommendation.sourceMarket,
                recommendation.sourceOdds,
                recommendation.targetMarket
            ].join("|");


            if (
                !historyMap.has(key)
            ) {

                historyMap.set(
                    key,
                    recommendation
                );
            }
        }
    }


    let historySuccess = 0;

    let historyTotal = 0;


    for (
        const item
        of historyMap.values()
    ) {

        historySuccess +=
            item.success;

        historyTotal +=
            item.total;
    }


    return {

        dailySuccess,

        dailyTotal,

        dailyPercent:
            dailyTotal
                ? (
                    dailySuccess /
                    dailyTotal
                ) * 100
                : null,


        historySuccess,

        historyTotal,

        historyPercent:
            historyTotal
                ? (
                    historySuccess /
                    historyTotal
                ) * 100
                : null
    };
}


/* =========================================================
   BAŞARI ÖZETİ RENDER
========================================================= */

function renderSummary(
    summary
) {

    const box =
        document.getElementById(
            "summary"
        );


    if (!box) {
        return;
    }


    const daily =
        summary.dailyPercent === null
            ? "—"
            : `${summary.dailyPercent.toFixed(1)}%`;


    const history =
        summary.historyPercent === null
            ? "—"
            : `${summary.historyPercent.toFixed(1)}%`;


    box.innerHTML = `

        <div class="summary-grid">

            <div class="summary-card">

                <span class="summary-label">
                    BUGÜN
                </span>

                <strong>
                    ${daily}
                </strong>

                <small>
                    ${
                        summary.dailyTotal
                            ? `${summary.dailySuccess}/${summary.dailyTotal} tahmin`
                            : "Henüz sonuç yok"
                    }
                </small>

            </div>


            <div class="summary-card">

                <span class="summary-label">
                    SON 60 GÜN
                </span>

                <strong>
                    ${history}
                </strong>

                <small>
                    ${
                        summary.historyTotal
                            ? `${summary.historySuccess}/${summary.historyTotal} örnek`
                            : "Veri yok"
                    }
                </small>

            </div>

        </div>
    `;
}


/* =========================================================
   RENDER
========================================================= */

function render() {

    if (!selectedDate) {
        return;
    }


    const matches =
        getSelectedMatches();


    const allForDay =
        allMatches.filter(
            match => {

                const date =
                    parseDate(
                        getDate(match)
                    );


                return (
                    date &&
                    dateToKey(date) ===
                    dateToKey(selectedDate)
                );
            }
        );


    const summary =
        calculateSummary(
            matches,
            selectedDate
        );


    renderSummary(
        summary
    );


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const selected =
        new Date(selectedDate);


    selected.setHours(
        0,
        0,
        0,
        0
    );


    if (
        selected.getTime() ===
        today.getTime()
    ) {

        pageTitle.textContent =
            "Bugünün Maçları";

    } else {

        pageTitle.textContent =
            `${formatDateTR(selectedDate)} Maçları`;
    }


    pageDescription.textContent =
        `Geçmiş ${HISTORY_DAYS} gündeki birebir aynı oranların sonuçları analiz ediliyor.`;


    const history =
        getHistoryMatches(
            selectedDate
        );


    const start =
        new Date(selectedDate);


    start.setDate(
        start.getDate() -
        HISTORY_DAYS
    );


    const previousDay =
        new Date(selectedDate);


    previousDay.setDate(
        previousDay.getDate() - 1
    );


    message.textContent =
        `${matches.length} maç · ${history.length} geçmiş maç analiz edildi`;


    updatedAt.textContent =
        `Geçmiş: ${formatDateTR(start)} - ${formatDateTR(previousDay)}`;


    if (!allForDay.length) {

        content.innerHTML = `
            <div class="empty">

                <strong>
                    Bu tarihte maç bulunamadı
                </strong>

                Takvimden başka bir tarih seçebilirsiniz.

            </div>
        `;

        return;
    }


    if (!matches.length) {

        content.innerHTML = `
            <div class="empty">

                <strong>
                    Filtreye uygun maç bulunamadı
                </strong>

            </div>
        `;

        return;
    }


    content.innerHTML = `
        <div class="match-list">

            ${matches.map(
                (match, index) =>
                    matchHtml(
                        match,
                        selectedDate,
                        index
                    )
            ).join("")}

        </div>
    `;


    document
        .querySelectorAll(
            "[data-more]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.more;


                    const element =
                        document.getElementById(
                            `extra-${id}`
                        );


                    if (!element) {
                        return;
                    }


                    const hidden =
                        element.classList.toggle(
                            "hidden"
                        );


                    button.textContent =
                        hidden
                            ? "+"
                            : "−";
                }
            );
        });
}


/* =========================================================
   LİG FİLTRESİ
========================================================= */

function fillLeagueFilter() {

    const leagues =
        new Set();


    for (
        const match
        of allMatches
    ) {

        const league =
            getLeague(match);


        if (league) {

            leagues.add(
                league
            );
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


    leagueFilter.innerHTML = `

        <option value="">
            Tüm Ligler
        </option>

        ${sorted.map(
            league => `
                <option value="${escapeHtml(league)}">
                    ${escapeHtml(league)}
                </option>
            `
        ).join("")}
    `;
}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

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


    calendarMonth.textContent =
        `${monthNames[month]} ${year}`;


    calendarDays.innerHTML = "";


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    const firstWeekday =
        (firstDay.getDay() + 6) % 7;


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const previousMonthDays =
        new Date(
            year,
            month,
            0
        ).getDate();


    const today =
        new Date();


    const selectedKey =
        selectedDate
            ? dateToKey(
                selectedDate
            )
            : null;


    const matchDates =
        new Set();


    for (
        const match
        of allMatches
    ) {

        const date =
            parseDate(
                getDate(match)
            );


        if (date) {

            matchDates.add(
                dateToKey(date)
            );
        }
    }


    for (
        let i =
            firstWeekday - 1;

        i >= 0;

        i--
    ) {

        const date =
            new Date(
                year,
                month - 1,
                previousMonthDays - i
            );


        createCalendarDay(
            date,
            true,
            matchDates,
            today,
            selectedKey
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


        createCalendarDay(
            date,
            false,
            matchDates,
            today,
            selectedKey
        );
    }


    const remaining =
        42 -
        calendarDays.children.length;


    for (
        let day = 1;

        day <= remaining;

        day++
    ) {

        const date =
            new Date(
                year,
                month + 1,
                day
            );


        createCalendarDay(
            date,
            true,
            matchDates,
            today,
            selectedKey
        );
    }
}


function createCalendarDay(
    date,
    otherMonth,
    matchDates,
    today,
    selectedKey
) {

    const button =
        document.createElement(
            "button"
        );


    button.type = "button";

    button.className =
        "calendar-day";


    const key =
        dateToKey(date);


    if (otherMonth) {

        button.classList.add(
            "other-month"
        );
    }


    if (
        dateToKey(today) === key
    ) {

        button.classList.add(
            "today"
        );
    }


    if (
        selectedKey === key
    ) {

        button.classList.add(
            "selected"
        );
    }


    if (
        matchDates.has(key)
    ) {

        button.classList.add(
            "has-matches"
        );
    }


    button.textContent =
        date.getDate();


    button.addEventListener(
        "click",
        () => {

            selectedDate =
                new Date(date);


            calendarDate =
                new Date(date);


            selectedDateText.textContent =
                formatDateTR(
                    selectedDate
                );


            calendarPopup.classList.add(
                "hidden"
            );


            renderCalendar();

            render();
        }
    );


    calendarDays.appendChild(
        button
    );
}


/* =========================================================
   İLK TARİH
========================================================= */

function findInitialDate() {

    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const todayKey =
        dateToKey(today);


    const todayExists =
        allMatches.some(
            match => {

                const date =
                    parseDate(
                        getDate(match)
                    );


                return (
                    date &&
                    dateToKey(date) ===
                    todayKey
                );
            }
        );


    if (todayExists) {

        return today;
    }


    const dates =
        allMatches
            .map(
                match =>
                    parseDate(
                        getDate(match)
                    )
            )
            .filter(Boolean)
            .sort(
                (a, b) =>
                    a - b
            );


    if (dates.length) {

        return (
            dates.find(
                date =>
                    date >= today
            ) ||
            dates[dates.length - 1]
        );
    }


    return today;
}


/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {

    calendarToggle.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            calendarPopup.classList.toggle(
                "hidden"
            );


            renderCalendar();
        }
    );


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


    document.addEventListener(
        "click",
        event => {

            if (
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


    searchInput.addEventListener(
        "input",
        render
    );


    leagueFilter.addEventListener(
        "change",
        render
    );


    unplayedOnly.addEventListener(
        "change",
        render
    );


    refreshButton.addEventListener(
        "click",
        () => {

            analysisCache.clear();

            loadData(true);
        }
    );
}


/* =========================================================
   VERİ YÜKLE
========================================================= */

async function loadData(
    forceRefresh = false
) {

    content.innerHTML = `
        <div class="loading">
            Veriler yükleniyor...
        </div>
    `;


    message.textContent =
        "Veriler yükleniyor...";


    try {

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


        if (Array.isArray(data)) {

            allMatches = data;

        } else if (
            data &&
            Array.isArray(data.matches)
        ) {

            allMatches =
                data.matches;

        } else {

            throw new Error(
                "matches.json içinde maç listesi bulunamadı."
            );
        }


        allMatches =
            allMatches.filter(
                match =>
                    !!parseDate(
                        getDate(match)
                    )
            );


        if (!allMatches.length) {

            throw new Error(
                "Geçerli maç verisi bulunamadı."
            );
        }


        analysisCache.clear();


        fillLeagueFilter();


        selectedDate =
            findInitialDate();


        calendarDate =
            new Date(selectedDate);


        selectedDateText.textContent =
            formatDateTR(
                selectedDate
            );


        renderCalendar();

        render();


        updatedAt.textContent +=
            ` · ${new Date().toLocaleTimeString(
                "tr-TR",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )}`;

    } catch (error) {

        console.error(error);


        message.textContent =
            "Veri yüklenemedi";


        content.innerHTML = `
            <div class="empty">

                <strong>
                    Veri yükleme hatası
                </strong>

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

setupEvents();

loadData();
