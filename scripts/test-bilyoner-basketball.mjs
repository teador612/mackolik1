const fs = await import(String.fromCharCode(110,111,100,101,58,102,115));

const file = [
100,97,116,97,47,98,97,115,107,101,116,98,97,108,108,
45,104,105,115,116,111,114,121,46,106,115,111,110
];

const path = String.fromCharCode(…file);

if (!fs.existsSync(path)) {
console.log(String.fromCharCode(68,79,83,89,65,32,89,79,75));
process.exit(1);
}

const json = fs.readFileSync(
path,
String.fromCharCode(117,116,102,56)
);

const data = JSON.parse(json);

const matches = Array.isArray(data.matches)
? data.matches
: [];

console.log(
String.fromCharCode(77,65,67,32,83,65,89,73,83,73),
matches.length
);

if (!matches.length) {
console.log(String.fromCharCode(77,65,67,32,89,79,75));
process.exit(1);
}

const match = matches.find(
m => m && m.finished
) || matches[0];

console.log(
String.fromCharCode(69,86),
match.home || match.homeTeam || String.fromCharCode(63)
);

console.log(
String.fromCharCode(68,69,80),
match.away || match.awayTeam || String.fromCharCode(63)
);

console.log(
String.fromCharCode(84,65,82,73,72),
match.date || String.fromCharCode(63)
);

console.log(
String.fromCharCode(73,68),
match.id || String.fromCharCode(89,79,75)
);

console.log(
String.fromCharCode(77,65,84,67,72,73,68),
match.matchId || String.fromCharCode(89,79,75)
);

console.log(
String.fromCharCode(69,86,69,78,84,73,68),
match.eventId || String.fromCharCode(89,79,75)
);

console.log(
String.fromCharCode(83,76,85,71),
match.slug || String.fromCharCode(89,79,75)
);

console.log(
String.fromCharCode(65,76,65,78,76,65,82)
);

console.log(
Object.keys(match).join(
String.fromCharCode(44,32)
)
);

console.log(
String.fromCharCode(84,69,83,84,32,66,65,83,65,82,73,76,73)
);
