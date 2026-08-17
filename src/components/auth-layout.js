import '../styles/auth-campus-v67.css';

export function authLayout({ title, subtitle, content, footer = '' }) {
  return `
    <div class="auth-page auth-page-campus">
      <section class="auth-brand-panel auth-brand-panel-campus">
        <div class="auth-brand-overlay"></div>
        <div class="auth-brand-top auth-brand-top-campus">
          <img src="/assets/ssu-logo.jpg" alt="SSU logo">
          <img src="/assets/cas-logo.jpg" alt="CAS logo">
        </div>

        <div class="auth-brand-copy auth-brand-copy-campus">
          <p class="eyebrow light">Samar State University</p>
          <h1>Research made<br>organized,<br>reviewed, and<br>accessible.</h1>
        </div>

        <div class="auth-brand-foot auth-brand-foot-campus">
          College of Arts and Sciences • Thesis Management System
        </div>
      </section>

      <main class="auth-form-panel auth-form-panel-campus">
        <div class="auth-card auth-card-campus">
          <div class="auth-mobile-logo auth-mobile-logo-campus">
            <img src="/assets/ssu-logo.jpg" alt="SSU logo">
            <img src="/assets/cas-logo.jpg" alt="CAS logo">
          </div>
          <p class="eyebrow">SSU Thesis Portal</p>
          <h2>${title}</h2>
          <p class="auth-subtitle">${subtitle}</p>
          ${content}
          ${footer ? `<div class="auth-footer">${footer}</div>` : ''}
        </div>
      </main>
    </div>`;
}
