import {
  firebaseConfig,
  isFirebaseConfigured,
  saveRealtimeDatabaseURL,
} from '../../config/firebase-config.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function render() {
  if (isFirebaseConfigured()) {
    return `
      <div class="config-page">
        <div class="config-card">
          <img src="/assets/ssu-logo.jpg" alt="SSU logo">
          <p class="eyebrow">Firebase Connected</p>
          <h1>Firebase configuration is complete.</h1>
          <p>Your project is connected to <strong>${escapeHtml(firebaseConfig.projectId)}</strong>.</p>
          <a class="btn btn-primary" href="#/login">Continue to login</a>
        </div>
      </div>`;
  }

  return `
    <div class="config-page">
      <div class="config-card" style="max-width:760px">
        <img src="/assets/ssu-logo.jpg" alt="SSU logo">
        <p class="eyebrow">One Firebase Step Remaining</p>
        <h1>Connect Realtime Database</h1>
        <p>
          Your Firebase Web App values are already patched into this project for
          <strong>${escapeHtml(firebaseConfig.projectId)}</strong>.
          The screenshot you supplied does not include the Realtime Database URL,
          so paste that exact URL below.
        </p>

        <div style="margin:18px 0;padding:14px 16px;border:1px solid #d9e2ec;border-radius:12px;background:#f8fafc">
          <strong>Firebase Console:</strong><br>
          Build / Databases &amp; Storage → Realtime Database → Create database (if needed).
          Copy the URL displayed at the top of the Data page.
        </div>

        <form id="database-url-form" class="form-grid" novalidate>
          <label class="field" style="grid-column:1/-1">
            <span>Realtime Database URL</span>
            <input
              id="database-url"
              name="databaseURL"
              type="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="https://your-database-name.asia-southeast1.firebasedatabase.app"
              required
            >
          </label>
          <div id="database-url-error" class="form-error" style="display:none;grid-column:1/-1"></div>
          <div style="grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" type="submit">Save Database URL &amp; Restart</button>
          </div>
        </form>

        <hr style="margin:24px 0;border:0;border-top:1px solid #e6edf3">
        <p><strong>Also required in Firebase Console:</strong></p>
        <ol>
          <li>Authentication → Sign-in method → enable <strong>Email/Password</strong>.</li>
          <li>Authentication → Settings → Authorized domains → add <strong>localhost</strong> for local testing if it is not listed.</li>
          <li>Realtime Database → Rules → replace the rules with this project's <code>database.rules.json</code> and click Publish.</li>
        </ol>
        <div class="code-line">Project ID: ${escapeHtml(firebaseConfig.projectId)}</div>
      </div>
    </div>`;
}

export function mount() {
  const form = document.getElementById('database-url-form');
  if (!form) return;

  const input = document.getElementById('database-url');
  const errorBox = document.getElementById('database-url-error');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      saveRealtimeDatabaseURL(input.value);
      location.hash = '#/login';
      location.reload();
    } catch (error) {
      errorBox.textContent = String(error?.message || error);
      errorBox.style.display = 'block';
      input.focus();
    }
  });
}
