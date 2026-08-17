import { getThesis, approveAndPublishThesis, archiveThesis } from '../../services/thesis.service.js';
import { getReviews } from '../../services/review.service.js';
import { reconstructFile } from '../../services/file.service.js';
import { downloadBlob } from '../../utils/file.js';
import { pageHeader, statusBadge, infoRow, emptyState } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';

export async function render({ params }) {
  const thesis = await getThesis(params.id);
  if (!thesis) return emptyState('Thesis not found', 'The requested thesis record does not exist.');

  const reviews = await getReviews(thesis.id);
  const awaitingAdmin = ['adviser_approved', 'recommended'].includes(thesis.status);

  let actions = `<button class="btn btn-secondary" id="download-current" data-file="${escapeHtml(thesis.currentFileId || '')}">${icon('download')} Download</button>`;
  if (awaitingAdmin) {
    actions += `<button class="btn btn-primary" id="approve-publish">${icon('check', 16)} Approve & Publish</button>`;
  }
  if (thesis.status !== 'archived') actions += '<button class="btn btn-danger" id="archive-thesis">Archive</button>';

  const finalReview = reviews.find((review) => ['adviser_approved', 'recommended'].includes(review.decision));

  return `${pageHeader(
    thesis.title,
    'Final administrator review. Adviser-approved research can be approved and published to the repository in one action.',
    actions,
  )}
  ${awaitingAdmin ? `<div class="notice-box success" style="margin-bottom:18px">
    <strong>Ready for final administrator approval</strong>
    <p>The selected adviser has approved this research. Review the manuscript and metadata, then use <strong>Approve & Publish</strong>. The record will immediately appear in the public SSU Research Repository.</p>
  </div>` : ''}
  <div class="detail-grid">
    <section class="panel">
      <div class="panel-header"><div><h2>Research record</h2>${statusBadge(thesis.status)}</div></div>
      <div class="panel-body">
        <div class="info-list">
          ${infoRow('Student', thesis.studentName)}
          ${infoRow('Authors', thesis.authors || thesis.studentName)}
          ${infoRow('Program', thesis.program)}
          ${infoRow('Student-selected Adviser', thesis.adviserName || '—')}
          ${infoRow('Academic Year', thesis.academicYear)}
          ${infoRow('Version', String(thesis.version || 1))}
          ${infoRow('Submitted', formatDateTime(thesis.submittedAt))}
          ${infoRow('Adviser Approved', thesis.adviserApprovedAt ? formatDateTime(thesis.adviserApprovedAt) : (finalReview ? formatDateTime(finalReview.createdAt) : '—'))}
          ${infoRow('Updated', formatDateTime(thesis.updatedAt))}
        </div>
        <div class="content-section"><h3>Abstract</h3><p class="long-copy">${escapeHtml(thesis.abstract || '—')}</p></div>
        <div class="content-section"><h3>Keywords</h3><p>${escapeHtml(thesis.keywords || '—')}</p></div>
      </div>
    </section>

    <aside class="panel">
      <div class="panel-header"><h2>Adviser review history</h2></div>
      <div class="panel-body timeline">
        ${reviews.length ? reviews.map((review) => `<article class="timeline-item"><div class="timeline-dot"></div><div><div class="timeline-head"><strong>${escapeHtml(review.adviserName)}</strong>${statusBadge(review.decision)}</div><p>${escapeHtml(review.comment)}</p><small>${formatDateTime(review.createdAt)}</small></div></article>`).join('') : emptyState('No review yet', 'The selected adviser must review this thesis before final administrator approval.')}
      </div>
    </aside>
  </div>`;
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

  document.getElementById('approve-publish')?.addEventListener('click', async () => {
    const confirmed = window.confirm('Approve this adviser-reviewed research and publish it to the SSU Research Repository?');
    if (!confirmed) return;
    try {
      await approveAndPublishThesis(profile.uid, params.id);
      toast('Research approved and published successfully.', 'success');
      location.hash = `#/admin/thesis/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  document.getElementById('archive-thesis')?.addEventListener('click', async () => {
    const confirmed = window.confirm('Archive this thesis record?');
    if (!confirmed) return;
    try {
      await archiveThesis(profile.uid, params.id);
      toast('Thesis archived.', 'success');
      location.hash = `#/admin/thesis/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}
