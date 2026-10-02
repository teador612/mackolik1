const DATA_URL = "./data/matches.json";

const HISTORY_DAYS = 60;
const MIN_SAMPLE = 5;
const MIN_SUCCESS = 70;

let matches = [];
let selectedDate = new Date();
let calendarDate = new Date();

let searchText = "";
let selectedLeague = "";
let unplayedOnly = false;

let analysisCache = new Map();

const $ = (id) => document.getElementById(id);


/* =========================================================
   GENEL YARDIMCILAR
========================================================= */

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function pad(value) {
    return String(value).padStart(2, "0");
}


function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}


function parseDate(value) {

    if (!value) return null;

    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();

    let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);

    if (match) {
        const d = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );

        return isNaN(d.getTime()) ? null : d;
    }

    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);

    if (match) {
        const d = new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );

        return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(text);

    return isNaN(d.getTime()) ? null : d;
}


function formatDateTR(date) {

    return date.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}


function addDays(date, days) {

    const d = new Date(date);

    d.setDate(d.getDate() + days);

    return d;
}


/* =========================================================
   VERİ ALANLARI
========================================================= */

function value(obj, names) {

    for (const name of names) {

        if (
            obj &&
            obj[name] !== undefined &&
            obj[name] !== null &&
            obj[name] !== ""
        ) {
            return obj[name];
        }
    }

    return "";
}


function getMatchDate(match) {

    return value(match, [
        "date",
        "Date",
        "tarih",
        "Tarih",
        "matchDate",
        "match_date"
    ]);
}


function getHome(match) {

    return value(match, [
        "home",
        "Home",
        "homeTeam",
        "home_team",
        "ev",
        "evSahibi",
        "ev_sahibi"
    ]);
}


function getAway(match) {

    return value(match, [
        "away",
        "Away",
        "awayTeam",
        "away_team",
        "deplasman",
        "deplasmanTakimi",
        "deplasman_takimi"
    ]);
}


function getLeague(match) {

    return value(match, [
        "league",
        "League",
        "lig",
        "Lig",
        "competition",
        "tournament"
    ]);
}


function getTime(match) {

    return value(match, [
        "time",
        "Time",
        "hour",
        "saat",
        "matchTime"
    ]);
}


/* =========================================================
   SKOR
========================================================= */

function getScore(match) {

    const score = value(match, [
        "score",
        "Score",
        "result",
        "Result",
        "macSonucu",
        "mac_sonucu"
    ]);

    if (score !== "") {

        const m = String(score).match(/(\d+)\s*[-:]\s*(\d+)/);

        if (m) {

            return {
                home: Number(m[1]),
                away: Number(m[2])
            };
        }
    }

    const homeScore = value(match, [
        "homeScore",
        "home_score",
        "evSkor",
        "ev_skor"
    ]);

    const awayScore = value(match, [
        "awayScore",
        "away_score",
        "depSkor",
        "dep_skor"
    ]);

    if (
        homeScore !== "" &&
        awayScore !== "" &&
        !isNaN(Number(homeScore)) &&
        !isNaN(Number(awayScore))
    ) {

        return {
            home: Number(homeScore),
            away: Number(awayScore)
        };
    }

    return null;
}


function getHalfTimeScore(match) {

    const score = value(match, [
        "halfTimeScore",
        "half_time_score",
        "htScore",
        "ht_score",
        "iySkor",
        "iy_skor",
        "ilkYariSkor",
        "ilk_yari_skor"
    ]);

    if (score === "") return null;

    const m = String(score).match(/(\d+)\s*[-:]\s*(\d+)/);

    if (!m) return null;

    return {
        home: Number(m[1]),
        away: Number(m[2])
    };
}


function isPlayed(match) {

    const score = getScore(match);

    return !!score;
}


/* =========================================================
   ORANLAR
========================================================= */

function normalizeOdds(value) {

    if (value === null || value === undefined) {
        return null;
    }

    let text = String(value)
        .trim()
        .replace(",", ".");

    const number = Number(text);

    if (!isFinite(number)) return null;

    return number.toFixed(2);
}


/*
   Farklı veri yapılarını desteklemek için
   oranları mümkün olduğunca esnek buluyoruz.
*/

function getOddsContainer(match) {

    return (
        match.openingOdds ||
        match.opening_odds ||
        match.odds ||
        match.Odds ||
        match.oranlar ||
        match.Oranlar ||
        {}
    );
}


function getOdd(match, aliases) {

    const container = getOddsContainer(match);

    for (const key of aliases) {

        if (
            container[key] !== undefined &&
            container[key] !== null &&
            container[key] !== ""
        ) {
            return normalizeOdds(container[key]);
        }

        if (
            match[key] !== undefined &&
            match[key] !== null &&
            match[key] !== ""
        ) {
            return normalizeOdds(match[key]);
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
        odds: [
            "ms1",
            "MS1",
            "mS1",
            "homeWin",
            "home_win",
            "mac1",
            "ms_1"
        ]
    },

    {
        id: "MSX",
        title: "MS X",
        odds: [
            "msx",
            "MSX",
            "ms0",
            "MS0",
            "draw",
            "beraberlik",
            "macx",
            "ms_x"
        ]
    },

    {
        id: "MS2",
        title: "MS 2",
        odds: [
            "ms2",
            "MS2",
            "awayWin",
            "away_win",
            "mac2",
            "ms_2"
        ]
    },

    {
        id: "IY1",
        title: "İY 1",
        odds: [
            "iy1",
            "IY1",
            "ht1",
            "HT1",
            "ilkYari1"
        ]
    },

    {
        id: "IYX",
        title: "İY X",
        odds: [
            "iyx",
            "IYX",
            "iy0",
            "IY0",
            "htx",
            "HTX"
        ]
    },

    {
        id: "IY2",
        title: "İY 2",
        odds: [
            "iy2",
            "IY2",
            "ht2",
            "HT2",
            "ilkYari2"
        ]
    },

    {
        id: "IY15U",
        title: "İY 1.5 Üst",
        odds: [
            "iy15u",
            "IY15U",
            "iy1_5_ust",
            "iy15Ust",
            "ht15u",
            "HT15U",
            "iy_15_ust"
        ]
    }

];


/* =========================================================
   MARKET SONUÇLARI
========================================================= */

function getMarketOutcome(match, marketId) {

    const score = getScore(match);
    const ht = getHalfTimeScore(match);

    if (!score) return null;


    if (marketId === "MS1") {

        if (score.home > score.away) return "MS 1";

        return null;
    }


    if (marketId === "MSX") {

        if (score.home === score.away) return "MS X";

        return null;
    }


    if (marketId === "MS2") {

        if (score.away > score.home) return "MS 2";

        return null;
    }


    if (marketId === "IY1") {

        if (!ht) return null;

        if (ht.home > ht.away) return "İY 1";

        return null;
    }


    if (marketId === "IYX") {

        if (!ht) return null;

        if (ht.home === ht.away) return "İY X";

        return null;
    }


    if (marketId === "IY2") {

        if (!ht) return null;

        if (ht.away > ht.home) return "İY 2";

        return null;
    }


    if (marketId === "IY15U") {

        if (!ht) return null;

        if ((ht.home + ht.away) >= 2) {
            return "İY 1.5 Üst";
        }

        return null;
    }


    return null;
}


/* =========================================================
   MAÇIN TÜM ORANLARI
========================================================= */

function getMatchMarkets(match) {

    const result = [];

    for (const market of MARKETS) {

        const odds = getOdd(match, market.odds);

        if (odds) {

            result.push({
                marketId: market.id,
                title: market.title,
                odds
            });
        }
    }

    return result;
}


/* =========================================================
   60 GÜNLÜK GEÇMİŞ
========================================================= */

function getHistory(targetDate) {

    const target = new Date(targetDate);

    target.setHours(0, 0, 0, 0);

    const start = addDays(target, -HISTORY_DAYS);

    const startKey = dateKey(start);
    const targetKey = dateKey(target);

    return matches.filter(match => {

        const d = parseDate(getMatchDate(match));

        if (!d) return false;

        d.setHours(0, 0, 0, 0);

        const key = dateKey(d);

        if (key < startKey) return false;

        if (key >= targetKey) return false;

        if (!isPlayed(match)) return false;

        return true;

    });
}


/* =========================================================
   ANALİZ İNDEKSİ
========================================================= */

function buildAnalysisIndex(targetDate) {

    const key = dateKey(targetDate);

    if (analysisCache.has(key)) {
        return analysisCache.get(key);
    }

    const history = getHistory(targetDate);

    const index = new Map();


    for (const match of history) {

        const markets = getMatchMarkets(match);

        for (const source of markets) {

            const sourceKey =
                `${source.marketId}|${source.odds}`;

            if (!index.has(sourceKey)) {
                index.set(sourceKey, []);
            }

            index.get(sourceKey).push(match);
        }
    }


    analysisCache.set(key, index);

    return index;
}


/* =========================================================
   TAHMİNLER
========================================================= */

function getRecommendations(match, targetDate) {

    const index = buildAnalysisIndex(targetDate);

    const currentMarkets = getMatchMarkets(match);

    const recommendations = [];


    for (const source of currentMarkets) {

        const key =
            `${source.marketId}|${source.odds}`;

        const historicalMatches =
            index.get(key) || [];


        if (historicalMatches.length < MIN_SAMPLE) {
            continue;
        }


        for (const target of MARKETS) {

            /*
               Aynı marketten kendisine tahmin üretme.
            */

            if (source.marketId === target.id) {
                continue;
            }


            let total = 0;
            let success = 0;


            for (const historical of historicalMatches) {

                const outcome =
                    getMarketOutcome(
                        historical,
                        target.id
                    );

                if (!outcome) continue;

                total++;

                success++;
            }


            /*
               Burada yalnızca olayın gerçekleştiği
               maçları sayarsak oran daima %100 olur.
               Bu yüzden gerçek sonuç değerlendirmesi
               için tüm maçları değerlendirmemiz gerekir.
            */

            total = historicalMatches.length;

            success = historicalMatches.filter(
                historical => {
                    return !!getMarketOutcome(
                        historical,
                        target.id
                    );
                }
            ).length;


            if (total < MIN_SAMPLE) {
                continue;
            }


            const percentage =
                (success / total) * 100;


            if (percentage < MIN_SUCCESS) {
                continue;
            }


            recommendations.push({

                sourceMarket: source.marketId,

                sourceTitle: source.title,

                sourceOdds: source.odds,

                targetMarket: target.id,

                targetTitle: target.title,

                success,

                total,

                percentage

            });

        }

    }


    /*
       Önce başarı yüzdesi,
       sonra örnek sayısı.
    */

    recommendations.sort((a, b) => {

        if (b.percentage !== a.percentage) {
            return b.percentage - a.percentage;
        }

        return b.total - a.total;

    });


    /*
       Aynı tahmini tekrar etme.
    */

    const unique = [];

    const seen = new Set();


    for (const rec of recommendations) {

        const key =
            `${rec.sourceMarket}|${rec.sourceOdds}|${rec.targetMarket}`;

        if (seen.has(key)) continue;

        seen.add(key);

        unique.push(rec);
    }


    return unique;
}


/* =========================================================
   TAHMİN KARTI
========================================================= */

function recommendationHtml(rec, match) {

    let statusClass = "pending";

    if (isPlayed(match)) {

        const hit =
            getMarketOutcome(
                match,
                rec.targetMarket
            );

        statusClass =
            hit ? "success" : "failed";
    }


    return `

        <div class="recommendation ${statusClass}">

            <span class="recommendation-dot"></span>

            <div class="recommendation-main">

                <div class="recommendation-line">

                    <strong>
                        ${escapeHtml(rec.sourceTitle)}
                    </strong>

                    <span class="odd">
                        ${escapeHtml(rec.sourceOdds)}
                    </span>

                    <span class="arrow">
                        →
                    </span>

                    <strong>
                        ${escapeHtml(rec.targetTitle)}
                    </strong>

                </div>


                <div class="recommendation-stats">

                    ${rec.success}/${rec.total}

                    ·

                    %${rec.percentage.toFixed(1)}

                </div>

            </div>

        </div>

    `;
}


/* =========================================================
   MAÇ KARTI
========================================================= */

function matchHtml(match, recommendations) {

    const home = getHome(match);
    const away = getAway(match);
    const time = getTime(match);

    const score = getScore(match);
    const ht = getHalfTimeScore(match);


    let html = `

        <article class="match-card">

            <div class="match-top">

                <span class="match-time">
                    ${escapeHtml(time)}
                </span>

                <span class="match-league">
                    ${escapeHtml(getLeague(match))}
                </span>

            </div>


            <div class="teams">

                <div class="team home">
                    ${escapeHtml(home)}
                </div>

                <div class="vs">
                    VS
                </div>

                <div class="team away">
                    ${escapeHtml(away)}
                </div>

            </div>
    `;


    if (score) {

        html += `

            <div class="scores">

                <span>
                    İY ${ht ? `${ht.home}-${ht.away}` : "-"}
                </span>

                <span>
                    MS ${score.home}-${score.away}
                </span>

            </div>

        `;
    }


    /*
       Sadece tahmini olan maçları
       ekrana basıyoruz.
    */

    if (!recommendations.length) {
        return "";
    }


    const first = recommendations[0];

    const extra = recommendations.slice(1);


    html += `

        <div class="recommendations">

            <div class="recommendation-list">

                ${recommendationHtml(first, match)}

            </div>
    `;


    if (extra.length > 0) {

        html += `

            <button
                class="more-recommendations"
                type="button"
                data-more="closed"
            >
                +${extra.length}
            </button>


            <div class="extra-recommendations hidden">

                ${extra
                    .map(rec =>
                        recommendationHtml(rec, match)
                    )
                    .join("")}

            </div>

        `;
    }


    html += `

        </div>

        </article>

    `;


    return html;
}


/* =========================================================
   GÜNLÜK BAŞARI
========================================================= */

function calculateDailySummary(dayMatches) {

    let success = 0;
    let total = 0;


    for (const match of dayMatches) {

        if (!isPlayed(match)) {
            continue;
        }


        const recs =
            getRecommendations(
                match,
                selectedDate
            );


        for (const rec of recs) {

            total++;

            if (
                getMarketOutcome(
                    match,
                    rec.targetMarket
                )
            ) {
                success++;
            }

        }

    }


    return {
        success,
        total,
        percentage:
            total
                ? (success / total) * 100
                : null
    };
}


/* =========================================================
   60 GÜN ÖZETİ
========================================================= */

function calculate60DaySummary() {

    const end = new Date(selectedDate);
    end.setHours(0, 0, 0, 0);

    const start = addDays(end, -HISTORY_DAYS);


    let success = 0;
    let total = 0;


    /*
       Son 60 gündeki maçları tek tek ele alıyoruz.
       Her gün için, o günden önceki 60 günlük
       geçmiş kullanılıyor.
    */

    const historicalMatches = matches.filter(match => {

        const d = parseDate(getMatchDate(match));

        if (!d) return false;

        d.setHours(0, 0, 0, 0);

        return d >= start && d < end;
    });


    for (const match of historicalMatches) {

        if (!isPlayed(match)) {
            continue;
        }


        const d = parseDate(getMatchDate(match));

        if (!d) continue;


        const recs =
            getRecommendations(
                match,
                d
            );


        for (const rec of recs) {

            total++;

            if (
                getMarketOutcome(
                    match,
                    rec.targetMarket
                )
            ) {
                success++;
            }

        }

    }


    return {
        success,
        total,
        percentage:
            total
                ? (success / total) * 100
                : null
    };
}


/* =========================================================
   ÖZET
========================================================= */

function renderSummary(dayMatches) {

    const summary = $("summary");

    if (!summary) return;


    const daily =
        calculateDailySummary(dayMatches);

    const sixty =
        calculate60DaySummary();


    const dailyText =
        daily.percentage === null
            ? "-"
            : `%${daily.percentage.toFixed(1)}`;


    const sixtyText =
        sixty.percentage === null
            ? "-"
            : `%${sixty.percentage.toFixed(1)}`;


    summary.innerHTML = `

        <div class="summary-grid">

            <div class="summary-card">

                <span class="summary-label">
                    BUGÜN
                </span>

                <strong>
                    ${dailyText}
                </strong>

                <small>
                    ${daily.success}/${daily.total}
                    gerçekleşen tahmin
                </small>

            </div>


            <div class="summary-card">

                <span class="summary-label">
                    SON 60 GÜN
                </span>

                <strong>
                    ${sixtyText}
                </strong>

                <small>
                    ${sixty.success}/${sixty.total}
                    gerçekleşen tahmin
                </small>

            </div>

        </div>

    `;
}


/* =========================================================
   GÜNÜN MAÇLARI
========================================================= */

function getSelectedDayMatches() {

    const selectedKey =
        dateKey(selectedDate);


    return matches.filter(match => {

        const d =
            parseDate(getMatchDate(match));

        if (!d) return false;

        return dateKey(d) === selectedKey;

    });
}


/* =========================================================
   FİLTRELEME
========================================================= */

function applyFilters(list) {

    return list.filter(match => {

        const home =
            String(getHome(match)).toLowerCase();

        const away =
            String(getAway(match)).toLowerCase();

        const league =
            String(getLeague(match)).toLowerCase();


        if (searchText) {

            const q =
                searchText.toLowerCase();

            if (
                !home.includes(q) &&
                !away.includes(q)
            ) {
                return false;
            }
        }


        if (selectedLeague) {

            if (
                String(getLeague(match)) !==
                selectedLeague
            ) {
                return false;
            }
        }


        if (unplayedOnly && isPlayed(match)) {
            return false;
        }


        return true;

    });
}


/* =========================================================
   LİG FİLTRESİ
========================================================= */

function fillLeagues(list) {

    const select =
        $("leagueFilter");

    if (!select) return;


    const leagues =
        [...new Set(
            list
                .map(match => getLeague(match))
                .filter(Boolean)
        )]
        .sort((a, b) =>
            String(a).localeCompare(
                String(b),
                "tr"
            )
        );


    select.innerHTML =
        `<option value="">Tüm Ligler</option>`;


    for (const league of leagues) {

        const option =
            document.createElement("option");

        option.value = league;
        option.textContent = league;

        select.appendChild(option);
    }


    select.value = selectedLeague;
}


/* =========================================================
   RENDER
========================================================= */

function render() {

    const content =
        $("content");

    if (!content) return;


    const allDayMatches =
        getSelectedDayMatches();


    fillLeagues(allDayMatches);


    const filtered =
        applyFilters(allDayMatches);


    /*
       Tahmin olmayan maçları tamamen çıkar.
    */

    const predicted = [];


    for (const match of filtered) {

        const recs =
            getRecommendations(
                match,
                selectedDate
            );


        if (recs.length > 0) {

            predicted.push({
                match,
                recs
            });

        }

    }


    renderSummary(
        predicted.map(item => item.match)
    );


    if (!predicted.length) {

        content.innerHTML = `

            <div class="empty-state">

                Bu tarihte uygun tahmin bulunamadı.

            </div>

        `;

        updateStatus(
            allDayMatches.length,
            0
        );

        return;
    }


    content.innerHTML =
        predicted
            .map(item =>
                matchHtml(
                    item.match,
                    item.recs
                )
            )
            .join("");


    updateStatus(
        allDayMatches.length,
        predicted.length
    );
}


/* =========================================================
   DURUM
========================================================= */

function updateStatus(totalMatches, predictedMatches) {

    const message =
        $("message");

    const updatedAt =
        $("updatedAt");


    if (message) {

        message.textContent =
            `${predictedMatches} tahminli maç / ${totalMatches} maç`;
    }


    if (updatedAt) {

        updatedAt.textContent =
            `Son 60 gün · ${formatDateTR(selectedDate)}`;
    }
}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

    const days =
        $("calendarDays");

    const monthText =
        $("calendarMonth");

    if (!days || !monthText) return;


    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();


    monthText.textContent =
        calendarDate.toLocaleDateString(
            "tr-TR",
            {
                month: "long",
                year: "numeric"
            }
        );


    days.innerHTML = "";


    const first =
        new Date(
            year,
            month,
            1
        );


    let startDay =
        first.getDay();

    /*
       Pazartesi = 0
    */

    startDay =
        startDay === 0
            ? 6
            : startDay - 1;


    const lastDate =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    for (let i = 0; i < startDay; i++) {

        const empty =
            document.createElement("div");

        empty.className =
            "calendar-day empty";

        days.appendChild(empty);
    }


    for (let day = 1; day <= lastDate; day++) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "calendar-day";


        const d =
            new Date(
                year,
                month,
                day
            );


        if (
            dateKey(d) ===
            dateKey(selectedDate)
        ) {

            button.classList.add("selected");
        }


        button.textContent = day;


        button.addEventListener(
            "click",
            () => {

                selectedDate = d;
                calendarDate = new Date(d);

                const popup =
                    $("calendarPopup");

                if (popup) {
                    popup.classList.add("hidden");
                }

                updateSelectedDateText();

                renderCalendar();

                render();

            }
        );


        days.appendChild(button);
    }
}


function updateSelectedDateText() {

    const element =
        $("selectedDateText");

    if (!element) return;


    element.textContent =
        selectedDate.toLocaleDateString(
            "tr-TR",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );
}


/* =========================================================
   EVENTLER
========================================================= */

function setupEvents() {

    const calendarToggle =
        $("calendarToggle");

    const calendarPopup =
        $("calendarPopup");


    if (calendarToggle) {

        calendarToggle.addEventListener(
            "click",
            () => {

                calendarPopup.classList.toggle(
                    "hidden"
                );

            }
        );
    }


    const prev =
        $("prevMonth");

    if (prev) {

        prev.addEventListener(
            "click",
            () => {

                calendarDate.setMonth(
                    calendarDate.getMonth() - 1
                );

                renderCalendar();

            }
        );
    }


    const next =
        $("nextMonth");

    if (next) {

        next.addEventListener(
            "click",
            () => {

                calendarDate.setMonth(
                    calendarDate.getMonth() + 1
                );

                renderCalendar();

            }
        );
    }


    const search =
        $("search");

    if (search) {

        search.addEventListener(
            "input",
            event => {

                searchText =
                    event.target.value.trim();

                render();

            }
        );
    }


    const league =
        $("leagueFilter");

    if (league) {

        league.addEventListener(
            "change",
            event => {

                selectedLeague =
                    event.target.value;

                render();

            }
        );
    }


    const unplayed =
        $("unplayedOnly");

    if (unplayed) {

        unplayed.addEventListener(
            "change",
            event => {

                unplayedOnly =
                    event.target.checked;

                render();

            }
        );
    }


    const refresh =
        $("refreshButton");

    if (refresh) {

        refresh.addEventListener(
            "click",
            () => {

                analysisCache.clear();

                loadData(true);

            }
        );
    }


    /*
       + butonları
    */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".more-recommendations"
                );

            if (!button) return;


            const extra =
                button.nextElementSibling;

            if (!extra) return;


            const closed =
                button.dataset.more === "closed";


            if (closed) {

                extra.classList.remove(
                    "hidden"
                );

                button.dataset.more =
                    "open";

                button.textContent =
                    "−";

            } else {

                extra.classList.add(
                    "hidden"
                );

                button.dataset.more =
                    "closed";

                const count =
                    extra.children.length;

                button.textContent =
                    `+${count}`;

            }

        }
    );


    /*
       Takvim dışına tıklayınca kapat.
    */

    document.addEventListener(
        "click",
        event => {

            if (!calendarPopup) return;

            if (
                !calendarPopup.contains(
                    event.target
                ) &&
                !calendarToggle.contains(
                    event.target
                )
            ) {

                calendarPopup.classList.add(
                    "hidden"
                );
            }

        }
    );
}


/* =========================================================
   VERİ YÜKLE
========================================================= */

async function loadData(force = false) {

    const message =
        $("message");


    try {

        if (message) {
            message.textContent =
                "Veriler yükleniyor...";
        }


        const url =
            force
                ? `${DATA_URL}?t=${Date.now()}`
                : DATA_URL;


        const response =
            await fetch(url, {
                cache: "no-store"
            });


        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        if (Array.isArray(data)) {

            matches = data;

        } else if (
            data &&
            Array.isArray(data.matches)
        ) {

            matches = data.matches;

        } else {

            throw new Error(
                "matches.json formatı geçersiz."
            );
        }


        analysisCache.clear();


        /*
           İlk açılışta veri içindeki
           en yeni tarihi seç.
        */

        const dates =
            matches
                .map(match =>
                    parseDate(
                        getMatchDate(match)
                    )
                )
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        b.getTime() -
                        a.getTime()
                );


        if (dates.length) {

            selectedDate =
                new Date(dates[0]);

            calendarDate =
                new Date(dates[0]);

        }


        updateSelectedDateText();

        renderCalendar();

        render();


    } catch (error) {

        console.error(error);


        if (message) {

            message.textContent =
                "Veriler yüklenemedi.";
        }


        const content =
            $("content");


        if (content) {

            content.innerHTML = `

                <div class="empty-state">

                    Veri yüklenirken hata oluştu.

                    <br>

                    <small>
                        ${escapeHtml(error.message)}
                    </small>

                </div>

            `;
        }
    }
}


/* =========================================================
   BAŞLAT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        updateSelectedDateText();

        renderCalendar();

        loadData();

    }
);
