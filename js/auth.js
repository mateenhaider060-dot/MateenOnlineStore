// ============================================================
// Mateen Online Store - Auth Logic (Bilingual)
// File: Js/auth.js
// ============================================================

import { auth, db } from "./firebase-config.js";
import { t, initLanguage, toggleLanguage } from "./i18n.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  showToast,
  showLoader,
  hideLoader,
  isValidEmail,
  isValidPhone,
  disableButton,
  enableButton,
  redirectIfLoggedIn
} from "./global.js";

// ============================================================
// INIT
// ============================================================
async function init() {
  // زبان لوڈ کریں
  await initLanguage();

  // Language toggle button
  const langBtn = document.getElementById("langToggle");
  if (langBtn) {
    langBtn.addEventListener("click", toggleLanguage);
  }

  // اگر user پہلے سے logged in ہے تو redirect
  redirectIfLoggedIn(auth, "home.html");

  // Password toggle buttons
  setupPasswordToggles();

  // Forms setup
  setupSignupForm();
  setupLoginForm();
  setupForgotPassword();
}

init();

// ============================================================
// PASSWORD TOGGLE
// ============================================================
function setupPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      if (target.type === "password") {
        target.type = "text";
        btn.textContent = "🙈";
      } else {
        target.type = "password";
        btn.textContent = "👁️";
      }
    });
  });
}

// ============================================================
// SIGN UP
// ============================================================
function setupSignupForm() {
  const signupForm = document.getElementById("signupForm");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const terms = document.getElementById("terms").checked;
    const btn = document.getElementById("signupBtn");

    // Validation
    if (!name || name.length < 2) {
      return showToast(t("fill_all_fields"), "warning");
    }
    if (!isValidEmail(email)) {
      return showToast(t("invalid_email"), "warning");
    }
    if (!isValidPhone(phone)) {
      return showToast(t("invalid_phone"), "warning");
    }
    if (password.length < 6) {
      return showToast(t("weak_password"), "warning");
    }
    if (password !== confirmPassword) {
      return showToast(t("password_mismatch"), "warning");
    }
    if (!terms) {
      return showToast(t("accept_terms"), "warning");
    }

    try {
      disableButton(btn, t("creating_account"));
      showLoader();

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        phone: phone,
        role: "customer",
        photoURL: "",
        addresses: [],
        createdAt: serverTimestamp()
      });

      showToast(t("signup_success") + " 🎉", "success");

      setTimeout(() => {
        window.location.replace("home.html");
      }, 1500);
    } catch (err) {
      console.error(err);
      let msg = t("signup_error");
      if (err.code === "auth/email-already-in-use") {
        msg = t("email_in_use");
      } else if (err.code === "auth/weak-password") {
        msg = t("password_too_weak");
      } else if (err.code === "auth/invalid-email") {
        msg = t("invalid_email_address");
      }
      showToast(msg, "error");
      enableButton(btn);
    } finally {
      hideLoader();
    }
  });
}

// ============================================================
// LOGIN
// ============================================================
function setupLoginForm() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = document.getElementById("loginBtn");

    // Validation
    if (!isValidEmail(email)) {
      return showToast(t("invalid_email"), "warning");
    }
    if (password.length < 6) {
      return showToast(t("weak_password"), "warning");
    }

    try {
      disableButton(btn, t("logging_in"));
      showLoader();

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const role = userSnap.exists()
        ? userSnap.data().role || "customer"
        : "customer";

      showToast(t("login_success") + " ✅", "success");

      let destination = "home.html";
      if (role === "admin") destination = "../Admin/admin.html";
      else if (role === "manager") destination = "../Manager/manager.html";
      else if (role === "delivery") destination = "../Delivery/delivery.html";

      setTimeout(() => {
        window.location.replace(destination);
      }, 1000);
    } catch (err) {
      console.error(err);
      let msg = t("login_failed");
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-credential"
      ) {
        msg = t("invalid_credential");
      } else if (err.code === "auth/wrong-password") {
        msg = t("wrong_password");
      } else if (err.code === "auth/too-many-requests") {
        msg = t("too_many_requests");
      }
      showToast(msg, "error");
      enableButton(btn);
    } finally {
      hideLoader();
    }
  });
}

// ============================================================
// FORGOT PASSWORD
// ============================================================
function setupForgotPassword() {
  const forgotLink = document.getElementById("forgotPassword");
  if (!forgotLink) return;

  forgotLink.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();

    if (!isValidEmail(email)) {
      return showToast(t("enter_email_first"), "warning");
    }

    try {
      showLoader();
      await sendPasswordResetEmail(auth, email);
      showToast(t("reset_email_sent") + " 📧", "success");
    } catch (err) {
      console.error(err);
      showToast(t("reset_email_error"), "error");
    } finally {
      hideLoader();
    }
  });
}

console.log("Auth logic loaded ✅");