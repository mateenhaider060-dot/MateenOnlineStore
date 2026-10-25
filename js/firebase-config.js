// ============================================================
// Mateen Online Store - Firebase Configuration
// File: Js/firebase-config.js
// Purpose: Firebase ko initialize karna (Auth + Firestore)
// ============================================================

// Firebase Modular SDK v10 (CDN se import)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ------------------------------------------------------------
// Firebase Project Configuration
// Project: Mateen Online Store
// ------------------------------------------------------------
const firebaseConfig = {
  // Yahan 'f' small hai, 'F' nahi
  apiKey: "AIzaSyBsNaHTswPcLxGbfN8ohT3yiLh9_WC5YMc", 
  authDomain: "mateen-online-store.firebaseapp.com",
  projectId: "mateen-online-store",
  storageBucket: "mateen-online-store.firebasestorage.app",
  // Yahan 718 hai, 716 nahi
  messagingSenderId: "200560536718", 
  // Yahan bhi 718 hai
  appId: "1:200560536718:web:5069fa9b39080cda26eddf", 
  measurementId: "G-BY53CHLS4D"
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