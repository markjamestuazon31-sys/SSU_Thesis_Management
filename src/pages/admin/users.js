import { deleteUserAccount, getAllUsers, setUserStatus, syncAdviserDirectory } from '../../services/user.service.js';
import { createAdviserAccount } from '../../services/auth.service.js';
import { PRIMARY_ADMIN } from '../../config/app.config.js';
import { pageHeader, roleBadge } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';
import '../../styles/user-management-v83.css';

function roleLabel(role) {
  if (role === 'student') return 'Student';
  if (role === 'adviser') return 'Adviser';
  if (role === 'admin') return 'Administrator';
  return 'Account';
}

function accountId(user) {
  return user.studentId || user.employeeId || '—';
}

function academicDetails(user) {
  if (user.role === 'student') {
    return `<div class="table-title">${escapeHtml(user.researchTitle || 'Research title not recorded')}</div>
      <div class="table-subtitle">${escapeHtml([user.program, user.researchYear].filter(Boolean).join(' · ') || 'Student research account')}</div>`;
  }

  if (user.role === 'adviser') {
    return `<div class="table-title">${escapeHtml(user.department || 'College of Arts and Sciences')}</div>
      <div class="table-subtitle">Adviser account</div>`;
  }

  return `<div class="table-title">Administration</div><div class="table-subtitle">System management account</div>`;
}

function searchableUserText(user) {
  return [
    user.displayName,
    user.email,
    user.studentId,
    user.employeeId,
    user.program,
    user.department,
    user.researchTitle,
    user.researchYear,
    roleLabel(user.role),
    user.status,
  ].filter(Boolean).join(' ').toLowerCase();
}

function userRows(users) {
  return users.map((user) => {
    const isPrimaryAdmin = user.id === PRIMARY_ADMIN.uid;
    const status = user.status || 'active';

    return `<tr class="user-account-row"
      data-role="${escapeHtml(user.role || '')}"
      data-status="${escapeHtml(status)}"
      data-search="${escapeHtml(searchableUserText(user))}">
      <td>
        <div class="user-identity-cell">
          <div class="user-avatar-placeholder" aria-hidden="true">${escapeHtml((user.displayName || roleLabel(user.role)).trim().charAt(0).toUpperCase() || 'U')}</div>
          <div>
            <div class="table-title">${escapeHtml(user.displayName || 'Unnamed')}</div>
            <div class="table-subtitle">${escapeHtml(user.email || '')}</div>
          </div>
        </div>
      </td>
      <td>${roleBadge(user.role)}${isPrimaryAdmin ? '<div class="table-subtitle">Primary administrator</div>' : ''}</td>
      <td><div class="user-id-value">${escapeHtml(accountId(user))}</div><div class="table-subtitle">${user.role === 'student' ? 'Student ID' : user.role === 'adviser' ? 'Employee ID' : 'Account ID'}</div></td>
      <td>${academicDetails(user)}</td>
      <td><span class="status status-${status === 'active' ? 'published' : 'archived'}">${escapeHtml(status)}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td class="table-action">${isPrimaryAdmin
        ? '<span class="table-subtitle">Protected</span>'
        : `<div class="user-account-actions">
            <button class="btn btn-ghost btn-sm status-toggle" data-uid="${escapeHtml(user.id)}" data-status="${status === 'active' ? 'disabled' : 'active'}">${status === 'active' ? 'Disable' : 'Activate'}</button>
            ${user.role === 'admin' ? '' : `<button class="btn btn-danger btn-sm delete-account" data-uid="${escapeHtml(user.id)}" data-name="${escapeHtml(user.displayName || user.email || 'this account')}" data-role="${escapeHtml(user.role || 'account')}">Delete Account</button>`}
          </div>`}
      </td>
    </tr>`;
  }).join('');
}

export async function render({ profile }) {
  await syncAdviserDirectory(profile.uid).catch((error) => console.warn('Adviser directory sync failed:', error));
  const users = await getAllUsers();
  const students = users.filter((user) => user.role === 'student').length;
  const advisers = users.filter((user) => user.role === 'adviser').length;
  const active = users.filter((user) => (user.status || 'active') === 'active').length;

  return `${pageHeader(
    'User Management',
    'Manage student, adviser, and administrator accounts from one organized directory.',
    '<button class="btn btn-primary" id="create-adviser">+ Create adviser</button>'
  )}

  <section class="user-summary-grid" aria-label="Account summary">
    <article class="user-summary-card">
      <span>All accounts</span>
      <strong>${users.length}</strong>
      <small>Registered portal users</small>
    </article>
    <article class="user-summary-card student">
      <span>Students</span>
      <strong>${students}</strong>
      <small>Self-registered accounts</small>
    </article>
    <article class="user-summary-card adviser">
      <span>Advisers</span>
      <strong>${advisers}</strong>
      <small>Administrator-created accounts</small>
    </article>
    <article class="user-summary-card active">
      <span>Active accounts</span>
      <strong>${active}</strong>
      <small>Currently allowed to sign in</small>
    </article>
  </section>

  <section class="panel user-directory-panel">
    <div class="panel-header user-directory-heading">
      <div>
        <p class="eyebrow">Account directory</p>
        <h2>Students and advisers</h2>
        <p>Search by name, email, ID, program, department, or research title, then narrow the list by account type or status.</p>
      </div>
      <div class="user-result-count" aria-live="polite"><strong id="user-result-count">${users.length}</strong><span>shown</span></div>
    </div>

    <div class="panel-body user-filter-body">
      <form class="user-filter-grid" id="user-filter-form">
        <label class="field user-filter-search">
          <span>Search</span>
          <input id="user-search" name="search" type="search" placeholder="Name, email, ID, program, department..." autocomplete="off">
        </label>
        <label class="field">
          <span>Account type</span>
          <select id="user-role-filter" name="role">
            <option value="">All account types</option>
            <option value="student">Students</option>
            <option value="adviser">Advisers</option>
            <option value="admin">Administrators</option>
          </select>
        </label>
        <label class="field">
          <span>Status</span>
          <select id="user-status-filter" name="status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <button class="btn btn-secondary user-filter-clear" id="user-filter-clear" type="button">Clear filters</button>
      </form>
    </div>

    <div class="panel-body no-pad user-table-area">
      <div class="table-wrap" id="user-table-wrap">
        <table class="data-table user-directory-table">
          <thead><tr><th>User</th><th>Account type</th><th>Institutional ID</th><th>Academic / Account details</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${userRows(users)}</tbody>
        </table>
      </div>
      <div class="user-filter-empty" id="user-filter-empty" hidden>
        <strong>No accounts match these filters</strong>
        <span>Try another search or clear the selected filters.</span>
      </div>
    </div>
  </section>`;
}

export function mount({ profile }) {
  const createButton = document.getElementById('create-adviser');
  const modalRoot = document.getElementById('modal-root');
  const filterForm = document.getElementById('user-filter-form');
  const searchInput = document.getElementById('user-search');
  const roleFilter = document.getElementById('user-role-filter');
  const statusFilter = document.getElementById('user-status-filter');
  const clearFiltersButton = document.getElementById('user-filter-clear');
  const resultCount = document.getElementById('user-result-count');
  const tableWrap = document.getElementById('user-table-wrap');
  const emptyState = document.getElementById('user-filter-empty');
  const rows = [...document.querySelectorAll('.user-account-row')];

  const openDeleteAccountModal = (button) => {
    const uid = String(button?.dataset?.uid || '');
    const name = String(button?.dataset?.name || 'this account');
    const role = String(button?.dataset?.role || 'account');
    if (!uid) return;

    openModal({
      title: 'Delete account',
      body: `
        <form id="delete-user-form" class="form-stack">
          <input type="hidden" name="uid" value="${escapeHtml(uid)}">
          <div class="notice-box danger user-delete-warning">
            <strong>Delete ${escapeHtml(role)} account?</strong>
            <p><b>${escapeHtml(name)}</b> will be removed from the portal. This action cannot be undone from User Management.</p>
            <p>Completed thesis records are preserved. Accounts with active thesis records must be resolved first.</p>
          </div>
          <div class="user-delete-auth-note">
            <strong>Firebase Authentication note</strong>
            <span>This frontend can remove portal access and account data, but deleting the Firebase Authentication identity itself requires a secure Firebase Admin SDK backend or Cloud Function.</span>
          </div>
          <div class="modal-actions user-delete-actions">
            <button class="btn btn-secondary" type="button" id="cancel-delete-user">Cancel</button>
            <button class="btn btn-danger" type="submit">Delete Account</button>
          </div>
        </form>`
    });
  };

  const openCreateAdviserModal = () => openModal({
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
        <label class="field"><span>Password</span><input name="password" type="password" minlength="8" required><small>Minimum 8 characters. The adviser can change the password after signing in.</small></label>
        <button class="btn btn-primary" type="submit">Create adviser account</button>
      </form>`
  });

  const applyFilters = () => {
    const search = String(searchInput?.value || '').trim().toLowerCase();
    const role = String(roleFilter?.value || '');
    const status = String(statusFilter?.value || '');
    let visible = 0;

    rows.forEach((row) => {
      const matchesSearch = !search || String(row.dataset.search || '').includes(search);
      const matchesRole = !role || row.dataset.role === role;
      const matchesStatus = !status || row.dataset.status === status;
      const show = matchesSearch && matchesRole && matchesStatus;
      row.hidden = !show;
      if (show) visible += 1;
    });

    if (resultCount) resultCount.textContent = String(visible);
    if (tableWrap) tableWrap.hidden = visible === 0;
    if (emptyState) emptyState.hidden = visible !== 0;
  };

  const handleFilterInput = () => applyFilters();
  const clearFilters = () => {
    if (filterForm instanceof HTMLFormElement) filterForm.reset();
    applyFilters();
    searchInput?.focus();
  };

  const handleCreateAdviserSubmit = async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'create-adviser-form') return;

    event.preventDefault();

    // Prevent repeated submit events from creating duplicate adviser records.
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const button = form.querySelector('button[type=submit]');
    setButtonLoading(button, true, 'Creating adviser...');

    try {
      await createAdviserAccount(profile.uid, formDataObject(form));
      closeModal();
      toast('Adviser account created successfully.', 'success');
      location.hash = `#/admin/users?refresh=${Date.now()}`;
    } catch (error) {
      form.dataset.submitting = 'false';
      toast(error.message, 'error');
      setButtonLoading(button, false);
    }
  };

  const handleDeleteUserSubmit = async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'delete-user-form') return;

    event.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const uid = String(form.querySelector('input[name="uid"]')?.value || '');
    const button = form.querySelector('button[type=submit]');
    setButtonLoading(button, true, 'Deleting account...');

    try {
      await deleteUserAccount(profile.uid, uid);
      closeModal();
      toast('Account removed from the portal.', 'success');
      location.hash = `#/admin/users?refresh=${Date.now()}`;
    } catch (error) {
      form.dataset.submitting = 'false';
      toast(error.message, 'error');
      setButtonLoading(button, false);
    }
  };

  const handleDeleteAccountClick = (event) => {
    const button = event.target.closest('.delete-account');
    if (!(button instanceof HTMLButtonElement)) return;
    openDeleteAccountModal(button);
  };

  const handleDeleteModalClick = (event) => {
    if (event.target?.id === 'cancel-delete-user') closeModal();
  };

  createButton?.addEventListener('click', openCreateAdviserModal);
  modalRoot?.addEventListener('submit', handleCreateAdviserSubmit);
  modalRoot?.addEventListener('submit', handleDeleteUserSubmit);
  modalRoot?.addEventListener('click', handleDeleteModalClick);
  document.getElementById('user-table-wrap')?.addEventListener('click', handleDeleteAccountClick);
  searchInput?.addEventListener('input', handleFilterInput);
  roleFilter?.addEventListener('change', handleFilterInput);
  statusFilter?.addEventListener('change', handleFilterInput);
  clearFiltersButton?.addEventListener('click', clearFilters);

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

  // modal-root persists between routes, so remove its handler during cleanup.
  return () => {
    createButton?.removeEventListener('click', openCreateAdviserModal);
    modalRoot?.removeEventListener('submit', handleCreateAdviserSubmit);
    modalRoot?.removeEventListener('submit', handleDeleteUserSubmit);
    modalRoot?.removeEventListener('click', handleDeleteModalClick);
    document.getElementById('user-table-wrap')?.removeEventListener('click', handleDeleteAccountClick);
    searchInput?.removeEventListener('input', handleFilterInput);
    roleFilter?.removeEventListener('change', handleFilterInput);
    statusFilter?.removeEventListener('change', handleFilterInput);
    clearFiltersButton?.removeEventListener('click', clearFilters);
  };
}
