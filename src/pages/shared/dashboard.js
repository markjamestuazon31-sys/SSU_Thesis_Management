import { getDashboardData } from '../../services/dashboard.service.js';
import { subscribeCollection, subscribeValue } from '../../services/db.service.js';
import { pageHeader, statCard, thesisTable } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { icon } from '../../components/icons.js';
import '../../styles/dashboard-professional-v73.css';

export async function render({ profile }) {
  const data = await getDashboardData(profile);
  const firstName = profile.displayName?.split(' ')[0] || 'User';
  const roleText = profile.role === 'admin' ? 'Administrator' : profile.role === 'adviser' ? 'Thesis Adviser' : 'Student Researcher';

  return `<section class="workspace-hero workspace-hero-professional">
    <div class="dashboard-hero-content-pro">
      <div class="workspace-kicker"><span class="live-dot"></span> Firebase Realtime Database connected</div>
      <h1>Good day, <span>${escapeHtml(firstName)}.</span></h1>
      <h2 class="dashboard-hero-subtitle">${profile.role === 'admin' ? 'Thesis Administration Dashboard' : profile.role === 'adviser' ? 'Thesis Adviser Dashboard' : 'Student Research Dashboard'}</h2>
      <p>${escapeHtml(roleText)} workspace for thesis submissions, research workflow, repository access, approvals, and live monitoring.</p>
      <div class="workspace-hero-actions">${heroActions(profile.role)}</div>
    </div>

    <aside class="dashboard-hero-brand" aria-label="College of Arts and Sciences">
      <img src="/assets/cas-logo.jpg" alt="College of Arts and Sciences logo">
      <div>
        <span>College of Arts and Sciences</span>
        <strong>Thesis Record Management System</strong>
        <small>Samar State University</small>
      </div>
    </aside>
  </section>

  <div class="dashboard-section-heading">
    <div><p class="eyebrow">Live overview</p><h2>Research activity at a glance</h2></div>
    <span class="live-sync-pill">${icon('check', 14)} Live data</span>
  </div>
  <div class="stats-grid" id="live-stats">${data.stats.map(statCard).join('')}</div>

  <div class="dashboard-grid executive-grid">
    <section class="panel workflow-overview-panel">
      <div class="panel-header">
        <div><h2>Workflow monitoring</h2><p>Current thesis progress across the review and publication process.</p></div>
        <a class="text-link" href="#${workflowRoute(profile.role)}">Open workflow ${icon('arrow', 15)}</a>
      </div>
      <div class="panel-body" id="live-workflow">${workflowSummary(data.theses, profile.role)}</div>
    </section>

    <aside class="panel quick-panel">
      <div class="panel-header"><div><h2>Priority actions</h2><p>Common tasks for your role.</p></div></div>
      <div class="panel-body quick-list">
        ${quick(profile.role)}
        <div class="notice-box live-notification-box">
          <div class="notice-icon">${icon('bell', 18)}</div>
          <div><strong><span id="live-unread">${data.unread}</span> unread notification${data.unread === 1 ? '' : 's'}</strong>
          <p>Workflow alerts, adviser feedback, and publication updates.</p>
          <a class="text-link" href="#/notifications">Open notifications →</a></div>
        </div>
      </div>
    </aside>
  </div>

  <section class="panel recent-activity-panel">
    <div class="panel-header">
      <div><h2>Recent thesis activity</h2><p>Latest records relevant to your account.</p></div>
      <span class="panel-meta">Automatically refreshed</span>
    </div>
    <div class="panel-body no-pad" id="live-recent">${recentTable(data.recent, profile)}</div>
  </section>

  <section class="panel dashboard-repository-panel">
    <div class="panel-header dashboard-library-header">
      <div>
        <p class="eyebrow">Centralized repository</p>
        <h2>Published Research Library</h2>
        <p>Search approved and published CAS research records from one institutional repository.</p>
      </div>
      <div class="dashboard-library-tools">
        <div class="dashboard-research-search">
          ${icon('search', 17)}
          <input id="dashboard-research-search" type="search" placeholder="Search title, author, program, keyword..." autocomplete="off">
        </div>
        <span class="research-count"><strong id="dashboard-research-count">${data.published.length}</strong> published</span>
      </div>
    </div>
    <div class="panel-body">
      <div class="dashboard-research-grid" id="dashboard-research-grid">${publishedCards(data.published)}</div>
    </div>
  </section>
`;
}

function heroActions(role) {
  if (role === 'student') return `<a class="btn btn-primary" href="#/student/submit">${icon('upload', 17)} New thesis submission</a><a class="btn btn-secondary" href="#/student/theses">${icon('file', 17)} My thesis records</a>`;
  if (role === 'adviser') return `<a class="btn btn-primary" href="#/adviser/assigned">${icon('review', 17)} Review submitted research</a><a class="btn btn-secondary" href="#/adviser/history">${icon('clock', 17)} Review history</a>`;
  return `<a class="btn btn-primary" href="#/admin/workflow">${icon('review', 17)} Manage thesis workflow</a><a class="btn btn-secondary" href="#/admin/reports">${icon('chart', 17)} Open analytics</a>`;
}

function workflowRoute(role) {
  if (role === 'student') return '/student/theses';
  if (role === 'adviser') return '/adviser/assigned';
  return '/admin/workflow';
}

function recentTable(rows, profile) {
  return thesisTable(rows, {
    showOwner: profile.role !== 'student',
    showAdviser: profile.role === 'admin',
    actionRoute: (id) => profile.role === 'student'
      ? `/student/thesis/${id}`
      : profile.role === 'adviser'
        ? `/adviser/review/${id}`
        : `/admin/thesis/${id}`,
  });
}

function workflowSummary(theses = [], role) {
  const groups = role === 'admin'
    ? [
        ['In review', ['submitted', 'under_review'], 'review'],
        ['Revision required', ['revision_required'], 'clock'],
        ['Awaiting admin approval', ['adviser_approved', 'recommended'], 'check'],
        ['Published', ['published'], 'repository'],
      ]
    : [
        ['In review', ['submitted', 'under_review'], 'review'],
        ['Revision required', ['revision_required'], 'clock'],
        ['Adviser approved', ['adviser_approved', 'recommended'], 'check'],
        ['Published', ['published'], 'repository'],
      ];

  const max = Math.max(1, ...groups.map(([, statuses]) => theses.filter((item) => statuses.includes(item.status)).length));
  return `<div class="workflow-stage-list">${groups.map(([label, statuses, iconName]) => {
    const value = theses.filter((item) => statuses.includes(item.status)).length;
    const percent = Math.max(value ? 8 : 0, (value / max) * 100);
    return `<article class="workflow-stage-card">
      <div class="workflow-stage-icon">${icon(iconName, 18)}</div>
      <div class="workflow-stage-copy"><span>${escapeHtml(label)}</span><div class="workflow-mini-track"><i style="width:${percent}%"></i></div></div>
      <strong>${value}</strong>
    </article>`;
  }).join('')}</div>`;
}

function publishedCards(rows) {
  if (!rows.length) {
    return `<div class="empty-state wide">
      <div class="empty-icon">${icon('repository', 30)}</div>
      <h3>No published research yet</h3>
      <p>Approved research will automatically appear here after publication by the administrator.</p>
    </div>`;
  }

  return rows.map((research) => {
    const searchable = `${research.title || ''} ${research.authors || ''} ${research.studentName || ''} ${research.program || ''} ${research.keywords || ''}`.toLowerCase();
    const abstract = research.abstract || '';
    return `<article class="dashboard-research-card" data-research-search="${escapeHtml(searchable)}">
      <div class="dashboard-research-top">
        <span class="repo-year">${escapeHtml(research.year || '—')}</span>
        <span class="published-date">${formatDate(research.publishedAt)}</span>
      </div>
      <h3>${escapeHtml(research.title || 'Untitled Research')}</h3>
      <p class="repo-author">${escapeHtml(research.authors || research.studentName || 'Author not specified')}</p>
      <p class="research-abstract">${escapeHtml(abstract.slice(0, 165))}${abstract.length > 165 ? '…' : ''}</p>
      <div class="research-keyword-line">${keywordChips(research.keywords)}</div>
      <div class="dashboard-research-footer">
        <span>${escapeHtml(research.program || 'Program not specified')}</span>
        <a class="btn btn-primary btn-sm" href="#/repository/${research.id}">Open research ${icon('arrow', 15)}</a>
      </div>
    </article>`;
  }).join('');
}

function keywordChips(value) {
  const chips = String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3);
  if (!chips.length) return '<span class="keyword-chip muted-chip">Research record</span>';
  return chips.map((item) => `<span class="keyword-chip">${escapeHtml(item)}</span>`).join('');
}

function quick(role) {
  if (role === 'student') {
    return `<a class="quick-action" href="#/student/submit"><span class="quick-action-icon">${icon('upload', 18)}</span><div><strong>Submit a thesis</strong><span>Create metadata and upload a manuscript.</span></div>${icon('arrow', 16)}</a>
      <a class="quick-action" href="#/student/theses"><span class="quick-action-icon">${icon('file', 18)}</span><div><strong>Track my theses</strong><span>Review status and adviser feedback.</span></div>${icon('arrow', 16)}</a>
      <a class="quick-action" href="#/repository"><span class="quick-action-icon">${icon('repository', 18)}</span><div><strong>Research repository</strong><span>Search all published CAS research.</span></div>${icon('arrow', 16)}</a>`;
  }
  if (role === 'adviser') {
    return `<a class="quick-action" href="#/adviser/assigned"><span class="quick-action-icon">${icon('review', 18)}</span><div><strong>Review submitted research</strong><span>Open manuscripts from students who selected you as adviser.</span></div>${icon('arrow', 16)}</a>
      <a class="quick-action" href="#/adviser/history"><span class="quick-action-icon">${icon('clock', 18)}</span><div><strong>Review history</strong><span>See previous decisions and comments.</span></div>${icon('arrow', 16)}</a>
      <a class="quick-action" href="#/repository"><span class="quick-action-icon">${icon('repository', 18)}</span><div><strong>Research repository</strong><span>Search all published CAS research.</span></div>${icon('arrow', 16)}</a>`;
  }
  return `<a class="quick-action" href="#/admin/workflow"><span class="quick-action-icon">${icon('review', 18)}</span><div><strong>Manage workflow</strong><span>Final-approve adviser-reviewed research and publish it.</span></div>${icon('arrow', 16)}</a>
    <a class="quick-action" href="#/admin/users"><span class="quick-action-icon">${icon('users', 18)}</span><div><strong>Manage users</strong><span>Create adviser accounts and control access.</span></div>${icon('arrow', 16)}</a>
    <a class="quick-action" href="#/admin/reports"><span class="quick-action-icon">${icon('chart', 18)}</span><div><strong>Reports & analytics</strong><span>View live status and program statistics.</span></div>${icon('arrow', 16)}</a>`;
}

function bindSearch() {
  const input = document.getElementById('dashboard-research-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.dashboard-research-card').forEach((card) => {
      const show = !query || card.dataset.researchSearch.includes(query);
      card.hidden = !show;
      if (show) visible += 1;
    });
    const count = document.getElementById('dashboard-research-count');
    if (count) count.textContent = String(visible);
  });
}

function updateDashboard(data, profile) {
  const stats = document.getElementById('live-stats');
  if (stats) stats.innerHTML = data.stats.map(statCard).join('');
  const workflow = document.getElementById('live-workflow');
  if (workflow) workflow.innerHTML = workflowSummary(data.theses, profile.role);
  const recent = document.getElementById('live-recent');
  if (recent) recent.innerHTML = recentTable(data.recent, profile);
  const unread = document.getElementById('live-unread');
  if (unread) unread.textContent = String(data.unread);
  const grid = document.getElementById('dashboard-research-grid');
  if (grid) grid.innerHTML = publishedCards(data.published);
  const count = document.getElementById('dashboard-research-count');
  if (count) count.textContent = String(data.published.length);
}

export function mount({ profile }) {
  bindSearch();
  let timer = null;
  let disposed = false;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (disposed) return;
      try {
        const data = await getDashboardData(profile);
        if (disposed) return;
        updateDashboard(data, profile);
        bindSearch();
      } catch (error) {
        console.error('Live dashboard refresh failed:', error);
      }
    }, 120);
  };

  const unsubscribers = [
    subscribeCollection('theses', refresh),
    subscribeCollection('publishedTheses', refresh),
    subscribeValue(`notifications/${profile.uid}`, refresh),
  ];
  if (profile.role === 'admin') unsubscribers.push(subscribeCollection('users', refresh));

  return () => {
    disposed = true;
    clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  };
}
