import { pageHeader } from '../../components/ui.js';
import { changePassword } from '../../services/auth.service.js';
import { formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';
import '../../styles/account-security-v68.css';

export async function render() {
  return `${pageHeader(
    'Account Security',
    'Manage the password used to access your SSU Thesis Portal account.'
  )}
    <div class="settings-grid settings-grid-single">
      <section class="panel account-security-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Security</p>
            <h2>Change password</h2>
          </div>
        </div>
        <div class="panel-body">
          <form id="password-form" class="form-stack">
            <label class="field">
              <span>New password</span>
              <input name="password" type="password" minlength="8" autocomplete="new-password" required>
            </label>
            <label class="field">
              <span>Confirm password</span>
              <input name="confirm" type="password" minlength="8" autocomplete="new-password" required>
            </label>
            <button class="btn btn-primary" type="submit">Update password</button>
          </form>
        </div>
      </section>
    </div>`;
}

export function mount() {
  document.getElementById('password-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formDataObject(event.currentTarget);
    if (data.password !== data.confirm) {
      toast('Passwords do not match.', 'error');
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    setButtonLoading(button, true, 'Updating...');
    try {
      await changePassword(data.password);
      event.currentTarget.reset();
      toast('Password updated.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
