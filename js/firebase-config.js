// ============================================================
// Mateen Online Store - Firebase Configuration
// File: js/firebase-config.js
// Purpose: Firebase ko initialize karna (Auth + Firestore)
// ============================================================

// Firebase Modular SDK v10 (CDN se import)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ------------------------------------------------------------
// Firebase Project Configuration (NEW PROJECT)
// ------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAGTt5Es857_OB5-roAqBQFKYWwCysw6Z8",
  authDomain: "mateenonlinestore.firebaseapp.com",
  projectId: "mateenonlinestore",
  storageBucket: "mateenonlinestore.firebasestorage.app",
  messagingSenderId: "875027596254",
  appId: "1:875027596254:web:4b711fb5a922902916134f"
};

// ------------------------------------------------------------
// Initialize Firebase
// ------------------------------------------------------------
const app = initializeApp(firebaseConfig);

// ------------------------------------------------------------
// Firebase Services
// ------------------------------------------------------------
const auth = getAuth(app);      // Authentication (login/signup)
const db = getFirestore(app);   // Firestore Database (products, orders, users)

// ------------------------------------------------------------
// Export (baaki files me use karne ke liye)
// ------------------------------------------------------------
export { app, auth, db };