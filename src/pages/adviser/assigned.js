import { getAssignedTheses } from '../../services/thesis.service.js';
import { pageHeader, statCard, thesisTable } from '../../components/ui.js';
import {
  bindThesisFilters,
  filterTheses,
  renderThesisFilters,
  sortForAdviserReview,
  updateThesisFilterCount,
} from '../../utils/thesis-filter.js';
import '../../styles/research-record-filters-v77.css';

const FILTER_PREFIX = 'adviser-research';
let assignedRows = [];

const needsReview = (item) => ['submitted', 'under_review'].includes(item.status);
const completedReview = (item) => ['instructor_approved', 'adviser_approved', 'recommended', 'approved', 'published', 'rejected'].includes(item.status);

function assignedTable(rows) {
  return thesisTable(rows, {
    showOwner: true,
    showProgram: true,
    showYear: true,
    actionLabel: (item) => needsReview(item) ? 'Review now' : 'Open record',
    actionRoute: (id) => `/research-instructor/review/${id}`,
  });
}

export async function render({ profile }) {
  assignedRows = sortForAdviserReview(await getAssignedTheses(profile.uid));
  const stats = [
    statCard({ label: 'Assigned Research', value: String(assignedRows.length), iconName: 'file', helper: 'All selected submissions' }),
    statCard({ label: 'Needs My Review', value: String(assignedRows.filter(needsReview).length), iconName: 'review', helper: 'Prioritized first' }),
    statCard({ label: 'Revision Pending', value: String(assignedRows.filter((item) => item.status === 'revision_required').length), iconName: 'clock', helper: 'Waiting for student' }),
    statCard({ label: 'Reviews Completed', value: String(assignedRows.filter(completedReview).length), iconName: 'check', helper: 'Decisions recorded' }),
  ];

  return `${pageHeader('Research Submitted to Me', 'Review and monitor manuscripts from students assigned to you as their Research Instructor.')}
  <div class="stats-grid adviser-workspace-stats">${stats.join('')}</div>
  ${renderThesisFilters(assignedRows, {
    prefix: FILTER_PREFIX,
    includePriority: true,
    heading: 'Find assigned student research',
    description: 'Filter by student, course, research year, exact status, or the action currently required from you.',
  })}
  <section class="panel research-monitor-panel">
    <div class="panel-header">
      <div><p class="eyebrow">Research Instructor review workspace</p><h2>Assigned submissions</h2><p>Items that need an Research Instructor decision are automatically listed first.</p></div>
      <span class="research-monitor-meta" id="adviser-visible-label">${assignedRows.length} visible</span>
    </div>
    <div class="panel-body no-pad" id="adviser-research-table">${assignedTable(assignedRows)}</div>
  </section>`;
}

export function mount() {
  return bindThesisFilters(FILTER_PREFIX, (filters) => {
    const filtered = filterTheses(assignedRows, filters);
    const table = document.getElementById('adviser-research-table');
    if (table) table.innerHTML = assignedTable(filtered);
    updateThesisFilterCount(FILTER_PREFIX, filtered.length);
    const label = document.getElementById('adviser-visible-label');
    if (label) label.textContent = `${filtered.length} visible`;
  });
}
