import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrtuZnJ33LzPV1rDyX2K0y9Jfi24hEnc8",
  authDomain: "project-palnner.firebaseapp.com",
  projectId: "project-palnner",
  storageBucket: "project-palnner.firebasestorage.app",
  messagingSenderId: "1013178295386",
  appId: "1:1013178295386:web:9811710ec54f780c852463",
  measurementId: "G-VXGCWNM7Z0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
