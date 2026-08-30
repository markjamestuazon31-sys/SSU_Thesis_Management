import { escapeHtml } from './dom.js';
import { titleCase } from './format.js';

const ADVISER_PRIORITY = Object.freeze({
  needs_review: new Set(['submitted', 'under_review']),
  revision_pending: new Set(['revision_required']),
  completed: new Set(['adviser_approved', 'recommended', 'approved', 'published', 'rejected', 'archived']),
});

const normalized = (value) => String(value ?? '').trim().toLowerCase();
const adviserToken = (row) => String(row.adviserUid || normalized(row.adviserName));

function uniqueValues(rows, getter, sorter = (a, b) => a.localeCompare(b)) {
  return [...new Set(rows.map(getter).filter(Boolean))].sort(sorter);
}

function optionList(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

function statusOptions(rows) {
  return uniqueValues(rows, (row) => String(row.status || ''))
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(titleCase(status))}</option>`)
    .join('');
}

function adviserOptions(rows) {
  const advisers = new Map();
  rows.forEach((row) => {
    const token = adviserToken(row);
    if (token) advisers.set(token, row.adviserName || 'Unassigned adviser');
  });
  return [...advisers.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join('');
}

export function renderThesisFilters(rows, {
  prefix,
  includeAdviser = false,
  includePriority = false,
  heading = 'Filter research records',
  description = 'Search and narrow records by course, research year, and workflow status.',
} = {}) {
  const programs = uniqueValues(rows, (row) => String(row.program || ''));
  const years = uniqueValues(rows, (row) => row.year ? String(row.year) : '', (a, b) => Number(b) - Number(a));

  return `<section class="panel research-filter-panel">
    <div class="panel-header research-filter-header">
      <div><p class="eyebrow">Record filters</p><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(description)}</p></div>
      <div class="research-filter-result"><strong id="${prefix}-count">${rows.length}</strong><span>record${rows.length === 1 ? '' : 's'} shown</span></div>
    </div>
    <div class="panel-body research-filter-grid ${includeAdviser || includePriority ? 'research-filter-grid-wide' : ''}">
      <label class="field research-filter-search"><span>Search</span><input id="${prefix}-search" type="search" placeholder="Title, student, researcher, keyword..." autocomplete="off"></label>
      <label class="field"><span>Course / Program</span><select id="${prefix}-program"><option value="">All courses</option>${optionList(programs)}</select></label>
      <label class="field"><span>Research Year</span><select id="${prefix}-year"><option value="">All years</option>${optionList(years)}</select></label>
      <label class="field"><span>Status</span><select id="${prefix}-status"><option value="">All statuses</option>${statusOptions(rows)}</select></label>
      ${includeAdviser ? `<label class="field"><span>Adviser</span><select id="${prefix}-adviser"><option value="">All advisers</option>${adviserOptions(rows)}</select></label>` : ''}
      ${includePriority ? `<label class="field"><span>Review Priority</span><select id="${prefix}-priority"><option value="">All assigned research</option><option value="needs_review">Needs my review</option><option value="revision_pending">Student revision pending</option><option value="completed">Review completed</option></select></label>` : ''}
      <button class="btn btn-secondary research-filter-clear" id="${prefix}-clear" type="button">Clear filters</button>
    </div>
  </section>`;
}

export function readThesisFilters(prefix) {
  const value = (suffix) => String(document.getElementById(`${prefix}-${suffix}`)?.value || '').trim();
  return {
    search: normalized(value('search')),
    program: value('program'),
    year: value('year'),
    status: value('status'),
    adviser: value('adviser'),
    priority: value('priority'),
  };
}

export function filterTheses(rows, filters = {}) {
  return rows.filter((row) => {
    const haystack = normalized([row.title, row.studentName, row.ownerName, row.authors, row.program, row.adviserName, row.keywords, row.academicYear, row.year, row.status].join(' '));
    if (filters.search && !haystack.includes(normalized(filters.search))) return false;
    if (filters.program && String(row.program || '') !== filters.program) return false;
    if (filters.year && String(row.year || '') !== filters.year) return false;
    if (filters.status && String(row.status || '') !== filters.status) return false;
    if (filters.adviser && adviserToken(row) !== filters.adviser) return false;
    if (filters.priority && !ADVISER_PRIORITY[filters.priority]?.has(row.status)) return false;
    return true;
  });
}

export function bindThesisFilters(prefix, onChange) {
  const controls = ['search', 'program', 'year', 'status', 'adviser', 'priority']
    .map((suffix) => document.getElementById(`${prefix}-${suffix}`)).filter(Boolean);
  const clear = document.getElementById(`${prefix}-clear`);
  const update = () => onChange(readThesisFilters(prefix));
  const eventName = (control) => control.type === 'search' ? 'input' : 'change';
  controls.forEach((control) => control.addEventListener(eventName(control), update));
  const clearFilters = () => {
    controls.forEach((control) => { control.value = ''; });
    update();
    document.getElementById(`${prefix}-search`)?.focus();
  };
  clear?.addEventListener('click', clearFilters);
  update();
  return () => {
    controls.forEach((control) => control.removeEventListener(eventName(control), update));
    clear?.removeEventListener('click', clearFilters);
  };
}

export function updateThesisFilterCount(prefix, count) {
  const node = document.getElementById(`${prefix}-count`);
  if (node) node.textContent = String(count);
}

export function sortForAdviserReview(rows) {
  const priority = (status) => ADVISER_PRIORITY.needs_review.has(status) ? 0 : ADVISER_PRIORITY.revision_pending.has(status) ? 1 : 2;
  return [...rows].sort((a, b) => priority(a.status) - priority(b.status) || (b.updatedAt || 0) - (a.updatedAt || 0));
}
