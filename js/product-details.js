// ============================================
// product-details.js — PRODUCT DETAILS LOGIC
// ============================================

import { db } from "./firebase-config.js";
import {
  doc, getDoc, collection, getDocs, query, where, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t, getCurrentLang } from "./i18n.js";
import { showToast, showLoader, hideLoader } from "./global.js";

// ---------- URL se product ID nikaalo ----------
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

// ---------- DOM refs ----------
const loadingEl    = document.getElementById("detailsLoading");
const layoutEl     = document.getElementById("productDetailsLayout");
const tabsEl       = document.getElementById("tabsSection");
const relatedEl    = document.getElementById("relatedSection");

const mainImage    = document.getElementById("mainImage");
const thumbRow     = document.getElementById("thumbnailRow");
const titleEl      = document.getElementById("detailTitle");
const starsEl      = document.getElementById("detailStars");
const reviewsEl    = document.getElementById("detailReviews");
const stockEl      = document.getElementById("detailStock");
const priceEl      = document.getElementById("detailPrice");
const oldPriceEl   = document.getElementById("detailOldPrice");
const discountEl   = document.getElementById("detailDiscount");
const descEl       = document.getElementById("detailDesc");
const breadcrumbEl = document.getElementById("breadcrumbProduct");
const relatedGrid  = document.getElementById("relatedGrid");

const qtyInput     = document.getElementById("qtyInput");
const addToCartBtn = document.getElementById("addToCartBtn");
const buyNowBtn    = document.getElementById("buyNowBtn");

let currentProduct = null;

// ============================================
// 1) Product load karo
// ============================================
async function loadProduct() {
  if (!productId) {
    loadingEl.textContent = "Product ID missing.";
    return;
  }

  showLoader();
  try {
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      loadingEl.textContent = "Product not found.";
      return;
    }

    currentProduct = { id: snap.id, ...snap.data() };
    renderProduct(currentProduct);
    loadRelatedProducts(currentProduct);
  } catch (err) {
    console.error("❌ Product load error:", err);
    loadingEl.textContent = t("error_loading");
  } finally {
    hideLoader();
  }
}

// ============================================
// 2) Product ko render karo
// ============================================
function renderProduct(p) {
  loadingEl.classList.add("hidden");
  layoutEl.classList.remove("hidden");
  tabsEl.classList.remove("hidden");

  // Title
  const title = p.title || p.name || "Untitled";
  titleEl.textContent = title;
  breadcrumbEl.textContent = title;
  document.title = `${title} — ${t("brand")}`;

  // Images
  const images = p.images && p.images.length
    ? p.images
    : [p.image || p.imageUrl || "https://via.placeholder.com/600x600?text=No+Image"];

  mainImage.src = images[0];
  mainImage.alt = title;

  thumbRow.innerHTML = images.map((img, i) => `
    <img src="${img}" alt="thumb ${i}" class="${i === 0 ? "active" : ""}" data-src="${img}" />
  `).join("");

  thumbRow.querySelectorAll("img").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      mainImage.src = thumb.dataset.src;
      thumbRow.querySelectorAll("img").forEach((x) => x.classList.remove("active"));
      thumb.classList.add("active");
    });
  });

  // Price
  const price = Number(p.price || 0);
  const oldPrice = p.oldPrice ? Number(p.oldPrice) : null;

  priceEl.textContent = `Rs ${price.toLocaleString()}`;

  if (oldPrice && oldPrice > price) {
    oldPriceEl.textContent = `Rs ${oldPrice.toLocaleString()}`;
    oldPriceEl.classList.remove("hidden");

    const disc = Math.round(((oldPrice - price) / oldPrice) * 100);
    discountEl.textContent = `-${disc}%`;
    discountEl.classList.remove("hidden");
  }

  // Description
  const desc = p.description || p.shortDesc || "—";
  descEl.textContent = desc;
  document.getElementById("tabDescriptionText").textContent = desc;

  // Stock
  const inStock = p.stock !== 0 && p.inStock !== false;
  stockEl.textContent = inStock ? t("in_stock") : t("out_of_stock");
  stockEl.className = "stock-badge " + (inStock ? "in-stock" : "out-stock");

  if (!inStock) {
    addToCartBtn.disabled = true;
    buyNowBtn.disabled = true;
  }

  // Rating
  const rating = p.rating || 5;
  const reviews = p.reviewsCount || 0;
  starsEl.textContent = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  reviewsEl.textContent = `(${reviews} ${t("reviews") || "reviews"})`;

  // Specifications
  const specs = p.specifications || {};
  const specsList = document.getElementById("tabSpecsList");
  if (Object.keys(specs).length === 0) {
    specsList.innerHTML = `<li><span data-i18n="no_specs">No specifications available.</span></li>`;
  } else {
    specsList.innerHTML = Object.entries(specs).map(([k, v]) => `
      <li><strong>${k}</strong><span>${v}</span></li>
    `).join("");
  }
}

// ============================================
// 3) Related Products load karo
// ============================================
async function loadRelatedProducts(p) {
  if (!p.category) return;

  try {
    const q = query(
      collection(db, "products"),
      where("category", "==", p.category),
      limit(8)
    );
    const snap = await getDocs(q);

    const related = [];
    snap.forEach((d) => {
      if (d.id !== p.id) related.push({ id: d.id, ...d.data() });
    });

    if (related.length === 0) return;

    relatedEl.classList.remove("hidden");

    relatedGrid.innerHTML = related.slice(0, 4).map((r) => {
      const img = r.image || r.imageUrl || "https://via.placeholder.com/300x300?text=No+Image";
      const title = r.title || r.name || "Untitled";
      const price = Number(r.price || 0).toLocaleString();
      return `
        <div class="product-card" data-id="${r.id}">
          <img src="${img}" alt="${title}" loading="lazy" />
          <div class="product-info">
            <h3 class="product-title">${title}</h3>
            <div class="product-price">Rs ${price}</div>
          </div>
        </div>
      `;
    }).join("");

    relatedGrid.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", () => {
        window.location.href = `product-details.html?id=${card.dataset.id}`;
      });
    });
  } catch (err) {
    console.error("Related products error:", err);
  }
}

// ============================================
// 4) Quantity controls
// ============================================
document.getElementById("qtyMinus")?.addEventListener("click", () => {
  let v = Number(qtyInput.value) || 1;
  if (v > 1) qtyInput.value = v - 1;
});

document.getElementById("qtyPlus")?.addEventListener("click", () => {
  let v = Number(qtyInput.value) || 1;
  qtyInput.value = v + 1;
});

qtyInput?.addEventListener("change", () => {
  let v = Number(qtyInput.value) || 1;
  if (v < 1) v = 1;
  qtyInput.value = v;
});

// ============================================
// 5) Add to Cart
// ============================================
addToCartBtn?.addEventListener("click", () => {
  if (!currentProduct) return;

  const qty = Number(qtyInput.value) || 1;
  addToCart(currentProduct, qty);
  showToast(`${currentProduct.title || currentProduct.name} — ${t("add_to_cart")} ✅`, "success");
});

// ============================================
// 6) Buy Now (Cart + Checkout par le jao)
// ============================================
buyNowBtn?.addEventListener("click", () => {
  if (!currentProduct) return;

  const qty = Number(qtyInput.value) || 1;
  addToCart(currentProduct, qty);
  window.location.href = "checkout.html";
});

// ============================================
// 7) Cart helper (localStorage based)
// ============================================
function addToCart(product, qty) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const idx = cart.findIndex((c) => c.id === product.id);

  if (idx > -1) {
    cart[idx].qty += qty;
  } else {
    cart.push({
      id: product.id,
      title: product.title || product.name,
      price: Number(product.price || 0),
      image: product.image || product.imageUrl || "",
      qty,
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  // Header cart count update
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  const cartCountEl = document.getElementById("cartCount");
  if (cartCountEl) cartCountEl.textContent = totalQty;
}

// ============================================
// 8) Tabs switching
// ============================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ============================================
// 9) Language change par re-render
// ============================================
window.addEventListener("languageChanged", () => {
  if (currentProduct) renderProduct(currentProduct);
});

// ============================================
// 10) Start
// ============================================
loadProduct();