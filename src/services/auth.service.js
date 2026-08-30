import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { firebaseConfig } from '../config/firebase-config.js';
import { CAS_PROGRAMS, PRIMARY_ADMIN } from '../config/app.config.js';
import {
  createValueIfAbsent,
  getValue,
  removeValue,
  setValue,
  updateRoot,
  updateValue,
} from './db.service.js';
import {
  normalizeResearchTitle,
  researchRegistrationKey,
  validEmail,
  validPassword,
  validResearchTitle,
  validResearchYear,
} from '../utils/validation.js';
import { logAudit } from './audit.service.js';
import { getProfilePhoto } from './profile-photo.service.js';

function ensureAuth() {
  if (!auth) throw new Error('Firebase is not configured. Check your .env file and Realtime Database URL.');
  return auth;
}

export function subscribeToAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
  const [profile, photo] = await Promise.all([
    getValue(`users/${uid}`),
    getProfilePhoto(uid).catch(() => null),
  ]);
  return profile ? {
    uid,
    ...profile,
    profilePhotoUrl: photo?.dataUrl || '',
    profilePhotoUpdatedAt: photo?.updatedAt || null,
  } : null;
}


export async function ensurePrimaryAdminProfile(firebaseUser) {
  if (!firebaseUser || firebaseUser.uid !== PRIMARY_ADMIN.uid) return null;

  const existing = await getUserProfile(firebaseUser.uid).catch(() => null);
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('The primary administrator UID exists in Realtime Database with a non-admin role. Correct the users profile before continuing.');
    }
    return existing;
  }

  const now = Date.now();
  const profile = {
    email: firebaseUser.email || PRIMARY_ADMIN.email,
    displayName: firebaseUser.displayName || PRIMARY_ADMIN.displayName,
    role: 'admin',
    status: 'active',
    employeeId: '',
    department: PRIMARY_ADMIN.department,
    createdAt: now,
    updatedAt: now,
    source: 'firebase_auth_primary_admin',
  };

  await setValue(`users/${firebaseUser.uid}`, profile);
  await logAudit(firebaseUser.uid, 'primary_admin_profile_created', { email: profile.email }).catch(() => {});
  return { uid: firebaseUser.uid, ...profile };
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(ensureAuth(), validEmail(email), String(password || ''));

  let profile = await getUserProfile(credential.user.uid).catch(() => null);
  if (!profile && credential.user.uid === PRIMARY_ADMIN.uid) {
    profile = await ensurePrimaryAdminProfile(credential.user);
  }

  if (!profile) {
    await signOut(auth);
    throw new Error('Authentication succeeded, but no system profile exists for this account. Students must self-register; adviser accounts must be created by the administrator.');
  }

  if (profile.status !== 'active') {
    await signOut(auth);
    throw new Error('This account is inactive. Contact the administrator.');
  }

  await updateValue(`users/${credential.user.uid}`, { lastLoginAt: Date.now() }).catch(() => {});
  return { user: credential.user, profile };
}

export async function logout() {
  if (auth) await signOut(auth);
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(ensureAuth(), validEmail(email));
}

/**
 * Student accounts are self-service only.
 * They are never created from the admin dashboard.
 */
export async function registerStudent(payload) {
  const email = validEmail(payload.email);
  const password = validPassword(payload.password);
  const displayName = String(payload.displayName || '').trim();
  const researchTitle = validResearchTitle(payload.researchTitle);
  const researchTitleNormalized = normalizeResearchTitle(researchTitle);
  const researchYear = validResearchYear(payload.researchYear);
  const registrationKey = researchRegistrationKey(researchTitleNormalized);

  if (!displayName) throw new Error('Full name is required.');

  const program = String(payload.program || '').trim();
  if (!CAS_PROGRAMS.includes(program)) {
    throw new Error('Please select a valid College of Arts and Sciences program.');
  }

  const credential = await createUserWithEmailAndPassword(ensureAuth(), email, password);
  const claimPath = `researchRegistrationClaims/${researchYear}/${registrationKey}`;
  let claimCreated = false;
  try {
    await updateProfile(credential.user, { displayName });
    const now = Date.now();
    claimCreated = await createValueIfAbsent(claimPath, {
      uid: credential.user.uid,
      researchTitle,
      researchTitleNormalized,
      researchYear,
      registrationKey,
      createdAt: now,
    });

    if (!claimCreated) {
      const duplicateError = new Error(
        `An account already exists for the research title “${researchTitle}” in ${researchYear}. Use a different title or verify the research year.`,
      );
      duplicateError.code = 'research/duplicate-title-year';
      throw duplicateError;
    }

    const profile = {
      email,
      displayName,
      role: 'student',
      status: 'active',
      studentId: String(payload.studentId || '').trim(),
      program,
      department: 'College of Arts and Sciences',
      adviserUid: '',
      adviserName: '',
      researchTitle,
      researchTitleNormalized,
      researchYear,
      researchRegistrationKey: registrationKey,
      createdAt: now,
      updatedAt: now,
      registrationSource: 'student_self_registration',
    };

    await setValue(`users/${credential.user.uid}`, profile);
    await logAudit(credential.user.uid, 'student_registered', { email }).catch(() => {});
    return { uid: credential.user.uid, ...profile };
  } catch (error) {
    if (claimCreated) await removeValue(claimPath).catch(() => {});
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

/**
 * Adviser accounts are created only by an authenticated administrator.
 * A secondary Firebase Auth instance is used so the administrator remains
 * signed in after the adviser account is created.
 */
export async function createAdviserAccount(adminUid, payload) {
  const email = validEmail(payload.email);
  const password = validPassword(payload.password);
  const displayName = String(payload.displayName || '').trim();
  const employeeId = String(payload.employeeId || '').trim();
  const department = String(payload.department || 'College of Arts and Sciences').trim();

  if (!displayName) throw new Error('Adviser full name is required.');

  const secondaryApp = initializeApp(firebaseConfig, `adviser-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser = null;

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName });

    const now = Date.now();
    const profile = {
      email,
      displayName,
      role: 'adviser',
      status: 'active',
      employeeId,
      studentId: '',
      program: '',
      department,
      adviserUid: '',
      adviserName: '',
      createdBy: adminUid,
      createdAt: now,
      updatedAt: now,
      accountSource: 'admin_created_adviser',
    };

    await updateRoot({
      [`users/${createdUser.uid}`]: profile,
      [`adviserDirectory/${createdUser.uid}`]: {
        displayName,
        employeeId,
        department,
        status: 'active',
        updatedAt: now,
      },
    });
    await logAudit(adminUid, 'adviser_account_created', {
      uid: createdUser.uid,
      email,
      employeeId,
    }).catch(() => {});

    return { uid: createdUser.uid, ...profile };
  } catch (error) {
    if (createdUser) await deleteUser(createdUser).catch(() => {});
    throw error;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

export async function changePassword(newPassword) {
  const password = validPassword(newPassword);
  const user = ensureAuth().currentUser;
  if (!user) throw new Error('You must be signed in.');
  await updatePassword(user, password);
}

export async function updateOwnProfile(uid, patch) {
  const existing = await getUserProfile(uid);
  if (!existing) throw new Error('Your system profile could not be found.');

  const displayName = String(patch.displayName || '').trim();
  if (!displayName) throw new Error('Full name is required.');

  const safe = {
    displayName,
    program: existing.role === 'student'
      ? String(patch.program || '').trim()
      : String(existing.program || ''),
    department: existing.role === 'student' || existing.role === 'adviser'
      ? 'College of Arts and Sciences'
      : String(patch.department || existing.department || '').trim(),
    studentId: existing.role === 'student'
      ? String(patch.studentId || '').trim()
      : String(existing.studentId || ''),
    employeeId: existing.role === 'adviser'
      ? String(patch.employeeId || '').trim()
      : String(existing.employeeId || ''),
    updatedAt: Date.now(),
  };

  if (existing.role === 'student' && !CAS_PROGRAMS.includes(safe.program)) {
    throw new Error('Please select a valid College of Arts and Sciences program.');
  }

  await updateValue(`users/${uid}`, safe);

  if (existing.role === 'adviser') {
    // Keep the student adviser selector synchronized with the adviser's
    // editable display identity. Older adviser accounts without a directory
    // entry can still update their user profile; an admin sync can create the
    // missing directory entry later.
    await updateValue(`adviserDirectory/${uid}`, {
      displayName,
      department: safe.department,
      updatedAt: safe.updatedAt,
    }).catch(() => {});
  }

  if (auth?.currentUser && safe.displayName) {
    await updateProfile(auth.currentUser, { displayName: safe.displayName });
  }
  return getUserProfile(uid);
}
