import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "striking-terminus-b7c1c",
  appId: "1:846030530692:web:1c69d62d25d04e58af7ad1",
  apiKey: "AIzaSyDU_5N6vaYoH8X17ovkp3JOCJ5hxlF4KXw",
  authDomain: "striking-terminus-b7c1c.firebaseapp.com",
  storageBucket: "striking-terminus-b7c1c.firebasestorage.app",
  messagingSenderId: "846030530692",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-zerotrack-ea7955c3-0987-49f2-b066-bbe73d1ee2b4");
