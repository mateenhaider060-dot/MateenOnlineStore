// ============================================================
// متین آن لائن اسٹور - صفحہ حفاظت
// فائل: Js/auth-guard.js
// مقصد: صرف لاگ ان صارفین کو صفحہ کھولنے دینا
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ------------------------------------------------------------
// 1. صارف کا ڈیٹا Firestore سے لانا
// استعمال: const userData = await getUserData(uid)
// ------------------------------------------------------------
export async function getUserData(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return { uid, ...snap.data() };
    }
    return null;
  } catch (err) {
    console.error("صارف کا ڈیٹا لانے میں مسئلہ:", err);
    return null;
  }
}

// ------------------------------------------------------------
// 2. صفحہ کی حفاظت — لاگ ان لازمی
// استعمال: const user = await protectPage()
// اگر لاگ ان نہ ہو → خود بخود login پر بھیج دے گا
// ------------------------------------------------------------
export function protectPage() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // صارف لاگ ان ہے
        const userData = await getUserData(user.uid);
        resolve({ user, userData });
      } else {
        // لاگ ان نہیں — login پر بھیج دو
        console.warn("صفحہ محفوظ ہے — لاگ ان ضروری");
        window.location.replace("../Pages/login.html");
        reject("لاگ ان نہیں");
      }
    });
  });
}

// ------------------------------------------------------------
// 3. کردار کے ساتھ صفحہ کی حفاظت
// استعمال: await protectPageWithRole("admin")
// اگر صارف کا کردار مختلف ہو → اُس کے صفحے پر بھیج دے گا
// ------------------------------------------------------------
export function protectPageWithRole(requiredRole) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace("../Pages/login.html");
        reject("لاگ ان نہیں");
        return;
      }

      const userData = await getUserData(user.uid);
      const role = userData?.role || "customer";

      if (role !== requiredRole) {
        // غلط کردار — صحیح صفحے پر بھیج دو
        console.warn(`صرف "${requiredRole}" کے لیے، آپ "${role}" ہیں`);

        if (role === "admin") window.location.replace("../Admin/admin.html");
        else if (role === "manager") window.location.replace("../Manager/manager.html");
        else if (role === "delivery") window.location.replace("../Delivery/delivery.html");
        else window.location.replace("../Pages/home.html");

        reject("غلط کردار");
        return;
      }

      resolve({ user, userData });
    });
  });
}

// ------------------------------------------------------------
// 4. صارف کو لاگ آؤٹ کرنا
// استعمال: await logout()
// ------------------------------------------------------------
export async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem("cart"); // کارٹ بھی صاف کر دو
    window.location.replace("../Pages/login.html");
  } catch (err) {
    console.error("لاگ آؤٹ میں مسئلہ:", err);
  }
}

// ------------------------------------------------------------
// 5. موجودہ صارف فوری حاصل کرنا (انتظار کے بغیر)
// استعمال: const user = getCurrentUser()
// ------------------------------------------------------------
export function getCurrentUser() {
  return auth.currentUser;
}

// ------------------------------------------------------------
// 6. صفحہ کھلتے ہی صارف کے مطابق UI بدلنا
// استعمال: updateUIForUser(userData)
// یہ navbar میں نام دکھائے گا، اور login/signup کے بٹن چھپا دے گا
// ------------------------------------------------------------
export function updateUIForUser(userData) {
  // نام دکھاؤ
  const nameEl = document.querySelectorAll("[data-user-name]");
  nameEl.forEach(el => {
    el.textContent = userData?.name || userData?.email || "صارف";
  });

  // تصویر دکھاؤ
  const imgEl = document.querySelectorAll("[data-user-image]");
  imgEl.forEach(el => {
    if (userData?.photoURL) el.src = userData.photoURL;
  });

  // لاگ ان والے عناصر دکھاؤ
  document.querySelectorAll("[data-auth-required]").forEach(el => {
    el.style.display = "";
  });

  // لاگ ان کے بغیر والے عناصر چھپاؤ
  document.querySelectorAll("[data-guest-only]").forEach(el => {
    el.style.display = "none";
  });
}

// ------------------------------------------------------------
// 7. آسانی کے لیے: ہر صفحے پر یہ چلاؤ
// استعمال: await initPageAuth()  → navbar خود بخود update ہو جائے گا
// ------------------------------------------------------------
export async function initPageAuth(options = {}) {
  const { requireLogin = false, role = null } = options;

  if (role) {
    // کردار کے ساتھ حفاظت
    const { user, userData } = await protectPageWithRole(role);
    updateUIForUser(userData);
    return { user, userData };
  }

  if (requireLogin) {
    // صرف لاگ ان لازمی
    const { user, userData } = await protectPage();
    updateUIForUser(userData);
    return { user, userData };
  }

  // لاگ ان اختیاری — صرف navbar update کرو اگر لاگ ان ہو
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userData = await getUserData(user.uid);
        updateUIForUser(userData);
        resolve({ user, userData });
      } else {
        // مہمان
        document.querySelectorAll("[data-guest-only]").forEach(el => {
          el.style.display = "";
        });
        document.querySelectorAll("[data-auth-required]").forEach(el => {
          el.style.display = "none";
        });
        resolve({ user: null, userData: null });
      }
    });
  });
}