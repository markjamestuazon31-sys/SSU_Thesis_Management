import { authLayout } from '../../components/auth-layout.js';
import { registerStudent } from '../../services/auth.service.js';
import { CAS_PROGRAMS } from '../../config/app.config.js';
import { formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';

function programOptions() {
  return CAS_PROGRAMS
    .map((program) => `<option value="${program}">${program}</option>`)
    .join('');
}

const currentResearchYear = new Date().getFullYear();
const latestResearchYear = currentResearchYear + 1;

export async function render() {
  return authLayout({
    title: 'Create student account',
    subtitle: 'Students may self-register. Adviser accounts are created only by the administrator.',
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
          <select name="program" required>
            <option value="" selected disabled>Select your CAS program</option>
            ${programOptions()}
          </select>
          <small>Choose your official College of Arts and Sciences program.</small>
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

        <button class="btn btn-primary btn-block" type="submit">Create student account</button>
      </form>

      <div class="notice-box info" style="margin-top:16px">
        <strong>Unique research registration</strong>
        <p>Your research title and year are permanently linked to this student account. If that same title and year are already registered, account creation will be stopped.</p>
      </div>`,
    footer: `Already registered? <a href="#/login">Sign in</a> • <a href="#/repository">Repository</a>`
  });
}

export function mount() {
  document.getElementById('register-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type=submit]');
    setButtonLoading(button, true, 'Creating account...');

    try {
      await registerStudent(formDataObject(event.currentTarget));
      toast('Student account created. You can now submit research and choose an active adviser.', 'success');
      location.hash = '#/dashboard';
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
