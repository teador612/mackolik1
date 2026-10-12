
"use strict";

/* =========================================================
   RNA — HIZLANDIRILMIŞ KUPON MOTORU

   Veri: ./data/v2-data.json
   Geçmiş: 30 gün
   Minimum örnek: 8
   Minimum başarı: %80
   Minimum tekli oran: 1.35
   Minimum kupon oranı: 2.00
   Maksimum maç: 5

   Eşleştirme: aynı market + iki ondalıklı oran
   Optimizasyon: tek seferlik indeks + geçmiş önbelleği
   ========================================================= */

(() => {
    const CFG = {
        DATA_URL: "./data/v2-data.json",
        HISTORY_DAYS: 30,
        MIN_SAMPLE: 8,
        MIN_SUCCESS: 80,
        MIN_ODD: 1.35,
        MIN_TOTAL_ODDS: 2.00,
        MAX_MATCHES: 5,
        FETCH_TIMEOUT: 20000
    };

    const MARKETS = [
        { key: "ms1", label: "MS 1", aliases: ["ms1", "ms 1", "1"] },
        { key: "msX", label: "MS 0", aliases: ["msx", "ms0", "ms x", "ms 0", "x", "beraberlik"] },
        { key: "ms2", label: "MS 2", aliases: ["ms2", "ms 2", "2"] },
        { key: "iy1", label: "İY 1", aliases: ["iy1", "iy 1", "ht1"] },
        { key: "iyX", label: "İY 0", aliases: ["iyx", "iy0", "iy x", "iy 0", "htx"] },
        { key: "iy2", label: "İY 2", aliases: ["iy2", "iy 2", "ht2"] },
        { key: "iy05Ust", label: "İY 0.5 Üst", aliases: ["iy05ust", "iy 0.5 üst", "iy 0,5 üst", "iy05over"] },
        { key: "iy15Ust", label: "İY 1.5 Üst", aliases: ["iy15ust", "iy 1.5 üst", "iy 1,5 üst", "iy15over"] },
        { key: "iy15Alt", label: "İY 1.5 Alt", aliases: ["iy15alt", "iy 1.5 alt", "iy 1,5 alt", "iy15under"] },
        { key: "kgVar", label: "KG Var", aliases: ["kgvar", "kg var", "bttsyes"] },
        { key: "kgYok", label: "KG Yok", aliases: ["kgyok", "kg yok", "bttsno"] },
        { key: "au15Ust", label: "1.5 Üst", aliases: ["au15ust", "1.5 üst", "1,5 üst", "au15over"] },
        { key: "au15Alt", label: "1.5 Alt", aliases: ["au15alt", "1.5 alt", "1,5 alt", "au15under"] },
        { key: "au25Ust", label: "2.5 Üst", aliases: ["au25ust", "2.5 üst", "2,5 üst", "au25over"] },
        { key: "au25Alt", label: "2.5 Alt", aliases: ["au25alt", "2.5 alt", "2,5 alt", "au25under"] },
        { key: "iyms11", label: "İY/MS 1/1", aliases: ["iyms11", "1/1"] },
        { key: "iyms12", label: "İY/MS 1/2", aliases: ["iyms12", "1/2"] },
        { key: "iyms21", label: "İY/MS 2/1", aliases: ["iyms21", "2/1"] },
        { key: "iyms22", label: "İY/MS 2/2", aliases: ["iyms22", "2/2"] },
        { key: "iyms00", label: "İY/MS 0/0", aliases: ["iyms00", "0/0", "x/x"] },
        { key: "iyms10", label: "İY/MS 1/0", aliases: ["iyms10", "1/0", "1/x"] },
        { key: "iyms20", label: "İY/MS 2/0", aliases: ["iyms20", "2/0", "2/x"] }
    ];

    const state = {
        rows: [],
        selectedDate: todayISO(),
        selectedMarkets: new Set(MARKETS.map(m => m.key)),
        historyCache: new Map(),
        loading: false,
        error: "",
        stats: {}
    };

    const $ = (selector) => document.querySelector(selector);

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
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "object") return null;

        let s = String(value).trim().replace(/\s/g, "").replace(/[^\d,.-]/g, "");
        if (!s) return null;

        if (s.includes(",") && s.includes(".")) {
            s = s.lastIndexOf(",") > s.lastIndexOf(".")
                ? s.replace(/\./g, "").replace(",", ".")
                : s.replace(/,/g, "");
        } else {
            s = s.replace(",", ".");
        }

        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    function val(obj, aliases) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;

        for (const key of aliases) {
            if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
                return obj[key];
            }
        }

        const wanted = new Set(aliases.map(norm));
        for (const [key, value] of Object.entries(obj)) {
            if (wanted.has(norm(key)) && value !== undefined && value !== null && value !== "") {
                return value;
            }
        }

        return undefined;
    }

    function dateISO(value) {
        if (value === undefined || value === null || value === "") return null;

        if (typeof value === "number") {
            const d = new Date(value < 1e11 ? value * 1000 : value);
            return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        }

        const s = String(value).trim();
        let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

        m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

        m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }

    function parseScore(value) {
        if (value && typeof value === "object") {
            const h = num(val(value, ["home", "homeScore", "home_score", "ev", "h"]));
            const a = num(val(value, ["away", "awayScore", "away_score", "dep", "a"]));
            if (h !== null && a !== null) return { h, a };
        }

        if (typeof value !== "string") return null;
        const m = value.match(/(?:^|\D)(\d{1,2})\s*[-:–]\s*(\d{1,2})(?:\D|$)/);
        return m ? { h: Number(m[1]), a: Number(m[2]) } : null;
    }

    function getDate(match) {
        let v = val(match, [
            "date", "matchDate", "match_date", "datetime", "dateTime",
            "kickoff", "startTime", "start_time", "eventDate", "event_date",
            "tarih", "macTarihi", "maçTarihi", "fixtureDate", "timestamp"
        ]);

        if (v && typeof v === "object") {
            v = val(v, ["date", "datetime", "value", "timestamp"]);
        }

        if (v === undefined) {
            for (const [key, value] of Object.entries(match || {})) {
                if (/(date|tarih|kickoff)/i.test(key) &&
                    (typeof value === "string" || typeof value === "number")) {
                    v = value;
                    break;
                }
            }
        }

        return dateISO(v);
    }

    function getTeam(match, side) {
        const aliases = side === "home"
            ? ["homeTeam", "home_team", "home", "homeName", "home_name", "evSahibi", "evTakim", "team1", "teamHome", "host"]
            : ["awayTeam", "away_team", "away", "awayName", "away_name", "deplasman", "depTakim", "team2", "teamAway", "visitor"];

        let v = val(match, aliases);

        if (v && typeof v === "object") {
            v = val(v, ["name", "teamName", "team_name", "title", "displayName"]);
        }

        if (v !== undefined) return String(v);

        const teams = val(match, ["teams", "takimlar", "participants"]);
        if (teams && typeof teams === "object") {
            const nested = val(teams, side === "home"
                ? ["home", "homeTeam", "ev", "team1"]
                : ["away", "awayTeam", "deplasman", "team2"]);

            if (nested && typeof nested === "object") {
                return String(val(nested, ["name", "teamName", "title"]) ?? "Bilinmiyor");
            }
            if (nested !== undefined) return String(nested);
        }

        return "Bilinmiyor";
    }

    function getScore(match, half = false) {
        const homeAliases = half
            ? ["halfHomeScore", "half_home_score", "htHomeScore", "iyHomeScore", "firstHalfHomeScore"]
            : ["homeScore", "home_score", "scoreHome", "evSkor", "homeGoals", "ftHome"];

        const awayAliases = half
            ? ["halfAwayScore", "half_away_score", "htAwayScore", "iyAwayScore", "firstHalfAwayScore"]
            : ["awayScore", "away_score", "scoreAway", "depSkor", "awayGoals", "ftAway"];

        const h = num(val(match, homeAliases));
        const a = num(val(match, awayAliases));
        if (h !== null && a !== null) return { h, a };

        const scoreAliases = half
            ? ["halfTimeScore", "half_time_score", "htScore", "ht_score", "iySkor", "ilkYariSkor", "firstHalfScore", "scoreHT"]
            : ["score", "result", "fullTimeScore", "full_time_score", "macSonucu", "skor", "ftScore", "finalScore"];

        for (const alias of scoreAliases) {
            const parsed = parseScore(val(match, [alias]));
            if (parsed) return parsed;
        }

        return null;
    }

    function findOddsRoots(match) {
        const roots = [];
        for (const key of [
            "odds", "openingOdds", "opening_odds", "openOdds", "open_odds",
            "opening", "oranlar", "oran", "markets", "marketOdds",
            "market_odds", "oddsData", "prices", "iddaa", "iddaaOdds"
        ]) {
            const v = val(match, [key]);
            if (v && typeof v === "object") roots.push(v);
        }
        roots.push(match);
        return roots;
    }

    function oddValue(v) {
        if (typeof v === "number" || typeof v === "string") {
            const n = num(v);
            return n !== null && n > 1 && n < 10000 ? n : null;
        }

        if (v && typeof v === "object") {
            const n = num(val(v, [
                "odd", "odds", "oran", "price", "value", "opening",
                "openingOdd", "openingOdds", "acilis", "acilisOrani",
                "decimal", "decimalOdds"
            ]));
            return n !== null && n > 1 && n < 10000 ? n : null;
        }

        return null;
    }

    function findOdd(root, aliases) {
        const wanted = new Set(aliases.map(norm));
        const queue = [{ v: root, depth: 0 }];
        const seen = new Set();

        while (queue.length) {
            const { v, depth } = queue.shift();
            if (!v || typeof v !== "object" || seen.has(v)) continue;
            seen.add(v);

            if (Array.isArray(v)) {
                for (const item of v) {
                    if (!item || typeof item !== "object") continue;
                    const name = val(item, ["market", "marketKey", "market_key", "name", "key", "type", "label", "betType"]);
                    if (name !== undefined && wanted.has(norm(name))) {
                        const n = oddValue(item);
                        if (n !== null) return n;
                    }
                    if (depth < 4) queue.push({ v: item, depth: depth + 1 });
                }
                continue;
            }

            for (const [key, child] of Object.entries(v)) {
                if (wanted.has(norm(key))) {
                    const n = oddValue(child);
                    if (n !== null) return n;
                }
            }

            const name = val(v, ["market", "marketKey", "market_key", "betType", "bet_type"]);
            if (name !== undefined && wanted.has(norm(name))) {
                const n = oddValue(v);
                if (n !== null) return n;
            }

            if (depth < 4) {
                for (const child of Object.values(v)) {
                    if (child && typeof child === "object") queue.push({ v: child, depth: depth + 1 });
                }
            }
        }

        return null;
    }

    function getOdd(match, market) {
        const aliases = [market.key, market.label, ...market.aliases];
        for (const root of findOddsRoots(match)) {
            const n = findOdd(root, aliases);
            if (n !== null) return n;
        }
        return null;
    }

    function outcome(key, full, half) {
        switch (key) {
            case "ms1": return full ? full.h > full.a : null;
            case "msX": return full ? full.h === full.a : null;
            case "ms2": return full ? full.h < full.a : null;
            case "iy1": return half ? half.h > half.a : null;
            case "iyX": return half ? half.h === half.a : null;
            case "iy2": return half ? half.h < half.a : null;
            case "iy05Ust": return half ? half.h + half.a >= 1 : null;
            case "iy15Ust": return half ? half.h + half.a >= 2 : null;
            case "iy15Alt": return half ? half.h + half.a <= 1 : null;
            case "kgVar": return full ? full.h > 0 && full.a > 0 : null;
            case "kgYok": return full ? full.h === 0 || full.a === 0 : null;
            case "au15Ust": return full ? full.h + full.a >= 2 : null;
            case "au15Alt": return full ? full.h + full.a <= 1 : null;
            case "au25Ust": return full ? full.h + full.a >= 3 : null;
            case "au25Alt": return full ? full.h + full.a <= 2 : null;
            case "iyms11": return half && full ? half.h > half.a && full.h > full.a : null;
            case "iyms12": return half && full ? half.h > half.a && full.h < full.a : null;
            case "iyms21": return half && full ? half.h < half.a && full.h > full.a : null;
            case "iyms22": return half && full ? half.h < half.a && full.h < full.a : null;
            case "iyms00": return half && full ? half.h === half.a && full.h === full.a : null;
            case "iyms10": return half && full ? half.h > half.a && full.h === full.a : null;
            case "iyms20": return half && full ? half.h < half.a && full.h === full.a : null;
            default: return null;
        }
    }

    function played(match, full) {
        if (!full) return false;
        const status = norm(val(match, ["status", "matchStatus", "match_status", "durum", "state"]));
        return ![
            "scheduled", "upcoming", "notstarted", "bekliyor",
            "ertelendi", "postponed", "cancelled", "canceled", "iptal"
        ].includes(status);
    }

    function matchId(match, index, date, home, away) {
        return String(val(match, ["id", "matchId", "match_id", "fixtureId", "eventId", "gameId"])
            ?? `${date || "tarihsiz"}|${home}|${away}|${index}`);
    }

    function flattenMatches(payload) {
        if (Array.isArray(payload)) return payload;

        for (const key of ["matches", "data", "fixtures", "events", "results"]) {
            if (Array.isArray(payload?.[key])) return payload[key];
        }

        // Bilinen bir üst alan yoksa nesne içindeki olası maç dizisini bul.
        const queue = [{ v: payload, depth: 0 }];
        const seen = new Set();
        const candidates = [];

        while (queue.length) {
            const { v, depth } = queue.shift();
            if (!v || typeof v !== "object" || seen.has(v)) continue;
            seen.add(v);

            if (Array.isArray(v)) {
                const rows = v.filter(x => x && typeof x === "object" && !Array.isArray(x));
                if (rows.length) {
                    const score = rows.reduce((n, row) => n +
                        ((getDate(row) ? 1 : 0) +
                         (getTeam(row, "home") !== "Bilinmiyor" ? 1 : 0) +
                         (getTeam(row, "away") !== "Bilinmiyor" ? 1 : 0)), 0);
                    candidates.push({ rows, score });
                }
            } else if (depth < 5) {
                for (const child of Object.values(v)) {
                    if (child && typeof child === "object") queue.push({ v: child, depth: depth + 1 });
                }
            }
        }

        candidates.sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);
        return candidates[0]?.rows || [];
    }

    /*
     * Ağır JSON alan taraması yalnızca burada yapılır.
     * Sonrasında analiz hazır satırlar üzerinde çalışır.
     */
    function prepareRows(payload) {
        const raw = flattenMatches(payload);
        const rows = [];

        for (let i = 0; i < raw.length; i++) {
            const match = raw[i];
            const date = getDate(match);
            const home = getTeam(match, "home");
            const away = getTeam(match, "away");
            const full = getScore(match, false);
            const half = getScore(match, true);
            const odds = Object.create(null);

            for (const market of MARKETS) {
                const n = getOdd(match, market);
                if (n !== null) odds[market.key] = n;
            }

            const results = Object.create(null);
            for (const market of MARKETS) {
                results[market.key] = outcome(market.key, full, half);
            }

            rows.push({
                id: matchId(match, i, date, home, away),
                date,
                home,
                away,
                name: `${home} - ${away}`,
                full,
                half,
                played: played(match, full),
                odds,
                results
            });
        }

        state.stats = {
            rawCount: raw.length,
            datedCount: rows.filter(r => r.date).length,
            playedCount: rows.filter(r => r.played).length,
            oddsCount: rows.reduce((sum, r) => sum + Object.keys(r.odds).length, 0)
        };

        return rows;
    }

    function getHistory(targetDate) {
        const marketKey = [...state.selectedMarkets].sort().join(",");
        const cacheKey = `${targetDate}|${marketKey}`;

        if (state.historyCache.has(cacheKey)) {
            return state.historyCache.get(cacheKey);
        }

        const end = new Date(`${targetDate}T00:00:00.000Z`);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - CFG.HISTORY_DAYS);
        const startDate = start.toISOString().slice(0, 10);

        const index = new Map();

        for (const row of state.rows) {
            if (!row.date || row.date < startDate || row.date >= targetDate || !row.played) continue;

            for (const marketKey of state.selectedMarkets) {
                const odd = row.odds[marketKey];
                const result = row.results[marketKey];

                if (odd === undefined || odd < CFG.MIN_ODD || result === null) continue;

                const key = `${marketKey}|${odd.toFixed(2)}`;
                let group = index.get(key);

                if (!group) {
                    group = { marketKey, odd: odd.toFixed(2), sample: 0, wins: 0, losses: 0 };
                    index.set(key, group);
                }

                group.sample++;
                if (result) group.wins++;
                else group.losses++;
            }
        }

        for (const group of index.values()) {
            group.success = group.sample ? group.wins / group.sample * 100 : 0;
        }

        state.historyCache.set(cacheKey, index);

        // Belleğin gereksiz büyümesini engelle.
        if (state.historyCache.size > 8) {
            const firstKey = state.historyCache.keys().next().value;
            state.historyCache.delete(firstKey);
        }

        return index;
    }

    function analyzeTargetMatches(targetDate, history) {
        const matches = state.rows.filter(row => row.date === targetDate && !row.played);
        const candidates = [];

        for (const row of matches) {
            let best = null;

            for (const marketKey of state.selectedMarkets) {
                const odd = row.odds[marketKey];
                if (odd === undefined || odd < CFG.MIN_ODD) continue;

                const key = `${marketKey}|${odd.toFixed(2)}`;
                const group = history.get(key);

                if (!group || group.sample < CFG.MIN_SAMPLE || group.success < CFG.MIN_SUCCESS) continue;

                const market = MARKETS.find(m => m.key === marketKey);
                const item = {
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

                if (!best ||
                    item.success > best.success ||
                    (item.success === best.success && item.sample > best.sample)) {
                    best = item;
                }
            }

            if (best) candidates.push(best);
        }

        return candidates.sort((a, b) =>
            b.success - a.success || b.sample - a.sample || b.odd - a.odd
        );
    }

    function buildCoupon(candidates, threshold) {
        const items = [];
        const used = new Set();
        let total = 1;

        for (const item of candidates) {
            if (items.length >= CFG.MAX_MATCHES) break;
            if (item.success < threshold || used.has(item.matchId)) continue;

            items.push(item);
            used.add(item.matchId);
            total *= item.odd;
        }

        if (!items.length || total < CFG.MIN_TOTAL_ODDS) {
            return { items: [], totalOdds: 1 };
        }

        return { items, totalOdds: total };
    }

    function getCoupons(candidates) {
        return [
            { title: "Güvenli Kupon", threshold: 90, ...buildCoupon(candidates, 90) },
            { title: "Orta Risk Kupon", threshold: 85, ...buildCoupon(candidates, 85) },
            { title: "Riskli Kupon", threshold: 80, ...buildCoupon(candidates, 80) }
        ];
    }

    function resultStatus(item) {
        const result = item.row.results[item.marketKey];
        if (result === true) return ["success", "Başarılı"];
        if (result === false) return ["failure", "Başarısız"];
        return ["pending", "Bekliyor"];
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[ch]);
    }

    function percent(value) {
        return `${value.toFixed(1).replace(".", ",")}%`;
    }

    function ensureUI() {
        if ($("#rnaRoot")) return;

        const root = document.createElement("main");
        root.id = "rnaRoot";

        root.innerHTML = `
            <style>
                #rnaRoot{color:#e5e7eb;font-family:Arial,sans-serif;max-width:1100px;margin:auto;padding:14px;box-sizing:border-box}
                #rnaRoot *{box-sizing:border-box}
                #rnaRoot .panel{background:#111827;border:1px solid #273449;border-radius:14px;padding:14px;margin-bottom:14px}
                #rnaRoot h1{font-size:23px;margin:0 0 8px;color:#f9fafb}
                #rnaRoot h2{font-size:18px;margin:0 0 12px;color:#f9fafb}
                #rnaRoot .muted{color:#9ca3af;font-size:13px;line-height:1.5}
                #rnaRoot .controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
                #rnaRoot input,#rnaRoot button{font:inherit;border-radius:8px;min-height:40px}
                #rnaRoot input{background:#0b1220;color:#f9fafb;border:1px solid #374151;padding:8px}
                #rnaRoot button{cursor:pointer;color:white;border:0;background:#2563eb;padding:9px 14px;font-weight:700}
                #rnaRoot .market-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px}
                #rnaRoot .market{display:flex;gap:8px;align-items:center;border:1px solid #374151;background:#0b1220;border-radius:8px;padding:9px;font-size:13px}
                #rnaRoot .market input{min-height:auto}
                #rnaRoot .coupon-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px}
                #rnaRoot .coupon{background:#0b1220;border:1px solid #374151;border-radius:12px;padding:12px;min-width:0}
                #rnaRoot .coupon h3{font-size:16px;margin:0 0 8px}
                #rnaRoot .total{font-size:20px;font-weight:800;margin:8px 0}
                #rnaRoot .leg{padding:10px 0;border-top:1px solid #273449;overflow-wrap:anywhere}
                #rnaRoot .leg strong{color:#f9fafb}
                #rnaRoot .leg small{display:block;color:#9ca3af;margin-top:4px;line-height:1.5}
                #rnaRoot .status{display:inline-block;padding:4px 7px;border-radius:6px;font-size:11px;font-weight:700;margin-top:5px}
                #rnaRoot .success{color:#86efac;background:#052e16}
                #rnaRoot .failure{color:#fca5a5;background:#450a0a}
                #rnaRoot .pending{color:#fde68a;background:#422006}
                #rnaRoot .error{color:#fca5a5}
                #rnaRoot .empty{color:#9ca3af;padding:12px 0;font-size:13px;line-height:1.5}
                #rnaRoot summary{cursor:pointer;padding:8px 0}
                @media(max-width:480px){#rnaRoot{padding:9px}#rnaRoot .panel{padding:11px}#rnaRoot .controls>*{flex:1 1 100%}#rnaRoot h1{font-size:21px}}
            </style>

            <section class="panel">
                <h1>RNA | Otomatik Kupon</h1>
                <div class="muted">Son ${CFG.HISTORY_DAYS} gün · En az ${CFG.MIN_SAMPLE} örnek · En az %${CFG.MIN_SUCCESS} başarı · Tekli oran ≥ ${CFG.MIN_ODD.toFixed(2)}</div>
                <div class="controls">
                    <label for="rnaDate">Maç tarihi</label>
                    <input type="date" id="rnaDate">
                    <button type="button" id="rnaRefresh">Verileri yenile</button>
                </div>
                <p id="rnaMessage" class="muted" role="status">Hazırlanıyor…</p>
            </section>

            <section class="panel">
                <h2>Market filtreleri</h2>
                <div class="controls">
                    <button type="button" id="rnaAll">Tümünü seç</button>
                    <button type="button" id="rnaNone">Seçimi temizle</button>
                </div>
                <div id="rnaMarkets" class="market-grid"></div>
            </section>

            <section class="panel">
                <h2>Kuponlar</h2>
                <div id="rnaSummary" class="muted"></div>
                <div id="rnaCoupons" class="coupon-grid"></div>
            </section>

            <section class="panel">
                <details>
                    <summary>Analiz ayrıntıları</summary>
                    <div id="rnaDiagnostics" class="muted"></div>
                </details>
            </section>
        `;

        document.body.appendChild(root);
        $("#rnaDate").value = state.selectedDate;

        $("#rnaDate").addEventListener("change", event => {
            state.selectedDate = event.target.value || todayISO();
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
                <input type="checkbox" data-market="${esc(m.key)}" ${state.selectedMarkets.has(m.key) ? "checked" : ""}>
                <span>${esc(m.label)}</span>
            </label>
        `).join("");

        container.querySelectorAll("[data-market]").forEach(input => {
            input.addEventListener("change", () => {
                if (input.checked) state.selectedMarkets.add(input.dataset.market);
                else state.selectedMarkets.delete(input.dataset.market);

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
                            ${esc(item.marketLabel)} · Oran ${item.oddKey}<br>
                            Geçmiş başarı ${percent(item.success)} · ${item.sample} maç
                            (${item.wins} başarılı / ${item.losses} başarısız)
                        </small>
                        <span class="status ${status}">${label}</span>
                    </div>
                `;
            }).join("")
            : `<div class="empty">Bu başarı eşiğinde yeterli eşleşme bulunamadı.</div>`;

        return `
            <article class="coupon">
                <h3>${esc(coupon.title)} (%${coupon.threshold}+)</h3>
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

        $("#rnaSummary").textContent =
            `${state.selectedDate} · ${state.rows.filter(r => r.date === state.selectedDate && !r.played).length} oynanmamış maç · ` +
            `${target.length} uygun maç · ${history.size} geçmiş market/oran grubu`;

        $("#rnaCoupons").innerHTML = coupons.map(renderCoupon).join("");

        const validGroups = [...history.values()].filter(g =>
            g.sample >= CFG.MIN_SAMPLE && g.success >= CFG.MIN_SUCCESS
        ).length;

        $("#rnaDiagnostics").innerHTML = `
            <p>Veri kaynağı: ${esc(CFG.DATA_URL)}</p>
            <p>Yüklenen maç: ${state.stats.rawCount || 0}</p>
            <p>Tarihi bulunan maç: ${state.stats.datedCount || 0}</p>
            <p>Skoru tamamlanmış maç: ${state.stats.playedCount || 0}</p>
            <p>Bulunan oran alanı: ${state.stats.oddsCount || 0}</p>
            <p>Geçmiş grubu: ${history.size}</p>
            <p>Şartları karşılayan grup: ${validGroups}</p>
            <p>Market + iki ondalıklı oran eşleştirmesi etkin.</p>
            <p>Analiz önbelleği: ${state.historyCache.size} kayıt.</p>
        `;

        if (state.error) {
            $("#rnaMessage").textContent = state.error;
            $("#rnaMessage").className = "muted error";
        }
    }

    async function loadData() {
        if (state.loading) return;
        state.loading = true;
        state.error = "";

        $("#rnaMessage") && ($("#rnaMessage").textContent = "Veriler yükleniyor…");

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CFG.FETCH_TIMEOUT);

        try {
            const separator = CFG.DATA_URL.includes("?") ? "&" : "?";
            const response = await fetch(`${CFG.DATA_URL}${separator}t=${Date.now()}`, {
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) throw new Error(`JSON yüklenemedi: HTTP ${response.status}`);

            const payload = await response.json();

            // Ağır alan çözümleme yalnızca bir kez yapılır.
            state.rows = prepareRows(payload);
            state.historyCache.clear();

            if (!state.rows.length) {
                throw new Error("JSON yüklendi ancak maç dizisi bulunamadı.");
            }

            render();

            if (!state.stats.datedCount) {
                $("#rnaMessage").textContent =
                    `Veri yüklendi (${state.rows.length} maç), ancak tarih alanları tanınamadı.`;
                $("#rnaMessage").className = "muted error";
            } else if (!state.stats.oddsCount) {
                $("#rnaMessage").textContent =
                    `Veri yüklendi (${state.rows.length} maç), ancak oran alanları bulunamadı.`;
                $("#rnaMessage").className = "muted error";
            } else {
                $("#rnaMessage").textContent =
                    `${state.rows.length} maç hazır · ${state.stats.oddsCount} oran alanı indekslendi.`;
                $("#rnaMessage").className = "muted";
            }
        } catch (error) {
            state.error = error.name === "AbortError"
                ? "Veri yükleme zaman aşımına uğradı."
                : `Veri yüklenemedi: ${error.message}`;

            console.error("[RNA]", error);
            ensureUI();
            $("#rnaMessage").textContent = state.error;
            $("#rnaMessage").className = "muted error";
            $("#rnaDiagnostics").textContent = state.error;
        } finally {
            clearTimeout(timer);
            state.loading = false;
        }
    }

    window.RNA = Object.freeze({
        config: CFG,
        markets: MARKETS,
        reload: loadData,
        render,
        get rows() {
            return state.rows.length;
        },
        get diagnostics() {
            return { ...state.stats, cachedHistories: state.historyCache.size };
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
