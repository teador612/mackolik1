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
const searchInput = document.getElementById("searchInput");
const leagueFilter = document.getElementById("leagueFilter");
const unplayedOnly = document.getElementById("unplayedOnly");
const refreshButton = document.getElementById("refreshButton");
const calendar = document.getElementById("calendar");
const calendarTitle = document.getElementById("calendarTitle");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const selectedDateText = document.getElementById("selectedDateText");
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
function pad(value) {
    return String(value).padStart(2, "0");
}
function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function sameDate(a, b) {
    return dateKey(a) === dateKey(b);
}
function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}
function formatDateTR(date) {
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}
function formatLongDateTR(date) {
    return date.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}
/* =========================================================
   TARİH
========================================================= */
function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    const text = String(value).trim();
    let match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const year = Number(match[3]);
        const date = new Date(year, month, day);
        if (
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        ) {
            return date;
        }
        return null;
    }
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const date = new Date(year, month, day);
        if (
            date.getFullYear() === year &&
            date.getMonth() === month &&
            date.getDate() === day
        ) {
            return date;
        }
        return null;
    }
    const parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
}
/* =========================================================
   DEĞER ALMA
========================================================= */
function getValue(object, keys, fallback = "") {
    for (const key of keys) {
        if (
            object &&
            Object.prototype.hasOwnProperty.call(object, key) &&
            object[key] !== null &&
            object[key] !== undefined &&
            object[key] !== ""
        ) {
            return object[key];
        }
    }
    return fallback;
}
function getHome(match) {
    return getValue(match, [
        "home",
        "homeTeam",
        "home_team",
        "ev",
        "evSahibi",
        "ev_sahibi",
        "team1",
        "teamHome"
    ]);
}
function getAway(match) {
    return getValue(match, [
        "away",
        "awayTeam",
        "away_team",
        "deplasman",
        "deplasmanTakimi",
        "deplasman_takimi",
        "team2",
        "teamAway"
    ]);
}
function getTime(match) {
    return getValue(match, [
        "time",
        "matchTime",
        "match_time",
        "saat",
        "kickoff",
        "kickoffTime",
        "startTime"
    ]);
}
function getLeague(match) {
    return getValue(match, [
        "league",
        "lig",
        "competition",
        "organization"
    ], "Diğer");
}
/* =========================================================
   SAAT SIRALAMA
========================================================= */
function timeToMinutes(value) {
    if (!value) {
        return Number.POSITIVE_INFINITY;
    }
    const text = String(value).trim();
    const match = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
    if (!match) {
        return Number.POSITIVE_INFINITY;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return Number.POSITIVE_INFINITY;
    }
    return hours * 60 + minutes;
}
/* =========================================================
   SKOR
========================================================= */
function parseScore(value) {
    if (!value) return null;
    const text = String(value).trim();
    const match = text.match(/(\d+)\s*[-:]\s*(\d+)/);
    if (!match) return null;
    return {
        home: Number(match[1]),
        away: Number(match[2])
    };
}
function getFullTimeScore(match) {
    return parseScore(
        getValue(match, [
            "score",
            "fullTimeScore",
            "full_time_score",
            "ft",
            "result",
            "sonuc"
        ])
    );
}
function getHalfTimeScore(match) {
    return parseScore(
        getValue(match, [
            "halfTimeScore",
            "half_time_score",
            "ht",
            "halfTime",
            "ilkYariSkor"
        ])
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
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }
    const number = Number(
        String(value)
            .replace(",", ".")
            .trim()
    );
    if (!Number.isFinite(number) || number <= 0) {
        return null;
    }
    return number;
}
function getOdds(match, market) {
    const containers = [
        match,
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
        const value = getValue(container, [
            market,
            market.toLowerCase(),
            market.toUpperCase()
        ]);
        const odds = normalizeOdds(value);
        if (odds !== null) {
            return odds;
        }
    }
    return null;
}
/* =========================================================
   MARKETLER
========================================================= */
const SOURCE_MARKETS = [
    {
        id: "IY15U",
        name: "İY 1.5 Üst",
        odds: match => getOdds(match, "iy15Ust")
    },
    {
        id: "IY1",
        name: "İY 1",
        odds: match => getOdds(match, "iy1")
    },
    {
        id: "IY2",
        name: "İY 2",
        odds: match => getOdds(match, "iy2")
    },
    {
        id: "MS15A",
        name: "1.5 Alt",
        odds: match => getOdds(match, "ms15Alt")
    },
    {
        id: "MS15U",
        name: "1.5 Üst",
        odds: match => getOdds(match, "ms15Ust")
    }
];
const TARGET_MARKETS = [
    {
        id: "IY15A",
        name: "İY 1.5 Alt",
        odds: match => getOdds(match, "iy15Alt"),
        result: match => {
            const score = getHalfTimeScore(match);
            if (!score) return null;
            return score.home + score.away < 2;
        }
    },
    {
        id: "IY15U",
        name: "İY 1.5 Üst",
        odds: match => getOdds(match, "iy15Ust"),
        result: match => {
            const score = getHalfTimeScore(match);
            if (!score) return null;
            return score.home + score.away >= 2;
        }
    },
    {
        id: "KG",
        name: "KG Var",
        odds: match => getOdds(match, "kgVar"),
        result: match => {
            const score = getFullTimeScore(match);
            if (!score) return null;
            return score.home > 0 && score.away > 0;
        }
    },
    {
        id: "KGY",
        name: "KG Yok",
        odds: match => getOdds(match, "kgYok"),
        result: match => {
            const score = getFullTimeScore(match);
            if (!score) return null;
            return !(score.home > 0 && score.away > 0);
        }
    },
    {
        id: "IYKG",
        name: "İlk Yarı KG Var",
        odds: match => getOdds(match, "iyKgVar"),
        result: match => {
            const score = getHalfTimeScore(match);
            if (!score) return null;
            return score.home > 0 && score.away > 0;
        }
    },
    {
        id: "MS25U",
        name: "2.5 Üst",
        odds: match => getOdds(match, "au25Ust"),
        result: match => {
            const score = getFullTimeScore(match);
            if (!score) return null;
            return score.home + score.away >= 3;
        }
    }
];
/* =========================================================
   SONUÇ
========================================================= */
function getMarketOutcome(match, marketId) {
    const market = TARGET_MARKETS.find(
        item => item.id === marketId
    );
    if (!market || !market.result) {
        return null;
    }
    return market.result(match);
}
/* =========================================================
   GEÇMİŞ MAÇLAR
========================================================= */
function getHistoryMatches(targetDate) {
    const startDate = addDays(targetDate, -HISTORY_DAYS);
    return allMatches.filter(match => {
        const date = parseDate(
            getValue(match, ["date", "matchDate", "match_date", "tarih"])
        );
        if (!date) return false;
        if (date >= targetDate) return false;
        if (date < startDate) return false;
        return isPlayed(match);
    });
}
/* =========================================================
   ANALİZ INDEX
========================================================= */
function buildAnalysisIndex(targetDate) {
    const cacheKey = dateKey(targetDate);
    if (analysisCache.has(cacheKey)) {
        return analysisCache.get(cacheKey);
    }
    const index = new Map();
    const history = getHistoryMatches(targetDate);
    for (const match of history) {
        for (const sourceMarket of SOURCE_MARKETS) {
            const sourceOdds = sourceMarket.odds(match);
            if (sourceOdds === null) {
                continue;
            }
            const key =
                `${sourceMarket.id}|${sourceOdds.toFixed(2)}`;
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
   TAHMİNLER
========================================================= */
function getRecommendations(match, targetDate) {
    const index = buildAnalysisIndex(targetDate);
    const recommendations = [];
    for (const sourceMarket of SOURCE_MARKETS) {
        const sourceOdds = sourceMarket.odds(match);
        if (sourceOdds === null) {
            continue;
        }
        const key =
            `${sourceMarket.id}|${sourceOdds.toFixed(2)}`;
        const history = index.get(key) || [];
        if (history.length < MIN_SAMPLE) {
            continue;
        }
        for (const targetMarket of TARGET_MARKETS) {
            if (targetMarket.id === sourceMarket.id) {
                continue;
            }
            const targetOdds = targetMarket.odds(match);
            if (targetOdds === null) {
                continue;
            }
            const results = [];
            for (const historicalMatch of history) {
                const result = getMarketOutcome(
                    historicalMatch,
                    targetMarket.id
                );
                if (result === null) {
                    continue;
                }
                results.push(result);
            }
            if (results.length < MIN_SAMPLE) {
                continue;
            }
            const successCount = results.filter(Boolean).length;
            const success =
                (successCount / results.length) * 100;
            if (success < MIN_SUCCESS) {
                continue;
            }
            recommendations.push({
                sourceMarket: sourceMarket.name,
                sourceMarketId: sourceMarket.id,
                sourceOdds,
                targetMarket: targetMarket.name,
                targetMarketId: targetMarket.id,
                targetOdds,
                success,
                successCount,
                total: results.length
            });
        }
    }
    recommendations.sort((a, b) => {
        if (b.success !== a.success) {
            return b.success - a.success;
        }
        return b.total - a.total;
    });
    const unique = [];
    const seen = new Set();
    for (const item of recommendations) {
        const key =
            `${item.sourceMarketId}|${item.sourceOdds}|${item.targetMarketId}`;
        if (seen.has(key)) {
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
function getRecommendationStatus(match, recommendation) {
    if (!recommendation) {
        return "pending";
    }
    const result = getMarketOutcome(
        match,
        recommendation.targetMarketId
    );
    if (result === null) {
        return "pending";
    }
    return result ? "success" : "failed";
}
/* =========================================================
   TAHMİN HTML
========================================================= */
function recommendationHtml(match, recommendation) {
    const status = getRecommendationStatus(
        match,
        recommendation
    );
    let statusClass = "pending";
    let statusText = "Bekliyor";
    if (status === "success") {
        statusClass = "success";
        statusText = "Başarılı";
    } else if (status === "failed") {
        statusClass = "failed";
        statusText = "Başarısız";
    }
    return `
        <div class="recommendation ${statusClass}">
            <div class="recommendation-main">
                <strong>${escapeHtml(recommendation.targetMarket)}</strong>
                <span class="recommendation-odd">
                    ${recommendation.targetOdds.toFixed(2)}
                </span>
            </div>
            <div class="recommendation-source">
                ${escapeHtml(recommendation.sourceMarket)}
                @
                ${recommendation.sourceOdds.toFixed(2)}
            </div>
            <div class="recommendation-stats">
                %${recommendation.success.toFixed(1)}
                ·
                ${recommendation.successCount}/${recommendation.total}
                ·
                ${statusText}
            </div>
        </div>
    `;
}
/* =========================================================
   MAÇ HTML
========================================================= */
function matchHtml(match, targetDate) {
    const home = getHome(match);
    const away = getAway(match);
    const time = getTime(match);
    const league = getLeague(match);
    const fullTime = getFullTimeScore(match);
    const halfTime = getHalfTimeScore(match);
    const recommendations =
        getRecommendations(match, targetDate);
    if (!recommendations.length) {
        return "";
    }
    const mainRecommendation = recommendations[0];
    const extraRecommendations =
        recommendations.slice(1);
    const status =
        getRecommendationStatus(
            match,
            mainRecommendation
        );
    let statusClass = "pending";
    let statusIcon = "⏳";
    if (status === "success") {
        statusClass = "success";
        statusIcon = "✓";
    } else if (status === "failed") {
        statusClass = "failed";
        statusIcon = "✕";
    }
    return `
        <article class="match-card ${statusClass}">
            <div class="match-header">
                <div class="match-time">
                    ${escapeHtml(time || "--:--")}
                </div>
                <div class="match-league">
                    ${escapeHtml(league)}
                </div>
                <div class="match-status">
                    ${statusIcon}
                </div>
            </div>
            <div class="teams">
                <div>${escapeHtml(home)}</div>
                <span>-</span>
                <div>${escapeHtml(away)}</div>
            </div>
            ${
                fullTime
                    ? `
                        <div class="score">
                            ${fullTime.home} - ${fullTime.away}
                        </div>
                        ${
                            halfTime
                                ? `
                                    <div class="half-score">
                                        İY ${halfTime.home} - ${halfTime.away}
                                    </div>
                                `
                                : ""
                        }
                    `
                    : `
                        <div class="score waiting">
                            -
                        </div>
                    `
            }
            <div class="main-recommendation">
                ${recommendationHtml(
                    match,
                    mainRecommendation
                )}
            </div>
            ${
                extraRecommendations.length
                    ? `
                        <details class="extra-recommendations">
                            <summary>
                                Diğer tahminler
                                (${extraRecommendations.length})
                            </summary>
                            <div class="recommendation-list">
                                ${extraRecommendations
                                    .map(item =>
                                        recommendationHtml(
                                            match,
                                            item
                                        )
                                    )
                                    .join("")}
                            </div>
                        </details>
                    `
                    : ""
            }
        </article>
    `;
}
/* =========================================================
   GÜNÜN MAÇLARI
========================================================= */
function getDayMatches() {
    const search =
        String(searchInput?.value || "")
            .trim()
            .toLocaleLowerCase("tr-TR");
    const league =
        String(leagueFilter?.value || "");
    const onlyUnplayed =
        !!unplayedOnly?.checked;
    const result = allMatches.filter(match => {
        const matchDate = parseDate(
            getValue(match, [
                "date",
                "matchDate",
                "match_date",
                "tarih"
            ])
        );
        if (!matchDate || !sameDate(matchDate, selectedDate)) {
            return false;
        }
        const home = String(getHome(match))
            .toLocaleLowerCase("tr-TR");
        const away = String(getAway(match))
            .toLocaleLowerCase("tr-TR");
        const matchLeague =
            String(getLeague(match));
        if (
            search &&
            !home.includes(search) &&
            !away.includes(search) &&
            !matchLeague
                .toLocaleLowerCase("tr-TR")
                .includes(search)
        ) {
            return false;
        }
        if (league && matchLeague !== league) {
            return false;
        }
        if (onlyUnplayed && isPlayed(match)) {
            return false;
        }
        return true;
    });
    /* =====================================================
       SAATE GÖRE SIRALA
       - 09:00 → 10:00 → 12:30 → ...
       - Saati olmayanlar en sona
       - Aynı saatte alfabetik takım sırası
    ===================================================== */
    result.sort((a, b) => {
        const timeA = timeToMinutes(getTime(a));
        const timeB = timeToMinutes(getTime(b));
        if (timeA !== timeB) {
            return timeA - timeB;
        }
        return String(getHome(a))
            .localeCompare(
                String(getHome(b)),
                "tr-TR"
            );
    });
    return result;
}
/* =========================================================
   BUGÜN ÖZETİ
========================================================= */
function calculateTodaySummary(matches) {
    let total = 0;
    let success = 0;
    for (const match of matches) {
        const recommendations =
            getRecommendations(
                match,
                selectedDate
            );
        if (!recommendations.length) {
            continue;
        }
        const main = recommendations[0];
        const result =
            getMarketOutcome(
                match,
                main.targetMarketId
            );
        if (result === null) {
            continue;
        }
        total++;
        if (result) {
            success++;
        }
    }
    return {
        total,
        success,
        percentage:
            total
                ? (success / total) * 100
                : 0
    };
}
/* =========================================================
   60 GÜN ÖZETİ
========================================================= */
function calculate60DaySummary() {
    let total = 0;
    let success = 0;
    const history =
        getHistoryMatches(selectedDate);
    for (const match of history) {
        const recommendations =
            getRecommendations(
                match,
                selectedDate
            );
        if (!recommendations.length) {
            continue;
        }
        const main = recommendations[0];
        const result =
            getMarketOutcome(
                match,
                main.targetMarketId
            );
        if (result === null) {
            continue;
        }
        total++;
        if (result) {
            success++;
        }
    }
    return {
        total,
        success,
        percentage:
            total
                ? (success / total) * 100
                : 0
    };
}
/* =========================================================
   ÖZET HTML
========================================================= */
function renderSummary(matches) {
    if (!summary) return;
    const today =
        calculateTodaySummary(matches);
    const history =
        calculate60DaySummary();
    summary.innerHTML = `
        <div class="summary-box">
            <div class="summary-title">
                BUGÜN
            </div>
            <div class="summary-value">
                ${
                    today.total
                        ? `%${today.percentage.toFixed(1)}`
                        : "-"
                }
            </div>
            <div class="summary-detail">
                ${today.success}/${today.total}
            </div>
        </div>
        <div class="summary-box">
            <div class="summary-title">
                SON 60 GÜN
            </div>
            <div class="summary-value">
                ${
                    history.total
                        ? `%${history.percentage.toFixed(1)}`
                        : "-"
                }
            </div>
            <div class="summary-detail">
                ${history.success}/${history.total}
            </div>
        </div>
    `;
}
/* =========================================================
   LİG FİLTRESİ
========================================================= */
function fillLeagueFilter() {
    if (!leagueFilter) return;
    const current =
        leagueFilter.value;
    const leagues =
        [...new Set(
            allMatches
                .map(getLeague)
                .filter(Boolean)
        )]
        .sort((a, b) =>
            String(a).localeCompare(
                String(b),
                "tr-TR"
            )
        );
    leagueFilter.innerHTML =
        `<option value="">Tüm Ligler</option>` +
        leagues
            .map(league =>
                `<option value="${escapeHtml(league)}">
                    ${escapeHtml(league)}
                </option>`
            )
            .join("");
    if (leagues.includes(current)) {
        leagueFilter.value = current;
    }
}
/* =========================================================
   TAKVİM
========================================================= */
function renderCalendar() {
    if (!calendar) return;
    const year =
        calendarDate.getFullYear();
    const month =
        calendarDate.getMonth();
    const firstDay =
        new Date(year, month, 1);
    const lastDay =
        new Date(year, month + 1, 0);
    const start =
        (firstDay.getDay() + 6) % 7;
    const totalDays =
        lastDay.getDate();
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
    let html = `
        <div class="calendar-weekdays">
            <div>Pzt</div>
            <div>Sal</div>
            <div>Çar</div>
            <div>Per</div>
            <div>Cum</div>
            <div>Cmt</div>
            <div>Paz</div>
        </div>
        <div class="calendar-days">
    `;
    for (let i = 0; i < start; i++) {
        html += `<div class="calendar-empty"></div>`;
    }
    for (let day = 1; day <= totalDays; day++) {
        const date =
            new Date(year, month, day);
        const active =
            sameDate(date, selectedDate);
        const today =
            sameDate(date, new Date());
        const hasMatches =
            allMatches.some(match => {
                const matchDate = parseDate(
                    getValue(match, [
                        "date",
                        "matchDate",
                        "match_date",
                        "tarih"
                    ])
                );
                return matchDate &&
                    sameDate(matchDate, date);
            });
        html += `
            <button
                type="button"
                class="
                    calendar-day
                    ${active ? "active" : ""}
                    ${today ? "today" : ""}
                    ${hasMatches ? "has-matches" : ""}
                "
                data-date="${dateKey(date)}"
            >
                ${day}
            </button>
        `;
    }
    html += `
        </div>
    `;
    calendar.innerHTML = html;
    calendar
        .querySelectorAll(".calendar-day")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const date =
                        parseDate(button.dataset.date);
                    if (!date) return;
                    selectedDate = date;
                    renderCalendar();
                    render();
                }
            );
        });
}
/* =========================================================
   RENDER
========================================================= */
function render() {
    if (selectedDateText) {
        selectedDateText.textContent =
            formatLongDateTR(selectedDate);
    }
    if (pageTitle) {
        pageTitle.textContent =
            sameDate(selectedDate, new Date())
                ? "Bugünün Maçları"
                : `${formatDateTR(selectedDate)} Maçları`;
    }
    if (pageDescription) {
        pageDescription.textContent =
            "Açılış oranlarından son 60 günlük geçmiş analizine göre tahminler.";
    }
    const matches =
        getDayMatches();
    const cards = matches
        .map(match =>
            matchHtml(
                match,
                selectedDate
            )
        )
        .filter(Boolean);
    if (!cards.length) {
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    Bu tarih için tahmin bulunan maç yok.
                </div>
            `;
        }
    } else {
        if (content) {
            content.innerHTML =
                cards.join("");
        }
    }
    renderSummary(matches);
}
/* =========================================================
   VERİ YÜKLEME
========================================================= */
async function loadData(forceRefresh = false) {
    try {
        if (message) {
            message.textContent =
                "Veriler yükleniyor...";
        }
        const url =
            forceRefresh
                ? `${DATA_URL}?t=${Date.now()}`
                : DATA_URL;
        const response =
            await fetch(url, {
                cache: "no-store"
            });
        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }
        const data =
            await response.json();
        allMatches =
            Array.isArray(data)
                ? data
                : Array.isArray(data.matches)
                    ? data.matches
                    : [];
        allMatches =
            allMatches.filter(match => {
                const date = parseDate(
                    getValue(match, [
                        "date",
                        "matchDate",
                        "match_date",
                        "tarih"
                    ])
                );
                return !!date;
            });
        analysisCache.clear();
        fillLeagueFilter();
        const today =
            new Date();
        const hasToday =
            allMatches.some(match => {
                const date = parseDate(
                    getValue(match, [
                        "date",
                        "matchDate",
                        "match_date",
                        "tarih"
                    ])
                );
                return date &&
                    sameDate(date, today);
            });
        selectedDate =
            hasToday
                ? today
                : (
                    allMatches.length
                        ? parseDate(
                            getValue(
                                allMatches[0],
                                [
                                    "date",
                                    "matchDate",
                                    "match_date",
                                    "tarih"
                                ]
                            )
                        ) || today
                        : today
                );
        calendarDate =
            new Date(selectedDate);
        if (updatedAt) {
            const dataUpdatedAt =
                data?.updatedAt ||
                data?.updated_at;
            if (dataUpdatedAt) {
                const updatedDate =
                    new Date(dataUpdatedAt);
                if (!isNaN(updatedDate.getTime())) {
                    updatedAt.textContent =
                        `Son güncelleme: ${updatedDate.toLocaleString("tr-TR")}`;
                }
            }
        }
        if (message) {
            message.textContent = "";
        }
        renderCalendar();
        render();
    } catch (error) {
        console.error(
            "Veri yükleme hatası:",
            error
        );
        if (message) {
            message.textContent =
                "Veriler yüklenirken hata oluştu.";
        }
        if (content) {
            content.innerHTML = `
                <div class="empty-state error">
                    Veri yüklenemedi.
                </div>
            `;
        }
    }
}
/* =========================================================
   EVENTLER
========================================================= */
prevMonth?.addEventListener(
    "click",
    () => {
        calendarDate.setMonth(
            calendarDate.getMonth() - 1
        );
        renderCalendar();
    }
);
nextMonth?.addEventListener(
    "click",
    () => {
        calendarDate.setMonth(
            calendarDate.getMonth() + 1
        );
        renderCalendar();
    }
);
searchInput?.addEventListener(
    "input",
    render
);
leagueFilter?.addEventListener(
    "change",
    render
);
unplayedOnly?.addEventListener(
    "change",
    render
);
refreshButton?.addEventListener(
    "click",
    () => loadData(true)
);
/* =========================================================
   BAŞLANGIÇ
========================================================= */
loadData();
/* =========================================================
   SERVICE WORKER
========================================================= */
if ("serviceWorker" in navigator) {
    window.addEventListener(
        "load",
        () => {
            navigator.serviceWorker
                .register("./sw.js")
                .catch(error => {
                    console.warn(
                        "Service Worker kaydı başarısız:",
                        error
                    );
                });
        }
    );
}
