import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCdGjAflb9TpxUQDLN0H8vwOxOQb2jRsHI",
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


let confirmationResult = null;

let recaptchaVerifier = null;


function setupRecaptcha(buttonId) {

  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    buttonId,
    {
      size: "invisible",

      callback: () => {
        console.log("reCAPTCHA verified.");
      },

      "expired-callback": () => {
        console.log("reCAPTCHA expired.");
      }
    }
  );

  return recaptchaVerifier;
}


async function sendOTP(phoneNumber, buttonId) {

  if (!phoneNumber) {
    throw new Error("Phone number is required.");
  }

  const verifier = setupRecaptcha(buttonId);

  try {

    confirmationResult =
      await signInWithPhoneNumber(
        auth,
        phoneNumber,
        verifier
      );

    return confirmationResult;

  } catch (error) {

    console.error(
      "OTP sending error:",
      error
    );

    if (recaptchaVerifier) {

      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.log(e);
      }

      recaptchaVerifier = null;
    }

    throw error;
  }
}


async function verifyOTP(code) {

  if (!confirmationResult) {
    throw new Error(
      "Please request an OTP first."
    );
  }

  if (!code) {
    throw new Error(
      "Please enter the OTP."
    );
  }

  const result =
    await confirmationResult.confirm(code);

  return result;
}


async function logoutUser() {

  await signOut(auth);

  confirmationResult = null;

}


function getCurrentUser() {

  return auth.currentUser;

}


function watchAuthState(callback) {

  return onAuthStateChanged(
    auth,
    callback
  );

}


async function saveProfile(profileData) {

  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in to save a profile."
    );
  }

  const uid = user.uid;

  const profileRef =
    doc(db, "profiles", uid);

  const existing =
    await getDoc(profileRef);


  const baseData = {

    uid: uid,

    fullName:
      profileData.fullName?.trim() || "",

    username:
      profileData.username?.trim().toLowerCase() || "",

    phone:
      profileData.phone || user.phoneNumber || "",

    facebookUrl:
      profileData.facebookUrl?.trim() || "",

    relationshipStatus:
      profileData.relationshipStatus ||
      profileData.relationship ||
      "",

    publicSearch:
      profileData.publicSearch === true,

    phoneVerified:
      user.phoneNumber ? true : false,

    profileStatus:
      profileData.profileStatus || "active",

    updatedAt:
      serverTimestamp()
  };


  if (!existing.exists()) {

    baseData.createdAt =
      serverTimestamp();

  }


  await setDoc(
    profileRef,
    baseData,
    {
      merge: true
    }
  );


  return {
    uid: uid,
    ...baseData
  };
}


async function getProfile(uid) {

  if (!uid) {
    return null;
  }

  const profileRef =
    doc(db, "profiles", uid);

  const snapshot =
    await getDoc(profileRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };
}


async function searchProfilesByPhone(phoneNumber) {

  if (!phoneNumber) {
    return [];
  }

  const profilesRef =
    collection(db, "profiles");

  const q =
    query(
      profilesRef,

      where(
        "phone",
        "==",
        phoneNumber
      ),

      where(
        "publicSearch",
        "==",
        true
      ),

      where(
        "phoneVerified",
        "==",
        true
      ),

      where(
        "profileStatus",
        "==",
        "active"
      )
    );


  const snapshot =
    await getDocs(q);


  const results = [];

  snapshot.forEach((item) => {

    results.push({
      id: item.id,
      ...item.data()
    });

  });


  return results;
}


async function searchProfilesByFacebook(facebookUrl) {

  if (!facebookUrl) {
    return [];
  }

  const profilesRef =
    collection(db, "profiles");

  const q =
    query(
      profilesRef,

      where(
        "facebookUrl",
        "==",
        facebookUrl.trim()
      ),

      where(
        "publicSearch",
        "==",
        true
      ),

      where(
        "phoneVerified",
        "==",
        true
      ),

      where(
        "profileStatus",
        "==",
        "active"
      )
    );


  const snapshot =
    await getDocs(q);


  const results = [];

  snapshot.forEach((item) => {

    results.push({
      id: item.id,
      ...item.data()
    });

  });


  return results;
}


async function searchProfiles(searchValue) {

  if (!searchValue) {
    return [];
  }

  const value =
    searchValue.trim();


  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.includes("facebook.com")
  ) {

    return searchProfilesByFacebook(
      value
    );

  }


  return searchProfilesByPhone(
    value
  );
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

  searchProfiles,
  searchProfilesByPhone,
  searchProfilesByFacebook,

  logoutUser,
  getCurrentUser,
  watchAuthState
};
