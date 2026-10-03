"use strict";

/* =========================================================
   SPOR TOTO - GELİŞMİŞ ÖRNEKLEM MOTORU
========================================================= */

const DATA_URL = "./data/matches.json";
const TOTO_URL = "./data/spor-toto.json";

const HISTORY_DAYS = 60;


/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];
let totoWeeks = [];
let selectedWeek = null;


/* =========================================================
   DOM
========================================================= */

const weekSelect =
    document.getElementById("weekSelect");

const summary =
    document.getElementById("summary");

const content =
    document.getElementById("matches") ||
    document.getElementById("content");


/* =========================================================
   GENEL
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


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
   TAKIM
========================================================= */

function normalizeTeam(value) {

    return String(value ?? "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/[^a-z0-9]/g, "");
}


function getHome(match) {

    return getValue(match, [
        "home",
        "Home",
        "homeTeam",
        "home_team",
        "ev",
        "Ev",
        "evSahibi"
    ]) || "";
}


function getAway(match) {

    return getValue(match, [
        "away",
        "Away",
        "awayTeam",
        "away_team",
        "deplasman",
        "Deplasman"
    ]) || "";
}


/* =========================================================
   TARİH
========================================================= */

function parseDate(value) {

    if (!value) {
        return null;
    }

    if (value instanceof Date) {

        if (
            Number.isNaN(
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

    const date =
        new Date(text);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}


function addDays(date, days) {

    const result =
        new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;
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

        home:
            Number(match[1]),

        away:
            Number(match[2])
    };
}


function getFullTimeScore(match) {

    const value =
        getValue(match, [
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


function isPlayed(match) {

    return !!getFullTimeScore(match);
}


function getMSResult(match) {

    const score =
        getFullTimeScore(match);

    if (!score) {
        return null;
    }

    if (
        score.home >
        score.away
    ) {
        return "1";
    }

    if (
        score.home <
        score.away
    ) {
        return "2";
    }

    return "X";
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

    if (
        !Number.isFinite(number)
    ) {
        return null;
    }

    /*
       Mevcut app.js ile aynı format.
       Eşleşme yine eşittir.
    */

    return number.toFixed(2);
}


function getOdds(match, names) {

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
   KAYNAK MARKETLER
   app.js ile aynı
========================================================= */

const SOURCE_MARKETS = [

    {
        id: "IY15U",

        title: "İY 1.5 Üst",

        odds: match =>
            getOdds(match, [
                "iy15Ust",
                "iy15üst",
                "iy15U",
                "IY15U",
                "iy1_5U",
                "iy1_5Over",
                "iy15Over"
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
        id: "MS15A",

        title: "1.5 Alt",

        odds: match =>
            getOdds(match, [
                "au15Alt",
                "au15alt",
                "15Alt",
                "1.5Alt",
                "1_5Alt",
                "under15"
            ])
    },

    {
        id: "MS15U",

        title: "1.5 Üst",

        odds: match =>
            getOdds(match, [
                "au15Ust",
                "au15üst",
                "au15U",
                "15Ust",
                "1.5Ust",
                "1.5Üst",
                "1_5Ust",
                "over15"
            ])
    }

];


/* =========================================================
   GEÇMİŞ
========================================================= */

function getHistory(
    targetDate
) {

    const end =
        parseDate(
            targetDate
        );

    if (!end) {
        return [];
    }

    const start =
        addDays(
            end,
            -HISTORY_DAYS
        );

    return allMatches.filter(
        match => {

            const date =
                parseDate(
                    getValue(match, [
                        "date",
                        "Date",
                        "tarih",
                        "Tarih",
                        "matchDate",
                        "match_date"
                    ])
                );

            if (!date) {
                return false;
            }

            return (
                date >= start &&
                date < end &&
                isPlayed(match)
            );
        }
    );
}


/* =========================================================
   AYNI MAÇ KONTROLÜ
========================================================= */

function sameMatch(a, b) {

    if (!a || !b) {
        return false;
    }

    const aHome =
        normalizeTeam(
            getHome(a)
        );

    const aAway =
        normalizeTeam(
            getAway(a)
        );

    const bHome =
        normalizeTeam(
            getHome(b)
        );

    const bAway =
        normalizeTeam(
            getAway(b)
        );

    return (
        aHome &&
        aAway &&
        aHome === bHome &&
        aAway === bAway
    );
}


/* =========================================================
   BİR KAYNAK MARKETİN ANALİZİ
========================================================= */

function analyzeSource(
    targetMatch,
    targetDate,
    source
) {

    const targetOdd =
        source.odds(
            targetMatch
        );

    if (!targetOdd) {

        return {
            source,
            targetOdd: null,
            samples: [],
            counts: {
                "1": 0,
                "X": 0,
                "2": 0
            },
            percentage: 0,
            confidence: 0,
            score: 0
        };
    }

    const history =
        getHistory(
            targetDate
        );

    const samples = [];

    const counts = {
        "1": 0,
        "X": 0,
        "2": 0
    };

    for (
        const historical
        of history
    ) {

        if (
            sameMatch(
                historical,
                targetMatch
            )
        ) {
            continue;
        }

        const historicalOdd =
            source.odds(
                historical
            );

        if (!historicalOdd) {
            continue;
        }

        /*
           BİREBİR ORAN
        */

        if (
            historicalOdd !==
            targetOdd
        ) {
            continue;
        }

        const result =
            getMSResult(
                historical
            );

        if (!result) {
            continue;
        }

        counts[result]++;

        samples.push({
            result,
            date:
                getValue(
                    historical,
                    [
                        "date",
                        "Date",
                        "tarih",
                        "Tarih",
                        "matchDate",
                        "match_date"
                    ]
                ),
            home:
                getHome(historical),
            away:
                getAway(historical)
        });
    }

    const total =
        samples.length;

    if (!total) {

        return {
            source,
            targetOdd,
            samples: [],
            counts,
            percentage: 0,
            confidence: 0,
            score: 0
        };
    }

    /*
       Baskın MS sonucu
    */

    let bestResult = "1";

    if (
        counts["X"] >
        counts[bestResult]
    ) {
        bestResult = "X";
    }

    if (
        counts["2"] >
        counts[bestResult]
    ) {
        bestResult = "2";
    }

    const bestCount =
        counts[bestResult];

    const percentage =
        bestCount /
        total *
        100;

    /*
       Güven skoru:

       Başarı oranı tek başına yeterli değil.

       Örnek:
       1 / 1 = %100
       8 / 10 = %80

       İkinci grup daha anlamlı.

       Bu yüzden örneklem sayısı
       arttıkça skor yükseliyor.
    */

    const sampleFactor =
        Math.min(
            1,
            Math.sqrt(total / 10)
        );

    const confidence =
        percentage *
        sampleFactor;

    /*
       Ek ağırlık:
       3+ örnek daha anlamlı.
    */

    const volumeFactor =
        Math.min(
            1.25,
            0.75 +
            total / 20
        );

    const score =
        confidence *
        volumeFactor;

    return {

        source,

        targetOdd,

        samples,

        counts,

        total,

        bestResult,

        percentage,

        confidence,

        score
    };
}


/* =========================================================
   MAÇIN ANA TAHMİNİ
========================================================= */

function calculatePrediction(
    targetMatch
) {

    const targetDate =
        getValue(
            targetMatch,
            [
                "date",
                "Date",
                "tarih",
                "Tarih",
                "matchDate",
                "match_date"
            ]
        );

    const analyses =
        SOURCE_MARKETS.map(
            source =>
                analyzeSource(
                    targetMatch,
                    targetDate,
                    source
                )
        )
        .filter(
            item =>
                item.total > 0
        );

    if (!analyses.length) {

        return {

            prediction: null,

            analyses: [],

            allCounts: {
                "1": 0,
                "X": 0,
                "2": 0
            }
        };
    }

    /*
       En güçlü kaynak grubu.

       Öncelik:
       1. score
       2. başarı yüzdesi
       3. örneklem
    */

    analyses.sort(
        (a, b) => {

            if (
                b.score !== a.score
            ) {
                return (
                    b.score -
                    a.score
                );
            }

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

    const strongest =
        analyses[0];

    /*
       Aynı zamanda tüm kaynakların
       ortak dağılımını hesapla.

       Bu sadece destekleyici
       istatistik olarak kullanılır.
    */

    const allCounts = {
        "1": 0,
        "X": 0,
        "2": 0
    };

    analyses.forEach(
        analysis => {

            allCounts["1"] +=
                analysis.counts["1"];

            allCounts["X"] +=
                analysis.counts["X"];

            allCounts["2"] +=
                analysis.counts["2"];
        }
    );

    return {

        prediction:
            strongest.bestResult,

        strongest,

        analyses,

        allCounts
    };
}


/* =========================================================
   MAÇI MATCHES.JSON'DA BUL
========================================================= */

function findMatch(
    totoMatch
) {

    const home =
        normalizeTeam(
            getHome(totoMatch)
        );

    const away =
        normalizeTeam(
            getAway(totoMatch)
        );

    if (!home || !away) {
        return null;
    }

    const candidates =
        allMatches.filter(
            match => {

                return (
                    normalizeTeam(
                        getHome(match)
                    ) === home
                    &&
                    normalizeTeam(
                        getAway(match)
                    ) === away
                );
            }
        );

    if (!candidates.length) {
        return null;
    }

    const totoDate =
        parseDate(
            getValue(
                totoMatch,
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

    if (totoDate) {

        const sameDay =
            candidates.find(
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

                    return (
                        date.getFullYear() ===
                        totoDate.getFullYear()
                        &&
                        date.getMonth() ===
                        totoDate.getMonth()
                        &&
                        date.getDate() ===
                        totoDate.getDate()
                    );
                }
            );

        if (sameDay) {
            return sameDay;
        }
    }

    return candidates[
        candidates.length - 1
    ];
}


/* =========================================================
   HAFTA
========================================================= */

function renderWeeks() {

    if (!weekSelect) {
        return;
    }

    weekSelect.innerHTML = "";

    totoWeeks.forEach(
        week => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(
                    week.id
                );

            option.textContent =
                `${week.season || ""} ${week.week || ""}. Hafta`;

            weekSelect.appendChild(
                option
            );
        }
    );

    if (
        selectedWeek !== null
    ) {

        weekSelect.value =
            String(
                selectedWeek
            );
    }

    weekSelect.onchange =
        async function () {

            selectedWeek =
                this.value;

            await render();
        };
}


/* =========================================================
   MAÇ KARTI
========================================================= */

function renderMatch(
    totoMatch,
    prediction,
    index
) {

    const result =
        totoMatch.result ||
        null;

    let status =
        "wait";

    let icon =
        "•";

    if (
        prediction.prediction &&
        result
    ) {

        if (
            prediction.prediction ===
            result
        ) {

            status = "hit";
            icon = "✓";

        } else {

            status = "miss";
            icon = "✕";
        }
    }

    if (
        !prediction.prediction
    ) {

        status = "wait";
        icon = "•";
    }

    const strongest =
        prediction.strongest;

    let details = "";

    if (!strongest) {

        details = `

            <div class="warning">

                Bu maç için son
                ${HISTORY_DAYS} günde
                birebir açılış oranı
                eşleşmesi bulunamadı.

            </div>

        `;

    } else {

        const percentages = {

            "1":
                strongest.counts["1"] /
                strongest.total *
                100,

            "X":
                strongest.counts["X"] /
                strongest.total *
                100,

            "2":
                strongest.counts["2"] /
                strongest.total *
                100
        };

        const otherSources =
            prediction.analyses
                .map(
                    analysis => `

                        <div class="sample-market">

                            <span>
                                ${escapeHtml(
                                    analysis.source.title
                                )}
                            </span>

                            <b>
                                ${escapeHtml(
                                    analysis.targetOdd
                                )}
                            </b>

                            <small>
                                ${analysis.total}
                                örnek ·
                                1:${analysis.counts["1"]}
                                X:${analysis.counts["X"]}
                                2:${analysis.counts["2"]}
                            </small>

                        </div>

                    `
                )
                .join("");

        details = `

            <div class="sample">

                <b>
                    En güçlü örneklem:
                </b>

                ${escapeHtml(
                    strongest.source.title
                )}

                ·

                <b>
                    ${escapeHtml(
                        strongest.targetOdd
                    )}
                </b>

            </div>


            <div class="sample">

                ${strongest.total}
                birebir geçmiş maç

                ·

                <b>
                    ${strongest.percentage.toFixed(1)}%
                </b>

                baskın sonuç

            </div>


            <div class="percentages">

                <div class="percent">
                    <span>1</span>
                    <b>
                        ${percentages["1"].toFixed(1)}%
                    </b>
                </div>

                <div class="percent">
                    <span>X</span>
                    <b>
                        ${percentages["X"].toFixed(1)}%
                    </b>
                </div>

                <div class="percent">
                    <span>2</span>
                    <b>
                        ${percentages["2"].toFixed(1)}%
                    </b>
                </div>

            </div>


            <div class="sample-markets">

                ${otherSources}

            </div>

        `;
    }

    return `

        <div class="match">

            <div class="match-row">

                <div class="number">
                    ${index + 1}
                </div>

                <div class="teams">

                    ${escapeHtml(
                        getHome(
                            totoMatch
                        )
                    )}

                    -

                    ${escapeHtml(
                        getAway(
                            totoMatch
                        )
                    )}

                </div>

                <div class="prediction">

                    ${
                        prediction.prediction ||
                        "?"
                    }

                </div>

                <div class="
                    status
                    ${status}
                ">

                    ${icon}

                </div>

            </div>

            <div class="details">

                ${details}

            </div>

        </div>

    `;
}


/* =========================================================
   ÖZET
========================================================= */

function renderSummary(
    predictions
) {

    let correct = 0;
    let wrong = 0;
    let waiting = 0;

    predictions.forEach(
        prediction => {

            if (
                !prediction.prediction ||
                !prediction.result
            ) {

                waiting++;
                return;
            }

            if (
                prediction.prediction ===
                prediction.result
            ) {

                correct++;

            } else {

                wrong++;
            }
        }
    );

    const finished =
        correct + wrong;

    const rate =
        finished
            ? correct /
              finished *
              100
            : 0;

    if (!summary) {
        return;
    }

    summary.innerHTML = `

        <div class="summary">

            <div class="summary-grid">

                <div class="summary-box green">

                    <strong>
                        ${correct}
                    </strong>

                    <span>
                        ✓ Doğru
                    </span>

                </div>


                <div class="summary-box red">

                    <strong>
                        ${wrong}
                    </strong>

                    <span>
                        ✕ Yanlış
                    </span>

                </div>


                <div class="summary-box gray">

                    <strong>
                        ${waiting}
                    </strong>

                    <span>
                        • Bekliyor
                    </span>

                </div>


                <div class="summary-box rate">

                    <strong>
                        ${rate.toFixed(1)}%
                    </strong>

                    <span>
                        Başarı
                    </span>

                </div>

            </div>

        </div>

    `;
}


/* =========================================================
   RENDER
========================================================= */

async function render() {

    if (!content) {
        return;
    }

    const week =
        totoWeeks.find(
            item =>
                String(item.id) ===
                String(selectedWeek)
        );

    if (!week) {

        content.innerHTML = `

            <div class="error">
                Hafta bulunamadı.
            </div>

        `;

        return;
    }

    const weekMatches =
        Array.isArray(
            week.matches
        )
            ? week.matches.slice(
                0,
                15
            )
            : [];

    const predictions = [];

    for (
        const totoMatch
        of weekMatches
    ) {

        const target =
            findMatch(
                totoMatch
            );

        if (!target) {

            predictions.push({

                prediction: null,

                result:
                    totoMatch.result ||
                    null,

                analyses: []

            });

            continue;
        }

        const prediction =
            calculatePrediction(
                target
            );

        prediction.result =
            totoMatch.result ||
            null;

        predictions.push(
            prediction
        );
    }

    renderSummary(
        predictions
    );

    content.innerHTML = `

        <div class="info">

            <b>Yeni Spor Toto örneklem motoru</b>

            <br><br>

            Son
            <b>${HISTORY_DAYS}</b>
            gün

            ·

            birebir açılış oranı

            ·

            minimum örneklem şartı yok

            ·

            %70 filtresi yok

            <br>

            Her kaynak market ayrı analiz edilir.
            En güçlü örneklem grubunun
            MS sonucu tahmin olarak kullanılır.

        </div>


        <div class="matches">

            ${
                weekMatches
                    .map(
                        (
                            match,
                            index
                        ) =>
                            renderMatch(
                                match,
                                predictions[index],
                                index
                            )
                    )
                    .join("")
            }

        </div>

    `;
}


/* =========================================================
   VERİ
========================================================= */

async function loadData() {

    const matchesResponse =
        await fetch(
            DATA_URL +
            "?t=" +
            Date.now(),
            {
                cache:
                    "no-store"
            }
        );

    if (
        !matchesResponse.ok
    ) {

        throw new Error(
            "matches.json yüklenemedi."
        );
    }

    const matchesJson =
        await matchesResponse.json();

    allMatches =
        Array.isArray(
            matchesJson
        )
            ? matchesJson
            : (
                Array.isArray(
                    matchesJson.matches
                )
                    ? matchesJson.matches
                    : []
            );

    if (!allMatches.length) {

        throw new Error(
            "matches.json içinde maç bulunamadı."
        );
    }


    const totoResponse =
        await fetch(
            TOTO_URL +
            "?t=" +
            Date.now(),
            {
                cache:
                    "no-store"
            }
        );

    if (
        !totoResponse.ok
    ) {

        throw new Error(
            "spor-toto.json yüklenemedi."
        );
    }

    const toto =
        await totoResponse.json();

    totoWeeks =
        Array.isArray(
            toto.weeks
        )
            ? toto.weeks
            : [];

    if (!totoWeeks.length) {

        throw new Error(
            "spor-toto.json içinde hafta bulunamadı."
        );
    }

    selectedWeek =
        String(
            toto.currentWeek ||
            totoWeeks[
                totoWeeks.length - 1
            ].id
        );
}


/* =========================================================
   BAŞLAT
========================================================= */

async function init() {

    try {

        await loadData();

        renderWeeks();

        await render();

    } catch (error) {

        console.error(
            "Spor Toto:",
            error
        );

        if (content) {

            content.innerHTML = `

                <div class="error">

                    <b>
                        Veri yüklenemedi
                    </b>

                    <br><br>

                    ${escapeHtml(
                        error.message
                    )}

                </div>

            `;
        }
    }
}

init();
