// ============================================
// i18n.js — MULTI-LANGUAGE SYSTEM
// Languages: English (default) + اردو
// ============================================

// ---------- موجودہ زبان ----------
let currentLang = localStorage.getItem("lang") || "en";
let translations = {};

// ============================================
// 1) ترجمہ فائل لوڈ کریں
// ============================================
async function loadTranslations(lang) {
  try {
    // راستہ: Pages/ سے ../lang/en.json تک
    const res = await fetch(`../lang/${lang}.json`);
    if (!res.ok) throw new Error(`Could not load ${lang}.json`);
    translations = await res.json();
    console.log(`✅ Language loaded: ${lang}`);
  } catch (err) {
    console.error("❌ Translation load error:", err);
    translations = {};
  }
}

// ============================================
// 2) ترجمہ حاصل کریں (key → text)
// ============================================
export function t(key) {
  return translations[key] || key;
}

// ============================================
// 3) زبان سیٹ کریں
// ============================================
export async function setLanguage(lang) {
  if (!["en", "ur"].includes(lang)) lang = "en";

  currentLang = lang;
  localStorage.setItem("lang", lang);

  await loadTranslations(lang);

  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ur" ? "rtl" : "ltr";

  document.body.classList.remove("lang-en", "lang-ur");
  document.body.classList.add(`lang-${lang}`);

  applyTranslations();
  updatePageTitle();
  updateLanguageButton();

  window.dispatchEvent(new CustomEvent("languageChanged", {
    detail: { lang }
  }));

  console.log(`🌐 Language changed to: ${lang}`);
}

// ============================================
// 4) تمام عناصر پر ترجمہ لگائیں
// ============================================
function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = t(key);
    if (value) el.textContent = value;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const value = t(key);
    if (value) el.placeholder = value;
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const value = t(key);
    if (value) el.title = value;
  });

  document.querySelectorAll("[data-i18n-value]").forEach((el) => {
    const key = el.getAttribute("data-i18n-value");
    const value = t(key);
    if (value) el.value = value;
  });
}

// ============================================
// 5) صفحے کا ٹائٹل اپ ڈیٹ کریں
// ============================================
function updatePageTitle() {
  const titleEl = document.querySelector("title");
  if (!titleEl) return;

  const pageTitleKey = titleEl.getAttribute("data-i18n-page_title");

  let pageName = "";
  if (pageTitleKey) {
    pageName = t(pageTitleKey);
  } else {
    const oldTitle = titleEl.textContent;
    const parts = oldTitle.split("—");
    if (parts.length > 1) {
      pageName = parts[1].trim();
    } else {
      pageName = oldTitle;
    }
  }

  const brandName = t("brand");
  document.title = pageName ? `${brandName} — ${pageName}` : brandName;
}

// ============================================
// 6) Language button کا label اپڈیٹ
// ============================================
function updateLanguageButton() {
  const label = document.getElementById("langLabel");
  if (label) {
    label.textContent = currentLang === "en" ? "اردو" : "English";
  }
}

// ============================================
// 7) موجودہ زبان حاصل کریں
// ============================================
export function getCurrentLang() {
  return currentLang;
}

// ============================================
// 8) زبان ٹوگل کریں
// ============================================
export async function toggleLanguage() {
  const next = currentLang === "en" ? "ur" : "en";
  await setLanguage(next);
}

// ============================================
// 9) شروعات
// ============================================
export async function initLanguage() {
  await setLanguage(currentLang);
}

// ============================================
// 10) خودکار شروعات
// ============================================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initLanguage();
  });
} else {
  initLanguage();
}