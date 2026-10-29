(() => {
"use strict";
const DATA_URL = "./outputs/ml-predictions.json";
const $ = id => document.getElementById(id);
let payload = null;
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const pct = n => Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)}%` : "—";
const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString("tr-TR") : "—";
async function load() {
  $("status").textContent = "Tahmin dosyası yükleniyor...";
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
    render();
  } catch (e) {
    $("status").textContent = `Veri yüklenemedi: ${e.message}. Önce GitHub Actions sekmesinden “Mackolik ML eğitim ve tahmin” iş akışını çalıştırın.`;
    $("summary").innerHTML = "";
    $("metrics").innerHTML = "";
    $("matches").innerHTML = "";
  }
}
function renderSummary() {
  const cards = [
    ["Eğitim maçı",fmt(payload.trainingMatches)],
    ["Tahmin üretilen maç",fmt(payload.predictionCount)],
    ["Model",payload.model || "—"],
    ["Son üretim",payload.generatedAt ? new Date(payload.generatedAt).toLocaleString("tr-TR") : "—"]
  ];
  $("summary").innerHTML = cards.map(([label,value])=>`<div class="card"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`).join("");
}
function renderMetrics() {
  const names = {MS:"Maç Sonucu (1/X/2)",KG:"Karşılıklı Gol",U25:"2.5 Üst",IY15U:"İY 1.5 Üst"};
  const val = payload.validation || {};
  $("metrics").innerHTML = Object.keys(names).map(key=>{
    const m = val[key] || {};
    return `<div class="metric"><h3>${names[key]}</h3><p>Eğitim örneği: <b>${fmt(m.samples)}</b></p><p>Zaman sıralı test doğruluğu: <b>${m.validationAccuracy == null ? "Hesaplanamadı" : pct(m.validationAccuracy)}</b></p><p>Test maçı: <b>${fmt(m.validationSamples)}</b></p><p>Log loss: <b>${m.validationLogLoss == null ? "—" : m.validationLogLoss}</b></p><p>Brier skoru: <b>${m.validationBrier == null ? "—" : m.validationBrier}</b></p>${m.message?`<p>${esc(m.message)}</p>`:""}</div>`;
  }).join("");
}
function marketHtml(key, market) {
  if (!market) return "";
  const opts = market.options || [];
  return `<div class="market"><div class="market-title">${esc(market.title)}</div><div class="options">${opts.map(o=>{
    const best = o.title === market.pick;
    return `<div class="option ${best?"best":""}"><div>${esc(o.title)}</div><div class="pct">${pct(o.probability)}</div>${best?'<div class="pick">MODEL SEÇİMİ</div>':""}</div>`;
  }).join("")}</div></div>`;
}
function renderMatches() {
  const q = $("search").value.trim().toLocaleLowerCase("tr-TR");
  const marketFilter = $("market").value;
  const rows = (payload.predictions || []).filter(m => {
    const text = `${m.home} ${m.away} ${m.league}`.toLocaleLowerCase("tr-TR");
    return (!q || text.includes(q)) && (marketFilter === "all" || m.markets?.[marketFilter]);
  });
  if (!rows.length) {
    $("matches").innerHTML = '<div class="empty">Bu filtrede tahmin bulunamadı.</div>';
    return;
  }
  $("matches").innerHTML = rows.map(m=>{
    const marketKeys = marketFilter === "all" ? ["MS","KG","U25","IY15U"] : [marketFilter];
    const date = [m.date,m.time].filter(Boolean).join(" · ");
    return `<article class="match"><div class="match-head"><span>${esc(m.league || "Lig belirtilmemiş")}</span><span>${esc(date)}</span></div><div class="teams">${esc(m.home)} <span style="color:var(--muted)">—</span> ${esc(m.away)}</div>${marketKeys.map(k=>marketHtml(k,m.markets?.[k])).join("")}<div class="market-title">Kullanılan oran alanı: ${fmt(m.featuresAvailable)} · tahmin güveni, gerçekleşme garantisi değildir.</div></article>`;
  }).join("");
}
function render() {
  renderSummary(); renderMetrics(); renderMatches();
  $("status").textContent = `Son güncelleme: ${payload.generatedAt ? new Date(payload.generatedAt).toLocaleString("tr-TR") : "bilinmiyor"} · Atlanan maç: ${fmt(payload.skippedFixtures)} · Harici API kullanılmıyor.`;
}
$("search").addEventListener("input",renderMatches);
$("market").addEventListener("change",renderMatches);
$("refresh").addEventListener("click",load);
load();
})();