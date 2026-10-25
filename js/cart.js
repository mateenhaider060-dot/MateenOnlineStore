// ============================================
// cart.js — CART PAGE LOGIC
// ============================================

import { t } from "./i18n.js";
import { showToast, showLoader, hideLoader } from "./global.js";

// ---------- Constants ----------
const SHIPPING_FEE = 200;   // Rs 200 flat shipping
const FREE_SHIPPING_MIN = 5000; // Rs 5000 se upar free shipping

// ---------- State ----------
let cart = [];
let appliedCoupon = null;

// ---------- DOM refs ----------
const emptyCartEl   = document.getElementById("emptyCart");
const cartLayoutEl  = document.getElementById("cartLayout");
const itemsList     = document.getElementById("cartItemsList");

const subtotalEl    = document.getElementById("summarySubtotal");
const shippingEl    = document.getElementById("summaryShipping");
const discountEl    = document.getElementById("summaryDiscount");
const discountRowEl = document.getElementById("discountRow");
const totalEl       = document.getElementById("summaryTotal");

const couponInput   = document.getElementById("couponInput");
const applyCouponBtn = document.getElementById("applyCouponBtn");
const checkoutBtn   = document.getElementById("checkoutBtn");

// ============================================
// 1) Cart load karo (localStorage se)
// ============================================
function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem("cart") || "[]");
  } catch {
    cart = [];
  }
}

// ============================================
// 2) Cart save karo
// ============================================
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateHeaderCartCount();
}

// ============================================
// 3) Header cart count update
// ============================================
function updateHeaderCartCount() {
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = totalQty;
}

// ============================================
// 4) Render cart
// ============================================
function renderCart() {
  if (cart.length === 0) {
    emptyCartEl.classList.remove("hidden");
    cartLayoutEl.classList.add("hidden");
    return;
  }

  emptyCartEl.classList.add("hidden");
  cartLayoutEl.classList.remove("hidden");

  itemsList.innerHTML = cart.map((item, idx) => `
    <div class="cart-item" data-index="${idx}">
      <div class="cart-item-product">
        <img src="${item.image || 'https://via.placeholder.com/100?text=No+Image'}" alt="${item.title}" />
        <a href="product-details.html?id=${item.id}">${item.title}</a>
      </div>
      <div class="cart-item-price">Rs ${Number(item.price).toLocaleString()}</div>
      <div class="cart-item-qty">
        <button data-action="minus" data-index="${idx}">
          <i class="fa-solid fa-minus"></i>
        </button>
        <input type="number" value="${item.qty}" min="1" data-index="${idx}" class="qty-input" />
        <button data-action="plus" data-index="${idx}">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
      <div class="cart-item-total">Rs ${(item.price * item.qty).toLocaleString()}</div>
      <button class="cart-item-remove" data-action="remove" data-index="${idx}" title="Remove">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `).join("");

  bindCartEvents();
  updateSummary();
}

// ============================================
// 5) Cart events (qty +, -, remove)
// ============================================
function bindCartEvents() {
  itemsList.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const action = btn.dataset.action;

      if (action === "plus") {
        cart[idx].qty += 1;
      } else if (action === "minus") {
        if (cart[idx].qty > 1) cart[idx].qty -= 1;
      } else if (action === "remove") {
        cart.splice(idx, 1);
        showToast(t("remove_item") || "Removed", "info");
      }

      saveCart();
      renderCart();
    });
  });

  // Direct qty input change
  itemsList.querySelectorAll(".qty-input").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.dataset.index);
      let val = Number(input.value) || 1;
      if (val < 1) val = 1;
      cart[idx].qty = val;
      saveCart();
      renderCart();
    });
  });
}

// ============================================
// 6) Summary calculate + render
// ============================================
function updateSummary() {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  // Shipping
  let shipping = subtotal === 0 ? 0 : (subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE);

  // Discount
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === "percent") {
      discount = Math.round((subtotal * appliedCoupon.value) / 100);
    } else if (appliedCoupon.type === "flat") {
      discount = appliedCoupon.value;
    }
    if (discount > subtotal) discount = subtotal;
  }

  const total = subtotal + shipping - discount;

  subtotalEl.textContent = `Rs ${subtotal.toLocaleString()}`;
  shippingEl.textContent = shipping === 0 ? t("free") || "Free" : `Rs ${shipping.toLocaleString()}`;

  if (discount > 0) {
    discountRowEl.classList.remove("hidden");
    discountEl.textContent = `- Rs ${discount.toLocaleString()}`;
  } else {
    discountRowEl.classList.add("hidden");
  }

  totalEl.textContent = `Rs ${total.toLocaleString()}`;
}

// ============================================
// 7) Coupon apply (demo)
// ============================================
applyCouponBtn?.addEventListener("click", () => {
  const code = couponInput.value.trim().toUpperCase();
  if (!code) return;

  // Demo coupons — baad mein Firestore se laa sakte hain
  const coupons = {
    "SAVE10": { type: "percent", value: 10 },
    "SAVE20": { type: "percent", value: 20 },
    "FLAT100": { type: "flat", value: 100 },
  };

  if (coupons[code]) {
    appliedCoupon = coupons[code];
    localStorage.setItem("coupon", JSON.stringify(appliedCoupon));
    showToast(t("coupon_applied") || "Coupon applied!", "success");
    updateSummary();
  } else {
    showToast(t("invalid_coupon") || "Invalid coupon", "error");
  }
});

// ============================================
// 8) Checkout — login check
// ============================================
checkoutBtn?.addEventListener("click", (e) => {
  if (cart.length === 0) {
    e.preventDefault();
    showToast(t("empty_cart") || "Cart is empty", "warning");
  }
});

// ============================================
// 9) Language change par re-render
// ============================================
window.addEventListener("languageChanged", () => {
  renderCart();
});

// ============================================
// 10) Start
// ============================================
loadCart();
updateHeaderCartCount();
renderCart();

// appliedCoupon bhi restore karo (agar pehle se laga ho)
try {
  const saved = JSON.parse(localStorage.getItem("coupon") || "null");
  if (saved) appliedCoupon = saved;
} catch {}