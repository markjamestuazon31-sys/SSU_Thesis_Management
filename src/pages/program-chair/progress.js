import { getProgramChairTheses } from '../../services/thesis.service.js';
import { pageHeader, emptyState, statusBadge } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { icon } from '../../components/icons.js';
import { getProgramChairVisibleRows, progressStage } from './program-chair.helpers.js';
import '../../styles/program-chair-v84.css';

let rows = [];

const STAGES = [
  ['Submitted', 'Student submission received'],
  ['Instructor Review', 'Academic review completed'],
  ['Instructor Approved', 'Routed to Program Chair and Admin'],
  ['Admin Review', 'Final administrator review'],
  ['Published', 'Available in repository'],
];

function progressRow(thesis) {
  const current = progressStage(thesis);
  const archived = thesis.status === 'archived';
  return `<article class="pc-progress-record" data-search="${escapeHtml(`${thesis.title || ''} ${thesis.studentName || ''} ${thesis.authors || ''} ${thesis.researchInstructorName || thesis.adviserName || ''} ${thesis.year || ''}`.toLowerCase())}">
    <div class="pc-progress-record-head">
      <div><span class="pc-progress-year">${escapeHtml(thesis.year || '—')}</span><h3>${escapeHtml(thesis.title || 'Untitled Research')}</h3><p>${escapeHtml(thesis.authors || thesis.studentName || 'Researchers not specified')} · ${escapeHtml(thesis.researchInstructorName || thesis.adviserName || 'Research Instructor')}</p></div>
      <div class="pc-progress-head-actions">${statusBadge(thesis.status)}<a class="table-record-action" href="#/program-chair/research/${encodeURIComponent(thesis.id)}">${icon('eye', 15)}<span>View details</span></a></div>
    </div>
    <div class="pc-stage-track ${archived ? 'is-archived' : ''}">
      ${STAGES.map(([label, description], index) => {
        const step = index + 1;
        const state = step < current ? 'complete' : step === current ? 'current' : 'future';
        return `<div class="pc-stage-step ${state}"><span class="pc-stage-dot">${state === 'complete' ? icon('check', 13) : step}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></div></div>`;
      }).join('')}
    </div>
    <div class="pc-progress-record-foot"><span>Last updated ${formatDate(thesis.updatedAt || thesis.createdAt)}</span>${archived ? '<strong>Archived record</strong>' : ''}</div>
  </article>`;
}

function renderRows(items) {
  if (!items.length) return emptyState('No research progress found', 'Research routed to your program will appear here after Research Instructor approval.');
  return items.map(progressRow).join('');
}

export async function render({ profile }) {
  if (!profile.program) {
    return `${pageHeader('Research Progress', 'Track the progress of research routed to your assigned program.')}
      <section class="panel"><div class="panel-body">${emptyState('No program assigned', 'Ask the administrator to assign this Program Chair account to a CAS program.')}</div></section>`;
  }

  rows = getProgramChairVisibleRows(await getProgramChairTheses(profile.program));

  return `<div class="pc-page">
    ${pageHeader(
      'Research Progress',
      `Track each Research Instructor-approved record from routing through final administrator publication for ${profile.program}.`,
      '<a class="btn btn-secondary" href="#/program-chair/research">Research Monitoring</a><a class="btn btn-primary" href="#/program-chair/reports">Program Reports</a>',
    )}

    <section class="panel pc-progress-filter-panel">
      <div class="panel-header pc-section-head"><div><p class="eyebrow">Workflow tracking</p><h2>Program research progress</h2><p>.</p></div><span class="pc-result-pill" id="pc-progress-count">${rows.length} records</span></div>
      <div class="panel-body pc-progress-toolbar">
        <label class="field pc-progress-search"><span>Search</span><div class="pc-input-icon">${icon('search', 17)}<input id="pc-progress-search" type="search" placeholder="Title, researcher, instructor, year..." autocomplete="off"></div></label>
        <label class="field"><span>Status</span><select id="pc-progress-status"><option value="">All statuses</option><option value="awaiting_admin">Awaiting Admin</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <button class="btn btn-secondary" id="pc-progress-clear" type="button">Clear filters</button>
      </div>
    </section>

    <section class="pc-progress-list" id="pc-progress-list">${renderRows(rows)}</section>
  </div>`;
}

export function mount() {
  const search = document.getElementById('pc-progress-search');
  const status = document.getElementById('pc-progress-status');
  const clear = document.getElementById('pc-progress-clear');
  const list = document.getElementById('pc-progress-list');
  const count = document.getElementById('pc-progress-count');

  const apply = () => {
    const term = String(search?.value || '').trim().toLowerCase();
    const statusValue = String(status?.value || '');
    const filtered = rows.filter((item) => {
      const haystack = `${item.title || ''} ${item.studentName || ''} ${item.authors || ''} ${item.researchInstructorName || item.adviserName || ''} ${item.year || ''}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (statusValue === 'awaiting_admin' && !['instructor_approved', 'adviser_approved', 'recommended'].includes(item.status)) return false;
      if (statusValue === 'published' && item.status !== 'published') return false;
      if (statusValue === 'archived' && item.status !== 'archived') return false;
      return true;
    });
    if (list) list.innerHTML = renderRows(filtered);
    if (count) count.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
  };

  const clearFilters = () => {
    if (search) search.value = '';
    if (status) status.value = '';
    apply();
  };

  search?.addEventListener('input', apply);
  status?.addEventListener('change', apply);
  clear?.addEventListener('click', clearFilters);

  return () => {
    search?.removeEventListener('input', apply);
    status?.removeEventListener('change', apply);
    clear?.removeEventListener('click', clearFilters);
  };
}
