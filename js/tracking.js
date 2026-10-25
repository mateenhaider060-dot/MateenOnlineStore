// ============================================
// tracking.js — ORDER TRACKING LOGIC
// ============================================

import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { t } from "./i18n.js";
import { showLoader, hideLoader, showToast } from "./global.js";

// ---------- Steps config ----------
const STEPS = [
  { key: "pending",   icon: "fa-clock",          labelKey: "status_pending" },
  { key: "confirmed", icon: "fa-circle-check",   labelKey: "status_confirmed" },
  { key: "shipped",   icon: "fa-truck-fast",     labelKey: "status_shipped" },
  { key: "delivered", icon: "fa-house-circle-check", labelKey: "status_delivered" },
];

const STATUS_ORDER = ["pending", "confirmed", "shipped", "delivered"];

// ---------- DOM ----------
const trackInput   = document.getElementById("trackInput");
const trackBtn     = document.getElementById("trackBtn");
const loadingEl    = document.getElementById("trackingLoading");
const notFoundEl   = document.getElementById("notFoundState");
const resultEl     = document.getElementById("trackingResult");
const recentWrap   = document.getElementById("recentOrdersWrap");
const recentChips  = document.getElementById("recentChips");

// ============================================
// 1) URL se order ID
// ============================================
const params   = new URLSearchParams(window.location.search);
const urlOrder = params.get("id") || params.get("order");

// ============================================
// 2) Auth state — phir recent orders load karo
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadRecentOrders(user.uid);
    if (urlOrder) {
      trackInput.value = urlOrder;
      trackOrder(urlOrder);
    }
  }
});

// ============================================
// 3) Recent Orders chips
// ============================================
async function loadRecentOrders(userId) {
  try {
    const q = query(collection(db, "orders"), where("userId", "==", userId));
    const snap = await getDocs(q);

    const orders = [];
    snap.forEach((d) => orders.push({ id: d.id, ...d.data() }));

    if (orders.length === 0) return;

    // Sort newest first
    orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    recentWrap.classList.remove("hidden");
    recentChips.innerHTML = orders.slice(0, 5).map((o) => `
      <button data-order="${o.orderNumber || o.id}">
        ${o.orderNumber || o.id.slice(0, 8)}
      </button>
    `).join("");

    recentChips.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        trackInput.value = btn.dataset.order;
        trackOrder(btn.dataset.order);
      });
    });
  } catch (err) {
    console.error("Recent orders error:", err);
  }
}

// ============================================
// 4) Track button / Enter
// ============================================
trackBtn?.addEventListener("click", () => {
  const val = trackInput.value.trim();
  if (!val) {
    showToast(t("enter_order_number") || "Please enter order number", "warning");
    return;
  }
  trackOrder(val);
});

trackInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") trackBtn.click();
});

// ============================================
// 5) Order track karo
// ============================================
async function trackOrder(orderNumber) {
  showLoader();
  hideAllStates();

  try {
    const user = auth.currentUser;
    if (!user) return;

    // Pehle orderNumber se search karo, phir id se
    let foundOrder = await findOrder(user.uid, orderNumber);

    if (!foundOrder) {
      notFoundEl.classList.remove("hidden");
      return;
    }

    renderTracking(foundOrder);
    resultEl.classList.remove("hidden");
  } catch (err) {
    console.error("❌ Track error:", err);
    showToast(t("error") || "Could not load order", "error");
  } finally {
    hideLoader();
  }
}

// ============================================
// 6) Firestore mein dhoondo (orderNumber ya id)
// ============================================
async function findOrder(userId, value) {
  // Try by orderNumber
  let q = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    where("orderNumber", "==", value)
  );
  let snap = await getDocs(q);
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  // Try by Firestore doc ID
  q = query(
    collection(db, "orders"),
    where("userId", "==", userId)
  );
  snap = await getDocs(q);
  let found = null;
  snap.forEach((d) => {
    if (d.id === value || d.id.startsWith(value)) {
      found = { id: d.id, ...d.data() };
    }
  });
  return found;
}

// ============================================
// 7) Render tracking
// ============================================
function renderTracking(order) {
  const status    = (order.status || "pending").toLowerCase();
  const statusTxt = t(`status_${status}`) || status;
  const orderNo   = order.orderNumber || order.id.slice(0, 8);
  const date      = formatDate(order.createdAt);

  // Header
  document.getElementById("trackOrderNo").textContent = orderNo;
  document.getElementById("trackOrderDate").textContent = date;

  const badge = document.getElementById("trackStatusBadge");
  badge.className = `status-badge ${status}`;
  badge.textContent = statusTxt;

  // Progress
  renderProgress(status, order);

  // Items
  const items = order.items || [];
  document.getElementById("trackItemsCount").textContent = `(${items.length})`;
  document.getElementById("trackItems").innerHTML = items.map((it) => `
    <div class="track-item">
      <img src="${it.image || 'https://via.placeholder.com/100?text=No+Image'}" alt="${it.title}" />
      <div class="track-item-info">
        <p>${it.title}</p>
        <span>Rs ${Number(it.price).toLocaleString()} × ${it.qty}</span>
      </div>
      <div class="track-item-price">
        Rs ${(it.price * it.qty).toLocaleString()}
      </div>
    </div>
  `).join("") || `<p class="text-muted">${t("no_items") || "No items"}</p>`;

  // Shipping info
  document.getElementById("trackName").textContent = order.fullName || "—";
  document.getElementById("trackPhone").textContent = order.phone || "—";
  document.getElementById("trackAddress").textContent = order.address || "—";
  document.getElementById("trackCity").textContent = order.city || "—";
  document.getElementById("trackPayment").textContent = order.paymentMethod === "cod"
    ? t("cash_on_delivery")
    : t("bank_transfer");

  // Totals
  document.getElementById("trackSubtotal").textContent = `Rs ${Number(order.subtotal || 0).toLocaleString()}`;
  document.getElementById("trackShipping").textContent =
    Number(order.shipping || 0) === 0 ? (t("free") || "Free") : `Rs ${Number(order.shipping).toLocaleString()}`;

  if (order.discount > 0) {
    document.getElementById("trackDiscountRow").style.display = "flex";
    document.getElementById("trackDiscount").textContent = `- Rs ${Number(order.discount).toLocaleString()}`;
  } else {
    document.getElementById("trackDiscountRow").style.display = "none";
  }

  document.getElementById("trackTotal").textContent = `Rs ${Number(order.total || 0).toLocaleString()}`;
}

// ============================================
// 8) Progress steps render
// ============================================
function renderProgress(currentStatus, order) {
  const wrap = document.getElementById("progressSteps");
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  wrap.innerHTML = STEPS.map((step, i) => {
    let cls = "";
    if (i < currentIdx) cls = "completed";
    else if (i === currentIdx) cls = "active";

    const stepTime = i <= currentIdx ? (order.createdAt ? formatDate(order.createdAt) : "") : "";

    return `
      <div class="progress-step ${cls}">
        <div class="step-icon">
          <i class="fa-solid ${step.icon}"></i>
        </div>
        <div class="step-info">
          <span class="step-label">${t(step.labelKey)}</span>
          <span class="step-time">${stepTime}</span>
        </div>
      </div>
    `;
  }).join("");

  // Active line width
  const totalSteps = STEPS.length - 1;
  const percent = totalSteps === 0 ? 0 : (currentIdx / totalSteps) * 76; // 76% kyunki line left 12% se start hoti hai
  const line = document.createElement("div");
  line.className = "progress-line-active";
  line.style.width = `${percent}%`;
  wrap.appendChild(line);
}

// ============================================
// 9) Helpers
// ============================================
function hideAllStates() {
  loadingEl.classList.add("hidden");
  notFoundEl.classList.add("hidden");
  resultEl.classList.add("hidden");
}

function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// 10) Language change — re-render if visible
// ============================================
window.addEventListener("languageChanged", () => {
  if (!resultEl.classList.contains("hidden") && trackInput.value) {
    trackOrder(trackInput.value);
  }
});