'use strict';


/* =========================================================
   AYARLAR
========================================================= */

const DATA_URL = './data/matches.json';

const MIN_SUCCESS = 70;
const MIN_SAMPLE = 5;
const HISTORY_DAYS = 60;


/* =========================================================
   DURUM
========================================================= */

const state = {

    matches: [],

    byDate: new Map(),

    oddsIndex: new Map(),

    selectedDate: '',

    cache: new Map()

};


let calendarMonth;
let calendarYear;


/* =========================================================
   YARDIMCILAR
========================================================= */

function $(id){
    return document.getElementById(id);
}


function esc(value){

    return String(value ?? '').replace(
        /[&<>"']/g,
        c => ({
            '&':'&amp;',
            '<':'&lt;',
            '>':'&gt;',
            '"':'&quot;',
            "'":'&#39;'
        }[c])
    );

}


function num(value){

    if(
        value === null ||
        value === undefined ||
        value === ''
    ){
        return null;
    }

    const n = Number(
        String(value).replace(',', '.')
    );

    return Number.isFinite(n)
        ? n
        : null;

}


/* =========================================================
   TARİH
========================================================= */

function today(){

    const d = new Date();

    return [
        String(d.getDate()).padStart(2,'0'),
        String(d.getMonth()+1).padStart(2,'0'),
        d.getFullYear()
    ].join('.');

}


function parseDate(date){

    const p = String(date).split('.');

    if(p.length !== 3){
        return null;
    }

    return {
        day:Number(p[0]),
        month:Number(p[1])-1,
        year:Number(p[2])
    };

}


function formatDate(
    day,
    month,
    year
){

    return [
        String(day).padStart(2,'0'),
        String(month+1).padStart(2,'0'),
        year
    ].join('.');

}


function monthName(month){

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


function dateNumber(date){

    if(!date){
        return 0;
    }

    const p =
        String(date).split('.');

    if(p.length !== 3){
        return 0;
    }

    return Number(
        p[2] +
        p[1].padStart(2,'0') +
        p[0].padStart(2,'0')
    );

}


function dateTimestamp(date){

    const p =
        String(date).split('.');

    if(p.length !== 3){
        return 0;
    }

    return new Date(
        Number(p[2]),
        Number(p[1])-1,
        Number(p[0])
    ).getTime();

}


/* =========================================================
   SKOR
========================================================= */

function scoreOf(obj){

    if(!obj){
        return null;
    }

    const home = num(obj.home);
    const away = num(obj.away);

    if(
        home === null ||
        away === null ||
        home < 0 ||
        away < 0
    ){
        return null;
    }

    return {
        home,
        away
    };

}


function getScore(match){
    return scoreOf(match?.score);
}


function getHalf(match){
    return scoreOf(match?.halfTimeScore);
}


function isPlayed(match){
    return getScore(match) !== null;
}


/* =========================================================
   ORAN
========================================================= */

function getOdd(match,key){

    const value =
        num(match?.openingOdds?.[key]);

    if(
        value === null ||
        value <= 0
    ){
        return null;
    }

    return value;

}


/* =========================================================
   ORAN KAYNAKLARI
========================================================= */

const SOURCES = [

    {key:'ms1',name:'MS 1'},
    {key:'msX',name:'MS X'},
    {key:'ms2',name:'MS 2'},

    {key:'kgVar',name:'KG Var'},
    {key:'kgYok',name:'KG Yok'},

    {key:'au15Ust',name:'1.5 Üst'},
    {key:'au15Alt',name:'1.5 Alt'},

    {key:'au25Ust',name:'2.5 Üst'},
    {key:'au25Alt',name:'2.5 Alt'},

    {key:'au35Ust',name:'3.5 Üst'},
    {key:'au35Alt',name:'3.5 Alt'},

    {key:'iy15Ust',name:'İY 1.5 Üst'},
    {key:'iy15Alt',name:'İY 1.5 Alt'},

    {key:'iy1',name:'İY 1'},
    {key:'iyX',name:'İY X'},
    {key:'iy2',name:'İY 2'}

];


const TARGETS = [

    {key:'ms1',name:'MS 1'},
    {key:'msX',name:'MS X'},
    {key:'ms2',name:'MS 2'},

    {key:'kgVar',name:'KG Var'},
    {key:'kgYok',name:'KG Yok'},

    {key:'over15',name:'1.5 Üst'},
    {key:'under15',name:'1.5 Alt'},

    {key:'over25',name:'2.5 Üst'},
    {key:'under25',name:'2.5 Alt'},

    {key:'over35',name:'3.5 Üst'},
    {key:'under35',name:'3.5 Alt'},

    {key:'iyOver05',name:'İY 0.5 Üst'},
    {key:'iyUnder05',name:'İY 0.5 Alt'},

    {key:'iyOver15',name:'İY 1.5 Üst'},
    {key:'iyUnder15',name:'İY 1.5 Alt'},

    {key:'iy1',name:'İY 1'},
    {key:'iyX',name:'İY X'},
    {key:'iy2',name:'İY 2'}

];


/* =========================================================
   SONUÇ
========================================================= */

function result(match,key){

    const score = getScore(match);
    const half = getHalf(match);

    switch(key){

        case 'ms1':
            if(!score) return null;
            return score.home > score.away;

        case 'msX':
            if(!score) return null;
            return score.home === score.away;

        case 'ms2':
            if(!score) return null;
            return score.home < score.away;


        case 'kgVar':
            if(!score) return null;
            return (
                score.home > 0 &&
                score.away > 0
            );


        case 'kgYok':
            if(!score) return null;
            return (
                score.home === 0 ||
                score.away === 0
            );


        case 'over15':
            if(!score) return null;
            return (
                score.home +
                score.away >= 2
            );


        case 'under15':
            if(!score) return null;
            return (
                score.home +
                score.away <= 1
            );


        case 'over25':
            if(!score) return null;
            return (
                score.home +
                score.away >= 3
            );


        case 'under25':
            if(!score) return null;
            return (
                score.home +
                score.away <= 2
            );


        case 'over35':
            if(!score) return null;
            return (
                score.home +
                score.away >= 4
            );


        case 'under35':
            if(!score) return null;
            return (
                score.home +
                score.away <= 3
            );


        case 'iyOver05':
            if(!half) return null;
            return (
                half.home +
                half.away >= 1
            );


        case 'iyUnder05':
            if(!half) return null;
            return (
                half.home +
                half.away === 0
            );


        case 'iyOver15':
            if(!half) return null;
            return (
                half.home +
                half.away >= 2
            );


        case 'iyUnder15':
            if(!half) return null;
            return (
                half.home +
                half.away <= 1
            );


        case 'iy1':
            if(!half) return null;
            return half.home > half.away;


        case 'iyX':
            if(!half) return null;
            return half.home === half.away;


        case 'iy2':
            if(!half) return null;
            return half.home < half.away;


        default:
            return null;

    }

}


/* =========================================================
   INDEX
========================================================= */

function buildIndex(){

    state.byDate.clear();
    state.oddsIndex.clear();
    state.cache.clear();


    for(const match of state.matches){

        if(
            !match ||
            !match.date
        ){
            continue;
        }


        if(
            !state.byDate.has(
                match.date
            )
        ){

            state.byDate.set(
                match.date,
                []
            );

        }


        state.byDate
            .get(match.date)
            .push(match);


        for(
            const source of SOURCES
        ){

            const odd =
                getOdd(
                    match,
                    source.key
                );

            if(odd === null){
                continue;
            }


            /*
               TAM EŞLEŞME.
               TOLERANS YOK.
            */

            const key =
                source.key +
                '|' +
                odd.toFixed(2);


            if(
                !state.oddsIndex.has(key)
            ){

                state.oddsIndex.set(
                    key,
                    []
                );

            }


            state.oddsIndex
                .get(key)
                .push(match);

        }

    }


    for(
        const list of
        state.oddsIndex.values()
    ){

        list.sort(
            (a,b) =>
                dateNumber(a.date) -
                dateNumber(b.date)
        );

    }

}


/* =========================================================
   GEÇMİŞ MAÇLAR
========================================================= */

function getHistory(
    matchDate,
    sourceKey,
    odd
){

    const key =
        sourceKey +
        '|' +
        Number(odd).toFixed(2);


    const list =
        state.oddsIndex.get(key) || [];


    const current =
        dateNumber(matchDate);


    const start =
        dateTimestamp(matchDate) -
        (
            HISTORY_DAYS *
            24 *
            60 *
            60 *
            1000
        );


    const startDate =
        new Date(start);


    const startNumber =
        Number(
            startDate.getFullYear() +
            String(
                startDate.getMonth()+1
            ).padStart(2,'0') +
            String(
                startDate.getDate()
            ).padStart(2,'0')
        );


    const resultList = [];


    for(const old of list){

        const oldDate =
            dateNumber(old.date);


        if(oldDate >= current){
            break;
        }


        if(oldDate < startNumber){
            continue;
        }


        if(!isPlayed(old)){
            continue;
        }


        resultList.push(old);

    }


    return resultList;

}


/* =========================================================
   ANALİZ
========================================================= */

function analyze(match){

    const cacheKey =
        String(match.code || '') +
        '_' +
        String(match.date || '');


    if(
        state.cache.has(cacheKey)
    ){

        return state.cache.get(
            cacheKey
        );

    }


    const list = [];


    for(
        const source of SOURCES
    ){

        const currentOdd =
            getOdd(
                match,
                source.key
            );


        if(currentOdd === null){
            continue;
        }


        const same =
            getHistory(
                match.date,
                source.key,
                currentOdd
            );


        for(
            const target of TARGETS
        ){

            let success = 0;
            let total = 0;


            for(
                const old of same
            ){

                const r =
                    result(
                        old,
                        target.key
                    );


                if(r === null){
                    continue;
                }


                total++;


                if(r === true){
                    success++;
                }

            }


            if(total < MIN_SAMPLE){
                continue;
            }


            const percent =
                success /
                total *
                100;


            if(
                percent < MIN_SUCCESS
            ){
                continue;
            }


            list.push({

                source:source.name,

                sourceKey:source.key,

                target:target.name,

                targetKey:target.key,

                odd:currentOdd,

                success,

                total,

                percent

            });

        }

    }


    list.sort(
        (a,b) => {

            if(
                b.percent !==
                a.percent
            ){

                return (
                    b.percent -
                    a.percent
                );

            }


            if(
                b.total !==
                a.total
            ){

                return (
                    b.total -
                    a.total
                );

            }


            return (
                b.success -
                a.success
            );

        }
    );


    const data = {

        list,

        best:
            list.length
                ? list[0]
                : null

    };


    state.cache.set(
        cacheKey,
        data
    );


    return data;

}


/* =========================================================
   TAKVİM
========================================================= */

function setupCalendar(){

    state.selectedDate =
        today();


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


function createCalendarDay(
    day,
    month,
    year,
    otherMonth
){

    if(month < 0){

        month = 11;
        year--;

    }


    if(month > 11){

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
        document.createElement(
            'button'
        );


    button.type = 'button';

    button.className =
        'calendar-day';


    button.textContent =
        day;


    if(otherMonth){

        button.classList.add(
            'other-month'
        );

    }


    if(date === today()){

        button.classList.add(
            'today'
        );

    }


    if(
        date ===
        state.selectedDate
    ){

        button.classList.add(
            'selected'
        );

    }


    if(
        state.byDate.has(date)
    ){

        button.classList.add(
            'has-data'
        );

    }


    button.addEventListener(
        'click',
        () => {

            state.selectedDate =
                date;


            const parsed =
                parseDate(date);


            calendarMonth =
                parsed.month;

            calendarYear =
                parsed.year;


            renderCalendar();

            render();

            closeCalendar();

        }
    );


    return button;

}


function renderCalendar(){

    const days =
        $('calendarDays');

    const title =
        $('calendarMonth');

    const selected =
        $('selectedDateText');


    if(
        !days ||
        !title
    ){
        return;
    }


    title.textContent =
        `${monthName(calendarMonth)} ${calendarYear}`;


    if(selected){

        selected.textContent =
            state.selectedDate ||
            today();

    }


    const firstDay =
        new Date(
            calendarYear,
            calendarMonth,
            1
        );


    let start =
        firstDay.getDay();


    /*
       Pazartesi = 0
    */

    start =
        start === 0
            ? 6
            : start - 1;


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


    /*
       Önceki ay
    */

    for(
        let i = start - 1;
        i >= 0;
        i--
    ){

        days.appendChild(
            createCalendarDay(
                previousDays - i,
                calendarMonth - 1,
                calendarYear,
                true
            )
        );

    }


    /*
       Bu ay
    */

    for(
        let day = 1;
        day <= daysInMonth;
        day++
    ){

        days.appendChild(
            createCalendarDay(
                day,
                calendarMonth,
                calendarYear,
                false
            )
        );

    }


    /*
       Sonraki ay
    */

    const total =
        start +
        daysInMonth;


    const remaining =
        total % 7 === 0
            ? 0
            : 7 - total % 7;


    for(
        let day = 1;
        day <= remaining;
        day++
    ){

        days.appendChild(
            createCalendarDay(
                day,
                calendarMonth + 1,
                calendarYear,
                true
            )
        );

    }

}


function openCalendar(){

    const popup =
        $('calendarPopup');

    if(popup){

        popup.hidden = false;

    }

}


function closeCalendar(){

    const popup =
        $('calendarPopup');

    if(popup){

        popup.hidden = true;

    }

}


/* =========================================================
   TAKVİM OLAYLARI
========================================================= */

function setupCalendarEvents(){

    $('calendarButton')
        ?.addEventListener(
            'click',
            event => {

                event.stopPropagation();


                const popup =
                    $('calendarPopup');


                if(!popup){
                    return;
                }


                if(popup.hidden){

                    openCalendar();

                }else{

                    closeCalendar();

                }

            }
        );


    $('prevMonth')
        ?.addEventListener(
            'click',
            event => {

                event.stopPropagation();


                calendarMonth--;


                if(calendarMonth < 0){

                    calendarMonth = 11;
                    calendarYear--;

                }


                renderCalendar();

            }
        );


    $('nextMonth')
        ?.addEventListener(
            'click',
            event => {

                event.stopPropagation();


                calendarMonth++;


                if(calendarMonth > 11){

                    calendarMonth = 0;
                    calendarYear++;

                }


                renderCalendar();

            }
        );


    $('todayButton')
        ?.addEventListener(
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


            if(
                wrapper &&
                !wrapper.contains(
                    event.target
                )
            ){

                closeCalendar();

            }

        }
    );

}


/* =========================================================
   ÖNERİ DURUMU
========================================================= */

function getStatus(
    match,
    best
){

    if(!best){

        return {
            cls:'pending',
            text:'Yeterli veri yok'
        };

    }


    const r =
        result(
            match,
            best.targetKey
        );


    if(r === true){

        return {
            cls:'success',
            text:'✓ Öneri tuttu'
        };

    }


    if(r === false){

        return {
            cls:'fail',
            text:'✕ Öneri tutmadı'
        };

    }


    return {
        cls:'pending',
        text:'⏳ Maç oynanmadı'
    };

}


/* =========================================================
   DETAY
========================================================= */

function detailHtml(list){

    if(!list.length){

        return `
            <div class="empty">
                %${MIN_SUCCESS} ve üzerinde
                yeterli örnek bulunamadı.
            </div>
        `;

    }


    return `
        <div class="detail-grid">

            ${
                list.map(
                    item => `

                        <div class="detail">

                            <div class="detail-top">

                                <div class="detail-name">
                                    ${esc(item.target)}
                                </div>

                                <div class="detail-percent">
                                    %${item.percent.toFixed(1)}
                                </div>

                            </div>

                            <div class="detail-bottom">
                                ${esc(item.source)}
                                · Oran ${item.odd.toFixed(2)}
                                · ${item.success}/${item.total}
                            </div>

                        </div>

                    `
                ).join('')
            }

        </div>
    `;

}


/* =========================================================
   MAÇ
========================================================= */

function matchHtml(
    match,
    index
){

    const analysis =
        analyze(match);


    const best =
        analysis.best;


    const status =
        getStatus(
            match,
            best
        );


    const score =
        getScore(match);


    let scoreText =
        'Henüz oynanmadı';


    if(score){

        scoreText =
            `${score.home} - ${score.away}`;

    }


    const bestHtml =
        best

        ? `

            <div class="rec-row">

                <div class="rec-left">

                    <div class="rec-label">
                        En güçlü öneri
                    </div>

                    <div class="rec-target">
                        ${esc(best.target)}
                    </div>

                </div>


                <div class="rec-right">

                    <div class="percent">
                        %${best.percent.toFixed(1)}
                    </div>

                    <div class="sample">
                        ${best.success}/${best.total}
                        · Oran ${best.odd.toFixed(2)}
                    </div>

                </div>

            </div>


            <div class="status ${status.cls}">
                ${status.text}
            </div>

        `

        : `

            <div class="rec-row">

                <div class="rec-left">

                    <div class="rec-label">
                        Analiz
                    </div>

                    <div class="rec-target">
                        Yeterli veri yok
                    </div>

                </div>

            </div>

        `;


    return `

        <div class="match">

            <div class="match-main">

                <div class="match-top">

                    <div class="time">
                        ${esc(match.time || '--:--')}
                    </div>

                    <div class="league">
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

                    <div class="team away">
                        ${esc(match.away || '-')}
                    </div>

                </div>


                <div class="score">
                    Skor: ${scoreText}
                </div>


                <div class="recommendation">
                    ${bestHtml}
                </div>


                <button
                    class="details-button"
                    type="button"
                    data-detail="${index}"
                >
                    ＋ Diğer öneriler
                </button>

            </div>


            <div
                class="details"
                id="details-${index}"
            >

                ${detailHtml(
                    analysis.list
                )}

            </div>

        </div>

    `;

}


/* =========================================================
   ÖZET
========================================================= */

function renderSummary(matches){

    let available = 0;


    for(
        const match of matches
    ){

        const analysis =
            analyze(match);


        if(analysis.best){

            available++;

        }

    }


    $('summary').innerHTML = `

        <div class="summary">

            <div class="summary-card">

                <div class="summary-label">
                    Seçili gün
                </div>

                <div class="summary-value">
                    ${matches.length}
                </div>

                <div class="summary-label">
                    maç
                </div>

            </div>


            <div class="summary-card">

                <div class="summary-label">
                    Analiz bulunan
                </div>

                <div class="summary-value">
                    ${available}
                </div>

                <div class="summary-label">
                    maç
                </div>

            </div>

        </div>

    `;

}


/* =========================================================
   MAÇLARI GÖSTER
========================================================= */

function render(){

    const date =
        state.selectedDate;


    const matches =
        state.byDate.get(date) || [];


    renderSummary(matches);


    if(!matches.length){

        $('content').innerHTML = `

            <div class="empty">
                Bu tarihte maç bulunamadı.
            </div>

        `;

        return;

    }


    $('content').innerHTML = `

        <div class="matches">

            ${
                matches.map(
                    (match,index) =>
                        matchHtml(
                            match,
                            index
                        )
                ).join('')
            }

        </div>

    `;


    document
        .querySelectorAll(
            '[data-detail]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        const index =
                            button.dataset.detail;


                        const box =
                            document.getElementById(
                                'details-' + index
                            );


                        if(!box){
                            return;
                        }


                        const open =
                            box.classList.toggle(
                                'open'
                            );


                        button.textContent =
                            open
                                ? '− Önerileri gizle'
                                : '＋ Diğer öneriler';

                    }
                );

            }
        );

}


/* =========================================================
   VERİYİ YÜKLE
========================================================= */

async function load(){

    $('content').innerHTML = `

        <div class="loading">
            Maç verileri yükleniyor...
        </div>

    `;


    try{

        const response =
            await fetch(
                DATA_URL +
                '?t=' +
                Date.now(),
                {
                    cache:'no-store'
                }
            );


        if(!response.ok){

            throw new Error(
                'Veri dosyası alınamadı. HTTP ' +
                response.status
            );

        }


        const data =
            await response.json();


        if(
            !data ||
            !Array.isArray(
                data.matches
            )
        ){

            throw new Error(
                'matches.json formatı geçersiz.'
            );

        }


        state.matches =
            data.matches;


        buildIndex();


        /*
           Sayfa ilk açıldığında
           cihazın gerçek bugünü seç.
        */

        if(!state.selectedDate){

            setupCalendar();

        }else{

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

    }catch(error){

        console.error(error);


        $('summary').innerHTML = '';


        $('content').innerHTML = `

            <div class="error">

                <strong>
                    Veri yüklenemedi.
                </strong>

                <br><br>

                ${esc(error.message)}

                <br><br>

                <button
                    class="refresh"
                    type="button"
                    onclick="location.reload()"
                >
                    🔄 Tekrar dene
                </button>

            </div>

        `;

    }

}


/* =========================================================
   YENİLE
========================================================= */

$('refreshButton')
    .addEventListener(
        'click',
        function(){

            this.textContent =
                '⏳ Yükleniyor...';

            this.disabled = true;


            load().finally(
                () => {

                    this.textContent =
                        '🔄 Yenile';

                    this.disabled = false;

                }
            );

        }
    );


/* =========================================================
   BAŞLAT
========================================================= */

setupCalendarEvents();

load();
