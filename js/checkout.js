// ============================================
// checkout.js — CHECKOUT PAGE LOGIC
// ============================================

import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from "./i18n.js";
import { showToast, showLoader, hideLoader } from "./global.js";

// ---------- Constants ----------
const SHIPPING_FEE = 200;
const FREE_SHIPPING_MIN = 5000;

// ---------- State ----------
let cart = [];
let appliedCoupon = null;
let currentUser = null;

// ---------- DOM refs ----------
const emptyEl      = document.getElementById("emptyCheckout");
const layoutEl     = document.getElementById("checkoutLayout");
const itemsList    = document.getElementById("summaryItems");

const subtotalEl   = document.getElementById("summarySubtotal");
const shippingEl   = document.getElementById("summaryShipping");
const discountEl   = document.getElementById("summaryDiscount");
const discountRowEl = document.getElementById("discountRow");
const totalEl      = document.getElementById("summaryTotal");

const placeOrderBtn = document.getElementById("placeOrderBtn");
const successModal  = document.getElementById("successModal");
const modalOrderNo  = document.getElementById("modalOrderNumber");

const bankDetails   = document.getElementById("bankDetails");

// ============================================
// 1) Cart + Coupon load karo
// ============================================
function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem("cart") || "[]");
    appliedCoupon = JSON.parse(localStorage.getItem("coupon") || "null");
  } catch {
    cart = [];
    appliedCoupon = null;
  }
}

// ============================================
// 2) Header cart count
// ============================================
function updateHeaderCartCount() {
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = totalQty;
}

// ============================================
// 3) Render summary items + totals
// ============================================
function renderSummary() {
  if (cart.length === 0) {
    emptyEl.classList.remove("hidden");
    layoutEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  layoutEl.classList.remove("hidden");

  itemsList.innerHTML = cart.map((item) => `
    <div class="summary-item">
      <img src="${item.image || 'https://via.placeholder.com/100?text=No+Image'}" alt="${item.title}" />
      <div class="summary-item-info">
        <p>${item.title}</p>
        <span>× ${item.qty}</span>
      </div>
      <div class="summary-item-price">Rs ${(item.price * item.qty).toLocaleString()}</div>
    </div>
  `).join("");

  updateTotals();
}

// ============================================
// 4) Totals calculate
// ============================================
function updateTotals() {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  let shipping = subtotal === 0 ? 0 : (subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_FEE);

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
  shippingEl.textContent = shipping === 0 ? (t("free") || "Free") : `Rs ${shipping.toLocaleString()}`;

  if (discount > 0) {
    discountRowEl.classList.remove("hidden");
    discountEl.textContent = `- Rs ${discount.toLocaleString()}`;
  } else {
    discountRowEl.classList.add("hidden");
  }

  totalEl.textContent = `Rs ${total.toLocaleString()}`;

  return { subtotal, shipping, discount, total };
}

// ============================================
// 5) Payment method change
// ============================================
document.querySelectorAll('input[name="payment"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "bank") {
      bankDetails.classList.remove("hidden");
    } else {
      bankDetails.classList.add("hidden");
    }
  });
});

// ============================================
// 6) Form validation
// ============================================
function validateForm() {
  const name    = document.getElementById("fullName").value.trim();
  const phone   = document.getElementById("phone").value.trim();
  const email   = document.getElementById("email").value.trim();
  const address = document.getElementById("address").value.trim();
  const city    = document.getElementById("city").value.trim();

  if (!name || !phone || !email || !address || !city) {
    showToast(t("fill_all_fields") || "Please fill all fields", "warning");
    return false;
  }

  // Phone validation (Pakistani)
  if (!/^03\d{9}$/.test(phone)) {
    showToast(t("invalid_phone") || "Invalid phone number", "error");
    return false;
  }

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast(t("invalid_email") || "Invalid email", "error");
    return false;
  }

  return true;
}

// ============================================
// 7) Place Order
// ============================================
placeOrderBtn?.addEventListener("click", async () => {
  if (!validateForm()) return;

  showLoader();

  try {
    // Current user info
    currentUser = auth.currentUser;
    const userData = {
      uid: currentUser ? currentUser.uid : "guest",
      email: currentUser ? currentUser.email : document.getElementById("email").value.trim(),
    };

    const totals = updateTotals();
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

    // Order number generate
    const orderNumber = "MOS-" + Date.now().toString().slice(-8);

    // Order object
    const orderData = {
      orderNumber,
      userId: userData.uid,
      userEmail: userData.email,

      // Shipping
      fullName: document.getElementById("fullName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      address: document.getElementById("address").value.trim(),
      city: document.getElementById("city").value.trim(),
      postalCode: document.getElementById("postalCode").value.trim(),

      // Payment
      paymentMethod,
      paymentStatus: "pending",

      // Notes
      orderNotes: document.getElementById("orderNotes").value.trim(),

      // Items
      items: cart.map((c) => ({
        productId: c.id,
        title: c.title,
        price: c.price,
        qty: c.qty,
        image: c.image,
      })),

      // Totals
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      discount: totals.discount,
      total: totals.total,
      couponCode: appliedCoupon ? appliedCoupon.code || null : null,

      // Status
      status: "pending",

      createdAt: serverTimestamp(),
    };

    // Firestore mein save karo
    await addDoc(collection(db, "orders"), orderData);

    // Cart clear karo
    localStorage.removeItem("cart");
    localStorage.removeItem("coupon");

    // Success modal dikhao
    modalOrderNo.textContent = orderNumber;
    successModal.classList.remove("hidden");

    showToast(t("order_success") || "Order placed!", "success");
  } catch (err) {
    console.error("❌ Order error:", err);
    showToast(t("error") || "Could not place order", "error");
  } finally {
    hideLoader();
  }
});

// ============================================
// 8) Language change
// ============================================
window.addEventListener("languageChanged", () => {
  renderSummary();
});

// ============================================
// 9) Start
// ============================================
loadCart();
updateHeaderCartCount();
renderSummary();