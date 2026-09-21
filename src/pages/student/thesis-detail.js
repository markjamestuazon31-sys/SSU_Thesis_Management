import { getThesis, getSubmissionHistory, resubmitThesis } from '../../services/thesis.service.js';
import { getReviews } from '../../services/review.service.js';
import { getFileMetadata } from '../../services/file.service.js';
import { bindRealtimeFileDownloads } from '../../components/file-download.js';
import { pageHeader, statusBadge, infoRow, emptyState } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/date.js';
import { formatBytes } from '../../utils/format.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';
import { APP_CONFIG } from '../../config/app.config.js';
import '../../styles/adviser-review-external-v80.css';

const maxFileSizeMb = Math.round(APP_CONFIG.maxFileSizeBytes / (1024 * 1024));

async function loadFileMap(fileIds) {
  const ids = [...new Set(fileIds.filter(Boolean))];
  return new Map(await Promise.all(ids.map(async (fileId) => [
    fileId,
    await getFileMetadata(fileId).catch(() => null),
  ])));
}

function typeLabel(metadata) {
  return String(metadata?.name || '').split('.').pop()?.toUpperCase() || 'FILE';
}

function reviewedFileMarkup(review, metadata, { compact = false } = {}) {
  if (!review?.reviewedFileId) return '';
  const available = metadata?.status === 'ready';
  return `<div class="review-attachment-v80 ${compact ? 'admin-review-file-v80' : ''}">
    <div class="review-file-icon-v80 review-file-icon-v80--small">${icon('file', 19)}</div>
    <div>
      <span>Research Instructor reviewed copy</span>
      <strong>${escapeHtml(metadata?.name || 'Reviewed manuscript')}</strong>
      <small>${metadata?.size ? `${escapeHtml(formatBytes(Number(metadata.size)))} · ` : ''}${escapeHtml(typeLabel(metadata))}</small>
    </div>
    <button class="btn btn-secondary btn-sm" type="button" data-file-download="${escapeHtml(review.reviewedFileId)}" ${available ? '' : 'disabled'}>${icon('download', 15)} Download</button>
  </div>`;
}

function reviewTimeline(reviews, files) {
  if (!reviews.length) return emptyState('No reviews yet', 'Research Instructor feedback will appear here after your manuscript is reviewed.');
  return reviews.map((review) => {
    const level = review.revisionLevel === 'major' ? 'Major Revision' : review.revisionLevel === 'minor' ? 'Minor Revision' : '';
    return `<article class="timeline-item review-history-item-v80">
      <div class="timeline-dot"></div>
      <div>
        <div class="timeline-head">
          <div><strong>${escapeHtml(review.researchInstructorName || review.adviserName || 'Research Instructor')}</strong><span class="review-version-v80">Version ${escapeHtml(String(review.sourceVersion || '—'))}</span></div>
          ${statusBadge(review.decision)}
        </div>
        ${level ? `<span class="review-level-v80 review-level-v80--${escapeHtml(review.revisionLevel)}">${escapeHtml(level)}</span>` : ''}
        <p>${escapeHtml(review.comment || 'No written feedback.')}</p>
        ${reviewedFileMarkup(review, files.get(review.reviewedFileId))}
        <small>${formatDateTime(review.createdAt)}</small>
      </div>
    </article>`;
  }).join('');
}

function submissionTimeline(history, files) {
  if (!history.length) return emptyState('No submission versions', 'Your submitted manuscript versions will appear here.');
  return history.map((item) => {
    const metadata = files.get(item.fileId);
    return `<article class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="submission-version-card-v80">
        <div>
          <strong>Version ${escapeHtml(String(item.version || '—'))}</strong>
          <p>${escapeHtml(item.note || 'No submission note.')}</p>
          <div class="submission-version-meta-v80">
            <span>${formatDateTime(item.submittedAt)}</span>
            ${metadata?.name ? `<span>${escapeHtml(metadata.name)}</span>` : ''}
            ${metadata?.size ? `<span>${escapeHtml(formatBytes(Number(metadata.size)))}</span>` : ''}
          </div>
        </div>
        ${item.fileId ? `<button class="btn btn-secondary btn-sm" type="button" data-file-download="${escapeHtml(item.fileId)}" ${metadata?.status === 'ready' ? '' : 'disabled'}>${icon('download', 15)} Download</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

export async function render({ profile, params }) {
  const thesis = await getThesis(params.id);
  if (!thesis || thesis.ownerUid !== profile.uid) {
    return emptyState('Thesis not found', 'The record does not exist or you do not have permission to view it.', '<a class="btn btn-secondary" href="#/student/theses">Back</a>');
  }

  const [reviews, history] = await Promise.all([
    getReviews(thesis.id),
    getSubmissionHistory(thesis.id),
  ]);
  const fileMap = await loadFileMap([
    thesis.currentFileId,
    ...history.map((item) => item.fileId),
    ...reviews.map((review) => review.reviewedFileId),
  ]);
  const currentMetadata = fileMap.get(thesis.currentFileId);
  const latestRevision = reviews.find((review) => review.decision === 'revision_required' && Number(review.sourceVersion || thesis.version) === Number(thesis.version || 1))
    || reviews.find((review) => review.decision === 'revision_required');
  const latestReviewedMetadata = fileMap.get(latestRevision?.reviewedFileId);

  return `${pageHeader(
    thesis.title,
    'Track every manuscript version, Research Instructor decision, reviewed copy, and revision submission in one record.',
    `<button class="btn btn-secondary" type="button" data-file-download="${escapeHtml(thesis.currentFileId || '')}" ${currentMetadata?.status === 'ready' ? '' : 'disabled'}>${icon('download')} Download Current Manuscript</button>`,
  )}

  ${thesis.status === 'revision_required' && latestRevision ? `<section class="student-revision-alert-v80">
    <div>
      ${icon('edit', 22)}
      <div>
        <strong>${latestRevision.revisionLevel === 'major' ? 'Major revision requested' : 'Revision requested'} for Version ${escapeHtml(String(latestRevision.sourceVersion || thesis.version || 1))}</strong>
        <p>Download the Research Instructor’s reviewed copy, apply the comments or Track Changes, then upload your corrected manuscript as the next version.</p>
      </div>
    </div>
    ${latestRevision.reviewedFileId ? `<button class="btn btn-primary" type="button" data-file-download="${escapeHtml(latestRevision.reviewedFileId)}" ${latestReviewedMetadata?.status === 'ready' ? '' : 'disabled'}>${icon('download', 16)} Download Reviewed Copy</button>` : ''}
  </section>` : ''}

  <div class="detail-grid">
    <section class="panel">
      <div class="panel-header"><div><h2>Thesis record</h2>${statusBadge(thesis.status)}</div></div>
      <div class="panel-body">
        <div class="info-list">
          ${infoRow('Authors', thesis.authors || thesis.studentName)}
          ${infoRow('Program', thesis.program)}
          ${infoRow('Research Year', thesis.year)}
          ${infoRow('Research Instructor', thesis.researchInstructorName || thesis.adviserName || 'Unassigned')}
          ${infoRow('Academic Year', thesis.academicYear)}
          ${infoRow('Current Version', String(thesis.version || 1))}
          ${infoRow('Last updated', formatDateTime(thesis.updatedAt))}
        </div>
        <div class="content-section"><h3>Abstract</h3><p class="long-copy">${escapeHtml(thesis.abstract || '—')}</p></div>
        <div class="content-section"><h3>Keywords</h3><p>${escapeHtml(thesis.keywords || '—')}</p></div>
      </div>
    </section>
    <aside class="panel">
      <div class="panel-header"><div><h2>Research Instructor feedback</h2><p>Reviewed manuscript files are attached to the exact version reviewed.</p></div></div>
      <div class="panel-body timeline">${reviewTimeline(reviews, fileMap)}</div>
    </aside>
  </div>

  ${thesis.status === 'revision_required' ? `<section class="panel form-panel">
    <div class="panel-header"><div><p class="eyebrow">Revision workflow</p><h2>Submit revised manuscript</h2><p>Do not overwrite the previous file. Your corrected manuscript will be stored as Version ${Number(thesis.version || 1) + 1}.</p></div></div>
    <div class="panel-body">
      <div class="student-review-guide-v80">
        <div><span>1</span><div><strong>Download reviewed copy</strong><small>Read the Research Instructor’s comments, Track Changes, or PDF annotations.</small></div></div>
        <div><span>2</span><div><strong>Apply corrections</strong><small>Edit your own working manuscript outside the website.</small></div></div>
        <div><span>3</span><div><strong>Upload next version</strong><small>The previous student and Research Instructor files remain in history.</small></div></div>
      </div>
      ${latestRevision ? reviewedFileMarkup(latestRevision, latestReviewedMetadata) : ''}
      <form id="resubmit-form" class="form-stack" style="margin-top:16px">
        <label class="field"><span>Revised PDF or DOCX</span><input id="revision-file" type="file" accept=".pdf,.docx" required><small>Maximum ${maxFileSizeMb} MB</small></label>
        <label class="field"><span>Revision note</span><textarea name="note" rows="3" required placeholder="Briefly explain the corrections you completed for the Research Instructor."></textarea></label>
        <div class="upload-progress" id="upload-progress" hidden><div><span>Uploading revision</span><strong id="upload-percent">0%</strong></div><div class="progress-track"><span id="progress-bar"></span></div></div>
        <button class="btn btn-primary" type="submit">Submit Version ${Number(thesis.version || 1) + 1}</button>
      </form>
    </div>
  </section>` : ''}

  <section class="panel">
    <div class="panel-header"><div><p class="eyebrow">Version audit trail</p><h2>Student submission history</h2><p>Every uploaded student manuscript remains linked to its version.</p></div></div>
    <div class="panel-body timeline">${submissionTimeline(history, fileMap)}</div>
  </section>`;
}

export function mount({ profile, params }) {
  const cleanupDownloads = bindRealtimeFileDownloads();
  const resubmitForm = document.getElementById('resubmit-form');

  const resubmit = async (event) => {
    event.preventDefault();
    const file = document.getElementById('revision-file')?.files?.[0];
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const wrap = document.getElementById('upload-progress');
    const percent = document.getElementById('upload-percent');
    const bar = document.getElementById('progress-bar');
    setButtonLoading(button, true, 'Uploading...');
    if (wrap) wrap.hidden = false;
    try {
      await resubmitThesis(profile, params.id, file, formDataObject(event.currentTarget).note, (progress) => {
        if (percent) percent.textContent = `${progress}%`;
        if (bar) bar.style.width = `${progress}%`;
      });
      toast('Revised manuscript submitted as a new version.', 'success');
      location.hash = `#/student/thesis/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error?.message || 'Unable to submit the revised manuscript.', 'error');
    } finally {
      setButtonLoading(button, false);
    }
  };

  resubmitForm?.addEventListener('submit', resubmit);
  return () => {
    cleanupDownloads?.();
    resubmitForm?.removeEventListener('submit', resubmit);
  };
}
