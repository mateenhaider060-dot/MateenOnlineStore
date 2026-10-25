// ============================================================
// متین آن لائن اسٹور - گلوبل جاوا اسکرپٹ
// فائل: Js/global.js
// مقصد: عام مددگار فنکشنز (ٹوسٹ، لوڈر، فارمیٹ وغیرہ)
// ============================================================

// ------------------------------------------------------------
// 1. ٹوسٹ (اطلاع) دکھانا
// استعمال: showToast("پیغام", "success" | "error" | "warning" | "info")
// ------------------------------------------------------------
export function showToast(message, type = "info", duration = 3000) {
  // کنٹینر بناؤ اگر نہ ہو
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  // ٹوسٹ عنصر بناؤ
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // مقررہ وقت بعد ہٹا دو
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ------------------------------------------------------------
// 2. لوڈر چالو / بند کرنا
// استعمال: showLoader() / hideLoader()
// ------------------------------------------------------------
export function showLoader() {
  let loader = document.getElementById("loader");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "loader";
    loader.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loader);
  }
  loader.classList.add("active");
}

export function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.classList.remove("active");
}

// ------------------------------------------------------------
// 3. قیمت کو خوبصورت بنانا
// استعمال: formatPrice(1500)  →  "Rs. 1,500"
// ------------------------------------------------------------
export function formatPrice(amount) {
  if (amount === null || amount === undefined) return "Rs. 0";
  const num = Number(amount) || 0;
  return "Rs. " + num.toLocaleString("en-PK");
}

// ------------------------------------------------------------
// 4. تاریخ کو خوبصورت بنانا
// استعمال: formatDate(new Date())  →  "11 اکتوبر 2026"
// ------------------------------------------------------------
export function formatDate(date) {
  if (!date) return "";
  let d;
  // Firestore Timestamp ہو تو
  if (date.toDate) d = date.toDate();
  else if (typeof date === "string" || typeof date === "number") d = new Date(date);
  else d = date;

  const months = [
    "جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون",
    "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"
  ];

  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ------------------------------------------------------------
// 5. تاریخ + وقت
// ------------------------------------------------------------
export function formatDateTime(date) {
  if (!date) return "";
  let d;
  if (date.toDate) d = date.toDate();
  else if (typeof date === "string" || typeof date === "number") d = new Date(date);
  else d = date;

  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${formatDate(d)} — ${h}:${m}`;
}

// ------------------------------------------------------------
// 6. ای میل چیک کرنا
// ------------------------------------------------------------
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ------------------------------------------------------------
// 7. پاکستانی فون نمبر چیک کرنا
// قبول کرے گا: 03001234567 یا +923001234567
// ------------------------------------------------------------
export function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s-]/g, "");
  const re = /^(\+92|0)3\d{9}$/;
  return re.test(cleaned);
}

// ------------------------------------------------------------
// 8. لیمٹ والا متن (طویل عنوان چھوٹا کرنا)
// استعمال: truncate("بہت لمبا عنوان...", 30)
// ------------------------------------------------------------
export function truncate(text, maxLength = 50) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

// ------------------------------------------------------------
// 9. یونیک آئی ڈی بنانا (آرڈر نمبر وغیرہ کے لیے)
// ------------------------------------------------------------
export function generateId(prefix = "ORD") {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `${prefix}-${time}-${random}`;
}

// ------------------------------------------------------------
// 10. تصدیق: صارف لاگ ان ہے یا نہیں (page protection کے لیے)
// استعمال: requireAuth()
// ------------------------------------------------------------
export function requireAuth(auth) {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (user) resolve(user);
      else {
        // لاگ ان صفحے پر بھیج دو
        window.location.href = "../Pages/login.html";
        reject("Not logged in");
      }
    });
  });
}

// ------------------------------------------------------------
// 11. اگر صارف لاگ ان ہو تو گھر بھیج دو (login/signup سے)
// ------------------------------------------------------------
export function redirectIfLoggedIn(auth, to = "../Pages/home.html") {
  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = to;
  });
}

// ------------------------------------------------------------
// 12. URL سے پیرامیٹر نکالنا
// استعمال: getQueryParam("id")  →  "abc123"
// ------------------------------------------------------------
export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ------------------------------------------------------------
// 13. مقامی اسٹوریج (LocalStorage) میں محفوظ کرنا
// ------------------------------------------------------------
export function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("مقامی اسٹوریج میں محفوظ نہیں ہو سکا:", e);
  }
}

export function getLocal(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function removeLocal(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(e);
  }
}

// ------------------------------------------------------------
// 14. تصویر کے لیے ڈیفالٹ (اگر تصویر نہ ہو)
// ------------------------------------------------------------
export const DEFAULT_PRODUCT_IMAGE =
  "https://res.cloudinary.com/demo/image/upload/v1/samples/placeholder.png";

// ------------------------------------------------------------
// 15. کلک کے بعد بٹن کو غیر فعال کرنا (double click سے بچنے کے لیے)
// ------------------------------------------------------------
export function disableButton(btn, text = "انتظار کریں...") {
  if (!btn) return;
  btn.dataset.originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = text;
}

export function enableButton(btn) {
  if (!btn) return;
  btn.disabled = false;
  if (btn.dataset.originalText) {
    btn.textContent = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
}

// ------------------------------------------------------------
// 16. صفحے پر واپس جانا
// ------------------------------------------------------------
export function goBack(fallback = "../Pages/home.html") {
  if (window.history.length > 1) window.history.back();
  else window.location.href = fallback;
}