"use strict";

/*
=========================================================
 SPOR TOTO
=========================================================

 KURALLAR:

 1. Her hafta 15 maç.
 2. Her maç için SADECE 1 / X / 2.
 3. TOLERANS YOK.
 4. Oran eşleşmesi birebir yapılır.
 5. Geçmiş örneklemler 1/X/2 havuzunda birleştirilir.
 6. Hedef maçın sonucu örnekleme dahil edilmez.
 7. En yüksek ortak sonuç tek tahmin olur.
 8. Geçmiş haftalarda:
      ✓ = tuttu
      ✕ = tutmadı
      • = bekliyor

=========================================================
*/

const DATA_URL =
    "https://raw.githubusercontent.com/teador612/mackolik1/refs/heads/main/data/matches.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;

let mackolikMatches = [];
let selectedWeek = null;


/* ======================================================
   METİN
====================================================== */

function normalizeText(value) {

    return String(value ?? "")
        .toLowerCase()
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

const TEAM_ALIASES = {

    corumfk: [
        "corumfk",
        "arcacorumfk",
        "corum"
    ],

    istanbulbasaksehir: [
        "istanbulbasaksehir",
        "ramsbasaksehir",
        "basaksehir"
    ],

    tottenhamhotspur: [
        "tottenhamhotspur",
        "thotspur",
        "tottenham"
    ],

    hullcity: [
        "hullcity",
        "hcity"
    ],

    manchestercity: [
        "manchestercity",
        "mcity"
    ],

    manchesterunited: [
        "manchesterunited",
        "manchesterutd",
        "manutd"
    ],

    parissaintgermain: [
        "parissaintgermain",
        "parisstgermain",
        "psg"
    ],

    kuzeymakedonya: [
        "kuzeymakedonyacumhuriyeti",
        "kuzeymakedonya",
        "makedonya",
        "northmacedonia"
    ],

    vfbstuttgart: [
        "vfbstuttgart",
        "stuttgart"
    ],

    bayerleverkusen: [
        "bayerleverkusen",
        "leverkusen"
    ],

    rbleipzig: [
        "rbleipzig",
        "leipzig"
    ],

    galatasaray: [
        "galatasaray"
    ],

    fenerbahce: [
        "fenerbahce"
    ],

    besiktas: [
        "besiktas"
    ],

    trabzonspor: [
        "trabzonspor"
    ],

    samsunspor: [
        "samsunspor"
    ],

    goztepe: [
        "goztepe"
    ],

    kocaelispor: [
        "kocaelispor"
    ],

    amedspor: [
        "amedsportiffaaliyetler",
        "amedspor",
        "amed"
    ],

    erzurumspor: [
        "erzurumsporfk",
        "erzurumspor"
    ],

    gaziantepfk: [
        "gaziantepfk",
        "gaziantep"
    ],

    alanyaspor: [
        "corendonalanyaspor",
        "alanyaspor"
    ],

    kasimpasa: [
        "kasimpasa"
    ],

    eyupspor: [
        "eyupspor"
    ],

    rizespor: [
        "caykurrizespor",
        "rizespor"
    ],

    konyaspor: [
        "tumosankonyaspor",
        "konyaspor"
    ],

    genclerbirligi: [
        "genclerbirligi"
    ]
};


function canonicalTeam(name) {

    const n = normalizeText(name);

    for (const canonical in TEAM_ALIASES) {

        if (TEAM_ALIASES[canonical].includes(n)) {
            return canonical;
        }
    }

    return n;
}


function sameTeam(a, b) {

    return canonicalTeam(a) === canonicalTeam(b);
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

        const [day, month, year] = s.split(".");

        d = new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
        );

    } else {

        d = new Date(s);
    }

    if (Number.isNaN(d?.getTime())) {
        return null;
    }

    d.setHours(0, 0, 0, 0);

    return d;
}


/* ======================================================
   SKOR
====================================================== */

function getScore(match) {

    const score = match?.score;

    if (!score) {
        return null;
    }

    const home = Number(score.home);
    const away = Number(score.away);

    if (
        !Number.isFinite(home) ||
        !Number.isFinite(away)
    ) {
        return null;
    }

    return {
        home,
        away
    };
}


function getResultFromScore(match) {

    const score = getScore(match);

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

function getOpeningOdds(match, key) {

    const odds = match?.openingOdds;

    if (!odds) {
        return null;
    }

    const value = odds[key];

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


/* ======================================================
   TOLERANS YOK
====================================================== */

function exactOdds(a, b) {

    if (a === null || b === null) {
        return false;
    }

    /*
     * ÖNEMLİ:
     * Burada hiçbir tolerans yok.
     */

    return Number(a) === Number(b);
}


/* ======================================================
   GEÇMİŞ
====================================================== */

function getHistory(targetDate) {

    const target = parseDate(targetDate);

    if (!target) {
        return [];
    }

    const start = new Date(target);

    start.setDate(
        start.getDate() - HISTORY_DAYS
    );

    return mackolikMatches.filter(match => {

        const date = parseDate(match.date);

        if (!date) {
            return false;
        }

        if (date < start) {
            return false;
        }

        /*
         * Hedef maç ve sonrası kesinlikle
         * örnekleme alınmaz.
         */
        if (date >= target) {
            return false;
        }

        return getScore(match) !== null;
    });
}


/* ======================================================
   HEDEF MAÇ BUL
====================================================== */

function findCandidates(sportMatch) {

    return mackolikMatches.filter(match => {

        return (
            sameTeam(match.home, sportMatch.home) &&
            sameTeam(match.away, sportMatch.away)
        );
    });
}


/*
 * Geçmiş maçlarda aynı iki takım tekrar bulunabilir.
 *
 * Sonucu biliyorsak aynı sonuçla eşleşen kayıtları
 * önceliklendiriyoruz.
 *
 * Tahmin hesaplamasında hedef maçın sonucu
 * hiçbir şekilde kullanılmıyor.
 */

function findMackolikMatch(sportMatch) {

    const candidates =
        findCandidates(sportMatch);

    if (!candidates.length) {
        return null;
    }

    const expectedResult =
        sportMatch.result || null;

    if (expectedResult) {

        const matchingResult =
            candidates.filter(match => {

                return (
                    getResultFromScore(match) ===
                    expectedResult
                );
            });

        if (matchingResult.length) {

            matchingResult.sort((a, b) => {

                const da = parseDate(a.date);
                const db = parseDate(b.date);

                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;

                return db - da;
            });

            return matchingResult[0];
        }
    }

    /*
     * Gelecek hafta için:
     * tarihi en yakın olan kayıt.
     */

    candidates.sort((a, b) => {

        const da = parseDate(a.date);
        const db = parseDate(b.date);

        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;

        return db - da;
    });

    return candidates[0];
}


/* ======================================================
   ÖRNEKLEM MARKETLERİ
====================================================== */

const MARKETS = [

    {
        key: "ms1",
        name: "MS 1"
    },

    {
        key: "ms0",
        name: "MS X"
    },

    {
        key: "ms2",
        name: "MS 2"
    },

    {
        key: "iy1",
        name: "İY 1"
    },

    {
        key: "iy2",
        name: "İY 2"
    },

    {
        key: "iy15Ust",
        name: "İY 1.5 Üst"
    },

    {
        key: "iy05Ust",
        name: "İY 0.5 Üst"
    },

    {
        key: "au25Ust",
        name: "2.5 Üst"
    },

    {
        key: "kgVar",
        name: "KG Var"
    },

    {
        key: "au15Ust",
        name: "1.5 Üst"
    },

    {
        key: "au15Alt",
        name: "1.5 Alt"
    }
];


/* ======================================================
   TEK MARKET ANALİZİ
====================================================== */

function analyzeMarket(
    targetMatch,
    market,
    targetDate
) {

    const targetOdd =
        getOpeningOdds(
            targetMatch,
            market.key
        );

    if (targetOdd === null) {
        return null;
    }

    const history =
        getHistory(targetDate);

    const samples =
        history.filter(match => {

            const odd =
                getOpeningOdds(
                    match,
                    market.key
                );

            return exactOdds(
                odd,
                targetOdd
            );
        });

    if (samples.length < MIN_SAMPLE) {
        return null;
    }

    let one = 0;
    let x = 0;
    let two = 0;

    samples.forEach(match => {

        const result =
            getResultFromScore(match);

        if (result === "1") one++;
        if (result === "X") x++;
        if (result === "2") two++;
    });

    const total =
        one + x + two;

    if (total < MIN_SAMPLE) {
        return null;
    }

    return {

        market: market.name,

        key: market.key,

        odd: targetOdd,

        sample: total,

        one: one / total * 100,

        x: x / total * 100,

        two: two / total * 100
    };
}


/* ======================================================
   ORTAK SONUÇ
====================================================== */

function calculatePrediction(
    targetMatch,
    targetDate
) {

    const analyses = [];

    MARKETS.forEach(market => {

        const result =
            analyzeMarket(
                targetMatch,
                market,
                targetDate
            );

        if (result) {
            analyses.push(result);
        }
    });


    if (!analyses.length) {

        return {

            prediction: null,

            one: 0,

            x: 0,

            two: 0,

            markets: [],

            totalSample: 0
        };
    }


    /*
     * TÜM ÖRNEKLEMLER TEK HAVUZDA
     *
     * Marketlerin her biri kendi
     * 1/X/2 sonuçlarını getirir.
     *
     * Daha fazla geçmiş örneklem bulunan
     * market biraz daha fazla ağırlık alır.
     */

    let one = 0;
    let x = 0;
    let two = 0;

    let totalWeight = 0;
    let totalSample = 0;


    analyses.forEach(item => {

        const weight =
            Math.sqrt(item.sample);

        one += item.one * weight;
        x += item.x * weight;
        two += item.two * weight;

        totalWeight += weight;

        totalSample += item.sample;
    });


    one /= totalWeight;
    x /= totalWeight;
    two /= totalWeight;


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
            key: "1",
            value: one
        },

        {
            key: "X",
            value: x
        },

        {
            key: "2",
            value: two
        }

    ];


    values.sort(
        (a, b) =>
            b.value - a.value
    );


    /*
     * EN YÜKSEK ORTAK SONUÇ
     *
     * Her durumda tek sonuç.
     */

    const prediction =
        values[0].key;


    return {

        prediction,

        one,

        x,

        two,

        markets: analyses,

        totalSample
    };
}


/* ======================================================
   YÜZDE
====================================================== */

function pct(value) {

    return (
        Number(value).toFixed(1) +
        "%"
    );
}


/* ======================================================
   HTML GÜVENLİĞİ
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
   SONUÇ DURUMU
====================================================== */

function resultState(
    prediction,
    actual
) {

    if (!actual) {
        return "waiting";
    }

    if (
        prediction &&
        prediction === actual
    ) {
        return "hit";
    }

    return "miss";
}


function resultIcon(state) {

    if (state === "hit") {
        return `
            <div class="result hit" title="Tahmin tuttu">
                ✓
            </div>
        `;
    }

    if (state === "miss") {
        return `
            <div class="result miss" title="Tahmin tutmadı">
                ✕
            </div>
        `;
    }

    return `
        <div class="result waiting" title="Henüz sonuçlanmadı">
            •
        </div>
    `;
}


/* ======================================================
   MAÇ RENDER
====================================================== */

function renderMatch(
    sportMatch,
    index
) {

    const mackolik =
        findMackolikMatch(
            sportMatch
        );


    if (!mackolik) {

        return `
            <div class="match">

                <div class="match-main">

                    <div class="number">
                        ${index + 1}
                    </div>

                    <div class="teams">
                        ${escapeHtml(sportMatch.home)}
                        -
                        ${escapeHtml(sportMatch.away)}
                    </div>

                    <div class="prediction no-data">
                        ?
                    </div>

                </div>

                <div class="no-data-box">
                    Mackolik verisinde bu maç bulunamadı.
                </div>

            </div>
        `;
    }


    const targetDate =
        mackolik.date;


    const decision =
        calculatePrediction(
            mackolik,
            targetDate
        );


    const prediction =
        decision.prediction;


    /*
     * Gerçek sonuç:
     *
     * Geçmiş hafta için data dosyasındaki
     * result kullanılır.
     *
     * Gelecek hafta için Mackolik skoru
     * kontrol edilir.
     */

    let actual =
        sportMatch.result || null;


    if (!actual) {

        actual =
            getResultFromScore(
                mackolik
            );
    }


    const state =
        resultState(
            prediction,
            actual
        );


    const predictionHtml =
        prediction
        ?
        `
            <div class="prediction">
                ${prediction}
            </div>
        `
        :
        `
            <div class="prediction no-data">
                ?
            </div>
        `;


    const marketsText =
        decision.markets.length
        ?
        decision.markets
            .map(item =>
                `${escapeHtml(item.market)}: ${item.odd}`
            )
            .join(" • ")
        :
        "";


    return `
        <div class="match">

            <div class="match-main">

                <div class="number">
                    ${index + 1}
                </div>

                <div class="teams">
                    ${escapeHtml(sportMatch.home)}
                    -
                    ${escapeHtml(sportMatch.away)}
                </div>

                ${predictionHtml}

                ${resultIcon(state)}

            </div>


            <div class="match-details">

                ${
                    decision.prediction
                    ?
                    `
                    <div class="odds-info">
                        ${decision.markets.length}
                        farklı örneklem türü •
                        ${decision.totalSample}
                        toplam geçmiş eşleşme
                    </div>

                    <div class="percentages">

                        <div class="percent">
                            1
                            <strong>
                                ${pct(decision.one)}
                            </strong>
                        </div>

                        <div class="percent">
                            X
                            <strong>
                                ${pct(decision.x)}
                            </strong>
                        </div>

                        <div class="percent">
                            2
                            <strong>
                                ${pct(decision.two)}
                            </strong>
                        </div>

                    </div>

                    <div class="odds-info">
                        Birebir eşleşenler:
                        ${marketsText}
                    </div>
                    `
                    :
                    `
                    <div class="no-data-box">
                        En az ${MIN_SAMPLE}
                        birebir oran eşleşmesi bulunan
                        örneklem bulunamadı.
                    </div>
                    `
                }

            </div>

        </div>
    `;
}


/* ======================================================
   HAFTA VERİSİ
====================================================== */

function getWeekMatches(week) {

    const weekData =
        window.SPORT_TOTO_DATA
            ?.weeks
            ?.[week];

    if (!weekData) {
        return [];
    }

    if (Array.isArray(weekData)) {
        return weekData;
    }

    return weekData.matches || [];
}


/* ======================================================
   HAFTA ÖZETİ
====================================================== */

function calculateWeekSummary(matches) {

    let hit = 0;
    let miss = 0;
    let waiting = 0;
    let noPrediction = 0;


    matches.forEach(match => {

        const mackolik =
            findMackolikMatch(match);

        if (!mackolik) {
            noPrediction++;
            return;
        }


        const decision =
            calculatePrediction(
                mackolik,
                mackolik.date
            );


        if (!decision.prediction) {
            noPrediction++;
            return;
        }


        let actual =
            match.result || null;


        if (!actual) {
            actual =
                getResultFromScore(
                    mackolik
                );
        }


        if (!actual) {
            waiting++;
            return;
        }


        if (
            decision.prediction ===
            actual
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


    return {

        hit,
        miss,
        waiting,
        noPrediction,
        rate
    };
}


/* ======================================================
   ÖZET RENDER
====================================================== */

function renderSummary(
    matches,
    summary
) {

    document.getElementById(
        "summary"
    ).innerHTML = `

        <section class="summary">

            <div class="summary-title">
                ${selectedWeek}. Hafta
            </div>

            <div class="summary-grid">

                <div class="summary-box hit">
                    <strong>
                        ${summary.hit}
                    </strong>
                    <small>
                        ✓ Doğru
                    </small>
                </div>

                <div class="summary-box miss">
                    <strong>
                        ${summary.miss}
                    </strong>
                    <small>
                        ✕ Yanlış
                    </small>
                </div>

                <div class="summary-box waiting">
                    <strong>
                        ${summary.waiting}
                    </strong>
                    <small>
                        • Bekliyor
                    </small>
                </div>

                <div class="summary-box rate">
                    <strong>
                        ${summary.rate.toFixed(1)}%
                    </strong>
                    <small>
                        Başarı
                    </small>
                </div>

            </div>

        </section>
    `;
}


/* ======================================================
   HAFTA RENDER
====================================================== */

function renderWeek() {

    const matches =
        getWeekMatches(
            selectedWeek
        );


    if (!matches.length) {

        document.getElementById(
            "summary"
        ).innerHTML = "";

        document.getElementById(
            "content"
        ).innerHTML = `
            <div class="error">
                ${selectedWeek}. hafta verisi bulunamadı.
            </div>
        `;

        return;
    }


    const summary =
        calculateWeekSummary(
            matches
        );


    renderSummary(
        matches,
        summary
    );


    const rows =
        matches
            .slice(0, 15)
            .map(
                (match, index) =>
                    renderMatch(
                        match,
                        index
                    )
            )
            .join("");


    document.getElementById(
        "content"
    ).innerHTML = `

        <section class="info">

            <div class="info-title">
                Spor Toto ${selectedWeek}. Hafta
            </div>

            <div class="info-text">

                15 maçın her biri için yalnızca
                tek sonuç üretilir.
                Farklı örneklemler 1 / X / 2
                havuzunda birleştirilir.
                En yüksek ortak sonuç tahmin olarak alınır.

                <br>

                Oran eşleşmesi tamamen birebirdir.
                Tolerans kullanılmaz.

            </div>

        </section>


        <section class="card">

            ${rows}

        </section>
    `;
}


/* ======================================================
   HAFTALAR
====================================================== */

function renderWeeks() {

    const weeks =
        window.SPORT_TOTO_DATA
            ?.weeks || {};


    const numbers =
        Object.keys(weeks)
            .map(Number)
            .sort(
                (a, b) => b - a
            );


    document.getElementById(
        "weeks"
    ).innerHTML =

        numbers
            .map(week => {

                return `
                    <button
                        class="week-btn ${
                            Number(week) ===
                            Number(selectedWeek)
                            ? "active"
                            : ""
                        }"
                        data-week="${week}"
                    >
                        ${week}. Hafta
                    </button>
                `;
            })
            .join("");


    document
        .querySelectorAll(".week-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectedWeek =
                        Number(
                            button.dataset.week
                        );

                    renderWeeks();

                    renderWeek();
                }
            );

        });
}


/* ======================================================
   MACKOLIK VERİSİ
====================================================== */

async function loadMackolik() {

    const response =
        await fetch(
            DATA_URL +
            "?t=" +
            Date.now(),
            {
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            "Mackolik verisi alınamadı. HTTP " +
            response.status
        );
    }


    const data =
        await response.json();


    if (
        !data ||
        !Array.isArray(data.matches)
    ) {

        throw new Error(
            "data/matches.json içinde matches bulunamadı."
        );
    }


    mackolikMatches =
        data.matches;


    console.log(
        "Spor Toto Mackolik maç sayısı:",
        mackolikMatches.length
    );
}


/* ======================================================
   BAŞLAT
====================================================== */

async function init() {

    try {

        if (
            !window.SPORT_TOTO_DATA
        ) {

            throw new Error(
                "data/spor-toto-data.js yüklenemedi."
            );
        }


        const weeks =
            window.SPORT_TOTO_DATA.weeks ||
            {};


        const numbers =
            Object.keys(weeks)
                .map(Number)
                .sort(
                    (a, b) => a - b
                );


        selectedWeek =
            Number(
                window.SPORT_TOTO_DATA.currentWeek
            ) ||
            numbers[numbers.length - 1];


        renderWeeks();


        document.getElementById(
            "content"
        ).innerHTML = `
            <div class="loading">
                Mackolik geçmiş verileri yükleniyor...
            </div>
        `;


        await loadMackolik();


        renderWeek();


    } catch (error) {

        console.error(
            "Spor Toto hata:",
            error
        );


        document.getElementById(
            "content"
        ).innerHTML = `

            <div class="error">

                <strong>
                    Veri yüklenemedi.
                </strong>

                <br><br>

                ${escapeHtml(
                    error.message ||
                    error
                )}

            </div>
        `;
    }
}


init();
