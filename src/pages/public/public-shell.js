import { icon } from '../../components/icons.js';

export function renderPublicHeader({ currentUser = null, active = 'repository' } = {}) {
  return `<div class="ssu-utility-bar">
    <div class="ssu-site-width ssu-utility-inner">
      <span>Official Thesis Repository · College of Arts and Sciences · Samar State University</span>
      <nav aria-label="University quick links">
        <a href="https://www.ssu.edu.ph/" target="_blank" rel="noopener">SSU Website</a>
        <a href="https://www.ssu.edu.ph/research-and-extension/" target="_blank" rel="noopener">Research &amp; Extension</a>
      </nav>
    </div>
  </div>

  <header class="ssu-main-header" id="top">
    <div class="ssu-site-width ssu-main-header-inner">
      <a class="ssu-official-brand" href="#/repository" aria-label="SSU Repository home">
        <span class="ssu-public-logo-shell"><img src="/assets/ssu-logo.jpg" alt="Samar State University logo"></span>
        <div class="ssu-brand-copy">
          <strong>Samar State University</strong>
          <span>CAS Thesis Management &amp; Institutional Repository</span>
          <small>Research discovery and academic records portal</small>
        </div>
      </a>

      <button class="ssu-public-menu-button" type="button" id="ssu-public-menu" aria-label="Open navigation" aria-expanded="false">
        ${icon('menu', 22)}
      </button>

      <nav class="ssu-primary-nav" id="ssu-primary-nav" aria-label="Repository navigation">
        <a class="${active === 'repository' ? 'active' : ''}" href="#/repository">Research</a>
        <a class="${active === 'about' ? 'active' : ''}" href="#/about">About Repository</a>
        <a href="https://www.ssu.edu.ph/research-and-extension/" target="_blank" rel="noopener">Research &amp; Extension</a>
        ${currentUser
          ? '<a class="ssu-portal-link" href="#/dashboard">My Dashboard</a>'
          : '<a class="ssu-portal-link" href="#/login">Portal Sign In</a>'}
      </nav>
    </div>
  </header>`;
}

export function renderPublicFooter({ currentUser = null } = {}) {
  return `<footer class="ssu-public-footer compact-footer">
    <div class="ssu-site-width ssu-footer-grid compact">
      <div class="ssu-footer-brand">
        <span class="ssu-footer-logo-shell"><img src="/assets/ssu-logo.jpg" alt="Samar State University logo"></span>
        <div><strong>Samar State University</strong><span>CAS Thesis Management &amp; Institutional Repository</span></div>
      </div>
      <div>
        <h3>Repository</h3>
        <a href="#/repository">Published Research</a>
        <a href="#/about">About Repository</a>
        ${currentUser ? '<a href="#/dashboard">My Dashboard</a>' : '<a href="#/login">Portal Sign In</a>'}
      </div>
      <div>
        <h3>University</h3>
        <a href="https://www.ssu.edu.ph/" target="_blank" rel="noopener">Official Website</a>
        <a href="https://www.ssu.edu.ph/research-and-extension/" target="_blank" rel="noopener">Research &amp; Extension</a>
      </div>
    </div>
    <div class="ssu-footer-bottom"><div class="ssu-site-width">College of Arts and Sciences · Samar State University</div></div>
  </footer>`;
}

export function bindPublicNavigation() {
  const menuButton = document.getElementById('ssu-public-menu');
  const navigation = document.getElementById('ssu-primary-nav');

  const closeMenu = () => {
    navigation?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = () => {
    const open = navigation?.classList.toggle('open') || false;
    menuButton?.setAttribute('aria-expanded', String(open));
  };

  menuButton?.addEventListener('click', toggleMenu);
  navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  const onKeyDown = (event) => {
    if (event.key === 'Escape') closeMenu();
  };
  const onResize = () => {
    if (window.innerWidth > 900) closeMenu();
  };

  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize, { passive: true });

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
  };
}
