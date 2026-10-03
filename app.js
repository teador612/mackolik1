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

    let match = text.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
    );

    if (match) {
        return new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );
    }

    match = text.match(
        /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
    );

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
    return getValue(match, [
        "date",
        "Date",
        "tarih",
        "Tarih",
        "matchDate",
        "match_date"
    ]);
}

function getHome(match) {
    return (
        getValue(match, [
            "home",
            "Home",
            "homeTeam",
            "home_team",
            "ev",
            "Ev",
            "evSahibi"
        ]) || "-"
    );
}

function getAway(match) {
    return (
        getValue(match, [
            "away",
            "Away",
            "awayTeam",
            "away_team",
            "deplasman",
            "Deplasman"
        ]) || "-"
    );
}

function getTime(match) {
    return (
        getValue(match, [
            "time",
            "Time",
            "saat",
            "Saat",
            "matchTime"
        ]) || ""
    );
}

function getLeague(match) {
    return (
        getValue(match, [
            "league",
            "League",
            "lig",
            "Lig",
            "competition",
            "tournament"
        ]) || "Lig belirtilmemiş"
    );
}

/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {
    if (!value) {
        return null;
    }

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

    if (!match) {
        return null;
    }

    return {
        home: Number(match[1]),
        away: Number(match[2])
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

    const number = Number(
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
        if (!container) {
            continue;
        }

        const value = getValue(
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
=========================================================

   SADECE İSTENEN MARKETLER:

   1. İY 1.5 Alt
   2. İY 1.5 Üst
   3. KG Var
   4. KG Yok
   5. İlk Yarı KG Var
   6. İlk Yarı KG Yok
   7. 2.5 Üst

   İY 0.5 Üst YOK.
========================================================= */

const MARKETS = [

    /* =====================================================
       İY 1.5 ALT
    ===================================================== */

    {
        id: "IY15A",
        title: "İY 1.5 Alt",

        odds: match =>
            getOdds(match, [
                "iy15Alt",
                "IY15Alt",
                "iy15alt",
                "iy1_5Alt",
                "iy1_5Under",
                "iy15Under",
                "IY1.5A",
                "İY1.5A",
                "iy1.5alt",
                "iy15_alt",
                "iy15Alt"
            ])
    },

    /* =====================================================
       İY 1.5 ÜST
    ===================================================== */

    {
        id: "IY15U",
        title: "İY 1.5 Üst",

        odds: match =>
            getOdds(match, [
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
                "iy15üst",
                "iy15Ust",
                "IY15_Ust",
                "IY15_Üst",
                "iy15_over"
            ])
    },

    /* =====================================================
       NORMAL KG VAR
    ===================================================== */

    {
        id: "KG",
        title: "KG Var",

        odds: match =>
            getOdds(match, [
                "kg",
                "KG",
                "kgVar",
                "KGVar",
                "kgvar",
                "kg1",
                "KG1"
            ])
    },

    /* =====================================================
       NORMAL KG YOK
    ===================================================== */

    {
        id: "KGY",
        title: "KG Yok",

        odds: match =>
            getOdds(match, [
                "kgy",
                "KGY",
                "kgYok",
                "KGYok",
                "kgyok",
                "kg0",
                "KG0"
            ])
    },

    /* =====================================================
       İLK YARI KG VAR
       
       ORAN OLMASA DA MARKET ÇALIŞIR.
    ===================================================== */

    {
        id: "IYKG",
        title: "İlk Yarı KG Var",

        odds: match =>
            getOdds(match, [
                "iyKgVar",
                "IYKgVar",
                "iyKGVar",
                "iykgvar",
                "iyKg1",
                "IYKG1",
                "ilkYariKgVar",
                "ilkYariKGVar",
                "ilkYariKg1",
                "IYKG",
                "IYKGVar"
            ])
    },

    /* =====================================================
       İLK YARI KG YOK
       
       ORAN OLMASA DA MARKET ÇALIŞIR.
    ===================================================== */

    {
        id: "IYKGY",
        title: "İlk Yarı KG Yok",

        odds: match =>
            getOdds(match, [
                "iyKgYok",
                "IYKgYok",
                "iyKGYok",
                "iykgyok",
                "iyKg0",
                "IYKG0",
                "ilkYariKgYok",
                "ilkYariKGYok",
                "ilkYariKg0",
                "IYKGY",
                "IYKGYok"
            ])
    },

    /* =====================================================
       2.5 ÜST
       
       Mackolik verisindeki doğru alan:
       au25Ust
    ===================================================== */

    {
        id: "MS25U",
        title: "2.5 Üst",

        odds: match =>
            getOdds(match, [
                "au25Ust",
                "au25üst",
                "au25ust",
                "AU25Ust",
                "AU25Üst",

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
            ])
    }

];

/* =========================================================
   MARKET SONUCU
========================================================= */

function getMarketOutcome(
    match,
    marketId
) {

    /* =====================================================
       İY 1.5 ALT / ÜST
    ===================================================== */

    if (
        marketId === "IY15A" ||
        marketId === "IY15U"
    ) {

        const score =
            getHalfTimeScore(match);

        if (!score) {
            return null;
        }

        const total =
            score.home +
            score.away;

        if (marketId === "IY15A") {
            return total <= 1;
        }

        if (marketId === "IY15U") {
            return total >= 2;
        }
    }

    /* =====================================================
       İLK YARI KG VAR / YOK
    ===================================================== */

    if (
        marketId === "IYKG" ||
        marketId === "IYKGY"
    ) {

        const score =
            getHalfTimeScore(match);

        if (!score) {
            return null;
        }

        const bothScored =
            score.home > 0 &&
            score.away > 0;

        if (marketId === "IYKG") {
            return bothScored;
        }

        return !bothScored;
    }

    /* =====================================================
       NORMAL KG VAR / YOK
    ===================================================== */

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

        if (marketId === "KG") {
            return bothScored;
        }

        return !bothScored;
    }

    /* =====================================================
       2.5 ÜST
    ===================================================== */

    if (marketId === "MS25U") {

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

    return null;
}

/* =========================================================
   60 GÜNLÜK GEÇMİŞ
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

            /*
               Kaynak oranı yoksa
               o market kaynak olarak
               kullanılamaz.
            */

            if (!odds) {
                continue;
            }

            const sourceKey =
                `${source.id}|${odds}`;

            if (
                !index.has(
                    sourceKey
                )
            ) {
                index.set(
                    sourceKey,
                    []
                );
            }

            index.get(
                sourceKey
            ).push(
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

    for (
        const source
        of MARKETS
    ) {

        const sourceOdds =
            source.odds(match);

        /*
           Kaynak markette oran yoksa
           geçmişte birebir oran
           eşleştiremeyiz.
        */

        if (!sourceOdds) {
            continue;
        }

        const sourceKey =
            `${source.id}|${sourceOdds}`;

        const historicalMatches =
            index.get(
                sourceKey
            ) || [];

        if (
            historicalMatches.length <
            MIN_SAMPLE
        ) {
            continue;
        }

        for (
            const target
            of MARKETS
        ) {

            /*
               Aynı market:
               örneğin KG Var → KG Var
               yapılmaz.
            */

            if (
                source.id ===
                target.id
            ) {
                continue;
            }

            /*
               DİKKAT:
               Hedef oranın bulunması ARTIK
               şart değil.

               Yoksa "-" gösterilecek.
            */

            const targetOdds =
                target.odds(match);

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

                targetOdds:
                    targetOdds || null,

                success,

                total,

                percentage
            });
        }
    }

    /* =====================================================
       SIRALAMA
    ===================================================== */

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

    /* =====================================================
       AYNI TAHMİNİ TEKRARLAMA
    ===================================================== */

    const unique = [];
    const seen = new Set();

    for (
        const item
        of recommendations
    ) {

        const key = [
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

    const targetOdd =
        recommendation.targetOdds ||
        "-";

    return `
        <div class="recommendation ${status}">
            <span class="recommendation-dot"></span>

            <div class="recommendation-main">

                <div class="recommendation-line">

                    <span class="recommendation-label">
                        Örneklem
                    </span>

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

                    <span class="recommendation-label">
                        Tahmin
                    </span>

                    <strong>
                        ${escapeHtml(
                            recommendation.targetTitle
                        )}
                    </strong>

                    <span class="odd">
                        ${escapeHtml(
                            targetOdd
                        )}
                    </span>

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

    const ft =
        getFullTimeScore(match);

    const ht =
        getHalfTimeScore(match);

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

                    <span class="team-name">
                        ${escapeHtml(
                            getHome(match)
                        )}
                    </span>

                    ${
                        ft
                            ? `
                                <span class="team-score">
                                    ${ft.home}
                                </span>
                              `
                            : ""
                    }

                </div>

                <div class="vs">
                    ${
                        ft
                            ? "MS"
                            : "VS"
                    }
                </div>

                <div class="team away">

                    ${
                        ft
                            ? `
                                <span class="team-score">
                                    ${ft.away}
                                </span>
                              `
                            : ""
                    }

                    <span class="team-name">
                        ${escapeHtml(
                            getAway(match)
                        )}
                    </span>

                </div>

            </div>

            ${
                ht
                    ? `
                        <div class="half-score">
                            İY ${ht.home}-${ht.away}
                        </div>
                      `
                    : ""
            }

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
   GÜNÜN MAÇLARI
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

    /* =====================================================
       ARAMA
    ===================================================== */

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

                    const text = [
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

    /* =====================================================
       LİG
    ===================================================== */

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

    /* =====================================================
       OYNANMAMIŞ
    ===================================================== */

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

    return result;
}

/* =========================================================
   BUGÜN BAŞARI
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
            !isPlayed(
                item.match
            )
        ) {
            continue;
        }

        for (
            const rec
            of item.recommendations
        ) {

            const result =
                getMarketOutcome(
                    item.match,
                    rec.targetMarket
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
    }

    return {
        success,
        total,
        percentage:
            total
                ? (
                    success /
                    total
                ) * 100
                : null
    };
}

/* =========================================================
   SON 60 GÜN BAŞARI
========================================================= */

function calculate60DaySummary() {

    const index =
        buildAnalysisIndex(
            selectedDate
        );

    let success = 0;
    let total = 0;

    for (
        const [
            key,
            historicalMatches
        ]
        of index.entries()
    ) {

        if (
            historicalMatches.length <
            MIN_SAMPLE
        ) {
            continue;
        }

        const sourceMarket =
            key.split("|")[0];

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

            let localSuccess = 0;
            let localTotal = 0;

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
                ? (
                    success /
                    total
                ) * 100
                : null
    };
}

/* =========================================================
   ÖZET
========================================================= */

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

                <span>
                    BUGÜN
                </span>

                <strong>
                    ${todayPercentage}
                </strong>

                <small>
                    ${today.success}/${today.total}
                </small>

            </div>

            <div class="summary-card">

                <span>
                    SON 60 GÜN
                </span>

                <strong>
                    ${sixtyPercentage}
                </strong>

                <small>
                    ${sixty.success}/${sixty.total}
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

    leagueFilter.innerHTML = `
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
   ANA RENDER
========================================================= */

function render() {

    if (!selectedDate) {
        return;
    }

    const allDay =
        getDayMatches();

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

        if (
            recommendations.length
        ) {

            predicted.push({
                match,
                recommendations
            });
        }
    }

    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    if (pageTitle) {

        pageTitle.textContent =
            sameDate(
                selectedDate,
                today
            )
                ? "Bugünün Maçları"
                : `${formatDateTR(
                    selectedDate
                )} Maçları`;
    }

    if (pageDescription) {

        pageDescription.textContent =
            `Geçmiş ${HISTORY_DAYS} gündeki birebir aynı oranlar analiz ediliyor.`;
    }

    renderSummary(
        predicted
    );

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
            `Geçmiş: ${formatDateTR(
                start
            )} - ${formatDateTR(
                end
            )}`;
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

    /* Boş günler */

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
        0,
        0,
        0,
        0
    );

    /* Günler */

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
                        formatLongDateTR(
                            selectedDate
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
        0,
        0,
        0,
        0
    );

    selectedDate =
        new Date(today);

    calendarDate =
        new Date(today);

    if (
        selectedDateText
    ) {

        selectedDateText.textContent =
            formatLongDateTR(
                today
            );
    }
}

/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {

    /* Takvim aç/kapat */

    if (
        calendarToggle &&
        calendarPopup
    ) {

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

    /* Önceki ay */

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

    /* Sonraki ay */

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

    /* Takvim dışına tıklama */

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

    /* Arama */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            render
        );
    }

    /* Lig */

    if (leagueFilter) {

        leagueFilter.addEventListener(
            "change",
            render
        );
    }

    /* Oynanmamış */

    if (unplayedOnly) {

        unplayedOnly.addEventListener(
            "change",
            render
        );
    }

    /* Yenile */

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            () => {

                analysisCache.clear();

                loadData(true);
            }
        );
    }

    /* =====================================================
       + BUTONU
    ===================================================== */

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

            const hidden =
                extra.classList.toggle(
                    "hidden"
                );

            button.textContent =
                hidden
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

        if (message) {

            message.textContent =
                "Veriler yükleniyor...";
        }

        if (content) {

            content.innerHTML = `
                <div class="empty-state">
                    Veriler yükleniyor...
                </div>
            `;
        }

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

        /* =================================================
           JSON FORMATLARI
        ================================================= */

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

        /* =================================================
           GEÇERLİ TARİHLER
        ================================================= */

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
           SAYFA İLK AÇILDIĞINDA
           BUGÜN SEÇİLİ
        */

        setToday();

        renderCalendar();

        render();

        if (updatedAt) {

            const now =
                new Date();

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

        if (message) {

            message.textContent =
                "Veri yüklenemedi";
        }

        if (content) {

            content.innerHTML = `
                <div class="empty-state">

                    <strong>
                        Veri yükleme hatası
                    </strong>

                    <br><br>

                    <small>
                        ${escapeHtml(
                            error.message
                        )}
                    </small>

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

        setupEvents();

        setToday();

        renderCalendar();

        loadData();
    }
);

/* =========================================================
   PWA
========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker.register(
                "./sw.js"
            );
        }
    );
}
