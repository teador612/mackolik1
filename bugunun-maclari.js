(function(){

'use strict';

const DATA_URL = './data/matches.json';
const START_DATE = '2026-09-01';

let MATCHES = [];
let HISTORICAL = [];
let OPENED = {};

const $ = id => document.getElementById(id);

function esc(v){
  return String(v == null ? '' : v)
    .replace(/[&<>"']/g,c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
}

function num(v){

  if(v == null || v === '') return NaN;

  if(typeof v === 'number'){
    return Number.isFinite(v) ? v : NaN;
  }

  const n = Number(
    String(v)
      .trim()
      .replace(',','.')
  );

  return Number.isFinite(n) ? n : NaN;
}

function isoDate(v){

  if(!v) return '';

  const s = String(v).trim();

  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    return s;
  }

  const m = s.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
  );

  if(!m) return '';

  return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
}

function today(){

  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dateTR(v){

  const p = String(v).split('-');

  return p.length === 3
    ? `${p[2]} ${monthName(p[1])} ${p[0]}`
    : v;
}

function monthName(m){

  const a = [
    '',
    'Oca','Şub','Mar','Nis','May','Haz',
    'Tem','Ağu','Eyl','Eki','Kas','Ara'
  ];

  return a[Number(m)] || m;
}

function score(v){

  if(!v) return null;

  const h = num(v.home);
  const a = num(v.away);

  if(Number.isFinite(h) && Number.isFinite(a)){
    return [h,a];
  }

  return null;
}

function scoreText(v){

  if(!v) return null;

  const m = String(v).match(
    /(\d+)\s*[-:]\s*(\d+)/
  );

  if(!m) return null;

  return [
    Number(m[1]),
    Number(m[2])
  ];
}

function getFT(m){

  let s = score(m.score);

  if(s) return s;

  s = score(m.fullTimeScore);

  if(s) return s;

  s = score(m.finalScore);

  if(s) return s;

  return scoreText(m.score);
}

function getHT(m){

  let s = score(m.halfTimeScore);

  if(s) return s;

  s = score(m.htScore);

  if(s) return s;

  return null;
}

function played(m){

  const ft = getFT(m);

  if(!ft) return false;

  const st = String(
    m.status == null ? '' : m.status
  ).toLowerCase();

  if(
    st === 'not_started' ||
    st === 'scheduled' ||
    st === 'upcoming' ||
    st === '0'
  ){
    return false;
  }

  return true;
}

/*
=========================================
ORANLARI NORMALLEŞTİR
=========================================
*/

function odds(m){

  const o =
    m.odds ||
    m.openingOdds ||
    m.opening ||
    m.markets ||
    {};

  const r = {};

  function add(name,...keys){

    for(const key of keys){

      const n = num(o[key]);

      if(Number.isFinite(n)){
        r[name] = n;
        return;
      }
    }
  }

  add('ms1','ms1');
  add('ms0','ms0','msX');
  add('ms2','ms2');

  add('kgVar','kgVar');
  add('kgYok','kgYok');

  add('over25','over25','au25Ust');
  add('under25','under25','au25Alt');

  add('iy1','iy1');
  add('iy0','iy0','iyX');
  add('iy2','iy2');

  add('iyOver05','iyOver05');
  add('iyOver15','iyOver15','iy15Ust');
  add('iyUnder15','iyUnder15','iy15Alt');

  return r;
}

function normalize(m){

  return {

    raw:m,

    code:String(
      m.code ||
      m.id ||
      ''
    ),

    date:isoDate(
      m.date ||
      m.matchDate
    ),

    time:String(
      m.time ||
      m.startTime ||
      ''
    ),

    league:String(
      m.league ||
      m.leagueName ||
      ''
    ),

    home:String(
      m.home ||
      m.homeTeam ||
      ''
    ),

    away:String(
      m.away ||
      m.awayTeam ||
      ''
    ),

    odds:odds(m),

    scoreFT:getFT(m),

    scoreHT:getHT(m),

    played:played(m)

  };
}

/*
=========================================
TAHMİN TÜRLERİ
=========================================
*/

const RESULTS = [

  {
    name:'MS1',
    keys:['ms1'],
    test:(ft)=>ft && ft[0] > ft[1]
  },

  {
    name:'MS0',
    keys:['ms0'],
    test:(ft)=>ft && ft[0] === ft[1]
  },

  {
    name:'MS2',
    keys:['ms2'],
    test:(ft)=>ft && ft[0] < ft[1]
  },

  {
    name:'KG Var',
    keys:['kgVar'],
    test:(ft)=>ft && ft[0] > 0 && ft[1] > 0
  },

  {
    name:'2,5 Üst',
    keys:['over25'],
    test:(ft)=>ft && ft[0] + ft[1] > 2.5
  },

  {
    name:'İY 0,5 Üst',
    keys:['iyOver05'],
    test:(ft,ht)=>ht && ht[0] + ht[1] > .5
  },

  {
    name:'İY 1,5 Üst',
    keys:['iyOver15'],
    test:(ft,ht)=>ht && ht[0] + ht[1] > 1.5
  }

];

/*
=========================================
ORAN EŞLEŞMESİ
=========================================
*/

function sameOdd(a,b){

  return Math.abs(
    Number(a)-Number(b)
  ) < .0001;
}

function historicalByOdd(match,key){

  const value = match.odds[key];

  if(!Number.isFinite(value)){
    return [];
  }

  return HISTORICAL.filter(h=>{

    const v = h.odds[key];

    return Number.isFinite(v) &&
           sameOdd(v,value);

  });
}

/*
=========================================
SONUÇ İSTATİSTİĞİ
=========================================
*/

function stat(list,result){

  let total=0;
  let success=0;

  for(const m of list){

    if(!m.scoreFT) continue;

    const ok =
      result.test(
        m.scoreFT,
        m.scoreHT
      );

    if(ok == null) continue;

    total++;

    if(ok) success++;
  }

  if(!total) return null;

  return {
    total,
    success,
    rate:(success/total)*100
  };
}

/*
=========================================
ANALİZ
=========================================
*/

function analyzeEach(match){

  const threshold =
    Math.max(
      0,
      Math.min(
        100,
        num($('tdThr').value) || 70
      )
    );

  const minSample =
    Math.max(
      1,
      Math.floor(
        num($('tdMin').value) || 5
      )
    );

  const minOdd =
    Math.max(
      1,
      num($('tdOdd').value) || 1.4
    );

  const output=[];

  for(const result of RESULTS){

    let oddKey=null;
    let oddValue=null;

    for(const key of result.keys){

      if(Number.isFinite(match.odds[key])){

        oddKey=key;
        oddValue=match.odds[key];

        break;
      }

    }

    if(!oddKey) continue;

    if(oddValue < minOdd) continue;

    const samples =
      historicalByOdd(
        match,
        oddKey
      );

    const s =
      stat(samples,result);

    if(!s) continue;

    if(s.total < minSample) continue;

    if(s.rate < threshold) continue;

    output.push({

      name:result.name,

      key:oddKey,

      odd:oddValue,

      rate:s.rate,

      total:s.total,

      success:s.success,

      samples:samples,

      result:result

    });

  }

  output.sort(
    (a,b)=>
      b.rate-a.rate ||
      b.total-a.total
  );

  return output;
}

/*
=========================================
BİRLEŞİK ANALİZ
=========================================
*/

function analyzeCombined(match,basis){

  const threshold =
    num($('tdThr').value) || 70;

  const minSample =
    Math.max(
      1,
      Math.floor(
        num($('tdMin').value) || 5
      )
    );

  const minOdd =
    num($('tdOdd').value) || 1.4;

  const keys =
    basis
      .split(',')
      .map(x=>x.trim());

  const pool =
    HISTORICAL.filter(h=>{

      return keys.every(key=>{

        const a=match.odds[key];
        const b=h.odds[key];

        return Number.isFinite(a) &&
               Number.isFinite(b) &&
               sameOdd(a,b);

      });

    });

  const output=[];

  for(const result of RESULTS){

    const s=stat(
      pool,
      result
    );

    if(!s) continue;

    if(s.total < minSample) continue;

    if(s.rate < threshold) continue;

    let odd=null;

    for(const key of result.keys){

      if(Number.isFinite(match.odds[key])){

        odd=match.odds[key];

        break;
      }

    }

    if(odd != null && odd < minOdd){
      continue;
    }

    output.push({

      name:result.name,

      key:null,

      odd,

      rate:s.rate,

      total:s.total,

      success:s.success,

      samples:pool,

      result

    });

  }

  return output.sort(
    (a,b)=>b.rate-a.rate
  );
}

/*
=========================================
ORANSIZ ANALİZ
=========================================
*/

function analyzeNoOdds(match,basis){

  const threshold =
    num($('tdThr').value) || 70;

  const minSample =
    Math.max(
      1,
      Math.floor(
        num($('tdMin').value) || 5
      )
    );

  let pool=[];

  if(basis==='league'){

    pool=HISTORICAL.filter(
      h=>h.league===match.league
    );

  }else if(basis==='team'){

    pool=HISTORICAL.filter(h=>
      h.home===match.home ||
      h.away===match.home ||
      h.home===match.away ||
      h.away===match.away
    );

  }else{

    pool=HISTORICAL.slice();

  }

  const output=[];

  for(const result of RESULTS){

    const s=stat(pool,result);

    if(!s) continue;

    if(s.total<minSample) continue;

    if(s.rate<threshold) continue;

    output.push({

      name:result.name,

      odd:null,

      rate:s.rate,

      total:s.total,

      success:s.success,

      samples:pool,

      result

    });

  }

  return output.sort(
    (a,b)=>b.rate-a.rate
  );
}

function analyze(match){

  const basis=$('tdBasis').value;

  if(basis==='each'){
    return analyzeEach(match);
  }

  if(
    basis==='league' ||
    basis==='team' ||
    basis==='all'
  ){
    return analyzeNoOdds(
      match,
      basis
    );
  }

  return analyzeCombined(
    match,
    basis
  );
}

/*
=========================================
ÖRNEKLEM SONUCU
=========================================
*/

function sampleHTML(sample,result){

  const ok =
    result.test(
      sample.scoreFT,
      sample.scoreHT
    );

  const score =
    sample.scoreFT
      ? `${sample.scoreFT[0]}-${sample.scoreFT[1]}`
      : '-';

  return `
    <div class="sample">

      <div class="sample-score">
        ${score}
      </div>

      <div class="sample-teams">

        <strong>
          ${esc(sample.home)}
          -
          ${esc(sample.away)}
        </strong>

        <span>
          ${esc(sample.date)}
          ·
          ${esc(sample.league)}
        </span>

      </div>

      <div class="sample-result ${ok?'win':'loss'}">
        ${ok?'✓':'✕'}
      </div>

    </div>
  `;
}

/*
=========================================
DETAY
=========================================
*/

function detailHTML(match,predictions){

  if(!predictions.length){

    return `
      <div class="no-sample">
        Bu maç için seçilen şartları sağlayan tahmin bulunamadı.
      </div>
    `;
  }

  return predictions.map((p,index)=>{

    const samples=p.samples || [];

    return `
      <div class="detail-prediction">

        <div class="detail-head">

          <div class="detail-name">
            ${esc(p.name)}
            ${
              p.odd != null
              ? ` · ${Number(p.odd).toFixed(2)}`
              : ''
            }
          </div>

          <div class="detail-rate">
            %${Number(p.rate).toFixed(1)}
          </div>

        </div>

        <div class="detail-meta">
          ${p.success} başarılı /
          ${p.total} geçmiş maç
        </div>

        <div class="samples">

          ${
            samples.length
              ? samples
                  .slice(0,50)
                  .map(s=>
                    sampleHTML(
                      s,
                      p.result
                    )
                  )
                  .join('')
              : `
                <div class="no-sample">
                  Örneklem bulunamadı.
                </div>
              `
          }

        </div>

      </div>
    `;

  }).join('');
}

/*
=========================================
MAÇ KARTI
=========================================
*/

function matchHTML(match,predictions,index){

  const id =
    `match_${index}`;

  const visible =
    predictions.slice(0,2);

  return `
    <div class="match">

      <div class="match-main">

        <button
          class="plus"
          data-id="${id}"
          aria-label="Detayları aç"
        >
          +
        </button>

        <div class="match-info">

          <div class="match-meta">
            <span>${esc(match.time || '--:--')}</span>
            <span>·</span>
            <span>${esc(match.league || '')}</span>
          </div>

          <div class="teams">
            ${esc(match.home)}
            -
            ${esc(match.away)}
          </div>

        </div>

        <div class="predictions">

          ${
            visible.length
              ? visible.map((p,i)=>`
                  <div class="prediction ${i===0?'best':''}">
                    ${esc(p.name)}
                    %${Number(p.rate).toFixed(1)}
                  </div>
                `).join('')
              : ''
          }

        </div>

      </div>

      <div
        class="match-detail"
        id="${id}"
      >
        ${detailHTML(match,predictions)}
      </div>

    </div>
  `;
}

/*
=========================================
TARİHLER
=========================================
*/

function fillDates(){

  const select=$('tdDate');

  const dates=[
    ...new Set(
      MATCHES
        .map(m=>m.date)
        .filter(Boolean)
    )
  ].sort();

  select.innerHTML='';

  const todayDate=today();

  for(const d of dates){

    const op=
      document.createElement('option');

    op.value=d;
    op.textContent=dateTR(d);

    if(d===todayDate){
      op.selected=true;
    }

    select.appendChild(op);
  }

  if(!select.value && dates.length){

    const nearest =
      dates.find(d=>d>=todayDate);

    select.value =
      nearest ||
      dates[dates.length-1];
  }
}

/*
=========================================
RENDER
=========================================
*/

function render(){

  const selectedDate=
    $('tdDate').value;

  const onlyIdeal=
    $('tdOnly').checked;

  const showAll=
    $('tdAll').checked;

  const matches=
    MATCHES
      .filter(m=>
        m.date===selectedDate &&
        !m.played
      )
      .sort((a,b)=>
        String(a.time)
          .localeCompare(
            String(b.time)
          )
      );

  let idealCount=0;
  let html='';
  let shown=0;

  for(let i=0;i<matches.length;i++){

    const match=matches[i];

    const predictions=
      analyze(match);

    if(predictions.length){
      idealCount++;
    }

    if(
      onlyIdeal &&
      predictions.length===0
    ){
      continue;
    }

    if(
      !showAll &&
      predictions.length===0
    ){
      continue;
    }

    html +=
      matchHTML(
        match,
        predictions,
        i
      );

    shown++;
  }

  $('statMatches').textContent=
    matches.length.toLocaleString('tr-TR');

  $('statIdeal').textContent=
    idealCount.toLocaleString('tr-TR');

  $('statPool').textContent=
    HISTORICAL.length.toLocaleString('tr-TR');

  $('tdStatus').textContent=
    `${dateTR(selectedDate)} · ${shown} maç gösteriliyor`;

  if(!shown){

    $('tdResults').innerHTML=`
      <div class="empty">
        Bu kriterlere uygun tahmin bulunan maç yok.
      </div>
    `;

    return;
  }

  $('tdResults').innerHTML=html;

  document
    .querySelectorAll('.plus')
    .forEach(button=>{

      button.addEventListener(
        'click',
        ()=>{

          const id=
            button.dataset.id;

          const detail=
            document.getElementById(id);

          if(!detail) return;

          const open=
            detail.classList.toggle('open');

          button.classList.toggle(
            'open',
            open
          );

          button.textContent=
            open ? '−' : '+';

        }
      );

    });
}

/*
=========================================
VERİYİ YÜKLE
=========================================
*/

async function load(){

  $('tdStatus').textContent=
    'Veriler yükleniyor...';

  try{

    const response=
      await fetch(
        DATA_URL +
        '?v=' +
        Date.now(),
        {
          cache:'no-store'
        }
      );

    if(!response.ok){
      throw new Error(
        'matches.json yüklenemedi'
      );
    }

    const data=
      await response.json();

    const raw=
      Array.isArray(data)
      ? data
      : Array.isArray(data.matches)
        ? data.matches
        : [];

    MATCHES=
      raw
        .map(normalize)
        .filter(m=>
          m.date &&
          m.home &&
          m.away
        );

    HISTORICAL=
      MATCHES.filter(m=>
        m.played &&
        m.date>=START_DATE
      );

    fillDates();

    render();

  }catch(error){

    console.error(error);

    $('tdStatus').textContent=
      'Veri yüklenemedi';

    $('tdResults').innerHTML=`
      <div class="empty">
        <b>Veriler yüklenemedi.</b>
        <br><br>
        data/matches.json kontrol edilmeli.
        <br><br>
        ${esc(error.message)}
      </div>
    `;
  }
}

/*
=========================================
EVENTLER
=========================================
*/

$('tdAnalyze')
  .addEventListener(
    'click',
    render
  );

$('tdRefresh')
  .addEventListener(
    'click',
    load
  );

$('tdDate')
  .addEventListener(
    'change',
    render
  );

$('tdBasis')
  .addEventListener(
    'change',
    render
  );

$('tdThr')
  .addEventListener(
    'change',
    render
  );

$('tdMin')
  .addEventListener(
    'change',
    render
  );

$('tdOdd')
  .addEventListener(
    'change',
    render
  );

$('tdOnly')
  .addEventListener(
    'change',
    render
  );

$('tdAll')
  .addEventListener(
    'change',
    render
  );

load();

})();
