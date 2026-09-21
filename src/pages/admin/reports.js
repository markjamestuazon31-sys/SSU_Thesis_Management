import { getReportData, summarizeTheses } from '../../services/report.service.js';
import { subscribeCollection } from '../../services/db.service.js';
import { statusBadge } from '../../components/ui.js';
import { toast } from '../../components/toast.js';
import { downloadText } from '../../utils/file.js';
import { csvEscape, titleCase } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';
import { APP_CONFIG, STATUS_LABELS } from '../../config/app.config.js';
import '../../styles/admin-reports-v81.css';

const EMPTY_FILTERS = Object.freeze({
  search: '',
  program: '',
  year: '',
  academicYear: '',
  status: '',
});

let currentData = null;
let activeFilters = { ...EMPTY_FILTERS };
let visibleTheses = [];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

function uniqueValues(rows, getter, sorter = (a, b) => a.localeCompare(b)) {
  return [...new Set(rows.map(getter).filter(Boolean))].sort(sorter);
}

function optionList(values, labeler = (value) => value) {
  return values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`)
    .join('');
}

function statusLabel(status) {
  if (status === 'published') return 'Uploaded Thesis';
  return STATUS_LABELS[status] || titleCase(status || 'unspecified');
}

function filterTheses(rows, filters) {
  return rows.filter((thesis) => {
    const searchable = normalize([
      thesis.title,
      thesis.studentName,
      thesis.ownerName,
      thesis.authors,
      thesis.program,
      thesis.researchInstructorName || thesis.adviserName,
      thesis.keywords,
      thesis.year,
      thesis.academicYear,
      statusLabel(thesis.status),
    ].join(' '));

    if (filters.search && !searchable.includes(normalize(filters.search))) return false;
    if (filters.program && String(thesis.program || '') !== filters.program) return false;
    if (filters.year && String(thesis.year || '') !== filters.year) return false;
    if (filters.academicYear && String(thesis.academicYear || '') !== filters.academicYear) return false;
    if (filters.status && String(thesis.status || '') !== filters.status) return false;
    return true;
  });
}

function renderReportFilters(theses) {
  const programs = uniqueValues(theses, (thesis) => String(thesis.program || ''));
  const years = uniqueValues(
    theses,
    (thesis) => thesis.year ? String(thesis.year) : '',
    (a, b) => Number(b) - Number(a),
  );
  const academicYears = uniqueValues(
    theses,
    (thesis) => String(thesis.academicYear || ''),
    (a, b) => b.localeCompare(a),
  );
  const availableStatuses = new Set(theses.map((thesis) => String(thesis.status || '')).filter(Boolean));
  const knownStatuses = Object.keys(STATUS_LABELS).filter((status) => availableStatuses.has(status));
  const unknownStatuses = [...availableStatuses]
    .filter((status) => !Object.hasOwn(STATUS_LABELS, status))
    .sort((a, b) => a.localeCompare(b));

  return `<section class="panel report-filter-panel">
    <div class="report-card-heading"><div><h2>Report filters</h2><p>Selections update the dashboard immediately.</p></div></div>
    <form class="report-filter-form" id="report-filter-form">
      <label class="field"><span>Course / Program</span><select id="report-program" name="program"><option value="">All courses</option>${optionList(programs)}</select></label>
      <label class="field"><span>Research year</span><select id="report-year" name="year"><option value="">All research years</option>${optionList(years)}</select></label>
      <label class="field"><span>Academic year</span><select id="report-academic-year" name="academicYear"><option value="">All academic years</option>${optionList(academicYears)}</select></label>
      <label class="field"><span>Status</span><select id="report-status" name="status"><option value="">All statuses</option>${optionList([...knownStatuses, ...unknownStatuses], statusLabel)}</select></label>
      <div class="report-filter-footer">
        <div class="report-filter-tags" data-report-filter-tags>${activeFilterTags(activeFilters)}</div>
        <button class="report-clear-link" type="button" data-clear-report-filters>Clear all</button>
      </div>
    </form>
  </section>`;
}

function activeFilterTags(filters) {
  const tags = [];
  if (filters.search) tags.push(`Search: ${filters.search}`);
  if (filters.program) tags.push(`Course: ${filters.program}`);
  if (filters.year) tags.push(`Research year: ${filters.year}`);
  if (filters.academicYear) tags.push(`Academic year: ${filters.academicYear}`);
  if (filters.status) tags.push(`Status: ${statusLabel(filters.status)}`);
  if (!tags.length) tags.push('All records');
  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
}

function filteredThesisTable(theses) {
  if (!theses.length) {
    return `<div class="empty-state report-empty-state">
      <div class="empty-icon">${icon('file', 30)}</div>
      <h3>No records match these filters</h3>
      <p>Choose another course or clear one of the active filters.</p>
    </div>`;
  }

  return `<div class="table-wrap report-preview-table-wrap">
    <table class="data-table report-preview-table">
      <thead><tr><th>Research title</th><th>Student / Researchers</th><th>Course / Program</th><th>Research year</th><th>Research Instructor</th><th>Status</th></tr></thead>
      <tbody>${theses.map((thesis) => `<tr>
        <td><div class="table-title">${escapeHtml(thesis.title || 'Untitled Thesis')}</div></td>
        <td><div>${escapeHtml(thesis.authors || thesis.studentName || thesis.ownerName || '—')}</div>${thesis.authors && thesis.studentName ? `<div class="table-subtitle">Submitted by ${escapeHtml(thesis.studentName)}</div>` : ''}</td>
        <td>${escapeHtml(thesis.program || 'Not specified')}</td>
        <td>${escapeHtml(thesis.year || '—')}</td>
        <td>${escapeHtml(thesis.researchInstructorName || thesis.adviserName || 'Unassigned')}</td>
        <td>${statusBadge(thesis.status || 'unspecified', statusLabel(thesis.status || 'unspecified'))}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function reportSummaryCards(theses) {
  const summary = summarizeTheses(theses);
  const cards = [
    { label: 'Records displayed', value: theses.length, iconName: 'file', tone: 'blue' },
    { label: 'Active review', value: summary.activeWorkflow, iconName: 'clock', tone: 'amber' },
    { label: 'Uploaded Thesis', value: summary.published, iconName: 'check', tone: 'green' },
    { label: 'Uploaded Thesis Rate', value: `${summary.publicationRate}%`, iconName: 'chart', tone: 'blue' },
  ];
  return cards.map((card) => `<article class="report-kpi-card report-kpi-card--${card.tone}"><div class="report-kpi-icon">${icon(card.iconName, 22)}</div><div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(String(card.value))}</strong></div></article>`).join('');
}

function courseChart(data, filters) {
  const chartRows = filterTheses(data.theses, { ...filters, program: '' });
  const programs = Object.entries(summarizeTheses(chartRows).programs).sort((a, b) => b[1] - a[1]);
  if (!programs.length) return `<div class="report-chart-empty">${icon('chart', 25)}<strong>No course data</strong><span>Clear another filter to display course totals.</span></div>`;
  const max = Math.max(...programs.map(([, value]) => value), 1);
  return `<div class="report-course-chart">${programs.map(([program, value]) => {
    const selected = filters.program === program;
    return `<button class="report-course-bar${selected ? ' is-selected' : ''}" type="button" data-report-program-jump="${escapeHtml(program)}" aria-pressed="${selected}">
      <span class="report-course-name">${escapeHtml(program)}</span>
      <span class="report-course-track"><i style="width:${Math.max(6, (value / max) * 100)}%"></i></span>
      <strong>${value}</strong>
    </button>`;
  }).join('')}</div>`;
}

function reportPageHeader() {
  return `<section class="report-page-header">
    <div><h1>Reports &amp; Analytics</h1><p>Monitor, filter, export, and print thesis records.</p><div class="report-live-status"><span class="report-live-dot"></span><strong>Live data</strong><span>· Updated just now</span></div></div>
    <div class="report-page-actions"><button class="btn btn-secondary" id="export-csv" type="button">${icon('download', 17)} Export CSV</button><button class="btn btn-primary" id="print-report" type="button">${icon('file', 17)} Print report</button></div>
  </section>`;
}

function reportWorkspace(data, theses, filters) {
  return `<div class="report-summary-grid" id="report-summary-grid">${reportSummaryCards(theses)}</div>
    <div class="report-main-grid">
      <section class="panel report-course-panel">
        <div class="report-card-heading"><div><h2>Thesis records by course</h2><p>Select a course to filter the dashboard.</p></div></div>
        <div class="report-course-chart-wrap" id="report-course-chart">${courseChart(data, filters)}</div>
      </section>
      ${renderReportFilters(data.theses)}
    </div>
    <section class="panel report-records-panel">
      <div class="report-table-heading"><div><h2>Thesis records <span id="report-table-count">${theses.length} record${theses.length === 1 ? '' : 's'}</span></h2><p>The table, CSV export, and print report use the same selected records.</p></div></div>
      <div class="report-table-toolbar">
        <label class="report-table-search">${icon('search', 17)}<input id="report-search" name="search" form="report-filter-form" type="search" placeholder="Search by title, student, researcher, or Research Instructor..." autocomplete="off"></label>
        <div class="report-table-tools"><div class="report-filter-tags" data-report-filter-tags>${activeFilterTags(filters)}</div><button class="report-clear-link" type="button" data-clear-report-filters>Clear all</button></div>
      </div>
      <div id="report-table-results">${filteredThesisTable(theses)}</div>
    </section>`;
}

function readFilters() {
  const value = (id) => String(document.getElementById(id)?.value || '').trim();
  return {
    search: value('report-search'),
    program: value('report-program'),
    year: value('report-year'),
    academicYear: value('report-academic-year'),
    status: value('report-status'),
  };
}

function updateReportView() {
  if (!currentData) return;
  visibleTheses = filterTheses(currentData.theses, activeFilters);
  const summary = document.getElementById('report-summary-grid');
  const chart = document.getElementById('report-course-chart');
  const table = document.getElementById('report-table-results');
  const count = document.getElementById('report-table-count');
  if (summary) summary.innerHTML = reportSummaryCards(visibleTheses);
  if (chart) chart.innerHTML = courseChart(currentData, activeFilters);
  if (table) table.innerHTML = filteredThesisTable(visibleTheses);
  if (count) count.textContent = `${visibleTheses.length} record${visibleTheses.length === 1 ? '' : 's'}`;
  document.querySelectorAll('[data-report-filter-tags]').forEach((element) => {
    element.innerHTML = activeFilterTags(activeFilters);
  });
  ['print-report', 'export-csv'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = visibleTheses.length === 0;
  });
}

function exportFilteredCsv() {
  if (!visibleTheses.length) {
    toast('No matching records are available to export.', 'error');
    return;
  }
  const header = ['No.', 'Research Title', 'Student / Researchers', 'Submitted By', 'Course / Program', 'Research Year', 'Academic Year', 'Research Instructor', 'Status'];
  const lines = [
    header.map(csvEscape).join(','),
    ...visibleTheses.map((thesis, index) => [
      index + 1,
      thesis.title,
      thesis.authors || thesis.studentName || thesis.ownerName,
      thesis.studentName || thesis.ownerName,
      thesis.program,
      thesis.year,
      thesis.academicYear,
      thesis.researchInstructorName || thesis.adviserName,
      statusLabel(thesis.status),
    ].map(csvEscape).join(',')),
  ];
  const suffix = [activeFilters.program || 'all-courses', activeFilters.year || 'all-years']
    .join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadText(lines.join('\n'), `ssu-thesis-report-${suffix}.csv`, 'text/csv;charset=utf-8');
}

function printFilterRows(filters) {
  const entries = [
    ['Course / Program', filters.program || 'All courses'],
    ['Research Year', filters.year || 'All research years'],
    ['Academic Year', filters.academicYear || 'All academic years'],
    ['Status', filters.status ? statusLabel(filters.status) : 'All statuses'],
  ];
  if (filters.search) entries.push(['Search', filters.search]);
  return entries.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function buildPrintDocument(theses, filters) {
  const summary = summarizeTheses(theses);
  const generatedAt = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric', month: 'long', day: '2-digit', hour: 'numeric', minute: '2-digit',
  }).format(new Date());

  return `<!doctype html><html><head><meta charset="utf-8"><title>Filtered Thesis Records Report</title><style>
    @page{size:A4 landscape;margin:10mm 9mm 13mm}
    *{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;color:#172534;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:9pt;line-height:1.45;background:#fff;text-rendering:optimizeLegibility}
    .head{text-align:center;border-bottom:2.5px solid #123e64;padding-bottom:9px;margin-bottom:9px}.head .institution{font-size:16pt;font-weight:800;color:#123e64;letter-spacing:.01em}.head .unit{font-size:10.5pt;margin-top:2px;color:#324b61}.head h1{font-size:18pt;letter-spacing:.025em;margin:9px 0 3px;text-transform:uppercase}.head p{margin:0;color:#52606d;font-size:9pt}
    .filters{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:9px 0}.filters div{border:1px solid #c8d4de;border-radius:5px;padding:6px 7px;background:#fbfcfd}.filters span{display:block;color:#5f6f7f;font-size:7.5pt;text-transform:uppercase;letter-spacing:.045em;margin-bottom:2px;font-weight:700}.filters strong{font-size:9pt;line-height:1.35}
    .summary{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:9px}.summary div{background:#eef4f8;border:1px solid #d4e0e9;border-radius:5px;padding:6px;text-align:center}.summary strong{display:block;font-size:15pt;line-height:1;color:#123e64}.summary span{display:block;margin-top:3px;font-size:7.5pt;font-weight:700;text-transform:uppercase;color:#526475}
    table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{background:#123e64!important;color:#fff;font-size:7.5pt;text-align:left;text-transform:uppercase;letter-spacing:.025em;padding:6px 5px;border:1px solid #123e64;line-height:1.3}td{vertical-align:top;padding:5.5px;border:1px solid #bdcad5;font-size:8.5pt;line-height:1.4;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f4f7f9!important}tr{break-inside:avoid;page-break-inside:avoid}.num{width:4%;text-align:center}.title{width:22%}.researcher{width:16%}.program{width:14%}.year{width:7%}.academic{width:8%}.adviser{width:14%}.status{width:11%}
    .footer{margin-top:8px;border-top:1px solid #c5d1db;padding-top:5px;display:flex;justify-content:space-between;color:#596b7b;font-size:8pt}
  </style></head><body>
    <header class="head"><div class="institution">${escapeHtml(APP_CONFIG.institution)}</div><div class="unit">${escapeHtml(APP_CONFIG.unit)}</div><h1>Filtered Thesis Records Report</h1><p>${escapeHtml(APP_CONFIG.name)} · Generated ${escapeHtml(generatedAt)}</p></header>
    <section class="filters">${printFilterRows(filters)}</section>
    <section class="summary">
      <div><strong>${theses.length}</strong><span>Total Records</span></div>
      <div><strong>${summary.activeWorkflow}</strong><span>Active Workflow</span></div>
      <div><strong>${summary.approved}</strong><span>Admin Approved</span></div>
      <div><strong>${summary.published}</strong><span>Uploaded Thesis</span></div>
      <div><strong>${summary.rejected}</strong><span>Rejected</span></div>
      <div><strong>${summary.publicationRate}%</strong><span>Uploaded Thesis Rate</span></div>
    </section>
    <table><thead><tr><th class="num">No.</th><th class="title">Research Title</th><th class="researcher">Student / Researchers</th><th class="program">Course / Program</th><th class="year">Research Year</th><th class="academic">Academic Year</th><th class="adviser">Research Instructor</th><th class="status">Status</th></tr></thead><tbody>
      ${theses.map((thesis, index) => `<tr><td class="num">${index + 1}</td><td>${escapeHtml(thesis.title || 'Untitled Thesis')}</td><td>${escapeHtml(thesis.authors || thesis.studentName || thesis.ownerName || '—')}</td><td>${escapeHtml(thesis.program || 'Not specified')}</td><td>${escapeHtml(thesis.year || '—')}</td><td>${escapeHtml(thesis.academicYear || '—')}</td><td>${escapeHtml(thesis.researchInstructorName || thesis.adviserName || 'Unassigned')}</td><td>${escapeHtml(statusLabel(thesis.status))}</td></tr>`).join('')}
    </tbody></table>
    <footer class="footer"><span>Generated by ${escapeHtml(APP_CONFIG.shortName)}</span><span>${theses.length} matching record${theses.length === 1 ? '' : 's'}</span></footer>
  </body></html>`;
}

function printFilteredReport() {
  if (!visibleTheses.length) {
    toast('No matching records are available to print.', 'error');
    return;
  }
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    toast('The print preview was blocked. Allow pop-ups for this website and try again.', 'error', 5000);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(visibleTheses, activeFilters));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

export async function render() {
  currentData = await getReportData();
  activeFilters = { ...EMPTY_FILTERS };
  visibleTheses = [...currentData.theses];
  return `${reportPageHeader()}${reportWorkspace(currentData, visibleTheses, activeFilters)}`;
}

export function mount() {
  const form = document.getElementById('report-filter-form');
  const clearButtons = [...document.querySelectorAll('[data-clear-report-filters]')];
  const exportButton = document.getElementById('export-csv');
  const printButton = document.getElementById('print-report');
  const programInput = document.getElementById('report-program');
  const searchInput = document.getElementById('report-search');
  const courseChartElement = document.getElementById('report-course-chart');

  const applyCurrentFilters = () => {
    activeFilters = readFilters();
    updateReportView();
  };

  const applyFilters = (event) => {
    event.preventDefault();
    applyCurrentFilters();
  };
  const selectCourse = (program) => {
    if (!programInput) return;
    programInput.value = program;
    applyCurrentFilters();
  };
  const handleFilterChange = (event) => {
    if (event.target.matches('select')) applyCurrentFilters();
  };
  let searchTimer = null;
  const handleSearch = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyCurrentFilters, 180);
  };
  const handleAnalyticsCourse = (event) => {
    const button = event.target.closest('[data-report-program-jump]');
    if (!button) return;
    selectCourse(String(button.dataset.reportProgramJump || ''));
  };
  const clearFilters = () => {
    form?.reset();
    if (searchInput) searchInput.value = '';
    activeFilters = { ...EMPTY_FILTERS };
    updateReportView();
  };

  form?.addEventListener('submit', applyFilters);
  form?.addEventListener('change', handleFilterChange);
  searchInput?.addEventListener('input', handleSearch);
  courseChartElement?.addEventListener('click', handleAnalyticsCourse);
  clearButtons.forEach((button) => button.addEventListener('click', clearFilters));
  exportButton?.addEventListener('click', exportFilteredCsv);
  printButton?.addEventListener('click', printFilteredReport);

  let timer = null;
  let disposed = false;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (disposed) return;
      try {
        currentData = await getReportData();
        updateReportView();
      } catch (error) {
        console.error('Unable to refresh live reports:', error);
      }
    }, 120);
  };

  const unsubscribers = [
    subscribeCollection('theses', refresh),
    subscribeCollection('users', refresh),
    subscribeCollection('publishedTheses', refresh),
  ];

  return () => {
    disposed = true;
    clearTimeout(timer);
    clearTimeout(searchTimer);
    form?.removeEventListener('submit', applyFilters);
    form?.removeEventListener('change', handleFilterChange);
    searchInput?.removeEventListener('input', handleSearch);
    courseChartElement?.removeEventListener('click', handleAnalyticsCourse);
    clearButtons.forEach((button) => button.removeEventListener('click', clearFilters));
    exportButton?.removeEventListener('click', exportFilteredCsv);
    printButton?.removeEventListener('click', printFilteredReport);
    unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  };
}
