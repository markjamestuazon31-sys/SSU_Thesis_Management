import { getAllUsers, setUserStatus, syncAdviserDirectory } from '../../services/user.service.js';
import { createAdviserAccount } from '../../services/auth.service.js';
import { PRIMARY_ADMIN } from '../../config/app.config.js';
import { pageHeader, roleBadge } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';

export async function render({ profile }) {
  await syncAdviserDirectory(profile.uid).catch((error) => console.warn('Adviser directory sync failed:', error));
  const users = await getAllUsers();

  return `${pageHeader(
    'User Management',
    'Students self-register. The administrator creates adviser accounts. Students choose one active adviser for each thesis submission; every account uses the same portal sign-in and receives a role-based dashboard.',
    '<button class="btn btn-primary" id="create-adviser">+ Create adviser</button>'
  )}
  <section class="panel">
    <div class="panel-body">
      <div class="notice-box info" style="margin-bottom:16px">
        <strong>Account policy</strong>
        <p>One login for all roles. Students self-register and choose an active adviser during thesis submission. Adviser accounts are created only by the administrator and automatically appear in the student adviser selector.</p>
      </div>
    </div>
    <div class="panel-body no-pad">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>User</th><th>Role</th><th>ID</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${users.map((user) => {
            const isPrimaryAdmin = user.id === PRIMARY_ADMIN.uid;
            return `<tr>
              <td><div class="table-title">${escapeHtml(user.displayName || 'Unnamed')}</div><div class="table-subtitle">${escapeHtml(user.email || '')}</div></td>
              <td>${roleBadge(user.role)}${isPrimaryAdmin ? '<div class="table-subtitle">Primary administrator</div>' : ''}</td>
              <td>${escapeHtml(user.studentId || user.employeeId || '—')}</td>
              <td><span class="status status-${user.status === 'active' ? 'published' : 'archived'}">${escapeHtml(user.status || 'active')}</span></td>
              <td>${formatDate(user.createdAt)}</td>
              <td>${isPrimaryAdmin
                ? '<span class="table-subtitle">Protected</span>'
                : `<button class="btn btn-ghost btn-sm status-toggle" data-uid="${user.id}" data-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? 'Disable' : 'Activate'}</button>`}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

export function mount({ profile }) {
  document.getElementById('create-adviser')?.addEventListener('click', () => openModal({
    title: 'Create adviser account',
    body: `
      <form id="create-adviser-form" class="form-stack">
        <div class="notice-box info">
          <strong>Adviser account</strong>
          <p>This creates an Adviser account in Firebase Authentication and its role profile in Realtime Database. The adviser then uses the same portal login and is routed to the Adviser dashboard.</p>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Full name</span><input name="displayName" required></label>
          <label class="field"><span>Employee ID</span><input name="employeeId" required></label>
        </div>
        <label class="field"><span>Department / College</span><input name="department" value="College of Arts and Sciences" required></label>
        <label class="field"><span>Email address</span><input name="email" type="email" required></label>
        <label class="field"><span>Temporary password</span><input name="password" type="password" minlength="8" required><small>The adviser can change this password after signing in.</small></label>
        <button class="btn btn-primary" type="submit">Create adviser account</button>
      </form>`
  }));

  document.getElementById('modal-root')?.addEventListener('submit', async (event) => {
    if (event.target.id !== 'create-adviser-form') return;
    event.preventDefault();
    const button = event.target.querySelector('button[type=submit]');
    setButtonLoading(button, true, 'Creating adviser...');

    try {
      await createAdviserAccount(profile.uid, formDataObject(event.target));
      closeModal();
      toast('Adviser account created successfully.', 'success');
      location.hash = `#/admin/users?refresh=${Date.now()}`;
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });

  document.querySelectorAll('.status-toggle').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await setUserStatus(profile.uid, button.dataset.uid, button.dataset.status);
        toast('User status updated.', 'success');
        location.hash = `#/admin/users?refresh=${Date.now()}`;
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
      }
    });
  });
}
