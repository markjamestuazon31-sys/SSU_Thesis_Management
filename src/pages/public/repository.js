import { CAS_PROGRAMS } from '../../config/app.config.js';
import { icon } from '../../components/icons.js';
import { toast } from '../../components/toast.js';
import { getPublishedTheses } from '../../services/thesis.service.js';
import { reconstructFile } from '../../services/file.service.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { downloadBlob } from '../../utils/file.js';
import '../../styles/repository-v76.css';

const PAGE_SIZE = 8;

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let activeView = 'list';
let filtersOpen = false;
let defaultMinYear = new Date().getFullYear();
let defaultMaxYear = new Date().getFullYear();

function filterIcon(size = 18) {
  return `
    <svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 5h16l-6.2 7.1v5.4l-3.6 1.8v-7.2L4 5z"/>
    </svg>`;
}

function chevronIcon(size = 16) {
  return `
    <svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6"/>
    </svg>`;
}

function publicHeader(currentUser) {
  return `
    <header class="repo75-header">
      <div class="repo75-shell repo75-header-inner">
        <a class="repo75-brand" href="#/repository" aria-label="SSU Institutional Repository">
          <span class="repo75-logo">
            <img src="/assets/ssu-logo.jpg" alt="Samar State University seal">
          </span>

          <span class="repo75-brand-copy">
            <strong>Samar State University</strong>
            <span>College of Arts and Sciences</span>
            <small>Institutional Repository</small>
          </span>
        </a>

        <button class="repo75-menu" id="repo75-menu" type="button" aria-label="Open navigation">
          ${icon('menu', 20)}
        </button>

        <nav class="repo75-nav" id="repo75-nav" aria-label="Repository navigation">
          <a class="active" href="#/repository">Research</a>
          <a href="#/about">About Repository</a>
          <a href="https://ssu.edu.ph/category/research-extension/" target="_blank" rel="noopener">Research &amp; Extension</a>
          <a class="repo75-login" href="${currentUser ? '#/dashboard' : '#/login'}">
            ${currentUser ? 'Open Dashboard' : 'Portal Sign In'}
          </a>
        </nav>
      </div>
    </header>`;
}

function publicFooter(currentUser) {
  return `
    <footer class="repo75-footer">
      <div class="repo75-shell repo75-footer-grid">
        <div class="repo75-footer-brand">
          <span class="repo75-footer-logo">
            <img src="/assets/ssu-logo.jpg" alt="Samar State University seal">
          </span>
          <div>
            <strong>Samar State University</strong>
            <span>College of Arts and Sciences</span>
            <small>Institutional Repository</small>
          </div>
        </div>

        <div class="repo75-footer-message">
          <p>Empowering research. Advancing knowledge.<br>Preserving scholarship for a better future.</p>
        </div>

        <div>
          <h3>Repository</h3>
          <a href="#/repository">Published Research</a>
          <a href="#/about">About Repository</a>
          <a href="${currentUser ? '#/dashboard' : '#/login'}">${currentUser ? 'Dashboard' : 'Portal Sign In'}</a>
        </div>

        <div>
          <h3>University</h3>
          <a href="https://ssu.edu.ph/" target="_blank" rel="noopener">Official Website</a>
          <a href="https://ssu.edu.ph/category/research-extension/" target="_blank" rel="noopener">Research &amp; Extension</a>
        </div>
      </div>

      <div class="repo75-footer-bottom">
        <div class="repo75-shell">
          <span>© 2026 Samar State University. All rights reserved.</span>
          <span>College of Arts and Sciences · Samar State University</span>
        </div>
      </div>
    </footer>`;
}

function keywordChips(value) {
  const keywords = String(value || '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (!keywords.length) {
    return '<span class="repo75-chip muted">No keywords</span>';
  }

  return keywords
    .map((keyword) => `<span class="repo75-chip">${escapeHtml(keyword)}</span>`)
    .join('');
}

function researchCard(research) {
  const title = research.title || 'Untitled Research';
  const authors = research.authors || research.studentName || 'Author not specified';
  const program = research.program || 'Program not specified';
  const adviser = research.researchInstructorName || research.adviserName || '—';
  const year = String(research.year || '—');
  const abstract = String(research.abstract || '').trim();
  const publishedAt = Number(research.publishedAt || 0);

  const fileButton = research.currentFileId
    ? `<button class="repo75-download" type="button" data-file="${escapeHtml(research.currentFileId)}">
        ${icon('download', 17)}
        <span>Download Manuscript</span>
      </button>`
    : `<button class="repo75-download disabled" type="button" disabled>
        <span>Manuscript Unavailable</span>
      </button>`;

  return `
    <article class="repo75-card">
      <div class="repo75-card-content">
        <div class="repo75-year-column">
          <span class="repo75-year">${escapeHtml(year)}</span>
        </div>

        <div class="repo75-card-main">
          <div class="repo75-card-heading">
            <h3>
              <a href="#/repository/${research.id}">${escapeHtml(title)}</a>
            </h3>

            <span class="repo75-date">
              ${icon('clock', 15)}
              ${formatDate(publishedAt)}
            </span>
          </div>

          <p class="repo75-author">
            ${icon('user', 15)}
            ${escapeHtml(authors)}
          </p>

          <div class="repo75-meta">
            <span>${icon('file', 15)} ${escapeHtml(program)}</span>
            <i aria-hidden="true"></i>
            <span>${icon('user', 15)} Research Instructor: ${escapeHtml(adviser)}</span>
          </div>

          <p class="repo75-abstract">
            ${escapeHtml(abstract || 'No abstract has been provided for this published research record.')}
          </p>

          <div class="repo75-keywords">${keywordChips(research.keywords)}</div>
        </div>
      </div>

      <div class="repo75-card-actions">
        <a class="repo75-open" href="#/repository/${research.id}">
          ${icon('eye', 17)}
          <span>View Full Record</span>
        </a>

        ${fileButton}
      </div>
    </article>`;
}

function programCounts(rows) {
  const map = new Map(CAS_PROGRAMS.map((program) => [program, 0]));
  rows.forEach((row) => {
    const program = row.program || '';
    if (!map.has(program)) map.set(program, 0);
    map.set(program, (map.get(program) || 0) + 1);
  });
  return map;
}

function adviserOptions(rows) {
  return [...new Set(
    rows
      .map((row) => String(row.researchInstructorName || row.adviserName || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function getInitialYears(rows) {
  const years = rows
    .map((row) => Number(row.year))
    .filter((year) => Number.isFinite(year) && year > 1900)
    .sort((a, b) => a - b);

  const current = new Date().getFullYear();
  return {
    min: years.length ? years[0] : current,
    max: years.length ? years[years.length - 1] : current,
  };
}

export async function render({ currentUser } = {}) {
  const rows = await getPublishedTheses().catch((error) => {
    console.error('Unable to load published research:', error);
    return [];
  });

  allRows = rows;
  filteredRows = rows;
  currentPage = 1;
  activeView = 'list';
  filtersOpen = false;

  const counts = programCounts(rows);
  const advisers = adviserOptions(rows);
  const years = getInitialYears(rows);
  defaultMinYear = years.min;
  defaultMaxYear = years.max;

  return `
    <div class="repo75-page">
      ${publicHeader(currentUser)}

      <main>
        <section class="repo75-hero">
          <div class="repo75-shell repo75-hero-inner">
            <div class="repo75-hero-copy">
              <h1>Explore published<br>research from<br><em>Samar State University.</em></h1>

              <p>
                Discover, access, and share scholarly works, thesis records, and academic research
                produced by the College of Arts and Sciences.
              </p>

              <label class="repo75-search" role="search">
                <input
                  id="repo-search"
                  type="search"
                  placeholder="Search thesis records, authors, keywords, or topics..."
                  autocomplete="off"
                >
                <button id="repo-search-button" type="button">
                  ${icon('search', 17)} Search
                </button>
              </label>

              <div class="repo75-stats">
                <article>
                  <span>${icon('file', 24)}</span>
                  <div><strong>${rows.length}</strong><small>Published Records</small></div>
                </article>

                <article>
                  <span>${icon('users', 24)}</span>
                  <div><strong>${CAS_PROGRAMS.length}</strong><small>CAS Programs</small></div>
                </article>

                <article>
                  <span>${icon('clock', 24)}</span>
                  <div><strong>${years.max}</strong><small>Latest Publication Year</small></div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section class="repo75-content">
          <div class="repo75-shell">
            <div class="repo75-controlbar">
              <div class="repo75-controlbar-left">
                <button
                  class="repo75-filter-toggle"
                  id="repo-filter-toggle"
                  type="button"
                  aria-expanded="false"
                  aria-controls="repo-filter-panel"
                >
                  ${filterIcon(17)}
                  <span>Filters</span>
                  <span class="repo75-filter-count" id="repo-filter-count" hidden>0</span>
                  ${chevronIcon(15)}
                </button>

                <label class="repo75-sort-control">
                  <span>Sort by</span>
                  <select id="repo-sort" aria-label="Sort research records">
                    <option value="newest">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title">Title A–Z</option>
                  </select>
                  ${chevronIcon(14)}
                </label>
              </div>

              <div class="repo75-controlbar-right">
                <span class="repo75-showing" id="repo-showing">Showing 0 results</span>

                <div class="repo75-view-control" aria-label="Research view">
                  <button id="repo-grid-view" type="button" aria-label="Grid view" title="Grid view">
                    ${icon('dashboard', 18)}
                  </button>
                  <button id="repo-list-view" class="active" type="button" aria-label="List view" title="List view">
                    ${icon('menu', 18)}
                  </button>
                </div>
              </div>
            </div>

            <div class="repo75-workspace" id="repo-workspace">
              <aside class="repo75-filter-panel" id="repo-filter-panel" hidden>
                <div class="repo75-filter-panel-head">
                  <div>
                    <span class="repo75-filter-eyebrow">Refine Results</span>
                    <h2>Quick Filters</h2>
                  </div>
                  <button class="repo75-filter-close" id="repo-filter-close" type="button" aria-label="Close filters">×</button>
                </div>

                <div class="repo75-filter-form">
                  <section class="repo75-filter-group">
                    <label for="program-filter">Program</label>
                    <div class="repo75-select-wrap">
                      <select id="program-filter">
                        <option value="">All CAS Programs (${rows.length})</option>
                        ${CAS_PROGRAMS.map((program) => `
                          <option value="${escapeHtml(program.toLowerCase())}">
                            ${escapeHtml(program)} (${counts.get(program) || 0})
                          </option>
                        `).join('')}
                      </select>
                      ${chevronIcon(14)}
                    </div>
                  </section>

                  <section class="repo75-filter-group">
                    <div class="repo75-filter-label-row">
                      <label>Research Year</label>
                      <button id="repo-reset-year" type="button">Reset</button>
                    </div>

                    <div class="repo75-range-wrap">
                      <div class="repo75-range-track"></div>
                      <input
                        id="year-min"
                        class="repo75-range repo75-range-min"
                        type="range"
                        min="${years.min}"
                        max="${years.max}"
                        value="${years.min}"
                        aria-label="Minimum research year"
                      >
                      <input
                        id="year-max"
                        class="repo75-range repo75-range-max"
                        type="range"
                        min="${years.min}"
                        max="${years.max}"
                        value="${years.max}"
                        aria-label="Maximum research year"
                      >
                    </div>

                    <div class="repo75-range-values">
                      <span id="year-min-label">${years.min}</span>
                      <span id="year-max-label">${years.max}</span>
                    </div>
                  </section>

                  <section class="repo75-filter-group">
                    <label for="adviser-filter">Research Instructor</label>
                    <div class="repo75-select-wrap">
                      <select id="adviser-filter">
                        <option value="">All Research Instructors</option>
                        ${advisers.map((adviser) => `
                          <option value="${escapeHtml(adviser.toLowerCase())}">
                            ${escapeHtml(adviser)}
                          </option>
                        `).join('')}
                      </select>
                      ${chevronIcon(14)}
                    </div>
                  </section>

                  <div class="repo75-filter-actions">
                    <button class="repo75-clear-button" id="repo-clear" type="button">
                      Clear All
                    </button>

                    <button class="repo75-apply-button" id="repo-apply-filters" type="button">
                      ${filterIcon(15)} Apply Filters
                    </button>
                  </div>
                </div>
              </aside>

              <div class="repo75-results">
                <div class="repo75-active-filters" id="repo-active-filters" hidden></div>

                <div class="repo75-grid list" id="repo-results"></div>

                <div class="repo75-empty" id="repo-empty" hidden>
                  ${icon('search', 32)}
                  <h3>No matching research found</h3>
                  <p>Try another search term or clear some filters.</p>
                </div>

                <nav class="repo75-pagination" id="repo-pagination" aria-label="Research pagination"></nav>
              </div>
            </div>
          </div>
        </section>
      </main>

      ${publicFooter(currentUser)}
    </div>`;
}

function selectedFilterState() {
  const program = String(document.getElementById('program-filter')?.value || '');
  const adviser = String(document.getElementById('adviser-filter')?.value || '');
  const minYear = Number(document.getElementById('year-min')?.value || defaultMinYear);
  const maxYear = Number(document.getElementById('year-max')?.value || defaultMaxYear);

  return { program, adviser, minYear, maxYear };
}

function activeFilterCount() {
  const { program, adviser, minYear, maxYear } = selectedFilterState();
  let count = 0;
  if (program) count += 1;
  if (adviser) count += 1;
  if (minYear !== defaultMinYear || maxYear !== defaultMaxYear) count += 1;
  return count;
}

function updateFilterCount() {
  const badge = document.getElementById('repo-filter-count');
  if (!badge) return;

  const count = activeFilterCount();
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function updateActiveFilterChips() {
  const container = document.getElementById('repo-active-filters');
  if (!container) return;

  const { program, adviser, minYear, maxYear } = selectedFilterState();
  const chips = [];

  if (program) {
    const option = document.getElementById('program-filter')?.selectedOptions?.[0];
    const label = String(option?.textContent || '').replace(/\s+\(\d+\)\s*$/, '').trim();
    chips.push(`<span>${filterIcon(12)} Program: ${escapeHtml(label)}</span>`);
  }

  if (minYear !== defaultMinYear || maxYear !== defaultMaxYear) {
    chips.push(`<span>${icon('clock', 12)} Year: ${minYear}–${maxYear}</span>`);
  }

  if (adviser) {
    const option = document.getElementById('adviser-filter')?.selectedOptions?.[0];
    chips.push(`<span>${icon('user', 12)} Research Instructor: ${escapeHtml(option?.textContent?.trim() || adviser)}</span>`);
  }

  container.innerHTML = chips.join('');
  container.hidden = chips.length === 0;
  updateFilterCount();
}

function filterRows() {
  const search = String(document.getElementById('repo-search')?.value || '').trim().toLowerCase();
  const { program, adviser, minYear, maxYear } = selectedFilterState();

  filteredRows = allRows.filter((row) => {
    const text = [
      row.title || '',
      row.authors || row.studentName || '',
      row.program || '',
      row.keywords || '',
      row.researchInstructorName || row.adviserName || '',
      row.abstract || '',
    ].join(' ').toLowerCase();

    const rowProgram = String(row.program || '').toLowerCase();
    const rowAdviser = String(row.researchInstructorName || row.adviserName || '').toLowerCase();
    const rowYear = Number(row.year || 0);

    const matchesSearch = !search || text.includes(search);
    const matchesProgram = !program || rowProgram === program;
    const matchesAdviser = !adviser || rowAdviser === adviser;
    const matchesYear = !rowYear || (rowYear >= minYear && rowYear <= maxYear);

    return matchesSearch && matchesProgram && matchesAdviser && matchesYear;
  });

  const sort = document.getElementById('repo-sort')?.value || 'newest';

  filteredRows.sort((a, b) => {
    if (sort === 'title') {
      return String(a.title || '').localeCompare(String(b.title || ''));
    }

    const left = Number(a.publishedAt || 0) || Number(a.year || 0);
    const right = Number(b.publishedAt || 0) || Number(b.year || 0);

    return sort === 'oldest' ? left - right : right - left;
  });

  currentPage = 1;
  updateActiveFilterChips();
  renderPage();
}

function renderPage() {
  const results = document.getElementById('repo-results');
  const empty = document.getElementById('repo-empty');
  const showing = document.getElementById('repo-showing');

  if (!results || !empty || !showing) return;

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (currentPage > totalPages) currentPage = totalPages;

  const start = total ? (currentPage - 1) * PAGE_SIZE : 0;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageRows = filteredRows.slice(start, end);

  results.classList.toggle('list', activeView === 'list');
  results.innerHTML = pageRows.map(researchCard).join('');
  empty.hidden = total !== 0;

  showing.textContent = total
    ? `Showing ${start + 1}–${end} of ${total} results`
    : 'Showing 0 results';

  bindDownloads();
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const nav = document.getElementById('repo-pagination');
  if (!nav) return;

  const safeTotalPages = Math.max(1, totalPages);
  const pages = [];
  const visible = new Set([
    1,
    safeTotalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  const ordered = [...visible]
    .filter((page) => page >= 1 && page <= safeTotalPages)
    .sort((a, b) => a - b);

  let previous = 0;

  ordered.forEach((page) => {
    if (previous && page - previous > 1) {
      pages.push('<span class="repo75-page-gap">…</span>');
    }

    pages.push(`
      <button
        type="button"
        class="repo75-page-number ${page === currentPage ? 'active' : ''}"
        data-page="${page}"
        aria-label="Go to page ${page}"
        ${page === currentPage ? 'aria-current="page"' : ''}
      >
        ${page}
      </button>`);

    previous = page;
  });

  nav.innerHTML = `
    <div class="repo75-page-buttons">
      <button
        class="repo75-page-arrow"
        type="button"
        data-page="${Math.max(1, currentPage - 1)}"
        ${currentPage === 1 ? 'disabled' : ''}
        aria-label="Previous page"
      >‹</button>

      ${pages.join('')}

      <button
        class="repo75-page-arrow"
        type="button"
        data-page="${Math.min(safeTotalPages, currentPage + 1)}"
        ${currentPage === safeTotalPages ? 'disabled' : ''}
        aria-label="Next page"
      >›</button>
    </div>

    <label class="repo75-go-page">
      <span>Go to page:</span>
      <select id="repo-go-page" aria-label="Go to page">
        ${Array.from({ length: safeTotalPages }, (_, index) => {
          const page = index + 1;
          return `<option value="${page}" ${page === currentPage ? 'selected' : ''}>${page}</option>`;
        }).join('')}
      </select>
    </label>
  `;

  nav.querySelectorAll('button[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      currentPage = Number(button.dataset.page);
      renderPage();
      document.getElementById('repo-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  const goPage = document.getElementById('repo-go-page');
  goPage?.addEventListener('change', () => {
    currentPage = Number(goPage.value);
    renderPage();
    document.getElementById('repo-results')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}

async function downloadManuscript(button) {
  const original = button.innerHTML;

  button.disabled = true;
  button.innerHTML = `${icon('download', 15)} <span>Preparing...</span>`;

  try {
    const { metadata, blob } = await reconstructFile(button.dataset.file);
    downloadBlob(blob, metadata.name || 'manuscript');
    toast('Manuscript download started.', 'success');
  } catch (error) {
    toast(error.message || 'Unable to download manuscript.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function bindDownloads() {
  document.querySelectorAll('.repo75-download[data-file]').forEach((button) => {
    button.addEventListener('click', () => downloadManuscript(button));
  });
}

function updateYearLabels() {
  const min = document.getElementById('year-min');
  const max = document.getElementById('year-max');
  const minLabel = document.getElementById('year-min-label');
  const maxLabel = document.getElementById('year-max-label');

  if (!min || !max || !minLabel || !maxLabel) return;

  let minValue = Number(min.value);
  let maxValue = Number(max.value);

  if (minValue > maxValue) {
    if (document.activeElement === min) {
      maxValue = minValue;
      max.value = String(maxValue);
    } else {
      minValue = maxValue;
      min.value = String(minValue);
    }
  }

  minLabel.textContent = String(minValue);
  maxLabel.textContent = String(maxValue);
  updateFilterCount();
}

function setFiltersOpen(open) {
  filtersOpen = Boolean(open);

  const panel = document.getElementById('repo-filter-panel');
  const workspace = document.getElementById('repo-workspace');
  const toggle = document.getElementById('repo-filter-toggle');

  if (panel) panel.hidden = !filtersOpen;
  workspace?.classList.toggle('filters-open', filtersOpen);
  toggle?.classList.toggle('active', filtersOpen);
  toggle?.setAttribute('aria-expanded', String(filtersOpen));
}

function resetFilters({ includeSearch = false } = {}) {
  const program = document.getElementById('program-filter');
  const adviser = document.getElementById('adviser-filter');
  const minYear = document.getElementById('year-min');
  const maxYear = document.getElementById('year-max');
  const sort = document.getElementById('repo-sort');
  const search = document.getElementById('repo-search');

  if (program) program.value = '';
  if (adviser) adviser.value = '';
  if (minYear) minYear.value = String(defaultMinYear);
  if (maxYear) maxYear.value = String(defaultMaxYear);
  if (sort) sort.value = 'newest';
  if (includeSearch && search) search.value = '';

  updateYearLabels();
  filterRows();
}

export function mount() {
  const cleanups = [];

  const menu = document.getElementById('repo75-menu');
  const nav = document.getElementById('repo75-nav');

  const menuHandler = () => nav?.classList.toggle('open');
  menu?.addEventListener('click', menuHandler);
  cleanups.push(() => menu?.removeEventListener('click', menuHandler));

  const filterToggle = document.getElementById('repo-filter-toggle');
  const filterClose = document.getElementById('repo-filter-close');

  const toggleFilters = () => setFiltersOpen(!filtersOpen);
  const closeFilters = () => setFiltersOpen(false);

  filterToggle?.addEventListener('click', toggleFilters);
  filterClose?.addEventListener('click', closeFilters);

  cleanups.push(() => filterToggle?.removeEventListener('click', toggleFilters));
  cleanups.push(() => filterClose?.removeEventListener('click', closeFilters));

  const search = document.getElementById('repo-search');
  const searchButton = document.getElementById('repo-search-button');

  const searchHandler = () => filterRows();
  const searchKeyHandler = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      filterRows();
    }
  };

  search?.addEventListener('input', searchHandler);
  search?.addEventListener('keydown', searchKeyHandler);
  searchButton?.addEventListener('click', searchHandler);

  cleanups.push(() => search?.removeEventListener('input', searchHandler));
  cleanups.push(() => search?.removeEventListener('keydown', searchKeyHandler));
  cleanups.push(() => searchButton?.removeEventListener('click', searchHandler));

  const minYear = document.getElementById('year-min');
  const maxYear = document.getElementById('year-max');

  const yearHandler = () => updateYearLabels();

  minYear?.addEventListener('input', yearHandler);
  maxYear?.addEventListener('input', yearHandler);

  cleanups.push(() => minYear?.removeEventListener('input', yearHandler));
  cleanups.push(() => maxYear?.removeEventListener('input', yearHandler));

  const program = document.getElementById('program-filter');
  const adviser = document.getElementById('adviser-filter');

  const stagedFilterHandler = () => updateFilterCount();

  program?.addEventListener('change', stagedFilterHandler);
  adviser?.addEventListener('change', stagedFilterHandler);

  cleanups.push(() => program?.removeEventListener('change', stagedFilterHandler));
  cleanups.push(() => adviser?.removeEventListener('change', stagedFilterHandler));

  const apply = document.getElementById('repo-apply-filters');
  const applyHandler = () => {
    filterRows();

    if (window.matchMedia('(max-width: 760px)').matches) {
      setFiltersOpen(false);
    }
  };

  apply?.addEventListener('click', applyHandler);
  cleanups.push(() => apply?.removeEventListener('click', applyHandler));

  const clear = document.getElementById('repo-clear');
  const clearHandler = () => resetFilters({ includeSearch: false });

  clear?.addEventListener('click', clearHandler);
  cleanups.push(() => clear?.removeEventListener('click', clearHandler));

  const resetYear = document.getElementById('repo-reset-year');
  const resetYearHandler = () => {
    if (minYear) minYear.value = String(defaultMinYear);
    if (maxYear) maxYear.value = String(defaultMaxYear);
    updateYearLabels();
  };

  resetYear?.addEventListener('click', resetYearHandler);
  cleanups.push(() => resetYear?.removeEventListener('click', resetYearHandler));

  const sort = document.getElementById('repo-sort');

  const sortHandler = () => filterRows();
  sort?.addEventListener('change', sortHandler);
  cleanups.push(() => sort?.removeEventListener('change', sortHandler));

  const gridButton = document.getElementById('repo-grid-view');
  const listButton = document.getElementById('repo-list-view');

  const setGrid = () => {
    activeView = 'grid';
    gridButton?.classList.add('active');
    listButton?.classList.remove('active');
    renderPage();
  };

  const setList = () => {
    activeView = 'list';
    listButton?.classList.add('active');
    gridButton?.classList.remove('active');
    renderPage();
  };

  gridButton?.addEventListener('click', setGrid);
  listButton?.addEventListener('click', setList);

  cleanups.push(() => gridButton?.removeEventListener('click', setGrid));
  cleanups.push(() => listButton?.removeEventListener('click', setList));

  updateYearLabels();
  updateFilterCount();
  setFiltersOpen(false);
  filterRows();

  return () => cleanups.forEach((cleanup) => cleanup());
}
