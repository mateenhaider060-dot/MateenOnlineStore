// ============================================
// WELCOME PAGE LOGIC — i18n کے ساتھ
// زبان بدلنے کا بٹن + خودکار redirect
// ============================================

import { auth } from "./firebase-config.js";
import { initLanguage, toggleLanguage } from "./i18n.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ============================================
// 1) LANGUAGE TOGGLE BUTTON
// ============================================
function setupLanguageToggle() {
  const btn = document.getElementById("langToggle");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await toggleLanguage();
  });
}

// ============================================
// 2) AUTO REDIRECT (اگر user پہلے سے logged in ہے)
// ============================================
function setupAutoRedirect() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User logged in — سیدھا home پر بھیجیں
      console.log("✅ User already logged in, redirecting to home...");

      // چھوٹی سی تاخیر تاکہ language لوڈ ہو جائے
      setTimeout(() => {
        window.location.href = "home.html";
      }, 300);
    }
    // اگر logged in نہیں تو welcome پر رہنے دیں
  });
}

// ============================================
// 3) INIT
// ============================================
async function init() {
  // زبان لوڈ کریں (default: English یا localStorage سے)
  await initLanguage();

  // Language button لگائیں
  setupLanguageToggle();

  // اگر user پہلے سے logged in ہے تو redirect
  setupAutoRedirect();
}

// صفحہ لوڈ ہوتے ہی چلائیں
init();