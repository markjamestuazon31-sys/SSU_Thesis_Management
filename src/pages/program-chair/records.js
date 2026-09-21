import { getProgramChairTheses } from '../../services/thesis.service.js';
import { pageHeader, statCard, thesisTable, emptyState } from '../../components/ui.js';
import {
  bindThesisFilters,
  filterTheses,
  renderThesisFilters,
  updateThesisFilterCount,
} from '../../utils/thesis-filter.js';
import { getProgramChairVisibleRows, isArchived, isAwaitingAdmin, isPublished } from './program-chair.helpers.js';
import '../../styles/research-record-filters-v77.css';
import '../../styles/program-chair-v84.css';

const FILTER_PREFIX = 'program-chair-records';
let rows = [];

function recordsTable(items) {
  return thesisTable(items, {
    showOwner: true,
    showProgram: true,
    showYear: true,
    showResearchInstructor: true,
    actionLabel: 'View details',
    actionRoute: (id) => `/program-chair/research/${id}`,
  });
}

export async function render({ profile }) {
  if (!profile.program) {
    return `${pageHeader('Program Research Monitoring', 'Monitor research records routed to your assigned program.')}
      <section class="panel"><div class="panel-body">${emptyState('No program assigned', 'Ask the administrator to assign this Program Chair account to a CAS program.')}</div></section>`;
  }

  rows = getProgramChairVisibleRows(await getProgramChairTheses(profile.program));
  const awaitingAdmin = rows.filter(isAwaitingAdmin).length;
  const published = rows.filter(isPublished).length;
  const archived = rows.filter(isArchived).length;

  return `<div class="pc-page">
    ${pageHeader(
      'Program Research Monitoring',
      `Monitor Research Instructor-approved records for ${profile.program}. The Program Chair has read-only access and does not approve research.`,
      '<a class="btn btn-secondary" href="#/program-chair/progress">Research Progress</a><a class="btn btn-primary" href="#/program-chair/reports">Program Reports</a>',
    )}

    <div class="stats-grid pc-stats-grid">
      ${statCard({ label: 'Routed Research', value: String(rows.length), iconName: 'file', helper: 'Instructor-approved program records' })}
      ${statCard({ label: 'Awaiting Admin', value: String(awaitingAdmin), iconName: 'clock', helper: 'Final admin decision pending' })}
      ${statCard({ label: 'Published', value: String(published), iconName: 'repository', helper: 'Available in the repository' })}
      ${statCard({ label: 'Archived', value: String(archived), iconName: 'archive', helper: 'Program records retained' })}
    </div>

    <section class="pc-role-banner" aria-label="Program Chair role information">
      <div class="pc-role-banner-icon">PC</div>
      <div><strong>Program-level monitoring only</strong><p>Open records, review the Research Instructor history, view or download the manuscript, and track progress. Final approval and publication remain with the administrator.</p></div>
    </section>

    ${renderThesisFilters(rows, {
      prefix: FILTER_PREFIX,
      includeResearchInstructor: true,
      heading: 'Find program research',
      description: 'Search and filter the Research Instructor-approved records routed to your program.',
    })}

    <section class="panel pc-monitor-panel">
      <div class="panel-header pc-section-head">
        <div><p class="eyebrow">Program monitoring register</p><h2>Research routed to the Program Chair</h2><p>Records appear here automatically after Research Instructor approval.</p></div>
        <span class="pc-result-pill" id="program-chair-visible-label">${rows.length} visible</span>
      </div>
      <div class="panel-body no-pad" id="program-chair-record-table">${recordsTable(rows)}</div>
    </section>
  </div>`;
}

export function mount() {
  return bindThesisFilters(FILTER_PREFIX, (filters) => {
    const filtered = filterTheses(rows, filters);
    const table = document.getElementById('program-chair-record-table');
    if (table) table.innerHTML = recordsTable(filtered);
    updateThesisFilterCount(FILTER_PREFIX, filtered.length);
    const label = document.getElementById('program-chair-visible-label');
    if (label) label.textContent = `${filtered.length} visible`;
  });
}
