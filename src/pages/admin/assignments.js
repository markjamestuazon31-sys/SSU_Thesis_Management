import { getSubmissionAdvisers } from '../../services/user.service.js';
import { createAdviserAccount } from '../../services/auth.service.js';
import { pageHeader, emptyState } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';

function adviserRows(advisers) {
  return advisers.map((adviser) => `<tr>
    <td><div class="table-title">${escapeHtml(adviser.displayName || 'Thesis Adviser')}</div></td>
    <td>${escapeHtml(adviser.employeeId || '—')}</td>
    <td>${escapeHtml(adviser.department || 'College of Arts and Sciences')}</td>
    <td><span class="status status-published">Active</span></td>
    <td><span class="status status-under_review">Visible in adviser selector</span></td>
  </tr>`).join('');
}

export async function render() {
  const advisers = await getSubmissionAdvisers();

  return `${pageHeader(
    'Adviser Directory',
    'Students select an active administrator-created adviser when submitting each research manuscript.',
    '<button class="btn btn-primary create-adviser-direct" type="button">+ Create adviser account</button>',
  )}
  <section class="panel">
    <div class="panel-body">
      <div class="notice-box info">
        <strong>Adviser accounts</strong>
        <p>Create adviser accounts directly from this page. Newly created active advisers automatically appear in the student adviser selector.</p>
      </div>
    </div>
    <div class="panel-body no-pad">
      ${advisers.length ? `<div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Adviser</th><th>Employee ID</th><th>Department / College</th><th>Status</th><th>Student Submission Access</th></tr></thead>
          <tbody>${adviserRows(advisers)}</tbody>
        </table>
      </div>` : emptyState(
        'No active adviser accounts yet',
        'Create the first adviser account directly from this page. Active advisers will automatically appear here and in the student thesis submission form.',
        '<button class="btn btn-primary create-adviser-direct" type="button">Create adviser account</button>',
      )}
    </div>
  </section>`;
}

export function mount({ profile }) {
  const createButtons = [...document.querySelectorAll('.create-adviser-direct')];
  const modalRoot = document.getElementById('modal-root');

  const openCreateAdviserModal = () => openModal({
    title: 'Create adviser account',
    body: `
      <form id="directory-create-adviser-form" class="form-stack">
        <div class="notice-box info">
          <strong>New adviser account</strong>
          <p>The adviser will be able to sign in using the email address and password entered below.</p>
        </div>
        <div class="form-grid two">
          <label class="field">
            <span>Full name</span>
            <input name="displayName" autocomplete="name" required>
          </label>
          <label class="field">
            <span>Employee ID</span>
            <input name="employeeId" autocomplete="off" required>
          </label>
        </div>
        <label class="field">
          <span>Department / College</span>
          <input name="department" value="College of Arts and Sciences" required>
        </label>
        <label class="field">
          <span>Email address</span>
          <input name="email" type="email" autocomplete="email" required>
        </label>
        <label class="field">
          <span>Password</span>
          <input name="password" type="password" minlength="8" autocomplete="new-password" required>
          <small>Minimum 8 characters. The adviser can change the password after signing in.</small>
        </label>
        <button class="btn btn-primary" type="submit">Create adviser account</button>
      </form>`,
  });

  const handleCreateAdviserSubmit = async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'directory-create-adviser-form') return;

    event.preventDefault();

    // Protect against double clicks and duplicate submit events.
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const submitButton = form.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, 'Creating adviser...');

    try {
      await createAdviserAccount(profile.uid, formDataObject(form));
      closeModal();
      toast('Adviser account created successfully.', 'success');

      // Stay on Adviser Directory and reload its data.
      location.hash = `#/admin/assignments?refresh=${Date.now()}`;
    } catch (error) {
      form.dataset.submitting = 'false';
      setButtonLoading(submitButton, false);
      toast(error.message || 'Unable to create adviser account.', 'error');
    }
  };

  createButtons.forEach((button) => button.addEventListener('click', openCreateAdviserModal));
  modalRoot?.addEventListener('submit', handleCreateAdviserSubmit);

  return () => {
    createButtons.forEach((button) => button.removeEventListener('click', openCreateAdviserModal));
    modalRoot?.removeEventListener('submit', handleCreateAdviserSubmit);
  };
}
