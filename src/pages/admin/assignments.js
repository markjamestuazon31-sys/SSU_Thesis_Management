import { getProgramChairs, getSubmissionResearchInstructors } from '../../services/user.service.js';
import { createProgramChairAccount, createResearchInstructorAccount } from '../../services/auth.service.js';
import { CAS_PROGRAMS } from '../../config/app.config.js';
import { pageHeader, emptyState } from '../../components/ui.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';

function programOptions() {
  return CAS_PROGRAMS.map((program) => `<option value="${escapeHtml(program)}">${escapeHtml(program)}</option>`).join('');
}

function instructorRows(instructors) {
  return instructors.map((instructor) => `<tr>
    <td><div class="table-title">${escapeHtml(instructor.displayName || 'Research Instructor')}</div></td>
    <td>${escapeHtml(instructor.employeeId || '—')}</td>
    <td>${escapeHtml(instructor.program || (instructor.programs?.length === CAS_PROGRAMS.length ? 'All CAS programs · legacy test account' : '—'))}</td>
    <td><span class="status status-published">Active</span></td>
    <td><span class="status status-under_review">Visible during student registration</span></td>
  </tr>`).join('');
}

function chairRows(chairs) {
  return chairs.map((chair) => `<tr>
    <td><div class="table-title">${escapeHtml(chair.displayName || 'Program Chair')}</div></td>
    <td>${escapeHtml(chair.employeeId || '—')}</td>
    <td>${escapeHtml(chair.program || '—')}</td>
    <td><span class="status status-published">Active</span></td>
    <td><span class="status status-under_review">Monitoring only</span></td>
  </tr>`).join('');
}

function staffForm(type) {
  const instructor = type === 'research_instructor';
  const label = instructor ? 'Research Instructor' : 'Program Chair';
  const id = instructor ? 'directory-create-instructor-form' : 'directory-create-chair-form';
  return `<form id="${id}" class="form-stack">
    <div class="notice-box info"><strong>New ${label} account</strong><p>${instructor
      ? 'Students from the selected program can choose this instructor when creating a student account.'
      : 'This Chair can view Research Instructor-approved records for the selected program. The Chair has no approval action.'}</p></div>
    <div class="form-grid two">
      <label class="field"><span>Full name</span><input name="displayName" autocomplete="name" required></label>
      <label class="field"><span>Employee ID</span><input name="employeeId" autocomplete="off" required></label>
    </div>
    <label class="field"><span>Assigned program</span><select name="program" required><option value="" selected disabled>Select CAS program</option>${programOptions()}</select></label>
    <label class="field"><span>Department / College</span><input name="department" value="College of Arts and Sciences" readonly required></label>
    <label class="field"><span>Email address</span><input name="email" type="email" autocomplete="email" required></label>
    <label class="field"><span>Password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required><small>Minimum 8 characters.</small></label>
    <button class="btn btn-primary" type="submit">Create ${label} account</button>
  </form>`;
}

export async function render() {
  const [instructors, chairs] = await Promise.all([
    getSubmissionResearchInstructors(),
    getProgramChairs(),
  ]);

  return `${pageHeader(
    'Academic Staff Directory',
    'Manage Research Instructors used during student registration and the Program Chair assigned to each course.',
    '<button class="btn btn-primary create-instructor-direct" type="button">+ Research Instructor</button><button class="btn btn-secondary create-chair-direct" type="button">+ Program Chair</button>',
  )}

  <section class="panel">
    <div class="panel-header"><div><p class="eyebrow">Research Instructor directory</p><h2>Active Research Instructors</h2><p>Students only see instructors assigned to their selected program during account creation.</p></div></div>
    <div class="panel-body no-pad">
      ${instructors.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Research Instructor</th><th>Employee ID</th><th>Assigned Program</th><th>Status</th><th>Student Access</th></tr></thead>
        <tbody>${instructorRows(instructors)}</tbody>
      </table></div>` : emptyState('No active Research Instructor accounts yet', 'Create a Research Instructor account before students register.', '<button class="btn btn-primary create-instructor-direct" type="button">Create Research Instructor</button>')}
    </div>
  </section>

  <section class="panel" style="margin-top:18px">
    <div class="panel-header"><div><p class="eyebrow">Program Chair directory</p><h2>Program Chairs by course</h2><p>A Program Chair monitors Research Instructor-approved records from the assigned course. Final approval remains with the administrator.</p></div></div>
    <div class="panel-body no-pad">
      ${chairs.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Program Chair</th><th>Employee ID</th><th>Assigned Program</th><th>Status</th><th>Authority</th></tr></thead>
        <tbody>${chairRows(chairs)}</tbody>
      </table></div>` : emptyState('No Program Chair accounts yet', 'Create one Program Chair account for each CAS program.', '<button class="btn btn-primary create-chair-direct" type="button">Create Program Chair</button>')}
    </div>
  </section>`;
}

export function mount({ profile }) {
  const instructorButtons = [...document.querySelectorAll('.create-instructor-direct')];
  const chairButtons = [...document.querySelectorAll('.create-chair-direct')];
  const modalRoot = document.getElementById('modal-root');

  const openInstructor = () => openModal({ title: 'Create Research Instructor account', body: staffForm('research_instructor') });
  const openChair = () => openModal({ title: 'Create Program Chair account', body: staffForm('program_chair') });

  const handleSubmit = async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const instructor = form.id === 'directory-create-instructor-form';
    const chair = form.id === 'directory-create-chair-form';
    if (!instructor && !chair) return;
    event.preventDefault();
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';

    const label = instructor ? 'Research Instructor' : 'Program Chair';
    const submitButton = form.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, `Creating ${label}...`);
    try {
      if (instructor) await createResearchInstructorAccount(profile.uid, formDataObject(form));
      else await createProgramChairAccount(profile.uid, formDataObject(form));
      closeModal();
      toast(`${label} account created successfully.`, 'success');
      location.hash = `#/admin/assignments?refresh=${Date.now()}`;
    } catch (error) {
      form.dataset.submitting = 'false';
      setButtonLoading(submitButton, false);
      toast(error.message || `Unable to create ${label} account.`, 'error');
    }
  };

  instructorButtons.forEach((button) => button.addEventListener('click', openInstructor));
  chairButtons.forEach((button) => button.addEventListener('click', openChair));
  modalRoot?.addEventListener('submit', handleSubmit);

  return () => {
    instructorButtons.forEach((button) => button.removeEventListener('click', openInstructor));
    chairButtons.forEach((button) => button.removeEventListener('click', openChair));
    modalRoot?.removeEventListener('submit', handleSubmit);
  };
}
