"use strict";
/*
=========================================================
SPOR TOTO HESAPLAMA MOTORU
Mantık:
1. Spor Toto maçını Mackolik'te bul
2. Açılış oranlarını al
3. Son 60 güne bak
4. Oranı birebir eşleştir
5. Şu 5 marketi kullan:
   iy15Ust
   iy1
   iy2
   au15Alt
   au15Ust
6. En az 5 örnek
7. Geçmiş maçların MS sonucunu hesapla
8. Tüm geçerli marketleri ortak hesapla
9. Yüzdeleri oluştur
10. Tek / çift / üçlü sistem belirle
=========================================================
*/
const MACKOLIK_URL = "./data/matches.json";
const HISTORY_DAYS = 60;
const MINIMUM_SAMPLE = 5;
/* =========================================================
   GLOBAL
========================================================= */
let allMatches = [];
let totoMatches = [];
/* =========================================================
   GENEL YARDIMCILAR
========================================================= */
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
/* =========================================================
   TAKIM İSMİ
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
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}
function addDays(date, days) {
    const result = new Date(date);
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
function getMSResult(match) {
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
    const direct = getValue(
        match,
        names
    );
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
   KULLANILAN 5 MARKET
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
   SON 60 GÜN
========================================================= */
function getHistory(targetDate) {
    const end = parseDate(targetDate);
    if (!end) {
        return [];
    }
    const start = addDays(
        end,
        -HISTORY_DAYS
    );
    return allMatches.filter(match => {
        const date = parseDate(
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
            getMSResult(match) !== null
        );
    });
}
/* =========================================================
   AYNI MAÇ
========================================================= */
function sameMatch(a, b) {
    if (!a || !b) {
        return false;
    }
    const aHome = normalizeTeam(
        getHome(a)
    );
    const aAway = normalizeTeam(
        getAway(a)
    );
    const bHome = normalizeTeam(
        getHome(b)
    );
    const bAway = normalizeTeam(
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
   BİR MARKETİ HESAPLA
========================================================= */
function analyzeSource(
    targetMatch,
    targetDate,
    source
) {
    const targetOdd = source.odds(
        targetMatch
    );
    if (!targetOdd) {
        return null;
    }
    const history = getHistory(
        targetDate
    );
    const counts = {
        "1": 0,
        "X": 0,
        "2": 0
    };
    const samples = [];
    for (const historical of history) {
        /*
        Hedef maçın kendisini tekrar
        örnekleme sokma
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
            source.odds(
                historical
            );
        if (!historicalOdd) {
            continue;
        }
        /*
        ORAN TAM EŞLEŞMESİ
        Örneğin:
        1.72 = 1.72  -> eşleşir
        1.72 = 1.73  -> eşleşmez
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
            date: getValue(
                historical,
                [
                    "date",
                    "Date",
                    "tarih",
                    "Tarih"
                ]
            ),
            home: getHome(
                historical
            ),
            away: getAway(
                historical
            )
        });
    }
    const total =
        samples.length;
    /*
    Minimum 5 örnek şartı
    */
    if (
        total < MINIMUM_SAMPLE
    ) {
        return null;
    }
    /*
    En fazla çıkan sonuç
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
    return {
        source,
        targetOdd,
        samples,
        counts,
        total,
        bestResult,
        percentage
    };
}
/* =========================================================
   ANA HESAPLAMA
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
    /*
    5 marketin tamamını hesapla
    */
    const analyses =
        SOURCE_MARKETS
            .map(source =>
                analyzeSource(
                    targetMatch,
                    targetDate,
                    source
                )
            )
            .filter(Boolean);
    /*
    Hiçbir markette yeterli
    örnek yoksa tahmin yok
    */
    if (!analyses.length) {
        return {
            prediction: null,
            percentages: {
                "1": 0,
                "X": 0,
                "2": 0
            },
            analyses: [],
            totalSamples: 0,
            validMarkets: 0
        };
    }
    /*
    =====================================================
    TÜM MARKETLERİN ORTAK SONUCUNU HESAPLA
    Ağırlık:
        sqrt(örnek sayısı)
    Örneğin:
        Market A = 5 örnek
        ağırlık = sqrt(5)
        Market B = 16 örnek
        ağırlık = sqrt(16) = 4
    =====================================================
    */
    const totals = {
        "1": 0,
        "X": 0,
        "2": 0
    };
    let totalWeight = 0;
    for (
        const analysis
        of analyses
    ) {
        const weight =
            Math.sqrt(
                analysis.total
            );
        totalWeight += weight;
        /*
        Marketin kendi dağılımı
        */
        totals["1"] +=
            (
                analysis.counts["1"] /
                analysis.total
            ) * weight;
        totals["X"] +=
            (
                analysis.counts["X"] /
                analysis.total
            ) * weight;
        totals["2"] +=
            (
                analysis.counts["2"] /
                analysis.total
            ) * weight;
    }
    /*
    =====================================================
    YÜZDEYE ÇEVİR
    =====================================================
    */
    const percentages = {
        "1":
            totalWeight
                ? totals["1"] /
                  totalWeight *
                  100
                : 0,
        "X":
            totalWeight
                ? totals["X"] /
                  totalWeight *
                  100
                : 0,
        "2":
            totalWeight
                ? totals["2"] /
                  totalWeight *
                  100
                : 0
    };
    /*
    =====================================================
    EN YÜKSEK SONUCU BUL
    =====================================================
    */
    const sorted = [
        {
            result: "1",
            percentage:
                percentages["1"]
        },
        {
            result: "X",
            percentage:
                percentages["X"]
        },
        {
            result: "2",
            percentage:
                percentages["2"]
        }
    ].sort(
        (a, b) =>
            b.percentage -
            a.percentage
    );
    const first = sorted[0];
    const second = sorted[1];
    /*
    =====================================================
    SİSTEM HESABI
    =====================================================
    TEK:
    en yüksek >= %50
    ve fark >= 15
    ÇİFT:
    en yüksek >= %40
    ve fark >= 7
    DİĞER:
    1X2
    =====================================================
    */
    let system = "1X2";
    let prediction = "1X2";
    const gap =
        first.percentage -
        second.percentage;
    /*
    TEK
    */
    if (
        first.percentage >= 50 &&
        gap >= 15
    ) {
        system =
            first.result;
        prediction =
            first.result;
    }
    /*
    ÇİFT
    */
    else if (
        first.percentage >= 40 &&
        gap >= 7
    ) {
        const double =
            [first.result, second.result]
                .sort()
                .join("");
        system = double;
        prediction = double;
    }
    /*
    ÜÇLÜ
    */
    else {
        system = "1X2";
        prediction = "1X2";
    }
    return {
        prediction,
        system,
        percentages,
        analyses,
        totalSamples:
            analyses.reduce(
                (sum, item) =>
                    sum + item.total,
                0
            ),
        validMarkets:
            analyses.length,
        gap,
        strongest: first
    };
}
/* =========================================================
   MACKOLIK'TE SPOR TOTO MAÇINI BUL
========================================================= */
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
    return candidates[
        candidates.length - 1
    ];
}
/* =========================================================
   VERİLERİ YÜKLE
========================================================= */
async function loadData() {
    /*
    Mackolik verisi
    */
    const response =
        await fetch(
            MACKOLIK_URL
        );
    if (!response.ok) {
        throw new Error(
            "Mackolik verisi yüklenemedi."
        );
    }
    const data =
        await response.json();
    /*
    matches.json yapısı:
    {
        matches: [...]
    }
    */
    allMatches =
        Array.isArray(data)
            ? data
            : data.matches || [];
    /*
    Spor Toto verisi
    */
    if (
        !window.SPORT_TOTO_DATA
    ) {
        throw new Error(
            "Spor Toto verisi bulunamadı."
        );
    }
    const weeks =
        window.SPORT_TOTO_DATA.weeks;
    /*
    Güncel haftayı al
    */
    const currentWeek =
        String(
            window.SPORT_TOTO_DATA.currentWeek
        );
    totoMatches =
        weeks[currentWeek] || [];
    return {
        allMatches,
        totoMatches
    };
}
/* =========================================================
   TEST
========================================================= */
async function start() {
    try {
        await loadData();
        console.log(
            "Mackolik maç sayısı:",
            allMatches.length
        );
        console.log(
            "Spor Toto maç sayısı:",
            totoMatches.length
        );
        /*
        Her Spor Toto maçını hesapla
        */
        totoMatches.forEach(
            (totoMatch, index) => {
                const mackolikMatch =
                    findMatch(
                        totoMatch
                    );
                if (!mackolikMatch) {
                    console.log(
                        index + 1,
                        totoMatch.home,
                        "-",
                        totoMatch.away,
                        "→ Mackolik maçı bulunamadı"
                    );
                    return;
                }
                const prediction =
                    calculatePrediction(
                        mackolikMatch
                    );
                console.log(
                    index + 1,
                    totoMatch.home,
                    "-",
                    totoMatch.away
                );
                console.log(
                    "Oranlar:",
                    mackolikMatch.openingOdds
                );
                console.log(
                    "Tahmin:",
                    prediction
                );
            }
        );
    } catch (error) {
        console.error(
            error
        );
    }
}
start();
