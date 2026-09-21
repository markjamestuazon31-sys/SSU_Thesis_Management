import { CAS_PROGRAMS, PRIMARY_ADMIN } from '../config/app.config.js';
import { getCollection, getValue, updateRoot } from './db.service.js';
import { logAudit } from './audit.service.js';

export function isResearchInstructorRole(role) {
  return role === 'research_instructor' || role === 'adviser';
}

function instructorPrograms(item = {}) {
  if (Array.isArray(item.programs) && item.programs.length) return item.programs.filter((program) => CAS_PROGRAMS.includes(program));
  if (item.program && CAS_PROGRAMS.includes(item.program)) return [item.program];
  // Existing adviser accounts did not have a program assignment. During the
  // test migration they remain selectable for all CAS programs.
  return [...CAS_PROGRAMS];
}

function normalizeInstructor(item) {
  return {
    ...item,
    role: 'research_instructor',
    programs: instructorPrograms(item),
    program: item.program || '',
  };
}

export async function getAllUsers() {
  return (await getCollection('users')).sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

export async function getResearchInstructors() {
  return (await getAllUsers()).filter((user) => isResearchInstructorRole(user.role) && (user.status || 'active') === 'active');
}

// Legacy export retained so older modules do not fail during migration.
export async function getAdvisers() {
  return getResearchInstructors();
}

/**
 * Public, minimal directory used by student registration. It intentionally
 * excludes email addresses and account-management fields.
 */
export async function getSubmissionResearchInstructors(program = '') {
  const [current, legacy] = await Promise.all([
    getCollection('researchInstructorDirectory').catch(() => []),
    getCollection('adviserDirectory').catch(() => []),
  ]);

  const merged = new Map();
  for (const item of legacy) merged.set(item.id, normalizeInstructor(item));
  for (const item of current) merged.set(item.id, normalizeInstructor(item));

  return [...merged.values()]
    .filter((instructor) => (instructor.status || 'active') === 'active')
    .filter((instructor) => !program || instructor.programs.includes(program))
    .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

// Legacy export retained for compatibility with old imports.
export async function getSubmissionAdvisers(program = '') {
  return getSubmissionResearchInstructors(program);
}

export async function getProgramChairs() {
  return (await getCollection('programChairDirectory'))
    .filter((chair) => (chair.status || 'active') === 'active')
    .sort((a, b) => String(a.program || '').localeCompare(String(b.program || '')) || String(a.displayName || '').localeCompare(String(b.displayName || '')));
}

export async function getProgramChairForProgram(program) {
  if (!program) return null;
  const chairs = await getProgramChairs();
  return chairs.find((chair) => chair.program === program) || null;
}

export async function getStudents() {
  return (await getAllUsers()).filter((user) => user.role === 'student' && (user.status || 'active') === 'active');
}

export async function getUser(uid) {
  const item = await getValue(`users/${uid}`);
  return item ? { uid, ...item } : null;
}

/**
 * Synchronizes current and legacy academic staff accounts into the minimal
 * directories used by registration and program routing.
 */
export async function syncAcademicDirectories(adminUid) {
  const users = await getAllUsers();
  const now = Date.now();
  const updates = {};
  let instructorCount = 0;
  let chairCount = 0;

  for (const user of users) {
    if (isResearchInstructorRole(user.role)) {
      instructorCount += 1;
      const programs = instructorPrograms(user);
      const entry = {
        displayName: user.displayName || 'Research Instructor',
        employeeId: user.employeeId || '',
        department: user.department || 'College of Arts and Sciences',
        program: user.program || '',
        programs,
        status: user.status || 'active',
        updatedAt: now,
      };
      updates[`researchInstructorDirectory/${user.id}`] = entry;
      // Keep the old directory synchronized while old records are still being tested.
      updates[`adviserDirectory/${user.id}`] = entry;
    }

    if (user.role === 'program_chair') {
      chairCount += 1;
      updates[`programChairDirectory/${user.id}`] = {
        displayName: user.displayName || 'Program Chair',
        employeeId: user.employeeId || '',
        department: user.department || 'College of Arts and Sciences',
        program: user.program || '',
        status: user.status || 'active',
        updatedAt: now,
      };
    }
  }

  if (Object.keys(updates).length) await updateRoot(updates);
  await logAudit(adminUid, 'academic_directories_synced', { instructorCount, chairCount }).catch(() => {});
  return { instructorCount, chairCount };
}

// Legacy export retained for current admin route imports.
export async function syncAdviserDirectory(adminUid) {
  return syncAcademicDirectories(adminUid);
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

  if (isResearchInstructorRole(target.role)) {
    const programs = instructorPrograms(target);
    const entry = {
      displayName: target.displayName || 'Research Instructor',
      employeeId: target.employeeId || '',
      department: target.department || 'College of Arts and Sciences',
      program: target.program || '',
      programs,
      status: normalized,
      updatedAt: now,
    };
    updates[`researchInstructorDirectory/${uid}`] = entry;
    updates[`adviserDirectory/${uid}`] = entry;
  }

  if (target.role === 'program_chair') {
    updates[`programChairDirectory/${uid}`] = {
      displayName: target.displayName || 'Program Chair',
      employeeId: target.employeeId || '',
      department: target.department || 'College of Arts and Sciences',
      program: target.program || '',
      status: normalized,
      updatedAt: now,
    };
  }

  await updateRoot(updates);
  await logAudit(adminUid, 'user_status_changed', { uid, status: normalized }).catch(() => {});
}

const TERMINAL_THESIS_STATUSES = new Set(['published', 'archived', 'rejected']);

/**
 * Removes portal data for non-admin accounts. Firebase Authentication identity
 * deletion still requires a trusted Admin SDK backend/Cloud Function.
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
  const linked = theses.filter((thesis) => {
    if (target.role === 'student') return thesis.ownerUid === uid;
    if (isResearchInstructorRole(target.role)) return thesis.researchInstructorUid === uid || thesis.adviserUid === uid;
    return false;
  });
  const activeLinked = linked.filter((thesis) => !TERMINAL_THESIS_STATUSES.has(String(thesis.status || '')));

  if (activeLinked.length) {
    const label = target.role === 'student' ? 'student' : 'Research Instructor';
    throw new Error(`This ${label} still has ${activeLinked.length} active thesis record${activeLinked.length === 1 ? '' : 's'}. Complete, reject, or archive the linked record first, or disable the account instead.`);
  }

  const updates = {
    [`users/${uid}`]: null,
    [`profilePhotos/${uid}`]: null,
    [`notifications/${uid}`]: null,
  };

  if (isResearchInstructorRole(target.role)) {
    updates[`researchInstructorDirectory/${uid}`] = null;
    updates[`adviserDirectory/${uid}`] = null;
  }
  if (target.role === 'program_chair') updates[`programChairDirectory/${uid}`] = null;

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
