/* =========================================================
   BASKETBOL SAYI ANALİZİ
   basketbol.html ile birlikte çalışır
========================================================= */

const DATA_URL = "./data/basketball.json";

let allMatches = [];

let currentMonth = new Date();
let selectedDate = new Date();

const monthNames = [
    "OCAK",
    "ŞUBAT",
    "MART",
    "NİSAN",
    "MAYIS",
    "HAZİRAN",
    "TEMMUZ",
    "AĞUSTOS",
    "EYLÜL",
    "EKİM",
    "KASIM",
    "ARALIK"
];


/* =========================================================
   BAŞLAT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    document
        .getElementById("prevMonth")
        .addEventListener("click", () => {

            currentMonth.setMonth(currentMonth.getMonth() - 1);

            renderCalendar();
        });


    document
        .getElementById("nextMonth")
        .addEventListener("click", () => {

            currentMonth.setMonth(currentMonth.getMonth() + 1);

            renderCalendar();
        });


    document
        .getElementById("closeModal")
        .addEventListener("click", closeModal);


    document
        .getElementById("analysisModal")
        .addEventListener("click", e => {

            if (e.target.id === "analysisModal") {
                closeModal();
            }

        });


    loadData();

});


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

async function loadData() {

    const container =
        document.getElementById("matchesContainer");

    try {

        const response = await fetch(
            DATA_URL + "?v=" + Date.now()
        );

        if (!response.ok) {
            throw new Error(
                "basketball.json yüklenemedi"
            );
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            allMatches = data;
        } else if (Array.isArray(data.matches)) {
            allMatches = data.matches;
        } else {
            allMatches = [];
        }


        allMatches = allMatches
            .map(normalizeMatch)
            .filter(Boolean);


        renderCalendar();

        renderSelectedDate();

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">⚠️</div>
                <div>Basketbol verileri yüklenemedi.</div>
            </div>
        `;

    }

}


/* =========================================================
   MAÇ NORMALİZASYONU
========================================================= */

function normalizeMatch(match) {

    if (!match) return null;

    const home =
        match.home ||
        match.homeTeam ||
        match.ev ||
        match.evSahibi ||
        "";

    const away =
        match.away ||
        match.awayTeam ||
        match.deplasman ||
        "";

    if (!home || !away) {
        return null;
    }


    const date =
        normalizeDate(
            match.date ||
            match.matchDate ||
            match.tarih
        );


    if (!date) {
        return null;
    }


    return {

        id:
            match.id ||
            createId(date, home, away),

        date,

        time:
            match.time ||
            match.hour ||
            match.saat ||
            "",

        league:
            match.league ||
            match.leagueName ||
            match.lig ||
            "BASKETBOL",

        home,

        away,


        homeScore:
            numberOrNull(
                match.homeScore ??
                match.home_score ??
                match.evSkor
            ),

        awayScore:
            numberOrNull(
                match.awayScore ??
                match.away_score ??
                match.depSkor
            ),


        halfHomeScore:
            numberOrNull(
                match.halfHomeScore ??
                match.firstHalfHome ??
                match.iyHomeScore
            ),

        halfAwayScore:
            numberOrNull(
                match.halfAwayScore ??
                match.firstHalfAway ??
                match.iyAwayScore
            ),


        status:
            match.status ||
            detectStatus(match),


        stats:
            match.stats || {},

        raw:
            match

    };

}


/* =========================================================
   TARİH NORMALİZASYONU
========================================================= */

function normalizeDate(value) {

    if (!value) return null;


    if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return value;
    }


    const text = String(value).trim();


    let m =
        text.match(
            /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/
        );


    if (m) {

        return [
            m[3],
            String(m[2]).padStart(2, "0"),
            String(m[1]).padStart(2, "0")
        ].join("-");

    }


    const d = new Date(value);

    if (isNaN(d.getTime())) {
        return null;
    }


    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");

}


/* =========================================================
   TARİH YARDIMCILARI
========================================================= */

function dateKey(date) {

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

}


function parseDate(key) {

    const parts = key.split("-").map(Number);

    return new Date(
        parts[0],
        parts[1] - 1,
        parts[2]
    );

}


function sameDate(a, b) {

    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );

}


/* =========================================================
   TAKVİM
========================================================= */

function renderCalendar() {

    const calendar =
        document.getElementById("calendar");

    const title =
        document.getElementById("calendarTitle");


    title.textContent =
        `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;


    calendar.innerHTML = "";


    const year =
        currentMonth.getFullYear();

    const month =
        currentMonth.getMonth();


    const firstDay =
        new Date(year, month, 1);


    let startDay =
        firstDay.getDay();

    /*
       JS:
       Pazar = 0

       Biz:
       Pazartesi = 0
    */

    startDay =
        startDay === 0
            ? 6
            : startDay - 1;


    const daysInMonth =
        new Date(year, month + 1, 0).getDate();


    for (let i = 0; i < startDay; i++) {

        const empty =
            document.createElement("div");

        empty.className = "day empty";

        calendar.appendChild(empty);

    }


    for (
        let dayNumber = 1;
        dayNumber <= daysInMonth;
        dayNumber++
    ) {

        const date =
            new Date(
                year,
                month,
                dayNumber
            );


        const key =
            dateKey(date);


        const matches =
            matchesForDate(key);


        const cell =
            document.createElement("div");

        cell.className = "day";


        if (sameDate(date, new Date())) {
            cell.classList.add("today");
        }


        if (sameDate(date, selectedDate)) {
            cell.classList.add("selected");
        }


        cell.innerHTML = `

            <div class="day-number">
                ${dayNumber}
            </div>

            ${
                matches.length
                    ? `
                        <div class="match-dot"></div>

                        <div class="match-count">
                            ${matches.length}
                        </div>
                    `
                    : ""
            }

        `;


        cell.addEventListener("click", () => {

            selectedDate =
                new Date(
                    year,
                    month,
                    dayNumber
                );

            renderCalendar();

            renderSelectedDate();

        });


        calendar.appendChild(cell);

    }

}


/* =========================================================
   SEÇİLEN GÜN
========================================================= */

function renderSelectedDate() {

    const key =
        dateKey(selectedDate);


    const matches =
        matchesForDate(key);


    const title =
        document.getElementById("selectedDate");

    const count =
        document.getElementById("matchCount");


    const today =
        sameDate(
            selectedDate,
            new Date()
        );


    title.textContent =
        today
            ? "Bugünün Basketbol Maçları"
            : formatLongDate(selectedDate);


    count.textContent =
        `${matches.length} maç`;


    renderMatches(matches);

}


/* =========================================================
   MAÇLARI BUL
========================================================= */

function matchesForDate(date) {

    return allMatches
        .filter(match => match.date === date)
        .sort((a, b) => {

            return timeToMinutes(a.time) -
                   timeToMinutes(b.time);

        });

}


/* =========================================================
   MAÇLARI GÖSTER
========================================================= */

function renderMatches(matches) {

    const container =
        document.getElementById("matchesContainer");


    if (!matches.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">🏀</div>
                <div>
                    Bu tarihte basketbol maçı bulunmuyor.
                </div>
            </div>
        `;

        return;

    }


    container.className = "matches-grid";


    /*
       Analiz edilemeyen maçları
       şimdilik gizlemiyoruz.

       Çünkü veri çekme sistemi
       tamamlandığında bütün maçların
       geçmiş istatistikleri üzerinden
       analiz edilmesini sağlayacağız.
    */

    container.innerHTML =
        matches
            .map(match => createMatchCard(match))
            .join("");


    container
        .querySelectorAll("[data-match-id]")
        .forEach(button => {

            button.addEventListener("click", () => {

                const id =
                    button.dataset.matchId;

                const match =
                    allMatches.find(
                        m => String(m.id) === String(id)
                    );

                if (match) {
                    openAnalysis(match);
                }

            });

        });

}


/* =========================================================
   MAÇ KARTI
========================================================= */

function createMatchCard(match) {

    const prediction =
        calculatePrediction(match);


    const finished =
        isFinished(match);


    const homeDisplay =
        prediction
            ? prediction.home.toFixed(1)
            : "—";


    const awayDisplay =
        prediction
            ? prediction.away.toFixed(1)
            : "—";


    const totalDisplay =
        prediction
            ? prediction.total.toFixed(1)
            : "—";


    const halfDisplay =
        prediction
            ? prediction.firstHalfTotal.toFixed(1)
            : "—";


    const confidence =
        prediction
            ? Math.round(prediction.confidence)
            : 0;


    let actualHome = "";

    let actualAway = "";


    if (finished) {

        actualHome =
            match.homeScore ?? "—";

        actualAway =
            match.awayScore ?? "—";

    }


    return `

        <article class="match-card">

            <div class="match-top">

                <div class="league">
                    ${escapeHtml(match.league)}
                </div>

                <div class="match-time">
                    ${escapeHtml(match.time || "--:--")}
                </div>

            </div>


            <div class="teams">

                <div class="team">

                    <div class="team-name">
                        ${escapeHtml(match.home)}
                    </div>

                    <div class="team-score ${
                        prediction ? "predicted" : ""
                    }">

                        ${
                            finished
                                ? actualHome
                                : homeDisplay
                        }

                    </div>

                </div>


                <div class="team">

                    <div class="team-name">
                        ${escapeHtml(match.away)}
                    </div>

                    <div class="team-score ${
                        prediction ? "predicted" : ""
                    }">

                        ${
                            finished
                                ? actualAway
                                : awayDisplay
                        }

                    </div>

                </div>

            </div>


            <div class="prediction-box">

                <div class="prediction-row">

                    <div>

                        <div class="prediction-label">
                            Maç Toplamı
                        </div>

                        <div class="prediction-value">
                            ${totalDisplay}
                        </div>

                    </div>


                    <div class="half-total">

                        <div class="prediction-label">
                            İlk Yarı
                        </div>

                        <div class="prediction-value">
                            ${halfDisplay}
                        </div>

                    </div>

                </div>

            </div>


            <div class="card-bottom">

                <div class="confidence">

                    ${
                        prediction
                            ? `Güven <strong>%${confidence}</strong>`
                            : `Analiz bekleniyor`
                    }

                </div>


                <button
                    class="detail-button"
                    data-match-id="${escapeHtml(match.id)}"
                >
                    ANALİZ DETAY →
                </button>

            </div>

        </article>

    `;

}


/* =========================================================
   TAHMİN HESAPLAMA
========================================================= */

function calculatePrediction(match) {

    /*
       Şimdilik JSON içindeki hazır stats
       varsa onları kullanıyoruz.

       Bir sonraki aşamada gerçek Mackolik
       geçmiş maç verilerini buraya bağlayacağız.
    */


    const homeStats =
        getTeamStats(
            match.home,
            match.date
        );


    const awayStats =
        getTeamStats(
            match.away,
            match.date
        );


    /*
       Yeterli geçmiş veri yoksa
       stats içindeki hazır değerleri kontrol et.
    */

    if (
        !homeStats.totalGames &&
        !awayStats.totalGames
    ) {

        return getExistingPrediction(match);

    }


    const homeAttack =
        average([
            homeStats.last5Scored,
            homeStats.last10Scored,
            homeStats.homeScored
        ]);


    const homeDefense =
        average([
            homeStats.last5Conceded,
            homeStats.last10Conceded,
            homeStats.homeConceded
        ]);


    const awayAttack =
        average([
            awayStats.last5Scored,
            awayStats.last10Scored,
            awayStats.awayScored
        ]);


    const awayDefense =
        average([
            awayStats.last5Conceded,
            awayStats.last10Conceded,
            awayStats.awayConceded
        ]);


    let expectedHome =
        average([
            homeAttack,
            awayDefense
        ]);


    let expectedAway =
        average([
            awayAttack,
            homeDefense
        ]);


    /*
       Mantıksız değerleri engelle
    */

    expectedHome =
        clamp(expectedHome, 50, 140);

    expectedAway =
        clamp(expectedAway, 50, 140);


    const total =
        expectedHome +
        expectedAway;


    const firstHalfTotal =
        total * 0.51;


    const sample =
        homeStats.totalGames +
        awayStats.totalGames;


    const confidence =
        calculateConfidence(sample);


    return {

        home: expectedHome,

        away: expectedAway,

        total,

        firstHalfTotal,

        confidence,

        homeStats,

        awayStats

    };

}


/* =========================================================
   MEVCUT TAHMİN VARSA KULLAN
========================================================= */

function getExistingPrediction(match) {

    const p =
        match.prediction ||
        match.analysis ||
        match.tahmin ||
        {};


    const home =
        numberOrNull(
            p.home ??
            p.homeScore ??
            p.ev
        );


    const away =
        numberOrNull(
            p.away ??
            p.awayScore ??
            p.deplasman
        );


    const total =
        numberOrNull(
            p.total ??
            p.matchTotal ??
            p.toplam
        );


    if (
        home === null &&
        away === null &&
        total === null
    ) {

        return null;

    }


    const h =
        home ??
        (
            total !== null
                ? total / 2
                : 0
        );


    const a =
        away ??
        (
            total !== null
                ? total / 2
                : 0
        );


    return {

        home: h,

        away: a,

        total:
            total ??
            (h + a),

        firstHalfTotal:
            numberOrNull(
                p.firstHalfTotal ??
                p.firstHalf ??
                p.iyTotal
            ) ??
            ((h + a) * .51),

        confidence:
            numberOrNull(
                p.confidence ??
                p.guven
            ) ??
            65

    };

}


/* =========================================================
   TAKIM İSTATİSTİKLERİ
========================================================= */

function getTeamStats(teamName, beforeDate) {

    const key =
        normalizeTeam(teamName);


    const history =
        allMatches
            .filter(match => {

                if (
                    normalizeTeam(match.home) !== key &&
                    normalizeTeam(match.away) !== key
                ) {
                    return false;
                }


                if (
                    match.date >= beforeDate
                ) {
                    return false;
                }


                return isFinished(match);

            })
            .sort(
                (a, b) =>
                    b.date.localeCompare(a.date)
            );


    const last5 =
        history.slice(0, 5);


    const last10 =
        history.slice(0, 10);


    const homeGames =
        history
            .filter(
                m =>
                    normalizeTeam(m.home) === key
            );


    const awayGames =
        history
            .filter(
                m =>
                    normalizeTeam(m.away) === key
            );


    const home5 =
        homeGames.slice(0, 5);


    const away5 =
        awayGames.slice(0, 5);


    return {

        totalGames:
            history.length,

        last5Scored:
            average(
                last5.map(
                    m => teamScored(m, key)
                )
            ),

        last5Conceded:
            average(
                last5.map(
                    m => teamConceded(m, key)
                )
            ),

        last10Scored:
            average(
                last10.map(
                    m => teamScored(m, key)
                )
            ),

        last10Conceded:
            average(
                last10.map(
                    m => teamConceded(m, key)
                )
            ),

        homeScored:
            average(
                home5.map(
                    m => teamScored(m, key)
                )
            ),

        homeConceded:
            average(
                home5.map(
                    m => teamConceded(m, key)
                )
            ),

        awayScored:
            average(
                away5.map(
                    m => teamScored(m, key)
                )
            ),

        awayConceded:
            average(
                away5.map(
                    m => teamConceded(m, key)
                )
            )

    };

}


/* =========================================================
   TAKIMIN ATTIĞI SAYI
========================================================= */

function teamScored(match, teamKey) {

    if (
        normalizeTeam(match.home) === teamKey
    ) {

        return match.homeScore;

    }


    return match.awayScore;

}


/* =========================================================
   TAKIMIN YEDİĞİ SAYI
========================================================= */

function teamConceded(match, teamKey) {

    if (
        normalizeTeam(match.home) === teamKey
    ) {

        return match.awayScore;

    }


    return match.homeScore;

}


/* =========================================================
   DETAY MODAL
========================================================= */

function openAnalysis(match) {

    const modal =
        document.getElementById("analysisModal");


    const prediction =
        calculatePrediction(match);


    document.getElementById("modalLeague")
        .textContent =
            match.league;


    document.getElementById("modalHome")
        .textContent =
            match.home;


    document.getElementById("modalAway")
        .textContent =
            match.away;


    document.getElementById("modalTime")
        .textContent =
            match.time || "--:--";


    document.getElementById("modalContent")
        .innerHTML =
            createModalContent(
                match,
                prediction
            );


    modal.classList.add("show");

}


/* =========================================================
   MODAL İÇERİĞİ
========================================================= */

function createModalContent(
    match,
    prediction
) {

    if (!prediction) {

        return `

            <div class="empty">

                <div class="empty-icon">
                    📊
                </div>

                Bu maç için yeterli geçmiş
                veri henüz bulunmuyor.

            </div>

        `;

    }


    const h =
        prediction.home.toFixed(1);


    const a =
        prediction.away.toFixed(1);


    const total =
        prediction.total.toFixed(1);


    const half =
        prediction.firstHalfTotal.toFixed(1);


    const confidence =
        Math.round(
            prediction.confidence
        );


    const hs =
        prediction.homeStats || {};


    const as =
        prediction.awayStats || {};


    let actualHtml = "";


    if (isFinished(match)) {

        actualHtml = `

            <div class="section-title">
                GERÇEKLEŞEN SONUÇ
            </div>

            <div class="actual-result">

                <div class="actual-score">

                    ${match.homeScore}

                    <span>-</span>

                    ${match.awayScore}

                </div>

            </div>

        `;

    }


    return `

        <div class="section-title">
            BASKETBOL MAÇ ANALİZİ
        </div>

        <div class="stats-grid">

            <div class="stat-box">

                <div class="stat-label">
                    1. PERİYOT
                </div>

                <div class="stat-value">
                    ${((total / 4) * .99).toFixed(1)}
                </div>

                <div class="stat-sub">
                    SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    2. PERİYOT
                </div>

                <div class="stat-value">
                    ${((total / 4) * 1.02).toFixed(1)}
                </div>

                <div class="stat-sub">
                    SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    İLK YARI
                </div>

                <div class="stat-value highlight">
                    ${half}
                </div>

                <div class="stat-sub">
                    SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    3. PERİYOT
                </div>

                <div class="stat-value">
                    ${((total / 4) * 1.01).toFixed(1)}
                </div>

                <div class="stat-sub">
                    SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    4. PERİYOT
                </div>

                <div class="stat-value">
                    ${((total / 4) * .98).toFixed(1)}
                </div>

                <div class="stat-sub">
                    SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    MAÇ TOPLAMI
                </div>

                <div class="stat-value highlight">
                    ${total}
                </div>

                <div class="stat-sub">
                    SAYI
                </div>

            </div>

        </div>


        <div class="section-title">
            TAKIM BAZLI TAHMİNLER
        </div>


        <div class="team-analysis">

            <div class="analysis-box">

                <div class="analysis-title">
                    EV SAHİBİ
                </div>

                <div class="analysis-team">
                    ${escapeHtml(match.home)}
                </div>

                <div class="analysis-number">
                    ${h}
                </div>

                <div class="analysis-desc">
                    BEKLENEN SAYI
                </div>

            </div>


            <div class="analysis-box">

                <div class="analysis-title">
                    DEPLASMAN
                </div>

                <div class="analysis-team">
                    ${escapeHtml(match.away)}
                </div>

                <div class="analysis-number">
                    ${a}
                </div>

                <div class="analysis-desc">
                    BEKLENEN SAYI
                </div>

            </div>


            <div class="analysis-box">

                <div class="analysis-title">
                    BEKLENEN MAÇ TOPLAMI
                </div>

                <div class="analysis-team">
                    ${h} + ${a}
                </div>

                <div class="analysis-number">
                    ${total}
                </div>

                <div class="analysis-desc">
                    SAYI
                </div>

            </div>

        </div>


        <div class="section-title">
            İLK YARI TAHMİNİ
        </div>


        <div class="team-analysis">

            <div class="analysis-box">

                <div class="analysis-title">
                    EV SAHİBİ
                </div>

                <div class="analysis-number">
                    ${(h * .51).toFixed(1)}
                </div>

            </div>


            <div class="analysis-box">

                <div class="analysis-title">
                    DEPLASMAN
                </div>

                <div class="analysis-number">
                    ${(a * .51).toFixed(1)}
                </div>

            </div>


            <div class="analysis-box">

                <div class="analysis-title">
                    İLK YARI TOPLAMI
                </div>

                <div class="analysis-number"
                     style="color:#43d6c3">
                    ${half}
                </div>

            </div>

        </div>


        <div class="section-title">
            GEÇMİŞ VERİLER
        </div>


        <div class="stats-grid">

            <div class="stat-box">

                <div class="stat-label">
                    EV SON 5
                </div>

                <div class="stat-value">
                    ${formatStat(hs.last5Scored)}
                </div>

                <div class="stat-sub">
                    ATILAN SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    EV SON 10
                </div>

                <div class="stat-value">
                    ${formatStat(hs.last10Scored)}
                </div>

                <div class="stat-sub">
                    ATILAN SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    EV İÇ SAHA
                </div>

                <div class="stat-value">
                    ${formatStat(hs.homeScored)}
                </div>

                <div class="stat-sub">
                    ATILAN SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    DEP SON 5
                </div>

                <div class="stat-value">
                    ${formatStat(as.last5Scored)}
                </div>

                <div class="stat-sub">
                    ATILAN SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    DEP SON 10
                </div>

                <div class="stat-value">
                    ${formatStat(as.last10Scored)}
                </div>

                <div class="stat-sub">
                    ATILAN SAYI
                </div>

            </div>


            <div class="stat-box">

                <div class="stat-label">
                    DEP DEPLASMAN
                </div>

                <div class="stat-value">
                    ${formatStat(as.awayScored)}
                </div>

                <div class="stat-sub">
                    ATILAN SAYI
                </div>

            </div>

        </div>


        <div class="section-title">
            ANALİZ GÜVENİ
        </div>


        <div class="actual-result">

            <div class="actual-score"
                 style="color:#43d6c3">

                %${confidence}

            </div>

        </div>


        ${actualHtml}

    `;

}


/* =========================================================
   MODAL KAPAT
========================================================= */

function closeModal() {

    document
        .getElementById("analysisModal")
        .classList.remove("show");

}


/* =========================================================
   TARİH / SAAT
========================================================= */

function timeToMinutes(time) {

    if (!time) return 9999;

    const m =
        String(time).match(
            /(\d{1,2})[:.](\d{2})/
        );

    if (!m) return 9999;

    return (
        Number(m[1]) * 60 +
        Number(m[2])
    );

}


function formatLongDate(date) {

    return date.toLocaleDateString(
        "tr-TR",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


/* =========================================================
   DURUM
========================================================= */

function detectStatus(match) {

    if (
        numberOrNull(match.homeScore) !== null &&
        numberOrNull(match.awayScore) !== null
    ) {
        return "finished";
    }

    return "not_started";

}


function isFinished(match) {

    return (
        match.status === "finished" ||
        match.status === "completed" ||
        match.status === "played" ||
        (
            match.homeScore !== null &&
            match.awayScore !== null
        )
    );

}


/* =========================================================
   TAKIM NORMALİZASYONU
========================================================= */

function normalizeTeam(name) {

    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

}


/* =========================================================
   YARDIMCI FONKSİYONLAR
========================================================= */

function numberOrNull(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    const n =
        Number(
            String(value)
                .replace(",", ".")
                .replace(/[^\d.-]/g, "")
        );


    return Number.isFinite(n)
        ? n
        : null;

}


function average(values) {

    const valid =
        values
            .filter(
                v =>
                    typeof v === "number" &&
                    Number.isFinite(v)
            );


    if (!valid.length) {
        return 0;
    }


    return (
        valid.reduce(
            (a, b) => a + b,
            0
        ) / valid.length
    );

}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


function calculateConfidence(sample) {

    if (!sample) {
        return 55;
    }


    return clamp(
        55 + Math.min(sample, 20) * 1.25,
        55,
        80
    );

}


function formatStat(value) {

    if (
        value === undefined ||
        value === null ||
        !Number.isFinite(value)
    ) {
        return "—";
    }

    return Number(value).toFixed(1);

}


function createId(date, home, away) {

    return (
        date +
        "-" +
        normalizeTeam(home) +
        "-" +
        normalizeTeam(away)
    )
        .replace(/\s+/g, "-");

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
   DIŞARIDAN KULLANILABİLSİN
========================================================= */

window.basketballMatches = () => allMatches;

window.refreshBasketball = () => {

    loadData();

};
