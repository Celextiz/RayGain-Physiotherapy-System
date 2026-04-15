// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAL6rvtbGZoWOQxm2o3fYxvFniwKz9GpXM",
  authDomain: "raygain-cf637.firebaseapp.com",
  projectId: "raygain-cf637",
  storageBucket: "raygain-cf637.firebasestorage.app",
  messagingSenderId: "258723115236",
  appId: "1:258723115236:web:766902037a28c178e6fcf1",
  measurementId: "G-7DXLCJCLVE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Export Firebase services
export { db, auth, analytics, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, onSnapshot, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
