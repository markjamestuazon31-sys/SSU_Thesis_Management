import { getAllTheses } from '../../services/thesis.service.js';
import { pageHeader, thesisTable, emptyState } from '../../components/ui.js';
import { icon } from '../../components/icons.js';
import '../../styles/admin-thesis-review-v74.css';

const REVIEW_STATUSES = new Set(['adviser_approved', 'recommended']);

export async function render() {
  const allRows = await getAllTheses();
  const rows = allRows
    .filter((thesis) => REVIEW_STATUSES.has(thesis.status))
    .sort((a, b) => (b.updatedAt || b.adviserApprovedAt || 0) - (a.updatedAt || a.adviserApprovedAt || 0));

  return `
    ${pageHeader(
      'Thesis Review',
      'Final administrator review for research already approved by the selected thesis adviser.'
    )}

    <section class="admin-review-summary">
      <article class="admin-review-summary-card">
        <span class="admin-review-summary-icon">${icon('review', 20)}</span>
        <div>
          <span>Awaiting Admin Review</span>
          <strong>${rows.length}</strong>
        </div>
      </article>

      <div class="admin-review-flow">
        <span>${icon('upload', 14)} Student Submission</span>
        <i>→</i>
        <span>${icon('check', 14)} Adviser Approval</span>
        <i>→</i>
        <strong>${icon('review', 14)} Admin Review</strong>
        <i>→</i>
        <span>${icon('repository', 14)} Publication</span>
      </div>
    </section>

    <section class="panel admin-thesis-review-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Final Approval Queue</p>
          <h2>Research awaiting administrator decision</h2>
          <p>Open a thesis to review its metadata, manuscript, adviser decision, and comments before final approval and publication.</p>
        </div>
      </div>

      <div class="panel-body no-pad">
        ${rows.length
          ? thesisTable(rows, {
              showOwner: true,
              showAdviser: true,
              actionLabel: 'Review',
              actionRoute: (id) => `/admin/thesis/${id}`,
            })
          : emptyState(
              'No thesis is awaiting final review',
              'Research will appear here after an adviser approves and forwards it to the administrator.'
            )
        }
      </div>
    </section>`;
}

export function mount() {}
