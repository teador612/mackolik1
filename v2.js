"use strict";

/* =========================================================
   MACKOLIK V2
   =========================================================

   ANALİZ MANTIĞI

   1. Oran kombinasyonu YOK.
   2. Her market kendi açılış oranını analiz eder.
   3. Oranlar birebir eşleşir.
   4. Son 60 gün geçmiş kullanılır.
   5. Minimum örneklem: 5
   6. Minimum başarı: %70
   7. Bir maç için yalnızca 1 ANA TAHMİN gösterilir.
   8. Birden fazla uygun tahminde örneklem büyüklüğü
      seçimde dikkate alınır.
   9. Tahmin bulunmayan maç gösterilmez.
  10. Son 60 günlük genel başarı sadece ANA TAHMİNLER
      üzerinden hesaplanır.

   ÖNEMLİ:

   Ekranda görünen başarı yüzdesi değiştirilmez.

   Örnek:

   %90 / 10 maç
   %85 / 30 maç

   İkinci tahmin örneklem avantajı sayesinde daha güçlü
   kabul edilebilir.

   Ancak kullanıcıya ayrıca "Güven %" gösterilmez.
========================================================= */


/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = "./data/v2-data.json";

const HISTORY_DAYS = 60;

const MIN_SAMPLE = 5;

const MIN_SUCCESS = 70;


/*
   Örneklem ağırlığı.

   Değer büyüdükçe küçük örneklemlerin yüksek başarı
   yüzdesine verilen avantaj azalır.

   20 seçildiğinde sistem yaklaşık olarak:

   5/5
   ile
   20/22

   gibi örneklerde daha dengeli davranır.

   Bu değer ekranda gösterilmez.
*/

const SAMPLE_WEIGHT = 20;


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

const content =
    document.getElementById("content");

const message =
    document.getElementById("message");

const updatedAt =
    document.getElementById("updatedAt");

const summary =
    document.getElementById("summary");

const searchInput =
    document.getElementById("search");

const leagueFilter =
    document.getElementById("leagueFilter");

const unplayedOnly =
    document.getElementById("unplayedOnly");

const refreshButton =
    document.getElementById("refreshButton");

const calendarToggle =
    document.getElementById("calendarToggle");

const calendarPopup =
    document.getElementById("calendarPopup");

const calendarMonth =
    document.getElementById("calendarMonth");

const calendarDays =
    document.getElementById("calendarDays");

const prevMonth =
    document.getElementById("prevMonth");

const nextMonth =
    document.getElementById("nextMonth");

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

    const result =
        new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;

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


function formatLongDateTR(date) {

    return date.toLocaleDateString(
        "tr-TR",
        {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    );

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

    return (
        getValue(
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
        ) || "-"
    );

}


function getAway(match) {

    return (
        getValue(
            match,
            [
                "away",
                "Away",
                "awayTeam",
                "away_team",
                "deplasman",
                "Deplasman"
            ]
        ) || "-"
    );

}


function getTime(match) {

    return (
        getValue(
            match,
            [
                "time",
                "Time",
                "saat",
                "Saat",
                "matchTime"
            ]
        ) || ""
    );

}


function getLeague(match) {

    return (
        getValue(
            match,
            [
                "league",
                "League",
                "lig",
                "Lig",
                "competition",
                "tournament"
            ]
        ) || "Lig belirtilmemiş"
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


function getHalfTimeScore(match) {

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

    if (
        !Number.isFinite(number) ||
        number <= 1
    ) {
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

        if (value !== undefined) {

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
        id: "IY15A",

        title: "İY 1.5 Alt",

        odds: match =>
            getOdds(
                match,
                [
                    "iy15Alt",
                    "iy15alt",
                    "iy1_5Alt",
                    "iy1.5Alt",
                    "IY15A"
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
                    "iy15Ust",
                    "iy15üst",
                    "iy15U",
                    "IY15U",
                    "iy1_5U",
                    "iy1_5Over",
                    "iy15Over"
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
        id: "KG",

        title: "KG Var",

        odds: match =>
            getOdds(
                match,
                [
                    "kgVar",
                    "KGVar",
                    "kgvar",
                    "kg",
                    "KG"
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
                    "kgYok",
                    "KGYok",
                    "kgyok",
                    "kgy",
                    "KGY"
                ]
            )
    },

    {
        id: "IYKG",

        title: "İY KG Var",

        odds: match =>
            getOdds(
                match,
                [
                    "iyKgVar",
                    "iyKGVar",
                    "iykgVar",
                    "iyKg",
                    "IYKG"
                ]
            )
    },

    {
        id: "IYKGY",

        title: "İY KG Yok",

        odds: match =>
            getOdds(
                match,
                [
                    "iyKgYok",
                    "iyKGYok",
                    "iykgyok",
                    "iyKgY",
                    "IYKGY"
                ]
            )
    },

    {
        id: "MS15A",

        title: "1.5 Alt",

        odds: match =>
            getOdds(
                match,
                [
                    "au15Alt",
                    "au15alt",
                    "15Alt",
                    "1.5Alt",
                    "1_5Alt",
                    "under15"
                ]
            )
    },

    {
        id: "MS15U",

        title: "1.5 Üst",

        odds: match =>
            getOdds(
                match,
                [
                    "au15Ust",
                    "au15üst",
                    "au15U",
                    "15Ust",
                    "1.5Ust",
                    "1.5Üst",
                    "1_5Ust",
                    "over15"
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
                    "au25Ust",
                    "au25üst",
                    "au25U",
                    "ms25U",
                    "MS25U",
                    "ms25u",
                    "ms2_5U",
                    "ms2_5Over",
                    "ms25Over",
                    "2.5Ust",
                    "2.5Üst",
                    "25Ust",
                    "25üst"
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

    if (marketId === "IY1") {

        const score =
            getHalfTimeScore(match);

        if (!score) {
            return null;
        }

        return (
            score.home >
            score.away
        );

    }


    if (marketId === "IY2") {

        const score =
            getHalfTimeScore(match);

        if (!score) {
            return null;
        }

        return (
            score.away >
            score.home
        );

    }


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

        if (
            marketId === "IY15A"
        ) {

            return total <= 1;

        }

        return total >= 2;

    }


    if (
        marketId === "MS15A" ||
        marketId === "MS15U"
    ) {

        const score =
            getFullTimeScore(match);

        if (!score) {
            return null;
        }

        const total =
            score.home +
            score.away;

        if (
            marketId === "MS15A"
        ) {

            return total <= 1;

        }

        return total >= 2;

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

        if (
            marketId === "IYKG"
        ) {

            return bothScored;

        }

        return !bothScored;

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
        const historical
        of history
    ) {

        for (
            const market
            of MARKETS
        ) {

            const odds =
                market.odds(
                    historical
                );

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

            index
                .get(key)
                .push(
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
   TEK MARKET ANALİZİ
========================================================= */

function analyzeMarket(
    match,
    market,
    targetDate
) {

    const currentOdds =
        market.odds(match);

    if (!currentOdds) {
        return null;
    }


    /*
       Birebir oran eşleşmesi.
    */

    const index =
        buildAnalysisIndex(
            targetDate
        );

    const key =
        `${market.id}|${currentOdds}`;

    const historicalMatches =
        index.get(key) || [];


    if (
        historicalMatches.length <
        MIN_SAMPLE
    ) {

        return null;

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
                market.id
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

        return null;

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

        return null;

    }


    return {

        marketId:
            market.id,

        title:
            market.title,

        odds:
            currentOdds,

        success,

        total,

        percentage

    };

}


/* =========================================================
   ÖRNEKLEM AĞIRLIKLI SEÇİM
========================================================= */

/*
   Burada ekranda görünen başarı yüzdesini değiştirmiyoruz.

   Sadece birden fazla uygun tahmin olduğunda hangisinin
   ANA TAHMİN olacağını belirlemek için örneklem büyüklüğünü
   hesaba katıyoruz.

   Formül:

   düzeltilmiş oran =
   (
       başarı + (%70 × ağırlık)
   )
   /
   (
       örneklem + ağırlık
   )

   Örnek:

   5/5  = %100
   20/22 = %90.9

   Küçük örneklemin %100 olması otomatik olarak kazanmaz.

   Bu değer SADECE sıralama içindir.
   Kullanıcıya gösterilen yüzde gerçek başarı yüzdesidir.
*/

function getSampleWeightedScore(
    analysis
) {

    if (
        !analysis ||
        !Number.isFinite(
            analysis.total
        ) ||
        analysis.total <= 0
    ) {

        return 0;

    }


    const priorSuccess =
        MIN_SUCCESS / 100;


    const weightedRate =
        (
            analysis.success +
            (
                priorSuccess *
                SAMPLE_WEIGHT
            )
        ) /
        (
            analysis.total +
            SAMPLE_WEIGHT
        );


    return weightedRate;

}


/* =========================================================
   ANA TAHMİN
========================================================= */

function getRecommendations(
    match,
    targetDate
) {

    const candidates = [];


    /*
       Her market tamamen bağımsız
       şekilde analiz edilir.
    */

    for (
        const market
        of MARKETS
    ) {

        const analysis =
            analyzeMarket(
                match,
                market,
                targetDate
            );

        if (!analysis) {
            continue;
        }

        candidates.push(
            analysis
        );

    }


    /*
       ANA TAHMİN SEÇİMİ

       Öncelik:

       1. Örneklem ağırlıklı skor
       2. Gerçek başarı yüzdesi
       3. Örneklem sayısı

       ÖNEMLİ:

       Oranlar arasında tolerans yoktur.
       Her market kendi birebir oranını kullanır.
    */

    candidates.sort(
        (a, b) => {

            const scoreA =
                getSampleWeightedScore(
                    a
                );

            const scoreB =
                getSampleWeightedScore(
                    b
                );


            if (
                scoreB !== scoreA
            ) {

                return (
                    scoreB -
                    scoreA
                );

            }


            /*
               Örneklem ağırlıklı skor eşitse
               gerçek başarı yüzdesi.
            */

            if (
                b.percentage !==
                a.percentage
            ) {

                return (
                    b.percentage -
                    a.percentage
                );

            }


            /*
               Her şey eşitse daha büyük
               örneklem kazanır.
            */

            return (
                b.total -
                a.total
            );

        }
    );


    /*
       SADECE 1 ANA TAHMİN.

       İkinci / üçüncü tahmin gösterilmez.
    */

    if (
        !candidates.length
    ) {

        return [];

    }


    return [
        candidates[0]
    ];

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
            recommendation.marketId
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

                    <span class="recommendation-label">
                        Tahmin
                    </span>

                    <strong>
                        ${escapeHtml(
                            recommendation.title
                        )}
                    </strong>

                    <span class="odd">
                        ${escapeHtml(
                            recommendation.odds
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
    recommendations
) {

    const recommendation =
        recommendations[0];

    const ft =
        getFullTimeScore(match);

    const ht =
        getHalfTimeScore(match);

    return `

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
                        recommendation
                    )}

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   GÜNÜN MAÇLARI
========================================================= */

function getDayMatches() {

    const key =
        dateKey(
            selectedDate
        );


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


    /*
       ARAMA
    */

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


    /*
       LİG
    */

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


    /*
       SADECE OYNANMAMIŞ
    */

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
            !isPlayed(item.match)
        ) {

            continue;

        }


        /*
           SADECE ANA TAHMİN.
        */

        const recommendation =
            item.recommendations &&
            item.recommendations[0];


        if (!recommendation) {
            continue;
        }


        const result =
            getMarketOutcome(
                item.match,
                recommendation.marketId
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

   ÇOK ÖNEMLİ:

   Burada her geçmiş maç için o maçın kendi tarihine
   göre tahmin yeniden oluşturulur.

   getRecommendations() yalnızca 1 tahmin döndürür.

   Dolayısıyla:

   - Ek tahmin yok.
   - İkinci market yok.
   - Üçüncü market yok.
   - Sadece ANA TAHMİN hesaba girer.
========================================================= */

function calculate60DaySummary() {

    const end =
        new Date(
            selectedDate
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


    let success = 0;

    let total = 0;


    const historicalDays =
        allMatches.filter(
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


    for (
        const match
        of historicalDays
    ) {

        const matchDate =
            parseDate(
                getDate(match)
            );


        if (!matchDate) {
            continue;
        }


        /*
           Bu maç oynanmadan önceki 60 gün
           kullanılarak ANA TAHMİN oluşturulur.

           Böylece geçmişe bakıp bugünü tahmin etme
           gibi bir veri sızıntısı oluşmaz.
        */

        const recommendations =
            getRecommendations(
                match,
                matchDate
            );


        if (
            !recommendations ||
            !recommendations.length
        ) {

            continue;

        }


        /*
           SADECE İLK VE TEK ANA TAHMİN.
        */

        const recommendation =
            recommendations[0];


        const result =
            getMarketOutcome(
                match,
                recommendation.marketId
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


        /*
           SADECE TAHMİN BULUNAN MAÇLAR.
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
            `Son ${HISTORY_DAYS} gündeki birebir aynı açılış oranları analiz ediliyor.`;

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

                ${predicted
                    .map(
                        item =>
                            matchHtml(
                                item.match,
                                item.recommendations
                            )
                    )
                    .join("")}

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
                    new Date(
                        date
                    );


                calendarDate =
                    new Date(
                        date
                    );


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
        new Date(
            today
        );


    calendarDate =
        new Date(
            today
        );


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
                "v2-data.json formatı geçersiz."
            );

        }


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
