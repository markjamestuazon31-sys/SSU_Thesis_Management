import { reconstructFile } from '../services/file.service.js';
import { downloadBlob } from '../utils/file.js';
import { toast } from './toast.js';

function progressLabel(progress) {
  const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
  if (progress?.phase === 'metadata') return 'Preparing download…';
  if (progress?.phase === 'assemble') return 'Preparing file…';
  if (progress?.phase === 'ready') return 'Starting download…';
  return `Downloading ${percent}%`;
}

/**
 * Binds every button carrying data-file-download to the exact file bytes stored
 * in Firebase Realtime Database. No preview, conversion, compression, or
 * browser-side document rendering is performed.
 */
export function bindRealtimeFileDownloads(root = document) {
  const buttons = [...root.querySelectorAll('[data-file-download]')];
  const bindings = [];

  for (const button of buttons) {
    const handler = async () => {
      const fileId = String(button.dataset.fileDownload || '').trim();
      if (!fileId) {
        toast('No file is linked to this record.', 'error');
        return;
      }

      const originalMarkup = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');

      try {
        const { metadata, blob } = await reconstructFile(fileId, {
          onProgress: (progress) => {
            button.textContent = progressLabel(progress);
          },
        });
        downloadBlob(blob, metadata.name || button.dataset.fileName || 'manuscript');
      } catch (error) {
        toast(error?.message || 'Unable to download the file.', 'error');
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = originalMarkup;
      }
    };

    button.addEventListener('click', handler);
    bindings.push([button, handler]);
  }

  return () => {
    for (const [button, handler] of bindings) button.removeEventListener('click', handler);
  };
}
