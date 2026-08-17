import { getSubmissionAdvisers } from '../../services/user.service.js';
import { pageHeader, emptyState } from '../../components/ui.js';
import { escapeHtml } from '../../utils/dom.js';

export async function render() {
  const advisers = await getSubmissionAdvisers();

  return `${pageHeader(
    'Adviser Directory',
    'Students select an active administrator-created adviser when submitting each research manuscript.',
    '<a class="btn btn-primary" href="#/admin/users">+ Create adviser account</a>',
  )}
  <section class="panel">
    <div class="panel-body">
      <div class="notice-box info">
        <strong>Revised adviser workflow</strong>
        <p>The administrator no longer assigns one adviser to a student profile. Instead, the administrator creates adviser accounts. During thesis submission, the student chooses one active adviser from this directory. That adviser reviews the selected research and can approve it for final administrator approval.</p>
      </div>
    </div>
    <div class="panel-body no-pad">
      ${advisers.length ? `<div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Adviser</th><th>Employee ID</th><th>Department / College</th><th>Status</th><th>Student Submission Access</th></tr></thead>
          <tbody>${advisers.map((adviser) => `<tr>
            <td><div class="table-title">${escapeHtml(adviser.displayName || 'Thesis Adviser')}</div></td>
            <td>${escapeHtml(adviser.employeeId || '—')}</td>
            <td>${escapeHtml(adviser.department || 'College of Arts and Sciences')}</td>
            <td><span class="status status-published">Active</span></td>
            <td><span class="status status-under_review">Visible in adviser selector</span></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : emptyState(
        'No active adviser accounts yet',
        'Create adviser accounts in User Management. Active advisers will automatically appear here and in the student thesis submission form.',
        '<a class="btn btn-primary" href="#/admin/users">Create adviser account</a>',
      )}
    </div>
  </section>`;
}

export function mount() {}
