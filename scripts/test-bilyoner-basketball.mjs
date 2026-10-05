import fs from “fs”;

const FILE = “data/basketball-history.json”;

if (!fs.existsSync(FILE)) {
console.log(❌ Dosya bulunamadı: ${FILE});
process.exit(1);
}

let data;

try {
data = JSON.parse(
fs.readFileSync(FILE, “utf8”)
);
} catch (error) {
console.log(❌ JSON okunamadı: ${error.message});
process.exit(1);
}

const matches = Array.isArray(data.matches)
? data.matches
: [];

console.log(””);
console.log(”========================================”);
console.log(“🏀 BILYONER BASKETBOL TESTİ”);
console.log(”========================================”);
console.log(📦 Toplam kayıt: ${matches.length});

if (!matches.length) {
console.log(“❌ Basketbol verisi yok”);
process.exit(1);
}

const finished = matches.filter(
m => m && m.finished
);

console.log(🏁 Tamamlanan maç: ${finished.length});

const match =
finished.find(
m =>
m.id ||
m.matchId ||
m.eventId ||
m.slug
) ||
matches.find(
m =>
m.id ||
m.matchId ||
m.eventId ||
m.slug
);

if (!match) {
console.log(“❌ Kullanılabilir maç kimliği bulunamadı”);

console.log(””);
console.log(“İlk kayıt:”);
console.log(
JSON.stringify(matches[0], null, 2)
);

process.exit(1);
}

console.log(””);
console.log(“🏀 TEST MAÇI”);
console.log(”––––––––––––––––––––”);

console.log(
Ev sahibi: ${match.home ?? match.homeTeam ?? "?"}
);

console.log(
Deplasman: ${match.away ?? match.awayTeam ?? "?"}
);

console.log(
Tarih: ${match.date ?? "?"}
);

console.log(
ID: ${match.id ?? "YOK"}
);

console.log(
matchId: ${match.matchId ?? "YOK"}
);

console.log(
eventId: ${match.eventId ?? "YOK"}
);

console.log(
slug: ${match.slug ?? "YOK"}
);

console.log(””);
console.log(“📋 ALANLAR:”);
console.log(
Object.keys(match).join(”, “)
);

console.log(””);
console.log(”========================================”);

console.log(””);
console.log(“ℹ️ Bu test dosyası artık slug zorunlu tutmuyor.”);
console.log(“ℹ️ Önce veri yapısını kontrol ediyor.”);
console.log(””);
console.log(
JSON.stringify(match, null, 2)
);
