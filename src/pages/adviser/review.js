import { getThesis } from '../../services/thesis.service.js';
import { getReviews, submitReview } from '../../services/review.service.js';
import { reconstructFile } from '../../services/file.service.js';
import { downloadBlob } from '../../utils/file.js';
import { pageHeader, statusBadge, infoRow, emptyState } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';

export async function render({ profile, params }) {
  const thesis = await getThesis(params.id);
  if (!thesis || thesis.adviserUid !== profile.uid) {
    return emptyState(
      'Thesis not available',
      'This research was not submitted to your adviser account.',
      '<a class="btn btn-secondary" href="#/adviser/assigned">Back</a>',
    );
  }

  const reviews = await getReviews(thesis.id);
  const reviewOpen = ['submitted', 'under_review'].includes(thesis.status);

  const decisionPanel = reviewOpen
    ? `<form id="review-form" class="form-stack">
        <div class="notice-box info">
          <strong>Adviser decision</strong>
          <p>Approving this research forwards it directly to the administrator for final approval and publication.</p>
        </div>
        <label class="field">
          <span>Decision</span>
          <select name="decision" required>
            <option value="">Select decision</option>
            <option value="adviser_approved">Approve & Forward to Administrator</option>
            <option value="revision_required">Request Revision</option>
            <option value="rejected">Reject</option>
          </select>
        </label>
        <label class="field"><span>Comments / feedback</span><textarea name="comment" rows="8" required placeholder="Provide specific, academic, and actionable feedback."></textarea></label>
        <button class="btn btn-primary" type="submit">Submit adviser decision</button>
      </form>`
    : `<div class="notice-box ${thesis.status === 'adviser_approved' || thesis.status === 'recommended' || thesis.status === 'published' ? 'success' : 'info'}">
        <strong>${thesis.status === 'published' ? 'Research already published' : thesis.status === 'adviser_approved' || thesis.status === 'recommended' ? 'Forwarded to administrator' : 'Review cycle completed'}</strong>
        <p>${thesis.status === 'published'
          ? 'The administrator approved this research and it is now available in the SSU Research Repository.'
          : thesis.status === 'adviser_approved' || thesis.status === 'recommended'
            ? 'You approved this research. It is waiting for the administrator to approve and publish it.'
            : thesis.status === 'revision_required'
              ? 'The student must submit a revised manuscript before another adviser decision can be made.'
              : 'See the review history below for the latest decision.'}</p>
      </div>`;

  return `${pageHeader(
    'Review Manuscript',
    'Review research selected by the student and decide whether it should proceed to final administrator approval.',
    `<button class="btn btn-secondary" id="download-current" data-file="${escapeHtml(thesis.currentFileId || '')}">${icon('download')} Download manuscript</button>`,
  )}
  <div class="detail-grid">
    <section class="panel">
      <div class="panel-header"><div><h2>${escapeHtml(thesis.title)}</h2>${statusBadge(thesis.status)}</div></div>
      <div class="panel-body">
        <div class="info-list">
          ${infoRow('Student', thesis.studentName)}
          ${infoRow('Authors', thesis.authors || thesis.studentName)}
          ${infoRow('Program', thesis.program)}
          ${infoRow('Selected Adviser', thesis.adviserName || profile.displayName)}
          ${infoRow('Academic Year', thesis.academicYear)}
          ${infoRow('Version', String(thesis.version || 1))}
          ${infoRow('Submitted', formatDateTime(thesis.submittedAt))}
        </div>
        <div class="content-section"><h3>Abstract</h3><p class="long-copy">${escapeHtml(thesis.abstract || '—')}</p></div>
        <div class="content-section"><h3>Keywords</h3><p>${escapeHtml(thesis.keywords || '—')}</p></div>
      </div>
    </section>
    <aside class="panel">
      <div class="panel-header"><h2>Review decision</h2></div>
      <div class="panel-body">${decisionPanel}</div>
    </aside>
  </div>

  <section class="panel">
    <div class="panel-header"><h2>Review history</h2></div>
    <div class="panel-body timeline">
      ${reviews.length ? reviews.map((review) => `<article class="timeline-item"><div class="timeline-dot"></div><div><div class="timeline-head"><strong>${escapeHtml(review.adviserName)}</strong>${statusBadge(review.decision)}</div><p>${escapeHtml(review.comment)}</p><small>${formatDateTime(review.createdAt)}</small></div></article>`).join('') : emptyState('No previous review', 'Your submitted review decisions will appear here.')}
    </div>
  </section>`;
}

export function mount({ profile, params }) {
  document.getElementById('download-current')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { metadata, blob } = await reconstructFile(button.dataset.file);
      downloadBlob(blob, metadata.name || 'manuscript');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('review-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    setButtonLoading(button, true, 'Submitting decision...');
    try {
      const data = formDataObject(event.currentTarget);
      await submitReview(profile, params.id, data.decision, data.comment);
      toast(data.decision === 'adviser_approved'
        ? 'Research approved and forwarded to the administrator.'
        : 'Review decision submitted.', 'success');
      location.hash = `#/adviser/review/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
