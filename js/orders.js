// ============================================
// orders.js — MY ORDERS PAGE LOGIC
// ============================================

import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { t } from "./i18n.js";
import { showLoader, hideLoader, showToast } from "./global.js";

// ---------- State ----------
let allOrders = [];
let filteredOrders = [];
let currentFilter = "all";

// ---------- DOM ----------
const loadingEl   = document.getElementById("ordersLoading");
const emptyEl     = document.getElementById("emptyOrders");
const tabsEl      = document.getElementById("ordersTabs");
const listEl      = document.getElementById("ordersList");
const modalEl     = document.getElementById("orderModal");
const modalBody   = document.getElementById("modalBody");
const modalClose  = document.getElementById("modalClose");

// ============================================
// 1) Auth state check karo — phir orders load karo
// ============================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadOrders(user.uid);
  } else {
    loadingEl.textContent = t("login") + " required";
  }
});

// ============================================
// 2) Orders load karo Firestore se
// ============================================
async function loadOrders(userId) {
  showLoader();
  try {
    const q = query(
      collection(db, "orders"),
      where("userId", "==", userId)
    );

    const snap = await getDocs(q);

    allOrders = [];
    snap.forEach((d) => {
      allOrders.push({ id: d.id, ...d.data() });
    });

    // Sort by createdAt (newest first) - client side
    allOrders.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    console.log(`✅ ${allOrders.length} orders loaded`);

    if (allOrders.length === 0) {
      showEmpty();
    } else {
      tabsEl.classList.remove("hidden");
      renderOrders();
    }
  } catch (err) {
    console.error("❌ Orders load error:", err);
    loadingEl.textContent = t("error_loading");
  } finally {
    hideLoader();
  }
}

// ============================================
// 3) Empty state
// ============================================
function showEmpty() {
  loadingEl.classList.add("hidden");
  emptyEl.classList.remove("hidden");
  tabsEl.classList.add("hidden");
  listEl.innerHTML = "";
}

// ============================================
// 4) Render orders list
// ============================================
function renderOrders() {
  loadingEl.classList.add("hidden");
  emptyEl.classList.add("hidden");

  // Filter
  if (currentFilter === "all") {
    filteredOrders = allOrders;
  } else {
    filteredOrders = allOrders.filter((o) => o.status === currentFilter);
  }

  if (filteredOrders.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-box-open"></i></div>
        <h3>${t("no_orders_yet") || "No orders found"}</h3>
        <p>${t("no_orders_desc") || "Try a different filter."}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filteredOrders.map(orderCardHTML).join("");
  bindOrderActions();
}

// ============================================
// 5) Order card HTML
// ============================================
function orderCardHTML(order) {
  const orderNo   = order.orderNumber || order.id.slice(0, 8);
  const date      = formatDate(order.createdAt);
  const status    = (order.status || "pending").toLowerCase();
  const statusTxt = t(`status_${status}`) || status;
  const total     = Number(order.total || 0).toLocaleString();
  const items     = order.items || [];
  const itemCount = items.length;

  // Preview images (max 3 dikhao)
  const previewImgs = items.slice(0, 3).map((it) => `
    <img src="${it.image || 'https://via.placeholder.com/100?text=No+Image'}" alt="${it.title}" />
  `).join("");

  const moreCount = itemCount > 3
    ? `<span class="order-items-count">+${itemCount - 3} more</span>`
    : "";

  return `
    <div class="order-card" data-id="${order.id}">
      <div class="order-card-header">
        <div class="order-meta">
          <div><strong>${t("order_number")}:</strong> ${orderNo}</div>
          <div><strong>${t("order_date")}:</strong> ${date}</div>
        </div>
        <span class="status-badge ${status}">${statusTxt}</span>
      </div>

      <div class="order-card-body">
        <div class="order-items-preview">
          ${previewImgs}
          ${moreCount}
        </div>

        <div class="order-total">
          Rs ${total}
          <span>${itemCount} ${t("items") || "items"}</span>
        </div>

        <div class="order-actions">
          <button class="btn btn-outline btn-sm" data-action="view" data-id="${order.id}">
            <i class="fa-solid fa-eye"></i>
            ${t("view_details") || "View"}
          </button>
          <a href="tracking.html?id=${order.id}" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-location-dot"></i>
            ${t("tracking") || "Track"}
          </a>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// 6) Bind view details
// ============================================
function bindOrderActions() {
  listEl.querySelectorAll("button[data-action='view']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const order = allOrders.find((o) => o.id === id);
      if (order) openOrderModal(order);
    });
  });
}

// ============================================
// 7) Order details modal
// ============================================
function openOrderModal(order) {
  const orderNo   = order.orderNumber || order.id.slice(0, 8);
  const date      = formatDate(order.createdAt);
  const status    = (order.status || "pending").toLowerCase();
  const statusTxt = t(`status_${status}`) || status;
  const items     = order.items || [];

  const itemsHTML = items.map((it) => `
    <div class="modal-item">
      <img src="${it.image || 'https://via.placeholder.com/100?text=No+Image'}" alt="${it.title}" />
      <div class="modal-item-info">
        <p>${it.title}</p>
        <span>Rs ${Number(it.price).toLocaleString()} × ${it.qty}</span>
      </div>
      <div class="modal-item-price">
        Rs ${(it.price * it.qty).toLocaleString()}
      </div>
    </div>
  `).join("");

  modalBody.innerHTML = `
    <div class="modal-section">
      <h4>${t("order_info") || "Order Information"}</h4>
      <p><strong>${t("order_number")}:</strong> ${orderNo}</p>
      <p><strong>${t("order_date")}:</strong> ${date}</p>
      <p><strong>${t("order_status")}:</strong> 
        <span class="status-badge ${status}">${statusTxt}</span>
      </p>
      <p><strong>${t("payment_method")}:</strong> 
        ${order.paymentMethod === "cod" ? t("cash_on_delivery") : t("bank_transfer")}
      </p>
    </div>

    <div class="modal-section">
      <h4>${t("shipping_info") || "Shipping Information"}</h4>
      <p><strong>${t("name")}:</strong> ${order.fullName || "—"}</p>
      <p><strong>${t("phone")}:</strong> ${order.phone || "—"}</p>
      <p><strong>${t("address")}:</strong> ${order.address || "—"}</p>
      <p><strong>${t("city")}:</strong> ${order.city || "—"}</p>
    </div>

    <div class="modal-section">
      <h4>${t("items") || "Items"} (${items.length})</h4>
      <div class="modal-items">
        ${itemsHTML}
      </div>
    </div>

    <div class="modal-section">
      <h4>${t("order_summary")}</h4>
      <div class="modal-totals">
        <div class="summary-row">
          <span>${t("subtotal")}</span>
          <span>Rs ${Number(order.subtotal || 0).toLocaleString()}</span>
        </div>
        <div class="summary-row">
          <span>${t("shipping")}</span>
          <span>Rs ${Number(order.shipping || 0).toLocaleString()}</span>
        </div>
        ${order.discount > 0 ? `
          <div class="summary-row">
            <span>${t("discount")}</span>
            <span>- Rs ${Number(order.discount).toLocaleString()}</span>
          </div>
        ` : ""}
        <div class="summary-row">
          <span>${t("grand_total")}</span>
          <span>Rs ${Number(order.total || 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  `;

  modalEl.classList.remove("hidden");
}

modalClose?.addEventListener("click", () => {
  modalEl.classList.add("hidden");
});

modalEl?.addEventListener("click", (e) => {
  if (e.target === modalEl) modalEl.classList.add("hidden");
});

// ============================================
// 8) Filter tabs
// ============================================
tabsEl?.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tabsEl.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.status;
    renderOrders();
  });
});

// ============================================
// 9) Helpers
// ============================================
function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ============================================
// 10) Language change
// ============================================
window.addEventListener("languageChanged", () => {
  if (allOrders.length > 0) renderOrders();
});