import { getSubmissionHistory, getThesis } from '../../services/thesis.service.js';
import {
  discardReviewDraft,
  getReviewDraft,
  getReviews,
  saveReviewDraft,
  submitReview,
} from '../../services/review.service.js';
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

const MAX_FILE_MB = Math.round(APP_CONFIG.maxFileSizeBytes / (1024 * 1024));

async function metadataMap(fileIds) {
  const uniqueIds = [...new Set(fileIds.filter(Boolean))];
  const pairs = await Promise.all(uniqueIds.map(async (fileId) => {
    const metadata = await getFileMetadata(fileId).catch(() => null);
    return [fileId, metadata];
  }));
  return new Map(pairs);
}

function fileTypeLabel(metadata) {
  const name = String(metadata?.name || '');
  const extension = name.split('.').pop()?.toUpperCase();
  return extension || 'FILE';
}

function originalManuscriptCard(fileId, metadata, thesis) {
  const available = Boolean(fileId && metadata?.status === 'ready');
  return `<article class="review-file-card-v80 review-file-card-v80--primary">
    <div class="review-file-icon-v80">${icon('file', 24)}</div>
    <div class="review-file-copy-v80">
      <span class="review-kicker-v80">Student-submitted manuscript</span>
      <strong>${escapeHtml(metadata?.name || 'Manuscript file unavailable')}</strong>
      <div class="review-file-meta-v80">
        <span>Version ${escapeHtml(String(thesis.version || 1))}</span>
        <span>${escapeHtml(fileTypeLabel(metadata))}</span>
        <span>${metadata?.size ? escapeHtml(formatBytes(Number(metadata.size))) : 'Size unavailable'}</span>
        <span>${formatDateTime(thesis.submittedAt)}</span>
      </div>
      <p>The system downloads the exact file submitted by the student. It is not converted, cropped, compressed, or edited.</p>
    </div>
    <button class="btn btn-primary review-download-btn-v80" type="button" data-file-download="${escapeHtml(fileId || '')}" ${available ? '' : 'disabled'}>
      ${icon('download', 17)} Download Original
    </button>
  </article>`;
}

function reviewedAttachment(review, metadata) {
  if (!review?.reviewedFileId) return '';
  const available = metadata?.status === 'ready';
  return `<div class="review-attachment-v80">
    <div class="review-file-icon-v80 review-file-icon-v80--small">${icon('file', 20)}</div>
    <div>
      <span>Reviewed copy sent to student</span>
      <strong>${escapeHtml(metadata?.name || 'Reviewed manuscript')}</strong>
      <small>${metadata?.size ? `${escapeHtml(formatBytes(Number(metadata.size)))} · ` : ''}${escapeHtml(fileTypeLabel(metadata))}</small>
    </div>
    <button class="btn btn-secondary btn-sm" type="button" data-file-download="${escapeHtml(review.reviewedFileId)}" ${available ? '' : 'disabled'}>${icon('download', 15)} Download</button>
  </div>`;
}

function reviewHistory(reviews, files) {
  if (!reviews.length) return emptyState('No previous review', 'Your submitted review decisions will appear here.');
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
        ${reviewedAttachment(review, files.get(review.reviewedFileId))}
        <small>${formatDateTime(review.createdAt)}</small>
      </div>
    </article>`;
  }).join('');
}

function draftAttachment(draft, metadata) {
  if (!draft?.reviewedFileId) return '';
  return `<div class="review-draft-file-v80">
    <div class="review-file-icon-v80 review-file-icon-v80--small">${icon('file', 20)}</div>
    <div><span>Saved reviewed copy</span><strong>${escapeHtml(metadata?.name || 'Reviewed manuscript')}</strong><small>${metadata?.size ? escapeHtml(formatBytes(Number(metadata.size))) : 'Saved in Realtime Database'}</small></div>
    <button class="btn btn-secondary btn-sm" type="button" data-file-download="${escapeHtml(draft.reviewedFileId)}">${icon('download', 15)} Check file</button>
  </div>`;
}

function decisionPanel({ thesis, draft, draftMetadata }) {
  const draftDecision = draft?.decision && draft.decision !== 'undecided' ? draft.decision : '';
  const draftLevel = draft?.revisionLevel || '';
  const draftComment = draft?.comment || '';
  const revisionSelected = draftDecision === 'revision_required';

  return `<form id="review-form" class="review-form-v80">
    ${draft ? `<div class="review-draft-banner-v80">
      <div>${icon('clock', 20)}<div><strong>Review draft saved</strong><span>Your unfinished review was restored from ${formatDateTime(draft.updatedAt)}. Nothing has been sent to the student yet.</span></div></div>
      <button class="btn btn-ghost btn-sm" id="discard-review-draft" type="button">Discard draft</button>
    </div>` : ''}

    <section class="review-form-section-v80">
      <div class="review-section-heading-v80">
        <span>Step 3</span>
        <div><h3>Choose your review decision</h3><p>The student is notified only after you submit the final decision.</p></div>
      </div>
      <div class="review-decision-grid-v80" role="radiogroup" aria-label="Research Instructor review decision">
        <label class="review-decision-card-v80">
          <input type="radio" name="decision" value="instructor_approved" ${['instructor_approved', 'adviser_approved'].includes(draftDecision) ? 'checked' : ''} required>
          <span class="review-decision-icon-v80 review-decision-icon-v80--approve">${icon('check', 22)}</span>
          <span><strong>Approve Manuscript</strong><small>Route this version to Program Chair monitoring and the administrator for final approval.</small></span>
        </label>
        <label class="review-decision-card-v80">
          <input type="radio" name="decision" value="revision_required" ${revisionSelected ? 'checked' : ''} required>
          <span class="review-decision-icon-v80 review-decision-icon-v80--revision">${icon('edit', 22)}</span>
          <span><strong>Request Revision</strong><small>Return a reviewed PDF or DOCX with your comments or Track Changes.</small></span>
        </label>
      </div>
    </section>

    <section class="review-form-section-v80">
      <label class="field review-feedback-field-v80">
        <span>Research Instructor feedback / instructions</span>
        <textarea name="comment" rows="6" required placeholder="Give clear, academic, and actionable instructions to the student.">${escapeHtml(draftComment)}</textarea>
        <small>This message becomes part of the permanent review history.</small>
      </label>
    </section>

    <section class="review-revision-box-v80" id="revision-fields" data-has-reviewed-file="${draft?.reviewedFileId ? 'true' : 'false'}" ${revisionSelected ? '' : 'hidden'}>
      <div class="review-section-heading-v80">
        <span>Revision</span>
        <div><h3>Return the reviewed manuscript</h3><p>Upload the copy you reviewed in Microsoft Word, Adobe Acrobat, Edge, Foxit, or another document editor.</p></div>
      </div>

      <div class="review-level-grid-v80">
        <label><input type="radio" name="revisionLevel" value="minor" ${draftLevel === 'minor' ? 'checked' : ''}><span><strong>Minor Revision</strong><small>Small corrections that do not substantially change the study.</small></span></label>
        <label><input type="radio" name="revisionLevel" value="major" ${draftLevel === 'major' ? 'checked' : ''}><span><strong>Major Revision</strong><small>Substantial corrections to content, methods, analysis, or presentation.</small></span></label>
      </div>

      ${draftAttachment(draft, draftMetadata)}

      <label class="review-upload-box-v80" for="reviewed-file">
        <span class="review-upload-icon-v80">${icon('upload', 22)}</span>
        <span><strong>${draft?.reviewedFileId ? 'Replace reviewed manuscript' : 'Upload reviewed manuscript'}</strong><small>PDF or DOCX · Maximum ${MAX_FILE_MB} MB · Keep Word comments/Track Changes if used</small></span>
        <input id="reviewed-file" type="file" accept=".pdf,.docx">
      </label>
      <div class="review-selected-file-v80" id="review-selected-file" hidden></div>
      <div class="upload-progress review-upload-progress-v80" id="review-upload-progress" hidden>
        <div><span id="review-upload-label">Uploading reviewed manuscript</span><strong id="review-upload-percent">0%</strong></div>
        <div class="progress-track"><span id="review-upload-bar"></span></div>
      </div>
    </section>

    <div class="review-form-actions-v80">
      <div><span>You may save a draft and continue later without notifying the student.</span></div>
      <button class="btn btn-secondary" id="save-review-draft" type="button">${icon('clock', 16)} Save & Continue Later</button>
      <button class="btn btn-primary" type="submit">Submit Final Decision</button>
    </div>
  </form>`;
}

export async function render({ profile, params }) {
  const thesis = await getThesis(params.id);
  if (!thesis || (thesis.researchInstructorUid || thesis.adviserUid) !== profile.uid) {
    return emptyState('Thesis not available', 'This research was not submitted to your Research Instructor account.', '<a class="btn btn-secondary" href="#/research-instructor/assigned">Back</a>');
  }

  const [reviews, history, draft] = await Promise.all([
    getReviews(thesis.id),
    getSubmissionHistory(thesis.id),
    getReviewDraft(thesis.id, profile.uid),
  ]);

  let currentFileId = String(thesis.currentFileId || '').trim();
  let currentMetadata = currentFileId ? await getFileMetadata(currentFileId).catch(() => null) : null;
  if (!currentMetadata && history.length) {
    const fallback = history.find((item) => item.fileId);
    if (fallback?.fileId) {
      currentFileId = fallback.fileId;
      currentMetadata = await getFileMetadata(currentFileId).catch(() => null);
    }
  }

  const reviewFiles = await metadataMap([
    ...reviews.map((review) => review.reviewedFileId),
    draft?.reviewedFileId,
  ]);
  const reviewOpen = ['submitted', 'under_review'].includes(thesis.status);

  const waitingMessage = thesis.status === 'revision_required'
    ? ['Waiting for student revision', 'The student received your reviewed copy and feedback. A new Research Instructor review opens after the student submits the next version.']
    : ['Review cycle completed', ['instructor_approved', 'adviser_approved', 'recommended', 'published'].includes(thesis.status)
      ? 'This version has already been approved by the Research Instructor. Check the history below for the recorded decision.'
      : 'This thesis is not currently open for a new Research Instructor decision.'];

  return `${pageHeader(
    'Manuscript Review',
    'Download the student submission, review it in your preferred document editor, then return the reviewed copy and decision through this page.',
    '<a class="btn btn-secondary" href="#/research-instructor/assigned">Back to Assigned Research</a>',
  )}

  <div class="review-workspace-v80">
    <section class="review-overview-v80">
      <div class="review-record-heading-v80">
        <div><span class="review-kicker-v80">Research Instructor review workspace</span><h2>${escapeHtml(thesis.title)}</h2><p>${escapeHtml(thesis.studentName)} · ${escapeHtml(thesis.program || 'Program not specified')}</p></div>
        <div class="review-heading-status-v80">${statusBadge(thesis.status)}<span class="review-version-badge-v80">Version ${escapeHtml(String(thesis.version || 1))}</span></div>
      </div>
      <div class="review-info-grid-v80">
        ${infoRow('Student', thesis.studentName)}
        ${infoRow('Authors', thesis.authors || thesis.studentName)}
        ${infoRow('Program', thesis.program)}
        ${infoRow('Research Year', thesis.year)}
        ${infoRow('Academic Year', thesis.academicYear)}
        ${infoRow('Submitted', formatDateTime(thesis.submittedAt))}
      </div>
    </section>

    <section class="review-flow-v80" aria-label="Review workflow">
      <div class="review-flow-step-v80 is-active"><span>1</span><div><strong>Download</strong><small>Get the exact student file</small></div></div>
      <i></i>
      <div class="review-flow-step-v80"><span>2</span><div><strong>Review externally</strong><small>Word or PDF editor</small></div></div>
      <i></i>
      <div class="review-flow-step-v80"><span>3</span><div><strong>Return decision</strong><small>Upload reviewed copy if needed</small></div></div>
    </section>

    <section class="review-main-grid-v80">
      <div class="review-main-column-v80">
        <section class="panel review-panel-v80">
          <div class="panel-header"><div><p class="eyebrow">Step 1</p><h2>Student manuscript</h2><p>Always review the current submitted version shown below.</p></div></div>
          <div class="panel-body">
            ${originalManuscriptCard(currentFileId, currentMetadata, thesis)}
            <div class="review-external-note-v80">
              ${icon('shield', 19)}
              <div><strong>Review outside the website</strong><p>Open the downloaded file in Microsoft Word or your preferred PDF editor. Use comments, Track Changes, highlights, shapes, or other native review tools. The website keeps the student’s original upload unchanged.</p></div>
            </div>
          </div>
        </section>

        <section class="panel review-panel-v80">
          <div class="panel-header"><div><p class="eyebrow">Research context</p><h2>Abstract and keywords</h2></div></div>
          <div class="panel-body">
            <div class="content-section"><h3>Abstract</h3><p class="long-copy">${escapeHtml(thesis.abstract || '—')}</p></div>
            <div class="content-section"><h3>Keywords</h3><p>${escapeHtml(thesis.keywords || '—')}</p></div>
          </div>
        </section>
      </div>

      <aside class="panel review-decision-panel-v80">
        <div class="panel-header"><div><p class="eyebrow">Research Instructor action</p><h2>${reviewOpen ? 'Complete the review' : 'Current review status'}</h2></div></div>
        <div class="panel-body">
          ${reviewOpen
            ? decisionPanel({ thesis, draft, draftMetadata: reviewFiles.get(draft?.reviewedFileId) })
            : `<div class="review-waiting-v80">${icon(thesis.status === 'revision_required' ? 'clock' : 'check', 24)}<div><strong>${escapeHtml(waitingMessage[0])}</strong><p>${escapeHtml(waitingMessage[1])}</p></div></div>`}
        </div>
      </aside>
    </section>

    <section class="panel review-panel-v80">
      <div class="panel-header"><div><p class="eyebrow">Audit trail</p><h2>Review history</h2><p>Every final Research Instructor decision is preserved by student manuscript version.</p></div></div>
      <div class="panel-body timeline">${reviewHistory(reviews, reviewFiles)}</div>
    </section>
  </div>`;
}

export function mount({ profile, params }) {
  const cleanupDownloads = bindRealtimeFileDownloads();
  const form = document.getElementById('review-form');
  const decisionInputs = [...document.querySelectorAll('input[name="decision"]')];
  const revisionFields = document.getElementById('revision-fields');
  const reviewedFileInput = document.getElementById('reviewed-file');
  const revisionLevelInputs = [...document.querySelectorAll('input[name="revisionLevel"]')];
  const selectedFile = document.getElementById('review-selected-file');
  const saveDraftButton = document.getElementById('save-review-draft');
  const discardDraftButton = document.getElementById('discard-review-draft');
  const progressWrap = document.getElementById('review-upload-progress');
  const progressPercent = document.getElementById('review-upload-percent');
  const progressBar = document.getElementById('review-upload-bar');
  const progressLabel = document.getElementById('review-upload-label');

  const currentDecision = () => form?.querySelector('input[name="decision"]:checked')?.value || '';

  const toggleRevision = () => {
    if (!revisionFields) return;
    const requestingRevision = currentDecision() === 'revision_required';
    revisionFields.hidden = !requestingRevision;
    for (const input of revisionLevelInputs) input.required = requestingRevision;
    if (reviewedFileInput) {
      reviewedFileInput.required = requestingRevision && revisionFields.dataset.hasReviewedFile !== 'true';
    }
  };

  const showSelectedFile = () => {
    const file = reviewedFileInput?.files?.[0];
    if (!selectedFile) return;
    selectedFile.hidden = !file;
    if (file) {
      selectedFile.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${escapeHtml(formatBytes(file.size))} · ${escapeHtml(file.name.split('.').pop()?.toUpperCase() || 'FILE')}</span>`;
    }
  };

  const updateProgress = (progress) => {
    const value = Math.max(0, Math.min(100, Number(progress) || 0));
    if (progressWrap) progressWrap.hidden = false;
    if (progressPercent) progressPercent.textContent = `${value}%`;
    if (progressBar) progressBar.style.width = `${value}%`;
    if (progressLabel) progressLabel.textContent = value >= 100 ? 'Reviewed manuscript uploaded' : 'Uploading reviewed manuscript';
  };

  const resetProgress = () => {
    if (progressWrap) progressWrap.hidden = true;
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressBar) progressBar.style.width = '0%';
  };

  const saveDraft = async () => {
    if (!form || !saveDraftButton) return;
    const data = formDataObject(form);
    setButtonLoading(saveDraftButton, true, 'Saving draft...');
    resetProgress();
    try {
      await saveReviewDraft(profile, params.id, {
        decision: data.decision || 'undecided',
        comment: data.comment || '',
        revisionLevel: data.revisionLevel || '',
        reviewedFile: reviewedFileInput?.files?.[0] || null,
        onProgress: updateProgress,
      });
      toast('Review draft saved. The student was not notified.', 'success');
      location.hash = `#/research-instructor/review/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error?.message || 'Unable to save the review draft.', 'error');
    } finally {
      setButtonLoading(saveDraftButton, false);
    }
  };

  const discardDraft = async () => {
    const confirmed = window.confirm('Discard this saved review draft? Any reviewed manuscript attached only to the draft will also be removed.');
    if (!confirmed) return;
    if (discardDraftButton) discardDraftButton.disabled = true;
    try {
      await discardReviewDraft(profile, params.id);
      toast('Review draft discarded.', 'success');
      location.hash = `#/research-instructor/review/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error?.message || 'Unable to discard the review draft.', 'error');
    } finally {
      if (discardDraftButton) discardDraftButton.disabled = false;
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const data = formDataObject(event.currentTarget);
    setButtonLoading(button, true, 'Submitting decision...');
    resetProgress();

    try {
      await submitReview(profile, params.id, data.decision, data.comment, {
        revisionLevel: data.revisionLevel || '',
        reviewedFile: reviewedFileInput?.files?.[0] || null,
        onProgress: updateProgress,
      });
      toast(data.decision === 'instructor_approved'
        ? 'Manuscript approved. It is now visible to the Program Chair for monitoring and is awaiting final administrator approval.'
        : 'Revision request and reviewed manuscript sent to the student.', 'success');
      location.hash = `#/research-instructor/review/${params.id}?refresh=${Date.now()}`;
    } catch (error) {
      toast(error?.message || 'Unable to submit the Research Instructor decision.', 'error');
    } finally {
      setButtonLoading(button, false);
    }
  };

  for (const input of decisionInputs) input.addEventListener('change', toggleRevision);
  reviewedFileInput?.addEventListener('change', showSelectedFile);
  saveDraftButton?.addEventListener('click', saveDraft);
  discardDraftButton?.addEventListener('click', discardDraft);
  form?.addEventListener('submit', submit);
  toggleRevision();
  showSelectedFile();

  return () => {
    cleanupDownloads?.();
    for (const input of decisionInputs) input.removeEventListener('change', toggleRevision);
    reviewedFileInput?.removeEventListener('change', showSelectedFile);
    saveDraftButton?.removeEventListener('click', saveDraft);
    discardDraftButton?.removeEventListener('click', discardDraft);
    form?.removeEventListener('submit', submit);
  };
}
