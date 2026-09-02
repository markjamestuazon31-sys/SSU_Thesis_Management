import { getAllTheses } from '../../services/thesis.service.js';
import { pageHeader, emptyState, statusBadge } from '../../components/ui.js';
import { icon } from '../../components/icons.js';
import { CAS_PROGRAMS } from '../../config/app.config.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import '../../styles/admin-thesis-review-v74.css';

const APPROVED_STATUSES = new Set(['approved', 'published']);

function approvedDate(item) {
  return item.adminApprovedAt || item.approvedAt || item.publishedAt || item.updatedAt || item.createdAt;
}

function table(rows) {
  if (!rows.length) {
    return emptyState(
      'No approved thesis records found',
      'Thesis records will appear here after the administrator gives final approval.'
    );
  }

  return `
    <div class="table-wrap">
      <table class="data-table approved-theses-table">
        <thead>
          <tr>
            <th>Research</th>
            <th>Student / Researchers</th>
            <th>Adviser</th>
            <th>Status</th>
            <th>Admin Approval</th>
            <th class="table-action-heading">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((item) => `
            <tr
              class="approved-thesis-row"
              data-search="${escapeHtml(`${item.title || ''} ${item.studentName || ''} ${item.authors || ''} ${item.program || ''} ${item.adviserName || ''}`.toLowerCase())}"
              data-program="${escapeHtml(String(item.program || '').toLowerCase())}"
            >
              <td>
                <div class="table-title">${escapeHtml(item.title || 'Untitled Thesis')}</div>
                <div class="table-subtitle">${escapeHtml(item.program || 'Program not specified')}</div>
              </td>
              <td>${escapeHtml(item.authors || item.studentName || item.ownerName || '—')}</td>
              <td>${escapeHtml(item.adviserName || '—')}</td>
              <td>${statusBadge(item.status)}</td>
              <td>${formatDate(approvedDate(item))}</td>
              <td class="table-action">
                <a class="table-record-action" href="#/admin/thesis/${item.id}">
                  ${icon('eye', 15)} <span>View record</span>
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

export async function render() {
  const rows = (await getAllTheses())
    .filter((item) => APPROVED_STATUSES.has(item.status))
    .sort((a, b) => approvedDate(b) - approvedDate(a));

  const published = rows.filter((item) => item.status === 'published').length;
  const legacyApproved = rows.filter((item) => item.status === 'approved').length;

  return `
    ${pageHeader(
      'Approved Thesis Records',
      'Final administrator-approved research records, including thesis records already published in the institutional repository.'
    )}

    <section class="approved-summary-grid">
      <article class="approved-summary-card">
        <span class="approved-summary-icon tone-blue">${icon('check', 21)}</span>
        <div><span>Total Approved</span><strong>${rows.length}</strong></div>
      </article>

      <article class="approved-summary-card">
        <span class="approved-summary-icon tone-green">${icon('repository', 21)}</span>
        <div><span>Published</span><strong>${published}</strong></div>
      </article>

      <article class="approved-summary-card">
        <span class="approved-summary-icon tone-gold">${icon('file', 21)}</span>
        <div><span>Approved Records</span><strong>${legacyApproved}</strong></div>
      </article>
    </section>

    <section class="panel approved-theses-panel">
      <div class="panel-header approved-theses-header">
        <div>
          <p class="eyebrow">Approval History</p>
          <h2>Administrator-approved research</h2>
          <p>Search approved records and open the complete thesis record for verification or repository review.</p>
        </div>

        <div class="approved-theses-filters">
          <label class="approved-search">
            ${icon('search', 16)}
            <input
              id="approved-search"
              type="search"
              placeholder="Search title, researcher, adviser..."
              autocomplete="off"
            >
          </label>

          <select id="approved-program" aria-label="Filter approved thesis records by program">
            <option value="">All CAS Programs</option>
            ${CAS_PROGRAMS.map((program) =>
              `<option value="${escapeHtml(program.toLowerCase())}">${escapeHtml(program)}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="panel-body no-pad" id="approved-table">
        ${table(rows)}
      </div>

      <div class="approved-filter-empty" id="approved-filter-empty" hidden>
        ${icon('search', 28)}
        <h3>No matching approved thesis</h3>
        <p>Try another title, researcher, adviser, or CAS program.</p>
      </div>
    </section>`;
}

export function mount() {
  const search = document.getElementById('approved-search');
  const program = document.getElementById('approved-program');
  const rows = [...document.querySelectorAll('.approved-thesis-row')];
  const empty = document.getElementById('approved-filter-empty');

  const filter = () => {
    const query = String(search?.value || '').trim().toLowerCase();
    const selectedProgram = String(program?.value || '').toLowerCase();
    let visible = 0;

    rows.forEach((row) => {
      const matchesSearch = !query || row.dataset.search.includes(query);
      const matchesProgram = !selectedProgram || row.dataset.program === selectedProgram;
      const show = matchesSearch && matchesProgram;
      row.hidden = !show;
      if (show) visible += 1;
    });

    if (empty) {
      empty.hidden = visible !== 0 || rows.length === 0;
    }
  };

  search?.addEventListener('input', filter);
  program?.addEventListener('change', filter);

  return () => {
    search?.removeEventListener('input', filter);
    program?.removeEventListener('change', filter);
  };
}
