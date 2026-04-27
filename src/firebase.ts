import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, getDoc, query, where, orderBy, setDoc, limit } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export { collection, addDoc, getDocs, updateDoc, doc, getDoc, query, where, orderBy, setDoc, limit };
