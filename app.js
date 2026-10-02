"use strict";

/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;

const MIN_SAMPLE = 5;

const MIN_SUCCESS = 0.70;


/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];

let selectedDate = null;

let calendarDate = new Date();

let calendarOpen = false;

const analysisCache = new Map();


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

const selectedDateText = document.getElementById("selectedDateText");

const pageTitle = document.getElementById("pageTitle");

const pageDescription = document.getElementById("pageDescription");


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


/* =========================================================
   TARİH
========================================================= */

function pad(number) {

    return String(number).padStart(2, "0");
}


function dateToKey(date) {

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}


function parseDate(value) {

    if (!value) return null;

    if (value instanceof Date) {

        return new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate()
        );
    }

    const text = String(value).trim();

    /* DD.MM.YYYY */

    let match = text.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
    );

    if (match) {

        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);

        return new Date(year, month - 1, day);
    }


    /* YYYY-MM-DD */

    match = text.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

    if (match) {

        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );
    }


    const parsed = new Date(text);

    if (!Number.isNaN(parsed.getTime())) {

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
   ALAN BULMA
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

    if (!value) return null;

    if (typeof value === "object") {

        const home = getValue(value, [
            "home",
            "Home",
            "ev",
            "h"
        ]);

        const away = getValue(value, [
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


    const text = String(value).trim();

    const match = text.match(
        /(\d+)\s*[-:]\s*(\d+)/
    );

    if (!match) return null;

    return {
        home: Number(match[1]),
        away: Number(match[2])
    };
}


function getFullTimeScore(match) {

    const objectScore = getValue(match, [
        "score",
        "Score",
        "fullTimeScore",
        "fulltimeScore",
        "ftScore"
    ]);

    const parsedObject = parseScore(objectScore);

    if (parsedObject) {
        return parsedObject;
    }


    const direct = getValue(match, [
        "ft",
        "FT",
        "fullTime",
        "FullTime",
        "ms",
        "MS",
        "macSonucu",
        "MaçSonucu"
    ]);

    return parseScore(direct);
}


function getHalfTimeScore(match) {

    const objectScore = getValue(match, [
        "halfTimeScore",
        "halftimeScore",
        "half_score",
        "htScore",
        "HTScore"
    ]);

    const parsedObject = parseScore(objectScore);

    if (parsedObject) {
        return parsedObject;
    }


    const direct = getValue(match, [
        "ht",
        "HT",
        "halfTime",
        "half",
        "iy",
        "IY",
        "ilkYari"
    ]);

    return parseScore(direct);
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

    const number = Number(
        String(value)
            .replace(",", ".")
            .trim()
    );

    if (!Number.isFinite(number)) {
        return null;
    }

    /*
       ÖNEMLİ:

       Tolerans yok.

       1.85 ile 1.86 farklıdır.

       Anahtar oluştururken 2 basamak kullanıyoruz.
    */

    return number.toFixed(2);
}


function getOdds(match, names) {

    const direct = getValue(match, names);

    if (direct !== undefined) {

        return normalizeOdds(direct);
    }


    /*
       openingOdds / odds / oranlar gibi
       iç nesneleri de destekle.
    */

    const containers = [
        match.openingOdds,
        match.opening,
        match.odds,
        match.Odds,
        match.oranlar,
        match.Oranlar
    ];


    for (const container of containers) {

        if (!container) continue;

        const value = getValue(container, names);

        if (value !== undefined) {

            return normalizeOdds(value);
        }
    }

    return null;
}


/* =========================================================
   ORAN ALANLARI
========================================================= */

function getMS1(match) {

    return getOdds(match, [
        "ms1",
        "MS1",
        "1",
        "MS_1"
    ]);
}


function getMSX(match) {

    return getOdds(match, [
        "msX",
        "msx",
        "MSX",
        "ms0",
        "MS0",
        "X"
    ]);
}


function getMS2(match) {

    return getOdds(match, [
        "ms2",
        "MS2",
        "2",
        "MS_2"
    ]);
}


function getIY1(match) {

    return getOdds(match, [
        "iy1",
        "IY1",
        "İY1",
        "iy_1"
    ]);
}


function getIYX(match) {

    return getOdds(match, [
        "iyX",
        "iyx",
        "IYX",
        "iy0",
        "IY0",
        "İYX"
    ]);
}


function getIY2(match) {

    return getOdds(match, [
        "iy2",
        "IY2",
        "İY2",
        "iy_2"
    ]);
}


function getIY15Over(match) {

    return getOdds(match, [
        "iy15U",
        "iy1_5U",
        "iy1_5Over",
        "iy15Over",
        "IY1.5U",
        "İY1.5Ü",
        "iy1.5ust",
        "iy15ust"
    ]);
}


/* =========================================================
   MAÇ OYNANDI MI?
========================================================= */

function isPlayed(match) {

    const score = getFullTimeScore(match);

    return !!score;
}


/* =========================================================
   SONUÇLAR
========================================================= */

function getMarketOutcome(match, market) {

    if (market === "MS1") {

        const score = getFullTimeScore(match);

        if (!score) return null;

        if (score.home > score.away) {
            return "win";
        }

        return "lose";
    }


    if (market === "MSX") {

        const score = getFullTimeScore(match);

        if (!score) return null;

        if (score.home === score.away) {
            return "win";
        }

        return "lose";
    }


    if (market === "MS2") {

        const score = getFullTimeScore(match);

        if (!score) return null;

        if (score.away > score.home) {
            return "win";
        }

        return "lose";
    }


    if (market === "IY1") {

        const score = getHalfTimeScore(match);

        if (!score) return null;

        if (score.home > score.away) {
            return "win";
        }

        return "lose";
    }


    if (market === "IYX") {

        const score = getHalfTimeScore(match);

        if (!score) return null;

        if (score.home === score.away) {
            return "win";
        }

        return "lose";
    }


    if (market === "IY2") {

        const score = getHalfTimeScore(match);

        if (!score) return null;

        if (score.away > score.home) {
            return "win";
        }

        return "lose";
    }


    if (market === "IY15U") {

        const score = getHalfTimeScore(match);

        if (!score) return null;

        const total =
            score.home +
            score.away;

        if (total >= 2) {
            return "win";
        }

        return "lose";
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
        odds: getMS1
    },

    {
        id: "MSX",
        title: "MS X",
        odds: getMSX
    },

    {
        id: "MS2",
        title: "MS 2",
        odds: getMS2
    },

    {
        id: "IY1",
        title: "İY 1",
        odds: getIY1
    },

    {
        id: "IYX",
        title: "İY X",
        odds: getIYX
    },

    {
        id: "IY2",
        title: "İY 2",
        odds: getIY2
    },

    {
        id: "IY15U",
        title: "İY 1.5 Üst",
        odds: getIY15Over
    }

];


/* =========================================================
   TARİHİN 60 GÜNLÜK GEÇMİŞİ
========================================================= */

function getHistoryMatches(targetDate) {

    const end = new Date(targetDate);

    /*
       Bugünün kendisini geçmişe dahil etme.
    */

    end.setHours(0, 0, 0, 0);


    const start = new Date(end);

    start.setDate(
        start.getDate() - HISTORY_DAYS
    );


    return allMatches.filter(match => {

        const date = parseDate(getDate(match));

        if (!date) {
            return false;
        }

        date.setHours(0, 0, 0, 0);

        return (
            date >= start &&
            date < end &&
            isPlayed(match)
        );
    });
}


/* =========================================================
   ANALİZ INDEX
========================================================= */

function buildAnalysisIndex(targetDate) {

    const key = dateToKey(targetDate);

    if (analysisCache.has(key)) {

        return analysisCache.get(key);
    }


    const history = getHistoryMatches(targetDate);

    const index = new Map();


    for (const match of history) {

        for (const market of MARKETS) {

            const odds = market.odds(match);

            if (!odds) {
                continue;
            }


            const outcome =
                getMarketOutcome(
                    match,
                    market.id
                );

            if (!outcome) {
                continue;
            }


            const indexKey =
                `${market.id}|${odds}`;


            if (!index.has(indexKey)) {

                index.set(indexKey, {
                    market: market.id,
                    title: market.title,
                    odds,
                    total: 0,
                    success: 0,
                    matches: []
                });
            }


            const item = index.get(indexKey);

            item.total++;

            if (outcome === "win") {
                item.success++;
            }


            item.matches.push(match);
        }
    }


    analysisCache.set(key, index);

    return index;
}


/* =========================================================
   MAÇIN ÖNERİLERİ
========================================================= */

function getRecommendations(match, targetDate) {

    const index =
        buildAnalysisIndex(targetDate);


    const recommendations = [];


    for (const market of MARKETS) {

        const odds =
            market.odds(match);

        if (!odds) {
            continue;
        }


        const key =
            `${market.id}|${odds}`;


        const stat =
            index.get(key);


        if (!stat) {
            continue;
        }


        /*
           Minimum 5 örnek
           Minimum %70 başarı
        */

        if (stat.total < MIN_SAMPLE) {
            continue;
        }


        const percentage =
            (stat.success / stat.total) * 100;


        if (
            percentage <
            MIN_SUCCESS * 100
        ) {
            continue;
        }


        recommendations.push({

            market: stat.market,

            title: stat.title,

            odds,

            total: stat.total,

            success: stat.success,

            percentage

        });
    }


    /*
       Önce başarı yüzdesi.

       Eşitse örnek sayısı fazla olan üstte.
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

            return b.total - a.total;
        }
    );


    return recommendations;
}


/* =========================================================
   ÖNERİ DURUMU
========================================================= */

function recommendationStatus(
    match,
    recommendation
) {

    if (!isPlayed(match)) {

        return "yellow";
    }


    const outcome =
        getMarketOutcome(
            match,
            recommendation.market
        );


    if (outcome === "win") {

        return "green";
    }


    return "red";
}


/* =========================================================
   ÖNERİ HTML
========================================================= */

function recommendationHtml(
    match,
    recommendation
) {

    const status =
        recommendationStatus(
            match,
            recommendation
        );


    return `
        <div class="recommendation status-${status}">

            <div class="rec-left">

                <span class="rec-status"></span>

                <span class="rec-market">
                    ${escapeHtml(recommendation.title)}
                </span>

                <span class="rec-odds">
                    ${escapeHtml(recommendation.odds)}
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
   SKOR GÖSTER
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


    const time =
        getTime(match);


    const league =
        getLeague(match);


    const home =
        getHome(match);


    const away =
        getAway(match);


    let recommendationsHtml = "";


    if (recommendations.length === 0) {

     recommendationsHtml = `
    <div class="no-prediction">
        Tahmin yok
    </div>
`;

    } else {

        const first =
            recommendations[0];


        const extra =
            recommendations.slice(1);


        recommendationsHtml = `

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
                            aria-label="Diğer öneriler"
                        >
                            +
                        </button>
                    `
                    : ""
                }

            </div>
        `;


        if (extra.length) {

            recommendationsHtml += `

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
                        ${escapeHtml(time)}
                    </span>

                    <span class="match-league">
                        ${escapeHtml(league)}
                    </span>

                </div>


                <div class="match-teams">

                    <div class="team">
                        ${escapeHtml(home)}
                    </div>

                    <div class="vs">
                        VS
                    </div>

                    <div class="team away">
                        ${escapeHtml(away)}
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


                ${recommendationsHtml}

            </div>

        </article>
    `;
}


/* =========================================================
   SEÇİLİ TARİH MAÇLARI
========================================================= */

function getSelectedMatches() {

    const key =
        dateToKey(selectedDate);


    let matches =
        allMatches.filter(match => {

            const date =
                parseDate(
                    getDate(match)
                );

            if (!date) {
                return false;
            }

            return (
                dateToKey(date) === key
            );
        });


    const search =
        searchInput.value
            .trim()
            .toLocaleLowerCase("tr-TR");


    const league =
        leagueFilter.value;


    if (search) {

        matches =
            matches.filter(match => {

                const text = (

                    getHome(match) +
                    " " +
                    getAway(match) +
                    " " +
                    getLeague(match)

                ).toLocaleLowerCase(
                    "tr-TR"
                );


                return text.includes(search);
            });
    }


    if (league) {

        matches =
            matches.filter(
                match =>
                    getLeague(match) === league
            );
    }


    if (unplayedOnly.checked) {

        matches =
            matches.filter(
                match =>
                    !isPlayed(match)
            );
    }


    matches.sort((a, b) => {

        return String(
            getTime(a)
        ).localeCompare(
            String(getTime(b))
        );
    });


    return matches;
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
        allMatches.filter(match => {

            const date =
                parseDate(getDate(match));

            return (
                date &&
                dateToKey(date) ===
                dateToKey(selectedDate)
            );
        });


    pageTitle.textContent =
        selectedDate.getTime() ===
        new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate()
        ).getTime()

        ? "Bugünün Maçları"

        : `${formatDateTR(selectedDate)} Maçları`;


    pageDescription.textContent =
        `Geçmiş ${HISTORY_DAYS} gündeki birebir aynı oranların sonuçları analiz ediliyor.`;


    const history =
        getHistoryMatches(selectedDate);


    const start =
        new Date(selectedDate);

    start.setDate(
        start.getDate() - HISTORY_DAYS
    );


    message.textContent =
        `${matches.length} maç · ${history.length} geçmiş maç analiz edildi`;


    updatedAt.textContent =
        `Geçmiş: ${formatDateTR(start)} - ${formatDateTR(
            new Date(selectedDate.getTime() - 86400000)
        )}`;


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

                Arama veya lig filtresini değiştirmeyi deneyin.

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
        .querySelectorAll("[data-more]")
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
                        hidden ? "+" : "−";
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


    for (const match of allMatches) {

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


    /*
       JS:
       Pazar = 0

       Biz:
       Pazartesi = 0
    */

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
            ? dateToKey(selectedDate)
            : null;


    const matchDates =
        new Set();


    for (const match of allMatches) {

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


    /*
       Önceki ayın günleri
    */

    for (
        let i = firstWeekday - 1;
        i >= 0;
        i--
    ) {

        const day =
            previousMonthDays - i;


        const date =
            new Date(
                year,
                month - 1,
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


    /*
       Bu ay
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


        createCalendarDay(
            date,
            false,
            matchDates,
            today,
            selectedKey
        );
    }


    /*
       Sonraki ay
    */

    const totalCells =
        calendarDays.children.length;


    const remaining =
        42 - totalCells;


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
        document.createElement("button");


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


            calendarOpen = false;


            renderCalendar();


            render();
        }
    );


    calendarDays.appendChild(
        button
    );
}


/* =========================================================
   BUGÜNÜ BUL
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


    const exists =
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


    if (exists) {

        return today;
    }


    /*
       Bugün yoksa veri içindeki
       en yakın gelecek günü bul.
    */

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

        return dates.find(
            date =>
                date >= today
        ) || dates[dates.length - 1];
    }


    return today;
}


/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {

    calendarToggle.addEventListener(
        "click",
        () => {

            calendarOpen =
                !calendarOpen;


            calendarPopup.classList.toggle(
                "hidden",
                !calendarOpen
            );


            if (calendarOpen) {

                renderCalendar();
            }
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

                calendarOpen = false;
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

async function loadData(forceRefresh = false) {

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


        /*
           Hem:

           { matches: [...] }

           hem de:

           [...]

           formatını destekliyoruz.
        */

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


        /*
           Tarihi olmayan bozuk kayıtları
           kullanma.
        */

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


        const now =
            new Date();


        updatedAt.textContent +=
            ` · Güncellendi ${now.toLocaleTimeString(
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
