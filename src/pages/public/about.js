import { icon } from '../../components/icons.js';
import { renderPublicHeader, renderPublicFooter, bindPublicNavigation } from './public-shell.js';

export async function render({ currentUser } = {}) {
  return `<div class="ssu-public-site about-repository-page">
    ${renderPublicHeader({ currentUser, active: 'about' })}

    <main>
      <section class="about-page-hero">
        <div class="ssu-site-width">
          <p class="ssu-section-kicker">About the Repository</p>
          <h1>A structured research workflow and a searchable institutional record.</h1>
          <p>The CAS Thesis Management and Institutional Repository connects student submission, adviser review, administrator approval, publication, and research discovery in one web-based system.</p>
        </div>
      </section>

      <section class="about-page-content">
        <div class="ssu-site-width about-page-grid">
          <div class="about-page-copy">
            <p class="ssu-section-kicker navy">Purpose</p>
            <h2>Supporting research visibility, academic quality, and responsible access.</h2>
            <p>The repository centralizes approved College of Arts and Sciences thesis records so students, faculty members, researchers, and visitors can discover published research more efficiently.</p>
            <p>Public users can browse research metadata and abstracts. Authenticated Student, Adviser, and Administrator accounts can use the thesis portal according to their assigned role and workflow permissions.</p>

            <div class="about-principles">
              <article>${icon('repository', 24)}<div><strong>Centralized Repository</strong><span>Published research is organized in one searchable collection.</span></div></article>
              <article>${icon('review', 24)}<div><strong>Reviewed Publication</strong><span>A thesis is published only after adviser approval and final administrator approval.</span></div></article>
              <article>${icon('shield', 24)}<div><strong>Controlled Manuscript Access</strong><span>Public discovery is separated from authenticated manuscript download access.</span></div></article>
            </div>
          </div>

          <aside class="about-workflow-card">
            <p class="ssu-section-kicker">Publication Workflow</p>
            <ol>
              <li><span>01</span><div><strong>Student submission</strong><small>The student uploads research metadata and selects an active adviser.</small></div></li>
              <li><span>02</span><div><strong>Adviser review</strong><small>The selected adviser reviews, requests revision, or approves the research.</small></div></li>
              <li><span>03</span><div><strong>Administrator approval</strong><small>The administrator performs the final approval of adviser-approved research.</small></div></li>
              <li><span>04</span><div><strong>Repository publication</strong><small>The approved record becomes searchable in the public repository.</small></div></li>
            </ol>
          </aside>
        </div>
      </section>
    </main>

    ${renderPublicFooter({ currentUser })}
  </div>`;
}

export function mount() {
  return bindPublicNavigation();
}
