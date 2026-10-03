"use strict";

/*
==========================================================
 SPOR TOTO
==========================================================

 Kaynak:
 TotoKazan

 Tahmin kaynağı:
 mevcut data/matches.json

 Kurallar:
 - 15 maç
 - tek sonuç
 - 1 / X / 2
 - tolerans YOK
 - oran birebir eşleşir
 - geçmiş örneklemler birleştirilir
 - hedef maç geçmiş örnekleme dahil edilmez
==========================================================
*/

const TOTO_URL =
    "https://totokazan.com/spor-toto";

const MATCHES_URL =
    "data/matches.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;

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
   NORMALIZE
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
   TAKIM EŞLEŞTİRME
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

        if (
            ALIASES[key].includes(n)
        ) {
            return key;
        }
    }

    return n;
}


function sameTeam(a,b) {

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

    if (
        /^\d{2}\.\d{2}\.\d{4}$/.test(s)
    ) {

        const p = s.split(".");

        d = new Date(
            Number(p[2]),
            Number(p[1])-1,
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

    d.setHours(0,0,0,0);

    return d;
}


/* ======================================================
   SKOR
====================================================== */

function scoreResult(match) {

    if (!match) {
        return null;
    }

    let home = null;
    let away = null;

    if (match.score) {

        home = Number(match.score.home);
        away = Number(match.score.away);

    } else if (
        match.homeScore !== undefined
    ) {

        home = Number(match.homeScore);
        away = Number(match.awayScore);

    }

    if (
        !Number.isFinite(home) ||
        !Number.isFinite(away)
    ) {
        return null;
    }

    if (home > away) return "1";
    if (home < away) return "2";

    return "X";
}


/* ======================================================
   ORANLAR
====================================================== */

function odds(match) {

    return (
        match?.openingOdds ||
        match?.odds ||
        {}
    );
}


function getOdd(match,key) {

    const o = odds(match);

    const value = o[key];

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : null;
}


/* ======================================================
   TOLERANS YOK
====================================================== */

function exact(a,b) {

    if (
        a === null ||
        b === null
    ) {
        return false;
    }

    /*
     * BİREBİR EŞLEŞME.
     *
     * 1.80 = 1.80
     * 1.81 ≠ 1.80
     * 1.799 ≠ 1.80
     *
     * TOLERANS YOK.
     */

    return Number(a) === Number(b);
}


/* ======================================================
   GEÇMİŞ
====================================================== */

function historyBefore(date) {

    const target =
        parseDate(date);

    if (!target) {
        return [];
    }

    const start =
        new Date(target);

    start.setDate(
        start.getDate() -
        HISTORY_DAYS
    );

    return matchesData.filter(m => {

        const d =
            parseDate(m.date);

        if (!d) return false;

        if (d < start) return false;

        if (d >= target) return false;

        return !!scoreResult(m);
    });
}


/* ======================================================
   MARKETLER
====================================================== */

const MARKETS = [

    ["ms1","MS 1"],
    ["ms0","MS X"],
    ["ms2","MS 2"],

    ["iy1","İY 1"],
    ["iy2","İY 2"],

    ["iy15Ust","İY 1.5 Üst"],
    ["iy05Ust","İY 0.5 Üst"],

    ["au15Ust","1.5 Üst"],
    ["au25Ust","2.5 Üst"],

    ["kgVar","KG Var"]
];


/* ======================================================
   MARKET SONUÇ HAVUZU
====================================================== */

function analyzeMarket(
    target,
    date,
    key,
    name
) {

    const targetOdd =
        getOdd(target,key);

    if (targetOdd === null) {
        return null;
    }

    const history =
        historyBefore(date);

    const samples =
        history.filter(m => {

            const odd =
                getOdd(m,key);

            return exact(
                odd,
                targetOdd
            );
        });

    if (
        samples.length <
        MIN_SAMPLE
    ) {
        return null;
    }

    let one = 0;
    let x = 0;
    let two = 0;

    samples.forEach(m => {

        const result =
            scoreResult(m);

        if (result === "1") one++;
        if (result === "X") x++;
        if (result === "2") two++;
    });

    const total =
        one + x + two;

    if (
        total <
        MIN_SAMPLE
    ) {
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

function predict(target,date) {

    const analyses = [];

    MARKETS.forEach(
        ([key,name]) => {

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


    if (!analyses.length) {

        return {
            prediction:null,
            one:0,
            x:0,
            two:0,
            sample:0,
            markets:[]
        };
    }


    /*
     * Bütün marketler ortak 1/X/2
     * havuzuna giriyor.
     *
     * Örnek:
     *
     * MS1     → 1 X 2
     * İY1     → 1 X 2
     * KG Var  → 1 X 2
     *
     * Hepsi tek sonuca dönüştürülüyor.
     */

    let one = 0;
    let x = 0;
    let two = 0;

    let totalSample = 0;


    analyses.forEach(a => {

        one += a.one;
        x += a.x;
        two += a.two;

        totalSample +=
            a.sample;
    });


    const total =
        one + x + two;


    one =
        one / total * 100;

    x =
        x / total * 100;

    two =
        two / total * 100;


    const values = [

        {
            result:"1",
            value:one
        },

        {
            result:"X",
            value:x
        },

        {
            result:"2",
            value:two
        }

    ];


    values.sort(
        (a,b) =>
            b.value-a.value
    );


    return {

        prediction:
            values[0].result,

        one,
        x,
        two,

        sample:
            totalSample,

        markets:
            analyses
    };
}


/* ======================================================
   TOTO KAZAN SCRAPER
====================================================== */

async function fetchTotoPage(url) {

    const response =
        await fetch(
            url,
            {
                cache:"no-store"
            }
        );

    if (!response.ok) {

        throw new Error(
            "TotoKazan HTTP " +
            response.status
        );
    }

    return response.text();
}


/*
 * Not:
 *
 * GitHub Pages üzerinde doğrudan
 * totokazan.com fetch edilirse CORS
 * engeli oluşabilir.
 *
 * Bu nedenle asıl veri çekme işlemini
 * GitHub Actions yapacak.
 *
 * Bu fonksiyon sadece veri dosyası
 * hazır olmadığında hata mesajını
 * açıklamak için bırakılmıştır.
 */


/* ======================================================
   HAFTA DOSYASI
====================================================== */

async function loadTotoData() {

    const response =
        await fetch(
            "data/spor-toto.json?t=" +
            Date.now(),
            {
                cache:"no-store"
            }
        );

    if (!response.ok) {

        throw new Error(
            "data/spor-toto.json bulunamadı."
        );
    }

    const data =
        await response.json();

    return data;
}


/* ======================================================
   HAFTA SEÇ
====================================================== */

function renderWeeks() {

    const select =
        document.getElementById(
            "weekSelect"
        );

    select.innerHTML = "";

    totoWeeks.forEach(week => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            week.id;

        option.textContent =
            `${week.season} ${week.week}. Hafta`;

        select.appendChild(option);
    });


    if (selectedWeek) {

        select.value =
            selectedWeek;
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

function renderSummary(
    predictions
) {

    let hit = 0;
    let miss = 0;
    let wait = 0;


    predictions.forEach(p => {

        if (!p.prediction) {
            wait++;
            return;
        }

        if (!p.result) {
            wait++;
            return;
        }

        if (
            p.prediction ===
            p.result
        ) {

            hit++;

        } else {

            miss++;
        }
    });


    const finished =
        hit + miss;

    const rate =
        finished
        ?
        hit / finished * 100
        :
        0;


    document.getElementById(
        "summary"
    ).innerHTML = `

        <div class="summary">

            <div class="summary-title">
                ${esc(
                    selectedWeek
                )}
            </div>

            <div class="summary-grid">

                <div class="summary-box green">
                    <strong>${hit}</strong>
                    <span>✓ Doğru</span>
                </div>

                <div class="summary-box red">
                    <strong>${miss}</strong>
                    <span>✕ Yanlış</span>
                </div>

                <div class="summary-box gray">
                    <strong>${wait}</strong>
                    <span>• Bekliyor</span>
                </div>

                <div class="summary-box rate">
                    <strong>
                        ${rate.toFixed(1)}%
                    </strong>
                    <span>Başarı</span>
                </div>

            </div>

        </div>
    `;
}


/* ======================================================
   MAÇ
====================================================== */

function renderMatch(
    match,
    prediction,
    index
) {

    const actual =
        match.result || null;

    let status =
        "wait";

    let icon = "•";


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


    const marketText =
        prediction.markets
            .map(m =>
                `${esc(m.name)} ${m.odd}`
            )
            .join(" • ");


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
                        prediction.prediction
                        || "?"
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
                        Skor: ${esc(match.score)}
                    </div>
                    `
                    :
                    ""
                }


                ${
                    prediction.prediction
                    ?
                    `
                    <div class="sample">

                        ${prediction.markets.length}
                        örneklem türü •

                        ${prediction.sample}
                        geçmiş eşleşme

                        <br>

                        Birebir eşleşen oranlar:

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
                    `
                    :
                    `
                    <div class="warning">

                        En az ${MIN_SAMPLE}
                        birebir oran eşleşmesi
                        bulunan örneklem yok.

                    </div>
                    `
                }

            </div>

        </div>
    `;
}


/* ======================================================
   RENDER
====================================================== */

async function render() {

    const box =
        document.getElementById(
            "matches"
        );

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


    for (
        const match of week.matches
    ) {

        /*
         * Geçmiş örneklem tarihi olarak
         * maçın tarihini kullan.
         */

        const targetDate =
            match.date ||
            new Date().toISOString();


        /*
         * matches.json içinden aynı
         * takımları bul.
         */

        const target =
            matchesData.find(m => {

                return (
                    sameTeam(
                        m.home,
                        match.home
                    ) &&
                    sameTeam(
                        m.away,
                        match.away
                    )
                );
            });


        if (!target) {

            predictions.push({

                prediction:null,

                result:
                    match.result || null,

                markets:[],

                sample:0,

                one:0,
                x:0,
                two:0
            });

            continue;
        }


        const p =
            predict(
                target,
                targetDate
            );


        p.result =
            match.result || null;

        predictions.push(p);
    }


    renderSummary(
        predictions
    );


    box.innerHTML = `

        <div class="info">

            Tahminler mevcut
            <b>matches.json</b>
            geçmiş oranlarından oluşturulur.

            <br>

            Oran eşleşmesi tamamen
            <b>birebir</b> yapılır.
            Tolerans kullanılmaz.

            <br>

            Farklı marketlerden gelen
            sonuçlar ortak
            <b>1 / X / 2</b>
            havuzunda birleştirilir.

            Her maç için yalnızca
            <b>tek sonuç</b> gösterilir.

        </div>

        <div class="matches">

            ${week.matches
                .slice(0,15)
                .map(
                    (m,i) =>
                        renderMatch(
                            m,
                            predictions[i],
                            i
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
         * Mevcut matches.json
         */

        const matchesResponse =
            await fetch(
                MATCHES_URL +
                "?t=" +
                Date.now(),
                {
                    cache:"no-store"
                }
            );


        if (!matchesResponse.ok) {

            throw new Error(
                "matches.json yüklenemedi."
            );
        }


        const matchesJson =
            await matchesResponse.json();


        matchesData =
            Array.isArray(matchesJson)
            ?
            matchesJson
            :
            (
                matchesJson.matches ||
                []
            );


        /*
         * Spor Toto verisi
         */

        const toto =
            await loadTotoData();


        totoWeeks =
            toto.weeks || [];


        if (!totoWeeks.length) {

            throw new Error(
                "spor-toto.json içinde hafta yok."
            );
        }


        /*
         * En son hafta
         */

        selectedWeek =
            String(
                toto.currentWeek ||
                totoWeeks[
                    totoWeeks.length - 1
                ].id
            );


        renderWeeks();

        await render();


    } catch(error) {

        console.error(error);

        document.getElementById(
            "matches"
        ).innerHTML = `

            <div class="error">

                <b>Veri yüklenemedi.</b>

                <br><br>

                ${esc(
                    error.message
                )}

            </div>
        `;
    }
}


init();
