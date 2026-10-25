/* =============================
   PRODUCTS PAGE — Mateen Store
   Firebase Firestore integration
   ============================= */

import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit as fsLimit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ---------- STATE ---------- */
const state = {
  allProducts: [],
  filtered: [],
  categories: [],
  page: 1,
  perPage: 12,
  filters: {
    categories: new Set(),
    minPrice: 0,
    maxPrice: Number.MAX_SAFE_INTEGER,
    search: '',
    sort: 'newest'
  }
};

const CART_KEY = 'cart';

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderSkeletons();
  setupUI();
  readURLParams();

  try {
    await Promise.all([loadCategories(), loadProducts()]);
    buildCategoryFilter();
    buildPriceRange();
    applyFilters();
  } catch (err) {
    console.error('[products] init failed:', err);
    showError(err);
  }
}

/* ---------- URL PARAMS ---------- */
function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('search')) state.filters.search = params.get('search');
  if (params.get('category')) state.filters.categories.add(params.get('category'));
  if (params.get('sort')) state.filters.sort = params.get('sort');

  const searchInput = document.getElementById('searchInput');
  if (searchInput && state.filters.search) searchInput.value = state.filters.search;

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect && state.filters.sort) sortSelect.value = state.filters.sort;
}

/* ---------- LOAD DATA ---------- */
async function loadProducts() {
  const snap = await getDocs(collection(db, 'products'));
  state.allProducts = snap.docs.map(doc => normalizeProduct(doc.id, doc.data()));
  console.log(`[products] loaded ${state.allProducts.length} products`);
}

async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    state.categories = snap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.data().title || doc.id,
      order: doc.data().order ?? 999
    })).sort((a, b) => a.order - b.order);
  } catch (e) {
    console.warn('[products] categories load failed, using product categories', e);
    const map = new Map();
    state.allProducts.forEach(p => {
      const cat = p.category;
      if (cat) {
        if (!map.has(cat)) map.set(cat, { id: cat, name: cat, order: 999 });
      }
    });
    state.categories = Array.from(map.values());
  }
}

function normalizeProduct(id, data) {
  const price = Number(data.price ?? data.salePrice ?? 0);
  const oldPrice = Number(data.oldPrice ?? data.comparePrice ?? 0);
  const images = data.images || (data.image ? [data.image] : []);
  const stock = Number(data.stock ?? data.quantity ?? 1);
  const createdAt = data.createdAt?.toMillis?.() ?? data.createdAt?.seconds * 1000 ?? Date.now();

  return {
    id,
    name: data.name || data.title || 'Untitled product',
    description: data.description || '',
    price,
    oldPrice,
    category: data.category || data.categoryId || '',
    image: images[0] || '',
    images,
    stock,
    rating: Number(data.rating ?? 0),
    reviews: Number(data.reviews ?? data.reviewCount ?? 0),
    featured: !!data.featured,
    isNew: !!data.isNew,
    discount: oldPrice > price && oldPrice > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0,
    createdAt
  };
}

/* ---------- FILTER + SORT ---------- */
function applyFilters() {
  const f = state.filters;
  const q = f.search.trim().toLowerCase();

  let list = state.allProducts.filter(p => {
    if (f.categories.size > 0 && !f.categories.has(p.category)) return false;
    if (p.price < f.minPrice) return false;
    if (p.price > f.maxPrice) return false;
    if (q) {
      const hay = `${p.name} ${p.description} ${p.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  switch (f.sort) {
    case 'price-asc':
      list.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      list.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      list.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'rating':
      list.sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
    default:
      list.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  state.filtered = list;
  state.page = 1;
  render();
}

/* ---------- RENDER ---------- */
function render() {
  const grid = document.getElementById('productsGrid');
  const countEl = document.getElementById('resultCount');
  if (!grid) return;

  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.perPage));

  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * state.perPage;
  const slice = state.filtered.slice(start, start + state.perPage);

  if (countEl) {
    countEl.innerHTML = total === 0
      ? ''
      : `Showing <strong>${start + 1}–${Math.min(start + state.perPage, total)}</strong> of <strong>${total}</strong> products`;
  }

  if (total === 0) {
    grid.innerHTML = renderEmpty();
    renderPagination(0);
    return;
  }

  grid.innerHTML = slice.map(renderCard).join('');
  renderPagination(pages);
  bindCardEvents();
}

function renderCard(p) {
  const badges = [];
  if (p.isNew) badges.push('<span class="badge badge-new">New</span>');
  if (p.discount > 0) badges.push(`<span class="badge badge-sale">-${p.discount}%</span>`);
  if (p.featured) badges.push('<span class="badge badge-featured">Featured</span>');
  if (p.stock <= 0) badges.push('<span class="badge badge-out">Out of stock</span>');

  const stars = renderStars(p.rating);
  const img = p.image || placeholderImage();
  const inCart = isInCart(p.id);

  return `
    <article class="product-card" data-id="${escapeHtml(p.id)}" role="button" tabindex="0"
             aria-label="View ${escapeHtml(p.name)}">
      <div class="product-card-image-wrap">
        <img class="product-card-image" src="${escapeAttr(img)}" alt="${escapeAttr(p.name)}"
             loading="lazy" onerror="this.src='${placeholderImage()}'" />
        <div class="product-card-badges">${badges.join('')}</div>
        <div class="product-card-actions">
          <button class="icon-action btn-wishlist" data-id="${escapeHtml(p.id)}"
                  title="Wishlist" aria-label="Add to wishlist">
            <i class="fa-regular fa-heart"></i>
          </button>
        </div>
      </div>
      <div class="product-card-body">
        ${p.category ? `<div class="product-card-category">${escapeHtml(p.category)}</div>` : ''}
        <h3 class="product-card-title">${escapeHtml(p.name)}</h3>
        ${p.rating > 0 ? `
          <div class="product-card-rating">
            <span class="stars">${stars}</span>
            <span>${p.rating.toFixed(1)}${p.reviews ? ` (${p.reviews})` : ''}</span>
          </div>` : ''}
        <div class="product-card-price-row">
          <span class="product-card-price">Rs ${formatPrice(p.price)}</span>
          ${p.oldPrice > p.price ? `<span class="product-card-price-old">Rs ${formatPrice(p.oldPrice)}</span>` : ''}
        </div>
        <button class="btn-add-cart ${inCart ? 'added' : ''}"
                data-id="${escapeHtml(p.id)}"
                ${p.stock <= 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-cart-shopping"></i>
          <span>${p.stock <= 0 ? 'Out of stock' : (inCart ? 'Added to cart' : 'Add to cart')}</span>
        </button>
      </div>
    </article>
  `;
}

function renderEmpty() {
  const hasFilters = state.filters.categories.size > 0
    || state.filters.search
    || state.filters.minPrice > 0
    || state.filters.maxPrice < Number.MAX_SAFE_INTEGER;

  return `
    <div class="empty-state">
      <span class="empty-state-icon"><i class="fa-solid fa-box-open"></i></span>
      <h3>${hasFilters ? 'No products match your filters' : 'No products yet'}</h3>
      <p>${hasFilters ? 'Try adjusting your search or filters.' : 'Check back soon — new products are on the way!'}</p>
      ${hasFilters ? '<button class="btn-primary" id="btnResetEmpty">Clear all filters</button>' : ''}
    </div>
  `;
}

function renderError() {
  return `
    <div class="error-state">
      <span class="error-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
      <h3>Could not load products</h3>
      <p>Please check your internet connection or try again.</p>
      <button class="btn-primary" id="btnRetry">Retry</button>
    </div>
  `;
}

function renderSkeletons(count = 8) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-80"></div>
        <div class="skeleton skeleton-line w-40 h-20"></div>
      </div>
    </div>
  `).join('');
}

function renderPagination(pages) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (pages <= 1) { el.innerHTML = ''; return; }

  const cur = state.page;
  const items = [];
  items.push(btn('«', cur - 1, cur === 1, 'Prev'));

  const pageList = pageNumbers(cur, pages);
  pageList.forEach(n => {
    if (n === '...') items.push('<span class="page-ellipsis">…</span>');
    else items.push(`<button class="page-btn ${n === cur ? 'active' : ''}" data-page="${n}">${n}</button>`);
  });

  items.push(btn('»', cur + 1, cur === pages, 'Next'));
  el.innerHTML = items.join('');
  el.querySelectorAll('.page-btn[data-page]').forEach(b => {
    b.addEventListener('click', () => {
      state.page = Number(b.dataset.page);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  function btn(label, page, disabled, ariaLabel) {
    return `<button class="page-btn" data-page="${page}" ${disabled ? 'disabled' : ''} aria-label="${ariaLabel}">${label}</button>`;
  }
}

function pageNumbers(current, total) {
  const delta = 2;
  const range = [];
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  if (current - delta > 2) range.unshift('...');
  if (current + delta < total - 1) range.push('...');
  return [1, ...range, total];
}

/* ---------- UI SETUP ---------- */
function setupUI() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.search = e.target.value;
        applyFilters();
      }, 300);
    });
  }
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      state.filters.search = searchInput.value;
      applyFilters();
    });
  }

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.value = state.filters.sort;
    sortSelect.addEventListener('change', e => {
      state.filters.sort = e.target.value;
      applyFilters();
    });
  }

  const toggleBtn = document.getElementById('btnFilterToggle');
  const sidebar = document.querySelector('.filters-sidebar');
  if (toggleBtn && sidebar) {
    const backdrop = document.createElement('div');
    backdrop.className = 'filters-backdrop';
    document.body.appendChild(backdrop);

    const open = () => { sidebar.classList.add('open'); backdrop.classList.add('show'); };
    const close = () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); };

    toggleBtn.addEventListener('click', open);
    backdrop.addEventListener('click', close);
  }

  document.querySelectorAll('.filter-group h3').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });

  const clearBtn = document.getElementById('btnClearFilters');
  if (clearBtn) clearBtn.addEventListener('click', resetFilters);

  document.getElementById('productsGrid')?.addEventListener('click', e => {
    if (e.target.closest('#btnRetry')) { renderSkeletons(); init(); }
    if (e.target.closest('#btnResetEmpty')) resetFilters();
  });
}

function buildCategoryFilter() {
  const el = document.getElementById('categoryFilter');
  if (!el) return;

  if (state.categories.length === 0) {
    el.innerHTML = '<p style="color:var(--prod-text-muted);font-size:13px;margin:0">No categories available</p>';
    return;
  }

  el.innerHTML = state.categories.map(cat => {
    const count = state.allProducts.filter(p => p.category === cat.id).length;
    const checked = state.filters.categories.has(cat.id) ? 'checked' : '';
    return `
      <label class="category-option">
        <input type="checkbox" value="${escapeAttr(cat.id)}" ${checked} />
        <span>${escapeHtml(cat.name)}</span>
        <span class="cat-count">${count}</span>
      </label>
    `;
  }).join('');

  el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.filters.categories.add(cb.value);
      else state.filters.categories.delete(cb.value);
      applyFilters();
    });
  });
}

function buildPriceRange() {
  const minEl = document.getElementById('priceMin');
  const maxEl = document.getElementById('priceMax');
  const rangeEl = document.getElementById('priceRange');
  if (!minEl && !maxEl && !rangeEl) return;

  const prices = state.allProducts.map(p => p.price).filter(n => n > 0);
  const globalMin = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const globalMax = prices.length ? Math.ceil(Math.max(...prices)) : 100000;

  if (minEl) { minEl.min = globalMin; minEl.max = globalMax; minEl.value = globalMin; }
  if (maxEl) { maxEl.min = globalMin; maxEl.max = globalMax; maxEl.value = globalMax; }
  if (rangeEl) { rangeEl.min = globalMin; rangeEl.max = globalMax; rangeEl.value = globalMax; }

  const apply = () => {
    let min = Number(minEl?.value ?? globalMin);
    let max = Number(maxEl?.value ?? globalMax);
    if (min > max) [min, max] = [max, min];
    state.filters.minPrice = min;
    state.filters.maxPrice = max;
    applyFilters();
  };

  minEl?.addEventListener('change', apply);
  maxEl?.addEventListener('change', apply);
  rangeEl?.addEventListener('input', e => {
    if (maxEl) maxEl.value = e.target.value;
    apply();
  });
}

/* ---------- CARD EVENTS ---------- */
function bindCardEvents() {
  document.querySelectorAll('.product-card').forEach(card => {
    const id = card.dataset.id;

    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      window.location.href = `product-details.html?id=${encodeURIComponent(id)}`;
    });

    card.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
        e.preventDefault();
        window.location.href = `product-details.html?id=${encodeURIComponent(id)}`;
      }
    });

    card.querySelector('.btn-add-cart')?.addEventListener('click', e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const product = state.allProducts.find(p => p.id === id);
      if (!product) return;
      addToCart(product);
      btn.classList.add('added');
      btn.querySelector('span').textContent = 'Added to cart';
      setTimeout(() => {
        btn.classList.remove('added');
        if (product.stock > 0) btn.querySelector('span').textContent = 'Add to cart';
      }, 1500);
    });

    card.querySelector('.btn-wishlist')?.addEventListener('click', e => {
      e.stopPropagation();
      e.currentTarget.classList.toggle('is-active');
      const icon = e.currentTarget.querySelector('i');
      if (e.currentTarget.classList.contains('is-active')) {
        icon.classList.replace('fa-regular', 'fa-solid');
        toast('Added to wishlist');
      } else {
        icon.classList.replace('fa-solid', 'fa-regular');
      }
    });
  });
}

/* ---------- CART ---------- */
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
  updateCartBadge(cart);
}

function isInCart(id) {
  return getCart().some(item => (item.id || item.productId) === id);
}

function addToCart(product) {
  if (typeof window.addToCart === 'function') {
    try { window.addToCart(product); updateCartBadge(getCart()); return; }
    catch (e) { console.warn('[products] window.addToCart failed', e); }
  }

  const cart = getCart();
  const existing = cart.find(i => (i.id || i.productId) === product.id);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({
      id: product.id,
      title: product.name,
      price: product.price,
      image: product.image,
      qty: 1
    });
  }
  saveCart(cart);
  window.dispatchEvent(new CustomEvent('cart:item-added', { detail: product }));
  toast(`${product.name} added to cart`);
}

function updateCartBadge(cart) {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const count = (cart || getCart()).reduce((sum, i) => sum + (i.qty || 1), 0);
  el.textContent = count;
  el.style.display = count > 0 ? '' : 'none';
}

/* ---------- FILTERS ---------- */
function resetFilters() {
  state.filters.categories.clear();
  state.filters.search = '';
  state.filters.minPrice = 0;
  state.filters.maxPrice = Number.MAX_SAFE_INTEGER;
  const si = document.getElementById('searchInput');
  if (si) si.value = '';
  const minEl = document.getElementById('priceMin');
  const maxEl = document.getElementById('priceMax');
  if (minEl) minEl.value = minEl.min;
  if (maxEl) maxEl.value = maxEl.max;
  document.querySelectorAll('#categoryFilter input[type="checkbox"]').forEach(cb => cb.checked = false);
  applyFilters();
}

/* ---------- HELPERS ---------- */
function showError(err) {
  const grid = document.getElementById('productsGrid');
  if (grid) grid.innerHTML = renderError();
  console.error(err);
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let out = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) out += '★';
    else if (i === full && half) out += '⯨';
    else out += '☆';
  }
  return out;
}

function formatPrice(n) {
  return Number(n || 0).toLocaleString('en-PK');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function placeholderImage() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<rect fill="#f3f4f6" width="200" height="200"/>' +
    '<text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14" dy=".3em">No Image</text>' +
    '</svg>'
  );
}

let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: #1f2937; color: #fff; padding: 12px 20px; border-radius: 10px;
      font-size: 14px; z-index: 9999; opacity: 0; transition: all .25s;
      box-shadow: 0 8px 24px rgba(0,0,0,.2); max-width: 90vw;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2200);
}

updateCartBadge(getCart());