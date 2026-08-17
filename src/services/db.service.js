import {
  equalTo,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
} from 'firebase/database';
import { db } from '../config/firebase.js';

function ensureDb() {
  if (!db) throw new Error('Firebase is not configured. Check your .env file and Realtime Database URL.');
  return db;
}

export async function getValue(path) {
  const snapshot = await get(ref(ensureDb(), path));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function setValue(path, value) {
  await set(ref(ensureDb(), path), value);
  return value;
}

export async function updateValue(path, value) {
  await update(ref(ensureDb(), path), value);
  return value;
}

export async function updateRoot(updates) {
  await update(ref(ensureDb()), updates);
  return updates;
}

export async function removeValue(path) {
  await remove(ref(ensureDb(), path));
}

export function createKey(path) {
  return push(ref(ensureDb(), path)).key;
}

export async function queryByChild(path, child, value) {
  const snapshot = await get(query(ref(ensureDb(), path), orderByChild(child), equalTo(value)));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([id, item]) => ({ id, ...item }));
}

export async function getCollection(path) {
  const data = await getValue(path);
  if (!data) return [];
  return Object.entries(data).map(([id, item]) => ({ id, ...item }));
}

/**
 * Realtime Database subscription helpers used by live dashboards and reports.
 * They use Firebase Realtime Database only. Firebase Storage is intentionally
 * not part of this project.
 */
export function subscribeValue(path, callback, onError = console.error) {
  return onValue(
    ref(ensureDb(), path),
    (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

export function subscribeCollection(path, callback, onError = console.error) {
  return subscribeValue(
    path,
    (data) => callback(data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : []),
    onError,
  );
}
