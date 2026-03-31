import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAAIaTQjM9yUlDYecw6xv6GWlbAQneJpck",
  authDomain: "showup-jenirocks.firebaseapp.com",
  projectId: "showup-jenirocks",
  storageBucket: "showup-jenirocks.firebasestorage.app",
  messagingSenderId: "747668131277",
  appId: "1:747668131277:web:f85b6082e7fa2a34624884"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };