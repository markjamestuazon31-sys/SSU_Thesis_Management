import { getThesis, approveAndPublishThesis, archiveThesis } from '../../services/thesis.service.js';
import { getReviews } from '../../services/review.service.js';
import { getFileMetadata } from '../../services/file.service.js';
import { bindRealtimeFileDownloads } from '../../components/file-download.js';
import { pageHeader, statusBadge, infoRow, emptyState } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/date.js';
import { formatBytes } from '../../utils/format.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';
import '../../styles/adviser-review-external-v80.css';

async function fileMap(fileIds) {
  const ids = [...new Set(fileIds.filter(Boolean))];
  return new Map(await Promise.all(ids.map(async (fileId) => [
    fileId,
    await getFileMetadata(fileId).catch(() => null),
  ])));
}

function reviewedAttachment(review, metadata) {
  if (!review?.reviewedFileId) return '';
  return `<div class="review-attachment-v80 admin-review-file-v80">
    <div class="review-file-icon-v80 review-file-icon-v80--small">${icon('file', 19)}</div>
    <div><span>Research Instructor reviewed copy</span><strong>${escapeHtml(metadata?.name || 'Reviewed manuscript')}</strong><small>${metadata?.size ? escapeHtml(formatBytes(Number(metadata.size))) : 'File attachment'}</small></div>
    <button class="btn btn-secondary btn-sm" type="button" data-file-download="${escapeHtml(review.reviewedFileId)}" ${metadata?.status === 'ready' ? '' : 'disabled'}>${icon('download', 15)} Download</button>
  </div>`;
}

export async function render({ params }) {
  const thesis = await getThesis(params.id);
  if (!thesis) return emptyState('Thesis not found', 'The requested thesis record does not exist.');

  const reviews = await getReviews(thesis.id);
  const files = await fileMap([thesis.currentFileId, ...reviews.map((review) => review.reviewedFileId)]);
  const currentFile = files.get(thesis.currentFileId);
  const awaitingAdmin = ['instructor_approved', 'adviser_approved', 'recommended'].includes(thesis.status);

  let actions = `<button class="btn btn-secondary" type="button" data-file-download="${escapeHtml(thesis.currentFileId || '')}" ${currentFile?.status === 'ready' ? '' : 'disabled'}>${icon('download')} Download Student Manuscript</button>`;
  if (awaitingAdmin) actions += `<button class="btn btn-primary" id="approve-publish">${icon('check', 16)} Approve & Upload Thesis</button>`;
  if (thesis.status !== 'archived') actions += '<button class="btn btn-danger" id="archive-thesis">Archive</button>';

  const finalReview = reviews.find((review) => ['instructor_approved', 'adviser_approved', 'recommended'].includes(review.decision));

  return `${pageHeader(
    thesis.title,
    'Final administrator review. The student manuscript and Research Instructor review history remain separate and traceable by version.',
    actions,
  )}
  ${awaitingAdmin ? `<div class="notice-box success" style="margin-bottom:18px">
    <strong>Ready for final administrator approval</strong>
    <p>The Research Instructor approved Version ${escapeHtml(String(finalReview?.sourceVersion || thesis.version || 1))}. Review the student manuscript and the Research Instructor decision below, then use <strong>Approve & Upload Thesis</strong>.</p>
  </div>` : ''}
  <div class="detail-grid">
    <section class="panel">
      <div class="panel-header"><div><h2>Research record</h2>${statusBadge(thesis.status, thesis.status === 'published' ? 'Uploaded Thesis' : '')}</div></div>
      <div class="panel-body">
        <div class="info-list">
          ${infoRow('Student', thesis.studentName)}
          ${infoRow('Authors', thesis.authors || thesis.studentName)}
          ${infoRow('Program', thesis.program)}
          ${infoRow('Research Year', thesis.year)}
          ${infoRow('Research Instructor', thesis.researchInstructorName || thesis.adviserName || '—')}
          ${infoRow('Program Chair', thesis.programChairName || 'Not assigned')}
          ${infoRow('Academic Year', thesis.academicYear)}
          ${infoRow('Version', String(thesis.version || 1))}
          ${infoRow('Submitted', formatDateTime(thesis.submittedAt))}
          ${infoRow('Research Instructor Approved', (thesis.researchInstructorApprovedAt || thesis.adviserApprovedAt) ? formatDateTime(thesis.researchInstructorApprovedAt || thesis.adviserApprovedAt) : (finalReview ? formatDateTime(finalReview.createdAt) : '—'))}
          ${infoRow('Updated', formatDateTime(thesis.updatedAt))}
        </div>
        <div class="content-section"><h3>Abstract</h3><p class="long-copy">${escapeHtml(thesis.abstract || '—')}</p></div>
        <div class="content-section"><h3>Keywords</h3><p>${escapeHtml(thesis.keywords || '—')}</p></div>
      </div>
    </section>

    <aside class="panel">
      <div class="panel-header"><div><h2>Research Instructor review history</h2><p>Reviewed copies are preserved separately from student submissions.</p></div></div>
      <div class="panel-body timeline">
        ${reviews.length ? reviews.map((review) => {
          const level = review.revisionLevel === 'major' ? 'Major Revision' : review.revisionLevel === 'minor' ? 'Minor Revision' : '';
          return `<article class="timeline-item review-history-item-v80"><div class="timeline-dot"></div><div>
            <div class="timeline-head"><div><strong>${escapeHtml(review.researchInstructorName || review.adviserName || 'Research Instructor')}</strong><span class="review-version-v80">Version ${escapeHtml(String(review.sourceVersion || '—'))}</span></div>${statusBadge(review.decision)}</div>
            ${level ? `<span class="review-level-v80 review-level-v80--${escapeHtml(review.revisionLevel)}">${escapeHtml(level)}</span>` : ''}
            <p>${escapeHtml(review.comment || 'No written feedback.')}</p>
            ${reviewedAttachment(review, files.get(review.reviewedFileId))}
            <small>${formatDateTime(review.createdAt)}</small>
          </div></article>`;
        }).join('') : emptyState('No review yet', 'The assigned Research Instructor must review this thesis before final administrator approval.')}
      </div>
    </aside>
  </div>`;
}

export function mount({ profile, params }) {
  const cleanupDownloads = bindRealtimeFileDownloads();

  const approve = async () => {
    const confirmed = window.confirm('Approve this Research Instructor-reviewed research and upload the thesis to the SSU Research Repository?');
    if (!confirmed) return;
    try {
      await approveAndPublishThesis(profile.uid, params.id);
      toast('Research approved and uploaded successfully.', 'success');
      location.hash = `#/admin/thesis/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error?.message || 'Unable to approve and upload this thesis.', 'error');
    }
  };

  const archive = async () => {
    const confirmed = window.confirm('Archive this thesis record?');
    if (!confirmed) return;
    try {
      await archiveThesis(profile.uid, params.id);
      toast('Thesis archived.', 'success');
      location.hash = `#/admin/thesis/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error?.message || 'Unable to archive this thesis.', 'error');
    }
  };

  document.getElementById('approve-publish')?.addEventListener('click', approve);
  document.getElementById('archive-thesis')?.addEventListener('click', archive);

  return () => {
    cleanupDownloads?.();
    document.getElementById('approve-publish')?.removeEventListener('click', approve);
    document.getElementById('archive-thesis')?.removeEventListener('click', archive);
  };
}
