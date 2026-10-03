"use strict";

/*
===========================================================
 SPOR TOTO - MACKOLIK1

 HESAPLAMA MANTIĞI

 1. Spor Toto maçını data/matches.json içinde bul.
 2. Oranları bulunan maçın AÇILIŞ ORANLARINDAN al.
 3. Mevcut Mackolik örneklem marketlerini kullan:
      - İY 1.5 Üst
      - İY 1
      - İY 2
      - 1.5 Alt
      - 1.5 Üst
 4. Son 60 gündeki geçmiş maçlarda aynı oranı ara.
 5. Oran eşleşmesi TAMAMEN BİREBİR.
 6. Minimum 5 örneklem şartı YOK.
 7. %70 başarı şartı YOK.
 8. Hedef maç geçmiş örnekleme dahil edilmez.
 9. Eşleşen geçmiş maçların MS sonucu:
      1 / X / 2
    olarak ortak havuzda toplanır.
10. En çok çıkan sonuç Spor Toto tahminidir.

 ÖRNEK:

 İY 1.5 Üst 1.55
 geçmiş:
 1, 1, X

 İY 1 2.20
 geçmiş:
 1, X

 1.5 Üst 1.35
 geçmiş:
 2, 1

 TOPLAM:
 1 = 4
 X = 2
 2 = 1

 TAHMİN = 1
===========================================================
*/


/* =========================================================
   AYARLAR
========================================================= */

const MATCHES_URL =
    "./data/matches.json";

const TOTO_DATA_URL =
    "./data/spor-toto.json";

const HISTORY_DAYS = 60;


/* =========================================================
   GLOBAL
========================================================= */

let matchesData = [];

let totoWeeks = [];

let selectedWeek = null;


/* =========================================================
   DOM
========================================================= */

const weekSelect =
    document.getElementById(
        "weekSelect"
    );

const summary =
    document.getElementById(
        "summary"
    );

const matchesBox =
    document.getElementById(
        "matches"
    );


/* =========================================================
   HTML GÜVENLİĞİ
========================================================= */

function esc(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   GENEL YARDIMCILAR
========================================================= */

function getValue(
    object,
    keys
) {

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
   TAKIMLAR
========================================================= */

function normalizeTeam(value) {

    return String(value ?? "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i")
        .replace(/[^a-z0-9]/g, "");
}


function sameTeam(a, b) {

    const x =
        normalizeTeam(a);

    const y =
        normalizeTeam(b);

    if (!x || !y) {
        return false;
    }

    return x === y;
}


/* =========================================================
   MAÇ BİLGİLERİ
========================================================= */

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


function getTime(match) {

    return getValue(match, [
        "time",
        "Time",
        "saat",
        "Saat",
        "matchTime"
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


function addDays(
    date,
    days
) {

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

    return !!getFullTimeScore(
        match
    );
}


/* =========================================================
   MS SONUCU
========================================================= */

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
   AÇILIŞ ORANI
========================================================= */

function normalizeOdd(value) {

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
    Mackolik sistemindeki gibi
    oran 2 basamaklı tutulur.
    */

    return number.toFixed(2);
}


/*
-----------------------------------------------------------
 Mevcut app.js ile aynı mantık:

 Önce doğrudan alanlar,
 sonra:

 openingOdds
 opening_odds
 opening
 odds
 Odds
 oranlar
 Oranlar

-----------------------------------------------------------
*/

function getOdds(
    match,
    names
) {

    const direct =
        getValue(
            match,
            names
        );


    if (
        direct !== undefined
    ) {

        return normalizeOdd(
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

            return normalizeOdd(
                value
            );
        }
    }


    return null;
}


/* =========================================================
   MACKOLIK ÖRNEKLEM MARKETLERİ

   app.js'deki mevcut SOURCE_MARKETS
========================================================= */

const SOURCE_MARKETS = [

    {

        id: "IY15U",

        title:
            "İY 1.5 Üst",

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

        title:
            "İY 1",

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

        title:
            "İY 2",

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

        id: "MS15A",

        title:
            "1.5 Alt",

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

        title:
            "1.5 Üst",

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
    }

];


/* =========================================================
   60 GÜNLÜK GEÇMİŞ
========================================================= */

function getHistoryMatches(
    targetDate
) {

    const end =
        parseDate(targetDate);


    if (!end) {
        return [];
    }


    const start =
        addDays(
            end,
            -HISTORY_DAYS
        );


    return matchesData.filter(
        match => {

            const date =
                parseDate(
                    getDate(match)
                );


            if (!date) {
                return false;
            }


            /*
            Hedef maçtan önceki
            60 günlük dönem.

            Hedef maçın kendisi
            kesinlikle dahil değil.
            */

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

function sameMatch(
    a,
    b
) {

    if (!a || !b) {
        return false;
    }


    /*
    Önce ID varsa kontrol et.
    */

    const aid =
        getValue(a, [
            "id",
            "matchId",
            "match_id"
        ]);


    const bid =
        getValue(b, [
            "id",
            "matchId",
            "match_id"
        ]);


    if (
        aid !== undefined &&
        bid !== undefined &&
        String(aid) === String(bid)
    ) {

        return true;
    }


    return (
        sameTeam(
            getHome(a),
            getHome(b)
        ) &&

        sameTeam(
            getAway(a),
            getAway(b)
        )
    );
}


/* =========================================================
   TEK MARKET İÇİN ÖRNEKLEM
========================================================= */

function getMarketSamples(
    targetMatch,
    targetDate,
    market
) {

    /*
    Hedef maçın AÇILIŞ ORANI
    */

    const targetOdd =
        market.odds(
            targetMatch
        );


    /*
    Hedef maçta bu oran yoksa
    market kullanılmaz.
    */

    if (!targetOdd) {
        return null;
    }


    const history =
        getHistoryMatches(
            targetDate
        );


    const samples = [];


    for (
        const historical
        of history
    ) {

        /*
        Hedef maç kendi
        örneklemine giremez.
        */

        if (
            sameMatch(
                historical,
                targetMatch
            )
        ) {
            continue;
        }


        const historicalOdd =
            market.odds(
                historical
            );


        if (!historicalOdd) {
            continue;
        }


        /*
        BİREBİR ORAN.

        1.85 = 1.85
        1.84 ≠ 1.85
        1.8501 ≠ 1.85

        Tolerans yok.
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


        samples.push({

            match:
                historical,

            result,

            odd:
                historicalOdd
        });
    }


    if (!samples.length) {
        return null;
    }


    return {

        marketId:
            market.id,

        marketTitle:
            market.title,

        targetOdd,

        samples
    };
}


/* =========================================================
   SPOR TOTO TAHMİNİ

   TÜM MARKETLER ORTAK HAVUZ
========================================================= */

function calculatePrediction(
    targetMatch,
    targetDate
) {

    const counts = {

        "1": 0,

        "X": 0,

        "2": 0
    };


    const markets = [];


    /*
    Her Mackolik örneklem marketini
    ayrı ayrı kontrol et.
    */

    for (
        const market
        of SOURCE_MARKETS
    ) {

        const result =
            getMarketSamples(
                targetMatch,
                targetDate,
                market
            );


        if (!result) {
            continue;
        }


        markets.push(
            result
        );


        /*
        Geçmiş eşleşmelerin
        MS sonucunu ortak havuza ekle.
        */

        for (
            const sample
            of result.samples
        ) {

            counts[
                sample.result
            ]++;
        }
    }


    const total =
        counts["1"] +
        counts["X"] +
        counts["2"];


    /*
    Hiçbir birebir oran
    eşleşmesi bulunamadı.
    */

    if (!total) {

        return {

            prediction: null,

            sample: 0,

            one: 0,

            x: 0,

            two: 0,

            counts,

            markets: []
        };
    }


    /*
    En çok çıkan sonucu bul.
    */

    let prediction = "1";


    if (
        counts["X"] >
        counts[prediction]
    ) {

        prediction = "X";
    }


    if (
        counts["2"] >
        counts[prediction]
    ) {

        prediction = "2";
    }


    /*
    Yüzdeler.
    */

    const one =
        counts["1"] /
        total *
        100;


    const x =
        counts["X"] /
        total *
        100;


    const two =
        counts["2"] /
        total *
        100;


    return {

        prediction,

        sample: total,

        one,

        x,

        two,

        counts,

        markets
    };
}


/* =========================================================
   SPOR TOTO MAÇINI MATCHES.JSON'DA BUL
========================================================= */

function findMackolikMatch(
    totoMatch
) {

    if (!totoMatch) {
        return null;
    }


    const home =
        getHome(totoMatch);

    const away =
        getAway(totoMatch);


    if (!home || !away) {
        return null;
    }


    /*
    Önce takım adına göre bul.
    */

    const candidates =
        matchesData.filter(
            match => {

                return (
                    sameTeam(
                        getHome(match),
                        home
                    ) &&

                    sameTeam(
                        getAway(match),
                        away
                    )
                );
            }
        );


    if (!candidates.length) {
        return null;
    }


    /*
    Tarih varsa aynı güne
    ait maçı tercih et.
    */

    const totoDate =
        parseDate(
            getDate(totoMatch)
        );


    if (totoDate) {

        const sameDay =
            candidates.find(
                match => {

                    const d =
                        parseDate(
                            getDate(match)
                        );

                    if (!d) {
                        return false;
                    }

                    return (
                        d.getFullYear() ===
                        totoDate.getFullYear() &&

                        d.getMonth() ===
                        totoDate.getMonth() &&

                        d.getDate() ===
                        totoDate.getDate()
                    );
                }
            );


        if (sameDay) {
            return sameDay;
        }
    }


    /*
    Aynı güne ait bulunamazsa
    en yakın/son kayıt.
    */

    return candidates[
        candidates.length - 1
    ];
}


/* =========================================================
   HAFTA LİSTESİ
========================================================= */

function renderWeekSelect() {

    if (!weekSelect) {
        return;
    }


    weekSelect.innerHTML = "";


    for (
        const week
        of totoWeeks
    ) {

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
    }


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
   ÖZET
========================================================= */

function renderSummary(
    predictions
) {

    let hit = 0;

    let miss = 0;

    let wait = 0;


    for (
        const p
        of predictions
    ) {

        if (
            !p.prediction
        ) {

            wait++;

            continue;
        }


        if (
            !p.result
        ) {

            wait++;

            continue;
        }


        if (
            p.prediction ===
            p.result
        ) {

            hit++;

        } else {

            miss++;
        }
    }


    const finished =
        hit + miss;


    const rate =
        finished
            ? hit / finished * 100
            : 0;


    if (!summary) {
        return;
    }


    summary.innerHTML = `

        <div class="summary">

            <div class="summary-title">

                ${esc(
                    selectedWeek
                )}

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


/* =========================================================
   MAÇ KARTI
========================================================= */

function renderMatch(
    match,
    prediction,
    index
) {

    const actual =
        match.result ||
        null;


    let status =
        "wait";

    let icon =
        "•";


    if (
        prediction.prediction &&
        actual
    ) {

        if (
            prediction.prediction ===
            actual
        ) {

            status =
                "hit";

            icon =
                "✓";

        } else {

            status =
                "miss";

            icon =
                "✕";
        }
    }


    /*
    Birebir eşleşen marketler.
    */

    const marketText =
        prediction.markets
            .map(
                market => {

                    return `
                        ${esc(
                            market.marketTitle
                        )}
                        ${esc(
                            market.targetOdd
                        )}
                        ·
                        ${market.samples.length}
                        eşleşme
                    `;
                }
            )
            .join(" • ");


    /*
    Marketlerin toplam
    örneklem sayısı.
    */

    const sampleCount =
        prediction.sample;


    return `

        <div class="match">

            <div class="match-row">

                <div class="number">

                    ${index + 1}

                </div>


                <div class="teams">

                    ${esc(
                        getHome(match)
                    )}

                    -

                    ${esc(
                        getAway(match)
                    )}

                </div>


                <div class="
                    prediction
                    ${
                        prediction.prediction
                            ? ""
                            : "empty"
                    }
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
                            ${esc(
                                match.score
                            )}

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

                            <b>
                                ${sampleCount}
                            </b>

                            geçmiş birebir
                            oran eşleşmesi

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

                    `

                    :

                    `

                        <div class="warning">

                            Bu maçın
                            <b>matches.json</b>
                            açılış oranlarında
                            son 60 gün içinde
                            birebir eşleşme
                            bulunamadı.

                        </div>

                    `
                }

            </div>

        </div>
    `;
}


/* =========================================================
   RENDER
========================================================= */

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

        /*
        Spor Toto maçının
        matches.json karşılığı.
        */

        const mackolikMatch =
            findMackolikMatch(
                totoMatch
            );


        /*
        Maç matches.json'da yoksa
        tahmin üretme.
        */

        if (!mackolikMatch) {

            predictions.push({

                prediction:
                    null,

                result:
                    totoMatch.result ||
                    null,

                sample: 0,

                one: 0,

                x: 0,

                two: 0,

                counts: {
                    "1": 0,
                    "X": 0,
                    "2": 0
                },

                markets: []
            });

            continue;
        }


        /*
        Çok önemli:

        Oranlar Spor Toto'dan değil,
        matches.json'daki maçtan
        alınır.

        Geçmiş tarih de
        matches.json maçının tarihidir.
        */

        const targetDate =
            getDate(
                mackolikMatch
            ) ||
            getDate(
                totoMatch
            );


        const prediction =
            calculatePrediction(
                mackolikMatch,
                targetDate
            );


        /*
        Gerçek Spor Toto sonucu.
        */

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

            <b>Spor Toto tahmin sistemi</b>

            <br><br>

            Maç ve açılış oranları
            <b>data/matches.json</b>
            içinden alınır.

            <br>

            Geçmiş dönem:
            <b>${HISTORY_DAYS} gün</b>

            <br>

            Oran eşleşmesi:
            <b>birebir</b>

            <br>

            Minimum örneklem:
            <b>yok</b>

            <br>

            Farklı örneklem marketlerinin
            geçmiş MS sonuçları
            <b>1 / X / 2</b>
            olarak birleştirilir.

            <br>

            En çok çıkan sonuç
            Spor Toto tahmini olarak
            gösterilir.

        </div>


        <div class="matches">

            ${
                weekMatches
                    .map(
                        (
                            match,
                            index
                        ) => {

                            return renderMatch(
                                match,
                                predictions[index],
                                index
                            );
                        }
                    )
                    .join("")
            }

        </div>
    `;
}


/* =========================================================
   VERİ YÜKLEME
========================================================= */

async function loadData() {

    /*
    matches.json
    */

    const matchesResponse =
        await fetch(
            MATCHES_URL +
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


    /*
    Hem:

    [
      ...
    ]

    hem de:

    {
      matches: [...]
    }

    desteklenir.
    */

    matchesData =
        Array.isArray(
            matchesJson
        )
            ? matchesJson
            : (
                matchesJson.matches ||
                []
            );


    /*
    Spor Toto verisi
    */

    const totoResponse =
        await fetch(
            TOTO_DATA_URL +
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


    /*
    Güncel hafta.
    */

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

        renderWeekSelect();

        await render();

    } catch (error) {

        console.error(
            "Spor Toto:",
            error
        );


        if (matchesBox) {

            matchesBox.innerHTML = `

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


/* =========================================================
   BAŞLAT
========================================================= */

init();
