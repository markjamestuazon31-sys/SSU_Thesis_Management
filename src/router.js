import { store } from './core/store.js';
import { renderAppShell, bindShell } from './components/app-shell.js';
import { logout } from './services/auth.service.js';
import { toast } from './components/toast.js';

import * as login from './pages/public/login.js';
import * as register from './pages/public/register.js';
import * as repository from './pages/public/repository.js';
import * as repositoryDetail from './pages/public/repository-detail.js';
import * as about from './pages/public/about.js';
import * as configuration from './pages/public/configuration.js';
import * as notFound from './pages/public/not-found.js';
import * as dashboard from './pages/shared/dashboard.js';
import * as notifications from './pages/shared/notifications.js';
import * as profilePage from './pages/shared/profile-v70.js';
import * as myTheses from './pages/student/my-theses.js';
import * as submit from './pages/student/submit.js';
import * as studentThesis from './pages/student/thesis-detail.js';
import * as studentHistory from './pages/student/history.js';
import * as assigned from './pages/adviser/assigned.js';
import * as review from './pages/adviser/review.js';
import * as adviserHistory from './pages/adviser/history.js';
import * as users from './pages/admin/users.js';
import * as assignments from './pages/admin/assignments.js';
import * as workflow from './pages/admin/workflow.js';
import * as approved from './pages/admin/approved.js';
import * as adminThesis from './pages/admin/thesis-detail.js';
import * as archive from './pages/admin/archive.js';
import * as reports from './pages/admin/reports.js';

let activePageCleanup = null;

const routes = [
  { pattern: /^\/login$/, page: login, public: true },
  { pattern: /^\/register$/, page: register, public: true },
  { pattern: /^\/repository$/, page: repository, public: true },
  { pattern: /^\/about$/, page: about, public: true },
  // Published repository records are public. Manuscript access follows the repository file rules.
  { pattern: /^\/repository\/([^/]+)$/, page: repositoryDetail, public: true, keys: ['id'] },
  { pattern: /^\/configuration$/, page: configuration, public: true },
  { pattern: /^\/dashboard$/, page: dashboard, roles: ['student', 'adviser', 'admin'] },
  { pattern: /^\/notifications$/, page: notifications, roles: ['student', 'adviser', 'admin'] },
  { pattern: /^\/profile$/, page: profilePage, roles: ['student', 'adviser', 'admin'] },
  { pattern: /^\/student\/theses$/, page: myTheses, roles: ['student'] },
  { pattern: /^\/student\/submit$/, page: submit, roles: ['student'] },
  { pattern: /^\/student\/thesis\/([^/]+)$/, page: studentThesis, roles: ['student'], keys: ['id'] },
  { pattern: /^\/student\/history$/, page: studentHistory, roles: ['student'] },
  { pattern: /^\/adviser\/assigned$/, page: assigned, roles: ['adviser'] },
  { pattern: /^\/adviser\/review\/([^/]+)$/, page: review, roles: ['adviser'], keys: ['id'] },
  { pattern: /^\/adviser\/history$/, page: adviserHistory, roles: ['adviser'] },
  { pattern: /^\/admin\/users$/, page: users, roles: ['admin'] },
  { pattern: /^\/admin\/assignments$/, page: assignments, roles: ['admin'] },
  { pattern: /^\/admin\/workflow$/, page: workflow, roles: ['admin'] },
  { pattern: /^\/admin\/approved$/, page: approved, roles: ['admin'] },
  { pattern: /^\/admin\/thesis\/([^/]+)$/, page: adminThesis, roles: ['admin'], keys: ['id'] },
  { pattern: /^\/admin\/archive$/, page: archive, roles: ['admin'] },
  { pattern: /^\/admin\/reports$/, page: reports, roles: ['admin'] },
];

function currentPath() {
  const raw = (location.hash || '#/repository').slice(1);
  return (raw.split('?')[0] || '/repository').replace(/\/$/, '') || '/repository';
}


function loginReturnPath() {
  const raw = (location.hash || '').slice(1);
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  const value = new URLSearchParams(query).get('return');
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

function matchRoute(path) {
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      const params = {};
      (route.keys || []).forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });
      return { ...route, params };
    }
  }
  return { page: notFound, public: true, params: {} };
}

function escapeForHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function renderRoute() {
  if (typeof activePageCleanup === 'function') {
    try { activePageCleanup(); } catch (error) { console.warn('Page cleanup failed:', error); }
  }
  activePageCleanup = null;

  const root = document.getElementById('app');
  const { authReady, currentUser, profile } = store.getState();
  if (!authReady) return;

  const path = currentPath();
  let route = matchRoute(path);

  if (!route.public && !currentUser) {
    const returnPath = encodeURIComponent(path);
    location.hash = `#/login?return=${returnPath}`;
    return;
  }

  if (route.roles && (!profile || !route.roles.includes(profile.role))) {
    if (!currentUser) {
      const returnPath = encodeURIComponent(path);
      location.hash = `#/login?return=${returnPath}`;
      return;
    }
    route = { page: notFound, public: true, params: {} };
  }

  if (currentUser && profile && ['/login', '/register'].includes(path)) {
    const destination = path === '/login' ? loginReturnPath() : '/dashboard';
    location.hash = `#${destination}`;
    return;
  }

  root.innerHTML = '<div class="route-loading"><span class="spinner"></span></div>';

  try {
    const context = { profile, currentUser, params: route.params, path };
    const html = await route.page.render(context);

    if (route.public) {
      root.innerHTML = html;
    } else {
      root.innerHTML = renderAppShell({ pageHtml: html, profile, currentPath: path });
      const shellCleanup = bindShell({
        onLogout: async () => {
          await logout();
          toast('Signed out.', 'success');
          location.hash = '#/repository';
        },
      });
      activePageCleanup = shellCleanup;
    }

    const pageCleanup = route.page.mount?.(context);
    if (typeof pageCleanup === 'function') {
      const shellCleanup = activePageCleanup;
      activePageCleanup = () => {
        try { pageCleanup(); } finally {
          if (typeof shellCleanup === 'function') shellCleanup();
        }
      };
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (error) {
    console.error(error);
    const message = String(error?.message || error || 'Unknown error');
    const missingIndex = /Index not defined/i.test(message) || /\.indexOn/i.test(message);

    if (missingIndex) {
      root.innerHTML = `
        <div class="config-page">
          <div class="config-card">
            <p class="eyebrow">Firebase Rules Update Required</p>
            <h1>Realtime Database index is not deployed</h1>
            <p>Your application code is working, but the Firebase Realtime Database rules currently published in the Firebase Console are older than this project.</p>
            <div class="setup-note">
              <strong>Required index for thesis records</strong>
              <code>".indexOn": ["ownerUid", "adviserUid", "status"]</code>
            </div>
            <p>Publish the included <strong>database.rules.json</strong> to Firebase Realtime Database, then refresh this page.</p>
            <div class="button-row">
              <button class="btn btn-primary" type="button" onclick="location.reload()">Retry dashboard</button>
              <a class="btn btn-secondary" href="#/repository">Public repository</a>
            </div>
            <details class="error-details"><summary>Technical details</summary><pre>${escapeForHtml(message)}</pre></details>
          </div>
        </div>`;
      return;
    }

    root.innerHTML = `<div class="config-page"><div class="config-card"><p class="eyebrow">Application Error</p><h1>Unable to load this page</h1><p>${escapeForHtml(message)}</p><a class="btn btn-primary" href="#/repository">Return to repository</a></div></div>`;
  }
}

export function startRouter() {
  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.hash = '#/repository';
  else renderRoute();
}
