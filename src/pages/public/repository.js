
import { CAS_PROGRAMS } from '../../config/app.config.js';
import { icon } from '../../components/icons.js';
import { toast } from '../../components/toast.js';
import { getPublishedTheses } from '../../services/thesis.service.js';
import { reconstructFile } from '../../services/file.service.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { downloadBlob } from '../../utils/file.js';
import '../../styles/repository-v66.css';

const PAGE_SIZE = 9;

let allRows = [];
let filteredRows = [];
let currentPage = 1;
let activeView = 'grid';

function publicHeader(currentUser) {
  return `
    <header class="repo66-header">
      <div class="repo66-shell repo66-header-inner">
        <a class="repo66-brand" href="#/repository" aria-label="SSU Institutional Repository">
          <span class="repo66-logo">
            <img src="/assets/ssu-logo.jpg" alt="Samar State University seal">
          </span>
          <span class="repo66-brand-copy">
            <strong>Samar State University</strong>
            <span>College of Arts and Sciences</span>
            <small>Institutional Repository</small>
          </span>
        </a>

        <button class="repo66-menu" id="repo66-menu" type="button" aria-label="Open navigation">
          ${icon('menu', 20)}
        </button>

        <nav class="repo66-nav" id="repo66-nav" aria-label="Repository navigation">
          <a class="active" href="#/repository">Research</a>
          <a href="#/about">About Repository</a>
          <a href="https://ssu.edu.ph/category/research-extension/" target="_blank" rel="noopener">Research &amp; Extension</a>
          <a class="repo66-login" href="${currentUser ? '#/dashboard' : '#/login'}">
            ${currentUser ? 'Open Dashboard' : 'Portal Sign In'}
          </a>
        </nav>
      </div>
    </header>`;
}

function publicFooter(currentUser) {
  return `
    <footer class="repo66-footer">
      <div class="repo66-shell repo66-footer-grid">
        <div class="repo66-footer-brand">
          <span class="repo66-footer-logo">
            <img src="/assets/ssu-logo.jpg" alt="Samar State University seal">
          </span>
          <div>
            <strong>Samar State University</strong>
            <span>College of Arts and Sciences</span>
            <small>Institutional Repository</small>
          </div>
        </div>

        <div class="repo66-footer-message">
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

      <div class="repo66-footer-bottom">
        <div class="repo66-shell">
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

  if (!keywords.length) return '<span class="repo66-chip muted">No keywords</span>';

  return keywords
    .map((keyword) => `<span class="repo66-chip">${escapeHtml(keyword)}</span>`)
    .join('');
}

function researchCard(research) {
  const title = research.title || 'Untitled Research';
  const authors = research.authors || research.studentName || 'Author not specified';
  const program = research.program || 'Program not specified';
  const year = String(research.year || '—');
  const abstract = String(research.abstract || '');
  const abstractPreview = abstract.length > 250 ? `${abstract.slice(0, 250)}…` : abstract;
  const publishedAt = research.publishedAt || 0;

  const fileButton = research.currentFileId
    ? `<button class="repo66-download" type="button" data-file="${escapeHtml(research.currentFileId)}">
        ${icon('download', 15)} Download Manuscript
      </button>`
    : `<button class="repo66-download disabled" type="button" disabled>Manuscript Unavailable</button>`;

  return `
    <article class="repo66-card"
      data-search="${escapeHtml(`${title} ${authors} ${program} ${research.keywords || ''} ${research.adviserName || ''} ${year}`.toLowerCase())}"
      data-program="${escapeHtml(program.toLowerCase())}"
      data-year="${escapeHtml(year)}"
      data-title="${escapeHtml(title.toLowerCase())}"
      data-published="${Number(publishedAt || 0)}">

      <div class="repo66-card-top">
        <span class="repo66-card-year">${escapeHtml(year)}</span>
        <span class="repo66-published">${icon('clock', 14)} ${formatDate(publishedAt)}</span>
      </div>

      <h3><a href="#/repository/${research.id}">${escapeHtml(title)}</a></h3>
      <p class="repo66-author">${escapeHtml(authors)}</p>
      <p class="repo66-program">${escapeHtml(program)}</p>
      <p class="repo66-adviser">Adviser: ${escapeHtml(research.adviserName || '—')}</p>
      <p class="repo66-abstract">${escapeHtml(abstractPreview || 'No abstract has been provided for this published record.')}</p>

      <div class="repo66-keywords">${keywordChips(research.keywords)}</div>

      <div class="repo66-card-actions">
        <a class="repo66-open" href="#/repository/${research.id}">
          ${icon('eye', 15)} View Full Record
        </a>
        ${fileButton}
      </div>
    </article>`;
}

function programCounts(rows) {
  const map = new Map(CAS_PROGRAMS.map((p) => [p, 0]));
  rows.forEach((row) => {
    const program = row.program || '';
    if (!map.has(program)) map.set(program, 0);
    map.set(program, (map.get(program) || 0) + 1);
  });
  return map;
}

export async function render({ currentUser } = {}) {
  const rows = await getPublishedTheses().catch((error) => {
    console.error('Unable to load published research:', error);
    return [];
  });

  allRows = rows;
  filteredRows = rows;
  currentPage = 1;

  const counts = programCounts(rows);
  const years = rows
    .map((r) => Number(r.year))
    .filter((y) => Number.isFinite(y) && y > 1900)
    .sort((a, b) => a - b);

  const minYear = years.length ? years[0] : new Date().getFullYear();
  const maxYear = years.length ? years[years.length - 1] : new Date().getFullYear();

  return `
    <div class="repo66-page">
      ${publicHeader(currentUser)}

      <main>
        <section class="repo66-hero">
          <div class="repo66-shell repo66-hero-inner">
            <div class="repo66-hero-copy">
              <h1>Explore published<br>research from<br><em>Samar State University.</em></h1>
              <p>Discover, access, and share scholarly works, theses, and academic research produced by the College of Arts and Sciences.</p>

              <label class="repo66-search" role="search">
                <input id="repo-search" type="search" placeholder="Search for theses, authors, keywords, or topics..." autocomplete="off">
                <button id="repo-search-button" type="button">${icon('search', 17)} Search</button>
              </label>

              <div class="repo66-stats">
                <article>
                  <span>${icon('file', 26)}</span>
                  <div><strong>${rows.length}</strong><small>Published Records</small></div>
                </article>
                <article>
                  <span>${icon('users', 26)}</span>
                  <div><strong>${CAS_PROGRAMS.length}</strong><small>CAS Programs</small></div>
                </article>
                <article>
                  <span>${icon('clock', 26)}</span>
                  <div><strong>${maxYear}</strong><small>Latest Publication Year</small></div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section class="repo66-content">
          <div class="repo66-shell repo66-layout">
            <aside class="repo66-filters">
              <div class="repo66-filter-heading">
                <h2>Filters</h2>
                <button id="repo-clear" type="button">Clear all</button>
              </div>

              <section class="repo66-filter-block">
                <button class="repo66-filter-block-title" type="button" data-collapse="programs">
                  <span>Program</span>
                  <span>⌃</span>
                </button>
                <div class="repo66-filter-block-body" id="filter-programs">
                  <label class="repo66-check-row">
                    <input type="checkbox" id="program-all" checked>
                    <span>All CAS Programs</span>
                    <strong>${rows.length}</strong>
                  </label>

                  ${CAS_PROGRAMS.map((program) => `
                    <label class="repo66-check-row">
                      <input type="checkbox" class="program-check" value="${escapeHtml(program.toLowerCase())}">
                      <span>${escapeHtml(program)}</span>
                      <strong>${counts.get(program) || 0}</strong>
                    </label>
                  `).join('')}
                </div>
              </section>

              <section class="repo66-filter-block">
                <button class="repo66-filter-block-title" type="button" data-collapse="years">
                  <span>Research Year</span>
                  <span>⌃</span>
                </button>
                <div class="repo66-filter-block-body" id="filter-years">
                  <div class="repo66-range-wrap">
                    <div class="repo66-range-track"></div>
                    <input id="year-min" class="repo66-range repo66-range-min" type="range" min="${minYear}" max="${maxYear}" value="${minYear}">
                    <input id="year-max" class="repo66-range repo66-range-max" type="range" min="${minYear}" max="${maxYear}" value="${maxYear}">
                  </div>
                  <div class="repo66-range-values">
                    <span id="year-min-label">${minYear}</span>
                    <span id="year-max-label">${maxYear}</span>
                  </div>
                </div>
              </section>

              <section class="repo66-filter-block">
                <button class="repo66-filter-block-title" type="button" data-collapse="sort">
                  <span>Sort By</span>
                  <span>⌃</span>
                </button>
                <div class="repo66-filter-block-body" id="filter-sort">
                  <select id="repo-sort">
                    <option value="newest">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </div>
              </section>
            </aside>

            <div class="repo66-results">
              <div class="repo66-results-toolbar">
                <div>
                  <span id="repo-showing">Showing 0 results</span>
                </div>
                <div class="repo66-view-control">
                  <span>View as:</span>
                  <button id="repo-grid-view" class="active" type="button" aria-label="Grid view">${icon('dashboard', 18)}</button>
                  <button id="repo-list-view" type="button" aria-label="List view">${icon('menu', 18)}</button>
                </div>
              </div>

              <div class="repo66-grid" id="repo-results"></div>

              <div class="repo66-empty" id="repo-empty" hidden>
                ${icon('search', 32)}
                <h3>No matching research found</h3>
                <p>Try changing your search or filters.</p>
              </div>

              <nav class="repo66-pagination" id="repo-pagination" aria-label="Research pagination"></nav>
            </div>
          </div>
        </section>
      </main>

      ${publicFooter(currentUser)}
    </div>`;
}

function getSelectedPrograms() {
  const checks = [...document.querySelectorAll('.program-check:checked')];
  return checks.map((el) => el.value);
}

function filterRows() {
  const search = String(document.getElementById('repo-search')?.value || '').trim().toLowerCase();
  const selectedPrograms = getSelectedPrograms();
  const minYear = Number(document.getElementById('year-min')?.value || 0);
  const maxYear = Number(document.getElementById('year-max')?.value || 9999);

  filteredRows = allRows.filter((row) => {
    const text = `${row.title || ''} ${row.authors || row.studentName || ''} ${row.program || ''} ${row.keywords || ''} ${row.adviserName || ''}`.toLowerCase();
    const program = String(row.program || '').toLowerCase();
    const year = Number(row.year || 0);

    const matchesSearch = !search || text.includes(search);
    const matchesProgram = selectedPrograms.length === 0 || selectedPrograms.includes(program);
    const matchesYear = !year || (year >= minYear && year <= maxYear);

    return matchesSearch && matchesProgram && matchesYear;
  });

  const sort = document.getElementById('repo-sort')?.value || 'newest';
  filteredRows.sort((a, b) => {
    if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
    const left = Number(a.publishedAt || 0) || Number(a.year || 0);
    const right = Number(b.publishedAt || 0) || Number(b.year || 0);
    return sort === 'oldest' ? left - right : right - left;
  });

  currentPage = 1;
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
  if (totalPages <= 1) {
    nav.innerHTML = '';
    return;
  }

  const pages = [];
  const visible = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = [...visible].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  let previous = 0;
  ordered.forEach((p) => {
    if (previous && p - previous > 1) pages.push('<span class="repo66-page-gap">…</span>');
    pages.push(`<button type="button" class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`);
    previous = p;
  });

  nav.innerHTML = `
    <button type="button" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
    ${pages.join('')}
    <button type="button" data-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
  `;

  nav.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.page);
      renderPage();
      document.getElementById('repo-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

async function downloadManuscript(button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('download', 15)} Preparing...`;

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
  document.querySelectorAll('.repo66-download[data-file]').forEach((button) => {
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
}

function syncProgramAll() {
  const all = document.getElementById('program-all');
  const checks = [...document.querySelectorAll('.program-check')];
  if (!all) return;

  all.checked = checks.every((c) => !c.checked);

  checks.forEach((check) => {
    check.addEventListener('change', () => {
      all.checked = checks.every((c) => !c.checked);
      filterRows();
    });
  });

  all.addEventListener('change', () => {
    if (all.checked) {
      checks.forEach((c) => { c.checked = false; });
      filterRows();
    }
  });
}

export function mount() {
  const cleanups = [];

  const menu = document.getElementById('repo66-menu');
  const nav = document.getElementById('repo66-nav');
  const menuHandler = () => nav?.classList.toggle('open');
  menu?.addEventListener('click', menuHandler);
  cleanups.push(() => menu?.removeEventListener('click', menuHandler));

  const search = document.getElementById('repo-search');
  const searchButton = document.getElementById('repo-search-button');
  const searchHandler = () => filterRows();
  search?.addEventListener('input', searchHandler);
  searchButton?.addEventListener('click', searchHandler);
  cleanups.push(() => search?.removeEventListener('input', searchHandler));
  cleanups.push(() => searchButton?.removeEventListener('click', searchHandler));

  const minYear = document.getElementById('year-min');
  const maxYear = document.getElementById('year-max');
  const yearHandler = () => {
    updateYearLabels();
    filterRows();
  };
  minYear?.addEventListener('input', yearHandler);
  maxYear?.addEventListener('input', yearHandler);
  cleanups.push(() => minYear?.removeEventListener('input', yearHandler));
  cleanups.push(() => maxYear?.removeEventListener('input', yearHandler));

  const sort = document.getElementById('repo-sort');
  sort?.addEventListener('change', filterRows);
  cleanups.push(() => sort?.removeEventListener('change', filterRows));

  const clear = document.getElementById('repo-clear');
  const clearHandler = () => {
    if (search) search.value = '';
    document.querySelectorAll('.program-check').forEach((c) => { c.checked = false; });
    const all = document.getElementById('program-all');
    if (all) all.checked = true;

    if (minYear) minYear.value = minYear.min;
    if (maxYear) maxYear.value = maxYear.max;

    if (sort) sort.value = 'newest';

    updateYearLabels();
    filterRows();
  };
  clear?.addEventListener('click', clearHandler);
  cleanups.push(() => clear?.removeEventListener('click', clearHandler));

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

  document.querySelectorAll('[data-collapse]').forEach((button) => {
    const handler = () => {
      const id = button.dataset.collapse;
      const body = document.getElementById(`filter-${id}`);
      body?.classList.toggle('collapsed');
      button.classList.toggle('collapsed');
    };
    button.addEventListener('click', handler);
    cleanups.push(() => button.removeEventListener('click', handler));
  });

  syncProgramAll();
  updateYearLabels();
  filterRows();

  return () => cleanups.forEach((cleanup) => cleanup());
}
