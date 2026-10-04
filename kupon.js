"use strict";

/* =========================================================
   MACKOLIK KUPON SİSTEMİ
   =========================================================
   Kurallar:
   - Geçmiş tarihler dahil kupon üretir
   - Minimum toplam oran: 2.00
   - Maksimum 5 maç
   - 5 maç zorunlu değil
   - 3 kupon:
       1. Güvenli
       2. Orta Güvenli
       3. Risk Alınabilir
   - Minimum örneklem: 5
   - Minimum başarı: %70
   - İY 0.5 Üst kullanılmaz
   - Maç sonucu:
       ✓ Tuttu
       ✕ Tutmadı
       ● Bekliyor
   - Kupon sonucu:
       🟢 Kazandı
       🔴 Kaybetti
       🟡 Bekliyor
   ========================================================= */


/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;

const MIN_SAMPLE = 5;

const MIN_SUCCESS = 70;

const MIN_TOTAL_ODDS = 2.00;

const MAX_MATCHES = 5;

const MAX_COUPONS = 3;


/* =========================================================
   KUPON TİPLERİ
========================================================= */

const COUPON_TYPES = [
    {
        id: "safe",
        name: "Güvenli"
    },
    {
        id: "medium",
        name: "Orta Güvenli"
    },
    {
        id: "risky",
        name: "Risk Alınabilir"
    }
];


/* =========================================================
   GLOBAL
========================================================= */

let allMatches = [];

let selectedDate = new Date();

let calendarDate = new Date();


/* =========================================================
   DOM
========================================================= */

const calendar =
    document.getElementById("calendar");

const monthTitle =
    document.getElementById("monthTitle");

const selectedDateBox =
    document.getElementById("selectedDate");

const couponList =
    document.getElementById("couponList");

const statistics =
    document.getElementById("statistics");

const prevMonth =
    document.getElementById("prevMonth");

const nextMonth =
    document.getElementById("nextMonth");


/* =========================================================
   YARDIMCI
========================================================= */

function pad(n) {
    return String(n).padStart(2, "0");
}


function dateKey(date) {

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}


function addDays(date, days) {

    const d = new Date(date);

    d.setDate(
        d.getDate() + days
    );

    return d;
}


function isToday(date) {

    return (
        dateKey(date) ===
        dateKey(new Date())
    );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
            isNaN(
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


    let m =
        text.match(
            /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
        );


    if (m) {

        return new Date(
            Number(m[3]),
            Number(m[2]) - 1,
            Number(m[1])
        );
    }


    m =
        text.match(
            /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
        );


    if (m) {

        return new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3])
        );
    }


    const parsed =
        new Date(text);


    if (
        !isNaN(
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


/* =========================================================
   DEĞER OKUMA
========================================================= */

function getValue(obj, keys) {

    if (
        !obj ||
        typeof obj !== "object"
    ) {
        return undefined;
    }


    for (
        const key of keys
    ) {

        if (
            obj[key] !== undefined &&
            obj[key] !== null &&
            obj[key] !== ""
        ) {
            return obj[key];
        }
    }


    return undefined;
}


/* =========================================================
   MAÇ BİLGİLERİ
========================================================= */

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

    return getValue(match, [
        "home",
        "Home",
        "homeTeam",
        "home_team",
        "ev",
        "Ev",
        "evSahibi",
        "evSahibiTakim"
    ]) || "-";
}


function getAway(match) {

    return getValue(match, [
        "away",
        "Away",
        "awayTeam",
        "away_team",
        "deplasman",
        "Deplasman",
        "deplasmanTakim"
    ]) || "-";
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


function getLeague(match) {

    return getValue(match, [
        "league",
        "League",
        "lig",
        "Lig",
        "competition",
        "tournament"
    ]) || "";
}


/* =========================================================
   SKOR
========================================================= */

function parseScore(value) {

    if (!value) {
        return null;
    }


    if (
        typeof value ===
        "object"
    ) {

        const h =
            getValue(
                value,
                [
                    "home",
                    "Home",
                    "ev",
                    "h"
                ]
            );


        const a =
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
            h !== undefined &&
            a !== undefined
        ) {

            const home =
                Number(h);

            const away =
                Number(a);


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
    }


    const text =
        String(value).trim();


    const m =
        text.match(
            /(\d+)\s*[-:]\s*(\d+)/
        );


    if (!m) {
        return null;
    }


    return {
        home: Number(m[1]),
        away: Number(m[2])
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
                "MacSonucu",
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
   ORAN
========================================================= */

function normalizeOdd(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }


    const n =
        Number(
            String(value)
                .replace(",", ".")
                .trim()
        );


    if (
        !Number.isFinite(n) ||
        n <= 1
    ) {
        return null;
    }


    return n.toFixed(2);
}


function getOdds(match, keys) {

    const direct =
        getValue(
            match,
            keys
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
                keys
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
   MARKETLER
========================================================= */

const MARKETS = [

    {
        id: "MS1",

        title: "MS 1",

        odds: m =>
            getOdds(
                m,
                [
                    "ms1",
                    "MS1",
                    "1",
                    "MS_1"
                ]
            )
    },


    {
        id: "MSX",

        title: "MS X",

        odds: m =>
            getOdds(
                m,
                [
                    "msX",
                    "msx",
                    "MSX",
                    "ms0",
                    "MS0",
                    "X"
                ]
            )
    },


    {
        id: "MS2",

        title: "MS 2",

        odds: m =>
            getOdds(
                m,
                [
                    "ms2",
                    "MS2",
                    "2",
                    "MS_2"
                ]
            )
    },


    {
        id: "IY1",

        title: "İY 1",

        odds: m =>
            getOdds(
                m,
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

        odds: m =>
            getOdds(
                m,
                [
                    "iy2",
                    "IY2",
                    "İY2",
                    "iy_2"
                ]
            )
    },


    {
        id: "IY15U",

        title: "İY 1.5 Üst",

        odds: m =>
            getOdds(
                m,
                [
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
                    "iy15üst"
                ]
            )
    },


    {
        id: "IY15A",

        title: "İY 1.5 Alt",

        odds: m =>
            getOdds(
                m,
                [
                    "iy15A",
                    "IY15A",
                    "iy15a",
                    "iy1_5A",
                    "iy1_5Under",
                    "iy15Under",
                    "IY1.5A",
                    "İY1.5A",
                    "iy1.5alt",
                    "iy15alt",
                    "iy1.5alt"
                ]
            )
    },


    {
        id: "MS25U",

        title: "2.5 Üst",

        odds: m =>
            getOdds(
                m,
                [
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
                    "2.5üst",
                    "au25Ust",
                    "au25üst"
                ]
            )
    },


    {
        id: "MS15U",

        title: "1.5 Üst",

        odds: m =>
            getOdds(
                m,
                [
                    "ms15U",
                    "MS15U",
                    "ms15u",
                    "ms1_5U",
                    "ms1_5Over",
                    "ms15Over",
                    "1.5U",
                    "15U",
                    "15ust",
                    "15üst",
                    "au15Ust",
                    "au15üst"
                ]
            )
    },


    {
        id: "MS15A",

        title: "1.5 Alt",

        odds: m =>
            getOdds(
                m,
                [
                    "ms15A",
                    "MS15A",
                    "ms15a",
                    "ms1_5A",
                    "ms1_5Under",
                    "ms15Under",
                    "1.5A",
                    "15A",
                    "15alt",
                    "au15Alt"
                ]
            )
    },


    {
        id: "KG",

        title: "KG Var",

        odds: m =>
            getOdds(
                m,
                [
                    "kg",
                    "KG",
                    "kgVar",
                    "KGVar",
                    "kgvar",
                    "kg1",
                    "KG1"
                ]
            )
    },


    {
        id: "KGY",

        title: "KG Yok",

        odds: m =>
            getOdds(
                m,
                [
                    "kgy",
                    "KGY",
                    "kgYok",
                    "KGYok",
                    "kgyok",
                    "kg0",
                    "KG0"
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

    const full =
        getFullTimeScore(match);

    const half =
        getHalfTimeScore(match);


    /* MS 1 */

    if (
        marketId === "MS1"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.home >
            full.away
        );
    }


    /* MS X */

    if (
        marketId === "MSX"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.home ===
            full.away
        );
    }


    /* MS 2 */

    if (
        marketId === "MS2"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.away >
            full.home
        );
    }


    /* İY 1 */

    if (
        marketId === "IY1"
    ) {

        if (!half) {
            return null;
        }

        return (
            half.home >
            half.away
        );
    }


    /* İY 2 */

    if (
        marketId === "IY2"
    ) {

        if (!half) {
            return null;
        }

        return (
            half.away >
            half.home
        );
    }


    /* İY 1.5 ÜST */

    if (
        marketId === "IY15U"
    ) {

        if (!half) {
            return null;
        }

        return (
            half.home +
            half.away
        ) >= 2;
    }


    /* İY 1.5 ALT */

    if (
        marketId === "IY15A"
    ) {

        if (!half) {
            return null;
        }

        return (
            half.home +
            half.away
        ) < 2;
    }


    /* MS 2.5 ÜST */

    if (
        marketId === "MS25U"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.home +
            full.away
        ) >= 3;
    }


    /* MS 1.5 ÜST */

    if (
        marketId === "MS15U"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.home +
            full.away
        ) >= 2;
    }


    /* MS 1.5 ALT */

    if (
        marketId === "MS15A"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.home +
            full.away
        ) < 2;
    }


    /* KG VAR */

    if (
        marketId === "KG"
    ) {

        if (!full) {
            return null;
        }

        return (
            full.home > 0 &&
            full.away > 0
        );
    }


    /* KG YOK */

    if (
        marketId === "KGY"
    ) {

        if (!full) {
            return null;
        }

        return !(
            full.home > 0 &&
            full.away > 0
        );
    }


    return null;
}


/* =========================================================
   GEÇMİŞ MAÇLAR
========================================================= */

function getHistoryMatches(
    targetDate
) {

    const end =
        new Date(
            targetDate
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


    return allMatches.filter(
        match => {

            const d =
                parseDate(
                    getDate(match)
                );


            if (!d) {
                return false;
            }


            d.setHours(
                0,
                0,
                0,
                0
            );


            return (
                d >= start &&
                d < end &&
                isPlayed(match)
            );
        }
    );
}


/* =========================================================
   MARKET ANALİZİ
========================================================= */

function analyzeMarket(
    match,
    market,
    history
) {

    const currentOdd =
        market.odds(match);


    if (!currentOdd) {
        return null;
    }


    const historical =
        history.filter(
            item => {

                const odd =
                    market.odds(item);

                return (
                    odd &&
                    odd === currentOdd
                );
            }
        );


    if (
        historical.length <
        MIN_SAMPLE
    ) {
        return null;
    }


    let total = 0;

    let success = 0;


    for (
        const item
        of historical
    ) {

        const result =
            getMarketOutcome(
                item,
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

        marketTitle:
            market.title,

        odds:
            Number(
                currentOdd
            ),

        sample:
            total,

        success,

        percentage

    };
}


/* =========================================================
   MAÇ TAHMİNLERİ
========================================================= */

function getMatchPredictions(
    match,
    targetDate,
    history
) {

    const predictions = [];


    for (
        const market
        of MARKETS
    ) {

        const result =
            analyzeMarket(
                match,
                market,
                history
            );


        if (!result) {
            continue;
        }


        predictions.push(
            result
        );
    }


    predictions.sort(
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


            if (
                b.sample !==
                a.sample
            ) {

                return (
                    b.sample -
                    a.sample
                );
            }


            return (
                b.odds -
                a.odds
            );
        }
    );


    return predictions;
}


/* =========================================================
   MAÇ ANAHTARI
========================================================= */

function matchKey(match) {

    const d =
        parseDate(
            getDate(match)
        );


    return [

        d
            ? dateKey(d)
            : "",

        getTime(match),

        getHome(match),

        getAway(match)

    ]
        .join("|")
        .toLowerCase();
}


/* =========================================================
   GÜNÜN ADAYLARI
========================================================= */

function getCandidates(
    targetDate
) {

    const key =
        dateKey(
            targetDate
        );


    const history =
        getHistoryMatches(
            targetDate
        );


    const matches =
        allMatches.filter(
            match => {

                const d =
                    parseDate(
                        getDate(match)
                    );


                if (!d) {
                    return false;
                }


                return (
                    dateKey(d) ===
                    key
                );
            }
        );


    const candidates = [];


    for (
        const match
        of matches
    ) {

        /*
           Oynanmış maç kupona girmez.
        */

        if (
            isPlayed(match)
        ) {
            continue;
        }


        const predictions =
            getMatchPredictions(
                match,
                targetDate,
                history
            );


        /*
           Tahmini olmayan maç
           kupona girmez.
        */

        if (
            !predictions.length
        ) {
            continue;
        }


        const best =
            predictions[0];


        candidates.push({

            key:
                matchKey(match),

            match,

            prediction:
                best,

            allPredictions:
                predictions

        });
    }


    return candidates;
}


/* =========================================================
   KUPON SIRALAMA
========================================================= */

function sortCouponPool(
    pool,
    type
) {

    const copy =
        [...pool];


    /* ================================================
       GÜVENLİ
       Başarı yüzdesi öncelikli
    ================================================ */

    if (
        type === "safe"
    ) {

        copy.sort(
            (a, b) => {

                const pa =
                    a.prediction;

                const pb =
                    b.prediction;


                if (
                    pb.percentage !==
                    pa.percentage
                ) {

                    return (
                        pb.percentage -
                        pa.percentage
                    );
                }


                if (
                    pb.sample !==
                    pa.sample
                ) {

                    return (
                        pb.sample -
                        pa.sample
                    );
                }


                return (
                    pb.odds -
                    pa.odds
                );
            }
        );

        return copy;
    }


    /* ================================================
       ORTA GÜVENLİ
       Başarı + oran dengesi
    ================================================ */

    if (
        type === "medium"
    ) {

        copy.sort(
            (a, b) => {

                const pa =
                    a.prediction;

                const pb =
                    b.prediction;


                const scoreA =
                    (
                        pa.percentage *
                        0.70
                    ) +
                    (
                        Math.min(
                            pa.odds,
                            3
                        ) *
                        10
                    );


                const scoreB =
                    (
                        pb.percentage *
                        0.70
                    ) +
                    (
                        Math.min(
                            pb.odds,
                            3
                        ) *
                        10
                    );


                return (
                    scoreB -
                    scoreA
                );
            }
        );

        return copy;
    }


    /* ================================================
       RİSK ALINABİLİR
       Daha yüksek oran
    ================================================ */

    if (
        type === "risky"
    ) {

        copy.sort(
            (a, b) => {

                const pa =
                    a.prediction;

                const pb =
                    b.prediction;


                if (
                    pb.odds !==
                    pa.odds
                ) {

                    return (
                        pb.odds -
                        pa.odds
                    );
                }


                return (
                    pb.percentage -
                    pa.percentage
                );
            }
        );

        return copy;
    }


    return copy;
}


/* =========================================================
   EN AZ MAÇLA 2.00'YE ULAŞ
========================================================= */

function buildCoupon(
    pool,
    type,
    number,
    targetDate
) {

    const sorted =
        sortCouponPool(
            pool,
            type
        );


    if (!sorted.length) {
        return null;
    }


    /*
       Güvenli ve orta kuponda
       sıralı şekilde seçim yap.

       Risk kuponunda yüksek oranlı
       maçlar öne çıkar.
    */

    const selections = [];

    let totalOdds = 1;


    for (
        const candidate
        of sorted
    ) {

        if (
            selections.length >=
            MAX_MATCHES
        ) {
            break;
        }


        const p =
            candidate.prediction;


        const odd =
            Number(
                p.odds
            );


        if (
            !Number.isFinite(odd) ||
            odd <= 1
        ) {
            continue;
        }


        selections.push({

            key:
                candidate.key,

            home:
                getHome(
                    candidate.match
                ),

            away:
                getAway(
                    candidate.match
                ),

            time:
                getTime(
                    candidate.match
                ),

            league:
                getLeague(
                    candidate.match
                ),

            targetMarket:
                p.marketId,

            targetTitle:
                p.marketTitle,

            targetOdds:
                odd,

            sample:
                p.sample,

            success:
                p.success,

            percentage:
                p.percentage

        });


        totalOdds *= odd;


        /*
           2.00'ye ulaştığımız anda
           daha fazla maç ekleme.
        */

        if (
            totalOdds >=
            MIN_TOTAL_ODDS
        ) {
            break;
        }
    }


    /*
       5 maç sonunda bile
       2.00 olmadıysa kupon yok.
    */

    if (
        !selections.length ||
        totalOdds <
        MIN_TOTAL_ODDS
    ) {

        return null;
    }


    return {

        number,

        type:
            COUPON_TYPES.find(
                x =>
                    x.id === type
            )?.name ||
            type,

        typeId:
            type,

        date:
            dateKey(
                targetDate
            ),

        totalOdds:
            Number(
                totalOdds.toFixed(2)
            ),

        selections

    };
}


/* =========================================================
   3 KUPON OLUŞTUR
========================================================= */

function createCoupons(
    targetDate
) {

    const candidates =
        getCandidates(
            targetDate
        );


    if (
        !candidates.length
    ) {
        return [];
    }


    const coupons = [];


    /*
       Aynı maçı mümkün olduğunca
       üç kupon arasında dağıt.

       Ancak bir kupon oluşturulamazsa
       diğer kuponların adayları korunur.
    */

    const usedByType = new Set();


    for (
        const type
        of COUPON_TYPES
    ) {

        let pool =
            candidates.filter(
                candidate =>
                    !usedByType.has(
                        candidate.key
                    )
            );


        /*
           Yeterli farklı maç yoksa
           kullanılmamışların tamamını kullan.
        */

        if (
            pool.length === 0
        ) {

            pool =
                [...candidates];
        }


        const coupon =
            buildCoupon(
                pool,
                type.id,
                coupons.length + 1,
                targetDate
            );


        if (!coupon) {
            continue;
        }


        coupons.push(
            coupon
        );


        coupon.selections.forEach(
            selection => {

                usedByType.add(
                    selection.key
                );

            }
        );


        if (
            coupons.length >=
            MAX_COUPONS
        ) {
            break;
        }
    }


    return coupons;
}


/* =========================================================
   MAÇ SONUCU
========================================================= */

function selectionResult(
    selection
) {

    const match =
        allMatches.find(
            item =>
                matchKey(item) ===
                selection.key
        );


    if (!match) {
        return "pending";
    }


    const result =
        getMarketOutcome(
            match,
            selection.targetMarket
        );


    if (
        result === true
    ) {
        return "win";
    }


    if (
        result === false
    ) {
        return "loss";
    }


    return "pending";
}


/* =========================================================
   KUPON SONUCU
========================================================= */

function couponResult(
    coupon
) {

    if (
        !coupon ||
        !coupon.selections ||
        !coupon.selections.length
    ) {

        return "pending";
    }


    let pending = false;


    for (
        const selection
        of coupon.selections
    ) {

        const result =
            selectionResult(
                selection
            );


        /*
           Bir maç bile kaybettiyse
           kupon direkt kaybetti.
        */

        if (
            result === "loss"
        ) {

            return "loss";
        }


        if (
            result === "pending"
        ) {

            pending = true;
        }
    }


    if (pending) {
        return "pending";
    }


    return "win";
}


/* =========================================================
   KUPON DURUMU
========================================================= */

function getCouponStatusHtml(
    result
) {

    if (
        result === "win"
    ) {

        return `
            <span class="coupon-status win">
                🟢 Kazandı
            </span>
        `;
    }


    if (
        result === "loss"
    ) {

        return `
            <span class="coupon-status loss">
                🔴 Kaybetti
            </span>
        `;
    }


    return `
        <span class="coupon-status pending">
            🟡 Bekliyor
        </span>
    `;
}


/* =========================================================
   MAÇ DURUMU
========================================================= */

function getMatchStatusHtml(
    result
) {

    if (
        result === "win"
    ) {

        return `
            <span class="match-result win">
                ✓ Tuttu
            </span>
        `;
    }


    if (
        result === "loss"
    ) {

        return `
            <span class="match-result loss">
                ✕ Tutmadı
            </span>
        `;
    }


    return `
        <span class="match-result pending">
            ● Bekliyor
        </span>
    `;
}


/* =========================================================
   KUPONLARI GÖSTER
========================================================= */

function renderCoupons(
    coupons
) {

    if (!couponList) {
        return;
    }


    couponList.innerHTML = "";


    if (!coupons.length) {

        couponList.innerHTML = `

            <div class="empty">

                <strong>
                    Bu tarih için kupon oluşmadı.
                </strong>

                <br><br>

                Kupon şartları:

                <br>

                Minimum başarı:
                <strong>
                    %${MIN_SUCCESS}
                </strong>

                <br>

                Minimum örneklem:
                <strong>
                    ${MIN_SAMPLE}
                </strong>

                <br>

                Minimum toplam oran:
                <strong>
                    ${MIN_TOTAL_ODDS.toFixed(2)}
                </strong>

                <br>

                Maksimum maç:
                <strong>
                    ${MAX_MATCHES}
                </strong>

            </div>

        `;

        return;
    }


    coupons.forEach(
        coupon => {

            const couponResultValue =
                couponResult(
                    coupon
                );


            const couponStatus =
                getCouponStatusHtml(
                    couponResultValue
                );


            let html = `

                <article class="coupon">

                    <div class="coupon-header">

                        <div>

                            <div class="coupon-title">

                                ${escapeHtml(
                                    coupon.type
                                )}

                            </div>

                            <div class="coupon-subtitle">

                                ${coupon.selections.length}
                                maç

                                ·

                                Minimum oran
                                ${MIN_TOTAL_ODDS.toFixed(2)}

                            </div>

                        </div>

                        <div class="coupon-right">

                            ${couponStatus}

                            <span class="coupon-odds">

                                ${Number(
                                    coupon.totalOdds
                                ).toFixed(2)}

                            </span>

                        </div>

                    </div>

            `;


            coupon.selections.forEach(
                selection => {

                    const result =
                        selectionResult(
                            selection
                        );


                    const resultHtml =
                        getMatchStatusHtml(
                            result
                        );


                    html += `

                        <div class="coupon-match">

                            <div class="match-top">

                                <div class="teams">

                                    ${escapeHtml(
                                        selection.home
                                    )}

                                    <span>
                                        -
                                    </span>

                                    ${escapeHtml(
                                        selection.away
                                    )}

                                </div>

                                <span class="match-time">

                                    ${escapeHtml(
                                        selection.time
                                    )}

                                </span>

                            </div>


                            <div class="pick">

                                <span class="pick-name">

                                    ${escapeHtml(
                                        selection.targetTitle
                                    )}

                                </span>


                                <span class="pick-odd">

                                    ${Number(
                                        selection.targetOdds
                                    ).toFixed(2)}

                                </span>


                                <span class="sample">

                                    ${selection.sample}
                                    örneklem

                                    ·

                                    %${Number(
                                        selection.percentage
                                    ).toFixed(1)}

                                </span>


                                ${resultHtml}

                            </div>

                        </div>

                    `;

                }
            );


            html += `

                </article>

            `;


            couponList.insertAdjacentHTML(
                "beforeend",
                html
            );
        }
    );
}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

    if (
        !calendar ||
        !monthTitle
    ) {
        return;
    }


    const year =
        calendarDate.getFullYear();


    const month =
        calendarDate.getMonth();


    monthTitle.textContent =
        new Date(
            year,
            month,
            1
        ).toLocaleDateString(
            "tr-TR",
            {
                month: "long",
                year: "numeric"
            }
        );


    calendar.innerHTML = "";


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    let startDay =
        firstDay.getDay();


    startDay =
        startDay === 0
            ? 6
            : startDay - 1;


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    /*
       Boş günler
    */

    for (
        let i = 0;
        i < startDay;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "calendar-day empty";


        calendar.appendChild(
            empty
        );
    }


    /*
       Günler
    */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const date =
            new Date(
                year,
                month,
                day
            );


        const key =
            dateKey(date);


        const button =
            document.createElement(
                "button"
            );


        button.type =
            "button";


        button.className =
            "calendar-day";


        button.textContent =
            day;


        if (
            dateKey(
                selectedDate
            ) === key
        ) {

            button.classList.add(
                "selected"
            );
        }


        const hasMatches =
            allMatches.some(
                match => {

                    const d =
                        parseDate(
                            getDate(match)
                        );


                    return (
                        d &&
                        dateKey(d) ===
                        key
                    );
                }
            );


        if (hasMatches) {

            button.classList.add(
                "has-data"
            );
        }


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


                renderCalendar();

                renderSelectedDate();

            }
        );


        calendar.appendChild(
            button
        );
    }
}


/* =========================================================
   TARİH SEÇ
========================================================= */

function renderSelectedDate() {

    if (
        !selectedDateBox
    ) {
        return;
    }


    selectedDateBox.textContent =
        selectedDate.toLocaleDateString(
            "tr-TR",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );


    const coupons =
        getCouponsForDate(
            selectedDate
        );


    renderStatistics(
        coupons
    );


    renderCoupons(
        coupons
    );
}


/* =========================================================
   İSTATİSTİK
========================================================= */

function renderStatistics(
    selectedCoupons
) {

    if (!statistics) {
        return;
    }


    let total =
        0;

    let win =
        0;

    let loss =
        0;

    let pending =
        0;


    /*
       Mevcut günün kuponları
    */

    selectedCoupons.forEach(
        coupon => {

            total++;


            const result =
                couponResult(
                    coupon
                );


            if (
                result === "win"
            ) {

                win++;

            } else if (
                result === "loss"
            ) {

                loss++;

            } else {

                pending++;
            }

        }
    );


    const finished =
        win + loss;


    const successRate =
        finished > 0
            ? (
                win /
                finished
            ) * 100
            : 0;


    statistics.innerHTML = `

        <div class="stat">

            <span class="stat-label">
                KUPON
            </span>

            <strong class="stat-value">
                ${total}
            </strong>

        </div>


        <div class="stat">

            <span class="stat-label">
                KAZANAN
            </span>

            <strong class="stat-value green">
                ${win}
            </strong>

        </div>


        <div class="stat">

            <span class="stat-label">
                KAYBEDEN
            </span>

            <strong class="stat-value red">
                ${loss}
            </strong>

        </div>


        <div class="stat">

            <span class="stat-label">
                BAŞARI
            </span>

            <strong class="stat-value">
                %${successRate.toFixed(1)}
            </strong>

        </div>

    `;
}


/* =========================================================
   AY GERİ
========================================================= */

if (prevMonth) {

    prevMonth.addEventListener(
        "click",
        () => {

            calendarDate =
                new Date(
                    calendarDate
                );


            calendarDate.setDate(
                1
            );


            calendarDate.setMonth(
                calendarDate.getMonth() - 1
            );


            renderCalendar();
        }
    );
}


/* =========================================================
   AY İLERİ
========================================================= */

if (nextMonth) {

    nextMonth.addEventListener(
        "click",
        () => {

            calendarDate =
                new Date(
                    calendarDate
                );


            calendarDate.setDate(
                1
            );


            calendarDate.setMonth(
                calendarDate.getMonth() + 1
            );


            renderCalendar();
        }
    );
}


/* =========================================================
   VERİ YÜKLE
========================================================= */

async function loadData() {

    if (couponList) {

        couponList.innerHTML = `

            <div class="empty">

                Kupon verileri yükleniyor...

            </div>

        `;
    }


    try {

        const response =
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
            !response.ok
        ) {

            throw new Error(
                "Veri alınamadı: " +
                response.status
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
                "matches bulunamadı"
            );
        }


        /*
           Başlangıç:
           bugün
        */

        selectedDate =
            new Date();


        calendarDate =
            new Date();


        renderCalendar();

        renderSelectedDate();


    } catch (error) {

        console.error(
            "Kupon veri hatası:",
            error
        );


        if (couponList) {

            couponList.innerHTML = `

                <div class="empty">

                    Kupon verileri yüklenemedi.

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

loadData();


/* =========================================================
   CSS
   =========================================================
   kupon.html içinde CSS yoksa bu stiller
   otomatik olarak uygulanır.
========================================================= */

const couponStyle =
    document.createElement("style");


couponStyle.textContent = `

.coupon-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 9px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
}

.coupon-status.win {
    background: #dcfce7;
    color: #15803d;
}

.coupon-status.loss {
    background: #fee2e2;
    color: #dc2626;
}

.coupon-status.pending {
    background: #fef3c7;
    color: #b45309;
}

.match-result {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: 8px;
    font-weight: 700;
    font-size: 12px;
}

.match-result.win {
    color: #16a34a;
}

.match-result.loss {
    color: #dc2626;
}

.match-result.pending {
    color: #d97706;
}

.coupon-subtitle {
    font-size: 11px;
    opacity: .65;
    margin-top: 3px;
}

.coupon-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.stat-value.green {
    color: #16a34a;
}

.stat-value.red {
    color: #dc2626;
}

`;

document.head.appendChild(
    couponStyle
);
