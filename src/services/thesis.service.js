import { THESIS_STATUS } from '../config/app.config.js';
import { createKey, getCollection, getValue, queryByChild, removeValue, setValue, updateValue } from './db.service.js';
import { uploadFileToRealtimeDatabase } from './file.service.js';
import { createNotification } from './notification.service.js';
import { logAudit } from './audit.service.js';

const normalize = (item, id) => item ? { id, ...item } : null;

export async function getThesis(id) {
  return normalize(await getValue(`theses/${id}`), id);
}

export async function getMyTheses(uid) {
  return (await queryByChild('theses', 'ownerUid', uid)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getAssignedTheses(uid) {
  return (await queryByChild('theses', 'adviserUid', uid)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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

/**
 * New workflow (v5.5):
 * Admin creates adviser account -> Student selects an active adviser while
 * submitting -> Adviser reviews/approves -> Admin approves & publishes.
 */
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
  if (!program) throw new Error('Your student account does not have a valid CAS program.');
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

export async function submitNewThesis(profile, payload, file, onProgress) {
  if (!profile?.uid) throw new Error('Your student session is not available. Please sign in again.');
  const adviserUid = String(payload.adviserUid || '').trim();
  if (!adviserUid) throw new Error('Please select a thesis adviser before submitting your research.');

  const metadata = validateSubmissionMetadata(profile, payload);
  const adviser = await getValue(`adviserDirectory/${adviserUid}`);
  if (!adviser || adviser.status !== 'active') {
    throw new Error('The selected adviser account is not available. Please choose another active adviser.');
  }

  const thesisId = createKey('theses');
  const now = Date.now();
  const uploaded = await uploadFileToRealtimeDatabase(file, {
    ownerUid: profile.uid,
    thesisId,
    onProgress,
  });

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
    adviserUid,
    adviserName: adviser.displayName || 'Thesis Adviser',
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

  await createNotification(adviserUid, {
    title: 'New thesis for review',
    message: `${profile.displayName} selected you as adviser and submitted “${thesis.title}” for review.`,
    type: 'submission',
    route: `/adviser/review/${thesisId}`,
    actorUid: profile.uid,
  });

  await logAudit(profile.uid, 'thesis_submitted', {
    thesisId,
    title: thesis.title,
    adviserUid,
  }).catch(() => {});

  return { id: thesisId, ...thesis };
}

export async function resubmitThesis(profile, thesisId, file, note, onProgress) {
  const thesis = await getThesis(thesisId);
  if (!thesis || thesis.ownerUid !== profile.uid) throw new Error('You cannot resubmit this thesis.');
  if (thesis.status !== THESIS_STATUS.REVISION_REQUIRED) throw new Error('This thesis is not requesting a revision.');

  const adviser = await getValue(`adviserDirectory/${thesis.adviserUid}`);
  if (!adviser || adviser.status !== 'active') {
    throw new Error('The adviser for this thesis is currently unavailable. Contact the administrator before resubmitting.');
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

  await createNotification(thesis.adviserUid, {
    title: 'Revised manuscript submitted',
    message: `${profile.displayName} submitted version ${version} of “${thesis.title}”.`,
    type: 'submission',
    route: `/adviser/review/${thesisId}`,
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
    adviserName: thesis.adviserName || 'Thesis Adviser',
    currentFileId: thesis.currentFileId,
    publishedAt,
  };
}

/**
 * Final admin action. In the revised workflow, admin approval immediately
 * publishes the adviser-approved thesis into the repository.
 */
export async function approveAndPublishThesis(adminUid, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');

  const allowed = [THESIS_STATUS.ADVISER_APPROVED, THESIS_STATUS.RECOMMENDED];
  if (!allowed.includes(thesis.status)) {
    throw new Error('Only a thesis approved by its adviser can receive final administrator approval and thesis upload.');
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

  if (thesis.adviserUid) {
    await createNotification(thesis.adviserUid, {
      title: 'Research published',
      message: `“${thesis.title}” was approved by the administrator and published in the repository.`,
      type: 'success',
      route: `/repository/${thesisId}`,
      actorUid: adminUid,
    });
  }

  await logAudit(adminUid, 'thesis_admin_approved_and_published', { thesisId }).catch(() => {});
}

// Legacy exports retained so old links/modules do not break. New UI uses
// approveAndPublishThesis() as the single final administrator action.
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
    ? THESIS_STATUS.ADVISER_APPROVED
    : (thesis.previousStatus || THESIS_STATUS.ADVISER_APPROVED);

  await updateValue(`theses/${thesisId}`, {
    status,
    previousStatus: null,
    archivedAt: null,
    updatedAt: Date.now(),
  });
  await logAudit(adminUid, 'thesis_restored', { thesisId }).catch(() => {});
}
