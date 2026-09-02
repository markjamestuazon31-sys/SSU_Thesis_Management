import { icon } from './icons.js';
import { escapeHtml } from '../utils/dom.js';

const commonTop = [{ href: '/dashboard', label: 'Overview', icon: 'dashboard' }];
const commonBottom = [
  { href: '/repository', label: 'Research Repository', icon: 'repository' },
  { href: '/notifications', label: 'Notifications', icon: 'bell' },
];

const roleLinks = {
  student: [
    { href: '/student/theses', label: 'My Thesis Records', icon: 'file' },
    { href: '/student/submit', label: 'New Submission', icon: 'upload' },
    { href: '/student/history', label: 'Submission History', icon: 'clock' },
  ],
  adviser: [
    { href: '/adviser/assigned', label: 'Research Submitted to Me', icon: 'file' },
    { href: '/adviser/history', label: 'Review History', icon: 'review' },
  ],
  admin: [
    { href: '/admin/users', label: 'User Management', icon: 'users' },
    { href: '/admin/assignments', label: 'Adviser Directory', icon: 'review' },
    { href: '/admin/workflow', label: 'Thesis Review', icon: 'review' },
    { href: '/admin/approved', label: 'Approved Thesis Records', icon: 'check' },
    { href: '/admin/archive', label: 'Records Archive', icon: 'archive' },
    { href: '/admin/reports', label: 'Reports & Analytics', icon: 'chart' },
  ],
};


function profileAvatar(profile, initials, sizeClass = '') {
  const photoUrl = String(profile?.profilePhotoUrl || '');
  const validPhoto = /^data:image\/(?:jpeg|png|webp);base64,/i.test(photoUrl);
  const classes = ['avatar', sizeClass, validPhoto ? 'has-photo' : ''].filter(Boolean).join(' ');
  if (validPhoto) {
    return `<div class="${classes}"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(profile?.displayName || 'User')} profile photo"></div>`;
  }
  return `<div class="${classes}">${escapeHtml(initials)}</div>`;
}

function nav(link, path) {
  const active = path === link.href || (link.href !== '/dashboard' && path.startsWith(link.href));
  return `<a class="nav-link ${active ? 'active' : ''}" href="#${link.href}">
    <span class="nav-icon-wrap">${icon(link.icon, 18)}</span><span>${link.label}</span>
  </a>`;
}

export function renderAppShell({ pageHtml, profile, currentPath }) {
  const role = profile?.role || 'student';
  const storedName = profile?.displayName || profile?.name || profile?.email || 'SSU User';
  const name = role === 'admin' ? 'CAS Thesis Administrator' : storedName;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const roleTitle = role === 'admin' ? 'System Administrator' : role === 'adviser' ? 'Thesis Adviser' : 'Student Researcher';

  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/dashboard">
        <span class="brand-logo-wrap"><img src="/assets/cas-logo.jpg" alt="College of Arts and Sciences logo"></span>
        <div><strong>CAS Research Portal</strong><span>Thesis Management System</span></div>
      </a>

      <div class="sidebar-campus-card">
        <span>College of Arts and Sciences</span>
        <strong>Institutional Thesis Records</strong>
        <small><i></i> Realtime Database online</small>
      </div>

      <div class="sidebar-label">Main workspace</div>
      <nav class="sidebar-nav">${commonTop.map((link) => nav(link, currentPath)).join('')}</nav>

      <div class="sidebar-label">${role === 'admin' ? 'Administration' : role === 'adviser' ? 'Adviser tools' : 'Student tools'}</div>
      <nav class="sidebar-nav">${(roleLinks[role] || []).map((link) => nav(link, currentPath)).join('')}</nav>

      <div class="sidebar-label">Research access</div>
      <nav class="sidebar-nav">${commonBottom.map((link) => nav(link, currentPath)).join('')}</nav>

      <div class="sidebar-spacer"></div>
      <nav class="sidebar-nav lower-nav">
        ${nav({ href: '/profile', label: 'My Profile', icon: 'user' }, currentPath)}
      </nav>

      <div class="sidebar-user">
        ${profileAvatar(profile, initials)}
        <div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(roleTitle)}</span></div>
      </div>
    </aside>

    <div class="app-main">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-button mobile-menu" id="mobile-menu" type="button" aria-label="Open navigation">${icon('menu')}</button>
          <div class="topbar-title"><span>College of Arts and Sciences</span><strong>Thesis Record Management System</strong></div>
        </div>
        <div class="topbar-actions">
          <a class="topbar-repository-link" href="#/repository">${icon('repository', 16)} Repository</a>
          <a class="icon-button" href="#/notifications" aria-label="Notifications">${icon('bell')}</a>
          <div class="topbar-profile">${profileAvatar(profile, initials, 'small')}<div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(roleTitle)}</span></div></div>
          <button class="icon-button" id="logout-button" type="button" title="Sign out">${icon('logout')}</button>
        </div>
      </header>
      <main class="page-container">${pageHtml}</main>
      <footer class="app-footer"><span>SSU College of Arts and Sciences</span><span>Firebase Authentication + Realtime Database only</span></footer>
    </div>
    <button class="sidebar-overlay" id="sidebar-overlay" aria-label="Close navigation"></button>
  </div>`;
}

export function bindShell({ onLogout }) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuButton = document.getElementById('mobile-menu');

  const setNavigationOpen = (open) => {
    sidebar?.classList.toggle('open', open);
    overlay?.classList.toggle('show', open);
    document.body.classList.toggle('nav-open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
  };

  const closeNavigation = () => setNavigationOpen(false);
  const toggleNavigation = () => setNavigationOpen(!sidebar?.classList.contains('open'));

  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.addEventListener('click', toggleNavigation);
  overlay?.addEventListener('click', closeNavigation);

  sidebar?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 900px)').matches) closeNavigation();
    });
  });

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) closeNavigation();
  };
  const onResize = () => {
    if (window.innerWidth > 900) closeNavigation();
  };

  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize, { passive: true });
  document.getElementById('logout-button')?.addEventListener('click', onLogout);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    document.body.classList.remove('nav-open');
  };
}
