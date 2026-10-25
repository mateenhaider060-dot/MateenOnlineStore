/* ═══════════════════════════════════════════
   MATEEN ONLINE STORE — MANAGER DASHBOARD LOGIC
   CRUD: Products, Categories, Orders, Coupons,
         Reviews + Customers (read-only)
   ═══════════════════════════════════════════ */

import { db } from "../../js/firebase-config.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ─── STATE ─── */
const state = {
  products:   [],
  categories: [],
  orders:     [],
  customers:  [],
  coupons:    [],
  reviews:    [],
  currentRole: null,
  currentSection: "dashboard"
};

/* ─── INIT ─── */
window.addEventListener("managerReady", (e) => {
  state.currentRole = e.detail.role;

  initNavigation();
  initSidebarToggle();
  initModals();
  initForms();
  initLanguageToggle();
  initOrderFilter();
  initCustomerSearch();

  loadDashboardStats();
  loadRecentOrders();
  loadPendingTasks();
  loadCategories();
  loadProducts();
});

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */
function initNavigation() {
  const navItems  = document.querySelectorAll(".nav-item");
  const pageTitle = document.getElementById("managerPageTitle");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (!section) return;

      navItems.forEach((n) => n.classList.remove("active"));
      item.classList.add("active");

      document.querySelectorAll(".manager-section").forEach((s) => {
        s.classList.remove("active");
      });
      document.getElementById(`section-${section}`)?.classList.add("active");

      if (pageTitle) {
        pageTitle.textContent = item.querySelector(".nav-label")?.textContent || section;
      }

      state.currentSection = section;
      loadSection(section);

      document.getElementById("managerSidebar")?.classList.remove("open");
    });
  });
}

function loadSection(section) {
  switch (section) {
    case "dashboard":  loadDashboardStats(); loadRecentOrders(); loadPendingTasks(); break;
    case "products":   loadProducts();    break;
    case "categories": loadCategories();  break;
    case "orders":     loadOrders();      break;
    case "customers":  loadCustomers();   break;
    case "coupons":    loadCoupons();     break;
    case "reviews":    loadReviews();     break;
  }
}

/* ═══════════════════════════════════════════
   SIDEBAR TOGGLE
   ═══════════════════════════════════════════ */
function initSidebarToggle() {
  const toggle  = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("managerSidebar");
  toggle?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

/* ═══════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════ */
function initModals() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.close)?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".manager-modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.getElementById("addProductBtn")?.addEventListener("click", () => openProductModal());
  document.getElementById("addCategoryBtn")?.addEventListener("click", () => openCategoryModal());
  document.getElementById("addCouponBtn")?.addEventListener("click", () => openCouponModal());
}

function openModal(id)  { document.getElementById(id)?.classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id)?.classList.add("hidden"); }

/* ═══════════════════════════════════════════
   DASHBOARD STATS
   ═══════════════════════════════════════════ */
async function loadDashboardStats() {
  try {
    const [productsSnap, ordersSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "orders"))
    ]);

    document.getElementById("statProducts").textContent = productsSnap.size;
    document.getElementById("statOrders").textContent   = ordersSnap.size;

    let pending = 0;
    let todayRevenue = 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = Math.floor(todayStart.getTime() / 1000);

    ordersSnap.forEach((d) => {
      const o = d.data();
      if (o.status === "pending") pending++;
      if (o.status !== "cancelled" && o.createdAt?.seconds >= todayTs) {
        todayRevenue += Number(o.total || 0);
      }
    });

    document.getElementById("statPending").textContent = pending;
    document.getElementById("statRevenue").textContent =
      todayRevenue.toLocaleString("en-PK");
  } catch (err) {
    console.error("Stats error:", err);
  }
}

/* ─── RECENT ORDERS ─── */
async function loadRecentOrders() {
  const container = document.getElementById("recentOrdersList");
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `<p class="empty-msg">No orders yet.</p>`;
      return;
    }

    container.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div>
          <strong>${d.orderNumber || docSnap.id.slice(0, 8)}</strong><br>
          <small>${d.customerName || d.userName || "—"}</small>
        </div>
        <div style="text-align:right">
          <strong>PKR ${Number(d.total || 0).toLocaleString()}</strong><br>
          <small class="badge badge-${d.status || "pending"}">${d.status || "pending"}</small>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Recent orders error:", err);
    container.innerHTML = `<p class="empty-msg">Error loading.</p>`;
  }
}

/* ─── PENDING TASKS ─── */
async function loadPendingTasks() {
  const container = document.getElementById("pendingTasksList");
  try {
    const tasks = [];

    const pendingQ = query(collection(db, "orders"), where("status", "==", "pending"));
    const pendingSnap = await getDocs(pendingQ);
    if (pendingSnap.size > 0) {
      tasks.push({
        icon: "🧾",
        text: `${pendingSnap.size} pending order${pendingSnap.size > 1 ? "s" : ""} to confirm`
      });
    }

    const lowQ = query(collection(db, "products"), where("stock", "<=", 5));
    const lowSnap = await getDocs(lowQ);
    if (lowSnap.size > 0) {
      tasks.push({
        icon: "📦",
        text: `${lowSnap.size} product${lowSnap.size > 1 ? "s" : ""} low on stock`
      });
    }

    const reviewsQ = query(collection(db, "reviews"), where("approved", "==", false));
    try {
      const reviewsSnap = await getDocs(reviewsQ);
      if (reviewsSnap.size > 0) {
        tasks.push({
          icon: "⭐",
          text: `${reviewsSnap.size} review${reviewsSnap.size > 1 ? "s" : ""} to approve`
        });
      }
    } catch { /* index may not exist */ }

    if (!tasks.length) {
      container.innerHTML = `<p class="empty-msg">All caught up! ✅</p>`;
      return;
    }

    container.innerHTML = "";
    tasks.forEach((t) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `<span>${t.icon}</span><span>${t.text}</span>`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Pending tasks error:", err);
    container.innerHTML = `<p class="empty-msg">Error loading tasks.</p>`;
  }
}

/* ═══════════════════════════════════════════
   PRODUCTS — CRUD
   ═══════════════════════════════════════════ */
async function loadProducts() {
  const tbody = document.getElementById("productsTableBody");
  try {
    const snap = await getDocs(collection(db, "products"));
    state.products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!state.products.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">No products yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    state.products.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img class="thumb" src="${p.image || "../../assets/placeholder.png"}" alt=""></td>
        <td>${p.name || "—"}</td>
        <td>${p.category || "—"}</td>
        <td>PKR ${Number(p.price || 0).toLocaleString()}</td>
        <td>${p.stock ?? 0}</td>
        <td>
          <span class="badge badge-${p.stock > 0 ? "active" : "inactive"}">
            ${p.stock > 0 ? "In Stock" : "Out"}
          </span>
        </td>
        <td>
          <button class="btn-edit" data-edit="${p.id}">Edit</button>
          <button class="btn-danger" data-del="${p.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openProductModal(b.dataset.edit))
    );
    tbody.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => deleteProduct(b.dataset.del))
    );
  } catch (err) {
    console.error("Load products error:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="empty-msg">Error loading.</td></tr>`;
  }
}

function openProductModal(id = null) {
  const titleEl = document.getElementById("productModalTitle");
  const form    = document.getElementById("productForm");
  form.reset();
  document.getElementById("productId").value = "";

  const catSelect = document.getElementById("productCategory");
  catSelect.innerHTML = `<option value="">Select category</option>`;
  state.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  if (id) {
    const p = state.products.find((x) => x.id === id);
    if (p) {
      titleEl.textContent = "Edit Product";
      document.getElementById("productId").value          = p.id;
      document.getElementById("productName").value        = p.name || "";
      document.getElementById("productCategory").value    = p.category || "";
      document.getElementById("productPrice").value       = p.price || 0;
      document.getElementById("productStock").value       = p.stock || 0;
      document.getElementById("productDescription").value = p.description || "";
      document.getElementById("productImage").value       = p.image || "";
    }
  } else {
    titleEl.textContent = "Add Product";
  }
  openModal("productModal");
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById("productId").value;

  const payload = {
    name:        document.getElementById("productName").value.trim(),
    category:    document.getElementById("productCategory").value,
    price:       Number(document.getElementById("productPrice").value),
    stock:       Number(document.getElementById("productStock").value),
    description: document.getElementById("productDescription").value.trim(),
    image:       document.getElementById("productImage").value.trim(),
    updatedAt:   serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "products", id), payload);
      toast("Product updated ✅", "success");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), payload);
      toast("Product added ✅", "success");
    }
    closeModal("productModal");
    loadProducts();
    loadDashboardStats();
  } catch (err) {
    console.error("Save product error:", err);
    toast("Failed to save product", "error");
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    toast("Product deleted", "success");
    loadProducts();
    loadDashboardStats();
  } catch (err) {
    console.error("Delete error:", err);
    toast("Failed to delete", "error");
  }
}

/* ═══════════════════════════════════════════
   CATEGORIES — CRUD
   ═══════════════════════════════════════════ */
async function loadCategories() {
  const tbody = document.getElementById("categoriesTableBody");
  try {
    const snap = await getDocs(collection(db, "categories"));
    state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!state.categories.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">No categories yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    state.categories.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><img class="thumb" src="${c.image || "../../assets/placeholder.png"}" alt=""></td>
        <td>${c.name || "—"}</td>
        <td>${c.slug || "—"}</td>
        <td>
          <button class="btn-edit" data-edit="${c.id}">Edit</button>
          <button class="btn-danger" data-del="${c.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openCategoryModal(b.dataset.edit))
    );
    tbody.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => deleteCategory(b.dataset.del))
    );
  } catch (err) {
    console.error("Load categories error:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">Error loading.</td></tr>`;
  }
}

function openCategoryModal(id = null) {
  const form = document.getElementById("categoryForm");
  form.reset();
  document.getElementById("categoryId").value = "";

  if (id) {
    const c = state.categories.find((x) => x.id === id);
    if (c) {
      document.getElementById("categoryId").value    = c.id;
      document.getElementById("categoryName").value  = c.name || "";
      document.getElementById("categoryImage").value = c.image || "";
    }
  }
  openModal("categoryModal");
}

async function saveCategory(e) {
  e.preventDefault();
  const id   = document.getElementById("categoryId").value;
  const name = document.getElementById("categoryName").value.trim();

  const payload = {
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    image: document.getElementById("categoryImage").value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "categories", id), payload);
      toast("Category updated ✅", "success");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "categories"), payload);
      toast("Category added ✅", "success");
    }
    closeModal("categoryModal");
    loadCategories();
  } catch (err) {
    console.error("Save category error:", err);
    toast("Failed to save category", "error");
  }
}

async function deleteCategory(id) {
  if (!confirm("Delete this category?")) return;
  try {
    await deleteDoc(doc(db, "categories", id));
    toast("Category deleted", "success");
    loadCategories();
  } catch (err) {
    console.error("Delete error:", err);
    toast("Failed", "error");
  }
}

/* ═══════════════════════════════════════════
   ORDERS
   ═══════════════════════════════════════════ */
function initOrderFilter() {
  document.getElementById("orderStatusFilter")?.addEventListener("change", loadOrders);
}

async function loadOrders() {
  const tbody  = document.getElementById("ordersTableBody");
  const filter = document.getElementById("orderStatusFilter")?.value || "all";

  try {
    let q = collection(db, "orders");
    if (filter !== "all") {
      q = query(q, where("status", "==", filter));
    }
    const snap = await getDocs(q);
    state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    state.orders.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    if (!state.orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    state.orders.forEach((o) => {
      const tr = document.createElement("tr");
      const date = o.createdAt?.seconds
        ? new Date(o.createdAt.seconds * 1000).toLocaleDateString()
        : "—";
      tr.innerHTML = `
        <td><strong>${o.orderNumber || o.id.slice(0, 8)}</strong></td>
        <td>${o.customerName || o.userName || "—"}</td>
        <td>PKR ${Number(o.total || 0).toLocaleString()}</td>
        <td>${date}</td>
        <td><span class="badge badge-${o.status || "pending"}">${o.status || "pending"}</span></td>
        <td>
          <button class="btn-edit" data-view="${o.id}">View</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-view]").forEach((b) =>
      b.addEventListener("click", () => openOrderDetails(b.dataset.view))
    );
  } catch (err) {
    console.error("Load orders error:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Error loading orders.</td></tr>`;
  }
}

async function openOrderDetails(id) {
  const container = document.getElementById("orderDetailsContent");
  container.innerHTML = `<p class="empty-msg">Loading...</p>`;
  openModal("orderModal");

  try {
    const snap = await getDoc(doc(db, "orders", id));
    if (!snap.exists()) {
      container.innerHTML = `<p class="empty-msg">Order not found.</p>`;
      return;
    }
    const o = snap.data();
    const date = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toLocaleString()
      : "—";

    const itemsHtml = (o.items || []).map((it) => `
      <div class="detail-row">
        <span>${it.title || it.name || "Item"} × ${it.quantity || it.qty || 1}</span>
        <span>PKR ${Number((it.price || 0) * (it.quantity || it.qty || 1)).toLocaleString()}</span>
      </div>
    `).join("") || `<p class="empty-msg">No items</p>`;

    container.innerHTML = `
      <h4>Order Info</h4>
      <div class="detail-row"><span>Order #</span><span>${o.orderNumber || id}</span></div>
      <div class="detail-row"><span>Date</span><span>${date}</span></div>
      <div class="detail-row"><span>Status</span><span class="badge badge-${o.status}">${o.status}</span></div>

      <h4>Customer</h4>
      <div class="detail-row"><span>Name</span><span>${o.customerName || o.fullName || "—"}</span></div>
      <div class="detail-row"><span>Email</span><span>${o.email || o.userEmail || "—"}</span></div>
      <div class="detail-row"><span>Phone</span><span>${o.phone || "—"}</span></div>
      <div class="detail-row"><span>Address</span><span>${o.address || "—"}</span></div>
      <div class="detail-row"><span>City</span><span>${o.city || "—"}</span></div>

      <h4>Items</h4>
      ${itemsHtml}

      <h4>Payment</h4>
      <div class="detail-row"><span>Method</span><span>${o.paymentMethod || "—"}</span></div>
      <div class="detail-row"><span>Subtotal</span><span>PKR ${Number(o.subtotal || 0).toLocaleString()}</span></div>
      <div class="detail-row"><span>Shipping</span><span>PKR ${Number(o.shipping || 0).toLocaleString()}</span></div>
      <div class="detail-row"><span><strong>Total</strong></span><span><strong>PKR ${Number(o.total || 0).toLocaleString()}</strong></span></div>

      <h4>Update Status</h4>
      <select class="order-status-select" id="orderStatusSelect">
        <option value="pending"   ${o.status === "pending"   ? "selected" : ""}>Pending</option>
        <option value="confirmed" ${o.status === "confirmed" ? "selected" : ""}>Confirmed</option>
        <option value="shipped"   ${o.status === "shipped"   ? "selected" : ""}>Shipped</option>
        <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>Delivered</option>
        <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelled</option>
      </select>
      <button class="btn-primary" id="updateOrderBtn" style="margin-top:12px">Update Status</button>
    `;

    document.getElementById("updateOrderBtn")?.addEventListener("click", async () => {
      const newStatus = document.getElementById("orderStatusSelect").value;
      try {
        await updateDoc(doc(db, "orders", id), {
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy: "manager"
        });
        toast("Order status updated ✅", "success");
        closeModal("orderModal");
        loadOrders();
        loadDashboardStats();
        loadPendingTasks();
      } catch (err) {
        console.error("Update order error:", err);
        toast("Failed to update", "error");
      }
    });
  } catch (err) {
    console.error("Order details error:", err);
    container.innerHTML = `<p class="empty-msg">Error loading order.</p>`;
  }
}

/* ═══════════════════════════════════════════
   CUSTOMERS (read-only view)
   ═══════════════════════════════════════════ */
function initCustomerSearch() {
  document.getElementById("customerSearch")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    renderCustomers(term);
  });
}

async function loadCustomers() {
  const tbody = document.getElementById("customersTableBody");
  try {
    const snap = await getDocs(collection(db, "users"));
    state.customers = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u.role !== "admin" && u.role !== "manager");

    const ordersSnap = await getDocs(collection(db, "orders"));
    const orderCounts = {};
    ordersSnap.forEach((d) => {
      const uid = d.data().userId;
      if (uid) orderCounts[uid] = (orderCounts[uid] || 0) + 1;
    });
    state.customers.forEach((c) => {
      c.orderCount = orderCounts[c.id] || 0;
    });

    renderCustomers("");
  } catch (err) {
    console.error("Load customers error:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">Error loading customers.</td></tr>`;
  }
}

function renderCustomers(searchTerm = "") {
  const tbody = document.getElementById("customersTableBody");
  let list = state.customers;

  if (searchTerm) {
    list = list.filter((u) =>
      (u.name || "").toLowerCase().includes(searchTerm) ||
      (u.email || "").toLowerCase().includes(searchTerm)
    );
  }

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">No customers found.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  list.forEach((u) => {
    const tr = document.createElement("tr");
    const joined = u.createdAt?.seconds
      ? new Date(u.createdAt.seconds * 1000).toLocaleDateString()
      : "—";
    tr.innerHTML = `
      <td>${u.name || "—"}</td>
      <td>${u.email || "—"}</td>
      <td>${u.phone || "—"}</td>
      <td><strong>${u.orderCount}</strong></td>
      <td>${joined}</td>
      <td>
        <button class="btn-edit" data-view-customer="${u.id}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-view-customer]").forEach((b) =>
    b.addEventListener("click", () => openCustomerDetails(b.dataset.viewCustomer))
  );
}

function openCustomerDetails(id) {
  const container = document.getElementById("customerDetailsContent");
  const c = state.customers.find((x) => x.id === id);
  if (!c) return;

  const joined = c.createdAt?.seconds
    ? new Date(c.createdAt.seconds * 1000).toLocaleString()
    : "—";

  container.innerHTML = `
    <h4>Customer Info</h4>
    <div class="detail-row"><span>Name</span><span>${c.name || "—"}</span></div>
    <div class="detail-row"><span>Email</span><span>${c.email || "—"}</span></div>
    <div class="detail-row"><span>Phone</span><span>${c.phone || "—"}</span></div>
    <div class="detail-row"><span>Address</span><span>${c.address || "—"}</span></div>
    <div class="detail-row"><span>City</span><span>${c.city || "—"}</span></div>

    <h4>Account</h4>
    <div class="detail-row"><span>Joined</span><span>${joined}</span></div>
    <div class="detail-row"><span>Total Orders</span><span><strong>${c.orderCount || 0}</strong></span></div>
  `;
  openModal("customerModal");
}

/* ═══════════════════════════════════════════
   COUPONS — CRUD
   ═══════════════════════════════════════════ */
async function loadCoupons() {
  const tbody = document.getElementById("couponsTableBody");
  try {
    const snap = await getDocs(collection(db, "coupons"));
    state.coupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!state.coupons.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No coupons yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    state.coupons.forEach((c) => {
      const expired = c.expiry && new Date(c.expiry) < new Date();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.code}</strong></td>
        <td>${c.discount}%</td>
        <td>${c.expiry || "—"}</td>
        <td>
          <span class="badge badge-${expired ? "cancelled" : "active"}">
            ${expired ? "Expired" : "Active"}
          </span>
        </td>
        <td>
          <button class="btn-edit" data-edit="${c.id}">Edit</button>
          <button class="btn-danger" data-del="${c.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openCouponModal(b.dataset.edit))
    );
    tbody.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => deleteCoupon(b.dataset.del))
    );
  } catch (err) {
    console.error("Load coupons error:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Error loading.</td></tr>`;
  }
}

function openCouponModal(id = null) {
  const form = document.getElementById("couponForm");
  form.reset();
  document.getElementById("couponId").value = "";

  if (id) {
    const c = state.coupons.find((x) => x.id === id);
    if (c) {
      document.getElementById("couponId").value       = c.id;
      document.getElementById("couponCode").value     = c.code || "";
      document.getElementById("couponDiscount").value = c.discount || 0;
      document.getElementById("couponExpiry").value   = c.expiry || "";
    }
  }
  openModal("couponModal");
}

async function saveCoupon(e) {
  e.preventDefault();
  const id = document.getElementById("couponId").value;
  const payload = {
    code:     document.getElementById("couponCode").value.trim().toUpperCase(),
    discount: Number(document.getElementById("couponDiscount").value),
    expiry:   document.getElementById("couponExpiry").value,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, "coupons", id), payload);
      toast("Coupon updated ✅", "success");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "coupons"), payload);
      toast("Coupon added ✅", "success");
    }
    closeModal("couponModal");
    loadCoupons();
  } catch (err) {
    console.error("Save coupon error:", err);
    toast("Failed to save coupon", "error");
  }
}

async function deleteCoupon(id) {
  if (!confirm("Delete this coupon?")) return;
  try {
    await deleteDoc(doc(db, "coupons", id));
    toast("Coupon deleted", "success");
    loadCoupons();
  } catch (err) {
    console.error("Delete error:", err);
    toast("Failed", "error");
  }
}

/* ═══════════════════════════════════════════
   REVIEWS
   ═══════════════════════════════════════════ */
async function loadReviews() {
  const tbody = document.getElementById("reviewsTableBody");
  try {
    const snap = await getDocs(collection(db, "reviews"));
    state.reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!state.reviews.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No reviews yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    state.reviews.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.productName || r.productId || "—"}</td>
        <td>${r.userName || "—"}</td>
        <td>${"⭐".repeat(Math.min(r.rating || 0, 5))}</td>
        <td>${(r.comment || "").slice(0, 60)}${r.comment?.length > 60 ? "..." : ""}</td>
        <td>
          <button class="btn-danger" data-del="${r.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this review?")) return;
        try {
          await deleteDoc(doc(db, "reviews", b.dataset.del));
          toast("Review deleted", "success");
          loadReviews();
        } catch (err) {
          console.error(err);
          toast("Failed", "error");
        }
      })
    );
  } catch (err) {
    console.error("Load reviews error:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">Error loading.</td></tr>`;
  }
}

/* ═══════════════════════════════════════════
   FORMS BINDING
   ═══════════════════════════════════════════ */
function initForms() {
  document.getElementById("productForm")?.addEventListener("submit", saveProduct);
  document.getElementById("categoryForm")?.addEventListener("submit", saveCategory);
  document.getElementById("couponForm")?.addEventListener("submit", saveCoupon);
}

/* ═══════════════════════════════════════════
   LANGUAGE TOGGLE
   ═══════════════════════════════════════════ */
function initLanguageToggle() {
  const btn   = document.getElementById("managerLangToggle");
  const label = document.getElementById("managerLangLabel");

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