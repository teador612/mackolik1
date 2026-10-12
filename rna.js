
"use strict";

/* =========================================================
   RNA — OTOMATİK KUPON MOTORU

   Veri               : ./data/v2-data.json
   Geçmiş             : 30 gün
   Minimum örnek      : 8
   Minimum başarı     : %80
   Minimum tekli oran : 1.35
   Minimum kupon oran : 2.00
   Maksimum maç       : 5

   Eşleştirme:
   - Aynı market
   - Aynı iki ondalıklı oran
   - Her market kendi sonucuyla değerlendirilir
   ========================================================= */

(() => {
    const CONFIG = Object.freeze({
        DATA_URL: "./data/v2-data.json",
        HISTORY_DAYS: 30,
        MIN_SAMPLE: 8,
        MIN_SUCCESS: 80,
        MIN_ODD: 1.35,
        MIN_TOTAL_ODDS: 2.00,
        MAX_MATCHES: 5,
        FETCH_TIMEOUT: 20000
    });

    const MARKETS = [
        {
            key: "ms1", label: "MS 1",
            aliases: ["ms1", "MS1", "1", "MS 1", "ev sahibi", "home win"]
        },
        {
            key: "msX", label: "MS 0",
            aliases: ["msX", "ms0", "MSX", "MS0", "X", "MS X", "beraberlik", "draw"]
        },
        {
            key: "ms2", label: "MS 2",
            aliases: ["ms2", "MS2", "2", "MS 2", "deplasman", "away win"]
        },

        {
            key: "iy1", label: "İY 1",
            aliases: ["iy1", "İY1", "ht1", "iy 1", "ilk yari 1"]
        },
        {
            key: "iyX", label: "İY 0",
            aliases: ["iyX", "iy0", "İYX", "İY0", "htX", "iy x", "ilk yari x"]
        },
        {
            key: "iy2", label: "İY 2",
            aliases: ["iy2", "İY2", "ht2", "iy 2", "ilk yari 2"]
        },

        {
            key: "iy05Ust", label: "İY 0.5 Üst",
            aliases: ["iy05Ust", "iy05üst", "iy05_over", "iy 0.5 üst", "iy 0,5 üst"]
        },
        {
            key: "iy15Ust", label: "İY 1.5 Üst",
            aliases: ["iy15Ust", "iy15üst", "iy15_over", "iy 1.5 üst", "iy 1,5 üst"]
        },
        {
            key: "iy15Alt", label: "İY 1.5 Alt",
            aliases: ["iy15Alt", "iy15alt", "iy15_under", "iy 1.5 alt", "iy 1,5 alt"]
        },

        {
            key: "kgVar", label: "KG Var",
            aliases: ["kgVar", "KG Var", "kgvar", "bttsYes", "kg var", "karşılıklı gol var"]
        },
        {
            key: "kgYok", label: "KG Yok",
            aliases: ["kgYok", "KG Yok", "kgyok", "bttsNo", "kg yok", "karşılıklı gol yok"]
        },

        {
            key: "au15Ust", label: "1.5 Üst",
            aliases: ["au15Ust", "au15üst", "au15_over", "1.5 üst", "1,5 üst", "toplam 1.5 üst"]
        },
        {
            key: "au15Alt", label: "1.5 Alt",
            aliases: ["au15Alt", "au15alt", "au15_under", "1.5 alt", "1,5 alt", "toplam 1.5 alt"]
        },
        {
            key: "au25Ust", label: "2.5 Üst",
            aliases: ["au25Ust", "au25üst", "au25_over", "2.5 üst", "2,5 üst", "toplam 2.5 üst"]
        },
        {
            key: "au25Alt", label: "2.5 Alt",
            aliases: ["au25Alt", "au25alt", "au25_under", "2.5 alt", "2,5 alt", "toplam 2.5 alt"]
        },

        { key: "iyms11", label: "İY/MS 1/1", aliases: ["iyms11", "1/1", "1-1"] },
        { key: "iyms12", label: "İY/MS 1/2", aliases: ["iyms12", "1/2", "1-2"] },
        { key: "iyms21", label: "İY/MS 2/1", aliases: ["iyms21", "2/1", "2-1"] },
        { key: "iyms22", label: "İY/MS 2/2", aliases: ["iyms22", "2/2", "2-2"] },
        { key: "iyms00", label: "İY/MS 0/0", aliases: ["iyms00", "0/0", "x/x"] },
        { key: "iyms10", label: "İY/MS 1/0", aliases: ["iyms10", "1/0", "1/x"] },
        { key: "iyms20", label: "İY/MS 2/0", aliases: ["iyms20", "2/0", "2/x"] }
    ];

    const state = {
        matches: [],
        selectedDate: todayISO(),
        selectedMarkets: new Set(MARKETS.map(m => m.key)),
        historyCache: new Map(),
        loadError: "",
        diagnostics: {
            rawCount: 0,
            matchCount: 0,
            datedCount: 0,
            targetCount: 0,
            playedCount: 0,
            oddsCount: 0,
            historyGroups: 0,
            validHistoryGroups: 0
        }
    };

    const SCORE_FIELDS = [
        "score", "result", "fullTimeScore", "full_time_score",
        "macSonucu", "skor", "sonuc", "ftScore", "ft_score",
        "scoreFT", "score_ft", "finalScore"
    ];

    const DATE_FIELDS = [
        "date", "matchDate", "match_date", "datetime", "dateTime",
        "matchDatetime", "match_datetime", "kickoff", "kickOff",
        "startTime", "start_time", "eventDate", "event_date",
        "tarih", "macTarihi", "maçTarihi", "fixtureDate",
        "fixture_date", "timestamp", "matchTimestamp"
    ];

    const HOME_FIELDS = [
        "homeTeam", "home_team", "home", "homeName", "home_name",
        "evSahibi", "evSahibiTakim", "ev", "evTakim", "team1",
        "teamHome", "team_home", "host", "localTeam"
    ];

    const AWAY_FIELDS = [
        "awayTeam", "away_team", "away", "awayName", "away_name",
        "deplasman", "deplasmanTakim", "dep", "depTakim", "team2",
        "teamAway", "team_away", "visitor", "awaySide"
    ];

    const STATUS_FIELDS = [
        "status", "matchStatus", "match_status", "durum",
        "fixtureStatus", "fixture_status", "state"
    ];

    const HOME_SCORE_FIELDS = [
        "homeScore", "home_score", "scoreHome", "score_home",
        "evSahibiSkor", "evSkor", "homeGoals", "home_goals",
        "goalsHome", "goals_home", "ftHome", "ft_home"
    ];

    const AWAY_SCORE_FIELDS = [
        "awayScore", "away_score", "scoreAway", "score_away",
        "deplasmanSkor", "depSkor", "awayGoals", "away_goals",
        "goalsAway", "goals_away", "ftAway", "ft_away"
    ];

    const HALF_HOME_FIELDS = [
        "halfHomeScore", "half_home_score", "htHomeScore",
        "iyHomeScore", "iy_home_score", "firstHalfHomeScore",
        "homeHalfScore", "home_half_score"
    ];

    const HALF_AWAY_FIELDS = [
        "halfAwayScore", "half_away_score", "htAwayScore",
        "iyAwayScore", "iy_away_score", "firstHalfAwayScore",
        "awayHalfScore", "away_half_score"
    ];

    const HALF_SCORE_FIELDS = [
        "halfTimeScore", "half_time_score", "htScore", "ht_score",
        "iySkor", "ilkYariSkor", "firstHalfScore", "first_half_score",
        "scoreHT", "score_ht"
    ];

    function todayISO() {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    function normalizeKey(value) {
        return String(value ?? "")
            .trim()
            .toLocaleLowerCase("tr-TR")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ı/g, "i")
            .replace(/[\s_.-]+/g, "")
            .replace(/[()[\]]/g, "");
    }

    function number(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        if (value === null || value === undefined || value === "") return null;

        if (typeof value === "object") return null;

        let text = String(value).trim();

        // Sayı dışındaki karakterleri kaldır; ondalık virgülü destekle.
        text = text.replace(/\s/g, "").replace(/[^\d,.-]/g, "");

        if (text.includes(",") && text.includes(".")) {
            if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
                text = text.replace(/\./g, "").replace(",", ".");
            } else {
                text = text.replace(/,/g, "");
            }
        } else {
            text = text.replace(",", ".");
        }

        const result = Number(text);
        return Number.isFinite(result) ? result : null;
    }

    function getValue(object, names) {
        if (!object || typeof object !== "object" || Array.isArray(object)) {
            return undefined;
        }

        for (const name of names) {
            if (Object.prototype.hasOwnProperty.call(object, name)) {
                const value = object[name];
                if (value !== undefined && value !== null && value !== "") {
                    return value;
                }
            }
        }

        const wanted = new Set(names.map(normalizeKey));

        for (const [key, value] of Object.entries(object)) {
            if (wanted.has(normalizeKey(key)) &&
                value !== undefined &&
                value !== null &&
                value !== "") {
                return value;
            }
        }

        return undefined;
    }

    function normalizeDate(value) {
        if (value === null || value === undefined || value === "") return null;

        if (typeof value === "number") {
            // Unix timestamp saniye veya milisaniye olabilir.
            const milliseconds = value < 100000000000 ? value * 1000 : value;
            const date = new Date(milliseconds);
            return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
        }

        const raw = String(value).trim();
        if (!raw) return null;

        // ISO tarih: YYYY-MM-DD veya YYYY-MM-DDTHH:mm:ss...
        const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (iso) {
            return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
        }

        // Türkçe tarih: DD.MM.YYYY veya DD/MM/YYYY
        const local = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
        if (local) {
            return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
        }

        // DD-MM-YYYY biçimi
        const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (dash) {
            return `${dash[3]}-${dash[2].padStart(2, "0")}-${dash[1].padStart(2, "0")}`;
        }

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return null;

        // Tarih saat içermiyorsa UTC dönüşümünden gün kaydırma.
        if (!/[T ]\d{1,2}:\d{2}/.test(raw)) {
            return raw.slice(0, 10);
        }

        return parsed.toISOString().slice(0, 10);
    }

    function getMatchDate(match) {
        let raw = getValue(match, DATE_FIELDS);

        if (raw && typeof raw === "object") {
            raw = getValue(raw, ["date", "datetime", "value", "timestamp"]);
        }

        if (raw === undefined) {
            // Bazı JSON'larda tarih ayrı bir nesnenin içinde olabilir.
            for (const [key, value] of Object.entries(match || {})) {
                const k = normalizeKey(key);
                if (
                    (k.includes("date") || k.includes("tarih") || k.includes("kickoff")) &&
                    (typeof value === "string" || typeof value === "number")
                ) {
                    raw = value;
                    break;
                }
            }
        }

        return normalizeDate(raw);
    }

    function parseScore(value) {
        if (value && typeof value === "object") {
            const home = number(getValue(value, [
                "home", "homeScore", "home_score", "h", "ev", "homeGoals"
            ]));

            const away = number(getValue(value, [
                "away", "awayScore", "away_score", "a", "dep", "awayGoals"
            ]));

            if (home !== null && away !== null) return { home, away };
        }

        if (typeof value === "number") return null;
        if (typeof value !== "string") return null;

        const match = value.match(/(?:^|\D)(\d{1,2})\s*[-:–]\s*(\d{1,2})(?:\D|$)/);
        if (!match) return null;

        return { home: Number(match[1]), away: Number(match[2]) };
    }

    function getFullScore(match) {
        const directHome = number(getValue(match, HOME_SCORE_FIELDS));
        const directAway = number(getValue(match, AWAY_SCORE_FIELDS));

        if (directHome !== null && directAway !== null) {
            return { home: directHome, away: directAway };
        }

        const score = getValue(match, SCORE_FIELDS);
        const parsed = parseScore(score);
        if (parsed) return parsed;

        // Skor başka bir nesnenin altında bulunabilir.
        const nested = findScoreObject(match, false);
        return nested;
    }

    function getHalfScore(match) {
        const directHome = number(getValue(match, HALF_HOME_FIELDS));
        const directAway = number(getValue(match, HALF_AWAY_FIELDS));

        if (directHome !== null && directAway !== null) {
            return { home: directHome, away: directAway };
        }

        const half = getValue(match, HALF_SCORE_FIELDS);
        const parsed = parseScore(half);
        if (parsed) return parsed;

        return findScoreObject(match, true);
    }

    function findScoreObject(root, halfTime) {
        const seen = new Set();
        const queue = [{ value: root, depth: 0 }];

        const patterns = halfTime
            ? ["halftime", "firsthalf", "htscore", "iyskor", "ilkyari"]
            : ["fulltime", "finalscore", "ftscore", "macsonucu", "skor"];

        while (queue.length) {
            const current = queue.shift();
            const object = current.value;

            if (!object || typeof object !== "object" || seen.has(object)) continue;
            seen.add(object);

            if (Array.isArray(object)) {
                for (const child of object) {
                    if (child && typeof child === "object") {
                        queue.push({ value: child, depth: current.depth + 1 });
                    }
                }
                continue;
            }

            const home = number(getValue(object, [
                "homeScore", "home_score", "homeGoals", "home_goals", "evSkor"
            ]));
            const away = number(getValue(object, [
                "awayScore", "away_score", "awayGoals", "away_goals", "depSkor"
            ]));

            if (home !== null && away !== null) {
                const parentKeys = Object.keys(object).map(normalizeKey).join("|");
                const looksHalf = patterns.some(pattern => parentKeys.includes(pattern));

                if (!halfTime || looksHalf) return { home, away };
            }

            for (const [key, value] of Object.entries(object)) {
                if (typeof value === "string") {
                    const normalized = normalizeKey(key);
                    const isHalf = [
                        "halftimescore", "firsthalfscore", "htscore",
                        "iyskor", "ilkyariskor", "scoreht"
                    ].includes(normalized);

                    const isFull = [
                        "score", "result", "fulltimescore", "ftscore",
                        "macsonucu", "skor", "finalscore"
                    ].includes(normalized);

                    if ((halfTime && isHalf) || (!halfTime && isFull)) {
                        const parsed = parseScore(value);
                        if (parsed) return parsed;
                    }
                }

                if (value && typeof value === "object" && current.depth < 5) {
                    queue.push({ value, depth: current.depth + 1 });
                }
            }
        }

        return null;
    }

    function getTeamName(match, side) {
        const names = side === "home" ? HOME_FIELDS : AWAY_FIELDS;
        const value = getValue(match, names);

        if (value && typeof value === "object") {
            return String(getValue(value, ["name", "teamName", "team_name", "title", "displayName"]) ?? "Bilinmiyor");
        }

        if (value !== undefined) return String(value);

        // İç içe takımlar nesnesi desteği.
        const teams = getValue(match, ["teams", "takimlar", "participants"]);
        if (teams && typeof teams === "object") {
            const nested = getValue(teams, side === "home"
                ? ["home", "homeTeam", "ev", "team1"]
                : ["away", "awayTeam", "deplasman", "team2"]);

            if (nested && typeof nested === "object") {
                return String(getValue(nested, ["name", "teamName", "title"]) ?? "Bilinmiyor");
            }

            if (nested !== undefined) return String(nested);
        }

        return "Bilinmiyor";
    }

    function getMatchId(match, index) {
        const id = getValue(match, [
            "id", "matchId", "match_id", "fixtureId", "fixture_id",
            "eventId", "event_id", "gameId", "game_id"
        ]);

        if (id !== undefined) return String(id);

        // ID yoksa farklı maçların tek maç sayılmasını önle.
        return [
            getMatchDate(match) || "tarihsiz",
            getTeamName(match, "home"),
            getTeamName(match, "away"),
            index
        ].join("|");
    }

    function matchLabel(match) {
        return `${getTeamName(match, "home")} - ${getTeamName(match, "away")}`;
    }

    function getOddsRoots(match) {
        const roots = [];
        const keys = [
            "odds", "openingOdds", "opening_odds", "openOdds", "open_odds",
            "opening", "oranlar", "oran", "markets", "marketOdds",
            "market_odds", "oddsData", "odds_data", "prices", "iddaa",
            "iddaaOdds", "iddaa_odds"
        ];

        for (const key of keys) {
            const value = getValue(match, [key]);
            if (value && typeof value === "object") roots.push(value);
        }

        // Oranlar doğrudan maç nesnesinde tutuluyorsa onu da tara.
        roots.push(match);

        return [...new Set(roots)];
    }

    function getOddFromValue(value) {
        if (typeof value === "number" || typeof value === "string") {
            const parsed = number(value);
            return parsed !== null && parsed > 1 && parsed < 10000 ? parsed : null;
        }

        if (!value || typeof value !== "object") return null;

        // Market objesi { odd: 1.75 } veya { opening: 1.75 } olabilir.
        const price = getValue(value, [
            "odd", "odds", "oran", "price", "value", "opening",
            "openingOdd", "openingOdds", "opening_odd", "opening_odds",
            "acilis", "acilisOrani", "acilis_orani", "decimal", "decimalOdds"
        ]);

        if (price !== undefined && price !== value) {
            const parsed = number(price);
            if (parsed !== null && parsed > 1 && parsed < 10000) return parsed;
        }

        return null;
    }

    function findOddInTree(root, aliases) {
        const wanted = new Set(aliases.map(normalizeKey));
        const visited = new Set();
        const queue = [{ value: root, depth: 0 }];

        while (queue.length) {
            const { value, depth } = queue.shift();

            if (!value || typeof value !== "object" || visited.has(value)) continue;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item && typeof item === "object") {
                        // Dizi öğeleri {market:"MS1", odd:1.80} biçiminde olabilir.
                        const marketName = getValue(item, [
                            "market", "marketKey", "market_key", "name", "key",
                            "type", "label", "betType"
                        ]);

                        if (marketName !== undefined && wanted.has(normalizeKey(marketName))) {
                            const odd = getOddFromValue(item);
                            if (odd !== null) return odd;
                        }

                        if (depth < 5) queue.push({ value: item, depth: depth + 1 });
                    }
                }
                continue;
            }

            // Market adı nesnenin anahtarıysa değerinden oranı al.
            for (const [key, child] of Object.entries(value)) {
                if (wanted.has(normalizeKey(key))) {
                    const odd = getOddFromValue(child);
                    if (odd !== null) return odd;
                }
            }

            // Bazı dosyalarda marketler "name"/"key" alanı olan nesnelerde tutulur.
            const marketName = getValue(value, [
                "market", "marketKey", "market_key", "betType", "bet_type"
            ]);

            if (marketName !== undefined && wanted.has(normalizeKey(marketName))) {
                const odd = getOddFromValue(value);
                if (odd !== null) return odd;
            }

            if (depth < 5) {
                for (const child of Object.values(value)) {
                    if (child && typeof child === "object") {
                        queue.push({ value: child, depth: depth + 1 });
                    }
                }
            }
        }

        return null;
    }

    function getOdd(match, market) {
        const aliases = [market.key, market.label, ...market.aliases];

        for (const root of getOddsRoots(match)) {
            const found = findOddInTree(root, aliases);
            if (found !== null) return found;
        }

        return null;
    }

    // DNA yöntemi: market anahtarına ek olarak oranı iki basamağa sabitle.
    function oddKey(value) {
        const odd = number(value);
        return odd === null ? null : odd.toFixed(2);
    }

    function getMarketOutcome(match, market) {
        if (!market) return null;

        const full = getFullScore(match);
        const half = getHalfScore(match);

        switch (market.key) {
            case "ms1": return full ? full.home > full.away : null;
            case "msX": return full ? full.home === full.away : null;
            case "ms2": return full ? full.home < full.away : null;

            case "iy1": return half ? half.home > half.away : null;
            case "iyX": return half ? half.home === half.away : null;
            case "iy2": return half ? half.home < half.away : null;

            case "iy05Ust":
                return half ? half.home + half.away >= 1 : null;
            case "iy15Ust":
                return half ? half.home + half.away >= 2 : null;
            case "iy15Alt":
                return half ? half.home + half.away <= 1 : null;

            case "kgVar":
                return full ? full.home > 0 && full.away > 0 : null;
            case "kgYok":
                return full ? full.home === 0 || full.away === 0 : null;

            case "au15Ust":
                return full ? full.home + full.away >= 2 : null;
            case "au15Alt":
                return full ? full.home + full.away <= 1 : null;
            case "au25Ust":
                return full ? full.home + full.away >= 3 : null;
            case "au25Alt":
                return full ? full.home + full.away <= 2 : null;

            case "iyms11":
                return half && full ? half.home > half.away && full.home > full.away : null;
            case "iyms12":
                return half && full ? half.home > half.away && full.home < full.away : null;
            case "iyms21":
                return half && full ? half.home < half.away && full.home > full.away : null;
            case "iyms22":
                return half && full ? half.home < half.away && full.home < full.away : null;
            case "iyms00":
                return half && full ? half.home === half.away && full.home === full.away : null;
            case "iyms10":
                return half && full ? half.home > half.away && full.home === full.away : null;
            case "iyms20":
                return half && full ? half.home < half.away && full.home === full.away : null;

            default:
                return null;
        }
    }

    function isPlayed(match) {
        const full = getFullScore(match);
        if (!full) return false;

        const status = normalizeKey(getValue(match, STATUS_FIELDS));

        const unfinished = [
            "scheduled", "upcoming", "notstarted", "bekliyor",
            "ertelendi", "postponed", "cancelled", "canceled",
            "iptal", "oynanmadi", "oynanmamis"
        ];

        if (unfinished.includes(status)) return false;

        return true;
    }

    function collectMatchArrays(payload) {
        const results = [];
        const visited = new Set();
        const queue = [{ value: payload, depth: 0 }];

        while (queue.length) {
            const { value, depth } = queue.shift();

            if (!value || typeof value !== "object" || visited.has(value)) continue;
            visited.add(value);

            if (Array.isArray(value)) {
                const objects = value.filter(item =>
                    item && typeof item === "object" && !Array.isArray(item)
                );

                if (objects.length) {
                    const matchLikeCount = objects.filter(item => {
                        const hasDate = getMatchDate(item) !== null;
                        const hasTeams =
                            getTeamName(item, "home") !== "Bilinmiyor" ||
                            getTeamName(item, "away") !== "Bilinmiyor";
                        const hasOdds = MARKETS.some(market => getOdd(item, market) !== null);

                        return hasDate || hasTeams || hasOdds;
                    }).length;

                    if (matchLikeCount > 0) {
                        results.push({
                            rows: objects,
                            score: matchLikeCount / objects.length
                        });
                    }
                }

                if (depth < 6) {
                    for (const item of value) {
                        if (item && typeof item === "object") {
                            queue.push({ value: item, depth: depth + 1 });
                        }
                    }
                }

                continue;
            }

            if (depth < 6) {
                for (const child of Object.values(value)) {
                    if (child && typeof child === "object") {
                        queue.push({ value: child, depth: depth + 1 });
                    }
                }
            }
        }

        if (!results.length) return [];

        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.rows.length - a.rows.length;
        });

        // En uygun maç dizisini kullan; iç içe aynı kayıtları üst üste ekleme.
        return results[0].rows;
    }

    function normalizeMatches(payload) {
        if (Array.isArray(payload)) return payload;

        if (payload && Array.isArray(payload.matches)) return payload.matches;
        if (payload && Array.isArray(payload.data)) return payload.data;
        if (payload && Array.isArray(payload.fixtures)) return payload.fixtures;
        if (payload && Array.isArray(payload.events)) return payload.events;

        return collectMatchArrays(payload);
    }

    function setMessage(message, isError = false) {
        const element = document.getElementById("rnaMessage");
        if (!element) return;

        element.textContent = message;
        element.classList.toggle("error", isError);
    }

    async function loadData() {
        setMessage("Veriler yükleniyor…");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

        try {
            const url = `${CONFIG.DATA_URL}${CONFIG.DATA_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;

            const response = await fetch(url, {
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`JSON yüklenemedi: HTTP ${response.status}. Dosya yolu: ${CONFIG.DATA_URL}`);
            }

            const payload = await response.json();

            state.diagnostics.rawCount = Array.isArray(payload)
                ? payload.length
                : Object.keys(payload || {}).length;

            state.matches = normalizeMatches(payload);
            state.historyCache.clear();
            state.loadError = "";

            if (!state.matches.length) {
                throw new Error(
                    "JSON yüklendi fakat maç listesi bulunamadı. Dosyada maçların bulunduğu dizinin alan adı farklı olabilir."
                );
            }

            state.diagnostics.matchCount = state.matches.length;
            state.diagnostics.datedCount = state.matches.filter(m => getMatchDate(m)).length;
            state.diagnostics.playedCount = state.matches.filter(isPlayed).length;
            state.diagnostics.oddsCount = state.matches.reduce((count, match) =>
                count + MARKETS.filter(market => getOdd(match, market) !== null).length, 0
            );

            render();

            const dated = state.diagnostics.datedCount;
            const odds = state.diagnostics.oddsCount;

            if (dated === 0) {
                setMessage(
                    `JSON yüklendi (${state.matches.length} kayıt), ancak maç tarihleri tanınamadı. Analiz ayrıntılarını kontrol et.`,
                    true
                );
            } else if (odds === 0) {
                setMessage(
                    `JSON yüklendi (${state.matches.length} kayıt), ancak market oranları bulunamadı. Oran alanlarının gerçek adları gerekli.`,
                    true
                );
            } else {
                setMessage(`${state.matches.length} maç yüklendi · ${dated} tarihli kayıt · ${odds} oran alanı bulundu.`);
            }
        } catch (error) {
            state.loadError = error.message;
            console.error("[RNA] Veri yükleme hatası:", error);
            setMessage(`Veri yüklenemedi: ${error.message}`, true);
            renderDiagnosticsOnly();
        } finally {
            clearTimeout(timeout);
        }
    }

    function getHistoryWindow(targetDate) {
        // UTC gün başlangıçlarıyla hesapla; yerel saat nedeniyle tarih kaymasın.
        const end = new Date(`${targetDate}T00:00:00.000Z`);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - CONFIG.HISTORY_DAYS);

        return {
            start: start.toISOString().slice(0, 10),
            end: targetDate
        };
    }

    function buildHistoryIndex(targetDate) {
        const selected = [...state.selectedMarkets].sort().join(",");
        const cacheKey = `${targetDate}|${CONFIG.HISTORY_DAYS}|${selected}`;

        if (state.historyCache.has(cacheKey)) {
            return state.historyCache.get(cacheKey);
        }

        const window = getHistoryWindow(targetDate);
        const index = new Map();

        for (const match of state.matches) {
            const date = getMatchDate(match);

            if (!date || date < window.start || date >= window.end) continue;
            if (!isPlayed(match)) continue;

            for (const market of MARKETS) {
                if (!state.selectedMarkets.has(market.key)) continue;

                const odd = getOdd(match, market);
                if (odd === null || odd < CONFIG.MIN_ODD) continue;

                const result = getMarketOutcome(match, market);
                if (result === null) continue;

                const key = `${market.key}|${oddKey(odd)}`;

                if (!index.has(key)) {
                    index.set(key, {
                        marketKey: market.key,
                        odd: oddKey(odd),
                        sample: 0,
                        wins: 0,
                        losses: 0,
                        success: 0
                    });
                }

                const group = index.get(key);
                group.sample += 1;

                if (result) group.wins += 1;
                else group.losses += 1;
            }
        }

        for (const group of index.values()) {
            group.success = group.sample > 0
                ? group.wins / group.sample * 100
                : 0;
        }

        state.diagnostics.historyGroups = index.size;
        state.diagnostics.validHistoryGroups = [...index.values()].filter(group =>
            group.sample >= CONFIG.MIN_SAMPLE &&
            group.success >= CONFIG.MIN_SUCCESS
        ).length;

        state.historyCache.set(cacheKey, index);
        return index;
    }

    function analyzeMatch(match, index, matchIndex) {
        const candidates = [];
        const matchId = getMatchId(match, matchIndex);

        for (const market of MARKETS) {
            if (!state.selectedMarkets.has(market.key)) continue;

            const odd = getOdd(match, market);
            if (odd === null || odd < CONFIG.MIN_ODD) continue;

            const key = `${market.key}|${oddKey(odd)}`;
            const history = index.get(key);

            if (!history) continue;
            if (history.sample < CONFIG.MIN_SAMPLE) continue;
            if (history.success < CONFIG.MIN_SUCCESS) continue;

            candidates.push({
                match,
                matchId,
                matchName: matchLabel(match),
                date: getMatchDate(match),
                marketKey: market.key,
                marketLabel: market.label,
                odd,
                oddKey: oddKey(odd),
                sample: history.sample,
                wins: history.wins,
                losses: history.losses,
                success: history.success,
                result: getMarketOutcome(match, market)
            });
        }

        candidates.sort((a, b) =>
            b.success - a.success ||
            b.sample - a.sample ||
            a.odd - b.odd
        );

        return candidates;
    }

    function buildCoupon(candidates, minimumSuccess) {
        const coupon = [];
        const usedMatchIds = new Set();
        let totalOdds = 1;

        for (const item of candidates) {
            if (coupon.length >= CONFIG.MAX_MATCHES) break;
            if (item.success < minimumSuccess) continue;
            if (usedMatchIds.has(item.matchId)) continue;

            coupon.push(item);
            usedMatchIds.add(item.matchId);
            totalOdds *= item.odd;
        }

        if (coupon.length === 0 || totalOdds < CONFIG.MIN_TOTAL_ODDS) {
            return { items: [], totalOdds: 1 };
        }

        return { items: coupon, totalOdds };
    }

    function getCoupons(candidates) {
        // Her kupon kendi seçim havuzunu kullanır.
        // Güvenli kupondaki maçlar diğer kuponların adaylarını engellemez.
        return [
            {
                key: "safe",
                title: "Güvenli Kupon",
                threshold: 90,
                ...buildCoupon(candidates, 90)
            },
            {
                key: "medium",
                title: "Orta Risk Kupon",
                threshold: 85,
                ...buildCoupon(candidates, 85)
            },
            {
                key: "risk",
                title: "Riskli Kupon",
                threshold: 80,
                ...buildCoupon(candidates, 80)
            }
        ];
    }

    function getResultStatus(item) {
        const market = MARKETS.find(m => m.key === item.marketKey);
        const outcome = getMarketOutcome(item.match, market);

        if (outcome === true) return "success";
        if (outcome === false) return "failure";
        return "pending";
    }

    function statusLabel(status) {
        if (status === "success") return "Başarılı";
        if (status === "failure") return "Başarısız";
        return "Bekliyor";
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function formatPercent(value) {
        return `${Number(value).toFixed(1).replace(".", ",")}%`;
    }

    function ensureUI() {
        if (document.getElementById("rnaRoot")) return;

        const root = document.createElement("main");
        root.id = "rnaRoot";

        root.innerHTML = `
            <style>
                #rnaRoot {
                    color: #e5e7eb;
                    font-family: Arial, sans-serif;
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 16px;
                    box-sizing: border-box;
                }
                #rnaRoot * { box-sizing: border-box; }
                #rnaRoot .rna-panel {
                    background: #111827;
                    border: 1px solid #273449;
                    border-radius: 14px;
                    padding: 14px;
                    margin-bottom: 14px;
                }
                #rnaRoot h1 {
                    font-size: 23px;
                    margin: 0 0 8px;
                    color: #f9fafb;
                }
                #rnaRoot h2 {
                    font-size: 18px;
                    margin: 0 0 12px;
                    color: #f9fafb;
                }
                #rnaRoot .rna-muted {
                    color: #9ca3af;
                    font-size: 13px;
                    line-height: 1.5;
                }
                #rnaRoot .rna-controls {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    align-items: center;
                    margin-top: 12px;
                }
                #rnaRoot input,
                #rnaRoot select,
                #rnaRoot button {
                    font: inherit;
                    border-radius: 8px;
                    min-height: 40px;
                }
                #rnaRoot input,
                #rnaRoot select {
                    background: #0b1220;
                    color: #f9fafb;
                    border: 1px solid #374151;
                    padding: 8px 10px;
                }
                #rnaRoot button {
                    cursor: pointer;
                    color: white;
                    border: 0;
                    background: #2563eb;
                    padding: 9px 14px;
                    font-weight: 700;
                }
                #rnaRoot .rna-market-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
                    gap: 8px;
                }
                #rnaRoot .rna-market {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    border: 1px solid #374151;
                    background: #0b1220;
                    border-radius: 8px;
                    padding: 9px;
                    min-height: 38px;
                    font-size: 13px;
                }
                #rnaRoot .rna-market input { min-height: auto; }
                #rnaRoot .rna-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 12px;
                }
                #rnaRoot .rna-coupon {
                    background: #0b1220;
                    border: 1px solid #374151;
                    border-radius: 12px;
                    padding: 12px;
                    min-width: 0;
                }
                #rnaRoot .rna-coupon h3 {
                    font-size: 16px;
                    margin: 0 0 8px;
                }
                #rnaRoot .rna-total {
                    font-size: 20px;
                    font-weight: 800;
                    margin: 8px 0;
                }
                #rnaRoot .rna-leg {
                    padding: 10px 0;
                    border-top: 1px solid #273449;
                }
                #rnaRoot .rna-leg strong { color: #f9fafb; }
                #rnaRoot .rna-leg small {
                    display: block;
                    color: #9ca3af;
                    margin-top: 4px;
                    line-height: 1.45;
                }
                #rnaRoot .rna-status {
                    display: inline-block;
                    padding: 4px 7px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    margin-top: 5px;
                }
                #rnaRoot .success { color: #86efac; background: #052e16; }
                #rnaRoot .failure { color: #fca5a5; background: #450a0a; }
                #rnaRoot .pending { color: #fde68a; background: #422006; }
                #rnaRoot .error { color: #fca5a5; }
                #rnaRoot .rna-empty {
                    color: #9ca3af;
                    padding: 12px 0;
                    font-size: 13px;
                    line-height: 1.5;
                }
                #rnaRoot details summary {
                    cursor: pointer;
                    color: #d1d5db;
                    padding: 8px 0;
                }
                @media (max-width: 480px) {
                    #rnaRoot { padding: 10px; }
                    #rnaRoot .rna-panel { padding: 11px; }
                    #rnaRoot .rna-controls > * { flex: 1 1 100%; }
                    #rnaRoot h1 { font-size: 21px; }
                }
            </style>

            <section class="rna-panel">
                <h1>RNA | Otomatik Kupon</h1>
                <div class="rna-muted">
                    Geçmiş ${CONFIG.HISTORY_DAYS} gün · Minimum örnek ${CONFIG.MIN_SAMPLE} ·
                    Minimum başarı %${CONFIG.MIN_SUCCESS} · Minimum oran ${CONFIG.MIN_ODD.toFixed(2)}
                </div>
                <div class="rna-controls">
                    <label for="rnaDate">Maç tarihi</label>
                    <input type="date" id="rnaDate">
                    <button type="button" id="rnaRefresh">Verileri yenile</button>
                </div>
                <p id="rnaMessage" class="rna-muted" role="status">Hazırlanıyor…</p>
            </section>

            <section class="rna-panel">
                <h2>Market filtreleri</h2>
                <div class="rna-controls">
                    <button type="button" id="rnaSelectAll">Tümünü seç</button>
                    <button type="button" id="rnaSelectNone">Seçimi temizle</button>
                </div>
                <div id="rnaMarkets" class="rna-market-grid"></div>
            </section>

            <section class="rna-panel">
                <h2>Kuponlar</h2>
                <div id="rnaSummary" class="rna-muted"></div>
                <div id="rnaCoupons" class="rna-grid"></div>
            </section>

            <section class="rna-panel">
                <details>
                    <summary>Analiz ayrıntıları</summary>
                    <div id="rnaDiagnostics" class="rna-muted"></div>
                </details>
            </section>
        `;

        document.body.appendChild(root);

        const dateInput = root.querySelector("#rnaDate");
        dateInput.value = state.selectedDate;

        dateInput.addEventListener("change", () => {
            state.selectedDate = dateInput.value || todayISO();
            render();
        });

        root.querySelector("#rnaRefresh").addEventListener("click", loadData);

        root.querySelector("#rnaSelectAll").addEventListener("click", () => {
            state.selectedMarkets = new Set(MARKETS.map(m => m.key));
            state.historyCache.clear();
            renderMarketFilters();
            render();
        });

        root.querySelector("#rnaSelectNone").addEventListener("click", () => {
            state.selectedMarkets.clear();
            state.historyCache.clear();
            renderMarketFilters();
            render();
        });

        renderMarketFilters();
    }

    function renderMarketFilters() {
        const container = document.getElementById("rnaMarkets");
        if (!container) return;

        container.innerHTML = MARKETS.map(market => `
            <label class="rna-market">
                <input
                    type="checkbox"
                    data-market="${escapeHTML(market.key)}"
                    ${state.selectedMarkets.has(market.key) ? "checked" : ""}
                >
                <span>${escapeHTML(market.label)}</span>
            </label>
        `).join("");

        container.querySelectorAll("input[data-market]").forEach(input => {
            input.addEventListener("change", () => {
                const key = input.dataset.market;

                if (input.checked) state.selectedMarkets.add(key);
                else state.selectedMarkets.delete(key);

                state.historyCache.clear();
                render();
            });
        });
    }

    function renderCoupon(coupon) {
        const body = coupon.items.length
            ? coupon.items.map(item => {
                const status = getResultStatus(item);

                return `
                    <div class="rna-leg">
                        <strong>${escapeHTML(item.matchName)}</strong>
                        <small>
                            ${escapeHTML(item.marketLabel)} · Oran ${item.oddKey}<br>
                            Geçmiş: ${formatPercent(item.success)} ·
                            ${item.sample} maç (${item.wins} başarılı / ${item.losses} başarısız)
                        </small>
                        <span class="rna-status ${status}">${statusLabel(status)}</span>
                    </div>
                `;
            }).join("")
            : `<div class="rna-empty">Bu başarı eşiğinde yeterli eşleşme bulunamadı.</div>`;

        return `
            <article class="rna-coupon">
                <h3>${escapeHTML(coupon.title)} (%${coupon.threshold}+)</h3>
                <div class="rna-total">Toplam oran: ${coupon.totalOdds.toFixed(2)}</div>
                <div class="rna-muted">${coupon.items.length} / ${CONFIG.MAX_MATCHES} maç</div>
                ${body}
            </article>
        `;
    }

    function renderDiagnosticsOnly() {
        const diagnostics = document.getElementById("rnaDiagnostics");
        if (!diagnostics) return;

        diagnostics.innerHTML = `
            <p>Veri kaynağı: ${escapeHTML(CONFIG.DATA_URL)}</p>
            <p>Hata: ${escapeHTML(state.loadError || "Bilinmeyen hata")}</p>
        `;
    }

    function render() {
        ensureUI();

        const dateInput = document.getElementById("rnaDate");
        if (dateInput && dateInput.value !== state.selectedDate) {
            dateInput.value = state.selectedDate;
        }

        const datedMatches = state.matches.filter(match => getMatchDate(match) !== null);

        const targetMatches = datedMatches.filter(match =>
            getMatchDate(match) === state.selectedDate && !isPlayed(match)
        );

        const history = buildHistoryIndex(state.selectedDate);

        const candidates = [];

        for (let i = 0; i < targetMatches.length; i++) {
            candidates.push(...analyzeMatch(targetMatches[i], history, i));
        }

        /*
         * Bir maç için birden fazla market uygunsa en yüksek başarı oranına
         * sahip market kupona aday olur. Böylece aynı maç aynı kuponda iki
         * farklı tahmin olarak kullanılmaz.
         */
        const bestByMatch = new Map();

        for (const candidate of candidates) {
            const previous = bestByMatch.get(candidate.matchId);

            if (
                !previous ||
                candidate.success > previous.success ||
                (candidate.success === previous.success && candidate.sample > previous.sample) ||
                (
                    candidate.success === previous.success &&
                    candidate.sample === previous.sample &&
                    candidate.odd > previous.odd
                )
            ) {
                bestByMatch.set(candidate.matchId, candidate);
            }
        }

        const uniqueCandidates = [...bestByMatch.values()].sort((a, b) =>
            b.success - a.success ||
            b.sample - a.sample ||
            b.odd - a.odd
        );

        const coupons = getCoupons(uniqueCandidates);

        state.diagnostics.targetCount = targetMatches.length;

        const summary = document.getElementById("rnaSummary");
        if (summary) {
            summary.textContent =
                `${state.selectedDate} · ${targetMatches.length} oynanmamış maç · ` +
                `${uniqueCandidates.length} uygun maç · ${history.size} market/oran grubu`;
        }

        const couponContainer = document.getElementById("rnaCoupons");
        if (couponContainer) {
            couponContainer.innerHTML = coupons.map(renderCoupon).join("");
        }

        const diagnostics = document.getElementById("rnaDiagnostics");
        if (diagnostics) {
            const groups = [...history.values()];
            const validGroups = groups.filter(group =>
                group.sample >= CONFIG.MIN_SAMPLE &&
                group.success >= CONFIG.MIN_SUCCESS
            ).length;

            const missingDate = state.matches.length - datedMatches.length;
            const missingOdds = state.diagnostics.oddsCount === 0;

            diagnostics.innerHTML = `
                <p>Veri kaynağı: ${escapeHTML(CONFIG.DATA_URL)}</p>
                <p>Yüklenen maç kaydı: ${state.matches.length}</p>
                <p>Tarih alanı tanınan kayıt: ${datedMatches.length}</p>
                <p>Tarih alanı tanınmayan kayıt: ${missingDate}</p>
                <p>Skoru tamamlanmış kayıt: ${state.diagnostics.playedCount}</p>
                <p>Bulunan oran alanı sayısı: ${state.diagnostics.oddsCount}</p>
                <p>Seçili market sayısı: ${state.selectedMarkets.size}</p>
                <p>Seçilen tarihte oynanmamış maç: ${targetMatches.length}</p>
                <p>Geçmiş aralığı: ${CONFIG.HISTORY_DAYS} gün</p>
                <p>Geçmiş market/oran grubu: ${groups.length}</p>
                <p>Örnek ve başarı şartlarını karşılayan grup: ${validGroups}</p>
                <p>Minimum örnek: ${CONFIG.MIN_SAMPLE}</p>
                <p>Minimum başarı: %${CONFIG.MIN_SUCCESS}</p>
                <p>Oran eşleştirmesi: market anahtarı + iki ondalıklı oran</p>
                <p>Başarı hesabı: her market kendi gerçek sonucuna göre</p>
                ${missingOdds ? "<p>Oranlar bulunamadı. JSON'daki oran alanlarının gerçek yapısı kontrol edilmeli.</p>" : ""}
                ${targetMatches.length === 0 ? "<p>Seçili tarihte oynanmamış maç bulunamadı. Tarih alanlarını ve tarih seçimini kontrol et.</p>" : ""}
                ${groups.length === 0 ? "<p>Geçmiş grubu oluşturulamadı. Geçmiş tarih, skor veya oran alanları eşleşmiyor olabilir.</p>" : ""}
            `;
        }

        if (state.loadError) {
            setMessage(`Veri yükleme hatası: ${state.loadError}`, true);
        }
    }

    function init() {
        ensureUI();
        renderMarketFilters();
        loadData();
    }

    window.RNA = Object.freeze({
        config: CONFIG,
        markets: MARKETS,
        reload: loadData,
        render,
        getOdd,
        oddKey,
        getMatchDate,
        getFullScore,
        getHalfScore,
        getMarketOutcome,
        buildHistoryIndex
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
