import { isFirebaseConfigured } from './config/firebase-config.js';
import { firebaseReady } from './config/firebase.js';
import { renderSplash } from './pages/public/splash.js';
import { store } from './core/store.js';
import { ensurePrimaryAdminProfile, getUserProfile, subscribeToAuth, logout } from './services/auth.service.js';
import { startRouter, renderRoute } from './router.js';

const app = document.getElementById('app');
const started = Date.now();
const minimumSplash = 0;

function showFatalError(error) {
  console.error('Application startup failed:', error);
  app.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#102a43">
      <div style="width:min(720px,100%);background:#fff;border:1px solid #d9e2ec;border-radius:18px;padding:28px;box-shadow:0 18px 45px rgba(16,42,67,.10)">
        <div style="font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#b42318">Startup Error</div>
        <h1 style="margin:8px 0 12px;font-size:28px">SSU Thesis Management could not start.</h1>
        <p style="margin:0 0 14px;line-height:1.6;color:#486581">The exact browser error is shown below. You can also open DevTools → Console.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#f8fafc;border:1px solid #e6edf3;border-radius:12px;padding:14px;overflow:auto">${escapeHtml(String(error?.message || error))}</pre>
      </div>
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function waitSplash() {
  const remaining = minimumSplash - (Date.now() - started);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function bootstrap() {
  app.innerHTML = renderSplash();

  if (!isFirebaseConfigured()) {
    await waitSplash();
    store.setState({ authReady: true, currentUser: null, profile: null });
    location.hash = '#/configuration';
    startRouter();
    return;
  }

  await firebaseReady;

  let routerStarted = false;
  subscribeToAuth(async (user) => {
    let profile = null;

    if (user) {
      profile = await ensurePrimaryAdminProfile(user).catch((error) => {
        console.error('Unable to initialize primary administrator profile:', error);
        return null;
      });

      for (let attempt = 0; attempt < 6 && !profile; attempt += 1) {
        profile = await getUserProfile(user.uid).catch((error) => {
          console.error('Unable to read user profile from Realtime Database:', error);
          return null;
        });
        if (!profile && attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      if (!profile || profile.status !== 'active') {
        await logout().catch(() => {});
        user = null;
        profile = null;
      }
    }

    await waitSplash();
    store.setState({ authReady: true, currentUser: user, profile });

    if (!routerStarted) {
      routerStarted = true;
      startRouter();
    } else {
      renderRoute();
    }
  });
}

bootstrap().catch(showFatalError);
