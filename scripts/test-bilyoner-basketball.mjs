import { readFileSync, existsSync } from String.fromCodePoint(110,111,100,101,58,102,115);

const FILE = String.fromCodePoint(
100,97,116,97,47,98,97,115,107,101,116,98,97,108,108,
45,104,105,115,116,111,114,121,46,106,115,111,110
);

console.log(String.fromCodePoint(
127936,32,66,73,76,89,79,78,69,82,32,66,65,83,75,69,84,66,79,76
));

if (!existsSync(FILE)) {
console.log(String.fromCodePoint(100,111,115,121,97,32,121,111,107));
process.exit(1);
}

const data = JSON.parse(
readFileSync(FILE, String.fromCodePoint(117,116,102,56))
);

const matches =
Array.isArray(data.matches)
? data.matches
: [];

console.log(
String.fromCodePoint(77,97,99,32,115,97,121,105,115,105,58),
matches.length
);

if (!matches.length) {
console.log(String.fromCodePoint(
66,97,115,107,101,116,98,111,108,32,109,97,99,105,32,121,111,107
));
process.exit(1);
}

const match =
matches.find(
m => m && m.finished
) || matches[0];

console.log(””);
console.log(String.fromCodePoint(
84,69,83,84,32,77,65,67,73
));

console.log(
String.fromCodePoint(69,118,58),
match.home || match.homeTeam || String.fromCodePoint(63)
);

console.log(
String.fromCodePoint(68,101,112,108,97,115,109,97,110,58),
match.away || match.awayTeam || String.fromCodePoint(63)
);

console.log(
String.fromCodePoint(84,97,114,105,104,58),
match.date || String.fromCodePoint(63)
);

console.log(
String.fromCodePoint(73,68,58),
match.id || String.fromCodePoint(89,79,75)
);

console.log(
String.fromCodePoint(109,97,116,99,104,73,100,58),
match.matchId || String.fromCodePoint(89,79,75)
);

console.log(
String.fromCodePoint(101,118,101,110,116,73,100,58),
match.eventId || String.fromCodePoint(89,79,75)
);

console.log(
String.fromCodePoint(115,108,117,103,58),
match.slug || String.fromCodePoint(89,79,75)
);

console.log(””);
console.log(String.fromCodePoint(65,76,65,78,76,65,82,58));
console.log(Object.keys(match).join(
String.fromCodePoint(44,32)
));

console.log(””);
console.log(String.fromCodePoint(
84,69,83,84,32,66,65,83,65,82,73,76,73
));
