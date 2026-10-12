
"use strict";

/* =========================================================
   RNA — OTOMATİK KUPON MOTORU

   Veri              : ./data/v2-data.json
   Geçmiş            : 30 gün
   Minimum örnek     : 8
   Minimum başarı    : %80
   Minimum tekli oran: 1.35
   Minimum kupon oran: 2.00
   Maksimum maç      : 5

   Eşleştirme:
   1. Market birebir eşleşir.
   2. Oran iki ondalık basamağa yuvarlanır.
   3. Her market kendi gerçek sonucuna göre değerlendirilir.
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
        { key: "ms1", label: "MS 1", aliases: ["ms1", "MS1", "1"] },
        { key: "msX", label: "MS 0", aliases: ["msX", "ms0", "MSX", "MS0", "X"] },
        { key: "ms2", label: "MS 2", aliases: ["ms2", "MS2", "2"] },

        { key: "iy1", label: "İY 1", aliases: ["iy1", "İY1", "ht1"] },
        { key: "iyX", label: "İY 0", aliases: ["iyX", "iy0", "İYX", "İY0", "htX"] },
        { key: "iy2", label: "İY 2", aliases: ["iy2", "İY2", "ht2"] },

        { key: "iy05Ust", label: "İY 0.5 Üst", aliases: ["iy05Ust", "iy05üst", "iy05_over"] },
        { key: "iy15Ust", label: "İY 1.5 Üst", aliases: ["iy15Ust", "iy15üst", "iy15_over"] },
        { key: "iy15Alt", label: "İY 1.5 Alt", aliases: ["iy15Alt", "iy15alt", "iy15_under"] },

        { key: "kgVar", label: "KG Var", aliases: ["kgVar", "KG Var", "kgvar", "bttsYes"] },
        { key: "kgYok", label: "KG Yok", aliases: ["kgYok", "KG Yok", "kgyok", "bttsNo"] },

        { key: "au15Ust", label: "2.5 Alt/Üst — 1.5 Üst", aliases: ["au15Ust", "au15üst", "au15_over"] },
        { key: "au15Alt", label: "1.5 Alt", aliases: ["au15Alt", "au15alt", "au15_under"] },
        { key: "au25Ust", label: "2.5 Üst", aliases: ["au25Ust", "au25üst", "au25_over"] },
        { key: "au25Alt", label: "2.5 Alt", aliases: ["au25Alt", "au25alt", "au25_under"] },

        { key: "iyms11", label: "İY/MS 1/1", aliases: ["iyms11"] },
        { key: "iyms12", label: "İY/MS 1/2", aliases: ["iyms12"] },
        { key: "iyms21", label: "İY/MS 2/1", aliases: ["iyms21"] },
        { key: "iyms22", label: "İY/MS 2/2", aliases: ["iyms22"] },
        { key: "iyms00", label: "İY/MS 0/0", aliases: ["iyms00"] },
        { key: "iyms10", label: "İY/MS 1/0", aliases: ["iyms10"] },
        { key: "iyms20", label: "İY/MS 2/0", aliases: ["iyms20"] }
    ];

    const state = {
        matches: [],
        selectedDate: todayISO(),
        selectedMarkets: new Set(MARKETS.map(market => market.key)),
        historyCache: new Map(),
        loading: false
    };

    const number = value => {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        if (value === null || value === undefined || value === "") {
            return null;
        }

        const parsed = Number(
            String(value)
                .trim()
                .replace(",", ".")
                .replace(/[^\d.-]/g, "")
        );

        return Number.isFinite(parsed) ? parsed : null;
    };

    function todayISO() {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    function normalizeDate(value) {
        if (!value) return null;

        if (typeof value === "number") {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
        }

        const raw = String(value).trim();

        const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (iso) {
            return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
        }

        const local = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
        if (local) {
            return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
        }

        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
    }

    function normalizeKey(value) {
        return String(value ?? "")
            .trim()
            .toLocaleLowerCase("tr-TR")
            .replace(/[\s_-]+/g, "")
            .replace(/[ıİ]/g, "i");
    }

    function getValue(object, names) {
        if (!object || typeof object !== "object") return undefined;

        for (const name of names) {
            if (Object.prototype.hasOwnProperty.call(object, name)) {
                const value = object[name];
                if (value !== undefined && value !== null && value !== "") {
                    return value;
                }
            }
        }

        const normalized = new Map(
            Object.keys(object).map(key => [normalizeKey(key), object[key]])
        );

        for (const name of names) {
            const value = normalized.get(normalizeKey(name));
            if (value !== undefined && value !== null && value !== "") {
                return value;
            }
        }

        return undefined;
    }

    function getOddsObject(match) {
        return (
            match.odds ||
            match.openingOdds ||
            match.opening_odds ||
            match.openOdds ||
            match.open_odds ||
            match.markets ||
            match.oranlar ||
            match.oran ||
            match
        );
    }

    function getOdd(match, market) {
        const oddsObject = getOddsObject(match);
        const names = [market.key, ...market.aliases];

        let raw = getValue(oddsObject, names);

        if (raw && typeof raw === "object") {
            raw = getValue(raw, [
                "odd", "odds", "oran", "opening", "openingOdd",
                "openingOdds", "acilis", "acilisOrani", "value"
            ]);
        }

        const odd = number(raw);
        return odd !== null && odd > 1 ? odd : null;
    }

    // DNA tarzı: oranı iki ondalık basamağa sabitle.
    function oddKey(value) {
        const odd = number(value);
        return odd === null ? null : odd.toFixed(2);
    }

    function getFullScore(match) {
        const directHome = getValue(match, [
            "homeScore", "home_score", "scoreHome", "score_home",
            "evSahibiSkor", "evSkor"
        ]);

        const directAway = getValue(match, [
            "awayScore", "away_score", "scoreAway", "score_away",
            "deplasmanSkor", "depSkor"
        ]);

        if (directHome !== undefined && directAway !== undefined) {
            const home = number(directHome);
            const away = number(directAway);
            if (home !== null && away !== null) return { home, away };
        }

        const score = getValue(match, [
            "score", "result", "fullTimeScore", "full_time_score",
            "macSonucu", "skor", "sonuc"
        ]);

        return parseScore(score);
    }

    function getHalfScore(match) {
        const directHome = getValue(match, [
            "halfHomeScore", "half_home_score", "htHomeScore",
            "iyHomeScore", "iy_home_score", "firstHalfHomeScore"
        ]);

        const directAway = getValue(match, [
            "halfAwayScore", "half_away_score", "htAwayScore",
            "iyAwayScore", "iy_away_score", "firstHalfAwayScore"
        ]);

        if (directHome !== undefined && directAway !== undefined) {
            const home = number(directHome);
            const away = number(directAway);
            if (home !== null && away !== null) return { home, away };
        }

        const half = getValue(match, [
            "halfTimeScore", "half_time_score", "htScore",
            "iySkor", "ilkYariSkor", "firstHalfScore"
        ]);

        return parseScore(half);
    }

    function parseScore(value) {
        if (value && typeof value === "object") {
            const home = number(getValue(value, ["home", "homeScore", "h", "ev"]));
            const away = number(getValue(value, ["away", "awayScore", "a", "dep"]));
            if (home !== null && away !== null) return { home, away };
        }

        if (typeof value !== "string") return null;

        const match = value.match(/(\d+)\s*[-:]\s*(\d+)/);
        if (!match) return null;

        return { home: Number(match[1]), away: Number(match[2]) };
    }

    function getMatchDate(match) {
        return normalizeDate(getValue(match, [
            "date", "matchDate", "match_date", "datetime",
            "kickoff", "startTime", "start_time", "tarih"
        ]));
    }

    function getMatchId(match, index) {
        return String(getValue(match, ["id", "matchId", "match_id", "fixtureId"]) ?? index);
    }

    function getTeamName(match, side) {
        const names = side === "home"
            ? ["homeTeam", "home_team", "home", "evSahibi", "ev", "team1"]
            : ["awayTeam", "away_team", "away", "deplasman", "dep", "team2"];

        const value = getValue(match, names);

        if (value && typeof value === "object") {
            return String(getValue(value, ["name", "teamName", "title"]) ?? "Bilinmiyor");
        }

        return String(value ?? "Bilinmiyor");
    }

    function matchLabel(match) {
        return `${getTeamName(match, "home")} - ${getTeamName(match, "away")}`;
    }

    function getMarketOutcome(match, market) {
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

        const status = normalizeKey(getValue(match, [
            "status", "matchStatus", "match_status", "durum"
        ]));

        if (["scheduled", "upcoming", "notstarted", "bekliyor", "ertelendi"].includes(status)) {
            return false;
        }

        return true;
    }

    function normalizeMatches(payload) {
        if (Array.isArray(payload)) return payload;

        if (payload && Array.isArray(payload.matches)) return payload.matches;
        if (payload && Array.isArray(payload.data)) return payload.data;
        if (payload && Array.isArray(payload.fixtures)) return payload.fixtures;

        return [];
    }

    async function loadData() {
        setMessage("Veriler yükleniyor…");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

        try {
            const response = await fetch(
                `${CONFIG.DATA_URL}${CONFIG.DATA_URL.includes("?") ? "&" : "?"}t=${Date.now()}`,
                {
                    cache: "no-store",
                    signal: controller.signal
                }
            );

            if (!response.ok) {
                throw new Error(`Veri dosyası yüklenemedi: HTTP ${response.status}`);
            }

            const payload = await response.json();
            state.matches = normalizeMatches(payload);
            state.historyCache.clear();

            if (!state.matches.length) {
                throw new Error("JSON dosyasında maç verisi bulunamadı.");
            }

            render();
            setMessage(`${state.matches.length} maç yüklendi.`);
        } catch (error) {
            console.error("[RNA] Veri yükleme hatası:", error);
            setMessage(`Veri yüklenemedi: ${error.message}`, true);
        } finally {
            clearTimeout(timeout);
        }
    }

    function getHistoryWindow(targetDate) {
        const end = new Date(`${targetDate}T00:00:00`);
        const start = new Date(end);
        start.setDate(start.getDate() - CONFIG.HISTORY_DAYS);

        return {
            start: start.toISOString().slice(0, 10),
            end: targetDate
        };
    }

    function buildHistoryIndex(targetDate) {
        const cacheKey = `${targetDate}|${CONFIG.HISTORY_DAYS}|${[...state.selectedMarkets].sort().join(",")}`;

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
                        losses: 0
                    });
                }

                const group = index.get(key);
                group.sample += 1;

                if (result) {
                    group.wins += 1;
                } else {
                    group.losses += 1;
                }
            }
        }

        for (const group of index.values()) {
            group.success = group.sample
                ? (group.wins / group.sample) * 100
                : 0;
        }

        state.historyCache.set(cacheKey, index);
        return index;
    }

    function analyzeMatch(match, index) {
        const candidates = [];

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
                matchId: getMatchId(match, 0),
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

    function buildCoupon(candidates, minimumSuccess, usedMatchIds) {
        const coupon = [];
        let totalOdds = 1;

        for (const item of candidates) {
            if (coupon.length >= CONFIG.MAX_MATCHES) break;
            if (item.success < minimumSuccess) continue;
            if (usedMatchIds.has(item.matchId)) continue;

            const nextTotal = totalOdds * item.odd;

            if (coupon.length > 0 && nextTotal < totalOdds) continue;

            coupon.push(item);
            totalOdds = nextTotal;
            usedMatchIds.add(item.matchId);
        }

        if (totalOdds < CONFIG.MIN_TOTAL_ODDS) {
            return { items: [], totalOdds: 1 };
        }

        return { items: coupon, totalOdds };
    }

    function getCoupons(candidates) {
        const used = new Set();

        const safe = buildCoupon(candidates, 90, used);
        const medium = buildCoupon(candidates, 85, used);
        const risk = buildCoupon(candidates, 80, used);

        return [
            { key: "safe", title: "Güvenli Kupon", threshold: 90, ...safe },
            { key: "medium", title: "Orta Risk Kupon", threshold: 85, ...medium },
            { key: "risk", title: "Riskli Kupon", threshold: 80, ...risk }
        ];
    }

    function getResultStatus(item) {
        const outcome = getMarketOutcome(item.match, MARKETS.find(m => m.key === item.marketKey));

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
        return `${value.toFixed(1).replace(".", ",")}%`;
    }

    function setMessage(message, isError = false) {
        const element = document.getElementById("rnaMessage");
        if (!element) return;

        element.textContent = message;
        element.classList.toggle("error", isError);
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
                #rnaRoot button:disabled {
                    opacity: .5;
                    cursor: wait;
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
            state.selectedMarkets = new Set(MARKETS.map(market => market.key));
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
            : `<div class="rna-empty">Bu eşikte kupon oluşturacak yeterli eşleşme bulunamadı.</div>`;

        return `
            <article class="rna-coupon">
                <h3>${escapeHTML(coupon.title)} (%${coupon.threshold}+)</h3>
                <div class="rna-total">Toplam oran: ${coupon.totalOdds.toFixed(2)}</div>
                <div class="rna-muted">${coupon.items.length} / ${CONFIG.MAX_MATCHES} maç</div>
                ${body}
            </article>
        `;
    }

    function render() {
        ensureUI();

        const dateInput = document.getElementById("rnaDate");
        if (dateInput && dateInput.value !== state.selectedDate) {
            dateInput.value = state.selectedDate;
        }

        const targetMatches = state.matches.filter(match =>
            getMatchDate(match) === state.selectedDate && !isPlayed(match)
        );

        const history = buildHistoryIndex(state.selectedDate);
        const candidates = targetMatches.flatMap(match => analyzeMatch(match, history));

        // Aynı maçtan birden fazla market gelirse en güçlü eşleşmeyi kullan.
        const bestByMatch = new Map();

        for (const candidate of candidates) {
            const previous = bestByMatch.get(candidate.matchId);

            if (
                !previous ||
                candidate.success > previous.success ||
                (candidate.success === previous.success && candidate.sample > previous.sample)
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

        const summary = document.getElementById("rnaSummary");
        if (summary) {
            summary.textContent =
                `${state.selectedDate} · ${targetMatches.length} maç · ` +
                `${uniqueCandidates.length} uygun eşleşme · ` +
                `${history.size} market/oran grubu`;
        }

        const couponContainer = document.getElementById("rnaCoupons");
        if (couponContainer) {
            couponContainer.innerHTML = coupons.map(renderCoupon).join("");
        }

        const diagnostics = document.getElementById("rnaDiagnostics");
        if (diagnostics) {
            const grouped = [...history.values()]
                .sort((a, b) => b.success - a.success || b.sample - a.sample);

            diagnostics.innerHTML = `
                <p>Veri kaynağı: ${escapeHTML(CONFIG.DATA_URL)}</p>
                <p>Geçmiş aralığı: ${CONFIG.HISTORY_DAYS} gün</p>
                <p>Seçili market sayısı: ${state.selectedMarkets.size}</p>
                <p>Minimum örnek: ${CONFIG.MIN_SAMPLE}</p>
                <p>Minimum başarı: %${CONFIG.MIN_SUCCESS}</p>
                <p>Eşleştirme anahtarı: market anahtarı + iki ondalıklı oran</p>
                <p>Market sonucu, aynı marketin kendi sonuç fonksiyonuyla değerlendirilir.</p>
                <p>Uygun geçmiş grubu: ${grouped.filter(group =>
                    group.sample >= CONFIG.MIN_SAMPLE &&
                    group.success >= CONFIG.MIN_SUCCESS
                ).length}</p>
            `;
        }
    }

    function init() {
        ensureUI();
        renderMarketFilters();
        loadData();
    }

    // Mevcut sayfada başka scriptlerin kullanabilmesi için API.
    window.RNA = Object.freeze({
        config: CONFIG,
        markets: MARKETS,
        reload: loadData,
        render,
        getOdd,
        oddKey,
        getMarketOutcome,
        buildHistoryIndex
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
