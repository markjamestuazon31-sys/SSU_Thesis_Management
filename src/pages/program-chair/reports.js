import { getProgramChairTheses } from '../../services/thesis.service.js';
import { pageHeader, statCard, emptyState } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { getProgramChairVisibleRows, groupCounts, isArchived, isAwaitingAdmin, isPublished, statusLabel } from './program-chair.helpers.js';
import '../../styles/program-chair-v84.css';

let rows = [];

function barRows(items, total, labelFormatter = (value) => value) {
  if (!items.length) return '<p class="pc-report-empty">No data is available for this section.</p>';
  const max = Math.max(1, ...items.map(([, value]) => value));
  return `<div class="pc-report-bars">${items.map(([label, value]) => `<div class="pc-report-bar-row"><div class="pc-report-bar-label"><strong>${escapeHtml(labelFormatter(label))}</strong><span>${value}</span></div><div class="pc-report-track"><i style="width:${Math.max(8, (value / max) * 100)}%"></i></div><small>${total ? Math.round((value / total) * 100) : 0}% of routed records</small></div>`).join('')}</div>`;
}

function instructorRows(items) {
  if (!items.length) return '<p class="pc-report-empty">No Research Instructor assignments are available.</p>';
  return `<div class="table-wrap"><table class="data-table pc-report-table"><thead><tr><th>Research Instructor</th><th>Routed Research</th><th>Awaiting Admin</th><th>Published</th></tr></thead><tbody>${items.map(([name, instructorRowsValue]) => `<tr><td><strong>${escapeHtml(name)}</strong></td><td>${instructorRowsValue.length}</td><td>${instructorRowsValue.filter(isAwaitingAdmin).length}</td><td>${instructorRowsValue.filter(isPublished).length}</td></tr>`).join('')}</tbody></table></div>`;
}

function instructorGroups(source) {
  const map = new Map();
  source.forEach((item) => {
    const name = item.researchInstructorName || item.adviserName || 'Unassigned Research Instructor';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(item);
  });
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

export async function render({ profile }) {
  if (!profile.program) {
    return `${pageHeader('Program Reports', 'View read-only research statistics for your assigned program.')}
      <section class="panel"><div class="panel-body">${emptyState('No program assigned', 'Ask the administrator to assign this Program Chair account to a CAS program.')}</div></section>`;
  }

  rows = getProgramChairVisibleRows(await getProgramChairTheses(profile.program));
  const awaitingAdmin = rows.filter(isAwaitingAdmin).length;
  const published = rows.filter(isPublished).length;
  const archived = rows.filter(isArchived).length;
  const years = groupCounts(rows, (item) => item.year || 'Not specified');
  const statuses = groupCounts(rows, (item) => item.status || 'Unknown');
  const instructors = instructorGroups(rows);

  return `<div class="pc-page">
    ${pageHeader(
      'Program Reports',
      `Read-only monitoring summary for Research Instructor-approved records routed to ${profile.program}.`,
      '<a class="btn btn-secondary" href="#/program-chair/research">Research Monitoring</a><a class="btn btn-primary" href="#/program-chair/progress">Research Progress</a>',
    )}

    <div class="stats-grid pc-stats-grid">
      ${statCard({ label: 'Routed Research', value: String(rows.length), iconName: 'file', helper: 'Program Chair monitoring scope' })}
      ${statCard({ label: 'Awaiting Admin', value: String(awaitingAdmin), iconName: 'clock', helper: 'Final review pending' })}
      ${statCard({ label: 'Published', value: String(published), iconName: 'repository', helper: 'Repository records' })}
      ${statCard({ label: 'Archived', value: String(archived), iconName: 'archive', helper: 'Retained historical records' })}
    </div>

    <div class="pc-report-grid">
      <section class="panel">
        <div class="panel-header"><div><p class="eyebrow">Workflow distribution</p><h2>Research by status</h2><p>Current status of all records routed to the Program Chair.</p></div></div>
        <div class="panel-body">${barRows(statuses, rows.length, statusLabel)}</div>
      </section>
      <section class="panel">
        <div class="panel-header"><div><p class="eyebrow">Research years</p><h2>Research by year</h2><p>Distribution of routed research records by research year.</p></div></div>
        <div class="panel-body">${barRows(years, rows.length)}</div>
      </section>
    </div>

    <section class="panel pc-instructor-report-panel">
      <div class="panel-header pc-section-head"><div><p class="eyebrow">Program monitoring</p><h2>Research Instructor assignments</h2><p></p></div><span class="pc-result-pill">${instructors.length} instructor${instructors.length === 1 ? '' : 's'}</span></div>
      <div class="panel-body no-pad">${instructorRows(instructors)}</div>
    </section>
  </div>`;
}

export function mount() { return undefined; }
