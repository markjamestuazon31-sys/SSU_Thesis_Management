import { getReportData } from '../../services/report.service.js';
import { subscribeCollection } from '../../services/db.service.js';
import { pageHeader, statCard } from '../../components/ui.js';
import { downloadText } from '../../utils/file.js';
import { csvEscape, titleCase } from '../../utils/format.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

export async function render() {
  const data = await getReportData();
  return `${pageHeader(
    'Reports & Live Analytics',
    'Realtime monitoring of thesis workflow, publication, programs, and system users.',
    '<button class="btn btn-secondary" id="export-csv">Export thesis CSV</button>'
  )}
  <div class="analytics-live-banner"><span class="live-dot"></span><div><strong>Live monitoring enabled</strong><span>Statistics refresh automatically from Firebase Realtime Database.</span></div><span class="analytics-db-label">RTDB</span></div>
  <div id="reports-live-content">${reportContent(data)}</div>`;
}

function reportContent(data) {
  const cards = [
    statCard({ label: 'Total Thesis Records', value: String(data.theses.length), iconName: 'file', helper: 'Centralized records' }),
    statCard({ label: 'Active Workflow', value: String(data.activeWorkflow), iconName: 'review', helper: 'In process' }),
    statCard({ label: 'Published Research', value: String(data.published), iconName: 'repository', helper: `${data.publicationRate}% publication rate` }),
    statCard({ label: 'Active System Users', value: String(data.users.filter((user) => user.status === 'active').length), iconName: 'users', helper: 'Students, advisers, admin' }),
  ];

  return `<div class="stats-grid analytics-stats">${cards.join('')}</div>
    <div class="analytics-grid">
      <section class="panel analytics-panel">
        <div class="panel-header"><div><h2>Workflow distribution</h2><p>Current thesis records by processing status.</p></div></div>
        <div class="panel-body report-bars">${barRows(data.statuses, data.theses.length, true)}</div>
      </section>
      <section class="panel analytics-panel">
        <div class="panel-header"><div><h2>Records by program</h2><p>Research volume across CAS programs.</p></div></div>
        <div class="panel-body report-bars">${barRows(data.programs, data.theses.length)}</div>
      </section>
      <section class="panel analytics-panel">
        <div class="panel-header"><div><h2>User role distribution</h2><p>Accounts managed by system role.</p></div></div>
        <div class="panel-body analytics-role-grid">${roleCards(data.roles)}</div>
      </section>
      <section class="panel analytics-panel">
        <div class="panel-header"><div><h2>Research by year</h2><p>Thesis record distribution based on research year.</p></div></div>
        <div class="panel-body report-bars">${barRows(data.years, data.theses.length)}</div>
      </section>
    </div>
   `;
}

function barRows(entries, total, formatStatus = false) {
  const rows = Object.entries(entries).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<div class="empty-state"><h3>No report data yet</h3><p>Statistics will appear as thesis records are created.</p></div>';
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return rows.map(([key, value]) => `<div class="report-row">
    <span>${escapeHtml(formatStatus ? titleCase(key) : key)}</span>
    <div class="bar"><i style="width:${Math.max(value ? 5 : 0, (value / max) * 100)}%"></i></div>
    <strong>${value}</strong><small>${total ? Math.round((value / total) * 100) : 0}%</small>
  </div>`).join('');
}

function roleCards(roles) {
  const labels = { admin: 'Administrators', adviser: 'Advisers', student: 'Students' };
  return ['student', 'adviser', 'admin'].map((role) => `<article>
    <div class="analytics-role-icon">${icon(role === 'student' ? 'user' : role === 'adviser' ? 'review' : 'shield', 20)}</div>
    <div><strong>${roles[role] || 0}</strong><span>${labels[role]}</span></div>
  </article>`).join('');
}

export function mount() {
  document.getElementById('export-csv')?.addEventListener('click', async () => {
    const data = await getReportData();
    const header = ['Title', 'Student', 'Program', 'Adviser', 'Status', 'Year', 'Academic Year'];
    const lines = [
      header.map(csvEscape).join(','),
      ...data.theses.map((thesis) => [
        thesis.title,
        thesis.studentName,
        thesis.program,
        thesis.adviserName,
        thesis.status,
        thesis.year,
        thesis.academicYear,
      ].map(csvEscape).join(',')),
    ];
    downloadText(lines.join('\n'), 'ssu-thesis-report.csv', 'text/csv;charset=utf-8');
  });

  let timer = null;
  let disposed = false;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (disposed) return;
      try {
        const data = await getReportData();
        const wrap = document.getElementById('reports-live-content');
        if (wrap) wrap.innerHTML = reportContent(data);
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
    unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  };
}
