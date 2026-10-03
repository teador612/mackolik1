"use strict";

/*
=========================================================
 SPOR TOTO ANALİZ MOTORU

 ALGORİTMA

 1. Güncel maçın matches.json açılış oranlarını al.
 2. Son 60 gündeki geçmiş maçlara bak.
 3. Aynı market + aynı oran birebir eşleşmeli.
 4. Her market için minimum 5 geçmiş örnek şartı.
 5. Her marketin gerçek MS 1/X/2 dağılımını hesapla.
 6. Market ağırlığı = sqrt(örnek sayısı)
 7. Tüm geçerli marketleri ağırlıklı olarak birleştir.
 8. Ortak 1/X/2 yüzdesini hesapla.

 TEK:
    en yüksek >= %50
    VE ikinci ile fark >= 15 puan

 ÇİFT:
    en yüksek >= %40
    VE ikinci ile fark >= 7 puan

 ÜÇLÜ:
    diğer bütün durumlar

 ÖNEMLİ:
 - Tolerans yok.
 - 1.72 sadece 1.72 ile eşleşir.
 - 1.71 / 1.73 eşleşmez.
 - 1.8501 / 1.85 eşleşmez.
 - Form, puan durumu, H2H, son 5 kullanılmaz.
=========================================================
*/

const DATA_URL = "./data/matches.json";
const TOTO_URL = "./data/spor-toto.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;

const SINGLE_MIN = 50;
const SINGLE_GAP = 15;

const DOUBLE_MIN = 40;
const DOUBLE_GAP = 7;

let allMatches = [];
let totoWeeks = [];
let selectedWeek = null;


/* ======================================================
   DOM
====================================================== */

const weekSelect =
    document.getElementById("weekSelect");

const summary =
    document.getElementById("summary");

const matchesBox =
    document.getElementById("matches");


/* ======================================================
   HTML
====================================================== */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ======================================================
   GENEL ALAN OKUMA
====================================================== */

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


function sameTeam(a, b) {

    return (
        normalizeTeam(a) ===
        normalizeTeam(b)
    );
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

    if (
        typeof value === "object"
    ) {

        const home =
            Number(
                value.home ??
                value.Home ??
                value.ev ??
                value.evSahibi
            );

        const away =
            Number(
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


function getResult(match) {

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


/* ======================================================
   AÇILIŞ ORANLARI
====================================================== */

/*
  BURADA özellikle toFixed(2) YOK.

  Çünkü:
  1.72 = 1.72
  1.71 ≠ 1.72
  1.73 ≠ 1.72
  1.8501 ≠ 1.85
*/

function getRawOdd(match, names) {

    const direct =
        getValue(
            match,
            names
        );

    if (
        direct !== undefined
    ) {
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
            return value;
        }
    }

    return null;
}


/* ======================================================
   ORANIN KANONİK HALİ

   1.8500 -> 1.85
   01.72  -> 1.72
   1.8501 -> 1.8501

   Yuvarlama YOK.
====================================================== */

function canonicalOdd(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    let text =
        String(value)
            .trim()
            .replace(",", ".");

    if (!text) {
        return null;
    }

    const number =
        Number(text);

    if (
        !Number.isFinite(number)
    ) {
        return null;
    }

    /*
       Bilimsel gösterim veya
       gereksiz sıfırlar için
       Number -> String kullanıyoruz.
       Yuvarlama yapılmıyor.
    */

    return String(number);
}


function exactOdd(a, b) {

    const aa =
        canonicalOdd(a);

    const bb =
        canonicalOdd(b);

    if (
        aa === null ||
        bb === null
    ) {
        return false;
    }

    return aa === bb;
}


/* ======================================================
   5 KAYNAK MARKET
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
   60 GÜNLÜK GEÇMİŞ
====================================================== */

function getHistoryMatches(
    targetDate
) {

    const end =
        parseDate(targetDate);

    if (!end) {
        return [];
    }

    end.setHours(
        0,
        0,
        0,
        0
    );

    const start =
        new Date(end);

    start.setDate(
        start.getDate() -
        HISTORY_DAYS
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


/* ======================================================
   TEK MARKET ANALİZİ
====================================================== */

function analyzeMarket(
    target,
    targetDate,
    source,
    history
) {

    const targetOddRaw =
        source.odds(target);

    const targetOdd =
        canonicalOdd(
            targetOddRaw
        );

    if (
        targetOdd === null
    ) {
        return null;
    }

    const samples =
        history.filter(
            historical => {

                const historicalOdd =
                    source.odds(
                        historical
                    );

                return exactOdd(
                    historicalOdd,
                    targetOdd
                );
            }
        );

    /*
       HER MARKET İÇİN
       EN AZ 5 ÖRNEK
    */

    if (
        samples.length <
        MIN_SAMPLE
    ) {
        return null;
    }

    let one = 0;
    let x = 0;
    let two = 0;

    samples.forEach(
        historical => {

            const result =
                getResult(
                    historical
                );

            if (result === "1") {
                one++;
            }

            else if (result === "X") {
                x++;
            }

            else if (result === "2") {
                two++;
            }
        }
    );

    const total =
        one + x + two;

    if (
        total <
        MIN_SAMPLE
    ) {
        return null;
    }

    const onePct =
        one / total * 100;

    const xPct =
        x / total * 100;

    const twoPct =
        two / total * 100;

    /*
       AĞIRLIK:
       sqrt(örnek sayısı)
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
   ORTAK AĞIRLIKLI HESAPLAMA
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

    /*
       5 MARKETİN HER BİRİNİ
       BAĞIMSIZ HESAPLA
    */

    for (
        const source
        of SOURCE_MARKETS
    ) {

        const analysis =
            analyzeMarket(
                target,
                targetDate,
                source,
                history
            );

        if (analysis) {
            markets.push(
                analysis
            );
        }
    }

    /*
       Hiçbir markette
       minimum 5 örnek yoksa
       tahmin yok.
    */

    if (!markets.length) {

        return {

            prediction: null,

            system: null,

            markets: [],

            one: 0,

            x: 0,

            two: 0,

            totalWeight: 0
        };
    }


    /* ----------------------------------------------
       AĞIRLIKLI TOPLAMLAR
    ---------------------------------------------- */

    let weightedOne = 0;
    let weightedX = 0;
    let weightedTwo = 0;

    let totalWeight = 0;


    markets.forEach(
        market => {

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
        }
    );


    /* ----------------------------------------------
       ORTAK YÜZDELER
    ---------------------------------------------- */

    const one =
        weightedOne /
        totalWeight;

    const x =
        weightedX /
        totalWeight;

    const two =
        weightedTwo /
        totalWeight;


    const outcomes = [

        {
            result: "1",
            value: one
        },

        {
            result: "X",
            value: x
        },

        {
            result: "2",
            value: two
        }

    ];


    /*
       BÜYÜKTEN KÜÇÜĞE
    */

    outcomes.sort(
        (a, b) =>
            b.value -
            a.value
    );


    const first =
        outcomes[0];

    const second =
        outcomes[1];


    const gap =
        first.value -
        second.value;


    let system;
    let prediction;


    /* ----------------------------------------------
       TEK
    ---------------------------------------------- */

    if (
        first.value >=
            SINGLE_MIN
        &&
        gap >=
            SINGLE_GAP
    ) {

        system = "TEK";

        prediction =
            first.result;
    }


    /* ----------------------------------------------
       ÇİFT
    ---------------------------------------------- */

    else if (
        first.value >=
            DOUBLE_MIN
        &&
        gap >=
            DOUBLE_GAP
    ) {

        system = "ÇİFT";

        prediction =
            outcomes[0].result +
            outcomes[1].result;
    }


    /* ----------------------------------------------
       ÜÇLÜ
    ---------------------------------------------- */

    else {

        system = "ÜÇLÜ";

        /*
           Her ihtimali kapsar.
        */

        prediction =
            "1X2";
    }


    return {

        prediction,

        system,

        one,

        x,

        two,

        totalWeight,

        markets,

        highest:
            first.result,

        highestPct:
            first.value,

        second:
            second.result,

        secondPct:
            second.value,

        gap
    };
}


/* ======================================================
   MAÇI MATCHES.JSON'DA BUL
====================================================== */

function findMatch(
    totoMatch
) {

    const home =
        getHome(totoMatch);

    const away =
        getAway(totoMatch);

    const homeNorm =
        normalizeTeam(home);

    const awayNorm =
        normalizeTeam(away);

    if (
        !homeNorm ||
        !awayNorm
    ) {
        return null;
    }

    const candidates =
        allMatches.filter(
            match => {

                return (
                    normalizeTeam(
                        getHome(match)
                    ) === homeNorm
                    &&
                    normalizeTeam(
                        getAway(match)
                    ) === awayNorm
                );
            }
        );

    if (!candidates.length) {
        return null;
    }


    /*
       Önce aynı günü bul.
    */

    const totoDate =
        parseDate(
            getDate(totoMatch)
        );

    if (totoDate) {

        const sameDay =
            candidates.find(
                candidate => {

                    const date =
                        parseDate(
                            getDate(
                                candidate
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


    /*
       Aynı gün bulunamazsa
       son kaydı kullan.
    */

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


/* ======================================================
   SONUÇ KAPSAMA KONTROLÜ
====================================================== */

function predictionHits(
    prediction,
    result
) {

    if (
        !prediction ||
        !result
    ) {
        return false;
    }

    /*
       TEK
    */

    if (
        prediction === "1" ||
        prediction === "X" ||
        prediction === "2"
    ) {

        return (
            prediction ===
            result
        );
    }


    /*
       ÇİFT
       Örn:
       1X
       12
       X2
    */

    if (
        prediction.includes(
            result
        )
    ) {

        return true;
    }


    return false;
}


/* ======================================================
   ÖZET
====================================================== */

function renderSummary(
    predictions
) {

    let correct = 0;
    let wrong = 0;
    let waiting = 0;

    let singleCount = 0;
    let doubleCount = 0;
    let tripleCount = 0;


    predictions.forEach(
        item => {

            if (
                !item.prediction ||
                !item.result
            ) {

                waiting++;
                return;
            }


            if (
                item.system ===
                "TEK"
            ) {
                singleCount++;
            }

            else if (
                item.system ===
                "ÇİFT"
            ) {
                doubleCount++;
            }

            else if (
                item.system ===
                "ÜÇLÜ"
            ) {
                tripleCount++;
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
                        ✓ Kapsayan
                    </span>

                </div>


                <div class="summary-box red">

                    <strong>
                        ${wrong}
                    </strong>

                    <span>
                        ✕ Kaçan
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


            <div class="summary-info">

                TEK:
                <b>${singleCount}</b>

                ·

                ÇİFT:
                <b>${doubleCount}</b>

                ·

                ÜÇLÜ:
                <b>${tripleCount}</b>

            </div>

        </div>
    `;
}


/* ======================================================
   MARKET DETAYI
====================================================== */

function renderMarket(
    market
) {

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

                ${market.sample}
                örnek

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


    let status =
        "wait";

    let icon =
        "•";


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


    if (
        !prediction.prediction
    ) {

        status = "wait";
        icon = "•";
    }


    let details = "";


    if (
        !prediction.prediction
    ) {

        details = `

            <div class="warning">

                Son ${HISTORY_DAYS}
                günde hiçbir markette
                en az ${MIN_SAMPLE}
                birebir oran eşleşmesi
                bulunamadı.

            </div>

        `;

    }

    else {

        const systemText =
            prediction.system;


        details = `

            <div class="sample">

                <b>
                    Sistem:
                </b>

                ${systemText}

                ·

                <b>
                    ${escapeHtml(
                        prediction.prediction
                    )}
                </b>

            </div>


            <div class="sample">

                Ağırlıklı sonuç:

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

                En yüksek:

                <b>
                    ${prediction.highest}
                    ${prediction.highestPct.toFixed(1)}%
                </b>

                ·

                İkinci:

                <b>
                    ${prediction.second}
                    ${prediction.secondPct.toFixed(1)}%
                </b>

                ·

                Fark:

                <b>
                    ${prediction.gap.toFixed(1)}
                    puan
                </b>

            </div>


            <div class="sample">

                Geçerli market:

                <b>
                    ${prediction.markets.length}
                    / 5
                </b>

            </div>


            <div class="sample-markets">

                ${prediction.markets
                    .map(
                        renderMarket
                    )
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
   RENDER
====================================================== */

async function render() {

    if (!matchesBox) {
        return;
    }


    const week =
        totoWeeks.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    selectedWeek
                )
        );


    if (!week) {

        matchesBox.innerHTML = `

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

                system: null,

                result:
                    totoMatch.result ||
                    null,

                markets: []

            });

            continue;
        }


        /*
           ÖNEMLİ:

           Geçmiş 60 gün hesabının
           bitiş tarihi Toto maçının
           kendi tarihidir.

           Böylece gelecekteki veriler
           geçmiş örnekleme girmez.
        */

        const targetDate =
            getDate(
                totoMatch
            ) ||
            getDate(
                target
            );


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

            <b>
                Spor Toto ağırlıklı örneklem motoru
            </b>

            <br><br>

            Son
            <b>${HISTORY_DAYS}</b>
            gün

            ·

            birebir açılış oranı

            ·

            market başına minimum
            <b>${MIN_SAMPLE}</b>
            örnek

            ·

            ağırlık:
            <b>√örnek</b>

            <br><br>

            TEK:
            ≥%${SINGLE_MIN}
            ve fark ≥${SINGLE_GAP} puan

            ·

            ÇİFT:
            ≥%${DOUBLE_MIN}
            ve fark ≥${DOUBLE_GAP} puan

            ·

            aksi halde ÜÇLÜ

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
   VERİ YÜKLE
====================================================== */

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


    if (
        !allMatches.length
    ) {

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


    if (
        !totoWeeks.length
    ) {

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
