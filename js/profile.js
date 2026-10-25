// ============================================
// profile.js — PROFILE PAGE LOGIC
// ============================================

import { db, auth } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { t } from "./i18n.js";
import { showToast, showLoader, hideLoader } from "./global.js";

// ---------- DOM ----------
const loadingEl    = document.getElementById("profileLoading");
const layoutEl     = document.getElementById("profileLayout");

const avatarImg    = document.getElementById("avatarImg");
const avatarInput  = document.getElementById("avatarInput");
const avatarEdit   = document.getElementById("avatarEditBtn");

const sidebarName  = document.getElementById("sidebarName");
const sidebarEmail = document.getElementById("sidebarEmail");

const infoForm     = document.getElementById("infoForm");
const passwordForm = document.getElementById("passwordForm");

const logoutBtn    = document.getElementById("logoutBtn");
const logoutBtnSide = document.getElementById("logoutBtnSide");

let currentUser = null;

// ============================================
// 1) Auth state
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;
  await loadProfile(user);
});

// ============================================
// 2) Profile load karo
// ============================================
async function loadProfile(user) {
  showLoader();
  try {
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    let data = {};
    if (snap.exists()) data = snap.data();

    // Sidebar
    sidebarName.textContent  = data.name || user.displayName || "User";
    sidebarEmail.textContent = user.email || "—";

    // Avatar
    if (data.photoURL) avatarImg.src = data.photoURL;

    // Info form
    document.getElementById("fullName").value = data.name || user.displayName || "";
    document.getElementById("email").value    = user.email || "";
    document.getElementById("phone").value    = data.phone || "";
    document.getElementById("address").value  = data.address || "";
    document.getElementById("city").value     = data.city || "";
    document.getElementById("postalCode").value = data.postalCode || "";

    loadingEl.classList.add("hidden");
    layoutEl.classList.remove("hidden");
  } catch (err) {
    console.error("❌ Profile load error:", err);
    showToast(t("error_loading") || "Could not load profile", "error");
  } finally {
    hideLoader();
  }
}

// ============================================
// 3) Sidebar tab switch (info / password)
// ============================================
document.querySelectorAll(".profile-nav-item[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".profile-nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    document.querySelectorAll(".profile-tab").forEach((t) => t.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.add("active");
  });
});

// ============================================
// 4) Info save
// ============================================
infoForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name    = document.getElementById("fullName").value.trim();
  const phone   = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const city    = document.getElementById("city").value.trim();
  const postal  = document.getElementById("postalCode").value.trim();

  if (!name || !phone) {
    showToast(t("fill_all_fields") || "Please fill all fields", "warning");
    return;
  }

  if (!/^03\d{9}$/.test(phone)) {
    showToast(t("invalid_phone") || "Invalid phone", "error");
    return;
  }

  showLoader();
  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      name, phone, address, city,
      postalCode: postal,
      updatedAt: serverTimestamp(),
    });

    sidebarName.textContent = name;
    showToast(t("profile_updated") || "Profile updated successfully ✅", "success");
  } catch (err) {
    console.error("❌ Profile update error:", err);
    showToast(t("error") || "Could not update profile", "error");
  } finally {
    hideLoader();
  }
});

// ============================================
// 5) Password change
// ============================================
passwordForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const current = document.getElementById("currentPassword").value;
  const newPass = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmNewPassword").value;

  if (!current || !newPass || !confirm) {
    showToast(t("fill_all_fields") || "Please fill all fields", "warning");
    return;
  }

  if (newPass.length < 6) {
    showToast(t("weak_password") || "Password too short", "error");
    return;
  }

  if (newPass !== confirm) {
    showToast(t("password_mismatch") || "Passwords do not match", "error");
    return;
  }

  showLoader();
  try {
    // Re-authenticate pehle
    const cred = EmailAuthProvider.credential(currentUser.email, current);
    await reauthenticateWithCredential(currentUser, cred);

    // Phir update
    await updatePassword(currentUser, newPass);

    passwordForm.reset();
    showToast(t("password_updated") || "Password updated ✅", "success");
  } catch (err) {
    console.error("❌ Password update error:", err);
    if (err.code === "auth/wrong-password") {
      showToast(t("wrong_password") || "Current password is incorrect", "error");
    } else {
      showToast(t("error") || "Could not update password", "error");
    }
  } finally {
    hideLoader();
  }
});

// ============================================
// 6) Avatar upload (base64 mein store — demo ke liye)
// ============================================
avatarEdit?.addEventListener("click", () => avatarInput.click());

avatarInput?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 1024 * 1024) {
    showToast(t("image_too_large") || "Image should be less than 1MB", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    const dataURL = ev.target.result;

    // Preview
    avatarImg.src = dataURL;

    // Save to Firestore
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        photoURL: dataURL,
        updatedAt: serverTimestamp(),
      });
      showToast(t("photo_updated") || "Photo updated ✅", "success");
    } catch (err) {
      console.error("Avatar save error:", err);
      showToast(t("error") || "Could not save photo", "error");
    }
  };
  reader.readAsDataURL(file);
});

// ============================================
// 7) Password visibility toggle
// ============================================
document.querySelectorAll(".toggle-pass").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    btn.querySelector("i").className = isPass ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
  });
});

// ============================================
// 8) Logout
// ============================================
function handleLogout() {
  if (confirm(t("logout_confirm") || "Are you sure you want to logout?")) {
    auth.signOut().then(() => {
      window.location.href = "login.html";
    });
  }
}

logoutBtn?.addEventListener("click", handleLogout);
logoutBtnSide?.addEventListener("click", handleLogout);

// ============================================
// 9) Language change
// ============================================
window.addEventListener("languageChanged", () => {
  // Kuch nahi — sab t() se auto translate ho jata hai
});