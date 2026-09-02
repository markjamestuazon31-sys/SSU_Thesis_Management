import { getAllTheses } from '../../services/thesis.service.js';
import { pageHeader, thesisTable, emptyState, statCard } from '../../components/ui.js';
import { icon } from '../../components/icons.js';
import { downloadText } from '../../utils/file.js';
import { csvEscape } from '../../utils/format.js';
import {
  bindThesisFilters,
  filterTheses,
  renderThesisFilters,
  updateThesisFilterCount,
} from '../../utils/thesis-filter.js';
import '../../styles/admin-thesis-review-v74.css';
import '../../styles/research-record-filters-v77.css';

const REVIEW_STATUSES = new Set(['adviser_approved', 'recommended']);
const FILTER_PREFIX = 'admin-submissions';
let allSubmissionRows = [];
let visibleSubmissionRows = [];

function submissionTable(rows) {
  return thesisTable(rows, {
    showOwner: true,
    showProgram: true,
    showYear: true,
    showAdviser: true,
    actionLabel: 'View record',
    actionRoute: (id) => `/admin/thesis/${id}`,
  });
}

function exportFilteredSubmissions() {
  const header = ['Title', 'Student / Researchers', 'Submitted By', 'Course / Program', 'Research Year', 'Academic Year', 'Adviser', 'Status'];
  const lines = [
    header.map(csvEscape).join(','),
    ...visibleSubmissionRows.map((thesis) => [thesis.title, thesis.authors || thesis.studentName, thesis.studentName, thesis.program, thesis.year, thesis.academicYear, thesis.adviserName, thesis.status].map(csvEscape).join(',')),
  ];
  downloadText(lines.join('\n'), 'ssu-filtered-submissions.csv', 'text/csv;charset=utf-8');
}

export async function render() {
  allSubmissionRows = await getAllTheses();
  visibleSubmissionRows = [...allSubmissionRows];
  const reviewRows = allSubmissionRows
    .filter((thesis) => REVIEW_STATUSES.has(thesis.status))
    .sort((a, b) => (b.updatedAt || b.adviserApprovedAt || 0) - (a.updatedAt || a.adviserApprovedAt || 0));
  const inAdviserReview = allSubmissionRows.filter((item) => ['submitted', 'under_review'].includes(item.status)).length;
  const published = allSubmissionRows.filter((item) => item.status === 'published').length;
  const stats = [
    statCard({ label: 'All Submissions', value: String(allSubmissionRows.length), iconName: 'file', helper: 'Across all courses' }),
    statCard({ label: 'With Advisers', value: String(inAdviserReview), iconName: 'review', helper: 'Currently under review' }),
    statCard({ label: 'Awaiting Admin', value: String(reviewRows.length), iconName: 'check', helper: 'Ready for final decision' }),
    statCard({ label: 'Published', value: String(published), iconName: 'repository', helper: 'Available in repository' }),
  ];

  return `${pageHeader(
    'Thesis Review',
    'Final approval queue and complete administrator monitoring of student research submissions.',
    '<button class="btn btn-secondary" id="admin-export-filtered" type="button">Export filtered CSV</button>'
  )}
  <div class="stats-grid adviser-workspace-stats">${stats.join('')}</div>
  <section class="admin-review-summary">
    <article class="admin-review-summary-card"><span class="admin-review-summary-icon">${icon('review', 20)}</span><div><span>Awaiting Admin Review</span><strong>${reviewRows.length}</strong></div></article>
    <div class="admin-review-flow"><span>${icon('upload', 14)} Student Submission</span><i>→</i><span>${icon('check', 14)} Adviser Approval</span><i>→</i><strong>${icon('review', 14)} Admin Review</strong><i>→</i><span>${icon('repository', 14)} Publication</span></div>
  </section>
  <section class="panel admin-thesis-review-panel">
    <div class="panel-header"><div><p class="eyebrow">Final Approval Queue</p><h2>Research awaiting administrator decision</h2><p>Only adviser-approved research appears here for final verification and publication.</p></div></div>
    <div class="panel-body no-pad">${reviewRows.length ? thesisTable(reviewRows, { showOwner: true, showProgram: true, showYear: true, showAdviser: true, actionLabel: 'Final review', actionRoute: (id) => `/admin/thesis/${id}` }) : emptyState('No thesis is awaiting final review', 'Research will appear here after an adviser approves and forwards it to the administrator.')}</div>
  </section>
  ${renderThesisFilters(allSubmissionRows, {
    prefix: FILTER_PREFIX,
    includeAdviser: true,
    heading: 'Monitor all student submissions',
    description: 'See who submitted, their course, research year, selected adviser, and current workflow status.',
  })}
  <section class="panel research-monitor-panel">
    <div class="panel-header"><div><p class="eyebrow">Complete submission register</p><h2>All research records</h2><p>The table and CSV export follow the active filters above.</p></div><span class="research-monitor-meta" id="admin-visible-label">${allSubmissionRows.length} visible</span></div>
    <div class="panel-body no-pad" id="admin-submission-table">${submissionTable(allSubmissionRows)}</div>
  </section>`;
}

export function mount() {
  const cleanupFilters = bindThesisFilters(FILTER_PREFIX, (filters) => {
    visibleSubmissionRows = filterTheses(allSubmissionRows, filters);
    const table = document.getElementById('admin-submission-table');
    if (table) table.innerHTML = submissionTable(visibleSubmissionRows);
    updateThesisFilterCount(FILTER_PREFIX, visibleSubmissionRows.length);
    const label = document.getElementById('admin-visible-label');
    if (label) label.textContent = `${visibleSubmissionRows.length} visible`;
  });
  const exportButton = document.getElementById('admin-export-filtered');
  exportButton?.addEventListener('click', exportFilteredSubmissions);
  return () => {
    cleanupFilters?.();
    exportButton?.removeEventListener('click', exportFilteredSubmissions);
  };
}
