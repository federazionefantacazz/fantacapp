import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA6-PybCz_csan8tcrOEfgP8v3WKg1SIWY",
  authDomain: "fantcapp.firebaseapp.com",
  databaseURL: "https://fantcapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fantcapp",
  storageBucket: "fantcapp.firebasestorage.app",
  messagingSenderId: "118817739792",
  appId: "1:118817739792:web:2dc599ae4bfb8769222695",
  measurementId: "G-DR0TJDVR2R"
};

// Inizializzazione di Firebase
const fapp = initializeApp(firebaseConfig);

// Esportiamo le istanze pronte all'uso e le funzioni core di Firebase
export const db = getDatabase(fapp);
export const auth = getAuth(fapp);

// Esportiamo anche le funzioni di Firebase che usi più spesso per accorciare gli import nelle altre pagine
export { ref, onValue, set, update, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut };
