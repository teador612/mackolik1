"use strict";

/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = "./data/v2-data.json";
const SCORE_DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;
const MIN_SUCCESS = 70;

/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];
let scoreMatches = [];

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

function sameDate(a, b) {
    return dateKey(a) === dateKey(b);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDateTR(date) {
    return date.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function formatLongDateTR(date) {
    return date.toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "2-digit",
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
        if (isNaN(value.getTime())) return null;

        return new Date(
            value.getFullYear(),
            value.getMonth(),
            value.getDate()
        );
    }

    const text = String(value).trim();
    let match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

    if (match) {
        return new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );
    }

    match = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);

    if (match) {
        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
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
        "date", "Date", "tarih", "Tarih",
        "matchDate", "match_date"
    ]);
}

function getHome(match) {
    return getValue(match, [
        "home", "Home", "homeTeam", "home_team",
        "ev", "Ev", "evSahibi", "homeName",
        "home_team_name", "homeTeamName"
    ]) || "-";
}

function getAway(match) {
    return getValue(match, [
        "away", "Away", "awayTeam", "away_team",
        "deplasman", "Deplasman", "awayName",
        "away_team_name", "awayTeamName"
    ]) || "-";
}

function getTime(match) {
    return getValue(match, [
        "time", "Time", "saat", "Saat",
        "matchTime", "kickoff", "kickoffTime"
    ]) || "";
}

function getLeague(match) {
    return getValue(match, [
        "league", "League", "lig", "Lig",
        "competition", "tournament"
    ]) || "Lig belirtilmemiş";
}

/* =========================================================
   SKOR OKUMA
========================================================= */

function parseScore(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "object") {
        const home = getValue(value, [
            "home", "Home", "ev", "h", "homeScore"
        ]);

        const away = getValue(value, [
            "away", "Away", "deplasman", "a", "awayScore"
        ]);

        if (home !== undefined && away !== undefined) {
            const h = Number(home);
            const a = Number(away);

            if (
                Number.isInteger(h) &&
                Number.isInteger(a) &&
                h >= 0 &&
                a >= 0
            ) {
                return { home: h, away: a };
            }
        }
    }

    const text = String(value).trim();
    const match = text.match(/(?:^|\D)(\d+)\s*[-:–]\s*(\d+)(?:\D|$)/);

    if (!match) return null;

    return {
        home: Number(match[1]),
        away: Number(match[2])
    };
}

function getFullTimeScore(match) {
    return parseScore(getValue(match, [
        "score", "Score", "fullTimeScore", "fulltimeScore",
        "ftScore", "ft", "FT", "fullTime", "FullTime",
        "ms", "MS", "macSonucu", "MaçSonucu",
        "result", "resultScore", "matchScore",
        "scoreText", "skor", "Skor"
    ]));
}

function getHalfTimeScore(match) {
    return parseScore(getValue(match, [
        "halfTimeScore", "halftimeScore", "half_score",
        "htScore", "HTScore", "ht", "HT", "halfTime",
        "half", "iy", "IY", "ilkYari", "halfTimeResult"
    ]));
}

/* =========================================================
   MAÇ DURUMU
========================================================= */

function getMatchStatusText(match) {
    const value = getValue(match, [
        "status", "Status", "matchStatus", "match_status",
        "state", "stateText", "statusText", "status_text",
        "macDurumu", "durum", "Durum", "period", "periodName"
    ]);

    if (value === undefined) return "";

    if (typeof value === "object") {
        return String(
            getValue(value, ["name", "text", "label", "shortName"]) || ""
        ).toLocaleLowerCase("tr-TR");
    }

    return String(value).toLocaleLowerCase("tr-TR");
}

function isFinishedMatch(match) {
    const status = getMatchStatusText(match);

    if (
        /canlı|canli|live|in.?play|devre|1st half|2nd half|ht\b/.test(status)
    ) {
        return false;
    }

    if (
        /bitmiş|bitti|finished|full.?time|after.?extra|penaltılar|maç sonucu|mac sonucu/.test(status)
    ) {
        return true;
    }

    const explicit = getValue(match, [
        "finished", "isFinished", "is_finished",
        "completed", "isCompleted"
    ]);

    if (explicit === true || explicit === 1) return true;

    return false;
}

function isLiveMatch(match) {
    const status = getMatchStatusText(match);

    if (
        /canlı|canli|live|in.?play|1st half|2nd half|devre arası|devam ediyor/.test(status)
    ) {
        return true;
    }

    const live = getValue(match, [
        "live", "isLive", "is_live", "inPlay"
    ]);

    return live === true || live === 1;
}

function isPlayed(match) {
    return !!getFullTimeScore(match);
}

/* =========================================================
   V2 MAÇIYLA SKOR MAÇINI EŞLEŞTİR
========================================================= */

function normalizeTeamName(value) {
    return String(value || "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/[^a-z0-9]/g, "");
}

function getMatchId(match) {
    return getValue(match, [
        "id", "matchId", "match_id", "eventId",
        "event_id", "fixtureId", "fixture_id"
    ]);
}

function findScoreMatch(match) {
    if (!scoreMatches.length) return null;

    const id = getMatchId(match);

    if (id !== undefined && id !== null) {
        const byId = scoreMatches.find(item => {
            const otherId = getMatchId(item);

            return otherId !== undefined &&
                String(otherId) === String(id);
        });

        if (byId) return byId;
    }

    const date = parseDate(getDate(match));

    if (!date) return null;

    const targetDate = dateKey(date);
    const home = normalizeTeamName(getHome(match));
    const away = normalizeTeamName(getAway(match));

    if (!home || !away || home === "-" || away === "-") {
        return null;
    }

    return scoreMatches.find(item => {
        const otherDate = parseDate(getDate(item));

        if (!otherDate || dateKey(otherDate) !== targetDate) {
            return false;
        }

        const otherHome = normalizeTeamName(getHome(item));
        const otherAway = normalizeTeamName(getAway(item));

        return home === otherHome && away === otherAway;
    }) || null;
}

/* Skor verisi yalnızca eşleşen maça uygulanır.
   V2 tahmin oranları ve geçmiş analiz kayıtları değiştirilmez. */

function getDisplayMatch(match) {
    return findScoreMatch(match) || match;
}

function getDisplayScore(match) {
    return getFullTimeScore(getDisplayMatch(match));
}

function getDisplayHalfTimeScore(match) {
    return getHalfTimeScore(getDisplayMatch(match));
}

function getDisplayStatus(match) {
    const source = getDisplayMatch(match);
    const score = getFullTimeScore(source);

    if (isLiveMatch(source)) {
        return {
            className: "live",
            label: score
                ? `CANLI · ${score.home}-${score.away}`
                : "CANLI"
        };
    }

    if (isFinishedMatch(source)) {
        return {
            className: "finished",
            label: score
                ? `BİTTİ · ${score.home}-${score.away}`
                : "BİTTİ"
        };
    }

    if (score) {
        return {
            className: "score-available",
            label: `${score.home}-${score.away}`
        };
    }

    return {
        className: "pending",
        label: "BEKLİYOR"
    };
}

/* =========================================================
   ORANLAR
========================================================= */

function normalizeOdds(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const number = Number(
        String(value).replace(",", ".").trim()
    );

    if (!Number.isFinite(number) || number <= 1.00) {
        return null;
    }

    return number.toFixed(2);
}

function getOdds(match, names) {
    const direct = getValue(match, names);

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
        if (!container) continue;

        const value = getValue(container, names);

        if (value !== undefined) {
            return normalizeOdds(value);
        }
    }

    return null;
}

/* =========================================================
   ÖRNEKLEM MARKETLERİ
========================================================= */

const SOURCE_MARKETS = [
    {
        id: "IY15U",
        title: "İY 1.5 Üst",
        odds: match => getOdds(match, [
            "iy15Ust", "iy15üst", "iy15U", "IY15U",
            "iy1_5U", "iy1_5Over", "iy15Over"
        ])
    },
    {
        id: "IY1",
        title: "İY 1",
        odds: match => getOdds(match, [
            "iy1", "IY1", "İY1", "iy_1"
        ])
    },
    {
        id: "IY2",
        title: "İY 2",
        odds: match => getOdds(match, [
            "iy2", "IY2", "İY2", "iy_2"
        ])
    },
    {
        id: "MS15A",
        title: "1.5 Alt",
        odds: match => getOdds(match, [
            "au15Alt", "au15alt", "15Alt",
            "1.5Alt", "1_5Alt", "under15"
        ])
    },
    {
        id: "MS15U",
        title: "1.5 Üst",
        odds: match => getOdds(match, [
            "au15Ust", "au15üst", "au15U",
            "15Ust", "1.5Ust", "1.5Üst",
            "1_5Ust", "over15"
        ])
    }
];

/* =========================================================
   TAHMİN MARKETLERİ
========================================================= */

const TARGET_MARKETS = [
    {
        id: "IY15A",
        title: "İY 1.5 Alt",
        odds: match => getOdds(match, [
            "iy15Alt", "iy15alt", "iy1_5Alt",
            "iy1.5Alt", "IY15A"
        ])
    },
    {
        id: "IY15U",
        title: "İY 1.5 Üst",
        odds: match => getOdds(match, [
            "iy15Ust", "iy15üst", "iy15U",
            "IY15U", "iy1_5U", "iy1_5Over", "iy15Over"
        ])
    },
    {
        id: "KG",
        title: "KG Var",
        odds: match => getOdds(match, [
            "kgVar", "KGVar", "kgvar", "kg", "KG"
        ])
    },
    {
        id: "KGY",
        title: "KG Yok",
        odds: match => getOdds(match, [
            "kgYok", "KGYok", "kgyok", "kgy", "KGY"
        ])
    },
    {
        id: "IYKG",
        title: "İlk Yarı KG Var",
        odds: match => getOdds(match, [
            "iyKgVar", "iyKGVar", "iykgVar", "iyKg", "IYKG"
        ])
    },
    {
        id: "MS25U",
        title: "2.5 Üst",
        odds: match => getOdds(match, [
            "au25Ust", "au25üst", "au25U", "ms25U",
            "MS25U", "ms25u", "ms2_5U", "ms2_5Over",
            "ms25Over", "2.5Ust", "2.5Üst", "25Ust", "25üst"
        ])
    }
];

const MARKETS = SOURCE_MARKETS;

/* =========================================================
   MARKET SONUCU
========================================================= */

function getMarketOutcome(match, marketId) {
    if (marketId === "IY1" || marketId === "IY2") {
        const score = getHalfTimeScore(match);

        if (!score) return null;

        return marketId === "IY1"
            ? score.home > score.away
            : score.away > score.home;
    }

    if (marketId === "IY15A" || marketId === "IY15U") {
        const score = getHalfTimeScore(match);

        if (!score) return null;

        const total = score.home + score.away;

        return marketId === "IY15A"
            ? total <= 1
            : total >= 2;
    }

    if (marketId === "MS15A" || marketId === "MS15U") {
        const score = getFullTimeScore(match);

        if (!score) return null;

        const total = score.home + score.away;

        return marketId === "MS15A"
            ? total <= 1
            : total >= 2;
    }

    if (marketId === "KG" || marketId === "KGY") {
        const score = getFullTimeScore(match);

        if (!score) return null;

        const bothScored = score.home > 0 && score.away > 0;

        return marketId === "KG" ? bothScored : !bothScored;
    }

    if (marketId === "IYKG" || marketId === "IYKGY") {
        const score = getHalfTimeScore(match);

        if (!score) return null;

        const bothScored = score.home > 0 && score.away > 0;

        return marketId === "IYKG" ? bothScored : !bothScored;
    }

    if (marketId === "MS25U") {
        const score = getFullTimeScore(match);

        if (!score) return null;

        return score.home + score.away >= 3;
    }

    return null;
}

/* =========================================================
   60 GÜNLÜK GEÇMİŞ
========================================================= */

function getHistoryMatches(targetDate) {
    const end = new Date(targetDate);
    end.setHours(0, 0, 0, 0);

    const start = addDays(end, -HISTORY_DAYS);

    return allMatches.filter(match => {
        const date = parseDate(getDate(match));

        if (!date) return false;

        date.setHours(0, 0, 0, 0);

        return date >= start && date < end && isPlayed(match);
    });
}

/* =========================================================
   ANALİZ İNDEKSİ
========================================================= */

function buildAnalysisIndex(targetDate) {
    const key = dateKey(targetDate);

    if (analysisCache.has(key)) {
        return analysisCache.get(key);
    }

    const history = getHistoryMatches(targetDate);
    const index = new Map();

    for (const historical of history) {
        for (const source of SOURCE_MARKETS) {
            const odds = source.odds(historical);

            if (!odds) continue;

            const sourceKey = `${source.id}|${odds}`;

            if (!index.has(sourceKey)) {
                index.set(sourceKey, []);
            }

            index.get(sourceKey).push(historical);
        }
    }

    analysisCache.set(key, index);

    return index;
}

/* =========================================================
   TAHMİNLER
========================================================= */

function getRecommendations(match, targetDate) {
    const index = buildAnalysisIndex(targetDate);
    const recommendations = [];

    for (const source of SOURCE_MARKETS) {
        const sourceOdds = source.odds(match);

        if (!sourceOdds) continue;

        const sourceKey = `${source.id}|${sourceOdds}`;
        const historicalMatches = index.get(sourceKey) || [];

        if (historicalMatches.length < MIN_SAMPLE) continue;

        for (const target of TARGET_MARKETS) {
            if (source.id === target.id) continue;

            let total = 0;
            let success = 0;

            for (const historical of historicalMatches) {
                const result = getMarketOutcome(
                    historical,
                    target.id
                );

                if (result === null) continue;

                total++;

                if (result === true) success++;
            }

            if (total < MIN_SAMPLE) continue;

            const percentage = (success / total) * 100;

            if (percentage < MIN_SUCCESS) continue;

            const targetOdds = target.odds(match);

            if (!targetOdds || targetOdds === "0.00") continue;

            recommendations.push({
                sourceMarket: source.id,
                sourceTitle: source.title,
                sourceOdds,
                targetMarket: target.id,
                targetTitle: target.title,
                targetOdds,
                success,
                total,
                percentage
            });
        }
    }

    recommendations.sort((a, b) => {
        if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
        }

        return b.total - a.total;
    });

    const unique = [];
    const seen = new Set();

    for (const item of recommendations) {
        const key = [
            item.sourceMarket,
            item.sourceOdds,
            item.targetMarket
        ].join("|");

        if (seen.has(key)) continue;

        seen.add(key);
        unique.push(item);
    }

    return unique;
}

/* =========================================================
   TAHMİN DURUMU
========================================================= */

function getRecommendationStatus(match, recommendation) {
    const scoreMatch = getDisplayMatch(match);

    if (!isFinishedMatch(scoreMatch)) {
        return "pending";
    }

    const result = getMarketOutcome(
        scoreMatch,
        recommendation.targetMarket
    );

    if (result === true) return "success";
    if (result === false) return "failed";

    return "pending";
}

/* =========================================================
   TAHMİN HTML
========================================================= */

function recommendationHtml(match, recommendation) {
    const status = getRecommendationStatus(match, recommendation);
    const targetOdd = recommendation.targetOdds || "-";

    return `
        <div class="recommendation ${status}">
            <span class="recommendation-dot"></span>

            <div class="recommendation-main">
                <div class="recommendation-line">
                    <span class="recommendation-label">Örneklem</span>

                    <strong>
                        ${escapeHtml(recommendation.sourceTitle)}
                    </strong>

                    <span class="odd">
                        ${escapeHtml(recommendation.sourceOdds)}
                    </span>

                    <span class="arrow">→</span>

                    <span class="recommendation-label">Tahmin</span>

                    <strong>
                        ${escapeHtml(recommendation.targetTitle)}
                    </strong>

                    <span class="odd">
                        ${escapeHtml(targetOdd)}
                    </span>
                </div>

                <div class="recommendation-stats">
                    ${recommendation.success}/${recommendation.total}
                    · %${recommendation.percentage.toFixed(1)}
                </div>
            </div>
        </div>
    `;
}

/* =========================================================
   SKOR DURUMU HTML
========================================================= */

function scoreStatusHtml(match) {
    const status = getDisplayStatus(match);

    return `
        <div class="v2-score-status v2-score-${escapeHtml(status.className)}">
            <span class="v2-score-indicator"></span>
            <span>${escapeHtml(status.label)}</span>
        </div>
    `;
}

/* =========================================================
   MAÇ KARTI
========================================================= */

function matchHtml(match, recommendations, index) {
    const first = recommendations[0];
    const extra = recommendations.slice(1);

    const ft = getDisplayScore(match);
    const ht = getDisplayHalfTimeScore(match);

    const displayMatch = getDisplayMatch(match);

    const time = getTime(match) || getTime(displayMatch);

    let html = `
        <article class="match-card">

            <div class="match-top">
                <span class="match-time">
                    ${escapeHtml(time)}
                </span>

                <span class="match-league">
                    ${escapeHtml(getLeague(match))}
                </span>
            </div>

            ${scoreStatusHtml(match)}

            <div class="teams">
                <div class="team home">
                    <span class="team-name">
                        ${escapeHtml(getHome(match))}
                    </span>

                    ${
                        ft
                            ? `<span class="team-score">${ft.home}</span>`
                            : ""
                    }
                </div>

                <div class="vs">
                    ${ft ? "MS" : "VS"}
                </div>

                <div class="team away">
                    ${
                        ft
                            ? `<span class="team-score">${ft.away}</span>`
                            : ""
                    }

                    <span class="team-name">
                        ${escapeHtml(getAway(match))}
                    </span>
                </div>
            </div>

            ${
                ht
                    ? `<div class="half-score">İY ${ht.home}-${ht.away}</div>`
                    : ""
            }

            <div class="recommendations">
                <div class="recommendation-list">
                    ${recommendationHtml(match, first)}
                </div>
    `;

    if (extra.length) {
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
                ${extra.map(item => recommendationHtml(match, item)).join("")}
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
   GÜNÜN MAÇLARI
========================================================= */

function getDayMatches() {
    const key = dateKey(selectedDate);

    let result = allMatches.filter(match => {
        const date = parseDate(getDate(match));

        return date && dateKey(date) === key;
    });

    const search = searchInput
        ? searchInput.value.trim().toLocaleLowerCase("tr-TR")
        : "";

    if (search) {
        result = result.filter(match => {
            const text = [
                getHome(match),
                getAway(match),
                getLeague(match)
            ].join(" ").toLocaleLowerCase("tr-TR");

            return text.includes(search);
        });
    }

    const league = leagueFilter ? leagueFilter.value : "";

    if (league) {
        result = result.filter(
            match => getLeague(match) === league
        );
    }

    if (unplayedOnly && unplayedOnly.checked) {
        result = result.filter(match => {
            const source = getDisplayMatch(match);

            return !isFinishedMatch(source) && !isPlayed(match);
        });
    }

    return result;
}

/* =========================================================
   BUGÜN BAŞARI
========================================================= */

function calculateTodaySummary(predictedMatches) {
    let success = 0;
    let total = 0;

    for (const item of predictedMatches) {
        const scoreMatch = getDisplayMatch(item.match);

        if (!isFinishedMatch(scoreMatch)) continue;

        const mainRecommendation = item.recommendations?.[0];

        if (!mainRecommendation) continue;

        const result = getMarketOutcome(
            scoreMatch,
            mainRecommendation.targetMarket
        );

        if (result === null) continue;

        total++;

        if (result === true) success++;
    }

    return {
        success,
        total,
        percentage: total ? (success / total) * 100 : null
    };
}

/* =========================================================
   SON 60 GÜN BAŞARI
========================================================= */

function calculate60DaySummary() {
    const end = new Date(selectedDate);
    end.setHours(0, 0, 0, 0);

    const start = addDays(end, -HISTORY_DAYS);

    let success = 0;
    let total = 0;

    const historicalDays = allMatches.filter(match => {
        const date = parseDate(getDate(match));

        if (!date) return false;

        date.setHours(0, 0, 0, 0);

        return date >= start && date < end && isPlayed(match);
    });

    for (const match of historicalDays) {
        const matchDate = parseDate(getDate(match));

        if (!matchDate) continue;

        const recommendations = getRecommendations(match, matchDate);

        if (!recommendations.length) continue;

        const mainRecommendation = recommendations[0];

        const result = getMarketOutcome(
            match,
            mainRecommendation.targetMarket
        );

        if (result === null) continue;

        total++;

        if (result === true) success++;
    }

    return {
        success,
        total,
        percentage: total ? (success / total) * 100 : null
    };
}

/* =========================================================
   ÖZET
========================================================= */

function renderSummary(predictedMatches) {
    if (!summary) return;

    const today = calculateTodaySummary(predictedMatches);
    const sixty = calculate60DaySummary();

    const todayPercentage = today.percentage === null
        ? "-"
        : `%${today.percentage.toFixed(1)}`;

    const sixtyPercentage = sixty.percentage === null
        ? "-"
        : `%${sixty.percentage.toFixed(1)}`;

    summary.innerHTML = `
        <div class="summary-grid">
            <div class="summary-card">
                <span>BUGÜN</span>
                <strong>${todayPercentage}</strong>
                <small>${today.success}/${today.total}</small>
            </div>

            <div class="summary-card">
                <span>SON 60 GÜN</span>
                <strong>${sixtyPercentage}</strong>
                <small>${sixty.success}/${sixty.total}</small>
            </div>
        </div>
    `;
}

/* =========================================================
   LİG FİLTRESİ
========================================================= */

function fillLeagueFilter() {
    if (!leagueFilter) return;

    const leagues = new Set();

    for (const match of allMatches) {
        const league = getLeague(match);

        if (league) leagues.add(league);
    }

    const sorted = [...leagues].sort(
        (a, b) => a.localeCompare(b, "tr")
    );

    leagueFilter.innerHTML = `
        <option value="">Tüm Ligler</option>
    `;

    for (const league of sorted) {
        const option = document.createElement("option");

        option.value = league;
        option.textContent = league;

        leagueFilter.appendChild(option);
    }
}

/* =========================================================
   ANA RENDER
========================================================= */

function render() {
    if (!selectedDate) return;

    const allDay = getDayMatches();
    const predicted = [];

    for (const match of allDay) {
        const recommendations = getRecommendations(
            match,
            selectedDate
        );

        if (
            recommendations.length > 0 &&
            recommendations[0].targetOdds &&
            recommendations[0].targetOdds !== "-" &&
            recommendations[0].targetOdds !== "0.00"
        ) {
            predicted.push({
                match,
                recommendations
            });
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (pageTitle) {
        pageTitle.textContent = sameDate(selectedDate, today)
            ? "Bugünün Maçları"
            : `${formatDateTR(selectedDate)} Maçları`;
    }

    if (pageDescription) {
        pageDescription.textContent =
            `Geçmiş ${HISTORY_DAYS} gündeki birebir aynı oranlar analiz ediliyor.`;
    }

    renderSummary(predicted);

    const history = getHistoryMatches(selectedDate);

    if (message) {
        message.textContent =
            `${predicted.length} tahminli maç · ${history.length} geçmiş maç analiz edildi`;
    }

    if (updatedAt) {
        const start = addDays(selectedDate, -HISTORY_DAYS);
        const end = addDays(selectedDate, -1);

        updatedAt.textContent =
            `Geçmiş: ${formatDateTR(start)} - ${formatDateTR(end)}`;
    }

    if (!predicted.length) {
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    Bu tarihte uygun tahmin bulunamadı.
                </div>
            `;
        }

        return;
    }

    if (content) {
        content.innerHTML = `
            <div class="match-list">
                ${predicted.map((item, index) =>
                    matchHtml(item.match, item.recommendations, index)
                ).join("")}
            </div>
        `;
    }
}

/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {
    if (!calendarDays || !calendarMonth) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    calendarMonth.textContent = calendarDate.toLocaleDateString(
        "tr-TR",
        {
            month: "long",
            year: "numeric"
        }
    );

    calendarDays.innerHTML = "";

    const first = new Date(year, month, 1);

    let start = first.getDay();
    start = start === 0 ? 6 : start - 1;

    const days = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < start; i++) {
        const empty = document.createElement("div");

        empty.className = "calendar-day empty";
        calendarDays.appendChild(empty);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= days; day++) {
        const date = new Date(year, month, day);
        const button = document.createElement("button");

        button.type = "button";
        button.className = "calendar-day";
        button.textContent = day;

        if (sameDate(date, selectedDate)) {
            button.classList.add("selected");
        }

        if (sameDate(date, today)) {
            button.classList.add("today");
        }

        button.addEventListener("click", () => {
            selectedDate = new Date(date);
            calendarDate = new Date(date);

            if (selectedDateText) {
                selectedDateText.textContent =
                    formatLongDateTR(selectedDate);
            }

            if (calendarPopup) {
                calendarPopup.classList.add("hidden");
            }

            renderCalendar();
            render();
        });

        calendarDays.appendChild(button);
    }
}

/* =========================================================
   BUGÜN
========================================================= */

function setToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    selectedDate = new Date(today);
    calendarDate = new Date(today);

    if (selectedDateText) {
        selectedDateText.textContent = formatLongDateTR(today);
    }
}

/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {
    if (calendarToggle && calendarPopup) {
        calendarToggle.addEventListener("click", event => {
            event.stopPropagation();
            calendarPopup.classList.toggle("hidden");
        });
    }

    if (prevMonth) {
        prevMonth.addEventListener("click", event => {
            event.stopPropagation();

            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextMonth) {
        nextMonth.addEventListener("click", event => {
            event.stopPropagation();

            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        });
    }

    document.addEventListener("click", event => {
        if (
            calendarPopup &&
            calendarToggle &&
            !calendarPopup.contains(event.target) &&
            !calendarToggle.contains(event.target)
        ) {
            calendarPopup.classList.add("hidden");
        }
    });

    if (searchInput) {
        searchInput.addEventListener("input", render);
    }

    if (leagueFilter) {
        leagueFilter.addEventListener("change", render);
    }

    if (unplayedOnly) {
        unplayedOnly.addEventListener("change", render);
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", () => {
            analysisCache.clear();
            loadData(true);
        });
    }

    document.addEventListener("click", event => {
        const button = event.target.closest(".more-recommendations");

        if (!button) return;

        const index = button.dataset.index;
        const extra = document.getElementById(`extra-${index}`);

        if (!extra) return;

        const hidden = extra.classList.toggle("hidden");

        button.textContent = hidden
            ? `+${extra.children.length}`
            : "−";
    });
}

/* =========================================================
   VERİ DOSYASI OKUMA
========================================================= */

async function fetchJson(url, forceRefresh = false) {
    const requestUrl = forceRefresh
        ? `${url}?v=${Date.now()}`
        : url;

    const response = await fetch(requestUrl, {
        cache: forceRefresh ? "no-store" : "default"
    });

    if (!response.ok) {
        throw new Error(`${url} yüklenemedi: HTTP ${response.status}`);
    }

    return response.json();
}

function extractMatches(data) {
    if (Array.isArray(data)) return data;

    if (data && Array.isArray(data.matches)) {
        return data.matches;
    }

    return null;
}

/* =========================================================
   VERİLERİ YÜKLE
========================================================= */

async function loadData(forceRefresh = false) {
    if (message) {
        message.textContent = "Veriler yükleniyor...";
    }

    if (content) {
        content.innerHTML = `
            <div class="empty-state">Veriler yükleniyor...</div>
        `;
    }

    try {
        /*
         * V2 tahmin verisi zorunludur.
         * Skor verisi ayrıca yüklenir; hata olursa V2 yine açılır.
         */

        const v2Data = await fetchJson(DATA_URL, forceRefresh);
        const v2Matches = extractMatches(v2Data);

        if (!v2Matches) {
            throw new Error("V2 veri formatı geçersiz.");
        }

        allMatches = v2Matches.filter(match =>
            !!parseDate(getDate(match))
        );

        if (!allMatches.length) {
            throw new Error("V2 verisinde geçerli maç bulunamadı.");
        }

        try {
            const scoreData = await fetchJson(
                SCORE_DATA_URL,
                forceRefresh
            );

            const parsedScores = extractMatches(scoreData);

            scoreMatches = parsedScores || [];

            console.info(
                `[V2] Skor kaynağı yüklendi: ${scoreMatches.length} maç`
            );
        } catch (scoreError) {
            scoreMatches = [];

            console.warn(
                "[V2] Skor dosyası yüklenemedi. V2 verileri kullanılacak.",
                scoreError
            );
        }

        analysisCache.clear();

        fillLeagueFilter();
        setToday();
        renderCalendar();
        render();

        if (updatedAt) {
            const now = new Date();

            updatedAt.textContent +=
                ` · Güncellendi ${now.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit"
                })}`;
        }

    } catch (error) {
        console.error(error);

        if (message) {
            message.textContent = "Veri yüklenemedi";
        }

        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    <strong>Veri yükleme hatası</strong>
                    <br><br>
                    <small>${escapeHtml(error.message)}</small>
                </div>
            `;
        }
    }
}

/* =========================================================
   SKOR STİLLERİ
   Mevcut style.css dosyasını değiştirmez.
========================================================= */

(function addScoreStyles() {
    const style = document.createElement("style");

    style.textContent = `
        .v2-score-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            width: fit-content;
            max-width: 100%;
            margin: 8px auto 10px;
            padding: 5px 11px;
            border: 1px solid rgba(148, 163, 184, .22);
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .035em;
            line-height: 1.4;
        }

        .v2-score-indicator {
            width: 7px;
            height: 7px;
            flex: 0 0 7px;
            border-radius: 50%;
            background: currentColor;
        }

        .v2-score-pending {
            color: #fbbf24;
            background: rgba(251, 191, 36, .09);
            border-color: rgba(251, 191, 36, .22);
        }

        .v2-score-live {
            color: #fb7185;
            background: rgba(244, 63, 94, .11);
            border-color: rgba(244, 63, 94, .28);
        }

        .v2-score-live .v2-score-indicator {
            animation: v2ScorePulse 1.2s infinite;
        }

        .v2-score-finished {
            color: #4ade80;
            background: rgba(34, 197, 94, .09);
            border-color: rgba(34, 197, 94, .24);
        }

        .v2-score-available {
            color: #93c5fd;
            background: rgba(59, 130, 246, .09);
            border-color: rgba(59, 130, 246, .24);
        }

        @keyframes v2ScorePulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .35; }
        }
    `;

    document.head.appendChild(style);
})();

/* =========================================================
   BAŞLAT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    setToday();
    renderCalendar();
    loadData();
});

/* =========================================================
   PWA
========================================================= */

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js");
    });
}
