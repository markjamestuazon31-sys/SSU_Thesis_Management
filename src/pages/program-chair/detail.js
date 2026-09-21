import { getThesis } from '../../services/thesis.service.js';
import { getReviews } from '../../services/review.service.js';
import { getFileMetadata } from '../../services/file.service.js';
import { bindRealtimeFileDownloads } from '../../components/file-download.js';
import { pageHeader, statusBadge, infoRow, emptyState } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/date.js';
import { formatBytes } from '../../utils/format.js';
import { icon } from '../../components/icons.js';
import { isProgramChairRouted, progressStage } from './program-chair.helpers.js';
import '../../styles/adviser-review-external-v80.css';
import '../../styles/program-chair-v84.css';

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

function workflowTimeline(thesis) {
  const current = progressStage(thesis);
  const stages = [
    { label: 'Research Submitted', description: 'Student manuscript entered the Research Instructor workflow.', date: thesis.submittedAt || thesis.createdAt },
    { label: 'Research Instructor Review', description: 'Academic review and any revision cycle were completed.', date: null },
    { label: 'Research Instructor Approved', description: 'Record was routed to Program Chair monitoring and administrator final review.', date: thesis.researchInstructorApprovedAt || thesis.adviserApprovedAt || thesis.programChairMonitoringAt },
    { label: 'Admin Final Review', description: thesis.status === 'published' ? 'Administrator final approval completed.' : 'Administrator final approval is the next decision stage.', date: thesis.adminApprovedAt || thesis.approvedAt },
    { label: 'Published in Repository', description: thesis.status === 'published' ? 'Research is available in the institutional repository.' : 'Publication occurs after administrator approval.', date: thesis.publishedAt },
  ];

  return `<div class="pc-detail-timeline">${stages.map((stage, index) => {
    const step = index + 1;
    const state = step < current ? 'complete' : step === current ? 'current' : 'future';
    return `<div class="pc-detail-step ${state}">
      <span class="pc-detail-step-dot">${state === 'complete' ? icon('check', 13) : step}</span>
      <div><strong>${escapeHtml(stage.label)}</strong><p>${escapeHtml(stage.description)}</p>${stage.date ? `<small>${formatDateTime(stage.date)}</small>` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

export async function render({ profile, params }) {
  const thesis = await getThesis(params.id);
  if (!thesis || thesis.program !== profile.program || !isProgramChairRouted(thesis)) {
    return emptyState('Research record not available', 'This record has not been routed to your assigned program.');
  }

  const reviews = await getReviews(thesis.id);
  const files = await fileMap([thesis.currentFileId, ...reviews.map((review) => review.reviewedFileId)]);
  const currentFile = files.get(thesis.currentFileId);
  const instructorName = thesis.researchInstructorName || thesis.adviserName || 'Research Instructor';
  const currentFileReady = thesis.currentFileId && currentFile?.status === 'ready';

  const actions = `<a class="btn btn-secondary" href="#/program-chair/research">Back to Monitoring</a>
    ${thesis.status === 'published' ? `<a class="btn btn-secondary" href="#/repository/${encodeURIComponent(thesis.id)}">${icon('repository', 16)} Open Published Research</a>` : ''}
    <button class="btn btn-primary" type="button" data-file-download="${escapeHtml(thesis.currentFileId || '')}" ${currentFileReady ? '' : 'disabled'}>${icon('download', 16)} Download Manuscript</button>`;

  return `<div class="pc-page pc-detail-page">
    ${pageHeader(
      thesis.title,
      'Read-only Program Chair monitoring. Final approval, publication, archival, and workflow decisions remain with the administrator.',
      actions,
    )}

    <section class="pc-role-banner pc-role-banner-compact">
      <div class="pc-role-banner-icon">PC</div>
      <div><strong>No Program Chair approval action is required</strong><p>This research has already passed the Research Instructor approval stage. Use this page to monitor the record, review history, manuscript, and final administrator progress.</p></div>
      <div class="pc-role-banner-status">${statusBadge(thesis.status)}</div>
    </section>

    <div class="pc-detail-layout">
      <main class="pc-detail-main">
        <section class="panel">
          <div class="panel-header"><div><p class="eyebrow">Research record</p><h2>Research information</h2><p>Core information for this routed program research record.</p></div></div>
          <div class="panel-body">
            <div class="pc-info-grid">
              ${infoRow('Student', thesis.studentName)}
              ${infoRow('Researchers', thesis.authors || thesis.studentName)}
              ${infoRow('Course / Program', thesis.program)}
              ${infoRow('Research Year', thesis.year)}
              ${infoRow('Academic Year', thesis.academicYear)}
              ${infoRow('Research Instructor', instructorName)}
              ${infoRow('Program Chair', thesis.programChairName || profile.displayName || 'Program Chair')}
              ${infoRow('Manuscript Version', String(thesis.version || 1))}
            </div>
            <div class="content-section pc-copy-section"><h3>Abstract</h3><p class="long-copy">${escapeHtml(thesis.abstract || '—')}</p></div>
            <div class="content-section pc-copy-section"><h3>Keywords</h3><p>${escapeHtml(thesis.keywords || '—')}</p></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><div><p class="eyebrow">Academic review</p><h2>Research Instructor review history</h2><p>Read-only record of review decisions, comments, revisions, and returned reviewed copies.</p></div><span class="pc-result-pill">${reviews.length} review${reviews.length === 1 ? '' : 's'}</span></div>
          <div class="panel-body timeline pc-review-timeline">
            ${reviews.length ? reviews.map((review) => {
              const level = review.revisionLevel === 'major' ? 'Major Revision' : review.revisionLevel === 'minor' ? 'Minor Revision' : '';
              const reviewer = review.researchInstructorName || review.adviserName || instructorName;
              return `<article class="timeline-item review-history-item-v80"><div class="timeline-dot"></div><div>
                <div class="timeline-head"><div><strong>${escapeHtml(reviewer)}</strong><span class="review-version-v80">Version ${escapeHtml(String(review.sourceVersion || '—'))}</span></div>${statusBadge(review.decision)}</div>
                ${level ? `<span class="review-level-v80 review-level-v80--${escapeHtml(review.revisionLevel)}">${escapeHtml(level)}</span>` : ''}
                <p>${escapeHtml(review.comment || 'No written feedback.')}</p>
                ${reviewedAttachment(review, files.get(review.reviewedFileId))}
                <small>${formatDateTime(review.createdAt)}</small>
              </div></article>`;
            }).join('') : emptyState('No review history', 'No Research Instructor review record is available.')}
          </div>
        </section>
      </main>

      <aside class="pc-detail-aside">
        <section class="panel">
          <div class="panel-header"><div><p class="eyebrow">Workflow</p><h2>Research progress</h2><p>Progress from student submission to repository publication.</p></div></div>
          <div class="panel-body">${workflowTimeline(thesis)}</div>
        </section>

        <section class="panel">
          <div class="panel-header"><div><p class="eyebrow">Latest file</p><h2>Current manuscript</h2></div></div>
          <div class="panel-body">
            <div class="pc-manuscript-card">
              <span class="pc-manuscript-icon">${icon('file', 22)}</span>
              <div><strong>${escapeHtml(currentFile?.name || 'Current research manuscript')}</strong><span>Version ${escapeHtml(String(thesis.version || 1))}${currentFile?.size ? ` · ${escapeHtml(formatBytes(Number(currentFile.size)))}` : ''}</span></div>
            </div>
            <button class="btn btn-primary pc-full-button" type="button" data-file-download="${escapeHtml(thesis.currentFileId || '')}" ${currentFileReady ? '' : 'disabled'}>${icon('download', 16)} Download Manuscript</button>
            <div class="pc-file-note">Program Chair access is read-only. Downloading the manuscript does not change the research workflow.</div>
          </div>
        </section>
      </aside>
    </div>
  </div>`;
}

export function mount() {
  return bindRealtimeFileDownloads();
}
