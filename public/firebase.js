/**
 * Kaushik Nursery - Firebase & Cloud Integration
 * 
 * Supports Modular Firebase v10+ (App, Analytics, Auth, Firestore).
 * Synchronizes orders, service bookings, and users directly to Google Cloud Firestore.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Production Firebase Configuration for Kaushik Nursery
export const defaultFirebaseConfig = {
  apiKey: "AIzaSyAwBtAF6Z8P1kJtcWEZCmRYOuloG4gogeQ",
  authDomain: "kaushiknursery-71d68.firebaseapp.com",
  projectId: "kaushiknursery-71d68",
  storageBucket: "kaushiknursery-71d68.firebasestorage.app",
  messagingSenderId: "720581963962",
  appId: "1:720581963962:web:04a0b5814ac2fec121d283",
  measurementId: "G-N1ZLCZBTK3"
};

class FirebaseService {
  constructor() {
    this.app = null;
    this.analytics = null;
    this.auth = null;
    this.db = null;
    this.isConfigured = false;
    this.init();
  }

  async init() {
    const savedConfig = localStorage.getItem("kaushik_firebase_config");
    let config = defaultFirebaseConfig;
    if (savedConfig) {
      try {
        config = JSON.parse(savedConfig);
      } catch (e) {
        console.warn("Invalid saved Firebase config:", e);
      }
    }

    if (config.apiKey && !config.apiKey.includes("MOCK")) {
      try {
        this.app = initializeApp(config);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.isConfigured = true;
        console.log("Firebase initialized successfully with project:", config.projectId);

        if (await isSupported().catch(() => false)) {
          this.analytics = getAnalytics(this.app);
          console.log("Firebase Analytics initialized:", config.measurementId);
        }
      } catch (err) {
        console.warn("Firebase initialization notice:", err);
      }
    }
  }

  saveConfig(newConfig) {
    localStorage.setItem("kaushik_firebase_config", JSON.stringify(newConfig));
    this.init();
  }

  // Save order to Firestore
  async saveOrder(order) {
    if (this.isConfigured && this.db) {
      try {
        const orderRef = doc(this.db, "orders", order.id);
        await setDoc(orderRef, {
          ...order,
          timestamp: new Date().toISOString()
        });
        console.log("Order saved to Firestore:", order.id);
        return order.id;
      } catch (err) {
        console.error("Firestore saveOrder error:", err);
      }
    }
    return null;
  }

  // Save service booking/lead to Firestore
  async saveLead(lead) {
    if (this.isConfigured && this.db) {
      try {
        const leadRef = doc(this.db, "leads", lead.id);
        await setDoc(leadRef, {
          ...lead,
          timestamp: new Date().toISOString()
        });
        console.log("Lead saved to Firestore:", lead.id);
        return lead.id;
      } catch (err) {
        console.error("Firestore saveLead error:", err);
      }
    }
    return null;
  }

  // Save user profile to Firestore
  async saveUser(user) {
    if (this.isConfigured && this.db && user?.phone) {
      try {
        const userRef = doc(this.db, "users", user.phone);
        await setDoc(userRef, {
          ...user,
          lastSeen: new Date().toISOString()
        }, { merge: true });
        console.log("User profile synced to Firestore:", user.phone);
      } catch (err) {
        console.error("Firestore saveUser error:", err);
      }
    }
  }
}

export const firebaseService = new FirebaseService();
