"use strict";

const DATA_URL = "./data/matches.json";
const TOTO_URL = "./data/spor-toto.json";

const HISTORY_DAYS = 60;

let allMatches = [];
let totoWeeks = [];
let selectedWeek = null;

const weekSelect = document.getElementById("weekSelect");
const summary = document.getElementById("summary");
const matchesBox = document.getElementById("matches");


/* ======================================================
   GENEL
====================================================== */

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


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ======================================================
   TAKIM
====================================================== */

function normalizeTeam(value) {

    return String(value ?? "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
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


/* ======================================================
   TARİH
====================================================== */

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


function parseDate(value) {

    if (!value) {
        return null;
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

    if (!Number.isNaN(parsed.getTime())) {
        return new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
        );
    }

    return null;
}


/* ======================================================
   SKOR
====================================================== */

function parseScore(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    if (typeof value === "object") {

        const home = Number(
            value.home ??
            value.Home ??
            value.ev ??
            value.evSahibi
        );

        const away = Number(
            value.away ??
            value.Away ??
            value.deplasman
        );

        if (
            Number.isFinite(home) &&
            Number.isFinite(away)
        ) {
            return {
                home,
                away
            };
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


function getResult(match) {

    const score = getFullTimeScore(match);

    if (!score) {
        return null;
    }

    if (score.home > score.away) {
        return "1";
    }

    if (score.home < score.away) {
        return "2";
    }

    return "X";
}


/* ======================================================
   ORAN
====================================================== */

function getRawOdd(match, names) {

    const direct = getValue(match, names);

    if (direct !== undefined) {
        return direct;
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

        if (!container) {
            continue;
        }

        const value = getValue(
            container,
            names
        );

        if (value !== undefined) {
            return value;
        }
    }

    return null;
}


/*
   Yuvarlama yok.

   1.85 = 1.85
   1.8500 = 1.85
   1.8501 ≠ 1.85
*/

function canonicalOdd(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const text = String(value)
        .trim()
        .replace(",", ".");

    const number = Number(text);

    if (!Number.isFinite(number)) {
        return null;
    }

    return String(number);
}


function exactOdd(a, b) {

    const aa = canonicalOdd(a);
    const bb = canonicalOdd(b);

    if (aa === null || bb === null) {
        return false;
    }

    return aa === bb;
}


/* ======================================================
   5 MARKET
====================================================== */

const SOURCE_MARKETS = [

    {
        id: "IY15U",

        title: "İY 1.5 Üst",

        odds: match =>
            getRawOdd(match, [
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
            getRawOdd(match, [
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
            getRawOdd(match, [
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
            getRawOdd(match, [
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
            getRawOdd(match, [
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


/* ======================================================
   60 GÜNLÜK TARİHÇE
====================================================== */

function getHistoryMatches(targetDate) {

    const end = parseDate(targetDate);

    if (!end) {
        return [];
    }

    end.setHours(0, 0, 0, 0);

    const start = new Date(end);

    start.setDate(
        start.getDate() - HISTORY_DAYS
    );

    return allMatches.filter(match => {

        const date = parseDate(
            getDate(match)
        );

        if (!date) {
            return false;
        }

        date.setHours(0, 0, 0, 0);

        return (
            date >= start &&
            date < end &&
            !!getFullTimeScore(match)
        );
    });
}


/* ======================================================
   MARKET ANALİZİ

   ARTIK MİNİMUM 5 ŞARTI YOK.
====================================================== */

function analyzeMarket(
    target,
    source,
    history
) {

    const targetOdd =
        canonicalOdd(
            source.odds(target)
        );

    if (targetOdd === null) {
        return null;
    }

    const samples =
        history.filter(match => {

            const historicalOdd =
                source.odds(match);

            return exactOdd(
                historicalOdd,
                targetOdd
            );
        });


    /*
       Hiç örnek yoksa
       market hesaplamaya girmez.
    */

    if (!samples.length) {
        return null;
    }


    let one = 0;
    let x = 0;
    let two = 0;


    samples.forEach(match => {

        const result =
            getResult(match);

        if (result === "1") {
            one++;
        }

        else if (result === "X") {
            x++;
        }

        else if (result === "2") {
            two++;
        }
    });


    const total =
        one + x + two;


    if (!total) {
        return null;
    }


    const onePct =
        one / total * 100;

    const xPct =
        x / total * 100;

    const twoPct =
        two / total * 100;


    /*
       AĞIRLIK = √ÖRNEK
    */

    const weight =
        Math.sqrt(total);


    return {

        id: source.id,

        title: source.title,

        odd: targetOdd,

        sample: total,

        one,
        x,
        two,

        onePct,
        xPct,
        twoPct,

        weight
    };
}


/* ======================================================
   ANA HESAPLAMA

   SADECE TEK SONUÇ
====================================================== */

function calculatePrediction(
    target,
    targetDate
) {

    const history =
        getHistoryMatches(
            targetDate
        );


    const markets = [];


    for (
        const source
        of SOURCE_MARKETS
    ) {

        const result =
            analyzeMarket(
                target,
                source,
                history
            );

        if (result) {
            markets.push(result);
        }
    }


    /*
       Hiç markette eşleşme yok.
    */

    if (!markets.length) {

        return {

            prediction: null,

            markets: [],

            one: 0,
            x: 0,
            two: 0,

            totalWeight: 0
        };
    }


    let weightedOne = 0;
    let weightedX = 0;
    let weightedTwo = 0;

    let totalWeight = 0;


    /*
       HER MARKET:

       yüzde × √örnek
    */

    markets.forEach(market => {

        weightedOne +=
            market.onePct *
            market.weight;

        weightedX +=
            market.xPct *
            market.weight;

        weightedTwo +=
            market.twoPct *
            market.weight;

        totalWeight +=
            market.weight;
    });


    const one =
        weightedOne /
        totalWeight;

    const x =
        weightedX /
        totalWeight;

    const two =
        weightedTwo /
        totalWeight;


    /*
       SADECE EN YÜKSEK
       SONUÇ SEÇİLİR.
    */

    const results = [

        {
            result: "1",
            percentage: one
        },

        {
            result: "X",
            percentage: x
        },

        {
            result: "2",
            percentage: two
        }

    ];


    results.sort(
        (a, b) =>
            b.percentage -
            a.percentage
    );


    const highest =
        results[0];


    return {

        prediction:
            highest.result,

        percentage:
            highest.percentage,

        one,
        x,
        two,

        totalWeight,

        markets
    };
}


/* ======================================================
   MATCHES.JSON MAÇ EŞLEŞTİRME
====================================================== */

function findMatch(totoMatch) {

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
        allMatches.filter(match => {

            return (
                normalizeTeam(
                    getHome(match)
                ) === home
                &&
                normalizeTeam(
                    getAway(match)
                ) === away
            );
        });


    if (!candidates.length) {
        return null;
    }


    /*
       Önce aynı tarihi bul.
    */

    const totoDate =
        parseDate(
            getDate(totoMatch)
        );


    if (totoDate) {

        const sameDay =
            candidates.find(match => {

                const date =
                    parseDate(
                        getDate(match)
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
            });


        if (sameDay) {
            return sameDay;
        }
    }


    return candidates[
        candidates.length - 1
    ];
}


/* ======================================================
   HAFTA SEÇİMİ
====================================================== */

function renderWeeks() {

    if (!weekSelect) {
        return;
    }

    weekSelect.innerHTML = "";


    totoWeeks.forEach(week => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            String(week.id);

        option.textContent =
            `${week.season || ""} ${week.week || ""}. Hafta`;

        weekSelect.appendChild(
            option
        );
    });


    if (selectedWeek !== null) {

        weekSelect.value =
            String(selectedWeek);
    }


    weekSelect.onchange =
        async function () {

            selectedWeek =
                this.value;

            await render();
        };
}


/* ======================================================
   SONUÇ KONTROL
====================================================== */

function predictionHits(
    prediction,
    result
) {

    if (!prediction || !result) {
        return false;
    }

    return prediction === result;
}


/* ======================================================
   ÖZET
====================================================== */

function renderSummary(predictions) {

    let correct = 0;
    let wrong = 0;
    let waiting = 0;


    predictions.forEach(item => {

        if (
            !item.prediction ||
            !item.result
        ) {

            waiting++;
            return;
        }


        if (
            predictionHits(
                item.prediction,
                item.result
            )
        ) {

            correct++;
        }

        else {

            wrong++;
        }
    });


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


/* ======================================================
   MARKET DETAYI
====================================================== */

function renderMarket(market) {

    return `

        <div class="sample-market">

            <span>
                ${escapeHtml(
                    market.title
                )}
            </span>

            <b>
                ${escapeHtml(
                    market.odd
                )}
            </b>

            <small>

                ${market.sample} örnek

                ·

                1:
                ${market.onePct.toFixed(1)}%

                ·

                X:
                ${market.xPct.toFixed(1)}%

                ·

                2:
                ${market.twoPct.toFixed(1)}%

                ·

                √n:
                ${market.weight.toFixed(2)}

            </small>

        </div>

    `;
}


/* ======================================================
   MAÇ KARTI
====================================================== */

function renderMatch(
    totoMatch,
    prediction,
    index
) {

    const result =
        totoMatch.result ||
        null;


    let status = "wait";
    let icon = "•";


    if (
        prediction.prediction &&
        result
    ) {

        if (
            predictionHits(
                prediction.prediction,
                result
            )
        ) {

            status = "hit";
            icon = "✓";

        }

        else {

            status = "miss";
            icon = "✕";
        }
    }


    let details = "";


    if (!prediction.prediction) {

        details = `

            <div class="warning">

                Bu maç için son
                ${HISTORY_DAYS}
                günde eşleşen oran
                bulunamadı.

            </div>

        `;

    }

    else {

        details = `

            <div class="sample">

                Ortak MS dağılımı:

                <b>
                    1
                    ${prediction.one.toFixed(1)}%
                </b>

                ·

                <b>
                    X
                    ${prediction.x.toFixed(1)}%
                </b>

                ·

                <b>
                    2
                    ${prediction.two.toFixed(1)}%
                </b>

            </div>


            <div class="sample">

                <b>
                    TEK TAHMİN:
                    ${prediction.prediction}
                </b>

                ·

                ${prediction.percentage.toFixed(1)}%

            </div>


            <div class="sample">

                Kullanılan market:

                <b>
                    ${prediction.markets.length}/5
                </b>

            </div>


            <div class="sample-markets">

                ${prediction.markets
                    .map(renderMarket)
                    .join("")}

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


                <div class="
                    prediction
                    ${prediction.prediction
                        ? ""
                        : "empty"}
                ">

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

                ${
                    result
                        ? `
                            <div class="sample">

                                Gerçek MS:

                                <b>
                                    ${escapeHtml(
                                        result
                                    )}
                                </b>

                            </div>
                          `
                        : ""
                }

                ${details}

            </div>

        </div>

    `;
}


/* ======================================================
   ANA RENDER
====================================================== */

async function render() {

    if (!matchesBox) {
        return;
    }


    const week =
        totoWeeks.find(
            item =>
                String(item.id) ===
                String(selectedWeek)
        );


    if (!week) {

        matchesBox.innerHTML = `
            <div class="error">
                Hafta bulunamadı.
            </div>
        `;

        return;
    }


    /*
       HER HAFTA TAM OLARAK
       15 MAÇ
    */

    const weekMatches =
        Array.isArray(
            week.matches
        )
            ? week.matches.slice(0, 15)
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

                markets: []

            });

            continue;
        }


        /*
           Hedef maçın kendi tarihi
           geçmiş hesabının sonudur.
        */

        const targetDate =
            getDate(totoMatch) ||
            getDate(target);


        const prediction =
            calculatePrediction(
                target,
                targetDate
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


    matchesBox.innerHTML = `

        <div class="info">

            Son
            <b>${HISTORY_DAYS}</b>
            gün

            ·

            birebir oran eşleşmesi

            ·

            5 market birlikte hesaplanır

            ·

            ağırlık:
            <b>√örnek sayısı</b>

            ·

            sonuç:
            <b>SADECE TEK</b>

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


/* ======================================================
   VERİLERİ YÜKLE
====================================================== */

async function loadData() {

    const matchesResponse =
        await fetch(
            DATA_URL +
            "?t=" +
            Date.now(),
            {
                cache: "no-store"
            }
        );


    if (!matchesResponse.ok) {

        throw new Error(
            "matches.json yüklenemedi."
        );
    }


    const matchesJson =
        await matchesResponse.json();


    allMatches =
        Array.isArray(matchesJson)
            ? matchesJson
            : (
                Array.isArray(
                    matchesJson.matches
                )
                    ? matchesJson.matches
                    : []
            );


    const totoResponse =
        await fetch(
            TOTO_URL +
            "?t=" +
            Date.now(),
            {
                cache: "no-store"
            }
        );


    if (!totoResponse.ok) {

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
            "spor-toto.json içinde hafta yok."
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


/* ======================================================
   BAŞLAT
====================================================== */

async function init() {

    try {

        await loadData();

        renderWeeks();

        await render();

    }

    catch (error) {

        console.error(
            "Spor Toto:",
            error
        );


        if (matchesBox) {

            matchesBox.innerHTML = `

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
