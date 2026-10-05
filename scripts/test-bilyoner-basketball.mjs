import fs from “fs”;

const FILE = “data/basketball-history.json”;

const data = JSON.parse(
fs.readFileSync(FILE, “utf8”)
);

const matches = Array.isArray(data.matches)
? data.matches
: [];

console.log(🏀 Toplam maç: ${matches.length});

const finished = matches.filter(m => m?.finished);

console.log(🏁 Tamamlanan maç: ${finished.length});

if (!finished.length) {
console.log(“❌ Tamamlanmış basketbol maçı yok”);
process.exit(1);
}

// Öncelik sırasıyla kullanılabilecek kimlikleri bul
const match = finished.find(m =>
m.slug ||
m.id ||
m.matchId ||
m.eventId ||
m.sportscoreId
);

if (!match) {
console.log(“❌ Maç kimliği bulunamadı”);

console.log(
“Örnek kayıt:”
);

console.log(
JSON.stringify(finished[0], null, 2)
);

process.exit(1);
}

console.log(””);
console.log(”========================================”);
console.log(“🏀 BASKETBOL TEST MAÇI”);
console.log(”========================================”);

console.log(
🏠 ${match.home ?? match.homeTeam ?? "?"}
);

console.log(
✈️ ${match.away ?? match.awayTeam ?? "?"}
);

console.log(
📅 ${match.date ?? "?"}
);

console.log(
ID=${match.id ?? "?"}
);

console.log(
slug=${match.slug ?? "YOK"}
);

console.log(
matchId=${match.matchId ?? "YOK"}
);

console.log(
eventId=${match.eventId ?? "YOK"}
);

console.log(
sportscoreId=${match.sportscoreId ?? "YOK"}
);

console.log(””);
console.log(“📦 Kayıt alanları:”);

console.log(
Object.keys(match).join(”, “)
);

console.log(””);
console.log(”========================================”);

// Eğer slug varsa mevcut endpoint’i test et
if (match.slug) {

const url =
https://sportscore.com/api/widget/match/ +
?sport=basketball +
&slug=${encodeURIComponent(match.slug)};

console.log(“🔗 API:”);
console.log(url);

try {

const response = await fetch(url, {
  headers: {
    accept: "application/json",
    "user-agent": "Mozilla/5.0"
  }
});
console.log(
  `HTTP=${response.status}`
);
const text = await response.text();
if (!response.ok) {
  console.log("❌ Detay alınamadı");
  console.log(text.slice(0, 1000));
  process.exit(1);
}
let json;
try {
  json = JSON.parse(text);
} catch {
  console.log("❌ API JSON döndürmedi");
  console.log(text.slice(0, 1000));
  process.exit(1);
}
const matchData =
  json?.match ??
  json?.data ??
  json;
console.log("");
console.log(
  `SKOR=${matchData?.home_score ?? "?"}-${matchData?.away_score ?? "?"}`
);
const periods =
  matchData?.periods ??
  matchData?.scores ??
  matchData?.quarters ??
  matchData?.periodScores ??
  null;
if (periods) {
  console.log(
    "✅ PERİYOT VERİSİ VAR"
  );
  console.log(
    JSON.stringify(periods, null, 2)
  );
} else {
  console.log(
    "❌ Periyot alanı bulunamadı"
  );
  console.log(
    "ALANLAR=" +
    Object.keys(matchData || {}).join(",")
  );
}

} catch (error) {

console.log(
  `❌ HATA=${error.message}`
);
process.exit(1);

}

} else {

console.log(””);
console.log(“⚠️ Bu kayıtta slug yok.”);
console.log(””);
console.log(
“SportScore API testi için kullanılan kimlik:”
);

console.log(
JSON.stringify({
id: match.id ?? null,
matchId: match.matchId ?? null,
eventId: match.eventId ?? null,
sportscoreId: match.sportscoreId ?? null
}, null, 2)
);

console.log(””);
console.log(
“ℹ️ Önce history dosyasındaki gerçek kimlik alanını”
);

console.log(
“belirlememiz gerekiyor.”
);
}
