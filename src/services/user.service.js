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

const TERMINAL_THESIS_STATUSES = new Set(['published', 'archived', 'rejected']);

/**
 * Removes a student/adviser account from the portal data while preserving
 * completed institutional thesis records. Because this frontend package uses
 * the Firebase client SDK, it cannot delete another user's Firebase Auth
 * identity. A Firebase Admin SDK backend/Cloud Function is required for that
 * final Auth deletion step.
 */
export async function deleteUserAccount(adminUid, uid) {
  if (!adminUid) throw new Error('Administrator session is required.');
  if (!uid) throw new Error('Select an account to delete.');
  if (uid === PRIMARY_ADMIN.uid) throw new Error('The primary administrator account is protected and cannot be deleted.');
  if (adminUid === uid) throw new Error('You cannot delete your own administrator account.');

  const target = await getUser(uid);
  if (!target) throw new Error('User account not found.');
  if (target.role === 'admin') throw new Error('Administrator accounts cannot be deleted from this page.');

  const theses = await getCollection('theses');
  const linked = theses.filter((thesis) => (
    target.role === 'student' ? thesis.ownerUid === uid : thesis.adviserUid === uid
  ));
  const activeLinked = linked.filter((thesis) => !TERMINAL_THESIS_STATUSES.has(String(thesis.status || '')));

  if (activeLinked.length) {
    const label = target.role === 'student' ? 'student' : 'adviser';
    throw new Error(`This ${label} still has ${activeLinked.length} active thesis record${activeLinked.length === 1 ? '' : 's'}. Complete, reject, or archive the linked record first, or disable the account instead.`);
  }

  const updates = {
    [`users/${uid}`]: null,
    [`profilePhotos/${uid}`]: null,
    [`notifications/${uid}`]: null,
  };

  if (target.role === 'adviser') {
    updates[`adviserDirectory/${uid}`] = null;
  }

  if (target.role === 'student' && target.researchYear && target.researchRegistrationKey) {
    updates[`researchRegistrationClaims/${target.researchYear}/${target.researchRegistrationKey}`] = null;
  }

  await updateRoot(updates);
  await logAudit(adminUid, 'user_account_deleted_from_portal', {
    uid,
    role: target.role,
    email: target.email || '',
    preservedThesisRecords: linked.length,
  }).catch(() => {});

  return target;
}

