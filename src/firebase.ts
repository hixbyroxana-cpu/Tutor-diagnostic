import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, getDoc, query, where, orderBy, setDoc, limit } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  setDoc,
  limit,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
};
