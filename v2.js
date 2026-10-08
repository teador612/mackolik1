"use strict";

/* =========================================================
   MACKOLIK V2 - ANA TAHMİN MOTORU
   =========================================================
   - Son 60 gün
   - Birebir aynı açılış oranı
   - Oran toleransı YOK
   - Oran kombinasyonu YOK
   - Minimum 5 geçmiş örnek
   - Minimum başarı %70
   - Her maç için yalnızca 1 ana tahmin
   - Tahmin yoksa maç gösterilmez
   - Confidence / güven puanı YOK
   - 60 günlük başarı sadece ANA TAHMİNLERDEN hesaplanır
   ========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;
const MIN_SUCCESS = 70;


/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];
let selectedDate = "";
let calendarDate = new Date();

const analysisCache = new Map();


/* =========================================================
   DOM
========================================================= */

const content = document.getElementById("content");
const message = document.getElementById("message");
const updatedAt = document.getElementById("updatedAt");
const summary = document.getElementById("summary");

const searchInput = document.getElementById("searchInput");
const leagueFilter = document.getElementById("leagueFilter");
const unplayedOnly = document.getElementById("unplayedOnly");
const refreshButton = document.getElementById("refreshButton");

const calendar = document.getElementById("calendar");
const calendarTitle = document.getElementById("calendarTitle");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

const pageTitle = document.getElementById("pageTitle");
const pageDescription = document.getElementById("pageDescription");


/* =========================================================
   GENEL YARDIMCILAR
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function pad2(value) {
    return String(value).padStart(2, "0");
}


function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "";
    }

    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate())
    ].join("-");
}


function parseDate(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();

    let match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const year = Number(match[3]);

        const date = new Date(year, month, day);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);

        const date = new Date(year, month, day);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date;
}


function getDateKey(match) {
    const possibleFields = [
        match?.date,
        match?.Date,
        match?.matchDate,
        match?.match_date,
        match?.tarih,
        match?.Tarih,
        match?.datetime,
        match?.dateTime
    ];

    for (const value of possibleFields) {
        const date = parseDate(value);

        if (date) {
            return formatDate(date);
        }
    }

    return "";
}


function getValue(object, keys) {
    if (!object || typeof object !== "object") {
        return undefined;
    }

    for (const key of keys) {
        if (
            Object.prototype.hasOwnProperty.call(object, key) &&
            object[key] !== null &&
            object[key] !== undefined &&
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

function getHomeTeam(match) {
    return getValue(match, [
        "homeTeam",
        "home",
        "homeName",
        "ev",
        "evSahibi",
        "team1",
        "takim1"
    ]) || "";
}


function getAwayTeam(match) {
    return getValue(match, [
        "awayTeam",
        "away",
        "awayName",
        "dep",
        "deplasman",
        "team2",
        "takim2"
    ]) || "";
}


function getLeague(match) {
    return getValue(match, [
        "league",
        "leagueName",
        "lig",
        "competition",
        "organization"
    ]) || "";
}


function getTime(match) {
    return getValue(match, [
        "time",
        "matchTime",
        "startTime",
        "hour",
        "saat"
    ]) || "";
}


/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    const match = text.match(/(\d+)\s*[-:]\s*(\d+)/);

    if (!match) {
        return null;
    }

    return {
        home: Number(match[1]),
        away: Number(match[2])
    };
}


function getFullTimeScore(match) {
    const values = [
        match?.score,
        match?.fullTimeScore,
        match?.ft,
        match?.ms,
        match?.result,
        match?.finalScore,
        match?.full_score,
        match?.fullScore
    ];

    for (const value of values) {
        const score = parseScore(value);

        if (score) {
            return score;
        }
    }

    return null;
}


function getHalfTimeScore(match) {
    const values = [
        match?.halfTimeScore,
        match?.htScore,
        match?.ht,
        match?.iy,
        match?.iyScore,
        match?.half_score,
        match?.halfScore
    ];

    for (const value of values) {
        const score = parseScore(value);

        if (score) {
            return score;
        }
    }

    return null;
}


function isPlayed(match) {
    return !!getFullTimeScore(match);
}


/* =========================================================
   ORANLAR
========================================================= */

function normalizeOdd(value) {
    if (value === null || value === undefined) {
        return null;
    }

    let text = String(value)
        .trim()
        .replace(",", ".");

    if (!text) {
        return null;
    }

    const number = Number(text);

    if (!Number.isFinite(number) || number <= 1) {
        return null;
    }

    return number.toFixed(2);
}


function getOdds(match, market) {
    const directKeys = [
        market.id,
        market.key,
        market.field
    ].filter(Boolean);

    for (const key of directKeys) {
        const value = getValue(match, [key]);

        const normalized = normalizeOdd(value);

        if (normalized) {
            return normalized;
        }
    }

    const containers = [
        match?.openingOdds,
        match?.opening_odds,
        match?.opening,
        match?.odds,
        match?.Odds,
        match?.oranlar,
        match?.Oranlar
    ];

    for (const container of containers) {
        if (!container || typeof container !== "object") {
            continue;
        }

        for (const key of directKeys) {
            const value = getValue(container, [key]);

            const normalized = normalizeOdd(value);

            if (normalized) {
                return normalized;
            }
        }
    }

    return null;
}


/* =========================================================
   MARKETLER
========================================================= */

const MARKETS = [
    {
        id: "IY15A",
        label: "İY 1.5 Alt",
        fields: ["iy15Alt", "iy15A", "iy_15_alt", "IY15Alt"],

        outcome(match) {
            const score = getHalfTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home + score.away <= 1;
        }
    },

    {
        id: "IY15U",
        label: "İY 1.5 Üst",
        fields: ["iy15Ust", "iy15U", "iy_15_ust", "IY15Ust"],

        outcome(match) {
            const score = getHalfTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home + score.away >= 2;
        }
    },

    {
        id: "IY1",
        label: "İY1",
        fields: ["iy1", "IY1"],

        outcome(match) {
            const score = getHalfTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home > score.away;
        }
    },

    {
        id: "IY2",
        label: "İY2",
        fields: ["iy2", "IY2"],

        outcome(match) {
            const score = getHalfTimeScore(match);

            if (!score) {
                return null;
            }

            return score.away > score.home;
        }
    },

    {
        id: "KG",
        label: "KG Var",
        fields: ["kgVar", "kg", "KGVar", "bothTeamsToScore"],

        outcome(match) {
            const score = getFullTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home > 0 && score.away > 0;
        }
    },

    {
        id: "KGY",
        label: "KG Yok",
        fields: ["kgYok", "kgy", "KGYok"],

        outcome(match) {
            const score = getFullTimeScore(match);

            if (!score) {
                return null;
            }

            return !(score.home > 0 && score.away > 0);
        }
    },

    {
        id: "IYKG",
        label: "İY KG Var",
        fields: ["iyKG", "iyKg", "iykgVar", "IYKGVar"],

        outcome(match) {
            const score = getHalfTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home > 0 && score.away > 0;
        }
    },

    {
        id: "IYKGY",
        label: "İY KG Yok",
        fields: ["iyKGY", "iyKgy", "iykgYok", "IYKGYok"],

        outcome(match) {
            const score = getHalfTimeScore(match);

            if (!score) {
                return null;
            }

            return !(score.home > 0 && score.away > 0);
        }
    },

    {
        id: "MS15A",
        label: "1.5 Alt",
        fields: ["ms15Alt", "ms15A", "au15Alt", "AU15Alt"],

        outcome(match) {
            const score = getFullTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home + score.away <= 1;
        }
    },

    {
        id: "MS15U",
        label: "1.5 Üst",
        fields: ["ms15Ust", "ms15U", "au15Ust", "AU15Ust"],

        outcome(match) {
            const score = getFullTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home + score.away >= 2;
        }
    },

    {
        id: "MS25U",
        label: "2.5 Üst",
        fields: ["ms25Ust", "ms25U", "au25Ust", "AU25Ust"],

        outcome(match) {
            const score = getFullTimeScore(match);

            if (!score) {
                return null;
            }

            return score.home + score.away >= 3;
        }
    }
];


/* =========================================================
   GEÇMİŞ 60 GÜN
========================================================= */

function getHistoryMatches(targetDate) {
    const target = parseDate(targetDate);

    if (!target) {
        return [];
    }

    target.setHours(0, 0, 0, 0);

    const start = new Date(target);

    start.setDate(start.getDate() - HISTORY_DAYS);

    return allMatches.filter(match => {
        const date = parseDate(getDateKey(match));

        if (!date) {
            return false;
        }

        date.setHours(0, 0, 0, 0);

        if (date < start || date >= target) {
            return false;
        }

        return isPlayed(match);
    });
}


/* =========================================================
   ANALİZ INDEX
   ========================================================= */

function buildAnalysisIndex(targetDate) {
    const cacheKey = formatDate(parseDate(targetDate));

    if (analysisCache.has(cacheKey)) {
        return analysisCache.get(cacheKey);
    }

    const history = getHistoryMatches(targetDate);

    const index = new Map();

    for (const match of history) {
        for (const market of MARKETS) {
            const odd = getOdds(match, market);

            if (!odd) {
                continue;
            }

            const key = `${market.id}|${odd}`;

            if (!index.has(key)) {
                index.set(key, []);
            }

            index.get(key).push(match);
        }
    }

    analysisCache.set(cacheKey, index);

    return index;
}


/* =========================================================
   TEK MARKET ANALİZİ
========================================================= */

function analyzeMarket(match, market, targetDate, index) {
    const odd = getOdds(match, market);

    if (!odd) {
        return null;
    }

    const key = `${market.id}|${odd}`;

    const historicalMatches = index.get(key) || [];

    if (historicalMatches.length < MIN_SAMPLE) {
        return null;
    }

    let success = 0;
    let total = 0;

    for (const historicalMatch of historicalMatches) {
        const result = market.outcome(historicalMatch);

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

    const percentage = (success / total) * 100;

    if (percentage < MIN_SUCCESS) {
        return null;
    }

    return {
        marketId: market.id,
        marketLabel: market.label,
        odds: odd,
        success,
        total,
        percentage
    };
}


/* =========================================================
   ANA TAHMİN
   ========================================================= */

function getRecommendations(match, targetDate) {
    const index = buildAnalysisIndex(targetDate);

    const candidates = [];

    for (const market of MARKETS) {
        const result = analyzeMarket(
            match,
            market,
            targetDate,
            index
        );

        if (result) {
            candidates.push(result);
        }
    }

    if (!candidates.length) {
        return [];
    }

    /*
       ESKİ MOTOR MANTIĞI

       1. En yüksek başarı yüzdesi
       2. Başarı yüzdesi eşitse daha fazla örnek
       3. Yine eşitse başarı sayısı
    */

    candidates.sort((a, b) => {
        if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
        }

        if (b.total !== a.total) {
            return b.total - a.total;
        }

        return b.success - a.success;
    });

    // SADECE 1 ANA TAHMİN
    return [candidates[0]];
}


/* =========================================================
   TAHMİN HTML
========================================================= */

function recommendationHtml(recommendation) {
    const percentage = recommendation.percentage.toFixed(1);

    return `
        <div class="v2-prediction">
            <div class="v2-prediction-main">
                <span class="v2-prediction-label">
                    ${escapeHtml(recommendation.marketLabel)}
                </span>

                <span class="v2-prediction-odd">
                    ${escapeHtml(recommendation.odds)}
                </span>
            </div>

            <div class="v2-prediction-stats">
                <span>
                    ${recommendation.success}/${recommendation.total}
                </span>

                <strong>
                    %${percentage}
                </strong>
            </div>
        </div>
    `;
}


/* =========================================================
   60 GÜNLÜK ANA TAHMİN BAŞARISI
========================================================= */

function calculate60DaySummary(targetDate) {
    const history = getHistoryMatches(targetDate);

    let predicted = 0;
    let successful = 0;

    /*
       ÖNEMLİ:

       Burada bütün marketleri tek tek saymıyoruz.

       Her geçmiş maç için o maç oynanmadan önce
       hesaplanan SADECE 1 ANA TAHMİNİ dikkate alıyoruz.

       Böylece aynı maçta KG + İY1 + 2.5 Üst gibi
       birden fazla sonuç başarı oranına girmiyor.
    */

    for (const match of history) {
        const matchDate = getDateKey(match);

        if (!matchDate) {
            continue;
        }

        const recommendations = getRecommendations(
            match,
            matchDate
        );

        if (!recommendations.length) {
            continue;
        }

        const mainPrediction = recommendations[0];

        const market = MARKETS.find(
            item => item.id === mainPrediction.marketId
        );

        if (!market) {
            continue;
        }

        const result = market.outcome(match);

        if (result === null) {
            continue;
        }

        predicted++;

        if (result === true) {
            successful++;
        }
    }

    const percentage = predicted > 0
        ? (successful / predicted) * 100
        : 0;

    return {
        predicted,
        successful,
        failed: predicted - successful,
        percentage
    };
}


/* =========================================================
   BUGÜN ÖZETİ
========================================================= */

function calculateTodaySummary(matches, targetDate) {
    let predicted = 0;
    let successful = 0;
    let failed = 0;

    for (const match of matches) {
        const recommendations = getRecommendations(
            match,
            targetDate
        );

        if (!recommendations.length) {
            continue;
        }

        predicted++;

        if (!isPlayed(match)) {
            continue;
        }

        const recommendation = recommendations[0];

        const market = MARKETS.find(
            item => item.id === recommendation.marketId
        );

        if (!market) {
            continue;
        }

        const result = market.outcome(match);

        if (result === true) {
            successful++;
        } else if (result === false) {
            failed++;
        }
    }

    const finished = successful + failed;

    const percentage = finished > 0
        ? (successful / finished) * 100
        : 0;

    return {
        predicted,
        successful,
        failed,
        percentage
    };
}


/* =========================================================
   ÖZET HTML
========================================================= */

function renderSummary(matches, targetDate) {
    if (!summary) {
        return;
    }

    const today = calculateTodaySummary(
        matches,
        targetDate
    );

    const history = calculate60DaySummary(
        targetDate
    );

    summary.innerHTML = `
        <div class="v2-summary-item">
            <span>Bugünkü tahmin</span>
            <strong>${today.predicted}</strong>
        </div>

        <div class="v2-summary-item">
            <span>Bugün başarı</span>
            <strong>%${today.percentage.toFixed(1)}</strong>
        </div>

        <div class="v2-summary-item">
            <span>60 günlük ana tahmin</span>
            <strong>${history.predicted}</strong>
        </div>

        <div class="v2-summary-item">
            <span>60 günlük başarı</span>
            <strong>%${history.percentage.toFixed(1)}</strong>
        </div>
    `;
}


/* =========================================================
   LİG FİLTRESİ
========================================================= */

function populateLeagueFilter(matches) {
    if (!leagueFilter) {
        return;
    }

    const current = leagueFilter.value;

    const leagues = [...new Set(
        matches
            .map(getLeague)
            .filter(Boolean)
    )].sort((a, b) =>
        String(a).localeCompare(
            String(b),
            "tr"
        )
    );

    leagueFilter.innerHTML = `
        <option value="">Tüm Ligler</option>
        ${leagues.map(league => `
            <option value="${escapeHtml(league)}">
                ${escapeHtml(league)}
            </option>
        `).join("")}
    `;

    if (leagues.includes(current)) {
        leagueFilter.value = current;
    }
}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {
    if (!calendar) {
        return;
    }

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    if (calendarTitle) {
        calendarTitle.textContent =
            calendarDate.toLocaleDateString(
                "tr-TR",
                {
                    month: "long",
                    year: "numeric"
                }
            );
    }

    const firstDay = new Date(
        year,
        month,
        1
    );

    const lastDay = new Date(
        year,
        month + 1,
        0
    );

    let startDay = firstDay.getDay();

    // Pazartesi başlangıcı
    startDay = startDay === 0
        ? 6
        : startDay - 1;

    let html = "";

    for (let i = 0; i < startDay; i++) {
        html += `<div class="calendar-empty"></div>`;
    }

    for (
        let day = 1;
        day <= lastDay.getDate();
        day++
    ) {
        const date = new Date(
            year,
            month,
            day
        );

        const key = formatDate(date);

        const isSelected =
            key === selectedDate;

        const hasMatch =
            allMatches.some(
                match => getDateKey(match) === key
            );

        html += `
            <button
                type="button"
                class="calendar-day ${isSelected ? "active" : ""} ${hasMatch ? "has-match" : ""}"
                data-date="${key}"
            >
                ${day}
            </button>
        `;
    }

    calendar.innerHTML = html;

    calendar
        .querySelectorAll(".calendar-day")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    selectedDate =
                        button.dataset.date;

                    const date =
                        parseDate(selectedDate);

                    if (date) {
                        calendarDate =
                            new Date(date);
                    }

                    renderCalendar();
                    render();
                }
            );
        });
}


/* =========================================================
   MAÇ KARTI
========================================================= */

function matchCard(match, recommendations) {
    const home = getHomeTeam(match);
    const away = getAwayTeam(match);
    const league = getLeague(match);
    const time = getTime(match);

    const score = getFullTimeScore(match);
    const halfTime = getHalfTimeScore(match);

    return `
        <article class="v2-match-card">

            <div class="v2-match-header">

                <div class="v2-match-time">
                    ${escapeHtml(time)}
                </div>

                <div class="v2-match-league">
                    ${escapeHtml(league)}
                </div>

            </div>

            <div class="v2-teams">

                <div class="v2-team home-team">
                    ${escapeHtml(home)}
                </div>

                <div class="v2-score">

                    ${
                        score
                            ? `
                                <strong>
                                    ${score.home}-${score.away}
                                </strong>

                                ${
                                    halfTime
                                        ? `<small>İY ${halfTime.home}-${halfTime.away}</small>`
                                        : ""
                                }
                            `
                            : `
                                <strong>-</strong>
                            `
                    }

                </div>

                <div class="v2-team away-team">
                    ${escapeHtml(away)}
                </div>

            </div>

            <div class="v2-predictions">

                ${recommendations
                    .map(recommendationHtml)
                    .join("")}

            </div>

        </article>
    `;
}


/* =========================================================
   RENDER
========================================================= */

function render() {
    if (!content) {
        return;
    }

    let matches = allMatches.filter(
        match =>
            getDateKey(match) === selectedDate
    );

    populateLeagueFilter(matches);

    const search =
        searchInput?.value
            ?.trim()
            .toLocaleLowerCase("tr-TR") || "";

    const selectedLeague =
        leagueFilter?.value || "";

    const onlyUnplayed =
        !!unplayedOnly?.checked;

    matches = matches.filter(match => {

        if (selectedLeague) {
            if (
                String(getLeague(match))
                    !== String(selectedLeague)
            ) {
                return false;
            }
        }

        if (search) {
            const text = [
                getHomeTeam(match),
                getAwayTeam(match),
                getLeague(match)
            ]
                .join(" ")
                .toLocaleLowerCase("tr-TR");

            if (!text.includes(search)) {
                return false;
            }
        }

        if (
            onlyUnplayed &&
            isPlayed(match)
        ) {
            return false;
        }

        return true;
    });


    const predicted = [];

    for (const match of matches) {
        const recommendations =
            getRecommendations(
                match,
                selectedDate
            );

        /*
           Tahmin yoksa maç gösterme.
        */

        if (!recommendations.length) {
            continue;
        }

        predicted.push({
            match,
            recommendations
        });
    }


    if (!predicted.length) {

        content.innerHTML = `
            <div class="v2-empty">
                Bu kriterlere uygun
                tahminli maç bulunamadı.
            </div>
        `;

        renderSummary(
            matches,
            selectedDate
        );

        if (message) {
            message.textContent =
                "Tahmin bulunamadı.";
        }

        return;
    }


    content.innerHTML = predicted
        .map(item =>
            matchCard(
                item.match,
                item.recommendations
            )
        )
        .join("");


    renderSummary(
        matches,
        selectedDate
    );


    if (message) {
        const history =
            getHistoryMatches(selectedDate);

        message.textContent =
            `${predicted.length} tahminli maç · ${history.length} geçmiş maç analiz edildi`;
    }
}


/* =========================================================
   VERİ YÜKLE
========================================================= */

async function loadData() {
    if (message) {
        message.textContent =
            "Veriler yükleniyor...";
    }

    try {
        const response = await fetch(
            `${DATA_URL}?t=${Date.now()}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
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
            allMatches = data.matches;
        } else {
            throw new Error(
                "Geçersiz veri formatı."
            );
        }


        analysisCache.clear();


        if (data?.updatedAt && updatedAt) {
            const updated =
                new Date(data.updatedAt);

            if (!Number.isNaN(updated.getTime())) {
                updatedAt.textContent =
                    `Güncellendi: ${updated.toLocaleString("tr-TR")}`;
            }
        }


        if (!selectedDate) {

            const today =
                formatDate(new Date());

            const todayExists =
                allMatches.some(
                    match =>
                        getDateKey(match) === today
                );

            if (todayExists) {
                selectedDate = today;
            } else {

                const dates =
                    allMatches
                        .map(getDateKey)
                        .filter(Boolean)
                        .sort();

                selectedDate =
                    dates[dates.length - 1] ||
                    today;
            }
        }


        const selected =
            parseDate(selectedDate);

        if (selected) {
            calendarDate =
                new Date(selected);
        }


        renderCalendar();
        render();

    } catch (error) {

        console.error(
            "V2 veri yükleme hatası:",
            error
        );

        if (message) {
            message.textContent =
                "Veriler yüklenemedi.";
        }

        if (content) {
            content.innerHTML = `
                <div class="v2-error">
                    Veri yüklenirken hata oluştu.
                </div>
            `;
        }
    }
}


/* =========================================================
   EVENTLER
========================================================= */

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
            loadData();
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


/* =========================================================
   SAYFA BAŞLANGICI
========================================================= */

if (pageTitle) {
    pageTitle.textContent =
        pageTitle.textContent ||
        "Mackolik V2";
}


if (pageDescription) {
    pageDescription.textContent =
        pageDescription.textContent ||
        "Birebir aynı açılış oranlarının son 60 günlük başarı analizine göre ana tahminler.";
}


/* =========================================================
   PWA
========================================================= */

if (
    "serviceWorker" in navigator
) {
    window.addEventListener(
        "load",
        () => {
            navigator.serviceWorker
                .register("./sw.js")
                .catch(error => {
                    console.warn(
                        "Service Worker:",
                        error
                    );
                });
        }
    );
}


/* =========================================================
   BAŞLAT
========================================================= */

loadData();
