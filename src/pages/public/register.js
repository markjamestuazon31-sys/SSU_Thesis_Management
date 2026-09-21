import { authLayout } from '../../components/auth-layout.js';
import { registerStudent } from '../../services/auth.service.js';
import { getSubmissionResearchInstructors } from '../../services/user.service.js';
import { CAS_PROGRAMS } from '../../config/app.config.js';
import { escapeHtml, formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';

function programOptions() {
  return CAS_PROGRAMS
    .map((program) => `<option value="${escapeHtml(program)}">${escapeHtml(program)}</option>`)
    .join('');
}

function instructorOptions(instructors) {
  return instructors.map((instructor) => {
    const programs = Array.isArray(instructor.programs) ? instructor.programs : (instructor.program ? [instructor.program] : CAS_PROGRAMS);
    return `<option value="${escapeHtml(instructor.id)}"
      data-programs="${escapeHtml(programs.join('|'))}"
      data-name="${escapeHtml(instructor.displayName || 'Research Instructor')}"
      data-employee="${escapeHtml(instructor.employeeId || '')}">
      ${escapeHtml(instructor.displayName || 'Research Instructor')}${instructor.employeeId ? ` · ${escapeHtml(instructor.employeeId)}` : ''}
    </option>`;
  }).join('');
}

const currentResearchYear = new Date().getFullYear();
const latestResearchYear = currentResearchYear + 1;

export async function render() {
  const instructors = await getSubmissionResearchInstructors().catch(() => []);

  return authLayout({
    title: 'Create student account',
    subtitle: 'Select your program and Research Instructor during registration. Program Chair accounts are assigned by the administrator.',
    content: `
      <form class="form-stack" id="register-form">
        <div class="form-grid two">
          <label class="field">
            <span>Full name</span>
            <input name="displayName" autocomplete="name" required>
          </label>
          <label class="field">
            <span>Student ID</span>
            <input name="studentId" autocomplete="off" required>
          </label>
        </div>

        <label class="field">
          <span>Program</span>
          <select name="program" id="register-program" required>
            <option value="" selected disabled>Select your CAS program</option>
            ${programOptions()}
          </select>
          <small>Choose your official College of Arts and Sciences program.</small>
        </label>

        <label class="field">
          <span>Research Instructor</span>
          <select name="researchInstructorUid" id="research-instructor-select" required disabled>
            <option value="" selected>Select your program first</option>
            ${instructorOptions(instructors)}
          </select>
          <small id="research-instructor-help">Only active Research Instructors assigned to your selected program will be shown.</small>
        </label>

        <label class="field">
          <span>Department / College</span>
          <input name="department" value="College of Arts and Sciences" readonly required>
        </label>

        <label class="field">
          <span>Research title</span>
          <input name="researchTitle" minlength="5" maxlength="240" autocomplete="off" placeholder="Enter the complete research title" required>
          <small>Capitalization and extra spaces are ignored when checking for duplicates.</small>
        </label>

        <label class="field">
          <span>Research year</span>
          <input name="researchYear" type="number" inputmode="numeric" min="1900" max="${latestResearchYear}" value="${currentResearchYear}" required>
          <small>The same research title may be registered in a different year, but not twice in the same year.</small>
        </label>

        <label class="field">
          <span>Email address</span>
          <input name="email" type="email" autocomplete="email" required>
        </label>

        <label class="field">
          <span>Password</span>
          <input name="password" type="password" minlength="8" autocomplete="new-password" required>
          <small>At least 8 characters with uppercase, lowercase, and a number.</small>
        </label>

        <button class="btn btn-primary btn-block" type="submit" ${instructors.length ? '' : 'disabled'}>Create student account</button>
      </form>

      <div class="notice-box ${instructors.length ? 'info' : 'danger'}" style="margin-top:16px">
        <strong>${instructors.length ? 'Research Instructor assignment' : 'No active Research Instructor available'}</strong>
        <p>${instructors.length
          ? 'Your selected Research Instructor is saved with your account and will automatically receive every thesis submission created from this account.'
          : 'The administrator must create and activate at least one Research Instructor account before a student account can be registered.'}</p>
      </div>

      <div class="notice-box info" style="margin-top:12px">
        <strong>Unique research registration</strong>
        <p>Your research title and year are permanently linked to this student account. If that same title and year are already registered, account creation will be stopped.</p>
      </div>`,
    footer: `Already registered? <a href="#/login">Sign in</a> • <a href="#/repository">Repository</a>`
  });
}

export function mount() {
  const form = document.getElementById('register-form');
  const program = document.getElementById('register-program');
  const instructorSelect = document.getElementById('research-instructor-select');
  const help = document.getElementById('research-instructor-help');
  const submitButton = form?.querySelector('button[type="submit"]');

  const filterInstructors = () => {
    if (!program || !instructorSelect) return;
    const selectedProgram = program.value;
    let visible = 0;

    [...instructorSelect.options].forEach((option, index) => {
      if (index === 0) return;
      const programs = String(option.dataset.programs || '').split('|').filter(Boolean);
      const show = Boolean(selectedProgram) && programs.includes(selectedProgram);
      option.hidden = !show;
      option.disabled = !show;
      if (show) visible += 1;
    });

    instructorSelect.value = '';
    instructorSelect.disabled = !selectedProgram || visible === 0;
    if (submitButton) submitButton.disabled = !selectedProgram || visible === 0;
    instructorSelect.options[0].textContent = !selectedProgram
      ? 'Select your program first'
      : visible
        ? 'Select your Research Instructor'
        : 'No Research Instructor assigned to this program';

    if (help) {
      help.textContent = visible
        ? `${visible} active Research Instructor${visible === 1 ? '' : 's'} available for this program.`
        : selectedProgram
          ? 'No active Research Instructor is currently assigned to this program. Contact the administrator.'
          : 'Only active Research Instructors assigned to your selected program will be shown.';
    }
  };

  program?.addEventListener('change', filterInstructors);
  filterInstructors();

  const submit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type=submit]');
    setButtonLoading(button, true, 'Creating account...');

    try {
      await registerStudent(formDataObject(event.currentTarget));
      toast('Student account created with your selected Research Instructor.', 'success');
      location.hash = '#/dashboard';
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  };

  form?.addEventListener('submit', submit);

  return () => {
    program?.removeEventListener('change', filterInstructors);
    form?.removeEventListener('submit', submit);
  };
}
