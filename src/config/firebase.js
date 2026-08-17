import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

export let app = null;
export let auth = null;
export let db = null;

export const firebaseReady = (async () => {
  if (!isFirebaseConfigured()) return false;

  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app, firebaseConfig.databaseURL);

  await setPersistence(auth, browserLocalPersistence);
  return true;
})();
