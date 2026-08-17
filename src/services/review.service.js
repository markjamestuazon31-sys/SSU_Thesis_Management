import { PRIMARY_ADMIN, THESIS_STATUS } from '../config/app.config.js';
import { createKey, getValue, setValue, updateValue } from './db.service.js';
import { createNotification } from './notification.service.js';
import { getAssignedTheses, getThesis } from './thesis.service.js';
import { logAudit } from './audit.service.js';

const decisionMap = {
  revision_required: THESIS_STATUS.REVISION_REQUIRED,
  adviser_approved: THESIS_STATUS.ADVISER_APPROVED,
  // Older UI versions used "recommended". Accept it as equivalent so old
  // cached pages/records remain compatible during migration.
  recommended: THESIS_STATUS.ADVISER_APPROVED,
  rejected: THESIS_STATUS.REJECTED,
};

export async function submitReview(profile, thesisId, decision, comment) {
  const thesis = await getThesis(thesisId);
  if (!thesis) throw new Error('Thesis not found.');
  if (thesis.adviserUid !== profile.uid) throw new Error('This thesis was submitted to a different adviser.');
  if (![THESIS_STATUS.SUBMITTED, THESIS_STATUS.UNDER_REVIEW].includes(thesis.status)) {
    throw new Error('This thesis is not currently open for adviser review.');
  }
  if (!decisionMap[decision]) throw new Error('Select a valid review decision.');

  const text = String(comment || '').trim();
  if (text.length < 5) throw new Error('Provide a meaningful review comment.');

  const normalizedDecision = decision === 'recommended' ? 'adviser_approved' : decision;
  const id = createKey(`reviews/${thesisId}`);
  const now = Date.now();

  await setValue(`reviews/${thesisId}/${id}`, {
    adviserUid: profile.uid,
    adviserName: profile.displayName,
    decision: normalizedDecision,
    comment: text,
    createdAt: now,
  });

  await updateValue(`theses/${thesisId}`, {
    status: decisionMap[decision],
    updatedAt: now,
    lastReviewedAt: now,
    ...(decisionMap[decision] === THESIS_STATUS.ADVISER_APPROVED ? { adviserApprovedAt: now } : {}),
  });

  const title = normalizedDecision === 'revision_required'
    ? 'Revision requested'
    : normalizedDecision === 'adviser_approved'
      ? 'Approved by adviser'
      : 'Review decision posted';

  await createNotification(thesis.ownerUid, {
    title,
    message: normalizedDecision === 'adviser_approved'
      ? `${profile.displayName} approved “${thesis.title}”. It has been forwarded to the administrator for final approval and publication.`
      : `${profile.displayName} posted a review decision for “${thesis.title}”.`,
    type: 'review',
    route: `/student/thesis/${thesisId}`,
    actorUid: profile.uid,
  });

  if (normalizedDecision === 'adviser_approved') {
    await createNotification(PRIMARY_ADMIN.uid, {
      title: 'Thesis awaiting final approval',
      message: `${profile.displayName} approved “${thesis.title}”. Review the record for final approval and publication.`,
      type: 'approval',
      route: `/admin/thesis/${thesisId}`,
      actorUid: profile.uid,
    });
  }

  await logAudit(profile.uid, 'review_submitted', {
    thesisId,
    decision: normalizedDecision,
  }).catch(() => {});
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
