
"use strict";

/* =========================================================
   RNA — V2 VERİ TABANLI OTOMATİK KUPON MOTORU
   Veri: ./data/v2-data.json
   Marketler: JSON içindeki markets dizisinden dinamik
   Geçmiş: 30 gün
   Minimum örnek: 8
   Minimum başarı: %80
   Minimum tekli oran: 1.35
   Minimum kupon oranı: 2.00
   Kupon başına maksimum: 5 maç
   Eşleştirme: Aynı market + birebir iki ondalıklı oran
   ========================================================= */

(() => {
    const CFG = Object.freeze({
        DATA_URL: "./data/v2-data.json",
        HISTORY_DAYS: 30,
        MIN_SAMPLE: 8,
        MIN_SUCCESS: 80,
        MIN_ODD: 1.35,
        MIN_TOTAL_ODDS: 2.00,
        MAX_MATCHES: 5,
        MAX_COUPONS: 3,
        FETCH_TIMEOUT: 20000
    });

    /*
     * Bu tanımlar JSON'daki market anahtarlarıyla eşleştirilir.
     * JSON içindeki markets dizisi, ekrandaki asıl market listesidir.
     */
    const MARKET_DEFS = [
        { key: "ms1", label: "MS 1" },
        { key: "msX", label: "MS 0" },
        { key: "ms2", label: "MS 2" },

        { key: "h12", label: "H12" },
        { key: "h0", label: "H0" },
        { key: "h23", label: "H23" },

        { key: "i14", label: "İ14" },
        { key: "olmaz", label: "OLMAZ" },
        { key: "i25", label: "İ25" },

        { key: "ms1Alt", label: "1 VE ALT" },
        { key: "msXAlt", label: "0 VE ALT" },
        { key: "ms2Alt", label: "2 VE ALT" },
        { key: "ms1Ust", label: "1 VE ÜST" },
        { key: "msXUst", label: "0 VE ÜST" },
        { key: "ms2Ust", label: "2 VE ÜST" },

        { key: "au25Alt", label: "2,5 ALT" },
        { key: "au25Ust", label: "2,5 ÜST" },
        { key: "au35Alt", label: "3,5 ALT" },
        { key: "au35Ust", label: "3,5 ÜST" },

        { key: "kgVar", label: "KG VAR" },
        { key: "kgYok", label: "KG YOK" },

        { key: "gol01", label: "0-1 GOL" },
        { key: "gol23", label: "2-3 GOL" },
        { key: "gol45", label: "4-5 GOL" },
        { key: "gol6plus", label: "6+ GOL" },

        { key: "iy1", label: "İY 1" },
        { key: "iyX", label: "İY 0" },
        { key: "iy2", label: "İY 2" },
        { key: "iy15Alt", label: "İY 1,5 ALT" },
        { key: "iy15Ust", label: "İY 1,5 ÜST" },

        { key: "iyms11", label: "İY/MS 1/1" },
        { key: "iyms10", label: "İY/MS 1/0" },
        { key: "iyms12", label: "İY/MS 1/2" },
        { key: "iyms01", label: "İY/MS 0/1" },
        { key: "iyms00", label: "İY/MS 0/0" },
        { key: "iyms02", label: "İY/MS 0/2" },
        { key: "iyms21", label: "İY/MS 2/1" },
        { key: "iyms20", label: "İY/MS 2/0" },
        { key: "iyms22", label: "İY/MS 2/2" }
    ];

    const UNSUPPORTED_OUTCOMES = new Set([
        "i14",
        "olmaz",
        "i25"
    ]);

    const $ = selector => document.querySelector(selector);

    let MARKETS = MARKET_DEFS.map(m => ({
        ...m,
        aliases: [m.key, m.label]
    }));

    const state = {
        rows: [],
        selectedDate: todayISO(),
        selectedMarkets: new Set(MARKET_DEFS.map(m => m.key)),
        historyCache: new Map(),
        loading: false,
        error: "",
        stats: {},
        controller: null
    };

    function todayISO() {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 10);
    }

    function norm(value) {
        return String(value ?? "")
            .trim()
            .toLocaleLowerCase("tr-TR")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ı/g, "i")
            .replace(/[\s_.-]+/g, "")
            .replace(/[()[\]]/g, "");
    }

    function num(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        if (value == null || value === "" || typeof value === "object") {
            return null;
        }

        let s = String(value)
            .trim()
            .replace(/\s/g, "")
            .replace(/[^\d,.-]/g, "");

        if (!s) return null;

        if (s.includes(",") && s.includes(".")) {
            s = s.lastIndexOf(",") > s.lastIndexOf(".")
                ? s.replace(/\./g, "").replace(",", ".")
                : s.replace(/,/g, "");
        } else {
            s = s.replace(",", ".");
        }

        const result = Number(s);
        return Number.isFinite(result) ? result : null;
    }

    function get(obj, aliases) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            return undefined;
        }

        for (const key of aliases) {
            if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
                return obj[key];
            }
        }

        const wanted = new Set(aliases.map(norm));

        for (const [key, value] of Object.entries(obj)) {
            if (wanted.has(norm(key)) && value != null && value !== "") {
                return value;
            }
        }

        return undefined;
    }

    function dateISO(value) {
        if (value == null || value === "") return null;

        if (typeof value === "number") {
            const d = new Date(value < 1e11 ? value * 1000 : value);
            return Number.isNaN(d.getTime())
                ? null
                : d.toISOString().slice(0, 10);
        }

        const s = String(value).trim();
        let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);

        if (m) {
            return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
        }

        m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);

        if (m) {
            return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }

        m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);

        if (m) {
            return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }

        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }

    function getDate(match) {
        let value = get(match, [
            "date", "matchDate", "match_date", "datetime", "dateTime",
            "kickoff", "startTime", "start_time", "eventDate",
            "tarih", "macTarihi", "maçTarihi", "fixtureDate", "timestamp"
        ]);

        if (value && typeof value === "object") {
            value = get(value, ["date", "datetime", "value", "timestamp"]);
        }

        return dateISO(value);
    }

    function getTeam(match, side) {
        const aliases = side === "home"
            ? [
                "homeTeam", "home_team", "home", "homeName", "home_name",
                "evSahibi", "evTakim", "team1", "host"
            ]
            : [
                "awayTeam", "away_team", "away", "awayName", "away_name",
                "deplasman", "depTakim", "team2", "visitor"
            ];

        let value = get(match, aliases);

        if (value && typeof value === "object") {
            value = get(value, [
                "name", "teamName", "team_name", "title", "displayName"
            ]);
        }

        if (value != null) return String(value);

        const teams = get(match, ["teams", "takimlar", "participants"]);

        if (teams && typeof teams === "object") {
            const nested = get(teams, side === "home"
                ? ["home", "homeTeam", "ev", "team1"]
                : ["away", "awayTeam", "deplasman", "team2"]);

            if (nested && typeof nested === "object") {
                return String(get(nested, ["name", "teamName", "title"]) ?? "Bilinmiyor");
            }

            if (nested != null) return String(nested);
        }

        return "Bilinmiyor";
    }

    function parseScore(value) {
        if (value && typeof value === "object") {
            const home = num(get(value, [
                "home", "homeScore", "home_score", "ev", "h"
            ]));

            const away = num(get(value, [
                "away", "awayScore", "away_score", "dep", "a"
            ]));

            if (home !== null && away !== null) {
                return { h: home, a: away };
            }
        }

        if (typeof value !== "string") return null;

        const match = value.match(/(?:^|\D)(\d{1,2})\s*[-:–]\s*(\d{1,2})(?:\D|$)/);

        return match
            ? { h: Number(match[1]), a: Number(match[2]) }
            : null;
    }

    function getScore(match, half = false) {
        const directHome = half
            ? [
                "halfHomeScore", "half_home_score", "htHomeScore",
                "iyHomeScore", "firstHalfHomeScore"
            ]
            : [
                "homeScore", "home_score", "scoreHome",
                "evSkor", "homeGoals", "ftHome"
            ];

        const directAway = half
            ? [
                "halfAwayScore", "half_away_score", "htAwayScore",
                "iyAwayScore", "firstHalfAwayScore"
            ]
            : [
                "awayScore", "away_score", "scoreAway",
                "depSkor", "awayGoals", "ftAway"
            ];

        const home = num(get(match, directHome));
        const away = num(get(match, directAway));

        if (home !== null && away !== null) {
            return { h: home, a: away };
        }

        const aliases = half
            ? [
                "halfTimeScore", "half_time_score", "htScore", "ht_score",
                "iySkor", "ilkYariSkor", "firstHalfScore", "scoreHT"
            ]
            : [
                "score", "result", "fullTimeScore", "full_time_score",
                "macSonucu", "skor", "ftScore", "finalScore"
            ];

        for (const alias of aliases) {
            const parsed = parseScore(get(match, [alias]));
            if (parsed) return parsed;
        }

        return null;
    }

    function isPlayed(match, full) {
        if (!full) return false;

        const status = norm(get(match, [
            "status", "matchStatus", "match_status", "durum", "state"
        ]));

        return ![
            "scheduled", "upcoming", "notstarted", "bekliyor",
            "ertelendi", "postponed", "cancelled", "canceled", "iptal"
        ].includes(status);
    }

    function outcome(key, full, half) {
        const total = full ? full.h + full.a : null;
        const halfTotal = half ? half.h + half.a : null;

        switch (key) {
            case "ms1": return full ? full.h > full.a : null;
            case "msX": return full ? full.h === full.a : null;
            case "ms2": return full ? full.h < full.a : null;

            // Çifte şans marketleri
            case "h12": return full ? full.h !== full.a : null;
            case "h0": return full ? full.h >= full.a : null;
            case "h23": return full ? full.h <= full.a : null;

            case "iy1": return half ? half.h > half.a : null;
            case "iyX": return half ? half.h === half.a : null;
            case "iy2": return half ? half.h < half.a : null;

            case "iy15Ust": return half ? halfTotal >= 2 : null;
            case "iy15Alt": return half ? halfTotal <= 1 : null;

            case "kgVar": return full ? full.h > 0 && full.a > 0 : null;
            case "kgYok": return full ? full.h === 0 || full.a === 0 : null;

            case "au25Ust": return full ? total >= 3 : null;
            case "au25Alt": return full ? total <= 2 : null;
            case "au35Ust": return full ? total >= 4 : null;
            case "au35Alt": return full ? total <= 3 : null;

            case "gol01": return full ? total <= 1 : null;
            case "gol23": return full ? total >= 2 && total <= 3 : null;
            case "gol45": return full ? total >= 4 && total <= 5 : null;
            case "gol6plus": return full ? total >= 6 : null;

            /*
             * "1 VE ALT/ÜST" gibi birleşik marketlerin alt/üst
             * sınırı, market adından tek başına kesinleşmediği için
             * bunlar yanlış varsayımla sonuçlandırılmaz.
             */

            case "iyms11":
                return half && full
                    ? half.h > half.a && full.h > full.a
                    : null;

            case "iyms10":
                return half && full
                    ? half.h > half.a && full.h === full.a
                    : null;

            case "iyms12":
                return half && full
                    ? half.h > half.a && full.h < full.a
                    : null;

            case "iyms01":
                return half && full
                    ? half.h === half.a && full.h > full.a
                    : null;

            case "iyms00":
                return half && full
                    ? half.h === half.a && full.h === full.a
                    : null;

            case "iyms02":
                return half && full
                    ? half.h === half.a && full.h < full.a
                    : null;

            case "iyms21":
                return half && full
                    ? half.h < half.a && full.h > full.a
                    : null;

            case "iyms20":
                return half && full
                    ? half.h < half.a && full.h === full.a
                    : null;

            case "iyms22":
                return half && full
                    ? half.h < half.a && full.h < full.a
                    : null;

            default:
                return null;
        }
    }

    function oddValue(value) {
        if (value && typeof value === "object") {
            value = get(value, [
                "odd", "odds", "oran", "price", "value", "opening",
                "openingOdd", "openingOdds", "acilis", "acilisOrani",
                "decimal", "decimalOdds"
            ]);
        }

        const n = num(value);
        return n !== null && n > 1 && n < 10000 ? n : null;
    }

    function buildMarkets(payload) {
        const catalog = Array.isArray(payload?.markets)
            ? payload.markets
            : [];

        if (!catalog.length) {
            MARKETS = MARKET_DEFS.map(m => ({
                ...m,
                aliases: [m.key, m.label]
            }));
        } else {
            MARKETS = catalog
                .filter(item => item && item.key)
                .map(item => {
                    const fallback = MARKET_DEFS.find(
                        market => norm(market.key) === norm(item.key)
                    );

                    return {
                        key: String(item.key),
                        label: String(item.name ?? fallback?.label ?? item.key),
                        aliases: [
                            String(item.key),
                            String(item.name ?? ""),
                            ...(fallback?.aliases ?? [])
                        ].filter(Boolean)
                    };
                });
        }

        const availableKeys = new Set(MARKETS.map(m => m.key));

        // İlk yüklemede seçili olanları koru; yeni marketleri de seç.
        for (const market of MARKETS) {
            if (!state._marketSelectionInitialized ||
                state.selectedMarkets.has(market.key) ||
                MARKET_DEFS.some(m => m.key === market.key)) {
                state.selectedMarkets.add(market.key);
            }
        }

        for (const key of [...state.selectedMarkets]) {
            if (!availableKeys.has(key)) state.selectedMarkets.delete(key);
        }

        state._marketSelectionInitialized = true;
    }

    function extractOdds(match) {
        const odds = Object.create(null);
        const marketAliases = new Map();

        for (const market of MARKETS) {
            for (const alias of [market.key, market.label, ...(market.aliases || [])]) {
                marketAliases.set(norm(alias), market.key);
            }
        }

        const roots = [];
        const rootNames = [
            "odds", "openingOdds", "opening_odds", "openOdds",
            "open_odds", "opening", "oranlar", "oran", "markets",
            "marketOdds", "market_odds", "oddsData", "prices",
            "iddaa", "iddaaOdds"
        ];

        for (const name of rootNames) {
            const value = get(match, [name]);
            if (value && typeof value === "object") roots.push(value);
        }

        roots.push(match);

        const queue = roots.map(value => ({ value, depth: 0 }));
        const seen = new Set();

        while (queue.length) {
            const { value, depth } = queue.pop();

            if (!value || typeof value !== "object" || seen.has(value)) continue;
            seen.add(value);

            if (Array.isArray(value)) {
                for (const item of value) {
                    if (!item || typeof item !== "object") continue;

                    const name = get(item, [
                        "market", "marketKey", "market_key",
                        "name", "key", "type", "label", "betType"
                    ]);

                    if (name != null) {
                        const key = marketAliases.get(norm(name));
                        const odd = oddValue(item);

                        if (key && odd !== null && odds[key] === undefined) {
                            odds[key] = odd;
                        }
                    }

                    if (depth < 3) {
                        queue.push({ value: item, depth: depth + 1 });
                    }
                }

                continue;
            }

            for (const [name, child] of Object.entries(value)) {
                const key = marketAliases.get(norm(name));

                if (key && odds[key] === undefined) {
                    const odd = oddValue(child);
                    if (odd !== null) odds[key] = odd;
                }

                if (depth < 3 && child && typeof child === "object") {
                    queue.push({ value: child, depth: depth + 1 });
                }
            }

            const name = get(value, [
                "market", "marketKey", "market_key", "betType", "bet_type"
            ]);

            if (name != null) {
                const key = marketAliases.get(norm(name));
                const odd = oddValue(value);

                if (key && odd !== null && odds[key] === undefined) {
                    odds[key] = odd;
                }
            }
        }

        return odds;
    }

    function flattenMatches(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== "object") return [];

        for (const key of [
            "matches", "fixtures", "events", "results", "rows", "records"
        ]) {
            if (Array.isArray(payload[key])) return payload[key];
        }

        if (Array.isArray(payload.data)) {
            if (payload.data.some(item =>
                item && typeof item === "object" &&
                (getDate(item) || getTeam(item, "home") !== "Bilinmiyor")
            )) {
                return payload.data;
            }
        }

        const candidates = [];
        const queue = [{ value: payload, depth: 0 }];
        const seen = new Set();

        while (queue.length) {
            const { value, depth } = queue.pop();

            if (!value || typeof value !== "object" || seen.has(value)) continue;
            seen.add(value);

            if (Array.isArray(value)) {
                const rows = value.filter(item =>
                    item && typeof item === "object" && !Array.isArray(item)
                );

                if (rows.length) {
                    let score = 0;

                    for (const row of rows.slice(0, 30)) {
                        if (getDate(row)) score += 3;
                        if (getTeam(row, "home") !== "Bilinmiyor") score += 2;
                        if (getTeam(row, "away") !== "Bilinmiyor") score += 2;
                        if (getScore(row)) score++;
                    }

                    candidates.push({ rows, score, length: rows.length });
                }

                continue;
            }

            if (depth < 4) {
                for (const child of Object.values(value)) {
                    if (child && typeof child === "object") {
                        queue.push({ value: child, depth: depth + 1 });
                    }
                }
            }
        }

        candidates.sort((a, b) =>
            b.score - a.score || b.length - a.length
        );

        return candidates[0]?.rows || [];
    }

    function prepareRows(payload) {
        buildMarkets(payload);

        const raw = flattenMatches(payload);
        const rows = [];

        for (let i = 0; i < raw.length; i++) {
            const match = raw[i];
            const date = getDate(match);
            const home = getTeam(match, "home");
            const away = getTeam(match, "away");
            const full = getScore(match);
            const half = getScore(match, true);
            const odds = extractOdds(match);
            const results = Object.create(null);

            for (const market of MARKETS) {
                results[market.key] = UNSUPPORTED_OUTCOMES.has(market.key)
                    ? null
                    : outcome(market.key, full, half);
            }

            rows.push({
                id: String(get(match, [
                    "id", "matchId", "match_id", "fixtureId", "eventId", "gameId"
                ]) ?? `${date || "tarihsiz"}|${home}|${away}|${i}`),
                date,
                home,
                away,
                name: `${home} - ${away}`,
                full,
                half,
                played: isPlayed(match, full),
                odds,
                results
            });
        }

        state.stats = {
            rawCount: raw.length,
            datedCount: rows.filter(row => row.date).length,
            playedCount: rows.filter(row => row.played).length,
            oddsCount: rows.reduce(
                (sum, row) => sum + Object.keys(row.odds).length,
                0
            ),
            marketCount: MARKETS.length,
            unsupportedMarketCount: MARKETS.filter(
                market => UNSUPPORTED_OUTCOMES.has(market.key)
            ).length
        };

        return rows;
    }

    function getHistory(targetDate) {
        const marketKeys = [...state.selectedMarkets].sort();
        const cacheKey = `${targetDate}|${marketKeys.join(",")}`;

        if (state.historyCache.has(cacheKey)) {
            return state.historyCache.get(cacheKey);
        }

        const end = new Date(`${targetDate}T00:00:00.000Z`);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - CFG.HISTORY_DAYS);

        const startDate = start.toISOString().slice(0, 10);
        const index = new Map();

        for (const row of state.rows) {
            if (
                !row.date ||
                row.date < startDate ||
                row.date >= targetDate ||
                !row.played
            ) {
                continue;
            }

            for (const marketKey of marketKeys) {
                const odd = row.odds[marketKey];
                const result = row.results[marketKey];

                if (
                    odd === undefined ||
                    odd < CFG.MIN_ODD ||
                    result === null ||
                    result === undefined
                ) {
                    continue;
                }

                const oddKey = odd.toFixed(2);
                const key = `${marketKey}|${oddKey}`;

                let group = index.get(key);

                if (!group) {
                    group = {
                        marketKey,
                        odd: oddKey,
                        sample: 0,
                        wins: 0,
                        losses: 0
                    };
                    index.set(key, group);
                }

                group.sample++;

                if (result === true) group.wins++;
                else group.losses++;
            }
        }

        for (const group of index.values()) {
            group.success = group.wins / group.sample * 100;
        }

        state.historyCache.set(cacheKey, index);

        while (state.historyCache.size > 4) {
            state.historyCache.delete(state.historyCache.keys().next().value);
        }

        return index;
    }

    function analyzeTargetMatches(targetDate, history) {
        const matches = state.rows.filter(row =>
            row.date === targetDate && !row.played
        );

        const candidates = [];

        for (const row of matches) {
            let best = null;

            for (const marketKey of state.selectedMarkets) {
                const odd = row.odds[marketKey];

                if (odd === undefined || odd < CFG.MIN_ODD) continue;

                const group = history.get(`${marketKey}|${odd.toFixed(2)}`);

                if (
                    !group ||
                    group.sample < CFG.MIN_SAMPLE ||
                    group.success < CFG.MIN_SUCCESS
                ) {
                    continue;
                }

                const market = MARKETS.find(item => item.key === marketKey);

                const candidate = {
                    row,
                    matchId: row.id,
                    name: row.name,
                    marketKey,
                    marketLabel: market?.label || marketKey,
                    odd,
                    oddKey: odd.toFixed(2),
                    sample: group.sample,
                    wins: group.wins,
                    losses: group.losses,
                    success: group.success
                };

                if (
                    !best ||
                    candidate.success > best.success ||
                    (
                        candidate.success === best.success &&
                        candidate.sample > best.sample
                    )
                ) {
                    best = candidate;
                }
            }

            if (best) candidates.push(best);
        }

        return candidates.sort((a, b) =>
            b.success - a.success ||
            b.sample - a.sample ||
            b.odd - a.odd
        );
    }

    function buildCoupon(candidates, threshold) {
        const items = [];
        const used = new Set();
        let totalOdds = 1;

        for (const item of candidates) {
            if (items.length >= CFG.MAX_MATCHES) break;
            if (item.success < threshold || used.has(item.matchId)) continue;

            items.push(item);
            used.add(item.matchId);
            totalOdds *= item.odd;
        }

        if (!items.length || totalOdds < CFG.MIN_TOTAL_ODDS) {
            return { items: [], totalOdds: 1 };
        }

        return { items, totalOdds };
    }

    function getCoupons(candidates) {
        return [
            {
                title: "Güvenli Kupon",
                threshold: 90,
                ...buildCoupon(candidates, 90)
            },
            {
                title: "Orta Risk Kupon",
                threshold: 85,
                ...buildCoupon(candidates, 85)
            },
            {
                title: "Riskli Kupon",
                threshold: 80,
                ...buildCoupon(candidates, 80)
            }
        ];
    }

    function resultStatus(item) {
        const result = item.row.results[item.marketKey];

        if (result === true) return ["success", "Kazandı"];
        if (result === false) return ["failure", "Kaybetti"];

        return ["pending", "Bekliyor"];
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function percent(value) {
        return `${value.toFixed(1).replace(".", ",")}%`;
    }

    function ensureUI() {
        let root = $("#rnaRoot");

        if (!root) {
            root = document.createElement("div");
            root.id = "rnaRoot";

            const mount = $("#mk-coupon-root");

            if (mount) {
                mount.replaceChildren();
                mount.appendChild(root);
            } else {
                document.body.appendChild(root);
            }
        }

        if (root.dataset.initialized === "true") return;

        root.dataset.initialized = "true";

        root.innerHTML = `
            <style>
                #rnaRoot{color:#f3f6fc;font-family:Arial,sans-serif;width:100%;min-width:0;box-sizing:border-box}
                #rnaRoot *{box-sizing:border-box}
                #rnaRoot .panel{background:#111827;border:1px solid #29374c;border-radius:13px;padding:13px;margin-bottom:12px;min-width:0}
                #rnaRoot h2{font-size:17px;margin:0 0 10px}
                #rnaRoot .muted{color:#9ca3af;font-size:12px;line-height:1.6;overflow-wrap:anywhere}
                #rnaRoot .controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
                #rnaRoot input,#rnaRoot button{font:inherit;border-radius:8px;min-height:39px;max-width:100%}
                #rnaRoot input{background:#0b1220;color:#f9fafb;border:1px solid #374151;padding:8px}
                #rnaRoot button{cursor:pointer;color:white;border:0;background:#2563eb;padding:9px 12px;font-weight:700}
                #rnaRoot button.secondary{background:#273449}
                #rnaRoot .market-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
                #rnaRoot .market{display:flex;gap:7px;align-items:center;border:1px solid #374151;background:#0b1220;border-radius:8px;padding:8px;font-size:12px;min-width:0}
                #rnaRoot .market input{min-height:auto;margin:0;flex:0 0 auto}
                #rnaRoot .coupon-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}
                #rnaRoot .coupon{background:#0b1220;border:1px solid #374151;border-radius:11px;padding:11px;min-width:0}
                #rnaRoot .coupon h3{font-size:15px;margin:0 0 8px}
                #rnaRoot .total{font-size:19px;font-weight:800;margin:8px 0}
                #rnaRoot .leg{padding:10px 0;border-top:1px solid #273449;overflow-wrap:anywhere}
                #rnaRoot .leg strong{color:#f9fafb}
                #rnaRoot .leg small{display:block;color:#9ca3af;margin-top:4px;line-height:1.6}
                #rnaRoot .status{display:inline-block;padding:4px 7px;border-radius:6px;font-size:11px;font-weight:700;margin-top:6px}
                #rnaRoot .success{color:#86efac;background:#052e16}
                #rnaRoot .failure{color:#fca5a5;background:#450a0a}
                #rnaRoot .pending{color:#fde68a;background:#422006}
                #rnaRoot .error{color:#fca5a5}
                #rnaRoot .empty{color:#9ca3af;padding:10px 0;font-size:12px;line-height:1.6}
                #rnaRoot summary{cursor:pointer;padding:8px 0}
                #rnaRoot .market-actions{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}
                @media(max-width:380px){#rnaRoot .market-grid{grid-template-columns:1fr}#rnaRoot .controls>*{max-width:100%}}
            </style>

            <section class="panel">
                <h2>RNA | Otomatik Kupon Motoru</h2>
                <div class="muted">
                    Son ${CFG.HISTORY_DAYS} gün · En az ${CFG.MIN_SAMPLE} geçmiş maç ·
                    En az %${CFG.MIN_SUCCESS} başarı · Tekli oran ≥ ${CFG.MIN_ODD.toFixed(2)}
                </div>

                <div class="controls">
                    <label for="rnaDate">Maç tarihi</label>
                    <input type="date" id="rnaDate">
                    <button type="button" id="rnaRefresh">Verileri yenile</button>
                </div>

                <p id="rnaMessage" class="muted" role="status">Veriler yükleniyor…</p>
            </section>

            <section class="panel">
                <h2>Market filtreleri</h2>
                <div class="market-actions">
                    <button type="button" id="rnaAll">Tümünü seç</button>
                    <button type="button" class="secondary" id="rnaNone">Seçimi temizle</button>
                </div>
                <div id="rnaMarkets" class="market-grid"></div>
            </section>

            <section class="panel">
                <h2>Oluşturulan kuponlar</h2>
                <div id="rnaSummary" class="muted"></div>
                <div id="rnaCoupons" class="coupon-grid"></div>
            </section>

            <section class="panel">
                <details>
                    <summary>Veri ve analiz bilgileri</summary>
                    <div id="rnaDiagnostics" class="muted"></div>
                </details>
            </section>
        `;

        $("#rnaDate").value = state.selectedDate;

        $("#rnaDate").addEventListener("change", event => {
            state.selectedDate = event.target.value || todayISO();
            state.historyCache.clear();
            render();
        });

        $("#rnaRefresh").addEventListener("click", loadData);

        $("#rnaAll").addEventListener("click", () => {
            state.selectedMarkets = new Set(MARKETS.map(m => m.key));
            state.historyCache.clear();
            renderMarketFilters();
            render();
        });

        $("#rnaNone").addEventListener("click", () => {
            state.selectedMarkets.clear();
            state.historyCache.clear();
            renderMarketFilters();
            render();
        });

        renderMarketFilters();
    }

    function renderMarketFilters() {
        const container = $("#rnaMarkets");
        if (!container) return;

        container.innerHTML = MARKETS.map(m => `
            <label class="market">
                <input
                    type="checkbox"
                    data-market="${esc(m.key)}"
                    ${state.selectedMarkets.has(m.key) ? "checked" : ""}
                >
                <span>${esc(m.label)}</span>
            </label>
        `).join("");

        container.querySelectorAll("[data-market]").forEach(input => {
            input.addEventListener("change", () => {
                if (input.checked) {
                    state.selectedMarkets.add(input.dataset.market);
                } else {
                    state.selectedMarkets.delete(input.dataset.market);
                }

                state.historyCache.clear();
                render();
            });
        });
    }

    function renderCoupon(coupon) {
        const content = coupon.items.length
            ? coupon.items.map(item => {
                const [status, label] = resultStatus(item);

                return `
                    <div class="leg">
                        <strong>${esc(item.name)}</strong>
                        <small>
                            ${esc(item.marketLabel)} · Açılış oranı ${item.oddKey}<br>
                            Geçmiş başarı ${percent(item.success)}<br>
                            ${item.sample} maç: ${item.wins} başarılı / ${item.losses} başarısız
                        </small>
                        <span class="status ${status}">${label}</span>
                    </div>
                `;
            }).join("")
            : `<div class="empty">Bu kupon eşiğinde yeterli eşleşme bulunamadı.</div>`;

        return `
            <article class="coupon">
                <h3>${esc(coupon.title)} (≥ %${coupon.threshold})</h3>
                <div class="total">Toplam oran: ${coupon.totalOdds.toFixed(2)}</div>
                <div class="muted">${coupon.items.length} / ${CFG.MAX_MATCHES} maç</div>
                ${content}
            </article>
        `;
    }

    function render() {
        ensureUI();

        if ($("#rnaDate").value !== state.selectedDate) {
            $("#rnaDate").value = state.selectedDate;
        }

        const history = getHistory(state.selectedDate);
        const target = analyzeTargetMatches(state.selectedDate, history);
        const coupons = getCoupons(target);

        const targetMatches = state.rows.filter(row =>
            row.date === state.selectedDate && !row.played
        ).length;

        $("#rnaSummary").textContent =
            `${state.selectedDate} · ${targetMatches} oynanmamış maç · ` +
            `${target.length} uygun maç · ${history.size} geçmiş market/oran grubu`;

        $("#rnaCoupons").innerHTML = coupons.map(renderCoupon).join("");

        const validGroups = [...history.values()].filter(group =>
            group.sample >= CFG.MIN_SAMPLE &&
            group.success >= CFG.MIN_SUCCESS
        ).length;

        $("#rnaDiagnostics").innerHTML = `
            <p>Kaynak: ${esc(CFG.DATA_URL)}</p>
            <p>Yüklenen kayıt: ${state.stats.rawCount || 0}</p>
            <p>Tarihi bulunan kayıt: ${state.stats.datedCount || 0}</p>
            <p>Skoru tamamlanmış kayıt: ${state.stats.playedCount || 0}</p>
            <p>İndekslenen market/oran: ${state.stats.oddsCount || 0}</p>
            <p>JSON market sayısı: ${state.stats.marketCount || MARKETS.length}</p>
            <p>Sonuç kuralı doğrulanması gereken market: ${state.stats.unsupportedMarketCount || 0}</p>
            <p>Geçmiş eşleşme grubu: ${history.size}</p>
            <p>Başarı ve örnek şartını karşılayan grup: ${validGroups}</p>
            <p>Analiz önbelleği: ${state.historyCache.size}</p>
        `;

        if (state.error) {
            $("#rnaMessage").textContent = state.error;
            $("#rnaMessage").className = "muted error";
        }
    }

    async function loadData() {
        if (state.loading && state.controller) {
            state.controller.abort();
        }

        state.loading = true;
        state.error = "";

        const message = $("#rnaMessage");

        if (message) {
            message.textContent = "V2 verileri yükleniyor…";
            message.className = "muted";
        }

        const controller = new AbortController();
        state.controller = controller;

        const timer = setTimeout(
            () => controller.abort(),
            CFG.FETCH_TIMEOUT
        );

        try {
            const separator = CFG.DATA_URL.includes("?") ? "&" : "?";

            const response = await fetch(
                `${CFG.DATA_URL}${separator}t=${Date.now()}`,
                {
                    cache: "no-store",
                    signal: controller.signal
                }
            );

            if (!response.ok) {
                throw new Error(`JSON yüklenemedi: HTTP ${response.status}`);
            }

            const payload = await response.json();

            if (controller !== state.controller) return;

            const rows = prepareRows(payload);

            if (!rows.length) {
                throw new Error(
                    "Veri dosyasında tanınan maç dizisi bulunamadı. V2 JSON yapısı kontrol edilmeli."
                );
            }

            state.rows = rows;
            state.historyCache.clear();

            renderMarketFilters();
            render();

            if (!state.stats.datedCount) {
                state.error = "Kayıtlar bulundu ancak tarih alanları tanınamadı.";
            } else if (!state.stats.oddsCount) {
                state.error =
                    "Kayıtlar bulundu ancak market oranları tanınamadı. V2 JSON alan yapısı kontrol edilmeli.";
            } else {
                state.error = "";
            }

            const status = $("#rnaMessage");

            if (status) {
                status.textContent = state.error ||
                    `${state.rows.length} kayıt yüklendi · ` +
                    `${state.stats.marketCount} market · ` +
                    `${state.stats.oddsCount} oran indekslendi.`;

                status.className = state.error ? "muted error" : "muted";
            }

            if (state.error) {
                console.warn("[RNA]", state.error, state.stats);
            }
        } catch (error) {
            if (error.name === "AbortError" && controller !== state.controller) {
                return;
            }

            state.error = error.name === "AbortError"
                ? "Veri yükleme zaman aşımına uğradı."
                : `Veri yüklenemedi: ${error.message}`;

            console.error("[RNA]", error);

            ensureUI();

            const status = $("#rnaMessage");

            if (status) {
                status.textContent = state.error;
                status.className = "muted error";
            }

            const diagnostics = $("#rnaDiagnostics");
            if (diagnostics) diagnostics.textContent = state.error;
        } finally {
            clearTimeout(timer);

            if (controller === state.controller) {
                state.loading = false;
                state.controller = null;
            }
        }
    }

    window.RNA = Object.freeze({
        config: CFG,

        get markets() {
            return MARKETS;
        },

        reload: loadData,
        render,

        get rows() {
            return state.rows.length;
        },

        get diagnostics() {
            return {
                ...state.stats,
                cachedHistories: state.historyCache.size,
                selectedMarkets: [...state.selectedMarkets]
            };
        }
    });

    function init() {
        ensureUI();
        loadData();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
