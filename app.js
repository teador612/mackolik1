'use strict';

const DATA_URL = './data/matches.json';

const MIN_SAMPLE = 5;
const MIN_SUCCESS = 70;
const HISTORY_DAYS = 60;

const state = {
    matches: [],
    byDate: new Map(),
    oddsIndex: new Map(),
    selectedDate: null
};

let calendarMonth;
let calendarYear;


/* =========================================================
   YARDIMCI
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function number(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const n = Number(String(value).replace(',', '.'));

    return Number.isFinite(n) ? n : null;
}


/* =========================================================
   TARİH
========================================================= */

function today() {
    const d = new Date();

    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function parseDate(date) {
    const p = String(date).split('.');

    if (p.length !== 3) return null;

    return {
        day: Number(p[0]),
        month: Number(p[1]) - 1,
        year: Number(p[2])
    };
}

function formatDate(day, month, year) {
    return `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
}

function dateValue(date) {
    const p = String(date).split('.');

    if (p.length !== 3) return 0;

    return Number(`${p[2]}${p[1].padStart(2, '0')}${p[0].padStart(2, '0')}`);
}

function dateTimestamp(date) {
    const p = String(date).split('.');

    if (p.length !== 3) return 0;

    return new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
    ).getTime();
}

function monthName(month) {
    return [
        'Ocak',
        'Şubat',
        'Mart',
        'Nisan',
        'Mayıs',
        'Haziran',
        'Temmuz',
        'Ağustos',
        'Eylül',
        'Ekim',
        'Kasım',
        'Aralık'
    ][month];
}


/* =========================================================
   SKOR
========================================================= */

function getScore(match) {
    if (!match?.score) return null;

    const home = number(match.score.home);
    const away = number(match.score.away);

    if (home === null || away === null) return null;

    return { home, away };
}

function getHalfScore(match) {
    if (!match?.halfTimeScore) return null;

    const home = number(match.halfTimeScore.home);
    const away = number(match.halfTimeScore.away);

    if (home === null || away === null) return null;

    return { home, away };
}

function isPlayed(match) {
    return getScore(match) !== null;
}


/* =========================================================
   ORANLAR
========================================================= */

function getOdd(match, key) {
    const value = number(match?.openingOdds?.[key]);

    if (value === null || value <= 0) {
        return null;
    }

    return value;
}


/* =========================================================
   ORAN TÜRLERİ
========================================================= */

const MARKETS = [
    { key: 'ms1', name: 'MS 1' },
    { key: 'msX', name: 'MS X' },
    { key: 'ms2', name: 'MS 2' },

    { key: 'kgVar', name: 'KG Var' },
    { key: 'kgYok', name: 'KG Yok' },

    { key: 'au15Ust', name: '1.5 Üst' },
    { key: 'au15Alt', name: '1.5 Alt' },

    { key: 'au25Ust', name: '2.5 Üst' },
    { key: 'au25Alt', name: '2.5 Alt' },

    { key: 'au35Ust', name: '3.5 Üst' },
    { key: 'au35Alt', name: '3.5 Alt' },

    { key: 'iy15Ust', name: 'İY 1.5 Üst' },
    { key: 'iy15Alt', name: 'İY 1.5 Alt' },

    { key: 'iy1', name: 'İY 1' },
    { key: 'iyX', name: 'İY X' },
    { key: 'iy2', name: 'İY 2' }
];


/* =========================================================
   SONUÇ HESABI
========================================================= */

function marketResult(match, market) {
    const score = getScore(match);
    const half = getHalfScore(match);

    if (market === 'ms1') {
        return score ? score.home > score.away : null;
    }

    if (market === 'msX') {
        return score ? score.home === score.away : null;
    }

    if (market === 'ms2') {
        return score ? score.home < score.away : null;
    }

    if (market === 'kgVar') {
        return score
            ? score.home > 0 && score.away > 0
            : null;
    }

    if (market === 'kgYok') {
        return score
            ? score.home === 0 || score.away === 0
            : null;
    }

    if (market === 'au15Ust') {
        return score
            ? score.home + score.away >= 2
            : null;
    }

    if (market === 'au15Alt') {
        return score
            ? score.home + score.away <= 1
            : null;
    }

    if (market === 'au25Ust') {
        return score
            ? score.home + score.away >= 3
            : null;
    }

    if (market === 'au25Alt') {
        return score
            ? score.home + score.away <= 2
            : null;
    }

    if (market === 'au35Ust') {
        return score
            ? score.home + score.away >= 4
            : null;
    }

    if (market === 'au35Alt') {
        return score
            ? score.home + score.away <= 3
            : null;
    }

    if (market === 'iy15Ust') {
        return half
            ? half.home + half.away >= 2
            : null;
    }

    if (market === 'iy15Alt') {
        return half
            ? half.home + half.away <= 1
            : null;
    }

    if (market === 'iy1') {
        return half ? half.home > half.away : null;
    }

    if (market === 'iyX') {
        return half ? half.home === half.away : null;
    }

    if (market === 'iy2') {
        return half ? half.home < half.away : null;
    }

    return null;
}


/* =========================================================
   VERİ İNDEKSİ
========================================================= */

function buildIndex() {

    state.byDate.clear();
    state.oddsIndex.clear();

    for (const match of state.matches) {

        if (!match?.date) continue;

        if (!state.byDate.has(match.date)) {
            state.byDate.set(match.date, []);
        }

        state.byDate
            .get(match.date)
            .push(match);


        for (const market of MARKETS) {

            const odd = getOdd(
                match,
                market.key
            );

            if (odd === null) continue;

            /*
               TAM EŞLEŞME.
               Tolerans yok.
            */

            const key =
                `${market.key}|${odd.toFixed(2)}`;

            if (!state.oddsIndex.has(key)) {
                state.oddsIndex.set(key, []);
            }

            state.oddsIndex
                .get(key)
                .push(match);
        }
    }
}


/* =========================================================
   GEÇMİŞ EŞLEŞMELER
========================================================= */

function getHistory(
    currentMatch,
    marketKey,
    odd
) {

    const key =
        `${marketKey}|${odd.toFixed(2)}`;

    const matches =
        state.oddsIndex.get(key) || [];

    const currentTime =
        dateTimestamp(currentMatch.date);

    const minTime =
        currentTime -
        HISTORY_DAYS * 24 * 60 * 60 * 1000;

    return matches.filter(match => {

        const time =
            dateTimestamp(match.date);

        return (
            time >= minTime &&
            time < currentTime &&
            isPlayed(match)
        );
    });
}


/* =========================================================
   ANALİZ
========================================================= */

function analyzeMatch(match) {

    const recommendations = [];

    for (const market of MARKETS) {

        const odd =
            getOdd(
                match,
                market.key
            );

        if (odd === null) continue;

        const history =
            getHistory(
                match,
                market.key,
                odd
            );

        if (history.length < MIN_SAMPLE) {
            continue;
        }


        for (const target of MARKETS) {

            let wins = 0;
            let total = 0;

            for (const oldMatch of history) {

                const result =
                    marketResult(
                        oldMatch,
                        target.key
                    );

                if (result === null) {
                    continue;
                }

                total++;

                if (result) {
                    wins++;
                }
            }

            if (total < MIN_SAMPLE) {
                continue;
            }

            const percentage =
                (wins / total) * 100;

            if (percentage < MIN_SUCCESS) {
                continue;
            }

            recommendations.push({
                source: market.name,
                sourceKey: market.key,
                target: target.name,
                targetKey: target.key,
                odd,
                wins,
                total,
                percentage
            });
        }
    }


    recommendations.sort(
        (a, b) =>
            b.percentage - a.percentage ||
            b.total - a.total
    );


    return recommendations;
}


/* =========================================================
   TAKVİM
========================================================= */

function createCalendarDay(
    day,
    month,
    year,
    otherMonth
) {

    if (month < 0) {
        month = 11;
        year--;
    }

    if (month > 11) {
        month = 0;
        year++;
    }

    const date =
        formatDate(
            day,
            month,
            year
        );

    const button =
        document.createElement('button');

    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = day;

    if (otherMonth) {
        button.classList.add('other-month');
    }

    if (date === today()) {
        button.classList.add('today');
    }

    if (date === state.selectedDate) {
        button.classList.add('selected');
    }

    if (state.byDate.has(date)) {
        button.classList.add('has-data');
    }

    button.addEventListener('click', () => {

        state.selectedDate = date;

        const parsed =
            parseDate(date);

        calendarMonth =
            parsed.month;

        calendarYear =
            parsed.year;

        renderCalendar();
        render();
        closeCalendar();
    });

    return button;
}


function renderCalendar() {

    const days =
        $('calendarDays');

    const title =
        $('calendarMonth');

    if (!days || !title) return;

    title.textContent =
        `${monthName(calendarMonth)} ${calendarYear}`;

    const first =
        new Date(
            calendarYear,
            calendarMonth,
            1
        );

    let start =
        first.getDay();

    start =
        start === 0 ? 6 : start - 1;

    const daysInMonth =
        new Date(
            calendarYear,
            calendarMonth + 1,
            0
        ).getDate();

    const previousDays =
        new Date(
            calendarYear,
            calendarMonth,
            0
        ).getDate();

    days.innerHTML = '';

    for (let i = start - 1; i >= 0; i--) {

        days.appendChild(
            createCalendarDay(
                previousDays - i,
                calendarMonth - 1,
                calendarYear,
                true
            )
        );
    }

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        days.appendChild(
            createCalendarDay(
                day,
                calendarMonth,
                calendarYear,
                false
            )
        );
    }

    const total =
        start + daysInMonth;

    const remaining =
        total % 7 === 0
            ? 0
            : 7 - (total % 7);

    for (
        let day = 1;
        day <= remaining;
        day++
    ) {

        days.appendChild(
            createCalendarDay(
                day,
                calendarMonth + 1,
                calendarYear,
                true
            )
        );
    }

    const selected =
        $('selectedDateText');

    if (selected) {
        selected.textContent =
            state.selectedDate || today();
    }
}


function openCalendar() {
    const popup = $('calendarPopup');

    if (popup) {
        popup.hidden = false;
    }
}


function closeCalendar() {
    const popup = $('calendarPopup');

    if (popup) {
        popup.hidden = true;
    }
}


function setupCalendar() {

    state.selectedDate = today();

    const parsed =
        parseDate(
            state.selectedDate
        );

    calendarMonth =
        parsed.month;

    calendarYear =
        parsed.year;

    renderCalendar();
}


/* =========================================================
   TAKVİM EVENTLERİ
========================================================= */

function setupCalendarEvents() {

    $('calendarButton')?.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            const popup =
                $('calendarPopup');

            if (!popup) return;

            popup.hidden
                ? openCalendar()
                : closeCalendar();
        }
    );


    $('prevMonth')?.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            calendarMonth--;

            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear--;
            }

            renderCalendar();
        }
    );


    $('nextMonth')?.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            calendarMonth++;

            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear++;
            }

            renderCalendar();
        }
    );


    $('todayButton')?.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            setupCalendar();

            render();

            closeCalendar();
        }
    );


    document.addEventListener(
        'click',
        event => {

            const wrapper =
                document.querySelector(
                    '.calendar-wrapper'
                );

            if (
                wrapper &&
                !wrapper.contains(event.target)
            ) {
                closeCalendar();
            }
        }
    );
}


/* =========================================================
   MAÇ KARTI
========================================================= */

function recommendationHtml(
    recommendation
) {

    if (!recommendation) {

        return `
            <div class="recommendation">
                <div class="rec-label">
                    Analiz
                </div>
                <div class="rec-target">
                    Yeterli geçmiş veri yok
                </div>
            </div>
        `;
    }

    return `
        <div class="recommendation">

            <div class="rec-row">

                <div class="rec-left">

                    <div class="rec-label">
                        ÖNERİ
                    </div>

                    <div class="rec-target">
                        ${esc(recommendation.target)}
                    </div>

                </div>

                <div class="rec-right">

                    <div class="percent">
                        %${recommendation.percentage.toFixed(1)}
                    </div>

                    <div class="sample">
                        ${recommendation.wins}/${recommendation.total}
                    </div>

                </div>

            </div>

            <div class="rec-source">
                ${esc(recommendation.source)}
                · Oran ${recommendation.odd.toFixed(2)}
            </div>

        </div>
    `;
}


function detailsHtml(
    recommendations
) {

    if (!recommendations.length) {
        return `
            <div class="empty">
                %${MIN_SUCCESS} ve üzeri
                yeterli örnek bulunamadı.
            </div>
        `;
    }

    return recommendations.map(item => `
        <div class="detail">

            <div class="detail-top">

                <div class="detail-name">
                    ${esc(item.target)}
                </div>

                <div class="detail-percent">
                    %${item.percentage.toFixed(1)}
                </div>

            </div>

            <div class="detail-bottom">
                ${esc(item.source)}
                · Oran ${item.odd.toFixed(2)}
                · ${item.wins}/${item.total}
            </div>

        </div>
    `).join('');
}


function getMatchStatus(
    match,
    recommendation
) {

    if (!recommendation) {
        return {
            className: 'pending',
            text: 'Yeterli veri yok'
        };
    }

    const result =
        marketResult(
            match,
            recommendation.targetKey
        );

    if (result === true) {
        return {
            className: 'success',
            text: '✓ Öneri tuttu'
        };
    }

    if (result === false) {
        return {
            className: 'fail',
            text: '✕ Öneri tutmadı'
        };
    }

    return {
        className: 'pending',
        text: '⏳ Bekliyor'
    };
}


function matchHtml(
    match,
    index
) {

    const recommendations =
        analyzeMatch(match);

    const best =
        recommendations[0] || null;

    const status =
        getMatchStatus(
            match,
            best
        );

    const score =
        getScore(match);

    const scoreText =
        score
            ? `${score.home} - ${score.away}`
            : '—';

    return `
        <div class="match-card">

            <div class="match-header">

                <div class="match-time">
                    ${esc(match.time || '--:--')}
                </div>

                <div class="match-league">
                    ${esc(match.league || '')}
                </div>

            </div>


            <div class="teams">

                <div class="team">
                    ${esc(match.home || '-')}
                </div>

                <div class="vs">
                    VS
                </div>

                <div class="team">
                    ${esc(match.away || '-')}
                </div>

            </div>


            <div class="score">
                Skor: ${scoreText}
            </div>


            ${recommendationHtml(best)}


            <div class="status ${status.className}">
                ${status.text}
            </div>


            <button
                type="button"
                class="details-button"
                data-index="${index}">

                ＋ Diğer öneriler

            </button>


            <div
                class="details"
                id="details-${index}">

                ${detailsHtml(
                    recommendations
                )}

            </div>

        </div>
    `;
}


/* =========================================================
   ÖZET
========================================================= */

function renderSummary(matches) {

    const summary =
        $('summary');

    if (!summary) return;

    let analyzed = 0;

    for (const match of matches) {

        if (
            analyzeMatch(match).length
        ) {
            analyzed++;
        }
    }

    summary.innerHTML = `
        <div class="summary-card">

            <div class="summary-label">
                Toplam Maç
            </div>

            <div class="summary-value">
                ${matches.length}
            </div>

        </div>

        <div class="summary-card">

            <div class="summary-label">
                Analiz Bulunan
            </div>

            <div class="summary-value">
                ${analyzed}
            </div>

        </div>
    `;
}


/* =========================================================
   EKRANI ÇİZ
========================================================= */

function render() {

    const content =
        $('content');

    if (!content) return;

    const matches =
        state.byDate.get(
            state.selectedDate
        ) || [];


    renderSummary(matches);


    if (!matches.length) {

        content.innerHTML = `
            <div class="empty">
                Bu tarihte maç bulunamadı.
            </div>
        `;

        return;
    }


    content.innerHTML =
        matches
            .map(
                (match, index) =>
                    matchHtml(
                        match,
                        index
                    )
            )
            .join('');


    document
        .querySelectorAll(
            '.details-button'
        )
        .forEach(button => {

            button.addEventListener(
                'click',
                () => {

                    const index =
                        button.dataset.index;

                    const details =
                        $(`details-${index}`);

                    if (!details) return;

                    const open =
                        details.classList.toggle(
                            'open'
                        );

                    button.textContent =
                        open
                            ? '− Önerileri gizle'
                            : '＋ Diğer öneriler';
                }
            );
        });
}


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

async function loadData() {

    const content =
        $('content');

    if (content) {

        content.innerHTML = `
            <div class="loading">
                Maç verileri yükleniyor...
            </div>
        `;
    }


    try {

        const response =
            await fetch(
                `${DATA_URL}?ts=${Date.now()}`,
                {
                    cache: 'no-store'
                }
            );


        if (!response.ok) {
            throw new Error(
                `Veri yüklenemedi: HTTP ${response.status}`
            );
        }


        const data =
            await response.json();


        if (
            !data ||
            !Array.isArray(data.matches)
        ) {
            throw new Error(
                'matches.json formatı geçersiz.'
            );
        }


        state.matches =
            data.matches;


        buildIndex();


        if (!state.selectedDate) {
            setupCalendar();
        } else {

            const parsed =
                parseDate(
                    state.selectedDate
                );

            calendarMonth =
                parsed.month;

            calendarYear =
                parsed.year;

            renderCalendar();
        }


        render();

    } catch (error) {

        console.error(error);

        if (content) {

            content.innerHTML = `
                <div class="error">

                    <strong>
                        Veri yüklenemedi.
                    </strong>

                    <br><br>

                    ${esc(error.message)}

                </div>
            `;
        }
    }
}


/* =========================================================
   YENİLE BUTONU
========================================================= */

$('refreshButton')?.addEventListener(
    'click',
    async function () {

        this.disabled = true;
        this.textContent = '⏳ Yükleniyor...';

        await loadData();

        this.disabled = false;
        this.textContent = '🔄 Yenile';
    }
);


/* =========================================================
   BAŞLAT
========================================================= */

setupCalendarEvents();

loadData();
