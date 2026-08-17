import { authLayout } from '../../components/auth-layout.js';
import { login, requestPasswordReset } from '../../services/auth.service.js';
import { formDataObject, setButtonLoading } from '../../utils/dom.js';
import { toast } from '../../components/toast.js';
import { openModal, closeModal } from '../../components/modal.js';

function requestedReturnPath() {
  const query = (location.hash.split('?')[1] || '');
  const params = new URLSearchParams(query);
  const value = params.get('return');
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export async function render() {
  return authLayout({
    title: 'Welcome back',
    subtitle: 'One secure portal sign-in for students, advisers, and administrators.',
    content: `
      

      <form class="form-stack" id="login-form">
        <label class="field">
          <span>Email address</span>
          <input name="email" type="email" autocomplete="email" required placeholder="name@ssu.edu.ph">
        </label>
        <label class="field">
          <span>Password</span>
          <input name="password" type="password" autocomplete="current-password" required placeholder="Enter your password">
        </label>
        <div class="form-row between">
          <label class="checkbox"><input type="checkbox" checked disabled><span>Keep me signed in</span></label>
          <button class="link-button" type="button" id="forgot-password">Forgot password?</button>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
      </form>

      <div class="auth-divider"><span>Student registration</span></div>
      <a class="btn btn-secondary btn-block" href="#/register">Create student account</a>

      <p class="auth-help-text" style="text-align:center;margin:14px 0 0;color:var(--muted, #667085);font-size:13px">
        Administrator and adviser accounts do not register here. They use the same sign-in form above.
      </p>

      <a class="text-link centered" href="#/repository">← Back to public repository</a>`
  });
}

export function mount() {
  document.getElementById('login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type=submit]');
    setButtonLoading(button, true, 'Signing in...');

    try {
      const data = formDataObject(event.currentTarget);
      const result = await login(data.email, data.password);
      const returnPath = requestedReturnPath();

      // All roles use one login. The shared /dashboard renders the correct
      // role-specific workspace for student, adviser, or administrator.
      location.hash = `#${returnPath}`;
      toast(`Signed in as ${result.profile.role}.`, 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });

  document.getElementById('forgot-password')?.addEventListener('click', () => openModal({
    title: 'Reset password',
    body: `<form id="reset-form" class="form-stack"><label class="field"><span>Email address</span><input name="email" type="email" required placeholder="name@ssu.edu.ph"></label><button class="btn btn-primary" type="submit">Send reset email</button></form>`
  }));

  document.getElementById('modal-root')?.addEventListener('submit', async (event) => {
    if (event.target.id !== 'reset-form') return;
    event.preventDefault();
    const data = formDataObject(event.target);
    try {
      await requestPasswordReset(data.email);
      closeModal();
      toast('Password reset email sent.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}
