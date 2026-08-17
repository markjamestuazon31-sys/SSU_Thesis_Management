// Firebase client configuration for Vite.
// Vite exposes only variables prefixed with VITE_ through import.meta.env.
// The optional localStorage fallback is used only by the in-app setup page
// when VITE_FIREBASE_DATABASE_URL is not set locally.

const DATABASE_URL_STORAGE_KEY = 'ssu.thesis.firebase.databaseURL';

function env(name) {
  return String(import.meta.env?.[name] ?? '').trim();
}

function getSavedDatabaseURL() {
  try {
    return String(localStorage.getItem(DATABASE_URL_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export const firebaseConfig = Object.freeze({
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: env('VITE_FIREBASE_DATABASE_URL') || getSavedDatabaseURL(),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
  measurementId: env('VITE_FIREBASE_MEASUREMENT_ID'),
});

export function isValidRealtimeDatabaseURL(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host.endsWith('.firebaseio.com') || host.endsWith('.firebasedatabase.app');
  } catch {
    return false;
  }
}

export function saveRealtimeDatabaseURL(value) {
  const url = String(value || '').trim().replace(/\/$/, '');
  if (!isValidRealtimeDatabaseURL(url)) {
    throw new Error('Enter the exact HTTPS URL shown in Firebase Realtime Database.');
  }
  localStorage.setItem(DATABASE_URL_STORAGE_KEY, url);
  return url;
}

export function clearRealtimeDatabaseURL() {
  localStorage.removeItem(DATABASE_URL_STORAGE_KEY);
}

export function getMissingFirebaseKeys() {
  const required = [
    ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
    ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
    ['VITE_FIREBASE_DATABASE_URL', firebaseConfig.databaseURL],
  ];
  return required.filter(([, value]) => !value).map(([key]) => key);
}

export function isFirebaseConfigured() {
  return getMissingFirebaseKeys().length === 0 && isValidRealtimeDatabaseURL(firebaseConfig.databaseURL);
}
