import fs from “fs”;

const FILE = “data/basketball-history.json”;

console.log(“🏀 BILYONER BASKETBOL TESTİ”);
console.log(”================================”);

if (!fs.existsSync(FILE)) {
console.log(“❌ Dosya bulunamadı:”, FILE);
process.exit(1);
}

const data = JSON.parse(
fs.readFileSync(FILE, “utf8”)
);

const matches = Array.isArray(data.matches)
? data.matches
: [];

console.log(“📦 Toplam maç:”, matches.length);

if (matches.length === 0) {
console.log(“❌ Basketbol maçı yok”);
process.exit(1);
}

const match =
matches.find(m => m.finished) ||
matches[0];

console.log(””);
console.log(“🏀 TEST MAÇI”);
console.log(”––––––––––––––––”);

console.log(
“Ev:”,
match.home ?? match.homeTeam ?? “?”
);

console.log(
“Deplasman:”,
match.away ?? match.awayTeam ?? “?”
);

console.log(
“Tarih:”,
match.date ?? “?”
);

console.log(
“ID:”,
match.id ?? “YOK”
);

console.log(
“matchId:”,
match.matchId ?? “YOK”
);

console.log(
“eventId:”,
match.eventId ?? “YOK”
);

console.log(
“slug:”,
match.slug ?? “YOK”
);

console.log(””);
console.log(“📋 ALANLAR:”);
console.log(
Object.keys(match).join(”, “)
);

console.log(””);
console.log(”================================”);
console.log(“✅ TEST DOSYASI ÇALIŞTI”);
