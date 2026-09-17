import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdGjAFlb9TpxUQDLN0H8vwOxOQb2jRsHI",
  authDomain: "loveroyality-aec58.firebaseapp.com",
  projectId: "loveroyality-aec58",
  storageBucket: "loveroyality-aec58.firebasestorage.app",
  messagingSenderId: "1083752090710",
  appId: "1:1083752090710:web:8f3c0efaae521a8d5e3ff7",
  measurementId: "G-YHE811T222"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

let recaptchaVerifier = null;
let confirmationResult = null;

function setupRecaptcha(buttonId = "sendOtpBtn") {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    buttonId,
    {
      size: "invisible",
      callback: () => {
        console.log("reCAPTCHA verified");
      },
      "expired-callback": () => {
        recaptchaVerifier = null;
      }
    }
  );

  return recaptchaVerifier;
}

async function sendOTP(phoneNumber, buttonId = "sendOtpBtn") {
  const verifier = setupRecaptcha(buttonId);

  confirmationResult = await signInWithPhoneNumber(
    auth,
    phoneNumber,
    verifier
  );

  return confirmationResult;
}

async function verifyOTP(code) {
  if (!confirmationResult) {
    throw new Error("OTP session not found.");
  }

  const result = await confirmationResult.confirm(code);

  return result.user;
}

async function saveProfile(uid, profileData) {
  const profileRef = doc(db, "profiles", uid);

  await setDoc(
    profileRef,
    {
      ...profileData,
      uid,
      phoneVerified: true,
      publicSearch: profileData.publicSearch === true,
      profileStatus: "active",
      updatedAt: serverTimestamp(),
      createdAt: profileData.createdAt || serverTimestamp()
    },
    { merge: true }
  );

  return profileRef;
}

async function getProfile(uid) {
  const profileRef = doc(db, "profiles", uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}

async function searchByPhone(phoneNumber) {
  const profilesRef = collection(db, "profiles");

  const q = query(
    profilesRef,
    where("phoneNormalized", "==", phoneNumber),
    where("publicSearch", "==", true),
    where("phoneVerified", "==", true),
    where("profileStatus", "==", "active")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function searchByFacebook(facebookUrl) {
  const profilesRef = collection(db, "profiles");

  const q = query(
    profilesRef,
    where("facebookUrlNormalized", "==", facebookUrl),
    where("publicSearch", "==", true),
    where("phoneVerified", "==", true),
    where("profileStatus", "==", "active")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function updateProfile(uid, changes) {
  const profileRef = doc(db, "profiles", uid);

  await updateDoc(profileRef, {
    ...changes,
    updatedAt: serverTimestamp()
  });
}

export {
  app,
  auth,
  db,
  setupRecaptcha,
  sendOTP,
  verifyOTP,
  saveProfile,
  getProfile,
  searchByPhone,
  searchByFacebook,
  updateProfile
};
