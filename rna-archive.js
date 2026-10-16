
"use strict";

/* =========================================================
   RNA — GEÇMİŞ KUPON ARŞİVİ
   Mevcut hesaplama motoruna müdahale etmez.
   Kayıt yeri: Tarayıcı localStorage
   ========================================================= */

(() => {
  const STORAGE_KEY = "rna_coupon_archive_v1";
  const PANEL_ID = "rnaArchivePanel";

  let initialized = false;
  let saveTimer = null;
  let domObserver = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getRoot() {
    return $("#rnaRoot") || document;
  }

  function getElements() {
    const root = getRoot();

    return {
      root,
      date: $("#rnaDate", root) || $("#rnaDate"),
      coupons: $("#rnaCoupons", root) || $("#rnaCoupons"),
      summary: $("#rnaSummary", root) || $("#rnaSummary"),
      diagnostics: $("#rnaDiagnostics", root) || $("#rnaDiagnostics")
    };
  }

  function readArchive() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (!value) return {};

      const parsed = JSON.parse(value);

      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch (error) {
      console.error("RNA arşivi okunamadı:", error);
      return {};
    }
  }

  function writeArchive(archive) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
      return true;
    } catch (error) {
      console.error("RNA arşivi kaydedilemedi:", error);
      alert(
        "Arşiv kaydedilemedi. Tarayıcı depolama alanı dolmuş veya kapalı olabilir."
      );
      return false;
    }
  }

  function selectedMatchDate() {
    const { date } = getElements();

    return date && date.value ? date.value : todayISO();
  }

  function formatDate(value) {
    if (!value) return "Tarih belirtilmedi";

    const parts = value.split("-");

    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    return value;
  }

  function formatSavedAt(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString("tr-TR");
  }

  function addStyles() {
    if ($("#rnaArchiveStyles")) return;

    const style = document.createElement("style");
    style.id = "rnaArchiveStyles";

    style.textContent = `
      #${PANEL_ID} {
        margin: 20px 0;
        padding: 16px;
        border: 1px solid #293b53;
        border-radius: 16px;
        background: #0c1829;
        color: #f3f6fc;
        font-family: inherit;
        box-sizing: border-box;
        width: 100%;
      }

      #${PANEL_ID} * {
        box-sizing: border-box;
      }

      #${PANEL_ID} .rna-archive-heading {
        margin: 0 0 6px;
        font-size: 18px;
        font-weight: 800;
      }

      #${PANEL_ID} .rna-archive-description {
        margin: 0 0 14px;
        color: #9aa9bd;
        font-size: 12px;
        line-height: 1.6;
      }

      #${PANEL_ID} .rna-archive-controls {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      #${PANEL_ID} select,
      #${PANEL_ID} button {
        width: 100%;
        min-width: 0;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid #344862;
        border-radius: 10px;
        background: #132238;
        color: #f3f6fc;
        font: inherit;
        font-size: 13px;
      }

      #${PANEL_ID} button {
        cursor: pointer;
        font-weight: 700;
      }

      #${PANEL_ID} button:active {
        transform: scale(.99);
      }

      #${PANEL_ID} .rna-archive-save {
        background: #174d3d;
        border-color: #28775d;
      }

      #${PANEL_ID} .rna-archive-status {
        margin-top: 10px;
        color: #9aa9bd;
        font-size: 12px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      #${PANEL_ID} .rna-archive-view {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid #293b53;
      }

      #${PANEL_ID} .rna-archive-view[hidden] {
        display: none !important;
      }

      #${PANEL_ID} .rna-archive-view-title {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 800;
      }

      #${PANEL_ID} .rna-archive-saved-at {
        margin: 0 0 12px;
        color: #9aa9bd;
        font-size: 11px;
      }

      #${PANEL_ID} .rna-archive-content {
        overflow-wrap: anywhere;
      }

      #${PANEL_ID} .rna-archive-empty {
        padding: 14px;
        border: 1px dashed #344862;
        border-radius: 10px;
        color: #9aa9bd;
        font-size: 13px;
        line-height: 1.7;
      }

      #${PANEL_ID} .rna-archive-content img {
        max-width: 100%;
      }

      @media (min-width: 560px) {
        #${PANEL_ID} .rna-archive-controls {
          grid-template-columns: minmax(0, 1fr) auto;
        }

        #${PANEL_ID} .rna-archive-controls button {
          width: auto;
          min-width: 150px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createPanel(elements) {
    if ($("#" + PANEL_ID)) return $("#" + PANEL_ID);

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "Geçmiş kupon arşivi");

    panel.innerHTML = `
      <h2 class="rna-archive-heading">Geçmiş Kupon Arşivi</h2>

      <p class="rna-archive-description">
        Kaydedilmiş kuponları tarihine göre görüntüle.
        Arşiv, bu tarayıcıda saklanır.
      </p>

      <div class="rna-archive-controls">
        <select class="rna-archive-select" aria-label="Arşiv tarihi">
          <option value="">Kayıtlı kupon tarihi seç</option>
        </select>

        <button type="button" class="rna-archive-save">
          Seçili günü arşivle
        </button>
      </div>

      <div class="rna-archive-status" role="status" aria-live="polite">
        Henüz arşiv kaydı kontrol edilmedi.
      </div>

      <div class="rna-archive-view" hidden>
        <h3 class="rna-archive-view-title"></h3>
        <p class="rna-archive-saved-at"></p>
        <div class="rna-archive-content"></div>
      </div>
    `;

    if (elements.coupons) {
      elements.coupons.insertAdjacentElement("afterend", panel);
    } else {
      elements.root.appendChild(panel);
    }

    panel.querySelector(".rna-archive-save").addEventListener("click", () => {
      saveSnapshot(true);
    });

    panel.querySelector(".rna-archive-select").addEventListener("change", event => {
      showArchive(event.target.value);
    });

    return panel;
  }

  function refreshArchiveOptions(keepSelection = true) {
    const panel = $("#" + PANEL_ID);
    if (!panel) return;

    const select = $(".rna-archive-select", panel);
    const previous = keepSelection ? select.value : "";

    const archive = readArchive();
    const dates = Object.keys(archive).sort((a, b) => b.localeCompare(a));

    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Kayıtlı kupon tarihi seç";
    select.appendChild(placeholder);

    dates.forEach(date => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = `${formatDate(date)} — ${archive[date].count || 0} seçim`;
      select.appendChild(option);
    });

    if (previous && archive[previous]) {
      select.value = previous;
    }

    const status = $(".rna-archive-status", panel);

    if (dates.length) {
      status.textContent = `${dates.length} farklı tarih için arşiv kaydı mevcut.`;
    } else {
      status.textContent =
        "Henüz kayıt yok. Kuponlar oluşturulduğunda arşivlemeye başlayabilirsin.";
    }
  }

  function getMeaningfulHTML(element) {
    if (!element) return "";

    const html = element.innerHTML.trim();
    const text = (element.innerText || element.textContent || "").trim();

    if (!html || !text) return "";

    const normalized = text.toLocaleLowerCase("tr-TR");

    if (
      normalized === "yükleniyor..." ||
      normalized === "yükleniyor…" ||
      normalized === "kuponlar hazırlanıyor..."
    ) {
      return "";
    }

    return html;
  }

  function saveSnapshot(manual = false) {
    const elements = getElements();
    const panel = $("#" + PANEL_ID);

    if (!elements.coupons || !panel) return false;

    const couponsHTML = getMeaningfulHTML(elements.coupons);

    if (!couponsHTML) {
      if (manual) {
        $(".rna-archive-status", panel).textContent =
          "Kaydedilecek kupon içeriği bulunamadı. Önce kuponların yüklenmesini bekle.";
      }
      return false;
    }

    const date = selectedMatchDate();
    const archive = readArchive();

    const summaryHTML = getMeaningfulHTML(elements.summary);
    const diagnosticsHTML = getMeaningfulHTML(elements.diagnostics);

    const text = (elements.coupons.innerText || elements.coupons.textContent || "").trim();

    const selectionCount = (text.match(/(?:MS1|MSX|MS2|İY1|İYX|İY2|KG|Alt|Üst)/gi) || []).length;

    archive[date] = {
      date,
      savedAt: new Date().toISOString(),
      couponsHTML,
      summaryHTML,
      diagnosticsHTML,
      count: selectionCount,
      source: "rna-archive-v1"
    };

    if (!writeArchive(archive)) return false;

    refreshArchiveOptions();

    const status = $(".rna-archive-status", panel);
    status.textContent = `${formatDate(date)} tarihli kupon arşivi kaydedildi.`;

    if (manual) {
      showArchive(date);
    }

    return true;
  }

  function showArchive(date) {
    const panel = $("#" + PANEL_ID);
    if (!panel) return;

    const view = $(".rna-archive-view", panel);
    const title = $(".rna-archive-view-title", panel);
    const savedAt = $(".rna-archive-saved-at", panel);
    const content = $(".rna-archive-content", panel);

    if (!date) {
      view.hidden = true;
      content.replaceChildren();
      return;
    }

    const archive = readArchive();
    const record = archive[date];

    if (!record) {
      view.hidden = true;
      $(".rna-archive-status", panel).textContent =
        "Seçilen tarihe ait kayıt bulunamadı.";
      return;
    }

    title.textContent = `${formatDate(date)} — Arşivlenmiş Kuponlar`;

    const savedText = formatSavedAt(record.savedAt);
    savedAt.textContent = savedText ? `Son kayıt: ${savedText}` : "";

    content.replaceChildren();

    if (record.summaryHTML) {
      const summary = document.createElement("div");
      summary.className = "rna-archive-saved-summary";
      summary.innerHTML = record.summaryHTML;
      content.appendChild(summary);
    }

    const coupons = document.createElement("div");
    coupons.className = "rna-archive-saved-coupons";
    coupons.innerHTML = record.couponsHTML || "";

    if (!coupons.innerHTML.trim()) {
      coupons.innerHTML = `
        <div class="rna-archive-empty">
          Bu tarih için kayıtlı kupon içeriği bulunamadı.
        </div>
      `;
    }

    content.appendChild(coupons);

    if (record.diagnosticsHTML) {
      const details = document.createElement("details");
      details.style.marginTop = "12px";

      const summaryElement = document.createElement("summary");
      summaryElement.textContent = "Kayıtlı analiz ayrıntıları";
      summaryElement.style.cursor = "pointer";
      summaryElement.style.padding = "10px 0";

      const diagnostics = document.createElement("div");
      diagnostics.innerHTML = record.diagnosticsHTML;

      details.append(summaryElement, diagnostics);
      content.appendChild(details);
    }

    view.hidden = false;
    $(".rna-archive-status", panel).textContent =
      `${formatDate(date)} tarihli kayıt görüntüleniyor.`;
  }

  function scheduleSnapshot() {
    if (saveTimer) clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
      saveSnapshot(false);
    }, 900);
  }

  function initialize() {
    if (initialized) return;

    const elements = getElements();

    if (!elements.coupons) return;

    initialized = true;

    addStyles();
    createPanel(elements);
    refreshArchiveOptions(false);

    const archive = readArchive();
    const currentDate = selectedMatchDate();

    if (archive[currentDate]) {
      const panel = $("#" + PANEL_ID);
      $(".rna-archive-select", panel).value = currentDate;
      showArchive(currentDate);
    }

    const observer = new MutationObserver(() => {
      scheduleSnapshot();
    });

    observer.observe(elements.coupons, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });

    if (elements.summary) {
      observer.observe(elements.summary, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    if (elements.diagnostics) {
      observer.observe(elements.diagnostics, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Arayüz ilk yüklendiğinde mevcut dolu kuponları da kaydet.
    scheduleSnapshot();

    console.info("RNA geçmiş kupon arşivi hazır.");
  }

  function start() {
    initialize();

    if (initialized) return;

    if (!domObserver) {
      domObserver = new MutationObserver(() => {
        initialize();

        if (initialized && domObserver) {
          domObserver.disconnect();
          domObserver = null;
        }
      });

      domObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
