// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA8Ih8PcY2vc9Ji_vsTW9RLaYd24J1l3zA",
  authDomain: "labmanager-82b2d.firebaseapp.com",
  projectId: "labmanager-82b2d",
  storageBucket: "labmanager-82b2d.firebasestorage.app",
  messagingSenderId: "821025419194",
  appId: "1:821025419194:web:9d60c447ff899c85af3783"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);  

export const db = getFirestore(app);
export const auth = getAuth(app);