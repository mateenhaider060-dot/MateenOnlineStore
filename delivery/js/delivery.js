/* ═══════════════════════════════════════════
   MATEEN ONLINE STORE — DELIVERY PANEL LOGIC
   Login (role: delivery) + Assigned Orders
   + Status Updates + Confirm/Failed Modals
   ═══════════════════════════════════════════ */

import { auth, db } from "../../js/firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ─── STATE ─── */
const state = {
  user: null,
  profile: null,
  orders: [],
  filteredOrders: [],
  currentTab: "assigned",
  activeOrderId: null
};

/* ─── DOM REFS ─── */
const loginScreen   = document.getElementById("deliveryLoginScreen");
const dashboard     = document.getElementById("deliveryDashboard");
const loginForm     = document.getElementById("deliveryLoginForm");
const loginBtn      = document.getElementById("deliveryLoginBtn");
const loginError    = document.getElementById("deliveryLoginError");
const emailInput    = document.getElementById("deliveryEmail");
const passwordInput = document.getElementById("deliveryPassword");
const logoutBtn     = document.getElementById("deliveryLogoutBtn");
const refreshBtn    = document.getElementById("refreshBtn");
const ordersList    = document.getElementById("deliveryOrdersList");

/* ═══════════════════════════════════════════
   UI HELPERS
   ═══════════════════════════════════════════ */
function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}
function hideError() {
  loginError.textContent = "";
  loginError.classList.add("hidden");
}
function setLoading(isLoading) {
  const btnText   = loginBtn.querySelector(".btn-text");
  const btnLoader = loginBtn.querySelector(".btn-loader");
  loginBtn.disabled = isLoading;
  btnText.classList.toggle("hidden", isLoading);
  btnLoader.classList.toggle("hidden", !isLoading);
}
function showLogin() {
  loginScreen.classList.remove("hidden");
  dashboard.classList.add("hidden");
}
function showDashboard() {
  loginScreen.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

function mapAuthError(code) {
  const map = {
    "auth/invalid-email":          "Invalid email address.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Invalid email or password.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
    "auth/user-disabled":          "This account has been disabled.",
    "auth/network-request-failed": "Network error. Check your connection."
  };
  return map[code] || "Login failed. Please try again.";
}

/* ═══════════════════════════════════════════
   ROLE VERIFICATION
   ═══════════════════════════════════════════ */
async function verifyDeliveryRole(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return { allowed: false };

    const data = snap.data();
    const role = data.role;

    const allowed = role === "delivery" || role === "admin";
    return { allowed, role, data };
  } catch (err) {
    console.error("Role verification error:", err);
    return { allowed: false };
  }
}

/* ═══════════════════════════════════════════
   LOGIN HANDLER
   ═══════════════════════════════════════════ */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Please fill in all fields.");
    setLoading(false);
    return;
  }

  try {
    const cred  = await signInWithEmailAndPassword(auth, email, password);
    const check = await verifyDeliveryRole(cred.user.uid);

    if (!check.allowed) {
      await signOut(auth);
      showError("Access denied. Delivery staff account required.");
      setLoading(false);
      return;
    }

    console.log("✅ Delivery staff logged in:", cred.user.email, "| Role:", check.role);
  } catch (err) {
    console.error("Login error:", err);
    showError(mapAuthError(err.code));
    setLoading(false);
  }
});

/* ═══════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════ */
logoutBtn.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to logout?")) return;
  try {
    await signOut(auth);
    window.location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
});

/* ═══════════════════════════════════════════
   AUTH STATE
   ═══════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  const check = await verifyDeliveryRole(user.uid);

  if (!check.allowed) {
    await signOut(auth);
    showLogin();
    showError("Access denied. Delivery staff only.");
    return;
  }

  state.user    = user;
  state.profile = check.data;

  const nameEl  = document.getElementById("deliveryName");
  const emailEl = document.getElementById("deliveryEmailDisplay");
  const avatar  = document.getElementById("deliveryAvatar");

  if (nameEl)  nameEl.textContent  = check.data?.name || user.displayName || "Rider";
  if (emailEl) emailEl.textContent = user.email || "";
  if (avatar && (check.data?.photoURL || user.photoURL)) {
    avatar.src = check.data?.photoURL || user.photoURL;
  }

  showDashboard();
  loadOrders();
  initEventListeners();
});

/* ═══════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════ */
let listenersInitialized = false;

function initEventListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.currentTab = btn.dataset.tab;
      renderOrders();
    });
  });

  refreshBtn?.addEventListener("click", () => {
    refreshBtn.style.transform = "rotate(360deg)";
    refreshBtn.style.transition = "transform 0.5s ease";
    setTimeout(() => {
      refreshBtn.style.transform = "rotate(0deg)";
      refreshBtn.style.transition = "none";
    }, 500);
    loadOrders();
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.close)?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".delivery-modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.getElementById("confirmDeliveryBtn")?.addEventListener("click", submitDeliveryConfirm);
  document.getElementById("confirmFailedBtn")?.addEventListener("click", submitDeliveryFailed);

  initLanguageToggle();
}

/* ═══════════════════════════════════════════
   LOAD ORDERS
   ═══════════════════════════════════════════ */
async function loadOrders() {
  if (!state.user) return;

  ordersList.innerHTML = `<div class="loading-state"><p>Loading orders...</p></div>`;

  try {
    let snap;
    try {
      const q1 = query(
        collection(db, "orders"),
        where("deliveryAgentId", "==", state.user.uid)
      );
      snap = await getDocs(q1);
    } catch {
      const q2 = query(
        collection(db, "orders"),
        where("assignedTo", "==", state.user.uid)
      );
      snap = await getDocs(q2);
    }

    state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    state.orders.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    updateStats();
    renderOrders();
  } catch (err) {
    console.error("Load orders error:", err);
    ordersList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <h3>Error loading orders</h3>
        <p>Please check your connection and try again.</p>
      </div>
    `;
  }
}

/* ═══════════════════════════════════════════
   STATS UPDATE
   ═══════════════════════════════════════════ */
function updateStats() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayTs = Math.floor(now.getTime() / 1000);

  const assigned   = state.orders.filter((o) => o.status === "confirmed" || o.status === "assigned").length;
  const outForDel  = state.orders.filter((o) => o.status === "shipped" || o.status === "out_for_delivery").length;
  const delivered  = state.orders.filter((o) =>
    o.status === "delivered" && (o.deliveredAt?.seconds || 0) >= todayTs
  ).length;
  const failed     = state.orders.filter((o) => o.status === "failed").length;

  setText("statAssigned",  assigned);
  setText("statOut",       outForDel);
  setText("statDelivered", delivered);
  setText("statFailed",    failed);

  setText("countAssigned",  assigned);
  setText("countOut",       outForDel);
  setText("countDelivered", state.orders.filter((o) => o.status === "delivered").length);
  setText("countFailed",    failed);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ═══════════════════════════════════════════
   RENDER ORDERS (by tab)
   ═══════════════════════════════════════════ */
function renderOrders() {
  let list = [];

  switch (state.currentTab) {
    case "assigned":
      list = state.orders.filter((o) =>
        o.status === "confirmed" || o.status === "assigned" || o.status === "pending"
      );
      break;
    case "out":
      list = state.orders.filter((o) =>
        o.status === "shipped" || o.status === "out_for_delivery"
      );
      break;
    case "delivered":
      list = state.orders.filter((o) => o.status === "delivered");
      break;
    case "failed":
      list = state.orders.filter((o) => o.status === "failed");
      break;
  }

  state.filteredOrders = list;

  if (!list.length) {
    ordersList.innerHTML = renderEmptyState(state.currentTab);
    return;
  }

  ordersList.innerHTML = "";
  list.forEach((o) => {
    ordersList.appendChild(createOrderCard(o));
  });
}

function renderEmptyState(tab) {
  const messages = {
    assigned:  { icon: "📭", title: "No assigned orders",   desc: "New deliveries will appear here." },
    out:       { icon: "🚴", title: "No orders in transit", desc: "Start a delivery to see it here." },
    delivered: { icon: "✅", title: "No delivered orders",  desc: "Completed deliveries will show here." },
    failed:    { icon: "❌", title: "No failed deliveries", desc: "Good job! No failures yet." }
  };
  const m = messages[tab] || messages.assigned;
  return `
    <div class="empty-state">
      <span class="empty-icon">${m.icon}</span>
      <h3>${m.title}</h3>
      <p>${m.desc}</p>
    </div>
  `;
}

/* ═══════════════════════════════════════════
   CREATE ORDER CARD
   ═══════════════════════════════════════════ */
function createOrderCard(order) {
  const card = document.createElement("div");
  card.className = `delivery-card status-${order.status || "assigned"}`;

  const statusMap = {
    pending:          { class: "badge-assigned",  label: "Pending" },
    confirmed:        { class: "badge-assigned",  label: "Assigned" },
    assigned:         { class: "badge-assigned",  label: "Assigned" },
    shipped:          { class: "badge-out",       label: "Out for Delivery" },
    out_for_delivery: { class: "badge-out",       label: "Out for Delivery" },
    delivered:        { class: "badge-delivered", label: "Delivered" },
    failed:           { class: "badge-failed",    label: "Failed" }
  };
  const badge = statusMap[order.status] || statusMap.assigned;

  const orderNum  = order.orderNumber || order.id.slice(0, 8).toUpperCase();
  const name      = order.customerName || order.userName || order.fullName || "Customer";
  const phone     = order.phone || "";
  const address   = order.address || "";
  const city      = order.city || "";
  const total     = Number(order.total || 0).toLocaleString("en-PK");
  const payMethod = order.paymentMethod || "COD";

  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-order-num">#${orderNum}</h3>
      <span class="card-badge ${badge.class}">${badge.label}</span>
    </div>

    <div class="card-customer">
      <p class="name">👤 ${name}</p>
      ${phone ? `<div class="info-row">📞 <strong>${phone}</strong></div>` : ""}
    </div>

    ${address ? `
      <div class="card-address">
        <strong>Delivery Address</strong>
        ${address}${city ? `, ${city}` : ""}
      </div>
    ` : ""}

    <div class="card-total">
      <span>Total (${payMethod})</span>
      <strong>PKR ${total}</strong>
    </div>

    <div class="card-actions">
      <button class="btn-view" data-view="${order.id}">👁️ View</button>
      ${phone ? `<a href="tel:${phone}" class="btn-call">📞 Call</a>` : ""}
      ${renderActionButtons(order)}
    </div>
  `;

  card.querySelector("[data-view]")?.addEventListener("click", () => openOrderDetails(order.id));

  const startBtn = card.querySelector("[data-start]");
  if (startBtn) {
    startBtn.addEventListener("click", () => markOutForDelivery(order.id));
  }

  const deliverBtn = card.querySelector("[data-deliver]");
  if (deliverBtn) {
    deliverBtn.addEventListener("click", () => openConfirmDelivery(order.id));
  }

  const failBtn = card.querySelector("[data-fail]");
  if (failBtn) {
    failBtn.addEventListener("click", () => openFailedDelivery(order.id));
  }

  return card;
}

function renderActionButtons(order) {
  const s = order.status;

  if (s === "confirmed" || s === "assigned" || s === "pending") {
    return `<button class="btn-start" data-start>🚴 Start Delivery</button>`;
  }
  if (s === "shipped" || s === "out_for_delivery") {
    return `
      <button class="btn-deliver" data-deliver>✅ Mark Delivered</button>
      <button class="btn-failed" data-fail>❌ Failed</button>
    `;
  }
  return "";
}

/* ═══════════════════════════════════════════
   ORDER DETAILS MODAL
   ═══════════════════════════════════════════ */
async function openOrderDetails(orderId) {
  state.activeOrderId = orderId;
  const container = document.getElementById("deliveryOrderContent");
  container.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:20px">Loading...</p>`;

  document.getElementById("deliveryOrderModal").classList.remove("hidden");

  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) {
      container.innerHTML = `<p style="text-align:center;color:#94a3b8">Order not found.</p>`;
      return;
    }

    const o = snap.data();
    const date = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toLocaleString()
      : "—";

    const itemsHtml = (o.items || []).map((it) => `
      <div class="item-row">
        <span class="item-name">${it.title || it.name || "Item"}</span>
        <span class="item-qty">× ${it.quantity || it.qty || 1}</span>
      </div>
    `).join("") || `<p style="color:#94a3b8;font-size:0.85rem">No items listed</p>`;

    container.innerHTML = `
      <h4>Order Info</h4>
      <div class="detail-row"><span>Order #</span><span>${o.orderNumber || orderId.slice(0, 8)}</span></div>
      <div class="detail-row"><span>Date</span><span>${date}</span></div>
      <div class="detail-row"><span>Status</span><span>${o.status || "—"}</span></div>

      <h4>Customer</h4>
      <div class="detail-row"><span>Name</span><span>${o.customerName || o.userName || o.fullName || "—"}</span></div>
      <div class="detail-row"><span>Phone</span><span>${o.phone || "—"}</span></div>
      <div class="detail-row"><span>Email</span><span>${o.email || o.userEmail || "—"}</span></div>

      <h4>Delivery Address</h4>
      <div class="detail-row"><span>Address</span><span>${o.address || "—"}</span></div>
      <div class="detail-row"><span>City</span><span>${o.city || "—"}</span></div>
      <div class="detail-row"><span>Postal</span><span>${o.postalCode || "—"}</span></div>

      <h4>Items</h4>
      ${itemsHtml}

      <h4>Payment</h4>
      <div class="detail-row"><span>Method</span><span>${o.paymentMethod || "COD"}</span></div>
      <div class="detail-row"><span>Subtotal</span><span>PKR ${Number(o.subtotal || 0).toLocaleString()}</span></div>
      <div class="detail-row"><span>Shipping</span><span>PKR ${Number(o.shipping || 0).toLocaleString()}</span></div>
      <div class="detail-row">
        <span><strong>Total to Collect</strong></span>
        <span><strong>PKR ${Number(o.total || 0).toLocaleString()}</strong></span>
      </div>

      ${o.orderNotes || o.notes ? `
        <h4>Customer Notes</h4>
        <div class="detail-row"><span></span><span>${o.orderNotes || o.notes}</span></div>
      ` : ""}
    `;
  } catch (err) {
    console.error("Order details error:", err);
    container.innerHTML = `<p style="text-align:center;color:#94a3b8">Error loading order.</p>`;
  }
}

/* ═══════════════════════════════════════════
   MARK OUT FOR DELIVERY
   ═══════════════════════════════════════════ */
async function markOutForDelivery(orderId) {
  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: "out_for_delivery",
      outForDeliveryAt: serverTimestamp(),
      deliveryAgentId: state.user.uid,
      updatedAt: serverTimestamp()
    });
    toast("Order marked as Out for Delivery 🚴", "success");
    loadOrders();
    setTimeout(() => {
      state.currentTab = "out";
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === "out");
      });
      renderOrders();
    }, 800);
  } catch (err) {
    console.error("Update status error:", err);
    toast("Failed to update status", "error");
  }
}

/* ═══════════════════════════════════════════
   CONFIRM DELIVERY
   ═══════════════════════════════════════════ */
function openConfirmDelivery(orderId) {
  state.activeOrderId = orderId;
  document.getElementById("deliveryNote").value = "";
  document.getElementById("receivedBy").value = "";
  document.getElementById("confirmDeliveryModal").classList.remove("hidden");
}

async function submitDeliveryConfirm() {
  const orderId = state.activeOrderId;
  if (!orderId) return;

  const note       = document.getElementById("deliveryNote").value.trim();
  const receivedBy = document.getElementById("receivedBy").value.trim();

  const btn = document.getElementById("confirmDeliveryBtn");
  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: "delivered",
      deliveredAt: serverTimestamp(),
      deliveryNote: note || null,
      receivedBy: receivedBy || null,
      deliveredBy: state.user.uid,
      updatedAt: serverTimestamp()
    });

    document.getElementById("confirmDeliveryModal").classList.add("hidden");
    toast("Order delivered successfully ✅", "success");
    loadOrders();

    setTimeout(() => {
      state.currentTab = "delivered";
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === "delivered");
      });
      renderOrders();
    }, 800);
  } catch (err) {
    console.error("Confirm delivery error:", err);
    toast("Failed to confirm delivery", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Delivered";
  }
}

/* ═══════════════════════════════════════════
   FAILED DELIVERY
   ═══════════════════════════════════════════ */
function openFailedDelivery(orderId) {
  state.activeOrderId = orderId;
  document.getElementById("failedReason").value = "";
  document.getElementById("failedNote").value = "";
  document.getElementById("failedDeliveryModal").classList.remove("hidden");
}

async function submitDeliveryFailed() {
  const orderId = state.activeOrderId;
  if (!orderId) return;

  const reason = document.getElementById("failedReason").value;
  const note   = document.getElementById("failedNote").value.trim();

  if (!reason) {
    toast("Please select a reason", "warning");
    return;
  }

  const btn = document.getElementById("confirmFailedBtn");
  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: "failed",
      failedReason: reason,
      failedNote: note || null,
      failedAt: serverTimestamp(),
      failedBy: state.user.uid,
      updatedAt: serverTimestamp()
    });

    document.getElementById("failedDeliveryModal").classList.add("hidden");
    toast("Marked as failed ❌", "success");
    loadOrders();

    setTimeout(() => {
      state.currentTab = "failed";
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === "failed");
      });
      renderOrders();
    }, 800);
  } catch (err) {
    console.error("Failed delivery error:", err);
    toast("Failed to update", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Mark as Failed";
  }
}

/* ═══════════════════════════════════════════
   LANGUAGE TOGGLE
   ═══════════════════════════════════════════ */
function initLanguageToggle() {
  const btn   = document.getElementById("deliveryLangToggle");
  const label = document.getElementById("deliveryLangLabel");

  btn?.addEventListener("click", () => {
    const current = localStorage.getItem("mateen_lang") || "en";
    const next    = current === "en" ? "ur" : "en";
    localStorage.setItem("mateen_lang", next);

    if (window.i18n?.setLanguage) {
      window.i18n.setLanguage(next);
    } else {
      window.location.reload();
    }

    if (label) label.textContent = next.toUpperCase();
  });

  if (label) {
    const current = localStorage.getItem("mateen_lang") || "en";
    label.textContent = current.toUpperCase();
  }
}

/* ═══════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════ */
function toast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ""}</span><span>${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(40px)";
    el.style.transition = "all 0.3s ease";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}