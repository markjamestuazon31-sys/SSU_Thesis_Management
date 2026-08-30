import { getAdviserReviewHistory } from '../../services/review.service.js';
import { getThesis } from '../../services/thesis.service.js';
import { pageHeader, statusBadge, emptyState } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/date.js';

export async function render({ profile }) {
  const rows = await getAdviserReviewHistory(profile.uid);
  for (const row of rows) {
    const thesis = await getThesis(row.thesisId).catch(() => null);
    row.title = thesis?.title || 'Thesis record';
    row.studentName = thesis?.studentName || '—';
  }

  return `${pageHeader('Review History', 'A chronological audit trail of final adviser decisions. Draft reviews are not shown here.')}
  <section class="panel"><div class="panel-body timeline">
    ${rows.length ? rows.map((row) => {
      const level = row.revisionLevel === 'major' ? 'Major revision' : row.revisionLevel === 'minor' ? 'Minor revision' : '';
      return `<article class="timeline-item"><div class="timeline-dot"></div><div>
        <div class="timeline-head"><strong>${escapeHtml(row.title)}</strong>${statusBadge(row.decision)}</div>
        <p>${escapeHtml(row.comment || 'No written feedback.')}</p>
        <small>${escapeHtml(row.studentName)} · Version ${escapeHtml(String(row.sourceVersion || '—'))}${level ? ` · ${escapeHtml(level)}` : ''} · ${formatDateTime(row.createdAt)}</small>
        <div><a class="text-link" href="#/adviser/review/${row.thesisId}">Open thesis record →</a></div>
      </div></article>`;
    }).join('') : emptyState('No review history', 'Final review decisions you submit will appear here.')}
  </div></section>`;
}

export function mount() {}
