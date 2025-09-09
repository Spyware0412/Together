import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkh4nP34JkMnCN1NjA4Ju6p40uanVCYA8",
  authDomain: "cinesync-b3jxg.firebaseapp.com",
  databaseURL: "https://cinesync-b3jxg-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cinesync-b3jxg",
  storageBucket: "cinesync-b3jxg.firebasestorage.app",
  messagingSenderId: "40884970758",
  appId: "1:40884970758:web:413a1062cff0d06eab2a87"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };
