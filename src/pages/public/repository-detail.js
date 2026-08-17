import { getPublishedThesis } from '../../services/thesis.service.js';
import { reconstructFile } from '../../services/file.service.js';
import { downloadBlob } from '../../utils/file.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatDate } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';
import { renderPublicHeader, renderPublicFooter, bindPublicNavigation } from './public-shell.js';

function keywordChips(value) {
  const keywords = String(value || '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  if (!keywords.length) return '<span class="scholar-keyword-empty">No keywords provided</span>';
  return keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('');
}

export async function render({ params, currentUser }) {
  const thesis = await getPublishedThesis(params.id);

  if (!thesis) {
    return `<div class="ssu-public-site">
      ${renderPublicHeader({ currentUser, active: 'repository' })}
      <main class="public-record-page"><div class="ssu-site-width"><div class="public-record-not-found"><h1>Repository record not found</h1><p>This research may have been removed from publication.</p><a class="btn btn-primary" href="#/repository">Back to research</a></div></div></main>
      ${renderPublicFooter({ currentUser })}
    </div>`;
  }

  const authors = thesis.authors || thesis.studentName || 'Author not specified';
  const fileButton = thesis.currentFileId
    ? `<button class="btn btn-primary" id="download-file" data-file="${escapeHtml(thesis.currentFileId)}">${icon('download')} Download manuscript</button>`
    : '<button class="btn btn-muted" disabled>Manuscript unavailable</button>';

  return `<div class="ssu-public-site public-research-detail-page public-research-detail-page-v62">
    ${renderPublicHeader({ currentUser, active: 'repository' })}
    <main class="public-record-page public-record-page-v62">
      <div class="ssu-site-width public-record-layout public-record-layout-v62">
        <a class="public-record-back" href="#/repository">← Back to research results</a>

        <article class="public-record-card public-record-card-v62">
          <div class="public-record-hero-row public-record-hero-row-v62">
            <div class="public-record-headline">
              <p class="ssu-section-kicker navy">Published Thesis Record</p>
              <h1>${escapeHtml(thesis.title || 'Untitled Research')}</h1>
              <p class="public-record-authors">${escapeHtml(authors)}</p>
              <p class="public-record-source">Samar State University · ${escapeHtml(thesis.program || 'Program not specified')} · ${escapeHtml(thesis.year || '—')}</p>
            </div>
            <div class="public-record-year-badge">${escapeHtml(thesis.year || '—')}</div>
          </div>

          <div class="public-record-meta-grid public-record-meta-grid-large public-record-meta-grid-v62">
            <div><span>Program</span><strong>${escapeHtml(thesis.program || '—')}</strong></div>
            <div><span>Adviser</span><strong>${escapeHtml(thesis.adviserName || '—')}</strong></div>
            <div><span>Academic Year</span><strong>${escapeHtml(thesis.academicYear || '—')}</strong></div>
            <div><span>Published</span><strong>${formatDate(thesis.publishedAt)}</strong></div>
            <div><span>College / Department</span><strong>${escapeHtml(thesis.department || 'College of Arts and Sciences')}</strong></div>
            <div><span>Researchers</span><strong>${escapeHtml(authors)}</strong></div>
          </div>

          <section class="public-record-section public-record-section-v62">
            <h2>Abstract</h2>
            <p>${escapeHtml(thesis.abstract || 'No abstract provided.')}</p>
          </section>

          <section class="public-record-section public-record-section-v62">
            <h2>Keywords</h2>
            <div class="scholar-keywords public-record-keywords">${keywordChips(thesis.keywords)}</div>
          </section>

          <section class="public-manuscript-access public-manuscript-access-v62">
            <div>
              <span class="public-access-icon">${icon('download', 22)}</span>
              <div>
                <h2>Public manuscript access</h2>
                <p>This published thesis is publicly accessible. Anyone may download the repository manuscript when a file is available.</p>
              </div>
            </div>
            ${fileButton}
          </section>
        </article>
      </div>
    </main>
    ${renderPublicFooter({ currentUser })}
  </div>`;
}

export function mount() {
  const cleanups = [];
  const navigationCleanup = bindPublicNavigation();
  if (navigationCleanup) cleanups.push(navigationCleanup);

  const button = document.getElementById('download-file');
  const downloadHandler = async (event) => {
    const target = event.currentTarget;
    target.disabled = true;
    const original = target.innerHTML;
    target.textContent = 'Preparing download...';

    try {
      const { metadata, blob } = await reconstructFile(target.dataset.file);
      downloadBlob(blob, metadata.name || 'manuscript');
      toast('Research manuscript downloaded.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      target.disabled = false;
      target.innerHTML = original;
    }
  };

  button?.addEventListener('click', downloadHandler);
  cleanups.push(() => button?.removeEventListener('click', downloadHandler));

  return () => cleanups.forEach((cleanup) => cleanup());
}
