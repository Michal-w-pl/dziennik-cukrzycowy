import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Dodany import

const firebaseConfig = {
  apiKey: "AIzaSyAMWs1cvWmS07v2t5IiK9kATrMw-aFNJUc",
  authDomain: "dziennik-ct1.firebaseapp.com",
  projectId: "dziennik-ct1",
  storageBucket: "dziennik-ct1.firebasestorage.app",
  messagingSenderId: "124377487187",
  appId: "1:124377487187:web:486893f2fccf074ac833a6"
};

// Te dwie poniższe linijki są absolutnie kluczowe:
// Inicjalizują Firebase i EKSPORTUJĄ zmienną 'db', której szuka page.js
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // Wyeksportowana autoryzacja