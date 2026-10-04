(function(){

'use strict';

const DATA_URL = './data/matches.json';
const START_DATE = '2026-09-01';

let MATCHES = [];
let HISTORICAL = [];

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

  if(p.length !== 3) return v;

  const months = [
    '',
    'Oca','Şub','Mar','Nis','May','Haz',
    'Tem','Ağu','Eyl','Eki','Kas','Ara'
  ];

  return `${p[2]} ${months[Number(p[1])] || p[1]} ${p[0]}`;
}

/* =====================================================
   SKOR
===================================================== */

function scoreObject(v){

  if(!v || typeof v !== 'object') return null;

  const h = num(v.home);
  const a = num(v.away);

  if(
    Number.isFinite(h) &&
    Number.isFinite(a)
  ){
    return [h,a];
  }

  return null;
}

function scoreString(v){

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

  let s = scoreObject(m.score);

  if(s) return s;

  s = scoreObject(m.fullTimeScore);

  if(s) return s;

  s = scoreObject(m.finalScore);

  if(s) return s;

  return scoreString(m.score);
}

function getHT(m){

  let s = scoreObject(m.halfTimeScore);

  if(s) return s;

  s = scoreObject(m.htScore);

  if(s) return s;

  return null;
}

function isPlayed(m){

  const ft = getFT(m);

  if(!ft) return false;

  const status = String(
    m.status == null ? '' : m.status
  ).toLowerCase();

  if(
    status === 'not_started' ||
    status === 'scheduled' ||
    status === 'upcoming' ||
    status === '0'
  ){
    return false;
  }

  return true;
}

/* =====================================================
   ORANLAR
===================================================== */

function getOdds(m){

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

/* =====================================================
   NORMALIZE
===================================================== */

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

    odds:getOdds(m),

    scoreFT:getFT(m),

    scoreHT:getHT(m),

    played:isPlayed(m)

  };
}

/* =====================================================
   TAHMİN TÜRLERİ
===================================================== */

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

/* =====================================================
   ORAN EŞLEŞTİRME
===================================================== */

function sameOdd(a,b){

  return Math.abs(
    Number(a) - Number(b)
  ) < 0.0001;
}

function historicalByOdd(match,key){

  const currentOdd =
    match.odds[key];

  if(!Number.isFinite(currentOdd)){
    return [];
  }

  return HISTORICAL.filter(h=>{

    const oldOdd =
      h.odds[key];

    return Number.isFinite(oldOdd) &&
           sameOdd(
             oldOdd,
             currentOdd
           );

  });
}

/* =====================================================
   BAŞARI HESABI
===================================================== */

function getStat(list,result){

  let total = 0;
  let success = 0;

  for(const m of list){

    if(!m.scoreFT) continue;

    const ok =
      result.test(
        m.scoreFT,
        m.scoreHT
      );

    if(ok == null) continue;

    total++;

    if(ok){
      success++;
    }

  }

  if(!total){
    return null;
  }

  return {

    total,

    success,

    rate:
      success / total * 100

  };
}

/* =====================================================
   HER ORAN TEK TEK
===================================================== */

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

  const results = [];

  for(const result of RESULTS){

    let key = null;
    let odd = null;

    for(const k of result.keys){

      if(
        Number.isFinite(
          match.odds[k]
        )
      ){

        key = k;
        odd = match.odds[k];

        break;
      }

    }

    if(!key) continue;

    if(odd < minOdd) continue;

    const history =
      historicalByOdd(
        match,
        key
      );

    const stat =
      getStat(
        history,
        result
      );

    if(!stat) continue;

    if(stat.total < minSample) continue;

    if(stat.rate < threshold) continue;

    results.push({

      name:result.name,

      key,

      odd,

      rate:stat.rate,

      total:stat.total,

      success:stat.success

    });

  }

  return results.sort(
    (a,b)=>
      b.rate-a.rate ||
      b.total-a.total
  );
}

/* =====================================================
   BİRLEŞİK ORAN
===================================================== */

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

        const a =
          match.odds[key];

        const b =
          h.odds[key];

        return Number.isFinite(a) &&
               Number.isFinite(b) &&
               sameOdd(a,b);

      });

    });

  const results=[];

  for(const result of RESULTS){

    const stat =
      getStat(
        pool,
        result
      );

    if(!stat) continue;

    if(stat.total < minSample) continue;

    if(stat.rate < threshold) continue;

    let odd=null;

    for(const key of result.keys){

      if(
        Number.isFinite(
          match.odds[key]
        )
      ){

        odd =
          match.odds[key];

        break;
      }

    }

    if(
      odd != null &&
      odd < minOdd
    ){
      continue;
    }

    results.push({

      name:result.name,

      odd,

      rate:stat.rate,

      total:stat.total,

      success:stat.success

    });

  }

  return results.sort(
    (a,b)=>b.rate-a.rate
  );
}

/* =====================================================
   ORANSIZ
===================================================== */

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

    pool =
      HISTORICAL.filter(
        h =>
          h.league &&
          h.league === match.league
      );

  }
  else if(basis==='team'){

    pool =
      HISTORICAL.filter(h=>
        h.home === match.home ||
        h.away === match.home ||
        h.home === match.away ||
        h.away === match.away
      );

  }
  else{

    pool =
      HISTORICAL.slice();

  }

  const results=[];

  for(const result of RESULTS){

    const stat =
      getStat(
        pool,
        result
      );

    if(!stat) continue;

    if(stat.total < minSample) continue;

    if(stat.rate < threshold) continue;

    results.push({

      name:result.name,

      odd:null,

      rate:stat.rate,

      total:stat.total,

      success:stat.success

    });

  }

  return results.sort(
    (a,b)=>b.rate-a.rate
  );
}

/* =====================================================
   ANA ANALİZ
===================================================== */

function analyze(match){

  const basis =
    $('tdBasis').value;

  if(basis==='each'){

    return analyzeEach(
      match
    );

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

/* =====================================================
   TAHMİN KARTLARI
   + BASINCA SADECE DİĞER TAHMİNLER
===================================================== */

function predictionCards(predictions){

  if(!predictions.length){

    return `
      <div class="no-sample">
        Bu maç için şartları sağlayan başka tahmin bulunamadı.
      </div>
    `;

  }

  return predictions.map(p=>{

    return `
      <div style="
        background:#15270b;
        border:2px solid #4baf16;
        border-radius:14px;
        padding:11px 10px;
        text-align:center;
        min-width:145px;
        flex:1;
      ">

        <div style="
          color:#e9f4df;
          font-size:14px;
          font-weight:800;
        ">
          ${esc(p.name)}
        </div>

        <div style="
          color:#86ed43;
          font-size:25px;
          font-weight:900;
          margin-top:3px;
        ">
          %${Number(p.rate).toFixed(1)}
        </div>

        <div style="
          color:#91a2bb;
          font-size:12px;
          margin-top:2px;
        ">
          ${p.success}/${p.total}
        </div>

      </div>
    `;

  }).join('');
}

/* =====================================================
   GENİŞLETİLMİŞ MAÇ
===================================================== */

function expandedHTML(match,predictions){

  if(!predictions.length){

    return `
      <div style="
        color:#8798b1;
        font-size:12px;
      ">
        Şartları sağlayan başka tahmin bulunamadı.
      </div>
    `;

  }

  /*
    Burada ilk tahmini başlıktan çıkarıyoruz.
    + açılınca kalan tahminler gösteriliyor.
  */

  const first =
    predictions[0];

  const others =
    predictions.slice(1);

  return `

    <div style="
      color:#899ab3;
      font-size:12px;
      line-height:1.6;
      margin-bottom:10px;
    ">

      Her oran türü ayrı aranır ·
      ${dateTR(START_DATE)} ve sonrası ·
      eşik %${num($('tdThr').value) || 70} ·
      en az ${Math.floor(num($('tdMin').value) || 5)} maç

      ${
        first.key
          ? ` · ${predictions.length} oran`
          : ''
      }

    </div>

    ${
      others.length
        ? `
          <div style="
            display:flex;
            flex-wrap:wrap;
            gap:10px;
          ">
            ${predictionCards(others)}
          </div>
        `
        : `
          <div style="
            background:#101c2e;
            border:1px solid #243958;
            border-radius:12px;
            padding:13px;
            color:#8a9ab3;
            font-size:12px;
          ">
            Bu maç için ilk tahmin dışında
            başka şartları sağlayan tahmin yok.
          </div>
        `
    }

  `;
}

/* =====================================================
   MAÇ KARTI
===================================================== */

function matchHTML(
  match,
  predictions,
  index
){

  const id =
    `detail_${index}`;

  const best =
    predictions[0];

  const score =
    match.scoreFT
      ? `${match.scoreFT[0]} - ${match.scoreFT[1]}`
      : '';

  return `

    <div class="match">

      <div class="match-main">

        <button
          class="plus"
          data-detail="${id}"
        >
          +
        </button>

        <div class="match-info">

          <div class="match-meta">

            <span>
              ${esc(match.time || '--:--')}
            </span>

            <span>·</span>

            <span>
              ${esc(match.league || '')}
            </span>

          </div>

          <div class="teams">
            ${esc(match.home)}
            -
            ${esc(match.away)}
          </div>

        </div>

        <div class="predictions">

          ${
            score
              ? `
                <div style="
                  border:2px solid #29476b;
                  background:#10213a;
                  color:#12e6df;
                  border-radius:10px;
                  padding:7px 11px;
                  font-size:17px;
                  font-weight:900;
                  white-space:nowrap;
                ">
                  ${score}
                </div>
              `
              : ''
          }

          ${
            best
              ? `
                <div class="prediction best">
                  ${esc(best.name)}
                  %${Number(best.rate).toFixed(1)}
                </div>
              `
              : ''
          }

        </div>

      </div>

      <div
        class="match-detail"
        id="${id}"
      >

        ${expandedHTML(
          match,
          predictions
        )}

      </div>

    </div>

  `;
}

/* =====================================================
   TARİHLER
===================================================== */

function fillDates(){

  const select =
    $('tdDate');

  const dates =
    [
      ...new Set(
        MATCHES
          .map(m=>m.date)
          .filter(Boolean)
      )
    ]
    .sort();

  select.innerHTML='';

  const todayDate =
    today();

  for(const date of dates){

    const option =
      document.createElement(
        'option'
      );

    option.value =
      date;

    option.textContent =
      dateTR(date);

    if(date===todayDate){

      option.selected =
        true;

    }

    select.appendChild(
      option
    );

  }

  /*
    Bugün veri yoksa en yakın
    mevcut tarihi seç.
  */

  if(
    !select.value &&
    dates.length
  ){

    const nearest =
      dates.find(
        d=>d>=todayDate
      );

    select.value =
      nearest ||
      dates[dates.length-1];

  }

}

/* =====================================================
   RENDER
===================================================== */

function render(){

  const selectedDate =
    $('tdDate').value;

  const onlyIdeal =
    $('tdOnly').checked;

  /*
    EN ÖNEMLİ DEĞİŞİKLİK:

    Artık sadece oynanmamış maçlar değil,
    seçilen tarihteki TÜM maçlar geliyor.
  */

  const matches =
    MATCHES
      .filter(m=>
        m.date === selectedDate
      )
      .sort((a,b)=>
        String(a.time)
          .localeCompare(
            String(b.time)
          )
      );

  let html='';

  let idealCount=0;

  let shown=0;

  for(let i=0;i<matches.length;i++){

    const match =
      matches[i];

    const predictions =
      analyze(match);

    if(predictions.length){

      idealCount++;

    }

    /*
      "Sadece ideal sonucu olan maçlar"
      işaretliyse tahmini olmayanı gizle.
    */

    if(
      onlyIdeal &&
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

  $('statMatches').textContent =
    matches.length.toLocaleString(
      'tr-TR'
    );

  $('statIdeal').textContent =
    idealCount.toLocaleString(
      'tr-TR'
    );

  $('statPool').textContent =
    HISTORICAL.length.toLocaleString(
      'tr-TR'
    );

  $('tdStatus').textContent =
    `${dateTR(selectedDate)} · ${shown} maç`;

  if(!shown){

    $('tdResults').innerHTML = `

      <div class="empty">

        ${onlyIdeal
          ? 'Bu tarihte şartları sağlayan tahminli maç yok.'
          : 'Bu tarihte maç bulunamadı.'
        }

      </div>

    `;

    return;
  }

  $('tdResults').innerHTML =
    html;

  /*
    + / -
  */

  document
    .querySelectorAll('.plus')
    .forEach(button=>{

      button.addEventListener(
        'click',
        ()=>{

          const id =
            button.dataset.detail;

          const detail =
            document.getElementById(
              id
            );

          if(!detail) return;

          const isOpen =
            detail.classList.toggle(
              'open'
            );

          button.classList.toggle(
            'open',
            isOpen
          );

          button.textContent =
            isOpen
              ? '−'
              : '+';

        }
      );

    });

}

/* =====================================================
   VERİYİ YÜKLE
===================================================== */

async function load(){

  $('tdStatus').textContent =
    'Veriler yükleniyor...';

  try{

    const response =
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
        `matches.json HTTP ${response.status}`
      );

    }

    const data =
      await response.json();

    const raw =
      Array.isArray(data)
        ? data
        : Array.isArray(data.matches)
          ? data.matches
          : [];

    MATCHES =
      raw
        .map(normalize)
        .filter(m=>
          m.date &&
          m.home &&
          m.away
        );

    /*
      Geçmiş havuzu sadece
      gerçekten oynanmış maçlardan oluşur.
    */

    HISTORICAL =
      MATCHES.filter(m=>
        m.played &&
        m.date >= START_DATE
      );

    fillDates();

    render();

  }
  catch(error){

    console.error(error);

    $('tdStatus').textContent =
      'Veri yüklenemedi';

    $('tdResults').innerHTML = `

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

/* =====================================================
   EVENTLER
===================================================== */

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
