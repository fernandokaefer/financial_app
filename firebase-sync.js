import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

var firebaseConfig = {
  apiKey: "AIzaSyBSIqaoROOhRYFx1E3oqr2R4uqByhF8nJ8",
  authDomain: "financialapp-7464b.firebaseapp.com",
  projectId: "financialapp-7464b",
  storageBucket: "financialapp-7464b.firebasestorage.app",
  messagingSenderId: "1005146687844",
  appId: "1:1005146687844:web:a6fcc357f83510128e5271"
};

var firebaseApp = initializeApp(firebaseConfig);
var auth = getAuth(firebaseApp);
var db = getFirestore(firebaseApp);

var currentUser = null;
var authListeners = [];
var saveTimer = null;

function backupDocRef(uid) {
  return doc(db, "users", uid, "backup", "data");
}

onAuthStateChanged(auth, function (user) {
  currentUser = user;
  authListeners.forEach(function (cb) { cb(user); });
});

function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

function signOutUser() {
  return signOut(auth);
}

function onAuthChange(cb) {
  authListeners.push(cb);
  if (auth.currentUser) cb(auth.currentUser);
}

function queueSave(getDataFn) {
  if (!currentUser) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    var data = getDataFn();
    setDoc(backupDocRef(currentUser.uid), {
      payload: JSON.stringify(data),
      updatedAt: Date.now()
    }).then(function () {
      window.dispatchEvent(new CustomEvent("cloudsync:saved", { detail: { at: Date.now() } }));
    }).catch(function (err) {
      window.dispatchEvent(new CustomEvent("cloudsync:error", { detail: { message: err.message } }));
    });
  }, 1500);
}

function fetchCloudBackup() {
  if (!currentUser) return Promise.resolve(null);
  return getDoc(backupDocRef(currentUser.uid)).then(function (snap) {
    if (!snap.exists()) return null;
    try { return JSON.parse(snap.data().payload); }
    catch (e) { return null; }
  });
}

window.CloudSync = {
  signUp: signUp,
  signIn: signIn,
  signOut: signOutUser,
  onAuthChange: onAuthChange,
  queueSave: queueSave,
  fetchCloudBackup: fetchCloudBackup,
  isSignedIn: function () { return !!currentUser; },
  currentEmail: function () { return currentUser ? currentUser.email : null; }
};

window.dispatchEvent(new CustomEvent("cloudsync:ready"));
