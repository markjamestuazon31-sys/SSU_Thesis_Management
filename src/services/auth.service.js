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

function isInstructorRole(role) {
  return role === 'research_instructor' || role === 'adviser';
}

function validateProgram(value) {
  const program = String(value || '').trim();
  if (!CAS_PROGRAMS.includes(program)) {
    throw new Error('Please select a valid College of Arts and Sciences program.');
  }
  return program;
}

function programList(entry = {}) {
  if (Array.isArray(entry.programs) && entry.programs.length) return entry.programs;
  if (entry.program) return [entry.program];
  return [...CAS_PROGRAMS];
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
    throw new Error('Authentication succeeded, but no system profile exists for this account. Students self-register; Research Instructor and Program Chair accounts are created by the administrator.');
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

/** Student self-registration with program-matched Research Instructor selection. */
export async function registerStudent(payload) {
  const email = validEmail(payload.email);
  const password = validPassword(payload.password);
  const displayName = String(payload.displayName || '').trim();
  const researchTitle = validResearchTitle(payload.researchTitle);
  const researchTitleNormalized = normalizeResearchTitle(researchTitle);
  const researchYear = validResearchYear(payload.researchYear);
  const registrationKey = researchRegistrationKey(researchTitleNormalized);
  const program = validateProgram(payload.program);
  const researchInstructorUid = String(payload.researchInstructorUid || '').trim();

  if (!displayName) throw new Error('Full name is required.');
  if (!researchInstructorUid) throw new Error('Please select your Research Instructor.');

  const instructor = await getValue(`researchInstructorDirectory/${researchInstructorUid}`)
    || await getValue(`adviserDirectory/${researchInstructorUid}`);
  if (!instructor || (instructor.status || 'active') !== 'active') {
    throw new Error('The selected Research Instructor is not active. Please select another instructor.');
  }
  if (!programList(instructor).includes(program)) {
    throw new Error('The selected Research Instructor is not assigned to your program.');
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
      const duplicateError = new Error(`An account already exists for the research title “${researchTitle}” in ${researchYear}. Use a different title or verify the research year.`);
      duplicateError.code = 'research/duplicate-title-year';
      throw duplicateError;
    }

    const instructorName = instructor.displayName || 'Research Instructor';
    const profile = {
      email,
      displayName,
      role: 'student',
      status: 'active',
      studentId: String(payload.studentId || '').trim(),
      program,
      department: 'College of Arts and Sciences',
      researchInstructorUid,
      researchInstructorName: instructorName,
      // Compatibility mirrors for thesis records created by older versions.
      adviserUid: researchInstructorUid,
      adviserName: instructorName,
      researchTitle,
      researchTitleNormalized,
      researchYear,
      researchRegistrationKey: registrationKey,
      createdAt: now,
      updatedAt: now,
      registrationSource: 'student_self_registration_v8',
    };

    await setValue(`users/${credential.user.uid}`, profile);
    await logAudit(credential.user.uid, 'student_registered', {
      email,
      program,
      researchInstructorUid,
    }).catch(() => {});
    return { uid: credential.user.uid, ...profile };
  } catch (error) {
    if (claimCreated) await removeValue(claimPath).catch(() => {});
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

async function createStaffAccount(adminUid, payload, { role, source, label }) {
  const email = validEmail(payload.email);
  const password = validPassword(payload.password);
  const displayName = String(payload.displayName || '').trim();
  const employeeId = String(payload.employeeId || '').trim();
  const department = String(payload.department || 'College of Arts and Sciences').trim();
  const program = validateProgram(payload.program);

  if (!displayName) throw new Error(`${label} full name is required.`);
  if (!employeeId) throw new Error('Employee ID is required.');

  if (role === 'program_chair') {
    const directory = await getValue('programChairDirectory');
    const duplicate = Object.values(directory || {}).find((chair) => (
      chair?.program === program && (chair?.status || 'active') === 'active'
    ));
    if (duplicate) throw new Error(`An active Program Chair is already assigned to ${program}. Disable the current Chair before creating another active Chair for this program.`);
  }

  const secondaryApp = initializeApp(firebaseConfig, `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
      role,
      status: 'active',
      employeeId,
      studentId: '',
      program,
      department,
      createdBy: adminUid,
      createdAt: now,
      updatedAt: now,
      accountSource: source,
    };

    const updates = { [`users/${createdUser.uid}`]: profile };

    if (role === 'research_instructor') {
      const directoryEntry = {
        displayName,
        employeeId,
        department,
        program,
        programs: [program],
        status: 'active',
        updatedAt: now,
      };
      updates[`researchInstructorDirectory/${createdUser.uid}`] = directoryEntry;
      updates[`adviserDirectory/${createdUser.uid}`] = directoryEntry;
    }

    if (role === 'program_chair') {
      updates[`programChairDirectory/${createdUser.uid}`] = {
        displayName,
        employeeId,
        department,
        program,
        status: 'active',
        updatedAt: now,
      };
    }

    await updateRoot(updates);
    await logAudit(adminUid, `${role}_account_created`, {
      uid: createdUser.uid,
      email,
      employeeId,
      program,
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

export async function createResearchInstructorAccount(adminUid, payload) {
  return createStaffAccount(adminUid, payload, {
    role: 'research_instructor',
    source: 'admin_created_research_instructor',
    label: 'Research Instructor',
  });
}

// Legacy function name retained for any older module still importing it.
export async function createAdviserAccount(adminUid, payload) {
  return createResearchInstructorAccount(adminUid, payload);
}

export async function createProgramChairAccount(adminUid, payload) {
  return createStaffAccount(adminUid, payload, {
    role: 'program_chair',
    source: 'admin_created_program_chair',
    label: 'Program Chair',
  });
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

  const staffRole = isInstructorRole(existing.role) || existing.role === 'program_chair';
  const safe = {
    displayName,
    // Academic program assignment is controlled by the administrator so
    // student/instructor/chair routing cannot be changed from My Profile.
    program: String(existing.program || ''),
    department: existing.role === 'admin'
      ? String(patch.department || existing.department || '').trim()
      : 'College of Arts and Sciences',
    studentId: existing.role === 'student'
      ? String(patch.studentId || '').trim()
      : String(existing.studentId || ''),
    employeeId: staffRole
      ? String(patch.employeeId || '').trim()
      : String(existing.employeeId || ''),
    updatedAt: Date.now(),
  };

  await updateValue(`users/${uid}`, safe);

  if (isInstructorRole(existing.role)) {
    const programs = existing.program ? [existing.program] : [...CAS_PROGRAMS];
    const directoryEntry = {
      displayName,
      employeeId: safe.employeeId,
      department: safe.department,
      program: existing.program || '',
      programs,
      status: existing.status || 'active',
      updatedAt: safe.updatedAt,
    };
    await updateRoot({
      [`researchInstructorDirectory/${uid}`]: directoryEntry,
      [`adviserDirectory/${uid}`]: directoryEntry,
    }).catch(() => {});
  }

  if (existing.role === 'program_chair') {
    await updateValue(`programChairDirectory/${uid}`, {
      displayName,
      employeeId: safe.employeeId,
      department: safe.department,
      program: existing.program || '',
      status: existing.status || 'active',
      updatedAt: safe.updatedAt,
    }).catch(() => {});
  }

  if (auth?.currentUser && safe.displayName) {
    await updateProfile(auth.currentUser, { displayName: safe.displayName });
  }
  return getUserProfile(uid);
}
