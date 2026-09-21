import { CAS_PROGRAMS, THESIS_STATUS } from '../config/app.config.js';
import { createKey, getCollection, getValue, queryByChild, removeValue, setValue, updateValue } from './db.service.js';
import { uploadFileToRealtimeDatabase } from './file.service.js';
import { createNotification } from './notification.service.js';
import { logAudit } from './audit.service.js';
import { getProgramChairForProgram } from './user.service.js';

const normalize = (item, id) => item ? { id, ...item } : null;

export async function getThesis(id) {
  return normalize(await getValue(`theses/${id}`), id);
}

export async function getMyTheses(uid) {
  return (await queryByChild('theses', 'ownerUid', uid)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getAssignedTheses(uid) {
  const [current, legacy] = await Promise.all([
    queryByChild('theses', 'researchInstructorUid', uid).catch(() => []),
    queryByChild('theses', 'adviserUid', uid).catch(() => []),
  ]);
  const merged = new Map();
  [...legacy, ...current].forEach((item) => merged.set(item.id, item));
  return [...merged.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getProgramChairTheses(program) {
  if (!CAS_PROGRAMS.includes(String(program || ''))) return [];
  return (await queryByChild('theses', 'program', program)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getAllTheses() {
  return (await getCollection('theses')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getPublishedTheses() {
  return (await getCollection('publishedTheses')).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
}

export async function getPublishedThesis(id) {
  return normalize(await getValue(`publishedTheses/${id}`), id);
}

export async function getSubmissionHistory(id) {
  const data = await getValue(`submissions/${id}`);
  if (!data) return [];
  return Object.entries(data)
    .map(([submissionId, item]) => ({ id: submissionId, ...item }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}

function normalizeText(value, maxLength = 5000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeAuthors(value, fallback = '') {
  const raw = String(value || fallback || '')
    .split(',')
    .map((name) => name.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(raw)].slice(0, 12);
}

function validateSubmissionMetadata(profile, payload) {
  const title = normalizeText(payload.title, 300);
  const abstract = String(payload.abstract || '').trim().slice(0, 5000);
  const keywords = normalizeText(payload.keywords, 500);
  const academicYear = normalizeText(payload.academicYear, 20);
  const program = normalizeText(payload.program || profile.program, 160);
  const department = normalizeText(payload.department || profile.department || 'College of Arts and Sciences', 160);
  const authorsList = normalizeAuthors(payload.authors, profile.displayName);
  const year = Number(payload.year) || new Date().getFullYear();

  if (title.length < 5) throw new Error('Enter a complete thesis title.');
  if (!authorsList.length) throw new Error('Add at least one researcher.');
  if (abstract.length < 20) throw new Error('Provide a complete research abstract.');
  if (!keywords) throw new Error('Provide at least one research keyword.');
  if (!CAS_PROGRAMS.includes(program)) throw new Error('Your student account does not have a valid CAS program.');
  if (!academicYear) throw new Error('Enter the academic year for this research.');
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Select a valid research year.');

  return {
    title,
    abstract,
    keywords,
    academicYear,
    program,
    department,
    authorsList,
    authors: authorsList.join(', '),
    year,
  };
}

function entryPrograms(entry = {}) {
  if (Array.isArray(entry.programs) && entry.programs.length) return entry.programs;
  if (entry.program) return [entry.program];
  return [...CAS_PROGRAMS];
}

async function getInstructorEntry(uid) {
  if (!uid) return null;
  return await getValue(`researchInstructorDirectory/${uid}`)
    || await getValue(`adviserDirectory/${uid}`);
}

export async function submitNewThesis(profile, payload, file, onProgress) {
  if (!profile?.uid) throw new Error('Your student session is not available. Please sign in again.');

  const researchInstructorUid = String(profile.researchInstructorUid || profile.adviserUid || '').trim();
  if (!researchInstructorUid) {
    throw new Error('Your student account does not have an assigned Research Instructor. Contact the administrator before submitting.');
  }

  const metadata = validateSubmissionMetadata(profile, payload);
  const instructor = await getInstructorEntry(researchInstructorUid);
  if (!instructor || (instructor.status || 'active') !== 'active') {
    throw new Error('Your assigned Research Instructor is currently unavailable. Contact the administrator before submitting.');
  }
  if (!entryPrograms(instructor).includes(metadata.program)) {
    throw new Error('Your assigned Research Instructor does not match your registered program. Contact the administrator.');
  }

  const chair = await getProgramChairForProgram(metadata.program).catch(() => null);
  const thesisId = createKey('theses');
  const now = Date.now();
  const uploaded = await uploadFileToRealtimeDatabase(file, {
    ownerUid: profile.uid,
    thesisId,
    onProgress,
  });

  const researchInstructorName = instructor.displayName || profile.researchInstructorName || profile.adviserName || 'Research Instructor';
  const thesis = {
    title: metadata.title,
    abstract: metadata.abstract,
    keywords: metadata.keywords,
    authors: metadata.authors,
    authorsList: metadata.authorsList,
    year: metadata.year,
    academicYear: metadata.academicYear,
    program: metadata.program,
    department: metadata.department,
    ownerUid: profile.uid,
    studentName: profile.displayName,
    researchInstructorUid,
    researchInstructorName,
    // Compatibility mirrors for existing data queries and old records.
    adviserUid: researchInstructorUid,
    adviserName: researchInstructorName,
    programChairUid: chair?.id || '',
    programChairName: chair?.displayName || '',
    status: THESIS_STATUS.UNDER_REVIEW,
    currentFileId: uploaded.fileId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
  };

  await setValue(`theses/${thesisId}`, thesis);

  const submissionId = createKey(`submissions/${thesisId}`);
  await setValue(`submissions/${thesisId}/${submissionId}`, {
    fileId: uploaded.fileId,
    version: 1,
    note: String(payload.note || '').trim(),
    submittedAt: now,
  });

  await createNotification(researchInstructorUid, {
    title: 'New research for review',
    message: `${profile.displayName} submitted “${thesis.title}” for your Research Instructor review.`,
    type: 'submission',
    route: `/research-instructor/review/${thesisId}`,
    actorUid: profile.uid,
  });

  await logAudit(profile.uid, 'thesis_submitted', {
    thesisId,
    title: thesis.title,
    researchInstructorUid,
    program: metadata.program,
    programChairUid: chair?.id || '',
  }).catch(() => {});

  return { id: thesisId, ...thesis };
}

export async function resubmitThesis(profile, thesisId, file, note, onProgress) {
  const thesis = await getThesis(thesisId);
  if (!thesis || thesis.ownerUid !== profile.uid) throw new Error('You cannot resubmit this thesis.');
  if (thesis.status !== THESIS_STATUS.REVISION_REQUIRED) throw new Error('This thesis is not requesting a revision.');

  const researchInstructorUid = thesis.researchInstructorUid || thesis.adviserUid;
  const instructor = await getInstructorEntry(researchInstructorUid);
  if (!instructor || (instructor.status || 'active') !== 'active') {
    throw new Error('The Research Instructor for this thesis is currently unavailable. Contact the administrator before resubmitting.');
  }

  const uploaded = await uploadFileToRealtimeDatabase(file, { ownerUid: profile.uid, thesisId, onProgress });
  const version = Number(thesis.version || 1) + 1;
  const now = Date.now();

  await updateValue(`theses/${thesisId}`, {
    currentFileId: uploaded.fileId,
    version,
    status: THESIS_STATUS.UNDER_REVIEW,
    updatedAt: now,
    submittedAt: now,
  });

  const submissionId = createKey(`submissions/${thesisId}`);
  await setValue(`submissions/${thesisId}/${submissionId}`, {
    fileId: uploaded.fileId,
    version,
    note: String(note || '').trim(),
    submittedAt: now,
  });

  await createNotification(researchInstructorUid, {
    title: 'Revised manuscript submitted',
    message: `${profile.displayName} submitted version ${version} of “${thesis.title}”.`,
    type: 'submission',
    route: `/research-instructor/review/${thesisId}`,
    actorUid: profile.uid,
  });

  await logAudit(profile.uid, 'thesis_resubmitted', { thesisId, version }).catch(() => {});
}

function publicationProjection(thesis, publishedAt) {
  return {
    title: thesis.title,
    abstract: thesis.abstract,
    keywords: thesis.keywords,
    authors: thesis.authors || thesis.studentName,
    authorsList: Array.isArray(thesis.authorsList) ? thesis.authorsList : normalizeAuthors(thesis.authors || thesis.studentName),
    year: thesis.year,
    academicYear: thesis.academicYear || '',
    program: thesis.program,
    department: thesis.department,
    studentName: thesis.studentName,
    researchInstructorName: thesis.researchInstructorName || thesis.adviserName || 'Research Instructor',
    adviserName: thesis.researchInstructorName || thesis.adviserName || 'Research Instructor',
    programChairName: thesis.programChairName || '',
    currentFileId: thesis.currentFileId,
    publishedAt,
  };
}

/** Final administrator action after Research Instructor approval. */
export async function approveAndPublishThesis(adminUid, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');

  const allowed = [THESIS_STATUS.INSTRUCTOR_APPROVED, THESIS_STATUS.ADVISER_APPROVED, THESIS_STATUS.RECOMMENDED];
  if (!allowed.includes(thesis.status)) {
    throw new Error('Only research approved by its Research Instructor can receive final administrator approval and thesis upload.');
  }

  const now = Date.now();
  await setValue(`publishedTheses/${thesisId}`, publicationProjection(thesis, now));
  await updateValue(`theses/${thesisId}`, {
    status: THESIS_STATUS.PUBLISHED,
    adminApprovedAt: now,
    approvedAt: now,
    approvedBy: adminUid,
    publishedAt: now,
    updatedAt: now,
  });
  await updateValue(`files/${thesis.currentFileId}`, { published: true, publishedAt: now }).catch(() => {});

  await createNotification(thesis.ownerUid, {
    title: 'Research approved and published',
    message: `“${thesis.title}” received final administrator approval and is now published in the SSU repository.`,
    type: 'success',
    route: `/repository/${thesisId}`,
    actorUid: adminUid,
  });

  const researchInstructorUid = thesis.researchInstructorUid || thesis.adviserUid;
  if (researchInstructorUid) {
    await createNotification(researchInstructorUid, {
      title: 'Research published',
      message: `“${thesis.title}” was approved by the administrator and published in the repository.`,
      type: 'success',
      route: `/repository/${thesisId}`,
      actorUid: adminUid,
    }).catch(() => {});
  }

  if (thesis.programChairUid) {
    await createNotification(thesis.programChairUid, {
      title: 'Program research published',
      message: `“${thesis.title}” from ${thesis.program} received final administrator approval and was published.`,
      type: 'success',
      route: `/program-chair/research/${thesisId}`,
      actorUid: adminUid,
    }).catch(() => {});
  }

  await logAudit(adminUid, 'thesis_admin_approved_and_published', { thesisId }).catch(() => {});
}

export async function approveThesis(adminUid, thesisId) {
  return approveAndPublishThesis(adminUid, thesisId);
}

export async function publishThesis(adminUid, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');
  if (thesis.status === THESIS_STATUS.PUBLISHED) return;
  if (thesis.status === THESIS_STATUS.APPROVED) {
    const now = Date.now();
    await setValue(`publishedTheses/${thesisId}`, publicationProjection(thesis, now));
    await updateValue(`theses/${thesisId}`, { status: THESIS_STATUS.PUBLISHED, publishedAt: now, updatedAt: now });
    await updateValue(`files/${thesis.currentFileId}`, { published: true, publishedAt: now }).catch(() => {});
    return;
  }
  return approveAndPublishThesis(adminUid, thesisId);
}

export async function archiveThesis(adminUid, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');
  const now = Date.now();

  if (thesis.status === THESIS_STATUS.PUBLISHED) {
    await removeValue(`publishedTheses/${thesisId}`).catch(() => {});
    await updateValue(`files/${thesis.currentFileId}`, { published: false }).catch(() => {});
  }

  await updateValue(`theses/${thesisId}`, {
    previousStatus: thesis.status,
    status: THESIS_STATUS.ARCHIVED,
    archivedAt: now,
    updatedAt: now,
  });
  await logAudit(adminUid, 'thesis_archived', { thesisId }).catch(() => {});
}

export async function restoreThesis(adminUid, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');

  const status = thesis.previousStatus === THESIS_STATUS.PUBLISHED
    ? THESIS_STATUS.INSTRUCTOR_APPROVED
    : (thesis.previousStatus || THESIS_STATUS.INSTRUCTOR_APPROVED);

  await updateValue(`theses/${thesisId}`, {
    status,
    previousStatus: null,
    archivedAt: null,
    updatedAt: Date.now(),
  });
  await logAudit(adminUid, 'thesis_restored', { thesisId }).catch(() => {});
}
