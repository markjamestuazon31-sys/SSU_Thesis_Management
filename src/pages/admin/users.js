import { deleteUserAccount, getAllUsers, setUserStatus, syncAcademicDirectories, isResearchInstructorRole } from '../../services/user.service.js';
import { createProgramChairAccount, createResearchInstructorAccount } from '../../services/auth.service.js';
import { CAS_PROGRAMS, PRIMARY_ADMIN } from '../../config/app.config.js';
import { pageHeader, roleBadge } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';
import '../../styles/user-management-v83.css';

function roleLabel(role) {
  if (role === 'student') return 'Student';
  if (isResearchInstructorRole(role)) return 'Research Instructor';
  if (role === 'program_chair') return 'Program Chair';
  if (role === 'admin') return 'Administrator';
  return 'Account';
}

function accountId(user) {
  return user.studentId || user.employeeId || '—';
}

function programOptions() {
  return CAS_PROGRAMS.map((program) => `<option value="${escapeHtml(program)}">${escapeHtml(program)}</option>`).join('');
}

function academicDetails(user) {
  if (user.role === 'student') {
    return `<div class="table-title">${escapeHtml(user.researchTitle || 'Research title not recorded')}</div>
      <div class="table-subtitle">${escapeHtml([user.program, user.researchYear].filter(Boolean).join(' · ') || 'Student research account')}</div>
      <div class="table-subtitle">Research Instructor: ${escapeHtml(user.researchInstructorName || user.adviserName || 'Not assigned')}</div>`;
  }

  if (isResearchInstructorRole(user.role)) {
    return `<div class="table-title">${escapeHtml(user.program || 'Legacy account · all CAS programs during testing')}</div>
      <div class="table-subtitle">Research Instructor · ${escapeHtml(user.department || 'College of Arts and Sciences')}</div>`;
  }

  if (user.role === 'program_chair') {
    return `<div class="table-title">${escapeHtml(user.program || 'Program not assigned')}</div>
      <div class="table-subtitle">Program Chair monitoring account</div>`;
  }

  return `<div class="table-title">Administration</div><div class="table-subtitle">Final approval and system management account</div>`;
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
    user.researchInstructorName,
    user.adviserName,
    roleLabel(user.role),
    user.status,
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizedRole(role) {
  return isResearchInstructorRole(role) ? 'research_instructor' : role;
}

function userRows(users) {
  return users.map((user) => {
    const isPrimaryAdmin = user.id === PRIMARY_ADMIN.uid;
    const status = user.status || 'active';
    const displayRole = normalizedRole(user.role);

    return `<tr class="user-account-row"
      data-role="${escapeHtml(displayRole || '')}"
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
      <td>${roleBadge(displayRole)}${isPrimaryAdmin ? '<div class="table-subtitle">Primary administrator</div>' : ''}${user.role === 'adviser' ? '<div class="table-subtitle">Legacy account</div>' : ''}</td>
      <td><div class="user-id-value">${escapeHtml(accountId(user))}</div><div class="table-subtitle">${user.role === 'student' ? 'Student ID' : displayRole === 'admin' ? 'Account ID' : 'Employee ID'}</div></td>
      <td>${academicDetails(user)}</td>
      <td><span class="status status-${status === 'active' ? 'published' : 'archived'}">${escapeHtml(status)}</span></td>
      <td>${formatDate(user.createdAt)}</td>
      <td class="table-action">${isPrimaryAdmin
        ? '<span class="table-subtitle">Protected</span>'
        : `<div class="user-account-actions">
            <button class="btn btn-ghost btn-sm status-toggle" data-uid="${escapeHtml(user.id)}" data-status="${status === 'active' ? 'disabled' : 'active'}">${status === 'active' ? 'Disable' : 'Activate'}</button>
            ${displayRole === 'admin' ? '' : `<button class="btn btn-danger btn-sm delete-account" data-uid="${escapeHtml(user.id)}" data-name="${escapeHtml(user.displayName || user.email || 'this account')}" data-role="${escapeHtml(roleLabel(user.role))}">Delete Account</button>`}
          </div>`}
      </td>
    </tr>`;
  }).join('');
}

export async function render({ profile }) {
  await syncAcademicDirectories(profile.uid).catch((error) => console.warn('Academic directory sync failed:', error));
  const users = await getAllUsers();
  const students = users.filter((user) => user.role === 'student').length;
  const instructors = users.filter((user) => isResearchInstructorRole(user.role)).length;
  const chairs = users.filter((user) => user.role === 'program_chair').length;
  const active = users.filter((user) => (user.status || 'active') === 'active').length;

  return `${pageHeader(
    'User Management',
    'Manage Student, Research Instructor, Program Chair, and Administrator accounts.',
    '<button class="btn btn-primary" id="create-research-instructor">+ Research Instructor</button><button class="btn btn-secondary" id="create-program-chair">+ Program Chair</button>'
  )}

  <section class="user-summary-grid" aria-label="Account summary">
    <article class="user-summary-card"><span>All accounts</span><strong>${users.length}</strong><small>Registered portal users</small></article>
    <article class="user-summary-card student"><span>Students</span><strong>${students}</strong><small>Self-registered accounts</small></article>
    <article class="user-summary-card instructor"><span>Research Instructors</span><strong>${instructors}</strong><small>Administrator-created accounts</small></article>
    <article class="user-summary-card chair"><span>Program Chairs</span><strong>${chairs}</strong><small>One active Chair per program</small></article>
    <article class="user-summary-card active"><span>Active accounts</span><strong>${active}</strong><small>Currently allowed to sign in</small></article>
  </section>

  <section class="panel user-directory-panel">
    <div class="panel-header user-directory-heading">
      <div>
        <p class="eyebrow">Account directory</p>
        <h2>Research portal accounts</h2>
        <p>Search by name, email, ID, program, department, Research Instructor, or research title.</p>
      </div>
      <div class="user-result-count" aria-live="polite"><strong id="user-result-count">${users.length}</strong><span>shown</span></div>
    </div>

    <div class="panel-body user-filter-body">
      <form class="user-filter-grid" id="user-filter-form">
        <label class="field user-filter-search"><span>Search</span><input id="user-search" name="search" type="search" placeholder="Name, email, ID, program, research..." autocomplete="off"></label>
        <label class="field"><span>Account type</span><select id="user-role-filter" name="role">
          <option value="">All account types</option>
          <option value="student">Students</option>
          <option value="research_instructor">Research Instructors</option>
          <option value="program_chair">Program Chairs</option>
          <option value="admin">Administrators</option>
        </select></label>
        <label class="field"><span>Status</span><select id="user-status-filter" name="status">
          <option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option>
        </select></label>
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
      <div class="user-filter-empty" id="user-filter-empty" hidden><strong>No accounts match these filters</strong><span>Try another search or clear the selected filters.</span></div>
    </div>
  </section>`;
}

function staffForm({ type }) {
  const instructor = type === 'research_instructor';
  const label = instructor ? 'Research Instructor' : 'Program Chair';
  const formId = instructor ? 'create-research-instructor-form' : 'create-program-chair-form';
  return `<form id="${formId}" class="form-stack">
    <div class="notice-box info">
      <strong>${label} account</strong>
      <p>${instructor
        ? 'Students in the selected program can choose this Research Instructor during student account creation.'
        : 'The Program Chair can monitor Research Instructor-approved records for this program. The Chair has no approve, reject, revise, or forward action.'}</p>
    </div>
    <div class="form-grid two">
      <label class="field"><span>Full name</span><input name="displayName" required></label>
      <label class="field"><span>Employee ID</span><input name="employeeId" required></label>
    </div>
    <label class="field"><span>Assigned program</span><select name="program" required><option value="" selected disabled>Select CAS program</option>${programOptions()}</select></label>
    <label class="field"><span>Department / College</span><input name="department" value="College of Arts and Sciences" readonly required></label>
    <label class="field"><span>Email address</span><input name="email" type="email" required></label>
    <label class="field"><span>Password</span><input name="password" type="password" minlength="8" required><small>Minimum 8 characters. The account holder can change it after signing in.</small></label>
    <button class="btn btn-primary" type="submit">Create ${label} account</button>
  </form>`;
}

export function mount({ profile }) {
  const createInstructorButton = document.getElementById('create-research-instructor');
  const createChairButton = document.getElementById('create-program-chair');
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
      body: `<form id="delete-user-form" class="form-stack">
        <input type="hidden" name="uid" value="${escapeHtml(uid)}">
        <div class="notice-box danger user-delete-warning"><strong>Delete ${escapeHtml(role)} account?</strong><p><b>${escapeHtml(name)}</b> will be removed from the portal.</p><p>Completed thesis records are preserved. Accounts with active linked thesis records must be resolved first.</p></div>
        <div class="user-delete-auth-note"><strong>Firebase Authentication note</strong><span>This frontend removes portal data only. Deleting another user from Firebase Authentication requires a trusted Firebase Admin SDK backend or Cloud Function.</span></div>
        <div class="modal-actions user-delete-actions"><button class="btn btn-secondary" type="button" id="cancel-delete-user">Cancel</button><button class="btn btn-danger" type="submit">Delete Account</button></div>
      </form>`,
    });
  };

  const openInstructorModal = () => openModal({ title: 'Create Research Instructor account', body: staffForm({ type: 'research_instructor' }) });
  const openChairModal = () => openModal({ title: 'Create Program Chair account', body: staffForm({ type: 'program_chair' }) });

  const applyFilters = () => {
    const search = String(searchInput?.value || '').trim().toLowerCase();
    const role = String(roleFilter?.value || '');
    const status = String(statusFilter?.value || '');
    let visible = 0;
    rows.forEach((row) => {
      const show = (!search || String(row.dataset.search || '').includes(search))
        && (!role || row.dataset.role === role)
        && (!status || row.dataset.status === status);
      row.hidden = !show;
      if (show) visible += 1;
    });
    if (resultCount) resultCount.textContent = String(visible);
    if (tableWrap) tableWrap.hidden = visible === 0;
    if (emptyState) emptyState.hidden = visible !== 0;
  };

  const clearFilters = () => {
    if (filterForm instanceof HTMLFormElement) filterForm.reset();
    applyFilters();
    searchInput?.focus();
  };

  const handleCreateStaffSubmit = async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const isInstructor = form.id === 'create-research-instructor-form';
    const isChair = form.id === 'create-program-chair-form';
    if (!isInstructor && !isChair) return;
    event.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';
    const label = isInstructor ? 'Research Instructor' : 'Program Chair';
    const button = form.querySelector('button[type=submit]');
    setButtonLoading(button, true, `Creating ${label}...`);
    try {
      if (isInstructor) await createResearchInstructorAccount(profile.uid, formDataObject(form));
      else await createProgramChairAccount(profile.uid, formDataObject(form));
      closeModal();
      toast(`${label} account created successfully.`, 'success');
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

  const handleTableClick = (event) => {
    const button = event.target.closest('.delete-account');
    if (button instanceof HTMLButtonElement) openDeleteAccountModal(button);
  };
  const handleModalClick = (event) => { if (event.target?.id === 'cancel-delete-user') closeModal(); };
  const handleFilterInput = () => applyFilters();

  createInstructorButton?.addEventListener('click', openInstructorModal);
  createChairButton?.addEventListener('click', openChairModal);
  modalRoot?.addEventListener('submit', handleCreateStaffSubmit);
  modalRoot?.addEventListener('submit', handleDeleteUserSubmit);
  modalRoot?.addEventListener('click', handleModalClick);
  document.getElementById('user-table-wrap')?.addEventListener('click', handleTableClick);
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

  return () => {
    createInstructorButton?.removeEventListener('click', openInstructorModal);
    createChairButton?.removeEventListener('click', openChairModal);
    modalRoot?.removeEventListener('submit', handleCreateStaffSubmit);
    modalRoot?.removeEventListener('submit', handleDeleteUserSubmit);
    modalRoot?.removeEventListener('click', handleModalClick);
    document.getElementById('user-table-wrap')?.removeEventListener('click', handleTableClick);
    searchInput?.removeEventListener('input', handleFilterInput);
    roleFilter?.removeEventListener('change', handleFilterInput);
    statusFilter?.removeEventListener('change', handleFilterInput);
    clearFiltersButton?.removeEventListener('click', clearFilters);
  };
}
