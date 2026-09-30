const state={matches:[],filters:{search:’’,date:’’,league:’’,unplayed:false}};
const $=id=>document.getElementById(id);
const esc=v=>String(v??’’).replace(/[&<>”’]/g,c=>({’&’:’&’,’<’:’<’,’>’:’>’,’”’:’"’,”’”:’'’}[c]));
const odd=v=>v==null||v===’’?’—’:Number.isFinite(Number(v))?Number(v).toFixed(2):’—’;
const score=v=>v?.home!=null&&v?.away!=null?${v.home} - ${v.away}:’—’;

function filteredMatches(){
const q=state.filters.search.toLocaleLowerCase(‘tr-TR’);
return state.matches.filter(m=>{
const text=${m.home??''} ${m.away??''} ${m.code??''}.toLocaleLowerCase(‘tr-TR’);
return (!q||text.includes(q))&&
(!state.filters.date||m.date===state.filters.date)&&
(!state.filters.league||m.league===state.filters.league)&&
(!state.filters.unplayed||(m.score?.home==null&&m.score?.away==null));
}).sort((a,b)=>{
const key=m=>{
const [d,mo,y]=String(m.date??’’).split(’.’);
return ${y??''}-${mo??''}-${d??''} ${m.time??''} ${m.code??''};
};
return key(a).localeCompare(key(b));
});
}

function render(){
const rows=filteredMatches();
$(‘message’).textContent=${rows.length} maç gösteriliyor.;
$(‘matches’).innerHTML=rows.map(m=>{
const o=m.openingOdds??{};
return `

   <td>${esc(m.date)}</td>
   <td>${esc(m.time??'—')}</td>
   <td>${esc(m.league)}</td>
   <td>${esc(m.code)}</td>
   <td>${esc(m.home)}</td>
   <td>${esc(m.away)}</td>
   <td>${esc(score(m.halfTimeScore))}</td>
   <td class="score">${esc(score(m.score))}</td>
   <td>${odd(o.ms1)}</td>
   <td>${odd(o.msX)}</td>
   <td>${odd(o.ms2)}</td>
   <td>${odd(o.kgVar)}</td>
   <td>${odd(o.kgYok)}</td>
   <td>${odd(o.au25Alt)}</td>
   <td>${odd(o.au25Ust)}</td>
  </tr>`;
 }).join('');
}

function fillFilters(){
const dates=[…new Set(state.matches.map(m=>m.date).filter(Boolean))].sort();
const leagues=[…new Set(state.matches.map(m=>m.league).filter(Boolean))].sort((a,b)=>a.localeCompare(b,‘tr’));
$(‘dateFilter’).innerHTML=’Tüm tarihler’+dates.map(v=><option value="${esc(v)}">${esc(v)}</option>).join(’’);
$(‘leagueFilter’).innerHTML=’Tüm ligler’+leagues.map(v=><option value="${esc(v)}">${esc(v)}</option>).join(’’);
}

$(‘search’).addEventListener(‘input’,e=>{state.filters.search=e.target.value;render()});
$(‘dateFilter’).addEventListener(‘change’,e=>{state.filters.date=e.target.value;render()});
$(‘leagueFilter’).addEventListener(‘change’,e=>{state.filters.league=e.target.value;render()});
$(‘unplayedOnly’).addEventListener(‘change’,e=>{state.filters.unplayed=e.target.checked;render()});

async function loadData(){
try{
$(‘message’).textContent=‘Veriler yükleniyor…’;

const url=new URL(’./data/matches.json’,document.baseURI);
url.searchParams.set(’_’,Date.now());

const response=await fetch(url.href,{cache:‘no-store’});

if(!response.ok){
throw new Error(HTTP ${response.status});
}

const data=await response.json();

if(!Array.isArray(data.matches)){
throw new Error(‘matches verisi bulunamadı’);
}

state.matches=data.matches;

$(‘updatedAt’).textContent=data.updatedAt
?Son güncelleme: ${new Date(data.updatedAt).toLocaleString('tr-TR')}
:‘Henüz veri yok’;

fillFilters();
render();

}catch(error){
console.error(‘Veri yükleme hatası:’,error);
$(‘matches’).innerHTML=’’;
$(‘message’).textContent=Veri yüklenemedi: ${error.message};
$(‘updatedAt’).textContent=‘Veri bağlantısı başarısız’;
}
}

loadData();
