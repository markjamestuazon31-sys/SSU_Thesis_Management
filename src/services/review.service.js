import { PRIMARY_ADMIN, THESIS_STATUS } from '../config/app.config.js';
import {
  createKey,
  getValue,
  removeValue,
  setValue,
  updateRoot,
} from './db.service.js';
import {
  deleteRealtimeFile,
  getFileMetadata,
  uploadFileToRealtimeDatabase,
} from './file.service.js';
import { createNotification } from './notification.service.js';
import { getAssignedTheses, getThesis } from './thesis.service.js';
import { logAudit } from './audit.service.js';

const FINAL_DECISIONS = new Set(['revision_required', 'adviser_approved']);
const DRAFT_DECISIONS = new Set(['undecided', ...FINAL_DECISIONS]);
const REVISION_LEVELS = new Set(['minor', 'major']);

const decisionMap = {
  revision_required: THESIS_STATUS.REVISION_REQUIRED,
  adviser_approved: THESIS_STATUS.ADVISER_APPROVED,
};

function normalizeComment(value, { required = true } = {}) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim().slice(0, 5000);
  if (required && text.length < 5) {
    throw new Error('Provide specific adviser feedback before submitting the decision.');
  }
  return text;
}

function normalizeDecision(value, { allowUndecided = false } = {}) {
  const decision = String(value || '').trim() || (allowUndecided ? 'undecided' : '');
  const allowed = allowUndecided ? DRAFT_DECISIONS : FINAL_DECISIONS;
  if (!allowed.has(decision)) {
    throw new Error(allowUndecided ? 'Select a valid review option.' : 'Select Approve or Request Revision.');
  }
  return decision;
}

function normalizeRevisionLevel(value, { required = false } = {}) {
  const level = String(value || '').trim().toLowerCase();
  if (!level && !required) return '';
  if (!REVISION_LEVELS.has(level)) throw new Error('Select Minor Revision or Major Revision.');
  return level;
}

async function requireOpenReview(profile, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');
  if (!profile?.uid || thesis.adviserUid !== profile.uid) {
    throw new Error('This thesis was submitted to a different adviser.');
  }
  if (![THESIS_STATUS.SUBMITTED, THESIS_STATUS.UNDER_REVIEW].includes(thesis.status)) {
    throw new Error('This thesis is not currently open for adviser review.');
  }
  if (!String(thesis.currentFileId || '').trim()) {
    throw new Error('This thesis does not have a current student manuscript file.');
  }
  return thesis;
}

async function verifyReviewedFile(fileId, profile, thesis) {
  const metadata = await getFileMetadata(fileId);
  if (!metadata || metadata.status !== 'ready') {
    throw new Error('The saved reviewed manuscript is missing or incomplete. Upload it again.');
  }
  if (metadata.ownerUid !== profile.uid || metadata.thesisId !== thesis.id) {
    throw new Error('The reviewed manuscript is not linked to this adviser and thesis.');
  }
  return metadata;
}

async function uploadReviewedCopy(profile, thesis, file, onProgress = () => {}) {
  return uploadFileToRealtimeDatabase(file, {
    ownerUid: profile.uid,
    thesisId: thesis.id,
    onProgress,
    purpose: 'adviser_reviewed_manuscript',
    sourceFileId: thesis.currentFileId,
    sourceVersion: Number(thesis.version || 1),
  });
}

export async function getReviewDraft(thesisId, adviserUid) {
  const draft = await getValue(`reviewDrafts/${thesisId}`);
  if (!draft || draft.adviserUid !== adviserUid) return null;
  return { thesisId, ...draft };
}

export async function saveReviewDraft(
  profile,
  thesisId,
  {
    decision = 'undecided',
    comment = '',
    revisionLevel = '',
    reviewedFile = null,
    onProgress = () => {},
  } = {},
) {
  const thesis = await requireOpenReview(profile, thesisId);
  const normalizedDecision = normalizeDecision(decision, { allowUndecided: true });
  const text = normalizeComment(comment, { required: false });
  const level = normalizedDecision === 'revision_required'
    ? normalizeRevisionLevel(revisionLevel, { required: false })
    : '';
  const existing = await getReviewDraft(thesisId, profile.uid);

  let uploaded = null;
  let reviewedFileId = normalizedDecision === 'revision_required' ? (existing?.reviewedFileId || '') : '';

  try {
    if (normalizedDecision === 'revision_required' && reviewedFile instanceof File && reviewedFile.size > 0) {
      uploaded = await uploadReviewedCopy(profile, thesis, reviewedFile, onProgress);
      reviewedFileId = uploaded.fileId;
    } else if (reviewedFileId) {
      await verifyReviewedFile(reviewedFileId, profile, thesis);
    }

    const now = Date.now();
    const record = {
      adviserUid: profile.uid,
      adviserName: profile.displayName || 'Thesis Adviser',
      decision: normalizedDecision,
      comment: text,
      revisionLevel: level,
      sourceFileId: thesis.currentFileId,
      sourceVersion: Number(thesis.version || 1),
      updatedAt: now,
      ...(reviewedFileId ? { reviewedFileId } : {}),
    };

    await setValue(`reviewDrafts/${thesisId}`, record);

    if (existing?.reviewedFileId && existing.reviewedFileId !== reviewedFileId) {
      await deleteRealtimeFile(existing.reviewedFileId).catch(() => {});
    }

    await logAudit(profile.uid, 'review_draft_saved', {
      thesisId,
      sourceVersion: record.sourceVersion,
      decision: normalizedDecision,
      reviewedFileAttached: Boolean(reviewedFileId),
    }).catch(() => {});

    return record;
  } catch (error) {
    if (uploaded?.fileId) await deleteRealtimeFile(uploaded.fileId).catch(() => {});
    throw error;
  }
}

export async function discardReviewDraft(profile, thesisId) {
  const thesis = await getThesis(thesisId);
  if (!thesis || thesis.adviserUid !== profile?.uid) throw new Error('Review draft not available.');
  const draft = await getReviewDraft(thesisId, profile.uid);
  if (!draft) return;
  await removeValue(`reviewDrafts/${thesisId}`);
  if (draft.reviewedFileId) await deleteRealtimeFile(draft.reviewedFileId).catch(() => {});
  await logAudit(profile.uid, 'review_draft_discarded', { thesisId }).catch(() => {});
}

export async function submitReview(
  profile,
  thesisId,
  decision,
  comment,
  {
    revisionLevel = '',
    reviewedFile = null,
    onProgress = () => {},
  } = {},
) {
  const thesis = await requireOpenReview(profile, thesisId);
  const normalizedDecision = normalizeDecision(decision);
  const text = normalizeComment(comment);
  const level = normalizedDecision === 'revision_required'
    ? normalizeRevisionLevel(revisionLevel, { required: true })
    : '';
  const draft = await getReviewDraft(thesisId, profile.uid);

  // A draft is only reusable for the exact student version that is currently
  // under review. This prevents a reviewed copy for an older version from
  // being accidentally sent with a newer submission.
  const draftMatchesCurrent = Boolean(
    draft
    && draft.sourceFileId === thesis.currentFileId
    && Number(draft.sourceVersion) === Number(thesis.version || 1),
  );

  let uploaded = null;
  let reviewedFileId = '';
  let committed = false;

  try {
    if (normalizedDecision === 'revision_required') {
      if (reviewedFile instanceof File && reviewedFile.size > 0) {
        uploaded = await uploadReviewedCopy(profile, thesis, reviewedFile, onProgress);
        reviewedFileId = uploaded.fileId;
      } else if (draftMatchesCurrent && draft?.reviewedFileId) {
        await verifyReviewedFile(draft.reviewedFileId, profile, thesis);
        reviewedFileId = draft.reviewedFileId;
      } else {
        throw new Error('Upload the reviewed PDF or DOCX containing your comments or Track Changes before requesting a revision.');
      }
    }

    const reviewId = createKey(`reviews/${thesisId}`);
    const now = Date.now();
    const reviewRecord = {
      adviserUid: profile.uid,
      adviserName: profile.displayName || 'Thesis Adviser',
      decision: normalizedDecision,
      comment: text,
      sourceFileId: thesis.currentFileId,
      sourceVersion: Number(thesis.version || 1),
      createdAt: now,
      ...(normalizedDecision === 'revision_required' ? {
        revisionLevel: level,
        reviewedFileId,
      } : {}),
    };

    const updates = {
      [`reviews/${thesisId}/${reviewId}`]: reviewRecord,
      [`theses/${thesisId}/status`]: decisionMap[normalizedDecision],
      [`theses/${thesisId}/updatedAt`]: now,
      [`theses/${thesisId}/lastReviewedAt`]: now,
      [`reviewDrafts/${thesisId}`]: null,
    };
    if (normalizedDecision === 'adviser_approved') {
      updates[`theses/${thesisId}/adviserApprovedAt`] = now;
    }

    // The final review record, thesis status, and draft removal are committed
    // in one Realtime Database multi-location update.
    await updateRoot(updates);
    committed = true;

    if (draft?.reviewedFileId && draft.reviewedFileId !== reviewedFileId) {
      await deleteRealtimeFile(draft.reviewedFileId).catch(() => {});
    }

    if (normalizedDecision === 'revision_required') {
      await createNotification(thesis.ownerUid, {
        title: `${level === 'major' ? 'Major' : 'Minor'} revision requested`,
        message: `${profile.displayName} reviewed version ${reviewRecord.sourceVersion} of “${thesis.title}”. Download the reviewed manuscript, apply the comments, then submit your revised version.`,
        type: 'review',
        route: `/student/thesis/${thesisId}`,
        actorUid: profile.uid,
      }).catch(() => {});
    } else {
      await createNotification(thesis.ownerUid, {
        title: 'Approved by adviser',
        message: `${profile.displayName} approved version ${reviewRecord.sourceVersion} of “${thesis.title}”. It has been forwarded to the administrator for final approval and publication.`,
        type: 'review',
        route: `/student/thesis/${thesisId}`,
        actorUid: profile.uid,
      }).catch(() => {});

      await createNotification(PRIMARY_ADMIN.uid, {
        title: 'Thesis awaiting final approval',
        message: `${profile.displayName} approved “${thesis.title}”. Review the record for final approval and thesis upload.`,
        type: 'approval',
        route: `/admin/thesis/${thesisId}`,
        actorUid: profile.uid,
      }).catch(() => {});
    }

    await logAudit(profile.uid, 'review_submitted', {
      thesisId,
      reviewId,
      decision: normalizedDecision,
      sourceVersion: reviewRecord.sourceVersion,
      revisionLevel: level || null,
      reviewedFileAttached: Boolean(reviewedFileId),
    }).catch(() => {});

    return { id: reviewId, ...reviewRecord };
  } catch (error) {
    if (!committed && uploaded?.fileId) await deleteRealtimeFile(uploaded.fileId).catch(() => {});
    throw error;
  }
}

export async function getReviews(thesisId) {
  const data = await getValue(`reviews/${thesisId}`);
  if (!data) return [];
  return Object.entries(data)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getAdviserReviewHistory(uid) {
  const theses = await getAssignedTheses(uid);
  const out = [];
  for (const thesis of theses) {
    const reviews = await getReviews(thesis.id);
    for (const review of reviews) {
      if (review.adviserUid === uid) out.push({ ...review, thesisId: thesis.id });
    }
  }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
