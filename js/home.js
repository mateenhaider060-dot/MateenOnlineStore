// ============================================
// HOME PAGE LOGIC — باہر i18n کے ساتھ
// Firebase سے ڈیٹا لا کر bilingual دکھانا
// ============================================

import { db, auth } from "./firebase-config.js";
import {
  t,
  initLanguage,
  toggleLanguage,
  getCurrentLang
} from "./i18n.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ============================================
// HELPERS
// ============================================

// قیمت فارمیٹ
function formatPrice(num) {
  return "Rs. " + Number(num || 0).toLocaleString("en-PK");
}

// پروڈکٹ کا نام زبان کے مطابق
function getProductName(p) {
  const lang = getCurrentLang();
  if (lang === "ur" && p.nameUr) return p.nameUr;
  return p.nameEn || p.name || "Product";
}

// کیٹیگری کا نام زبان کے مطابق
function getCategoryName(c) {
  const lang = getCurrentLang();
  if (lang === "ur" && c.nameUr) return c.nameUr;
  return c.nameEn || c.name || "Category";
}

// ============================================
// 1) FEATURED PRODUCTS
// ============================================
async function loadFeaturedProducts() {
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;

  try {
    const q = query(
      collection(db, "products"),
      where("featured", "==", true),
      limit(8)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      grid.innerHTML = `<p class="loading-text">${t("no_featured")}</p>`;
      return;
    }

    grid.innerHTML = "";
    snap.forEach((docSnap) => {
      grid.appendChild(buildProductCard(docSnap.id, docSnap.data()));
    });
  } catch (err) {
    console.error("Featured load error:", err);
    grid.innerHTML = `<p class="loading-text">${t("error_loading")}</p>`;
  }
}

// ============================================
// 2) NEW ARRIVALS
// ============================================
async function loadNewArrivals() {
  const grid = document.getElementById("newArrivalsGrid");
  if (!grid) return;

  try {
    const q = query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      limit(8)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      grid.innerHTML = `<p class="loading-text">${t("no_products")}</p>`;
      return;
    }

    grid.innerHTML = "";
    snap.forEach((docSnap) => {
      grid.appendChild(buildProductCard(docSnap.id, docSnap.data()));
    });
  } catch (err) {
    console.error("New arrivals error:", err);
    grid.innerHTML = `<p class="loading-text">${t("error_loading")}</p>`;
  }
}

// ============================================
// 3) PRODUCT CARD
// ============================================
function buildProductCard(id, p) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.onclick = () => (window.location.href = `product-details.html?id=${id}`);

  const discountBadge = p.discount
    ? `<span class="product-badge">-${p.discount}%</span>`
    : "";

  const oldPrice = p.oldPrice
    ? `<del>${formatPrice(p.oldPrice)}</del>`
    : "";

  card.innerHTML = `
    ${discountBadge}
    <img src="${p.image || 'https://via.placeholder.com/300x300?text=No+Image'}"
         alt="${getProductName(p)}"
         onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'" />
    <div class="product-info">
      <div class="product-title">${getProductName(p)}</div>
      <div class="product-price">
        ${oldPrice} ${formatPrice(p.price)}
      </div>
    </div>
  `;
  return card;
}

// ============================================
// 4) CATEGORIES
// ============================================
async function loadCategories() {
  const grid = document.getElementById("categoriesGrid");
  if (!grid) return;

  try {
    const snap = await getDocs(collection(db, "categories"));

    if (snap.empty) {
      grid.innerHTML = `<p class="loading-text">${t("no_categories")}</p>`;
      return;
    }

    grid.innerHTML = "";
    snap.forEach((d) => {
      const c = d.data();
      const a = document.createElement("a");
      a.className = "category-card";
      a.href = `products.html?category=${d.id}`;
      a.innerHTML = `
        <img src="${c.image || 'https://via.placeholder.com/100?text=Cat'}"
             alt="${getCategoryName(c)}"
             onerror="this.src='https://via.placeholder.com/100?text=Cat'" />
        <span>${getCategoryName(c)}</span>
      `;
      grid.appendChild(a);
    });
  } catch (err) {
    console.error("Categories error:", err);
    grid.innerHTML = `<p class="loading-text">${t("error_loading")}</p>`;
  }
}

// ============================================
// 5) CART COUNT
// ============================================
async function loadCartCount() {
  const el = document.getElementById("cartCount");
  if (!el) return;

  if (!auth.currentUser) {
    el.textContent = "0";
    return;
  }
  try {
    const ref = doc(db, "carts", auth.currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists() && Array.isArray(snap.data().items)) {
      el.textContent = snap.data().items.length;
    } else {
      el.textContent = "0";
    }
  } catch (err) {
    console.error("Cart count error:", err);
    el.textContent = "0";
  }
}

// ============================================
// 6) SEARCH
// ============================================
function setupSearch() {
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("searchBtn");
  if (!input || !btn) return;

  const go = () => {
    const v = input.value.trim();
    if (v) window.location.href = `products.html?search=${encodeURIComponent(v)}`;
  };
  btn.addEventListener("click", go);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") go();
  });
}

// ============================================
// 7) LOGOUT
// ============================================
function setupLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!confirm(t("logout_confirm"))) return;
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// ============================================
// 8) LANGUAGE TOGGLE
// ============================================
function setupLanguageToggle() {
  const btn = document.getElementById("langToggle");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    await toggleLanguage();
  });
}

// ============================================
// 9) BANNER SLIDER
// ============================================
function setupBannerSlider() {
  const slides = document.querySelectorAll(".banner-slide");
  const dotsBox = document.getElementById("bannerDots");
  if (slides.length <= 1 || !dotsBox) return;

  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("active");
    dot.onclick = () => showSlide(i);
    dotsBox.appendChild(dot);
  });

  let current = 0;
  function showSlide(i) {
    slides.forEach((s) => s.classList.remove("active"));
    dotsBox.querySelectorAll("span").forEach((d) => d.classList.remove("active"));
    slides[i].classList.add("active");
    dotsBox.children[i].classList.add("active");
    current = i;
  }

  setInterval(() => {
    showSlide((current + 1) % slides.length);
  }, 4000);
}

// ============================================
// 10) RELOAD ALL DATA (زبان بدلنے پر)
// ============================================
function reloadAllData() {
  loadFeaturedProducts();
  loadNewArrivals();
  loadCategories();
}

// ============================================
// 11) INIT
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Auth guard نے پہلے ہی ری ڈائریکٹ کر دیا ہوگا
    return;
  }

  // 1. زبان لوڈ کریں (i18n.js خود بھی کر لیتا ہے، مگر یہاں بھی)
  await initLanguage();

  // 2. Language toggle button
  setupLanguageToggle();

  // 3. تمام data لوڈ کریں
  await Promise.all([
    loadFeaturedProducts(),
    loadNewArrivals(),
    loadCategories(),
    loadCartCount()
  ]);

  // 4. باقی setup
  setupSearch();
  setupLogout();
  setupBannerSlider();

  // 5. جب زبان بدلے → data دوبارہ render کریں
  window.addEventListener("languageChanged", () => {
    console.log("🌐 Language changed, reloading data...");
    reloadAllData();
  });
});