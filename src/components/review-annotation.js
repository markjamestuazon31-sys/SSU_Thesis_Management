import { escapeHtml } from '../utils/dom.js';

const SAFE_ANNOTATION = /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i;

export function safeAnnotationUrl(annotation) {
  const value = String(annotation?.dataUrl || '');
  return value.length <= 500000 && SAFE_ANNOTATION.test(value) ? value : '';
}

export function reviewAnnotationMarkup(review) {
  const source = safeAnnotationUrl(review?.annotation);
  if (!source) return '';
  const pageLabel = String(review.annotation.pageLabel || '').trim();
  return `<figure class="review-annotation-card">
    <div class="review-annotation-heading"><div><strong>Visual revision markup</strong><span>${escapeHtml(pageLabel || 'Page or section not specified')}</span></div><button class="btn btn-secondary btn-sm" type="button" data-annotation-download>Download markup</button></div>
    <button class="review-annotation-preview" type="button" data-annotation-preview aria-label="Open visual revision markup">
      <img src="${escapeHtml(source)}" alt="Visual revision markup from the Research Instructor">
    </button>
  </figure>`;
}

export function bindAnnotationPreviews() {
  const handlers = [];
  let activeOverlay = null;
  const closeActive = () => {
    activeOverlay?.remove();
    activeOverlay = null;
  };
  document.querySelectorAll('[data-annotation-preview]').forEach((button) => {
    const open = () => {
      const image = button.querySelector('img');
      if (!image?.src) return;
      closeActive();
      const overlay = document.createElement('div');
      overlay.className = 'annotation-lightbox';
      overlay.innerHTML = `<div class="annotation-lightbox-inner"><button type="button" aria-label="Close visual markup">×</button><img src="${escapeHtml(image.src)}" alt="Visual revision markup"></div>`;
      activeOverlay = overlay;
      const close = closeActive;
      overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
      overlay.querySelector('button')?.addEventListener('click', close);
      document.body.appendChild(overlay);
    };
    button.addEventListener('click', open);
    handlers.push(() => button.removeEventListener('click', open));
  });
  document.querySelectorAll('[data-annotation-download]').forEach((button) => {
    const download = () => {
      const image = button.closest('.review-annotation-card')?.querySelector('img');
      if (!image?.src) return;
      const anchor = document.createElement('a');
      anchor.href = image.src;
      anchor.download = 'revision-markup.jpg';
      anchor.click();
    };
    button.addEventListener('click', download);
    handlers.push(() => button.removeEventListener('click', download));
  });
  return () => {
    handlers.forEach((dispose) => dispose());
    closeActive();
  };
}
