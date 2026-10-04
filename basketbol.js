(() => {
  "use strict";

  const DATA_URL = "./data/basketball.json";

  let matches = [];
  let currentDate = new Date();
  let selectedDate = new Date();

  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();

    currentDate = new Date();
    selectedDate = new Date();

    await loadData();
    renderCalendar();
    renderSelectedDate();
  }

  function bindEvents() {
    $("prevMonth")?.addEventListener("click", () => {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );

      renderCalendar();
    });

    $("nextMonth")?.addEventListener("click", () => {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );

      renderCalendar();
    });

    $("closeModal")?.addEventListener("click", closeModal);

    $("analysisModal")?.addEventListener("click", (e) => {
      if (e.target.id === "analysisModal") {
        closeModal();
      }
    });
  }

  async function loadData() {
    const container = $("matchesContainer");

    try {
      if (container) {
        container.innerHTML = `
          <div class="loading">
            Basketbol maçları yükleniyor...
          </div>
        `;
      }

      const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const rawMatches = Array.isArray(data)
        ? data
        : Array.isArray(data.matches)
          ? data.matches
          : [];

      matches = rawMatches
        .map(normalizeMatch)
        .filter(Boolean)
        .sort(sortMatches);

      window.basketballMatches = matches;

      console.log("🏀 Basketbol maçları:", matches.length);
      console.log(matches);

    } catch (error) {
      console.error("Basketbol verisi alınamadı:", error);

      if (container) {
        container.innerHTML = `
          <div class="empty">
            <div style="font-size:34px">⚠️</div>
            <strong>Basketbol verisi alınamadı</strong>
            <p>data/basketball.json kontrol edin.</p>
          </div>
        `;
      }
    }
  }

  /* =========================================================
     MAÇ NORMALİZASYONU
  ========================================================= */

  function normalizeMatch(m) {
    if (!m) return null;

    const home =
      m.home ??
      m.homeTeam ??
      m.home_name ??
      m.team1 ??
      m.takim1 ??
      "";

    const away =
      m.away ??
      m.awayTeam ??
      m.away_name ??
      m.team2 ??
      m.takim2 ??
      "";

    const date =
      m.date ??
      m.matchDate ??
      m.tarih ??
      "";

    const time =
      m.time ??
      m.matchTime ??
      m.saat ??
      "";

    if (!home || !away || !date) {
      return null;
    }

    return {
      ...m,

      id:
        m.id ??
        `${date}_${time}_${home}_${away}`,

      date: normalizeDate(date),

      time: normalizeTime(time),

      league:
        m.league ??
        m.leagueName ??
        m.league_name ??
        m.lig ??
        "Basketbol",

      home: cleanTeamName(home),

      away: cleanTeamName(away),

      total:
        numberValue(
          m.total ??
          m.totalScore ??
          m.ts ??
          m.altUst ??
          m.line
        ),

      homeScore:
        numberValue(
          m.homeScore ??
          m.home_score ??
          m.scoreHome ??
          m.msHome
        ),

      awayScore:
        numberValue(
          m.awayScore ??
          m.away_score ??
          m.scoreAway ??
          m.msAway
        ),

      halfHomeScore:
        numberValue(
          m.halfHomeScore ??
          m.half_home_score ??
          m.iyHome
        ),

      halfAwayScore:
        numberValue(
          m.halfAwayScore ??
          m.half_away_score ??
          m.iyAway
        )
    };
  }

  function cleanTeamName(value) {
    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeDate(value) {
    const s = String(value).trim();

    // 04.10.2026
    let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

    if (m) {
      return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    }

    // 2026-10-04
    m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);

    if (m) {
      return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    }

    return s;
  }

  function normalizeTime(value) {
    const s = String(value ?? "").trim();

    const m = s.match(/(\d{1,2}):(\d{2})/);

    if (!m) {
      return "";
    }

    return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
  }

  function numberValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const n = Number(
      String(value)
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    );

    return Number.isFinite(n) ? n : null;
  }

  /* =========================================================
     TAKVİM
  ========================================================= */

  function renderCalendar() {
    const calendar = $("calendar");
    const title = $("calendarTitle");

    if (!calendar) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık"
    ];

    if (title) {
      title.textContent = `${monthNames[month]} ${year}`;
    }

    calendar.innerHTML = "";

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = firstDay.getDay();

    // Pazartesi başlangıcı
    startDay = startDay === 0 ? 6 : startDay - 1;

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-day empty-day";
      calendar.appendChild(empty);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateKey = formatDate(date);

      const cell = document.createElement("button");

      cell.type = "button";
      cell.className = "calendar-day";

      if (isSameDate(date, selectedDate)) {
        cell.classList.add("selected");
      }

      if (isToday(date)) {
        cell.classList.add("today");
      }

      const dayMatches = getMatchesForDate(dateKey);

      if (dayMatches.length > 0) {
        cell.classList.add("has-matches");
      }

      cell.innerHTML = `
        <span class="day-number">${day}</span>
        ${
          dayMatches.length
            ? `<span class="match-dot">${dayMatches.length}</span>`
            : ""
        }
      `;

      cell.addEventListener("click", () => {
        selectedDate = new Date(date);

        renderCalendar();
        renderSelectedDate();
      });

      calendar.appendChild(cell);
    }
  }

  /* =========================================================
     SEÇİLİ GÜN
  ========================================================= */

  function renderSelectedDate() {
    const title = $("selectedDate");
    const count = $("matchCount");
    const container = $("matchesContainer");

    const dateKey = formatDate(selectedDate);
    const dayMatches = getMatchesForDate(dateKey);

    if (title) {
      title.textContent = formatTurkishDate(selectedDate);
    }

    if (count) {
      count.textContent = `${dayMatches.length} maç`;
    }

    if (!container) return;

    if (!dayMatches.length) {
      container.innerHTML = `
        <div class="empty">
          <div style="font-size:42px">🏀</div>
          <strong>Bu tarihte basketbol maçı yok</strong>
          <p>Başka bir gün seçebilirsiniz.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = "";

    dayMatches.forEach(match => {
      container.appendChild(createMatchCard(match));
    });
  }

  function getMatchesForDate(dateKey) {
    return matches
      .filter(m => m.date === dateKey)
      .sort(sortMatches);
  }

  /* =========================================================
     MAÇ KARTI
  ========================================================= */

  function createMatchCard(match) {
    const card = document.createElement("article");
    card.className = "basket-match-card";

    const prediction = calculatePrediction(match);
    const finished = isFinished(match);

    const totalText =
      prediction.total !== null
        ? prediction.total.toFixed(1)
        : "-";

    const firstHalfText =
      prediction.firstHalf !== null
        ? prediction.firstHalf.toFixed(1)
        : "-";

    card.innerHTML = `
      <div class="match-top">
        <span class="league">
          ${escapeHtml(match.league)}
        </span>

        <span class="match-time">
          ${escapeHtml(match.time || "--:--")}
        </span>
      </div>

      <div class="teams">
        <div class="team home">
          <strong>${escapeHtml(match.home)}</strong>
        </div>

        <div class="vs">
          ${
            finished
              ? `${match.homeScore ?? "-"}<span>-</span>${match.awayScore ?? "-"}`
              : "VS"
          }
        </div>

        <div class="team away">
          <strong>${escapeHtml(match.away)}</strong>
        </div>
      </div>

      <div class="prediction-box">
        <div class="prediction-title">
          TAHMİN
        </div>

        <div class="predicted-score">
          <span>${prediction.home.toFixed(1)}</span>
          <b>-</b>
          <span>${prediction.away.toFixed(1)}</span>
        </div>
      </div>

      <div class="stats-row">
        <div>
          <small>MAÇ TOPLAMI</small>
          <strong>${totalText}</strong>
        </div>

        <div>
          <small>İLK YARI</small>
          <strong>${firstHalfText}</strong>
        </div>

        <div>
          <small>GÜVEN</small>
          <strong>%${prediction.confidence}</strong>
        </div>
      </div>

      <button class="analysis-button" type="button">
        ANALİZ DETAY
      </button>
    `;

    card
      .querySelector(".analysis-button")
      ?.addEventListener("click", () => {
        openAnalysis(match, prediction);
      });

    return card;
  }

  /* =========================================================
     TAHMİN
  ========================================================= */

  function calculatePrediction(match) {
    /*
     * Şimdilik elimizde gelecek maç için yalnızca maçın
     * kendisine ait TS çizgisi varsa onu kullanıyoruz.
     *
     * Geçmiş maç verileri sisteme eklendiğinde burada:
     * - son 5
     * - son 10
     * - iç saha
     * - deplasman
     * - H2H
     * - ilk yarı
     * istatistikleri otomatik kullanılacak.
     */

    const total =
      match.total !== null
        ? match.total
        : 160;

    let homeRatio = 0.50;

    /*
     * Basit takım ismi bazlı sabit dağılım kullanmıyoruz.
     * Veri yoksa dengeli dağılım veriyoruz.
     */

    const home = total * homeRatio;
    const away = total - home;

    const firstHalf = total * 0.47;

    return {
      home,
      away,
      total,
      firstHalf,
      confidence:
        match.total !== null ? 62 : 50
    };
  }

  /* =========================================================
     ANALİZ MODALI
  ========================================================= */

  function openAnalysis(match, prediction) {
    const modal = $("analysisModal");

    if (!modal) return;

    const league = $("modalLeague");
    const home = $("modalHome");
    const away = $("modalAway");
    const time = $("modalTime");
    const content = $("modalContent");

    if (league) {
      league.textContent = match.league;
    }

    if (home) {
      home.textContent = match.home;
    }

    if (away) {
      away.textContent = match.away;
    }

    if (time) {
      time.textContent = match.time || "--:--";
    }

    if (content) {
      content.innerHTML = `
        <div class="analysis-summary">

          <div class="analysis-team">
            <span>${escapeHtml(match.home)}</span>
            <strong>${prediction.home.toFixed(1)}</strong>
          </div>

          <div class="analysis-vs">VS</div>

          <div class="analysis-team">
            <span>${escapeHtml(match.away)}</span>
            <strong>${prediction.away.toFixed(1)}</strong>
          </div>

        </div>

        <div class="analysis-grid">

          <div class="analysis-item">
            <small>Beklenen Maç Toplamı</small>
            <strong>
              ${
                prediction.total !== null
                  ? prediction.total.toFixed(1)
                  : "-"
              }
            </strong>
          </div>

          <div class="analysis-item">
            <small>Beklenen İlk Yarı</small>
            <strong>
              ${
                prediction.firstHalf !== null
                  ? prediction.firstHalf.toFixed(1)
                  : "-"
              }
            </strong>
          </div>

          <div class="analysis-item">
            <small>Ev Sahibi Tahmini</small>
            <strong>${prediction.home.toFixed(1)}</strong>
          </div>

          <div class="analysis-item">
            <small>Deplasman Tahmini</small>
            <strong>${prediction.away.toFixed(1)}</strong>
          </div>

          <div class="analysis-item">
            <small>Güven</small>
            <strong>%${prediction.confidence}</strong>
          </div>

          <div class="analysis-item">
            <small>Veri Durumu</small>
            <strong>
              ${
                match.total !== null
                  ? "TS mevcut"
                  : "Sınırlı veri"
              }
            </strong>
          </div>

        </div>

        <div class="analysis-note">
          Bu maç için geçmiş Mackolik istatistikleri
          henüz veri havuzuna eklenmemişse tahmin,
          mevcut maç bilgileri üzerinden hesaplanır.
        </div>
      `;
    }

    modal.classList.add("open");
    modal.style.display = "flex";
  }

  function closeModal() {
    const modal = $("analysisModal");

    if (!modal) return;

    modal.classList.remove("open");
    modal.style.display = "none";
  }

  /* =========================================================
     TARİH / SIRALAMA
  ========================================================= */

  function formatDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatTurkishDate(date) {
    const days = [
      "Pazar",
      "Pazartesi",
      "Salı",
      "Çarşamba",
      "Perşembe",
      "Cuma",
      "Cumartesi"
    ];

    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık"
    ];

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  function isToday(date) {
    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function isSameDate(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isFinished(match) {
    return (
      match.homeScore !== null &&
      match.awayScore !== null
    );
  }

  function sortMatches(a, b) {
    const ad = `${a.date} ${a.time}`;
    const bd = `${b.date} ${b.time}`;

    return ad.localeCompare(bd);
  }

  /* =========================================================
     HTML GÜVENLİĞİ
  ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================================================
     DIŞARIDAN ÇAĞRILABİLİR
  ========================================================= */

  window.refreshBasketball = async function () {
    await loadData();
    renderCalendar();
    renderSelectedDate();
  };

  window.renderBasketballDate = function (date) {
    const d = date instanceof Date
      ? date
      : new Date(date);

    if (Number.isNaN(d.getTime())) {
      return;
    }

    selectedDate = d;
    currentDate = new Date(
      d.getFullYear(),
      d.getMonth(),
      1
    );

    renderCalendar();
    renderSelectedDate();
  };

})();
