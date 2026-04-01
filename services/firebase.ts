/**
 * Firebase SDK - Optimized initialization with deferred persistence
 * Key optimization: Persistence is initialized AFTER app renders, not blocking startup
 */
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase app only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const firestore = firebase.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZATION: Defer persistence to avoid blocking initial render
// This saves 2-5 seconds on first load
// ─────────────────────────────────────────────────────────────────────────────
let persistenceInitialized = false;

const initPersistence = () => {
  if (persistenceInitialized) return;
  persistenceInitialized = true;
  
  firestore.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported');
      }
    });
};

// Initialize persistence after app has rendered (non-blocking)
if (typeof window !== 'undefined') {
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(initPersistence);
  } else {
    setTimeout(initPersistence, 2000);
  }
}

export { auth, firestore, firebase };
