/* ═══════════════════════════════════════════
   MATEEN ONLINE STORE — ADMIN AUTH (v2)
   Login + Role Verification (Improved)
   ═══════════════════════════════════════════ */

import { auth, db } from "../../js/firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* ─── CONFIG ─── */
const DEBUG = true;                  // ← false کر دیں production میں
const ROLE_TIMEOUT_MS = 10000;       // 10 seconds

/* ─── DOM ELEMENTS ─── */
const loginScreen   = document.getElementById("adminLoginScreen");
const dashboard     = document.getElementById("adminDashboard");
const loginForm     = document.getElementById("adminLoginForm");
const loginBtn      = document.getElementById("adminLoginBtn");
const loginError    = document.getElementById("adminLoginError");
const emailInput    = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");
const logoutBtn     = document.getElementById("adminLogoutBtn");

/* ─── DEBUG LOGGER ─── */
function log(...args) {
  if (DEBUG) console.log("🔍 [AdminAuth]", ...args);
}
function logError(...args) {
  console.error("❌ [AdminAuth]", ...args);
}

/* ─── UI HELPERS ─── */
function showError(msg) {
  if (!loginError) return;
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

function hideError() {
  if (!loginError) return;
  loginError.textContent = "";
  loginError.classList.add("hidden");
}

function setLoading(isLoading) {
  if (!loginBtn) return;
  const btnText   = loginBtn.querySelector(".btn-text");
  const btnLoader = loginBtn.querySelector(".btn-loader");
  loginBtn.disabled = isLoading;
  if (btnText)   btnText.classList.toggle("hidden", isLoading);
  if (btnLoader) btnLoader.classList.toggle("hidden", !isLoading);
}

function showLogin() {
  loginScreen?.classList.remove("hidden");
  dashboard?.classList.add("hidden");
}

function showDashboard() {
  loginScreen?.classList.add("hidden");
  dashboard?.classList.remove("hidden");
}

/* ─── SAFE DOM GUARD ─── */
if (!loginForm) {
  logError("Login form not found! Check admin.html");
}

/* ─── ERROR MESSAGES ─── */
function mapAuthError(code) {
  const map = {
    "auth/invalid-email":          "Invalid email address.",
    "auth/user-not-found":         "No admin account found with this email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Invalid email or password.",
    "auth/too-many-requests":      "Too many attempts. Try again later.",
    "auth/user-disabled":          "This account has been disabled.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/operation-not-allowed":  "Email/Password login is disabled. Enable it in Firebase Console.",
    "auth/missing-password":       "Please enter your password."
  };
  return map[code] || `Login failed (${code || "unknown"}). Please try again.`;
}

/* ─── TIMEOUT WRAPPER ─── */
function withTimeout(promise, ms, timeoutMsg = "Request timed out") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMsg)), ms)
    )
  ]);
}

/* ─── VERIFY ADMIN ROLE ─── */
async function verifyAdminRole(uid) {
  if (!uid) {
    logError("verifyAdminRole: no uid provided");
    return { isAdmin: false, reason: "no_uid" };
  }

  try {
    log("Verifying role for UID:", uid);

    const userRef  = doc(db, "users", uid);
    const userSnap = await withTimeout(
      getDoc(userRef),
      ROLE_TIMEOUT_MS,
      "Firestore role check timed out"
    );

    if (!userSnap.exists()) {
      log("❌ User document does not exist in Firestore");
      return { isAdmin: false, reason: "no_document" };
    }

    const data = userSnap.data();
    log("User document data:", data);

    if (!("role" in data)) {
      logError("❌ 'role' field missing in user document");
      return { isAdmin: false, reason: "no_role_field" };
    }

    const role = String(data.role).trim().toLowerCase();
    log("Parsed role:", JSON.stringify(role));

    const isAdmin = role === "admin";
    log(isAdmin ? "✅ Role verified as ADMIN" : `❌ Role is "${role}", not "admin"`);

    return { isAdmin, role, data };

  } catch (err) {
    logError("Role verification failed:", err);

    const code = err?.code || "";
    let reason = "unknown";

    if (code === "permission-denied") {
      reason = "permission_denied";
      logError("👉 Firestore rules are blocking read access. Check firestore.rules");
    } else if (err.message?.includes("timed out")) {
      reason = "timeout";
      logError("👉 Network is too slow or Firestore is unreachable");
    } else if (err.message?.includes("offline")) {
      reason = "offline";
    }

    return { isAdmin: false, reason, error: err };
  }
}

/* ─── HUMAN-READABLE REASON ─── */
function reasonToMessage(reason) {
  const messages = {
    no_uid:            "Authentication error. Please try again.",
    no_document:       "No profile found. Ask super-admin to create your user document.",
    no_role_field:     "Your profile is missing a 'role' field. Contact super-admin.",
    permission_denied: "Permission denied. Firestore rules may be blocking access.",
    timeout:           "Server timeout. Check your internet connection.",
    offline:           "You appear to be offline. Check your connection.",
    unknown:           "Could not verify admin access. Please try again."
  };
  return messages[reason] || messages.unknown;
}

/* ─── LOGIN HANDLER ─── */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);

  const email    = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  log("Login attempt for:", email);

  if (!email || !password) {
    showError("Please fill in all fields.");
    setLoading(false);
    return;
  }

  try {
    log("Step 1: Signing in with Firebase Auth...");
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    log("✅ Auth success. UID:", userCred.user.uid);

    log("Step 2: Verifying admin role...");
    const result = await verifyAdminRole(userCred.user.uid);

    if (!result.isAdmin) {
      logError("Admin verification failed. Reason:", result.reason);

      if (result.reason === "no_document" ||
          result.reason === "no_role_field" ||
          result.reason === "permission_denied") {
        await signOut(auth);
        showError(reasonToMessage(result.reason));
      } else {
        showError(reasonToMessage(result.reason));
      }

      setLoading(false);
      return;
    }

    log("🎉 Admin login successful:", userCred.user.email);

  } catch (err) {
    logError("Login failed:", err);
    showError(mapAuthError(err.code));
    setLoading(false);
  }
});

/* ─── LOGOUT HANDLER ─── */
logoutBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!confirm("Are you sure you want to logout?")) return;

  try {
    log("Logging out...");
    await signOut(auth);
    window.location.reload();
  } catch (err) {
    logError("Logout error:", err);
  }
});

/* ─── AUTH STATE OBSERVER ─── */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    log("No user signed in. Showing login screen.");
    showLogin();
    return;
  }

  log("Auth state changed — user:", user.email);

  const result = await verifyAdminRole(user.uid);

  if (!result.isAdmin) {
    logError("Auth state: not admin. Signing out. Reason:", result.reason);

    if (result.reason === "no_document" ||
        result.reason === "no_role_field" ||
        result.reason === "permission_denied") {
      await signOut(auth);
      showLogin();
      showError(reasonToMessage(result.reason));
    } else {
      showLogin();
      showError(reasonToMessage(result.reason));
    }
    return;
  }

  const nameEl  = document.getElementById("adminName");
  const emailEl = document.getElementById("adminEmailDisplay");
  const avatar  = document.getElementById("adminAvatar");

  if (nameEl)  nameEl.textContent  = result.data?.name || user.displayName || "Admin";
  if (emailEl) emailEl.textContent = user.email || "";
  if (avatar && (result.data?.photoURL || user.photoURL)) {
    avatar.src = result.data?.photoURL || user.photoURL;
  }

  showDashboard();
  log("Dashboard shown.");

  window.dispatchEvent(new CustomEvent("adminReady", {
    detail: { user, profile: result.data }
  }));
});

/* ─── GLOBAL ERROR HANDLER ─── */
window.addEventListener("unhandledrejection", (e) => {
  logError("Unhandled promise rejection:", e.reason);
});

/* ─── EXPORT ─── */
export { verifyAdminRole };