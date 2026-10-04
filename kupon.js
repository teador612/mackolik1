/* =========================================================
   MACKOLIK - KUPON SİSTEMİ
   3 Kupon:
   1. Güvenli
   2. Orta Güvenli
   3. Risk Alınabilir

   Özellikler:
   - Tarihe göre kupon üretir
   - Bugün ve geçmiş tarihler çalışır
   - Minimum toplam oran: 2.00
   - Maksimum maç: 5
   - Daha az maç olabilir
   - Minimum örneklem: 5
   - Minimum başarı: %70
   - Açılış oranlarını kullanır
   - Exact odds matching
   - İY 0.5 Üst kullanılmaz
   - Kazanan: yeşil tik
   - Kaybeden: kırmızı X
   - Bekleyen: sarı saat
   ========================================================= */

(() => {
    "use strict";

    const DATA_URL = "./data/matches.json";

    const HISTORY_DAYS = 60;
    const MIN_SAMPLE = 5;
    const MIN_SUCCESS = 70;

    const MIN_TOTAL_ODDS = 2.00;
    const MAX_MATCHES = 5;

    const MARKET_NAMES = {
        MS1: "MS 1",
        MSX: "MS X",
        MS2: "MS 2",

        IY1: "İY 1",
        IY2: "İY 2",

        IY15U: "İY 1.5 Üst",
        IY15A: "İY 1.5 Alt",

        MS25U: "2.5 Üst",

        MS15U: "1.5 Üst",
        MS15A: "1.5 Alt",

        KG: "KG Var",
        KGY: "KG Yok"
    };

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

    let ALL_MATCHES = [];
    let DATA_LOADED = false;

    /* =========================================================
       GENEL YARDIMCILAR
       ========================================================= */

    function normalize(value) {
        return String(value ?? "")
            .toLocaleLowerCase("tr-TR")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ı/g, "i")
            .replace(/ç/g, "c")
            .replace(/ş/g, "s")
            .replace(/ğ/g, "g")
            .replace(/ü/g, "u")
            .replace(/ö/g, "o")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function numberValue(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        let text = String(value)
            .replace(",", ".")
            .replace(/[^\d.-]/g, "");

        const n = Number(text);

        return Number.isFinite(n) ? n : null;
    }

    function parseDate(value) {
        if (!value) return null;

        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : new Date(
                value.getFullYear(),
                value.getMonth(),
                value.getDate()
            );
        }

        const text = String(value).trim();

        // DD.MM.YYYY
        let m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

        if (m) {
            const d = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const y = Number(m[3]);

            const date = new Date(y, mo, d);

            if (!isNaN(date.getTime())) {
                return new Date(y, mo, d);
            }
        }

        // YYYY-MM-DD
        m = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);

        if (m) {
            const y = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const d = Number(m[3]);

            const date = new Date(y, mo, d);

            if (!isNaN(date.getTime())) {
                return new Date(y, mo, d);
            }
        }

        const parsed = new Date(text);

        if (!isNaN(parsed.getTime())) {
            return new Date(
                parsed.getFullYear(),
                parsed.getMonth(),
                parsed.getDate()
            );
        }

        return null;
    }

    function dateKey(value) {
        const d = parseDate(value);

        if (!d) return "";

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");

        return `${y}-${m}-${day}`;
    }

    function formatDate(value) {
        const d = parseDate(value);

        if (!d) return "-";

        return `${String(d.getDate()).padStart(2, "0")}.${String(
            d.getMonth() + 1
        ).padStart(2, "0")}.${d.getFullYear()}`;
    }

    function dateDiffDays(a, b) {
        const da = parseDate(a);
        const db = parseDate(b);

        if (!da || !db) return 99999;

        return Math.round(
            Math.abs(da.getTime() - db.getTime()) /
            86400000
        );
    }

    function isDateBefore(a, b) {
        const da = parseDate(a);
        const db = parseDate(b);

        if (!da || !db) return false;

        return da.getTime() < db.getTime();
    }

    function todayKey() {
        return dateKey(new Date());
    }

    /* =========================================================
       TAKIM / MAÇ BİLGİSİ
       ========================================================= */

    function getHomeTeam(match) {
        return (
            match.homeTeam ||
            match.home ||
            match.home_name ||
            match.team1 ||
            match.teamHome ||
            match.ev ||
            match.evSahibi ||
            match.ev_sahibi ||
            "-"
        );
    }

    function getAwayTeam(match) {
        return (
            match.awayTeam ||
            match.away ||
            match.away_name ||
            match.team2 ||
            match.teamAway ||
            match.dep ||
            match.deplasman ||
            match.deplasmanTakim ||
            "-"
        );
    }

    function getLeague(match) {
        return (
            match.league ||
            match.leagueName ||
            match.lig ||
            match.competition ||
            match.tournament ||
            ""
        );
    }

    function getMatchDate(match) {
        return (
            match.date ||
            match.matchDate ||
            match.gameDate ||
            match.tarih ||
            match.startDate ||
            match.kickoff ||
            ""
        );
    }

    function getMatchTime(match) {
        return (
            match.time ||
            match.matchTime ||
            match.hour ||
            match.saat ||
            match.kickoffTime ||
            ""
        );
    }

    function getMatchId(match) {
        return (
            match.id ||
            match.matchId ||
            match.code ||
            match.fixtureId ||
            `${getHomeTeam(match)}-${getAwayTeam(match)}-${getMatchDate(match)}`
        );
    }

    /* =========================================================
       SKOR OKUMA
       ========================================================= */

    function parseScore(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (typeof value === "object") {
            const home =
                value.home ??
                value.homeScore ??
                value.home_score ??
                value.h ??
                value.ev;

            const away =
                value.away ??
                value.awayScore ??
                value.away_score ??
                value.a ??
                value.dep;

            const h = numberValue(home);
            const a = numberValue(away);

            if (h !== null && a !== null) {
                return {
                    home: h,
                    away: a
                };
            }
        }

        const text = String(value);

        const m = text.match(/(\d+)\s*[-:]\s*(\d+)/);

        if (m) {
            return {
                home: Number(m[1]),
                away: Number(m[2])
            };
        }

        return null;
    }

    function getFullTimeScore(match) {
        const values = [
            match.score,
            match.fullTimeScore,
            match.full_time_score,
            match.ftScore,
            match.ft_score,
            match.result,
            match.skor,
            match.msScore,
            match.finalScore,
            match.fulltime
        ];

        for (const value of values) {
            const score = parseScore(value);

            if (score) return score;
        }

        return null;
    }

    function getHalfTimeScore(match) {
        const values = [
            match.halfTimeScore,
            match.half_time_score,
            match.htScore,
            match.ht_score,
            match.halfscore,
            match.iyScore,
            match.iy_skor,
            match.firstHalfScore
        ];

        for (const value of values) {
            const score = parseScore(value);

            if (score) return score;
        }

        return null;
    }

    function isFinished(match) {
        const status = normalize(
            match.status ||
            match.state ||
            match.matchStatus ||
            ""
        );

        if (
            status.includes("finished") ||
            status.includes("finished") ||
            status.includes("ended") ||
            status.includes("played") ||
            status.includes("tamam") ||
            status === "ft"
        ) {
            return true;
        }

        if (
            status.includes("not started") ||
            status.includes("not_started") ||
            status.includes("scheduled") ||
            status.includes("upcoming") ||
            status.includes("bekliyor") ||
            status.includes("baslamadi")
        ) {
            return false;
        }

        return !!getFullTimeScore(match);
    }

    /* =========================================================
       ORANLAR
       ========================================================= */

    function getOddsContainers(match) {
        const containers = [match];

        const possible = [
            match.openingOdds,
            match.opening_odds,
            match.opening,
            match.odds,
            match.Odds,
            match.oranlar,
            match.Oranlar,
            match.openingMarkets,
            match.markets
        ];

        for (const item of possible) {
            if (item && typeof item === "object") {
                containers.push(item);
            }
        }

        return containers;
    }

    function getOdd(match, market) {
        const aliases = {
            MS1: [
                "ms1",
                "MS1",
                "ms_1",
                "1"
            ],

            MSX: [
                "msX",
                "msx",
                "MSX",
                "ms_x",
                "X"
            ],

            MS2: [
                "ms2",
                "MS2",
                "ms_2",
                "2"
            ],

            IY1: [
                "iy1",
                "IY1",
                "iy_1"
            ],

            IY2: [
                "iy2",
                "IY2",
                "iy_2"
            ],

            IY15U: [
                "iy15Ust",
                "iy15ust",
                "iy15U",
                "iy15u",
                "IY15Ust",
                "iy1_5_ust"
            ],

            IY15A: [
                "iy15Alt",
                "iy15alt",
                "iy15A",
                "iy15a",
                "IY15Alt",
                "iy1_5_alt"
            ],

            MS25U: [
                "au25Ust",
                "au25ust",
                "au25U",
                "au25u",
                "MS25U",
                "ms25u",
                "2_5_ust"
            ],

            MS15U: [
                "au15Ust",
                "au15ust",
                "au15U",
                "au15u",
                "MS15U",
                "ms15u",
                "1_5_ust"
            ],

            MS15A: [
                "au15Alt",
                "au15alt",
                "au15A",
                "au15a",
                "MS15A",
                "ms15a",
                "1_5_alt"
            ],

            KG: [
                "kgVar",
                "kgvar",
                "KGVar",
                "kg",
                "KG"
            ],

            KGY: [
                "kgYok",
                "kgyok",
                "KGYok",
                "kgy",
                "KGY"
            ]
        };

        const keys = aliases[market] || [];

        for (const container of getOddsContainers(match)) {
            for (const key of keys) {
                if (
                    Object.prototype.hasOwnProperty.call(
                        container,
                        key
                    )
                ) {
                    const value = numberValue(container[key]);

                    if (
                        value !== null &&
                        value > 1 &&
                        value < 100
                    ) {
                        return value;
                    }
                }
            }
        }

        return null;
    }

    /* =========================================================
       MARKET SONUÇLARI
       ========================================================= */

    function marketWon(match, market) {
        const ft = getFullTimeScore(match);
        const ht = getHalfTimeScore(match);

        if (market === "MS1") {
            if (!ft) return null;
            return ft.home > ft.away;
        }

        if (market === "MSX") {
            if (!ft) return null;
            return ft.home === ft.away;
        }

        if (market === "MS2") {
            if (!ft) return null;
            return ft.away > ft.home;
        }

        if (market === "IY1") {
            if (!ht) return null;
            return ht.home > ht.away;
        }

        if (market === "IY2") {
            if (!ht) return null;
            return ht.away > ht.home;
        }

        if (market === "IY15U") {
            if (!ht) return null;
            return ht.home + ht.away >= 2;
        }

        if (market === "IY15A") {
            if (!ht) return null;
            return ht.home + ht.away < 2;
        }

        if (market === "MS25U") {
            if (!ft) return null;
            return ft.home + ft.away >= 3;
        }

        if (market === "MS15U") {
            if (!ft) return null;
            return ft.home + ft.away >= 2;
        }

        if (market === "MS15A") {
            if (!ft) return null;
            return ft.home + ft.away < 2;
        }

        if (market === "KG") {
            if (!ft) return null;
            return ft.home > 0 && ft.away > 0;
        }

        if (market === "KGY") {
            if (!ft) return null;
            return !(ft.home > 0 && ft.away > 0);
        }

        return null;
    }

    /* =========================================================
       TARİHSEL ANALİZ
       ========================================================= */

    function getHistoricalMatches(targetDate) {
        const result = [];

        for (const match of ALL_MATCHES) {
            const d = getMatchDate(match);

            if (!d) continue;

            if (!isDateBefore(d, targetDate)) {
                continue;
            }

            const diff = dateDiffDays(d, targetDate);

            if (diff > HISTORY_DAYS) {
                continue;
            }

            if (!isFinished(match)) {
                continue;
            }

            result.push(match);
        }

        return result;
    }

    function analyzeMarket(targetMatch, market, targetDate) {
        const odd = getOdd(targetMatch, market);

        if (odd === null) {
            return null;
        }

        const history = getHistoricalMatches(targetDate);

        let sample = 0;
        let wins = 0;

        for (const historicalMatch of history) {
            const historicalOdd = getOdd(
                historicalMatch,
                market
            );

            if (historicalOdd === null) {
                continue;
            }

            /*
             * EXACT ODDS
             * Tolerans kullanılmıyor.
             */
            if (historicalOdd !== odd) {
                continue;
            }

            const result = marketWon(
                historicalMatch,
                market
            );

            if (result === null) {
                continue;
            }

            sample++;

            if (result === true) {
                wins++;
            }
        }

        if (sample < MIN_SAMPLE) {
            return null;
        }

        const percentage =
            sample > 0
                ? (wins / sample) * 100
                : 0;

        if (percentage < MIN_SUCCESS) {
            return null;
        }

        return {
            market,
            marketName: MARKET_NAMES[market] || market,
            odd,
            sample,
            wins,
            percentage
        };
    }

    /* =========================================================
       MAÇ İÇİN TAHMİNLER
       ========================================================= */

    function getPredictions(match, targetDate) {
        const markets = [
            "MS1",
            "MSX",
            "MS2",

            "IY1",
            "IY2",

            "IY15U",
            "IY15A",

            "MS25U",

            "MS15U",
            "MS15A",

            "KG",
            "KGY"
        ];

        const predictions = [];

        for (const market of markets) {
            const result = analyzeMarket(
                match,
                market,
                targetDate
            );

            if (result) {
                predictions.push(result);
            }
        }

        return predictions;
    }

    /* =========================================================
       MAÇIN GÖSTERİM SONUCU
       ========================================================= */

    function getPredictionResult(match, prediction) {
        const result = marketWon(
            match,
            prediction.market
        );

        if (result === true) {
            return "won";
        }

        if (result === false) {
            return "lost";
        }

        return "pending";
    }

    /* =========================================================
       HEDEF TARİH MAÇLARI
       ========================================================= */

    function getMatchesForDate(targetDate) {
        const key = dateKey(targetDate);

        return ALL_MATCHES.filter(match => {
            return dateKey(getMatchDate(match)) === key;
        });
    }

    function getCandidates(targetDate) {
        const matches = getMatchesForDate(targetDate);

        const candidates = [];

        for (const match of matches) {
            const predictions = getPredictions(
                match,
                targetDate
            );

            if (!predictions.length) {
                continue;
            }

            candidates.push({
                match,
                predictions
            });
        }

        return candidates;
    }

    /* =========================================================
       EN İYİ TAHMİNİ SEÇ
       ========================================================= */

    function bestPrediction(predictions, type) {
        if (!predictions.length) {
            return null;
        }

        const sorted = [...predictions];

        if (type === "safe") {
            sorted.sort((a, b) => {
                if (b.percentage !== a.percentage) {
                    return b.percentage - a.percentage;
                }

                if (b.sample !== a.sample) {
                    return b.sample - a.sample;
                }

                return a.odd - b.odd;
            });
        }

        if (type === "medium") {
            sorted.sort((a, b) => {
                const scoreA =
                    a.percentage * 0.70 +
                    Math.min(a.odd, 3) * 10;

                const scoreB =
                    b.percentage * 0.70 +
                    Math.min(b.odd, 3) * 10;

                return scoreB - scoreA;
            });
        }

        if (type === "risky") {
            sorted.sort((a, b) => {
                if (b.odd !== a.odd) {
                    return b.odd - a.odd;
                }

                return b.percentage - a.percentage;
            });
        }

        return sorted[0];
    }

    /* =========================================================
       KUPON ADAYLARI
       ========================================================= */

    function makeCandidateList(candidates, type) {
        const list = [];

        for (const candidate of candidates) {
            const prediction = bestPrediction(
                candidate.predictions,
                type
            );

            if (!prediction) {
                continue;
            }

            list.push({
                match: candidate.match,
                prediction
            });
        }

        return list;
    }

    /* =========================================================
       KUPON OLUŞTUR
       ========================================================= */

    function buildCoupon(candidates, type) {
        const pool = [...candidates];

        if (!pool.length) {
            return null;
        }

        const selected = [];
        let totalOdds = 1;

        /*
         * Öncelik:
         * - önce daha güçlü tahminleri al
         * - toplam oran 2.00'a ulaşana kadar devam et
         * - maksimum 5 maç
         */

        for (const candidate of pool) {
            if (selected.length >= MAX_MATCHES) {
                break;
            }

            selected.push(candidate);

            totalOdds *= candidate.prediction.odd;

            if (totalOdds >= MIN_TOTAL_ODDS) {
                break;
            }
        }

        /*
         * 5 maça rağmen 2.00 olmadıysa kupon oluşturma.
         */
        if (
            totalOdds < MIN_TOTAL_ODDS ||
            selected.length === 0
        ) {
            return null;
        }

        return {
            type,
            matches: selected,
            totalOdds
        };
    }

    /* =========================================================
       3 KUPON
       ========================================================= */

    function createCoupons(targetDate) {
        const candidates = getCandidates(targetDate);

        if (!candidates.length) {
            return [];
        }

        const coupons = [];

        /*
         * Önce her tip için adayları ayrı sıralıyoruz.
         */

        for (const type of COUPON_TYPES) {
            const list = makeCandidateList(
                candidates,
                type.id
            );

            const coupon = buildCoupon(
                list,
                type
            );

            if (coupon) {
                coupons.push({
                    ...coupon,
                    name: type.name
                });
            }
        }

        /*
         * Eğer ilk aşamada 3 kupon oluşmadıysa,
         * kalan adaylarla tekrar dene.
         */

        if (coupons.length < 3) {
            for (const type of COUPON_TYPES) {
                if (
                    coupons.some(
                        c => c.type === type.id
                    )
                ) {
                    continue;
                }

                const list = makeCandidateList(
                    candidates,
                    type.id
                );

                /*
                 * Daha fazla seçenek için oranı yüksek
                 * adayları da dene.
                 */

                list.sort((a, b) => {
                    return (
                        b.prediction.odd -
                        a.prediction.odd
                    );
                });

                const coupon = buildCoupon(
                    list,
                    type.id
                );

                if (coupon) {
                    coupons.push({
                        ...coupon,
                        name: type.name
                    });
                }
            }
        }

        return coupons.slice(0, 3);
    }

    /* =========================================================
       HTML YARDIMCILARI
       ========================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function resultIcon(status) {
        if (status === "won") {
            return `<span class="match-result won">✓</span>`;
        }

        if (status === "lost") {
            return `<span class="match-result lost">✕</span>`;
        }

        return `<span class="match-result pending">●</span>`;
    }

    function couponStatus(coupon) {
        let hasPending = false;
        let hasLost = false;

        for (const item of coupon.matches) {
            const status = getPredictionResult(
                item.match,
                item.prediction
            );

            if (status === "lost") {
                hasLost = true;
            }

            if (status === "pending") {
                hasPending = true;
            }
        }

        if (hasLost) {
            return {
                text: "Kaybetti",
                className: "lost"
            };
        }

        if (hasPending) {
            return {
                text: "Bekliyor",
                className: "pending"
            };
        }

        return {
            text: "Kazandı",
            className: "won"
        };
    }

    /* =========================================================
       KUPON HTML
       ========================================================= */

    function couponHTML(coupon, index) {
        const status = couponStatus(coupon);

        let html = `
            <div class="coupon-card">

                <div class="coupon-header">

                    <div>
                        <div class="coupon-title">
                            ${escapeHTML(coupon.name)}
                        </div>

                        <div class="coupon-subtitle">
                            ${coupon.matches.length} maç
                        </div>
                    </div>

                    <div class="coupon-status ${status.className}">
                        ${status.text}
                    </div>

                </div>

                <div class="coupon-total">
                    Toplam Oran:
                    <strong>${coupon.totalOdds.toFixed(2)}</strong>
                </div>

                <div class="coupon-matches">
        `;

        coupon.matches.forEach(item => {
            const match = item.match;
            const prediction = item.prediction;

            const result = getPredictionResult(
                match,
                prediction
            );

            const score = getFullTimeScore(match);

            let scoreText = "";

            if (score) {
                scoreText =
                    `${score.home}-${score.away}`;
            }

            html += `
                <div class="coupon-match">

                    <div class="match-main">

                        <div class="match-teams">

                            <div class="match-date">
                                ${escapeHTML(
                                    formatDate(
                                        getMatchDate(match)
                                    )
                                )}
                                ${getMatchTime(match)
                                    ? " • " +
                                      escapeHTML(
                                          getMatchTime(match)
                                      )
                                    : ""}
                            </div>

                            <div class="teams">
                                <span>
                                    ${escapeHTML(
                                        getHomeTeam(match)
                                    )}
                                </span>

                                <span class="vs">
                                    -
                                </span>

                                <span>
                                    ${escapeHTML(
                                        getAwayTeam(match)
                                    )}
                                </span>
                            </div>

                            ${
                                scoreText
                                    ? `<div class="match-score">
                                         ${scoreText}
                                       </div>`
                                    : ""
                            }

                        </div>

                        <div class="prediction">

                            <div class="prediction-name">
                                ${escapeHTML(
                                    prediction.marketName
                                )}
                            </div>

                            <div class="prediction-info">
                                <strong>
                                    ${prediction.odd.toFixed(2)}
                                </strong>

                                <span>
                                    %${prediction.percentage.toFixed(0)}
                                </span>

                                <span>
                                    N=${prediction.sample}
                                </span>
                            </div>

                        </div>

                        <div class="result">
                            ${resultIcon(result)}
                        </div>

                    </div>

                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /* =========================================================
       CSS
       ========================================================= */

    function injectCSS() {
        if (document.getElementById("kupon-system-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "kupon-system-style";

        style.textContent = `
            .coupon-card {
                background: #fff;
                border-radius: 14px;
                margin: 14px 0;
                overflow: hidden;
                border: 1px solid #e5e7eb;
                box-shadow: 0 4px 15px rgba(0,0,0,.06);
            }

            .coupon-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                padding: 16px;
                border-bottom: 1px solid #eee;
            }

            .coupon-title {
                font-size: 18px;
                font-weight: 800;
            }

            .coupon-subtitle {
                font-size: 12px;
                color: #777;
                margin-top: 3px;
            }

            .coupon-status {
                padding: 6px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 700;
                white-space: nowrap;
            }

            .coupon-status.won {
                background: #dcfce7;
                color: #15803d;
            }

            .coupon-status.lost {
                background: #fee2e2;
                color: #dc2626;
            }

            .coupon-status.pending {
                background: #fef3c7;
                color: #b45309;
            }

            .coupon-total {
                padding: 10px 16px;
                background: #f8fafc;
                font-size: 14px;
            }

            .coupon-total strong {
                font-size: 17px;
                margin-left: 5px;
            }

            .coupon-match {
                padding: 13px 16px;
                border-bottom: 1px solid #f0f0f0;
            }

            .coupon-match:last-child {
                border-bottom: 0;
            }

            .match-main {
                display: grid;
                grid-template-columns: 1fr auto auto;
                align-items: center;
                gap: 12px;
            }

            .match-date {
                font-size: 11px;
                color: #888;
                margin-bottom: 4px;
            }

            .teams {
                font-weight: 700;
                font-size: 14px;
            }

            .teams .vs {
                color: #999;
                margin: 0 5px;
            }

            .match-score {
                margin-top: 4px;
                font-size: 12px;
                font-weight: 700;
            }

            .prediction {
                text-align: right;
            }

            .prediction-name {
                font-weight: 700;
                font-size: 13px;
            }

            .prediction-info {
                margin-top: 4px;
                display: flex;
                gap: 7px;
                justify-content: flex-end;
                font-size: 11px;
                color: #777;
            }

            .prediction-info strong {
                color: #111;
                font-size: 13px;
            }

            .result {
                min-width: 28px;
                text-align: center;
            }

            .match-result {
                display: inline-flex;
                width: 27px;
                height: 27px;
                border-radius: 50%;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 16px;
            }

            .match-result.won {
                background: #dcfce7;
                color: #16a34a;
            }

            .match-result.lost {
                background: #fee2e2;
                color: #dc2626;
            }

            .match-result.pending {
                background: #fef3c7;
                color: #d97706;
                font-size: 10px;
            }

            .coupon-empty {
                text-align: center;
                padding: 30px 15px;
                color: #777;
            }

            .coupon-error {
                background: #fee2e2;
                color: #991b1b;
                padding: 14px;
                border-radius: 10px;
                margin: 10px 0;
            }

            @media (max-width: 650px) {

                .match-main {
                    grid-template-columns: 1fr auto;
                }

                .prediction {
                    grid-column: 1 / 2;
                    text-align: left;
                    margin-top: 5px;
                }

                .prediction-info {
                    justify-content: flex-start;
                }

                .result {
                    grid-column: 2 / 3;
                    grid-row: 1 / 3;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* =========================================================
       KUPONLARI SAYFAYA BAS
       ========================================================= */

    function renderCoupons(targetDate) {
        injectCSS();

        const coupons = createCoupons(
            targetDate
        );

        /*
         * Sayfadaki muhtemel container isimlerini destekle.
         */

        const container =
            document.getElementById("coupons") ||
            document.getElementById("couponList") ||
            document.getElementById("kuponlar") ||
            document.getElementById("kuponListesi") ||
            document.querySelector(
                ".coupons-container"
            );

        if (!container) {
            console.warn(
                "Kupon container bulunamadı."
            );

            return coupons;
        }

        if (!coupons.length) {
            container.innerHTML = `
                <div class="coupon-empty">
                    <strong>Bu tarih için kupon oluşturulamadı.</strong>
                    <br><br>
                    En az ${MIN_SAMPLE} örneklem,
                    %${MIN_SUCCESS} başarı ve
                    toplam en az ${MIN_TOTAL_ODDS.toFixed(2)}
                    oran şartı aranıyor.
                </div>
            `;

            return coupons;
        }

        container.innerHTML = coupons
            .map((coupon, index) =>
                couponHTML(coupon, index)
            )
            .join("");

        return coupons;
    }

    /* =========================================================
       DIŞARIDAN ÇAĞRILACAK FONKSİYON
       ========================================================= */

    window.getCouponsForDate = function(targetDate) {
        if (!DATA_LOADED) {
            return [];
        }

        const date =
            targetDate ||
            todayKey();

        return createCoupons(date);
    };

    window.renderCouponsForDate = function(targetDate) {
        const date =
            targetDate ||
            todayKey();

        return renderCoupons(date);
    };

    /* =========================================================
       VERİYİ YÜKLE
       ========================================================= */

    async function loadData() {
        try {
            const response = await fetch(
                `${DATA_URL}?t=${Date.now()}`,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const json = await response.json();

            if (Array.isArray(json)) {
                ALL_MATCHES = json;
            } else if (
                json &&
                Array.isArray(json.matches)
            ) {
                ALL_MATCHES = json.matches;
            } else {
                throw new Error(
                    "matches.json içinde matches bulunamadı."
                );
            }

            DATA_LOADED = true;

            return ALL_MATCHES;
        } catch (error) {
            console.error(
                "Kupon verileri yüklenemedi:",
                error
            );

            const container =
                document.getElementById("coupons") ||
                document.getElementById("couponList") ||
                document.getElementById("kuponlar") ||
                document.getElementById("kuponListesi") ||
                document.querySelector(
                    ".coupons-container"
                );

            if (container) {
                container.innerHTML = `
                    <div class="coupon-error">
                        Kupon verileri yüklenemedi.<br>
                        ${escapeHTML(
                            error.message
                        )}
                    </div>
                `;
            }

            throw error;
        }
    }

    /* =========================================================
       TARİH SEÇİCİSİ
       ========================================================= */

    function setupDatePicker() {
        const input =
            document.getElementById("dateFilter") ||
            document.getElementById("couponDate") ||
            document.getElementById("date");

        if (!input) {
            return;
        }

        /*
         * Eğer tarih boşsa bugün.
         */

        if (!input.value) {
            input.value = todayKey();
        }

        input.addEventListener(
            "change",
            () => {
                renderCoupons(input.value);
            }
        );
    }

    /* =========================================================
       BAŞLAT
       ========================================================= */

    async function init() {
        try {
            await loadData();

            setupDatePicker();

            const input =
                document.getElementById("dateFilter") ||
                document.getElementById("couponDate") ||
                document.getElementById("date");

            const selectedDate =
                input && input.value
                    ? input.value
                    : todayKey();

            renderCoupons(selectedDate);

            /*
             * Eğer kupon.html kendi scriptinden
             * getCouponsForDate çağırıyorsa artık
             * bu fonksiyon global olarak mevcut.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "couponsReady",
                    {
                        detail: {
                            date: selectedDate,
                            coupons:
                                getCouponsForDate(
                                    selectedDate
                                )
                        }
                    }
                )
            );

        } catch (error) {
            console.error(
                "Kupon sistemi başlatılamadı:",
                error
            );
        }
    }

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init
        );
    } else {
        init();
    }

})();
