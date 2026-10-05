const fs = await import(“node:fs”);

const FILE = “data/basketball-history.json”;

console.log(”========================================”);
console.log(“BILYONER BASKETBOL TEST”);
console.log(”========================================”);

if (!fs.existsSync(FILE)) {
console.log(“DOSYA YOK:”, FILE);
process.exit(1);
}

const raw = fs.readFileSync(FILE, “utf8”);

const data = JSON.parse(raw);

const matches = Array.isArray(data.matches)
? data.matches
: [];

console.log(“TOPLAM MAC:”, matches.length);

if (matches.length === 0) {
console.log(“MAC YOK”);
process.exit(1);
}

const match =
matches.find(function (m) {
return m && m.finished;
}) || matches[0];

console.log(””);
console.log(“TEST MACI”);
console.log(”––––––––––––––––––––”);

console.log(
“EV:”,
match.home || match.homeTeam || “YOK”
);

console.log(
“DEP:”,
match.away || match.awayTeam || “YOK”
);

console.log(
“TARIH:”,
match.date || “YOK”
);

console.log(
“ID:”,
match.id || “YOK”
);

console.log(
“MATCH ID:”,
match.matchId || “YOK”
);

console.log(
“EVENT ID:”,
match.eventId || “YOK”
);

console.log(
“SLUG:”,
match.slug || “YOK”
);

console.log(””);
console.log(“ALANLAR:”);
console.log(Object.keys(match).join(”, “));

console.log(””);
console.log(”========================================”);
console.log(“TEST BASARILI”);
console.log(”========================================”);
