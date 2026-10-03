"use strict";

/*
==========================================================
 SPOR TOTO
==========================================================

 Kaynak:
 TotoKazan

 Tahmin kaynağı:
 data/matches.json

 KURALLAR:
 - Her hafta 15 maç
 - Her maç için tek sonuç: 1 / X / 2
 - Oran eşleşmesi birebir
 - Tolerans YOK
 - 1.85 sadece 1.85 ile eşleşir
 - Minimum 5 örneklem şartı YOK
 - 1 adet eşleşme bile hesaba katılır
 - Farklı marketler ortak 1/X/2 havuzuna girer
 - Hedef maç kendi örneklemine dahil edilmez
 - Sonuçlardan en çok destek alan tahmin edilir
==========================================================
*/

const MATCHES_URL = "data/matches.json";
const TOTO_DATA_URL = "data/spor-toto.json";

const HISTORY_DAYS = 60;

let matchesData = [];
let totoWeeks = [];
let selectedWeek = null;


/* ======================================================
   HTML GÜVENLİĞİ
====================================================== */

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ======================================================
   METİN NORMALİZASYONU
====================================================== */

function norm(value) {
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


/* ======================================================
   TAKIM ALIASLARI
====================================================== */

const ALIASES = {

    turkiye: [
        "turkiye",
        "turkiyea",
        "turkiyeailli"
    ],

    belcika: [
        "belcika",
        "belgium"
    ],

    italya: [
        "italya",
        "italy"
    ],

    bosnahersek: [
        "bosnahersek",
        "bosniaandherzegovina"
    ],

    isvec: [
        "isvec",
        "sweden"
    ],

    fransa: [
        "fransa",
        "france"
    ],

    macaristan: [
        "macaristan",
        "hungary"
    ],

    gurcistan: [
        "gurcistan",
        "georgia"
    ],

    polonya: [
        "polonya",
        "poland"
    ],

    romanya: [
        "romanya",
        "romania"
    ],

    hirvatistan: [
        "hirvatistan",
        "croatia"
    ],

    ingiltere: [
        "ingiltere",
        "england"
    ],

    kuzeymakedonya: [
        "kuzeymakedonyacumhuriyeti",
        "kuzeymakedonya",
        "northmacedonia"
    ],

    iskocya: [
        "iskocya",
        "scotland"
    ],

    ispanya: [
        "ispanya",
        "spain"
    ],

    cekya: [
        "cekya",
        "czechia",
        "czechrepublic"
    ],

    isvicre: [
        "isvicre",
        "switzerland"
    ],

    slovenya: [
        "slovenya",
        "slovenia"
    ],

    galler: [
        "galler",
        "wales"
    ],

    danimarka: [
        "danimarka",
        "denmark"
    ],

    hollanda: [
        "hollanda",
        "netherlands"
    ],

    sirbistan: [
        "sirbistan",
        "serbia"
    ],

    portekiz: [
        "portekiz",
        "portugal"
    ],

    norvec: [
        "norvec",
        "norway"
    ],

    yunanistan: [
        "yunanistan",
        "greece"
    ],

    almanya: [
        "almanya",
        "germany"
    ]
};


function canonicalTeam(value) {

    const n = norm(value);

    for (const key in ALIASES) {

        if (ALIASES[key].includes(n)) {
            return key;
        }
    }

    return n;
}


function sameTeam(a, b) {

    return (
        canonicalTeam(a) ===
        canonicalTeam(b)
    );
}


/* ======================================================
   TARİH
====================================================== */

function parseDate(value) {

    if (!value) {
        return null;
    }

    const s = String(value).trim();

    let d = null;

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {

        const p = s.split(".");

        d = new Date(
            Number(p[2]),
            Number(p[1]) - 1,
            Number(p[0])
        );

    } else {

        d = new Date(s);
    }

    if (
        !d ||
        Number.isNaN(d.getTime())
    ) {
        return null;
    }

    d.setHours(0, 0, 0, 0);

    return d;
}


/* ======================================================
   SKOR → 1 / X / 2
====================================================== */

function scoreResult(match) {

    if (!match) {
        return null;
    }

    let home = null;
    let away = null;


    if (
        match.score &&
        typeof match.score === "object"
    ) {

        home = Number(match.score.home);
        away = Number(match.score.away);

    } else if (
        match.homeScore !== undefined
    ) {

        home = Number(match.homeScore);
        away = Number(match.awayScore);

    } else if (
        match.home_score !== undefined
    ) {

        home = Number(match.home_score);
        away = Number(match.away_score);
    }


    if (
        !Number.isFinite(home) ||
        !Number.isFinite(away)
    ) {
        return null;
    }


    if (home > away) {
        return "1";
    }

    if (home < away) {
        return "2";
    }

    return "X";
}


/* ======================================================
   ORANLAR
====================================================== */

function odds(match) {

    if (!match) {
        return {};
    }

    return (
        match.openingOdds ||
        match.odds ||
        {}
    );
}


function getOdd(match, key) {

    const o = odds(match);

    const value = o[key];

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const n = Number(
        String(value).replace(",", ".")
    );

    return Number.isFinite(n)
        ? n
        : null;
}


/* ======================================================
   BİREBİR ORAN KONTROLÜ
====================================================== */

function exact(a, b) {

    if (
        a === null ||
        b === null
    ) {
        return false;
    }

    /*
    TOLERANS YOK.

    1.85 = 1.85       → EŞLEŞİR
    1.84 = 1.85       → EŞLEŞMEZ
    1.8501 = 1.85     → EŞLEŞMEZ
    */

    return Number(a) === Number(b);
}


/* ======================================================
   GEÇMİŞ MAÇLAR
====================================================== */

function historyBefore(date) {

    const target = parseDate(date);

    if (!target) {
        return [];
    }

    const start = new Date(target);

    start.setDate(
        start.getDate() - HISTORY_DAYS
    );


    return matchesData.filter(match => {

        const d = parseDate(match.date);

        if (!d) {
            return false;
        }

        /*
        Sadece son 60 gün.
        Hedef maçın tarihi ve sonrası kullanılmaz.
        */

        if (d < start) {
            return false;
        }

        if (d >= target) {
            return false;
        }

        /*
        Sonucu belli olmayan maç
        örnekleme girmez.
        */

        return !!scoreResult(match);
    });
}


/* ======================================================
   MARKETLER
====================================================== */

const MARKETS = [

    ["ms1", "MS 1"],
    ["ms0", "MS X"],
    ["ms2", "MS 2"],

    ["iy1", "İY 1"],
    ["iy2", "İY 2"],

    ["iy15Ust", "İY 1.5 Üst"],
    ["iy05Ust", "İY 0.5 Üst"],

    ["au15Ust", "1.5 Üst"],
    ["au25Ust", "2.5 Üst"],

    ["kgVar", "KG Var"]
];


/* ======================================================
   TEK MARKET ANALİZİ
====================================================== */

function analyzeMarket(
    target,
    date,
    key,
    name
) {

    const targetOdd =
        getOdd(target, key);

    /*
    Hedef maçta bu oran yoksa
    bu market kullanılmaz.
    */

    if (targetOdd === null) {
        return null;
    }


    const history =
        historyBefore(date);


    /*
    ORAN BİREBİR EŞLEŞİR.
    */

    const samples =
        history.filter(historyMatch => {

            const historyOdd =
                getOdd(historyMatch, key);

            return exact(
                historyOdd,
                targetOdd
            );
        });


    /*
    ARTIK MINIMUM 5 ŞARTI YOK.
    1 eşleşme bile kullanılabilir.
    */

    if (!samples.length) {
        return null;
    }


    let one = 0;
    let x = 0;
    let two = 0;


    samples.forEach(match => {

        const result =
            scoreResult(match);

        if (result === "1") {
            one++;
        }

        if (result === "X") {
            x++;
        }

        if (result === "2") {
            two++;
        }
    });


    const total =
        one + x + two;


    if (!total) {
        return null;
    }


    return {

        name,

        key,

        odd: targetOdd,

        sample: total,

        one,

        x,

        two
    };
}


/* ======================================================
   ORTAK TAHMİN
====================================================== */

function predict(target, date) {

    const analyses = [];


    /*
    Her market ayrı ayrı incelenir.
    */

    MARKETS.forEach(
        ([key, name]) => {

            const result =
                analyzeMarket(
                    target,
                    date,
                    key,
                    name
                );

            if (result) {
                analyses.push(result);
            }
        }
    );


    /*
    Hiçbir birebir eşleşme yok.
    */

    if (!analyses.length) {

        return {

            prediction: null,

            one: 0,
            x: 0,
            two: 0,

            sample: 0,

            markets: []
        };
    }


    /*
    =====================================================
    TÜM MARKETLER TEK HAVUZDA BİRLEŞTİRİLİR
    =====================================================

    Örneğin:

    MS1:
    1 = 3
    X = 1
    2 = 0

    İY1:
    1 = 2
    X = 2
    2 = 1

    KG Var:
    1 = 1
    X = 0
    2 = 2

    Ortak:

    1 = 6
    X = 3
    2 = 3

    Tahmin = 1
    */


    let one = 0;
    let x = 0;
    let two = 0;

    let totalSample = 0;


    analyses.forEach(analysis => {

        one += analysis.one;

        x += analysis.x;

        two += analysis.two;

        totalSample +=
            analysis.sample;
    });


    const total =
        one + x + two;


    if (!total) {

        return {

            prediction: null,

            one: 0,
            x: 0,
            two: 0,

            sample: 0,

            markets: analyses
        };
    }


    const onePercent =
        (one / total) * 100;

    const xPercent =
        (x / total) * 100;

    const twoPercent =
        (two / total) * 100;


    /*
    En çok destek alan sonuç.
    */

    const values = [

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


    values.sort(
        (a, b) =>
            b.value - a.value
    );


    return {

        prediction:
            values[0].result,

        one: onePercent,

        x: xPercent,

        two: twoPercent,

        sample: totalSample,

        markets: analyses
    };
}


/* ======================================================
   SPOR TOTO VERİSİ
====================================================== */

async function loadTotoData() {

    const response =
        await fetch(
            TOTO_DATA_URL +
            "?t=" +
            Date.now(),
            {
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            "data/spor-toto.json bulunamadı."
        );
    }


    return await response.json();
}


/* ======================================================
   HAFTA SEÇİMİ
====================================================== */

function renderWeeks() {

    const select =
        document.getElementById(
            "weekSelect"
        );


    if (!select) {
        return;
    }


    select.innerHTML = "";


    totoWeeks.forEach(week => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            week.id;


        option.textContent =
            `${week.season || ""} ${week.week || ""}. Hafta`;


        select.appendChild(option);
    });


    if (selectedWeek !== null) {

        select.value =
            String(selectedWeek);
    }


    select.onchange = () => {

        selectedWeek =
            select.value;

        render();
    };
}


/* ======================================================
   ÖZET
====================================================== */

function renderSummary(predictions) {

    let hit = 0;
    let miss = 0;
    let wait = 0;


    predictions.forEach(prediction => {

        if (!prediction.prediction) {

            wait++;

            return;
        }


        if (!prediction.result) {

            wait++;

            return;
        }


        if (
            prediction.prediction ===
            prediction.result
        ) {

            hit++;

        } else {

            miss++;
        }
    });


    const finished =
        hit + miss;


    const rate =
        finished > 0
            ? (hit / finished) * 100
            : 0;


    const summary =
        document.getElementById(
            "summary"
        );


    if (!summary) {
        return;
    }


    summary.innerHTML = `

        <div class="summary">

            <div class="summary-title">
                ${esc(selectedWeek)}
            </div>

            <div class="summary-grid">

                <div class="summary-box green">

                    <strong>
                        ${hit}
                    </strong>

                    <span>
                        ✓ Doğru
                    </span>

                </div>


                <div class="summary-box red">

                    <strong>
                        ${miss}
                    </strong>

                    <span>
                        ✕ Yanlış
                    </span>

                </div>


                <div class="summary-box gray">

                    <strong>
                        ${wait}
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
   MAÇ KARTI
====================================================== */

function renderMatch(
    match,
    prediction,
    index
) {

    const actual =
        match.result || null;


    let status = "wait";
    let icon = "•";


    /*
    Sonuç belli ve tahmin varsa
    */

    if (
        prediction.prediction &&
        actual
    ) {

        if (
            prediction.prediction ===
            actual
        ) {

            status = "hit";
            icon = "✓";

        } else {

            status = "miss";
            icon = "✕";
        }
    }


    /*
    Birebir eşleşen marketler
    */

    const marketText =
        prediction.markets
            .map(m =>
                `${esc(m.name)} ${m.odd}`
            )
            .join(" • ");


    /*
    Hiç eşleşme yoksa
    */

    const noSampleText = `

        <div class="warning">

            Bu maç için geçmişte
            birebir eşleşen oran bulunamadı.

        </div>
    `;


    /*
    Tahmin varsa detay
    */

    const predictionDetails = `

        <div class="sample">

            <b>
                ${prediction.sample}
            </b>
            geçmiş birebir eşleşme

            <br>

            Eşleşen marketler:

            ${marketText}

        </div>


        <div class="percentages">

            <div class="percent">

                1

                <b>
                    ${prediction.one.toFixed(1)}%
                </b>

            </div>


            <div class="percent">

                X

                <b>
                    ${prediction.x.toFixed(1)}%
                </b>

            </div>


            <div class="percent">

                2

                <b>
                    ${prediction.two.toFixed(1)}%
                </b>

            </div>

        </div>
    `;


    return `

        <div class="match">

            <div class="match-row">

                <div class="number">

                    ${index + 1}

                </div>


                <div class="teams">

                    ${esc(match.home)}

                    -

                    ${esc(match.away)}

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
                    match.score
                    ?
                    `
                    <div class="score">

                        Skor:
                        ${esc(match.score)}

                    </div>
                    `
                    :
                    ""
                }


                ${
                    prediction.prediction
                    ? predictionDetails
                    : noSampleText
                }

            </div>

        </div>
    `;
}


/* ======================================================
   HEDEF MAÇI BUL
====================================================== */

function findTargetMatch(totoMatch) {

    if (!totoMatch) {
        return null;
    }


    return matchesData.find(match => {

        return (

            sameTeam(
                match.home,
                totoMatch.home
            )

            &&

            sameTeam(
                match.away,
                totoMatch.away
            )

        );
    }) || null;
}


/* ======================================================
   RENDER
====================================================== */

async function render() {

    const box =
        document.getElementById(
            "matches"
        );


    if (!box) {
        return;
    }


    const week =
        totoWeeks.find(
            w =>
                String(w.id) ===
                String(selectedWeek)
        );


    if (!week) {

        box.innerHTML = `

            <div class="error">

                Hafta bulunamadı.

            </div>
        `;

        return;
    }


    const predictions = [];


    /*
    Sadece ilk 15 maç.
    */

    const weekMatches =
        Array.isArray(week.matches)
            ? week.matches.slice(0, 15)
            : [];


    for (
        const match of weekMatches
    ) {

        /*
        Maçın tarihi.
        */

        const targetDate =
            match.date ||
            week.date ||
            new Date()
                .toISOString();


        /*
        matches.json içinde
        aynı maçı bul.
        */

        const target =
            findTargetMatch(match);


        /*
        matches.json'da maç bulunamazsa
        tahmin üretilemez.
        */

        if (!target) {

            predictions.push({

                prediction: null,

                result:
                    match.result ||
                    null,

                markets: [],

                sample: 0,

                one: 0,

                x: 0,

                two: 0
            });

            continue;
        }


        /*
        Tahmin oluştur.
        */

        const prediction =
            predict(
                target,
                targetDate
            );


        /*
        TotoKazan sonucu.
        */

        prediction.result =
            match.result ||
            null;


        predictions.push(
            prediction
        );
    }


    /*
    Özet.
    */

    renderSummary(
        predictions
    );


    /*
    Bilgi alanı + maçlar.
    */

    box.innerHTML = `

        <div class="info">

            Tahminler
            <b>matches.json</b>
            geçmiş oranlarından oluşturulur.

            <br><br>

            Oran eşleşmesi
            <b>birebir</b> yapılır.

            <br>

            Tolerans kullanılmaz.

            <br>

            Minimum örneklem şartı yoktur.
            Bir adet birebir eşleşme bile
            hesaba katılır.

            <br>

            Farklı marketlerin sonuçları
            ortak
            <b>1 / X / 2</b>
            havuzunda birleştirilir.

            <br>

            En çok destek alan sonuç
            tek tahmin olarak gösterilir.

        </div>


        <div class="matches">

            ${weekMatches
                .map(
                    (match, index) =>
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
   BAŞLAT
====================================================== */

async function init() {

    try {

        /*
        matches.json
        */

        const matchesResponse =
            await fetch(
                MATCHES_URL +
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


        /*
        Hem dizi hem de
        { matches: [] } formatını destekle.
        */

        matchesData =
            Array.isArray(matchesJson)
                ? matchesJson
                : (
                    matchesJson.matches ||
                    []
                );


        /*
        Spor Toto verisi.
        */

        const toto =
            await loadTotoData();


        totoWeeks =
            Array.isArray(toto.weeks)
                ? toto.weeks
                : [];


        if (!totoWeeks.length) {

            throw new Error(
                "spor-toto.json içinde hafta yok."
            );
        }


        /*
        Önce currentWeek.
        Yoksa son hafta.
        */

        selectedWeek =
            String(
                toto.currentWeek ||
                totoWeeks[
                    totoWeeks.length - 1
                ].id
            );


        /*
        Hafta seçiciyi oluştur.
        */

        renderWeeks();


        /*
        Maçları oluştur.
        */

        await render();


    } catch (error) {

        console.error(
            "Spor Toto:",
            error
        );


        const matches =
            document.getElementById(
                "matches"
            );


        if (matches) {

            matches.innerHTML = `

                <div class="error">

                    <b>
                        Veri yüklenemedi.
                    </b>

                    <br><br>

                    ${esc(
                        error.message
                    )}

                </div>
            `;
        }
    }
}


/* ======================================================
   ÇALIŞTIR
====================================================== */

init();
