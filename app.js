const state = {
    matches: [],
    filters: {
        search: "",
        date: "",
        league: "",
        unplayed: false
    }
};
const $ = (id) => document.getElementById(id);
function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function odd(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }
    const number = Number(value);
    return Number.isFinite(number)
        ? number.toFixed(2)
        : "—";
}
function score(value) {
    if (
        value &&
        value.home !== null &&
        value.home !== undefined &&
        value.away !== null &&
        value.away !== undefined
    ) {
        return `${value.home} - ${value.away}`;
    }
    return "—";
}
/* =========================================================
   BUGÜNÜN TARİHİ
   JS tarihi -> DD.MM.YYYY
========================================================= */
function getTodayString() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}.${month}.${year}`;
}
/* =========================================================
   TARİHİ KARŞILAŞTIRMA
========================================================= */
function dateKey(date) {
    if (!date) return "";
    const parts = String(date).split(".");
    if (parts.length !== 3) {
        return String(date);
    }
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    return `${year}-${month}-${day}`;
}
/* =========================================================
   FİLTRELENMİŞ MAÇLAR
========================================================= */
function filteredMatches() {
    const query = state.filters.search
        .trim()
        .toLocaleLowerCase("tr-TR");
    return state.matches
        .filter((match) => {
            const text = `
                ${match.home ?? ""}
                ${match.away ?? ""}
                ${match.code ?? ""}
            `.toLocaleLowerCase("tr-TR");
            const searchOK =
                !query || text.includes(query);
            const dateOK =
                !state.filters.date ||
                match.date === state.filters.date;
            const leagueOK =
                !state.filters.league ||
                match.league === state.filters.league;
            const unplayedOK =
                !state.filters.unplayed ||
                (
                    match.score?.home == null &&
                    match.score?.away == null
                );
            return (
                searchOK &&
                dateOK &&
                leagueOK &&
                unplayedOK
            );
        })
        .sort((a, b) => {
            const keyA =
                `${dateKey(a.date)} ${a.time ?? ""} ${a.code ?? ""}`;
            const keyB =
                `${dateKey(b.date)} ${b.time ?? ""} ${b.code ?? ""}`;
            return keyA.localeCompare(
                keyB,
                "tr"
            );
        });
}
/* =========================================================
   TABLOYU OLUŞTUR
========================================================= */
function ensureTable() {
    const content = $("content");
    if (!content) return null;
    let table = $("matches");
    if (table) {
        return table;
    }
    content.innerHTML = `
        <div class="table-wrapper">
            <table id="matches">
                <thead>
                    <tr>
                        <th>Tarih</th>
                        <th>Saat</th>
                        <th>Lig</th>
                        <th>Kod</th>
                        <th>Ev Sahibi</th>
                        <th>Deplasman</th>
                        <th>İY</th>
                        <th>MS</th>
                        <th>MS1</th>
                        <th>MSX</th>
                        <th>MS2</th>
                        <th>KG VAR</th>
                        <th>KG YOK</th>
                        <th>2.5 ALT</th>
                        <th>2.5 ÜST</th>
                    </tr>
                </thead>
                <tbody id="matches-body"></tbody>
            </table>
        </div>
    `;
    return $("matches");
}
/* =========================================================
   TABLOYU RENDER ET
========================================================= */
function render() {
    const rows = filteredMatches();
    const message = $("message");
    if (message) {
        message.textContent =
            `${rows.length.toLocaleString("tr-TR")} maç gösteriliyor`;
    }
    const table = ensureTable();
    if (!table) return;
    const tbody =
        $("matches-body") ||
        table.querySelector("tbody");
    if (!tbody) return;
    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15">
                    <div class="empty">
                        Bu filtrelere uygun maç bulunamadı.
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    tbody.innerHTML = rows.map((match) => {
        const odds =
            match.openingOdds || {};
        return `
            <tr>
                <td>${esc(match.date)}</td>
                <td>${esc(match.time ?? "—")}</td>
                <td>${esc(match.league)}</td>
                <td>${esc(match.code)}</td>
                <td>${esc(match.home)}</td>
                <td>${esc(match.away)}</td>
                <td>
                    ${esc(score(match.halfTimeScore))}
                </td>
                <td class="score">
                    ${esc(score(match.score))}
                </td>
                <td>${odd(odds.ms1)}</td>
                <td>${odd(odds.msX)}</td>
                <td>${odd(odds.ms2)}</td>
                <td>${odd(odds.kgVar)}</td>
                <td>${odd(odds.kgYok)}</td>
                <td>${odd(odds.au25Alt)}</td>
                <td>${odd(odds.au25Ust)}</td>
            </tr>
        `;
    }).join("");
}
/* =========================================================
   FİLTRELERİ DOLDUR
========================================================= */
function fillFilters() {
    const dateFilter = $("dateFilter");
    const leagueFilter = $("leagueFilter");
    if (!dateFilter || !leagueFilter) {
        return;
    }
    const dates = [
        ...new Set(
            state.matches
                .map((match) => match.date)
                .filter(Boolean)
        )
    ].sort((a, b) =>
        dateKey(a).localeCompare(dateKey(b))
    );
    const leagues = [
        ...new Set(
            state.matches
                .map((match) => match.league)
                .filter(Boolean)
        )
    ].sort((a, b) =>
        String(a).localeCompare(
            String(b),
            "tr"
        )
    );
    dateFilter.innerHTML = `
        <option value="">
            Tüm tarihler
        </option>
        ${dates.map((date) => `
            <option value="${esc(date)}">
                ${esc(date)}
            </option>
        `).join("")}
    `;
    leagueFilter.innerHTML = `
        <option value="">
            Tüm ligler
        </option>
        ${leagues.map((league) => `
            <option value="${esc(league)}">
                ${esc(league)}
            </option>
        `).join("")}
    `;
    /*
       AÇILIŞTA BUGÜNÜ SEÇ
    */
    const today = getTodayString();
    if (dates.includes(today)) {
        state.filters.date = today;
        dateFilter.value = today;
    } else {
        /*
          Bugünün verisi henüz JSON'da yoksa
          tüm tarihleri göster.
        */
        state.filters.date = "";
        dateFilter.value = "";
    }
}
/* =========================================================
   EVENTLER
========================================================= */
function setupEvents() {
    const search = $("search");
    if (search) {
        search.addEventListener(
            "input",
            (event) => {
                state.filters.search =
                    event.target.value;
                render();
            }
        );
    }
    const dateFilter = $("dateFilter");
    if (dateFilter) {
        dateFilter.addEventListener(
            "change",
            (event) => {
                state.filters.date =
                    event.target.value;
                render();
            }
        );
    }
    const leagueFilter = $("leagueFilter");
    if (leagueFilter) {
        leagueFilter.addEventListener(
            "change",
            (event) => {
                state.filters.league =
                    event.target.value;
                render();
            }
        );
    }
    const unplayedOnly = $("unplayedOnly");
    if (unplayedOnly) {
        unplayedOnly.addEventListener(
            "change",
            (event) => {
                state.filters.unplayed =
                    event.target.checked;
                render();
            }
        );
    }
    const refreshButton =
        $("refreshButton");
    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            () => {
                loadData(true);
            }
        );
    }
}
/* =========================================================
   VERİYİ YÜKLE
========================================================= */
async function loadData(forceRefresh = false) {
    const message = $("message");
    const updatedAt = $("updatedAt");
    try {
        if (message) {
            message.textContent =
                "Veriler yükleniyor...";
        }
        /*
          GitHub Pages'te kesin olarak
          mevcut klasörden data/matches.json oku.
        */
        const url =
            new URL(
                "./data/matches.json",
                window.location.href
            );
        /*
          Cache problemi yaşamamak için
          timestamp ekle.
        */
        if (forceRefresh) {
            url.searchParams.set(
                "_",
                Date.now().toString()
            );
        }
        const response =
            await fetch(
                url.toString(),
                {
                    method: "GET",
                    cache: "no-store"
                }
            );
        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }
        const data =
            await response.json();
        if (
            !data ||
            !Array.isArray(data.matches)
        ) {
            throw new Error(
                "matches verisi bulunamadı"
            );
        }
        /*
          VERİ BAŞARIYLA GELDİ
        */
        state.matches =
            data.matches;
        if (updatedAt) {
            if (data.updatedAt) {
                const date =
                    new Date(
                        data.updatedAt
                    );
                updatedAt.textContent =
                    `Son güncelleme: ${
                        date.toLocaleString(
                            "tr-TR"
                        )
                    }`;
            } else {
                updatedAt.textContent =
                    "Veri güncel";
            }
        }
        /*
          Filtreleri oluştur
          ve bugünü otomatik seç.
        */
        fillFilters();
        render();
    } catch (error) {
        console.error(
            "Veri yükleme hatası:",
            error
        );
        if (message) {
            message.textContent =
                "Veri yüklenemedi";
        }
        if (updatedAt) {
            updatedAt.textContent =
                "Veri bağlantısı başarısız";
        }
        const content =
            $("content");
        if (content) {
            content.innerHTML = `
                <div class="error">
                    <h3>
                        Veri yüklenemedi
                    </h3>
                    <p>
                        ${esc(error.message)}
                    </p>
                    <button
                        id="retryButton"
                        class="refresh-button"
                        type="button"
                    >
                        ↻ Tekrar Dene
                    </button>
                </div>
            `;
            const retry =
                $("retryButton");
            if (retry) {
                retry.addEventListener(
                    "click",
                    () => loadData(true)
                );
            }
        }
    }
}
/* =========================================================
   BAŞLAT
========================================================= */
document.addEventListener(
    "DOMContentLoaded",
    () => {
        setupEvents();
        loadData();
    }
);
