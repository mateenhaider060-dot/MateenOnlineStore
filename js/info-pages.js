/* ============================================
   MATEEN ONLINE STORE — INFO PAGES JS
   Handles: FAQ accordion, contact form,
            language toggle, cart count,
            logout, and shared header/footer
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initFAQ();
    initContactForm();
    initLanguageToggle();
    initCartCount();
    initLogout();
    initAuthGuard();
});

/* ============================================
   1. FAQ ACCORDION
   ============================================ */
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (!question) return;

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all other items (accordion behavior)
            faqItems.forEach(other => other.classList.remove('active'));

            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

/* ============================================
   2. CONTACT FORM
   ============================================ */
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const statusEl = document.getElementById('formStatus');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = form.name.value.trim();
        const email = form.email.value.trim();
        const subject = form.subject.value.trim();
        const message = form.message.value.trim();

        // Validation
        if (!name || !email || !subject || !message) {
            showStatus(statusEl, 'Please fill in all fields.', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showStatus(statusEl, 'Please enter a valid email address.', 'error');
            return;
        }

        // Simulate sending (replace with Firebase / backend later)
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            // TODO: Replace with actual backend/Firebase call
            await fakeSendMessage({ name, email, subject, message });

            showStatus(
                statusEl,
                'Thank you! Your message has been sent successfully.',
                'success'
            );
            form.reset();
        } catch (err) {
            console.error('Contact form error:', err);
            showStatus(statusEl, 'Something went wrong. Please try again.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

/* Fake async send — replace with real API */
function fakeSendMessage(data) {
    return new Promise((resolve) => {
        console.log('📩 Message sent:', data);
        setTimeout(resolve, 900);
    });
}

/* Helper: show form status */
function showStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + type;

    // Auto-clear after 5 seconds
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
        el.textContent = '';
        el.className = 'form-status';
    }, 5000);
}

/* Helper: email validation */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ============================================
   3. LANGUAGE TOGGLE
   ============================================ */
function initLanguageToggle() {
    const btn = document.getElementById('langToggle');
    if (!btn) return;

    // Load saved language
    const savedLang = localStorage.getItem('lang') || 'en';
    applyLanguage(savedLang, btn);

    btn.addEventListener('click', () => {
        const current = localStorage.getItem('lang') || 'en';
        const next = current === 'en' ? 'ur' : 'en';
        applyLanguage(next, btn);

        // If i18n.js exposes a function, use it
        if (typeof window.setLanguage === 'function') {
            window.setLanguage(next);
        } else if (typeof window.loadLanguage === 'function') {
            window.loadLanguage(next);
        }
    });
}

function applyLanguage(lang, btn) {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    btn.textContent = lang === 'en' ? 'اردو' : 'English';
}

/* ============================================
   4. CART COUNT
   ============================================ */
function initCartCount() {
    const cartCountEl = document.getElementById('cartCount');
    if (!cartCountEl) return;

    updateCartCount();

    // Listen for storage changes (from other tabs/pages)
    window.addEventListener('storage', (e) => {
        if (e.key === 'cart') updateCartCount();
    });

    // Custom event for same-page updates
    window.addEventListener('cartUpdated', updateCartCount);
}

function updateCartCount() {
    const cartCountEl = document.getElementById('cartCount');
    if (!cartCountEl) return;

    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const total = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
        cartCountEl.textContent = total;
        cartCountEl.style.display = total > 0 ? 'inline-flex' : 'none';
    } catch (err) {
        console.error('Cart count error:', err);
        cartCountEl.textContent = '0';
    }
}

/* ============================================
   5. LOGOUT
   ============================================ */
function initLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const confirmed = confirm('Are you sure you want to logout?');
        if (!confirmed) return;

        try {
            // Firebase logout (if available)
            if (window.firebase && firebase.auth) {
                await firebase.auth().signOut();
            }

            // Clear local session
            localStorage.removeItem('user');
            localStorage.removeItem('token');

            // Redirect to login
            window.location.href = 'login.html';
        } catch (err) {
            console.error('Logout error:', err);
            alert('Logout failed. Please try again.');
        }
    });
}

/* ============================================
   6. AUTH GUARD (Protect info pages)
   ============================================ */
function initAuthGuard() {
    // If auth-guard.js already handles this, skip
    if (window.__authGuardActive) return;

    const user = localStorage.getItem('user');
    const isLoginPage = window.location.pathname.includes('login.html');
    const isSignupPage = window.location.pathname.includes('signup.html');
    const isWelcomePage = window.location.pathname.includes('welcome.html');

    if (!user && !isLoginPage && !isSignupPage && !isWelcomePage) {
        // Uncomment below to enforce login on info pages:
        // window.location.href = 'login.html';
    }
}

/* ============================================
   EXPORT (optional)
   ============================================ */
window.InfoPages = {
    initFAQ,
    initContactForm,
    initLanguageToggle,
    initCartCount,
    initLogout
};