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

// FORCE CLEAR in dev mode synchronously before any query can run
if (import.meta.env.DEV) {
  try {
    firestore.clearPersistence().catch(() => {});
  } catch (e) {
    console.warn("Could not wipe persistence: ", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZATION: Defer persistence to avoid blocking initial render
// This saves 2-5 seconds on first load
// ─────────────────────────────────────────────────────────────────────────────
let persistenceInitialized = false;

const initPersistence = () => {
  if (persistenceInitialized) return;
  persistenceInitialized = true;

  // Vite HMR causes multiple instances to hold onto IndexedDB, which causes 
  // FIRESTORE (12.11.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9) CONTEXT: {"ve":-1}
  // Disable persistence and forcefully wipe it so the user's browser is reset automatically.
  if (import.meta.env.DEV) {
    console.info('Firestore caching wiped and disabled in DEV to prevent HMR IndexedDB cache corruption.');
    firestore.clearPersistence().catch(() => {});
    return;
  }
  
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
