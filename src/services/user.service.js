import { PRIMARY_ADMIN } from '../config/app.config.js';
import { getCollection, getValue, updateRoot } from './db.service.js';
import { logAudit } from './audit.service.js';

export async function getAllUsers() {
  return (await getCollection('users')).sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

export async function getAdvisers() {
  return (await getAllUsers()).filter((user) => user.role === 'adviser' && user.status === 'active');
}

/**
 * Minimal adviser directory that students are allowed to read when choosing
 * the adviser for a thesis submission. It intentionally does not expose
 * adviser email addresses or other account-management fields.
 */
export async function getSubmissionAdvisers() {
  return (await getCollection('adviserDirectory'))
    .filter((adviser) => adviser.status === 'active')
    .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

export async function getStudents() {
  return (await getAllUsers()).filter((user) => user.role === 'student' && user.status === 'active');
}

export async function getUser(uid) {
  const item = await getValue(`users/${uid}`);
  return item ? { uid, ...item } : null;
}

/**
 * Ensures adviser accounts created by older app versions are visible in the
 * student adviser selector. This is run from the Admin User Management page.
 */
export async function syncAdviserDirectory(adminUid) {
  const users = await getAllUsers();
  const advisers = users.filter((user) => user.role === 'adviser');
  if (!advisers.length) return [];

  const now = Date.now();
  const updates = {};
  advisers.forEach((adviser) => {
    updates[`adviserDirectory/${adviser.id}`] = {
      displayName: adviser.displayName || 'Thesis Adviser',
      employeeId: adviser.employeeId || '',
      department: adviser.department || 'College of Arts and Sciences',
      status: adviser.status || 'active',
      updatedAt: now,
    };
  });
  await updateRoot(updates);
  await logAudit(adminUid, 'adviser_directory_synced', { count: advisers.length }).catch(() => {});
  return advisers;
}

export async function setUserStatus(adminUid, uid, status) {
  const normalized = status === 'disabled' ? 'disabled' : 'active';
  if (uid === PRIMARY_ADMIN.uid) throw new Error('The primary administrator account is protected and cannot be disabled.');
  if (adminUid === uid && normalized === 'disabled') throw new Error('You cannot disable your own administrator account.');

  const target = await getUser(uid);
  if (!target) throw new Error('User account not found.');

  const now = Date.now();
  const updates = {
    [`users/${uid}/status`]: normalized,
    [`users/${uid}/updatedAt`]: now,
  };

  if (target.role === 'adviser') {
    updates[`adviserDirectory/${uid}/displayName`] = target.displayName || 'Thesis Adviser';
    updates[`adviserDirectory/${uid}/employeeId`] = target.employeeId || '';
    updates[`adviserDirectory/${uid}/department`] = target.department || 'College of Arts and Sciences';
    updates[`adviserDirectory/${uid}/status`] = normalized;
    updates[`adviserDirectory/${uid}/updatedAt`] = now;
  }

  await updateRoot(updates);
  await logAudit(adminUid, 'user_status_changed', { uid, status: normalized }).catch(() => {});
}
