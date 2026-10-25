/* ═══════════════════════════════════════════
   MATEEN ONLINE STORE — MANAGER AUTH
   Login + Role Verification (admin OR manager)
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

/* ─── DOM ELEMENTS ─── */
const loginScreen   = document.getElementById("managerLoginScreen");
const dashboard     = document.getElementById("managerDashboard");
const loginForm     = document.getElementById("managerLoginForm");
const loginBtn      = document.getElementById("managerLoginBtn");
const loginError    = document.getElementById("managerLoginError");
const emailInput    = document.getElementById("managerEmail");
const passwordInput = document.getElementById("managerPassword");
const logoutBtn     = document.getElementById("managerLogoutBtn");

/* ─── UI HELPERS ─── */
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

/* ─── ERROR MESSAGES ─── */
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

/* ─── VERIFY MANAGER ROLE ─── */
async function verifyManagerRole(uid) {
  try {
    const userRef  = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return { allowed: false, role: null };

    const data = userSnap.data();
    const role = data.role;

    const allowed = role === "manager" || role === "admin";
    return { allowed, role, data };
  } catch (err) {
    console.error("Role verification error:", err);
    return { allowed: false, role: null };
  }
}

/* ─── LOGIN HANDLER ─── */
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
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const check    = await verifyManagerRole(userCred.user.uid);

    if (!check.allowed) {
      await signOut(auth);
      showError("Access denied. Manager account required.");
      setLoading(false);
      return;
    }

    console.log("✅ Manager logged in:", userCred.user.email, "| Role:", check.role);
  } catch (err) {
    console.error("Login error:", err);
    showError(mapAuthError(err.code));
    setLoading(false);
  }
});

/* ─── LOGOUT HANDLER ─── */
logoutBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!confirm("Are you sure you want to logout?")) return;

  try {
    await signOut(auth);
    window.location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
});

/* ─── AUTH STATE OBSERVER ─── */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLogin();
    return;
  }

  const check = await verifyManagerRole(user.uid);

  if (!check.allowed) {
    await signOut(auth);
    showLogin();
    showError("Access denied. Manager only.");
    return;
  }

  const nameEl  = document.getElementById("managerName");
  const emailEl = document.getElementById("managerEmailDisplay");
  const avatar  = document.getElementById("managerAvatar");

  if (nameEl)  nameEl.textContent  = check.data?.name || user.displayName || "Manager";
  if (emailEl) emailEl.textContent = user.email || "";
  if (avatar && (check.data?.photoURL || user.photoURL)) {
    avatar.src = check.data?.photoURL || user.photoURL;
  }

  showDashboard();

  window.dispatchEvent(new CustomEvent("managerReady", {
    detail: { user, role: check.role, profile: check.data }
  }));
});

/* ─── EXPORT ─── */
export { verifyManagerRole };